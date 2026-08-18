/**
 * V2 PREBOUND_ONLY ingress gate tests
 * (AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC §4.5/§5.5, accepted).
 *
 * The gate is exercised END-TO-END over a REAL agent-router (real
 * BindingStore + real workspace-bootstrap over tmp roots + a fake per-agent
 * process factory) and the REAL feishu-connector bridge handler — only the
 * network/DSH edges are stubbed. This is the wiring the production-runtime
 * compose installs; the Router itself is never modified and never
 * Feishu-aware.
 *
 * Frozen verdicts proven here:
 *
 *   unknown/unbound conversation  -> FAIL CLOSED: the Router's onIngress is
 *     never called, resolveChannelConversation never runs, and NO default
 *     Binding row is created (the store stays empty).
 *
 *   known/pre-bound conversation with the primary-workspace shape
 *     (workspace null -> Default Workspace Rule) -> forwarded; the turn runs
 *     in the canonical 'main' session with cwd = resolveWorkspace(agentId)
 *     (Agent primary workspace), and no conversation workspace override ever
 *     reaches the Binding.
 *
 *   pre-bound row with a NON-PRIMARY Binding.workspace (the old p2p
 *     compatibility state, e.g. agt_stock_agent + feishu-oc_...) -> BLOCKED
 *     from the V2 normal path; the row is preserved byte-for-byte on disk.
 */

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { apply as applyBootstrap } from '../../workspace-bootstrap/src/index.js'
import { apply as applyRouter } from '../../agent-router/src/index.js'
import { createBridgeHandler } from '../../feishu-connector/src/bridge.js'
import { conversationWorkspaceId, INGRESS_GATE_REJECTED_REPLY } from '../../feishu-connector/src/core.js'
import { makeV2PreboundIngressGate, wireV2IngressGate, V2_INGRESS_MODE } from '../src/v2-ingress-gate.js'

/** Fake cordis ctx: get/provide/effect only (what the router uses). */
function fakeCtx(services) {
  const provided = new Map()
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    effect: (fn) => { const dispose = fn(); return () => dispose?.() },
  }
}

let pidSeq = 9100

/** Minimal fake per-agent process (records turns; freezes session cwds like
 *  the demo-server contract). */
class FakeProc {
  constructor({ agentId, home, workspace }) {
    this.agentId = agentId
    this.home = home
    this.workspace = workspace
    this.pid = ++pidSeq
    this.exit = undefined
    this.exitPromise = new Promise(() => {})
    this.turns = []
    this.sessionCwds = new Map()
  }
  spawn() {}
  async ready() { return 0 }
  async turn(sessionId, text, opts = {}) {
    this.turns.push({ sessionId, text, cwd: opts.cwd, bindingContext: opts.bindingContext })
    return { reply: `ok:${text}`, messageId: `m-${this.turns.length}` }
  }
  async deliver(sessionId, text, opts = {}) {
    this.turns.push({ sessionId, text, cwd: opts.cwd })
    return { accepted: true, sessionId, messageId: 'd-1' }
  }
  async shutdown() {}
}

const STOCK = { id: 'agt_stock_agent', name: 'Stock Agent' }

/**
 * Real definition + real workspace-bootstrap + real router over tmp stores,
 * plus a stub feishu handle carrying the REAL V2 gate (wired exactly like
 * compose.js wires it) and the REAL connector ingress pipeline.
 *
 * `primaryWorkspaces` (AGENT_PRIMARY_WORKSPACE_IMPORT_V1) optionally mounts
 * workspace-bootstrap with an import map; `importedDir` creates the imported
 * directory for it.
 */
