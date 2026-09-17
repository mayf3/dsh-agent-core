import { normalizeJob, toPublicJob } from './job-model.js'
import { applyTransition, rebuildFences } from './occurrence-model.js'
import {
  DEFAULT_AT_CATCHUP_GRACE_MS,
  deriveJobStateSummary,
  hasNonTerminalOccurrence,
  isTerminalRecord,
  naturalCandidate,
  retryCandidate,
} from './eligibility.js'
import {
  accountDowntimeSlots,
  createSlotAccountingCursor,
  latestPastSlot,
  recordSlotAccounting,
} from './watchdog/slot-accounting.js'
import { MIN_REFIRE_GAP_MS } from './schedule.js'

function jobSlotAccountingFloorMs(job, occurrences) {
  const activation = Number.isFinite(job.revisionActivatedAtMs) ? job.revisionActivatedAtMs : job.createdAtMs
  let floor = activation
  for (const record of occurrences) {
    if (record.jobId !== job.id || !isTerminalRecord(record)) continue
    const end = record.terminationSettlement?.committedAt ?? record.endedAt ?? record.admittedAt
    if (Number.isFinite(end) && end + MIN_REFIRE_GAP_MS > floor) floor = end + MIN_REFIRE_GAP_MS
  }
  return floor
}
import {
  createJobOp,
  updateJobOp,
  enableJobOp,
  disableJobOp,
  deleteJobOp,
  submitOneShotOp,
  reconcileOccurrence as reconcileOccurrenceOp,
} from './control.js'
import {
  AGENT_TURN_SAFETY_TIMEOUT_MS,
  TIMEOUT_ERROR_TEXT,
  occurrenceEngineMethods,
} from './occurrence.js'

export { AGENT_TURN_SAFETY_TIMEOUT_MS, TIMEOUT_ERROR_TEXT }

const defaultLog = {
  info: (...args) => process.stderr.write(`[scheduler] ${args.join(' ')}\n`),
  warn: (...args) => process.stderr.write(`[scheduler] WARN ${args.join(' ')}\n`),
  error: (...args) => process.stderr.write(`[scheduler] ERROR ${args.join(' ')}\n`),
}

/**
 * Scheduler V2. Job definitions produce durable logical occurrences; every
 * execution decision is made from the occurrence ledger, never runningAtMs.
 */
export class Scheduler {
  constructor(deps) {
    if (!deps?.store) throw new TypeError('Scheduler: store is required')
    if (typeof deps?.invoker?.invokeAgent !== 'function' && typeof deps?.invoker !== 'function') {
      throw new TypeError('Scheduler: invoker (invokeAgent seam) is required')
    }
    this.store = deps.store
    this.invoker = typeof deps.invoker === 'function'
      ? { invokeAgent: deps.invoker, assertRunnable: deps.invoker.assertRunnable }
      : deps.invoker
    if (typeof this.invoker.assertRunnable !== 'function') {
      throw new TypeError('Scheduler: invoker.assertRunnable(agentId) synchronous eligibility seam is required')
    }
    this.deliver = deps.deliver ?? (async () => {})
    this.nowMs = deps.nowMs ?? (() => Date.now())
    this.tickMs = deps.tickMs ?? 1000
    this.concurrency = Math.max(1, deps.concurrency ?? 5)
    this.atCatchupGraceMs = deps.atCatchupGraceMs ?? DEFAULT_AT_CATCHUP_GRACE_MS
    this.deadlineSetTimeout = deps.deadlineSetTimeout ?? setTimeout
    this.deadlineClearTimeout = deps.deadlineClearTimeout ?? clearTimeout
    this.log = deps.log ?? defaultLog
    // AGENT_CORE_SCHEDULER_RUN_HISTORY_V1: optional structured-history sink.
    // Facts only — never consulted by admission (spec R-H1).
    this.history = deps.history ?? null

    this.doc = { version: 3, jobs: [], occurrences: [], fences: {} }
    this._timer = null
    this._executing = false
    this._rerunPending = false
    this._stopped = false
    this._started = false
    this._engineLease = null
    this._inflight = new Set()
    // Slot accounting (NO_SILENT_SLOT_LOSS): per-session dedupe cursor so an
    // elapsed slot is durably receipted exactly once per engine session.
    this._slotCursor = createSlotAccountingCursor()
    this._engineSessionId = `${process.pid}:${Date.now().toString(36)}`
    this._leaseLossRecorded = false
    // Stale-retry receipts: once per engine session per superseded state —
    // the detection loop re-derives the same candidate every tick.
    this._staleRetryNoted = new Set()
  }

