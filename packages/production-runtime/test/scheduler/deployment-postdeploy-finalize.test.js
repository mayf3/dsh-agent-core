import test from 'node:test'
import assert from 'node:assert/strict'

import { publishVerifiedPostdeployReceipt, verifyPostdeployEvidence } from '../../src/scheduler/deployment-postdeploy-finalize.js'
import { compileIncidents } from '../../../scheduler/src/watchdog/incident-compiler.js'
import { bindNotificationDelivery, markNotificationDelivery, updateIncidentState } from '../../../scheduler/src/watchdog/incident-lifecycle.js'
import { providerIdempotencyKey, stableNotificationText } from '../../../scheduler/src/watchdog/delivery.js'
import { POSTDEPLOY_CANARY_MARKER } from '../../src/scheduler/deployment-canary-control.js'

const SOURCE = 'a'.repeat(40)
const occurrence = { occurrenceId: 'occ-old', runId: 'run-old', jobId: 'job-quarantined', kind: 'scheduled', state: 'outcome_unknown', executionOutcome: 'unknown', admittedAt: 1, startedAt: 2, endedAt: 3, nominalScheduledAt: 1, scheduleRevision: 1 }
const job = { id: 'job-quarantined', agentId: 'agt-q', logicalKey: 'q', name: 'Q', enabled: true, scheduleRevision: 1, revisionActivatedAtMs: 1, createdAtMs: 1, updatedAtMs: 1, schedule: { kind: 'every', everyMs: 1000, anchorMs: 1 }, payload: { kind: 'agentTurn', message: 'q' }, delivery: { mode: 'none' }, state: {} }
const otherJob = { ...job, id: 'job-other', logicalKey: 'other', agentId: 'agt-other' }
const beforeStore = { version: 3, jobs: [job, otherJob], occurrences: [occurrence], fences: { 'job-quarantined': ['occ-old'] } }
const canaryOccurrence = { occurrenceId: 'occ-canary', runId: 'run-canary', jobId: 'job-canary', kind: 'scheduled', state: 'succeeded', executionOutcome: 'succeeded', admittedAt: 10, startedAt: 11, endedAt: 12, nominalScheduledAt: 10, scheduleRevision: 1 }
const otherOccurrence = { ...canaryOccurrence, occurrenceId: 'occ-other', runId: 'run-other', jobId: otherJob.id }
const afterStore = { ...beforeStore, occurrences: [...beforeStore.occurrences, canaryOccurrence, otherOccurrence] }
const row = { jobId: job.id, state: 'QUARANTINED_UNKNOWN', currentOccurrence: { occurrenceId: 'occ-old', state: 'outcome_unknown' }, currentBlocker: 'OUTCOME_UNKNOWN', blockedSince: 3, fenceReason: 'unresolved outcome_unknown occurrence contribution' }
const healthyRow = { jobId: otherJob.id, state: 'HEALTHY', classification: 'healthy', credentialReadiness: 'READY', currentBlocker: null, fenceReason: null, notificationRoute: { status: 'READY' } }
const health = (at) => ({ complete: true, unknown: 0, enabled: 2, healthy: 1, degraded: 0, blocked: 1, generatedAt: at,
  provenance: { canonicalPair: true, runtime: SOURCE, store: 'b'.repeat(64), routing: 'c'.repeat(64), incidents: 'd'.repeat(64) }, jobs: [row, healthyRow],
  findings: [
    { class: 'ADMISSION_BLOCKED_UNKNOWN', jobId: job.id, occurrenceId: 'occ-old', runId: 'run-old' },
    { class: 'EXPECTED_RUN_MISSED', jobId: job.id, occurrenceId: 'occ-old', runId: 'run-old', derivedUnderAdmissionBlock: true },
  ] })