async function freshRig(t, { bindings = {}, primaryWorkspaces = {} } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-v2gate-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const workspacesRoot = join(dir, 'workspaces')
  const homesRoot = join(dir, 'homes')
  await mkdir(workspacesRoot, { recursive: true })
  await mkdir(homesRoot, { recursive: true })

  // AGENT_PRIMARY_WORKSPACE_IMPORT_V1: import targets must be EXISTING real
  // directories (config-load validation) — create them under the rig tree.
  const importedDirs = new Map()
  for (const [agentId, path] of Object.entries(primaryWorkspaces)) {
    if (importedDirs.has(path)) continue
    await mkdir(path, { recursive: true })
    importedDirs.set(path, agentId)
  }

  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, {
    defaultAgentId: STOCK.id,
    agents: [{ id: STOCK.id, name: STOCK.name }],
  })
  const definition = new AgentDefinition({ configFile })

  const bctx = fakeCtx(new Map())
  applyBootstrap(bctx, { workspaceRoot: workspacesRoot, agentsHome: homesRoot, primaryWorkspaces })
  const workspaceBootstrap = bctx.get('workspaceBootstrap')

  // Optional pre-seeded durable binding rows (the real on-disk shapes).
  if (Object.keys(bindings).length > 0) {
    await writeFile(join(dir, 'bindings.json'), JSON.stringify({
      version: 1,
      bindings,
    }, null, 2), 'utf8')
  }

  const spawned = []
  const ctx = fakeCtx(new Map([
    ['workspaceBootstrap', workspaceBootstrap],
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
    processFactory: (opts) => { const p = new FakeProc(opts); spawned.push(p); return p },
  })

  // Stub feishu channel handle + the REAL SDK-to-Agent-Core bridge, wired
  // like compose.js. The official SDK owns normalization/policy/dedup before
  // this handler; these tests exercise the preserved PREBOUND_ONLY segment.
  const receipts = []
  const feishu = {
    gate: null,
    setIngressGate(fn) { this.gate = fn },
    reply: async (target, text) => { receipts.push({ target, text }) },
  }
  assert.equal(wireV2IngressGate(feishu, router, workspaceBootstrap), true)
  const forwarded = []
  const cfg = { onEvent: async (ev) => { forwarded.push(ev); await router.route(ev) }, ingressGate: feishu.gate }
  const handleIngress = createBridgeHandler({
    resolveBotIdentity: () => ({ openId: 'ou_bot', name: 'test-bot' }),
    config: cfg,
    reply: (ingress) => feishu.reply({ conversationId: ingress.conversationId }, INGRESS_GATE_REJECTED_REPLY),
    log: () => {},
  })

  /** A normalized SDK group message (the bridge emits NO workspace/session). */
  let msgSeq = 0
  const groupEvent = (conversationId, text = 'hello') => {
    const seq = ++msgSeq
    return {
      messageId: `om_${conversationId}_${seq}`,
      chatType: 'group',
      chatId: conversationId,
      senderId: 'ou_sender',
      senderType: 'user',
      senderName: 'test-user',
      content: text,
      rawContentType: 'text',
      resources: [],
      mentions: [],
      mentionAll: false,
      mentionedBot: true,
      createTime: Date.now(),
      raw: {
        event_id: `evt_${conversationId}_${seq}`,
        sender: { sender_id: { open_id: 'ou_sender' } },
      },
    }
  }

  return {
    dir, workspacesRoot, workspaceBootstrap, router, spawned,
    handleIngress, forwarded, receipts, groupEvent,
  }
}

// The real production group conversation shape: pre-bound, workspace null.
const GROUP_BINDING = (agentId = STOCK.id) => ({
  channelConversationId: 'feishu:oc_92332c45c1cac2ef89857abfee8ed762',
  activeAgentId: agentId,
  activeSessionId: 'main',
  workspace: null,
  updatedAt: '2026-08-17T00:00:00.000Z',
})

// The real old p2p transitional row: same agent, EXPLICIT non-primary workspace.
const P2P_COMPAT_BINDING = {
  channelConversationId: 'feishu:oc_9dd74b9ed02ce216951260a381eb502d',
  activeAgentId: STOCK.id,
  activeSessionId: 'main-oc_9dd74b9ed02ce216951260a381eb502d',
  workspace: 'feishu-oc_9dd74b9ed02ce216951260a381eb502d',
  updatedAt: '2026-07-01T00:00:00.000Z',
}

// ---------------------------------------------------------------------------

test('V2_INGRESS_MODE is frozen to PREBOUND_ONLY', () => {
  assert.equal(V2_INGRESS_MODE, 'PREBOUND_ONLY')
})

test('UNKNOWN conversation -> FAIL CLOSED: no forward, no default Binding row, fixed receipt', async (t) => {
  const rig = await freshRig(t)
  const before = rig.router.bindingsSnapshot()
  assert.equal(before.length, 0)

  await rig.handleIngress(rig.groupEvent('oc_brand_new'))

  assert.equal(rig.forwarded.length, 0, 'onIngress never ran')
  assert.equal(rig.spawned.length, 0, 'no agent process ever started')
  const after = rig.router.bindingsSnapshot()
  assert.equal(after.length, 0, 'MUST NOT create a default Binding (fail closed)')
  assert.equal(rig.router.getBinding('feishu:oc_brand_new'), undefined)
  assert.equal(rig.receipts.length, 1, 'structured rejection receipt sent')
  assert.equal(rig.receipts[0].text, INGRESS_GATE_REJECTED_REPLY)
  assert.equal(rig.receipts[0].target.conversationId, 'oc_brand_new')
})

test('UNKNOWN conversation (direct gate call): unbound verdict, store untouched', async (t) => {
  const rig = await freshRig(t)
  const gate = makeV2PreboundIngressGate({
    router: rig.router,
    workspaceBootstrap: rig.workspaceBootstrap,
  })
  const verdict = await gate({ conversationId: 'oc_nope' })
  assert.deepEqual(
    { allowed: verdict.allowed, reason: verdict.reason },
    { allowed: false, reason: 'unbound' },
  )
  assert.equal(verdict.channelConversationId, 'feishu:oc_nope')
  assert.equal(rig.router.bindingsSnapshot().length, 0, 'read-only gate created nothing')
})

