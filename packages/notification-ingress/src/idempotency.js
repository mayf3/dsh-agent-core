/**
 * @agent-core/notification-ingress/src/idempotency.js — the durable delivery
 * idempotency authority (NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1 §5).
 *
 * ONE versioned JSON document is the single authority for "did this business
 * delivery already happen, and with which outcome":
 *
 *   path     = <production-root>/notification-ingress/idempotency.json
 *   shape    = { "version": 1,
 *                "records": { "<callerPrincipalId>": { "<requestId>": {
 *                  callerPrincipalId, requestId, payloadHash,
 *                  state: "reserved" | "delivered" | "failed_no_admission"
 *                       | "outcome_unknown",
 *                  createdAt, updatedAt,
 *                  sessionId?                      (delivered)
 *                  failure? {code, httpStatus}    (failed_no_admission)
 *                  outcomeUnknown? { reconciliationHandle?,
 *                                    deadlineAtWallMs?, source }  (unknown
 *                    wire keeps the reconciliation handle — task freeze)
 *                  history? [ {at, from, to, reason} ]  (≤16, oldest evicted)
 *                } } } }
 *
 * Persistence discipline (C-IDM-003, mirroring BindingStore / Scheduler V2):
 * internal mutation queue serializes mutations; every mutation takes a
 * cross-process advisory lockfile (`idempotency.lock` beside the store,
 * O_EXCL with stale-break), re-reads the LATEST document from disk, mutates,
 * then replaces the file atomically (tmp + fsync + rename + directory fsync).
 * The lockfile is defensive serialization only — exactly one ingress mounts
 * per production runtime (compose structure); it is not multi-instance
 * authorization.
 *
 * Fail-loud (C-IDM-003/014): a missing file is a legal empty store (fresh
 * deployment); a corrupt / unparseable / unknown-version / structurally
 * invalid document throws at construction — the service must NOT start, must
 * never wipe-and-recreate, never degrade to in-memory mode, and never accept
 * deliveries while the authority is unusable.
 *
 * Crash windows (C-IDM-009/010): W2–W4 all leave a non-terminal `reserved`
 * record on disk. At boot every non-terminal record is atomically migrated
 * to `outcome_unknown` (reason `restart_unresolved`) — under single-process
 * authority a restart proves the previous in-flight attempt dead, and an
 * unprovable admission is exactly `outcome_unknown`. Nothing ever auto
 * re-delivers a reserved record. Late Router settlements after a deadline are
 * evidence-only (`late_settled` appended to evidence.jsonl); the durable
 * outcome is NEVER rewritten (C-IDM-010d NO_LATE_REWRITE).
 *
 * Retention (C-IDM-013): sweep at boot + hourly; TERMINAL records only;
 * over-age first, then oldest-terminal over-count. Non-terminal records are
 * never directly pruned (they first pass the boot sweep).
 *
 * Evidence (C-IDM-015): append-only evidence.jsonl beside the store — events
 * auth_ok / auth_reject / idempotency_transition / outcome / late_settled /
 * sweep_pruned / boot_unresolved_sweep. Evidence is NOT an authority: no
 * decision path reads it, it never participates in recovery, and it never
 * carries credential material. Rotation at 10 MiB, 2 generations kept.
 *
 * C-IDM-016: this store NEVER reads or writes the Router's durable mapping
 * tables. The Router's own (agentId, requestId)→sessionId fresh-session map
 * keeps its session-identity semantics; this store keys on
 * (callerPrincipalId, requestId) and records delivery OUTCOMES.
 */

import { existsSync } from 'node:fs'
import { dirname, isAbsolute } from 'node:path'

import { IdempotencyPersistence } from './idempotency-persistence.js'
import {
  CORRUPT_STORE, DEFAULT_MAX_RECORDS, DEFAULT_RETENTION_MS, DEFAULT_ROTATE_BYTES,
  DEFAULT_SWEEP_INTERVAL_MS, EVIDENCE_GENERATIONS, HISTORY_CAP,
  PROVEN_NO_ADMISSION_CODES, RECORD_STATES, STATE_DELIVERED,
  STATE_FAILED_NO_ADMISSION, STATE_OUTCOME_UNKNOWN, STATE_RESERVED, STORE_VERSION,
  TERMINAL_STATES, canonicalPayloadHash, storeError,
} from './idempotency-record.js'

