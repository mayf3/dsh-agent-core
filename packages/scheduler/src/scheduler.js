/**
 * @agent-core/scheduler — the V1 execution engine.
 *
 * Execution semantics are a faithful, minimal port of the OpenClaw gateway
 * cron scheduler (verified against the OpenClaw 2026.3.13 bundle and the
 * live 140-job inventory; see docs/investigations/scheduler-replacement-audit.md
 * and docs/decisions/SCHEDULER_V1.md):
 *
 *   due       : enabled, not running, not in error backoff,
 *               nextRunAtMs <= now
 *   one-shot  : an `at` job runs at most once — after the first attempt it is
 *               either deleted (deleteAfterRun) or disabled; a transient
 *               error retries it up to 3 times with 30s/60s/5m backoff
 *   recurring : cron — next run = next occurrence strictly after the run
 *               end (+2s refire gap); every — lastRun + interval, else
 *               anchor-aligned. On error, next run is pushed to
 *               max(naturalNext, endedAt + backoff(consecutiveErrors)) with
 *               30s/60s/5m/15m/60m exponential backoff
 *   restart   : catch-up fires an enabled job at most ONCE per downtime —
 *               `at` only if it never ran; `cron` only if the most recent
 *               schedule occurrence is after lastRunAtMs (no replay of
 *               older missed occurrences); `every` via its stored nextRunAtMs
 *   no-dup    : state.runningAtMs is persisted BEFORE invocation; on
 *               restart a job with a fresh runningAtMs is skipped (assumed
 *               in-flight); a marker older than stuckRunMs (2h) is cleared
 *   disabled  : never runs; nextRunAtMs/runningAtMs are cleared
 *
 * The engine never touches an agent or a channel directly: it calls the
 * injected `invoker.invokeAgent(...)` and `deliver({job, result, text})`
 * seams (src/seams.js). All time comes from the injected `nowMs` for
 * deterministic tests.
 */

import { MIN_REFIRE_GAP_MS, computeNextRunAtMs, computePreviousRunAtMs, parseAtToMs } from './schedule.js'
import { cloneJob, normalizeJob, toPublicJob } from './job-model.js'
import { defaultSessionId } from './seams.js'

/** OpenClaw constants (verified in the gateway bundle). */
export const STUCK_RUN_MS = 7200 * 1000 // clear runningAtMs after 2h
export const AGENT_TURN_SAFETY_TIMEOUT_MS = 3600 * 1000 // default run timeout when unset
export const DEFAULT_MAX_TRANSIENT_RETRIES = 3
/** One-shot retry backoff (indexed by consecutive error count). */
export const ONE_SHOT_RETRY_BACKOFF_MS = [30 * 1000, 60 * 1000, 300 * 1000]
/** Recurring error backoff (indexed by consecutive error count). */
export const RECURRING_ERROR_BACKOFF_MS = [30 * 1000, 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000]
/** OpenClaw DEFAULT_MAX_MISSED_JOBS_PER_RESTART — immediate catch-up cap. */
export const DEFAULT_MAX_CATCHUP_PER_START = 5
export const TIMEOUT_ERROR_TEXT = 'cron: job execution timed out'

const TRANSIENT_ERROR_PATTERNS = [
  /(rate[_ ]limit|too many requests|429|resource has been exhausted|cloudflare|tokens per day)/i,
  /\b529\b|\boverloaded(?:_error)?\b|high demand|temporar(?:ily|y) (?:unavailable|overloaded)/i,
  /\b5\d\d\b|\bECONNRESET\b|\bETIMEDOUT\b|\bENOTFOUND\b|\bEAI_AGAIN\b|network error|connection (?:reset|refused|closed)/i,
]

export function isTransientError(error) {
  if (!error || typeof error !== 'string') return false
  return TRANSIENT_ERROR_PATTERNS.some((re) => re.test(error))
}

export function errorBackoffMs(consecutiveErrors, scheduleMs = RECURRING_ERROR_BACKOFF_MS) {
  const idx = Math.min(Math.max(1, Math.floor(consecutiveErrors)) - 1, scheduleMs.length - 1)
  return scheduleMs[Math.max(0, idx)]
}

