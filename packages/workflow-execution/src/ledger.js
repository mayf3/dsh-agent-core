/**
 * @agent-core/workflow-execution/src/ledger.js — the execution ledger store
 * (WORKFLOW_AGENT_EXECUTION_V2; whole-authority successor of V1).
 *
 * Minimal append-only evidence + mutation machinery for NodeVisit → Attempt
 * → Run linkage. It records facts; it is NEVER an authority over workflow
 * business state (svc-workflow's state version / idempotency / transactions
 * stay the only business authority) and it is not a scheduler: no leases, no
 * heartbeat, no renewal. WORKFLOW_STALE_REENTRY_V1 adds the ONE evidence-
 * gated re-entry path (generation + stale_superseded): redispatch is bounded
 * by the threshold window, never by a lease, and only on positive business
 * evidence — never on a timeout alone.
 *
 * Store shape (per production layout dir, mirrors the scheduler store
 * discipline — one mutation authority + append-only event log):
 *
 *   <dir>/attempts.jsonl   append-only events (append + fsync, never throws)
 *   <dir>/attempts.lock    OwnerLock artifact (SIGKILL-safe; cross-process)
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

import { applyLedgerEvent, buildDeliveryStartedEvent, buildRecoveryAuthorizedEvent, buildRecoveryRefusedEvent, buildResolutionBlockedEvent, buildStaleSupersededEvent, terminalRefusal } from './ledger-events.js'

export const LEDGER_EVENTS_FILE = 'attempts.jsonl'
export const LEDGER_LOCK_FILE = 'attempts.lock'

/** Ledger attempt states (the whole V1 state machine). */
export const ATTEMPT_STATES = Object.freeze(['ACTIVE', 'SETTLED', 'NEEDS_REVIEW'])

/** The ONE re-entry judgment (WORKFLOW_STALE_REENTRY_V1 CTR-SRE-002). */
export const STALE_NO_PROGRESS_JUDGMENT = 'stale_no_progress'

/**
 * WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-004: the per-visit attempt limit.
 * Admission-time policy only (never a file-format invariant): the fence
 * refuses to MINT a generation above the limit; already-written files replay
 * unchanged. Default 3, configurable via maxAttemptsPerVisit (wiring: env
 * DSH_WORKFLOW_MAX_ATTEMPTS_PER_VISIT).
 */
export const DEFAULT_MAX_ATTEMPTS_PER_VISIT = 3

/** The ONE escalation fact (CTR-WEC1-005): recorded at most once per visit. */
export const ESCALATION_REQUESTED_KIND = 'escalation_requested'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * Deterministic attempt id for one NodeVisit generation: stable across
 * pollers, restarts and re-polls, so "already attempted" needs no clock and
 * no coordination beyond the ledger itself. Generation 1 keeps the V2
 * formula byte-identically (existing files replay unchanged); generation
 * N > 1 exists only via the CTR-SRE-003 stale re-entry path.
 */
