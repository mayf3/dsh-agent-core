/**
 * SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 CTR-SCT-003/004 — the frozen
 * session disposition table over the self-service runs projection:
 * a not_created occurrence must NEVER expose its designated session id
 * (SC-1), `unknown` never guesses, and the additive projection tail keeps
 * every pre-existing field byte-identical.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { occurrenceProjection, sessionDispositionOf } from '../../src/self-service/projections.js'

const FENCES = {}

test('CTR-SCT-003: frozen disposition table over persisted occurrence fields', () => {
  const worlds = [
    [{ state: 'succeeded', nativeSessionId: 'cron-run-occ:a' }, { sessionCreated: 'created' }],
    [{ state: 'running', nativeSessionId: 'cron-run-occ:b' }, { sessionCreated: 'created' }],
    [{ state: 'failed', terminalEvidence: { kind: 'turn-terminal' } }, { sessionCreated: 'created' }],
    [{ state: 'failed', terminalEvidence: { kind: 'pre-start-rejection', code: 'AGENT_NOT_FOUND' } },
      { sessionCreated: 'not_created', sessionNotCreatedReason: 'pre-start-rejection' }],
    [{ state: 'failed', terminalEvidence: { kind: 'late-settlement' } }, { sessionCreated: 'unknown' }],
    [{ state: 'failed', terminalEvidence: { kind: 'operator-reconcile' } }, { sessionCreated: 'unknown' }],
    [{ state: 'outcome_unknown' }, { sessionCreated: 'unknown' }],
    [{ state: 'admitted' }, { sessionCreated: 'pending' }],
  ]
  for (const [record, expected] of worlds) {
    assert.deepEqual(sessionDispositionOf(record), expected, `drift at ${JSON.stringify(record)}`)
  }
})

test('CTR-SCT-004: projection exposes sessionId + disposition; not_created hides the session id entirely', () => {
  const succeeded = occurrenceProjection({
    occurrenceId: 'occ:x1', runId: 'run:occ:x1', jobId: 'job_1', kind: 'natural',
    state: 'succeeded', executionOutcome: 'succeeded', deliveryStatus: 'none',
    admittedAt: 1, startedAt: 2, endedAt: 3, nativeSessionId: 'cron-run-occ:a',
  }, FENCES)
  assert.equal(succeeded.sessionId, 'cron-run-occ:a')
  assert.equal(succeeded.sessionCreated, 'created')
  assert.equal(succeeded.sessionNotCreatedReason, undefined)

  const preStart = occurrenceProjection({
    occurrenceId: 'occ:x2', runId: 'run:occ:x2', jobId: 'job_1', kind: 'natural',
    state: 'failed', executionOutcome: 'failed', deliveryStatus: 'none',
    admittedAt: 1, endedAt: 3, nativeSessionId: 'cron-run-occ:b',
    terminalEvidence: { kind: 'pre-start-rejection', code: 'AGENT_DISABLED' },
  }, FENCES)
  assert.equal(preStart.sessionId, null, 'SC-1: no fabricated sessionId for a session that never existed')
  assert.equal(preStart.sessionCreated, 'not_created')
  assert.equal(preStart.sessionNotCreatedReason, 'pre-start-rejection')

  const admitted = occurrenceProjection({
    occurrenceId: 'occ:x3', runId: 'run:occ:x3', jobId: 'job_1', kind: 'natural',
    state: 'admitted', deliveryStatus: 'none', admittedAt: 1,
  }, FENCES)
  assert.equal(admitted.sessionId, null)
  assert.equal(admitted.sessionCreated, 'pending')

  const unknown = occurrenceProjection({
    occurrenceId: 'occ:x4', runId: 'run:occ:x4', jobId: 'job_1', kind: 'natural',
    state: 'outcome_unknown', deliveryStatus: 'unknown', admittedAt: 1,
    nativeSessionId: 'cron-run-occ:d',
  }, { job_1: { occurrenceId: 'occ:x4' } })
  assert.equal(unknown.sessionCreated, 'unknown', 'outcome_unknown never guesses')
  assert.equal(unknown.sessionId, 'cron-run-occ:d')
  assert.equal(unknown.fenceActive, true, 'fence state rides along with the unknown disposition')
  assert.equal(unknown.terminationSettled, false, 'bare unknown: no trusted settlement')

  const settledUnknown = occurrenceProjection({
    occurrenceId: 'occ:x5', runId: 'run:occ:x5', jobId: 'job_1', kind: 'natural',
    state: 'outcome_unknown', deliveryStatus: 'unknown', admittedAt: 1,
    nativeSessionId: 'cron-run-occ:e',
    terminationSettlement: { kind: 'terminated_without_outcome', businessStateAtCommit: 'outcome_unknown' },
  }, FENCES)
  assert.equal(settledUnknown.terminationSettled, true, 'C-039 settlement presence is surfaced (CTR-SCT-003 annotation)')
})

test('CTR-SCT-004: the additive tail keeps every pre-existing projection field', () => {
  const record = {
    occurrenceId: 'occ:y', runId: 'run:occ:y', jobId: 'job_2', kind: 'catch_up',
    state: 'succeeded', executionOutcome: 'succeeded', deliveryStatus: 'delivered',
    nominalScheduledAt: 10, admittedAt: 11, startedAt: 12, endedAt: 13,
    lateSettlement: { basis: 'trusted-late-evidence' }, nativeSessionId: 'cron-run-occ:e',
  }
  const projection = occurrenceProjection(record, FENCES)
  // Pre-existing closed field set (byte-compat surface).
  for (const key of ['occurrenceId', 'runId', 'jobId', 'kind', 'state', 'executionOutcome', 'deliveryStatus', 'nominalScheduledAt', 'admittedAt', 'startedAt', 'endedAt', 'lateSettlement', 'fenceActive']) {
    assert.ok(key in projection, `${key} preserved`)
  }
  assert.deepEqual(projection.lateSettlement, { basis: 'trusted-late-evidence' })
  assert.equal(projection.sessionCreated, 'created')
})
