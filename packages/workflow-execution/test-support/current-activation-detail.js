export function completeCurrentActivationDetail(body, { workflowInstanceId, ownerPrincipalId }) {
  if (body === null || typeof body !== 'object' || body.detail === null || typeof body.detail !== 'object') return body
  const detail = body.detail
  const visitId = detail.current_node_visit_id
  return {
    ...body,
    detail: {
      ...detail,
      instance: {
        ...detail.instance,
        workflow_instance_id: detail.instance?.workflow_instance_id ?? workflowInstanceId,
        is_terminal: detail.instance?.is_terminal ?? false,
      },
      current_visit: {
        ...detail.current_visit,
        node_visit_id: detail.current_visit?.node_visit_id ?? visitId,
        workflow_instance_id: detail.current_visit?.workflow_instance_id ?? workflowInstanceId,
        assignee_principal_id: detail.current_visit?.assignee_principal_id ?? ownerPrincipalId,
      },
    },
  }
}
