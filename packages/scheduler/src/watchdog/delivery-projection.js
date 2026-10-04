/**
 * External delivery projection (Product #428) — PURE and READ-ONLY.
 *
 * The accepted incident authority (SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1
 * CTR-INCIDENT-001/CTR-ALERT-001) keeps every detector fact, every root-cause
 * incident and every durable transition intent exactly as compiled. This layer
 * sits between that durable lifecycle and the external Feishu adapter and only
 * decides WHICH durable intents are user-facing:
 *
 *   1. current-truth re-read — a NEW whose incident has already left the OPEN
 *      state before delivery is suppressed as stale (one truthful RECOVERED
 *      still pages);
 *   2. causal-window correlation — a job-level CONSECUTIVE_FAILURE incident
 *      subsumes same-job RUN_FAILED children that open inside its active
 *      window; a SCHEDULER_RUNTIME_UNHEALTHY incident subsumes occurrence-class
 *      incidents whose mechanical evidence anchors (failure end, stuck
 *      observation, fence onset, missed slot due time) intersect the outage
 *      window. Anything anchored outside the parent window stays a separate
 *      user-facing incident — unrelated failures are never silenced;
 *   3. same-occurrence coalescing — RUN_STUCK + RUN_STUCK_OUTCOME_UNKNOWN on
 *      the exact same (jobId, occurrenceId) form ONE user-facing episode: at
 *      most one OPEN (the first member to open) and one RECOVERED (delivered
 *      only once every member of the pair has actually closed);
 *   4. suppression is projection-only — suppressed intents stay durable in the
 *      single existing outbox with their delivery state untouched, so raw
 *      evidence remains fully queryable and restart/replay re-derives the exact
 *      same decisions (no second delivery ledger, no state mutation).
 */

/**
 * Version stamped on incident records created by the projected lifecycle.
 * stableNotificationText renders the human-readable v2 text only for records
 * carrying this marker; pre-projection durable intents keep the exact frozen
 * wire format so existing immutable delivery bindings stay valid.
 */
export const DELIVERY_PROJECTION_VERSION = 2

export const SUPPRESSION_CODES = Object.freeze({
  STALE_NEW: 'stale_new_incident_recovered',
  JOB_PARENT: 'subsumed_by_job_consecutive_failure',
  RUNTIME_PARENT: 'subsumed_by_scheduler_runtime_unhealthy',
  PAIR: 'coalesced_same_occurrence_stuck_pair',
})

const STUCK_PAIR_CLASSES = new Set(['RUN_STUCK', 'RUN_STUCK_OUTCOME_UNKNOWN'])

function rootSegments(incident) {
  return String(incident?.rootIdentity ?? '').split('|')
}

function rootKind(incident) {
  return rootSegments(incident)[0]
}

function rootClass(incident) {
  return rootSegments(incident)[1]
}

function rootJobId(incident) {
  const segments = rootSegments(incident)
  return incident?.jobId ?? (segments[0] === 'occurrence' || segments[0] === 'job' ? segments[2] : undefined)
}

function rootOccurrenceId(incident) {
  const segments = rootSegments(incident)
  return segments[0] === 'occurrence' ? segments[3] : undefined
}

function stuckPairKey(incident) {
  if (rootKind(incident) !== 'occurrence' || !STUCK_PAIR_CLASSES.has(rootClass(incident))) return null
  return `${rootJobId(incident)}|${rootOccurrenceId(incident)}`
}

/**
 * Durable per-episode causal windows for one parent class: [start, end) with
 * `end = Infinity` while the episode is still OPEN. Rebuilt deterministically
 * from the incident state + outbox every call — closed boundaries never change,
 * so decisions are stable across restart/replay.
 */
function episodeWindows(state, matcher) {
  const episodes = new Map()
  const entryFor = (incidentId, rootIdentity) => {
    let entry = episodes.get(incidentId)
    if (!entry) {
      entry = { incidentId, rootIdentity, start: undefined, end: undefined }
      episodes.set(incidentId, entry)
    }
    return entry
  }
  for (const intent of Object.values(state?.outbox ?? {})) {
    const incident = intent?.incident
    if (!incident?.rootIdentity || !matcher(incident)) continue
    const entry = entryFor(intent.incidentId, incident.rootIdentity)
    if (intent.transitionKind === 'OPEN') entry.start = incident.alertState?.lastTransitionAt
    else entry.end ??= incident.alertState?.lastTransitionAt
  }
  for (const record of Object.values(state?.incidents ?? {})) {
    if (!matcher(record)) continue
    const entry = entryFor(record.incidentId, record.rootIdentity)
    if (entry.start === undefined) entry.start = record.firstSeenAt
    if (entry.end === undefined && record.lifecycle !== 'OPEN') entry.end = record.alertState?.lastTransitionAt
  }
  return [...episodes.values()]
    .filter((window) => Number.isFinite(window.start))
    .map((window) => ({ ...window, end: Number.isFinite(window.end) ? window.end : Infinity }))
}