export function attemptIdFor(nodeVisitId, generation = 1) {
  if (typeof nodeVisitId !== 'string' || !UUID_RE.test(nodeVisitId)) {
    throw new TypeError(`workflow-execution: attemptIdFor requires a UUID nodeVisitId (got ${JSON.stringify(nodeVisitId)})`)
  }
  if (!Number.isInteger(generation) || generation < 1) {
    throw new TypeError(`workflow-execution: attemptIdFor requires a positive integer generation (got ${JSON.stringify(generation)})`)
  }
  const base = nodeVisitId.toLowerCase()
  const material = generation === 1 ? base : `${base}#gen${generation}`
  return `wfeat-${createHash('sha256').update(material).digest('hex').slice(0, 24)}`
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
   * @param {number} [opts.maxAttemptsPerVisit] - WORKFLOW_EXECUTION_CONTROL_V1
   *   CTR-WEC1-004 admission policy: the fence refuses generation N+1 when
   *   N >= maxAttemptsPerVisit (default 3, min 1).
   */
  constructor({ dir, clock = () => Date.now(), log = {}, io = {}, maxAttemptsPerVisit = DEFAULT_MAX_ATTEMPTS_PER_VISIT }) {
    if (typeof dir !== 'string' || dir === '') throw new TypeError('workflow-execution: ledger dir is required')
    if (!Number.isInteger(maxAttemptsPerVisit) || maxAttemptsPerVisit < 1) {
      throw new TypeError(`workflow-execution: ledger maxAttemptsPerVisit must be a positive integer (got ${JSON.stringify(maxAttemptsPerVisit)})`)
    }
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
    this.maxAttemptsPerVisit = maxAttemptsPerVisit
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
    // WORKFLOW_EXECUTION_CONTROL_V1: every durable line carries its
    // workflowInstanceId when the attempt context knows it — outbound
    // projections (forum thread resolution, traces) key on the line alone
    // and must not depend on which event kind happens to carry identity.
    // Additive stamping: identity-bearing events keep their own value.
    const attempt = this.attempts.get(String(event.nodeVisitId ?? '').toLowerCase())
    if (event.workflowInstanceId === undefined && attempt?.workflowInstanceId !== undefined) {
      event.workflowInstanceId = attempt.workflowInstanceId
    }
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
   * one, with the single WORKFLOW_STALE_REENTRY_V1 exception: a terminal
   * attempt with judgment 'stale_no_progress' is superseded by generation
   * N+1 (CTR-SRE-003). This is what makes duplicate pollers / re-polls /
   * HR + scheduler double triggers safe on the DSH side.
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
        if (!(existing.state !== 'ACTIVE' && existing.judgment === STALE_NO_PROGRESS_JUDGMENT)) {
          return { created: false, attempt: { ...existing }, cause: 'already_attempted' }
        }
        // CTR-SRE-003 identity pre-check BEFORE the durable append: the
        // projection guard would refuse a mismatched replan on replay, and
        // an append-then-refuse would mean a corrupt file. The activation is
        // unique per visit server-side, so a mismatch means the feed itself
        // contradicts the ledger — fail loud, never absorb.
        const sameIdentity = existing.dispatchIntentId === dispatchIntentId.toLowerCase()
          && existing.workflowInstanceId === workflowInstanceId.toLowerCase()
          && existing.ownerPrincipalId === ownerPrincipalId.toLowerCase()
        if (!sameIdentity) {
          throw new Error(`workflow-execution: refusing generation ${(existing.generation ?? 1) + 1} attempt_planned for nodeVisit ${nodeVisitId.toLowerCase()} — identity triple differs from the stale-superseded attempt (corrupt feed or ledger)`)
        }
        // WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-004: the policy limit is
        // enforced INSIDE the fence, so no poller, race or double trigger can
        // mint past it. Refusal is a clean non-created outcome — the engine
        // turns it into the one-time escalation (CTR-WEC1-005).
        const nextGeneration = (existing.generation ?? 1) + 1
        if (nextGeneration > this.maxAttemptsPerVisit) {
          return { created: false, attempt: { ...existing }, cause: 'attempt_limit_reached' }
        }
      }
      // WORKFLOW_STALE_REENTRY_V1 CTR-SRE-003: a terminal attempt with
      // judgment 'stale_no_progress' is superseded by generation N+1 (the
      // projection guard in ledger-events re-validates identity + generation
      // on both live append and replay). Every other existing attempt keeps
      // the V2 fence semantics byte-for-byte.
      const generation = existing === undefined ? 1 : (existing.generation ?? 1) + 1
      const event = {
        kind: 'attempt_planned',
        attemptId: attemptIdFor(nodeVisitId, generation),
        nodeVisitId: nodeVisitId.toLowerCase(),
        dispatchIntentId: dispatchIntentId.toLowerCase(),
        workflowInstanceId: workflowInstanceId.toLowerCase(),
        ownerPrincipalId: ownerPrincipalId.toLowerCase(),
        atMs: this.clock(),
        ...(generation === 1 ? {} : { generation }),
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
  async recordRunDelivered({ nodeVisitId, agentId, requestId, sessionId, reconciliationHandle, messageId, workflowStateVersionAtDispatch }) {
    return this.mutate(() => this.#recordRunDelivered(nodeVisitId, { agentId, requestId, sessionId, reconciliationHandle, messageId, workflowStateVersionAtDispatch }))
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

  /**
   * WORKFLOW_STALE_REENTRY_V1 CTR-SRE-002: settle ONE stale attempt as the
   * re-entry marker (terminal SETTLED / judgment 'stale_no_progress'). The
   * `expected` snapshot (state + phase + delivered.atMs) is the CAS guard:
   * two pollers may both probe stale, only the one whose snapshot still
   * matches the fresh replay wins; the loser gets { committed: false } —
   * never a double settlement, never a corrupt append.
   */
  async recordStaleSuperseded({ nodeVisitId, expected, observedWorkflowStateVersion }) {
    if (expected === null || typeof expected !== 'object') throw new TypeError('workflow-execution: stale supersession expected snapshot is required')
    if (typeof expected.state !== 'string' || typeof expected.phase !== 'string') throw new TypeError('workflow-execution: stale supersession expected.state/phase are required')
    if (!Number.isInteger(expected.deliveredAtMs)) throw new TypeError('workflow-execution: stale supersession expected.deliveredAtMs must be an integer')
    return this.mutate(() => {
      const current = this.#attempt(nodeVisitId)
      if (current === undefined) {
        throw new Error(`workflow-execution: no attempt exists for nodeVisit ${nodeVisitId.toLowerCase()} — beginAttemptIfAbsent first`)
      }
      const matches = current.state === expected.state
        && current.phase === expected.phase
        && current.delivered !== undefined
        && current.delivered.atMs === expected.deliveredAtMs
      if (!matches) {
        return { committed: false, attempt: { ...current }, cause: 'attempt_changed' }
      }
      const patch = buildStaleSupersededEvent(current, nodeVisitId, observedWorkflowStateVersion)
      const event = { nodeVisitId: nodeVisitId.toLowerCase(), atMs: this.clock(), ...patch }
      this.#appendEvent(event)
      this.#applyEvent(event)
      return { committed: true, attempt: { ...this.#attempt(nodeVisitId) } }
    })
  }

  #recordRunDelivered(nodeVisitId, { agentId, requestId, sessionId, reconciliationHandle, messageId, workflowStateVersionAtDispatch }) {
    return this.#recordForActive(nodeVisitId, (event) => {
      event.kind = 'run_delivered'
      event.agentId = agentId
      event.requestId = requestId
      event.sessionId = sessionId
      if (reconciliationHandle !== undefined) event.reconciliationHandle = reconciliationHandle
      if (messageId !== undefined) event.messageId = messageId
      if (workflowStateVersionAtDispatch !== undefined) event.workflowStateVersionAtDispatch = workflowStateVersionAtDispatch
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
      // The record seam is SCOPE-BOUND: the appenders die with the locked
      // callback (revoked in `finally`), so a captured closure can never
      // append after the OwnerLock/FIFO boundary — every post-callback call
      // fails loud instead of bypassing the serialization.
      let closed = false
      const guard = (call) => (...args) => {
        if (closed) throw new Error('workflow-execution: recovery mutation seam is closed (lock released)')
        return call(...args)
      }
      const record = {
        recoveryAuthorized: guard((authorityRef) => this.#recordRecoveryAuthorized(nodeVisitId, authorityRef)),
        resolutionBlocked: guard((code) => this.#recordResolutionBlocked(nodeVisitId, code)),
        deliveryStarted: guard(() => this.#recordDeliveryStarted(nodeVisitId)),
        recoveryRefused: guard((authorityRef, refused) => this.#recordRecoveryRefused(nodeVisitId, authorityRef, refused)),
        runDelivered: guard((fields) => this.#recordRunDelivered(nodeVisitId, fields)),
        deliveryFailed: guard((reason) => this.#recordDeliveryFailed(nodeVisitId, reason)),
      }
      try {
        return await fn(record, () => this.#attempt(nodeVisitId))
      } finally {
        closed = true
      }
    })
  }

  /** Cross-process-fresh ACTIVE snapshot for one reconciliation pass. */
  async listActiveFresh() {
    return this.mutate(() => [...this.attempts.values()]
      .filter((attempt) => attempt.state === 'ACTIVE')
      .map((attempt) => ({ ...attempt })))
  }

  /**
   * WORKFLOW_STALE_REENTRY_V1: cross-process-fresh enumeration of delivered
   * attempts whose dispatch clock has exceeded the stale threshold — the
   * ACTIVE/run_delivered candidates (evaluated inside the reconcile loop)
   * plus the terminal NEEDS_REVIEW candidates (the run-ended-without-
   * submission class). Fresh replay under the lock, same discipline as
   * listActiveFresh.
   */
  async listStaleCandidatesFresh(thresholdMs, nowMs = this.clock()) {
    if (!Number.isInteger(thresholdMs) || thresholdMs < 1) {
      throw new TypeError('workflow-execution: listStaleCandidatesFresh requires a positive integer thresholdMs')
    }
    return this.mutate(() => [...this.attempts.values()]
      .filter((attempt) => attempt.delivered !== undefined
        && nowMs - attempt.delivered.atMs >= thresholdMs
        && ((attempt.state === 'ACTIVE' && attempt.phase === 'run_delivered') || attempt.state === 'NEEDS_REVIEW'))
      .map((attempt) => ({ ...attempt })))
  }

  /**
   * WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-005: record the ONE escalation
   * fact per visit (append-only `escalation_requested` event). Idempotent:
   * an already-escalated visit yields { committed: false } WITHOUT appending
   * anything. Requires an existing terminal attempt — escalation rides the
   * attempt's own terminal evidence, never an ACTIVE attempt.
   */
  async recordEscalationRequested({ nodeVisitId, reason, attemptCount, lastAttemptId, dispatchIntentId }) {
    if (typeof reason !== 'string' || reason === '') throw new TypeError('workflow-execution: escalation reason is required')
    return this.mutate(() => {
      const current = this.#attempt(nodeVisitId)
      if (current === undefined) {
        throw new Error(`workflow-execution: no attempt exists for nodeVisit ${nodeVisitId.toLowerCase()} — escalation rides an existing attempt`)
      }
      if (current.state === 'ACTIVE') {
        throw new Error(`workflow-execution: refusing escalation_requested for nodeVisit ${nodeVisitId.toLowerCase()} — attempt is ACTIVE`)
      }
      if (current.escalation !== undefined) {
        return { committed: false, attempt: { ...current }, cause: 'already_escalated' }
      }
      const event = {
        kind: ESCALATION_REQUESTED_KIND,
        nodeVisitId: nodeVisitId.toLowerCase(),
        // The workflowInstanceId rides the event line (not the projection):
        // outbound projections (forum) key their thread resolution on it.
        workflowInstanceId: current.workflowInstanceId,
        atMs: this.clock(),
        reason,
        ...(Number.isInteger(attemptCount) ? { attemptCount } : {}),
        ...(typeof lastAttemptId === 'string' ? { lastAttemptId } : {}),
        ...(typeof dispatchIntentId === 'string' ? { dispatchIntentId } : {}),
      }
      this.#appendEvent(event)
      this.#applyEvent(event)
      return { committed: true, attempt: { ...this.#attempt(nodeVisitId) } }
    })
  }

  /**
   * WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-004: cross-process-fresh
   * enumeration of terminal NEEDS_REVIEW run_ended_no_submission attempts
   * whose reconcile verdict is at least retryDelayMs old — the policy-driven
   * continuation class (fast re-entry path, shorter than the stale clock;
   * outcome_unknown NEVER appears here).
   */
  async listRunEndedCandidatesFresh(retryDelayMs, nowMs = this.clock()) {
    if (!Number.isInteger(retryDelayMs) || retryDelayMs < 1) {
      throw new TypeError('workflow-execution: listRunEndedCandidatesFresh requires a positive integer retryDelayMs')
    }
    return this.mutate(() => [...this.attempts.values()]
      .filter((attempt) => attempt.state === 'NEEDS_REVIEW'
        && attempt.judgment === 'run_ended_no_submission'
        && Number.isInteger(attempt.reconciledAtMs)
        && nowMs - attempt.reconciledAtMs >= retryDelayMs)
      .map((attempt) => ({ ...attempt })))
  }

  snapshot() {
    if (!this.loaded) this.load()
    return [...this.attempts.values()].map((a) => ({ ...a }))
  }

  /**
   * WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-003: cross-process-fresh read
   * view for the trace projection — replays the file under the existing
   * lock (same discipline as listActiveFresh) and returns the whole
   * projection. Read-only in intent; the lock is the freshness seam.
   */
  async snapshotFresh() {
    return this.mutate(() => [...this.attempts.values()].map((a) => ({ ...a })))
  }
}
