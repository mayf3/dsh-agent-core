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
 * and optionally the parsed desired-state manifest (per-job runPolicy grace).
 *
 * EXPECTED_RUN_MISSED: an enabled job whose derived nextRunAtMs is older than
 * the missed grace — the engine advances nextRunAtMs when a slot runs, so a
 * stale past timestamp means the expected execution did not happen.
 */
export function evaluateRunHealth(doc, { nowMs, opts = {}, runtimeHealth = {}, desired } = {}) {
  const o = { ...DEFAULTS, ...opts }
  const graceByLogicalKey = new Map(
    (desired?.jobs ?? []).map((entry) => [entry.logicalKey, entry.runPolicy?.graceMinutes]),
  )
  const findings = []
  const jobs = Array.isArray(doc?.jobs) ? doc.jobs : []
  const occurrences = Array.isArray(doc?.occurrences) ? doc.occurrences : []
  for (const job of jobs) {
    const base = { jobId: job.id, logicalKey: job.logicalKey, agentId: job.agentId }
    if (job.enabled === true) {
      const nextRunAtMs = job.state?.nextRunAtMs
      // Explicit grace (manifest runPolicy, then store job) wins; the global
      // default applies only when nothing is pinned — an Owner-tightened grace
      // must not be silently floored back to 30 minutes.
      const pinnedGraceMinutes = graceByLogicalKey.get(job.logicalKey) ?? job.runPolicy?.graceMinutes
      const graceMs = pinnedGraceMinutes !== undefined ? pinnedGraceMinutes * 60 * 1000 : o.missedGraceMs
      if (Number.isFinite(nextRunAtMs) && nowMs - nextRunAtMs > graceMs) {
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
    // An operator-reconciled failure is a dispositioned fact, not an open
    // incident (2026-09-09: reconciled occ 6c4cccaf… kept emitting bounded
    // REMINDERs for its whole 24h window after disposition). Suppression is
    // scoped to basis=operator-reconcile — the run-event ledger carries the
    // late_settlement evidence, and the finding vanishing from the next
    // evaluation flips an ACTIVE alert to one final RECOVERED.
    const operatorReconciled = record.lateSettlement?.basis === 'operator-reconcile'
    if (!operatorReconciled && record.executionOutcome === 'failed' && Number.isFinite(record.endedAt) && nowMs - record.endedAt <= o.failedWindowMs) {
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
  // evidence-heartbeat staleness is deliberately NOT a finding (2026-09-09:
  // the evidence log only gains entries on activity, so quiet nights trip it
  // forever — flapping NEW/RECOVERED every cycle). Runtime liveness is
  // authoritatively carried by the health probe above.
  void o.evidenceFreshMs
  return findings
}

/**
 * §5.6 credential-provider self-probe (audit FOLLOW_UP closure): the
 * credential file is the input to EVERY scheduler mutation (its absence makes
 * all mutations capability_unavailable), so W1 watches it directly — exists
 * and non-empty. Never reads or logs bytes.
 */
export function evaluateCredentialProvider(probe, { path } = {}) {
  if (probe === undefined) return []
  const ok = probe.exists === true && probe.bytes !== undefined && probe.bytes > 0
  if (ok) return []
  const reason = probe.exists === false
    ? `credential provider file missing${path ? ` (${path})` : ''}`
    : `credential provider file empty${path ? ` (${path})` : ''}`
  return [{ class: 'CREDENTIAL_PROVIDER_DEGRADED', reason }]
}

/** W1↔W2 mutual liveness (§5.7): heartbeat freshness is the only signal. */
export function heartbeatStale(mtimeMs, nowMs, graceMs) {
  if (!Number.isFinite(mtimeMs)) return true
  return nowMs - mtimeMs > graceMs
}

/**
 * §5.2/§5.6: consume the child relay's persisted reconciliation evidence —
 * every recent STILL_UNKNOWN entry becomes an Owner-visible finding until its
 * window passes (the relay cannot alert by itself: its channel to the parent
 * is the thing that just failed). `entries` = parsed JSON lines of
 * SCHEDULER_RECONCILIATION_EVIDENCE_FILE ({ts, operation, logicalKey?|jobId?,
 * reason}); corrupt lines are skipped by the reader.
 */
export function evaluateReconciliationEvidence(entries, { nowMs, windowMs = 24 * 60 * 60 * 1000 } = {}) {
  const findings = []
  if (!Array.isArray(entries)) return findings
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') continue
    if (!Number.isFinite(entry.ts) || typeof entry.operation !== 'string') continue
    if (nowMs - entry.ts > windowMs) continue
    findings.push({
      class: 'MUTATION_STILL_UNKNOWN',
      operation: entry.operation,
      ...(entry.logicalKey !== undefined ? { logicalKey: entry.logicalKey } : {}),
      ...(entry.jobId !== undefined ? { jobId: entry.jobId } : {}),
      reason: entry.reason,
      evidenceAt: new Date(entry.ts).toISOString(),
    })
  }
  return findings
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

/**
 * Owner-notification dedupe state machine (alert-storm hardening, 2026-09-09):
 * one unresolved finding fingerprint notifies ONCE, then suppresses exact
 * duplicates for bounded reminders only; recovery notifies once; a new
 * occurrence is a new fingerprint. Monitoring evidence is NEVER deduped —
 * every watchdog evaluation is still recorded by the caller.
 *
 * Fingerprint: findingType + jobId + occurrenceId (either id may be absent —
 * the fingerprint is the stable join of whatever ids the finding carries).
 */
export function findingFingerprint(finding) {
  return ['RUN_STUCK', 'RUN_FAILED', 'EXPECTED_RUN_MISSED', 'CONSECUTIVE_FAILURE']
    .includes(finding.class)
    ? `${finding.class}|${finding.jobId ?? '-'}|${finding.occurrenceId ?? finding.runId ?? '-'}`
    : `${finding.class}|${finding.logicalKey ?? finding.jobId ?? '-'}`
}

/**
 * Transition the alert state for one batch of findings.
 * @param {Record<string, {firstSeenAt:number,lastSeenAt:number,lastNotifiedAt?:number,
 *   notifiedCount:number,severity:string,detail:string}>} state persisted by the caller
 * @param {Array<object>} findings current findings (same shapes the detectors emit)
 * @param {object} opts { nowMs, reminderIntervalMs = 60*60*1000 }
 * @returns {{notifications: Array<{fingerprint,kind:'new'|'reminder'|'severity'|'recovered',finding}>,
 *   state: (same shape as `state`), recovered: string[]}}
 */
export function updateAlertState(state, findings, { nowMs = Date.now(), reminderIntervalMs = 60 * 60 * 1000, recoveryCooldownMs = 6 * 60 * 60 * 1000 } = {}) {
  // legacy flat states (pre-anti-flap) are treated as the active namespace
  const legacy = state && !state.active && (state.RUN_STUCK !== undefined || state.SCHEDULER_RUNTIME_UNHEALTHY !== undefined || Object.keys(state).some((k) => !k.startsWith('__')))
  const active = legacy ? { ...state } : { ...(state?.active ?? {}) }
  const retired = { ...(state?.retired ?? {}) }
  const next = { active, retired }
  const notifications = []
  const seen = new Set()
  for (const finding of findings ?? []) {
    const fp = findingFingerprint(finding)
    seen.add(fp)
    const prior = next.active[fp]
    const retiredAt = retired[fp]
    if (prior === undefined && retiredAt !== undefined && nowMs - retiredAt < recoveryCooldownMs) {
      // anti-flap: this fingerprint recovered moments ago and is back — the
      // condition is FLAPPING, not recovered+new. Resume silently (no Owner
      // notification); the evidence log still carries every evaluation.
      delete retired[fp]
      next.active[fp] = { firstSeenAt: nowMs, lastSeenAt: nowMs, notifiedCount: 0, severity: finding.class, detail: finding.reason ?? finding.detail ?? '' }
      continue
    }
    if (prior === undefined) {
      delete retired[fp]
      next.active[fp] = { firstSeenAt: nowMs, lastSeenAt: nowMs, lastNotifiedAt: nowMs, notifiedCount: 1, severity: finding.class, detail: finding.reason ?? finding.detail ?? '' }
      notifications.push({ fingerprint: fp, kind: 'new', finding })
      continue
    }
    const materialChange = prior.severity !== finding.class
    const dueReminder = nowMs - (prior.lastNotifiedAt ?? prior.firstSeenAt) >= reminderIntervalMs
    if (materialChange) {
      next.active[fp] = { ...prior, lastSeenAt: nowMs, notifiedCount: prior.notifiedCount + 1, severity: finding.class }
      notifications.push({ fingerprint: fp, kind: 'severity', finding })
    } else if (dueReminder) {
      next.active[fp] = { ...prior, lastSeenAt: nowMs, lastNotifiedAt: nowMs, notifiedCount: prior.notifiedCount + 1 }
      notifications.push({ fingerprint: fp, kind: 'reminder', finding })
    } else {
      next.active[fp] = { ...prior, lastSeenAt: nowMs }
    }
  }
  // Recovery: fingerprints previously ACTIVE whose finding is now absent.
  // Only entries with notifiedCount > 0 fire a recovery notification — a
  // silently-resumed entry (notifiedCount=0) disappears without one. After
  // recovery the fp is held in `retired` for the cooldown so a re-appearing
  // intermittent finding resumes SILENTLY, and only a genuinely fresh episode
  // after the cooldown notifies as new again.
  const recovered = Object.keys(active).filter((fp) => !seen.has(fp))
  for (const fp of recovered) {
    const entry = active[fp]
    if (entry.notifiedCount > 0) {
      notifications.push({ fingerprint: fp, kind: 'recovered', finding: { class: entry.severity } })
    }
    retired[fp] = nowMs
    delete active[fp]
  }
  for (const [fp, at] of Object.entries(retired)) {
    if (nowMs - at >= recoveryCooldownMs) delete retired[fp]
  }
  return { notifications, state: { active, retired }, recovered }
}
