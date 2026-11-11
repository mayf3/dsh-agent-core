import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'
import { test } from 'node:test'
import { createNativeGoalAdmission } from '../src/native-goal-admission.js'

function fixture() {
  let request
  let resolve
  const reply = new Promise(r => { resolve = r })
  const agent = { session: { id: 'main', header: { cwd: '/test/workspace' } } }
  const carrier = new AsyncLocalStorage()
  const queued = []
  const provider = createNativeGoalAdmission({
    request: async (method, params) => { request = { method, params }; return reply },
    getAgent: id => id === 'main' ? agent : undefined,
  })
  provider.activate({ parentVersion: 1, driver: { protocolVersion: 1, enqueueMode: 'external' } })
  const message = { id: 'original-id', source: { kind: 'goal', goalId: 'goal-id', revision: 1, round: 1 },
    content: [{ type: 'text', text: 'original native goal prompt' }] }
  const controller = new AbortController()
  const result = provider.enqueue({ agent, message, signal: controller.signal, commit() {
    queued.push({ message, handle: carrier.getStore() })
    return { kind: 'enqueued', messageId: message.id }
  } })
  return { agent, carrier, queued, provider, message, controller, result, resolve, request: () => request }
}

test('native callback commits original message under incoming parent context, at most once', async () => {
  const f = fixture()
  assert.equal(f.queued.length, 0)
  const args = { sessionId: 'main', cwd: '/test/workspace', contentBlocks: f.message.content,
    turnExecutionId: 'new-parent-handle', reservation: f.request().params }
  const receipt = f.carrier.run(args.turnExecutionId, () => f.provider.commit(args))
  assert.equal(receipt.messageId, 'original-id')
  assert.equal(f.provider.commit(args).messageId, 'original-id')
  assert.equal(f.queued.length, 1)
  assert.equal(f.queued[0].message, f.message)
  assert.equal(f.queued[0].handle, 'new-parent-handle')
  f.resolve({ ok: true, result: { kind: 'enqueued', messageId: 'original-id', reconciliationHandle: args.turnExecutionId } })
  assert.equal((await f.result).kind, 'enqueued')
})

test('cancelled reservation rejects delayed commit and never creates a Session', async () => {
  const f = fixture()
  f.controller.abort()
  assert.equal((await f.result).kind, 'outcome_unknown')
  assert.throws(() => f.provider.commit({ sessionId: 'main', cwd: '/test/workspace',
    contentBlocks: f.message.content, turnExecutionId: 'new-handle', reservation: f.request().params }), /reservation/i)
  assert.equal(f.queued.length, 0)
})

test('a lost outer response after local enqueue remains unknown and does not repeat commit', async () => {
  const f = fixture()
  f.provider.commit({ sessionId: 'main', cwd: '/test/workspace', contentBlocks: f.message.content,
    turnExecutionId: 'new-handle', reservation: f.request().params })
  f.controller.abort()
  assert.equal((await f.result).kind, 'outcome_unknown')
  assert.equal(f.queued.length, 1)
})

test('wrong message/session/workspace/handle cannot reuse a pending native reservation', async () => {
  for (const patch of [{ sessionId: 'other' }, { cwd: '/other' }, { turnExecutionId: '' },
    { contentBlocks: [{ type: 'text', text: 'changed' }] }]) {
    const f = fixture()
    assert.throws(() => f.provider.commit({ sessionId: 'main', cwd: '/test/workspace', contentBlocks: f.message.content,
      turnExecutionId: 'new-handle', reservation: f.request().params, ...patch }))
    assert.equal(f.queued.length, 0)
    f.controller.abort()
    await f.result
  }
})

test('parent/native capability mismatch never enables external admission', () => {
  const provider = createNativeGoalAdmission({ request: () => { throw new Error('no RPC allowed') }, getAgent: () => undefined })
  for (const args of [{ parentVersion: undefined, driver: { protocolVersion: 1, enqueueMode: 'external' } },
    { parentVersion: 1, driver: undefined }, { parentVersion: 1, driver: { protocolVersion: 1, enqueueMode: 'native' } }]) {
    assert.throws(() => provider.activate(args), /protocol/i)
  }
})
