/** Closed r5 status answer-leg boundary. No send/reconcile or full-inspect fallback. */
import { exactKeys } from './scheduler-mutation-result.js'

const MAX_BYTES = 4096
const RESULT_KEYS = ['status', 'targetAgentId', 'sessionId', 'messageId', 'resolvedTurnId', 'turnState', 'startedAt', 'endedAt', 'stopReason', 'reply']
const KINDS = new Set(['completed', 'aborted', 'blocked', 'error', 'max-tokens', 'interrupted', 'other'])
const CAUSES = new Set(['user', 'parent', 'hook', 'disposed', 'legacy', 'other'])
const ERROR_CODES = new Set(['invalid_arguments', 'credential_unavailable', 'credential_invalid', 'access_denied',
  'not_found_or_not_owned', 'trace_unresolvable', 'inspection_unavailable', 'internal_error', 'transport_failure', 'unsupported_operation'])
const integer = value => Number.isSafeInteger(value) && value >= 0
const unavailable = () => ({ errorCode: 'inspection_unavailable', detail: 'bounded dispatch status response is unavailable' })

/** Also covers trusted gateway failures occurring before the reader/relay. */
export function sanitizeDispatchStatusError(error) {
  return {
    code: ERROR_CODES.has(error?.code) ? error.code : 'internal_error',
    detail: 'dispatch status read did not return an authorized status',
  }
}

function validResult(result, args) {
  if (!exactKeys(result, RESULT_KEYS) || result.status !== 'found') return false
  if (!['targetAgentId', 'sessionId', 'messageId'].every(key => result[key] === args[key])) return false
  if (!exactKeys(result.reply, ['state', 'reference'])) return false
  const { turnState, resolvedTurnId, startedAt, endedAt, stopReason, reply } = result
  if (turnState === 'accepted_not_started') {
    return resolvedTurnId === null && startedAt === null && endedAt === null && stopReason === null
      && reply.state === 'pending' && reply.reference === null
  }
  if (!integer(resolvedTurnId) || !integer(startedAt)) return false
  if (turnState === 'running') return endedAt === null && stopReason === null
    && reply.state === 'pending' && reply.reference === null
  if (!['completed', 'failed'].includes(turnState) || !integer(endedAt)
    || !exactKeys(stopReason, ['kind', 'abortCause']) || !KINDS.has(stopReason.kind)) return false
  if (stopReason.kind === 'aborted' ? !CAUSES.has(stopReason.abortCause) : stopReason.abortCause !== null) return false
  if (turnState === 'failed') return stopReason.kind !== 'completed' && reply.state === 'not_successful' && reply.reference === null
  if (stopReason.kind !== 'completed') return false
  return reply.state === 'absent' ? reply.reference === null
    : reply.state === 'available' && exactKeys(reply.reference, ['assistantMessageSeq']) && integer(reply.reference.assistantMessageSeq)
}

export async function relayDispatchStatus(requestFn, manifest, operation, args) {
  let envelope
  try {
    envelope = await requestFn({ capabilityId: manifest.id, operation, args })
  } catch {
    return { errorCode: 'transport_failure', detail: 'dispatch status transport is unavailable' }
  }
  if (!exactKeys(envelope, ['ok', 'result']) || envelope.ok !== true) return unavailable()
  const parent = envelope.result
  if (parent?.ok === true) {
    try {
      if (!exactKeys(parent, ['ok', 'result']) || !validResult(parent.result, args)
        || Buffer.byteLength(JSON.stringify(parent.result), 'utf8') > MAX_BYTES) return unavailable()
      return parent.result
    } catch { return unavailable() }
  }
  if (parent?.ok === false && manifest.errors.some(entry => entry.code === parent.error?.code)) {
    // A fixed public detail avoids forwarding raw exception/provider strings or
    // arbitrary metadata across this small projection's error boundary.
    const error = sanitizeDispatchStatusError(parent.error)
    return { errorCode: error.code, detail: error.detail }
  }
  return unavailable()
}
