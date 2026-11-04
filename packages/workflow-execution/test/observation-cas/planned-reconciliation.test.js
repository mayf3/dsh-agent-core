import assert from 'node:assert/strict'
import { test } from 'node:test'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { ExecutionLedger, attemptIdFor } from '../../src/ledger.js'
import { reconcileDeliveryEvidence } from '../../src/projection.js'
import { TurnReconciliationStore } from '../../../agent-router/src/reconciliation/store.js'
import { fixture, intent, engine, VISIT, AGENT, T0, barrier } from './fixture.js'

const INTERRUPTION = new Error('B3 injected process interruption')
const bytes = file => existsSync(file) ? readFileSync(file, 'utf8') : ''
const sourceSha = process.env.EKR_SOURCE_SHA ?? 'UNBOUND (set EKR_SOURCE_SHA for receipt)'

function receipt(requestId, changes = {}) {
  const handle = 'turn:original-epoch:a1:g1:s1'
  return { state: 'pending', handle, snapshot: {
    handle, turnExecutionId: handle, state: 'pending', agentId: AGENT,
    sessionId: 'main', messageId: 'original-message', callerCorrelation: { requestId },
    ...changes,
  } }
}

for (const [position, expected] of [
  ['before_delivery', 'NOT_SENT'],
  ['during_delivery', 'UNKNOWN'],
  ['accepted_receipt_lost', 'ACCEPTED'],
]) {
  test(`B3 fault injection: ${position} -> ${expected}, same responsibility and zero restart delivery`, async () => {
    const fx = fixture()
    const routerFile = join(fx.dir, 'router-reconciliation.json')
    const router = new TurnReconciliationStore({ runtimeEpoch: 'original-epoch', persistenceFile: routerFile })
    let originalSends = 0
    try {
      // Memory sender, real fsynced ledger and isolated durable Router receipt.
      // Throw outside the engine's normal error handling, like an interrupted
      // admission closure; no completion event can be written by this sender.
      await assert.rejects(fx.writer.beginAttemptIfAbsent(intent(), async (attempt, { recordDeliveryStarted }) => {
        assert.match(bytes(fx.writer.eventsFile), /"kind":"attempt_planned"/)
        if (position === 'before_delivery') throw INTERRUPTION
        recordDeliveryStarted()
        assert.match(bytes(fx.writer.eventsFile), /"kind":"delivery_started"/)
        originalSends += 1
        const handle = router.mintTurnExecution({ agentId: AGENT, processGeneration: 1,
          sessionId: 'main', callerCorrelation: { requestId: attempt.attemptId } })
        if (position === 'accepted_receipt_lost') router.markPromptReceipt(handle, { messageId: 'original-message' })
        throw INTERRUPTION
      }), error => error === INTERRUPTION)
      const initialWal = bytes(fx.writer.eventsFile)
      const initialState = fx.writer.get(VISIT)
      assert.equal(initialState.phase, position === 'before_delivery' ? 'planned' : 'delivery_started')
      // Reload BOTH authorities, so caller receipt loss is not repaired using
      // a handle or acceptance result cached in the stopped sender.
      fx.reader = new ExecutionLedger({ dir: fx.dir, clock: () => T0 + 100 })
      const restartedRouter = new TurnReconciliationStore({ runtimeEpoch: 'restart-epoch', persistenceFile: routerFile })
      const initialRouter = bytes(routerFile)
      const correlationReads = []
      const restarted = engine(fx, {
        resolveCallerCorrelation: query => {
          correlationReads.push(query)
          return restartedRouter.resolveCallerCorrelation(query)
        },
        fetchDuePage: async () => ({ ok: true, items: [intent()] }),
      })
      const [observed] = await restarted.engine.reconcileDeliveries()
      assert.equal(observed.classification, expected)
      assert.equal(observed.requestId, attemptIdFor(VISIT))
      assert.equal(observed.generation, 1)
      assert.equal(observed.businessOutcome, 'UNKNOWN')
      assert.equal(observed.resumeAuthorized, false)
      assert.equal(bytes(fx.reader.eventsFile), initialWal, 'classification appends no verdict/fence/attempt')
      assert.equal(bytes(routerFile), initialRouter, 'original receipt query is non-consuming')
      const refused = await restarted.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: 'B3_TEST' })
      assert.equal(refused.outcome, 'RECOVERY_INAPPLICABLE', 'observation does not extend ordinary recovery eligibility')
      assert.equal(bytes(fx.reader.eventsFile), initialWal)
      const first = await restarted.engine.pollOnce()
      assert.equal(first.reconciled.deliveryReconciliation[0].classification, expected)
      assert.equal(fx.reader.get(VISIT).state, 'NEEDS_REVIEW')
      assert.equal(fx.reader.get(VISIT).judgment, 'delivery_unverified', 'CTR-WAE-006 remains unchanged')
      const terminalWal = bytes(fx.reader.eventsFile)
      // Every subsequent existing poll must rediscover the retained terminal
      // responsibility; it cannot silently vanish from readback after one pass.
      const second = await restarted.engine.pollOnce()
      assert.equal(second.reconciled.deliveryReconciliation[0].classification, expected)
      assert.equal(bytes(fx.reader.eventsFile), terminalWal, 'no terminal append')
      assert.equal(bytes(routerFile), initialRouter)
      assert.equal(restarted.calls.delivers.length, 0)
      assert.deepEqual(restarted.calls.errors, [])
      assert.deepEqual(correlationReads, Array(3).fill({ requestId: attemptIdFor(VISIT) }))
      assert.equal(terminalWal.split('"kind":"attempt_planned"').length - 1, 1)
      console.log(JSON.stringify({ sourceSha, testName: `B3-${position}`,
        faultInjection: position, initialState: { phase: initialState.phase, wal: initialWal.trim().split('\n').map(JSON.parse) },
        expectedResult: expected, actualResult: observed, originalSends,
        restartSends: restarted.calls.delivers.length, originalCorrelationReads: correlationReads.length,
        rawReceipt: restartedRouter.resolveCallerCorrelation({ requestId: attemptIdFor(VISIT) }),
        finalResponsibility: { state: fx.reader.get(VISIT).state, judgment: fx.reader.get(VISIT).judgment },
        readOnlyLedgerUnchanged: true, readOnlyRouterUnchanged: true }))
    } finally { fx.cleanup() }
  })
}

