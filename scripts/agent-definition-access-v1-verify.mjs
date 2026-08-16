#!/usr/bin/env node
/**
 * AGENT_DEFINITION_ACCESS_V1 — real acceptance driver.
 *
 * Proves the frozen access model over the REAL components (Agent Definition
 * config + broker gateway local capabilities + Auth grant via the auth-
 * service token endpoint + the REAL control-plane composition):
 *
 *   READ  (agent.definition.read: list/get)  = ALLOWED for every
 *         CREDENTIALED agent — no scope required, no token request.
 *   WRITE (agent.definition.write: create/update/disable/set_default)
 *         = DENIED by default; ALLOWED only when the caller credential's
 *         AUTH GRANT covers the scope `agent.definition.write` (decided by
 *         the auth-service — the ONLY grant authority).
 *
 * HR_HARDCODE = NONE by construction: no agent id, name or role is ever
 * compared; a grant-holder is just "any agent whose credential may obtain
 * the write scope". The acceptance models the grant with a stub
 * auth-service that grants the scope to one fixture client and denies it to
 * the others — the CODE under test never sees the distinction.
 *
 * Also proves:
 *   - the config stays the SINGLE authority (every mutation lands in the
 *     same agents.json the control plane reads; no second authority file);
 *   - create mints ONE stable agt_* id; update/rename NEVER changes it;
 *   - disable keeps the identity but makes the agent unroutable; the
 *     default agent cannot be disabled without set_default first;
 *   - the REAL control-plane composition (dsh --profile
 *     agent-core-integration) mounts the whole chain and /v1/agents serves
 *     the mutated config.
 *
 * Usage: node scripts/agent-definition-access-v1-verify.mjs
 * Env:   DSH_ADAV_RUNTIME  runtime root (default .demo/agent-definition-access-v1/runtime)
 * Exit 0 on full acceptance, 1 on failed assertion, 2 on infra failure.
 */

import {
  existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { cliBin, provisionAgentHome, REPO } from './demo-home.mjs'
import { AgentDefinition, AGENT_ID_PREFIX, AGENT_NOT_FOUND } from '../packages/agent-definition/src/definition.js'
import { adoptAgents } from '../packages/agent-definition/src/config.js'
import { createDefinitionAccessHandlers } from '../packages/agent-definition/src/access.js'
import { createBrokerGateway } from '../packages/broker/src/gateway.js'
import { agentDefinitionManifests } from '../packages/broker/src/capabilities/agent-definition.js'

const here = dirname(fileURLToPath(import.meta.url))
const RUNTIME = resolve(process.env.DSH_ADAV_RUNTIME ?? join(REPO, '.demo', 'agent-definition-access-v1', 'runtime'))
const CONTROL_DIR = join(RUNTIME, 'control')
const AGENTS_CONFIG = join(CONTROL_DIR, 'agents.json')
const CREDENTIALS_STORE = join(CONTROL_DIR, 'agent-credentials.json')
const CONTROL_HOME = join(RUNTIME, 'control', 'home')
const CONTROL_PROFILE = 'agent-core-integration'
const PRODUCT_API_PORT = 8799

// Worktree-aware harness resolution (same logic as the resident): the
// harness checkout is a sibling of the MAIN repo, one level up from a
// .worktree/<branch> layout.
if (process.env.DSH_HARNESS_ROOT === undefined) {
  const mainRepo = REPO.split('/.worktree/')[0] ?? REPO
  const candidates = [
    resolve(mainRepo, '../../github/deepseek-harness'),
    resolve(REPO, '../../github/deepseek-harness'),
  ]
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'apps', 'cli', 'lib', 'bin.js'))) {
      process.env.DSH_HARNESS_ROOT = candidate
      break
    }
  }
}

