/** #523 / D-008 §20: real Router + BindingStore + workspace resolution;
 * fake child only, no provisioning or model calls. Operator uses real HTTP. */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentDefinition } from '../../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../../agent-definition/src/config.js'
import { apply as applyBootstrap } from '../../../workspace-bootstrap/src/index.js'
import { apply as applyProductApi } from '../../../product-api/src/index.js'
import { apply as applyRouter, SWITCH_RPC_METHOD } from '../../src/index.js'

function context(services = new Map()) {
  const provided = new Map()
  const disposers = []
  return {
    get: name => services.get(name) ?? provided.get(name),
    provide: (name, value) => provided.set(name, value),
    effect: fn => { const dispose = fn(); if (dispose) disposers.push(dispose) },
    dispose: async () => { for (const fn of disposers.reverse()) await fn() },
  }
}

class FakeProcess {
  constructor({ agentId }) {
    this.agentId = agentId
    this.pid = 523
    this.exitPromise = new Promise(resolve => { this.resolveExit = resolve })
  }
  spawn() {}
  async ready() { return 0 }
  async shutdown() { this.exit = { code: 0, signal: null }; this.resolveExit(this.exit) }
}

async function rig(t, { shared = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'switch-523-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const workspaceRoot = join(dir, 'workspaces')
  const imported = join(dir, 'imported-primary')
  await mkdir(imported)
  const bctx = context()
  applyBootstrap(bctx, { workspaceRoot, agentsHome: join(dir, 'homes'),
    primaryWorkspaces: shared ? { agt_a: imported, agt_b: imported } : {} })
  const bootstrap = bctx.get('workspaceBootstrap')
  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, { defaultAgentId: 'agt_a', agents: [
    { id: 'agt_a', name: 'Agent A' }, { id: 'agt_b', name: 'Agent B' },
  ] })
  const definition = new AgentDefinition({ configFile })
  const ctx = context(new Map([
    ['workspaceBootstrap', bootstrap], ['agentDefinition', definition],
  ]))
  const storeFile = join(dir, 'bindings.json')
  const router = applyRouter(ctx, { bindingsStoreFile: storeFile, defaultSessionId: 'main',
    provisionHome: () => {}, processFactory: opts => new FakeProcess(opts) })
  t.after(() => ctx.dispose())
  return { router, bootstrap, storeFile, ctx, definition, workspaceRoot, imported }
}

async function child(r, ccId) {
  const proc = await r.router.ensureRunning('agt_a')
  proc.activeBindingContext = ccId
  return proc
}

async function rejectUnchanged(r, proc, ccId, params, currentPath, targetPath) {
  const before = await readFile(r.storeFile, 'utf8')
  const binding = r.router.getBinding(ccId)
  const lines = []
  const original = process.stderr.write
  process.stderr.write = chunk => { lines.push(String(chunk)); return true }
  try {
    await assert.rejects(() => proc.onRpcRequest(SWITCH_RPC_METHOD, params), error => {
      assert.equal(error.code, 'SWITCH_WORKSPACE_MISMATCH')
      assert.match(error.message, /SWITCH_WORKSPACE_MISMATCH/,
        'code token must survive the message-only RPC failure channel')
      return true
    })
  } finally {
    process.stderr.write = original
  }
  assert.deepEqual(r.router.getBinding(ccId), binding, 'memory Binding unchanged')
  assert.equal(await readFile(r.storeFile, 'utf8'), before,
    'entire durable store unchanged, including updatedAt and lastSession bookmarks')
  const audit = lines.filter(line => line.includes('switch-rejected'))
  assert.equal(audit.length, 1)
  for (const field of [ccId, `from=${binding.activeAgentId}`, `to=${params.targetAgentId}`,
    'code=SWITCH_WORKSPACE_MISMATCH', `current_workspace=${currentPath}`, `target_primary=${targetPath}`]) {
    assert.ok(audit[0].includes(field), `audit includes ${field}`)
  }
}

for (const channel of ['feishu', 'mobile', 'custom-channel']) {
  test(`#523: ${channel} agent-turn cross-workspace switch rejects before any Binding/bookmark write`, async t => {
    const r = await rig(t)
    const ccId = `${channel}:surface-523`
    await r.router.switchAgent(ccId, 'agt_a', { targetSessionId: 'session-before' })
    await rejectUnchanged(r, await child(r, ccId), ccId, { targetAgentId: 'agt_b' },
      r.bootstrap.resolveWorkspace('agt_a'), r.bootstrap.resolveWorkspace('agt_b'))
  })
}

