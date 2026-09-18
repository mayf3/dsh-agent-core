/**
 * Unit tests for AGENT_CORE_BINDING_WORKSPACE_V1 at the ROUTER level —
 * Binding.workspace, effective-workspace resolution, per-session cwd
 * plumbing, and the frozen product scenarios:
 *
 *   AC1  two Feishu groups, same Agent -> two stable workspaces
 *   AC2/AC7  same workspace, multiple sessions -> same cwd, shared files
 *   AC3  App-style agent switch -> target Agent DEFAULT workspace follows
 *   AC4  cross-workspace mismatch -> structured reject, no partial write
 *   AC5  restart/resume -> persisted session cwd preserved
 *   AC6  different workspaces -> isolated files
 *   AC8  legacy binding without workspace -> resolveWorkspace(agentId)
 *   AC9  one Agent = one process across multiple workspaces
 *   AC10 no cwd leakage between bindings
 *   AC11 invalid workspaceIds -> structured WORKSPACE_ID_INVALID (router side)
 *
 * The rig drives the REAL router + REAL BindingStore + REAL workspace
 * bootstrap (over tmp roots) + a REAL Feishu workspace policy helper, with a
 * FAKE per-agent process that simulates the demo-server SESSION_WRITE_CONTRACT
 * (first turn freezes a session's cwd; a later turn with a different cwd
 * rejects with SESSION_WORKSPACE_MISMATCH) — the same contract proven at the
 * seam level in packages/demo-server/test/session-seam.test.js.
 */

import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { apply as applyBootstrap } from '../../workspace-bootstrap/src/index.js'
import { conversationWorkspaceId, conversationMainSessionId } from '../../feishu-connector/src/core.js'
import { apply as applyRouter } from '../src/index.js'

/** Fake cordis ctx: get/provide/effect only (what the router uses). */
function fakeCtx(services) {
  const provided = new Map()
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    effect: (fn) => { const dispose = fn(); return () => dispose?.() },
  }
}

let pidSeq = 5000

/**
 * Fake per-agent process that SIMULATES the demo-server session-write
 * contract: the first turn/deliver freezes the session's cwd (R1); a later
 * call resolving a different cwd rejects SESSION_WORKSPACE_MISMATCH (R3).
 * `seedCwds` pre-freezes persisted session cwds (restart simulation, R2).
 */
class FakeProc {
  constructor({ agentId, home, workspace, seedCwds = new Map() }) {
    this.agentId = agentId
    this.home = home
    this.workspace = workspace
    this.pid = ++pidSeq
    this.exit = undefined
    this.exitResolve = undefined
    this.exitPromise = new Promise((resolve) => { this.exitResolve = resolve })
    this.onRpcRequest = undefined
    this.turns = [] // { sessionId, text, cwd, bindingContext }
    this.deliveries = [] // { sessionId, text, cwd }
    this.sessionCwds = new Map(seedCwds) // sessionId -> frozen cwd
    this.spawned = true
  }

  spawn() { this.spawned = true }

  async ready() { return 0 }

  /** The demo-server contract, as seen from the router side of the wire. */
  assertCwd(sessionId, cwd) {
    const frozen = this.sessionCwds.get(sessionId)
    if (frozen === undefined) {
      this.sessionCwds.set(sessionId, cwd)
      return
    }
    if (frozen !== cwd) {
      throw Object.assign(
        new Error(`session ${sessionId} workspace mismatch (${frozen} != ${cwd})`),
        { code: 'SESSION_WORKSPACE_MISMATCH' },
      )
    }
  }

  async turn(sessionId, text, opts = {}) {
    this.assertCwd(sessionId, opts.cwd)
    this.turns.push({ sessionId, text, cwd: opts.cwd, bindingContext: opts.bindingContext })
    return { reply: `ok:${text}`, messageId: `m-${this.turns.length}`, ms: 1, promptMs: 1 }
  }

  async deliver(sessionId, text, opts = {}) {
    this.assertCwd(sessionId, opts.cwd)
    this.deliveries.push({ sessionId, text, cwd: opts.cwd })
    return { accepted: true, sessionId, messageId: `d-${this.deliveries.length}`, ms: 1 }
  }

  async shutdown() {}

  kill() {
    this.exit = { code: 9, signal: 'SIGKILL' }
    this.exitResolve?.({ code: 9, signal: 'SIGKILL' })
  }
}

