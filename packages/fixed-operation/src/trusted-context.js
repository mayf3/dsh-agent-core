import { FixedOperationError } from './errors.js'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const ATTEMPT_ID_RE = /^wfeat-[0-9a-f]{24}$/

/**
 * Trusted workflow execution context — the runtime-owned provenance sidecar
 * minted by the workflow-execution engine
 * (packages/workflow-execution/src/engine.js provenanceFor) and validated
 * with the exact rules of packages/agent-router/src/ingress-delivery.js
 * validateMessageOrigin: exactly { kind, workflowInstanceId, nodeVisitId,
 * attemptId }, UUID coordinates, ledger-minted wfeat-* attempt id. This
 * context is NEVER caller/model input; every fixed-operation invocation must
 * bind one or it fails closed. Returns a frozen copy; any deviation throws
 * missing_trusted_context.
 */
export function requireWorkflowTrustedContext(trustedContext) {
  if (trustedContext === undefined || trustedContext === null
    || typeof trustedContext !== 'object' || Array.isArray(trustedContext)) {
    throw new FixedOperationError('missing_trusted_context', 'trusted workflow execution context must be an object')
  }
  const keys = Object.keys(trustedContext)
  if (keys.length !== 4
    || !keys.includes('kind')
    || !keys.includes('workflowInstanceId')
    || !keys.includes('nodeVisitId')
    || !keys.includes('attemptId')
    || trustedContext.kind !== 'workflow_execution') {
    throw new FixedOperationError('missing_trusted_context', 'trusted workflow execution context must be exactly { kind: "workflow_execution", workflowInstanceId, nodeVisitId, attemptId }')
  }
  for (const field of ['workflowInstanceId', 'nodeVisitId']) {
    if (typeof trustedContext[field] !== 'string' || !UUID_RE.test(trustedContext[field])) {
      throw new FixedOperationError('missing_trusted_context', `trusted context ${field} must be a UUID string`)
    }
  }
  if (typeof trustedContext.attemptId !== 'string' || !ATTEMPT_ID_RE.test(trustedContext.attemptId)) {
    throw new FixedOperationError('missing_trusted_context', 'trusted context attemptId must be a wfeat-* ledger attempt id')
  }
  return Object.freeze({
    kind: 'workflow_execution',
    workflowInstanceId: trustedContext.workflowInstanceId,
    nodeVisitId: trustedContext.nodeVisitId,
    attemptId: trustedContext.attemptId,
  })
}
