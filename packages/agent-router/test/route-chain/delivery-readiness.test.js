import assert from 'node:assert/strict'
import { test } from 'node:test'
import { makeFx } from '../helpers/fake-child.js'
import { monotonicNowMs } from '../../src/process/state-machine.js'

async function readyFixture() {
  const fx = makeFx()
  await fx.readyNow()
  fx.proc.initializeEvidence.deliveryReadiness = { version: 1 }
  return fx
}

test('R1 readiness: initialize ready cannot bypass session preparation acknowledgement', async () => {
  const fx = await readyFixture()
  let settled = false
  const prepared = fx.proc.prepareDelivery('main', { cwd: '/tmp/fx-ws' }, {
    deadlineMono: monotonicNowMs() + 500,
  }).then(value => { settled = true; return value })
  await fx.tick()
  const request = fx.writes.find(write => write.method === 'session/prepare')
  assert.deepEqual(request.params, { version: 1, sessionId: 'main', cwd: '/tmp/fx-ws' })
  assert.equal(settled, false, 'no readiness until resume/creation acknowledgement arrives')
  assert.equal(fx.counts().promptWriteAttempts, 0)
  assert.equal(fx.store.records.size, 0, 'preparation does not mint a business execution')
  fx.respondTo('session/prepare', { version: 1, ready: true, sessionId: 'main' })
  assert.deepEqual(await prepared, { version: 1, ready: true, sessionId: 'main' })
})

test('R1 readiness: absent capability and mismatched acknowledgement fail closed', async () => {
  const legacy = await readyFixture()
  delete legacy.proc.initializeEvidence.deliveryReadiness
  await assert.rejects(legacy.proc.prepareDelivery('main'), { code: 'AGENT_DELIVERY_PREPARE_PROTOCOL' })
  assert.equal(legacy.writes.filter(write => write.method === 'session/prepare').length, 0)

  for (const acknowledgement of [undefined, {}, { version: 2, ready: true, sessionId: 'main' },
    { version: 1, ready: false, sessionId: 'main' }, { version: 1, ready: true, sessionId: 'other' }]) {
    const fx = await readyFixture()
    const prepared = fx.proc.prepareDelivery('main')
    fx.respondTo('session/prepare', acknowledgement)
    await assert.rejects(prepared, { code: 'AGENT_DELIVERY_PREPARE_PROTOCOL' })
    assert.equal(fx.counts().promptWriteAttempts, 0)
  }
})

test('R1 readiness: never-ready child respects caller deadline and late ack cannot admit', async () => {
  const fx = await readyFixture()
  const keepAlive = setTimeout(() => {}, 1000)
  try {
    const started = monotonicNowMs()
    const prepared = fx.proc.prepareDelivery('main', {}, { deadlineMono: started + 35 })
    const rejection = assert.rejects(prepared, { code: 'AGENT_DELIVERY_PREPARE_TIMEOUT' })
    const request = fx.writes.find(write => write.method === 'session/prepare')
    await rejection
    assert.ok(monotonicNowMs() - started < 400, 'caller deadline bounds preparation')
    assert.equal(fx.proc.pending.size, 0)
    fx.emit({ id: request.id, result: { version: 1, ready: true, sessionId: 'main' } })
    assert.equal(fx.counts().promptWriteAttempts, 0)
  } finally {
    clearTimeout(keepAlive)
  }
})

test('R4 readiness: process state and newly installed UNKNOWN fence gate acknowledgement', async () => {
  const cold = makeFx()
  await assert.rejects(cold.proc.prepareDelivery('main'), { code: 'AGENT_PROCESS_NOT_READY' })
  assert.equal(cold.writes.length, 0)

  const fx = await readyFixture()
  const prepared = fx.proc.prepareDelivery('main')
  fx.proc.activeUnknownFences.set('unknown-handle', { handle: 'unknown-handle', sessionId: 'main' })
  fx.proc.activeUnknownFence = { handle: 'unknown-handle', sessionId: 'main' }
  fx.respondTo('session/prepare', { version: 1, ready: true, sessionId: 'main' })
  await assert.rejects(prepared, { code: 'AGENT_PROCESS_TURN_FENCED' })
  assert.equal(fx.counts().promptWriteAttempts, 0)
})

test('R1 readiness: each call obtains a fresh ack; expired caller budget writes nothing', async () => {
  const fx = await readyFixture()
  await assert.rejects(fx.proc.prepareDelivery('main', {}, {
    deadlineMono: monotonicNowMs() - 1,
  }), { code: 'AGENT_DELIVERY_PREPARE_TIMEOUT' })
  assert.equal(fx.writes.filter(write => write.method === 'session/prepare').length, 0)
  for (let call = 0; call < 3; call += 1) {
    const prepared = fx.proc.prepareDelivery('main')
    fx.respondTo('session/prepare', { version: 1, ready: true, sessionId: 'main' })
    await prepared
  }
  assert.equal(fx.writes.filter(write => write.method === 'session/prepare').length, 3)
  assert.equal(fx.counts().promptWriteAttempts, 0)
})

test('R1 readiness: an acknowledgement processed beyond the absolute budget cannot admit', async () => {
  const fx = await readyFixture()
  const deadlineMono = monotonicNowMs() + 5
  const prepared = fx.proc.prepareDelivery('main', {}, { deadlineMono })
  while (monotonicNowMs() <= deadlineMono) { /* hold the event loop past the caller budget */ }
  fx.respondTo('session/prepare', { version: 1, ready: true, sessionId: 'main' })
  await assert.rejects(prepared, { code: 'AGENT_DELIVERY_PREPARE_TIMEOUT' })
  assert.equal(fx.counts().promptWriteAttempts, 0)
})

test('R1 readiness preserves private-session log suppression without forwarding custody payload', async () => {
  const fx = await readyFixture()
  fx.proc.initializeEvidence.websiteAdmission = { version: 1 }
  const prepared = fx.proc.prepareDelivery('private-session', { websiteControl: { carrier: 'private-sentinel' } })
  assert.deepEqual(fx.writes.at(-1).params, {
    version: 1, sessionId: 'private-session', privateSession: true,
  })
  fx.respondTo('session/prepare', { version: 1, ready: true, sessionId: 'private-session' })
  await prepared
})