/**
 * Build a definition + REAL workspace bootstrap (tmp roots) + REAL router
 * over tmp stores, with the FakeProc factory. Agents: [id, name] pairs,
 * first is default.
 */
async function freshRig(t, { agents = [[AGENT.id, AGENT.name]] } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-wsbind-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const workspacesRoot = join(dir, 'workspaces')
  const homesRoot = join(dir, 'homes')
  await mkdir(workspacesRoot, { recursive: true })
  await mkdir(homesRoot, { recursive: true })

  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, {
    defaultAgentId: agents[0]?.[0] ?? null,
    agents: agents.map(([id, name]) => ({ id, name })),
  })
  const definition = new AgentDefinition({ configFile })

  const bctx = fakeCtx(new Map())
  applyBootstrap(bctx, { workspaceRoot: workspacesRoot, agentsHome: homesRoot })
  const bootstrap = bctx.get('workspaceBootstrap')

  const spawned = []
  const spawnSessionCwds = new Map() // (agentId, sessionId) -> frozen cwd, survives process death
  const ctx = fakeCtx(new Map([
    ['workspaceBootstrap', bootstrap],
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
    processFactory: (opts) => {
      const seed = new Map([...spawnSessionCwds].filter(([k]) => k.startsWith(`${opts.agentId}:`))
        .map(([k, v]) => [k.slice(opts.agentId.length + 1), v]))
      const proc = new FakeProc({ ...opts, seedCwds: seed })
      spawned.push(proc)
      return proc
    },
  })
  return { router, definition, dir, workspacesRoot, homesRoot, spawned, spawnSessionCwds, bootstrap }
}

const AGENT = { id: 'agt_test', name: 'Test Agent' }
const AGENT_B = { id: 'agt_invest', name: 'Investment Agent' }
const AGENT_S = { id: 'agt_secretary', name: 'Secretary Agent' }

/** A Feishu-group ingress for `conversationId` with the entry's workspace policy. */
function groupIngress(conversationId, text = 'hello') {
  return {
    channel: 'group',
    chatId: conversationId,
    conversationId,
    sender: { openId: 'ou_sender' },
    text,
    // The PRODUCT ENTRY (feishu-connector) computed these; the Router
    // treats them as opaque data.
    workspace: conversationWorkspaceId(conversationId),
    session: conversationMainSessionId(conversationId),
  }
}

/** Mirror frozen session cwds into the rig's restart-surviving map. */
function persistSessionCwds(rig, agentId = AGENT.id) {
  for (const proc of rig.spawned) {
    if (proc.agentId !== agentId) continue
    for (const [sessionId, cwd] of proc.sessionCwds) {
      rig.spawnSessionCwds.set(`${agentId}:${sessionId}`, cwd)
    }
  }
}

// ---------------------------------------------------------------------------
// AC1 — two Feishu groups, same Agent, different stable Workspaces
// ---------------------------------------------------------------------------

test('AC1: same Agent + two Feishu group bindings -> two different, stable, deterministic workspaces', async (t) => {
  const { router, spawned, workspacesRoot } = await freshRig(t)

  const r1 = await router.route(groupIngress('oc_AAAA'))
  const r2 = await router.route(groupIngress('oc_BBBB'))

  assert.equal(r1.error, undefined)
  assert.equal(r2.error, undefined)
  const wsA = conversationWorkspaceId('oc_AAAA')
  const wsB = conversationWorkspaceId('oc_BBBB')
  assert.notEqual(wsA, wsB, 'the entry policy derives distinct ids')

  const b1 = router.getBinding('feishu:oc_AAAA')
  const b2 = router.getBinding('feishu:oc_BBBB')
  assert.equal(b1.activeAgentId, AGENT.id)
  assert.equal(b1.workspace, wsA, 'binding A stores the conversation workspaceId')
  assert.equal(b2.workspace, wsB)
  assert.notEqual(b1.workspace, b2.workspace)

  // Deterministic derivation: same conversation -> same id forever.
  assert.equal(conversationWorkspaceId('oc_AAAA'), wsA)

  // The sessions' cwds are the two DIFFERENT resolved workspace paths.
  assert.equal(spawned[0].turns[0].cwd, join(workspacesRoot, wsA))
  assert.equal(spawned[0].turns[1].cwd, join(workspacesRoot, wsB))

  // AC9 folded in: same Agent -> ONE process served both workspaces.
  assert.equal(spawned.length, 1, 'one Agent one process; workspaces vary per session cwd')
})