/**
 * Mechanical attribution anchor of one occurrence incident: the evidence time
 * (or stuck observation interval) a runtime outage must overlap to subsume it.
 */
function occurrenceAnchor(incident) {
  const facts = Array.isArray(incident?.facts) ? incident.facts : []
  const firstFinite = (pick) => {
    for (const fact of facts) {
      const value = pick(fact)
      if (Number.isFinite(value)) return value
    }
    return undefined
  }
  const kind = rootClass(incident)
  if (kind === 'RUN_FAILED') {
    const endedAt = firstFinite((fact) => Date.parse(fact?.endedAt))
    return endedAt === undefined ? null : { start: endedAt, end: endedAt }
  }
  if (kind === 'RUN_STUCK') {
    const startedAt = firstFinite((fact) => Date.parse(fact?.startedAt))
    if (startedAt === undefined) return null
    const observedAt = incident.alertState?.lastTransitionAt
    return { start: startedAt, end: Number.isFinite(observedAt) ? observedAt : startedAt }
  }
  if (kind === 'RUN_STUCK_OUTCOME_UNKNOWN') {
    const blockedSince = firstFinite((fact) => Date.parse(fact?.blockedSince)) ?? firstFinite((fact) => Date.parse(fact?.dueAt))
    return blockedSince === undefined ? null : { start: blockedSince, end: blockedSince }
  }
  if (kind === 'EXPECTED_RUN_MISSED') {
    const dueAt = firstFinite((fact) => Date.parse(fact?.dueAt))
    return dueAt === undefined ? null : { start: dueAt, end: dueAt }
  }
  return null
}

function runtimeParentCode(state, incident) {
  const anchor = occurrenceAnchor(incident)
  if (!anchor) return null
  const windows = episodeWindows(state, (candidate) => rootClass(candidate) === 'SCHEDULER_RUNTIME_UNHEALTHY')
  return windows.some((window) => anchor.start < window.end && anchor.end >= window.start)
    ? SUPPRESSION_CODES.RUNTIME_PARENT
    : null
}

function jobParentCode(state, incident) {
  if (rootKind(incident) !== 'occurrence' || rootClass(incident) !== 'RUN_FAILED') return null
  const jobId = rootJobId(incident)
  const openedAt = incident.alertState?.lastTransitionAt
  if (jobId === undefined || !Number.isFinite(openedAt)) return null
  const windows = episodeWindows(state, (candidate) => rootClass(candidate) === 'CONSECUTIVE_FAILURE' && rootJobId(candidate) === jobId)
  return windows.some((window) => window.start <= openedAt && openedAt < window.end)
    ? SUPPRESSION_CODES.JOB_PARENT
    : null
}

/**
 * Child subsumption decided ONCE at the child's OPEN transition and inherited
 * by its later closure, so a subsumed incident never pages in either direction.
 */
function parentSuppressionCodes(state) {
  const codes = new Map()
  const consider = (incidentId, incident) => {
    if (!incident || codes.has(incidentId)) return
    const kind = rootKind(incident)
    const kindClass = rootClass(incident)
    let code = null
    if (kind === 'occurrence' && kindClass === 'RUN_FAILED') code = jobParentCode(state, incident) ?? runtimeParentCode(state, incident)
    else if (kind === 'occurrence') code = runtimeParentCode(state, incident)
    else if (kind === 'job' && kindClass === 'EXPECTED_RUN_MISSED') code = runtimeParentCode(state, incident)
    if (code) codes.set(incidentId, code)
  }
  for (const intent of Object.values(state?.outbox ?? {})) {
    if (intent?.transitionKind === 'OPEN') consider(intent.incidentId, intent.incident)
  }
  for (const record of Object.values(state?.incidents ?? {})) {
    if (record?.lifecycle === 'OPEN') consider(record.incidentId, record)
  }
  return codes
}

