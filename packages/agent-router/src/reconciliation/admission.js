/** Existing early admission gates with one observation for the rejected request. */
import { fencedRejection } from '../process/state-machine.js'

export function createRecoveryAdmission(store, routeChain) {
  function observed(error, agentId = null) {
    routeChain.recordBlockedDelivery?.(error, { agentId, reason: store.businessAdmissionStatus?.()?.reason })
    return error
  }
  return {
    observed,
    assertReady() {
      try { store.assertBusinessAdmissionReady?.() } catch (error) { throw observed(error) }
    },
    assertUnfenced(agentId) {
      const fence = typeof store.admissionBlockerForAgent === 'function'
        ? store.admissionBlockerForAgent(agentId) : store.activeFenceForAgent?.(agentId)
      if (fence !== null && fence !== undefined) {
        throw observed(Object.assign(fencedRejection(fence.handle), store.recoveryDiagnostic?.(fence.handle) ?? {}), agentId)
      }
    },
  }
}
