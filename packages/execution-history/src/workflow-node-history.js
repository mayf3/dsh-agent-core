/**
 * @agent-core/execution-history/src/workflow-node-history.js — the read-only
 * workflow-node attempt-history index. Given (workflowInstanceId, nodeVisitId)
 * it projects EVERY ledger generation of that node visit (R2: the identity-
 * triple scan is authoritative; projectAttempts preserves each generation's
 * evidence — stale re-entry never discards the superseded attempt) as a
 * stably sorted, coordinate-only index:
 *   attemptId / generation, the system-owned execution state (the frozen
 *   CTR-WEC1-002 mapping at generation granularity), delivering agentId,
 *   SessionRef=(agentId, sessionId) taken ONLY from the persisted
 *   run_delivered receipt (SC-1: no receipt ⇒ no SessionRef, never
 *   fabricated), started/updated/finished times, and the delivery
 *   coordinates (requestId / reconciliationHandle / messageId).
 *
 * Index-only by construction: no session journal is opened, no transcript is
 * read, no svc business facts are aggregated here — the ledger state is the
 * SYSTEM execution state, never workflow business truth (§5: agent progress
 * ≠ business progress; business completion stays a svc-workflow fact).
 * Self scope still resolves svc visibility with the caller's own credential
 * before any attempt coordinate is shown (same rule as root=workflow_instance);
 * the audit scope widens reach, never content. Result output carries
 * coordinates only — redaction (§4.3) is satisfied vacuously and asserted in
 * tests. This module is consumed only by the broker execution-history family
 * (§4.5 consumption ban).
 */

import { fetchInstanceDetail, svcFailureGap } from './loaders/svc-facts.js'
import { createQueryContext, gap } from './correlate/context.js'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const AGENT_ID_RE = /^agt_[A-Za-z0-9_-]+$/
const RESOLVE_FAILED_PREFIX = 'resolve_failed:'

const err = (code, detail) => ({ ok: false, code, detail })

/**
 * Tolerant per-generation replay of the frozen ledger vocabulary (ledger-events.js
 * applyLedgerEvent semantics, read-only and lossy-tolerant like projectAttempts:
 * a corrupt row degrades the entry instead of throwing — T5 discipline).
 * @returns {{state:string, phase:string, judgment:(string|undefined), reason:(string|undefined),
 *   blockedCode:(string|undefined), delivered:(object|undefined), startedAtMs:(number|null),
 *   finishedAtMs:(number|null), updatedAtMs:(number|null)}}
 */
function foldGenerationState(events) {
  const st = {
    state: 'ACTIVE', phase: 'planned', judgment: undefined, reason: undefined,
    blockedCode: undefined, delivered: undefined, startedAtMs: null,
    finishedAtMs: null, updatedAtMs: null,
  }
  for (const rec of events) {
    const atMs = Number.isFinite(rec.atMs) ? rec.atMs : null
    if (atMs !== null && (st.updatedAtMs === null || atMs > st.updatedAtMs)) st.updatedAtMs = atMs
    const data = rec.data ?? {}
    switch (rec.kind) {
      case 'attempt_attempt_planned':
        st.phase = 'planned'
        st.state = 'ACTIVE'
        if (st.startedAtMs === null) st.startedAtMs = atMs
        break
      case 'attempt_delivery_started':
        if (st.state === 'ACTIVE') st.phase = 'delivery_started'
        break
      case 'attempt_resolution_blocked':
        if (st.state === 'ACTIVE') { st.phase = 'resolution_blocked'; st.blockedCode = data.code }
        break
      case 'attempt_recovery_authorized':
        break
      case 'attempt_recovery_refused':
        if (st.state === 'ACTIVE') {
          st.state = 'NEEDS_REVIEW'; st.phase = 'recovery_refused'
          st.reason = `recovery_refused:${data.refused ?? ''}`
          st.finishedAtMs = atMs
        }
        break
      case 'attempt_run_delivered':
        if (st.state === 'ACTIVE') {
          st.phase = 'run_delivered'
          st.delivered = {
            agentId: typeof data.agentId === 'string' && data.agentId !== '' ? data.agentId : undefined,
            requestId: typeof data.requestId === 'string' && data.requestId !== '' ? data.requestId : undefined,
            sessionId: typeof data.sessionId === 'string' && data.sessionId !== '' ? data.sessionId : undefined,
            reconciliationHandle: typeof data.reconciliationHandle === 'string' && data.reconciliationHandle !== '' ? data.reconciliationHandle : undefined,
            messageId: typeof data.messageId === 'string' && data.messageId !== '' ? data.messageId : undefined,
            atMs,
          }
        }
        break
      case 'attempt_delivery_failed':
        if (st.state !== 'ACTIVE') break
        // V2 CTR-WAE-011 projection-only reclassification: the historical
        // `resolve_failed:` emission proves deliver was never reached — the
        // recoverable-blocked live phase, never a terminal.
        if (typeof data.reason === 'string' && data.reason.startsWith(RESOLVE_FAILED_PREFIX)) {
          st.phase = 'resolution_blocked'
          st.blockedCode = data.reason.slice(RESOLVE_FAILED_PREFIX.length)
        } else {
          st.state = 'NEEDS_REVIEW'; st.phase = 'delivery_failed'
          st.reason = data.reason; st.finishedAtMs = atMs
        }
        break
      case 'attempt_reconciled':
        if (st.state === 'ACTIVE' && (data.verdict === 'SETTLED' || data.verdict === 'NEEDS_REVIEW')) {
          st.state = data.verdict; st.phase = 'reconciled'
          st.judgment = data.judgment; st.reason = data.reason
          st.finishedAtMs = atMs
        }
        break
      case 'attempt_stale_superseded':
        // CTR-SRE-002: the ONE re-entry marker (source guard mirrored
        // tolerantly: delivered evidence must exist).
        if ((st.state === 'ACTIVE' && st.phase === 'run_delivered' && st.delivered !== undefined)
          || (st.state === 'NEEDS_REVIEW' && st.delivered !== undefined)) {
          st.state = 'SETTLED'; st.phase = 'stale_superseded'
          st.judgment = 'stale_no_progress'; st.finishedAtMs = atMs
        }
        break
      default:
        break
    }
  }
  return st
}

