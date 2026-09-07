/**
 * @agent-core/scheduler — watchdog detectors (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1
 * §5.4–§5.7). PURE functions only: no fs, no network, no clocks beyond the
 * injected `nowMs`. The host-side runner (scripts/scheduler-watchdog.mjs) owns
 * file access, HTTP, Feishu delivery, and launchd wiring.
 *
 * Failure-domain rules baked in here:
 *   - desired-state expectations live in a SEPARATE manifest (never inside
 *     jobs.json) and join jobs by persisted logicalKey — never by name;
 *   - the watchdog is strictly READ-ONLY over the store: it classifies, it
 *     never mutates;
 *   - W2 (observer) liveness is detected by heartbeat freshness only, so the
 *     scheduler being monitored cannot hide its own watchdog's death.
 */

/** Parse + validate the desired-state manifest (schema §5.4.2). Throws TypeError. */
export function parseDesiredState(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('desired-state manifest must be an object')
  }
  if (raw.version !== 1) throw new TypeError('desired-state manifest version must be 1')
  if (!Array.isArray(raw.jobs)) throw new TypeError('desired-state manifest jobs must be an array')
  return {
    version: 1,
    jobs: raw.jobs.map((entry) => {
      if (entry === null || typeof entry !== 'object') throw new TypeError('desired job entry must be an object')
      const logicalKey = entry.logicalKey
      if (typeof logicalKey !== 'string' || logicalKey.trim() === '') {
        throw new TypeError('desired job entry requires a non-empty logicalKey')
      }
      const schedule = entry.expectedSchedule
      if (schedule === null || typeof schedule !== 'object') {
        throw new TypeError(`desired job ${logicalKey} requires expectedSchedule`)
      }
      if (!['cron', 'at', 'every'].includes(schedule.kind)) {
        throw new TypeError(`desired job ${logicalKey} expectedSchedule.kind must be cron|at|every`)
      }
      const policy = entry.runPolicy ?? {}
      return {
        logicalKey,
        expectedEnabled: entry.expectedEnabled !== false,
        expectedSchedule: {
          kind: schedule.kind,
          ...(schedule.expr !== undefined ? { expr: String(schedule.expr) } : {}),
          ...(schedule.tz !== undefined ? { tz: String(schedule.tz) } : {}),
          ...(schedule.at !== undefined ? { at: String(schedule.at) } : {}),
          ...(schedule.everyMs !== undefined ? { everyMs: Number(schedule.everyMs) } : {}),
        },
        expectedAgentId: String(entry.expectedAgentId ?? ''),
        runPolicy: {
          graceMinutes: Number.isFinite(policy.graceMinutes) ? policy.graceMinutes : 30,
          maxConsecutiveFailures: Number.isFinite(policy.maxConsecutiveFailures) ? policy.maxConsecutiveFailures : 2,
        },
      }
    }),
  }
}

function comparableSchedule(schedule) {
  if (schedule.kind === 'cron') return `cron:${schedule.expr}`
  if (schedule.kind === 'at') return `at:${schedule.at}`
  return `every:${schedule.everyMs}`
}

function normalizeStoredSchedule(stored) {
  if (stored.kind === 'cron') return { kind: 'cron', expr: stored.expr, tz: stored.tz }
  if (stored.kind === 'at') return { kind: 'at', at: stored.at }
  return { kind: 'every', everyMs: stored.everyMs }
}

/**
 * Desired-state vs live-state comparison (§5.4.3). `doc` is the RAW parsed
 * canonical store document ({jobs:[...]}); `desired` is parseDesiredState
 * output. Returns findings[] — pure classification, zero mutation.
 */
export function evaluateDesiredState(doc, desired) {
  const findings = []
  const jobs = Array.isArray(doc?.jobs) ? doc.jobs : []
  for (const entry of desired.jobs) {
    const matches = jobs.filter((job) => job.logicalKey === entry.logicalKey)
    if (matches.length === 0) {
      findings.push({ class: 'JOB_MISSING', logicalKey: entry.logicalKey })
      continue
    }
    if (matches.length > 1) {
      // Can only happen if the §5.1 uniqueness invariant was violated — that
      // alone is a finding even before any drift check.
      findings.push({ class: 'JOB_DUPLICATED', logicalKey: entry.logicalKey, jobIds: matches.map((job) => job.id) })
      continue
    }
    const job = matches[0]
    const base = { logicalKey: entry.logicalKey, jobId: job.id }
    if (entry.expectedEnabled && job.enabled !== true) {
      findings.push({ class: 'JOB_DISABLED', ...base })
    }
    const stored = normalizeStoredSchedule(job.schedule ?? {})
    const wanted = entry.expectedSchedule
    if (comparableSchedule(stored) !== comparableSchedule(wanted)) {
      findings.push({ class: 'SCHEDULE_DRIFT', ...base, expected: comparableSchedule(wanted), actual: comparableSchedule(stored) })
    } else if (stored.kind === 'cron' && (stored.tz ?? null) !== (wanted.tz ?? null)) {
      findings.push({ class: 'TIMEZONE_DRIFT', ...base, expected: wanted.tz ?? null, actual: stored.tz ?? null })
    }
    if (entry.expectedAgentId !== '' && job.agentId !== entry.expectedAgentId) {
      findings.push({ class: 'TARGET_AGENT_DRIFT', ...base, expected: entry.expectedAgentId, actual: job.agentId })
    }
  }
  return findings
}

