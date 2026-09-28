/**
 * Runtime-owned mapping from the Router's exact turnExecutionId to the trusted
 * workflow_execution provenance that admitted that turn.
 *
 * This is execution context, not workflow business state. It is bounded,
 * process-local, and never accepts workflow coordinates from model arguments.
 */
const MAX_NOTED_TURNS = 256
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const ATTEMPT_ID_RE = /^wfeat-[0-9a-f]{24}$/
const AGENT_ID_RE = /^agt_[A-Za-z0-9_-]+$/

function normalizeProvenance(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const keys = Object.keys(value)
  if (keys.length !== 4
    || value.kind !== 'workflow_execution'
    || !keys.includes('workflowInstanceId')
    || !keys.includes('nodeVisitId')
    || !keys.includes('attemptId')) return undefined
  if (!UUID_RE.test(value.workflowInstanceId ?? '') || !UUID_RE.test(value.nodeVisitId ?? '')) return undefined
  if (!ATTEMPT_ID_RE.test(value.attemptId ?? '')) return undefined
  return Object.freeze({
    kind: 'workflow_execution',
    workflowInstanceId: value.workflowInstanceId.toLowerCase(),
    nodeVisitId: value.nodeVisitId.toLowerCase(),
    attemptId: value.attemptId,
  })
}
function turnIdFromTrustedContext(trustedContext) {
  const nested = trustedContext?.ingressContext?.turnExecutionId
  const legacy = trustedContext?.turnExecutionId
  if (nested !== undefined && legacy !== undefined && nested !== legacy) return undefined
  return nested ?? legacy
}

export function mountWorkflowExecutionContextRuntime({ ctx }) {
  if (ctx === undefined || typeof ctx.provide !== 'function') {
    throw new TypeError('workflow-execution-context-runtime: ctx with provide() is required')
  }

  const byTurn = new Map()

  function noteWorkflowTurn({ turnExecutionId, provenance, agentId, sessionId }) {
    if (typeof turnExecutionId !== 'string' || turnExecutionId === '') {
      return { ok: false, code: 'invalid_turn' }
    }
    const workflow = normalizeProvenance(provenance)
    if (workflow === undefined) return { ok: false, code: 'missing_trusted_context' }
    if (agentId !== undefined && (typeof agentId !== 'string' || !AGENT_ID_RE.test(agentId))) {
      return { ok: false, code: 'invalid_agent' }
    }
    if (sessionId !== undefined && (typeof sessionId !== 'string' || sessionId === '')) {
      return { ok: false, code: 'invalid_session' }
    }

    if (byTurn.size >= MAX_NOTED_TURNS) byTurn.delete(byTurn.keys().next().value)
    byTurn.set(turnExecutionId, Object.freeze({
      workflow,
      ...(agentId === undefined ? {} : { agentId }),
      ...(sessionId === undefined ? {} : { sessionId }),
      turnExecutionId,
    }))
    return { ok: true }
  }
  function resolveWorkflowExecutionContext(trustedContext) {
    const turnExecutionId = turnIdFromTrustedContext(trustedContext)
    if (typeof turnExecutionId !== 'string' || turnExecutionId === '') return undefined
    const noted = byTurn.get(turnExecutionId)
    if (noted === undefined) return undefined

    const actualAgentId = trustedContext?.agentId
    if (noted.agentId !== undefined && noted.agentId !== actualAgentId) return undefined

    return noted
  }

  function resolveWorkflowProvenance(trustedContext) {
    return resolveWorkflowExecutionContext(trustedContext)?.workflow
  }

  const access = Object.freeze({
    noteWorkflowTurn,
    resolveWorkflowExecutionContext,
    resolveWorkflowProvenance,
  })
  ctx.provide('workflowExecutionContextAccess', access)
  return access
}
