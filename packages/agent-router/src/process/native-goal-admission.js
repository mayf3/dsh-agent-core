/** Native goal reservations enter the existing Router-owned prompt queue. */
import { createHash } from 'node:crypto'
import { PROCESS_EVIDENCE_CAPS } from './evidence-buffer.js'

export const NATIVE_GOAL_RPC_METHOD = 'agent-core/nativeGoalContinuation'
export const NATIVE_GOAL_PROTOCOL_VERSION = 1
const fields = ['version', 'reservationId', 'sessionId', 'messageId', 'goal', 'contentBlocks', 'contentSha256'].sort().join(',')
const boundedText = value => typeof value === 'string' && value.length > 0 && value.length <= 256

/** Validate the complete process-wire reservation; never derives caller identity. */
export function validateNativeGoalReservation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).sort().join(',') !== fields || value.version !== 1
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.reservationId ?? '')
      || !boundedText(value.sessionId) || !boundedText(value.messageId)) return false
  const goal = value.goal
  if (!goal || Object.keys(goal).sort().join(',') !== 'goalId,revision,round'
      || !boundedText(goal.goalId) || !Number.isSafeInteger(goal.revision) || goal.revision < 1
      || !Number.isSafeInteger(goal.round) || goal.round < 1) return false
  const blocks = value.contentBlocks
  if (!Array.isArray(blocks) || blocks.length !== 1 || !blocks[0]
      || Object.keys(blocks[0]).sort().join(',') !== 'text,type'
      || blocks[0].type !== 'text' || typeof blocks[0].text !== 'string'
      || Buffer.byteLength(blocks[0].text) > PROCESS_EVIDENCE_CAPS.MAX_PROMPT_BYTES) return false
  return createHash('sha256').update(JSON.stringify(blocks)).digest('hex') === value.contentSha256
}

/** Admit only the bound child's exact already-live session, never a target Agent. */
export async function admitNativeGoalContinuation(proc, params, rpcMeta = {}) {
  const deny = code => ({ kind: 'not_enqueued', code })
  if (!validateNativeGoalReservation(params)) return deny('NATIVE_GOAL_INVALID_RESERVATION')
  if (proc?.initializeEvidence?.nativeGoalContinuation?.version !== 1) return deny('NATIVE_GOAL_PROTOCOL_UNAVAILABLE')
  if (!Object.hasOwn(proc.status ?? {}, params.sessionId)) return deny('NATIVE_GOAL_SESSION_NOT_LIVE')
  // Process-local transport dedup survives reconciliation retention eviction.
  // Saturation denies new automatic admission; no remembered attempt is evicted.
  proc.nativeGoalReservationsSeen ??= new Set()
  if (proc.nativeGoalReservationsSeen.has(params.reservationId)) return deny('NATIVE_GOAL_RESERVATION_ALREADY_SEEN')
  if (proc.nativeGoalReservationsSeen.size >= PROCESS_EVIDENCE_CAPS.MAX_LATE_PROMPT_TOMBSTONES) return deny('NATIVE_GOAL_RESERVATION_CAPACITY')
  proc.nativeGoalReservationsSeen.add(params.reservationId)
  const reservation = JSON.parse(JSON.stringify(params))
  // requestId is the existing generic caller correlation. No Scheduler
  // occurrence/run identity is invented; generation and Agent are parent-owned.
  const requestId = `native-goal:${proc.agentId}:${proc.processGeneration}:${params.reservationId}`
  try {
    const receipt = await proc.deliver(params.sessionId, params.contentBlocks[0].text, {
      nativeGoalContinuation: reservation,
      admissionSignal: rpcMeta.signal,
      admissionDeadlineMono: rpcMeta.handlerDeadlineMono,
      callerCorrelation: { requestId },
    })
    proc.auditBounded({ kind: 'native_goal_admitted', detail: JSON.stringify({
      reservationId: params.reservationId, sessionId: params.sessionId, messageId: receipt.messageId,
      goal: params.goal, processGeneration: proc.processGeneration, reconciliationHandle: receipt.reconciliationHandle,
    }) })
    return { kind: 'enqueued', messageId: receipt.messageId, reconciliationHandle: receipt.reconciliationHandle }
  } catch (error) {
    const definite = error?.status === 'not_admitted' || error?.status === 'failed'
    const result = { kind: definite ? 'not_enqueued' : 'outcome_unknown', code: error?.code ?? 'NATIVE_GOAL_ADMISSION_FAILED',
      reconciliationHandle: error?.reconciliationHandle ?? null }
    proc.auditBounded({ kind: 'native_goal_admission_failed', detail: JSON.stringify({
      reservationId: params.reservationId, sessionId: params.sessionId, goal: params.goal, ...result,
    }) })
    return result
  }
}

/** Classify only this protocol's uncertain callback; ordinary RPC behavior is unchanged. */
export function nativeGoalResponseError(execution, message) {
  if (!execution?.nativeGoalMessageId) return null
  if (message.error?.code === 'NATIVE_GOAL_ENQUEUE_OUTCOME_UNKNOWN') return 'NATIVE_GOAL_ENQUEUE_OUTCOME_UNKNOWN'
  if (message.error === undefined && message.result?.messageId !== execution.nativeGoalMessageId) return 'NATIVE_GOAL_RECEIPT_MISMATCH'
  return null
}

/** Register cancellation only for this bounded private entry on this exact child. */
export function registerNativeGoalCancellation(proc, method, requestId, controller) {
  if (method !== NATIVE_GOAL_RPC_METHOD) return () => {}
  proc.nativeGoalRpcControllers ??= new Map()
  if (proc.nativeGoalRpcControllers.size >= PROCESS_EVIDENCE_CAPS.MAX_QUEUED_TURNS_PER_PROCESS
      || proc.nativeGoalRpcControllers.has(requestId) || requestId.length > 256) return null
  proc.nativeGoalRpcControllers.set(requestId, controller)
  return () => proc.nativeGoalRpcControllers.delete(requestId)
}

/** A wire notification cancels only the sender's exact pending native admission. */
export function cancelNativeGoalRpc(proc, params) {
  if (!params || Object.keys(params).join(',') !== 'requestId' || typeof params.requestId !== 'string') return
  const controller = proc.nativeGoalRpcControllers?.get(params.requestId)
  controller?.abort('native_goal_child_cancelled')
}