  async load() {
    const doc = await this.store.loadDoc()
    const jobs = []
    for (const entry of doc.jobs) {
      try {
        jobs.push(normalizeJob(entry, { nowMs: this.nowMs() }))
      } catch (error) {
        this.log.warn(`dropping corrupt job ${entry?.id ?? '(unknown)'}: ${error.message}`)
      }
    }
    this.doc = { ...doc, jobs }
    return this.doc
  }

  /**
   * Lease -> upgrade -> recovery completes before ANY admission (runnable
   * state is published only after the store is recovered). A dead prior
   * engine's lease is reaped exclusively on mechanical pid-death proof
   * inside acquireEngineLease (never a time threshold).
   */
  async start({ autoStart = true, catchup = true } = {}) {
    if (this._started) throw new Error('Scheduler: already started')
    this._started = true
    try {
      this._engineLease = await this.store.acquireEngineLease()
      await this.store.ensureUpgraded()
      await this.load()
      this._executing = true
      try {
        // Recovery sweep is mandatory even when operational catch-up is off.
        await this._sweepUnresolved()
        // Slot accounting before catch-up: the newest elapsed slot belongs to
        // the native at-most-one catch-up (its receipt will be the catch-up
        // occurrence); every OLDER elapsed slot is receipted as missed.
        await this._accountDowntime()
        if (catchup) await this._startupCatchup()
      } finally {
        this._executing = false
      }
      if (autoStart) this._startTimer()
      return this
    } catch (error) {
      await this._engineLease?.release().catch(() => {})
      this._engineLease = null
      this._started = false
      throw error
    }
  }

  async stop() {
    this._stopped = true
    this._clearTimer()
    await this.whenIdle()
    await this._engineLease?.release()
    this._engineLease = null
  }

  /**
   * Single-live-engine guard: admission passes require the engine lease to
   * still be verifiably ours. A lost/superseded lease (foreign removal,
   * superseding engine) halts admission fail-loud — two live engines can
   * never both admit against one store. The halt itself is durably receipted
   * (engine_lease_lost) so elapsed slots are never silently unexplained.
   */
  async _assertEngineLeaseHeld() {
    if (this._stopped) return false
    if (!this._engineLease) {
      await this._recordLeaseLoss('engine lease reference unavailable')
      return false
    }
    if (!(await this._engineLease.verify())) {
      this._stopped = true
      this.log.error('engine lease lost or superseded — admission halted (single-live-engine guard)')
      await this._recordLeaseLoss('engine lease verification failed (lost or superseded)')
      return false
    }
    return true
  }

  async _recordLeaseLoss(reason) {
    if (this._leaseLossRecorded) return
    this._leaseLossRecorded = true
    try {
      await this.store.appendRunEvent({
        ts: this.nowMs(), action: 'engine_lease_lost', reason,
        engineSessionId: this._engineSessionId,
      })
    } catch { /* evidence is best-effort; the halt decision stands */ }
  }

  async whenIdle() {
    while (this._inflight.size > 0 || this._executing) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }

  _startTimer() {
    this._clearTimer()
    this._timer = setInterval(() => {
      this.tick().catch((error) => this.log.error(`tick failed: ${error?.message ?? error}`))
    }, this.tickMs)
    if (this._timer.unref) this._timer.unref()
  }

  _clearTimer() {
    if (this._timer) clearInterval(this._timer)
    this._timer = null
  }

  async tick() {
    if (this._stopped) return 0
    if (this._executing) {
      this._rerunPending = true
      return 0
    }
    this._executing = true
    try {
      let total = 0
      do {
        this._rerunPending = false
        total += await this._tickOnce()
      } while (this._rerunPending && !this._stopped)
      return total
    } finally {
      this._executing = false
    }
  }

