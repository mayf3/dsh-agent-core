/**
 * @agent-core/execution-history/src/correlate/workflow-root.js — root=workflow_instance
 * (Spec §4.1): svc detail/timeline/submissions (per-caller credential, svc
 * visibility decides) + local attempts ledger + correlated sessions (index) +
 * ASM audit rows for the dispatch messages. Admission narrative comes from
 * the svc timeline; activation/closure tables have no read endpoint
 * (SOURCE_ABSENT, R4/F6).
 */

import { fetchInstanceDetail, fetchTimelineAll, fetchSubmissions, timelineToRecords, svcFailureGap } from '../loaders/svc-facts.js'
import { observation, classifyAttempt, classifySvcEvents, classifySendOutcome, VERDICTS } from '../rules.js'
import { gap, correlation, timelineEntry } from './context.js'
import { projectForViewer } from '../redact.js'

const lower = (v) => String(v ?? '').toLowerCase()

export async function buildWorkflowRoot(ctx, args) {
  const workflowInstanceId = String(args.workflowInstanceId ?? '').toLowerCase()
  const records = []
  const correlations = []
  const gaps = []
  const observations = []
  let svcDetail = null

  if (ctx.svcRequest !== null) {
    const detail = await fetchInstanceDetail(ctx.svcRequest, ctx.viewer.agentId, workflowInstanceId)
    if (detail.ok) {
      svcDetail = detail.body
      records.push({
        source: 'svc_detail', kind: 'svc_instance', provenanceClass: 'PRIMARY_PERSISTED',
        atMs: Date.parse(svcDetail?.detail?.createdAt ?? svcDetail?.createdAt ?? '') || null,
        nativeSeq: undefined, nativeRefs: { workflowInstanceId }, dedupeKey: `svc:detail:${workflowInstanceId}`,
        data: svcDetail,
      })
      ctx._sources.set('svc_detail', { status: { status: 'OK' }, files: [], rowsRead: 1 })
    } else {
      gaps.push(svcFailureGap(detail, 'svc_instance_detail'))
      ctx._sources.set('svc_detail', { status: { status: 'ABSENT', reason: detail.code }, files: [], rowsRead: 0 })
    }
    const timeline = await fetchTimelineAll(ctx.svcRequest, ctx.viewer.agentId, workflowInstanceId, {})
    if (timeline.error !== null && timeline.error !== undefined) {
      gaps.push(svcFailureGap(timeline.error, 'svc_timeline'))
      ctx._sources.set('svc_timeline', { status: { status: 'ABSENT', reason: timeline.error.code }, files: [], rowsRead: 0 })
    } else {
      const timelineRecords = timelineToRecords(timeline.items)
      records.push(...timelineRecords)
      if (timeline.truncated) gaps.push(gap('TRUNCATED', 'svc_timeline', { reason: 'timeline page cap reached' }))
      observations.push(...classifySvcEvents(timelineRecords))
      ctx._sources.set('svc_timeline', { status: { status: timeline.truncated ? 'DEGRADED' : 'OK', truncated: timeline.truncated }, files: [], rowsRead: timelineRecords.length })
    }
    const submissions = await fetchSubmissions(ctx.svcRequest, ctx.viewer.agentId, workflowInstanceId, {})
    if (submissions.ok) {
      records.push({
        source: 'svc_submissions', kind: 'svc_submissions', provenanceClass: 'PRIMARY_PERSISTED',
        atMs: null, nativeRefs: { workflowInstanceId }, dedupeKey: `svc:submissions:${workflowInstanceId}`,
        data: submissions.body,
      })
      ctx._sources.set('svc_submissions', { status: { status: 'OK' }, files: [], rowsRead: 1 })
    } else {
      gaps.push(svcFailureGap(submissions, 'svc_submissions'))
      ctx._sources.set('svc_submissions', { status: { status: 'ABSENT', reason: submissions.code }, files: [], rowsRead: 0 })
    }
  } else {
    gaps.push(gap('SOURCE_ABSENT', 'svc', { reason: 'svc transport unavailable in this context' }))
    for (const name of ['svc_detail', 'svc_timeline', 'svc_submissions']) {
      ctx._sources.set(name, { status: { status: 'ABSENT', reason: 'svc transport unavailable' }, files: [], rowsRead: 0 })
    }
  }

  // Local attempts (R2: identity-triple scan is authoritative).
  const attempts = ctx.attemptProjections().filter((proj) => lower(proj.workflowInstanceId) === workflowInstanceId)
  const attemptMessageIds = []
  for (const proj of attempts) {
    records.push(...proj.events.map((rec) => ({ ...rec, dedupeKey: `att:${proj.nodeVisitId}:${rec.dedupeKey}` })))
    observations.push(...classifyAttempt(proj))
    correlations.push(correlation('R2', { source: 'svc_timeline', nativeRef: `nodeVisit:${proj.nodeVisitId}` }, { source: 'attempts_ledger', nativeRef: proj.attemptId }, [proj.attemptId]))
    const delivered = proj.events.find((e) => e.kind === 'attempt_run_delivered')
    if (typeof delivered?.data?.messageId === 'string') attemptMessageIds.push(delivered.data.messageId)
    if (delivered !== undefined && typeof delivered.data?.sessionId === 'string') {
      correlations.push(correlation('R3', { source: 'attempts_ledger', nativeRef: proj.attemptId }, { source: 'session_journal', nativeRef: `${delivered.data.agentId ?? proj.ownerPrincipalId}/${delivered.data.sessionId}` }, [proj.attemptId, delivered.data.sessionId]))
    }
  }
  if (attempts.length === 0) {
    gaps.push(gap('CORRELATION_GAP', 'dispatch_attempts', { reason: 'no attempts-ledger attempt for this instance (visit dispatch may predate the ledger or was never engine-dispatched — G6)', knownFacts: { workflowInstanceId } }))
  }

  // Correlated sessions via the index (G5/G7: the coordinate anchor).
  const sessionEntries = ctx.sessionsMatching((lookups) => lookups.byWorkflowInstanceId(workflowInstanceId))
  const seenSidecar = sessionEntries.some((entry) => entry.coordinates.hasWorkflowExecutionSidecar)
  if (attempts.length > 0 && !seenSidecar) {
    gaps.push(gap('CORRELATION_GAP', 'message_sidecar', { reason: 'no workflow_execution source sidecar found in correlated sessions (V2 seam not exercised on this dispatch — reported, never inferred)' }))
  }
  for (const entry of sessionEntries) {
    const loaded = ctx.journal(entry.agentId, entry.sessionId)
    if (loaded === null) { gaps.push(gap('SOURCE_DEGRADED', 'session_journal', { reason: `journal unresolvable: ${entry.agentId}/${entry.sessionId}` })); continue }
    if (loaded.raw.readFailed !== undefined) {
      gaps.push(gap('SOURCE_DEGRADED', 'session_journal', { reason: `journal unreadable: ${entry.agentId}/${entry.sessionId}: ${loaded.raw.readFailed}` }))
      continue
    }
    const view = projectForViewer({ sessionAgentId: entry.agentId, viewerAgentId: ctx.viewer.agentId, audit: ctx.viewer.audit === true, journal: loaded.projected })
    records.push({
      source: 'session_journal', kind: 'session_view', provenanceClass: 'PRIMARY_PERSISTED',
      atMs: loaded.raw.events[0]?.timeMs ?? null, nativeRefs: { agentId: entry.agentId, sessionId: entry.sessionId, file: entry.file },
      dedupeKey: `journal:${entry.file}`, data: view,
    })
    for (const coord of view.workflowCoordinates ?? []) {
      if (lower(coord.workflowInstanceId) !== workflowInstanceId) continue
      const version = coord.workflowStateVersion ?? coord.expectedWorkflowStateVersion
      if (version !== undefined) {
        correlations.push(correlation('R4', { source: 'session_journal', nativeRef: `${entry.agentId}/${entry.sessionId}#${coord.seq}` }, { source: 'svc_timeline', nativeRef: `stateVersion:${version}` }, [workflowInstanceId]))
      }
    }
  }

  // ASM audit rows for the dispatch messages (R1/R3 reverse join).
  const asmByMessage = ctx.asmRowsByMessage()
  for (const messageId of attemptMessageIds) {
    for (const row of asmByMessage.get(messageId) ?? []) {
      records.push(row)
      observations.push(classifySendOutcome(row))
      correlations.push(correlation('R1', { source: 'attempts_ledger', nativeRef: row.nativeRefs.requestId ?? messageId }, { source: 'asm_audit', nativeRef: messageId }, [messageId]))
    }
  }

  // Admission dimension from the svc timeline facts we hold.
  if (records.some((r) => r.source === 'svc_timeline' && /CREATED|IMPORTED/.test(r.kind.toUpperCase()))) {
    observations.push(observation('schedulingAdmission', VERDICTS.ADMITTED, { ruleId: 'R4', evidenceRefs: [workflowInstanceId] }))
  }
  observations.push(observation('schedulingAdmission', VERDICTS.NOT_APPLICABLE, { ruleId: 'R4', evidenceRefs: [], note: 'activation/closure tables have no read endpoint (SOURCE_ABSENT per R4/F6)' }))

  return { records, correlations, gaps, observations }
}

export function briefWorkflow(rec) {
  if (rec.kind === 'svc_instance') return 'instance detail (visibility per caller)'
  if (rec.kind === 'svc_submissions') return 'submission history'
  if (rec.source === 'session_journal') return `session ${rec.nativeRefs.agentId}/${rec.nativeRefs.sessionId}`
  if (rec.source === 'svc_timeline') return `${rec.kind} @ event_sequence=${rec.nativeSeq ?? '?'}`
  if (rec.source === 'asm_audit') return `send ${rec.kind} → ${rec.nativeRefs.targetAgentId ?? '?'} (message ${rec.nativeRefs.messageId ?? 'none'})`
  return rec.kind
}

export { timelineEntry }
