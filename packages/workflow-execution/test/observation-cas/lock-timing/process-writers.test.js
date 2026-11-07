import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ExecutionLedger } from '../../../src/ledger.js'
import { delay, describe, due, events, evidence, identity, makeEngine,
  serviceState, setServiceState, setup, writer } from './fixture.js'

const red = process.env.WEC4_EXPECT_RED === '1'
const boundMs = 400

for (const interval of ['pre-plan', 'evidence']) {
  test(`#1366 ${red ? 'RED' : 'GREEN'} real two writers: B progresses during A ${interval}`, { timeout: 15_000 }, async t => {
    const fx = await setup({ ownerResume: interval === 'evidence' })
    const a = writer(fx.dir, { name: 'A', pause: interval })
    const b = writer(fx.dir, { name: 'B', key: '1' })
    try {
      await Promise.all([a.next('ready'), b.next('ready')])
      a.send({ stage: 'start' })
      const paused = await a.next('paused')
      const bDone = b.next('completed')
      b.send({ stage: 'start' })
      await b.next('started')
      const progressed = await Promise.race([bDone.then(() => true), delay(boundMs).then(() => false)])
      const releasedAt = Date.now()
      a.send({ stage: 'release' })
      const [aResult, bResult] = await Promise.all([a.next('completed'), bDone])
      assert.deepEqual(await a.exited, [0, null], a.stderr)
      assert.deepEqual(await b.exited, [0, null], b.stderr)
      const raw = events(fx.dir)
      const planned = raw.filter(event => event.kind === 'attempt_planned')
      const replay = await new ExecutionLedger({ dir: fx.dir }).snapshotFresh()
      describe(t, red ? 'RED_REACHED_HEAD_OF_LINE_BLOCKING' : 'REAL_DUAL_WRITER_OBSERVATION', {
        interval, progressedBeforeRelease: progressed, observationBoundMs: boundMs, releasedAt,
        aPid: paused.pid, bPid: bResult.pid, bCompletedAt: bResult.completedAt,
        barrier: paused.trace.at(-1), aResult, bResult, appendOrder: raw, replay,
        finalValidationWaits: aResult.trace.filter(event => event.kind === 'detail-end' && event.call === 2),
      })
      assert.equal(progressed, !red, red ? 'RED reached: B blocked for the full A collection interval'
        : 'B must complete while A collection remains barrier-paused')
      assert.equal(paused.trace.at(-1).held, red, 'only the two collection reads change lock timing')
      assert.equal(aResult.result.action, 'admitted')
      assert.equal(bResult.result.action, 'admitted')
      assert.equal(aResult.calls.delivers.length, 1)
      assert.equal(bResult.calls.delivers.length, 1)
      assert.equal(planned.length, interval === 'evidence' ? 3 : 2)
      assert.equal(replay.length, 2)
      assert.equal(aResult.calls.evidence, interval === 'evidence' ? 1 : 0,
        'Owner evidence collection must never be repeated under the lock')
    } finally { await Promise.all([a.close(), b.close()]); fx.cleanup() }
  })
}

for (const interval of ['pre-plan', 'evidence']) {
  test(`#1366 unchanged local ledger rejects external version drift after ${interval}`, { skip: red, timeout: 15_000 }, async t => {
    const fx = await setup({ ownerResume: interval === 'evidence' })
    const a = writer(fx.dir, { name: 'A', pause: interval })
    try {
      await a.next('ready')
      a.send({ stage: 'start' })
      const paused = await a.next('paused')
      const before = events(fx.dir)
      const state = serviceState(fx.dir)
      state[0].version = 13
      setServiceState(fx.dir, state)
      a.send({ stage: 'release' })
      const result = await a.next('completed')
      assert.deepEqual(await a.exited, [0, null], a.stderr)
      assert.ok(['pre_plan_unavailable', 'already_attempted'].includes(result.result.action))
      assert.equal(result.calls.delivers.length, 0)
      assert.deepEqual(events(fx.dir), before, 'old version mints no plan and consumes no permit')
      describe(t, 'EXTERNAL_VERSION_DRIFT_REFUSED_WITH_UNCHANGED_LOCAL_LEDGER', { interval,
        collectedVersion: 12, canonicalVersion: 13, paused, result, before, after: events(fx.dir) })
    } finally { await a.close(); fx.cleanup() }
  })
}

