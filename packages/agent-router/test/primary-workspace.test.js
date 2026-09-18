/**
 * AGENT_PRIMARY_WORKSPACE_IMPORT_V1 (accepted @d823750) — ROUTER seam tests
 * (task D + Spec §8/AC3/AC9).
 *
 * The Router change is MECHANICAL ONLY: at spawn it hands the control
 * plane's already-resolved primary workspace (workspaceBootstrap.
 * resolveWorkspace(agentId) output — the single path authority) to the child
 * process env as $DSH_PRIMARY_WORKSPACE, next to $DSH_AGENT_ID. Zero
 * re-derivation, zero product branching (ROUTER_PRODUCT_SPECIAL_CASE =
 * NONE). Everything downstream then flows through the existing seams:
 *
 *   process workspace (spawn cwd base) = imported directory
 *   turn/deliver session cwd            = imported directory (R1 freeze)
 *   pre-import session (cwd frozen in the old default workspace)
 *     -> SESSION_WORKSPACE_MISMATCH structured rejection (R3, no remap)
 *   scheduler-style turns (no explicit cwd) -> process-level imported
 *     workspace (AC10: the proc-level cwd base IS the imported directory)
 */

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
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

let pidSeq = 7300

/** Fake per-agent process capturing the factory options (workspace + env)
 *  and simulating the demo-server SESSION_WRITE_CONTRACT (R1 freeze / R3
 *  mismatch), like workspace-binding.test.js. */
class FakeProc {
  constructor({ agentId, home, workspace, env }) {
    this.agentId = agentId
    this.home = home
    this.workspace = workspace
    this.env = env
    this.pid = ++pidSeq
    this.exit = undefined
    this.exitResolve = undefined
    this.exitPromise = new Promise((resolve) => { this.exitResolve = resolve })
    this.onRpcRequest = undefined
    this.turns = []
    this.deliveries = []
    this.sessionCwds = new Map()
    this.spawned = true
  }
  spawn() { this.spawned = true }
  async ready() { return 0 }
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

const AGENT = { id: 'agt_stock_agent', name: 'Stock Agent' }

/**
 * Real definition + REAL workspace bootstrap (tmp roots, optional import map)
 * + real router + FakeProc factory.
 */
async function freshRig(t, { primaryWorkspaces = {} } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-priws-'))
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
  applyBootstrap(bctx, { workspaceRoot: workspacesRoot, agentsHome: homesRoot, primaryWorkspaces })
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
  return { router, bootstrap, dir, workspacesRoot, homesRoot, spawned }
}

/** An EXISTING imported directory with real pre-import content, no AGENTS.md. */
async function makeImported(t) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-priws-src-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const imported = join(dir, 'workspace-oc_imported')
  await mkdir(imported, { recursive: true })
  await writeFile(join(imported, 'MEMORY.md'), '# imported memory\n', 'utf8')
  await writeFile(join(imported, 'notes.md'), 'owned by the old world\n', 'utf8')
  return imported
}

/** An ingress with NO workspace field (Default Workspace Rule path). */
function ingress(text = 'hello') {
  return {
    channel: 'p2p', chatId: 'oc_x', conversationId: 'oc_x',
    sender: { openId: 'ou_sender' }, text,
  }
}

// ---------------------------------------------------------------------------

test('D: imported agent — spawn hands the process the imported workspace + env mechanically', async (t) => {
  const imported = await makeImported(t)
  const rig = await freshRig(t, { primaryWorkspaces: { [AGENT.id]: imported } })

  const result = await rig.router.route(ingress('first turn after import'))
  assert.equal(result.error, undefined)
  assert.equal(rig.spawned.length, 1)

  const proc = rig.spawned[0]
  assert.equal(proc.workspace, imported, 'process workspace (spawn cwd base) = imported directory')
  assert.deepEqual(
    proc.env,
    { DSH_AGENT_ID: AGENT.id, DSH_PRIMARY_WORKSPACE: imported },
    'spawn env carries the control-plane-resolved primary workspace verbatim (value pass-through, no branching)',
  )
  assert.equal(proc.turns[0].cwd, imported, 'session cwd (R1 freeze) = imported directory')
  assert.equal(proc.sessionCwds.get('main'), imported)
})

