import { createHash } from 'node:crypto'

export const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
export const AGENT_ID_RE = /^agt_[A-Za-z0-9_-]+$/
export const ATTEMPT_ID_RE = /^wfeat-[0-9a-f]{24}$/

export function attemptIdFor(nodeVisitId, generation = 1) {
  if (typeof nodeVisitId !== 'string' || !UUID_RE.test(nodeVisitId)) {
    throw new TypeError(`workflow-execution: attemptIdFor requires a UUID nodeVisitId (got ${JSON.stringify(nodeVisitId)})`)
  }
  if (!Number.isInteger(generation) || generation < 1) {
    throw new TypeError(`workflow-execution: attemptIdFor requires a positive integer generation (got ${JSON.stringify(generation)})`)
  }
  const base = nodeVisitId.toLowerCase()
  const material = generation === 1 ? base : `${base}#gen${generation}`
  return `wfeat-${createHash('sha256').update(material).digest('hex').slice(0, 24)}`
}

export function validateIntentIds({ dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId }) {
  for (const [name, value] of Object.entries({ dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId })) {
    if (typeof value !== 'string' || !UUID_RE.test(value)) {
      throw new TypeError(`workflow-execution: ${name} must be a UUID string (got ${JSON.stringify(value)})`)
    }
  }
}
