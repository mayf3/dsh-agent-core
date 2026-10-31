/** CTR-R1..R5: same-route recovery. Unknown outcomes never enter this retry path. */
import { monotonicNowMs } from './state-machine.js'
import { authoritativeTurnEvidence, chainDeadlineError } from './route-chain-evidence.js'
import { hasExactDeathEvidence } from '../process-registry-death-evidence.js'
import { createDeliveryFailureStore } from '../reconciliation/delivery-failures.js'

const retryProofs = new WeakMap()
export const DELIVERY_COMPLETION = Symbol('deliveryCompletion')
const harmlessEvents = new Set(['agent/inbox/spliced', 'turn/start', 'user/message', 'turn/end'])
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/** Called only by the exact terminal+idle reducer, before the execution is discarded.
 * Unknown event types, an evicted event, any assistant content/tool or an earlier
 * failed turn deny replay. No arbitrary provider-supplied proof crosses here. */
export function markTransportRetryEvidence(proc, execution, error) {
  if (error.transportFailure === 'connection_failure') proc.deliveryTransportFailed = true
  if (error.transportFailure !== 'connection_failure' || execution.unknownMarked
      || execution.streamGapSeen || execution.laterTurnStartSeen || execution.deliveryRpcObserved || execution.hasOutput()) return
  for (let seq = execution.watermarkSeq + 1; seq <= proc.eventSeq; seq += 1) {
    const entry = proc.eventLog.get(seq)
    if (!entry) return
    if (entry.params?.sessionId !== execution.sessionId) continue
    if (!harmlessEvents.has(entry.params.event?.type)) return
  }
  retryProofs.set(error, { proc, handle: execution.handle })
}

function retryProven(proc, error) {
  const proof = retryProofs.get(error)
  const snapshot = authoritativeTurnEvidence(proc, error)
  return proof !== undefined && proof.proc === proc && proof.handle === error.reconciliationHandle
    && snapshot?.initialOutcome !== 'outcome_unknown'
    && snapshot?.reconciledOutcome === 'failed'
    && snapshot?.outcomeEvidence === 'exact_turn_end_failure'
    && snapshot?.terminationEvidence === 'exact_terminal_then_idle'
    && snapshot?.finalAssistantOutputAvailable === false
}

async function bounded(operation, deadlineMono, agentId) {
  const remaining = deadlineMono - monotonicNowMs()
  if (remaining <= 0) throw chainDeadlineError(agentId)
  let timer
  try {
    return await Promise.race([operation(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(chainDeadlineError(agentId)), remaining)
    })])
  } finally { clearTimeout(timer) }
}

/** Quarantine synchronously before yielding; reuse/admission gates see this flag.
 * Existing single-flight ownership must drain before shutdown. Real exit (not
 * shutdown ACK) is required before the caller can acquire a replacement. */
async function retire(proc, deadlineMono, agentId) {
  proc.deliveryTransportFailed = true
  proc.rejectQueuedTurns?.('AGENT_DELIVERY_TRANSPORT_UNHEALTHY', 'transport generation quarantined')
  await bounded(async () => {
    while (proc.turnInFlight === true || (proc.executions?.size ?? 0) > 0) await sleep(1)
    if (typeof proc.shutdown !== 'function') throw new Error('controlled shutdown unavailable')
    await proc.shutdown(Math.max(1, Math.min(proc.deadlines?.shutdownGraceMs ?? 30_000, deadlineMono - monotonicNowMs())))
    if (!hasExactDeathEvidence(proc)) throw new Error('transport generation real exit unproven')
  }, deadlineMono, agentId)
}

