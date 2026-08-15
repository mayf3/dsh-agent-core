#!/usr/bin/env node
/**
 * Product Integration V1 acceptance driver — REAL DSH processes, REAL model
 * turns, ONE Router.
 *
 * Proves the full assembly for the first time: Registry + Workspace + DSH
 * native Session + Memory + per-Agent process, wired through the unified
 * Router / Binding domain (switchAgent) — two long-lived Agents A and B.
 *
 *   Phase 0  setup + registry: register Agent A / Agent B (A first -> default)
 *   Phase 1  first contact: chat-main auto-binds A/main; a real message is
 *            routed into A's own process/session (reply ALPHA-1)
 *   Phase 2  A memory: A saves birthday 1990-01-01 (memory_save), recalls it
 *   Phase 3  switch (domain op, the "Mobile UI tap" entry): switchAgent(chat-main
 *            -> B); the next message truly enters B's process/session (BETA-1);
 *            A's trajectory/memory untouched; the other conversation (chat-other)
 *            untouched
 *   Phase 4  B memory + isolation: B saves 1991-02-02; A's memory file never
 *            sees it and vice versa
 *   Phase 5  crash + resume: kill B's process; the next message respawns B and
 *            RESUMES its main session + memory (BETA-2, birthday recall)
 *   Phase 6  DSH switch tool (the "自然语言入口"): switch back to A, then the
 *            user asks A "叫 Agent B 来"; A calls agent_core_switch_agent ->
 *            parent-RPC relay -> Router.switchAgent; the next message enters B
 *   Phase 7  control-plane restart (in-process): fresh registry + fresh router
 *            over the SAME stores -> chat-main is still B, chat-other still A
 *   Phase 8  control-plane restart (real process): boot the real
 *            agent-core-integration composition over the same stores -> it
 *            loads the persisted Binding table ("binding store loaded: 2")
 *
 * Usage:
 *   node scripts/product-integration-v1-verify.mjs
 * Env:
 *   DSH_PRODUCT_INTEGRATION_RUNTIME  runtime root (default .demo/product-integration-v1/runtime)
 *   DSH_PRODUCT_INTEGRATION_KEEP=1   keep existing agent homes (default: wipe)
 *   DSH_AGENT_PROVIDER / DSH_AGENT_MODEL  LLM route (default opencode-go / deepseek-v4-flash)
 * Exit 0 on full acceptance, 1 on failed assertion, 2 on infra failure.
 */

import { spawn, spawnSync } from 'node:child_process'
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync,
  readlinkSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { cliBin, provisionAgentHome, REPO } from './demo-home.mjs'
import { AgentRegistry } from '../packages/agent-registry/src/registry.js'
import { apply as applyBootstrap } from '../packages/workspace-bootstrap/src/index.js'
import { apply as applyRouter, channelConversationIdOf } from '../packages/agent-router/src/index.js'

const RUNTIME = resolve(process.env.DSH_PRODUCT_INTEGRATION_RUNTIME ?? join(REPO, '.demo', 'product-integration-v1', 'runtime'))
const AGENTS_DIR = join(RUNTIME, 'agents') // workspace root (memory root)
const HOMES_DIR = join(RUNTIME, 'homes')   // agents home root (DSH_HOME per agent)
const CONTROL_HOME = join(RUNTIME, 'control', 'home')
const REGISTRY_STORE = join(RUNTIME, 'control', 'registry.json')
const BINDINGS_STORE = join(RUNTIME, 'control', 'bindings.json')
const KEEP = process.env.DSH_PRODUCT_INTEGRATION_KEEP === '1'
const PROVIDER = process.env.DSH_AGENT_PROVIDER ?? 'opencode-go'
const MODEL = process.env.DSH_AGENT_MODEL ?? 'deepseek-v4-flash'
const MAX_TOKENS = 8192
const AGENT_PROFILE = 'agent-core-integration-agent'
const CONTROL_PROFILE = 'agent-core-integration'
const AGENT_A_NAME = 'Agent A'
const AGENT_B_NAME = 'Agent B'
const CC_MAIN = 'feishu:chat-main'
const CC_OTHER = 'feishu:chat-other'
const TURN_TIMEOUT_MS = Number.parseInt(process.env.DSH_PI_TURN_TIMEOUT ?? '300000', 10)
const WAIT_SWITCH_MS = Number.parseInt(process.env.DSH_PI_SWITCH_TIMEOUT ?? '180000', 10)
const MEMORY_WAIT_MS = Number.parseInt(process.env.DSH_PI_MEMORY_TIMEOUT ?? '180000', 10)

