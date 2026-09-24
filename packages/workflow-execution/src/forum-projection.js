/**
 * @agent-core/workflow-execution/src/forum-projection.js — the forum
 * execution-event projection (WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-007).
 *
 * Converts ledger lifecycle events into human-readable messages on the
 * CANONICAL workflow thread. Discipline:
 *
 *   - The module NEVER creates threads. Canonical binding is owned by
 *     svc-workflow (companion Spec CTR-SWEC-001/002/003); the thread is
 *     resolved by context query, and an absent thread means "skip, retry
 *     next pass" — never a second binding surface.
 *   - eventKey = sha256(raw ledger line): the dedupe identity riding the
 *     message metadata. Posted keys + the file byte offset persist in
 *     <dir>/forum-projection-state.json so a restart neither re-posts the
 *     committed window nor skips unread lines.
 *   - Posting failures never propagate into the engine, the ledger, or any
 *     execution decision. The ledger stays the evidence store; this module
 *     is a recoverable projection with at-least-once delivery.
 *
 * All I/O is injected; production wiring lives in workflow-execution-runtime.
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { LEDGER_EVENTS_FILE } from './ledger.js'

export const FORUM_PROJECTION_STATE_FILE = 'forum-projection-state.json'
const POSTED_KEYS_WINDOW = 128
const DEFAULT_INTERVAL_MS = 30_000
const MAX_TAIL_BYTES = 4 * 1024 * 1024

const UUID8 = (id) => (typeof id === 'string' && id.length >= 8 ? id.slice(0, 8) : String(id))

/** Human-readable projection text per ledger event (Goal Scope G list). */
export function forumMessageFor(event, attempt) {
  const visit = UUID8(event.nodeVisitId)
  const generation = attempt?.generation ?? event.generation ?? 1
  switch (event.kind) {
    case 'attempt_planned':
      return `▶️ Attempt #${generation} planned for node visit ${visit} (dispatch ${UUID8(event.dispatchIntentId)})`
    case 'run_delivered':
      return `🤖 Attempt #${generation} dispatched to Agent \`${event.agentId}\`${event.sessionId !== undefined ? ` — session \`${event.sessionId}\` linked` : ''}`
    case 'delivery_failed':
      return `⚠️ Execution delivery failed on visit ${visit}: ${event.reason ?? 'unknown reason'}`
    case 'resolution_blocked':
      return `⛔ Execution blocked on visit ${visit}: ${event.code ?? 'unknown code'} (no Run started)`
    case 'stale_superseded':
      return `⏱️ Attempt #${generation} stale: no business progress observed — visit restored for re-entry`
    case 'escalation_requested':
      return `🚨 HUMAN_REQUIRED requested for visit ${visit} (attempt limit reached, ${event.reason ?? 'ATTEMPTS_EXHAUSTED'}) — escalation recorded ${event.assistanceCaseId !== undefined ? `(case ${UUID8(event.assistanceCaseId)})` : ''}`
    case 'reconciled':
      if (event.judgment === 'run_ended_no_submission') {
        return `❗ Attempt #${generation} run ended WITHOUT a business transition (visit ${visit} still current)`
      }
      if (event.judgment === 'run_outcome_unknown') {
        return `❓ Attempt #${generation} run outcome UNKNOWN — awaiting exact termination evidence (no re-run on a timeout alone)`
      }
      if (event.judgment === 'business_commitment_observed') {
        return `✅ Attempt #${generation} settled: business commitment observed on visit ${visit}`
      }
      if (event.judgment === 'delivery_unverified') {
        return `❓ Attempt #${generation} delivery unverified (visit ${visit}) — recorded for review, never silently dropped`
      }
      return `ℹ️ Attempt #${generation} reconciled (${event.judgment ?? 'unknown judgment'})`
    default:
      return undefined
  }
}

/**
 * @param {object} deps
 * @param {string} deps.dir - workflowExecutionDir (ledger + state file home).
 * @param {({workflowInstanceId:string}) => Promise<{ok:true, threadId:string|null}|{ok:false, code:string}>} deps.resolveThread
 *   - canonical thread lookup by context (svc-owned binding; null = none yet).
 * @param {({threadId:string, content:string, metadata:object}) => Promise<{ok:true}|{ok:false, code:string}>} deps.postMessage
 * @param {object} [deps.log]
 * @param {Function} [deps.clock]
 * @param {number} [deps.intervalMs]
 */
