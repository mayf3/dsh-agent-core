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

import { createHash, randomUUID } from 'node:crypto'
import {
  appendFileSync, closeSync, existsSync, fsyncSync, ftruncateSync, mkdirSync,
  openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { constants } from 'node:fs'
import { dirname, isAbsolute } from 'node:path'

/** Store document version; bumped only on breaking format changes. */
export const STORE_VERSION = 1

/** Error code for a corrupt / unsupported authority document (fail-loud). */
export const CORRUPT_STORE = 'IDEMPOTENCY_STORE_CORRUPT'

/** The single non-terminal state. */
export const STATE_RESERVED = 'reserved'
/** Terminal: Router accepted the message into the session inbox. */
export const STATE_DELIVERED = 'delivered'
/** Terminal: PROVEN no admission happened (see PROVEN_NO_ADMISSION_CODES). */
export const STATE_FAILED_NO_ADMISSION = 'failed_no_admission'
/** Terminal: admission could not be proven either way. */
export const STATE_OUTCOME_UNKNOWN = 'outcome_unknown'

/** All legal record states. */
export const RECORD_STATES = Object.freeze([
  STATE_RESERVED, STATE_DELIVERED, STATE_FAILED_NO_ADMISSION, STATE_OUTCOME_UNKNOWN,
])

/** Terminal states (durable outcome reuse; retention-eligible). */
export const TERMINAL_STATES = new Set([STATE_DELIVERED, STATE_FAILED_NO_ADMISSION, STATE_OUTCOME_UNKNOWN])

/**
 * The ONLY Router errors that PROVE no admission happened (C-IDM-008): both
 * are thrown by the Router BEFORE ensureRunning / proc.deliver. Everything
 * else (timeouts, process faults, unknown codes, ReconciliationCapacityError,
 * outcome_unknown carriers, ...) is outcome_unknown. Implementations must NOT
 * expand this set without an independent review.
 */
export const PROVEN_NO_ADMISSION_CODES = Object.freeze(['VALIDATION_ERROR', 'AGENT_NOT_FOUND'])

/** Max per-record history entries (oldest evicted beyond this). */
export const HISTORY_CAP = 16

/** Default retention window: 7 days. */
export const DEFAULT_RETENTION_MS = 604800000
/** Default max terminal records kept. */
export const DEFAULT_MAX_RECORDS = 100000
/** Retention sweep cadence: hourly. */
export const DEFAULT_SWEEP_INTERVAL_MS = 3600000
/** Evidence rotation threshold (10 MiB) and generations kept (2). */
export const DEFAULT_ROTATE_BYTES = 10485760
export const EVIDENCE_GENERATIONS = 2

const LOCK_RETRY_MS = 10
const LOCK_TIMEOUT_MS = 15000
const LOCK_STALE_MS = 30000
const PRIVATE_DIRECTORY_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600

function storeError(message, code = CORRUPT_STORE) {
  return Object.assign(new Error(message), { code })
}

/**
 * Canonical payload hash (C-IDM-002): sha256 over the FIXED insertion order
 * {agentId, message, requestId, sessionMode} of exactly the four wire
 * contract fields. Unknown request fields are ignored by the thin adapter
 * and therefore never participate in the hash; the Router receipt is not a
 * caller input and is excluded.
 * @param {{requestId:string, agentId:string, sessionMode:string, message:string}} payload
 * @returns {string} lowercase hex sha256.
 */
export function canonicalPayloadHash({ requestId, agentId, sessionMode, message }) {
  return createHash('sha256')
    .update(JSON.stringify({ agentId, message, requestId, sessionMode }), 'utf8')
    .digest('hex')
}

/** Validate one loaded record; throws CORRUPT_STORE on any deviation. */
function validateRecord(record, clientId, requestId, storeFile) {
  const at = `${JSON.stringify(clientId)}/${JSON.stringify(requestId)}`
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw storeError(`notification-ingress: idempotency record is not an object at ${at} in ${storeFile}`)
  }
  if (record.callerPrincipalId !== clientId || record.requestId !== requestId) {
    throw storeError(`notification-ingress: idempotency record identity mismatch at ${at} in ${storeFile}`)
  }
  if (typeof record.payloadHash !== 'string' || record.payloadHash === '') {
    throw storeError(`notification-ingress: idempotency record payloadHash missing at ${at} in ${storeFile}`)
  }
  if (!RECORD_STATES.includes(record.state)) {
    throw storeError(`notification-ingress: idempotency record has unknown state ${JSON.stringify(record.state)} at ${at} in ${storeFile}`)
  }
  if (typeof record.createdAt !== 'string' || typeof record.updatedAt !== 'string') {
    throw storeError(`notification-ingress: idempotency record timestamps missing at ${at} in ${storeFile}`)
  }
  if (record.sessionId !== undefined && (typeof record.sessionId !== 'string' || record.sessionId === '')) {
    throw storeError(`notification-ingress: idempotency record sessionId invalid at ${at} in ${storeFile}`)
  }
  if (record.failure !== undefined) {
    const { code, httpStatus } = record.failure ?? {}
    if (typeof code !== 'string' || code === '' || !Number.isInteger(httpStatus)) {
      throw storeError(`notification-ingress: idempotency record failure invalid at ${at} in ${storeFile}`)
    }
  }
  if (record.outcomeUnknown !== undefined) {
    if (record.outcomeUnknown === null || typeof record.outcomeUnknown !== 'object' || Array.isArray(record.outcomeUnknown)) {
      throw storeError(`notification-ingress: idempotency record outcomeUnknown invalid at ${at} in ${storeFile}`)
    }
  }
  if (record.history !== undefined) {
    if (!Array.isArray(record.history)) {
      throw storeError(`notification-ingress: idempotency record history must be an array at ${at} in ${storeFile}`)
    }
    for (const entry of record.history) {
      if (typeof entry?.at !== 'string' || typeof entry?.from !== 'string' || typeof entry?.to !== 'string') {
        throw storeError(`notification-ingress: idempotency record history entry invalid at ${at} in ${storeFile}`)
      }
    }
  }
}