test('PRE-BOUND primary conversation -> forwarded: canonical main + Agent primary workspace, no override', async (t) => {
  const rig = await freshRig(t, { bindings: { 'feishu:oc_92332c45c1cac2ef89857abfee8ed762': GROUP_BINDING() } })
  await rig.handleIngress(rig.groupEvent('oc_92332c45c1cac2ef89857abfee8ed762', 'ping'))

  assert.equal(rig.forwarded.length, 1)
  assert.equal(rig.receipts.length, 0)
  assert.equal(rig.spawned.length, 1, 'the bound agent process ran')

  const binding = rig.router.getBinding('feishu:oc_92332c45c1cac2ef89857abfee8ed762')
  assert.equal(binding.workspace, null, 'Binding.workspace stays null (no conversation override)')
  assert.equal(binding.activeAgentId, STOCK.id)

  const primaryWorkspace = rig.workspaceBootstrap.resolveWorkspace(STOCK.id)
  const turn = rig.spawned[0].turns[0]
  assert.equal(turn.sessionId, 'main', 'canonical main (native sessionId), not main-<conversationId>')
  assert.equal(turn.cwd, primaryWorkspace, 'session cwd == Agent primary workspace == resolveWorkspace(agentId)')
  assert.notEqual(turn.cwd, join(rig.workspacesRoot, conversationWorkspaceId('oc_92332c45c1cac2ef89857abfee8ed762')),
    'NOT the old conversation workspace')
})

test('PRE-BOUND primary conversation: second message RESUMES the same main (regression)', async (t) => {
  const rig = await freshRig(t, { bindings: { 'feishu:oc_92332c45c1cac2ef89857abfee8ed762': GROUP_BINDING() } })
  await rig.handleIngress(rig.groupEvent('oc_92332c45c1cac2ef89857abfee8ed762', 'first'))
  await rig.handleIngress(rig.groupEvent('oc_92332c45c1cac2ef89857abfee8ed762', 'second'))

  const turns = rig.spawned[0].turns
  assert.deepEqual(turns.map(x => x.sessionId), ['main', 'main'], 'same canonical main across messages')
  assert.equal(new Set(turns.map(x => x.cwd)).size, 1, 'same frozen cwd')
  assert.equal(rig.router.bindingsSnapshot().length, 1, 'no new Binding row')
})

test('PRE-BOUND NON-PRIMARY compatibility row -> BLOCKED from the V2 normal path, state preserved', async (t) => {
  const rig = await freshRig(t, { bindings: { 'feishu:oc_9dd74b9ed02ce216951260a381eb502d': { ...P2P_COMPAT_BINDING } } })
  const before = await readFile(join(rig.dir, 'bindings.json'), 'utf8')

  await rig.handleIngress(rig.groupEvent('oc_9dd74b9ed02ce216951260a381eb502d'))

  assert.equal(rig.forwarded.length, 0, 'must NOT enter the V2 normal route')
  assert.equal(rig.spawned.length, 0, 'no process started for the compatibility row')
  assert.equal(rig.receipts.length, 1, 'structured rejection receipt')

  // Transitional state preserved byte-for-byte: not deleted, not migrated,
  // not rewritten.
  const after = await readFile(join(rig.dir, 'bindings.json'), 'utf8')
  assert.equal(after, before, 'the p2p compatibility row is untouched on disk')
  const row = rig.router.getBinding('feishu:oc_9dd74b9ed02ce216951260a381eb502d')
  assert.equal(row.workspace, 'feishu-oc_9dd74b9ed02ce216951260a381eb502d')
  assert.equal(row.activeAgentId, STOCK.id)
})

test('NON-PRIMARY row (direct gate call): non_primary_workspace verdict', async (t) => {
  const rig = await freshRig(t, { bindings: { 'feishu:oc_9dd74b9ed02ce216951260a381eb502d': { ...P2P_COMPAT_BINDING } } })
  const gate = makeV2PreboundIngressGate({ router: rig.router, workspaceBootstrap: rig.workspaceBootstrap })
  const verdict = await gate({ conversationId: 'oc_9dd74b9ed02ce216951260a381eb502d' })
  assert.equal(verdict.allowed, false)
  assert.equal(verdict.reason, 'non_primary_workspace')
})

