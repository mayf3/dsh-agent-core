/**
 * @agent-core/execution-history/src/correlate/scheduler-root.js —
 * root=scheduler_run (Spec §4.1): job admission facts from the authority
 * ledger (jobs.json — the only source for never-reserved occurrences),
 * history events/run records, correlated cron-run sessions via the index,
 * runtime-evidence invocation rows, and wake_sent workflow links.
 */

import { observation, classifySendOutcome, VERDICTS } from '../rules.js'
import { gap, correlation } from './context.js'
import { projectForViewer } from '../redact.js'

const RUN_ID_PREFIX = 'run:'

export async function buildSchedulerRoot(ctx, args) {
  const records = []
  const correlations = []
  const gaps = []
  const observations = []

  const store = ctx.source('scheduler_store')
  if (store.status.status === 'ABSENT') {
    gaps.push(gap('SOURCE_ABSENT', 'scheduler_store', { reason: store.status.reason }))
  }
  const history = ctx.source('scheduler_history')

  let jobId = typeof args.jobId === 'string' ? args.jobId : undefined
  let occurrenceId = typeof args.occurrenceId === 'string' ? args.occurrenceId : undefined
  if (typeof args.runId === 'string') {
    if (args.runId.startsWith(RUN_ID_PREFIX)) occurrenceId = args.runId.slice(RUN_ID_PREFIX.length)
    else occurrenceId = args.runId
  }

  // Resolve occurrence → job when only finer coordinates were given.
  if (jobId === undefined && occurrenceId !== undefined) {
    const occ = store.occurrences.find((o) => o.occurrenceId === occurrenceId)
    if (occ !== undefined) jobId = occ.jobId
    else {
      const runRecord = history.records.find((r) => r.kind === 'run_record' && r.nativeRefs.occurrence_id === occurrenceId)
      if (runRecord !== undefined) jobId = runRecord.nativeRefs.job_id
    }
  }

  const job = jobId !== undefined ? ctx.schedulerHelpers.findJob(store.jobs, jobId) : null
  if (job === null && occurrenceId === undefined) {
    return { notFound: { code: 'scheduler_record_not_found', detail: `job ${jobId ?? '(none)'}` }, records, correlations, gaps, observations }
  }

  // Job admission facts (exists even when no occurrence was ever reserved).
  if (job !== null) {
    records.push({
      source: 'scheduler_store', kind: 'job_definition', provenanceClass: 'PRIMARY_PERSISTED',
      atMs: Number.isFinite(job.createdAtMs) ? job.createdAtMs : null,
      nativeRefs: { job_id: job.id ?? job.jobId, ...(jobRouting(job) ? { agentId: jobRouting(job) } : {}) },
      dedupeKey: `job:${job.id ?? job.jobId}`, data: summarizeJob(job),
    })
    observations.push(observation('schedulingAdmission', job.enabled === false ? VERDICTS.LEGAL_SKIP : VERDICTS.ADMITTED, { ruleId: 'R5', evidenceRefs: [String(job.id ?? job.jobId)], note: job.enabled === false ? 'job disabled' : 'job definition present in authority ledger' }))
  }

  const occurrences = occurrenceId !== undefined
    ? ctx.schedulerHelpers.occurrencesOf(store.occurrences).filter((o) => o.occurrenceId === occurrenceId)
    : (jobId !== undefined ? ctx.schedulerHelpers.occurrencesOf(store.occurrences, jobId).slice(0, 50) : [])
  if (occurrenceId !== undefined && occurrences.length === 0) {
    gaps.push(gap('SOURCE_ABSENT', 'scheduler_store', { reason: `occurrence ${occurrenceId} not in authority ledger (never reserved here, or store since rotated)` }))
  }
  for (const occ of occurrences) {
    records.push({
      source: 'scheduler_store', kind: 'occurrence', provenanceClass: 'PRIMARY_PERSISTED',
      atMs: Number.isFinite(occ.admittedAt) ? occ.admittedAt : Number.isFinite(occ.updatedAtMs) ? occ.updatedAtMs : null,
      nativeRefs: { occurrence_id: occ.occurrenceId, job_id: occ.jobId, ...(occ.nativeSessionId ? { sessionId: occ.nativeSessionId } : {}) },
      dedupeKey: `occ:${occ.occurrenceId}:${occ.updatedAtMs ?? ''}`,
      data: summarizeOccurrence(occ),
    })
  }

  // History events + run records for the resolved coordinates.
  const occurrenceIds = new Set(occurrences.map((o) => o.occurrenceId))
  for (const rec of history.records) {
    const matches = (rec.nativeRefs.occurrence_id !== undefined && occurrenceIds.has(rec.nativeRefs.occurrence_id))
      || (rec.kind === 'run_record' && jobId !== undefined && rec.nativeRefs.job_id === jobId && occurrences.length === 0)
    if (!matches) continue
    records.push(rec)
    if (rec.kind === 'run_record') {
      const outcome = rec.data?.outcome ?? rec.data?.status_view
      observations.push(observation('agentExecution', outcome === 'succeeded' ? VERDICTS.REPLIED : outcome === 'failed' ? VERDICTS.FAILED : outcome === 'outcome_unknown' ? VERDICTS.OUTCOME_UNKNOWN : VERDICTS.UNKNOWN, { ruleId: 'R5', evidenceRefs: [rec.nativeRefs.run_id] }))
      if (rec.nativeRefs.sessionId !== undefined) {
        gaps.push(gap('JOIN_BY_NAME_CONVENTION', 'scheduler_session', { reason: `run ${rec.nativeRefs.run_id} joined via session_id naming convention` }))
      }
      for (const wake of Array.isArray(rec.data?.result?.wake_sent) ? rec.data.result.wake_sent : []) {
        if (typeof wake.workflow_instance_id === 'string') {
          correlations.push(correlation('R5', { source: 'scheduler_history', nativeRef: rec.nativeRefs.run_id }, { source: 'svc_timeline', nativeRef: `workflowInstance:${wake.workflow_instance_id.toLowerCase()}` }, [wake.workflow_instance_id]))
        }
      }
    } else if (rec.kind === 'history_occurrence_reserved') {
      observations.push(observation('schedulingAdmission', VERDICTS.ADMITTED, { ruleId: 'R5', evidenceRefs: [rec.nativeRefs.occurrence_id ?? ''] }))
    } else if (rec.kind === 'history_run_terminal' && String(rec.data?.outcome ?? '') === 'outcome_unknown') {
      observations.push(observation('agentExecution', VERDICTS.OUTCOME_UNKNOWN, { ruleId: 'R5', evidenceRefs: [rec.nativeRefs.run_id ?? ''], note: 'outcome_unknown ≠ no side effects' }))
    }
  }

  // Correlated cron-run sessions (index; name-derived + content coordinate).
  if (occurrenceIds.size > 0) {
    for (const occId of [...occurrenceIds].slice(0, 10)) {
      for (const entry of ctx.sessionsMatching((lookups) => lookups.byCronOccurrence(occId))) {
        const loaded = ctx.journal(entry.agentId, entry.sessionId)
        if (loaded === null) continue
        const view = projectForViewer({ sessionAgentId: entry.agentId, viewerAgentId: ctx.viewer.agentId, audit: ctx.viewer.audit === true, journal: loaded.projected })
        records.push({
          source: 'session_journal', kind: 'session_view', provenanceClass: 'PRIMARY_PERSISTED',
          atMs: loaded.raw.events[0]?.timeMs ?? null, nativeRefs: { agentId: entry.agentId, sessionId: entry.sessionId, file: entry.file },
          dedupeKey: `journal:${entry.file}`, data: view,
        })
        observations.push(observation('agentExecution', view.turns?.length > 0 ? VERDICTS.STARTED : VERDICTS.UNKNOWN, { ruleId: 'R5', evidenceRefs: [`${entry.agentId}/${entry.sessionId}`], note: 'cron-run session located by naming convention + occurrence coordinate' }))
        const asmByMessage = ctx.asmRowsByMessage()
        for (const spliced of loaded.projected.spliced.slice(0, 50)) {
          for (const row of asmByMessage.get(spliced.messageId) ?? []) {
            records.push(row)
            const obs = classifySendOutcome(row)
            if (obs !== null) observations.push(obs)
          }
        }
        correlations.push(correlation('R5', { source: 'scheduler_store', nativeRef: occId }, { source: 'session_journal', nativeRef: `${entry.agentId}/${entry.sessionId}` }, [occId, entry.sessionId]))
      }
    }
  }

  // Runtime-evidence invocation rows.
  const evidence = ctx.source('runtime_evidence')
  for (const row of evidence.records) {
    const occ = row.nativeRefs.occurrenceId ?? row.data?.occurrenceId
    if (occ === undefined && row.kind !== 'evidence_invocation') continue
    if (occ !== undefined && occurrenceIds.size > 0 && !occurrenceIds.has(occ)) continue
    records.push(row)
  }

  return { records, correlations, gaps, observations }
}

function jobRouting(job) {
  return job?.targetAgentId ?? job?.agentId ?? job?.payload?.agentId ?? job?.payload?.targetAgentId ?? null
}

function summarizeJob(job) {
  return {
    id: job.id ?? job.jobId,
    name: job.name,
    agentId: jobRouting(job),
    enabled: job.enabled,
    schedule: job.schedule ?? job.cronExpr ?? job.cron_expr ?? null,
    deleteAfterRun: job.deleteAfterRun,
    payloadKeys: job.payload && typeof job.payload === 'object' ? Object.keys(job.payload) : [],
  }
}

function summarizeOccurrence(occ) {
  return {
    occurrenceId: occ.occurrenceId,
    jobId: occ.jobId,
    agentId: occ.agentId,
    scheduleRevision: occ.scheduleRevision,
    state: occ.state,
    fenced: occ.fenced,
    retryOfOccurrenceId: occ.retryOfOccurrenceId,
    nativeSessionId: occ.nativeSessionId,
    executionOutcome: occ.executionOutcome,
    deliveryStatus: occ.deliveryStatus,
    startedAt: occ.startedAt,
    endedAt: occ.endedAt,
  }
}
