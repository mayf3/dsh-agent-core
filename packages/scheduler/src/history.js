/**
 * Durable Scheduler execution history (AGENT_CORE_SCHEDULER_RUN_HISTORY_V1).
 * events.jsonl is the append+fsync authority; monthly JSON files are atomic
 * query projections that replay-heal after a crash. History records D-007
 * facts verbatim and never gates admission, retry, or fence decisions.
 */

import path from 'node:path'
import { OwnerLock } from './lock.js'
import {
  HISTORY_OUTCOMES,
  HISTORY_STORE_VERSION,
  applyRunFilters,
  buildJobSnapshot,
  buildRunRecord,
  cloneHistoryValue as clone,
  historyIso as isoOf,
  historyMonth as monthOf,
  truncateHistoryError as truncateError,
} from './history-model.js'
import {
  applyHistoryEvent,
  deriveHistoryChain,
  historyChainRootFirst,
  historyRetryCount,
  materializeHistoryRun,
  publicHistoryOccurrence,
  writeHistoryPartition,
} from './history-projection.js'
import {
  appendHistoryEvent,
  healHistoryPartitions,
  readHistoryState,
  readProjectionRuns,
} from './history-storage.js'

export {
  HISTORY_STORE_VERSION,
  HISTORY_OUTCOMES,
  STATUS_VIEW_VOCABULARY,
  ERROR_CODES,
  RESULT_ERROR_CODES,
  RESULT_STATUSES,
  deriveStatusView,
  deriveErrorCode,
  buildRunRecord,
  applyRunFilters,
} from './history-model.js'

/** The HistoryStore. One instance per process; cross-process writes serialize on the lock file. */
export class HistoryStore {
  /**
   * @param {object} opts
   * @param {string} opts.dir - the history directory (…/scheduler/history)
   * @param {Function} [opts.nowMs] - wall clock (defaults Date.now)
   * @param {object} [opts.log] - { warn?, error? } sink
   */
  constructor(opts = {}) {
    if (typeof opts.dir !== 'string' || opts.dir === '') {
      throw new TypeError('HistoryStore: dir is required')
    }
    this.dir = opts.dir
    this.eventsPath = path.join(this.dir, 'events.jsonl')
    this.lockPath = path.join(this.dir, '.lock')
    this.nowMs = opts.nowMs ?? (() => Date.now())
    this.log = opts.log ?? {}
    this._lock = new OwnerLock(this.lockPath)
    this._mutexChain = Promise.resolve()
    this._loaded = false
    this._loadPromise = null
    // In-memory facts (rebuilt by load(); mutated only inside the lock).
    this._occurrences = new Map() // occurrence_id -> occurrence view
    this._runs = new Map() // run_id -> RunRecord (query surface)
    this._seq = 0
  }

  // ── load / replay heal (R6) ────────────────────────────────────────────

  /**
   * Eagerly start (or join) the initial load. Idempotent; writes await this
   * via _withLock, so a query racing the initial load can only see the
   * fail-loud "not loaded yet" assertion, never a partial view.
   */
  ensureLoaded() {
    if (this._loaded) return Promise.resolve()
    this._loadPromise ??= this.load()
    return this._loadPromise
  }

  /** Read immutable facts, heal projections, then atomically publish RAM state. */
  async load() {
    return this._lock.runExclusive(async () => {
      const { state, corruptLines } = readHistoryState(this, { empty: true })
      await healHistoryPartitions(state)
      this._installState(state)
      this._reportCorruptLines(corruptLines)
      this._loaded = true
    })
  }

  // ── engine-facing record API (called at lifecycle boundaries) ──────────

