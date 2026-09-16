import { createOrReconcileJobOp } from '../../../scheduler/src/control.js'

export const POSTDEPLOY_CANARY_AGENT_ID = 'agt_scheduler-postdeploy-canary'
export const POSTDEPLOY_CANARY_MARKER = 'SCHEDULER_POSTDEPLOY_CANARY_OK'
export const postdeployCanaryMessage = (sourceSha) => `SCHEDULER_POSTDEPLOY_CANARY:${sourceSha}`

export async function createRetainedPostdeployCanary(store, { sourceSha, agentId = POSTDEPLOY_CANARY_AGENT_ID, at, nowMs = Date.now() }) {
  if (!/^[0-9a-f]{40}$/.test(sourceSha ?? '') || agentId !== POSTDEPLOY_CANARY_AGENT_ID) throw new TypeError('invalid postdeploy canary identity')
  const atMs = Date.parse(at)
  if (!Number.isFinite(atMs) || atMs <= nowMs || atMs > nowMs + 5 * 60_000) throw new TypeError('postdeploy canary must be due within five minutes')
  return createOrReconcileJobOp(store, {
    name: 'scheduler-postdeploy-side-effect-free-canary', agentId, logicalKey: `scheduler-postdeploy:${sourceSha}`,
    schedule: { kind: 'at', at: new Date(atMs).toISOString() }, payload: { kind: 'agentTurn', message: postdeployCanaryMessage(sourceSha), timeoutSeconds: 120 },
    retry: { auto: false }, delivery: { mode: 'none' }, deleteAfterRun: false,
  }, { nowMs })
}
