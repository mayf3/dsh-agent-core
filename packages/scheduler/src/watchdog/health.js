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
  const open = values.find((incident) => incident.lifecycle === 'OPEN')
  return open?.alertState ?? { lifecycle: 'CLOSED_RECOVERED', delivery: 'DELIVERED', incidentKey: null, lastTransitionAt: null }
}

function scheduleReady(schedule) {
  if (schedule?.kind === 'cron') return typeof schedule.expr === 'string' && schedule.expr.trim() !== ''
  if (schedule?.kind === 'at') return typeof schedule.at === 'string' && Number.isFinite(Date.parse(schedule.at))
  if (schedule?.kind === 'every') return Number.isFinite(schedule.everyMs) && schedule.everyMs > 0
  return false
}

function fenceProjectionValid(snapshot) {
  if (snapshot.fences === null || typeof snapshot.fences !== 'object' || Array.isArray(snapshot.fences)) return false
  const expected = new Set((snapshot.occurrences ?? [])
    .filter((item) => item.state === 'outcome_unknown' && item.terminationSettlement === undefined)
    .map((item) => item.jobId))
  const actual = new Set(Object.keys(snapshot.fences))
  return expected.size === actual.size && [...expected].every((jobId) => actual.has(jobId))
}

function projectRow(job, snapshot, complete) {
  const records = (snapshot.occurrences ?? []).filter((item) => item.jobId === job.id)
  const unresolved = records.filter((item) => item.state === 'outcome_unknown' && item.terminationSettlement === undefined)
  const current = [...records].sort((a, b) => (b.admittedAt ?? b.startedAt ?? 0) - (a.admittedAt ?? a.startedAt ?? 0))[0] ?? null
  const credentialReady = snapshot.credentials?.[job.agentId] === true
  const routeState = snapshot.routes?.[job.id] ?? snapshot.routes?.[job.logicalKey] ?? { ready: false }
  const routeHealthy = routeState.ready === true && (routeState.status === undefined || routeState.status === 'READY')
  let classification = 'healthy'
  let state = 'HEALTHY'
  if (!complete) {
    classification = 'unknown'; state = 'UNKNOWN'
  } else if (unresolved.length > 0 || !credentialReady) {
    classification = 'blocked'; state = unresolved.length > 0 ? 'QUARANTINED_UNKNOWN' : 'BLOCKED'
  } else if (!routeHealthy || !scheduleReady(job.schedule)) {
    classification = 'degraded'; state = 'DEGRADED'
  }
  const blockedSinceMs = unresolved.length
    ? Math.min(...unresolved.map((item) => item.endedAt ?? item.startedAt ?? item.admittedAt ?? snapshot.generatedAt))
    : null
  const lastReconciliationAt = lastReconciliation(records)
  return {
    jobId: job.id, agentId: job.agentId, logicalKey: job.logicalKey, classification, state,
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
  const jobs = snapshot.jobs.filter((job) => job.enabled === true)
  const complete = generationsComplete(snapshot.generations) && snapshot.provenance?.canonicalPair === true && fenceProjectionValid(snapshot)
  const rows = jobs.map((job) => projectRow(job, snapshot, complete))
  const count = (kind) => rows.filter((row) => row.classification === kind).length
  return {
    enabled: rows.length, healthy: count('healthy'), degraded: count('degraded'), blocked: count('blocked'), unknown: count('unknown'),
    complete, generatedAt: snapshot.generatedAt ?? Date.now(), jobs: rows,
    censusError: complete ? null : (snapshot.censusError ?? 'source generation, provenance, or fence projection incomplete'),
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
    censusError: 'source generations drifted or were unavailable',
  }
}

export function filterHealthForPrincipal(health, principal) {
  const scopes = principal?.scopes instanceof Set ? principal.scopes : new Set()
  if (scopes.has('scheduler.audit')) return structuredClone(health)
  if (!scopes.has('scheduler.read') || typeof principal?.agentId !== 'string' || principal.agentId === '') {
    throw Object.assign(new Error('forbidden scheduler health read'), { status: 403, code: 'forbidden' })
  }
  const jobs = health.jobs.filter((row) => row.agentId === principal.agentId)
  const count = (kind) => jobs.filter((row) => row.classification === kind).length
  return { ...structuredClone(health), enabled: jobs.length, healthy: count('healthy'), degraded: count('degraded'), blocked: count('blocked'), unknown: count('unknown'), jobs }
}