  /**
   * occurrence_reserved — admission fact + job_snapshot (R1/R5). Identity is
   * recorded verbatim from the authority ledger (R1a priority 1).
   * @param {object} input
   * @param {object} input.record - the admitted occurrence record (jobs.json v2 ledger shape)
   * @param {object} [input.job] - the live job definition at admission (for job_snapshot)
   */
  async occurrenceReserved({ record, job }) {
    if (!record?.occurrenceId || !record?.runId) throw new TypeError('HistoryStore.occurrenceReserved: record identity is required')
    return this._enqueue(() => this._withLock(async () => {
      const ts = this.nowMs()
      if (this._occurrences.has(record.occurrenceId)) {
        // R1a: a repeated observation of the same logical slot converges to
        // the same occurrence_id; keep the repeated reserve as evidence,
        // never regress state, never mint a second record.
        await this._appendEvent({
          ts, type: 'occurrence_reserved', replay_evidence: true,
          occurrence_id: record.occurrenceId, run_id: record.runId, job_id: record.jobId,
        })
        return { deduped: true }
      }
      const kind = record.kind ?? 'natural'
      // scheduled_at: the nominal slot for natural/catchup. For retry the
      // engine persists no nominal wall time — the admission instant IS the
      // retry's scheduled time (honest mapping, rebuilt identically).
      const scheduledAtMs = record.nominalScheduledAt ?? record.catchUpOfNominalAt ?? record.admittedAt ?? ts
      const chain = this._deriveChain(record)
      const event = {
        ts, type: 'occurrence_reserved',
        occurrence_id: record.occurrenceId,
        run_id: record.runId,
        job_id: record.jobId,
        job_snapshot: buildJobSnapshot(job, record),
        schedule_revision: record.scheduleRevision,
        origin: kind,
        scheduled_at_ms: scheduledAtMs,
        payload_hash: record.payloadHash,
        idempotency_key: record.idempotencyKey,
        admitted_at_ms: record.admittedAt ?? ts,
        retry_of_occurrence_id: record.retryOfOccurrenceId ?? null,
        correlation_id: chain.correlationId,
        parent_run_id: chain.parentRunId,
        deadline_at_ms: record.executionDeadlineAtMs ?? null,
        timeout_seconds: job?.payload?.timeoutSeconds ?? null,
        model: job?.payload?.model ?? null,
      }
      await this._appendEvent(event)
      return { deduped: false }
    }))
  }

  /** run_state — start evidence (admitted -> running). */
  async runStarted({ record }) {
    if (!record?.occurrenceId) throw new TypeError('HistoryStore.runStarted: record identity is required')
    return this._enqueue(() => this._withLock(async () => {
      const ts = this.nowMs()
      await this._appendEvent({
        ts, type: 'run_state', state: 'running',
        occurrence_id: record.occurrenceId, run_id: record.runId, job_id: record.jobId,
        started_at_ms: ts, start_evidence: 'invoker-dispatch',
      })
    }))
  }

  /** run_state — non-terminal observable states (restart sweep). */
  async runState({ record, state, reason }) {
    if (!record?.occurrenceId) throw new TypeError('HistoryStore.runState: record identity is required')
    if (!HISTORY_OUTCOMES.has(state) || state === 'succeeded' || state === 'failed') {
      throw new TypeError(`HistoryStore.runState: non-terminal state required, got ${state}`)
    }
    return this._enqueue(() => this._withLock(async () => {
      const ts = this.nowMs()
      await this._appendEvent({
        ts, type: 'run_state', state, reason: truncateError(reason),
        occurrence_id: record.occurrenceId, run_id: record.runId, job_id: record.jobId,
      })
      if (state === 'outcome_unknown') {
        await this._appendEvent({
          ts, type: 'fence_event', fence: 'active', reason: 'outcome_unknown without termination proof',
          occurrence_id: record.occurrenceId, run_id: record.runId, job_id: record.jobId,
        })
      }
    }))
  }

