/**
 * Feishu V2 NORMAL path tests (AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC
 * §5/§6, accepted) at the Router level.
 *
 * The V2 normal Feishu ingress carries NEITHER a workspace NOR a session
 * field (the connector stopped injecting them). The Router — fully generic,
 * unchanged — then mechanically produces the V2 shape:
 *
 *   Binding.workspace   = null (Default Workspace Rule, no override)
 *   activeSessionId     = 'main' (the deployment default = canonical main)
 *   session cwd         = resolveWorkspace(agentId) (Agent primary workspace)
 *
 * Plus the main create/resume regression: the second message RESUMES the same
 * native 'main' session with the same frozen cwd (one process, one binding
 * row). The Router's generic explicit-workspace override mechanism (old
 * compatibility rows) is regression-covered by workspace-binding.test.js.
 */

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { apply as applyBootstrap } from '../../workspace-bootstrap/src/index.js'
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

let pidSeq = 9300

/** Fake per-agent process freezing session cwds (the demo-server contract as
 *  seen from the Router side of the wire). */
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
    const frozen = this.sessionCwds.get(sessionId)
    if (frozen !== undefined && frozen !== opts.cwd) {
      throw Object.assign(new Error('cwd mismatch'), { code: 'SESSION_WORKSPACE_MISMATCH' })
    }
    this.sessionCwds.set(sessionId, opts.cwd)
    this.turns.push({ sessionId, text, cwd: opts.cwd, bindingContext: opts.bindingContext })
    return { reply: `ok:${text}`, messageId: `m-${this.turns.length}` }
  }
  async deliver(sessionId, text, opts = {}) {
    this.turns.push({ sessionId, text, cwd: opts.cwd })
    return { accepted: true, sessionId, messageId: 'd-1' }
  }
  async shutdown() {}
}

const AGENT = { id: 'agt_stock_agent', name: 'Stock Agent' }

async function freshRig(t) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-v2normal-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const workspacesRoot = join(dir, 'workspaces')
  const homesRoot = join(dir, 'homes')
  await mkdir(workspacesRoot, { recursive: true })
  await mkdir(homesRoot, { recursive: true })

  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, {
    defaultAgentId: AGENT.id,
    agents: [{ id: AGENT.id, name: AGENT.name }],
  })
  const definition = new AgentDefinition({ configFile })

  const bctx = fakeCtx(new Map())
  applyBootstrap(bctx, { workspaceRoot: workspacesRoot, agentsHome: homesRoot })
  const bootstrap = bctx.get('workspaceBootstrap')

  const spawned = []
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
    processFactory: (opts) => { const p = new FakeProc(opts); spawned.push(p); return p },
  })
  return { dir, workspacesRoot, bootstrap, router, spawned }
}

/** The V2-normal Feishu ingress: exactly what normalizeIngressEvent now
 *  produces for a mentioned group message — NO workspace, NO session. */
function v2FeishuIngress(conversationId, text = 'hello', channel = 'group') {
  return {
    channel,
    chatType: channel,
    conversationId,
    chatId: conversationId,
    messageId: `om_${conversationId}`,
    sender: { openId: 'ou_sender' },
    text,
  }
}

// ---------------------------------------------------------------------------

test('V2 normal: first contact binds workspace=null + session main, turns in the Agent primary workspace', async (t) => {
  const { router, spawned, workspacesRoot, bootstrap } = await freshRig(t)
  const result = await router.route(v2FeishuIngress('oc_92332c45c1cac2ef89857abfee8ed762'))

  assert.equal(result.error, undefined)
  assert.equal(result.sessionId, 'main', 'canonical main (native sessionId)')

  const binding = router.getBinding('feishu:oc_92332c45c1cac2ef89857abfee8ed762')
  assert.equal(binding.activeAgentId, AGENT.id)
  assert.equal(binding.workspace, null, 'no conversation workspace override (Binding.workspace = null)')
  assert.equal(binding.activeSessionId, 'main')

  const primary = bootstrap.resolveWorkspace(AGENT.id)
  assert.equal(primary, join(workspacesRoot, AGENT.id))
  assert.equal(spawned[0].turns[0].cwd, primary,
    'session cwd == Agent.primaryWorkspace == resolveWorkspace(agentId)')
})

