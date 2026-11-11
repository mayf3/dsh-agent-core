import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ExecutionLedger } from '../../../src/ledger.js'
import { delay, describe, due, events, identity, makeEngine, serviceState,
  setServiceState, setup, writer } from './fixture.js'

const changedId = 'fd5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e88'
const externalCases = [
  ['activation absent', { active: false }],
  ['dispatch identity', { dueDrift: { dispatchIntentId: changedId } }],
  ['terminal instance', { terminal: true }],
  ['instance identity', { instanceId: changedId }],
  ['current visit identity', { currentVisitId: changedId }],
  ['visit identity', { visitId: changedId }],
  ['visit instance identity', { visitInstanceId: changedId }],
  ['assignee identity', { assigneeId: changedId }],
  ['workflow version', { version: 13 }],
  ['restricted detail', { visibility: 'historical_participant' }],
  ['unavailable detail', { detailFailure: 'unavailable' }],
  ['throwing detail', { detailFailure: 'throw' }],
  ['malformed detail', { detailFailure: 'malformed' }],
  ['unavailable due', { dueFailure: 'unavailable' }],
  ['throwing due', { dueFailure: 'throw' }],
  ['malformed due', { dueFailure: 'malformed' }],
]

for (const [label, drift] of externalCases) {
  test(`#1366 canonical validation rejects ${label} with unchanged local ledger`, { timeout: 15_000 }, async t => {
    const fx = await setup()
    const a = writer(fx.dir, { name: 'A', pause: 'pre-plan' })
    try {
      await a.next('ready')
      a.send({ stage: 'start' })
      const paused = await a.next('paused')
      assert.equal(paused.trace.at(-1).held, false)
      const before = events(fx.dir)
      const oldState = serviceState(fx.dir)
      const newState = structuredClone(oldState)
      Object.assign(newState[0], drift)
      setServiceState(fx.dir, newState)
      a.send({ stage: 'release' })
      const result = await a.next('completed')
      assert.deepEqual(await a.exited, [0, null], a.stderr)
      assert.equal(result.result.action, 'pre_plan_unavailable')
      assert.equal(result.calls.delivers.length, 0)
      assert.deepEqual(events(fx.dir), before)
      describe(t, 'CANONICAL_FIELD_DRIFT_REFUSED', { label, oldState, newState, before,
        result, after: events(fx.dir), localLedgerUnchanged: true })
    } finally { await a.close(); fx.cleanup() }
  })
}

test('#1366 Owner version drift between pre-plan and evidence rejects both old observations', { timeout: 15_000 }, async t => {
  const fx = await setup({ ownerResume: true })
  const a = writer(fx.dir, { name: 'A', pause: 'pre-plan' })
  try {
    await a.next('ready')
    a.send({ stage: 'start' })
    await a.next('paused')
    const before = events(fx.dir)
    const state = serviceState(fx.dir)
    state[0].version = 13
    setServiceState(fx.dir, state)
    a.send({ stage: 'release' })
    const result = await a.next('completed')
    assert.deepEqual(await a.exited, [0, null], a.stderr)
    assert.ok(['pre_plan_unavailable', 'already_attempted'].includes(result.result.action))
    assert.equal(result.calls.evidence, 1)
    assert.equal(result.calls.delivers.length, 0)
    assert.deepEqual(events(fx.dir), before)
    describe(t, 'OWNER_TWO_READ_VERSION_MISMATCH', { collectedDetailVersion: 12,
      evidenceVersion: 13, before, result, after: events(fx.dir) })
  } finally { await a.close(); fx.cleanup() }
})

for (const failure of ['unavailable', 'restricted', 'throw', 'timeout', 'malformed']) {
  test(`#1366 ${failure} Owner evidence provides no planning permission`, { timeout: 15_000 }, async t => {
    const fx = await setup({ ownerResume: true })
    const a = writer(fx.dir, { name: 'A', pause: 'pre-plan' })
    try {
      await a.next('ready')
      a.send({ stage: 'start' })
      await a.next('paused')
      const before = events(fx.dir)
      const state = serviceState(fx.dir)
      state[0].evidenceFailure = failure
      setServiceState(fx.dir, state)
      a.send({ stage: 'release' })
      const result = await a.next('completed')
      assert.ok(['pre_plan_unavailable', 'already_attempted'].includes(result.result.action))
      assert.equal(result.calls.evidence, 1)
      assert.equal(result.calls.delivers.length, 0)
      assert.deepEqual(events(fx.dir), before)
      describe(t, 'UNAVAILABLE_OWNER_PROOF_REFUSED', { failure, before, result, after: events(fx.dir) })
    } finally { await a.close(); fx.cleanup() }
  })
}

for (const mutation of ['budget', 'managed policy', 'positive settled proof']) {
  test(`#1366 local ${mutation} drift during collection rejects the old planning context`, { timeout: 15_000 }, async t => {
    const fx = await setup({ ownerResume: true })
    let entered
    let release
    const arrived = new Promise(resolve => { entered = resolve })
    const held = new Promise(resolve => { release = resolve })
    const a = makeEngine(fx.dir, { pause: async kind => {
      if (kind === 'pre-plan') { entered(); await held }
    } })
    try {
      const pending = a.engine.admitDueIntent(due('0'))
      await arrived
      const before = events(fx.dir)
      if (mutation === 'budget') a.ledger.maxAttemptsPerVisit = 2
      if (mutation === 'managed policy') a.ledger.resolveManagedAttempt = async () => true
      if (mutation === 'positive settled proof') {
        const state = serviceState(fx.dir)
        state[0].settled = false
        setServiceState(fx.dir, state)
      }
      release()
      const result = await pending
      assert.ok(['pre_plan_unavailable', 'already_attempted', 'attempt_limit_reached'].includes(result.action))
      assert.equal(a.calls.delivers.length, 0)
      assert.deepEqual(events(fx.dir), before)
      describe(t, 'LOCAL_ELIGIBILITY_INPUT_DRIFT_REFUSED', { mutation, result,
        maxAttemptsPerVisit: a.ledger.maxAttemptsPerVisit, before, after: events(fx.dir) })
    } finally { release(); fx.cleanup() }
  })
}

