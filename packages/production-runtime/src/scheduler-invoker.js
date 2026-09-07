import { createRouterInvoker } from '../../scheduler-router/src/index.js'
import { attachSchedulerResult } from './scheduler-result.js'

/** Add production evidence and trusted result ingestion around the Router seam. */
export function createObservedSchedulerInvoker({ router, definition, writeEvidence }) {
  const rawInvoker = createRouterInvoker(router, { definition })
  const invoker = async (request) => {
    const started = Date.now()
    const outcome = await rawInvoker(request)
    attachSchedulerResult(outcome)
    const proc = router.registrySnapshot().find((entry) => entry.agentId === request.agentId)
    writeEvidence({
      kind: 'invocation',
      pid: process.pid,
      agentId: request.agentId,
      sessionId: request.sessionId,
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
  invoker.assertRunnable = rawInvoker.assertRunnable
  return invoker
}
