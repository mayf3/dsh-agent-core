/**
 * @agent-core/scheduler — OpenClaw -> V2 definition-only import.
 *
 * SCHEDULER_TIMEOUT_OUTCOME_V2 C-034 / D-007 §15 mechanics:
 *
 *   - DEFINITION-ONLY import: every legacy EXECUTION state and legacy session
 *     field is stripped and reported (LEGACY_EXECUTION_STATE_AUTHORITY = NONE).
 *   - In-flight source markers (state.runningAtMs) are REPORTED + STRIPPED —
 *     never migrated to running/admitted truth, never auto-enabled, outcome
 *     never guessed (§15.3).
 *   - Stale one-shots (past `at`) = DO_NOT_IMPORT (§15.6). Disabled jobs stay
 *     disabled (§15.7). Missing agentId = BLOCKED (§15.5). payload.kind !=
 *     agentTurn (incl. systemEvent / daemon-shaped) = BLOCKED / out of
 *     scheduler (§15.8-adjacent; daemon disposition belongs to its owner).
 *   - MIGRATION_CATCH_UP_POLICY = NO_CATCH_UP: past-due nextRunAt / missed
 *     occurrences never become immediate executions; recurring jobs start
 *     from their next FUTURE natural occurrence after activation.
 *
 * Write path: `writeImportToStore(store, jobs, { force, report })` — default
 * REFUSE when the target store exists or contains jobs/occurrences; explicit
 * force authorizes a DEFINITIONS-ONLY replacement that preserves the target's
 * `occurrences` / `fences` / occurrence `history` verbatim (never deletes
 * occurrence authority); unsafe merges fail loud. The guard reads the latest
 * target state INSIDE the mutation lock (no TOCTOU).
 */

import { normalizeJob } from './job-model.js'
import { computePayloadHash } from './occurrence-model.js'
import { DEFAULT_TOP_OF_HOUR_STAGGER_MS, isRecurringTopOfHourCronExpr, parseAbsoluteTimeMs } from './schedule.js'

/** Fields with zero real usage in the live inventory — dropped without warning noise. */
const DORMANT_SILENT_FIELDS = new Set(['wakeMode', 'state.status'])

/** Legacy execution-state fields stripped on import (report per job). */
const LEGACY_EXECUTION_STATE_FIELDS = [
  'lastRunAtMs', 'lastStatus', 'lastRunStatus', 'lastError', 'lastDurationMs',
  'lastDeliveryStatus', 'lastDelivered', 'consecutiveErrors', 'nextRunAtMs', 'runningAtMs',
]

function mapPayload(rawPayload, job) {
  const kind = String(rawPayload?.kind ?? 'agentTurn').trim().toLowerCase()
  if (kind !== 'agentturn') {
    return { error: `payload.kind '${kind}' not executable by V2 (not imported; systemEvent/daemon disposition is out of scheduler)` }
  }
  const message = typeof rawPayload?.message === 'string' ? rawPayload.message : ''
  if (!message.trim()) return { error: 'payload.message empty' }

  const payload = { kind: 'agentTurn', message }

  // Canonical timeout is payload.timeoutSeconds; legacy top-level fields are
  // equivalent runtime behavior (OpenClaw resolveCronJobTimeoutMs only reads
  // payload.timeoutSeconds, so importing them here is behavior-preserving).
  let timeoutSeconds = rawPayload.timeoutSeconds
  if (typeof timeoutSeconds !== 'number' || !Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    for (const legacy of ['timeoutSec', 'timeoutMs', 'runTimeoutMs']) {
      if (typeof job[legacy] === 'number' && Number.isFinite(job[legacy]) && job[legacy] > 0) {
        timeoutSeconds = legacy === 'timeoutMs' || legacy === 'runTimeoutMs'
          ? job[legacy] / 1000
          : job[legacy]
        break
      }
    }
  }
  if (typeof timeoutSeconds === 'number' && Number.isFinite(timeoutSeconds) && timeoutSeconds > 0) {
    const seconds = Math.floor(timeoutSeconds)
    if (seconds < 1) return { error: `legacy timeout normalizes to <1s (${timeoutSeconds}) — not silently valid` }
    payload.timeoutSeconds = seconds
  }
  if (rawPayload?.lightContext === true) payload.lightContext = true
  if (typeof rawPayload?.model === 'string' && rawPayload.model.trim()) payload.model = rawPayload.model.trim()
  return { payload }
}

