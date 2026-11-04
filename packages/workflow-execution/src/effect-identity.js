/** Stable external-effect identity: unlike attemptId, it survives a safe generation re-entry. */
export function workflowEffectId({ workflowInstanceId, nodeVisitId, operation = 'dispatch' }) {
  for (const [name, value] of Object.entries({ workflowInstanceId, nodeVisitId, operation })) {
    if (typeof value !== 'string' || value === '') throw new TypeError(`workflow-effect: ${name} is required`)
  }
  return `workflow-effect:${workflowInstanceId.toLowerCase()}:${nodeVisitId.toLowerCase()}:${operation}`
}
