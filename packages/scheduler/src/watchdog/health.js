import { canonicalJSON, rebuildFences, validateOccurrenceRecord } from '../occurrence-model.js'
import { latestTerminalOccurrence } from '../eligibility.js'
import { computeNextRunAtMs, MIN_REFIRE_GAP_MS } from '../schedule.js'
import { normalizeJob } from '../job-model.js'

function generationsComplete(generations) {
  return Array.isArray(generations) && generations.length > 0
    && generations.every((item) => item?.trusted === true && item.captured !== false && item.start != null && item.start === item.end)
}

function latest(records, predicate, field) {
  const values = records.filter(predicate).map((item) => item[field]).filter(Number.isFinite)
  return values.length ? Math.max(...values) : null
}

function lastOutcome(records) {
  const terminal = records.filter((item) => Number.isFinite(item.endedAt)).sort((a, b) => b.endedAt - a.endedAt)[0]
  return terminal?.executionOutcome ?? terminal?.state ?? null
}

function lastReconciliation(records) {
  const values = records.flatMap((item) => [item.lastReconciliationAt, item.lateSettlement?.resolvedAt, item.terminationSettlement?.settledAt]).filter(Number.isFinite)
  return values.length ? Math.max(...values) : null
}

function alertForJob(incidents, jobId) {
  const values = Object.values(incidents ?? {}).filter((incident) => incident.jobId === jobId)
  const current = values.sort((a, b) => (b.alertState?.lastTransitionAt ?? 0) - (a.alertState?.lastTransitionAt ?? 0))[0]
  return current?.alertState ?? { lifecycle: 'CLOSED_RECOVERED', delivery: 'DELIVERED', incidentKey: null, lastTransitionAt: null }
}

function scheduleReady(job, nowMs) {
  try { return computeNextRunAtMs(job.schedule, nowMs, { jobId: job.id, fallbackAnchorMs: job.createdAtMs ?? nowMs }) !== undefined }
  catch { return false }
}

function fenceProjectionValid(snapshot) {
  if (snapshot.fences === null || typeof snapshot.fences !== 'object' || Array.isArray(snapshot.fences)) return false
  try { return canonicalJSON(snapshot.fences) === canonicalJSON(rebuildFences(snapshot.occurrences ?? [])) } catch { return false }
}

function canonicalJobFindings(job, records, snapshot) {
  const findings = []
  const base = { jobId: job.id, logicalKey: job.logicalKey, agentId: job.agentId, jobRevision: job.scheduleRevision }
  const unresolved = records.filter((item) => item.state === 'outcome_unknown' && item.terminationSettlement === undefined)
  for (const record of records) {
    if (record.executionOutcome === 'failed' && Number.isFinite(record.endedAt)) {
      findings.push({
        class: 'RUN_FAILED', jobId: job.id, runId: record.runId, occurrenceId: record.occurrenceId, endedAt: new Date(record.endedAt).toISOString(),
        ...(record.lateSettlement?.basis === 'operator-reconcile' ? { disposition: {
          basis: 'operator-reconcile', resolvedTo: record.lateSettlement.resolvedTo ?? null, resolvedAt: record.lateSettlement.resolvedAt ?? null,
        } } : {}),
      })
    }
    if (Number.isFinite(record.startedAt) && !Number.isFinite(record.endedAt)
      && Number.isFinite(record.executionDeadlineAtMs) && snapshot.generatedAt > record.executionDeadlineAtMs) {
      findings.push({ class: 'RUN_STUCK', jobId: job.id, runId: record.runId, occurrenceId: record.occurrenceId, startedAt: new Date(record.startedAt).toISOString() })
    }
    if (record.state === 'outcome_unknown' && record.terminationSettlement === undefined) findings.push({ class: 'ADMISSION_BLOCKED_UNKNOWN', jobId: job.id, runId: record.runId, occurrenceId: record.occurrenceId })
  }
  if (Number.isFinite(job.state?.consecutiveErrors) && job.state.consecutiveErrors >= 2) {
    findings.push({ class: 'CONSECUTIVE_FAILURE', ...base, consecutiveErrors: job.state.consecutiveErrors })
  }
  const graceMs = (job.runPolicy?.graceMinutes ?? 30) * 60 * 1000
  let expectedAt = job.state?.nextRunAtMs
  if (!Number.isFinite(expectedAt)) {
    const terminal = latestTerminalOccurrence(snapshot.occurrences ?? [], job.id)
    const activation = Number.isFinite(job.revisionActivatedAtMs) ? job.revisionActivatedAtMs : job.createdAtMs
    const reference = terminal ? Math.max((terminal.endedAt ?? terminal.admittedAt) + MIN_REFIRE_GAP_MS, activation) : activation
    expectedAt = Number.isFinite(reference)
      ? computeNextRunAtMs(job.schedule, reference, { jobId: job.id, fallbackAnchorMs: job.createdAtMs }) : undefined
  }
  if (Number.isFinite(expectedAt) && snapshot.generatedAt - expectedAt > graceMs) {
    const targets = unresolved.length ? unresolved : [null]
    for (const blocker of targets) findings.push({
      class: 'EXPECTED_RUN_MISSED', ...base,
      ...(blocker ? { occurrenceId: blocker.occurrenceId, runId: blocker.runId, derivedUnderAdmissionBlock: true } : {}),
      dueAt: new Date(expectedAt).toISOString(), overdueMs: snapshot.generatedAt - expectedAt,
    })
  }
  return findings
}