/** Parse + validate the whole document; throws CORRUPT_STORE when unusable. */
function parseDocument(raw, storeFile) {
  let document
  try {
    document = JSON.parse(raw)
  } catch (error) {
    throw storeError(`notification-ingress: idempotency store is not valid JSON: ${storeFile} (${error.message})`)
  }
  if (document?.version !== STORE_VERSION) {
    throw storeError(`notification-ingress: unsupported idempotency store version ${JSON.stringify(document?.version)} in ${storeFile}`)
  }
  if (document.records === null || typeof document.records !== 'object' || Array.isArray(document.records)) {
    throw storeError(`notification-ingress: idempotency store records table invalid in ${storeFile}`)
  }
  for (const [clientId, perRequest] of Object.entries(document.records)) {
    if (perRequest === null || typeof perRequest !== 'object' || Array.isArray(perRequest)) {
      throw storeError(`notification-ingress: idempotency records row invalid at ${JSON.stringify(clientId)} in ${storeFile}`)
    }
    for (const [requestId, record] of Object.entries(perRequest)) {
      validateRecord(record, clientId, requestId, storeFile)
    }
  }
  return document
}

/** Deep-copy the records table (snapshot/rollback for the mutation queue). */
function snapshotRecords(records) {
  const out = new Map()
  for (const [clientId, perRequest] of records.entries()) {
    out.set(clientId, new Map([...perRequest.entries()].map(([rid, row]) => [rid, { ...row, history: row.history === undefined ? undefined : [...row.history] }])))
  }
  return out
}

/**
 * The durable delivery idempotency authority.
 *
 * Construction loads the store synchronously and fail-loud: a corrupt
 * document throws (the mount must abort — no server, no deliveries). The
 * boot sweep then migrates every non-terminal record to outcome_unknown.
 */
export class NotificationIdempotencyStore {
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

  // ── load / reload ────────────────────────────────────────────────────────

  /** Synchronous read + validate + adopt the latest document from disk. */
  reloadFromDiskSync() {
    if (!existsSync(this.storeFile)) {
      this.fileExists = false
      this.records = new Map()
      return
    }
    let raw
    try {
      raw = readFileSync(this.storeFile, 'utf8')
    } catch (error) {
      throw storeError(`notification-ingress: idempotency store is unreadable: ${this.storeFile} (${error.message})`)
    }
    const document = parseDocument(raw, this.storeFile)
    this.fileExists = true
    this.records = new Map()
    for (const [clientId, perRequest] of Object.entries(document.records)) {
      this.records.set(clientId, new Map(Object.entries(perRequest)))
    }
  }

  /** Async re-read of the latest document (inside the mutation lock). */
  async reloadLatest() {
    this.reloadFromDiskSync()
  }

  // ── cross-process advisory lock ──────────────────────────────────────────

