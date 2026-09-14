import { createHash } from 'node:crypto'

import { canonicalJSON } from '../../../scheduler/src/occurrence-model.js'
import { compileIncidents } from '../../../scheduler/src/watchdog/incident-compiler.js'
import { updateIncidentState } from '../../../scheduler/src/watchdog/incident-lifecycle.js'

const digest = (value) => createHash('sha256').update(typeof value === 'string' ? value : canonicalJSON(value)).digest('hex')
const exact = (left, right, label) => {
  if (canonicalJSON(left) !== canonicalJSON(right)) throw new Error(`postdeploy ${label} changed unexpectedly`)
}

export function assertCanonicalPostdeployHealth(health, sourceSha) {
  if (health?.complete !== true || health.unknown !== 0) throw new Error('postdeploy canonical health is incomplete or unknown')
  if (![health.enabled, health.healthy, health.degraded, health.blocked].every(Number.isSafeInteger)
    || health.enabled !== health.healthy + health.degraded + health.blocked) throw new Error('postdeploy health count equation failed')
  if (health.provenance?.canonicalPair !== true || health.provenance.runtime !== sourceSha
    || !/^[0-9a-f]{64}$/.test(health.provenance.store ?? '') || !/^[0-9a-f]{64}$/.test(health.provenance.routing ?? '')) {
    throw new Error('postdeploy health provenance is not bound to the deployed generation')
  }
  return health
}

function canaryRows(runReadback, canaryJobId) {
  const rows = runReadback?.runs ?? runReadback?.occurrences ?? []
  return rows.filter((row) => (row.job_id ?? row.jobId) === canaryJobId)
}

export function assertSuccessfulCanaryRun(runReadback, canaryJobId) {
  const rows = canaryRows(runReadback, canaryJobId)
  if (rows.length !== 1 || (rows[0].outcome ?? rows[0].state ?? rows[0].executionOutcome) !== 'succeeded'
    || (rows[0].ended_at == null && !Number.isFinite(rows[0].endedAt))) {
    throw new Error('postdeploy run readback does not prove exactly one successful canary occurrence')
  }
  return rows[0]
}

export function assertCanaryStoreDelta({ beforeStore, afterStore, canaryJobId, runReadback }) {
  if (!beforeStore || !afterStore || beforeStore.version !== 3 || afterStore.version !== 3) throw new Error('postdeploy store snapshots must be V3')
  if (beforeStore.jobs.some((job) => job.id === canaryJobId) || afterStore.jobs.some((job) => job.id === canaryJobId)) throw new Error('postdeploy canary Job was not disposable')
  exact(beforeStore.jobs, afterStore.jobs, 'non-canary Jobs')
  exact(beforeStore.fences, afterStore.fences, 'same-Job fences')
  const beforeIds = new Set(beforeStore.occurrences.map((row) => row.occurrenceId))
  const preserved = afterStore.occurrences.filter((row) => beforeIds.has(row.occurrenceId))
  exact(beforeStore.occurrences, preserved, 'pre-existing occurrences')
  const appended = afterStore.occurrences.filter((row) => !beforeIds.has(row.occurrenceId))
  if (appended.length !== 1 || appended[0].jobId !== canaryJobId
    || appended[0].state !== 'succeeded' || appended[0].executionOutcome !== 'succeeded'
    || !Number.isFinite(appended[0].endedAt)) throw new Error('postdeploy store delta is not exactly one successful canary occurrence')
  assertSuccessfulCanaryRun(runReadback, canaryJobId)
  return appended[0]
}

export function assertQuarantineIsolationAndDedupe(beforeHealth, afterHealth) {
  const quarantined = beforeHealth.jobs.filter((row) => row.state === 'QUARANTINED_UNKNOWN')
  for (const before of quarantined) {
    const after = afterHealth.jobs.find((row) => row.jobId === before.jobId)
    if (!after || after.state !== 'QUARANTINED_UNKNOWN') throw new Error(`quarantine changed during canary: ${before.jobId}`)
    exact({ occurrence: before.currentOccurrence, blocker: before.currentBlocker, since: before.blockedSince, reason: before.fenceReason },
      { occurrence: after.currentOccurrence, blocker: after.currentBlocker, since: after.blockedSince, reason: after.fenceReason }, `quarantine ${before.jobId}`)
  }
  const relevant = afterHealth.findings.filter((fact) => quarantined.some((row) => row.jobId === fact.jobId
    && row.currentOccurrence?.occurrenceId === (fact.occurrenceId ?? fact.runId))
    && ['ADMISSION_BLOCKED_UNKNOWN', 'EXPECTED_RUN_MISSED'].includes(fact.class))
  const compiled = compileIncidents(relevant).incidents
  if (compiled.length !== quarantined.length || compiled.some((incident) => incident.rootCauseClass !== 'RUN_STUCK_OUTCOME_UNKNOWN')) {
    throw new Error('postdeploy unknown root-cause incident compilation is not one-per-occurrence')
  }
  const first = updateIncidentState({}, compiled, { nowMs: afterHealth.generatedAt })
  const replay = updateIncidentState(first.state, compiled, { nowMs: afterHealth.generatedAt + 1 })
  if (first.notifications.length !== quarantined.length || replay.notifications.length !== 0) throw new Error('postdeploy incident replay is not deduplicated')
  return { quarantinedCount: quarantined.length, rootIdentities: compiled.map((item) => item.rootIdentity) }
}

export function verifyPostdeployEvidence({ phaseReceipt, sourceSha, beforeHealth, afterHealth, beforeStore, afterStore, beforeStoreSha256, afterStoreSha256, canaryJobId, runReadback }) {
  if (phaseReceipt?.sourceSha !== sourceSha || phaseReceipt?.acceptanceStatus !== 'PENDING_CANONICAL_HEALTH_AND_CANARY'
    || phaseReceipt.productionAccepted !== false || phaseReceipt.currentSixAuthorized !== false) throw new Error('postdeploy phase receipt is not the pending deployed generation')
  assertCanonicalPostdeployHealth(beforeHealth, sourceSha)
  assertCanonicalPostdeployHealth(afterHealth, sourceSha)
  if (beforeHealth.provenance.store !== beforeStoreSha256 || afterHealth.provenance.store !== afterStoreSha256) throw new Error('postdeploy API/store generation binding mismatch')
  const occurrence = assertCanaryStoreDelta({ beforeStore, afterStore, canaryJobId, runReadback })
  const isolation = assertQuarantineIsolationAndDedupe(beforeHealth, afterHealth)
  return {
    status: 'ACCEPTED', sourceSha, productionAccepted: true, currentSixAuthorized: isolation.quarantinedCount === 6,
    currentSixOccurrences: isolation.rootIdentities.map((rootIdentity) => rootIdentity.split('|').at(-1)),
    acceptedAt: new Date(afterHealth.generatedAt).toISOString(), canary: { jobId: canaryJobId, occurrenceId: occurrence.occurrenceId },
    health: { beforeSha256: digest(beforeHealth), afterSha256: digest(afterHealth), enabled: afterHealth.enabled,
      healthy: afterHealth.healthy, degraded: afterHealth.degraded, blocked: afterHealth.blocked },
    quarantine: isolation,
  }
}

export function publishVerifiedPostdeployReceipt(evidence, { writeReceipt, readReceipt }) {
  const receipt = verifyPostdeployEvidence(evidence)
  writeReceipt(receipt)
  const readback = readReceipt()
  if (digest(readback) !== digest(receipt)) throw new Error('postdeploy acceptance receipt publication/readback mismatch')
  return receipt
}
