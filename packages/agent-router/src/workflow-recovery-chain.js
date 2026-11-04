/** Validate the evidence chain used to re-wake the original workflow visit. */
export function buildWorkflowRecoveryKick(receipt) {
  const required = ['turnExecutionId', 'workflowInstanceId', 'nodeVisitId', 'workflowStateVersion', 'assigneePrincipalId']
  if (receipt === null || typeof receipt !== 'object' || required.some(key => receipt[key] === undefined)) {
    throw Object.assign(new TypeError('turn-to-workflow recovery receipt is incomplete'), { code: 'WORKFLOW_RECOVERY_EVIDENCE_INCOMPLETE' })
  }
  if (!Number.isSafeInteger(receipt.workflowStateVersion) || receipt.workflowStateVersion < 1) {
    throw Object.assign(new TypeError('workflowStateVersion must be a positive integer'), { code: 'WORKFLOW_RECOVERY_VERSION_INVALID' })
  }
  return {
    kind: 'WORKFLOW_EXECUTION_KICK',
    cause: 'AGENT_PROCESS_RECOVERY',
    turnExecutionId: receipt.turnExecutionId,
    workflowInstanceId: receipt.workflowInstanceId,
    nodeVisitId: receipt.nodeVisitId,
    workflowStateVersion: receipt.workflowStateVersion,
    assigneePrincipalId: receipt.assigneePrincipalId,
  }
}
