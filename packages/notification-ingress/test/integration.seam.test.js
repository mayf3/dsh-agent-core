/**
 * Integration SEAM for @agent-core/notification-ingress — the REAL
 * composition path.
 *
 * This file is deliberately NOT a unit test: it boots the REAL control-plane
 * composition (`agent-core-integration` profile via the dsh CLI, with the
 * notification-ingress mount row), POSTs /v1/deliver over real HTTP and
 * asserts the frozen Router contract answer { accepted, sessionId }.
 *
 * It is skipped by default because main does NOT have `agentRouter.deliver`
 * yet — the Router Agent is implementing it in parallel on branch
 * feat/agent-router-delivery-v0. The ingress side must not (and does not)
 * fake or re-implement Router logic, so this seam stays pending until that
 * branch lands.
 *
 * Run it explicitly AFTER the Router branch lands:
 *
 *   NOTIFICATION_INGRESS_INTEGRATION=1 npm test -- packages/notification-ingress
 *
 * Until then it reports `skip` in the test summary (visible seam, no silent
 * fake). If you force it on main, it FAILS LOUDLY with a 503
 * SERVICE_UNAVAILABLE assertion — the correct failure mode for a seam whose
 * dependency has not landed.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawn } from 'node:child_process'
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cliBin, provisionAgentHome, REPO } from '../../../scripts/demo-home.mjs'
import { AgentRegistry } from '../../agent-registry/src/registry.js'

const SEAM_ENABLED = process.env.NOTIFICATION_INGRESS_INTEGRATION === '1'
const SEAM_REASON = 'awaiting agentRouter.deliver (Router branch feat/agent-router-delivery-v0 not merged); rerun with NOTIFICATION_INGRESS_INTEGRATION=1 once the Router branch lands'

const CONTROL_PROFILE = 'agent-core-integration'
const AGENT_PROFILE = 'agent-core-integration-agent'
const AGENT_ID = 'agent-demo'
const INGRESS_PORT = Number.parseInt(process.env.NOTIFICATION_INGRESS_PORT ?? '18790', 10)
const INGRESS_BASE = `http://127.0.0.1:${INGRESS_PORT}`

const sleep = (ms) => new Promise(resolveTimeout => setTimeout(resolveTimeout, ms))

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

/** Provision a scratch DSH_HOME for the REAL control plane. */
function provisionControlHome(home) {
  const profileDir = join(home, 'profiles', CONTROL_PROFILE)
  mkdirSync(profileDir, { recursive: true })
  copyOnce(join(REPO, 'profile-integration', 'package.json'), join(profileDir, 'package.json'))
  copyOnce(join(REPO, 'profile-integration', 'cordis.patch.yml'), join(profileDir, 'cordis.patch.yml'))
  const farm = join(home, 'profiles', 'node_modules', '@agent-core')
  for (const [pkg, rel] of {
    'bundle-integration': 'bundle-integration',
    'feishu-connector': 'packages/feishu-connector',
    'agent-router': 'packages/agent-router',
    'product-api': 'packages/product-api',
    'notification-ingress': 'packages/notification-ingress',
    'workspace-bootstrap': 'packages/workspace-bootstrap',
    'agent-registry': 'packages/agent-registry',
  }) {
    ensureSymlink(join(REPO, rel), join(farm, pkg))
  }
}

test('REAL control plane: POST /v1/deliver -> agentRouter.deliver -> {accepted, sessionId}', { skip: SEAM_ENABLED ? false : SEAM_REASON }, async (t) => {
  // Scratch runtime: control home + registry store + agent home/workspace.
  const runtime = mkdtempSync(join(tmpdir(), 'notification-ingress-seam-'))
  t.after(() => { try { rmSync(runtime, { recursive: true, force: true }) } catch { /* best effort */ } })
  const controlHome = join(runtime, 'control', 'home')
  const registryStore = join(runtime, 'control', 'registry.json')
  const bindingsStore = join(runtime, 'control', 'bindings.json')
  const workspaceRoot = join(runtime, 'agents')

  // Phase 0: ONE registered agent, provisioned home (real per-agent profile).
  const registry = new AgentRegistry({ storeFile: registryStore })
  await registry.registerAgent({ name: 'Agent Demo', description: 'notification ingress seam agent' })
  provisionAgentHome(join(runtime, 'homes', AGENT_ID), join(workspaceRoot, AGENT_ID), { profile: AGENT_PROFILE })
  provisionControlHome(controlHome)

  // Phase 1: boot the REAL control plane; wait for the ingress listener.
  const env = {
    ...process.env,
    DSH_HOME: controlHome,
    DSH_TELEMETRY_DISABLED: '1',
    DSH_PERMISSION_MODE: 'danger-full-access',
    FEISHU_ENABLED: '0',
    AGENT_REGISTRY_STORE: registryStore,
    ROUTER_BINDINGS_STORE: bindingsStore,
    ROUTER_DEFAULT_AGENT: AGENT_ID,
    ROUTER_AGENT_PROFILE: AGENT_PROFILE,
    DSH_MEMORY_WORKSPACE_ROOT: workspaceRoot,
    NOTIFICATION_INGRESS_HOST: '127.0.0.1',
    NOTIFICATION_INGRESS_PORT: String(INGRESS_PORT),
  }
  const child = spawn(process.execPath, [cliBin(), '--profile', CONTROL_PROFILE], {
    cwd: REPO,
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  let booted = false
  const bootPromise = new Promise((resolveBoot) => {
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      if (stderr.includes(`[notification-ingress] listening on http://127.0.0.1:${INGRESS_PORT}`)) {
        booted = true
        resolveBoot(true)
      }
    })
    child.once('exit', (code) => {
      resolveBoot(false)
      if (!booted) stderr += `\n[seam] control plane exited (code ${code}) before the ingress listener came up`
    })
    setTimeout(() => resolveBoot(booted), 120000)
  })
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
      await Promise.race([new Promise(resolveExit => child.once('exit', resolveExit)), sleep(15000)])
      if (child.exitCode === null && child.signalCode === null) {
        try { child.kill('SIGKILL') } catch { /* already dead */ }
      }
    }
  })

  const up = await bootPromise
  assert.equal(up, true, `control plane did not come up; stderr tail:\n${stderr.slice(-800)}`)

  // Health: the ingress must report deliverReady (the Router branch provides it).
  const health = await fetch(`${INGRESS_BASE}/health`)
  const healthBody = await health.json()
  assert.equal(healthBody.deliverReady, true, `agentRouter.deliver missing in the real composition (Router branch not merged?); stderr tail:\n${stderr.slice(-800)}`)

  // Phase 2: the seam call — HTTP -> validation -> agentRouter.deliver -> reply.
  const res = await fetch(`${INGRESS_BASE}/v1/deliver`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      requestId: 'seam-req-1',
      agentId: AGENT_ID,
      sessionMode: 'main',
      message: 'notification ingress seam ping',
    }),
  })
  const body = await res.json()
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(body)}; stderr tail:\n${stderr.slice(-800)}`)
  assert.equal(body.accepted, true, `deliver must accept; body: ${JSON.stringify(body)}`)
  assert.equal(typeof body.sessionId, 'string', `sessionId must be a string; body: ${JSON.stringify(body)}`)
})