test('An explicit workspace that RESOLVES to the primary path is allowed (effective == primary)', async (t) => {
  const rig = await freshRig(t, {
    bindings: {
      'feishu:oc_equal': {
        channelConversationId: 'feishu:oc_equal',
        activeAgentId: STOCK.id,
        activeSessionId: 'main',
        // sanitize('agt_stock_agent') == 'agt_stock_agent' -> the SAME path
        // resolveWorkspace(agentId) derives.
        workspace: STOCK.id,
        updatedAt: '2026-08-17T00:00:00.000Z',
      },
    },
  })
  const gate = makeV2PreboundIngressGate({ router: rig.router, workspaceBootstrap: rig.workspaceBootstrap })
  const verdict = await gate({ conversationId: 'oc_equal' })
  assert.equal(verdict.allowed, true, 'effective workspace == Agent.primaryWorkspace satisfies the V2 rule')
})

test('wireV2IngressGate: wires onto a feishu handle; returns false without one', async (t) => {
  const rig = await freshRig(t)
  const gateCalls = []
  const feishu = { setIngressGate(fn) { gateCalls.push(fn) } }
  assert.equal(wireV2IngressGate(feishu, rig.router, rig.workspaceBootstrap), true)
  assert.equal(gateCalls.length, 1, 'gate installed on the connector handle')
  // No feishu channel mounted (honest offline): nothing to wire, no error.
  assert.equal(wireV2IngressGate(undefined, rig.router, rig.workspaceBootstrap), false)
})

test('makeV2PreboundIngressGate: fail-loud on missing generic Router read seams', () => {
  assert.throws(() => makeV2PreboundIngressGate({ router: {}, workspaceBootstrap: { resolveWorkspace: () => '', resolveWorkspacePath: () => '' } }), /getBinding/)
  assert.throws(() => makeV2PreboundIngressGate({ router: { getBinding: () => undefined, channelConversationId: () => 'x' }, workspaceBootstrap: {} }), /resolveWorkspace/)
})

// ---------------------------------------------------------------------------
// AGENT_PRIMARY_WORKSPACE_IMPORT_V1 — an imported primary must NOT open a
// Binding.workspace bypass around the V2 gate (task F / Spec §3 / AC6):
//
//   resolveWorkspacePath(workspaceId) stays the generic
//   <workspaceRoot>/<workspaceId> derivation (never consults the import
//   map), while resolveWorkspace(agentId) now returns the imported
//   directory — so a binding whose workspace STRING equals the agentId no
//   longer "resolves to the primary" and is blocked as
//   non_primary_workspace, exactly like any other non-primary workspace.
// ---------------------------------------------------------------------------

test('IMPORTED primary: Binding.workspace == agentId no longer resolves to the primary → blocked (non_primary_workspace)', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'acr-v2gate-imp-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const imported = join(dir, 'workspace-oc_0480imported')
  await mkdir(imported, { recursive: true })

  const rig = await freshRig(t, {
    primaryWorkspaces: { [STOCK.id]: imported },
    bindings: {
      'feishu:oc_equal': {
        channelConversationId: 'feishu:oc_equal',
        activeAgentId: STOCK.id,
        activeSessionId: 'main',
        // Pre-import this string RESOLVED to the primary path (the
        // "effective == primary" allowance). With the import active it must
        // NOT — the V2 gate stays fail-closed against the override.
        workspace: STOCK.id,
        updatedAt: '2026-08-17T00:00:00.000Z',
      },
    },
  })

  assert.equal(rig.workspaceBootstrap.resolveWorkspace(STOCK.id), imported,
    'the primary authority resolves the imported directory')
  assert.equal(rig.workspaceBootstrap.resolveWorkspacePath(STOCK.id), join(rig.workspacesRoot, STOCK.id),
    'Binding.workspace derivation stays generic (unpolluted by the override)')

  const gate = makeV2PreboundIngressGate({ router: rig.router, workspaceBootstrap: rig.workspaceBootstrap })
  const verdict = await gate({ conversationId: 'oc_equal' })
  assert.equal(verdict.allowed, false, 'no override-based bypass of the primary-workspace gate')
  assert.equal(verdict.reason, 'non_primary_workspace')
})

test('IMPORTED primary: workspace-null binding stays allowed and the turn runs in the imported directory', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'acr-v2gate-imp2-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const imported = join(dir, 'workspace-oc_0480imported')
  await mkdir(imported, { recursive: true })

  const rig = await freshRig(t, {
    primaryWorkspaces: { [STOCK.id]: imported },
    bindings: { 'feishu:oc_92332c45c1cac2ef89857abfee8ed762': GROUP_BINDING() },
  })
  await rig.handleIngress(rig.groupEvent('oc_92332c45c1cac2ef89857abfee8ed762', 'post-import turn'))

  assert.equal(rig.forwarded.length, 1, 'pre-bound primary shape still allowed')
  assert.equal(rig.spawned.length, 1)
  assert.equal(rig.spawned[0].turns[0].cwd, imported,
    'session cwd == Agent.primaryWorkspace == imported directory')
})
