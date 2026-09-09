/**
 * @agent-core/workflow-execution/src/ledger.js — the execution ledger
 * (WORKFLOW_AGENT_EXECUTION_V1).
 *
 * Minimal append-only evidence + projection for NodeVisit → Attempt → Run
 * linkage. It records facts; it is NEVER an authority over workflow business
 * state (svc-workflow's state version / idempotency / transactions stay the
 * only business authority) and it is not a scheduler: there are no leases,
 * no retries and no heartbeat here.
 *
 * Store shape (per production layout dir, mirrors the scheduler store
 * discipline — one mutation authority + append-only event log):
 *
 *   <dir>/attempts.jsonl   append-only events (append + fsync, never throws)
 *   <dir>/attempts.lock    OwnerLock artifact (SIGKILL-safe, reused from the
 *                          scheduler package — cross-process pollers serialize)
 *
 * Event kinds and the projection they build:
 *
 *   attempt_planned    { attemptId, nodeVisitId, dispatchIntentId,
 *                        workflowInstanceId, ownerPrincipalId }
 *                      -> state ACTIVE phase planned. This append IS the
 *                      atomic one-attempt-per-NodeVisit fence: the id is
 *                      deterministic from nodeVisitId, and beginAttemptIfAbsent
 *                      is the only way to mint one.
 *   run_delivered      { attemptId, agentId, requestId, sessionId,
 *                        reconciliationHandle?, messageId? }
 *                      -> state ACTIVE phase run_delivered (the Run linkage).
 *   delivery_failed    { attemptId, reason }
 *                      -> terminal NEEDS_REVIEW (delivery never succeeded;
 *                      no automatic retry, no agent reassignment in V1).
 *   reconciled         { attemptId, verdict: SETTLED|NEEDS_REVIEW, judgment,
 *                        reason }
 *                      -> terminal (settled business fact or run-ended-without-
 *                      submission). ACTIVE attempts never append this.
 *
 * Terminal attempts reject further appends fail-loud: V1 has no automatic
 * second execution, so a late writer would mean a caller is trying to re-run
 * a settled/reviewed NodeVisit — that must be visible, never absorbed.
 */

import { createHash } from 'node:crypto'
import { mkdirSync, appendFileSync, existsSync, statSync, openSync, readSync, closeSync, fsyncSync, truncateSync } from 'node:fs'
import { join } from 'node:path'