export function validateCanonicalHealthAuthority(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || snapshot.version !== 3 || !Array.isArray(snapshot.jobs)
    || !Array.isArray(snapshot.occurrences) || snapshot.fences === null
    || typeof snapshot.fences !== 'object' || Array.isArray(snapshot.fences)) {
    throw new TypeError('canonical health authority document has an invalid shape')
  }
  const jobIds = new Set()
  const logicalKeys = new Set()
  for (const job of snapshot.jobs) {
    if (!job || typeof job !== 'object' || Array.isArray(job) || typeof job.id !== 'string' || job.id === ''
      || typeof job.enabled !== 'boolean' || !Number.isSafeInteger(job.scheduleRevision)
      || !Number.isFinite(job.createdAtMs) || !Number.isFinite(job.updatedAtMs)
      || !Number.isFinite(job.revisionActivatedAtMs)) throw new TypeError('canonical health authority has malformed Job record')
    normalizeJob(job, { id: job.id, createdAtMs: job.createdAtMs, nowMs: job.updatedAtMs })
    if (jobIds.has(job.id)) throw new TypeError('canonical health authority has duplicate jobId')
    jobIds.add(job.id)
    if (job.logicalKey !== undefined) {
      if (logicalKeys.has(job.logicalKey)) throw new TypeError('canonical health authority has duplicate logicalKey')
      logicalKeys.add(job.logicalKey)
    }
  }
  const occurrenceIds = new Set()
  for (const occurrence of snapshot.occurrences) {
    validateOccurrenceRecord(occurrence)
    if (occurrenceIds.has(occurrence.occurrenceId)) throw new TypeError('canonical health authority has duplicate occurrenceId')
    occurrenceIds.add(occurrence.occurrenceId)
  }
  if (!fenceProjectionValid(snapshot)) throw new TypeError('canonical health authority fence projection mismatch')
  return snapshot
}