/**
 * The CTR-WEC1-002 deterministic executionState mapping at generation
 * granularity. ELIGIBLE stays a svc activation fact and is never derived here.
 */
export function executionStateName(st) {
  if (st.state === 'SETTLED') return st.judgment === 'stale_no_progress' ? 'STALE_NO_PROGRESS' : 'SETTLED'
  if (st.state === 'NEEDS_REVIEW') {
    if (st.judgment === 'run_ended_no_submission') return 'RUN_ENDED_NO_TRANSITION'
    return 'OUTCOME_UNKNOWN'
  }
  if (st.phase === 'resolution_blocked') return 'BLOCKED'
  return st.phase === 'run_delivered' ? 'RUNNING' : 'DISPATCHED'
}

/** One index entry per generation — coordinates only, absent facts stay absent. */
function attemptEntryFor(gen, nextGen) {
  const st = foldGenerationState(gen.events)
  const delivered = st.delivered
  const sessionRef = delivered !== undefined && delivered.agentId !== undefined && delivered.sessionId !== undefined
    ? { agentId: delivered.agentId, sessionId: delivered.sessionId }
    : null
  return {
    attemptId: gen.attemptId ?? null,
    generation: gen.generation,
    execution: {
      state: executionStateName(st),
      phase: st.phase,
      ...(st.judgment !== undefined ? { judgment: st.judgment } : {}),
      ...(st.reason !== undefined ? { reason: st.reason } : {}),
      ...(st.blockedCode !== undefined ? { blockedCode: st.blockedCode } : {}),
    },
    ...(delivered?.agentId !== undefined ? { agentId: delivered.agentId } : {}),
    sessionRef,
    startedAtMs: st.startedAtMs,
    updatedAtMs: st.updatedAtMs ?? st.startedAtMs,
    finishedAtMs: st.finishedAtMs,
    // The run_delivered row IS the dispatch receipt; a delivered attempt
    // without messageId is visible receipt loss (R3/CTR-SCT-006) — null is
    // an explicit absence, never fabricated.
    delivery: delivered === undefined ? null : {
      requestId: delivered.requestId ?? null,
      reconciliationHandle: delivered.reconciliationHandle ?? null,
      messageId: delivered.messageId ?? null,
      receiptKind: 'run_delivered',
      receiptAtMs: delivered.atMs ?? null,
    },
    ...(nextGen !== undefined && nextGen.attemptId !== undefined ? { supersededBy: nextGen.attemptId } : {}),
  }
}

/**
 * Project one visit's full attempt history (every generation), stably sorted:
 * (generation asc, startedAtMs asc, attemptId asc) — a deterministic total
 * order over append-only facts, stable across repeated queries on the same
 * ledger boundary.
 */
export function projectNodeAttemptHistory(proj) {
  const generations = [...(proj.generations ?? [])]
    .map((gen, index, all) => {
      const entry = attemptEntryFor(gen, all[index + 1])
      entry.startedSortMs = entry.startedAtMs ?? 0
      return entry
    })
    .sort((a, b) => (a.generation - b.generation)
      || (a.startedSortMs - b.startedSortMs)
      || String(a.attemptId ?? '').localeCompare(String(b.attemptId ?? '')))
  for (const entry of generations) delete entry.startedSortMs
  return generations
}

/**
 * Public entry (rides the same module surface as queryExecutionTrace /
 * listAgentSessions — the trusted provider imports ONE module).
 * @param {object} opts
 * @param {string} opts.workflowInstanceId - UUID.
 * @param {string} opts.nodeVisitId - UUID.
 * @param {{agentId: string, audit: boolean}} opts.viewer - trusted gateway identity.
 * @param {object} opts.paths - {homesRoot, controlDir, historyDir, jobsStore, workflowExecutionDir, evidenceLog}
 * @param {Function} [opts.svcRequest] - per-caller svc read seam.
 * @param {number} [opts.nowMs]
 */
