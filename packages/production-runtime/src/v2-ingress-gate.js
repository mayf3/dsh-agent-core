/**
 * @agent-core/production-runtime/src/v2-ingress-gate.js — the V2 Feishu
 * ingress gate wiring (AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC §4.5/§5.5,
 * accepted).
 *
 * FEISHU_V2_INGRESS_MODE = PREBOUND_ONLY. This is PRODUCT wiring at the
 * composition layer — NOT Router logic. The Router stays fully generic (no
 * "if Feishu" / "if normal path" branch exists or is added there); this gate
 * uses ONLY the Router service's already-exposed generic READ APIs:
 *
 *   router.channelConversationId('feishu', conversationId)  # id format owner
 *   router.getBinding(ccId)                                 # row or undefined
 *
 * Verdicts (fail closed in every uncertain direction):
 *
 *   known/pre-bound conversation whose binding has the V2 primary-workspace
 *   shape (workspace null/absent -> Default Workspace Rule =
 *   resolveWorkspace(agentId), or an explicit workspace that RESOLVES to the
 *   same primary path)  -> { allowed: true }
 *
 *   unknown/unbound conversation (no Binding row)
 *     -> { allowed: false, reason: 'unbound' }
 *     the connector then never calls onEvent, so resolveChannelConversation
 *     never runs -> NO default Binding is created and the conversation never
 *     enters the default Agent / its main (AUTOMATIC_AGENT_BIRTH stays
 *     out of scope; the Router's generic first-contact mechanism itself is
 *     untouched and remains available to other entries).
 *
 *   pre-bound row with a NON-PRIMARY Binding.workspace (the transitional p2p
 *     compatibility state, e.g. agt_stock_agent + feishu-oc_... )
 *     -> { allowed: false, reason: 'non_primary_workspace' }
 *     TRANSITIONAL_COMPATIBILITY_STATE: preserved on disk, never rewritten by
 *     this path, and blocked from the V2 normal production path
 *     (V2_NORMAL_PATH_REQUIRES_PRIMARY_WORKSPACE = YES).
 *
 * TOCTOU safety direction: the gate and the Router's resolve read the SAME
 * in-process durable Binding store synchronously, and Bindings are only ever
 * created (never deleted), so a gate error can only UNDER-admit — never
 * over-admit.
 */

/** The frozen V2 transitional ingress mode (spec §4.5). */
export const V2_INGRESS_MODE = 'PREBOUND_ONLY'

/** The binding namespace of the Feishu entry (agent-router is the id owner;
 *  'feishu' is the only namespace this gate is wired for). */
export const V2_INGRESS_CHANNEL = 'feishu'

/**
 * Build the pre-bound ingress gate predicate.
 *
 * @param {object} p
 * @param {object} p.router - the agentRouter service (getBinding +
 *   channelConversationId only).
 * @param {object} p.workspaceBootstrap - the workspaceBootstrap service
 *   (resolveWorkspace / resolveWorkspacePath; the existing single owner of
 *   the id -> path derivation).
 * @param {object} [p.log] - optional `{ warn(...) }` logger.
 * @returns {Function} `async (ingress) -> { allowed, reason?, channelConversationId }`
 *   — the shape the feishu-connector pipeline consumes.
 */
export function makeV2PreboundIngressGate({ router, workspaceBootstrap, log }) {
  if (router === undefined || typeof router.getBinding !== 'function'
      || typeof router.channelConversationId !== 'function') {
    throw new TypeError('v2-ingress-gate: router service must expose getBinding + channelConversationId')
  }
  if (workspaceBootstrap === undefined || typeof workspaceBootstrap.resolveWorkspace !== 'function'
      || typeof workspaceBootstrap.resolveWorkspacePath !== 'function') {
    throw new TypeError('v2-ingress-gate: workspaceBootstrap service must expose resolveWorkspace + resolveWorkspacePath')
  }
  return async function v2PreboundIngressGate(ingress) {
    const conversationId = ingress?.conversationId
    const ccId = router.channelConversationId(V2_INGRESS_CHANNEL, conversationId)
    const binding = router.getBinding(ccId)

    if (binding === undefined) {
      log?.warn?.(`[v2-ingress-gate] unbound conversation ${ccId} -> FAIL CLOSED (no default binding created)`)
      return { allowed: false, reason: 'unbound', channelConversationId: ccId }
    }

    if (binding.workspace !== null && binding.workspace !== undefined) {
      const primaryPath = workspaceBootstrap.resolveWorkspace(binding.activeAgentId)
      const boundPath = workspaceBootstrap.resolveWorkspacePath(binding.workspace)
      if (boundPath !== primaryPath) {
        log?.warn?.(`[v2-ingress-gate] ${ccId} carries a non-primary Binding.workspace (${binding.workspace}) -> transitional compatibility state, blocked from the V2 normal path`)
        return { allowed: false, reason: 'non_primary_workspace', channelConversationId: ccId }
      }
    }

    return { allowed: true, reason: 'prebound', channelConversationId: ccId }
  }
}

/**
 * Wire the gate onto a mounted feishu connector handle
 * (`feishu.setIngressGate`). Composition-layer glue only: the connector stays
 * a pure channel and the Router stays generic.
 *
 * @param {object|undefined} feishu - the feishu connector handle (undefined
 *   when the channel is not mounted — honest offline).
 * @param {object} router - the agentRouter service.
 * @param {object} workspaceBootstrap - the workspaceBootstrap service.
 * @param {object} [log] - optional logger.
 * @returns {boolean} whether the gate was wired.
 */
export function wireV2IngressGate(feishu, router, workspaceBootstrap, log) {
  if (feishu === undefined || typeof feishu.setIngressGate !== 'function') return false
  feishu.setIngressGate(makeV2PreboundIngressGate({ router, workspaceBootstrap, log }))
  return true
}
