import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  workflowAssistanceActionManifest,
  workflowAssistanceReadManifest,
} from '../src/capabilities/workflow-assistance.js'
import { workflowExecutionEscalationManifest } from '../src/capabilities/workflow.js'
import { DEFAULT_MANIFESTS } from '../src/index.js'
import { assertValidManifest } from '../src/mapping.js'

test('Domain Owner assistance read/action are split by least-privilege scope', () => {
  const read = assertValidManifest(workflowAssistanceReadManifest)
  const action = assertValidManifest(workflowAssistanceActionManifest)

  assert.deepEqual(read.requiredScopes, ['workflow.read'])
  assert.deepEqual(action.requiredScopes, ['workflow.execute'])
  assert.deepEqual(read.operations.map((op) => op.name), ['owner_inbox', 'detail'])
  assert.deepEqual(action.operations.map((op) => op.name), ['resolve', 'escalate_to_human'])
  assert.equal(read.operations[0].http.path, '/internal/v1/assistance-cases/owner-inbox')
  assert.equal(read.operations[1].http.path, '/internal/v1/assistance-cases/{assistanceCaseId}')
})

test('Domain Owner assistance actions reuse authoritative svc endpoints and idempotency', () => {
  const action = assertValidManifest(workflowAssistanceActionManifest)
  const resolve = action.operations.find((op) => op.name === 'resolve')
  const escalate = action.operations.find((op) => op.name === 'escalate_to_human')

  assert.equal(resolve.http.method, 'POST')
  assert.equal(resolve.http.path, '/internal/v1/assistance-cases/{assistanceCaseId}/resolve')
  assert.equal(resolve.http.idempotencyKey, true)
  assert.equal(escalate.http.path, '/internal/v1/assistance-cases/{assistanceCaseId}/escalate-to-human')
  assert.equal(escalate.http.idempotencyKey, true)

  for (const op of [resolve, escalate]) {
    const json = JSON.stringify(op.arguments)
    for (const forbidden of ['principalId', 'domainId', 'agentId', 'scriptPath', 'shell', 'credential']) {
      assert.equal(json.includes(forbidden), false, 'authority/escape field must not be model input: ' + forbidden)
    }
  }
})

test('assistance capabilities are part of the default broker surface exactly once', () => {
  const ids = DEFAULT_MANIFESTS.map((manifest) => manifest.id)
  assert.equal(ids.filter((id) => id === 'workflow_assistance_read').length, 1)
  assert.equal(ids.filter((id) => id === 'workflow_assistance_action').length, 1)
})

test('system execution policy now opens OWNER_PENDING instead of auto-human escalation', () => {
  const manifest = assertValidManifest(workflowExecutionEscalationManifest)
  assert.match(manifest.description, /OWNER_PENDING/)
  assert.doesNotMatch(manifest.description, /created\/escalated/)
  assert.match(manifest.operations[0].description, /OWNER_PENDING/)
})
