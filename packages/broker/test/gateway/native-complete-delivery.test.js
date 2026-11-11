import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as Broker from '../../src/index.js'
import { workflowCurrentTaskBodyCompleteManifest as manifest } from '../../src/capabilities/manifests.js'

// Explicit paired native build; a missing build is a visible skip, never native proof.
const root = process.env.NGC_HARNESS_ROOT
const load = path => import(pathToFileURL(join(root, path, 'lib/index.js')).href)
const native = root ? await Promise.all([load('vendor/cordis'), load('packages/core/tools'),
  load('packages/core/system-prompt'), load('packages/spill/spill'), load('packages/spill/spill-policy'),
  load('packages/test-support/agent-loop-testkit'), load('packages/core/agent-loop'), load('packages/llm/llm')]) : []
const [{ Context } = {}, Tools = {}, System = {}, Spill = {}, Policy = {}, Testkit = {}, Loop = {}, Llm = {}] = native
const options = { skip: !root, timeout: 10000 }
const id = 'workflow_current_task_body_complete'
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444']
const sha = text => createHash('sha256').update(text).digest('hex')
function fixture(bytes = 64579) {
  const text = '"' + 'x'.repeat(bytes - 2) + '"'
  const args = { operation: 'read', workflowInstanceId: ids[0], expectedDefinitionVersionId: ids[1],
    expectedNodeVisitId: ids[2], expectedWorkflowStateVersion: 7, expectedContextRevisionId: ids[3],
    bodyKind: 'CURRENT_DETAIL', bodyId: ids[2], expectedBodySha256: sha(text) }
  const value = { ok: true, result: { view: 'complete_body', binding: { workflow_instance_id: ids[0],
    definition_version_id: ids[1], node_visit_id: ids[2], workflow_state_version: 7, context_revision_id: ids[3] },
  body: { kind: 'CURRENT_DETAIL', id: ids[2], sha256: sha(text), encoding: 'utf-8', serialization: 'JCS',
    total_bytes: bytes, offset: 0, text, next_offset: null, content_status: 'COMPLETE' },
  verification: { sha256_verified: true, page_count: Math.ceil(bytes / 8192) } } }
  return { args, value, text }
}
async function setup(t, { bytes = 64579, order = 'before', manifests = [manifest], loop = false, change = x => x } = {}) {
  const ctx = new Context(), f = fixture(bytes)
  t.after(() => ctx.fiber.dispose())
  if (loop) await Testkit.mountAgentLoopTestDependencies(ctx)
  else { await ctx.plugin(System.default); await ctx.plugin(Tools.default) }
  class Store extends Spill.SpillStore {
    saves = []
    async saveText(input) { this.saves.push(input); return { locator: '/isolated-spill/result.txt', bytes: Buffer.byteLength(input.content), retrievalHint: 'Read full file.' } }
  }
  await ctx.plugin(Store)
  ctx.provide('agentRpc', { request: async () => ({ ok: true, result: change(structuredClone(f.value)) }) })
  if (order === 'before') await ctx.plugin(Policy, { maxInlineBytes: 50000 })
  await ctx.plugin(Broker, { mode: 'child', manifests, authoringFileEntry: false })
  if (order === 'after') await ctx.plugin(Policy, { maxInlineBytes: 50000 })
  return { ctx, ...f, exec: extra => ctx.tools.execute({ callId: 'call-original', name: id, arguments: f.args,
    agent: { session: { header: { id: 'test-session' } } }, signal: new AbortController().signal, ...extra }) }
}
const textOf = r => r.content.filter(x => x.type === 'text').map(x => x.text).join('')
for (const order of ['before', 'after']) for (const bytes of [50033, 64579]) {
  test(`native ${order} spill: ${bytes}-byte complete original stays exact`, options, async t => {
    const f = await setup(t, { order, bytes }); const r = await f.exec()
    assert.equal(r.isError, false)
    assert.equal(f.ctx.spillStore.saves.length, 0, 'complete original was spilled')
    assert.equal(sha(textOf(r)), sha(JSON.stringify(f.value)))
    assert.equal(sha(JSON.parse(textOf(r)).result.body.text), f.args.expectedBodySha256)
  })
}
test('ordinary similarly large registered tool still uses native 50000-byte spill', options, async t => {
  const f = await setup(t)
  f.ctx.tools.register(Tools.defineContentToolFixture({ name: 'ordinary', description: 'ordinary', parameters: {},
    execute: async () => [{ type: 'text', text: f.text }] }))
  const r = await f.exec({ name: 'ordinary', arguments: {} })
  assert.equal(r.isError, false); assert.match(textOf(r), /Full formatted result stored at:/)
  assert.ok(Buffer.byteLength(textOf(r)) <= 50000); assert.equal(f.ctx.spillStore.saves.length, 1)
})
for (const kind of ['block', 'content', 'value']) {
  test(`native downstream ${kind} remains authoritative and keeps context`, options, async t => {
    const f = await setup(t)
    const context = Llm.createUserMessage({ source: { kind: 'plugin', plugin: 'test-policy' }, content: [{ type: 'text', text: 'policy context' }] })
    f.ctx.on('tools/post-execute', async () => kind === 'block'
      ? { kind: 'block', feedback: [{ type: 'text', text: 'denied by policy' }], additionalContexts: [context] }
      : kind === 'content' ? { kind: 'accept', content: [{ type: 'text', text: 'rewritten by policy' }], additionalContexts: [context] }
        : { kind: 'accept', value: { ok: false, error: { code: 'invalid_arguments' } }, additionalContexts: [context] })
    const r = await f.exec()
    assert.equal(r.isError, kind === 'block'); assert.deepEqual(r.additionalContexts, [context])
    assert.equal(f.ctx.spillStore.saves.length, 0)
    assert.ok(!textOf(r).includes(f.text))
    if (kind === 'block') assert.equal(textOf(r), 'denied by policy')
    if (kind === 'content') assert.equal(textOf(r), 'rewritten by policy')
    if (kind === 'value') assert.equal(JSON.parse(textOf(r)).ok, false)
  })
}
test('accepted unmodified value keeps downstream additional contexts', options, async t => {
  const f = await setup(t)
  const context = Llm.createUserMessage({ source: { kind: 'plugin', plugin: 'test-policy' }, content: [{ type: 'text', text: 'keep me' }] })
  f.ctx.on('tools/post-execute', async () => ({ kind: 'accept', additionalContexts: [context] }))
  const r = await f.exec(); assert.equal(sha(textOf(r)), sha(JSON.stringify(f.value)))
  assert.deepEqual(r.additionalContexts, [context]); assert.equal(f.ctx.spillStore.saves.length, 0)
})
test('nested calls do not acquire the tool-owned post-execute value exception', options, async t => {
  const f = await setup(t); let decision
  f.ctx.on('tools/post-execute', async (_e, _r, next) => { decision = await next(); return decision }, { prepend: true })
  const r = await f.exec({ parent: Symbol('run-code-parent') })
  assert.equal(r.isError, false); assert.equal(sha(textOf(r)), sha(JSON.stringify(f.value)))
  assert.equal(Object.hasOwn(decision, 'value'), false)
})
for (const mode of ['absent', 'other-capability', 'other-tool-name']) {
  test(`exact capability and tool registration required: ${mode}`, options, async t => {
    const manifests = mode === 'absent' ? [] : [{ ...manifest,
      ...(mode === 'other-capability' ? { id: 'workflow_other' } : { toolName: 'workflow_other' }) }]
    const f = await setup(t, { manifests })
    if (mode === 'absent') f.ctx.tools.register(Tools.defineContentToolFixture({ name: id,
      description: 'unowned', parameters: {}, execute: async () => [{ type: 'text', text: f.text }] }))
    const r = await f.exec({ name: mode === 'other-tool-name' ? 'workflow_other' : id,
      ...(mode === 'absent' ? { arguments: {} } : {}) })
    assert.equal(r.isError, false); assert.match(textOf(r), /Full formatted result stored at:/)
    assert.equal(f.ctx.spillStore.saves.length, 1)
  })
}
test('scoped shadow with the same name cannot borrow registered ownership', options, async t => {
  const f = await setup(t); const { createScope } = await load('packages/core/scope')
  const agent = { session: { header: { id: 'shadow-session' } } }; let scope
  await f.ctx.plugin(Object.assign(inner => { scope = createScope(inner, agent) }, { inject: ['tools'] }))
  scope.ctx.tools.register(Tools.defineContentToolFixture({ name: id, description: 'shadow', parameters: {},
    execute: async () => [{ type: 'text', text: f.text }] }))
  const r = await f.exec({ agent, arguments: {} })
  assert.equal(r.isError, false); assert.match(textOf(r), /Full formatted result stored at:/)
  assert.equal(f.ctx.spillStore.saves.length, 1)
})
for (const [name, change] of Object.entries({
  binding: x => { x.result.binding.workflow_state_version++; return x },
  digest: x => { x.result.body.text = 'y'.repeat(x.result.body.total_bytes); return x },
  surrogate: x => { x.result.body.text = '\ud800'; return x },
  extra: x => { x.result.body.untrusted = true; return x },
  oversized: x => { x.result.body.total_bytes = 131073; x.result.body.text = 'x'.repeat(131073); return x },
  failure: () => ({ ok: false, error: { code: 'http_4xx', status: 403, detail: 'secret'.repeat(20000) } }),
})) {
  test(`invalid parent result ${name} stays a bounded failure`, options, async t => {
    const f = await setup(t, { change }); const r = await f.exec(); const v = JSON.parse(textOf(r))
    assert.equal(v.ok, false); assert.equal(Object.hasOwn(v, 'result'), false)
    assert.ok(Buffer.byteLength(textOf(r)) <= 4096); assert.equal(f.ctx.spillStore.saves.length, 0)
  })
}
test('real native agent loop projects the complete result into the next model request', options, async t => {
  const f = await setup(t, { loop: true }); const requests = []
  class Adapter extends Llm.LlmAdapter {
    async * stream(request) {
      requests.push(request)
      const block = requests.length === 1 ? { type: 'tool-call', id: 'original-call', name: id, arguments: JSON.stringify(f.args) }
        : { type: 'text', text: 'received' }
      yield { type: 'block-start', index: 0, blockType: block.type }
      yield { type: 'block-end', index: 0, block }
      yield { type: 'finish', reason: { kind: requests.length === 1 ? 'tool-calls' : 'stop' } }
    }
  }
  f.ctx.llm.registerAdapter(['captured'], new Adapter())
  await f.ctx.plugin(Loop.default, { agents: [] })
  const agent = f.ctx.agentLoop.create('complete-projection', { provider: 'captured', model: 'captured' })
  const idle = new Promise(resolve => { const off = f.ctx.on('agent/status', ({ agent: a, status }) => {
    if (a === agent && status === 'idle') { off(); resolve() }
  }) })
  agent.followup(Llm.createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'read original once' }] }))
  await idle
  assert.equal(requests.length, 2)
  const results = requests[1].messages.flatMap(m => m.content).filter(b => b.type === 'tool-result')
  assert.equal(results.length, 1); assert.equal(results[0].isError, false)
  assert.equal(sha(textOf(results[0])), sha(JSON.stringify(f.value)))
  assert.equal(sha(JSON.parse(textOf(results[0])).result.body.text), f.args.expectedBodySha256)
  assert.equal(f.ctx.spillStore.saves.length, 0)
})
