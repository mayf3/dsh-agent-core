/**
 * @agent-core/workflow-execution/src/ledger.js — the execution ledger store
 * (WORKFLOW_AGENT_EXECUTION_V2; whole-authority successor of V1).
 *
 * Minimal append-only evidence + mutation machinery for NodeVisit → Attempt
 * → Run linkage. It records facts; it is NEVER an authority over workflow
 * business state (svc-workflow's state version / idempotency / transactions
 * stay the only business authority) and it is not a scheduler: no leases, no
 * retries, no heartbeat.
 *
 * Store shape (per production layout dir, mirrors the scheduler store
 * discipline — one mutation authority + append-only event log):
 *
 *   <dir>/attempts.jsonl   append-only events (append + fsync, never throws)
 *   <dir>/attempts.lock    OwnerLock artifact (SIGKILL-safe, reused from the
 *                          scheduler package — cross-process pollers serialize)
 *
 * The EVENT VOCABULARY and the replay projection live in ledger-events.js
 * (pure, unit-testable): attempt_planned, delivery_started (the V2 write-ahead
 * fence), resolution_blocked (the V2 recoverable-blocked live phase),
 * recovery_authorized / recovery_refused (the V2 controlled-recovery
 * lifecycle), run_delivered, delivery_failed (post-invocation classes stay
 * terminal; HISTORICAL resolve_failed:* reprojects bytes-unchanged to the
 * blocked phase per CTR-WAE-011), reconciled.
 *
 * All mutations go through mutate(): in-process FIFO chain → cross-process
 * OwnerLock → read-latest/replay → apply → append+fsync. Terminal attempts
 * reject further appends fail-loud: a late writer would mean someone is
 * trying to re-run a settled/reviewed NodeVisit — visible, never absorbed.
 */