const incidentState = () => updateIncidentState({}, compileIncidents(health(20).findings).incidents, { nowMs: 20 }).state
const evidence = () => ({ phaseReceipt: { sourceSha: SOURCE, acceptanceStatus: 'PENDING_CANONICAL_HEALTH_AND_CANARY', productionAccepted: false, currentSixAuthorized: false },
  routingReceipt: { status: 'INSTALLED', candidateSha256: 'c'.repeat(64) }, sourceSha: SOURCE,
  routingManifest: { version: 1, canonicalOpsTarget: { channel: 'feishu', to: 'scheduler-ops' }, ownerTargets: {}, jobFailureTargets: {} }, routingManifestSha256: 'c'.repeat(64),
  beforeHealth: health(20), afterHealth: health(30), beforeStore, afterStore, canaryJobId: 'job-canary',
  beforeStoreSha256: 'b'.repeat(64), afterStoreSha256: 'b'.repeat(64),
  beforeIncidentState: incidentState(), afterIncidentState: incidentState(), beforeIncidentSha256: 'd'.repeat(64), afterIncidentSha256: 'd'.repeat(64),
  runReadback: { occurrences: [{ ...canaryOccurrence, result: { final_status: 'PASS', counters: { tool_calls: 0, external_effects: 0 }, notes: `SCHEDULER_NATIVE_NOOP:${SOURCE}` } }],
    events: [{ occurrenceId: 'occ-canary', action: 'router_admission', phase: 'accepted',
    evidence: { executionClass: 'SCHEDULER_NATIVE_NOOP', sourceSha: SOURCE, marker: POSTDEPLOY_CANARY_MARKER, toolCalls: 0, externalEffects: 0 } }] } })

test('formal postdeploy evidence accepts exact health, one canary delta, quarantine isolation and dedupe', () => {
  const receipt = verifyPostdeployEvidence(evidence())
  assert.equal(receipt.status, 'ACCEPTED')
  assert.equal(receipt.currentSixAuthorized, false, 'authorization is minted only for an exact six-occurrence evidence set')
  assert.equal(receipt.canary.occurrenceId, 'occ-canary')
  assert.equal(receipt.quarantine.quarantinedCount, 1)
})

test('cardinality never mints current-six recovery authority', () => {
  const jobs = Array.from({ length: 6 }, (_, index) => ({ ...job, id: `job-${index}`, logicalKey: `q-${index}` }))
  const occurrences = jobs.map((item, index) => ({ ...occurrence, jobId: item.id, occurrenceId: `occ-${index}`, runId: `run-${index}` }))
  const storeBefore = { version: 3, jobs: [...jobs, otherJob], occurrences, fences: Object.fromEntries(occurrences.map((item) => [item.jobId, [item.occurrenceId]])) }
  const rows = occurrences.map((item) => ({ ...row, jobId: item.jobId, currentOccurrence: { occurrenceId: item.occurrenceId, state: 'outcome_unknown' } }))
  const findings = occurrences.flatMap((item) => [
    { class: 'ADMISSION_BLOCKED_UNKNOWN', jobId: item.jobId, occurrenceId: item.occurrenceId, runId: item.runId },
    { class: 'EXPECTED_RUN_MISSED', jobId: item.jobId, occurrenceId: item.occurrenceId, runId: item.runId, derivedUnderAdmissionBlock: true },
  ])
  const healthSix = (at) => ({ ...health(at), enabled: 7, healthy: 1, blocked: 6, jobs: [...rows, healthyRow], findings })
  const sixIncidentState = updateIncidentState({}, compileIncidents(findings).incidents, { nowMs: 20 }).state
  const receipt = verifyPostdeployEvidence({ ...evidence(), beforeStore: storeBefore,
    afterStore: { ...storeBefore, occurrences: [...occurrences, canaryOccurrence, otherOccurrence] }, beforeHealth: healthSix(20), afterHealth: healthSix(30),
    beforeIncidentState: sixIncidentState, afterIncidentState: sixIncidentState })
  assert.equal(receipt.currentSixAuthorized, false)
  assert.equal(receipt.currentSixGate, 'PENDING_EXACT_OWNER_SUFFIX_RESOLUTION')
  assert.deepEqual(receipt.currentSixOccurrences, [])
})

test('formal postdeploy evidence rejects fabricated generation and incomplete health', () => {
  assert.throws(() => verifyPostdeployEvidence({ ...evidence(), sourceSha: 'd'.repeat(40) }), /pending deployed generation/)
  assert.throws(() => verifyPostdeployEvidence({ ...evidence(), afterHealth: { ...health(30), complete: false } }), /incomplete or unknown/)
})

