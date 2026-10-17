/**
 * @agent-core/workflow-execution/src/fixed-operation/trusted-context.js —
 * the trusted-context predicates for FIXED_OPERATION_V1.
 *
 * Two server-derived facts gate every invocation, and NEITHER may arrive
 * through operation arguments:
 *
 *   1. the trusted CALLER — the broker gateway overwrites agentId /
 *      callerAgentId from the actual Router spawning relationship
 *      (packages/broker/src/gateway.js); a disagreement fails closed exactly
 *      like the scheduler self-service trustedCaller does.
 *   2. the trusted WORKFLOW EXECUTION CONTEXT — the runtime-owned
 *      `workflow_execution` messageOrigin coordinates
 *      ({workflowInstanceId, nodeVisitId, attemptId}) the workflow-execution
 *      engine froze at Run admission, retained on the Router execution
 *      record, proven at the parent-RPC boundary (same exact
 *      current-generation/unsettled discipline as the source-turn proof),
 *      and forwarded by the gateway OUTSIDE the argument bag. Field shapes
 *      mirror the exact-allowlist validators in agent-router (ingress
 *      delivery) and demo-server (session seam).
 *
 * Every predicate ANSWERS instead of throwing: `undefined` is the
 * fail-closed answer and the invocation pipeline turns it into a stable
 * denial code.
 */

export const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
export const ATTEMPT_ID_RE = /^wfeat-[0-9a-f]{24}$/

/**
 * The trusted caller identity, or undefined. Mirrors the self-service rule:
 * the gateway-derived agentId is authoritative; an embedded callerAgentId
 * that disagrees marks a merged/forged context, which fails closed.
 */
export function trustedCallerFrom(context) {
  const agentId = context?.agentId
  if (typeof agentId !== 'string' || agentId === '') return undefined
  if (context?.callerAgentId !== undefined && context.callerAgentId !== agentId) return undefined
  return agentId
}

/**
 * The runtime-bound workflow execution coordinates, or undefined. Exact
 * shape: kind 'workflow_execution' plus the three coordinate fields and
 * nothing else — the same exact-key rule the Router and session seam
 * enforce on the sidecar itself.
 */
export function workflowContextFrom(boundContext) {
  if (boundContext === null || typeof boundContext !== 'object' || Array.isArray(boundContext)) return undefined
  if (boundContext.kind !== 'workflow_execution') return undefined
  const keys = Object.keys(boundContext)
  if (keys.length !== 4
    || !keys.includes('workflowInstanceId') || !keys.includes('nodeVisitId') || !keys.includes('attemptId')) {
    return undefined
  }
  for (const field of ['workflowInstanceId', 'nodeVisitId']) {
    if (typeof boundContext[field] !== 'string' || !UUID_RE.test(boundContext[field])) return undefined
  }
  if (typeof boundContext.attemptId !== 'string' || !ATTEMPT_ID_RE.test(boundContext.attemptId)) return undefined
  return {
    workflowInstanceId: boundContext.workflowInstanceId,
    nodeVisitId: boundContext.nodeVisitId,
    attemptId: boundContext.attemptId,
  }
}
