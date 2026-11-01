/** Parent-owned admission provider for the native driver's awaited enqueue hook. */
import { createHash, randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { NATIVE_GOAL_RPC_METHOD, validateNativeGoalReservation } from '../../agent-router/src/process/native-goal-admission.js'
import { PROCESS_EVIDENCE_CAPS } from '../../agent-router/src/process/evidence-buffer.js'

function rejected(message, code = 'NATIVE_GOAL_RESERVATION_REJECTED') {
  return Object.assign(new Error(message), { code })
}

/** Keep process-local closures; the native driver remains the reservation owner. */
export function createNativeGoalAdmission({ request, getAgent, audit = () => {} }) {
  const pending = new Map()
  let active = false
  let reservationSeq = 0
  function activate({ parentVersion, driver }) {
    if (parentVersion !== 1 || driver?.protocolVersion !== 1 || driver?.enqueueMode !== 'external') {
      throw rejected('native goal admission protocol is unavailable', 'NATIVE_GOAL_PROTOCOL_UNAVAILABLE')
    }
    active = true
    return { version: 1 }
  }

  async function enqueue({ agent, message, signal, commit }) {
    if (!active || signal.aborted || getAgent(String(agent.session.id)) !== agent
        || reservationSeq === Number.MAX_SAFE_INTEGER
        || pending.size >= PROCESS_EVIDENCE_CAPS.MAX_QUEUED_TURNS_PER_PROCESS) return { kind: 'not_enqueued' }
    const reservation = {
      version: 1, reservationId: randomUUID(), reservationSeq: ++reservationSeq, sessionId: String(agent.session.id), messageId: message.id,
      goal: { goalId: message.source.goalId, revision: message.source.revision, round: message.source.round },
      contentBlocks: structuredClone(message.content),
      contentSha256: createHash('sha256').update(JSON.stringify(message.content)).digest('hex'),
    }
    if (!validateNativeGoalReservation(reservation)) return { kind: 'not_enqueued' }
    const entry = { agent, message, commit, reservation, phase: 'pending', signal, receipt: undefined }
    pending.set(reservation.reservationId, entry)
    let abort
    const cancelled = new Promise(resolve => {
      abort = () => resolve({ kind: 'outcome_unknown' })
      signal.addEventListener('abort', abort, { once: true })
      entry.abort = abort
    })
    try {
      const response = Promise.resolve(request(NATIVE_GOAL_RPC_METHOD, reservation, { signal })).then(value => {
        const result = value?.ok === true ? value.result : undefined
        if (result?.kind === 'not_enqueued' && entry.phase === 'pending') return result
        if (result?.kind === 'enqueued' && entry.phase === 'committed'
            && result.messageId === message.id && result.reconciliationHandle === entry.handle) return result
        return { kind: 'outcome_unknown', reconciliationHandle: entry.handle ?? null }
      }, () => ({ kind: 'outcome_unknown', reconciliationHandle: entry.handle ?? null }))
      const result = await Promise.race([response, cancelled])
      audit({ kind: 'native_goal_admission', reservationId: reservation.reservationId,
        sessionId: reservation.sessionId, goal: reservation.goal, messageId: reservation.messageId,
        outcome: result.kind, reconciliationHandle: entry.handle ?? null })
      return result
    } finally {
      signal.removeEventListener('abort', abort)
      pending.delete(reservation.reservationId)
    }
  }

  function commit({ sessionId, cwd, contentBlocks, turnExecutionId, reservation }) {
    const entry = pending.get(reservation?.reservationId)
    if (!active || !entry || entry.signal.aborted || !validateNativeGoalReservation(reservation)
        || !isDeepStrictEqual(reservation, entry.reservation)
        || sessionId !== reservation.sessionId || getAgent(sessionId) !== entry.agent
        || (cwd !== undefined && cwd !== entry.agent.session.header.cwd) || !isDeepStrictEqual(contentBlocks, entry.message.content)
        || !isDeepStrictEqual(contentBlocks, reservation.contentBlocks)
        || typeof turnExecutionId !== 'string' || turnExecutionId === '') {
      throw rejected('native goal reservation is absent, invalidated or mismatched')
    }
    if (entry.phase === 'committed' && entry.handle === turnExecutionId) return entry.receipt
    if (entry.phase !== 'pending') throw rejected('native goal reservation already attempted')
    entry.handle = turnExecutionId
    entry.phase = 'committing'
    let result
    try {
      result = entry.commit()
    } catch {
      throw rejected('native goal enqueue outcome is unknown', 'NATIVE_GOAL_ENQUEUE_OUTCOME_UNKNOWN')
    }
    if (result?.kind === 'not_enqueued') {
      entry.phase = 'rejected'
      throw rejected('native driver invalidated its reservation before enqueue')
    }
    if (result?.kind !== 'enqueued' || result.messageId !== entry.message.id) {
      throw rejected('native goal enqueue outcome is unknown', 'NATIVE_GOAL_ENQUEUE_OUTCOME_UNKNOWN')
    }
    entry.phase = 'committed'
    entry.receipt = { messageId: entry.message.id }
    return entry.receipt
  }

  function dispose() {
    active = false
    for (const entry of pending.values()) entry.abort()
  }
  return { protocolVersion: 1, activate, enqueue, commit, dispose }
}
