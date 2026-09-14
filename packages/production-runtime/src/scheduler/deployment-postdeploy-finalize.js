import { createHash } from 'node:crypto'

import { canonicalJSON } from '../../../scheduler/src/occurrence-model.js'
import { compileIncidents } from '../../../scheduler/src/watchdog/incident-compiler.js'
import { notificationKey, updateIncidentState } from '../../../scheduler/src/watchdog/incident-lifecycle.js'
import { validateIncidentState } from '../../../scheduler/src/watchdog/durable-state.js'
import { POSTDEPLOY_CANARY_MARKER } from './deployment-canary-control.js'

const digest = (value) => createHash('sha256').update(typeof value === 'string' ? value : canonicalJSON(value)).digest('hex')
const exact = (left, right, label) => {
  if (canonicalJSON(left) !== canonicalJSON(right)) throw new Error(`postdeploy ${label} changed unexpectedly`)
}

export function assertCanonicalPostdeployHealth(health, sourceSha) {
  if (health?.complete !== true || health.unknown !== 0) throw new Error('postdeploy canonical health is incomplete or unknown')
  if (![health.enabled, health.healthy, health.degraded, health.blocked].every(Number.isSafeInteger)
    || health.enabled !== health.healthy + health.degraded + health.blocked) throw new Error('postdeploy health count equation failed')
  if (health.provenance?.canonicalPair !== true || health.provenance.runtime !== sourceSha
    || !/^[0-9a-f]{64}$/.test(health.provenance.store ?? '')
    || !/^[0-9a-f]{64}$/.test(health.provenance.routing ?? '')
    || !/^[0-9a-f]{64}$/.test(health.provenance.incidents ?? '')) {
    throw new Error('postdeploy health provenance is not bound to the deployed generation')
  }
  return health
}

function canaryRows(runReadback, canaryJobId) {
  const rows = runReadback?.runs ?? runReadback?.occurrences ?? []
  return rows.filter((row) => (row.job_id ?? row.jobId) === canaryJobId)
}

export function assertSuccessfulCanaryRun(runReadback, canaryJobId, sourceSha) {
  const rows = canaryRows(runReadback, canaryJobId)
  if (rows.length !== 1 || (rows[0].outcome ?? rows[0].state ?? rows[0].executionOutcome) !== 'succeeded'
    || (rows[0].ended_at == null && !Number.isFinite(rows[0].endedAt))) {
    throw new Error('postdeploy run readback does not prove exactly one successful canary occurrence')
  }
  const occurrenceId = rows[0].occurrenceId ?? rows[0].occurrence_id
  const durableResult = rows[0].result
  const evidence = (runReadback.events ?? []).find((event) => (event.occurrenceId ?? event.occurrence_id) === occurrenceId
    && event.action === 'router_admission' && event.phase === 'accepted')?.evidence
  const durableProof = durableResult?.final_status === 'PASS' && durableResult?.counters?.tool_calls === 0
    && durableResult?.counters?.external_effects === 0 && durableResult?.notes === `SCHEDULER_NATIVE_NOOP:${sourceSha}`
  const eventProof = evidence?.executionClass === 'SCHEDULER_NATIVE_NOOP' && evidence?.toolCalls === 0
    && evidence?.externalEffects === 0 && evidence?.marker === POSTDEPLOY_CANARY_MARKER && evidence?.sourceSha === sourceSha
  if (!durableProof || ((runReadback.events ?? []).length > 0 && !eventProof)) {
    throw new Error('postdeploy canary lacks mechanical zero-side-effect evidence')
  }
  return rows[0]
}

