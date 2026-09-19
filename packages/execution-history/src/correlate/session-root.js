/**
 * @agent-core/execution-history/src/correlate/session-root.js —
 * root=agent_session (Spec §4.1/§4.2): one journal + everything that points
 * at it (ASM audit rows by sessionId/messageId, attempts by
 * run_delivered.sessionId, scheduler history runs by session_id,
 * runtime-evidence invocation rows) + outbound workflow coordinates (R4).
 */

import { observation, classifySendOutcome, VERDICTS } from '../rules.js'
import { gap, correlation } from './context.js'
import { projectForViewer } from '../redact.js'

export async function buildSessionRoot(ctx, args) {
  const agentId = String(args.agentId ?? '')
  const sessionId = String(args.sessionId ?? '')
  const records = []
  const correlations = []
  const gaps = []
  const observations = []

  const loaded = ctx.journal(agentId, sessionId)
  if (loaded === null) {
    return { notFound: { code: 'session_not_found', detail: `${agentId}/${sessionId}` }, records, correlations, gaps, observations }
  }
  if (loaded.raw.readFailed !== undefined) {
    gaps.push({ code: 'SOURCE_DEGRADED', stage: 'session_journal', reason: `journal unreadable: ${loaded.raw.readFailed}` })
  }
  const view = projectForViewer({ sessionAgentId: agentId, viewerAgentId: ctx.viewer.agentId, audit: ctx.viewer.audit === true, journal: loaded.projected })
  records.push({
    source: 'session_journal', kind: 'session_view', provenanceClass: 'PRIMARY_PERSISTED',
    atMs: loaded.raw.events[0]?.timeMs ?? null,
    nativeRefs: { agentId, sessionId, file: loaded.file }, dedupeKey: `journal:${loaded.file}`, data: view,
  })

  const sessionMessageIds = new Set([...loaded.projected.spliced.map((s) => s.messageId), ...loaded.projected.messages.map((m) => m.messageId).filter(Boolean)])

  // ASM audit: rows where this session is the TARGET (inbound dispatches).
  const asm = ctx.source('asm_audit')
  const inbound = asm.records.filter((r) => r.nativeRefs.sessionId === sessionId || (r.nativeRefs.messageId !== undefined && sessionMessageIds.has(r.nativeRefs.messageId)))
  for (const row of inbound) {
    records.push(row)
    const obs = classifySendOutcome(row)
    if (obs !== null) observations.push(obs)
    if (row.nativeRefs.messageId !== undefined) {
      correlations.push(correlation('R1', { source: 'asm_audit', nativeRef: row.nativeRefs.requestId ?? row.nativeRefs.messageId }, { source: 'session_journal', nativeRef: `${agentId}/${sessionId}#${row.nativeRefs.messageId}` }, [row.nativeRefs.messageId]))
    }
  }
  if (inbound.length === 0) {
    gaps.push(gap('CORRELATION_GAP', 'inbound_dispatch', { reason: 'no ASM audit row matches this session (outside live/.1/archive window or never dispatched through agent_session_send)' }))
  }

  // Attempts delivered into this session (R3).
  for (const proj of ctx.attemptProjections()) {
    const delivered = proj.events.find((e) => e.kind === 'attempt_run_delivered')
    if (delivered === undefined || delivered.data?.sessionId !== sessionId) continue
    records.push(...proj.events.map((rec) => ({ ...rec, dedupeKey: `att:${proj.nodeVisitId}:${rec.dedupeKey}` })))
    correlations.push(correlation('R3', { source: 'attempts_ledger', nativeRef: proj.attemptId }, { source: 'session_journal', nativeRef: `${agentId}/${sessionId}` }, [proj.attemptId, sessionId]))
    if (proj.workflowInstanceId) {
      correlations.push(correlation('R4', { source: 'attempts_ledger', nativeRef: proj.attemptId }, { source: 'svc_timeline', nativeRef: `workflowInstance:${proj.workflowInstanceId}` }, [proj.workflowInstanceId]))
    }
  }

  // Scheduler runs whose session_id matches (R5; naming-convention marking).
  const history = ctx.source('scheduler_history')
  const runRecords = history.records.filter((r) => r.kind === 'run_record' && r.nativeRefs.sessionId === sessionId)
  for (const run of runRecords) {
    records.push(run)
    observations.push(observation('schedulingAdmission', VERDICTS.ADMITTED, { ruleId: 'R5', evidenceRefs: [run.nativeRefs.run_id], note: 'session_id name-based join (JOIN_BY_NAME_CONVENTION)' }))
    gaps.push(gap('JOIN_BY_NAME_CONVENTION', 'scheduler_session', { reason: `run ${run.nativeRefs.run_id} joined via session_id naming convention` }))
  }
  const historyEvents = history.records.filter((r) => r.kind !== 'run_record' && r.nativeRefs.sessionId === sessionId)
  records.push(...historyEvents)

  // Runtime-evidence invocation rows (scheduler invoker for this session).
  const evidence = ctx.source('runtime_evidence')
  for (const row of evidence.records) {
    if (row.nativeRefs.sessionId === sessionId) {
      records.push(row)
      if (row.nativeRefs.reconciliationHandle !== undefined) {
        correlations.push(correlation('R6', { source: 'runtime_evidence', nativeRef: row.nativeRefs.reconciliationHandle }, { source: 'session_journal', nativeRef: `${agentId}/${sessionId}` }, [row.nativeRefs.reconciliationHandle]))
      }
    }
  }

  // Outbound workflow coordinates from this journal (R4 bridge facts).
  for (const coord of view.workflowCoordinates ?? []) {
    if (coord.workflowInstanceId !== undefined) {
      correlations.push(correlation('R4', { source: 'session_journal', nativeRef: `${agentId}/${sessionId}#${coord.seq}` }, { source: 'svc_timeline', nativeRef: `workflowInstance:${String(coord.workflowInstanceId).toLowerCase()}` }, [String(coord.workflowInstanceId).toLowerCase()]))
    }
  }

  return { records, correlations, gaps, observations }
}

export function briefSession(rec) {
  if (rec.kind === 'session_view') return `journal ${rec.nativeRefs.agentId}/${rec.nativeRefs.sessionId} (${rec.data?.ownership ?? 'view'})`
  if (rec.source === 'asm_audit') return `send ${rec.kind} from ${rec.nativeRefs.sourceAgentId ?? '?'} (message ${rec.nativeRefs.messageId ?? 'none'})`
  if (rec.kind === 'run_record') return `scheduler run ${rec.nativeRefs.run_id} (${rec.data?.status_view ?? rec.data?.outcome ?? '?'})`
  if (rec.kind.startsWith('evidence_')) return `evidence ${rec.kind}`
  return rec.kind
}
