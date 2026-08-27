/**
 * @agent-core/agent-router/src/parent-rpc-relay.js — the parent-RPC relay
 * the Router installs on every per-agent process (extracted from the former
 * src/index.js startup wiring in the PR #42 structure refactor — no
 * semantic change).
 *
 * A per-agent process asks the Control Plane to run a Router domain
 * operation (switch) or a trusted Broker capability call (broker). The DSH
 * tool itself owns no policy — it forwards the request over the
 * demo-server parent-RPC channel; every decision happens here in the
 * Router.
 */

/** The tool method name per-agent processes use over the parent-RPC relay. */
export const SWITCH_RPC_METHOD = 'agent-core/switchAgent'

/**
 * The parent-RPC method for trusted Broker capability calls (relay ->
 * gateway). The child sends ONLY { capabilityId, operation, args }; the
 * caller identity is decided by the Router from the actual proc.agentId.
 * Kept in sync with packages/broker/src/relay.js (BROKER_RPC_METHOD).
 */
export const BROKER_RPC_METHOD = 'agent-core/broker'

/**
 * Create the per-process parent-RPC handler bound to one agent slot.
 * @param {object} deps
 * @param {string} deps.agentId - the ACTUAL identity of the owning process
 *   (the trusted spawning relationship — never anything the child says).
 * @param {object} deps.log - structured logger.
 * @param {function} deps.getProc - () => the wired process (read lazily so
 *   the handler can be installed on the proc it dispatches for).
 * @param {function} deps.getBrokerGateway - () => broker gateway service
 *   (ctx.get('brokerGateway'), resolved lazily per request).
 * @param {function} deps.switchAgent - the unified switch domain operation
 *   (binding-resolution).
 */
export function createParentRpcHandler({ agentId, log, getProc, getBrokerGateway, switchAgent }) {
  return async (method, params) => {
    if (method === BROKER_RPC_METHOD) {
      // TRUSTED CREDENTIAL BROKER: the caller identity is THIS proc's
      // actual agentId (the trusted spawning relationship) — never
      // anything the child says. Forged self-reported fields are ignored.
      const selfReported = [
        'agentId', 'callerAgentId', 'principalId', 'clientId', 'scope', 'audience', 'authorization',
        'processGeneration', 'turnExecutionId', 'channelNamespace', 'channelConversationId',
        'feishuChatId', 'feishuConversationId', 'feishuMessageId',
        'ingressContext', 'activeIngressContext',
      ].filter((field) => params?.[field] !== undefined)
      if (selfReported.length > 0) {
        log.log(`[broker] agent ${agentId}: IGNORING child-supplied identity fields: ${selfReported.join(', ')}`)
      }
      const proc = getProc()
      const gateway = getBrokerGateway()
      if (gateway === undefined || typeof gateway.execute !== 'function') {
        return {
          ok: true,
          result: { ok: false, error: { code: 'invalid_arguments', detail: 'broker gateway unavailable in the control plane' } },
        }
      }
      log.log(`[broker] execute as agent ${agentId} (capability ${params?.capabilityId})`)
      // Transport envelope {ok:true, result:<invoke shape>}: the child's
      // relay unwraps it; failures stay STRUCTURED (the parent-RPC failure
      // channel only carries a message string, so the business envelope is
      // always delivered inside the success envelope).
      return {
        ok: true,
        result: await gateway.execute(
          { capabilityId: params?.capabilityId, operation: params?.operation, args: params?.args },
          {
            agentId, // ACTUAL identity — decided here, never from params
            ingressContext: proc.activeIngressContext,
          },
        ),
      }
    }
    if (method !== SWITCH_RPC_METHOD) {
      throw new Error(`agent-router: unknown parent-RPC method ${method}`)
    }
    const proc = getProc()
    if (proc.activeBindingContext === undefined) {
      throw new Error('agent-router: no active binding context for this process (switch tool called outside a routed turn)')
    }
    return switchAgent(proc.activeBindingContext, params?.targetAgentId, {
      targetSessionId: params?.targetSessionId,
      workspace: params?.workspace,
    })
  }
}