test('#523: same imported primary path allows different agent IDs and display-name resolution', async t => {
  const r = await rig(t, { shared: true })
  const ccId = 'mobile:shared'
  await r.router.switchAgent(ccId, 'agt_a', { targetSessionId: 'remember-me' })
  const proc = await child(r, ccId)
  const result = await proc.onRpcRequest(SWITCH_RPC_METHOD, { targetAgentId: 'Agent B' })
  assert.equal(result.activeAgentId, 'agt_b')
  assert.equal(result.workspace, null)
  assert.equal(r.bootstrap.resolveWorkspace('agt_b'), r.imported)
  const back = await r.router.switchAgent(ccId, 'agt_a')
  assert.equal(back.activeSessionId, 'remember-me', 'successful switch still saves the bookmark')
})

test('#523: explicit current workspace is compared instead of current agent primary', async t => {
  const r = await rig(t)
  const ccId = 'feishu:explicit'
  await r.router.switchAgent(ccId, 'agt_a', { workspace: 'group-workspace' })
  await rejectUnchanged(r, await child(r, ccId), ccId, { targetAgentId: 'agt_b' },
    r.bootstrap.resolveWorkspacePath('group-workspace'), r.bootstrap.resolveWorkspace('agt_b'))
})

test('#523: explicit workspace equal to target primary allows the switch', async t => {
  const r = await rig(t)
  const ccId = 'custom-channel:explicit-equal'
  await r.router.switchAgent(ccId, 'agt_a', { workspace: 'agt_b' })
  const proc = await child(r, ccId)
  const result = await proc.onRpcRequest(SWITCH_RPC_METHOD, { targetAgentId: 'agt_b' })
  assert.equal(result.activeAgentId, 'agt_b')
  assert.equal(result.workspace, 'agt_b')
})

test('#523: targetSessionId and requested workspace cannot bypass cross-workspace admission', async t => {
  const r = await rig(t)
  const ccId = 'mobile:no-bypass'
  await r.router.switchAgent(ccId, 'agt_a')
  await rejectUnchanged(r, await child(r, ccId), ccId,
    { targetAgentId: 'agt_b', targetSessionId: 'other-session', workspace: 'agt_a' },
    r.bootstrap.resolveWorkspace('agt_a'), r.bootstrap.resolveWorkspace('agt_b'))
})

test('#523: self-switch cannot bypass the guard when current effective workspace differs', async t => {
  const r = await rig(t)
  const ccId = 'feishu:self'
  await r.router.switchAgent(ccId, 'agt_a', { workspace: 'another-workspace' })
  await rejectUnchanged(r, await child(r, ccId), ccId, { targetAgentId: 'agt_a' },
    r.bootstrap.resolveWorkspacePath('another-workspace'), r.bootstrap.resolveWorkspace('agt_a'))
})

test('#523: operator POST /v1/switch-agent still crosses workspaces on the real Router', async t => {
  const r = await rig(t)
  await r.router.switchAgent('mobile:operator', 'agt_a', { targetSessionId: 'saved-session' })
  const apiCtx = context(new Map([['agentRouter', r.router], ['agentDefinition', r.definition]]))
  const api = applyProductApi(apiCtx, { port: 0, host: '127.0.0.1', channel: 'mobile' })
  t.after(() => apiCtx.dispose())
  for (let attempt = 0; api.address().port === 0 && attempt < 100; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  assert.ok(api.address().port > 0, 'ephemeral loopback HTTP server is listening')
  const base = `http://127.0.0.1:${api.address().port}`
  const response = await fetch(`${base}/v1/switch-agent`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ surfaceId: 'operator', targetAgentId: 'agt_b' }),
  })
  assert.equal(response.status, 200)
  await response.json()
  assert.equal(r.router.getBinding('mobile:operator').activeAgentId, 'agt_b')
  const persisted = JSON.parse(await readFile(r.storeFile, 'utf8'))
  assert.equal(persisted.lastSessions['mobile:operator'].agt_a, 'saved-session')
  assert.notEqual(r.bootstrap.resolveWorkspace('agt_a'), r.bootstrap.resolveWorkspace('agt_b'))
})