test('B3 late original receipt is read after terminal judgment and another engine restart, with zero writes', async () => {
  const fx = fixture()
  try {
    await assert.rejects(fx.writer.beginAttemptIfAbsent(intent(), async (_, { recordDeliveryStarted }) => {
      recordDeliveryStarted()
      throw INTERRUPTION
    }), error => error === INTERRUPTION)
    const before = engine(fx)
    const first = await before.engine.reconcileOnce()
    assert.equal(first.deliveryReconciliation[0].classification, 'UNKNOWN', 'started + never_existed remains unknown')
    const terminalWal = bytes(fx.reader.eventsFile)
    fx.reader = new ExecutionLedger({ dir: fx.dir })
    const after = engine(fx, { resolveCallerCorrelation: () => receipt(attemptIdFor(VISIT)) })
    const second = await after.engine.reconcileOnce()
    assert.equal(second.deliveryReconciliation[0].classification, 'ACCEPTED')
    assert.equal(second.deliveryReconciliation[0].businessOutcome, 'UNKNOWN')
    assert.equal(bytes(fx.reader.eventsFile), terminalWal)
    assert.equal(after.calls.delivers.length, 0)
  } finally { fx.cleanup() }
})

test('B3 historical unmarked planned and malformed/lost/foreign correlations cannot prove non-send', async () => {
  const fx = fixture()
  try {
    await fx.writer.beginAttemptIfAbsent(intent())
    const current = fx.writer.get(VISIT)
    const cases = [
      undefined, null, [], {}, { state: 'restart_lost' }, { state: 'evicted' },
      { state: 'never_existed', handle: 'contradictory-handle' },
      receipt('other-attempt'), receipt(current.attemptId, { messageId: null }),
      receipt(current.attemptId, { handle: 'other-handle' }),
      receipt(current.attemptId, { turnExecutionId: 'other-turn' }),
      receipt(current.attemptId, { state: 'settled' }),
      receipt(current.attemptId, { callerCorrelation: { requestId: current.attemptId, occurrenceId: 'foreign-occurrence' } }),
      receipt(current.attemptId, { callerCorrelation: { requestId: current.attemptId, runId: 'foreign-run' } }),
    ]
    for (const correlation of cases) {
      const observed = reconcileDeliveryEvidence(current, () => correlation)
      assert.equal(observed.classification, 'UNKNOWN', JSON.stringify(correlation))
      assert.equal(observed.resumeAuthorized, false)
    }
    assert.equal(reconcileDeliveryEvidence(current).classification, 'UNKNOWN')
    assert.equal(reconcileDeliveryEvidence(current, () => { throw new Error('unavailable') }).classification, 'UNKNOWN')
    const event = JSON.parse(bytes(fx.writer.eventsFile).trim())
    delete event.deliveryProtocol
    writeFileSync(fx.writer.eventsFile, `${JSON.stringify(event)}\n`)
    const historicalWal = bytes(fx.writer.eventsFile)
    const historical = engine(fx)
    const [observed] = await historical.engine.reconcileDeliveries()
    assert.equal(observed.classification, 'UNKNOWN', 'absence of an old fence is not modern WAL proof')
    assert.equal(bytes(fx.reader.eventsFile), historicalWal)
    event.deliveryProtocol = 'unrecognized-protocol'
    writeFileSync(fx.writer.eventsFile, `${JSON.stringify(event)}\n`)
    assert.equal((await historical.engine.reconcileDeliveries())[0].classification, 'UNKNOWN')
  } finally { fx.cleanup() }
})

test('B3 unknown classification leaves a torn ledger tail byte-for-byte intact', async () => {
  const fx = fixture()
  try {
    await fx.writer.beginAttemptIfAbsent(intent())
    appendFileSync(fx.writer.eventsFile, '{"kind":"delivery_started"')
    const tornWal = bytes(fx.writer.eventsFile)
    const restarted = engine(fx, { resolveCallerCorrelation: () => ({ state: 'restart_lost' }) })
    assert.equal((await restarted.engine.reconcileDeliveries())[0].classification, 'UNKNOWN')
    assert.equal(bytes(fx.reader.eventsFile), tornWal)
    assert.equal(restarted.calls.delivers.length, 0)
  } finally { fx.cleanup() }
})

test('B3 observation waits for in-flight admission lock instead of racing an unsent snapshot', async () => {
  const fx = fixture()
  const paused = barrier()
  try {
    const admitting = fx.writer.beginAttemptIfAbsent(intent(), async (_, { recordDeliveryStarted }) => {
      await paused.call()
      recordDeliveryStarted()
      throw INTERRUPTION
    })
    const interrupted = assert.rejects(admitting, error => error === INTERRUPTION)
    await paused.arrived
    const restarted = engine(fx)
    const observation = restarted.engine.reconcileDeliveries()
    paused.release()
    await interrupted
    const [observed] = await observation
    assert.equal(observed.classification, 'UNKNOWN')
    assert.equal(observed.reason, 'delivery_started_without_exact_receipt')
  } finally { paused.release(); fx.cleanup() }
})