const sleep = (ms) => new Promise(resolveTimeout => setTimeout(resolveTimeout, ms))

// ---------------------------------------------------------------- utils

function ensureSymlink(target, link) {
  mkdirSync(dirname(link), { recursive: true })
  try {
    const stat = lstatSync(link)
    if (stat.isSymbolicLink() && resolve(readlinkSync(link)) === resolve(target)) return
    rmSync(link, { recursive: true, force: true })
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  symlinkSync(target, link)
}

function copyOnce(source, target) {
  if (!existsSync(target)) {
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target)
  }
}

function provisionProfile(home, profileName, repoProfileDir) {
  const profileDir = join(home, 'profiles', profileName)
  mkdirSync(profileDir, { recursive: true })
  copyOnce(join(repoProfileDir, 'package.json'), join(profileDir, 'package.json'))
  copyOnce(join(repoProfileDir, 'cordis.patch.yml'), join(profileDir, 'cordis.patch.yml'))
}

function linkFarm(home, entries) {
  const farm = join(home, 'profiles', 'node_modules', '@agent-core')
  for (const [pkg, target] of Object.entries(entries)) {
    ensureSymlink(target, join(farm, pkg))
  }
}

/** Provision one agent home + workspace for the integration-agent profile. */
function provisionAgent(agentId) {
  const home = join(HOMES_DIR, agentId)
  const workspace = join(AGENTS_DIR, agentId)
  provisionAgentHome(home, workspace)
  provisionProfile(home, AGENT_PROFILE, join(REPO, 'profile-integration-agent'))
  linkFarm(home, {
    'bundle-memory': join(REPO, 'bundle-memory'),
    'agent-memory': join(REPO, 'packages', 'agent-memory'),
    'bundle-agent-switch': join(REPO, 'bundle-agent-switch'),
    'agent-switch': join(REPO, 'packages', 'agent-switch'),
    'workspace-bootstrap': join(REPO, 'packages', 'workspace-bootstrap'),
  })
  return { home, workspace }
}

/** Provision the control-plane home for the real-process smoke boot. */
function provisionControlHome() {
  provisionAgentHome(CONTROL_HOME, REPO)
  provisionProfile(CONTROL_HOME, CONTROL_PROFILE, join(REPO, 'profile-integration'))
  linkFarm(CONTROL_HOME, {
    'bundle-integration': join(REPO, 'bundle-integration'),
    'feishu-connector': join(REPO, 'packages', 'feishu-connector'),
    'agent-router': join(REPO, 'packages', 'agent-router'),
    'workspace-bootstrap': join(REPO, 'packages', 'workspace-bootstrap'),
    'agent-registry': join(REPO, 'packages', 'agent-registry'),
  })
}

/** Base environment shared by every spawned process. */
function baseEnv(extra = {}) {
  return {
    ...process.env,
    DSH_HOME: CONTROL_HOME,
    DSH_TELEMETRY_DISABLED: '1',
    DSH_PERMISSION_MODE: 'danger-full-access',
    AGENT_REGISTRY_STORE: REGISTRY_STORE,
    ROUTER_BINDINGS_STORE: BINDINGS_STORE,
    ROUTER_AGENT_PROFILE: AGENT_PROFILE,
    DSH_MEMORY_WORKSPACE_ROOT: AGENTS_DIR,
    DSH_PRODUCT_INTEGRATION_KEEP: '1', // never let a child wipe the runtime
    ...extra,
  }
}

