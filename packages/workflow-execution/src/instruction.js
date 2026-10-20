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
    `1. 用你自己的 Principal 通过 workflow_instance_detail 读取该实例（workflowInstanceId=${workflowInstanceId}）；读取响应根 detail，确认 detail.current_node_visit_id === ${nodeVisitId}。若不一致，说明该 visit 已不是当前节点：停止执行本指令，不得继续执行旧节点。`,
    '2. 在同一份新读取的 detail 中，按 detail.current_visit 的节点要求完成实际工作（需要上下文就先读 submission 历史/上下文）。',
    '3. 用 workflow_execute.transition 正式提交：transitionDefinitionId 逐字复制同一次新鲜 detail 的 detail.outgoing_transitions[].transition_id（禁止从旧消息手打、修补或重建 UUID）；expectedWorkflowStateVersion 取同一份 detail.instance.workflow_state_version。transition 成功回执是唯一交账事实。',
    '4. 「收到」「完成了」这类回复不构成开始或完成事实；只有 transition 成功回执算提交。',
    `5. 若实际无法完成（缺权限/缺信息/被阻塞），不要伪造提交，也不要静默结束：走现有的 Workflow Assistance，用你自己的 Principal（必须是该 visit 的 current assignee）调用 workflow_assistance_request 的 operation="open"，workflowInstanceId=${workflowInstanceId}，currentNodeVisitId=detail.current_node_visit_id（当前 visit），expectedWorkflowStateVersion=同一份新鲜 detail.instance.workflow_state_version，request.message 写真实阻塞（缺什么、为什么无法完成）。只有返回 assistanceCaseId 的成功回执才算 case 已开启。若 workflow_assistance_request 未加载或调用失败，按真实缺口报告实际错误，不得捏造 case 或 HUMAN_REQUIRED，不得改用其他写入口或绕过权限。`,
    '6. 若提交遇到 workflow_state_version_conflict，重新读取实例后按上述规则再试一次；其他错误不要重复提交或反复重试，也不要自动重试。若重读发现 detail.current_node_visit_id 已变化，不得继续执行旧节点。',
  ].join('\n')
}