function projectRow(job, snapshot, complete) {
  const records = (snapshot.occurrences ?? []).filter((item) => item.jobId === job.id)
  const unresolved = records.filter((item) => item.state === 'outcome_unknown' && item.terminationSettlement === undefined)
  const current = [...records].sort((a, b) => (b.admittedAt ?? b.startedAt ?? 0) - (a.admittedAt ?? a.startedAt ?? 0))[0] ?? null
  const credentialReady = snapshot.credentials?.[job.agentId] === true
  const routeState = snapshot.routes?.[job.id] ?? snapshot.routes?.[job.logicalKey] ?? { ready: false }
  const routeHealthy = routeState.ready === true && (routeState.status === undefined || routeState.status === 'READY')
  const findings = canonicalJobFindings(job, records, snapshot)
  let classification = 'healthy'
  let state = 'HEALTHY'
  if (!complete) {
    classification = 'unknown'; state = 'UNKNOWN'
  } else if (unresolved.length > 0 || !credentialReady) {
    classification = 'blocked'; state = unresolved.length > 0 ? 'QUARANTINED_UNKNOWN' : 'BLOCKED'
  } else if (!routeHealthy || !scheduleReady(job, snapshot.generatedAt) || findings.length > 0 || snapshot.runtimeHealth?.healthOk === false) {
    classification = 'degraded'; state = 'DEGRADED'
  }
  const blockedSinceMs = unresolved.length
    ? Math.min(...unresolved.map((item) => item.endedAt ?? item.startedAt ?? item.admittedAt ?? snapshot.generatedAt))
    : null
  const lastReconciliationAt = lastReconciliation(records)
  return {
    jobId: job.id, agentId: job.agentId, logicalKey: job.logicalKey, health: classification.toUpperCase(), classification, state,
    lastExpectedAt: job.state?.lastExpectedAtMs ?? latest(records, () => true, 'scheduledAt'),
    lastStartAt: latest(records, () => true, 'startedAt'),
    lastFinishAt: latest(records, () => true, 'endedAt'),
    lastSuccessAt: latest(records, (item) => item.executionOutcome === 'succeeded' || item.state === 'succeeded', 'endedAt'),
    lastOutcome: lastOutcome(records),
    currentOccurrence: current ? { occurrenceId: current.occurrenceId, state: current.state } : null,
    currentBlocker: unresolved.length ? 'OUTCOME_UNKNOWN' : (!credentialReady ? 'CREDENTIAL_UNAVAILABLE' : null),
    blockedAgeMs: blockedSinceMs === null ? null : Math.max(0, snapshot.generatedAt - blockedSinceMs),
    credentialReadiness: credentialReady ? 'READY' : 'MISSING',
    nextExpectedAt: job.state?.nextRunAtMs ?? null,
    notificationRoute: {
      class: routeState.class ?? 'JOB_FAILURE',
      source: routeState.source ?? 'local_ops_sink',
      status: routeState.status ?? (routeState.ready === true ? 'READY' : 'CONFIG_MISSING'),
      targetRef: routeState.targetRef ?? null,
    },
    runtime: snapshot.provenance?.runtime ?? null,
    store: snapshot.provenance?.store ?? null,
    blockedSince: blockedSinceMs,
    lastReconciliationAt,
    lastKnownExecutionEvidence: current ? { source: 'occurrence-store', observedAt: current.endedAt ?? current.startedAt ?? current.admittedAt ?? null, state: current.state } : null,
    fenceReason: unresolved.length ? 'unresolved outcome_unknown occurrence contribution' : null,
    alertState: alertForJob(snapshot.incidents, job.id),
    alertTargetMissing: !routeHealthy,
    findings,
  }
}