test('#1366 required final validation retains a measured held-lock wait', { timeout: 15_000 }, async t => {
  const fx = await setup()
  const a = writer(fx.dir, { name: 'A', pause: 'final-validation' })
  const b = writer(fx.dir, { name: 'B', key: '1' })
  try {
    await Promise.all([a.next('ready'), b.next('ready')])
    a.send({ stage: 'start' })
    const paused = await a.next('paused')
    assert.equal(paused.kind, 'final-validation')
    assert.equal(paused.trace.at(-1).held, true)
    b.send({ stage: 'start' })
    await b.next('started')
    const bDone = b.next('completed')
    const progressed = await Promise.race([bDone.then(() => true), delay(400).then(() => false)])
    a.send({ stage: 'release' })
    const [aResult, bResult] = await Promise.all([a.next('completed'), bDone])
    assert.equal(progressed, false, 'the accepted final validation remains lock-held')
    assert.equal(aResult.result.action, 'admitted')
    assert.equal(bResult.result.action, 'admitted')
    const finalRead = aResult.trace.find(event => event.kind === 'detail-end' && event.call === 2)
    assert.equal(finalRead.held, true)
    assert.ok(finalRead.endedAt - finalRead.startedAt >= 400)
    assert.equal(aResult.calls.evidence, 0)
    assert.equal(events(fx.dir).filter(event => event.kind === 'attempt_planned').length, 2)
    describe(t, 'RESIDUAL_FINAL_VALIDATION_WAIT_MEASURED', { observationBoundMs: 400,
      progressedDuringFinalValidation: progressed, finalValidationWaitMs: finalRead.endedAt - finalRead.startedAt,
      paused, aResult, bResult, appendOrder: events(fx.dir) })
  } finally { await Promise.all([a.close(), b.close()]); fx.cleanup() }
})

test('#1366 remote version drift during reacquisition contention is refused', { timeout: 15_000 }, async t => {
  const fx = await setup()
  const a = writer(fx.dir, { name: 'A', pause: 'pre-plan' })
  const blocker = new ExecutionLedger({ dir: fx.dir })
  let token
  try {
    await a.next('ready')
    a.send({ stage: 'start' })
    await a.next('paused')
    const before = events(fx.dir)
    token = await blocker.lock.acquire()
    a.send({ stage: 'release' })
    const reacquiring = await a.next('reacquire-start')
    const finishedWhileBlocked = await Promise.race([
      a.next('completed').then(() => true), delay(100).then(() => false),
    ])
    assert.equal(finishedWhileBlocked, false)
    const state = serviceState(fx.dir)
    state[0].version = 13
    setServiceState(fx.dir, state)
    await blocker.lock.release(token)
    token = undefined
    const result = await a.next('completed')
    assert.equal(result.result.action, 'pre_plan_unavailable')
    assert.equal(result.calls.delivers.length, 0)
    assert.deepEqual(events(fx.dir), before)
    const secondAcquire = result.trace.filter(event => event.kind === 'lock-acquired')[1]
    assert.ok(secondAcquire.endedAt - secondAcquire.startedAt >= 100)
    describe(t, 'REACQUISITION_WAIT_DRIFT_REFUSED', { reacquiring, secondAcquire,
      before, after: events(fx.dir), result })
  } finally {
    if (token) await blocker.lock.release(token)
    await a.close()
    fx.cleanup()
  }
})

test('#1366 SIGKILL after reacquire before plan consumes nothing; dead-owner restart remains safe', { timeout: 15_000 }, async t => {
  const fx = await setup({ ownerResume: true })
  const a = writer(fx.dir, { name: 'A', pause: 'final-validation' })
  let restarted
  try {
    await a.next('ready')
    const before = events(fx.dir)
    a.send({ stage: 'start' })
    const paused = await a.next('paused')
    assert.equal(paused.trace.at(-1).held, true)
    await a.close()
    assert.deepEqual(events(fx.dir), before)
    restarted = writer(fx.dir, { name: 'restart' })
    await restarted.next('ready')
    restarted.send({ stage: 'start' })
    const result = await restarted.next('completed')
    assert.equal(result.result.action, 'admitted')
    assert.equal(result.calls.delivers.length, 1)
    const raw = events(fx.dir)
    const plans = raw.filter(event => event.kind === 'attempt_planned')
    assert.equal(plans.length, 2)
    assert.equal(plans[1].generation, 2)
    const [replay] = await new ExecutionLedger({ dir: fx.dir }).snapshotFresh()
    assert.equal(replay.nodeVisitId, identity('0').nodeVisitId)
    assert.equal(replay.consumedAssistanceCaseIds.length, 1)
    describe(t, 'CRASH_AFTER_REACQUIRE_BEFORE_PLAN', { before, paused, result, raw, replay })
  } finally { await a.close(); await restarted?.close(); fx.cleanup() }
})