  /**
   * run_terminal — authoritative execution outcome write-back (R10). The
   * `outcome` envelope may carry the trusted wrapper's structured result
   * (`result`) or its ingestion rejection (`result_error_code`) — persisted
   * verbatim, never interpreted (R4/R-H7).
   */
  async runTerminal({ record, classification, deliveryStatus, outcome, startedAt }) {
    if (!record?.occurrenceId) throw new TypeError('HistoryStore.runTerminal: record identity is required')
    return this._enqueue(() => this._withLock(async () => {
      const ts = this.nowMs()
      const state = classification?.state
      if (!HISTORY_OUTCOMES.has(state)) throw new TypeError(`HistoryStore.runTerminal: bad state ${state}`)
      const view = this._occurrences.get(record.occurrenceId)
      const scheduledAtMs = view?.scheduledAtMs ?? record.admittedAt ?? ts
      const admittedAt = view?.admittedAt ?? record.admittedAt ?? ts
      const facts = {
        occurrence: {
          occurrenceId: record.occurrenceId,
          runId: record.runId,
          jobId: record.jobId,
          scheduleRevision: record.scheduleRevision,
          nativeSessionId: record.nativeSessionId ?? null,
          agentId: view?.agentId ?? record.agentId ?? null,
          model: view?.model ?? null,
          idempotencyKey: view?.idempotencyKey ?? record.occurrenceId,
          retryOfOccurrenceId: view?.retryOfOccurrenceId ?? record.retryOfOccurrenceId ?? null,
          correlationId: view?.correlationId ?? `schcorr:${record.occurrenceId}`,
          parentRunId: view?.parentRunId ?? null,
          retryCount: this._retryCount(record.occurrenceId),
        },
        classification: {
          state,
          reason: classification?.reason,
          endedAt: classification?.endedAt ?? ts,
          terminalEvidence: classification?.terminalEvidence,
          rejectionCode: classification?.rejectionCode,
        },
        deliveryStatus,
        outcome,
        startedAt: startedAt ?? view?.startedAt ?? null,
        startEvidence: view?.startEvidence ?? null,
        admittedAt,
        scheduledAtMs,
      }
      const runRecord = buildRunRecord(facts)
      await this._appendEvent({
        ts, type: 'run_terminal',
        occurrence_id: record.occurrenceId, run_id: record.runId, job_id: record.jobId,
        state,
        execution_outcome: classification?.executionOutcome ?? null,
        reason: truncateError(classification?.reason),
        delivery_status: deliveryStatus,
        started_at_ms: facts.startedAt,
        start_evidence: facts.startEvidence,
        ended_at_ms: facts.classification.endedAt,
        terminal_evidence: classification?.terminalEvidence ?? null,
        run_record: runRecord,
      })
      if (outcome?.result !== undefined || outcome?.result_error_code !== undefined) {
        await this._appendEvent({
          ts, type: 'result_recorded',
          occurrence_id: record.occurrenceId, run_id: record.runId, job_id: record.jobId,
          result_recorded: runRecord.result_recorded,
          result_status: runRecord.result_status,
          result_error_code: runRecord.result_error_code,
        })
      }
      if (state === 'succeeded' || state === 'failed') {
        await this._appendEvent({
          ts, type: 'fence_event', fence: 'cleared',
          reason: `run terminal: ${state}`,
          occurrence_id: record.occurrenceId, run_id: record.runId, job_id: record.jobId,
        })
      }
      return runRecord
    }))
  }

  /** delivery_outcome — D-007 §11.4 separate delivery fact (never rewrites execution). */
  async deliveryOutcome({ record, deliveryStatus }) {
    if (!record?.occurrenceId) throw new TypeError('HistoryStore.deliveryOutcome: record identity is required')
    return this._enqueue(() => this._withLock(async () => {
      const ts = this.nowMs()
      await this._appendEvent({
        ts, type: 'delivery_outcome', delivery_status: deliveryStatus,
        occurrence_id: record.occurrenceId, run_id: record.runId, job_id: record.jobId,
      })
    }))
  }

  /** late_settlement — trusted late evidence or operator reconcile. */
  async lateSettlement({ record, resolvedTo, basis, note, operatorIdentity }) {
    if (!record?.occurrenceId) throw new TypeError('HistoryStore.lateSettlement: record identity is required')
    if (resolvedTo !== 'succeeded' && resolvedTo !== 'failed') {
      throw new TypeError('HistoryStore.lateSettlement: resolvedTo must be succeeded|failed')
    }
    return this._enqueue(() => this._withLock(async () => {
      const ts = this.nowMs()
      await this._appendEvent({
        ts, type: 'late_settlement', resolved_to: resolvedTo, basis,
        note: truncateError(note),
        operator_username: operatorIdentity?.username ?? null,
        occurrence_id: record.occurrenceId, run_id: record.runId, job_id: record.jobId,
        ended_at_ms: ts,
      })
      await this._appendEvent({
        ts, type: 'fence_event', fence: 'cleared', reason: `late settlement resolved to ${resolvedTo}`,
        occurrence_id: record.occurrenceId, run_id: record.runId, job_id: record.jobId,
      })
    }))
  }

  // ── query surface (R7) ─────────────────────────────────────────────────

  /**
   * Query runs (the projection index). Filters: jobId, agentId, status
   * (task vocabulary + outcome_unknown), from/to (scheduled_at range),
   * sessionId, correlationId, occurrenceId; limit (default 50, max 200);
   * opaque cursor (scheduled_at desc + run_id tie-breaker).
   */
  queryRuns(filters = {}) {
    this._assertLoaded()
    const { runs, nextCursor, notice } = applyRunFilters(readProjectionRuns(this.dir, filters), filters)
    return { runs, next_cursor: nextCursor, ...(notice !== undefined ? { notice } : {}) }
  }

  /** One run by id (or null). */
  getRun(runId) {
    this._assertLoaded()
    return clone(readProjectionRuns(this.dir).get(runId)) ?? null
  }

