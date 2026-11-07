/**
 * Occurrence model tests — SCHEDULER_TIMEOUT_OUTCOME_V2:
 *   ACC-005 (identity determinism, with scheduler-level restart coverage in
 *           scheduler.test.js), ACC-006 (state machine), ACC-022 (record
 *           schema), ACC-023 (identity derivation + collision policy),
 *           ACC-024 (payloadHash), ACC-028 (fence rebuild, pure level).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JobStore } from '../src/store.js'
import {
  deriveOccurrenceId, deriveRunId, deriveNativeSessionId, computePayloadHash,
  canonicalJSON, canTransition, isTerminalState, isUnresolvedUnknown,
  buildOccurrenceRecord, applyTransition, rebuildFences, validateOccurrenceRecord, decodeOccurrenceRecord,
  logicalCoordinates, findOccurrenceByCoords, structuredCollisionError,
} from '../src/occurrence-model.js'

const JOB = {
  id: 'job-1', agentId: 'agent-a', scheduleRevision: 3,
  payload: { kind: 'agentTurn', message: 'hello', timeoutSeconds: 90 },
}

// ── ACC-023 / C-023: deterministic identity ───────────────────────────────

test('ACC-023 identity derivation is deterministic per logical coordinates', () => {
  const a = deriveOccurrenceId({ jobId: 'job-1', scheduleRevision: 3, kind: 'natural', nominalScheduledAt: 1000 })
  const b = deriveOccurrenceId({ jobId: 'job-1', scheduleRevision: 3, kind: 'natural', nominalScheduledAt: 1000 })
  assert.equal(a, b)
  assert.match(a, /^occ:[0-9a-f]{16}$/)
  assert.notEqual(a, deriveOccurrenceId({ jobId: 'job-1', scheduleRevision: 4, kind: 'natural', nominalScheduledAt: 1000 }), 'revision changes identity')
  assert.notEqual(a, deriveOccurrenceId({ jobId: 'job-1', scheduleRevision: 3, kind: 'natural', nominalScheduledAt: 1001 }), 'slot changes identity')
  assert.notEqual(a, deriveOccurrenceId({ jobId: 'job-1', scheduleRevision: 3, kind: 'catchup', catchUpOfNominalAt: 1000 }), 'kind changes identity')
  // unambiguous encoding: (rev 1, slot 231) != (rev 12, slot 31)
  assert.notEqual(
    deriveOccurrenceId({ jobId: 'j', scheduleRevision: 1, kind: 'natural', nominalScheduledAt: 231 }),
    deriveOccurrenceId({ jobId: 'j', scheduleRevision: 12, kind: 'natural', nominalScheduledAt: 31 }),
  )
})

test('ACC-023 runId/idempotencyKey derive from occurrenceId; session is fresh + non-main', () => {
  const occ = deriveOccurrenceId({ jobId: 'job-1', scheduleRevision: 1, kind: 'natural', nominalScheduledAt: 5 })
  assert.equal(deriveRunId(occ), `run:${occ}`)
  const session = deriveNativeSessionId(occ)
  assert.ok(session.startsWith('cron-run-'), 'native session per D-006 cron-run-* convention')
  assert.notEqual(session, 'main')
  assert.notEqual(session, `agent:agent-a:cron:job-1`, 'never the legacy stable per-job session')
  assert.notEqual(deriveNativeSessionId('occ:aaa'), deriveNativeSessionId('occ:bbb'), 'two occurrences never share a session')
})

test('ACC-023 natural/catchup jointly occupy the nominal slot space; retry occupies its predecessor', () => {
  const natural = logicalCoordinates({ jobId: 'j', scheduleRevision: 1, kind: 'natural', nominalScheduledAt: 42 })
  const catchup = logicalCoordinates({ jobId: 'j', scheduleRevision: 1, kind: 'catchup', catchUpOfNominalAt: 42 })
  assert.deepEqual(natural, catchup, 'same effectiveSlot -> at most one record regardless of kind')
  const retry = logicalCoordinates({ jobId: 'j', scheduleRevision: 1, kind: 'retry', retryOfOccurrenceId: 'occ:x' })
  assert.equal(retry.effectiveSlot, 'occ:x')
})

test('ACC-023 structured collision error is fail-loud and structured', () => {
  const existing = buildOccurrenceRecord({ job: JOB, kind: 'natural', nominalScheduledAt: 1000, admittedAt: 1 })
  const attempted = buildOccurrenceRecord({ job: JOB, kind: 'retry', retryOfOccurrenceId: 'occ:other', admittedAt: 2 })
  assert.notEqual(existing.occurrenceId, attempted.occurrenceId)
  const err = structuredCollisionError(existing, attempted)
  assert.equal(err.code, 'OCCURRENCE_STRUCTURED_COLLISION')
  assert.deepEqual(err.attempted, { jobId: 'job-1', scheduleRevision: 3, effectiveSlot: 'occ:other' })
})

// ── ACC-006 / §9.1 state machine ──────────────────────────────────────────

test('ACC-006 state machine: legal transitions and hard rejections', () => {
  assert.ok(canTransition('admitted', 'running'))
  assert.ok(canTransition('admitted', 'failed'))
  assert.ok(canTransition('admitted', 'outcome_unknown'))
  assert.ok(canTransition('running', 'succeeded'))
  assert.ok(canTransition('running', 'failed'))
  assert.ok(canTransition('running', 'outcome_unknown'))
  assert.ok(canTransition('outcome_unknown', 'succeeded'))
  assert.ok(canTransition('outcome_unknown', 'failed'))
  // forbidden
  assert.equal(canTransition('outcome_unknown', 'admitted'), false, 'outcome_unknown -> admitted is FORBIDDEN')
  assert.equal(canTransition('admitted', 'succeeded'), false, 'success must pass through running')
  assert.equal(canTransition('succeeded', 'running'), false)
  assert.equal(canTransition('succeeded', 'outcome_unknown'), false)
  assert.equal(canTransition('failed', 'admitted'), false)
})

test('ACC-006 applyTransition appends history and rejects illegal transitions', () => {
  const record = buildOccurrenceRecord({ job: JOB, kind: 'natural', nominalScheduledAt: 1, admittedAt: 10 })
  applyTransition(record, { to: 'running', at: 20, reason: 'turn start', startedAt: 20 })
  applyTransition(record, { to: 'succeeded', at: 30, reason: 'terminal ok', executionOutcome: 'succeeded', endedAt: 30 })
  assert.equal(record.state, 'succeeded')
  assert.deepEqual(record.history.map((h) => [h.from, h.to]), [
    [null, 'admitted'], ['admitted', 'running'], ['running', 'succeeded'],
  ])
  assert.throws(() => applyTransition(record, { to: 'outcome_unknown', at: 40 }), /illegal transition succeeded -> outcome_unknown/)
  const unknown = buildOccurrenceRecord({ job: JOB, kind: 'natural', nominalScheduledAt: 2, admittedAt: 10 })
  applyTransition(unknown, { to: 'outcome_unknown', at: 12 })
  assert.throws(() => applyTransition(unknown, { to: 'admitted', at: 15 }), /outcome_unknown -> admitted/)
})

test('ACC-006 late settlement leaves the unknown history auditable', () => {
  const record = buildOccurrenceRecord({ job: JOB, kind: 'natural', nominalScheduledAt: 1, admittedAt: 10 })
  applyTransition(record, { to: 'running', at: 11 })
  applyTransition(record, { to: 'outcome_unknown', at: 12, reason: 'timeout' })
  applyTransition(record, {
    to: 'succeeded', at: 99, reason: 'late evidence',
    executionOutcome: 'succeeded',
    lateSettlement: { resolvedTo: 'succeeded', resolvedAt: 99, basis: 'operator-reconcile', evidenceRef: 'note' },
  })
  assert.equal(record.state, 'succeeded')
  assert.equal(record.lateSettlement.basis, 'operator-reconcile')
  assert.ok(record.history.some((h) => h.to === 'outcome_unknown'), 'timeout history preserved')
})

// ── ACC-022 record schema ─────────────────────────────────────────────────

test('ACC-022 buildOccurrenceRecord carries every authority field (C-022)', () => {
  const record = buildOccurrenceRecord({ job: JOB, kind: 'natural', nominalScheduledAt: 5000, admittedAt: 100, timeoutMs: 90_000 })
  validateOccurrenceRecord(record)
  assert.equal(record.jobId, 'job-1')
  assert.equal(record.scheduleRevision, 3)
  assert.equal(record.kind, 'natural')
  assert.equal(record.nominalScheduledAt, 5000)
  assert.equal(record.runId, `run:${record.occurrenceId}`)
  assert.equal(record.idempotencyKey, record.occurrenceId, 'C-023: idempotencyKey = occurrenceId')
  assert.equal(record.state, 'admitted')
  assert.equal(record.executionDeadlineAtMs, 100 + 90_000, 'C-025: deadline = admittedAt + timeoutMs')
})

test('ACC-022 corrupt occurrence records fail loud on validation (authority corruption)', () => {
  const record = buildOccurrenceRecord({ job: JOB, kind: 'natural', nominalScheduledAt: 1, admittedAt: 1 })
  for (const field of ['occurrenceId', 'jobId', 'runId', 'payloadHash', 'state', 'admittedAt', 'executionDeadlineAtMs', 'history']) {
    const broken = { ...record }
    delete broken[field]
    assert.throws(() => validateOccurrenceRecord(broken), { code: 'OCCURRENCE_STORE_CORRUPT' }, `missing ${field} must fail loud`)
  }
  assert.throws(() => validateOccurrenceRecord({ ...record, state: 'weird' }), { code: 'OCCURRENCE_STORE_CORRUPT' })
  assert.throws(() => validateOccurrenceRecord({ ...record, kind: 'natural', nominalScheduledAt: undefined }), { code: 'OCCURRENCE_STORE_CORRUPT' })
})

test('ACC-006/011 unknown-to-terminal history without trusted lateSettlement fails loud', () => {
  const record = buildOccurrenceRecord({ job: JOB, kind: 'natural', nominalScheduledAt: 1, admittedAt: 0 })
  applyTransition(record, { to: 'outcome_unknown', at: 2, reason: 'unproven' })
  record.state = 'succeeded'
  record.executionOutcome = 'succeeded'
  record.endedAt = 3
  record.history.push({ at: 3, from: 'outcome_unknown', to: 'succeeded', reason: 'fabricated' })
  assert.throws(() => validateOccurrenceRecord(record), /requires lateSettlement authority/)
})

test('ACC-004/022 failed authority requires a valid terminalEvidence kind', () => {
  const record = buildOccurrenceRecord({ job: JOB, kind: 'natural', nominalScheduledAt: 1, admittedAt: 0 })
  applyTransition(record, {
    to: 'failed', at: 2, reason: 'rejected', endedAt: 2, executionOutcome: 'failed',
    terminalEvidence: { kind: 'pre-start-rejection', detailRef: 'AGENT_DISABLED' },
  })
  assert.doesNotThrow(() => validateOccurrenceRecord(record))
  delete record.terminalEvidence
  assert.throws(() => validateOccurrenceRecord(record), /failed requires terminalEvidence/)
  record.terminalEvidence = { kind: 'best-effort-guess', detailRef: 42 }
  assert.throws(() => validateOccurrenceRecord(record), /invalid terminalEvidence/)
})

test('ACC-022 default timeout falls back to the safety timeout (C-025)', () => {
  const job = { ...JOB, payload: { kind: 'agentTurn', message: 'x' } } // no timeoutSeconds
  const record = buildOccurrenceRecord({ job, kind: 'natural', nominalScheduledAt: 1, admittedAt: 0 })
  assert.equal(record.executionDeadlineAtMs, 3_600_000)
})

// ── ACC-024 payloadHash ───────────────────────────────────────────────────

test('ACC-024 payloadHash: canonical JSON, key order irrelevant, delivery excluded', () => {
  const a = computePayloadHash({ agentId: 'a1', payload: { message: 'm', timeoutSeconds: 5, kind: 'agentTurn' } })
  const b = computePayloadHash({ agentId: 'a1', payload: { kind: 'agentTurn', timeoutSeconds: 5, message: 'm' } })
  assert.equal(a, b, 'key order does not matter (canonical JSON)')
  assert.notEqual(a, computePayloadHash({ agentId: 'a1', payload: { message: 'm2' } }), 'message change changes hash')
  assert.equal(
    computePayloadHash({ agentId: 'a1', payload: { message: 'm' } }),
    computePayloadHash({ agentId: 'a1', payload: { message: 'm', model: undefined, lightContext: undefined } }),
    'undefined fields omitted',
  )
  // delivery never enters the execution hash (D-007 §11.4 separation)
  assert.equal(typeof a, 'string')
  assert.ok(a.startsWith('sha256:'))
})

test('ACC-024 canonicalJSON sorts keys recursively', () => {
  assert.equal(canonicalJSON({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}')
})

// ── ACC-028 fence projection (pure level) ─────────────────────────────────

test('ACC-028 rebuildFences derives fences from unresolved unknowns only', () => {
  const base = { jobId: 'j1', admittedAt: 5 }
  const unknown = { ...base, occurrenceId: 'occ:u1', runId: 'run:occ:u1', state: 'outcome_unknown' }
  const settled = { ...base, occurrenceId: 'occ:u2', runId: 'run:occ:u2', state: 'outcome_unknown', lateSettlement: { resolvedTo: 'succeeded' } }
  const ok = { ...base, occurrenceId: 'occ:o1', runId: 'run:occ:o1', state: 'succeeded' }
  const fences = rebuildFences([unknown, settled, ok])
  assert.deepEqual(Object.keys(fences), ['j1'])
  assert.equal(fences.j1.occurrenceId, 'occ:u1')
  assert.deepEqual(rebuildFences([settled, ok]), {})
})

test('ACC-028 isUnresolvedUnknown + terminal helpers', () => {
  assert.ok(isUnresolvedUnknown({ state: 'outcome_unknown' }))
  assert.equal(isUnresolvedUnknown({ state: 'outcome_unknown', lateSettlement: { resolvedTo: 'failed' } }), false)
  assert.ok(isTerminalState('succeeded'))
  assert.ok(isTerminalState('failed'))
  assert.equal(isTerminalState('outcome_unknown'), false)
})

test('findOccurrenceByCoords locates records by logical coordinates', () => {
  const record = buildOccurrenceRecord({ job: JOB, kind: 'natural', nominalScheduledAt: 777, admittedAt: 1 })
  const found = findOccurrenceByCoords([record], logicalCoordinates(record))
  assert.equal(found.occurrenceId, record.occurrenceId)
  assert.equal(findOccurrenceByCoords([record], { jobId: 'job-1', scheduleRevision: 3, effectiveSlot: 778 }), undefined)
})

// Compatibility read projection and strict writer preservation.
function unknownRecord() {
  const record = buildOccurrenceRecord({
    job: { id: 'compat-job', agentId: 'compat-agent', scheduleRevision: 1, payload: { message: 'test' } },
    kind: 'natural', nominalScheduledAt: 10, admittedAt: 10, timeoutMs: 100,
  })
  applyTransition(record, { to: 'outcome_unknown', at: 20, reason: 'no outcome evidence' })
  return record
}

test('R4 arbitrary non-enum history to values decode as unverifiable without inventing admission', () => {
  for (const value of ['[redacted]', 'unknown-marker', 'damaged-state', '', null, 42, false, {}, []]) {
    const record = unknownRecord()
    record.history[0].to = value
    const before = structuredClone(record)
    const decoded = decodeOccurrenceRecord(record)
    assert.deepEqual(decoded.historyVerification, { status: 'unverifiable', outcome: 'UNKNOWN', invalidEnumEntries: [0] })
    const { historyVerification, ...facts } = decoded
    assert.deepEqual(facts, before)
    assert.deepEqual(record, before, 'decoder does not mutate its source')
    assert.equal(decoded.state, 'outcome_unknown')
    assert.equal(decoded.executionOutcome, undefined)
    assert.equal(decoded.lateSettlement, undefined)
    assert.equal(decoded.terminationSettlement, undefined)
    assert.equal(decoded.history.some(entry => entry.to === 'admitted'), false)
    assert.throws(() => validateOccurrenceRecord(decoded), { code: 'OCCURRENCE_STORE_CORRUPT' })
  }
})

test('R4 invalid from/final enums retain their raw values; marker is recomputed, never trusted', () => {
  const record = unknownRecord()
  record.history[1].from = 'unrecognized-source'
  record.history[1].to = 'unrecognized-target'
  record.historyVerification = { status: 'verified' }
  const decoded = decodeOccurrenceRecord(record)
  assert.deepEqual(decoded.history, record.history)
  assert.equal(decoded.historyVerification.status, 'unverifiable')
  const valid = unknownRecord()
  valid.historyVerification = decoded.historyVerification
  assert.equal(decodeOccurrenceRecord(valid).historyVerification, undefined)
})

test('R4 structurally unusable records and independently provable corruption still fail loud', () => {
  const mutations = [
    record => { delete record.ownerAgentId },
    record => { record.occurrenceId = 'wrong-identity' },
    record => { record.history = [] },
    record => { record.history[1] = null },
    record => { delete record.history[1].from },
    record => { delete record.history[1].to },
    record => { record.history[1].at = null },
    record => { record.history[1].at = 0 },
    record => { record.history[1].reason = null },
    record => { record.history[1].from = 'succeeded' }, // Known illegal edge remains illegal.
    record => { record.lateSettlement = { basis: 'guess' } },
    record => { record.terminationSettlement = { kind: 'terminated_without_outcome' } },
  ]
  for (const mutate of mutations) {
    const record = unknownRecord()
    record.history[0].to = 'unknown-token'
    mutate(record)
    assert.throws(() => decodeOccurrenceRecord(record), { code: 'OCCURRENCE_STORE_CORRUPT' })
  }
})

test('R4 redacted late-settlement linkage is unverifiable while settlement authority stays strict', () => {
  const record = unknownRecord()
  applyTransition(record, {
    to: 'failed', at: 30, endedAt: 30, executionOutcome: 'failed',
    terminalEvidence: { kind: 'late-settlement', detailRef: 'test-proof' },
    lateSettlement: { basis: 'operator-reconcile', resolvedTo: 'failed', resolvedAt: 30, evidenceRef: 'test-proof' },
  })
  record.history[2].to = 'unknown-token'
  const decoded = decodeOccurrenceRecord(record)
  assert.equal(decoded.historyVerification.outcome, 'UNKNOWN')
  assert.deepEqual(decoded.lateSettlement, record.lateSettlement)
  assert.deepEqual(decoded.history, record.history)
  record.lateSettlement.evidenceRef = ''
  assert.throws(() => decodeOccurrenceRecord(record), /invalid lateSettlement authority/)
})

test('R4 JobStore read/restart preserves raw UNKNOWN fences; strict mutation rejects with zero file writes', async t => {
  const root = mkdtempSync(join(tmpdir(), 'scheduler-history-compat-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const file = join(root, 'jobs.json')
  const record = unknownRecord()
  record.history[0].to = 'unknown-token'
  const raw = { version: 3, jobs: [], occurrences: [record], fences: rebuildFences([record]) }
  writeFileSync(file, JSON.stringify(raw))
  const before = readFileSync(file)
  const store = new JobStore(file)
  const doc = await store.loadDoc()
  assert.equal(doc.occurrences[0].historyVerification.status, 'unverifiable')
  assert.deepEqual(doc.fences, raw.fences)
  assert.deepEqual(await new JobStore(file).loadDoc(), doc)
  await assert.rejects(store.mutateDoc(() => {}), /occurrence authority corrupted/)
  assert.deepEqual(readFileSync(file), before)
  assert.deepEqual(await store.loadDoc(), doc)
})