test('AC1 stability: bindings survive a control-plane restart with the same workspaceIds', async (t) => {
  const first = await freshRig(t)
  await first.router.route(groupIngress('oc_AAAA'))
  await first.router.route(groupIngress('oc_BBBB'))

  // Restart: fresh rig over the SAME store file (new router, new processes).
  const dir = first.dir
  const definition2 = new AgentDefinition({ configFile: join(dir, 'agents.json') })
  const bctx = fakeCtx(new Map())
  applyBootstrap(bctx, { workspaceRoot: first.workspacesRoot, agentsHome: first.homesRoot })
  const ctx2 = fakeCtx(new Map([
    ['workspaceBootstrap', bctx.get('workspaceBootstrap')],
    ['agentDefinition', {
      listAgents: () => definition2.listAgents(),
      getAgent: (id) => definition2.getAgent(id),
      getDefaultAgent: () => definition2.getDefaultAgent(),
      resolveAgentRef: (ref) => definition2.resolveAgentRef(ref),
    }],
  ]))
  const router2 = applyRouter(ctx2, {
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultSessionId: 'main',
    agentProfile: 'agent-core-demo',
    processFactory: (opts) => new FakeProc(opts),
  })
  assert.equal(router2.getBinding('feishu:oc_AAAA').workspace, conversationWorkspaceId('oc_AAAA'))
  assert.equal(router2.getBinding('feishu:oc_BBBB').workspace, conversationWorkspaceId('oc_BBBB'))
})

// ---------------------------------------------------------------------------
// AC2 / AC7 — same Workspace, multiple Sessions
// ---------------------------------------------------------------------------

test('AC2/AC7: one group workspace, main + cron sessions -> different sessionIds, SAME cwd, shared files', async (t) => {
  const { router, spawned, workspacesRoot } = await freshRig(t)
  const cc = 'feishu:oc_AAAA'
  const ws = conversationWorkspaceId('oc_AAAA')
  const cwd = join(workspacesRoot, ws)

  await router.route(groupIngress('oc_AAAA', 'main turn'))
  // A second session in the SAME conversation workspace (product entry
  // selects it; the Router only records the triple).
  await router.switchAgent(cc, AGENT.id, { targetSessionId: 'cron-daily' })
  await router.route(groupIngress('oc_AAAA', 'cron turn'))

  const turns = spawned[0].turns
  assert.deepEqual(turns.map(x => x.sessionId), ['main-oc_AAAA', 'cron-daily'], 'distinct native sessions')
  assert.deepEqual(turns.map(x => x.cwd), [cwd, cwd], 'same frozen workspace cwd')
  // Shared instruction/memory surface: the workspace dir was bootstrapped
  // (AGENTS.md) — both sessions read the SAME files by construction.
  assert.ok(existsSync(join(cwd, 'AGENTS.md')), 'workspace bootstrapped with AGENTS.md')
})

// ---------------------------------------------------------------------------
// AC3 — App-style agent switch -> target Agent default workspace
// ---------------------------------------------------------------------------

test('AC3: App switch to Investment Agent -> its DEFAULT workspace, no product logic in the Router', async (t) => {
  const { router, spawned, workspacesRoot } = await freshRig(t, { agents: [[AGENT_S.id, AGENT_S.name], [AGENT_B.id, AGENT_B.name]] })

  // First contact from the App-style mobile surface: NO workspace field —
  // the binding starts on the default rule (secretary default).
  await router.route({
    channel: 'mobile', chatId: 'surface-1', conversationId: 'surface-1',
    sender: { openId: 'mobile:surface-1' }, text: 'hi',
  })
  const cc = 'mobile:surface-1'
  assert.equal(router.getBinding(cc).workspace, null)
  assert.equal(spawned[0].turns[0].cwd, join(workspacesRoot, AGENT_S.id), 'secretary default workspace')

  // The switch entry passes only the target agent — the effective workspace
  // follows the DEFAULT RULE for the target (null preserved -> target
  // default), never the previous agent's workspace.
  const binding = await router.switchAgent(cc, AGENT_B.id)
  assert.equal(binding.activeAgentId, AGENT_B.id)
  assert.equal(binding.workspace, null, 'App switch -> target Agent default (not secretary\'s)')

  await router.route({
    channel: 'mobile', chatId: 'surface-1', conversationId: 'surface-1',
    sender: { openId: 'mobile:surface-1' }, text: 'invest!',
  })
  const investTurn = spawned.find(p => p.agentId === AGENT_B.id).turns.at(-1)
  assert.equal(investTurn.cwd, join(workspacesRoot, AGENT_B.id), 'investment default workspace via resolveWorkspace(agentId)')
  assert.notEqual(investTurn.cwd, join(workspacesRoot, AGENT_S.id), 'never 投资Agent+秘书Workspace')
})

