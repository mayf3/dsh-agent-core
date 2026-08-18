/**
 * AGENT_PRIMARY_WORKSPACE_IMPORT_V1 (accepted @d823750) — production-runtime
 * composition tests.
 *
 * The runtime's ONLY new responsibility (§4/§9): READ the optional
 * deployment-authored `<productionRoot>/primary-workspaces.json`
 * (agentId → absolute existing directory) and hand it to workspace-bootstrap
 * (the single path authority, which fail-loud validates every entry) via
 * applyBootstrap — plus one startup log line. Absent file = no imports =
 * behavior identical to today. The runtime never writes the file and adds no
 * second validator.
 */

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { composeProductionRuntime } from '../src/compose.js'
import { resolveProductionLayout } from '../src/paths.js'

const AGT_ID = 'agt_stock_agent'

let pidSeq = 4600

/** Fake per-agent process capturing the factory options (workspace + env). */
class FakeProc {
  constructor({ agentId, workspace, env }) {
    this.agentId = agentId
    this.workspace = workspace
    this.env = env
    this.pid = ++pidSeq
    this.home = `/tmp/prt-priws-home-${agentId}`
    this.profile = 'fake-profile'
    this.creations = []
    this.exit = undefined
    this.exitResolve = undefined
    this.exitPromise = new Promise((resolve) => { this.exitResolve = resolve })
    this.onRpcRequest = undefined
    this.turns = []
    this.deliveries = []
  }
  spawn() {}
  async ready() { return 1 }
  async deliver(sessionId, text, opts = {}) {
    this.deliveries.push({ sessionId, text, cwd: opts.cwd })
    return { accepted: true, sessionId, messageId: `msg-${this.deliveries.length}` }
  }
  async turn(sessionId, text, opts = {}) {
    this.turns.push({ sessionId, text, cwd: opts.cwd })
    return { reply: `TURNED:${text}`, ms: 1, promptMs: 1, messageId: `m${this.turns.length}` }
  }
  async shutdown() {}
  kill() {
    this.exit = { code: 9, signal: 'SIGKILL' }
    this.exitResolve?.({ code: 9, signal: 'SIGKILL' })
  }
}

/** Seed a tmp production root (layout + default agent) + an EXISTING
 *  imported directory with pre-import content (no AGENTS.md).
 *
 *  `mapAgentToImported` writes { [AGT_ID]: <created imported dir> } into
 *  <root>/primary-workspaces.json (the valid import case); `rawMap` writes a
 *  verbatim object (invalid-entry cases). Neither → no file (today's
 *  behavior). */
async function seedRuntime(t, { mapAgentToImported = false, rawMap = undefined } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'prt-priws-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const layout = resolveProductionLayout(root)
  mkdirSync(join(root, 'scheduler'), { recursive: true })
  await writeAgentDefinition(layout.agentsConfig, {
    defaultAgentId: AGT_ID,
    agents: [{ id: AGT_ID, name: 'Stock Agent' }],
  })

  const importedRoot = await mkdtemp(join(tmpdir(), 'prt-priws-src-'))
  t.after(() => rmSync(importedRoot, { recursive: true, force: true }))
  const imported = join(importedRoot, 'workspace-oc_0480imported')
  await mkdir(imported, { recursive: true })
  await writeFile(join(imported, 'MEMORY.md'), '# imported\n', 'utf8')
  await writeFile(join(imported, 'notes.md'), 'old world\n', 'utf8')

  const map = mapAgentToImported ? { [AGT_ID]: imported } : rawMap
  if (map !== undefined) {
    await writeFile(join(root, 'primary-workspaces.json'), JSON.stringify(map, null, 2), 'utf8')
  }
  return { root, layout, imported }
}

const silentLog = { log() {}, warn() {}, error() {} }

test('wiring: the import map reaches workspace-bootstrap AND the spawned process (cwd base + env)', async (t) => {
  const { root, layout, imported } = await seedRuntime(t, { mapAgentToImported: true })
  const spawned = []
  const lines = []
  const runtime = await composeProductionRuntime({
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: false, port: 0 },
    processFactory: (opts) => { const p = new FakeProc(opts); spawned.push(p); return p },
    log: { ...silentLog, log: (...a) => lines.push(a.join(' ')) },
  })
  t.after(() => runtime.stop())

  const bootstrap = runtime.ctx.get('workspaceBootstrap')
  assert.equal(bootstrap.resolveWorkspace(AGT_ID), imported, 'single path authority resolves the imported dir')
  assert.deepEqual(bootstrap.primaryWorkspaces, { [AGT_ID]: imported })
  assert.ok(
    lines.some((line) => line.includes('primary workspace imports loaded') && line.includes(AGT_ID) && line.includes(imported)),
    'one startup log line announces the import map',
  )

  await runtime.router.deliver({ requestId: 'r1', agentId: AGT_ID, sessionMode: 'main', message: 'x' })
  assert.equal(spawned.length, 1)
  assert.equal(spawned[0].workspace, imported, 'process workspace (spawn cwd base) = imported dir')
  assert.equal(spawned[0].env.DSH_PRIMARY_WORKSPACE, imported, 'spawn env carries the imported primary verbatim')
  assert.equal(spawned[0].env.DSH_AGENT_ID, AGT_ID)
  assert.equal(spawned[0].deliveries[0].cwd, imported, 'session cwd = imported dir (R1)')

  // AC7 at the composition level: the import never wrote into the directory.
  const entries = readdirSync(imported).sort()
  assert.deepEqual(entries, ['MEMORY.md', 'notes.md'], 'zero write into the imported workspace')
  assert.ok(!existsSync(join(layout.workspacesRoot, AGT_ID)), 'no disposable <workspacesRoot>/<agentId> copy created')
})

