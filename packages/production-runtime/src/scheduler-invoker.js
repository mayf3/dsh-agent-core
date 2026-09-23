import { createRouterInvoker } from '../../scheduler-router/src/index.js'
import { attachSchedulerResult } from './scheduler-result.js'
import { POSTDEPLOY_CANARY_AGENT_ID, POSTDEPLOY_CANARY_MARKER, postdeployCanaryMessage } from './scheduler/deployment-canary-control.js'

/** Add production evidence and trusted result ingestion around the Router seam. */
export function createObservedSchedulerInvoker({ router, definition, writeEvidence, runtimeGeneration = process.env.AGENT_CORE_DEPLOYED_SHA }) {
  const rawInvoker = createRouterInvoker(router, { definition })
  const invoker = async (request) => {
    const started = Date.now()
    const isCanary = /^[0-9a-f]{40}$/.test(runtimeGeneration ?? '')
      && request.agentId === POSTDEPLOY_CANARY_AGENT_ID
      && request.message === postdeployCanaryMessage(runtimeGeneration)
    // This reserved identity is mechanically side-effect-free: it never
    // reaches AgentProcess, Router, tools, credentials, or delivery.
    const outcome = isCanary ? {
      status: 'ok', summary: POSTDEPLOY_CANARY_MARKER, sessionId: request.sessionId,
      durationMs: 0, started: true,
      result: { final_status: 'PASS', counters: { tool_calls: 0, external_effects: 0 },
        notes: `SCHEDULER_NATIVE_NOOP:${runtimeGeneration}` },
      evidence: { executionClass: 'SCHEDULER_NATIVE_NOOP', sourceSha: runtimeGeneration,
        marker: POSTDEPLOY_CANARY_MARKER, toolCalls: 0, externalEffects: 0 },
    } : await rawInvoker(request)
    attachSchedulerResult(outcome)
    const proc = isCanary ? null : router.registrySnapshot().find((entry) => entry.agentId === request.agentId)
    writeEvidence({
      kind: 'invocation',
      pid: process.pid,
      agentId: request.agentId,
      sessionId: request.sessionId,
      // CTR-SCT-005 coordinate keys (additive): whatever the request carries,
      // so execution-history can coordinate-match this row to its occurrence.
      occurrenceId: request.occurrenceId ?? null,
      runId: request.runId ?? null,
      jobId: request.jobId ?? null,
      requestId: request.requestId ?? null,
      status: outcome.status,
      summary: outcome.status === 'ok' ? (outcome.summary ?? null) : null,
      error: outcome.status === 'ok' ? null : (outcome.error ?? null),
      reconciliationHandle: outcome.reconciliationHandle ?? null,
      deadlineAtWallMs: outcome.deadlineAtWallMs ?? null,
      evidence: outcome.evidence ?? null,
      durationMs: Date.now() - started,
      routerProcessPid: proc?.pid ?? null,
      routerProcessAlive: proc?.alive ?? null,
    })
    return outcome
  }
  invoker.assertRunnable = (agentId) => agentId === POSTDEPLOY_CANARY_AGENT_ID ? true : rawInvoker.assertRunnable(agentId)
  return invoker
}
