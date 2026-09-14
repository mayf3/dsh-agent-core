import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { JobStore } from '../../../scheduler/src/store.js'
import { createRetainedPostdeployCanary, POSTDEPLOY_CANARY_MESSAGE } from '../../src/scheduler/deployment-canary-control.js'

test('postdeploy control creates one retained, no-delivery, no-retry canary and replays idempotently', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'scheduler-postdeploy-control-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const store = new JobStore(join(root, 'jobs.json')), nowMs = Date.now(), at = new Date(nowMs + 15_000).toISOString()
  const input = { sourceSha: 'a'.repeat(40), agentId: 'agt_healthcheck-agent', at, nowMs }
  const first = await createRetainedPostdeployCanary(store, input)
  const replay = await createRetainedPostdeployCanary(store, input)
  assert.equal(first.outcome, 'created'); assert.equal(replay.outcome, 'already_applied'); assert.equal(first.job.id, replay.job.id)
  assert.equal(first.job.deleteAfterRun, false); assert.deepEqual(first.job.delivery, { mode: 'none' }); assert.deepEqual(first.job.retry, { auto: false })
  assert.equal(first.job.payload.message, POSTDEPLOY_CANARY_MESSAGE)
})

test('postdeploy control rejects arbitrary identity and non-near-future schedules before store access', async () => {
  const noStore = { mutateDoc: () => assert.fail('store must not be touched') }, nowMs = Date.now()
  await assert.rejects(createRetainedPostdeployCanary(noStore, { sourceSha: 'bad', agentId: 'agt_x', at: new Date(nowMs + 1_000).toISOString(), nowMs }), /invalid/)
  await assert.rejects(createRetainedPostdeployCanary(noStore, { sourceSha: 'a'.repeat(40), agentId: 'agt_x', at: new Date(nowMs + 600_000).toISOString(), nowMs }), /five minutes/)
})
