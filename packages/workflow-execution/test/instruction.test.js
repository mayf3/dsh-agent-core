/**
 * WORKFLOW_AGENT_EXECUTION_V1 — instruction builder tests.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildExecutionInstruction } from '../src/instruction.js'

const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const ATTEMPT = `wfeat-${'c'.repeat(24)}`

test('instruction is deterministic and carries the exact coordinates', () => {
  const input = { workflowInstanceId: INSTANCE, nodeVisitId: VISIT, dispatchIntentId: INTENT, attemptId: ATTEMPT }
  const a = buildExecutionInstruction(input)
  const b = buildExecutionInstruction(input)
  assert.equal(a, b, 'same attempt => byte-identical instruction')
  for (const id of [INSTANCE, VISIT, INTENT, ATTEMPT]) {
    assert.ok(a.includes(id), `instruction carries ${id}`)
  }
})

test('instruction states the special semantics (acks are not facts; transition receipt is the commitment)', () => {
  const text = buildExecutionInstruction({ workflowInstanceId: INSTANCE, nodeVisitId: VISIT, dispatchIntentId: INTENT, attemptId: ATTEMPT })
  assert.match(text, /workflow_instance_detail/)
  assert.match(text, /workflow_execute\.transition/)
  assert.match(text, /expectedWorkflowStateVersion/)
  assert.match(text, /收到」「完成了/, 'acknowledgments are explicitly called out as non-facts')
  assert.match(text, /Assistance/, 'blocked work routes to the existing Assistance surface')
  assert.doesNotMatch(text, /secret|password|Bearer|token/i, 'no credential material in prompts')
})

test('instruction rejects malformed ids (fail loud, never prompt with garbage coordinates)', () => {
  const bad = [
    { workflowInstanceId: 'nope', nodeVisitId: VISIT, dispatchIntentId: INTENT, attemptId: ATTEMPT },
    { workflowInstanceId: INSTANCE, nodeVisitId: VISIT, dispatchIntentId: INTENT, attemptId: 'bogus' },
    {},
  ]
  for (const input of bad) {
    assert.throws(() => buildExecutionInstruction(input), TypeError)
  }
})