export function assertCanaryStoreDelta({ beforeStore, afterStore, beforeHealth, afterHealth, canaryJobId, runReadback, sourceSha }) {
  if (!beforeStore || !afterStore || beforeStore.version !== 3 || afterStore.version !== 3) throw new Error('postdeploy store snapshots must be V3')
  if (beforeStore.jobs.some((job) => job.id === canaryJobId) || afterStore.jobs.some((job) => job.id === canaryJobId)) throw new Error('postdeploy canary Job was not disposable')
  const stableJob = ({ state: _state, ...value }) => value
  exact(beforeStore.jobs.map(stableJob), afterStore.jobs.map(stableJob), 'non-canary Job definitions')
  exact(beforeStore.fences, afterStore.fences, 'same-Job fences')
  const beforeIds = new Set(beforeStore.occurrences.map((row) => row.occurrenceId))
  exact(beforeStore.occurrences, afterStore.occurrences.filter((row) => beforeIds.has(row.occurrenceId)), 'pre-existing occurrences')
  const appended = afterStore.occurrences.filter((row) => !beforeIds.has(row.occurrenceId))
  const canaries = appended.filter((row) => row.jobId === canaryJobId)
  const preexistingJobs = new Set(beforeStore.jobs.map((job) => job.id))
  const healthByJob = (health) => new Map(health.jobs.map((row) => [row.jobId, row]))
  const beforeRows = healthByJob(beforeHealth)
  const afterRows = healthByJob(afterHealth)
  const fencedJobs = new Set([
    ...Object.entries(beforeStore.fences ?? {}).filter(([, ids]) => ids.length > 0).map(([jobId]) => jobId),
    ...Object.entries(afterStore.fences ?? {}).filter(([, ids]) => ids.length > 0).map(([jobId]) => jobId),
  ])
  const quarantinedJobs = new Set([...preexistingJobs].filter((jobId) => beforeRows.get(jobId)?.state === 'QUARANTINED_UNKNOWN'
    || afterRows.get(jobId)?.state === 'QUARANTINED_UNKNOWN'))
  const forbiddenJobs = new Set([...fencedJobs, ...quarantinedJobs])
  if (appended.some((row) => forbiddenJobs.has(row.jobId))) {
    throw new Error('postdeploy store delta contains an occurrence for a fenced or quarantined Job')
  }
  const unrelated = appended.filter((row) => row.jobId !== canaryJobId && preexistingJobs.has(row.jobId)
    && beforeRows.get(row.jobId)?.classification === 'healthy' && afterRows.get(row.jobId)?.classification === 'healthy')
  if (canaries.length !== 1 || unrelated.length < 1 || canaries[0].state !== 'succeeded'
    || canaries[0].executionOutcome !== 'succeeded' || !Number.isFinite(canaries[0].endedAt)
    || unrelated.some((row) => !preexistingJobs.has(row.jobId) || row.state !== 'succeeded'
      || row.executionOutcome !== 'succeeded' || !Number.isFinite(row.endedAt))) {
    throw new Error('postdeploy store delta is not exactly one successful canary occurrence')
  }
  assertSuccessfulCanaryRun(runReadback, canaryJobId, sourceSha)
  return canaries[0]
}

export function assertQuarantineIsolationAndDedupe(beforeHealth, afterHealth) {
  const severity = { healthy: 0, degraded: 1, blocked: 2, unknown: 3 }
  for (const before of beforeHealth.jobs) {
    const after = afterHealth.jobs.find((row) => row.jobId === before.jobId)
    if (!after) throw new Error(`pre-existing Job disappeared during canary: ${before.jobId}`)
    if ((severity[after.classification] ?? 4) > (severity[before.classification] ?? 4)) throw new Error(`unrelated Job health regressed during canary: ${before.jobId}`)
    exact({ credentialReadiness: before.credentialReadiness, currentBlocker: before.currentBlocker,
      fenceReason: before.fenceReason, notificationRoute: before.notificationRoute },
    { credentialReadiness: after.credentialReadiness, currentBlocker: after.currentBlocker,
      fenceReason: after.fenceReason, notificationRoute: after.notificationRoute }, `admission surface ${before.jobId}`)
  }
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
  return { quarantinedCount: quarantined.length, rootIdentities: compiled.map((item) => item.rootIdentity), incidents: compiled }
}