test('#1366 same predecessor/case contention mints exactly one next generation', { skip: red, timeout: 15_000 }, async t => {
  const fx = await setup({ ownerResume: true })
  const a = writer(fx.dir, { name: 'A', pause: 'evidence' })
  const b = writer(fx.dir, { name: 'B' })
  try {
    await Promise.all([a.next('ready'), b.next('ready')])
    a.send({ stage: 'start' })
    await a.next('paused')
    b.send({ stage: 'start' })
    const winner = await b.next('completed')
    a.send({ stage: 'release' })
    const loser = await a.next('completed')
    assert.equal(winner.result.action, 'admitted')
    assert.equal(loser.result.action, 'already_attempted')
    assert.equal(winner.calls.delivers.length + loser.calls.delivers.length, 1)
    const raw = events(fx.dir)
    const plans = raw.filter(event => event.kind === 'attempt_planned')
    assert.equal(plans.length, 2)
    assert.equal(plans[1].generation, 2)
    assert.equal(plans[1].previousAttemptId, plans[0].attemptId)
    assert.equal(plans[1].assistanceResume.assistanceCaseId, evidence('0').assistanceCaseId)
    const [replay] = await new ExecutionLedger({ dir: fx.dir }).snapshotFresh()
    assert.deepEqual(replay.consumedAssistanceCaseIds, [evidence('0').assistanceCaseId])
    describe(t, 'SAME_CASE_LOCAL_PREDECESSOR_DRIFT_REFUSED', { winner, loser, appendOrder: raw, replay })
  } finally { await Promise.all([a.close(), b.close()]); fx.cleanup() }
})

for (const interval of ['pre-plan', 'evidence']) {
  test(`#1366 SIGKILL during unlocked ${interval} consumes nothing; restart recollects`, { skip: red, timeout: 15_000 }, async t => {
    const fx = await setup({ ownerResume: interval === 'evidence' })
    const a = writer(fx.dir, { name: 'A', pause: interval })
    let restarted
    try {
      await a.next('ready')
      const before = events(fx.dir)
      a.send({ stage: 'start' })
      const paused = await a.next('paused')
      assert.equal(paused.trace.at(-1).held, false)
      await a.close()
      assert.deepEqual(events(fx.dir), before)
      restarted = writer(fx.dir, { name: 'restart' })
      await restarted.next('ready')
      restarted.send({ stage: 'start' })
      const result = await restarted.next('completed')
      assert.equal(result.result.action, 'admitted')
      assert.equal(result.calls.delivers.length, 1)
      const raw = events(fx.dir)
      assert.equal(raw.filter(event => event.kind === 'attempt_planned').length,
        interval === 'evidence' ? 2 : 1)
      describe(t, 'CRASH_BEFORE_PLAN_NO_CONSUMPTION_FRESH_RESTART', { interval, before, paused, result, raw })
    } finally { await a.close(); await restarted?.close(); fx.cleanup() }
  })
}

for (const interval of ['pre-plan', 'evidence']) {
  test(`#1366 same-process FIFO permits B during ${interval}`, { skip: red, timeout: 15_000 }, async t => {
    const fx = await setup({ ownerResume: interval === 'evidence' })
    let release
    let entered
    const barrier = new Promise(resolve => { entered = resolve })
    const held = new Promise(resolve => { release = resolve })
    const a = makeEngine(fx.dir, { pause: async kind => {
      if (kind === interval) { entered(); await held }
    } })
    // The SAME ledger instance exercises its in-process FIFO, independently
    // from the separate-process OwnerLock cases above.
    const b = makeEngine(fx.dir, { key: '1', ledger: a.ledger })
    try {
      const pendingA = a.engine.admitDueIntent(due('0'))
      await barrier
      const pendingB = b.engine.admitDueIntent(due('1'))
      const progressed = await Promise.race([pendingB.then(() => true), delay(boundMs).then(() => false)])
      release()
      const [resultA, resultB] = await Promise.all([pendingA, pendingB])
      assert.equal(progressed, true)
      assert.equal(resultA.action, 'admitted')
      assert.equal(resultB.action, 'admitted')
      describe(t, 'SAME_LEDGER_FIFO_PROGRESS', { interval, resultA, resultB })
    } finally { release(); fx.cleanup() }
  })
}