test('formal postdeploy rejects an attempted notification relabeled PENDING', () => {
  const candidate = evidence()
  const key = Object.keys(candidate.beforeIncidentState.outbox)[0]
  const bound = bindNotificationDelivery(candidate.beforeIncidentState, key, {
    producer: candidate.beforeIncidentState.outbox[key].producer, route: { channel: 'feishu', to: 'scheduler-ops' },
    routeSource: 'canonicalOpsTarget', routingSha256: candidate.routingManifestSha256,
    payload: stableNotificationText(candidate.beforeIncidentState.outbox[key]), providerKey: providerIdempotencyKey(key),
  }, 20)
  const regressed = markNotificationDelivery(bound, key, 'OUTCOME_UNKNOWN', 20)
  regressed.outbox[key].delivery = 'PENDING'
  regressed.incidents[regressed.outbox[key].incident.rootIdentity].alertState.delivery = 'PENDING'
  candidate.beforeIncidentState = regressed
  assert.throws(() => verifyPostdeployEvidence(candidate), /delivery chronology/)
})

test('formal postdeploy evidence rejects unexpected store mutation or duplicate incident roots', () => {
  const changed = structuredClone(afterStore); changed.jobs[0].enabled = false
  assert.throws(() => verifyPostdeployEvidence({ ...evidence(), afterStore: changed }), /Job definitions changed unexpectedly/)
  const duplicated = health(30)
  duplicated.findings[1] = { ...duplicated.findings[1], derivedUnderAdmissionBlock: false, jobRevision: 1 }
  assert.throws(() => verifyPostdeployEvidence({ ...evidence(), afterHealth: duplicated }), /one-per-occurrence/)
})

test('formal postdeploy evidence rejects route drift, synthetic incident state, unsafe canary and unrelated Job regression', () => {
  assert.throws(() => verifyPostdeployEvidence({ ...evidence(), routingReceipt: { status: 'INSTALLED', candidateSha256: 'e'.repeat(64) } }), /routing generation/)
  assert.throws(() => verifyPostdeployEvidence({ ...evidence(), beforeIncidentState: { version: 1, incidents: {}, outbox: {} } }), /lacks exact open root/)
  const missingOutbox = evidence(); missingOutbox.beforeIncidentState = structuredClone(missingOutbox.beforeIncidentState)
  missingOutbox.beforeIncidentState.outbox = {}
  assert.throws(() => verifyPostdeployEvidence(missingOutbox), /lacks current outbox/)
  const missingDelivery = evidence(); missingDelivery.beforeIncidentState = structuredClone(missingDelivery.beforeIncidentState)
  const missingRecord = Object.values(missingDelivery.beforeIncidentState.incidents)[0]
  const missingIntent = Object.values(missingDelivery.beforeIncidentState.outbox)[0]
  delete missingRecord.alertState.delivery; delete missingIntent.delivery
  assert.throws(() => verifyPostdeployEvidence(missingDelivery), /incoherent incident/)
  const forgedMigration = evidence(); forgedMigration.beforeIncidentState = structuredClone(forgedMigration.beforeIncidentState)
  forgedMigration.beforeIncidentState.migration = { legacySha256: 'a'.repeat(64), evidenceSha256: 'b'.repeat(64), factsSha256: 'c'.repeat(64) }
  forgedMigration.incidentMigrationAuthority = { legacySha256: 'd'.repeat(64), evidenceSha256: 'e'.repeat(64), factsSha256: 'f'.repeat(64) }
  const forgedKey = Object.keys(forgedMigration.beforeIncidentState.outbox)[0]
  delete forgedMigration.beforeIncidentState.outbox[forgedKey]
  Object.values(forgedMigration.beforeIncidentState.incidents)[0].alertState.delivery = 'DELIVERED'
  assert.throws(() => verifyPostdeployEvidence(forgedMigration), /migration authority mismatch/)
  const attempted = evidence(); attempted.afterIncidentState = structuredClone(attempted.afterIncidentState)
  const [outboxKey] = Object.keys(attempted.afterIncidentState.outbox)
  attempted.afterIncidentState.outbox[outboxKey].delivery = 'FAILED'
  attempted.afterIncidentState.incidents[Object.keys(attempted.afterIncidentState.incidents)[0]].alertState.delivery = 'FAILED'
  assert.throws(() => verifyPostdeployEvidence(attempted), /notification attempt surface/)
  const unsafe = evidence(); unsafe.runReadback.occurrences[0].result.counters.external_effects = 1
  assert.throws(() => verifyPostdeployEvidence(unsafe), /zero-side-effect/)
  const noUnrelated = evidence(); noUnrelated.afterStore = { ...afterStore, occurrences: [occurrence, canaryOccurrence] }
  assert.throws(() => verifyPostdeployEvidence(noUnrelated), /one successful canary/)
  const fenceBypass = evidence()
  fenceBypass.afterStore = { ...afterStore, occurrences: [occurrence, canaryOccurrence,
    { ...otherOccurrence, jobId: job.id, occurrenceId: 'occ-forbidden', runId: 'run-forbidden' }] }
  assert.throws(() => verifyPostdeployEvidence(fenceBypass), /fenced or quarantined Job/)
  const regressed = evidence(); regressed.beforeHealth.jobs.push({ jobId: 'job-ok', classification: 'healthy', credentialReadiness: 'READY', currentBlocker: null, fenceReason: null, notificationRoute: { status: 'READY' } })
  regressed.afterHealth.jobs.push({ jobId: 'job-ok', classification: 'blocked', credentialReadiness: 'READY', currentBlocker: 'OUTCOME_UNKNOWN', fenceReason: 'new', notificationRoute: { status: 'READY' } })
  regressed.beforeHealth.enabled += 1; regressed.beforeHealth.healthy += 1
  regressed.afterHealth.enabled += 1; regressed.afterHealth.blocked += 1
  assert.throws(() => verifyPostdeployEvidence(regressed), /health regressed/)
})