export function createForumProjection({
  dir,
  resolveThread,
  postMessage,
  log = {},
  clock = () => Date.now(),
  intervalMs = DEFAULT_INTERVAL_MS,
}) {
  if (typeof dir !== 'string' || dir === '') throw new TypeError('workflow-execution: forum projection dir is required')
  if (typeof resolveThread !== 'function' || typeof postMessage !== 'function') {
    throw new TypeError('workflow-execution: forum projection requires resolveThread and postMessage seams')
  }
  const stateFile = join(dir, FORUM_PROJECTION_STATE_FILE)
  const eventsFile = join(dir, LEDGER_EVENTS_FILE)
  let timer
  let running = false
  // Per-instance thread resolution cache: resolved threads are stable (the
  // binding is canonical); an unresolved thread is retried every pass.
  const threadCache = new Map()

  function loadState() {
    try {
      if (!existsSync(stateFile)) return { byteOffset: 0, postedKeys: [] }
      const parsed = JSON.parse(readFileSync(stateFile, 'utf8'))
      return {
        byteOffset: Number.isInteger(parsed.byteOffset) && parsed.byteOffset >= 0 ? parsed.byteOffset : 0,
        postedKeys: Array.isArray(parsed.postedKeys) ? parsed.postedKeys.filter((k) => typeof k === 'string') : [],
      }
    } catch (error) {
      log.warn?.(`forum-projection: state file unreadable, restarting from offset 0 (${error?.message ?? error})`)
      return { byteOffset: 0, postedKeys: [] }
    }
  }

  function saveState(state) {
    const tmp = `${stateFile}.tmp`
    writeFileSync(tmp, JSON.stringify(state), 'utf8')
    renameSync(tmp, stateFile)
  }

  /** Parse the not-yet-consumed tail of the ledger file into
   *  [{ event, eventKey, lineBytes }]. A torn (unparseable) tail line is
   *  left for the next pass; nextOffset only ever covers COMPLETE lines. */
  function readNewEvents(byteOffset) {
    if (!existsSync(eventsFile)) return { events: [], size: byteOffset, nextOffset: byteOffset }
    const buf = readFileSync(eventsFile)
    const size = buf.length
    if (size <= byteOffset) return { events: [], size, nextOffset: Math.min(byteOffset, size) }
    const start = Math.max(byteOffset, Math.max(0, size - MAX_TAIL_BYTES))
    const lines = buf.subarray(start).toString('utf8').split('\n')
    const events = []
    let consumed = 0
    for (const line of lines) {
      if (line === '') {
        // Interior blank line = one '\n' byte; the trailing split artifact
        // after the final newline contributes nothing real (clamped below).
        consumed += 1
        continue
      }
      let event
      try {
        event = JSON.parse(line)
      } catch {
        log.warn?.('forum-projection: stopped at an unparseable ledger line — it retries next pass')
        break
      }
      const lineBytes = Buffer.byteLength(line, 'utf8') + 1
      events.push({
        event,
        eventKey: createHash('sha256').update(line).digest('hex'),
        lineBytes,
      })
      consumed += lineBytes
    }
    return { events, size, nextOffset: Math.min(start + consumed, size) }
  }

  async function pass() {
    const state = loadState()
    const read = readNewEvents(state.byteOffset)
    if (read.events.length === 0) {
      if (read.nextOffset !== state.byteOffset) {
        saveState({ ...state, byteOffset: read.nextOffset })
      }
      return { posted: 0, skipped: 0 }
    }
    // Latest attempt facts per visit for richer messages (best effort — the
    // message text stays a projection of the event itself when absent).
    let posted = 0
    let skipped = 0
    const postedKeys = new Set(state.postedKeys)
    let byteOffset = state.byteOffset
    for (const item of read.events) {
      if (postedKeys.has(item.eventKey)) {
        byteOffset += item.lineBytes
        continue
      }
      const workflowInstanceId = typeof item.event.workflowInstanceId === 'string' ? item.event.workflowInstanceId : undefined
      if (workflowInstanceId === undefined) {
        // A pre-stamping historical line: not projectable, never re-read.
        skipped += 1
        byteOffset += item.lineBytes
        continue
      }
      const text = forumMessageFor(item.event)
      if (text === undefined) {
        skipped += 1
        byteOffset += item.lineBytes
        continue
      }
      let threadId = threadCache.get(workflowInstanceId)
      if (threadId === undefined) {
        const resolved = await resolveThread({ workflowInstanceId })
        threadId = resolved?.ok === true ? (resolved.threadId ?? null) : null
        if (resolved?.ok !== true) skipped += 1
        // ONLY a resolved thread id is cached. A null (binding still pending
        // or transient resolver failure) retries on the next pass — never a
        // cached "no thread" that would hold events forever.
        if (threadId !== null) threadCache.set(workflowInstanceId, threadId)
      }
      if (threadId === null) {
        // No canonical thread YET (svc binding still pending or class is not
        // BUSINESS): hold the offset — the event retries next pass, and the
        // ledger keeps the fact either way.
        skipped += 1
        break
      }
      const posted_ = await postMessage({
        threadId,
        // kind='comment' is intrinsic to this projection: system events stay
        // reviewer-safe (system/decision kinds require forum.moderate and
        // are deliberately out of scope — companion forum Spec §2).
        kind: 'comment',
        content: text,
        metadata: {
          workflowInstanceId,
          nodeVisitId: item.event.nodeVisitId,
          eventKey: item.eventKey,
          eventType: item.event.kind,
        },
      })
      if (posted_?.ok !== true) {
        skipped += 1
        break // hold the offset; retry next pass (at-least-once)
      }
      postedKeys.add(item.eventKey)
      while (postedKeys.size > POSTED_KEYS_WINDOW) {
        postedKeys.delete(postedKeys.values().next().value)
      }
      byteOffset += item.lineBytes
      posted += 1
      saveState({ byteOffset, postedKeys: [...postedKeys] })
    }
    return { posted, skipped }
  }

  async function guardedPass() {
    if (running) return { posted: 0, skipped: 0 }
    running = true
    try {
      return await pass()
    } catch (error) {
      log.warn?.(`forum-projection: pass failed: ${error?.message ?? error}`)
      return { posted: 0, skipped: 0, error: String(error?.message ?? error) }
    } finally {
      running = false
    }
  }

  return {
    /** ONE guarded projection pass — never throws into the caller. */
    pass: guardedPass,
    stateFile,
    start({ intervalMs: override } = {}) {
      if (timer !== undefined) return
      timer = setInterval(() => { void guardedPass() }, override ?? intervalMs)
      timer.unref?.()
      log.log?.(`forum-projection: projection loop armed (intervalMs=${override ?? intervalMs})`)
    },
    stop() {
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
    },
  }
}