  async _tickOnce() {
    if (this._stopped) return 0
    const leaseHeld = await this._assertEngineLeaseHeld()
    const now = this.nowMs()
    await this.load()
    if (!leaseHeld) {
      // Halted engine still leaves durable slot accounting — a halted engine
      // must never be indistinguishable from "no slot ever came due".
      await this._accountEngineHalted(now)
      return 0
    }
    const candidates = []
    for (const job of this.doc.jobs) {
      try {
        if (!job.enabled) continue
        if (this.doc.fences[job.id] !== undefined) {
          await this._recordPolicySkip(job, now, 'fenced (outcome_unknown in flight)')
          continue
        }
        if (hasNonTerminalOccurrence(this.doc.occurrences, job.id)) {
          await this._recordPolicySkip(job, now, 'non-terminal occurrence in flight')
          continue
        }
        const retry = retryCandidate({ job, occurrences: this.doc.occurrences, nowMs: now })
        if (retry && !retry.exhausted) {
          if (retry.due) candidates.push({ kind: 'retry', job, retryOfOccurrenceId: retry.retryOfOccurrenceId })
          continue
        }
        if (retry?.staleRevision) {
          // Durable policy receipt: the pending retry belongs to a
          // superseded schedule revision (minting it would failLoud the
          // store); the natural schedule below still owns this job's slots.
          const notedKey = `${job.id}:${retry.predecessorScheduleRevision}->${job.scheduleRevision}`
          if (!this._staleRetryNoted.has(notedKey)) {
            this._staleRetryNoted.add(notedKey)
            await this.store.appendRunEvent({
              ts: now, action: 'retry_superseded_by_revision', jobId: job.id,
              retryOfOccurrenceId: retry.retryOfOccurrenceId,
              predecessorScheduleRevision: retry.predecessorScheduleRevision,
              jobScheduleRevision: job.scheduleRevision,
            })
          }
        }
        const natural = naturalCandidate({
          job,
          occurrences: this.doc.occurrences,
          nowMs: now,
          atCatchupGraceMs: this.atCatchupGraceMs,
        })
        if (natural.due) candidates.push({ kind: 'natural', job, nominalScheduledAt: natural.nominal })
        else await this._recordPolicySkip(job, now, natural.reason, natural.nominal)
      } catch (error) {
        const slot = latestPastSlot({ schedule: job.schedule, jobId: job.id, nowMs: now })
        await this._recordSlot(job, slot, 'DETECTION_INTERRUPTED', String(error?.message ?? error).slice(0, 300))
      }
    }
    let fired = 0
    for (const candidate of candidates) {
      if (this._inflight.size >= this.concurrency) break
      const slot = candidate.nominalScheduledAt ?? candidate.catchUpOfNominalAt
      let rejectionReason = null
      let reserved
      try {
        reserved = await this._reserve(candidate, (reason) => { rejectionReason = reason })
      } catch (error) {
        // Fail-closed stays fail-loud (accepted ACC-032/CROSS-AGENT semantics):
        // the admission interruption is receipted, the not-yet-attempted
        // candidates are receipted as skipped, and the error still propagates.
        await this._recordSlot(candidate.job, slot, 'ADMISSION_INTERRUPTED', String(error?.message ?? error).slice(0, 300))
        for (const pending of candidates.slice(candidates.indexOf(candidate) + 1)) {
          await this._recordSlot(
            pending.job, pending.nominalScheduledAt ?? pending.catchUpOfNominalAt,
            'SKIPPED_POLICY', 'tick aborted by an admission failure (fail-closed propagation)',
          )
        }
        throw error
      }
      if (!reserved) {
        await this._recordSlot(candidate.job, slot, 'ADMISSION_REJECTED', rejectionReason ?? 'reserve refused without a reason')
        continue
      }
      if (reserved.deduped) continue
      void this._runOccurrence(reserved.job, reserved.record).catch((error) => {
        this.log.error(`occurrence ${reserved.record.occurrenceId} run failed: ${error?.message ?? error}`)
      })
      if (typeof slot === 'number') this._slotCursor.mark(candidate.job.id, slot)
      fired += 1
    }
    return fired
  }

  /** Durable receipt for one elapsed slot (deduped per engine session). */
  async _recordSlot(job, slot, classification, reason, extra = {}) {
    if (!job || typeof slot !== 'number' || !this._slotCursor.shouldRecord(job.id, slot)) return
    // Slots at-or-before the accounting floor were never due slots (pre-
    // activation, or covered by the last terminal run + refire gap): they
    // are policy non-events, not silent losses.
    const floor = jobSlotAccountingFloorMs(job, this.doc.occurrences)
    if (slot <= floor) return
    const ok = await recordSlotAccounting(this.store, {
      ts: this.nowMs(), jobId: job.id, agentId: job.agentId, slot,
      classification, reason, ...extra,
    })
    if (ok) this._slotCursor.mark(job.id, slot)
  }

  /** SKIPPED_POLICY receipt: the engine observed the slot and chose not to run it. */
  async _recordPolicySkip(job, nowMs, reason, nominal = undefined) {
    const slot = nominal ?? latestPastSlot({ schedule: job.schedule, jobId: job.id, nowMs })
    await this._recordSlot(job, slot, 'SKIPPED_POLICY', reason)
  }

  async _accountEngineHalted(now) {
    for (const job of this.doc.jobs) {
      if (!job.enabled) continue
      const slot = latestPastSlot({ schedule: job.schedule, jobId: job.id, nowMs: now })
      await this._recordSlot(job, slot, 'ENGINE_HALTED', 'engine could not verify the admission lease — slot not evaluated')
    }
  }