/** Next run for a job's schedule, honoring per-kind rules (OpenClaw computeJobNextRunAtMs). */
export function computeJobNextRunAtMs(job, nowMs, { preserveLastRunAtMs } = {}) {
  if (!job.enabled) return undefined
  const schedule = job.schedule
  if (schedule.kind === 'every') {
    const everyMs = Math.max(1, Math.floor(schedule.everyMs))
    const lastRunAtMs = preserveLastRunAtMs ?? job.state?.lastRunAtMs
    if (typeof lastRunAtMs === 'number' && Number.isFinite(lastRunAtMs)) {
      const nextFromLastRun = Math.floor(lastRunAtMs) + everyMs
      if (nextFromLastRun > nowMs) return nextFromLastRun
    }
    const fallbackAnchorMs = Number.isFinite(job.createdAtMs) ? job.createdAtMs : nowMs
    return computeNextRunAtMs({ ...schedule, everyMs }, nowMs, { fallbackAnchorMs })
  }
  return computeNextRunAtMs(schedule, nowMs, { jobId: job.id })
}

function isErrorBackoffPending(job, nowMs) {
  if (job.schedule.kind === 'at' || job.state?.lastStatus !== 'error') return false
  const lastRunAtMs = job.state.lastRunAtMs
  if (typeof lastRunAtMs !== 'number') return false
  return nowMs < lastRunAtMs + errorBackoffMs(job.state.consecutiveErrors ?? 1)
}

/**
 * Runnability with optional startup catch-up rules (OpenClaw isRunnableJob).
 * @param {object} opts - { catchup?: boolean, skipJobIds?: Set }
 */
export function isRunnableJob(job, nowMs, opts = {}) {
  if (!job.enabled) return false
  if (!job.state) job.state = {}
  if (typeof job.state.runningAtMs === 'number') return false
  if (opts.skipJobIds?.has(job.id)) return false

  const atAlreadyAttempted = opts.catchup && job.schedule.kind === 'at' && job.state.lastStatus
  if (atAlreadyAttempted) {
    if (job.state.lastStatus === 'error'
      && typeof job.state.nextRunAtMs === 'number'
      && typeof job.state.lastRunAtMs === 'number'
      && job.state.nextRunAtMs > job.state.lastRunAtMs) {
      return nowMs >= job.state.nextRunAtMs
    }
    return false
  }

  const next = job.state.nextRunAtMs
  if (typeof next === 'number' && Number.isFinite(next) && nowMs >= next) return true
  if (typeof next === 'number' && Number.isFinite(next) && next > nowMs && isErrorBackoffPending(job, nowMs)) return false
  if (!opts.catchup || job.schedule.kind !== 'cron') return false

  // Missed-run catch-up: at most ONE missed occurrence per downtime, and only
  // for jobs that have run before (OpenClaw: lastRunAtMs must be a number —
  // a never-ran cron job starts from its next occurrence instead).
  let previousRunAtMs
  try {
    previousRunAtMs = computePreviousRunAtMs(job.schedule, nowMs, { jobId: job.id })
  } catch {
    return false
  }
  if (typeof previousRunAtMs !== 'number' || !Number.isFinite(previousRunAtMs)) return false
  const lastRunAtMs = job.state.lastRunAtMs
  if (typeof lastRunAtMs !== 'number' || !Number.isFinite(lastRunAtMs)) return false
  return previousRunAtMs > lastRunAtMs
}

/** Normalize tick state: disabled jobs lose nextRunAtMs/runningAtMs; stuck markers clear. */
export function normalizeJobTickState(job, nowMs) {
  let changed = false
  if (!job.state) job.state = {}
  if (!job.enabled) {
    if (job.state.nextRunAtMs !== undefined) { job.state.nextRunAtMs = undefined; changed = true }
    if (job.state.runningAtMs !== undefined) { job.state.runningAtMs = undefined; changed = true }
    return changed
  }
  const runningAt = job.state.runningAtMs
  if (typeof runningAt === 'number' && nowMs - runningAt > STUCK_RUN_MS) {
    job.state.runningAtMs = undefined
    changed = true
  }
  return changed
}

