import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { executeR28Recovery, R28_STATES } from '../src/r28-recovery-state-machine.js'

test('R28 isolated E2E: real child exit through workflow terminal continuation', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })))
  child.kill('SIGTERM')
  const exit = await exited
  assert.equal(exit.signal, 'SIGTERM')

  const states = []; const escalations = []; let recovered = false
  const result = await executeR28Recovery({
    agentId: 'agt_fixture', generation: 23,
    workflow: { workflowInstanceId: 'wf-1', nodeVisitId: 'visit-1', workflowStateVersion: 7, assigneePrincipalId: 'p-1' },
    deps: {
      detect: async () => true,
      terminationEvidence: async input => { states.push('termination-evidence'); return { ...input, childRealExit: true, liveOwnership: false, registryCasToken: 'cas-23' } },
      recover: async input => { states.push('recover'); recovered = input.registryCasToken === 'cas-23'; return { recovered, generation: 23, receipt: 'recovery-1' } },
      escalate: async event => escalations.push(event),
      rewakeWorkflow: async input => { states.push('rewake'); return { workflowInstanceId: input.workflowInstanceId, nodeVisitId: input.nodeVisitId, workflowStateVersion: 8, newKickId: 'kick-1' } },
      verify: async () => { states.push('verify'); return { newTurnId: 'turn-2', workflowEventId: 'event-2', workflowStateVersion: 8 } },
      continueWorkflow: async () => { states.push('continue'); return { terminal: true, outcome: 'completed' } },
    },
  })
  states.push(...result.history.map(entry => entry.state))
  assert.deepEqual(result.outcome, 'TERMINAL')
  assert.equal(recovered, true)
  assert.deepEqual(escalations, [])
  assert.ok(R28_STATES.every(state => result.history.some(entry => entry.state === state)))
  assert.deepEqual(states.slice(0, 5), ['termination-evidence', 'recover', 'rewake', 'verify', 'continue'])
  assert.equal(result.verified.newTurnId, 'turn-2')
  assert.equal(result.verified.workflowEventId, 'event-2')
})

test('R28 E2E negative path escalates when exact termination proof is absent', async () => {
  const escalations = []
  const result = await executeR28Recovery({
    agentId: 'agt_fixture', generation: 23, workflow: {},
    deps: {
      detect: async () => true,
      terminationEvidence: async () => ({ agentId: 'agt_fixture', generation: 23, childRealExit: false, liveOwnership: true }),
      recover: async () => { throw new Error('must not recover') },
      escalate: async event => escalations.push(event),
    },
  })
  assert.equal(result.outcome, 'ESCALATED'); assert.equal(escalations[0].target, 'itops/HUMAN_GATE')
})
