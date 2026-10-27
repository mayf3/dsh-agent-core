import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { createParentRpcHandler } from '../../src/parent-rpc-relay.js'
import { makeFx } from '../helpers/fake-child.js'

const METHOD = 'agent-core/nativeGoalContinuation'
const text = '<goal_round>isolated round one</goal_round>'
function request() {
  const contentBlocks = [{ type: 'text', text }]
  return { version: 1, reservationId: randomUUID(), sessionId: 'main', messageId: 'native-message-1',
    goal: { goalId: 'goal-test', revision: 1, round: 1 }, contentBlocks,
    contentSha256: createHash('sha256').update(JSON.stringify(contentBlocks)).digest('hex') }
}
async function prepared(t, options = {}) {
  const fx = makeFx(options)
  t.after(() => fx.childExit())
  await fx.readyNow()
  fx.proc.initializeEvidence.nativeGoalContinuation = { version: 1 }
  const initial = fx.proc.turn('main', 'initial')
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'initial-message' })
  fx.completeTurn('main', 'initial-message', 'initial done')
  const old = await initial
  const handler = createParentRpcHandler({ agentId: fx.proc.agentId, getProc: () => fx.proc,
    log: { log() {} }, getBrokerGateway: () => { throw new Error('not a Broker request') } })
  return { fx, handler, old }
}

test('native continuation uses a new owned queue execution after the initial turn settles', async t => {
  const { fx, handler, old } = await prepared(t)
  const req = request()
  const delivered = handler(METHOD, req, {})
  await fx.tick()
  const write = fx.writes.filter(x => x.method === 'session/prompt').at(-1)
  assert.notEqual(write.params.turnExecutionId, old.reconciliationHandle, 'must mint a new execution before write')
  assert.deepEqual(write.params.nativeGoalContinuation, req, 'private sidecar preserves the reserved native message')
  fx.respondTo('session/prompt', { messageId: req.messageId })
  const receipt = await delivered
  assert.equal(receipt.kind, 'enqueued')
  assert.equal(receipt.messageId, req.messageId)
  assert.equal(fx.proc.turnInFlight, true, 'receipt alone must retain queue ownership')
  fx.completeTurn('main', req.messageId, 'round done', { turn: 2 })
  await fx.tick()
  assert.equal(fx.proc.turnInFlight, false)
  assert.equal(fx.store.records.get(receipt.reconciliationHandle).outcome, 'completed')
})

test('duplicate native reservation cannot mint another execution or enqueue twice', async t => {
  const { fx, handler } = await prepared(t)
  const req = request()
  const delivered = handler(METHOD, req, {})
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: req.messageId })
  await delivered
  fx.completeTurn('main', req.messageId, 'done', { turn: 2 })
  await fx.tick()
  const count = fx.writes.filter(x => x.method === 'session/prompt').length
  const duplicate = await handler(METHOD, req, {})
  assert.equal(duplicate.kind, 'not_enqueued')
  assert.equal(fx.writes.filter(x => x.method === 'session/prompt').length, count)
})

test('aborting a native request behind an occupied queue cannot write later', async t => {
  const { fx, handler } = await prepared(t)
  const busy = fx.proc.turn('main', 'ordinary owner')
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'busy' })
  const controller = new AbortController()
  const pending = handler(METHOD, request(), { signal: controller.signal })
  await fx.tick()
  controller.abort()
  const denial = await pending
  assert.equal(denial.kind, 'not_enqueued')
  fx.completeTurn('main', 'busy', 'done', { turn: 2 })
  await busy
  await fx.tick()
  assert.equal(fx.writes.filter(x => x.method === 'session/prompt').length, 2, 'cancelled admission never writes after release')
})

test('native entry rejects other sessions, incompatible children and forged fields before admission', async t => {
  const { fx, handler } = await prepared(t)
  for (const bad of [{ ...request(), sessionId: 'foreign' }, { ...request(), turnExecutionId: 'forged' }]) {
    assert.equal((await handler(METHOD, bad, {})).kind, 'not_enqueued')
  }
  fx.proc.initializeEvidence.nativeGoalContinuation = undefined
  assert.equal((await handler(METHOD, request(), {})).kind, 'not_enqueued')
  assert.equal(fx.writes.filter(x => x.method === 'session/prompt').length, 1)
})

test('native callback unknown is fenced rather than misclassified as definitive rejection', async t => {
  const { fx, handler } = await prepared(t)
  const pending = handler(METHOD, request(), {})
  await fx.tick()
  const write = fx.writes.filter(x => x.method === 'session/prompt').at(-1)
  fx.proc.onStdout(JSON.stringify({ jsonrpc: '2.0', id: write.id,
    error: { code: 'NATIVE_GOAL_ENQUEUE_OUTCOME_UNKNOWN', message: 'commit did not return its receipt' } }) + '\n')
  const result = await pending
  assert.equal(result.kind, 'outcome_unknown')
  assert.equal(fx.proc.activeUnknownFence.handle, result.reconciliationHandle)
  assert.equal(fx.store.records.get(result.reconciliationHandle).outcome, null)
  const next = await handler(METHOD, request(), {})
  assert.equal(next.kind, 'not_enqueued')
})

test('lost native prompt receipt can reconcile exact retained message without resending', async t => {
  const { fx, handler } = await prepared(t, { deadlines: { promptReceiptTimeoutMs: 15 } })
  const req = request()
  const pending = handler(METHOD, req, {})
  await fx.tick()
  await fx.sleep(30)
  const result = await pending
  assert.equal(result.kind, 'outcome_unknown')
  fx.completeTurn('main', req.messageId, 'late exact terminal', { turn: 2 })
  await fx.tick()
  assert.equal(fx.store.records.get(result.reconciliationHandle).lateOutcome, 'late_completed')
  assert.equal(fx.proc.activeUnknownFence, null)
  assert.equal(fx.writes.filter(x => x.method === 'session/prompt').length, 2)
})

test('a duplicate reservation remains rejected after its reconciled record is evicted', async t => {
  const { fx, handler } = await prepared(t)
  const req = request()
  const pending = handler(METHOD, req, {})
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: req.messageId })
  const receipt = await pending
  fx.completeTurn('main', req.messageId, 'done', { turn: 2 })
  await fx.tick()
  fx.store.evictRecord(fx.store.records.get(receipt.reconciliationHandle))
  const duplicate = handler(METHOD, req, {})
  await fx.tick()
  assert.equal(fx.writes.filter(value => value.method === 'session/prompt').length, 2)
  assert.equal((await duplicate).kind, 'not_enqueued')
})