const defaultLog = {
  info: (...args) => process.stderr.write(`[scheduler] ${args.join(' ')}\n`),
  warn: (...args) => process.stderr.write(`[scheduler] WARN ${args.join(' ')}\n`),
  error: (...args) => process.stderr.write(`[scheduler] ERROR ${args.join(' ')}\n`),
}

/**
 * The V1 scheduler engine.
 * @param {object} deps
 * @param {import('./store.js').JobStore} deps.store
 * @param {Function} deps.invoker - invokeAgent(request) -> outcome envelope
 * @param {Function} [deps.deliver] - deliver({job, result, text}) -> void (throw = not-delivered)
 * @param {Function} [deps.nowMs] - clock
 * @param {number} [deps.tickMs] - timer period (1000)
 * @param {number} [deps.concurrency] - max parallel invocations (5)
 * @param {number} [deps.stuckRunMs] - STUCK_RUN_MS (2h)
 * @param {number} [deps.maxCatchupPerStart] - DEFAULT_MAX_CATCHUP_PER_START (5)
 * @param {object} [deps.log]
 */
export class Scheduler {
  constructor(deps) {
    if (!deps?.store) throw new TypeError('Scheduler: store is required')
    if (typeof deps?.invoker?.invokeAgent !== 'function' && typeof deps?.invoker !== 'function') {
      throw new TypeError('Scheduler: invoker (invokeAgent seam) is required')
    }
    this.store = deps.store
    this.invoker = typeof deps.invoker === 'function' ? { invokeAgent: deps.invoker } : deps.invoker
    this.deliver = deps.deliver ?? (async () => {})
    this.nowMs = deps.nowMs ?? (() => Date.now())
    this.tickMs = deps.tickMs ?? 1000
    this.concurrency = Math.max(1, deps.concurrency ?? 5)
    this.stuckRunMs = deps.stuckRunMs ?? STUCK_RUN_MS
    this.maxCatchupPerStart = deps.maxCatchupPerStart ?? DEFAULT_MAX_CATCHUP_PER_START
    this.log = deps.log ?? defaultLog

    this.jobs = [] // working copy (fresh from store on reload)
    this._timer = null
    this._running = false
    this._stopped = false
    this._started = false
    this._inflight = new Set()
    this._lastTickError = null
    this._persistPromise = Promise.resolve()
    this._catchupPromise = null
  }

  // ── lifecycle ──────────────────────────────────────────────────────────

  async load() {
    const raw = await this.store.load()
    const jobs = []
    for (const entry of raw) {
      try {
        jobs.push(normalizeJob(entry, { nowMs: this.nowMs() }))
      } catch (error) {
        this.log.warn(`dropping corrupt job ${entry?.id ?? '(unknown)'}: ${error.message}`)
      }
    }
    this.jobs = jobs
    return jobs
  }

  async start({ autoStart = true } = {}) {
    if (this._started) throw new Error('Scheduler: already started')
    this._started = true
    await this.load()
    this._repairAndCatchup()
    if (autoStart) this._startTimer()
    return this
  }

  /** Resolve when every in-flight invocation has settled (tests + graceful shutdown). */
  async whenIdle() {
    if (this._catchupPromise) {
      const pending = this._catchupPromise
      this._catchupPromise = null
      await pending
    }
    while (this._inflight.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    await this._persistPromise
  }

  async stop() {
    this._stopped = true
    this._clearTimer()
    // Wait for the startup catch-up and any in-flight invocations to settle
    // so the persisted state is final.
    await this.whenIdle()
    await this.store.persist(this.jobs)
  }

  _startTimer() {
    this._clearTimer()
    this._timer = setInterval(() => {
      this.tick().catch((error) => {
        this._lastTickError = error
        this.log.error(`tick failed: ${error?.message ?? error}`)
      })
    }, this.tickMs)
    if (this._timer.unref) this._timer.unref()
  }

  _clearTimer() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }

  // ── startup repair + catch-up ──────────────────────────────────────────

