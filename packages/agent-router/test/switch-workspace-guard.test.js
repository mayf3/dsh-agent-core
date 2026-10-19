/**
 * Unit tests for the Product #523 Router-level binding-switch guard: an
 * agent turn (the SWITCH parent-RPC relay is the only agent-owned switch
 * entry) must not persistently move a conversation to an Agent whose primary
 * workspace does not own the conversation's CURRENT effective workspace —
 * the write-time mirror of the v2-ingress-gate equality
 * (resolveWorkspacePath(binding.workspace) vs resolveWorkspace(activeAgentId)).
 *
 * Reuses the Binding Workspace V1 cross-workspace rejection semantics:
 * STRUCTURED_REJECT (code SWITCH_WORKSPACE_MISMATCH), an audit log line, and
 * a Binding row left untouched (no half-write). The operator entry
 * (product-api POST /v1/switch-agent -> Router.switchAgent directly) stays
 * unguarded: explicit operator-authorized handoff remains possible.
 */

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { AgentProcess } from '../src/process.js'
import { apply as applyRouter, SWITCH_RPC_METHOD } from '../src/index.js'

function fakeCtx(services) {
  const provided = new Map()
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    effect: (fn) => { const dispose = fn(); return () => dispose?.() },
  }
}

/**
 * Stub workspace-bootstrap with an explicit primary-workspace map — the same
 * shape the production compose wires from primary-workspaces.json. The path
 * authority seam is resolveWorkspace(agentId); resolveWorkspacePath(id) is
 * the Binding.workspace derivation (V2 gate predicate input).
 */
function stubBootstrap(primaryMap, wsRoot) {
  return {
    resolveWorkspace: (agentId) => primaryMap[agentId] ?? join(wsRoot, agentId),
    resolveWorkspacePath: (workspaceId) => join(wsRoot, 'binding-ws', workspaceId),
    // Same contract as the real service for already-safe ids (safe-id shape
    // is not under test here).
    validateWorkspaceId: (workspaceId) => workspaceId,
    resolveDshHome: (agentId) => join(wsRoot, 'homes', agentId),
    ensure: async () => ({ workspace: wsRoot, dshHome: wsRoot }),
  }
}

/** Stub AgentProcess so ensureRunning installs the RPC hook without spawning. */
function stubAgentProcess() {
  AgentProcess.prototype.spawn = function spawnStub() {
    this.pid = 4242
    this.exit = undefined
    this.exitPromise = new Promise(() => {})
    return this
  }
  AgentProcess.prototype.ready = async () => 0
  AgentProcess.prototype.turn = async () => ({ reply: 'stub-reply', messageId: 'stub-msg' })
  AgentProcess.prototype.shutdown = async () => ({ code: 0, signal: null })
}

/**
 * Fresh router in a per-test tmpdir. `primaries` maps agentId -> directory
 * NAME of its primary workspace (created for real under the tmpdir —
 * ensureRunning provisions the workspace directory, so stub paths must
 * exist), e.g. { agt_shopping: 'workspace-oc_shopping' }.
 */
async function freshRouter(t, primaries = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-switch-guard-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const wsRoot = join(dir, 'workspaces')
  const primaryMap = {}
  for (const [agentId, wsDir] of Object.entries(primaries)) {
    const primary = join(wsRoot, wsDir)
    await mkdir(primary, { recursive: true })
    primaryMap[agentId] = primary
  }
  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, {
    defaultAgentId: 'agt_shopping',
    agents: [
      { id: 'agt_shopping', name: 'Shopping List Agent' },
      { id: 'agt_family', name: 'Family Steward Agent' },
      { id: 'agt_peer', name: 'Peer Agent' },
    ],
  })
  const definition = new AgentDefinition({ configFile })
  const ctx = fakeCtx(new Map([
    ['workspaceBootstrap', stubBootstrap(primaryMap, wsRoot)],
    ['agentDefinition', {
      listAgents: () => definition.listAgents(),
      getAgent: (id) => definition.getAgent(id),
      getDefaultAgent: () => definition.getDefaultAgent(),
      resolveAgentRef: (ref) => definition.resolveAgentRef(ref),
    }],
  ]))
  const router = applyRouter(ctx, {
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultSessionId: 'main',
    agentProfile: 'agent-core-demo',
  })
  return { router, wsRoot }
}

/** Capture the router's stderr audit lines for the duration of `fn`. */
async function captureStderr(fn) {
  const lines = []
  const original = process.stderr.write
  process.stderr.write = (chunk) => { lines.push(String(chunk)); return true }
  try {
    await fn()
  } finally {
    process.stderr.write = original
  }
  return lines
}

test('same-workspace agent-turn switch remains allowed', async (t) => {
  stubAgentProcess()
  // agt_peer's primary workspace IS the conversation's current effective
  // workspace (co-owned workspace, e.g. two agents imported onto the same
  // group directory): the switch keeps the conversation in its own workspace.
  const { router } = await freshRouter(t, {
    agt_shopping: 'workspace-oc_shopping',
    agt_peer: 'workspace-oc_shopping',
    agt_family: 'workspace-oc_family',
  })
  await router.switchAgent('feishu:oc_shopping', 'agt_shopping')
  const proc = await router.ensureRunning('agt_shopping')
  proc.activeBindingContext = 'feishu:oc_shopping'

  const binding = await proc.onRpcRequest(SWITCH_RPC_METHOD, { targetAgentId: 'agt_peer' })
  assert.equal(binding.activeAgentId, 'agt_peer')
  assert.equal(binding.workspace, null, 'conversation workspace preserved across the in-workspace switch')
  assert.equal(router.getBinding('feishu:oc_shopping').activeAgentId, 'agt_peer')
})