export {
  CORRUPT_STORE, DEFAULT_MAX_RECORDS, DEFAULT_RETENTION_MS, DEFAULT_ROTATE_BYTES,
  DEFAULT_SWEEP_INTERVAL_MS, EVIDENCE_GENERATIONS, HISTORY_CAP,
  PROVEN_NO_ADMISSION_CODES, RECORD_STATES, STATE_DELIVERED,
  STATE_FAILED_NO_ADMISSION, STATE_OUTCOME_UNKNOWN, STATE_RESERVED, STORE_VERSION,
  TERMINAL_STATES, canonicalPayloadHash,
} from './idempotency-record.js'

/**
 * The durable delivery idempotency authority.
 *
 * Construction loads the store synchronously and fail-loud: a corrupt
 * document throws (the mount must abort — no server, no deliveries). The
 * boot sweep then migrates every non-terminal record to outcome_unknown.
 */
export class NotificationIdempotencyStore extends IdempotencyPersistence {
  /**
   * @param {object} options
   * @param {string} options.storeFile - ABSOLUTE path of the JSON authority
   *   document (relative values are rejected fail-loud).
   * @param {string} [options.evidenceFile] - evidence JSONL path (default:
   *   `evidence.jsonl` beside the store).
   * @param {number} [options.retentionMs] - terminal retention window.
   * @param {number} [options.maxRecords] - terminal record cap.
   * @param {() => string} [options.now] - ISO timestamp provider (testable).
   * @param {() => number} [options.clockMs] - wall clock ms (testable).
   * @param {number} [options.sweepIntervalMs] - retention sweep cadence.
   * @param {number} [options.rotateBytes] - evidence rotation threshold.
   * @param {object} [options.log] - logger {log,error} (default silent).
   */
  constructor({
    storeFile, evidenceFile, retentionMs = DEFAULT_RETENTION_MS, maxRecords = DEFAULT_MAX_RECORDS,
    now = () => new Date().toISOString(), clockMs = () => Date.now(),
    sweepIntervalMs = DEFAULT_SWEEP_INTERVAL_MS, rotateBytes = DEFAULT_ROTATE_BYTES,
    log = { log() {}, error() {} },
  } = {}) {
    super()
    if (typeof storeFile !== 'string' || storeFile === '' || !isAbsolute(storeFile)) {
      throw storeError('notification-ingress: idempotency storeFile must be an absolute path', 'VALIDATION_ERROR')
    }
    this.storeFile = storeFile
    this.evidenceFile = evidenceFile ?? `${dirname(storeFile)}/evidence.jsonl`
    this.lockPath = `${dirname(storeFile)}/idempotency.lock`
    this.retentionMs = retentionMs
    this.maxRecords = maxRecords
    this.rotateBytes = rotateBytes
    this.now = now
    this.clockMs = clockMs
    this.log = log
    this.fileExists = existsSync(storeFile)
    /** @type {Map<string, Map<string, object>>} clientId -> (requestId -> record) */
    this.records = new Map()
    this.queue = Promise.resolve()
    this.sweepTimer = undefined
    if (this.fileExists) {
      this.reloadFromDiskSync()
    }
    // Boot: unresolved non-terminal records are atomically migrated to
    // outcome_unknown, then retention prunes terminal records (C-IDM-010a/013).
    const bootLock = this.acquireLockSync('boot')
    try {
      if (this.fileExists) this.reloadFromDiskSync()
      const migrated = this.migrateUnresolvedSync('restart_unresolved')
      const pruned = this.sweepTerminalSync()
      if (migrated > 0 || pruned > 0) this.persistSync()
      if (migrated > 0) {
        this.appendEvidence({ kind: 'boot_unresolved_sweep', count: migrated })
        this.log.log(`notification-ingress: boot sweep migrated ${migrated} unresolved record(s) to outcome_unknown`)
      }
      if (pruned > 0) this.appendEvidence({ kind: 'sweep_pruned', count: pruned })
    } finally {
      this.releaseLockSync(bootLock)
    }
    if (sweepIntervalMs > 0) {
      this.sweepTimer = setInterval(() => {
        this.sweepNow().catch((error) => {
          this.log.error(`notification-ingress: retention sweep failed: ${error?.message ?? error}`)
        })
      }, sweepIntervalMs)
      this.sweepTimer.unref?.()
    }
  }

  /** Stop the retention timer (dispose path). */
  stop() {
    if (this.sweepTimer !== undefined) {
      clearInterval(this.sweepTimer)
      this.sweepTimer = undefined
    }
  }

  // ── record helpers ───────────────────────────────────────────────────────

