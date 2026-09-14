import test from 'node:test'
import assert from 'node:assert/strict'

import { publishVerifiedPostdeployReceipt, verifyPostdeployEvidence } from '../../src/scheduler/deployment-postdeploy-finalize.js'

const SOURCE = 'a'.repeat(40)
const occurrence = { occurrenceId: 'occ-old', runId: 'run-old', jobId: 'job-quarantined', kind: 'scheduled', state: 'outcome_unknown', executionOutcome: 'unknown', admittedAt: 1, startedAt: 2, endedAt: 3, nominalScheduledAt: 1, scheduleRevision: 1 }
const job = { id: 'job-quarantined', agentId: 'agt-q', logicalKey: 'q', name: 'Q', enabled: true, scheduleRevision: 1, revisionActivatedAtMs: 1, createdAtMs: 1, updatedAtMs: 1, schedule: { kind: 'every', everyMs: 1000, anchorMs: 1 }, payload: { kind: 'agentTurn', message: 'q' }, delivery: { mode: 'none' }, state: {} }
const beforeStore = { version: 3, jobs: [job], occurrences: [occurrence], fences: { 'job-quarantined': ['occ-old'] } }
const canaryOccurrence = { occurrenceId: 'occ-canary', runId: 'run-canary', jobId: 'job-canary', kind: 'scheduled', state: 'succeeded', executionOutcome: 'succeeded', admittedAt: 10, startedAt: 11, endedAt: 12, nominalScheduledAt: 10, scheduleRevision: 1 }
const afterStore = { ...beforeStore, occurrences: [...beforeStore.occurrences, canaryOccurrence] }
const row = { jobId: job.id, state: 'QUARANTINED_UNKNOWN', currentOccurrence: { occurrenceId: 'occ-old', state: 'outcome_unknown' }, currentBlocker: 'OUTCOME_UNKNOWN', blockedSince: 3, fenceReason: 'unresolved outcome_unknown occurrence contribution' }
const health = (at) => ({ complete: true, unknown: 0, enabled: 1, healthy: 0, degraded: 0, blocked: 1, generatedAt: at,
  provenance: { canonicalPair: true, runtime: SOURCE, store: 'b'.repeat(64), routing: 'c'.repeat(64) }, jobs: [row],
  findings: [
    { class: 'ADMISSION_BLOCKED_UNKNOWN', jobId: job.id, occurrenceId: 'occ-old', runId: 'run-old' },
    { class: 'EXPECTED_RUN_MISSED', jobId: job.id, occurrenceId: 'occ-old', runId: 'run-old', derivedUnderAdmissionBlock: true },
  ] })
const evidence = () => ({ phaseReceipt: { sourceSha: SOURCE, acceptanceStatus: 'PENDING_CANONICAL_HEALTH_AND_CANARY', productionAccepted: false, currentSixAuthorized: false }, sourceSha: SOURCE,
  beforeHealth: health(20), afterHealth: health(30), beforeStore, afterStore, canaryJobId: 'job-canary',
  beforeStoreSha256: 'b'.repeat(64), afterStoreSha256: 'b'.repeat(64),
  runReadback: { occurrences: [canaryOccurrence] } })

test('formal postdeploy evidence accepts exact health, one canary delta, quarantine isolation and dedupe', () => {
  const receipt = verifyPostdeployEvidence(evidence())
  assert.equal(receipt.status, 'ACCEPTED')
  assert.equal(receipt.currentSixAuthorized, false, 'authorization is minted only for an exact six-occurrence evidence set')
  assert.equal(receipt.canary.occurrenceId, 'occ-canary')
  assert.equal(receipt.quarantine.quarantinedCount, 1)
})

test('current-six recovery authority is bound to the exact six quarantined occurrence identities', () => {
  const jobs = Array.from({ length: 6 }, (_, index) => ({ ...job, id: `job-${index}`, logicalKey: `q-${index}` }))
  const occurrences = jobs.map((item, index) => ({ ...occurrence, jobId: item.id, occurrenceId: `occ-${index}`, runId: `run-${index}` }))
  const storeBefore = { version: 3, jobs, occurrences, fences: Object.fromEntries(occurrences.map((item) => [item.jobId, [item.occurrenceId]])) }
  const rows = occurrences.map((item) => ({ ...row, jobId: item.jobId, currentOccurrence: { occurrenceId: item.occurrenceId, state: 'outcome_unknown' } }))
  const findings = occurrences.flatMap((item) => [
    { class: 'ADMISSION_BLOCKED_UNKNOWN', jobId: item.jobId, occurrenceId: item.occurrenceId, runId: item.runId },
    { class: 'EXPECTED_RUN_MISSED', jobId: item.jobId, occurrenceId: item.occurrenceId, runId: item.runId, derivedUnderAdmissionBlock: true },
  ])
  const healthSix = (at) => ({ ...health(at), enabled: 6, blocked: 6, jobs: rows, findings })
  const receipt = verifyPostdeployEvidence({ ...evidence(), beforeStore: storeBefore,
    afterStore: { ...storeBefore, occurrences: [...occurrences, canaryOccurrence] }, beforeHealth: healthSix(20), afterHealth: healthSix(30) })
  assert.equal(receipt.currentSixAuthorized, true)
  assert.deepEqual(receipt.currentSixOccurrences, occurrences.map((item) => item.occurrenceId))
})

test('formal postdeploy evidence rejects fabricated generation and incomplete health', () => {
  assert.throws(() => verifyPostdeployEvidence({ ...evidence(), sourceSha: 'd'.repeat(40) }), /pending deployed generation/)
  assert.throws(() => verifyPostdeployEvidence({ ...evidence(), afterHealth: { ...health(30), complete: false } }), /incomplete or unknown/)
})

test('formal postdeploy evidence rejects unexpected store mutation or duplicate incident roots', () => {
  const changed = structuredClone(afterStore); changed.jobs[0].enabled = false
  assert.throws(() => verifyPostdeployEvidence({ ...evidence(), afterStore: changed }), /Jobs changed unexpectedly/)
  const duplicated = health(30)
  duplicated.findings[1] = { ...duplicated.findings[1], derivedUnderAdmissionBlock: false, jobRevision: 1 }
  assert.throws(() => verifyPostdeployEvidence({ ...evidence(), afterHealth: duplicated }), /one-per-occurrence/)
})

test('interrupted or non-exact receipt publication cannot return acceptance', () => {
  assert.throws(() => publishVerifiedPostdeployReceipt(evidence(), { writeReceipt: () => { throw new Error('interrupted') }, readReceipt: () => assert.fail() }), /interrupted/)
  assert.throws(() => publishVerifiedPostdeployReceipt(evidence(), { writeReceipt: () => {}, readReceipt: () => ({ status: 'PENDING' }) }), /publication\/readback mismatch/)
})