test('one quarantined Job does not prevent an unrelated healthy Job from completing during canary', () => {
  const proof = evidence()
  proof.afterStore = { ...afterStore, jobs: [job, { ...otherJob, state: { nextRunAtMs: 200, lastOutcome: 'succeeded' } }] }
  assert.equal(verifyPostdeployEvidence(proof).status, 'ACCEPTED')
})

test('passive dedupe proof tolerates advancing overdueMs without changing root or notification attempt', () => {
  const proof = evidence()
  const beforeExpected = proof.beforeHealth.findings.find((fact) => fact.class === 'EXPECTED_RUN_MISSED')
  beforeExpected.dueAt = '2026-09-14T00:00:00.000Z'; beforeExpected.overdueMs = 10
  proof.afterHealth = structuredClone(proof.beforeHealth); proof.afterHealth.generatedAt = 30
  proof.afterHealth.findings.find((fact) => fact.class === 'EXPECTED_RUN_MISSED').overdueMs = 20
  const durable = updateIncidentState({}, compileIncidents(proof.beforeHealth.findings).incidents, { nowMs: 20 }).state
  const [root] = Object.keys(durable.incidents)
  const missed = durable.incidents[root].facts.find((fact) => fact.class === 'EXPECTED_RUN_MISSED')
  durable.incidents[root].facts.push({ ...missed, overdueMs: 20 })
  proof.beforeIncidentState = durable; proof.afterIncidentState = structuredClone(durable)
  assert.equal(verifyPostdeployEvidence(proof).status, 'ACCEPTED')
})

test('interrupted or non-exact receipt publication cannot return acceptance', () => {
  assert.throws(() => publishVerifiedPostdeployReceipt(evidence(), { writeReceipt: () => { throw new Error('interrupted') }, readReceipt: () => assert.fail() }), /interrupted/)
  assert.throws(() => publishVerifiedPostdeployReceipt(evidence(), { writeReceipt: () => {}, readReceipt: () => ({ status: 'PENDING' }) }), /publication\/readback mismatch/)
})