  /** In-memory lookup (copy) — the mutation queue keeps RAM = disk. */
  lookup(callerPrincipalId, requestId) {
    const row = this.records.get(callerPrincipalId)?.get(requestId)
    return row === undefined ? undefined : { ...row }
  }

  /** Current terminal record count. */
  terminalCount() {
    let count = 0
    for (const perRequest of this.records.values()) {
      for (const row of perRequest.values()) {
        if (TERMINAL_STATES.has(row.state)) count += 1
      }
    }
    return count
  }

  /** Append {at, from, to, reason} to the record history (cap HISTORY_CAP). */
  static historyPush(record, at, from, to, reason) {
    if (record.history === undefined) record.history = []
    record.history.push({ at, from, to, reason })
    while (record.history.length > HISTORY_CAP) record.history.shift()
  }

  // ── authority operations ─────────────────────────────────────────────────

  /**
   * Atomically judge + reserve one delivery key (C-IDM-001/004/005/006/007).
   * Runs inside the mutation queue (lock + re-read-latest), so the
   * judge-and-reserve decision is atomic against every other caller.
   *
   * @returns {Promise<{outcome:'new'}|{outcome:'terminal', record:object}
   *   |{outcome:'reserved', record:object}|{outcome:'conflict', record:object}>}
   */
  reserve({ callerPrincipalId, requestId, payloadHash }) {
    for (const [field, value] of Object.entries({ callerPrincipalId, requestId, payloadHash })) {
      if (typeof value !== 'string' || value === '') {
        return Promise.reject(storeError(`notification-ingress: reserve ${field} must be a non-empty string`, 'VALIDATION_ERROR'))
      }
    }
    return this.enqueue(async () => {
      let perRequest = this.records.get(callerPrincipalId)
      if (perRequest === undefined) {
        perRequest = new Map()
        this.records.set(callerPrincipalId, perRequest)
      }
      const existing = perRequest.get(requestId)
      if (existing !== undefined) {
        if (existing.payloadHash !== payloadHash) {
          // C-IDM-006: same key + different payload — conflict, no delivery,
          // the original record is never rewritten.
          return { outcome: 'conflict', record: { ...existing } }
        }
        return TERMINAL_STATES.has(existing.state)
          ? { outcome: 'terminal', record: { ...existing } }
          : { outcome: 'reserved', record: { ...existing } }
      }
      // C-IDM-004: the durable `reserved` write commits BEFORE the Router is
      // ever called (the caller proceeds only after this resolves).
      const record = {
        callerPrincipalId,
        requestId,
        payloadHash,
        state: STATE_RESERVED,
        createdAt: this.now(),
        updatedAt: this.now(),
      }
      perRequest.set(requestId, record)
      this.appendEvidence({ kind: 'idempotency_transition', from: '(none)', to: STATE_RESERVED, reason: 'reserve', callerPrincipalId, requestId })
      return { outcome: 'new' }
    })
  }

  /**
   * Durably record one terminal outcome (C-IDM-005 settle path). Only the
   * owner of the in-flight attempt settles; a terminal record is NEVER
   * rewritten (NO_LATE_REWRITE — late Router settlements go to evidence via
   * recordLateSettled).
   *
   * @param {object} input
   * @param {'delivered'|'failed_no_admission'|'outcome_unknown'} input.state
   * @returns {Promise<{record:object, superseded:boolean}>}
   */
  settle({
    callerPrincipalId, requestId, state, sessionId, failure, outcomeUnknown, reason,
  }) {
    if (!TERMINAL_STATES.has(state)) {
      return Promise.reject(storeError(`notification-ingress: settle state must be terminal (got ${JSON.stringify(state)})`, 'VALIDATION_ERROR'))
    }
    return this.enqueue(async () => {
      const record = this.records.get(callerPrincipalId)?.get(requestId)
      if (record === undefined) {
        throw storeError(`notification-ingress: settle target record missing for ${callerPrincipalId}/${requestId}`)
      }
      if (record.state !== STATE_RESERVED) {
        // Terminal already recorded — never rewrite (NO_LATE_REWRITE).
        return { record: { ...record }, superseded: true }
      }
      const from = record.state
      record.state = state
      record.updatedAt = this.now()
      if (sessionId !== undefined) record.sessionId = sessionId
      if (failure !== undefined) record.failure = failure
      if (outcomeUnknown !== undefined) record.outcomeUnknown = outcomeUnknown
      NotificationIdempotencyStore.historyPush(record, record.updatedAt, from, state, reason ?? state)
      this.appendEvidence({ kind: 'idempotency_transition', from, to: state, reason: reason ?? state, callerPrincipalId, requestId })
      this.appendEvidence({ kind: 'outcome', outcome: state, callerPrincipalId, requestId })
      return { record: { ...record }, superseded: false }
    })
  }

