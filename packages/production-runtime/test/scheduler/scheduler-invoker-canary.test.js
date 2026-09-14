import test from 'node:test'
import assert from 'node:assert/strict'

import { createObservedSchedulerInvoker } from '../../src/scheduler-invoker.js'
import { POSTDEPLOY_CANARY_AGENT_ID, POSTDEPLOY_CANARY_MARKER, postdeployCanaryMessage } from '../../src/scheduler/deployment-canary-control.js'

test('reserved generation-bound canary is a mechanical no-op and never reaches Router', async () => {
  const sourceSha = 'a'.repeat(40)
  const router = {
    runTurnWithRouteChain: () => assert.fail('Router must not be called'),
    registrySnapshot: () => assert.fail('registry must not be queried'),
  }
  const evidence = []
  const invoke = createObservedSchedulerInvoker({ router, definition: { getAgent: () => assert.fail('definition must not be queried') },
    writeEvidence: (row) => evidence.push(row), runtimeGeneration: sourceSha })
  const result = await invoke({ agentId: POSTDEPLOY_CANARY_AGENT_ID, sessionId: 'session', message: postdeployCanaryMessage(sourceSha) })
  assert.equal(result.status, 'ok')
  assert.equal(result.summary, POSTDEPLOY_CANARY_MARKER)
  assert.deepEqual(result.result, { final_status: 'PASS', counters: { tool_calls: 0, external_effects: 0 }, notes: `SCHEDULER_NATIVE_NOOP:${sourceSha}` })
  assert.deepEqual(result.evidence, { executionClass: 'SCHEDULER_NATIVE_NOOP', sourceSha,
    marker: POSTDEPLOY_CANARY_MARKER, toolCalls: 0, externalEffects: 0 })
  assert.equal(evidence[0].routerProcessPid, null)
})

test('reserved identity with a non-matching generation fails closed through ordinary validation', async () => {
  const router = { runTurnWithRouteChain: () => assert.fail('Router must not be called'), registrySnapshot: () => [] }
  const error = Object.assign(new Error('unknown reserved agent'), { code: 'AGENT_NOT_FOUND' })
  const invoke = createObservedSchedulerInvoker({ router, definition: { getAgent: () => { throw error } }, writeEvidence: () => {}, runtimeGeneration: 'a'.repeat(40) })
  const result = await invoke({ agentId: POSTDEPLOY_CANARY_AGENT_ID, sessionId: 'session', message: postdeployCanaryMessage('b'.repeat(40)) })
  assert.equal(result.status, 'error')
  assert.equal(result.started, false)
})