/** Fake cordis ctx: get/provide/effect only (what the mounted plugins use). */
function fakeCtx() {
  const services = new Map()
  const disposers = []
  return {
    get: (name) => services.get(name),
    provide: (name, value) => { services.set(name, value) },
    effect: (fn) => {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
    },
    async disposeAll() {
      for (const dispose of disposers.splice(0)) {
        try { await dispose() } catch { /* best effort */ }
      }
    },
  }
}

// ------------------------------------------------------------ assertions

const checks = []
function record(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  checks.push({ name, ok, detail })
}

// --------------------------------------------------------------- helpers

function agentWorkspace(agentId) { return join(AGENTS_DIR, agentId) }
function agentHome(agentId) { return join(HOMES_DIR, agentId) }
function memoryFile(agentId) { return join(agentWorkspace(agentId), 'MEMORY.md') }
function readMemory(agentId) {
  const file = memoryFile(agentId)
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

/** Poll until `needle` appears in the agent's MEMORY.md. */
async function waitForMemory(agentId, needle, timeoutMs = MEMORY_WAIT_MS) {
  const started = Date.now()
  for (;;) {
    const text = readMemory(agentId)
    if (text.includes(needle)) return text
    if (Date.now() - started > timeoutMs) return text
    await sleep(2000)
  }
}

/** Scan <home>/sessions/<project>/<id>/session.jsonl — mirrors persistence.list(). */
function sessionFiles(home) {
  const root = join(home, 'sessions')
  const out = []
  if (!existsSync(root)) return out
  for (const project of readdirSync(root, { withFileTypes: true })) {
    if (!project.isDirectory()) continue
    const projectDir = join(root, project.name)
    for (const entry of readdirSync(projectDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const file = join(projectDir, entry.name, 'session.jsonl')
      if (existsSync(file)) out.push({ project: project.name, id: entry.name, file })
    }
  }
  return out
}

function mainTrajectory(agentId) {
  const files = sessionFiles(agentHome(agentId)).filter(f => f.id === 'main')
  return files.length > 0 ? readFileSync(files[0].file, 'utf8') : ''
}

/** Build an ingress event the router's route() accepts. */
function ingress(ccId, text) {
  return {
    channel: 'feishu',
    chatId: `oc_${ccId.split(':')[1]}`,
    conversationId: ccId.split(':')[1],
    sender: { openId: 'ou_test_user' },
    text,
  }
}

const BIRTHDAY_A_RE = /1990[^\d]{0,4}0?1[^\d]{0,4}0?1/
const BIRTHDAY_B_RE = /1991[^\d]{0,4}0?2[^\d]{0,4}0?2/

// ------------------------------------------------------------------ main

async function main() {
  console.log(`=== Product Integration V1 acceptance — runtime ${RUNTIME}`)
  console.log(`agents: A (${AGENT_A_NAME}) + B (${AGENT_B_NAME}); conversation ${CC_MAIN}`)

  // The per-agent child processes inherit the driver's env; the memory
  // plugin in each child resolves its workspace root from this variable.
  process.env.DSH_MEMORY_WORKSPACE_ROOT = AGENTS_DIR

  // ------------------------------------------------------------- phase 0
  if (KEEP && existsSync(RUNTIME)) {
    console.log('\n[phase 0] keeping existing runtime (KEEP=1)')
  } else {
    rmSync(RUNTIME, { recursive: true, force: true })
    console.log('\n[phase 0] runtime wiped, provisioning…')
  }
  mkdirSync(CONTROL_HOME, { recursive: true })
  provisionControlHome()

  const ctx = fakeCtx()
  applyBootstrap(ctx, { workspaceRoot: AGENTS_DIR, agentsHome: HOMES_DIR })
  const registrySvc = (() => {
    const core = new AgentRegistry({ storeFile: REGISTRY_STORE })
    return {
      listAgents: () => core.listAgents(),
      getAgent: (id) => core.getAgent(id),
      getDefaultAgent: () => core.getDefaultAgent(),
      registerAgent: (input) => core.registerAgent(input),
      updateAgent: (agentId, patch) => core.updateAgent(agentId, patch),
      setDefaultAgent: (agentId) => core.setDefaultAgent(agentId),
    }
  })()
  ctx.provide('agentRegistry', registrySvc)

  // Register FIRST: the Registry owns the opaque agentIds, and the router /
  // workspace-bootstrap derive every agent path from exactly that id — the
  // homes below must be provisioned under the GENERATED ids, not a chosen
  // name (the acceptance itself proves id-driven provisioning).
  const agentA = await registrySvc.registerAgent({ name: AGENT_A_NAME, description: '论文导师' })
  const agentB = await registrySvc.registerAgent({ name: AGENT_B_NAME, description: '研发总监' })
  record('REGISTRY_PROVIDES_AB', registrySvc.listAgents().length === 2 && registrySvc.getAgent(agentA.id).name === AGENT_A_NAME && registrySvc.getAgent(agentB.id).name === AGENT_B_NAME,
    `${agentA.id} / ${agentB.id}`)
  record('REGISTRY_DEFAULT_IS_A', registrySvc.getDefaultAgent()?.id === agentA.id, 'first registered becomes default')

  provisionAgent(agentA.id)
  provisionAgent(agentB.id)

  // Per-agent AGENTS.md: identity + sibling info so the switch tool is
  // callable with the right reference (the workspace file is the natural
  // per-agent instruction surface; workspace-bootstrap seeds it, we extend).
  writeFileSync(join(agentWorkspace(agentA.id), 'AGENTS.md'), [
    '# AGENTS.md',
    '',
    `You are ${AGENT_A_NAME} (论文导师). Your agentId is ${agentA.id}.`,
    `The other agent is ${AGENT_B_NAME} (研发总监), agentId ${agentB.id}, display name '${AGENT_B_NAME}'.`,
    `When the user asks to switch the conversation to ${AGENT_B_NAME}, call the tool agent_core_switch_agent with targetAgentId = '${AGENT_B_NAME}'.`,
    '',
  ].join('\n'))
  writeFileSync(join(agentWorkspace(agentB.id), 'AGENTS.md'), [
    '# AGENTS.md',
    '',
    `You are ${AGENT_B_NAME} (研发总监). Your agentId is ${agentB.id}.`,
    `The other agent is ${AGENT_A_NAME} (论文导师), agentId ${agentA.id}, display name '${AGENT_A_NAME}'.`,
    `When the user asks to switch the conversation to ${AGENT_A_NAME}, call the tool agent_core_switch_agent with targetAgentId = '${AGENT_A_NAME}'.`,
    '',
  ].join('\n'))

  const router = applyRouter(ctx, {
    bindingsStoreFile: BINDINGS_STORE,
    defaultSessionId: 'main',
    defaultAgentId: agentA.id,
    agentProfile: AGENT_PROFILE,
  })

  // ------------------------------------------------------------- phase 1
  console.log('\n[phase 1] first contact -> A/main; first real message into A')
  const contact = await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })
  record('PHASE1_FIRST_CONTACT_BINDS_DEFAULT', contact.binding.activeAgentId === agentA.id && contact.binding.activeSessionId === 'main',
    `${CC_MAIN} -> ${contact.binding.activeAgentId}/${contact.binding.activeSessionId}`)

  const replyA1 = await router.route(ingress(CC_MAIN, 'Reply with exactly: ALPHA-1'))
  const snapA = router.registrySnapshot()
  const procA = snapA.find(s => s.agentId === agentA.id)
  record('PHASE1_REPLY_FROM_A', (replyA1?.reply ?? '').includes('ALPHA-1'), `reply="${replyA1?.reply?.slice(0, 80)}"`)
  record('PHASE1_A_PROCESS_INDEPENDENT', procA !== undefined && procA.alive, `A pid=${procA?.pid} home=${procA?.home}`)
  record('PHASE1_A_SESSION_CREATED', (procA?.sessions ?? []).some(s => s.sessionId === 'main' && s.mode === 'created'),
    JSON.stringify(procA?.sessions ?? []))
  const trajA1 = mainTrajectory(agentA.id)
  record('PHASE1_A_SESSION_ON_DISK', trajA1.includes('ALPHA-1'), `trajectory ${trajA1.length} bytes`)

  // ------------------------------------------------------------- phase 2
  console.log('\n[phase 2] A memory: save birthday, recall it')
  await router.route(ingress(CC_MAIN, '用 memory_save 记住: 我的生日是 1990-01-01'))
  const memoryA = await waitForMemory(agentA.id, '1990')
  record('PHASE2_A_MEMORY_SAVED', memoryA.includes('1990'), `${memoryFile(agentA.id)}`)
  const replyA2 = await router.route(ingress(CC_MAIN, '我的生日是哪天? 只回答日期'))
  record('PHASE2_A_RECALLS_MEMORY', BIRTHDAY_A_RE.test(replyA2?.reply ?? ''), `reply="${replyA2?.reply?.slice(0, 80)}"`)

  // Let A's debounced turn/end consolidation settle (3s delay + LLM distill)
  // BEFORE snapshotting: the snapshot must be byte-stable so the "A 不受
  // 修改" assertion compares like with like.
  await sleep(12000)

  // Snapshot A's trajectory + memory for the "A 不受修改" assertion.
  const trajA_beforeSwitch = mainTrajectory(agentA.id)
  const memA_beforeSwitch = readMemory(agentA.id)

  // ------------------------------------------------------------- phase 3
  console.log('\n[phase 3] switch (domain op) chat-main -> B; next message enters B')
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-other' })
  const bindingBefore = router.getBinding(CC_MAIN)
  const switched = await router.switchAgent(CC_MAIN, agentB.id)
  record('PHASE3_SWITCH_TO_B', switched.activeAgentId === agentB.id && switched.activeSessionId === 'main',
    `${CC_MAIN} ${bindingBefore.activeAgentId} -> ${switched.activeAgentId}/${switched.activeSessionId}`)
  record('PHASE3_OTHER_BINDING_UNTOUCHED', router.getBinding(CC_OTHER)?.activeAgentId === agentA.id,
    `${CC_OTHER} still ${router.getBinding(CC_OTHER)?.activeAgentId}`)

  const replyB1 = await router.route(ingress(CC_MAIN, 'Reply with exactly: BETA-1'))
  const snapB = router.registrySnapshot()
  const procB = snapB.find(s => s.agentId === agentB.id)
  record('PHASE3_REPLY_FROM_B', (replyB1?.reply ?? '').includes('BETA-1'), `reply="${replyB1?.reply?.slice(0, 80)}"`)
  record('PHASE3_B_PROCESS_INDEPENDENT', procB !== undefined && procA !== undefined && procB.pid !== procA.pid,
    `A pid=${procA?.pid} vs B pid=${procB?.pid}`)
  record('PHASE3_B_SESSION_CREATED_IN_B_HOME', (procB?.sessions ?? []).some(s => s.sessionId === 'main' && s.mode === 'created'),
    JSON.stringify(procB?.sessions ?? []))
  const trajB = mainTrajectory(agentB.id)
  record('PHASE3_MESSAGE_TRULY_ENTERED_B', trajB.includes('BETA-1') && !trajA1.includes('BETA-1'),
    'B trajectory has BETA-1; A trajectory never does')
  record('PHASE3_A_UNTOUCHED', mainTrajectory(agentA.id) === trajA_beforeSwitch && readMemory(agentA.id) === memA_beforeSwitch,
    'A trajectory + MEMORY.md byte-identical after the switch')

  // ------------------------------------------------------------- phase 4
  console.log('\n[phase 4] B memory + file isolation')
  await router.route(ingress(CC_MAIN, '用 memory_save 记住: 我的生日是 1991-02-02'))
  const memoryB = await waitForMemory(agentB.id, '1991')
  record('PHASE4_B_MEMORY_SAVED', memoryB.includes('1991'), `${memoryFile(agentB.id)}`)
  record('PHASE4_MEMORY_ISOLATED', !readMemory(agentA.id).includes('1991') && !memoryB.includes('1990'),
    'A never sees 1991, B never sees 1990 (physical file isolation)')

  // ------------------------------------------------------------- phase 5
  console.log('\n[phase 5] kill B process; next message respawns + resumes B')
  const pidB = procB.pid
  spawnSync('kill', ['-9', String(pidB)])
  await sleep(1500)
  const replyB2 = await router.route(ingress(CC_MAIN, 'Reply with exactly: BETA-2'))
  const snapB2 = router.registrySnapshot()
  const procB2 = snapB2.find(s => s.agentId === agentB.id)
  record('PHASE5_B_RESPAWNED', procB2 !== undefined && procB2.alive && procB2.pid !== pidB,
    `B pid ${pidB} -> ${procB2?.pid}`)
  record('PHASE5_B_SESSION_RESUMED', (procB2?.sessions ?? []).some(s => s.sessionId === 'main' && s.mode === 'resumed'),
    JSON.stringify(procB2?.sessions ?? []))
  record('PHASE5_REPLY_AFTER_RESUME', (replyB2?.reply ?? '').includes('BETA-2'), `reply="${replyB2?.reply?.slice(0, 80)}"`)
  const replyB3 = await router.route(ingress(CC_MAIN, '我的生日是哪天? 只回答日期'))
  record('PHASE5_MEMORY_AFTER_RESUME', BIRTHDAY_B_RE.test(replyB3?.reply ?? ''), `reply="${replyB3?.reply?.slice(0, 80)}"`)

  // ------------------------------------------------------------- phase 6
  console.log('\n[phase 6] DSH tool: switch back to A, then A is asked "叫 Agent B 来"')
  await router.switchAgent(CC_MAIN, agentA.id)
  record('PHASE6_BACK_TO_A', router.getBinding(CC_MAIN)?.activeAgentId === agentA.id, 'switchAgent(chat-main -> A)')
  const firstTry = await router.route(ingress(CC_MAIN, '请把当前对话切换到 Agent B'))
  let bindingAfterTool = router.getBinding(CC_MAIN)
  let toolAttempt = 1
  if (bindingAfterTool?.activeAgentId !== agentB.id) {
    console.log(`  [phase 6] model did not switch on the natural phrasing (attempt 1); retrying with an explicit instruction…`)
    await router.route(ingress(CC_MAIN, '请调用工具 agent_core_switch_agent, targetAgentId 填 Agent B'))
    bindingAfterTool = router.getBinding(CC_MAIN)
    toolAttempt = 2
  }
  record('PHASE6_TOOL_SWITCHED_TO_B', bindingAfterTool?.activeAgentId === agentB.id && bindingAfterTool?.activeSessionId === 'main',
    `attempt ${toolAttempt}: ${CC_MAIN} -> ${bindingAfterTool?.activeAgentId}/${bindingAfterTool?.activeSessionId} (A replied "${(firstTry?.reply ?? '').slice(0, 60)}")`)
  const replyB4 = await router.route(ingress(CC_MAIN, 'Reply with exactly: BETA-3'))
  record('PHASE6_NEXT_MESSAGE_ENTERS_B', (replyB4?.reply ?? '').includes('BETA-3'), `reply="${replyB4?.reply?.slice(0, 80)}"`)

  // ------------------------------------------------------------- phase 7
  console.log('\n[phase 7] control-plane restart (in-process, same stores)')
  await ctx.disposeAll() // shutdown every owned agent process
  const ctx2 = fakeCtx()
  applyBootstrap(ctx2, { workspaceRoot: AGENTS_DIR, agentsHome: HOMES_DIR })
  const registry2 = new AgentRegistry({ storeFile: REGISTRY_STORE })
  ctx2.provide('agentRegistry', {
    listAgents: () => registry2.listAgents(),
    getAgent: (id) => registry2.getAgent(id),
    getDefaultAgent: () => registry2.getDefaultAgent(),
  })
  const router2 = applyRouter(ctx2, {
    bindingsStoreFile: BINDINGS_STORE,
    defaultSessionId: 'main',
    defaultAgentId: agentA.id,
    agentProfile: AGENT_PROFILE,
  })
  record('PHASE7_RESTART_KEEPS_B', router2.getBinding(CC_MAIN)?.activeAgentId === agentB.id,
    `${CC_MAIN} still ${router2.getBinding(CC_MAIN)?.activeAgentId} after restart (was ${agentB.id})`)
  record('PHASE7_RESTART_KEEPS_OTHER', router2.getBinding(CC_OTHER)?.activeAgentId === agentA.id,
    `${CC_OTHER} still ${router2.getBinding(CC_OTHER)?.activeAgentId}`)
  await ctx2.disposeAll()

  // ------------------------------------------------------------- phase 8
  console.log('\n[phase 8] real control-plane process boot over the same stores')
  const cpLog = await bootControlPlane(router2.bindingsSnapshot().length)
  record('PHASE8_REAL_CP_BOOT_OK', cpLog.ok, cpLog.detail)

  // -------------------------------------------------------------- report
  const evidence = [
    '# Product Integration V1 — real multi-agent acceptance',
    '',
    `Run: ${new Date().toISOString()}`,
    `Runtime: ${RUNTIME}`,
    `Agents: A = ${agentA.id} ("${AGENT_A_NAME}"), B = ${agentB.id} ("${AGENT_B_NAME}")`,
    `Conversations: ${CC_MAIN} (switched), ${CC_OTHER} (control)`,
    '',
    '## Checks',
    '',
    ...checks.map(c => `- ${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`),
    '',
    '## Key artifacts',
    '',
    `- A workspace: ${agentWorkspace(agentA.id)}`,
    `- B workspace: ${agentWorkspace(agentB.id)}`,
    `- A home: ${agentHome(agentA.id)}`,
    `- B home: ${agentHome(agentB.id)}`,
    `- A MEMORY.md: ${memoryFile(agentA.id)} (${readMemory(agentA.id).split('\n').length} lines)`,
    `- B MEMORY.md: ${memoryFile(agentB.id)} (${readMemory(agentB.id).split('\n').length} lines)`,
    `- A main trajectory: ${mainTrajectory(agentA.id).length} bytes`,
    `- B main trajectory: ${mainTrajectory(agentB.id).length} bytes`,
    `- Binding store: ${BINDINGS_STORE} (${JSON.stringify(router2.bindingsSnapshot(), null, 2)})`,
    `- Registry store: ${REGISTRY_STORE}`,
    '',
  ].join('\n')
  const reportPath = join(RUNTIME, '..', 'evidence.md')
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, evidence)
  console.log(`\nevidence written: ${reportPath}`)

  const allPass = checks.every(c => c.ok)
  process.exit(allPass ? 0 : 1)
}