test('cross-workspace agent-turn switch is rejected, audited, and leaves the Binding untouched', async (t) => {
  stubAgentProcess()
  const { router, wsRoot } = await freshRouter(t, {
    agt_shopping: 'workspace-oc_shopping',
    agt_family: 'workspace-oc_family',
  })
  await router.switchAgent('feishu:oc_shopping', 'agt_shopping')
  const proc = await router.ensureRunning('agt_shopping')
  proc.activeBindingContext = 'feishu:oc_shopping'

  const lines = await captureStderr(() =>
    assert.rejects(
      () => proc.onRpcRequest(SWITCH_RPC_METHOD, { targetAgentId: 'agt_family' }),
      (err) => {
        assert.match(err.message, /SWITCH_WORKSPACE_MISMATCH/, 'structured code survives the RPC message channel')
        assert.equal(err.code, 'SWITCH_WORKSPACE_MISMATCH')
        return true
      },
    ))

  const audit = lines.filter((line) => line.includes('switch-rejected'))
  assert.equal(audit.length, 1, 'exactly one audit line for the rejected switch')
  assert.match(audit[0], /code=SWITCH_WORKSPACE_MISMATCH/)
  assert.match(audit[0], /feishu:oc_shopping/)
  assert.match(audit[0], /agt_shopping -> agt_family/)
  assert.match(audit[0], new RegExp(`current_workspace=${join(wsRoot, 'workspace-oc_shopping').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  assert.match(audit[0], new RegExp(`target_primary=${join(wsRoot, 'workspace-oc_family').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))

  // No half-write: the Binding row is byte-identical to the pre-switch state.
  const binding = router.getBinding('feishu:oc_shopping')
  assert.equal(binding.activeAgentId, 'agt_shopping')
  assert.equal(binding.workspace, null)
})

test('operator-authorized cross-workspace handoff remains possible', async (t) => {
  stubAgentProcess()
  const { router } = await freshRouter(t, {
    agt_shopping: 'workspace-oc_shopping',
    agt_family: 'workspace-oc_family',
  })
  await router.switchAgent('feishu:oc_shopping', 'agt_shopping')
  await router.ensureRunning('agt_shopping')

  // The operator entry (product-api POST /v1/switch-agent) calls
  // Router.switchAgent directly — no RPC relay, no agent-turn guard.
  const binding = await router.switchAgent('feishu:oc_shopping', 'agt_family')
  assert.equal(binding.activeAgentId, 'agt_family')
  assert.equal(router.getBinding('feishu:oc_shopping').activeAgentId, 'agt_family')
})

test('workspace-carrying Binding: guard compares the RESOLVED preserved workspace', async (t) => {
  stubAgentProcess()
  const { router, wsRoot } = await freshRouter(t, {
    agt_shopping: 'workspace-oc_shopping',
    agt_family: 'workspace-oc_family',
  })
  // Binding carries an explicit workspaceId (V1 schema): its RESOLVED path is
  // the conversation's current workspace, not the active agent's primary.
  await router.switchAgent('feishu:oc_shopping', 'agt_shopping', { workspace: 'feishu-oc_shopping' })
  const proc = await router.ensureRunning('agt_shopping')
  proc.activeBindingContext = 'feishu:oc_shopping'

  const lines = await captureStderr(() =>
    assert.rejects(
      () => proc.onRpcRequest(SWITCH_RPC_METHOD, { targetAgentId: 'agt_family' }),
      /SWITCH_WORKSPACE_MISMATCH/,
    ))
  const audit = lines.filter((line) => line.includes('switch-rejected'))
  assert.match(audit[0], new RegExp(`current_workspace=${join(wsRoot, 'binding-ws', 'feishu-oc_shopping').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))

  const binding = router.getBinding('feishu:oc_shopping')
  assert.equal(binding.activeAgentId, 'agt_shopping', 'Binding untouched by the rejection')
  assert.equal(binding.workspace, 'feishu-oc_shopping')
})

test('first-contact switch with no existing Binding stays allowed (backward compatible)', async (t) => {
  stubAgentProcess()
  const { router } = await freshRouter(t, {
    agt_shopping: 'workspace-oc_shopping',
    agt_family: 'workspace-oc_family',
  })
  await router.switchAgent('feishu:oc_shopping', 'agt_shopping')
  const proc = await router.ensureRunning('agt_shopping')
  // A routed turn always has a Binding row; the no-row shape is the defensive
  // first-contact path (switching is a legal first contact, D-004 §2.1).
  proc.activeBindingContext = 'feishu:oc_new_group'

  const binding = await proc.onRpcRequest(SWITCH_RPC_METHOD, { targetAgentId: 'agt_family' })
  assert.equal(binding.activeAgentId, 'agt_family')
})