  /**
   * Repair pass + bounded catch-up, exactly-once per downtime:
   *   - repair nextRunAtMs for enabled jobs that have none (or one that is
   *     stale and not due via catch-up — OpenClaw recomputeNextRuns);
   *   - fire due jobs (cron missed-run rule, at never-ran rule), capped at
   *     maxCatchupPerStart; the rest stay due and fire on the first tick.
   */
  _repairAndCatchup() {
    const now = this.nowMs()
    let changed = false
    const candidates = []
    for (const job of this.jobs) {
      if (normalizeJobTickState(job, now)) changed = true
      if (isRunnableJob(job, now, { catchup: true })) candidates.push(job)
      else if (job.enabled && job.state.nextRunAtMs === undefined) {
        const next = computeJobNextRunAtMs(job, now)
        if (next !== undefined) { job.state.nextRunAtMs = next; changed = true }
      }
    }
    if (changed) {
      this._persistPromise = this.store.persist(this.jobs).catch((error) => {
        this._lastTickError = error
        this.log.error(`persist failed: ${error?.message ?? error}`)
      })
    }
    candidates.sort((a, b) => (a.state.nextRunAtMs ?? 0) - (b.state.nextRunAtMs ?? 0))
    const immediate = candidates.slice(0, this.maxCatchupPerStart)
    if (immediate.length > 0) {
      this.log.info(`catch-up: ${immediate.length} of ${candidates.length} due job(s) run at startup`)
      this._catchupPromise = this._fireJobs(immediate)
    }
  }

  // ── tick ───────────────────────────────────────────────────────────────

  /** One scheduler pass: reload external changes, collect due, fire. */
  async tick() {
    if (this._stopped) return 0
    await this.load() // mtime-checked reload picks up CLI-seam additions
    const now = this.nowMs()
    let changed = false
    for (const job of this.jobs) {
      if (normalizeJobTickState(job, now)) changed = true
    }
    const due = this.jobs.filter((job) => isRunnableJob(job, now, { catchup: false }))
    if (due.length === 0) {
      if (changed) await this._safePersist()
      return 0
    }
    return this._fireJobs(due)
  }

  /**
   * Fire due jobs: mark all runningAtMs in memory, persist the batch BEFORE
   * any invocation (crash → restart skips them; no duplicates), then invoke
   * with a concurrency cap and apply outcomes.
   */
  async _fireJobs(due) {
    const now = this.nowMs()
    for (const job of due) {
      job.state.runningAtMs = now
      job.state.lastError = undefined
    }
    await this._safePersist()

    const results = []
    let cursor = 0
    while (cursor < due.length) {
      const batch = due.slice(cursor, cursor + this.concurrency)
      cursor += this.concurrency
      let batchResults
      try {
        batchResults = await Promise.all(batch.map((job) => this._runOne(job)))
      } catch (error) {
        // _runOne never throws by contract; this is a defensive net so one
        // broken job can never wedge the whole tick.
        this.log.error(`run batch failed: ${error?.message ?? error}`)
        batchResults = batch.map((job) => ({ jobId: job.id, status: 'error', error: String(error?.message ?? error) }))
      }
      results.push(...batchResults)
    }
    await this._safePersist()
    return results.length
  }

  /** One invocation + outcome application. Never throws (failures become error outcomes). */
  async _runOne(job) {
    const startedAt = this.nowMs()
    this._inflight.add(job.id)
    try {
      await this.store.appendRunEvent({
        ts: startedAt, jobId: job.id, action: 'started', runAtMs: startedAt, agentId: job.agentId,
      }).catch(() => {})
      const outcome = await this._invokeWithTimeout(job, startedAt).catch((error) => ({
        status: 'error',
        error: error?.message ?? String(error),
      }))
      const result = {
        status: outcome.status === 'ok' ? 'ok' : 'error',
        error: outcome.error ?? (outcome.status === 'ok' ? undefined : 'invoke failed'),
        summary: typeof outcome.summary === 'string' ? outcome.summary : undefined,
        sessionId: typeof outcome.sessionId === 'string' ? outcome.sessionId : undefined,
        startedAt,
        endedAt: this.nowMs(),
      }
      const shouldDelete = await this._applyJobResult(job, result)
      await this.store.appendRunEvent({
        ts: result.endedAt, jobId: job.id, action: 'finished', status: result.status,
        error: result.error, delivered: result.delivered, deliveryStatus: job.state.lastDeliveryStatus,
        sessionId: result.sessionId, runAtMs: startedAt, durationMs: result.endedAt - startedAt,
        nextRunAtMs: job.state.nextRunAtMs,
      }).catch(() => {})
      if (shouldDelete) {
        this.jobs = this.jobs.filter((j) => j.id !== job.id)
        this.log.info(`job ${job.id.slice(0, 8)} (${job.name}) done (one-shot); deleted`)
      }
      return { jobId: job.id, ...result, deleted: shouldDelete }
    } finally {
      this._inflight.delete(job.id)
    }
  }