/**
 * Boot the REAL control-plane composition (profile agent-core-integration)
 * over the same registry + binding stores and assert it loads the persisted
 * Binding table — a process-level restart proof.
 */
function bootControlPlane(expectedBindings) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [cliBin(), '--profile', CONTROL_PROFILE], {
      cwd: REPO,
      env: baseEnv({ FEISHU_ENABLED: '0' }),
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    let sawBindings = false
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      if (stderr.includes(`binding store loaded: ${expectedBindings} binding(s)`)) sawBindings = true
      // Both boot signals: the persisted Binding table loaded AND the router
      // mounted entry-agnostic (no feishu configured in this boot).
      if (sawBindings && stderr.includes('router idle') && !child.__done) {
        child.__done = true
        child.kill('SIGKILL')
        resolvePromise({ ok: true, detail: `real control plane mounted over persisted stores (${expectedBindings} bindings, ${BINDINGS_STORE})` })
      }
    })
    child.once('exit', () => {
      if (child.__done) return
      resolvePromise({ ok: false, detail: `control plane exited before mounting: ${stderr.slice(-400)}` })
    })
    setTimeout(() => {
      if (child.__done) return
      child.__done = true
      child.kill('SIGKILL')
      resolvePromise({ ok: false, detail: `control plane boot timeout; stderr tail: ${stderr.slice(-400)}` })
    }, 90000)
  })
}

main().catch((error) => {
  console.error(`\nPRODUCT INTEGRATION V1 FAILED: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(2)
})