test('V2 normal: the conversation-derived workspace is NEVER chosen', async (t) => {
  const { router, spawned, workspacesRoot } = await freshRig(t)
  await router.route(v2FeishuIngress('oc_92332c45c1cac2ef89857abfee8ed762'))
  const cwd = spawned[0].turns[0].cwd
  assert.notEqual(cwd, join(workspacesRoot, 'feishu-oc_92332c45c1cac2ef89857abfee8ed762'),
    'the old conversation workspace id must not be the cwd')
  assert.equal(cwd, join(workspacesRoot, AGENT.id))
})

test('V2 normal: second message RESUMES the same main (create/resume regression)', async (t) => {
  const { router, spawned } = await freshRig(t)
  const cc = 'feishu:oc_92332c45c1cac2ef89857abfee8ed762'

  const r1 = await router.route(v2FeishuIngress('oc_92332c45c1cac2ef89857abfee8ed762', 'first'))
  const r2 = await router.route(v2FeishuIngress('oc_92332c45c1cac2ef89857abfee8ed762', 'second'))

  assert.equal(r1.error, undefined)
  assert.equal(r2.error, undefined)
  assert.equal(r1.sessionId, 'main')
  assert.equal(r2.sessionId, 'main', 'second message resumes the SAME canonical main')
  assert.equal(spawned.length, 1, 'one Agent = one process across both messages')
  assert.deepEqual(spawned[0].turns.map(x => x.sessionId), ['main', 'main'])
  assert.deepEqual(spawned[0].turns.map(x => x.cwd).filter((c, i, a) => a.indexOf(c) === i).length, 1,
    'same frozen cwd across both turns (R2)')
  assert.equal(router.bindingsSnapshot().length, 1, 'exactly one binding row, never rewritten')
})

test('V2 normal: p2p ingress has the same shape (no p2p special case)', async (t) => {
  const { router, spawned, workspacesRoot } = await freshRig(t)
  const result = await router.route(v2FeishuIngress('oc_p2p_v2', 'dm', 'p2p'))
  assert.equal(result.error, undefined)
  const binding = router.getBinding('feishu:oc_p2p_v2')
  assert.equal(binding.workspace, null)
  assert.equal(binding.activeSessionId, 'main')
  assert.equal(spawned[0].turns[0].cwd, join(workspacesRoot, AGENT.id))
})

test('V2 normal: fresh non-main sessions in the SAME conversation share the primary cwd', async (t) => {
  const { router, spawned, workspacesRoot } = await freshRig(t)
  const cc = 'feishu:oc_92332c45c1cac2ef89857abfee8ed762'
  await router.route(v2FeishuIngress('oc_92332c45c1cac2ef89857abfee8ed762', 'main turn'))
  // A non-main session of the same agent (e.g. via switchAgent's explicit
  // targetSessionId — same Agent, same workspace): the Router resolves the
  // SAME primary cwd for it (V2: all sessions share the Agent workspace).
  await router.switchAgent(cc, AGENT.id, { targetSessionId: 'cron-run-1' })
  await router.route(v2FeishuIngress('oc_92332c45c1cac2ef89857abfee8ed762', 'cron turn'))

  const turns = spawned[0].turns
  assert.deepEqual(turns.map(x => x.sessionId), ['main', 'cron-run-1'])
  assert.deepEqual(turns.map(x => x.cwd), [join(workspacesRoot, AGENT.id), join(workspacesRoot, AGENT.id)],
    'SAME Agent primary workspace cwd across main and non-main sessions')
  // The binding keeps the V2 shape (the explicit-session switch preserved
  // workspace null).
  assert.equal(router.getBinding(cc).workspace, null)
})
