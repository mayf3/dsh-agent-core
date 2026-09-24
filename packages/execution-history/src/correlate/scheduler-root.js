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
  // CTR-SCT-007: occurrences whose session journal was NOT found but whose
  // disposition says a session should exist — they owe an honest
  // CORRELATION_GAP once the session sweep below has completed.
  const pendingJournalGaps = new Map()
  const journalsFound = new Set()
  // B1: per-occurrence authoritative routed/owning agent. A session join may
  // only be promoted when the located journal's agent EXACTLY equals this —
  // a foreign agent's journal can never become the SessionRef (SC-2).
  const expectedAgents = new Map()

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
  // §5: the EXISTENCE of an enabled job proves nothing about any specific
  // run's admission — it is a timeline fact, not a per-run verdict. Only a
  // DISABLED gate yields a verdict (LEGAL_SKIP), because it bounds every run.
  if (job !== null) {
    records.push({
      source: 'scheduler_store', kind: 'job_definition', provenanceClass: 'PRIMARY_PERSISTED',
      atMs: Number.isFinite(job.createdAtMs) ? job.createdAtMs : null,
      nativeRefs: { job_id: job.id ?? job.jobId, ...(jobRouting(job) ? { agentId: jobRouting(job) } : {}) },
      dedupeKey: `job:${job.id ?? job.jobId}`, data: summarizeJob(job),
    })
    if (job.enabled === false) {
      observations.push(observation('schedulingAdmission', VERDICTS.LEGAL_SKIP, { ruleId: 'R5', evidenceRefs: [String(job.id ?? job.jobId)], note: 'job disabled — no run of it can be admitted while disabled' }))
    }
  }

  const occurrences = occurrenceId !== undefined
    ? ctx.schedulerHelpers.occurrencesOf(store.occurrences).filter((o) => o.occurrenceId === occurrenceId)
    : (jobId !== undefined ? ctx.schedulerHelpers.occurrencesOf(store.occurrences, jobId).slice(0, 50) : [])
  if (occurrenceId !== undefined && occurrences.length === 0) {
    gaps.push(gap('SOURCE_ABSENT', 'scheduler_store', { reason: `occurrence ${occurrenceId} not in authority ledger (never reserved here, or store since rotated)` }))
  }
  for (const occ of occurrences) {
    // B1: authoritative owner = occurrence owner agent, else the job's
    // routing agent (definition-time fixed).
    expectedAgents.set(occ.occurrenceId, occ.agentId ?? occ.ownerAgentId ?? (job ? jobRouting(job) : undefined))
    // CTR-SCT-003: the session disposition is derived ONLY from persisted
    // fields. A not_created occurrence must never expose its designated
    // session id as a coordinate (SC-1: no fabricated sessionId).
    const disposition = sessionDispositionOf(occ)
    records.push({
      source: 'scheduler_store', kind: 'occurrence', provenanceClass: 'PRIMARY_PERSISTED',
      atMs: Number.isFinite(occ.admittedAt) ? occ.admittedAt : Number.isFinite(occ.updatedAtMs) ? occ.updatedAtMs : null,
      nativeRefs: {
        occurrence_id: occ.occurrenceId, job_id: occ.jobId,
        ...(disposition.sessionCreated !== 'not_created' && occ.nativeSessionId ? { sessionId: occ.nativeSessionId } : {}),
      },
      dedupeKey: `occ:${occ.occurrenceId}:${occ.updatedAtMs ?? ''}`,
      data: summarizeOccurrence(occ, store.fences, disposition),
    })
  }

  // History events + run records for the resolved coordinates.
  // §二 scoping: when the query names ONE occurrence, records of sibling
  // occurrences of the same job never enter the timeline — not even when the
  // authority ledger is unreadable (the store-absent world must WIDEN THE
  // GAP, never the result set). The job-wide run_record projection applies
  // ONLY to job-level queries.
  const occurrenceScoped = occurrenceId !== undefined
  const occurrenceIds = new Set(occurrences.map((o) => o.occurrenceId))
  for (const rec of history.records) {
    // C3 (GitHub fresh review @ d25ae108): an occurrence-scoped query whose
    // ledger row has rotated away must STILL surface its exact history
    // run_record — otherwise the session answer (join or honest gap) is
    // silently omitted. Sibling runs are still excluded (exact-id compare).
    const rotatedExact = occurrenceScoped && rec.kind === 'run_record' && rec.nativeRefs.occurrence_id === occurrenceId
    const matches = rotatedExact
      || (rec.nativeRefs.occurrence_id !== undefined && occurrenceIds.has(rec.nativeRefs.occurrence_id))
      || (rec.kind === 'run_record' && !occurrenceScoped && jobId !== undefined && rec.nativeRefs.job_id === jobId && occurrences.length === 0)
    if (!matches) continue
    records.push(rec)
    if (rec.kind === 'run_record') {
      const outcome = rec.data?.outcome ?? rec.data?.status_view
      observations.push(observation('agentExecution', outcome === 'succeeded' ? VERDICTS.REPLIED : outcome === 'failed' ? VERDICTS.FAILED : outcome === 'outcome_unknown' ? VERDICTS.OUTCOME_UNKNOWN : VERDICTS.UNKNOWN, { ruleId: 'R5', evidenceRefs: [rec.nativeRefs.run_id] }))
      // CTR-SCT-007: disposition-aware session linkage. A ledger disposition
      // of not_created suppresses any session expectation entirely; otherwise
      // a run whose journal never surfaces owes an explicit gap AFTER the
      // session sweep below (never a silent success, never a name-only claim).
      const ledgerOcc = store.occurrences.find((o) => o.occurrenceId === rec.nativeRefs.occurrence_id)
      const disposition = ledgerOcc !== undefined
        ? sessionDispositionOf(ledgerOcc)
        : conservativeDispositionFromOutcome(outcome)
      if (rec.nativeRefs.sessionId !== undefined && disposition.sessionCreated !== 'not_created') {
        const occKey = rec.nativeRefs.occurrence_id ?? rec.nativeRefs.run_id
        pendingJournalGaps.set(occKey, {
          runId: rec.nativeRefs.run_id, sessionId: rec.nativeRefs.sessionId,
        })
        // B1: history-only worlds have no ledger row; the run record itself
        // carries the routed agent (run_record.agent_id) — else unknown.
        if (!expectedAgents.has(occKey)) expectedAgents.set(occKey, rec.data?.agent_id)
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
  // When the authority ledger is outside the readable boundary, the
  // occurrence coordinate itself still drives the name-convention join —
  // degraded, but never silently empty.
  const sessionOccurrenceIds = occurrenceIds.size > 0
    ? [...occurrenceIds].slice(0, 10)
    : (occurrenceId !== undefined ? [occurrenceId] : [])
  for (const occId of sessionOccurrenceIds) {
      // B1: the routed/owning agent must be provable; without it there is no
      // lawful exact join (and nothing to sweep for this occurrence). In
      // ledger-absent worlds the persisted history run_record itself carries
      // the routed agent (agent_id) — a PRIMARY_PERSISTED owner proof.
      let expectedAgent = expectedAgents.get(occId)
      if (expectedAgent === undefined) {
        const histRun = history.records.find((rec) => rec.kind === 'run_record' && rec.nativeRefs.occurrence_id === occId)
        expectedAgent = histRun?.data?.agent_id
        if (expectedAgent !== undefined) expectedAgents.set(occId, expectedAgent)
      }
      if (expectedAgent === undefined) continue
      for (const entry of ctx.sessionsMatching((lookups) => lookups.byCronOccurrence(occId))) {
        // B1: foreign-agent journals never join, even when the decoded
        // sessionId would match the canonical form exactly.
        if (entry.agentId !== expectedAgent) continue
        const loaded = ctx.journal(entry.agentId, entry.sessionId)
        if (loaded === null) continue
        journalsFound.add(occId)
        const view = projectForViewer({ sessionAgentId: entry.agentId, viewerAgentId: ctx.viewer.agentId, audit: ctx.viewer.audit === true, journal: loaded.projected })
        records.push({
          source: 'session_journal', kind: 'session_view', provenanceClass: 'PRIMARY_PERSISTED',
          atMs: loaded.raw.events[0]?.timeMs ?? null, nativeRefs: { agentId: entry.agentId, sessionId: entry.sessionId, file: entry.file },
          dedupeKey: `journal:${entry.file}`, data: view,
        })
        observations.push(observation('agentExecution', view.turns?.length > 0 ? VERDICTS.STARTED : VERDICTS.UNKNOWN, { ruleId: 'R5', evidenceRefs: [`${entry.agentId}/${entry.sessionId}`], note: 'cron-run session located by deterministic derivation + journal existence proof (CTR-SCT-007)' }))
        const asmByMessage = ctx.asmRowsByMessage()
        for (const spliced of loaded.projected.spliced.slice(0, 50)) {
          for (const row of asmByMessage.get(spliced.messageId) ?? []) {
            records.push(row)
            const obs = classifySendOutcome(row)
            if (obs !== null) observations.push(obs)
          }
        }
        correlations.push({
          rule: 'R5',
          // CTR-SCT-007 / D-SCT-5: the cron-run-<occ> id is a deterministic
          // derivation from the occurrence coordinate; the located journal is
          // the EXISTENCE PROOF, so this join is DERIVED_EXACT — no longer a
          // weak name convention. When no journal exists the honest
          // CORRELATION_GAP below stands instead.
          from: { source: occurrenceIds.has(occId) ? 'scheduler_store' : 'query_coordinate', nativeRef: occId },
          to: { source: 'session_journal', nativeRef: `${entry.agentId}/${entry.sessionId}` },
          evidenceRefs: [occId, entry.sessionId],
          strength: 'DERIVED_EXACT',
        })
      }
  }

  // CTR-SCT-007 (review round-1 blocker closure): the journal sweep above is
  // bounded (newest-N occurrences, per-session caps). Every run_record that
  // still owes a session answer but was never swept — occurrence rotation,
  // runs beyond the sweep window, ledger-absent history-only worlds — must
  // still emit its honest gap here; a bounded sweep must never silently
  // swallow the SC-2 gap. (Single flush point after the sweep; journalsFound
  // marks the proven entries.)
  for (const [occId, pending] of pendingJournalGaps) {
    if (journalsFound.has(occId)) continue
    gaps.push(gap('CORRELATION_GAP', 'session_journal', {
      stage: 'session_journal',
      knownFacts: { occurrenceId: occId, runId: pending.runId, designatedSessionId: pending.sessionId, expectedAgentId: expectedAgents.get(occId) ?? null, reason: 'run recorded a session coordinate but no owner-matching session journal was located within this query\'s sweep bound — existence unproven (SC-2, never claimed exact)' },
    }))
  }

  // Runtime-evidence invocation rows: included ONLY on an explicit coordinate
  // match — an invocation without coordinates, or one belonging to another
  // occurrence/job, is never pulled in by default (§二). When nothing can be
  // matched the SOURCE_ABSENT/DEGRADED gap stands as-is.
  const evidence = ctx.source('runtime_evidence')
  for (const row of evidence.records) {
    const occ = row.nativeRefs.occurrenceId ?? row.data?.occurrenceId
    const rowJob = row.nativeRefs.jobId ?? row.data?.jobId
    const included = occurrenceScoped
      ? (occ !== undefined && (occ === occurrenceId || occurrenceIds.has(occ)))
      : (occurrenceIds.size > 0
          ? (occ !== undefined && occurrenceIds.has(occ))
          : (jobId !== undefined && rowJob === jobId))
    if (!included) continue
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

function summarizeOccurrence(occ, fences, disposition) {
  const resolved = disposition ?? sessionDispositionOf(occ)
  return {
    occurrenceId: occ.occurrenceId,
    jobId: occ.jobId,
    agentId: occ.agentId,
    scheduleRevision: occ.scheduleRevision,
    state: occ.state,
    fenced: fences?.[occ.jobId] !== undefined,
    retryOfOccurrenceId: occ.retryOfOccurrenceId,
    nativeSessionId: resolved.sessionCreated === 'not_created' ? null : (occ.nativeSessionId ?? null),
    executionOutcome: occ.executionOutcome,
    deliveryStatus: occ.deliveryStatus,
    startedAt: occ.startedAt,
    endedAt: occ.endedAt,
    ...(occ.terminalEvidence !== undefined ? { terminalEvidence: occ.terminalEvidence } : {}),
    sessionCreated: resolved.sessionCreated,
    ...(resolved.sessionNotCreatedReason !== undefined ? { sessionNotCreatedReason: resolved.sessionNotCreatedReason } : {}),
    terminationSettled: occ.terminationSettlement !== undefined,
  }
}

// SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 CTR-SCT-003 — frozen disposition
// table over persisted occurrence fields ONLY. Keep semantics-identical with
// packages/scheduler/src/self-service/projections.js sessionDispositionOf();
// equivalence is asserted by tests. Exported for that equivalence test only.
export function sessionDispositionOf(record) {
  const kind = record?.terminalEvidence?.kind
  if (record?.state === 'failed' && kind === 'pre-start-rejection') {
    return { sessionCreated: 'not_created', sessionNotCreatedReason: 'pre-start-rejection' }
  }
  if (record?.state === 'succeeded' || record?.state === 'running') return { sessionCreated: 'created' }
  if (record?.state === 'failed' && kind === 'turn-terminal') return { sessionCreated: 'created' }
  if (record?.state === 'admitted') return { sessionCreated: 'pending' }
  return { sessionCreated: 'unknown' }
}

// History-only run records (ledger outside the readable boundary) carry no
// terminalEvidence, so the table degrades conservatively: `failed` cannot
// prove pre-start (unknown), only a plain `succeeded` reads as created —
// with the documented canary-invoker limitation (Spec CTR-SCT-003).
function conservativeDispositionFromOutcome(outcome) {
  if (outcome === 'succeeded') return { sessionCreated: 'created' }
  return { sessionCreated: 'unknown' }
}
