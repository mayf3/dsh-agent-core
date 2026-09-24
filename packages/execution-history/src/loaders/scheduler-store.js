/**
 * @agent-core/execution-history/src/loaders/scheduler-store.js — read-only
 * loader for the scheduler authority ledger jobs.json (v2/v3). History events
 * only cover occurrences from `occurrence_reserved` onward; job-level
 * admission facts (existence, enabled, routing agent) and never-reserved
 * occurrences exist ONLY here (Spec §2 G1 fix). In-runtime only: the store
 * is owner-private on disk; this loader never leaves the runtime process.
 */

import { readFileSync, existsSync, statSync } from 'node:fs'

/**
 * @returns {{ status: {status: string, reason?: string}, jobs: object[], occurrences: object[], fences: object, file?: {file, size, mtimeMs} }}
 */
export function loadSchedulerStore({ jobsStore, maxBytes = 64 * 1024 * 1024 }) {
  if (!existsSync(jobsStore)) {
    return { status: { status: 'ABSENT', reason: 'scheduler store absent' }, jobs: [], occurrences: [], fences: {} }
  }
  let raw
  try {
    const st = statSync(jobsStore)
    if (!st.isFile() || Number(st.size) > maxBytes) throw new Error('store size exceeds bound')
    raw = readFileSync(jobsStore, 'utf8')
  } catch (error) {
    return { status: { status: 'DEGRADED', reason: `scheduler store unreadable: ${error?.message ?? error}` }, jobs: [], occurrences: [], fences: {} }
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return { status: { status: 'DEGRADED', reason: `scheduler store corrupt: ${error?.message ?? error}` }, jobs: [], occurrences: [], fences: {} }
  }
  const jobs = Array.isArray(parsed?.jobs) ? parsed.jobs.filter((j) => j && typeof j === 'object') : []
  const occurrences = Array.isArray(parsed?.occurrences) ? parsed.occurrences.filter((o) => o && typeof o === 'object') : []
  // CTR-SCT-003: the unresolved-unknown fence map is persisted store data —
  // expose it (additive) so session dispositions can annotate fence state.
  const fences = parsed?.fences && typeof parsed.fences === 'object' ? parsed.fences : {}
  const st = statSync(jobsStore)
  return {
    status: { status: 'OK' },
    jobs,
    occurrences,
    fences,
    file: { file: jobsStore, size: Number(st.size), mtimeMs: Number(st.mtimeMs) },
  }
}

/** Find one job by id across the id/jobId field spellings. */
export function findJob(jobs, jobId) {
  return jobs.find((j) => j.id === jobId || j.jobId === jobId) ?? null
}

/** Occurrences of one job (or all when jobId omitted), newest first. */
export function occurrencesOf(occurrences, jobId) {
  return occurrences
    .filter((o) => jobId === undefined || o.jobId === jobId)
    .sort((a, b) => Number(b.updatedAtMs ?? b.admittedAt ?? 0) - Number(a.updatedAtMs ?? a.admittedAt ?? 0))
}

/** The routing/target agent of a job (ownership evaluation, Spec §4.2). */
export function jobRoutingAgent(job) {
  return job?.targetAgentId ?? job?.agentId ?? job?.payload?.agentId ?? job?.payload?.targetAgentId ?? null
}
