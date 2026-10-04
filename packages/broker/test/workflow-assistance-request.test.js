import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  workflowAssistanceRequestManifest,
} from '../src/capabilities/workflow-assistance.js'
import { DEFAULT_MANIFESTS } from '../src/index.js'
import { assertValidManifest } from '../src/mapping.js'

// PRODUCT #449 (Workflow v5 distribution recovery): the assigned agent's formal
// blocker path. WORKFLOW_AGENT_EXECUTION_V1 instruction rule 4 mandates
// "走现有 Workflow Assistance（assistance case）" when the node cannot be
// completed (missing/empty context inputs like targetPlatforms, missing child
// creation authority); EXECUTION_CONTROL_V1 §4 provides least-privilege
// assistance tools over EXISTING svc-workflow APIs. The requester-side endpoint
// POST /internal/v1/workflow-instances/{id}/assistance-cases (assignee-only,
// server-side CAS + Idempotency-Key) had no broker surface, so a blocked agent
// could only end silently or fabricate a submission.

test('assistance request is a least-privilege assignee surface on the existing svc endpoint', () => {
  const request = assertValidManifest(workflowAssistanceRequestManifest)

  assert.deepEqual(request.requiredScopes, ['workflow.execute'])
  assert.deepEqual(request.operations.map((op) => op.name), ['open'])

  const open = request.operations[0]
  assert.equal(open.http.target, 'svc-workflow')
  assert.equal(open.http.method, 'POST')
  assert.equal(open.http.path, '/internal/v1/workflow-instances/{workflowInstanceId}/assistance-cases')
  assert.deepEqual(open.http.pathParams, ['workflowInstanceId'])
  // The trusted Idempotency-Key seam (DEC-003) — svc request endpoint validates it.
  assert.equal(open.http.idempotencyKey, true)
  assert.deepEqual(open.http.body, ['currentNodeVisitId', 'expectedWorkflowStateVersion', 'request'])

  const json = JSON.stringify(open.arguments)
  for (const forbidden of ['principalId', 'domainId', 'agentId', 'assignee', 'onBehalfOf', 'credential']) {
    assert.equal(json.includes(forbidden), false, 'authority field must not be model input: ' + forbidden)
  }
  // Exact CAS + visit coordinates are required model inputs (read from
  // workflow_instance_detail first — same discipline as transition).
  assert.deepEqual(open.arguments.required, ['workflowInstanceId', 'currentNodeVisitId', 'expectedWorkflowStateVersion', 'request'])
})

test('assistance request declares the assignee-request error family from svc error.rs', () => {
  const request = assertValidManifest(workflowAssistanceRequestManifest)
  const codes = request.errors.map((e) => e.code)
  for (const code of [
    'principal_not_found',
    'principal_disabled',
    'instance_not_found',
    'current_visit_not_found',
    'current_node_visit_mismatch',
    'principal_not_assignee',
    'source_node_terminal',
    'instance_cancelled',
    'instance_archived',
    'workflow_state_version_conflict',
    'assistance_already_open',
    'invalid_assistance_payload',
    'size_limit_exceeded',
    'idempotency_conflict',
    'command_still_processing',
    'internal_consistency_error',
    'service_unavailable',
  ]) {
    assert.ok(codes.includes(code), 'missing declared stable error code: ' + code)
  }
})

test('assistance request is part of the default broker surface exactly once', () => {
  const ids = DEFAULT_MANIFESTS.map((manifest) => manifest.id)
  assert.equal(ids.filter((id) => id === 'workflow_assistance_request').length, 1)
})

test('request payload stays bounded and non-authoritative', () => {
  const request = assertValidManifest(workflowAssistanceRequestManifest)
  const open = request.operations[0]
  const requestArg = open.arguments.properties.request
  assert.equal(requestArg.type, 'object')
  assert.equal(requestArg.additionalProperties, false)
  assert.deepEqual(requestArg.required, ['message'])
  assert.ok(requestArg.properties.message, 'message is the blocker declaration')
  assert.equal(open.arguments.properties.expectedWorkflowStateVersion.minimum, 1)
})