export async function queryWorkflowNodeHistory(opts) {
  const { viewer, paths, svcRequest, caps, nowMs = Date.now() } = opts
  const workflowInstanceId = typeof opts.workflowInstanceId === 'string' ? opts.workflowInstanceId : ''
  const nodeVisitId = typeof opts.nodeVisitId === 'string' ? opts.nodeVisitId : ''
  if (!UUID_RE.test(workflowInstanceId) || !UUID_RE.test(nodeVisitId)) {
    return err('invalid_arguments', 'workflowInstanceId and nodeVisitId must be UUIDs')
  }
  if (viewer?.agentId === undefined || typeof viewer.agentId !== 'string' || !AGENT_ID_RE.test(viewer.agentId)) {
    return err('forbidden_not_owner', 'trusted caller identity unavailable')
  }
  const wfId = workflowInstanceId.toLowerCase()
  const visitId = nodeVisitId.toLowerCase()
  const ctx = createQueryContext({ paths, caps, viewer, svcRequest: svcRequest ?? null })
  const gaps = []

  // Self scope: svc visibility (the caller's own credential) decides whether
  // any attempt coordinate may be shown — same rule as root=workflow_instance.
  let svcVisibility = 'not_checked'
  if (svcRequest !== null && svcRequest !== undefined) {
    const detail = await fetchInstanceDetail(svcRequest, viewer.agentId, wfId)
    if (detail.ok) {
      svcVisibility = 'visible'
      ctx._sources.set('svc_detail', { status: { status: 'OK' }, files: [], rowsRead: 1 })
    } else {
      svcVisibility = 'not_visible'
      gaps.push(svcFailureGap(detail, 'svc_instance_detail'))
      ctx._sources.set('svc_detail', { status: { status: 'ABSENT', reason: detail.code }, files: [], rowsRead: 0 })
      if (viewer.audit !== true) {
        return err('workflow_instance_not_found', 'not found or not visible to the caller')
      }
    }
  } else {
    svcVisibility = 'transport_unavailable'
    gaps.push(gap('SOURCE_ABSENT', 'svc', { reason: 'svc transport unavailable in this context' }))
    ctx._sources.set('svc_detail', { status: { status: 'ABSENT', reason: 'svc transport unavailable' }, files: [], rowsRead: 0 })
  }

  const ledger = ctx.source('attempts_ledger')
  const visits = ctx.attemptProjections().filter((p) => (p.workflowInstanceId ?? '').toLowerCase() === wfId && p.nodeVisitId === visitId)
  const attempts = visits.length > 0 ? projectNodeAttemptHistory(visits[0]) : []
  if (attempts.length === 0) {
    gaps.push(gap('CORRELATION_GAP', 'dispatch_attempts', {
      reason: 'no attempts-ledger attempt for this node visit on this runtime (visit dispatch may predate the ledger, was never engine-dispatched, or execution happened on another runtime — G6); this is not proof the visit never executed',
      knownFacts: { workflowInstanceId: wfId, nodeVisitId: visitId },
    }))
  }
  const escalationRow = visits.length > 0 ? visits[0].events.find((e) => e.kind === 'attempt_escalation_requested') : undefined
  // The escalation fact (CTR-WEC1-005) is VISIT-level: it is surfaced at the
  // result root, not folded into any single generation's execution state (the
  // per-attempt state stays derived from that generation's own facts only).
  const escalation = escalationRow === undefined ? undefined : {
    reason: escalationRow.data?.reason ?? null,
    ...(Number.isFinite(escalationRow.data?.attemptCount) ? { attemptCount: escalationRow.data.attemptCount } : {}),
    ...(typeof escalationRow.data?.lastAttemptId === 'string' ? { lastAttemptId: escalationRow.data.lastAttemptId } : {}),
    ...(Number.isFinite(escalationRow.atMs) ? { atMs: escalationRow.atMs } : {}),
  }

  // §4.4: zero records AND every consulted source absent/degraded — the
  // honest "we could see nothing at all" answer.
  const consulted = [ctx._sources.get('svc_detail'), ledger]
  if (attempts.length === 0 && consulted.every((s) => s?.status?.status === 'ABSENT' || s?.status?.status === 'DEGRADED')) {
    return err('history_unavailable', 'every consulted history source is absent or degraded')
  }

  const result = {
    workflowInstanceId: wfId,
    nodeVisitId: visitId,
    attempts,
    ...(escalation !== undefined ? { escalation } : {}),
    gaps,
    readBoundary: {
      asOfUtc: new Date(nowMs).toISOString(),
      svcVisibility,
      sources: [
        {
          name: 'attempts_ledger',
          status: ledger.status.status,
          ...(ledger.status.reason !== undefined ? { reason: ledger.status.reason } : {}),
          ...(ledger.status.badLines !== undefined ? { badLines: ledger.status.badLines } : {}),
          truncated: ledger.status.truncated === true,
          rows: ledger.rowsRead,
        },
      ],
    },
  }
  return { ok: true, result }
}
