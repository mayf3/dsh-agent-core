import { createOrReconcileJobOp } from '../../../scheduler/src/control.js'

export const POSTDEPLOY_CANARY_MESSAGE = 'Reply with exactly SCHEDULER_POSTDEPLOY_CANARY_OK. Do not call tools or perform external actions.'

export async function createRetainedPostdeployCanary(store, { sourceSha, agentId, at, nowMs = Date.now() }) {
  if (!/^[0-9a-f]{40}$/.test(sourceSha ?? '') || !/^agt_[a-z0-9_-]+$/.test(agentId ?? '')) throw new TypeError('invalid postdeploy canary identity')
  const atMs = Date.parse(at)
  if (!Number.isFinite(atMs) || atMs <= nowMs || atMs > nowMs + 5 * 60_000) throw new TypeError('postdeploy canary must be due within five minutes')
  return createOrReconcileJobOp(store, {
    name: 'scheduler-postdeploy-side-effect-free-canary', agentId, logicalKey: `scheduler-postdeploy:${sourceSha}`,
    schedule: { kind: 'at', at: new Date(atMs).toISOString() }, payload: { kind: 'agentTurn', message: POSTDEPLOY_CANARY_MESSAGE, timeoutSeconds: 120 },
    retry: { auto: false }, delivery: { mode: 'none' }, deleteAfterRun: false,
  }, { nowMs })
}