  /**
   * Exclusive lockfile (single machine): O_EXCL create; a lock older than
   * LOCK_STALE_MS is broken; waiting gives up after LOCK_TIMEOUT_MS.
   * Defensive serialization only — one ingress per runtime is the authority.
   */
  acquireLockSync(purpose = 'mutation') {
    const start = this.clockMs()
    for (;;) {
      let fd
      try {
        mkdirSync(dirname(this.lockPath), { recursive: true, mode: PRIVATE_DIRECTORY_MODE })
        fd = openSync(this.lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR, PRIVATE_FILE_MODE)
        writeFileSync(fd, `${process.pid} ${purpose} ${this.now()}\n`, 'utf8')
        return fd
      } catch (error) {
        if (fd !== undefined) closeSync(fd)
        if (error?.code !== 'EEXIST') {
          throw storeError(`notification-ingress: cannot acquire idempotency lock ${this.lockPath} (${error.message})`)
        }
        try {
          const stat = statSync(this.lockPath)
          if (this.clockMs() - stat.mtimeMs > LOCK_STALE_MS) {
            rmSync(this.lockPath, { force: true })
            this.log.log('notification-ingress: broke a stale idempotency lock')
            continue
          }
        } catch { /* lock vanished — retry */ }
        if (this.clockMs() - start > LOCK_TIMEOUT_MS) {
          throw Object.assign(new Error(`notification-ingress: idempotency lock timeout on ${this.lockPath}`), { code: 'IDEMPOTENCY_STORE_LOCKED' })
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_RETRY_MS)
      }
    }
  }

  releaseLockSync(fd) {
    try { closeSync(fd) } catch { /* already closed */ }
    try { rmSync(this.lockPath, { force: true }) } catch { /* best effort */ }
  }

  // ── persistence ──────────────────────────────────────────────────────────

  serializeDocument() {
    const records = {}
    for (const [clientId, perRequest] of this.records.entries()) {
      records[clientId] = Object.fromEntries([...perRequest.entries()].map(([rid, row]) => [rid, { ...row }]))
    }
    return `${JSON.stringify({ version: STORE_VERSION, records }, null, 2)}\n`
  }

  /** Atomic synchronous persist: tmp + fsync + rename + directory fsync. */
  persistSync() {
    const serialized = this.serializeDocument()
    mkdirSync(dirname(this.storeFile), { recursive: true, mode: PRIVATE_DIRECTORY_MODE })
    const tmp = `${this.storeFile}.tmp-${process.pid}-${randomUUID()}`
    let fd
    try {
      fd = openSync(tmp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, PRIVATE_FILE_MODE)
      writeFileSync(fd, serialized, 'utf8')
      ftruncateSync(fd, serialized.length)
      fsyncSync(fd)
      closeSync(fd)
      fd = undefined
      renameSync(tmp, this.storeFile)
      this.fileExists = true
      // fsync the directory so the rename itself is durable (first creation
      // and every replacement alike).
      const dirFd = openSync(dirname(this.storeFile), constants.O_RDONLY)
      try { fsyncSync(dirFd) } catch { /* not supported on some FS */ }
      closeSync(dirFd)
    } catch (error) {
      if (fd !== undefined) { try { closeSync(fd) } catch { /* best effort */ } }
      try { rmSync(tmp, { force: true }) } catch { /* best effort */ }
      throw storeError(`notification-ingress: idempotency store persist failed: ${this.storeFile} (${error.message})`)
    }
  }

  // ── mutation queue (serialize + lock + re-read latest + snapshot rollback)

  enqueue(mutate) {
    const run = this.queue.then(async () => {
      const fd = this.acquireLockSync()
      const snapshot = snapshotRecords(this.records)
      const fileExisted = this.fileExists
      try {
        await this.reloadLatest()
        const result = await mutate()
        this.persistSync()
        return result
      } catch (error) {
        this.records = snapshot
        this.fileExists = fileExisted
        throw error
      } finally {
        this.releaseLockSync(fd)
      }
    })
    this.queue = run.then(() => undefined, () => undefined)
    return run
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

  // ── evidence (NOT an authority; never read by any decision path) ─────────

  /**
   * Append one evidence event to evidence.jsonl. Rotation at rotateBytes,
   * keeping EVIDENCE_GENERATIONS generations. Failures are logged and
   * swallowed — evidence must never break the authority path — and NO
   * credential material may ever be passed in here (redaction is enforced
   * upstream in auth.js / index.js).
   */
  appendEvidence(event) {
    try {
      mkdirSync(dirname(this.evidenceFile), { recursive: true, mode: PRIVATE_DIRECTORY_MODE })
      let size = 0
      try {
        size = statSync(this.evidenceFile).size
      } catch { /* not created yet */ }
      if (size >= this.rotateBytes) {
        // keep 2 generations: drop .1, current -> .1, fresh current.
        const gen1 = `${this.evidenceFile}.1`
        try { rmSync(gen1, { force: true }) } catch { /* best effort */ }
        try { renameSync(this.evidenceFile, gen1) } catch { /* best effort */ }
      }
      appendFileSync(this.evidenceFile, `${JSON.stringify({ ...event, at: this.now() })}\n`, 'utf8')
    } catch (error) {
      this.log.error(`notification-ingress: evidence append failed: ${error?.message ?? error}`)
    }
  }

  /** Read evidence lines (test/audit surface only — never a decision input). */
  evidenceLines() {
    try {
      return readFileSync(this.evidenceFile, 'utf8').trim().split('\n').filter((line) => line !== '').map((line) => JSON.parse(line))
    } catch {
      return []
    }
  }
}