function mapSchedule(rawSchedule) {
  const kind = String(rawSchedule?.kind ?? '').trim().toLowerCase()
  if (kind === 'at') {
    const atMs = parseAbsoluteTimeMs(rawSchedule.at)
    if (atMs === null) return { error: `schedule.at invalid: ${rawSchedule?.at}` }
    return { schedule: { kind: 'at', at: new Date(atMs).toISOString() } }
  }
  if (kind === 'every') {
    const everyMs = typeof rawSchedule.everyMs === 'number' ? rawSchedule.everyMs : Number(rawSchedule.everyMs)
    if (!Number.isFinite(everyMs) || everyMs < 1) return { error: `schedule.everyMs invalid: ${rawSchedule?.everyMs}` }
    const out = { kind: 'every', everyMs: Math.max(1, Math.floor(everyMs)) }
    const anchorMs = typeof rawSchedule.anchorMs === 'number' ? rawSchedule.anchorMs : Number(rawSchedule.anchorMs)
    if (Number.isFinite(anchorMs)) out.anchorMs = Math.max(0, Math.floor(anchorMs))
    return { schedule: out }
  }
  if (kind === 'cron') {
    const expr = typeof rawSchedule.expr === 'string' ? rawSchedule.expr.trim() : ''
    if (!expr || expr.split(/\s+/).filter(Boolean).length !== 5) {
      return { error: `schedule.expr invalid (need 5 fields): ${expr}` }
    }
    const out = { kind: 'cron', expr }
    if (typeof rawSchedule.tz === 'string' && rawSchedule.tz.trim()) out.tz = rawSchedule.tz.trim()
    // Effective stagger: explicit > auto top-of-hour default.
    if (typeof rawSchedule.staggerMs === 'number' && Number.isFinite(rawSchedule.staggerMs) && rawSchedule.staggerMs > 0) {
      out.staggerMs = Math.floor(rawSchedule.staggerMs)
    } else if (isRecurringTopOfHourCronExpr(expr)) {
      out.staggerMs = DEFAULT_TOP_OF_HOUR_STAGGER_MS
    }
    return { schedule: out }
  }
  return { error: `schedule.kind '${String(rawSchedule?.kind)}' unsupported` }
}

function mapDelivery(rawDelivery) {
  const mode = String(rawDelivery?.mode ?? 'none').trim().toLowerCase()
  if (!['announce', 'none', 'silent'].includes(mode)) {
    return { error: `delivery.mode '${mode}' unsupported` }
  }
  const delivery = { mode }
  if (typeof rawDelivery?.channel === 'string' && rawDelivery.channel.trim()) delivery.channel = rawDelivery.channel.trim()
  if (typeof rawDelivery?.to === 'string' && rawDelivery.to.trim()) delivery.to = rawDelivery.to.trim()
  if (rawDelivery?.bestEffort === true) delivery.bestEffort = true
  return { delivery }
}

/**
 * Map one raw OpenClaw job onto the V2 definition. Returns
 * { job?, gap?, warnings, strippedExecutionState, sessionDisposition }.
 *
 * Legacy execution state and session fields are migration INPUT only —
 * stripped + reported, never persisted (C-030/C-031 / D-007 §15.1/§3.2).
 * Jobs carrying `main` / explicit stable-session intent stay DISABLED until
 * a migration review confirms their new semantics.
 */