  /**
   * Late Router settlement after the deadline already judged outcome_unknown:
   * EVIDENCE ONLY — the durable outcome never changes (C-IDM-010d).
   * @returns {Promise<void>}
   */
  recordLateSettled({ callerPrincipalId, requestId, settled, detail }) {
    return this.enqueue(async () => {
      const record = this.records.get(callerPrincipalId)?.get(requestId)
      const state = record?.state
      this.appendEvidence({
        kind: 'late_settled',
        callerPrincipalId,
        requestId,
        settled,
        durableStateAtLateSettlement: state,
        detail: typeof detail === 'string' ? detail.slice(0, 200) : undefined,
      })
    })
  }

  /**
   * Defensive: a `reserved` record with no live attempt in THIS process
   * (only possible through foreign-process interference under the
   * single-process authority) is unprovable -> settle outcome_unknown.
   */
  settleUnresolvedReserved({ callerPrincipalId, requestId, reason = 'unresolved_reserved' }) {
    return this.settle({ callerPrincipalId, requestId, state: STATE_OUTCOME_UNKNOWN, reason })
  }

  // ── sweeps ───────────────────────────────────────────────────────────────

  /** Migrate every non-terminal record to outcome_unknown (boot sweep body). */
  migrateUnresolvedSync(reason) {
    let migrated = 0
    for (const perRequest of this.records.values()) {
      for (const record of perRequest.values()) {
        if (record.state === STATE_RESERVED) {
          const from = record.state
          record.state = STATE_OUTCOME_UNKNOWN
          record.updatedAt = this.now()
          record.outcomeUnknown = { source: reason }
          NotificationIdempotencyStore.historyPush(record, record.updatedAt, from, STATE_OUTCOME_UNKNOWN, reason)
          this.appendEvidence({ kind: 'idempotency_transition', from, to: STATE_OUTCOME_UNKNOWN, reason, callerPrincipalId: record.callerPrincipalId, requestId: record.requestId })
          migrated += 1
        }
      }
    }
    return migrated
  }

  /**
   * Retention prune (C-IDM-013): terminal records only — over-age first,
   * then oldest-terminal over-count. Non-terminal records are never touched.
   */
  sweepTerminalSync() {
    const nowMs = this.clockMs()
    const flat = []
    for (const [clientId, perRequest] of this.records.entries()) {
      for (const [rid, record] of perRequest.entries()) {
        if (TERMINAL_STATES.has(record.state)) {
          flat.push({ clientId, rid, record, terminalAtMs: Date.parse(record.updatedAt) || 0 })
        }
      }
    }
    let pruned = 0
    const drop = (entry) => {
      const perRequest = this.records.get(entry.clientId)
      if (perRequest === undefined) return
      const row = perRequest.get(entry.rid)
      if (row !== entry.record) return
      perRequest.delete(entry.rid)
      if (perRequest.size === 0) this.records.delete(entry.clientId)
      pruned += 1
    }
    // 1) over-age terminal records.
    const ageCutoff = nowMs - this.retentionMs
    for (const entry of flat) {
      if (entry.terminalAtMs < ageCutoff) drop(entry)
    }
    // 2) still over-count: evict oldest terminal first.
    const remaining = []
    for (const [clientId, perRequest] of this.records.entries()) {
      for (const [rid, record] of perRequest.entries()) {
        if (TERMINAL_STATES.has(record.state)) {
          remaining.push({ clientId, rid, record, terminalAtMs: Date.parse(record.updatedAt) || 0 })
        }
      }
    }
    if (remaining.length > this.maxRecords) {
      remaining.sort((a, b) => a.terminalAtMs - b.terminalAtMs)
      for (const entry of remaining.slice(0, remaining.length - this.maxRecords)) drop(entry)
    }
    return pruned
  }

  /** Hourly sweep entrypoint (queued through the normal discipline). */
  sweepNow() {
    return this.enqueue(async () => {
      const pruned = this.sweepTerminalSync()
      if (pruned > 0) this.appendEvidence({ kind: 'sweep_pruned', count: pruned })
      return pruned
    })
  }

  /** Apply auth-config retention overrides (single authority: auth.json). */
  applyTuning({ retentionMs, maxRecords } = {}) {
    if (retentionMs !== undefined) this.retentionMs = retentionMs
    if (maxRecords !== undefined) this.maxRecords = maxRecords
  }


}
