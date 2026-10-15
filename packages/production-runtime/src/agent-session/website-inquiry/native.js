import { readBoundMainMetadata } from './main-metadata.js'
import { recoverNativeProjection } from './projection.js'
import { readCustodyProjection } from '../../../../demo-server/src/website-custody.js'

/** Same Router and original reconciliation observer; no new timer/worker. */
export function createWebsiteNative({ router, workspaceBootstrap }) {
  const pending = new Map()
  const recover = record => {
    const carrier = { namespace: 'website-human-inquiry-v1', human_principal_id: record.human,
      communication_scope_id: record.shell.communication_scope_id, request_id: record.shell.request_id,
      payload_digest: record.shell.payload_digest, site_owner_binding_version: record.bindingVersion }
    const retained = readCustodyProjection(workspaceBootstrap.resolveDshHome(record.shell.trace.agent_id), carrier)
    if (retained.status !== 'pending' || record.shell.delivery_status !== 'DELIVERED') return retained
    try { return recoverNativeProjection(workspaceBootstrap, record) } catch { return retained }
  }
  const off = router.onTurnReconciled(() => {
    for (const [key, operation] of pending) {
      try {
        const proof = recover(operation.record)
        if (proof.status === 'completed' && proof.complete) {
          operation.settle(proof)
          pending.delete(key)
        }
      } catch { /* retained source remains repairable via the same RID read */ }
    }
  })
  return {
    metadata: agentId => readBoundMainMetadata(workspaceBootstrap, agentId),
    custodyReady: () => typeof off === 'function' && typeof router.admitWebsiteInquiry === 'function',
    recover,
    async admit(operation) {
      pending.set(operation.carrier.payload_digest, operation)
      const receipt = await router.admitWebsiteInquiry({ agentId: operation.record.shell.trace.agent_id,
        message: operation.record.message, carrier: operation.carrier, recheck: operation.recheck,
        map: async coordinate => {
          const metadata = readBoundMainMetadata(workspaceBootstrap, coordinate.agentId)
          if (metadata.state !== 'exists') throw new Error('website main metadata unavailable')
          const oldGeneration = operation.record.shell.trace.session_generation
          if (oldGeneration !== null && oldGeneration !== metadata.generation) throw new Error('website generation changed')
          operation.map({ ...coordinate, generation: metadata.generation })
        } })
      if (receipt.accepted !== true) throw new Error('website native receipt unavailable')
      operation.receipt(receipt)
      // Terminal can arrive before receipt; observe retained source once here
      // as well as through the original observer. No time-based polling.
      let proof
      try { proof = recover(operation.record) } catch { return }
      if (proof.status === 'completed' && proof.complete) {
        operation.settle(proof)
        pending.delete(operation.carrier.payload_digest)
      }
    },
    dispose: () => off?.(),
  }
}