import { OwnerLock } from '../../scheduler/src/lock.js'

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
    this.dir = dir
    this.eventsFile = join(dir, LEDGER_EVENTS_FILE)
    this.clock = clock
    this.log = log
    this.appendFileSync = io.appendFileSync ?? appendFileSync
    this.lock = new OwnerLock(join(dir, LEDGER_LOCK_FILE), {
      onEvidence: (event) => { this.log.warn?.(`workflow-execution ledger lock: ${JSON.stringify(event)}`) },
    })
    this.attempts = new Map() // nodeVisitId -> attempt projection
    this.loaded = false
    this._queue = Promise.resolve()
    mkdirSync(dir, { recursive: true })
  }

  /** One projection record derived from the event stream. */
  #attempt(nodeVisitId) {
    return this.attempts.get(nodeVisitId.toLowerCase())
  }

  #applyEvent(event) {
    const nodeVisitId = event.nodeVisitId.toLowerCase()
    const current = this.attempts.get(nodeVisitId)
    switch (event.kind) {
      case 'attempt_planned':
        if (current !== undefined) {
          // beginAttemptIfAbsent guards this; a replayed file can only hit it
          // if the same nodeVisitId was planned twice — impossible by
          // construction (deterministic id + existence check under lock).
          throw new Error(`workflow-execution: corrupt ledger — attempt_planned twice for nodeVisit ${nodeVisitId}`)
        }
        this.attempts.set(nodeVisitId, {
          attemptId: event.attemptId,
          nodeVisitId,
          dispatchIntentId: event.dispatchIntentId.toLowerCase(),
          workflowInstanceId: event.workflowInstanceId.toLowerCase(),
          ownerPrincipalId: event.ownerPrincipalId.toLowerCase(),
          state: 'ACTIVE',
          phase: 'planned',
          reason: undefined,
          createdAtMs: event.atMs,
          delivered: undefined,
        })
        return
      case 'run_delivered':
        if (current?.state !== 'ACTIVE') this.#terminalGuard(current, event)
        current.state = 'ACTIVE'
        current.phase = 'run_delivered'
        current.delivered = {
          agentId: event.agentId,
          requestId: event.requestId,
          sessionId: event.sessionId,
          reconciliationHandle: event.reconciliationHandle,
          messageId: event.messageId,
          atMs: event.atMs,
        }
        return
      case 'delivery_failed':
        if (current?.state !== 'ACTIVE') this.#terminalGuard(current, event)
        current.state = 'NEEDS_REVIEW'
        current.phase = 'delivery_failed'
        current.reason = event.reason
        return
      case 'reconciled':
        if (current?.state !== 'ACTIVE') this.#terminalGuard(current, event)
        if (event.verdict === 'ACTIVE') {
          throw new Error('workflow-execution: reconciled events must be terminal (SETTLED | NEEDS_REVIEW)')
        }
        current.state = event.verdict
        current.phase = 'reconciled'
        current.judgment = event.judgment
        current.reason = event.reason
        return
      default:
        throw new Error(`workflow-execution: unknown ledger event kind ${JSON.stringify(event?.kind)}`)
    }
  }

  #terminalGuard(current, event) {
    throw new Error(
      `workflow-execution: refusing ${event.kind} for nodeVisit ${event.nodeVisitId} — attempt is terminal `
      + `(state=${current?.state}, phase=${current?.phase}); V1 never re-runs a settled/reviewed NodeVisit`,
    )
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
    this.appendFileSync(this.eventsFile, value)
    const fd = openSync(this.eventsFile, 'r+')
    try { fsyncSync(fd) } finally { closeSync(fd) }
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
   * @returns {Promise<{created:true, attempt:object}
   *   | {created:false, attempt:object, cause:'already_attempted'}>}
   */
  async beginAttemptIfAbsent({ dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId }) {
    validateIntentIds({ dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId })
    return this.mutate(() => {
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
      return { created: true, attempt: { ...this.#attempt(nodeVisitId) } }
    })
  }

  /** Record a successful Run admission (NodeVisit → Attempt → Run linkage). */
  async recordRunDelivered({ nodeVisitId, agentId, requestId, sessionId, reconciliationHandle, messageId }) {
    return this.mutate(() => this.#recordForActive(nodeVisitId, (event) => {
      event.kind = 'run_delivered'
      event.agentId = agentId
      event.requestId = requestId
      event.sessionId = sessionId
      if (reconciliationHandle !== undefined) event.reconciliationHandle = reconciliationHandle
      if (messageId !== undefined) event.messageId = messageId
      return event
    }))
  }

  /** Record a failed (or never-verifiably-started) delivery: NEEDS_REVIEW. */
  async recordDeliveryFailed({ nodeVisitId, reason }) {
    if (typeof reason !== 'string' || reason === '') throw new TypeError('workflow-execution: delivery_failed reason is required')
    return this.mutate(() => this.#recordForActive(nodeVisitId, (event) => {
      event.kind = 'delivery_failed'
      event.reason = reason
      return event
    }))
  }

  /** Record the terminal reconcile verdict for an ACTIVE attempt. */
  async recordReconciled({ nodeVisitId, verdict, judgment, reason }) {
    if (verdict !== 'SETTLED' && verdict !== 'NEEDS_REVIEW') {
      throw new TypeError(`workflow-execution: reconciled verdict must be SETTLED | NEEDS_REVIEW (got ${JSON.stringify(verdict)})`)
    }
    if (typeof judgment !== 'string' || judgment === '') throw new TypeError('workflow-execution: reconciled judgment is required')
    if (typeof reason !== 'string' || reason === '') throw new TypeError('workflow-execution: reconciled reason is required')
    return this.mutate(() => this.#recordForActive(nodeVisitId, (event) => {
      event.kind = 'reconciled'
      event.verdict = verdict
      event.judgment = judgment
      event.reason = reason
      return event
    }))
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

  snapshot() {
    if (!this.loaded) this.load()
    return [...this.attempts.values()].map((a) => ({ ...a }))
  }
}