// ---------------------------------------------------------------------------
// AC4 — cross-workspace mismatch: structured reject, cwd unchanged, no partial write
// ---------------------------------------------------------------------------

test('AC4: persisted session cwd A vs resolved workspace B -> SESSION_WORKSPACE_MISMATCH, no mutation', async (t) => {
  const { router, spawned } = await freshRig(t)
  const cc = 'feishu:oc_AAAA'
  const wsA = conversationWorkspaceId('oc_AAAA')

  await router.route(groupIngress('oc_AAAA', 'freeze cwd in workspace A'))
  const frozenA = spawned[0].turns[0].cwd

  // The product entry moves the binding to workspace B while the active
  // session's cwd is frozen at A.
  const switched = await router.switchAgent(cc, AGENT.id, { workspace: 'ws-explicit-B' })
  assert.equal(switched.workspace, 'ws-explicit-B')

  const result = await router.route(groupIngress('oc_AAAA', 'now resolves B'))
  assert.ok(result.error instanceof Error, 'turn rejected')
  assert.equal(result.error.code, 'SESSION_WORKSPACE_MISMATCH', 'structured rejection code')

  // cwd unchanged: the session stays frozen at A.
  assert.equal(spawned[0].sessionCwds.get(conversationMainSessionId('oc_AAAA')), frozenA)
  // No partial write: the binding is exactly the atomic switch result — the
  // failed turn rewrote nothing.
  const after = router.getBinding(cc)
  assert.deepEqual(
    { agent: after.activeAgentId, session: after.activeSessionId, workspace: after.workspace },
    { agent: switched.activeAgentId, session: switched.activeSessionId, workspace: switched.workspace },
  )
  assert.equal(after.updatedAt, switched.updatedAt, 'no half-write during the rejected turn')

  // Recovering is a PRODUCT decision (select a compatible session / move the
  // workspace back) — the Router never does it silently. Switching the
  // workspace back unblocks the same session.
  await router.switchAgent(cc, AGENT.id, { workspace: wsA })
  const ok = await router.route(groupIngress('oc_AAAA', 'back on A'))
  assert.equal(ok.error, undefined)
  assert.equal(spawned[0].sessionCwds.get(conversationMainSessionId('oc_AAAA')), frozenA, 'same cwd resumed, never mutated')
})

// ---------------------------------------------------------------------------
// AC5 — restart / resume
// ---------------------------------------------------------------------------

test('AC5: process restart -> sessions resume their persisted cwds; wrong resolution rejects', async (t) => {
  const rig = await freshRig(t)

  await rig.router.route(groupIngress('oc_AAAA', 'a1'))
  await rig.router.route(groupIngress('oc_BBBB', 'b1'))
  const cwdA = rig.spawned[0].turns[0].cwd
  const cwdB = rig.spawned[0].turns[1].cwd

  // "Persist" the frozen session headers, kill the process, respawn.
  persistSessionCwds(rig)
  rig.spawned[0].kill()
  const a2 = await rig.router.route(groupIngress('oc_AAAA', 'a2'))
  const b2 = await rig.router.route(groupIngress('oc_BBBB', 'b2'))
  assert.equal(a2.error, undefined)
  assert.equal(b2.error, undefined)
  const proc2 = rig.spawned[1]
  assert.equal(proc2.turns[0].cwd, cwdA, 'session resumes with its persisted cwd (R2 equal)')
  assert.equal(proc2.turns[1].cwd, cwdB)

  // A control-plane that resolves a DIFFERENT workspace for a persisted
  // session is structurally rejected (R3) — the resume path never re-guesses.
  await rig.router.switchAgent('feishu:oc_AAAA', AGENT.id, { workspace: 'ws-wrong' })
  const bad = await rig.router.route(groupIngress('oc_AAAA', 'a3'))
  assert.equal(bad.error?.code, 'SESSION_WORKSPACE_MISMATCH')
  assert.equal(proc2.sessionCwds.get(conversationMainSessionId('oc_AAAA')), cwdA, 'persisted cwd still intact')
})

