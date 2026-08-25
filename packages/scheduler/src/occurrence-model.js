/**
 * @agent-core/scheduler — V2 occurrence model (SCHEDULER_TIMEOUT_OUTCOME_V2).
 *
 * Governing contracts (docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V2.md):
 *   C-022 occurrence record schema (authority fields, fail-loud validation)
 *   C-023 deterministic identity derivation + collision policy
 *   C-024 payloadHash (canonical JSON; delivery excluded)
 *   §9.1 durable state machine (admitted/running/succeeded/failed/outcome_unknown)
 *   C-028 fence projection derived from the occurrence ledger
 *
 * Identity (C-023): occurrenceId is DERIVED from the logical coordinates
 * (jobId, scheduleRevision, kind, slot) — the same logical slot always yields
 * the same id across ticks, restarts and store reloads. runId and
 * idempotencyKey derive from occurrenceId, so a second admission of the same
 * occurrence is mechanically impossible to represent as a new record.
 */

import { createHash } from 'node:crypto'

export const OCCURRENCE_KINDS = new Set(['natural', 'retry', 'catchup'])
export const OCCURRENCE_STATES = new Set(['admitted', 'running', 'succeeded', 'failed', 'outcome_unknown'])
export const TERMINAL_STATES = new Set(['succeeded', 'failed'])
export const EXECUTION_OUTCOMES = new Set(['succeeded', 'failed'])
export const DELIVERY_STATUSES = new Set(['delivered', 'not-delivered', 'not-requested', 'unknown'])
export const LATE_SETTLEMENT_BASES = new Set(['trusted-late-evidence', 'operator-reconcile'])
export const TERMINAL_EVIDENCE_KINDS = new Set([
  'pre-start-rejection', 'turn-terminal', 'late-settlement', 'operator-reconcile',
])

/**
 * §9.1 state machine. Key = from-state, value = Set of legal to-states.
 * outcome_unknown may ONLY move to succeeded|failed via trusted late
 * settlement / operator reconcile, and NEVER back to admitted.
 */
const STATE_TRANSITIONS = {
  admitted: new Set(['running', 'failed', 'outcome_unknown']),
  running: new Set(['succeeded', 'failed', 'outcome_unknown']),
  succeeded: new Set(),
  failed: new Set(),
  outcome_unknown: new Set(['succeeded', 'failed']),
}

export function canTransition(from, to) {
  return STATE_TRANSITIONS[from]?.has(to) === true
}

export function isTerminalState(state) {
  return TERMINAL_STATES.has(state)
}

export function isUnresolvedUnknown(record) {
  return record?.state === 'outcome_unknown' && record?.lateSettlement === undefined
}

/** Unambiguous encoding of the logical coordinates for hashing (length-prefixed parts). */
function encodeCoords(parts) {
  return parts.map((p) => `${String(p).length}:${p}`).join('|')
}

function shaHex16(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)
}

/**
 * C-023 deterministic identity.
 *   natural:  hash(jobId, revision, 'natural',  nominalScheduledAt)
 *   retry:    hash(jobId, revision, 'retry',    retryOfOccurrenceId)
 *   catchup:  hash(jobId, revision, 'catchup',  catchUpOfNominalAt)
 */
export function deriveOccurrenceId({ jobId, scheduleRevision, kind, nominalScheduledAt, retryOfOccurrenceId, catchUpOfNominalAt }) {
  const slot = kind === 'retry' ? retryOfOccurrenceId : kind === 'catchup' ? catchUpOfNominalAt : nominalScheduledAt
  if (slot === undefined) {
    throw new TypeError(`occurrence identity: kind '${kind}' requires its slot coordinate`)
  }
  return `occ:${shaHex16(encodeCoords([jobId, String(scheduleRevision), kind, String(slot)]))}`
}

export function deriveRunId(occurrenceId) {
  return `run:${occurrenceId}`
}

/**
 * C-031 fresh non-main native Session per occurrence. Derived from the
 * occurrence identity (stable, unique per occurrence, never 'main', never the
 * legacy `agent:<id>:cron:<jobId>` stable per-job form).
 */
export function deriveNativeSessionId(occurrenceId) {
  return `cron-run-${occurrenceId}`
}

