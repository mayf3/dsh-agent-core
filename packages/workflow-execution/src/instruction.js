/**
 * @agent-core/workflow-execution/src/instruction.js — the execution prompt
 * (WORKFLOW_AGENT_EXECUTION_V1). Pure: deterministic text from explicit ids.
 *
 * The message is the ONLY thing the target agent receives; provenance also
 * rides the trusted messageOrigin sidecar (never model input). The text
 * carries the exact coordinates and the working rules — including the
 * special semantics that acknowledgments are not facts and that a successful
 * workflow_execute.transition receipt is the only business commitment.
 */

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const ATTEMPT_ID_RE = /^wfeat-[0-9a-f]{24}$/

/**
 * Build the deterministic execution instruction for one attempt.
 * @param {object} input
 * @param {string} input.workflowInstanceId
 * @param {string} input.nodeVisitId
 * @param {string} input.dispatchIntentId
 * @param {string} input.attemptId - wfeat-* id (ledger minted).
 * @returns {string}
 */
export function buildExecutionInstruction({ workflowInstanceId, nodeVisitId, dispatchIntentId, attemptId }) {
  for (const [name, value] of Object.entries({ workflowInstanceId, nodeVisitId, dispatchIntentId })) {
    if (typeof value !== 'string' || !UUID_RE.test(value)) {
      throw new TypeError(`workflow-execution: buildExecutionInstruction ${name} must be a UUID string`)
    }
  }
  if (typeof attemptId !== 'string' || !ATTEMPT_ID_RE.test(attemptId)) {
    throw new TypeError('workflow-execution: buildExecutionInstruction attemptId must be a wfeat-* ledger id')
  }
  return [
    `[workflow-execution attempt ${attemptId}]`,
    `你有一个到期的 Workflow 节点工作：workflowInstanceId=${workflowInstanceId} nodeVisitId=${nodeVisitId} (dispatchIntentId=${dispatchIntentId})。`,
    '执行要求：',
    `1. 用你自己的 Principal 通过 workflow_instance_detail 读取该实例（workflowInstanceId=${workflowInstanceId}），确认 current_node_visit_id === ${nodeVisitId}，并读取节点要求与 outgoing_transitions。`,
    '2. 以 current_visit 的节点要求完成实际工作（需要上下文就先读 submission 历史/上下文）。',
    '3. 用 workflow_execute.transition 正式提交：transitionDefinitionId 取对应的 outgoing transition，expectedWorkflowStateVersion 取第 1 步读到的 workflowStateVersion，提交成功回执是唯一交账事实。',
    '4. 「收到」「完成了」这类回复不构成开始或完成事实；只有 transition 成功回执算提交。若实际无法完成（缺权限/缺信息/被阻塞），不要伪造提交，走现有 Workflow Assistance（assistance case），不要静默结束。',
    '5. 若提交遇到 workflow_state_version_conflict，重新读取实例后再试一次；除此之外不要反复重试提交。',
  ].join('\n')
}