  /**
   * Occurrence view (R7): the record, its runs (V1 cardinality 1), and the
   * retry chain from the chain root down to this occurrence.
   */
  getOccurrence(occurrenceId) {
    this._assertLoaded()
    const view = this._occurrences.get(occurrenceId)
    if (view === undefined) return null
    const projectionRuns = readProjectionRuns(this.dir)
    const runs = [...projectionRuns.values()]
      .filter((record) => record.occurrence_id === occurrenceId)
      .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))
    const retryChain = this._chainRootFirst(occurrenceId).map((id) => {
      const entry = this._occurrences.get(id)
      const run = [...projectionRuns.values()].find((record) => record.occurrence_id === id)
      return {
        occurrence_id: id,
        scheduled_at: isoOf(entry?.scheduledAtMs),
        outcome: run?.outcome ?? entry?.state ?? 'admitted',
      }
    })
    return { occurrence: this._occurrencePublic(view), runs, retry_chain: retryChain }
  }

  /** job_snapshot for a run or occurrence id (R5 query self-containment), or null. */
  getJobSnapshot(runIdOrOccurrenceId) {
    this._assertLoaded()
    const run = readProjectionRuns(this.dir).get(runIdOrOccurrenceId)
    const occurrenceId = run?.occurrence_id ?? runIdOrOccurrenceId
    return clone(this._occurrences.get(occurrenceId)?.jobSnapshot) ?? null
  }

  // ── internals ──────────────────────────────────────────────────────────

  _assertLoaded() {
    if (!this._loaded) throw new Error('HistoryStore: load() must complete before queries')
  }

  _enqueue(fn) {
    const run = this._mutexChain.then(fn)
    this._mutexChain = run.catch(() => {})
    return run
  }

  async _withLock(fn) {
    await this.ensureLoaded()
    return this._lock.runExclusive(async () => {
      const { state, corruptLines } = readHistoryState(this)
      await healHistoryPartitions(state)
      this._installState(state)
      this._reportCorruptLines(corruptLines)
      return fn()
    })
  }

  /**
   * Append one event (append + fsync) inside the lock, apply it to the
   * in-memory facts, then commit the affected month partition(s) (tmp +
   * fsync + rename). Event first, projection second — a crash in between
   * heals on load.
   */
  async _appendEvent(event) {
    try {
      const state = await appendHistoryEvent(this, event, (next, draft) => this._monthsTouched(next, draft))
      this._installState(state)
    } catch (error) {
      this._loaded = false
      this._loadPromise = null
      throw error
    }
  }

  /** Months whose projection content this event can change. */
  _monthsTouched(event, state = this) {
    const months = new Set()
    const view = state._occurrences.get(event.occurrence_id)
    if (view !== undefined) for (const month of view.months ?? []) months.add(month)
    if (Number.isFinite(event.scheduled_at_ms)) months.add(monthOf(event.scheduled_at_ms))
    const record = event.run_record
    if (record?.scheduled_at) months.add(monthOf(Date.parse(record.scheduled_at)))
    if (months.size === 0) months.add(monthOf(event.ts))
    return months
  }

  /**
   * Apply one event to the in-memory facts. Replay-identical to live
   * application (upsert-merge; a terminal fact is never regressed).
   */
  _applyEvent(event) {
    return applyHistoryEvent(this, event)
  }

  _installState(state) {
    this._seq = state._seq
    this._occurrences = state._occurrences
    this._runs = state._runs
  }

  _reportCorruptLines(count) {
    if (count > 0) {
      ;(this.log.warn ?? (() => {}))(`history store: skipped ${count} unparseable or invalid events.jsonl line(s) during load`)
    }
  }

  /** Rebuild the query-surface record for a run from its current facts, carrying richer earlier faces forward. */
  _materializeRun(view) {
    return materializeHistoryRun(this, view)
  }

  /** Derive correlation root / parent run for a newly admitted occurrence (R9). */
  _deriveChain(record) {
    return deriveHistoryChain(this, record)
  }

  /** retry_count = position along the retry chain (root = 0) — derived, never stored (R10). */
  _retryCount(occurrenceId) {
    return historyRetryCount(this, occurrenceId)
  }

  _chainRootFirst(occurrenceId) {
    return historyChainRootFirst(this, occurrenceId)
  }

  _occurrencePublic(view) {
    return publicHistoryOccurrence(view)
  }

  /** Write one month partition: tmp + fsync + atomic rename (jobs.json discipline). */
  async _writePartition(month) {
    return writeHistoryPartition(this, month)
  }
}