import { createHash } from 'node:crypto'
import { mkdirSync, appendFileSync, existsSync, statSync, openSync, readSync, closeSync, fsyncSync, truncateSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { OwnerLock } from '../../scheduler/src/lock.js'

import { applyLedgerEvent, buildDeliveryStartedEvent, buildRecoveryAuthorizedEvent, buildRecoveryRefusedEvent, buildResolutionBlockedEvent, terminalRefusal } from './ledger-events.js'

export const LEDGER_EVENTS_FILE = 'attempts.jsonl'
export const LEDGER_LOCK_FILE = 'attempts.lock'

/** Ledger attempt states (the whole V1 state machine). */
export const ATTEMPT_STATES = Object.freeze(['ACTIVE', 'SETTLED', 'NEEDS_REVIEW'])

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * Deterministic attempt id for one NodeVisit: stable across pollers,
 * restarts and re-polls, so "already attempted" needs no clock and no
 * coordination beyond the ledger itself. V1 mints at most ONE attempt per
 * NodeVisit (no retries), so the hash alone identifies the attempt.
 */
export function attemptIdFor(nodeVisitId) {
  if (typeof nodeVisitId !== 'string' || !UUID_RE.test(nodeVisitId)) {
    throw new TypeError(`workflow-execution: attemptIdFor requires a UUID nodeVisitId (got ${JSON.stringify(nodeVisitId)})`)
  }
  return `wfeat-${createHash('sha256').update(nodeVisitId.toLowerCase()).digest('hex').slice(0, 24)}`
}

function validateIntentIds({ dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId }) {
  for (const [name, value] of Object.entries({ dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId })) {
    if (typeof value !== 'string' || !UUID_RE.test(value)) {
      throw new TypeError(`workflow-execution: ${name} must be a UUID string (got ${JSON.stringify(value)})`)
    }
  }
}

/**
 * The execution ledger. All mutations go through mutate() — in-process FIFO
 * chain, then the cross-process OwnerLock, then read-latest/replay, apply,
 * append+fsync — mirroring the scheduler JobStore discipline.
 */
export class ExecutionLedger {
  /**
   * @param {object} opts
   * @param {string} opts.dir - persistent directory (layout.workflowExecutionDir).
   * @param {Function} [opts.clock] - () => ms epoch (tests).
   * @param {object} [opts.log] - { log?, warn?, error? } (optional).
   * @param {object} [opts.io] - injectable durable-I/O seams (tests).
   */
  constructor({ dir, clock = () => Date.now(), log = {}, io = {} }) {
    if (typeof dir !== 'string' || dir === '') throw new TypeError('workflow-execution: ledger dir is required')
    if (io.appendFileSync !== undefined && typeof io.appendFileSync !== 'function') {
      throw new TypeError('workflow-execution: io.appendFileSync must be a function when provided')
    }
    if (io.syncDirectorySync !== undefined && typeof io.syncDirectorySync !== 'function') {
      throw new TypeError('workflow-execution: io.syncDirectorySync must be a function when provided')
    }
    this.dir = dir
    this.eventsFile = join(dir, LEDGER_EVENTS_FILE)
    this.clock = clock
    this.log = log
    this.appendFileSync = io.appendFileSync ?? appendFileSync
    this.syncDirectorySync = io.syncDirectorySync ?? ((path) => {
      const fd = openSync(path, 'r')
      try { fsyncSync(fd) } finally { closeSync(fd) }
    })
    this.lock = new OwnerLock(join(dir, LEDGER_LOCK_FILE), {
      onEvidence: (event) => { this.log.warn?.(`workflow-execution ledger lock: ${JSON.stringify(event)}`) },
    })
    this.attempts = new Map() // nodeVisitId -> attempt projection
    this.loaded = false
    this.eventFilePublicationPending = false
    this._queue = Promise.resolve()
    mkdirSync(dir, { recursive: true })
    // Re-confirm on every construction, not only on observed creation: after
    // a prior fsync failure the path may still be visible in page cache even
    // though its directory entry was never durably published.
    this.syncDirectorySync(dirname(dir))
    if (existsSync(this.eventsFile)) this.syncDirectorySync(this.dir)
  }

  /** One projection record derived from the event stream. */
  #attempt(nodeVisitId) {
    return this.attempts.get(nodeVisitId.toLowerCase())
  }

  #applyEvent(event) {
    applyLedgerEvent(this.attempts, event)
  }
  #terminalGuard(current, event) {
    terminalRefusal(current, event)
  }
  /** Replay the append-only event file. Read-only callers may ignore one torn
   * tail; the mutation path repairs it under OwnerLock before any append. */
  load({ repairTornTail = false } = {}) {
    this.attempts = new Map()
    if (!existsSync(this.eventsFile)) {
      this.loaded = true
      return
    }
    const raw = this.#readAllBytes()
    const endsWithNewline = raw.length === 0 || raw[raw.length - 1] === 0x0a
    const lines = raw.toString('utf8').split('\n')
    for (const [index, line] of lines.entries()) {
      if (line === '') continue
      let event
      try {
        event = JSON.parse(line)
      } catch (error) {
        const isTornTail = !endsWithNewline && index === lines.length - 1
        if (!isTornTail) {
          throw new Error(`workflow-execution: corrupt ledger record at line ${index + 1}`, { cause: error })
        }
        this.log.warn?.('workflow-execution: skipped torn tail line in attempts.jsonl')
        if (repairTornTail) this.#truncateTornTail(raw)
        continue
      }
      this.#applyEvent(event)
    }
    // A complete JSON object without its newline is still replayable, but a
    // later append would concatenate onto it. Seal that boundary under the
    // mutation lock before permitting another event.
    if (repairTornTail && !endsWithNewline && lines.at(-1) !== '') {
      let completeTail = false
      try {
        JSON.parse(lines.at(-1))
        completeTail = true
      } catch { /* a corrupt tail was already truncated above */ }
      // Keep durable-I/O failures outside the parse-only catch: if sealing
      // fails, the locked mutation must abort before it can concatenate a new
      // event onto the unterminated record.
      if (completeTail) this.#appendAndSync('\n')
    }
    this.loaded = true
  }

  #readAllBytes() {
    const size = statSync(this.eventsFile).size
    if (size === 0) return Buffer.alloc(0)
    const fd = openSync(this.eventsFile, 'r')
    try {
      const buffer = Buffer.alloc(size)
      let offset = 0
      while (offset < size) {
        const read = readSync(fd, buffer, offset, size - offset, offset)
        if (read <= 0) break
        offset += read
      }
      return buffer.subarray(0, offset)
    } finally {
      closeSync(fd)
    }
  }

  #truncateTornTail(raw) {
    const lastNewline = raw.lastIndexOf(0x0a)
    truncateSync(this.eventsFile, lastNewline < 0 ? 0 : lastNewline + 1)
    const fd = openSync(this.eventsFile, 'r+')
    try { fsyncSync(fd) } finally { closeSync(fd) }
    this.log.warn?.('workflow-execution: truncated torn ledger tail before append')
  }

  #appendAndSync(value) {
    const createsEventFile = !existsSync(this.eventsFile)
    this.appendFileSync(this.eventsFile, value)
    const fd = openSync(this.eventsFile, 'r+')
    try { fsyncSync(fd) } finally { closeSync(fd) }
    // File fsync does not durably publish a newly-created directory entry.
    // The first fence is committed only after its parent directory is synced.
    if (createsEventFile) {
      this.eventFilePublicationPending = true
      this.syncDirectorySync(this.dir)
      this.eventFilePublicationPending = false
    }
  }

  #appendEvent(event) {
    // The event is a durable fact only once its bytes hit the disk (same
    // append + fsync discipline as the scheduler history store's 'r+' sync).
    this.#appendAndSync(`${JSON.stringify(event)}\n`)
  }

  /**
   * THE single mutation authority: in-process FIFO -> cross-process lock ->
   * fresh replay -> apply -> append. Replaying under the lock means a second
   * process (or a second engine on a stale projection) converges before it
   * mutates.
   */
  async mutate(fn) {
    const run = this._queue.then(() => this.lock.runExclusive(() => {
      if (this.eventFilePublicationPending) {
        this.syncDirectorySync(this.dir)
        this.eventFilePublicationPending = false
      }
      this.load({ repairTornTail: true })
      return fn()
    }))
    // Keep the chain alive on unexpected failures: the failing caller gets the
    // error, later mutations still run against a fresh replay.
    this._queue = run.then(() => {}, () => {})
    return run
  }

  /**
   * The atomic one-attempt-per-NodeVisit fence. Creates the attempt (and
   * appends attempt_planned) only when the NodeVisit has NO attempt yet —
   * any existing attempt (ACTIVE, SETTLED or NEEDS_REVIEW) blocks a second
   * one. This is what makes duplicate pollers / re-polls / HR + scheduler
   * double triggers safe on the DSH side.
   *
   * When `complete` is supplied, retain the same cross-process OwnerLock
   * through resolve/delivery and append exactly one completion event before
   * releasing it. Omitting `complete` preserves the ledger-only primitive
   * used by focused lifecycle tests and recovery tooling.
   *
   * @returns {Promise<{created:true, attempt:object, completion?:object}
   *   | {created:false, attempt:object, cause:'already_attempted'}>}
   */
  async beginAttemptIfAbsent({ dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId }, complete) {
    validateIntentIds({ dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId })
    if (complete !== undefined && typeof complete !== 'function') {
      throw new TypeError('workflow-execution: admission completion callback must be a function when provided')
    }
    return this.mutate(async () => {
      const existing = this.#attempt(nodeVisitId)
      if (existing !== undefined) {
        return { created: false, attempt: { ...existing }, cause: 'already_attempted' }
      }
      const event = {
        kind: 'attempt_planned',
        attemptId: attemptIdFor(nodeVisitId),
        nodeVisitId: nodeVisitId.toLowerCase(),
        dispatchIntentId: dispatchIntentId.toLowerCase(),
        workflowInstanceId: workflowInstanceId.toLowerCase(),
        ownerPrincipalId: ownerPrincipalId.toLowerCase(),
        atMs: this.clock(),
      }
      this.#appendEvent(event)
      this.#applyEvent(event)
      if (complete === undefined) return { created: true, attempt: { ...this.#attempt(nodeVisitId) } }
      // V2 CTR-WAE-013: the completion callback gets a write-ahead seam so it
      // can durably append delivery_started BEFORE invoking router.deliver,
      // inside this same locked mutation. There is no invocation-to-record
      // crash window: any delivery attempt must first leave this trace.
      const completion = await complete({ ...this.#attempt(nodeVisitId) }, {
        recordDeliveryStarted: () => { this.#recordDeliveryStarted(nodeVisitId) },
      })
      if (completion?.kind === 'run_delivered') {
        this.#recordRunDelivered(nodeVisitId, completion)
      } else if (completion?.kind === 'delivery_failed') {
        this.#recordDeliveryFailed(nodeVisitId, completion.reason)
      } else if (completion?.kind === 'resolution_blocked') {
        this.#recordResolutionBlocked(nodeVisitId, completion.code)
      } else {
        throw new TypeError('workflow-execution: admission callback must return run_delivered, delivery_failed or resolution_blocked')
      }
      return { created: true, attempt: { ...this.#attempt(nodeVisitId) }, completion }
    })
  }

  /** Record a successful Run admission (NodeVisit → Attempt → Run linkage). */
  async recordRunDelivered({ nodeVisitId, agentId, requestId, sessionId, reconciliationHandle, messageId }) {
    return this.mutate(() => this.#recordRunDelivered(nodeVisitId, { agentId, requestId, sessionId, reconciliationHandle, messageId }))
  }

  /** Record a failed (or never-verifiably-started) delivery: NEEDS_REVIEW.
   *  V2: NEW-path resolution failures must use recordResolutionBlocked — a
   *  fresh `resolve_failed:` reason here would silently re-create the V1
   *  conflation this successor removed, so it fails loud. */
  async recordDeliveryFailed({ nodeVisitId, reason }) {
    if (typeof reason === 'string' && reason.startsWith('resolve_failed:')) {
      throw new TypeError('workflow-execution: delivery_failed cannot carry a resolve_failed: reason (V2) — use recordResolutionBlocked')
    }
    return this.mutate(() => this.#recordDeliveryFailed(nodeVisitId, reason))
  }

  /** V2 CTR-WAE-012: durable WRITE-AHEAD INTENT before any router.deliver
   *  invocation. Allowed from the pre-delivery phases only; at-most-one is
   *  enforced by the projection (second = corrupt fail-loud). */
  async recordDeliveryStarted({ nodeVisitId }) {
    return this.mutate(() => this.#recordDeliveryStarted(nodeVisitId))
  }

  /** V2 CTR-WAE-011: the recoverable-blocked live phase for a resolution-
   *  phase failure (zero delivery side effect by construction). */
  async recordResolutionBlocked({ nodeVisitId, code }) {
    return this.mutate(() => this.#recordResolutionBlocked(nodeVisitId, code))
  }

  /** V2 CTR-WAE-013: record the governance authorization for ONE controlled
   *  recovery (only writer: the recovery operation, after its preconditions). */
  async recordRecoveryAuthorized({ nodeVisitId, authorityRef }) {
    if (typeof authorityRef !== 'string' || authorityRef === '') {
      throw new TypeError('workflow-execution: authorityRef is required')
    }
    return this.mutate(() => this.#recordRecoveryAuthorized(nodeVisitId, authorityRef))
  }

  /** V2 CTR-WAE-013 E5: world drift discovered on an eligible-shaped attempt
   *  — refusal is terminal NEEDS_REVIEW (the human path), zero admission. */
  async recordRecoveryRefused({ nodeVisitId, authorityRef, refused }) {
    if (typeof authorityRef !== 'string' || authorityRef === '') {
      throw new TypeError('workflow-execution: authorityRef is required')
    }
    if (typeof refused !== 'string' || refused === '') {
      throw new TypeError('workflow-execution: refused is required')
    }
    return this.mutate(() => this.#recordRecoveryRefused(nodeVisitId, authorityRef, refused))
  }

  /** Record the terminal reconcile verdict for an ACTIVE attempt. */
  async recordReconciled({ nodeVisitId, expectedPhase, verdict, judgment, reason }) {
    if (verdict !== 'SETTLED' && verdict !== 'NEEDS_REVIEW') {
      throw new TypeError(`workflow-execution: reconciled verdict must be SETTLED | NEEDS_REVIEW (got ${JSON.stringify(verdict)})`)
    }
    if (typeof expectedPhase !== 'string' || expectedPhase === '') throw new TypeError('workflow-execution: reconciled expectedPhase is required')
    if (typeof judgment !== 'string' || judgment === '') throw new TypeError('workflow-execution: reconciled judgment is required')
    if (typeof reason !== 'string' || reason === '') throw new TypeError('workflow-execution: reconciled reason is required')
    return this.mutate(() => {
      const current = this.#attempt(nodeVisitId)
      if (current === undefined) {
        throw new Error(`workflow-execution: no attempt exists for nodeVisit ${nodeVisitId.toLowerCase()} — beginAttemptIfAbsent first`)
      }
      if (current.state !== 'ACTIVE') this.#terminalGuard(current, { kind: 'reconciled', nodeVisitId })
      if (current.phase !== expectedPhase) {
        return { committed: false, attempt: { ...current }, cause: 'attempt_changed' }
      }
      const record = this.#recordForActive(nodeVisitId, (event) => {
        event.kind = 'reconciled'
        event.verdict = verdict
        event.judgment = judgment
        event.reason = reason
        return event
      })
      return { committed: true, ...record }
    })
  }

  #recordRunDelivered(nodeVisitId, { agentId, requestId, sessionId, reconciliationHandle, messageId }) {
    return this.#recordForActive(nodeVisitId, (event) => {
      event.kind = 'run_delivered'
      event.agentId = agentId
      event.requestId = requestId
      event.sessionId = sessionId
      if (reconciliationHandle !== undefined) event.reconciliationHandle = reconciliationHandle
      if (messageId !== undefined) event.messageId = messageId
      return event
    })
  }

  #recordDeliveryFailed(nodeVisitId, reason) {
    if (typeof reason !== 'string' || reason === '') throw new TypeError('workflow-execution: delivery_failed reason is required')
    if (reason.startsWith('resolve_failed:')) {
      throw new TypeError('workflow-execution: delivery_failed cannot carry a resolve_failed: reason (V2) — use recordResolutionBlocked')
    }
    return this.#recordForActive(nodeVisitId, (event) => {
      event.kind = 'delivery_failed'
      event.reason = reason
      return event
    })
  }

  // V2: recovery-lifecycle records PRE-CHECK the projection BEFORE the
  // durable append (the builders carry the guards). Pre-check + append +
  // apply run inside ONE locked mutation, so the check is atomic with the
  // write; checking only post-append (replay) would let an interleaved
  // caller corrupt the file.
  #precheckActive(nodeVisitId, kind) {
    const current = this.#attempt(nodeVisitId)
    if (current === undefined) {
      throw new Error(`workflow-execution: no attempt exists for nodeVisit ${String(nodeVisitId).toLowerCase()} — beginAttemptIfAbsent first`)
    }
    if (current.state !== 'ACTIVE') this.#terminalGuard(current, { kind, nodeVisitId })
    return current
  }

  #recordDeliveryStarted(nodeVisitId) {
    const patch = buildDeliveryStartedEvent(this.#precheckActive(nodeVisitId, 'delivery_started'), nodeVisitId)
    return this.#recordForActive(nodeVisitId, (event) => Object.assign(event, patch))
  }

  #recordResolutionBlocked(nodeVisitId, code) {
    const patch = buildResolutionBlockedEvent(this.#precheckActive(nodeVisitId, 'resolution_blocked'), nodeVisitId, code)
    return this.#recordForActive(nodeVisitId, (event) => Object.assign(event, patch))
  }

  #recordRecoveryAuthorized(nodeVisitId, authorityRef) {
    const patch = buildRecoveryAuthorizedEvent(this.#precheckActive(nodeVisitId, 'recovery_authorized'), nodeVisitId, authorityRef)
    return this.#recordForActive(nodeVisitId, (event) => Object.assign(event, patch))
  }

  #recordRecoveryRefused(nodeVisitId, authorityRef, refused) {
    const patch = buildRecoveryRefusedEvent(this.#precheckActive(nodeVisitId, 'recovery_refused'), nodeVisitId, authorityRef, refused)
    return this.#recordForActive(nodeVisitId, (event) => Object.assign(event, patch))
  }

  #recordForActive(nodeVisitId, build) {
    if (typeof nodeVisitId !== 'string' || !UUID_RE.test(nodeVisitId)) {
      throw new TypeError(`workflow-execution: nodeVisitId must be a UUID string (got ${JSON.stringify(nodeVisitId)})`)
    }
    const current = this.#attempt(nodeVisitId)
    if (current === undefined) {
      throw new Error(`workflow-execution: no attempt exists for nodeVisit ${nodeVisitId.toLowerCase()} — beginAttemptIfAbsent first`)
    }
    if (current.state !== 'ACTIVE') this.#terminalGuard(current, { kind: 'record', nodeVisitId })
    const event = build({ nodeVisitId: nodeVisitId.toLowerCase(), atMs: this.clock() })
    this.#appendEvent(event)
    this.#applyEvent(event)
    return { attempt: { ...this.#attempt(nodeVisitId) } }
  }

  /** Non-mutating reads (projection only; load() lazily when untouched). */
  get(nodeVisitId) {
    if (!this.loaded) this.load()
    const attempt = this.#attempt(nodeVisitId)
    return attempt === undefined ? undefined : { ...attempt }
  }

  listActive() {
    if (!this.loaded) this.load()
    return [...this.attempts.values()].filter((a) => a.state === 'ACTIVE').map((a) => ({ ...a }))
  }

  /** V2 CTR-WAE-013: run ONE controlled-recovery dispatch ATOMICALLY — fresh
   *  replay under the lock, held across the whole entry-state dispatch (the
   *  same discipline as the admission completion callback). `record` exposes
   *  the locked-mutation appenders (pre-checked private paths — NO nested
   *  mutate, which would deadlock the FIFO chain), and `getAttempt` reads the
   *  live projection, so an interleaved caller can never split an E-check
   *  from its append: the whole dispatch is single-flight. */
  async mutateWithRecord(nodeVisitId, fn) {
    return this.mutate(async () => {
      const record = {
        recoveryAuthorized: (authorityRef) => this.#recordRecoveryAuthorized(nodeVisitId, authorityRef),
        resolutionBlocked: (code) => this.#recordResolutionBlocked(nodeVisitId, code),
        deliveryStarted: () => this.#recordDeliveryStarted(nodeVisitId),
        recoveryRefused: (authorityRef, refused) => this.#recordRecoveryRefused(nodeVisitId, authorityRef, refused),
        runDelivered: (fields) => this.#recordRunDelivered(nodeVisitId, fields),
        deliveryFailed: (reason) => this.#recordDeliveryFailed(nodeVisitId, reason),
      }
      return fn(record, () => this.#attempt(nodeVisitId))
    })
  }

  /** Cross-process-fresh ACTIVE snapshot for one reconciliation pass. */
  async listActiveFresh() {
    return this.mutate(() => [...this.attempts.values()]
      .filter((attempt) => attempt.state === 'ACTIVE')
      .map((attempt) => ({ ...attempt })))
  }

  snapshot() {
    if (!this.loaded) this.load()
    return [...this.attempts.values()].map((a) => ({ ...a }))
  }
}