export function projectSchedulerHealth(snapshot = {}) {
  if (!Array.isArray(snapshot.jobs)) {
    return {
      enabled: null, healthy: null, degraded: null, blocked: null, unknown: null,
      complete: false, generatedAt: snapshot.generatedAt ?? Date.now(), jobs: [],
      censusError: snapshot.censusError ?? 'canonical Job document unreadable',
      readbackAvailable: true, watchdogRunnable: true,
    }
  }
  let authorityError = null
  try { validateCanonicalHealthAuthority(snapshot) } catch (error) { authorityError = error }
  const jobs = snapshot.jobs.filter((job) => job.enabled === true)
  const complete = authorityError === null && generationsComplete(snapshot.generations)
    && snapshot.provenance?.canonicalPair === true && fenceProjectionValid(snapshot)
  const rows = jobs.map((job) => projectRow(job, snapshot, complete))
  const findings = rows.flatMap((row) => row.findings ?? [])
  if (snapshot.runtimeHealth?.healthOk === false) findings.push({
    class: 'SCHEDULER_RUNTIME_UNHEALTHY', subjectKind: 'runtime', stableSubjectId: 'scheduler-runtime', reason: snapshot.runtimeHealth.reason,
  })
  const count = (kind) => rows.filter((row) => row.classification === kind).length
  return {
    enabled: rows.length, healthy: count('healthy'), degraded: count('degraded'), blocked: count('blocked'), unknown: count('unknown'),
    complete, generatedAt: snapshot.generatedAt ?? Date.now(), jobs: rows, findings,
    provenance: {
      canonicalPair: snapshot.provenance?.canonicalPair === true,
      runtime: snapshot.provenance?.runtime ?? null,
      store: snapshot.provenance?.store ?? null,
      routing: snapshot.provenance?.routing ?? null,
    },
    censusError: complete ? null : (snapshot.censusError ?? authorityError?.message ?? 'source generation, provenance, or fence projection incomplete'),
    readbackAvailable: true, watchdogRunnable: true,
  }
}

export async function acquireConsistentHealthSnapshot(sources, { maxAttempts = 3 } = {}) {
  let lastGenerations = []
  let lastCaptured = []
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const starts = await Promise.all(sources.map(async (source) => { try { return await source.token() } catch { return null } }))
    lastCaptured = await Promise.all(sources.map(async (source) => {
      try { return { ok: true, value: await source.capture() } } catch (error) { return { ok: false, error: String(error?.message ?? error).slice(0, 160) } }
    }))
    const ends = await Promise.all(sources.map(async (source) => { try { return await source.token() } catch { return null } }))
    lastGenerations = sources.map((source, index) => ({
      source: source.name, captured: lastCaptured[index].ok,
      trusted: lastCaptured[index].ok && starts[index] != null && ends[index] != null,
      start: starts[index], end: ends[index],
    }))
    if (generationsComplete(lastGenerations)) {
      return { complete: true, attempts: attempt, generations: lastGenerations, sources: Object.fromEntries(sources.map((source, index) => [source.name, lastCaptured[index].value])) }
    }
  }
  return {
    complete: false, attempts: maxAttempts, generations: lastGenerations,
    sources: Object.fromEntries(sources.flatMap((source, index) => lastCaptured[index]?.ok ? [[source.name, lastCaptured[index].value]] : [])),
    censusError: lastCaptured.some((item) => item?.ok === false)
      ? `health source unavailable: ${sources.flatMap((source, index) => lastCaptured[index]?.ok === false ? [`${source.name}: ${lastCaptured[index].error}`] : []).join('; ')}`
      : 'source generations drifted or were unavailable',
  }
}

export function filterHealthForPrincipal(health, principal) {
  const scopes = principal?.scopes instanceof Set ? principal.scopes : new Set()
  if (scopes.has('scheduler.audit')) return structuredClone(health)
  if (!scopes.has('scheduler.read') || typeof principal?.agentId !== 'string' || principal.agentId === '') {
    throw Object.assign(new Error('forbidden scheduler health read'), { status: 403, code: 'forbidden' })
  }
  const jobs = health.jobs.filter((row) => row.agentId === principal.agentId)
  const visibleJobIds = new Set(jobs.map((row) => row.jobId))
  const findings = (health.findings ?? []).filter((finding) => finding.subjectKind === 'runtime' || visibleJobIds.has(finding.jobId))
  const count = (kind) => jobs.filter((row) => row.classification === kind).length
  return { ...structuredClone(health), enabled: jobs.length, healthy: count('healthy'), degraded: count('degraded'), blocked: count('blocked'), unknown: count('unknown'), jobs, findings }
}