  /** Recovery never re-admits an admitted/running record. */
  async _sweepUnresolved() {
    const now = this.nowMs()
    const swept = []
    await this._commitDoc((doc) => {
      for (const record of doc.occurrences) {
        if (record.state !== 'admitted' && record.state !== 'running') continue
        applyTransition(record, {
          to: 'outcome_unknown',
          at: now,
          reason: 'restart_unresolved: no termination proof at recovery',
          deliveryStatus: record.deliveryStatus ?? 'unknown',
        })
        swept.push({ occurrenceId: record.occurrenceId, runId: record.runId, jobId: record.jobId })
      }
      doc.fences = rebuildFences(doc.occurrences)
      for (const job of doc.jobs) job.state = deriveJobStateSummary(job, doc.occurrences, now)
    })
    for (const record of swept) {
      await this._evidence({ ts: now, action: 'outcome', occurrenceId: record.occurrenceId, state: 'outcome_unknown', reason: 'restart_unresolved' })
      await this._historyWrite('runState', {
        record,
        state: 'outcome_unknown',
        reason: 'restart_unresolved: no termination proof at recovery',
      })
    }
    return swept.map((record) => record.occurrenceId)
  }

  /** Downtime backfill: durable MISSED receipts for pre-catch-up slots. */
  async _accountDowntime() {
    await accountDowntimeSlots({
      store: this.store,
      jobs: this.doc.jobs,
      occurrences: this.doc.occurrences,
      nowMs: this.nowMs(),
      cursor: this._slotCursor,
      engineSessionId: this._engineSessionId,
    })
  }

  /** Native restart policy: at most the most recent eligible missed slot. */
  async _startupCatchup() {
    if (!(await this._assertEngineLeaseHeld())) return 0
    const now = this.nowMs()
    let count = 0
    for (const job of this.doc.jobs) {
      if (this._inflight.size >= this.concurrency) break
      if (!job.enabled || this.doc.fences[job.id] !== undefined) continue
      if (hasNonTerminalOccurrence(this.doc.occurrences, job.id)) continue
      const candidate = naturalCandidate({
        job,
        occurrences: this.doc.occurrences,
        nowMs: now,
        atCatchupGraceMs: this.atCatchupGraceMs,
      })
      if (!candidate.due) continue
      const reserved = await this._reserve({
        kind: 'catchup',
        job,
        catchUpOfNominalAt: candidate.nominal,
      })
      if (!reserved || reserved.deduped) continue
      void this._runOccurrence(reserved.job, reserved.record).catch((error) => {
        this.log.error(`catch-up occurrence failed: ${error?.message ?? error}`)
      })
      count += 1
    }
    return count
  }

  async _commitDoc(fn) {
    const { doc } = await this.store.mutateDoc(fn)
    this.doc = doc
  }

  listOccurrences(jobId) {
    return (jobId === undefined
      ? this.doc.occurrences
      : this.doc.occurrences.filter((record) => record.jobId === jobId))
      .map((record) => structuredClone(record))
  }

  isFenced(jobId) {
    return this.doc.fences[jobId] !== undefined
  }

  async createJob(input) {
    const result = await createJobOp(this.store, input, { nowMs: this.nowMs() })
    await this.load()
    return result
  }

  async updateJob(id, patch) {
    const result = await updateJobOp(this.store, id, patch, { nowMs: this.nowMs() })
    await this.load()
    return result
  }

  async enableJob(id) {
    const result = await enableJobOp(this.store, id, { nowMs: this.nowMs() })
    await this.load()
    return result
  }

  async disableJob(id) {
    const result = await disableJobOp(this.store, id, { nowMs: this.nowMs() })
    await this.load()
    return result
  }

  async deleteJob(id) {
    const result = await deleteJobOp(this.store, id)
    await this.load()
    return result
  }

  async listJobs() {
    return this.doc.jobs.map((job) => ({
      ...toPublicJob(job),
      fenced: this.doc.fences[job.id] !== undefined,
    }))
  }

  async getJob(id) {
    const job = this.doc.jobs.find((entry) => entry.id === id)
    return job ? { ...toPublicJob(job), fenced: this.doc.fences[job.id] !== undefined } : undefined
  }

  async submitOneShot(input) {
    const result = await submitOneShotOp(this.store, input, { nowMs: this.nowMs() })
    await this.load()
    return result
  }

  async readRunEvidence({ limit } = {}) {
    return this.store.readRunEvents({ limit })
  }

  async reconcileOccurrence(occurrenceId, runId, { resolvedTo, evidenceNote }) {
    const result = await reconcileOccurrenceOp(this.store, {
      occurrenceId, runId, resolvedTo, evidenceNote, nowMs: this.nowMs(),
    })
    await this.load()
    await this._historyWrite('lateSettlement', {
      record: result.record,
      resolvedTo,
      basis: 'operator-reconcile',
      note: evidenceNote,
      operatorIdentity: result.identity,
    })
    return result
  }

  snapshotJobs() {
    return this.doc.jobs.map((job) => structuredClone(job))
  }
}

Object.assign(Scheduler.prototype, occurrenceEngineMethods)