export function assertIncidentDedupeFromDurableState({ incidentState, compiledIncidents, nowMs }) {
  validateIncidentState(incidentState)
  const roots = new Set(compiledIncidents.map((item) => item.rootIdentity))
  const proof = {}
  for (const expected of compiledIncidents) {
    const root = expected.rootIdentity
    const record = incidentState?.incidents?.[root]
    if (!record || record.lifecycle !== 'OPEN' || record.rootCauseClass !== 'RUN_STUCK_OUTCOME_UNKNOWN') {
      throw new Error(`durable incident state lacks exact open root: ${root}`)
    }
    exact({ rootIdentity: record.rootIdentity, rootCauseClass: record.rootCauseClass, routeClass: record.routeClass,
      facts: record.facts, symptoms: record.symptoms },
    { rootIdentity: expected.rootIdentity, rootCauseClass: expected.rootCauseClass, routeClass: expected.routeClass,
      facts: expected.facts, symptoms: expected.symptoms }, `durable incident payload ${root}`)
    if (!Number.isSafeInteger(record.episode) || record.episode < 1 || !Number.isSafeInteger(record.transitionRevision)
      || record.transitionRevision < 1 || record.incidentId !== `${root}|episode:${record.episode}`
      || record.alertState?.lifecycle !== 'OPEN' || record.alertState?.incidentKey !== root) throw new Error(`durable incident episode is incoherent: ${root}`)
    const entries = Object.entries(incidentState.outbox ?? {}).filter(([, intent]) => intent.incidentId === record.incidentId)
    if (entries.length === 0) {
      if (record.alertState.delivery !== 'DELIVERED' || incidentState.migration === undefined) throw new Error(`durable incident lacks required outbox intent: ${root}`)
    } else {
      if (entries.length !== 1) throw new Error(`durable incident has duplicate outbox intents: ${root}`)
      const [key, intent] = entries[0]
      if (key !== notificationKey(intent) || intent.notificationKey !== key || intent.transitionKind !== 'OPEN'
        || intent.transitionRevision !== record.transitionRevision || intent.routeClass !== record.routeClass
        || intent.producer !== record.producer || intent.incident?.rootIdentity !== root
        || (intent.delivery !== record.alertState.delivery
          && !(incidentState.migration !== undefined && record.alertState.delivery === 'FAILED' && intent.delivery === 'PENDING'))) {
        throw new Error(`durable incident outbox binding is incoherent: ${root}`)
      }
    }
    proof[root] = { episode: record.episode, incidentId: record.incidentId, transitionRevision: record.transitionRevision,
      alertState: record.alertState, outbox: entries }
  }
  const replay = updateIncidentState(incidentState, compiledIncidents, { nowMs, ownsIncident: (record) => roots.has(record.rootIdentity) })
  if (replay.notifications.length !== 0) throw new Error('durable incident replay is not deduplicated')
  return proof
}

export function verifyPostdeployEvidence({ phaseReceipt, routingReceipt, sourceSha, beforeHealth, afterHealth, beforeStore, afterStore,
  beforeStoreSha256, afterStoreSha256, beforeIncidentState, afterIncidentState, beforeIncidentSha256, afterIncidentSha256, canaryJobId, runReadback }) {
  if (phaseReceipt?.sourceSha !== sourceSha || phaseReceipt?.acceptanceStatus !== 'PENDING_CANONICAL_HEALTH_AND_CANARY'
    || phaseReceipt.productionAccepted !== false || phaseReceipt.currentSixAuthorized !== false) throw new Error('postdeploy phase receipt is not the pending deployed generation')
  assertCanonicalPostdeployHealth(beforeHealth, sourceSha)
  assertCanonicalPostdeployHealth(afterHealth, sourceSha)
  if (routingReceipt?.status !== 'INSTALLED' || routingReceipt.candidateSha256 !== beforeHealth.provenance.routing
    || routingReceipt.candidateSha256 !== afterHealth.provenance.routing) throw new Error('postdeploy routing generation is not bound to install receipt')
  if (beforeHealth.provenance.store !== beforeStoreSha256 || afterHealth.provenance.store !== afterStoreSha256) throw new Error('postdeploy API/store generation binding mismatch')
  if (beforeHealth.provenance.incidents !== beforeIncidentSha256 || afterHealth.provenance.incidents !== afterIncidentSha256) throw new Error('postdeploy API/incident generation binding mismatch')
  const occurrence = assertCanaryStoreDelta({ beforeStore, afterStore, beforeHealth, afterHealth, canaryJobId, runReadback, sourceSha })
  const isolation = assertQuarantineIsolationAndDedupe(beforeHealth, afterHealth)
  const beforeIncidentProof = assertIncidentDedupeFromDurableState({ incidentState: beforeIncidentState, compiledIncidents: isolation.incidents, nowMs: beforeHealth.generatedAt + 1 })
  const afterIncidentProof = assertIncidentDedupeFromDurableState({ incidentState: afterIncidentState, compiledIncidents: isolation.incidents, nowMs: afterHealth.generatedAt + 1 })
  exact(beforeIncidentProof, afterIncidentProof, 'incident notification attempt surface')
  return {
    status: 'ACCEPTED', sourceSha, productionAccepted: true, currentSixAuthorized: false,
    currentSixGate: 'PENDING_EXACT_OWNER_SUFFIX_RESOLUTION', currentSixOccurrences: [],
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
