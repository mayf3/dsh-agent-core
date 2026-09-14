import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  RECONCILIATION_RESULTS,
  classifyReconciliationEvidence,
  dispatchReconciliation,
  unresolvedFenceContributions,
} from '../../src/watchdog/reconciliation.js'

const identity = { jobId: 'job-a', occurrenceId: 'occ-a', runId: 'run-a', epoch: 'request-a' }
const exact = (value) => ({ trusted: true, fresh: true, source: 'router', ...identity, observedAt: 100, ...value })
const classify = (evidence) => classifyReconciliationEvidence(evidence, { nowMs: 100 })

test('T05 age/timeout alone never proves failure or fence release', () => {
  const result = classify({ identity, ageMs: 99_999_999, timedOut: true })
  assert.equal(result.classification, RECONCILIATION_RESULTS.QUARANTINED_UNKNOWN)
  assert.equal(result.releaseFence, false)
  assert.equal(result.zeroWrite, true)
})

test('T06/T07 trusted exact business outcome wins success/failure and releases only its contribution', () => {
  for (const [status, classification] of [['succeeded', 'RECONCILED_SUCCESS'], ['failed', 'RECONCILED_FAILURE']]) {
    const result = classify({ identity, businessOutcome: exact({ status }), termination: exact({ terminated: true }) })
    assert.equal(result.classification, classification)
    assert.equal(result.path, 'business-outcome')
    assert.equal(result.releaseFence, true)
  }
})

test('T08 fresh exact live evidence retains the fence', () => {
  const result = classify({ identity, live: exact({ live: true, fresh: true }) })
  assert.equal(result.classification, RECONCILIATION_RESULTS.STILL_IN_FLIGHT)
  assert.equal(result.releaseFence, false)
})

test('T09/T24 ambiguous stale conflicting or cross-occurrence evidence is quarantine and zero-write', () => {
  const cases = [
    { identity },
    { identity, live: exact({ live: true, fresh: false }) },
    { identity, businessOutcome: { ...exact({ status: 'failed' }), occurrenceId: 'other' } },
    { identity, businessOutcome: exact({ status: 'failed' }), live: exact({ live: true, fresh: true }) },
    { identity, businessOutcome: exact({ status: 'failed', fresh: false }) },
    { identity, termination: exact({ terminated: true, fresh: false }) },
    { identity, termination: exact({ terminated: true }), live: exact({ live: true }) },
    { identity, termination: exact({ terminated: true, epoch: 'old-request' }) },
    { identity, termination: exact({ terminated: true, observedAt: 94 }) },
    { identity, termination: exact({ terminated: true, observedAt: 101 }) },
    { identity, termination: exact({ terminated: true, source: 'caller-asserted' }) },
  ]
  for (const evidence of cases) {
    const result = classifyReconciliationEvidence(evidence, { nowMs: 100, maxEvidenceAgeMs: 5 })
    assert.equal(result.classification, RECONCILIATION_RESULTS.QUARANTINED_UNKNOWN)
    assert.equal(result.zeroWrite, true)
    assert.equal(result.releaseFence, false)
  }
})

test('T20/T24 exact termination-only dispatches to existing settlement seam and never classifier mutation', async () => {
  const calls = []
  const result = await dispatchReconciliation({
    evidence: { identity, termination: exact({ terminated: true }) },
    nowMs: 100,
    settleBusiness: async () => calls.push('business'),
    settleTermination: async () => calls.push('termination'),
  })
  assert.equal(result.path, 'termination-only')
  assert.deepEqual(calls, ['termination'])
  assert.equal(result.replayOccurrence, false)
  assert.equal(result.nextSchedule, 'future-natural-only')
})

test('T24 every ordered evidence path dispatches at most one seam', async () => {
  for (const evidence of [
    { identity, businessOutcome: exact({ status: 'succeeded' }) },
    { identity, businessOutcome: exact({ status: 'failed' }) },
    { identity, live: exact({ live: true, fresh: true }) },
    { identity },
  ]) {
    const calls = []
    await dispatchReconciliation({ evidence, nowMs: 100, settleBusiness: async () => calls.push('business'), settleTermination: async () => calls.push('termination') })
    assert.ok(calls.length <= 1)
  }
})

test('T23 aggregate fence remains until every unresolved contribution for exact Job settles', () => {
  const occurrences = [
    { jobId: 'job-a', occurrenceId: 'occ-a', state: 'succeeded' },
    { jobId: 'job-a', occurrenceId: 'occ-b', state: 'outcome_unknown' },
    { jobId: 'job-b', occurrenceId: 'occ-c', state: 'outcome_unknown' },
  ]
  assert.deepEqual(unresolvedFenceContributions(occurrences, 'job-a'), ['occ-b'])
  assert.deepEqual(unresolvedFenceContributions(occurrences, 'job-b'), ['occ-c'])
})