export function mapOpenClawJob(raw, { nowMs = Date.now() } = {}) {
  const warnings = []
  const id = String(raw?.id ?? '')
  const name = String(raw?.name ?? '')
  if (!id || !name.trim()) return { gap: 'job missing id or name', warnings }

  const agentId = typeof raw.agentId === 'string' && raw.agentId.trim() ? raw.agentId.trim() : undefined
  if (!agentId) {
    return {
      gap: 'no agentId — V2 requires exactly one target agent; blocked (no fuzzy match, no default agent)',
      warnings,
    }
  }

  const payloadResult = mapPayload(raw.payload, raw)
  if (payloadResult.error) return { gap: payloadResult.error, warnings }

  const scheduleResult = mapSchedule(raw.schedule)
  if (scheduleResult.error) return { gap: scheduleResult.error, warnings }

  const deliveryResult = mapDelivery(raw.delivery)
  if (deliveryResult.error) return { gap: deliveryResult.error, warnings }

  // Legacy session fields: strip + report. main / explicit stable-session
  // intent keeps the job DISABLED pending migration review (D-007 §3.2).
  const sessionDisposition = {
    sessionTarget: typeof raw.sessionTarget === 'string' ? raw.sessionTarget : null,
    sessionKey: typeof raw.sessionKey === 'string' && raw.sessionKey.trim() ? raw.sessionKey : null,
  }
  const blockedBySessionIntent = sessionDisposition.sessionTarget === 'main' || sessionDisposition.sessionKey !== null
  if (sessionDisposition.sessionTarget !== null || sessionDisposition.sessionKey !== null) {
    warnings.push(`legacy session fields stripped (sessionTarget='${sessionDisposition.sessionTarget}', sessionKey=${sessionDisposition.sessionKey ? 'set' : 'none'}); V2 executes every occurrence in a fresh non-main session`)
    if (blockedBySessionIntent) {
      warnings.push('job has main / explicit stable-session intent — kept DISABLED until migration review confirms new semantics')
    }
  }

  // Legacy execution state: strip + report, never migrated (§15.1/§15.3).
  const strippedExecutionState = []
  for (const field of LEGACY_EXECUTION_STATE_FIELDS) {
    if (raw?.state && raw.state[field] !== undefined) strippedExecutionState.push(field)
  }
  if (strippedExecutionState.length > 0) {
    warnings.push(`legacy execution state stripped (never authority): ${strippedExecutionState.join(', ')}`)
  }
  if (typeof raw?.state?.runningAtMs === 'number') {
    warnings.push('source in-flight marker (state.runningAtMs) reported + stripped; NOT migrated to running truth; outcome not guessed')
  }

  // Stale one-shot: a past `at` target never converts to "run now" (§15.6).
  let staleOneShot = false
  if (scheduleResult.schedule.kind === 'at') {
    const atMs = parseAbsoluteTimeMs(scheduleResult.schedule.at)
    if (atMs !== null && atMs <= nowMs) {
      staleOneShot = true
      return {
        gap: 'stale one-shot (past at target) — DO_NOT_IMPORT (never converted to an immediate execution)',
        warnings,
        staleOneShot,
        strippedExecutionState,
        sessionDisposition,
      }
    }
  }

  for (const key of Object.keys(raw)) {
    if (DORMANT_SILENT_FIELDS.has(key)) {
      warnings.push(`dormant field '${key}' dropped`)
      continue
    }
    if (['id', 'name', 'agentId', 'enabled', 'schedule', 'sessionTarget', 'payload', 'delivery',
      'description', 'sessionKey', 'deleteAfterRun', 'createdAtMs', 'updatedAtMs', 'state',
      'timeoutSec', 'timeoutMs', 'runTimeoutMs', 'everyMs'].includes(key)) continue
    warnings.push(`dormant field '${key}' dropped`)
  }

  const blockedByInFlight = typeof raw?.state?.runningAtMs === 'number'
  const jobInput = {
    id,
    name: name.trim(),
    agentId,
    // C-019/C-037 restore gate is closed in this implementation round.
    // Definitions are importable, but no imported definition is auto-enabled.
    enabled: false,
    migrationRestoreBlocked: true,
    schedule: scheduleResult.schedule,
    payload: payloadResult.payload,
    delivery: deliveryResult.delivery,
    createdAtMs: raw.createdAtMs,
    updatedAtMs: raw.updatedAtMs,
    revisionActivatedAtMs: nowMs, // recurring starts from the next FUTURE natural occurrence (§15.1)
    // NOTE: state intentionally NOT carried — execution state never migrates.
  }
  if (typeof raw.description === 'string' && raw.description.trim()) jobInput.description = raw.description.trim()
  if (typeof raw.deleteAfterRun === 'boolean') jobInput.deleteAfterRun = raw.deleteAfterRun

  try {
    return {
      job: normalizeJob(jobInput, { nowMs }),
      warnings,
      strippedExecutionState,
      sessionDisposition,
      staleOneShot,
      restoreBlocked: {
        gate: 'C-019/C-037',
        sourceEnabled: raw.enabled === true,
        inFlight: blockedByInFlight,
        legacySessionIntent: blockedBySessionIntent,
      },
    }
  } catch (error) {
    return { gap: `validation: ${error.message}`, warnings, strippedExecutionState, sessionDisposition }
  }
}

/**
 * Import an OpenClaw jobs array (e.g. `{version, jobs}` from
 * ~/.openclaw/cron/jobs.json) into V2 definitions. DEFAULT = DRY RUN: this
 * function never writes; use writeImportToStore for the guarded write.
 *
 * @returns {{ jobs: object[], report: { total, imported, gaps, warnings, inFlight, dispositions } }}
 */