test('D: deliver V0 resolves the imported workspace as the per-session cwd (AC3)', async (t) => {
  const imported = await makeImported(t)
  const rig = await freshRig(t, { primaryWorkspaces: { [AGENT.id]: imported } })

  await rig.router.deliver({ requestId: 'r1', agentId: AGENT.id, sessionMode: 'main', message: 'x' })
  assert.equal(rig.spawned[0].deliveries[0].cwd, imported)
  assert.equal(rig.spawned[0].env.DSH_PRIMARY_WORKSPACE, imported)
})

test('D: default agent (no entry) — env still set mechanically to the derived default path', async (t) => {
  const rig = await freshRig(t)
  await rig.router.route(ingress())
  const proc = rig.spawned[0]
  const defaultPath = join(rig.workspacesRoot, AGENT.id)
  assert.equal(proc.workspace, defaultPath)
  assert.equal(proc.env.DSH_PRIMARY_WORKSPACE, defaultPath,
    'the env seam is unconditional value pass-through — resolveWorkspace output, import or not')
  assert.equal(proc.turns[0].cwd, defaultPath)
})

test('D/AC7: the router ensure() writes NOTHING into the imported directory', async (t) => {
  const imported = await makeImported(t)
  const rig = await freshRig(t, { primaryWorkspaces: { [AGENT.id]: imported } })
  await rig.router.route(ingress())

  const entries = (await readdir(imported)).sort()
  assert.deepEqual(entries, ['MEMORY.md', 'notes.md'], 'no AGENTS.md seeded, no memory/ created, nothing added')
  // The default-derived directory under workspacesRoot was NOT created either:
  // the agent never touches the TEST_ONLY_DISPOSABLE copy path.
  const wsRootEntries = await readdir(rig.workspacesRoot)
  assert.deepEqual(wsRootEntries, [], 'no <workspacesRoot>/<agentId> side directory created')
  // DSH home IS provisioned (control-plane state, independent of the import).
  const homeEntries = await readdir(join(rig.homesRoot, AGENT.id))
  assert.ok(homeEntries.length > 0, 'dshHome provisioned by the router spawn path')
})

test('AC9: pre-import session frozen in the old default workspace → structured rejection, no remap', async (t) => {
  const imported = await makeImported(t)
  const rig = await freshRig(t, { primaryWorkspaces: { [AGENT.id]: imported } })
  const oldDefault = join(rig.workspacesRoot, AGENT.id)

  // Simulate a PRE-import main: its header.cwd is frozen at the old default
  // workspace (persisted across the process death / control-plane restart).
  // Route once to spawn the process, then freeze the persisted header as the
  // OLD cwd would have been, and let the next turn hit the mismatch.
  const first = await rig.router.route(ingress('post-import fresh session'))
  assert.equal(first.error, undefined)
  const proc = rig.spawned.at(-1)
  proc.sessionCwds.set('main', oldDefault)

  const result = await rig.router.route(ingress('resume pre-import main'))
  assert.ok(result.error instanceof Error, 'turn rejected')
  assert.equal(result.error.code, 'SESSION_WORKSPACE_MISMATCH',
    'structured rejection (R3) — never a silent remap, never a new session')
  assert.equal(result.sessionId, undefined)
  assert.equal(proc.sessionCwds.get('main'), oldDefault, 'the frozen old cwd is never mutated')
})

test('I: restart over the same static config re-resolves the identical imported workspace', async (t) => {
  const imported = await makeImported(t)
  const primaryWorkspaces = { [AGENT.id]: imported }
  const rig = await freshRig(t, { primaryWorkspaces })
  await rig.router.route(ingress('run 1'))
  const first = { workspace: rig.spawned[0].workspace, env: rig.spawned[0].env.DSH_PRIMARY_WORKSPACE }

  // Control-plane restart: fresh mounts over the SAME static import map.
  const rig2 = await freshRig(t, { primaryWorkspaces })
  await rig2.router.route(ingress('run 2'))
  const second = { workspace: rig2.spawned[0].workspace, env: rig2.spawned[0].env.DSH_PRIMARY_WORKSPACE }
  assert.deepEqual(second, first)
  assert.equal(second.workspace, imported)
})
