/**
 * @agent-core/production-runtime/src/agent-session-reply-wait.js — the thin,
 * race-safe reconciliation wait helper for agent_session_send
 * (AGENT_CORE_AGENT_SESSION_MESSAGING_V1 R8 + R9).
 *
 * The helper owns NO second output cache, NO durable state, NO poll loop and
 * NO external delivery. It composes exactly the existing sole reconciliation
 * authority:
 *
 *   read(handle)    -> readFinalAssistantOutput(handle)
 *   subscribe(fn)   -> onTurnReconciled(listener) returning a disposer
 *
 * R9 algorithm (frozen):
 *   1. read once; a terminal state settles immediately
 *   2. subscribe and filter the EXACT handle
 *   3. read again after subscribing (closes the read→subscribe race)
 *   4. install the remaining-deadline timer
 *   5. on a matching event, read the authoritative output again
 *   6. before declaring timeout, perform one final read
 *   7. settle through one once-guard
 *   8. clear the timer and dispose the listener on EVERY exit path
 *
 * `mapFinalAssistantOutputToOutcome` is the closed R8 mapping. A bounded
 * tail with truncated=true is never silently called the exact reply, and
 * text emitted before a failed (or outcome-unknown) Run never becomes a
 * successful tool result — including the late `terminated_without_outcome`
 * terminal, which maps to outcome_unknown.
 */

/**
 * Closed R8 mapping from one readFinalAssistantOutput snapshot to the
 * capability outcome. Returns null while the Run is still pending.
 *
 * @param {object} output - readFinalAssistantOutput(handle) result.
 * @returns {{kind:'replied', reply:string}
 *   | {kind:'reply_unavailable', reason:string}
 *   | {kind:'target_run_failed'}
 *   | {kind:'outcome_unknown'}
 *   | {kind:'not_admitted'}
 *   | null} null means keep waiting (state 'pending').
 */
export function mapFinalAssistantOutputToOutcome(output) {
  if (output === null || output === undefined || typeof output !== 'object') {
    return { kind: 'reply_unavailable', reason: 'never_existed' }
  }
  if (output.state === 'pending') return null
  if (output.state === 'available') {
    if (output.truncated === true) return { kind: 'reply_unavailable', reason: 'truncated' }
    if (output.terminalState === 'completed' || output.terminalState === 'late_completed') {
      return { kind: 'replied', reply: output.text }
    }
    if (output.terminalState === 'failed' || output.terminalState === 'late_failed') {
      return { kind: 'target_run_failed' }
    }
    if (output.terminalState === 'terminated_without_outcome') return { kind: 'outcome_unknown' }
    if (output.terminalState === 'not_admitted') return { kind: 'not_admitted' }
    return { kind: 'outcome_unknown' }
  }
  if (output.state === 'no_output') {
    if (output.terminalState === 'completed' || output.terminalState === 'late_completed') {
      return { kind: 'reply_unavailable', reason: 'no_output' }
    }
    if (output.terminalState === 'failed' || output.terminalState === 'late_failed') {
      return { kind: 'target_run_failed' }
    }
    if (output.terminalState === 'terminated_without_outcome') return { kind: 'outcome_unknown' }
    if (output.terminalState === 'not_admitted') return { kind: 'not_admitted' }
    return { kind: 'outcome_unknown' }
  }
  // evicted | restart_lost | never_existed — the state name IS the reason.
  return { kind: 'reply_unavailable', reason: String(output.state) }
}

/**
 * Create the wait helper over the Router reconciliation seams.
 *
 * @param {object} deps
 * @param {(handle:string) => object} deps.read - readFinalAssistantOutput.
 * @param {(listener:Function) => Function} deps.subscribe - onTurnReconciled;
 *   must return a disposer. Listeners receive `{ handle, ...snapshot }`.
 * @param {{set:(fn:Function, ms:number) => unknown, clear:(timer:unknown) => void}} [deps.timer] -
 *   injectable timer seam (defaults to setTimeout/clearTimeout).
 * @param {() => number} [deps.now] - wall-clock seam (defaults Date.now).
 * @returns {(handle:string, deadlineWallMs:number) =>
 *   Promise<{timedOut:true} | {timedOut:false, outcome:object}>}
 */
export function createFinalReplyWaiter({ read, subscribe, timer = defaultTimer(), now = () => Date.now() }) {
  if (typeof read !== 'function') throw new TypeError('agent-session-reply-wait: read is required')
  if (typeof subscribe !== 'function') throw new TypeError('agent-session-reply-wait: subscribe is required')

  return async function waitForFinalAssistantReply(handle, deadlineWallMs) {
    // R9.1: an already-settled Run settles without ever subscribing.
    const first = mapFinalAssistantOutputToOutcome(read(handle))
    if (first !== null) return { timedOut: false, outcome: first }

    return new Promise((resolve) => {
      let done = false
      let timerHandle
      let disposer

      const once = (value) => {
        if (done) return
        done = true
        // The post-subscribe read may settle BEFORE the timer is installed —
        // clearing an unset timer is a no-op, never an error.
        if (timerHandle !== undefined) timer.clear(timerHandle)
        if (disposer !== undefined) disposer()
        resolve(value)
      }

      // R9.2: subscribe first, filtered to the EXACT handle; R9.5: on the
      // matching event, read the authoritative output again (never trust a
      // snapshot carried by the event).
      disposer = subscribe((event) => {
        if (done || event?.handle !== handle) return
        const mapped = mapFinalAssistantOutputToOutcome(read(handle))
        if (mapped !== null) once({ timedOut: false, outcome: mapped })
      })

      // R9.3: read again AFTER subscribing — closes the read→subscribe race
      // (settled between the first read and the subscription).
      const afterSubscribe = mapFinalAssistantOutputToOutcome(read(handle))
      if (afterSubscribe !== null) {
        once({ timedOut: false, outcome: afterSubscribe })
        return
      }

      // R9.4 + R9.6: the remaining deadline fires one FINAL authoritative
      // read before the timeout is declared.
      const remaining = Math.max(0, deadlineWallMs - now())
      timerHandle = timer.set(() => {
        const finalRead = mapFinalAssistantOutputToOutcome(read(handle))
        once(finalRead === null ? { timedOut: true } : { timedOut: false, outcome: finalRead })
      }, remaining)
    })
  }
}

function defaultTimer() {
  return {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (handle) => clearTimeout(handle),
  }
}
