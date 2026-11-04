import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWorkflowRecoveryKick } from '../src/workflow-recovery-chain.js'

test('recovery kick preserves turn and workflow visit CAS identity', () => {
  const kick = buildWorkflowRecoveryKick({ turnExecutionId: 'turn-1', workflowInstanceId: 'wf-1', nodeVisitId: 'visit-1', workflowStateVersion: 7, assigneePrincipalId: 'principal-1' })
  assert.deepEqual(kick, { kind: 'WORKFLOW_EXECUTION_KICK', cause: 'AGENT_PROCESS_RECOVERY', turnExecutionId: 'turn-1', workflowInstanceId: 'wf-1', nodeVisitId: 'visit-1', workflowStateVersion: 7, assigneePrincipalId: 'principal-1' })
})

test('incomplete recovery chain fails closed', () => {
  assert.throws(() => buildWorkflowRecoveryKick({ turnExecutionId: 'turn-1' }), error => error.code === 'WORKFLOW_RECOVERY_EVIDENCE_INCOMPLETE')
})