test('absent primary-workspaces.json → behavior identical to today (default derivation)', async (t) => {
  const { root, layout } = await seedRuntime(t)
  const spawned = []
  const runtime = await composeProductionRuntime({
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: false, port: 0 },
    processFactory: (opts) => { const p = new FakeProc(opts); spawned.push(p); return p },
    log: silentLog,
  })
  t.after(() => runtime.stop())

  const bootstrap = runtime.ctx.get('workspaceBootstrap')
  assert.deepEqual(bootstrap.primaryWorkspaces, {})
  assert.equal(bootstrap.resolveWorkspace(AGT_ID), join(layout.workspacesRoot, AGT_ID))
  await runtime.router.deliver({ requestId: 'r1', agentId: AGT_ID, sessionMode: 'main', message: 'x' })
  assert.equal(spawned[0].workspace, join(layout.workspacesRoot, AGT_ID))
  assert.equal(spawned[0].env.DSH_PRIMARY_WORKSPACE, join(layout.workspacesRoot, AGT_ID),
    'the env seam passes the resolveWorkspace output unconditionally (no import branch)')
})

test('invalid import entry (relative path) → startup fails loud with PRIMARY_WORKSPACE_INVALID', async (t) => {
  const { layout } = await seedRuntime(t, { rawMap: { [AGT_ID]: 'relative/dir' } })
  await assert.rejects(
    () => composeProductionRuntime({
      layout,
      productApi: { enabled: false, port: 0 },
      notificationIngress: { enabled: false, port: 0 },
      log: silentLog,
    }),
    (error) => error.code === 'PRIMARY_WORKSPACE_INVALID',
  )
})

test('invalid import entry (missing directory) → startup fails loud', async (t) => {
  const { layout } = await seedRuntime(t, { rawMap: { [AGT_ID]: '/nonexistent/import/target' } })
  await assert.rejects(
    () => composeProductionRuntime({
      layout,
      productApi: { enabled: false, port: 0 },
      notificationIngress: { enabled: false, port: 0 },
      log: silentLog,
    }),
    (error) => error.code === 'PRIMARY_WORKSPACE_INVALID',
  )
})

test('malformed primary-workspaces.json (bad JSON / non-object) → startup fails loud', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'prt-priws-bad-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const layout = resolveProductionLayout(root)
  mkdirSync(join(root, 'scheduler'), { recursive: true })
  await writeAgentDefinition(layout.agentsConfig, {
    defaultAgentId: AGT_ID,
    agents: [{ id: AGT_ID, name: 'Stock Agent' }],
  })

  await writeFile(join(root, 'primary-workspaces.json'), '{not json', 'utf8')
  await assert.rejects(
    () => composeProductionRuntime({
      layout, productApi: { enabled: false, port: 0 }, notificationIngress: { enabled: false, port: 0 }, log: silentLog,
    }),
    (error) => error.code === 'PRIMARY_WORKSPACE_INVALID',
  )

  await writeFile(join(root, 'primary-workspaces.json'), '["array"]', 'utf8')
  await assert.rejects(
    () => composeProductionRuntime({
      layout, productApi: { enabled: false, port: 0 }, notificationIngress: { enabled: false, port: 0 }, log: silentLog,
    }),
    (error) => error.code === 'PRIMARY_WORKSPACE_INVALID',
  )
})

test('I: the same static config file yields the identical primary across restarts', async (t) => {
  const { root, layout, imported } = await seedRuntime(t, { mapAgentToImported: true })
  const compose = async () => {
    const runtime = await composeProductionRuntime({
      layout,
      productApi: { enabled: false, port: 0 },
      notificationIngress: { enabled: false, port: 0 },
      processFactory: (opts) => new FakeProc(opts),
      log: silentLog,
    })
    return runtime
  }
  const first = await compose()
  const p1 = first.ctx.get('workspaceBootstrap').resolveWorkspace(AGT_ID)
  await first.stop()

  const second = await compose()
  const p2 = second.ctx.get('workspaceBootstrap').resolveWorkspace(AGT_ID)
  await second.stop()

  assert.equal(p1, imported)
  assert.equal(p2, imported)
  // The deployment file itself was never rewritten by the runtime.
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'primary-workspaces.json'), 'utf8')), { [AGT_ID]: imported })
})