const DEFAULTS = {
  missedGraceMs: 30 * 60 * 1000,
  failedWindowMs: 24 * 60 * 60 * 1000,
  stuckThresholdMs: 2 * 60 * 60 * 1000,
  evidenceFreshMs: 15 * 60 * 1000,
}

/**
 * Run-time reliability detection (§5.5) over the raw store document plus a
 * runtime-health snapshot supplied by the runner:
 *   { healthOk?: boolean, evidenceAgeMs?: number|null }
 *
 * EXPECTED_RUN_MISSED: an enabled job whose derived nextRunAtMs is older than
 * the missed grace — the engine advances nextRunAtMs when a slot runs, so a
 * stale past timestamp means the expected execution did not happen.
 */
export function evaluateRunHealth(doc, { nowMs, opts = {}, runtimeHealth = {} } = {}) {
  const o = { ...DEFAULTS, ...opts }
  const findings = []
  const jobs = Array.isArray(doc?.jobs) ? doc.jobs : []
  const occurrences = Array.isArray(doc?.occurrences) ? doc.occurrences : []
  for (const job of jobs) {
    const base = { jobId: job.id, logicalKey: job.logicalKey, agentId: job.agentId }
    if (job.enabled === true) {
      const nextRunAtMs = job.state?.nextRunAtMs
      const graceMs = (job.runPolicy?.graceMinutes ?? 30) * 60 * 1000
      if (Number.isFinite(nextRunAtMs) && nowMs - nextRunAtMs > Math.max(graceMs, o.missedGraceMs)) {
        findings.push({
          class: 'EXPECTED_RUN_MISSED',
          ...base,
          dueAt: new Date(nextRunAtMs).toISOString(),
          overdueMs: nowMs - nextRunAtMs,
        })
      }
    }
    const consecutiveErrors = job.state?.consecutiveErrors
    if (Number.isFinite(consecutiveErrors) && consecutiveErrors >= (o.consecutiveFailureLimit ?? 2)) {
      findings.push({ class: 'CONSECUTIVE_FAILURE', ...base, consecutiveErrors })
    }
  }
  for (const record of occurrences) {
    if (record.executionOutcome === 'failed' && Number.isFinite(record.endedAt) && nowMs - record.endedAt <= o.failedWindowMs) {
      findings.push({ class: 'RUN_FAILED', jobId: record.jobId, runId: record.runId, endedAt: new Date(record.endedAt).toISOString() })
    }
    if (Number.isFinite(record.startedAt) && !Number.isFinite(record.endedAt)
      && nowMs - record.startedAt > (record.timeoutMs ?? o.stuckThresholdMs)) {
      findings.push({ class: 'RUN_STUCK', jobId: record.jobId, runId: record.runId, startedAt: new Date(record.startedAt).toISOString() })
    }
  }
  if (runtimeHealth.healthOk === false) {
    findings.push({ class: 'SCHEDULER_RUNTIME_UNHEALTHY', reason: runtimeHealth.reason ?? 'health endpoint not ok' })
  }
  if (runtimeHealth.evidenceAgeMs === null || (Number.isFinite(runtimeHealth.evidenceAgeMs) && runtimeHealth.evidenceAgeMs > o.evidenceFreshMs)) {
    findings.push({ class: 'SCHEDULER_RUNTIME_UNHEALTHY', reason: 'runtime evidence heartbeat stale' })
  }
  return findings
}

/** W1↔W2 mutual liveness (§5.7): heartbeat freshness is the only signal. */
export function heartbeatStale(mtimeMs, nowMs, graceMs) {
  if (!Number.isFinite(mtimeMs)) return true
  return nowMs - mtimeMs > graceMs
}

/** Human-readable, secret-free Owner alert text for a batch of findings. */
export function formatFindings(findings, { role = 'W1', nowMs = Date.now() } = {}) {
  const lines = findings.map((f) => {
    const coordinates = [f.logicalKey, f.jobId, f.runId].filter(Boolean).join(' ')
    const detail = f.detail ?? f.reason
      ?? (f.expected !== undefined || f.actual !== undefined ? `expected=${f.expected} actual=${f.actual}` : '')
    return `- ${f.class}${coordinates ? ` [${coordinates}]` : ''}${detail ? ` ${detail}` : ''}`
  })
  return `Scheduler watchdog ${role} alert @ ${new Date(nowMs).toISOString()}\n${lines.join('\n')}`
}
