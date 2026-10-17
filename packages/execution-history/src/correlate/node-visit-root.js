/**
 * @agent-core/execution-history/src/correlate/node-visit-root.js — root=
 * workflow_node_visit (WORKFLOW_NODE_SESSION_HISTORY_V1): given
 * workflowInstanceId + nodeVisitId, return the NodeVisit's HISTORICAL
 * attempts (every ledger generation, not just the current one) as a stable,
 * coordinate-only index. The per-attempt state folds each generation's
 * attempts-ledger events through the FROZEN workflow-execution state machine
 * (applyLedgerEvent + executionStateFor — reused, never re-implemented), so
 * execution state stays engine-ledger truth: agent self-reported progress
 * never enters this face. No session journal content is read (transcript
 * loading is out of scope by construction); a sessionRef's journal
 * reachability is probed at file-stat/header level only and reported as a
 * bounded-reachability flag, never as a claim that the session exists or
 * does not. Business truth (svc timeline/submissions) stays out of scope —
 * the index points callers at root=workflow_instance for that chain.
 */

import { applyLedgerEvent } from '../../../workflow-execution/src/ledger-events.js'
import { executionStateFor } from '../../../workflow-execution/src/projection.js'
import { fetchInstanceDetail, svcFailureGap } from '../loaders/svc-facts.js'
import { classifyAttempt, observation, VERDICTS } from '../rules.js'
import { gap, correlation } from './context.js'
import { resolveSessionFile } from '../loaders/session-journal.js'

const lower = (v) => String(v ?? '').toLowerCase()

/**
 * Fold ONE generation's ledger records through the frozen state machine and
 * project the coordinate-only attempt index entry. Corrupt replay degrades
 * to an error return — the caller surfaces it as SOURCE_DEGRADED, never
 * silently drops the generation.
 */
function projectGenerationAttempt(gen, nodeVisitId) {
  const attempts = new Map()
  for (const rec of gen.events) {
    applyLedgerEvent(attempts, { ...rec.data, nodeVisitId: rec.data.nodeVisitId ?? nodeVisitId })
  }
  const attempt = attempts.get(lower(nodeVisitId))
  if (attempt === undefined) throw new Error('generation replay produced no attempt projection')
  const { state: executionState } = executionStateFor(attempt)

  const events = gen.events
  const planned = events.find((e) => e.kind === 'attempt_attempt_planned')
  const delivered = events.find((e) => e.kind === 'attempt_run_delivered')
  const startedAtMs = planned?.atMs ?? events[0]?.atMs ?? null
  const lastAtMs = events[events.length - 1]?.atMs ?? null
  const terminal = attempt.state !== 'ACTIVE'

  // sessionRef = the persisted (agentId, sessionId) pair from run_delivered —
  // SC-1: attempts that never produced a persisted delivery coordinate output
  // NO sessionRef at all (never a derived/fabricated one).
  const refs = delivered?.nativeRefs ?? {}
  const hasSessionRef = typeof refs.agentId === 'string' && typeof refs.sessionId === 'string'
  const entry = {
    attemptId: gen.attemptId,
    generation: gen.generation,
    executionState,
    state: attempt.state,
    phase: attempt.phase,
    terminal,
    ...(attempt.judgment !== undefined ? { judgment: attempt.judgment } : {}),
    ...(attempt.reason !== undefined ? { reason: attempt.reason } : {}),
    ...(typeof attempt.dispatchIntentId === 'string' ? { dispatchIntentId: attempt.dispatchIntentId } : {}),
    ...(typeof attempt.ownerPrincipalId === 'string' ? { ownerPrincipalId: attempt.ownerPrincipalId } : {}),
    ...(hasSessionRef ? { agentId: refs.agentId, sessionRef: { agentId: refs.agentId, sessionId: refs.sessionId } } : {}),
    ...(startedAtMs !== null ? { startedAtMs } : {}),
    ...(lastAtMs !== null ? { updatedAtMs: lastAtMs } : {}),
    ...(terminal && lastAtMs !== null ? { finishedAtMs: lastAtMs } : {}),
    // Message/receipt coordinates — each present only when the ledger row
    // persisted it (outcome_unknown receipt loss stays honestly absent).
    ...(typeof refs.requestId === 'string' ? { requestId: refs.requestId } : {}),
    ...(typeof refs.messageId === 'string' ? { messageId: refs.messageId } : {}),
    ...(typeof refs.reconciliationHandle === 'string' ? { reconciliationHandle: refs.reconciliationHandle } : {}),
  }
  return { entry, hasSessionRef, sessionRef: hasSessionRef ? { agentId: refs.agentId, sessionId: refs.sessionId } : null }
}