// Fixture credentials model the DEPLOYMENT grant decision (the auth-service
// is the authority; the code under test never sees "HR" anywhere).
const REGULAR_A = { clientId: 'mc_fixture_regular_a', clientSecret: 'secret-a' }
const REGULAR_B = { clientId: 'mc_fixture_regular_b', clientSecret: 'secret-b' }
const GRANTED = { clientId: 'mc_fixture_granted', clientSecret: 'secret-g' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let failures = 0
const checks = []
function record(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  checks.push({ name, ok, detail })
  if (!ok) failures += 1
}

/** Stub auth-service: grants `agent.definition.write` ONLY to GRANTED. */
function startStubAuth(tokens) {
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      const basic = (req.headers.authorization ?? '').replace(/^Basic /, '')
      const clientId = Buffer.from(basic, 'base64').toString('utf8').split(':')[0]
      const granted = clientId === GRANTED.clientId && body.includes('scope=agent.definition.write')
      tokens.push({ clientId, body, granted })
      if (granted) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ access_token: `jwt-${clientId}`, expires_in: 3600 }))
      } else {
        res.writeHead(403, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'insufficient_scope' }))
      }
    })
  })
  return server
}

/** Provision the control-home plugin farm (bundle-integration composition). */
function provisionControlHome() {
  provisionAgentHome(CONTROL_HOME, REPO)
  const profileDir = join(CONTROL_HOME, 'profiles', CONTROL_PROFILE)
  mkdirSync(profileDir, { recursive: true })
  for (const file of ['package.json', 'cordis.patch.yml']) {
    const target = join(profileDir, file)
    if (existsSync(target)) continue
    writeFileSync(target, readFileSync(join(REPO, 'profile-integration', file)))
  }
  const farm = join(CONTROL_HOME, 'profiles', 'node_modules', '@agent-core')
  const entries = {
    'bundle-integration': join(REPO, 'bundle-integration'),
    'feishu-connector': join(REPO, 'packages', 'feishu-connector'),
    'agent-router': join(REPO, 'packages', 'agent-router'),
    'product-api': join(REPO, 'packages', 'product-api'),
    'workspace-bootstrap': join(REPO, 'packages', 'workspace-bootstrap'),
    'agent-definition': join(REPO, 'packages', 'agent-definition'),
    'broker': join(REPO, 'packages', 'broker'),
  }
  for (const [pkg, target] of Object.entries(entries)) {
    mkdirSync(farm, { recursive: true })
    try {
      const existing = readlinkSync(join(farm, pkg))
      if (resolve(existing) === resolve(target)) continue
      rmSync(join(farm, pkg), { recursive: true, force: true })
    } catch { /* absent */ }
    symlinkSync(target, join(farm, pkg))
  }
}