export function createDeliveryResilience({ log, deadLetterDirectory, transportRetry = {}, deliveryAlert = {} }) {
  const failures = createDeliveryFailureStore({ log, directory: deadLetterDirectory, ...deliveryAlert })
  // Fixed production policy: original + two retries, delays 250/500ms.
  // Test seam may shorten delays; cannot widen the production retry count.
  const maxRetries = 2
  const baseDelayMs = transportRetry.baseDelayMs ?? 250
  const wait = transportRetry.sleep ?? sleep
  function exhausted(error, request, attempts, category, recoveryBlocked = false) {
    let deadLetterId = null
    try { deadLetterId = failures.deadLetter({ ...request, attempts, error }) } catch {
      log.error?.(`delivery-dead-letter-failed ${JSON.stringify({ agentId: request.agentId, category, transportAttempts: attempts })}`)
    }
    error.deliveryFailure = { category, retriesExhausted: true, recoveryBlocked, deadLetterId,
      userMessage: deadLetterId ? `自动重试已停止，消息已留存（${deadLetterId}），请重发。`
        : '自动重试已停止，消息留存失败，请重发。' }
    return error
  }
  async function perform({ agentId, route, sessionId, message, opts, deadlineMono, acquire, invoke, onAcquired }, accepted) {
    let failedProc
    for (let retryIndex = 0; ; retryIndex += 1) {
      let proc
      let preparing = false
      try {
        proc = await bounded(() => acquire(agentId, route, deadlineMono), deadlineMono, agentId)
        onAcquired(proc)
        if (proc === failedProc || proc.deliveryTransportFailed) throw Object.assign(
          new Error('quarantined transport generation cannot be reused'), { code: 'AGENT_DELIVERY_TRANSPORT_UNHEALTHY' })
        preparing = true
        if (typeof proc.prepareDelivery === 'function') {
          await proc.prepareDelivery(sessionId, opts, { deadlineMono })
        }
        preparing = false
        if (monotonicNowMs() >= deadlineMono) throw chainDeadlineError(agentId)
        const result = await invoke(proc)
        if (result?.[DELIVERY_COMPLETION]) {
          accepted(result)
          await bounded(() => result[DELIVERY_COMPLETION], deadlineMono, agentId)
        }
        return result
      } catch (error) {
        const category = failures.failure(error, { agentId, routeRef: route.routeRef ?? null,
          transportAttempt: retryIndex + 1, processGeneration: proc?.processGeneration ?? null })
        const preparationFailure = preparing && error.deliveryPreparation === true
          && (['AGENT_DELIVERY_PREPARE_PROTOCOL', 'AGENT_DELIVERY_PREPARE_TIMEOUT',
            'AGENT_PROCESS_UNAVAILABLE', 'AGENT_PROCESS_EXITED', 'AGENT_PROCESS_INPUT_FROZEN'].includes(error.code)
            || error.transportFailure === 'connection_failure')
        const safe = preparationFailure || retryProven(proc, error)
        if (!safe || !proc) throw error
        if (!preparationFailure && (opts?.conversationSource || opts?.websiteControl || opts?.nativeGoalContinuation)) {
          // These accepted carriers own an exact original message/reservation.
          // Their stronger custody forbids another prompt for that same key.
          exhausted(error, { agentId, sessionId, message, opts, route }, retryIndex + 1, category)
          error.deliveryFailure.retriesExhausted = false
          error.deliveryFailure.replayForbidden = true
          throw error
        }
        failedProc = proc
        try { await retire(proc, deadlineMono, agentId) } catch {
          throw exhausted(error, { agentId, sessionId, message, opts, route }, retryIndex + 1, category, true)
        }
        const delay = baseDelayMs * 2 ** retryIndex
        if (retryIndex >= maxRetries || monotonicNowMs() + delay >= deadlineMono) {
          throw exhausted(error, { agentId, sessionId, message, opts, route }, retryIndex + 1, category)
        }
        try { await bounded(() => wait(delay), deadlineMono, agentId) } catch {
          throw exhausted(error, { agentId, sessionId, message, opts, route }, retryIndex + 1, category)
        }
      }
    }
  }
  function run(request) {
    // Deliver V0 remains receipt-only. One worker observes the exact terminal
    // promise after returning the receipt, without a second outward acceptance.
    return new Promise((resolve, reject) => {
      let accepted = false
      void perform(request, receipt => { accepted = true; resolve(receipt) }).then(resolve, error => {
        if (!accepted) return reject(error)
        log.error?.(`delivery-background-failed ${JSON.stringify({ agentId: request.agentId,
          deadLetterId: error.deliveryFailure?.deadLetterId ?? null,
          category: error.deliveryFailure?.category ?? 'other' })}`)
      })
    })
  }
  return { run, failures }
}