/** Canonical JSON: recursively key-sorted, no whitespace, undefined omitted. */
export function canonicalJSON(value) {
  if (value === undefined) return ''
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * C-024 payloadHash. Execution payload only — delivery is a separate outcome
 * (D-007 §11.4) and never enters this hash.
 */
export function computePayloadHash({ agentId, payload }) {
  const executionPayload = {
    agentId,
    payload: {
      kind: payload?.kind ?? 'agentTurn',
      message: payload?.message,
      timeoutSeconds: payload?.timeoutSeconds,
      lightContext: payload?.lightContext,
      model: payload?.model,
    },
  }
  return `sha256:${createHash('sha256').update(canonicalJSON(executionPayload), 'utf8').digest('hex')}`
}

/**
 * C-023 logical coordinates. natural and catchup jointly occupy the nominal
 * slot space ((jobId, revision, nominal) at most one record regardless of
 * kind); retry occupies (jobId, revision, retryOfOccurrenceId).
 */
export function logicalCoordinates({ jobId, scheduleRevision, kind, nominalScheduledAt, retryOfOccurrenceId, catchUpOfNominalAt }) {
  if (kind === 'retry') {
    return { jobId, scheduleRevision, effectiveSlot: retryOfOccurrenceId }
  }
  const nominal = kind === 'catchup' ? catchUpOfNominalAt : nominalScheduledAt
  return { jobId, scheduleRevision, effectiveSlot: nominal }
}

function coordsKey(coords) {
  return encodeCoords([coords.jobId, String(coords.scheduleRevision), String(coords.effectiveSlot)])
}

/** Structured collision / duplicate error (C-023 fail-loud policy). */
export function structuredCollisionError(existing, attempted) {
  const err = new Error(
    `occurrence collision: id ${attempted.occurrenceId} already bound to different logical coordinates `
    + `(existing ${JSON.stringify(logicalCoordinates(existing))}, attempted ${JSON.stringify(logicalCoordinates(attempted))})`,
  )
  err.code = 'OCCURRENCE_STRUCTURED_COLLISION'
  err.existing = logicalCoordinates(existing)
  err.attempted = logicalCoordinates(attempted)
  return err
}

/** Authority fields every persisted occurrence record must carry (C-022). */
const REQUIRED_FIELDS = [
  'occurrenceId', 'jobId', 'scheduleRevision', 'kind', 'runId', 'idempotencyKey',
  'payloadHash', 'state', 'admittedAt', 'executionDeadlineAtMs', 'history',
]

/**
 * Validate a persisted occurrence record. Corruption of an occurrence record
 * is corruption of the execution authority and MUST fail loud — unlike a
 * single corrupt job (warn-drop), a corrupt occurrence may never be silently
 * treated as "no occurrence" (C-022 / ACC-021).
 */
export function validateOccurrenceRecord(record) {
  const corrupt = (message) => {
    throw Object.assign(new Error(`occurrence ${record?.occurrenceId ?? '(unknown)'}: ${message}`), {
      code: 'OCCURRENCE_STORE_CORRUPT',
    })
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) corrupt('record is not an object')
  for (const field of REQUIRED_FIELDS) {
    if (record[field] === undefined) corrupt(`missing authority field '${field}'`)
  }
  if (typeof record.jobId !== 'string' || record.jobId === '') corrupt('jobId must be a non-empty string')
  if (!Number.isSafeInteger(record.scheduleRevision) || record.scheduleRevision < 1) corrupt('scheduleRevision must be a positive integer')
  if (!OCCURRENCE_KINDS.has(record.kind)) corrupt(`invalid kind '${record.kind}'`)
  if (!OCCURRENCE_STATES.has(record.state)) corrupt(`invalid state '${record.state}'`)
  const slotOk = record.kind === 'retry'
    ? typeof record.retryOfOccurrenceId === 'string' && record.retryOfOccurrenceId !== ''
    : Number.isFinite(record.kind === 'catchup' ? record.catchUpOfNominalAt : record.nominalScheduledAt)
  if (!slotOk) corrupt(`kind '${record.kind}' missing its slot coordinate`)

  const derivedId = deriveOccurrenceId(record)
  if (record.occurrenceId !== derivedId) corrupt(`occurrenceId does not match logical coordinates (expected ${derivedId})`)
  if (record.runId !== deriveRunId(record.occurrenceId)) corrupt('runId does not derive from occurrenceId')
  if (record.idempotencyKey !== record.occurrenceId) corrupt('idempotencyKey must equal occurrenceId in V2')
  if (typeof record.payloadHash !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(record.payloadHash)) corrupt('payloadHash must be sha256:<64 lowercase hex>')
  if (!Number.isFinite(record.admittedAt)) corrupt('admittedAt must be finite')
  if (!Number.isFinite(record.executionDeadlineAtMs) || record.executionDeadlineAtMs <= record.admittedAt) {
    corrupt('executionDeadlineAtMs must be after admittedAt')
  }
  if (record.startedAt !== undefined && (!Number.isFinite(record.startedAt) || record.startedAt < record.admittedAt)) corrupt('invalid startedAt')
  if (record.endedAt !== undefined && (!Number.isFinite(record.endedAt) || record.endedAt < record.admittedAt)) corrupt('invalid endedAt')
  if (record.nativeSessionId !== undefined
    && (typeof record.nativeSessionId !== 'string' || record.nativeSessionId === '' || record.nativeSessionId === 'main')) {
    corrupt('nativeSessionId must be a non-main string')
  }
  if (record.deliveryStatus !== undefined && !DELIVERY_STATUSES.has(record.deliveryStatus)) corrupt(`invalid deliveryStatus '${record.deliveryStatus}'`)
  if (record.executionOutcome !== undefined && !EXECUTION_OUTCOMES.has(record.executionOutcome)) corrupt(`invalid executionOutcome '${record.executionOutcome}'`)
  if (record.terminalEvidence !== undefined && (!record.terminalEvidence
    || !TERMINAL_EVIDENCE_KINDS.has(record.terminalEvidence.kind)
    || typeof record.terminalEvidence.detailRef !== 'string' || record.terminalEvidence.detailRef === '')) {
    corrupt('invalid terminalEvidence authority')
  }
  if (record.state === 'failed' && record.terminalEvidence === undefined) corrupt('failed requires terminalEvidence authority')
  if (TERMINAL_STATES.has(record.state) && record.executionOutcome !== record.state) corrupt('terminal state must equal executionOutcome')
  if (record.state === 'outcome_unknown' && record.executionOutcome !== undefined) corrupt('outcome_unknown cannot claim a terminal executionOutcome')

  if (!Array.isArray(record.history) || record.history.length === 0) corrupt('history must be a non-empty array')
  let previous = null
  let previousAt = -Infinity
  let unknownResolutionEntry = null
  for (const [index, entry] of record.history.entries()) {
    if (!entry || typeof entry !== 'object' || !Number.isFinite(entry.at)
      || typeof entry.to !== 'string' || typeof entry.reason !== 'string') corrupt(`malformed history entry ${index}`)
    if (entry.from !== previous) corrupt(`history entry ${index} has discontinuous from-state`)
    if (entry.at < previousAt) corrupt(`history entry ${index} moves backward in time`)
    if (index === 0 && entry.at !== record.admittedAt) corrupt('history must begin at admittedAt')
    if (previous === null && entry.to !== 'admitted') corrupt('history must begin with admitted')
    if (previous !== null && !canTransition(previous, entry.to)) corrupt(`history contains illegal ${previous} -> ${entry.to}`)
    if (previous === 'outcome_unknown' && TERMINAL_STATES.has(entry.to)) unknownResolutionEntry = entry
    previous = entry.to
    previousAt = entry.at
  }
  if (previous !== record.state) corrupt('history final state does not match record.state')
  if (record.startedAt !== undefined
    && !record.history.some((entry) => entry.to === 'running' && entry.at === record.startedAt)) {
    corrupt('startedAt must match the running transition')
  }
  if (record.endedAt !== undefined && previousAt !== record.endedAt) corrupt('endedAt must match the final history transition')
  if (unknownResolutionEntry && record.lateSettlement === undefined) {
    corrupt('outcome_unknown resolution requires lateSettlement authority')
  }
  if (record.lateSettlement !== undefined) {
    const settlement = record.lateSettlement
    if (!settlement || !LATE_SETTLEMENT_BASES.has(settlement.basis)
      || !TERMINAL_STATES.has(settlement.resolvedTo)
      || settlement.resolvedTo !== record.state || !Number.isFinite(settlement.resolvedAt)
      || !unknownResolutionEntry || settlement.resolvedAt !== unknownResolutionEntry.at
      || typeof settlement.evidenceRef !== 'string' || settlement.evidenceRef === '') {
      corrupt('invalid lateSettlement authority')
    }
  }
  return record
}

/**
 * Build a fresh admitted occurrence record (C-022 schema, C-025 deadline at
 * admission). Pure: the caller persists it inside the mutation lock.
 */
export function buildOccurrenceRecord({ job, kind, nominalScheduledAt, retryOfOccurrenceId, catchUpOfNominalAt, admittedAt, timeoutMs, nowMs = () => Date.now() }) {
  if (!OCCURRENCE_KINDS.has(kind)) throw new TypeError(`occurrence kind must be natural|retry|catchup, got: ${kind}`)
  const occurrenceId = deriveOccurrenceId({
    jobId: job.id, scheduleRevision: job.scheduleRevision, kind,
    nominalScheduledAt, retryOfOccurrenceId, catchUpOfNominalAt,
  })
  const timeoutMsResolved = typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.floor(timeoutMs)
    : 3600_000 // AGENT_TURN_SAFETY_TIMEOUT_MS default (C-025)
  const record = {
    occurrenceId,
    jobId: job.id,
    scheduleRevision: job.scheduleRevision,
    kind,
    runId: deriveRunId(occurrenceId),
    idempotencyKey: occurrenceId,
    payloadHash: computePayloadHash({ agentId: job.agentId, payload: job.payload }),
    state: 'admitted',
    admittedAt,
    executionDeadlineAtMs: admittedAt + timeoutMsResolved,
    history: [{ at: admittedAt, from: null, to: 'admitted', reason: `${kind} occurrence reserved` }],
  }
  if (kind === 'retry') record.retryOfOccurrenceId = retryOfOccurrenceId
  if (kind === 'natural') record.nominalScheduledAt = nominalScheduledAt
  if (kind === 'catchup') record.catchUpOfNominalAt = catchUpOfNominalAt
  return record
}

/**
 * Apply one state transition in place (caller holds the mutation lock).
 * Appends the mandatory history entry; rejects illegal §9.1 transitions and
 * payloadHash/revision mismatches fail-loud (C-024/C-027).
 */
export function applyTransition(record, { to, at, reason, executionOutcome, deliveryStatus, startedAt, endedAt, terminalEvidence, lateSettlement, nativeSessionId }) {
  if (!OCCURRENCE_STATES.has(to)) throw new TypeError(`occurrence ${record.occurrenceId}: invalid target state '${to}'`)
  const from = record.state
  if (from === to) return record
  if (!canTransition(from, to)) {
    throw Object.assign(
      new Error(`occurrence ${record.occurrenceId}: illegal transition ${from} -> ${to} (§9.1 state machine)`),
      { code: 'OCCURRENCE_ILLEGAL_TRANSITION', from, to },
    )
  }
  if (from === 'outcome_unknown') {
    if (!lateSettlement || !LATE_SETTLEMENT_BASES.has(lateSettlement.basis)
      || lateSettlement.resolvedTo !== to) {
      throw Object.assign(
        new Error(`occurrence ${record.occurrenceId}: outcome_unknown resolution requires trusted late settlement or operator reconcile`),
        { code: 'OCCURRENCE_RECONCILE_EVIDENCE_REQUIRED' },
      )
    }
  }
  record.state = to
  record.history.push({ at, from, to, reason: reason ?? '' })
  if (startedAt !== undefined) record.startedAt = startedAt
  if (endedAt !== undefined) record.endedAt = endedAt
  if (executionOutcome !== undefined) record.executionOutcome = executionOutcome
  if (deliveryStatus !== undefined) record.deliveryStatus = deliveryStatus
  if (nativeSessionId !== undefined) record.nativeSessionId = nativeSessionId
  if (terminalEvidence !== undefined) record.terminalEvidence = terminalEvidence
  if (lateSettlement !== undefined) record.lateSettlement = lateSettlement
  return record
}

/**
 * C-028 fence projection: a job is fenced exactly while it has at least one
 * unresolved outcome_unknown occurrence. The map is a rebuildable projection
 * of the ledger — the ledger is the authority.
 */
export function rebuildFences(occurrences) {
  const fences = {}
  for (const record of occurrences) {
    if (!isUnresolvedUnknown(record)) continue
    const existing = fences[record.jobId]
    // Keep the earliest activating unknown (stable rebuild result).
    if (existing === undefined || record.admittedAt < existing.activatedAtMs) {
      fences[record.jobId] = {
        occurrenceId: record.occurrenceId,
        runId: record.runId,
        activatedAtMs: record.admittedAt,
        reason: `outcome_unknown without termination proof (occurrence ${record.occurrenceId})`,
      }
    }
  }
  return fences
}

/** Index helpers: find an existing record by logical coordinates or id. */
export function findOccurrenceByCoords(occurrences, coords) {
  const key = coordsKey(coords)
  return occurrences.find((record) => {
    const recordCoords = logicalCoordinates(record)
    return coordsKey(recordCoords) === key
  })
}

export function findOccurrenceById(occurrences, occurrenceId) {
  return occurrences.find((record) => record.occurrenceId === occurrenceId)
}