function stuckPairAnalysis(state, parentCodes) {
  const members = new Map()
  for (const record of Object.values(state?.incidents ?? {})) {
    const pairKey = stuckPairKey(record)
    if (!pairKey) continue
    if (!members.has(pairKey)) members.set(pairKey, [])
    members.get(pairKey).push({
      incidentId: record.incidentId,
      rootIdentity: record.rootIdentity,
      openAt: Number.isFinite(record.firstSeenAt) ? record.firstSeenAt : Infinity,
      lifecycle: record.lifecycle,
    })
  }
  const analysis = new Map()
  for (const [pairKey, list] of members) {
    const openPrimary = [...list].sort((left, right) => (left.openAt - right.openAt)
      || (left.rootIdentity < right.rootIdentity ? -1 : 1))[0]
    const parentCode = list.map((member) => parentCodes.get(member.incidentId)).find(Boolean) ?? null
    const fullyClosed = list.every((member) => member.lifecycle !== 'OPEN')
    let closePrimary = null
    for (const intent of Object.values(state?.outbox ?? {})) {
      if (!intent?.transitionKind?.startsWith('CLOSED_')) continue
      const member = list.find((candidate) => candidate.incidentId === intent.incidentId)
      if (!member) continue
      const candidate = {
        incidentId: member.incidentId,
        rootIdentity: member.rootIdentity,
        closedAt: intent.incident?.alertState?.lastTransitionAt ?? 0,
      }
      if (!closePrimary || candidate.closedAt > closePrimary.closedAt
        || (candidate.closedAt === closePrimary.closedAt && candidate.rootIdentity < closePrimary.rootIdentity)) {
        closePrimary = candidate
      }
    }
    analysis.set(pairKey, {
      openPrimaryIncidentId: openPrimary.incidentId,
      parentCode,
      fullyClosed,
      closePrimaryIncidentId: closePrimary?.incidentId ?? null,
    })
  }
  return analysis
}

/**
 * Decide the user-facing subset. `intents` are the durable outbox intents
 * candidate for delivery this cycle (e.g. retryableOutboxIntents output); the
 * decision for each is a pure function of the durable incident state.
 */
export function projectIncidentDelivery(state, intents) {
  const ordered = [...(intents ?? [])].sort((left, right) => String(left?.notificationKey).localeCompare(String(right?.notificationKey)))
  const parentCodes = parentSuppressionCodes(state)
  const pairs = stuckPairAnalysis(state, parentCodes)
  const decisions = new Map()
  for (const intent of ordered) {
    const incident = intent?.incident
    const base = { rootIdentity: incident?.rootIdentity, transitionKind: intent?.transitionKind, incidentId: intent?.incidentId }
    let outcome
    const record = state?.incidents?.[incident?.rootIdentity]
    if (intent?.transitionKind === 'OPEN' && (!record || record.incidentId !== intent.incidentId || record.lifecycle !== 'OPEN')) {
      outcome = { deliver: false, code: SUPPRESSION_CODES.STALE_NEW, ...base }
    }
    const pair = pairs.get(stuckPairKey(incident))
    if (!outcome && pair) outcome = pairDecision(pair, intent, base)
    if (!outcome) {
      const parentCode = parentCodes.get(intent?.incidentId)
      if (parentCode) outcome = { deliver: false, code: parentCode, ...base }
    }
    decisions.set(intent.notificationKey, outcome ?? { deliver: true, code: 'deliver', ...base })
  }
  const deliverable = ordered.filter((intent) => decisions.get(intent.notificationKey).deliver)
  const suppressed = ordered
    .filter((intent) => !decisions.get(intent.notificationKey).deliver)
    .map((intent) => {
      const { code, rootIdentity, transitionKind, incidentId } = decisions.get(intent.notificationKey)
      return { notificationKey: intent.notificationKey, code, rootIdentity, transitionKind, incidentId }
    })
  return { decisions, deliverable, suppressed }
}

function pairDecision(pair, intent, base) {
  if (pair.parentCode) return { deliver: false, code: pair.parentCode, ...base }
  if (intent.transitionKind === 'OPEN') {
    return intent.incidentId === pair.openPrimaryIncidentId
      ? null
      : { deliver: false, code: SUPPRESSION_CODES.PAIR, ...base }
  }
  if (!pair.fullyClosed || intent.incidentId !== pair.closePrimaryIncidentId) {
    return { deliver: false, code: SUPPRESSION_CODES.PAIR, ...base }
  }
  return null
}

/**
 * Additive delivery-identification join by EXACT persisted jobId (never by
 * name/fuzzy match): occurrence-class detector facts carry only UUIDs, while
 * the user-facing text must identify the affected Agent/Job. Raw detector
 * fields are preserved untouched; two identity fields are added.
 */
export function annotateFindingsWithJobs(findings, jobs = []) {
  const byId = new Map((Array.isArray(jobs) ? jobs : [])
    .filter((job) => job && typeof job.id === 'string')
    .map((job) => [job.id, job]))
  return (Array.isArray(findings) ? findings : []).map((finding) => {
    if (!finding || typeof finding !== 'object' || typeof finding.jobId !== 'string' || finding.logicalKey !== undefined) return finding
    const job = byId.get(finding.jobId)
    if (!job) return finding
    const annotated = { ...finding }
    if (typeof job.logicalKey === 'string') annotated.logicalKey = job.logicalKey
    if (typeof job.agentId === 'string') annotated.agentId = job.agentId
    return annotated
  })
}
