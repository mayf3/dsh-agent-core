import { validateWebsiteAdmission } from '../../demo-server/src/website-admission.js'
import { fencedRejection } from './process/state-machine.js'

/** Separate trusted website entry; Delivery V0/ASM/channel shapes unchanged.
 * The actual prompt still goes through the original route chain and the
 * AgentProcess unified FIFO/fence. Runtime-owned callbacks never reach a tool.
 */
export function createWebsiteInquiryAdmission({ routeChain, reconciliationStore, workspaceBootstrap, definition, store }) {
  return async function admitWebsiteInquiry({ agentId, message, carrier, recheck, map }) {
    const verified = validateWebsiteAdmission(carrier)
    if (typeof recheck !== 'function' || typeof map !== 'function' || typeof message !== 'string') throw new TypeError('website admission unavailable')
    reconciliationStore.assertBusinessAdmissionReady?.()
    const agent = definition.getAgent(agentId)
    if (!agent || agent.id !== agentId || agent.disabled === true) throw new Error('website target unavailable')
    const fence = reconciliationStore.admissionBlockerForAgent?.(agentId) ?? reconciliationStore.activeFenceForAgent?.(agentId)
    if (fence) throw fencedRejection(fence.handle)
    reconciliationStore.assertMintCapacity(agentId)
    const admission = () => routeChain.admitWithRouteChain(agentId, { sessionId: 'main', message,
      opts: { cwd: workspaceBootstrap.resolveWorkspace(agentId),
        callerCorrelation: { requestId: `whi:${verified.payload_digest}` },
        websiteControl: Object.freeze({ carrier: verified, recheck, map }) } })
    // Hold the original BindingStore mutation queue through the real receipt.
    // This adds no binding mutation/persist and uses the same serialization
    // chain as switchAgent and every Binding writer.
    const pending = store.queue.then(admission)
    store.queue = pending.then(() => undefined, () => undefined)
    return pending
  }
}
/** Child cannot choose RID/Agent: match the parent execution-owned carrier. */
export async function bindWebsiteNativeMessage(proc, params, rpcMeta) {
  const execution = proc?.executions?.get(rpcMeta?.turnExecutionId)
  const control = execution?.websiteControl
  if (!control || execution.settled || execution.sessionId !== 'main' || execution.phase !== 'prompt_sending'
    || JSON.stringify(validateWebsiteAdmission(params?.websiteAdmission)) !== JSON.stringify(control.carrier)
    || typeof params.messageId !== 'string' || !params.messageId) throw new Error('website native mapping denied')
  await control.map({ messageId: params.messageId, agentId: proc.agentId })
  return { mapped: true }
}

/** Website diagnostics are request-digest/enums only. Original journal stays
 * the existing Router authority, and other admission logs remain unchanged.
 */
export function websiteRouteLog(entry, control) {
  return { kind: entry.kind, request_digest: control.carrier.payload_digest,
    attempt_index: entry.attemptIndex, failure_class: entry.failureClass,
    admission_proven: entry.admissionProven, attempt_outcome: entry.attemptOutcome,
    final_outcome: entry.finalOutcome, total_attempts: entry.totalRouteAttempts }
}
