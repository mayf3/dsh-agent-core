/**
 * WORKFLOW_AGENT_EXECUTION_V1 — instruction builder tests.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildExecutionInstruction } from '../src/instruction.js'
import { workflowExecuteManifest } from '../../broker/src/capabilities/workflow-execute.js'
import { workflowAssistanceRequestManifest } from '../../broker/src/capabilities/workflow-assistance.js'

const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const ATTEMPT = `wfeat-${'c'.repeat(24)}`

function buildText() {
  return buildExecutionInstruction({ workflowInstanceId: INSTANCE, nodeVisitId: VISIT, dispatchIntentId: INTENT, attemptId: ATTEMPT })
}

function manifestOperation(manifest, name) {
  const operation = manifest.operations.find((candidate) => candidate.name === name)
  assert.ok(operation, `${manifest.id}.${name} must exist in the broker manifest`)
  return operation
}

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

test('transition instruction binds CAS and definition ids to the same fresh detail using live response paths', () => {
  const text = buildText()
  const transition = manifestOperation(workflowExecuteManifest, 'transition')
  for (const field of transition.arguments.required) {
    assert.ok(text.includes(field), `instruction names workflow_execute.transition argument ${field}`)
  }

  assert.ok(text.includes('detail.current_node_visit_id'), 'instruction confirms the current visit from detail')
  assert.ok(text.includes('detail.current_visit'), 'instruction reads node requirements from detail.current_visit')
  assert.ok(text.includes('detail.instance.workflow_state_version'), 'instruction reads CAS version from detail.instance')
  assert.ok(text.includes('detail.outgoing_transitions[].transition_id'), 'instruction names the exact transition id path')
  const transitionInstruction = text.split('\n').find((line) => line.includes('workflow_execute.transition'))
  assert.ok(transitionInstruction, 'transition must have its own instruction')
  assert.match(transitionInstruction, /expectedWorkflowStateVersion[^。\n]{0,80}detail\.instance\.workflow_state_version/)
  assert.match(transitionInstruction, /transitionDefinitionId[^。\n]{0,100}detail\.outgoing_transitions\[\]\.transition_id/)
  assert.match(text, /逐字[^。\n]{0,80}transition_id/, 'transition id must be copied verbatim')
  assert.match(text, /禁止[^。\n]{0,20}旧消息[^。\n]{0,20}手打/, 'ids must not be retyped from old messages')
  assert.ok(text.includes('同一次'), 'ids must come from the same fresh detail')
  assert.doesNotMatch(text, /workflowStateVersion/, 'stale camelCase field must not be taught')
  assert.doesNotMatch(text, /outgoingTransitions/, 'stale camelCase field must not be taught')

  assert.match(text, /workflow_state_version_conflict/)
  assert.match(text, /(重新读取|重读)/)
  assert.match(text, /(再试一次|重试一次)/)
  assert.match(text, /(不要|不得)[^。\n]{0,20}(反复|多次)[^。\n]{0,10}重试/)
  assert.ok(text.includes('不得继续执行旧节点'), 'a changed visit must stop old-node execution')
})

test('broker transition description teaches the same live detail paths and exact-copy rule', () => {
  const description = workflowExecuteManifest.description
  assert.ok(description.includes('detail.current_node_visit_id'))
  assert.ok(description.includes('detail.instance.workflow_state_version'))
  assert.ok(description.includes('detail.outgoing_transitions[].transition_id'))
  assert.doesNotMatch(description, /outgoingTransitions/)
  assert.match(description, /verbatim/i)
})

test('blocked work routes to current-assignee workflow_assistance_request open, never scheduler-only escalation', () => {
  const fullText = buildText()
  const text = fullText.split('\n').find((line) => line.includes('workflow_assistance_request'))
  assert.ok(text, 'Assistance must have its own instruction')
  const open = manifestOperation(workflowAssistanceRequestManifest, 'open')
  assert.ok(text.includes('workflow_assistance_request'))
  assert.match(text, /operation\s*=\s*["']?open/)
  for (const field of open.arguments.required) {
    assert.ok(text.includes(field), `instruction names workflow_assistance_request.open argument ${field}`)
  }
  assert.ok(text.includes('currentNodeVisitId=detail.current_node_visit_id'))
  assert.ok(text.includes('expectedWorkflowStateVersion=同一份新鲜 detail.instance.workflow_state_version'))
  assert.ok(text.includes('request.message'))
  assert.match(text, /自己的 Principal/)
  assert.match(text, /(当前\s*assignee|current\s+assignee)/i)
  assert.match(text, /真实[^。\n]{0,20}阻塞/)
  assert.match(text, /assistanceCaseId[^。\n]{0,40}(成功|回执|才算)/)
  assert.doesNotMatch(fullText, /workflow_execution_escalation/, 'scheduler-only escalation must not be recommended to a business assignee')
})

test('missing Assistance capability is reported with real failure facts, never a fabricated case or fallback write', () => {
  const text = buildText()
  assert.match(text, /(未装载|未加载|不可用|not\s+available)/i)
  assert.match(text, /(真实缺口|能力缺口|缺失)/)
  assert.ok(text.includes('实际错误'))
  assert.match(text, /(不得|不要|禁止)[^。\n]{0,40}(捏造|虚构|编造)[^。\n]{0,20}(case|HUMAN_REQUIRED)/i)
  assert.match(text, /HUMAN_REQUIRED/)
  assert.match(text, /(不得|不要|禁止)[^。\n]{0,40}(其他写入口|替代写入口|fallback)/i)
  assert.match(text, /(不得|不要|禁止)[^。\n]{0,40}(绕过|bypass)/i)
})
