import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Scheduler } from '../../src/scheduler.js'
import { JobStore } from '../../src/store.js'
import { createRecordingDelivery } from '../../src/seams.js'
import { compileIncidents } from '../../src/watchdog/incident-compiler.js'
import { updateIncidentState } from '../../src/watchdog/incident-lifecycle.js'
import { commitIncidentState, loadIncidentState } from '../../src/watchdog/durable-state.js'
import { evaluateRunHealth } from '../../src/watchdog/index.js'

test('T02/T03/T04 one quarantined Job fences only itself, persists, and unrelated admission continues', async () => {
  const root = mkdtempSync(join(tmpdir(), 'same-job-fence-'))
  const clock = { value: 1_000 }
  const calls = []
  const invokeAgent = async (request) => {
    calls.push(request.message)
    request.onStart()
    if (request.message === 'unknown-job') return new Promise(() => {})
    return { status: 'ok', summary: 'unrelated-complete' }
  }
  invokeAgent.assertRunnable = () => true
  const store = new JobStore(join(root, 'jobs.json'), { clock: () => clock.value })
  const scheduler = new Scheduler({
    store,
    invoker: invokeAgent,
    deliver: createRecordingDelivery(),
    nowMs: () => clock.value,
    deadlineSetTimeout: (fn) => { queueMicrotask(fn); return 1 },
    deadlineClearTimeout: () => {},
  })
  await scheduler.start({ autoStart: false, catchup: false })
  const fenced = await scheduler.createJob({
    name: 'fenced', agentId: 'agent-a', enabled: true,
    schedule: { kind: 'every', everyMs: 100, anchorMs: 1_000 },
    payload: { kind: 'agentTurn', message: 'unknown-job' }, delivery: { mode: 'none' },
  })
  const unrelated = await scheduler.createJob({
    name: 'unrelated', agentId: 'agent-b', enabled: true,
    schedule: { kind: 'every', everyMs: 100, anchorMs: 1_000 },
    payload: { kind: 'agentTurn', message: 'unrelated-job' }, delivery: { mode: 'none' },
  })
  clock.value = 1_100
  await scheduler.tick()
  await scheduler.whenIdle()
  await scheduler.load()
  assert.equal(scheduler.isFenced(fenced.id), true)
  assert.equal(scheduler.listOccurrences(unrelated.id)[0].state, 'succeeded')
  const findings = evaluateRunHealth(await store.loadDoc({ force: true }), { nowMs: clock.value })
  const lifecycle = updateIncidentState({}, compileIncidents(findings).incidents, { nowMs: clock.value })
  const incidentPath = join(root, 'incident-state', 'incidents.json')
  commitIncidentState(incidentPath, lifecycle.state, { expectedHash: null })

  await scheduler.stop()
  const restarted = new Scheduler({
    store: new JobStore(join(root, 'jobs.json'), { clock: () => clock.value }),
    invoker: invokeAgent,
    deliver: createRecordingDelivery(),
    nowMs: () => clock.value,
  })
  await restarted.start({ autoStart: false, catchup: false })
  assert.equal(restarted.isFenced(fenced.id), true, 'T04 same-Job fence survives restart')
  assert.equal(Object.values(loadIncidentState(incidentPath).state.incidents).filter((row) => row.jobId === fenced.id).length, 1, 'T04 one root incident survives restart')

  const later = await restarted.createJob({
    name: 'later-unrelated', agentId: 'agent-c', enabled: true,
    schedule: { kind: 'at', at: new Date(3_000).toISOString() },
    payload: { kind: 'agentTurn', message: 'later-unrelated-job' }, delivery: { mode: 'none' },
  })
  clock.value = 3_000
  await restarted.tick()
  await restarted.whenIdle()
  await restarted.load()
  assert.equal(calls.filter((message) => message === 'unknown-job').length, 1)
  assert.equal(calls.filter((message) => message === 'later-unrelated-job').length, 1)
  assert.equal(restarted.listOccurrences(later.id)[0].state, 'succeeded')
  assert.equal(restarted.isFenced(unrelated.id), false)
  await restarted.stop()
})