export async function buildNodeVisitHistory(ctx, args) {
  const workflowInstanceId = lower(args.workflowInstanceId)
  const nodeVisitId = lower(args.nodeVisitId)
  const records = []
  const correlations = []
  const gaps = []
  const observations = []

  // svc instance detail = the caller's visibility fact for the self-scope
  // gate (same discipline as root=workflow_instance). Timeline/submissions
  // are deliberately NOT consulted here: business truth is out of scope for
  // the attempts index.
  if (ctx.svcRequest !== null) {
    const detail = await fetchInstanceDetail(ctx.svcRequest, ctx.viewer.agentId, workflowInstanceId)
    if (detail.ok) {
      records.push({
        source: 'svc_detail', kind: 'svc_instance', provenanceClass: 'PRIMARY_PERSISTED',
        atMs: Date.parse(detail.body?.detail?.createdAt ?? detail.body?.createdAt ?? '') || null,
        nativeSeq: undefined, nativeRefs: { workflowInstanceId }, dedupeKey: `svc:detail:${workflowInstanceId}`,
        data: detail.body,
      })
      ctx._sources.set('svc_detail', { status: { status: 'OK' }, files: [], rowsRead: 1 })
    } else {
      gaps.push(svcFailureGap(detail, 'svc_instance_detail'))
      ctx._sources.set('svc_detail', { status: { status: 'ABSENT', reason: detail.code }, files: [], rowsRead: 0 })
    }
  } else {
    gaps.push(gap('SOURCE_ABSENT', 'svc', { reason: 'svc transport unavailable in this context' }))
    ctx._sources.set('svc_detail', { status: { status: 'ABSENT', reason: 'svc transport unavailable' }, files: [], rowsRead: 0 })
  }

  // The attempts ledger is THE source for this root. Absent/degraded ledger =
  // the history is not reachable — never claim the visit does not exist.
  const ledger = ctx.source('attempts_ledger')
  if (ledger.status?.status !== 'OK') {
    return {
      notFound: { code: 'history_unavailable', detail: `attempts ledger ${ledger.status?.status ?? 'UNKNOWN'} — attempt history not reachable (${ledger.status?.reason ?? 'no reason recorded'})` },
      records, correlations, gaps, observations,
    }
  }

  const proj = ctx.attemptProjections().find((p) => lower(p.nodeVisitId) === nodeVisitId && lower(p.workflowInstanceId ?? '') === workflowInstanceId)
  if (proj === undefined) {
    gaps.push(gap('CORRELATION_GAP', 'dispatch_attempts', { reason: 'no attempts-ledger attempt for this (workflowInstanceId, nodeVisitId) on this runtime', knownFacts: { workflowInstanceId, nodeVisitId } }))
    return { notFound: { code: 'workflow_node_visit_not_found', detail: 'no attempts recorded for this node visit under this workflow instance on this runtime' }, records, correlations, gaps, observations }
  }

  // One index entry per generation, generation-ascending. The dedupeKey
  // carries the zero-padded generation so the shared merge order tiebreak
  // keeps generation order even when ledger atMs values collide.
  const attemptsIndex = []
  const accountedEvents = new Set()
  for (const gen of [...proj.generations].sort((a, b) => a.generation - b.generation || String(a.attemptId).localeCompare(String(b.attemptId)))) {
    for (const rec of gen.events) accountedEvents.add(rec.dedupeKey)
    let folded
    try {
      folded = projectGenerationAttempt(gen, proj.nodeVisitId)
    } catch (error) {
      gaps.push(gap('SOURCE_DEGRADED', 'dispatch_attempts', { reason: `generation ${gen.generation} replay failed: ${error?.message ?? error}`, knownFacts: { attemptId: gen.attemptId, generation: gen.generation } }))
      continue
    }
    const { entry, hasSessionRef, sessionRef } = folded
    attemptsIndex.push(entry)
    records.push({
      source: 'attempts_ledger', kind: 'attempt_index_entry', provenanceClass: 'PRIMARY_PERSISTED',
      atMs: entry.startedAtMs, nativeSeq: undefined,
      nativeRefs: {
        attemptId: entry.attemptId, nodeVisitId: proj.nodeVisitId, workflowInstanceId: proj.workflowInstanceId,
        generation: entry.generation,
        ...(hasSessionRef ? { agentId: sessionRef.agentId, sessionId: sessionRef.sessionId } : {}),
        ...(entry.requestId !== undefined ? { requestId: entry.requestId } : {}),
        ...(entry.messageId !== undefined ? { messageId: entry.messageId } : {}),
        ...(entry.reconciliationHandle !== undefined ? { reconciliationHandle: entry.reconciliationHandle } : {}),
      },
      dedupeKey: `nvh:${proj.nodeVisitId}:g${String(gen.generation).padStart(4, '0')}:${entry.attemptId}`,
      data: entry,
    })
    if (hasSessionRef) {
      correlations.push(correlation('R3', { source: 'attempts_ledger', nativeRef: entry.attemptId }, { source: 'session_journal', nativeRef: `${sessionRef.agentId}/${sessionRef.sessionId}` }, [entry.attemptId, sessionRef.sessionId]))
      // Bounded reachability probe: file location + header only, never a
      // content read. Unreachable = explicit gap + flag, never interpreted
      // as session non-existence.
      const reachable = resolveSessionFile(ctx.paths.homesRoot, sessionRef.agentId, sessionRef.sessionId) !== null
      entry.journalReachable = reachable
      if (!reachable) {
        gaps.push(gap('CORRELATION_GAP', 'session_journal', { reason: `persisted run_delivered session coordinate not locatable within this query's reach: ${sessionRef.agentId}/${sessionRef.sessionId}`, knownFacts: { attemptId: entry.attemptId, generation: entry.generation } }))
      }
    }
  }
  const unattributed = proj.events.filter((rec) => !accountedEvents.has(rec.dedupeKey))
  if (unattributed.length > 0) {
    gaps.push(gap('SOURCE_DEGRADED', 'dispatch_attempts', { reason: `${unattributed.length} ledger row(s) attach to no planned generation (pre-planned or corrupt residue)`, knownFacts: { nodeVisitId: proj.nodeVisitId } }))
  }
  if (proj.generations.length === 0) {
    gaps.push(gap('CORRELATION_GAP', 'dispatch_attempts', { reason: 'visit present in the ledger with no attempt_planned row (legacy/foreign writer)', knownFacts: { nodeVisitId: proj.nodeVisitId } }))
  }

  // Business truth is out of scope for this index — say so explicitly instead
  // of letting the dimension silently read UNKNOWN.
  gaps.push(gap('SOURCE_ABSENT', 'svc_timeline', { reason: 'business/admission truth (svc timeline & submissions) is out of scope for the node-visit attempts index; query root=workflow_instance for that chain' }))

  // Visit-level dimension facts (multi-generation aware classifier reuse).
  observations.push(...classifyAttempt(proj))
  observations.push(observation('evidenceIntegrity', 'SOURCE_ABSENT', { ruleId: 'R7', evidenceRefs: ['svc_timeline'], note: 'business truth out of scope for this index' }))

  attemptsIndex.sort((a, b) => a.generation - b.generation || String(a.attemptId).localeCompare(String(b.attemptId)))
  return { records, correlations, gaps, observations, attemptIndex: { attempts: attemptsIndex } }
}

export function briefNodeVisit(rec) {
  if (rec.kind === 'svc_instance') return 'instance detail (visibility per caller)'
  if (rec.kind === 'attempt_index_entry') {
    const d = rec.data ?? {}
    const session = d.sessionRef !== undefined ? ` session=${d.sessionRef.agentId}/${d.sessionRef.sessionId}` : ' session=NONE'
    return `attempt gen=${d.generation} ${d.attemptId} state=${d.executionState}${session}`
  }
  return rec.kind
}
