/** Application-level session preparation, separate from process initialize.
 * The versioned acknowledgement proves session creation/resume completed.
 * It does not claim that a later provider network request will succeed;
 * connection-level failures remain the delivery recovery layer's concern.
 */
import { envelopeCarrier, monotonicNowMs } from './state-machine.js'

function preparationError(code, message) {
  return envelopeCarrier('not_admitted', null, code, message, { deliveryPreparation: true })
}

export const deliveryReadinessMethods = {
  async prepareDelivery(sessionId, opts = {}, { deadlineMono } = {}) {
    const gate = this.preAdmissionError('turn', sessionId, '', 0, opts)
    if (gate !== null) throw gate
    if (this.initializeEvidence?.deliveryReadiness?.version !== 1) {
      throw preparationError('AGENT_DELIVERY_PREPARE_PROTOCOL',
        'child does not support versioned delivery preparation')
    }
    if (deadlineMono !== undefined && !Number.isFinite(deadlineMono)) {
      throw new TypeError('delivery preparation requires a finite monotonic deadline')
    }
    const deadline = Math.min(deadlineMono ?? Infinity,
      monotonicNowMs() + this.deadlines.initializeTimeoutMs)
    if (deadline <= monotonicNowMs()) {
      throw preparationError('AGENT_DELIVERY_PREPARE_TIMEOUT',
        'delivery preparation deadline expired before request')
    }
    let acknowledgement
    try {
      acknowledgement = await this.request('session/prepare', {
        version: 1,
        sessionId,
        ...(opts.cwd === undefined ? {} : { cwd: opts.cwd }),
        ...(opts.websiteControl ? { privateSession: true } : {}),
      }, undefined, { deadlineMono: deadline })
    } catch (error) {
      if (error?.code === 'AGENT_PROCESS_RPC_DEADLINE') {
        throw preparationError('AGENT_DELIVERY_PREPARE_TIMEOUT',
          'child did not finish delivery preparation before the deadline')
      }
      error.deliveryPreparation = true
      throw error
    }
    if (monotonicNowMs() >= deadline) {
      throw preparationError('AGENT_DELIVERY_PREPARE_TIMEOUT',
        'delivery preparation acknowledgement arrived after the deadline')
    }
    if (acknowledgement?.version !== 1 || acknowledgement?.ready !== true
        || acknowledgement?.sessionId !== sessionId) {
      throw preparationError('AGENT_DELIVERY_PREPARE_PROTOCOL',
        'child returned an invalid delivery preparation acknowledgement')
    }
    // State or fences can change while a large session is replaying.
    const currentGate = this.preAdmissionError('turn', sessionId, '', 0, opts)
    if (currentGate !== null) throw currentGate
    return { version: 1, ready: true, sessionId }
  },
}