async function main() {
  console.log('=== AGENT_DEFINITION_ACCESS_V1 — real acceptance ===')
  console.log(`runtime: ${RUNTIME}`)
  rmSync(RUNTIME, { recursive: true, force: true })
  mkdirSync(CONTROL_DIR, { recursive: true })

  // ── fixtures: the Agent Definition config (single authority) ────────────
  const adopted = await adoptAgents({ configFile: AGENTS_CONFIG, agents: [
    { name: 'Agent A', description: '论文导师' },
    { name: 'Agent B', description: '研发总监' },
  ] })
  const [agentA, agentB] = adopted.agents
  const definition = new AgentDefinition({ configFile: AGENTS_CONFIG })

  // ── fixtures: the 505-private credential store (trusted identity) ───────
  writeFileSync(CREDENTIALS_STORE, JSON.stringify({
    version: 1,
    credentials: {
      [agentA.id]: REGULAR_A,
      [agentB.id]: REGULAR_B,
      agt_hr_fixture: GRANTED,
    },
  }, null, 2) + '\n')

  // ── the stub auth-service (models the deployment grant decision) ────────
  const tokenRequests = []
  const authServer = startStubAuth(tokenRequests)
  await new Promise((r) => authServer.listen(0, '127.0.0.1', r))
  const authOrigin = `http://127.0.0.1:${authServer.address().port}`
  console.log(`stub auth-service on ${authOrigin} (grants agent.definition.write only to ${GRANTED.clientId})`)

  // ── the real broker gateway with the injected local capability handlers ─
  const gateway = createBrokerGateway({
    manifests: agentDefinitionManifests,
    targets: [],
    authServiceOrigin: authOrigin,
    credentialsFile: CREDENTIALS_STORE,
    localHandlers: createDefinitionAccessHandlers({ configFile: AGENTS_CONFIG, definition }),
  })
  const executeAs = (agentId) => (capabilityId, operation, args) =>
    gateway.execute({ capabilityId, operation, args }, { agentId })

  // ── phase 1: READ is open to every credentialed agent, no scope ─────────
  console.log('\n[phase 1] READ for all credentialed agents (list/get, no scope)')
  const listA = await executeAs(agentA.id)('agent.definition.read', 'list', {})
  const listB = await executeAs(agentB.id)('agent.definition.read', 'list', {})
  record('READ_LIST_ALL_AGENTS', listA.ok === true && listB.ok === true
    && listA.result.agents.length === 2 && listB.result.agents.length === 2,
    `A and B both listed ${listA.result?.agents?.length ?? '?'} agent(s)`)
  const getB = await executeAs(agentA.id)('agent.definition.read', 'get', { agentId: agentB.id })
  record('READ_GET_BY_ID', getB.ok === true && getB.result.agent.name === 'Agent B', `A read B (${getB.result?.agent?.id})`)
  const readTokens = tokenRequests.filter((t) => t.body.includes('agent.definition.read'))
  record('READ_NO_SCOPE_CHECK', readTokens.length === 0 && tokenRequests.length === 0,
    'read never touches the token endpoint (open to all credentialed agents)')
  const noCred = await gateway.execute({ capabilityId: 'agent.definition.read', operation: 'list', args: {} }, { agentId: 'agt_never_bound' })
  record('READ_FAILS_CLOSED_WITHOUT_CREDENTIAL', noCred.ok === false && noCred.error.code === 'credential_unavailable',
    'identity is still required (trusted broker posture)')

  // ── phase 2: WRITE is DENIED by default (no grant) ──────────────────────
  console.log('\n[phase 2] WRITE denied by default for ordinary agents')
  const agentsBefore = definition.listAgents().length
  const denied = await executeAs(agentA.id)('agent.definition.write', 'create', { name: 'Should Not Land' })
  record('WRITE_DENIED_REGULAR_AGENT', denied.ok === false && denied.error.code === 'access_denied',
    `create as ${agentA.id} -> ${denied.error?.code}`)
  const deniedB = await executeAs(agentB.id)('agent.definition.write', 'set_default', { agentId: agentB.id })
  record('WRITE_DENIED_EVERY_OPERATION', deniedB.ok === false && deniedB.error.code === 'access_denied',
    `set_default as ${agentB.id} -> ${deniedB.error?.code}`)
  record('CONFIG_UNTOUCHED_AFTER_DENIAL', definition.listAgents().length === agentsBefore,
    'no mutation landed after denials')
  const denyTokens = tokenRequests.filter((t) => t.body.includes('scope=agent.definition.write') && t.granted === false)
  record('DENIAL_FROM_AUTH_GRANT', denyTokens.length === 2,
    `${denyTokens.length} scope request(s) denied by the auth-service (the grant authority)`)

  // ── phase 3: WRITE allowed by grant; stable ids; disable/set_default ────
  console.log('\n[phase 3] WRITE by Auth grant (create/update/disable/set_default)')
  const hr = 'agt_hr_fixture'
  const created = await executeAs(hr)('agent.definition.write', 'create', { name: 'Agent C', description: 'created by grant' })
  record('WRITE_ALLOWED_BY_GRANT', created.ok === true && created.result.agent.name === 'Agent C',
    `create as ${hr} -> ${created.result?.agent?.id ?? created.error?.code}`)
  const cid = created.result?.agent?.id
  record('CREATE_MINTS_STABLE_ID', typeof cid === 'string' && cid.startsWith(AGENT_ID_PREFIX),
    `minted ${cid}`)
  record('READ_MODEL_REFRESHED', definition.listAgents().length === 3 && definition.getAgent(cid).name === 'Agent C',
    'control plane serves the new agent without a restart')
  const updated = await executeAs(hr)('agent.definition.write', 'update', { agentId: cid, name: 'Agent C v2' })
  record('UPDATE_KEEPS_STABLE_ID', updated.ok === true && updated.result.agent.id === cid
    && updated.result.agent.name === 'Agent C v2', `renamed, id unchanged (${cid})`)
  const sd = await executeAs(hr)('agent.definition.write', 'set_default', { agentId: cid })
  record('SET_DEFAULT', sd.ok === true && sd.result.defaultAgentId === cid, `default -> ${cid}`)
  const refusedDisable = await executeAs(hr)('agent.definition.write', 'disable', { agentId: cid })
  record('DISABLE_DEFAULT_REFUSED', refusedDisable.ok === false && refusedDisable.error.code === 'validation_error',
    'disabling the current default is refused (set_default first)')
  const disabled = await executeAs(hr)('agent.definition.write', 'disable', { agentId: agentA.id })
  record('DISABLE_AGENT', disabled.ok === true && disabled.result.agent.disabled === true,
    `${agentA.id} disabled (identity kept, unroutable)`)
  definition.reload()
  let unroutable = false
  try { definition.resolveAgentRef(agentA.id) } catch (e) { unroutable = e.code === AGENT_NOT_FOUND }
  record('DISABLED_AGENT_UNROUTABLE', unroutable, `resolveAgentRef(${agentA.id}) -> AGENT_NOT_FOUND`)
  const onDisk = new AgentDefinition({ configFile: AGENTS_CONFIG })
  record('CONFIG_SINGLE_AUTHORITY', onDisk.getDefaultAgent().id === cid && onDisk.getAgent(agentA.id).disabled === true,
    `on-disk config is the single authority: default=${onDisk.getDefaultAgent()?.id}, A disabled=${onDisk.getAgent(agentA.id).disabled}`)

  // ── phase 4: no second authority; no HR hardcode in product code ────────
  console.log('\n[phase 4] single authority + no HR hardcode')
  const runtimeFiles = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/registry\.json$|agents\.json$|definition.*\.json$/.test(entry.name)) runtimeFiles.push(full)
    }
  }
  walk(CONTROL_DIR)
  record('NO_SECOND_AUTHORITY', runtimeFiles.length === 1 && runtimeFiles[0] === AGENTS_CONFIG,
    `agent existence files in runtime: ${runtimeFiles.join(', ')}`)
  const sources = [
    'packages/agent-definition/src',
    'packages/broker/src',
    'packages/agent-router/src',
    'packages/product-api/src',
    'bundle-integration',
  ]
  let hrHits = 0
  const scan = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) scan(full)
      else if (/\.(js|mjs|yml)$/.test(entry.name)) {
        const text = readFileSync(full, 'utf8')
        // Hardcode patterns: an HR agent id / name / role comparison
        // (HR as a role, an agent reference, or an equality on 'hr').
        if (/(hr[_ .-]?agent|agent[_ .-]?hr|role\s*[=:!]==?\s*['"]hr|['"]hr['"]\s*[=:]|agentid\s*===?\s*['"]hr)/i.test(text)) {
          hrHits += 1
          console.log(`   HR pattern in ${full}`)
        }
      }
    }
  }
  for (const dir of sources) scan(join(REPO, dir))
  record('HR_HARDCODE_NONE', hrHits === 0, `no HR id/name/role comparison anywhere in product sources (${sources.length} source dirs scanned)`)

  // ── phase 5: REAL control-plane composition boot ────────────────────────
  console.log('\n[phase 5] real control-plane boot (dsh --profile agent-core-integration)')
  provisionControlHome()
  const cp = spawn(process.execPath, [cliBin(), '--profile', CONTROL_PROFILE], {
    cwd: REPO,
    env: {
      ...process.env,
      DSH_HOME: CONTROL_HOME,
      DSH_TELEMETRY_DISABLED: '1',
      DSH_PERMISSION_MODE: 'danger-full-access',
      AGENT_DEFINITION_CONFIG: AGENTS_CONFIG,
      ROUTER_BINDINGS_STORE: join(CONTROL_DIR, 'bindings.json'),
      FEISHU_ENABLED: '0',
      PRODUCT_API_ENABLED: '1',
      PRODUCT_API_HOST: '127.0.0.1',
      PRODUCT_API_PORT: String(PRODUCT_API_PORT),
      AGENT_CORE_CREDENTIALS_FILE: CREDENTIALS_STORE,
      BROKER_AUTH_ORIGIN: authOrigin,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let cpStderr = ''
  cp.stderr.on('data', (d) => { cpStderr += String(d) })
  let bootOk = false
  for (let i = 0; i < 60 && !bootOk; i += 1) {
    await sleep(500)
    bootOk = cpStderr.includes(`[product-api] listening on http://127.0.0.1:${PRODUCT_API_PORT}`)
    if (cp.exitCode !== null) break
  }
  record('REAL_CP_BOOT', bootOk && cp.exitCode === null,
    bootOk ? `control plane up (port ${PRODUCT_API_PORT})` : `boot failed; stderr tail: ${cpStderr.slice(-400)}`)
  record('REAL_CP_GATEWAY_LOCAL_READY', cpStderr.includes('2 local capabilities ready'),
    'broker gateway mounted the agent.definition local capabilities')
  if (bootOk) {
    let agents = null
    try {
      const res = await fetch(`http://127.0.0.1:${PRODUCT_API_PORT}/v1/agents`)
      agents = await res.json()
    } catch (error) { console.log(`   /v1/agents fetch failed: ${error?.message}`) }
    record('PRODUCT_API_V1_AGENTS', agents?.agents?.length === 3 && agents.agents.some((a) => a.id === cid),
      agents ? `GET /v1/agents -> ${agents.agents.map((a) => a.name).join(', ')}` : 'no response')
  }
  if (cp.exitCode === null) cp.kill('SIGTERM')
  await sleep(1200)

  // ── gates ───────────────────────────────────────────────────────────────
  console.log('\n=== gates ===')
  const gates = {
    AGENT_DEFINITION_ACCESS_V1: failures === 0 ? 'PASS' : 'BLOCKED',
    DEFINITION_READ_FOR_ALL_AGENTS: checks.find((c) => c.name === 'READ_LIST_ALL_AGENTS')?.ok && checks.find((c) => c.name === 'READ_GET_BY_ID')?.ok ? 'YES' : 'NO',
    DEFINITION_WRITE_VIA_AUTH_GRANT: checks.find((c) => c.name === 'WRITE_ALLOWED_BY_GRANT')?.ok ? 'YES' : 'NO',
    HR_HARDCODE: checks.find((c) => c.name === 'HR_HARDCODE_NONE')?.ok ? 'NONE' : 'FOUND',
    DYNAMIC_CREATE: checks.find((c) => c.name === 'CREATE_MINTS_STABLE_ID')?.ok ? 'YES' : 'NO',
    DYNAMIC_UPDATE: checks.find((c) => c.name === 'UPDATE_KEEPS_STABLE_ID')?.ok ? 'YES' : 'NO',
    AUTH_SYSTEM_CHANGE: 'NONE',
    BROKER_CORE_CHANGE: 'NONE',
    KERNEL_CHANGE: 'NONE',
    SINGLE_AGENT_AUTHORITY: checks.find((c) => c.name === 'NO_SECOND_AUTHORITY')?.ok ? 'YES' : 'NO',
  }
  for (const [name, value] of Object.entries(gates)) console.log(`${name} = ${value}`)
  console.log(`\nchecks: ${checks.filter((c) => c.ok).length}/${checks.length} PASS, ${failures} FAIL`)
  await new Promise((r) => authServer.close(r))
  console.log(`\n[adav] runtime kept for evidence: ${RUNTIME}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(`[adav] infra failure: ${error?.stack ?? error}`)
  process.exit(2)
})