export function importOpenClawJobs(rawJobs, { nowMs = Date.now(), enabledOnly = false } = {}) {
  const jobs = []
  const gaps = []
  const warnings = []
  const inFlight = []
  const dispositions = []
  let total = 0
  for (const raw of rawJobs) {
    if (enabledOnly && raw.enabled !== true) continue
    total += 1
    if (typeof raw?.state?.runningAtMs === 'number') {
      inFlight.push({ id: raw.id, name: raw.name, agentId: raw.agentId ?? '(none)' })
    }
    const mapped = mapOpenClawJob(raw, { nowMs })
    for (const w of mapped.warnings) warnings.push({ id: raw.id, name: raw.name, detail: w })
    if (mapped.gap) {
      gaps.push({ id: raw.id, name: raw.name, reason: mapped.gap })
      dispositions.push({
        id: raw.id, name: raw.name, disposition: mapped.staleOneShot ? 'stale-one-shot-do-not-import' : 'blocked-not-imported',
        reason: mapped.gap, restoreEligible: false,
      })
    } else {
      jobs.push(mapped.job)
      dispositions.push({
        id: raw.id, name: raw.name, disposition: mapped.job.enabled ? 'imported-enabled' : 'imported-disabled',
        targetAgent: mapped.job.agentId,
        schedule: mapped.job.schedule.kind,
        sessionDisposition: mapped.sessionDisposition,
        strippedExecutionState: mapped.strippedExecutionState,
        restoreEligible: false, // C-019/C-037: restore gate closed — owner decision later
        restoreBlocked: mapped.restoreBlocked,
      })
    }
  }
  return {
    jobs,
    report: { total, imported: jobs.length, gaps, warnings, inFlight: { count: inFlight.length, jobs: inFlight }, dispositions },
  }
}

/**
 * C-034 guarded write. Semantics:
 *
 *   no --force:
 *     target store exists OR contains jobs/occurrences -> REFUSE (in-lock
 *     latest read — no TOCTOU).
 *
 *   --force (explicit operator authorization, stop/drain prerequisite):
 *     DEFINITIONS-ONLY replacement — `jobs` is replaced; `occurrences` /
 *     `fences` / occurrence `history` are preserved VERBATIM (never deleted,
 *     never rewritten). Fails loud when a replacement would change the
 *     scheduleRevision/payloadHash semantics an existing occurrence is bound
 *     to. force is still bound by no-catch-up / state-strip / disabled /
 *     restore-gate constraints — it is NOT auto-enable authority.
 *
 * @returns {{ written: true, preserved: { occurrences: number, fences: number } }}
 * @throws {Error} code IMPORT_REFUSED | IMPORT_UNSAFE_MERGE
 */
export async function writeImportToStore(store, jobs, { force = false, nowMs = Date.now() } = {}) {
  if (jobs.some((job) => job.enabled !== false || job.migrationRestoreBlocked !== true)) {
    throw Object.assign(
      new Error('import restore gate is closed: every imported definition must be disabled and durably restore-blocked'),
      { code: 'IMPORT_RESTORE_GATE_CLOSED' },
    )
  }
  const { doc, value } = await store.mutateDoc((latest, mutation) => {
    const targetHasContent = latest.jobs.length > 0
      || latest.occurrences.length > 0
      || Object.keys(latest.fences).length > 0
    if (!force && (mutation.existed || targetHasContent)) {
      throw Object.assign(
        new Error('target store exists or contains authority (checked inside mutation lock)'),
        { code: 'IMPORT_REFUSED' },
      )
    }
    if (force) {
      for (const record of latest.occurrences) {
        const incoming = jobs.find((job) => job.id === record.jobId)
        if (!incoming) continue // Definition deletion never mutates occurrence authority.
        const current = latest.jobs.find((job) => job.id === record.jobId)
        const incomingHash = computePayloadHash({ agentId: incoming.agentId, payload: incoming.payload })
        const scheduleMatches = current !== undefined
          && JSON.stringify(incoming.schedule) === JSON.stringify(current.schedule)
        const retryMatches = current !== undefined
          && JSON.stringify(incoming.retry ?? null) === JSON.stringify(current.retry ?? null)
        if (incoming.scheduleRevision !== record.scheduleRevision || incomingHash !== record.payloadHash
          || !scheduleMatches || !retryMatches) {
          throw Object.assign(
            new Error(`unsafe merge: definition ${record.jobId} does not match occurrence ${record.occurrenceId} revision/payloadHash/schedule/retry binding`),
            { code: 'IMPORT_UNSAFE_MERGE' },
          )
        }
      }
    }
    const preservedOccurrences = latest.occurrences
    const preservedFences = latest.fences
    latest.jobs = jobs.map((job) => structuredClone(job))
    latest.occurrences = preservedOccurrences
    latest.fences = preservedFences
    return { value: { preserved: { occurrences: preservedOccurrences.length, fences: Object.keys(preservedFences).length } } }
  })
  await store.appendRunEvent({
    ts: nowMs, action: 'import_write', force: force === true, importedJobs: jobs.length,
    preserved: value.preserved,
  })
  return { written: true, preserved: value.preserved, doc }
}