// ---------------------------------------------------------------------------
// AC6 — different Workspaces are isolated
// ---------------------------------------------------------------------------

test('AC6: two workspaces -> isolated AGENTS.md / files', async (t) => {
  const { router, workspacesRoot } = await freshRig(t)

  await router.route(groupIngress('oc_AAAA', 'hi'))
  await router.route(groupIngress('oc_BBBB', 'hi'))
  const dirA = join(workspacesRoot, conversationWorkspaceId('oc_AAAA'))
  const dirB = join(workspacesRoot, conversationWorkspaceId('oc_BBBB'))

  assert.ok(existsSync(join(dirA, 'AGENTS.md')))
  assert.ok(existsSync(join(dirB, 'AGENTS.md')))
  // A file written in workspace A never appears in workspace B.
  await writeFile(join(dirA, 'GROUP_A_ONLY.txt'), 'secret', 'utf8')
  const entriesB = await readdir(dirB)
  assert.ok(!entriesB.includes('GROUP_A_ONLY.txt'), 'no leakage across workspaces')
})

// ---------------------------------------------------------------------------
// AC8 — legacy bindings fall back to resolveWorkspace(agentId)
// ---------------------------------------------------------------------------

test('AC8: a legacy store row WITHOUT workspace loads as null and turns in the agent default workspace', async (t) => {
  const rig = await freshRig(t)
  // Hand-write a pre-Spec store document (the exact legacy shape).
  const legacy = {
    version: 1,
    bindings: {
      'feishu:oc_legacy': {
        channelConversationId: 'feishu:oc_legacy',
        activeAgentId: AGENT.id,
        activeSessionId: 'main',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    },
  }
  await writeFile(join(rig.dir, 'bindings.json'), JSON.stringify(legacy, null, 2), 'utf8')

  const definition2 = new AgentDefinition({ configFile: join(rig.dir, 'agents.json') })
  const bctx = fakeCtx(new Map())
  applyBootstrap(bctx, { workspaceRoot: rig.workspacesRoot, agentsHome: rig.homesRoot })
  const ctx2 = fakeCtx(new Map([
    ['workspaceBootstrap', bctx.get('workspaceBootstrap')],
    ['agentDefinition', {
      listAgents: () => definition2.listAgents(),
      getAgent: (id) => definition2.getAgent(id),
      getDefaultAgent: () => definition2.getDefaultAgent(),
      resolveAgentRef: (ref) => definition2.resolveAgentRef(ref),
    }],
  ]))
  const router2 = applyRouter(ctx2, {
    bindingsStoreFile: join(rig.dir, 'bindings.json'),
    defaultSessionId: 'main',
    agentProfile: 'agent-core-demo',
    processFactory: (opts) => new FakeProc(opts),
  })

  const binding = router2.getBinding('feishu:oc_legacy')
  assert.equal(binding.workspace, null, 'legacy row -> null (no forced migration)')

  const result = await router2.route(groupIngress('oc_legacy', 'still works'))
  // The legacy ingress CARRIES the new conversation workspace policy — but
  // the existing binding wins (stability): it stays on the agent default.
  assert.equal(router2.getBinding('feishu:oc_legacy').workspace, null)
  assert.equal(result.error, undefined)
  assert.equal(result.sessionId, 'main')
})

test('AC8 (fresh legacy path): an ingress WITHOUT any workspace field turns in the agent default workspace', async (t) => {
  const { router, spawned, workspacesRoot } = await freshRig(t)
  const result = await router.route({
    channel: 'p2p', chatId: 'oc_p2p', conversationId: 'oc_p2p',
    sender: { openId: 'ou_x' }, text: 'legacy ingress (no workspace field)',
  })
  assert.equal(result.error, undefined)
  assert.equal(router.getBinding('feishu:oc_p2p').workspace, null)
  assert.equal(spawned[0].turns[0].cwd, join(workspacesRoot, AGENT.id), 'resolveWorkspace(agentId) fallback')
})

// ---------------------------------------------------------------------------
// AC9 / AC10 — one process per agent; no cross-binding cwd leakage
// ---------------------------------------------------------------------------

test('AC9/AC10: same Agent, two bindings with different workspaces -> ONE process, per-binding cwd only', async (t) => {
  const { router, spawned, workspacesRoot } = await freshRig(t)

  await router.route(groupIngress('oc_AAAA', 'for A'))
  await router.route(groupIngress('oc_BBBB', 'for B'))
  assert.equal(spawned.length, 1, 'registry stays keyed by agentId — one process')

  const cwds = spawned[0].turns.map(x => x.cwd)
  assert.deepEqual(cwds, [
    join(workspacesRoot, conversationWorkspaceId('oc_AAAA')),
    join(workspacesRoot, conversationWorkspaceId('oc_BBBB')),
  ], 'each turn carried exactly its own binding\'s resolved workspace')
  assert.deepEqual(spawned[0].turns.map(x => x.bindingContext), ['feishu:oc_AAAA', 'feishu:oc_BBBB'])
})

// ---------------------------------------------------------------------------
// AC11 (router side) — workspaceId validation at the domain surface
// ---------------------------------------------------------------------------

test('AC11: switchAgent rejects invalid workspaceIds structurally and leaves the Binding untouched', async (t) => {
  const { router } = await freshRig(t)
  const cc = 'feishu:oc_AAAA'
  await router.route(groupIngress('oc_AAAA', 'seed'))

  for (const bad of ['a/b', '..', '.', ' lead', 'trail ', 'a\\b', '/abs', 'a.b', 'x'.repeat(201), '', 42]) {
    await assert.rejects(
      () => router.switchAgent(cc, AGENT.id, { workspace: bad }),
      (error) => error.code === 'WORKSPACE_ID_INVALID',
      `expected WORKSPACE_ID_INVALID for ${JSON.stringify(bad)}`,
    )
  }
  const after = router.getBinding(cc)
  assert.equal(after.workspace, conversationWorkspaceId('oc_AAAA'), 'rejected switch never mutated the binding')

  // Valid ids pass through unchanged (never reshaped).
  for (const good of ['feishu-oc_9233xyz', 'secretary', 'investment']) {
    const b = await router.switchAgent(cc, AGENT.id, { workspace: good })
    assert.equal(b.workspace, good)
  }
})

test('AC11 (resolve surface): first contact with an invalid workspaceId is rejected before any binding row', async (t) => {
  const { router } = await freshRig(t)
  await assert.rejects(
    () => router.resolveChannelConversation({ channel: 'feishu', externalId: 'oc_bad', workspace: '../evil' }),
    (error) => error.code === 'WORKSPACE_ID_INVALID',
  )
  assert.equal(router.getBinding('feishu:oc_bad'), undefined, 'no binding row was created')
})

// ---------------------------------------------------------------------------
// switchAgent workspace semantics (preserve / explicit reset)
// ---------------------------------------------------------------------------

test('switchAgent: omitted workspace PRESERVES the binding workspace across agent switches', async (t) => {
  const { router } = await freshRig(t, { agents: [[AGENT.id, AGENT.name], [AGENT_B.id, AGENT_B.name]] })
  const cc = 'feishu:oc_AAAA'
  await router.route(groupIngress('oc_AAAA', 'seed'))
  const ws = conversationWorkspaceId('oc_AAAA')

  // In-group agent switch: the conversation workspace stays (the group's
  // sessions keep sharing the group workspace).
  const b = await router.switchAgent(cc, AGENT_B.id, { targetSessionId: 'main' })
  assert.equal(b.activeAgentId, AGENT_B.id)
  assert.equal(b.workspace, ws, 'group workspace preserved across the switch')

  // Explicit null resets to the Default Workspace Rule.
  const reset = await router.switchAgent(cc, AGENT.id, { workspace: null })
  assert.equal(reset.workspace, null)
})

// ---------------------------------------------------------------------------
// deliver path — Default Workspace Rule mechanically
// ---------------------------------------------------------------------------

test('deliver: Delivery V0 sessions run in the agent default workspace (no Binding exists)', async (t) => {
  const { router, spawned, workspacesRoot } = await freshRig(t)
  await router.deliver({ requestId: 'j1', agentId: AGENT.id, sessionMode: 'main', message: 'x' })
  const fresh = await router.deliver({ requestId: 'req-X', agentId: AGENT.id, sessionMode: 'fresh', message: 'y' })
  assert.equal(spawned.length, 1)
  assert.deepEqual(
    spawned[0].deliveries.map(d => d.cwd),
    [join(workspacesRoot, AGENT.id), join(workspacesRoot, AGENT.id)],
    'both delivery sessions resolved the agent default workspace as their cwd',
  )
  assert.notEqual(spawned[0].deliveries[0].sessionId, fresh.sessionId)
})