  async _invokeWithTimeout(job, startedAt) {
    const timeoutMs = job.payload.timeoutSeconds
      ? Math.floor(job.payload.timeoutSeconds * 1000)
      : AGENT_TURN_SAFETY_TIMEOUT_MS
    const request = {
      agentId: job.agentId,
      sessionId: job.sessionKey ? job.sessionKey : job.sessionTarget === 'main' ? 'main' : defaultSessionId(job),
      message: job.payload.message,
      model: job.payload.model,
      lightContext: job.payload.lightContext,
      timeoutMs,
      deliveryTarget: job.delivery,
    }
    let timer
    try {
      return await Promise.race([
        Promise.resolve(this.invoker.invokeAgent(request)),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(TIMEOUT_ERROR_TEXT)), timeoutMs)
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  /**
   * Apply one run outcome to the job (OpenClaw applyJobResult). Returns true
   * when the job should be deleted (at + deleteAfterRun + ok).
   */
  async _applyJobResult(job, result) {
    const now = this.nowMs()
    job.state.runningAtMs = undefined
    job.state.lastRunAtMs = result.startedAt
    job.state.lastRunStatus = result.status
    job.state.lastStatus = result.status
    job.state.lastDurationMs = Math.max(0, result.endedAt - result.startedAt)
    job.state.lastError = result.status === 'error' ? (result.error ?? 'error') : undefined
    job.updatedAtMs = result.endedAt

    // Delivery: announce/silent deliver the final text; the target is opaque.
    let deliveryStatus
    if (job.delivery.mode === 'none') {
      deliveryStatus = 'not-requested'
    } else if (result.status === 'ok') {
      try {
        await this.deliver({ job, result, text: result.summary })
        result.delivered = true
        deliveryStatus = 'delivered'
      } catch (error) {
        result.delivered = false
        deliveryStatus = 'not-delivered'
        this.log.warn(`job ${job.id.slice(0, 8)} delivery failed: ${error?.message ?? error}`)
      }
    } else {
      result.delivered = false
      deliveryStatus = 'not-delivered'
    }
    job.state.lastDeliveryStatus = deliveryStatus
    job.state.lastDelivered = result.delivered === true

    if (result.status === 'error') {
      job.state.consecutiveErrors = (job.state.consecutiveErrors ?? 0) + 1
    } else {
      job.state.consecutiveErrors = 0
    }

    const schedule = job.schedule
    if (schedule.kind === 'at' && job.deleteAfterRun === true && result.status === 'ok') {
      job.state.nextRunAtMs = undefined
      return true
    }
    if (schedule.kind === 'at') {
      if (result.status === 'ok') {
        job.enabled = false
        job.state.nextRunAtMs = undefined
      } else {
        const consecutive = job.state.consecutiveErrors
        if (isTransientError(result.error) && consecutive <= DEFAULT_MAX_TRANSIENT_RETRIES) {
          job.state.nextRunAtMs = result.endedAt + errorBackoffMs(consecutive, ONE_SHOT_RETRY_BACKOFF_MS)
        } else {
          job.enabled = false
          job.state.nextRunAtMs = undefined
          this.log.warn(`one-shot job ${job.id.slice(0, 8)} (${job.name}) disabled after ${consecutive} error(s): ${result.error}`)
        }
      }
      return false
    }

    // recurring (cron / every)
    const naturalNext = computeJobNextRunAtMs(job, result.endedAt)
    if (result.status === 'error' && job.enabled) {
      const backoffNext = result.endedAt + errorBackoffMs(job.state.consecutiveErrors ?? 1)
      job.state.nextRunAtMs = naturalNext !== undefined ? Math.max(naturalNext, backoffNext) : backoffNext
    } else if (job.enabled) {
      if (schedule.kind === 'cron') {
        const minNext = result.endedAt + MIN_REFIRE_GAP_MS
        job.state.nextRunAtMs = naturalNext !== undefined ? Math.max(naturalNext, minNext) : minNext
      } else {
        job.state.nextRunAtMs = naturalNext
      }
    } else {
      job.state.nextRunAtMs = undefined
    }
    return false
  }

  async _safePersist() {
    this._persistPromise = this.store.persist(this.jobs)
    await this._persistPromise
  }

  // ── domain operations (Control Plane + daemon submission seam) ─────────

  /** Create a job (validated). nextRunAtMs computed when absent. */
  async createJob(input) {
    const now = this.nowMs()
    const job = normalizeJob(input, { nowMs: now })
    if (job.enabled && job.state.nextRunAtMs === undefined) {
      job.state.nextRunAtMs = computeJobNextRunAtMs(job, now)
    }
    this.jobs.push(job)
    await this._safePersist()
    return toPublicJob(job)
  }

  /** Update mutable fields; schedule changes recompute nextRunAtMs. */
  async updateJob(id, patch) {
    const job = this.jobs.find((j) => j.id === id)
    if (!job) throw new Error(`unknown job id: ${id}`)
    const merged = { ...job, ...patch }
    const now = this.nowMs()
    const normalized = normalizeJob(merged, { nowMs: now, id: job.id, createdAtMs: job.createdAtMs })
    normalized.updatedAtMs = now
    if (patch.schedule !== undefined || patch.enabled !== undefined || job.state.nextRunAtMs === undefined) {
      normalized.state.nextRunAtMs = normalized.enabled ? computeJobNextRunAtMs(normalized, now) : undefined
    }
    this.jobs[this.jobs.indexOf(job)] = normalized
    await this._safePersist()
    return toPublicJob(normalized)
  }

  async enableJob(id) {
    return this.updateJob(id, { enabled: true })
  }

  async disableJob(id) {
    const job = this.jobs.find((j) => j.id === id)
    if (!job) throw new Error(`unknown job id: ${id}`)
    job.enabled = false
    job.state.nextRunAtMs = undefined
    job.state.runningAtMs = undefined
    await this._safePersist()
    return toPublicJob(job)
  }

  async deleteJob(id) {
    const before = this.jobs.length
    this.jobs = this.jobs.filter((j) => j.id !== id)
    if (this.jobs.length === before) throw new Error(`unknown job id: ${id}`)
    await this._safePersist()
    return true
  }

  async listJobs() {
    return this.jobs.map(toPublicJob)
  }

  async getJob(id) {
    const job = this.jobs.find((j) => j.id === id)
    return job ? toPublicJob(job) : undefined
  }

  /**
   * One-shot submission seam — the thin replacement for
   * `openclaw cron add --at <delay|ISO> ...` used by forum-scheduler /
   * workflow-dispatcher (see scripts/agentcore-cron.mjs).
   *
   * @param {object} input - { agentId, name, at, message, lightContext?,
   *   deliver?, sessionTarget?, timeoutSeconds?, deleteAfterRun?, model? }
   */
  async submitOneShot(input) {
    const now = this.nowMs()
    const atMs = parseAtToMs(input.at, now)
    if (atMs === null) throw new TypeError(`submitOneShot: invalid at: ${input.at}`)
    const job = normalizeJob(
      {
        name: input.name,
        agentId: input.agentId,
        enabled: true,
        schedule: { kind: 'at', at: new Date(atMs).toISOString() },
        sessionTarget: input.sessionTarget ?? 'isolated',
        payload: {
          kind: 'agentTurn',
          message: input.message,
          timeoutSeconds: input.timeoutSeconds,
          lightContext: input.lightContext,
          model: input.model,
        },
        delivery: input.deliver === true
          ? { mode: 'announce' }
          : { mode: 'none', channel: 'last' },
        deleteAfterRun: input.deleteAfterRun ?? true,
        state: { nextRunAtMs: atMs },
      },
      { nowMs: now },
    )
    this.jobs.push(job)
    await this._safePersist()
    return toPublicJob(job)
  }

  /** Snapshot used by tests/verify: raw internal jobs (deep copy). */
  snapshotJobs() {
    return this.jobs.map(cloneJob)
  }
}
