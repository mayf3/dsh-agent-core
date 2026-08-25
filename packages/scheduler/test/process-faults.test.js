import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { Scheduler } from '../src/scheduler.js'
import { JobStore } from '../src/store.js'
import { normalizeJob } from '../src/job-model.js'
import { createFakeInvoker } from '../src/seams.js'

const root = join(import.meta.dirname, '..', '..', '..')
const schedulerUrl = pathToFileURL(join(root, 'packages/scheduler/src/scheduler.js')).href
const storeUrl = pathToFileURL(join(root, 'packages/scheduler/src/store.js')).href
const cli = join(root, 'scripts/agentcore-cron.mjs')
const deferred = () => {
  let resolve
  const promise = new Promise((yes) => { resolve = yes })
  return { promise, resolve }
}

function waitForOutput(child, marker, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error(`timed out waiting for ${marker}: ${output}`)), timeoutMs)
    child.stdout.on('data', (chunk) => {
      output += chunk
      if (!output.includes(marker)) return
      clearTimeout(timeout)
      resolve(output)
    })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.once('exit', (code, signal) => {
      if (!output.includes(marker)) {
        clearTimeout(timeout)
        reject(new Error(`child exited ${code}/${signal} before ${marker}: ${output}`))
      }
    })
  })
}

test('ACC-007 PROCESS_EXIT_WITHOUT_TURN_ATTRIBUTION: SIGKILL recovers running to unknown without Router replay', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-process-exit-'))
  const file = join(dir, 'jobs.json')
  const now = Date.now()
  const job = normalizeJob({
    id: 'killed-job', name: 'killed job', agentId: 'agent-a',
    schedule: { kind: 'at', at: new Date(now - 1_000).toISOString() },
    payload: { kind: 'agentTurn', message: 'work' }, delivery: { mode: 'none' },
    deleteAfterRun: false,
  }, { nowMs: now - 5_000 })
  const store = new JobStore(file)
  await store.mutateDoc((doc) => { doc.jobs = [job] })

  const childSource = `
    import { Scheduler } from ${JSON.stringify(schedulerUrl)};
    import { JobStore } from ${JSON.stringify(storeUrl)};
    const store = new JobStore(process.argv[1]);
    const invoke = async (request) => { request.onStart(); return new Promise(() => {}); };
    invoke.assertRunnable = () => true;
    const scheduler = new Scheduler({ store, invoker: invoke });
    await scheduler.start({ autoStart: false, catchup: false });
    await scheduler.tick();
    for (;;) {
      const doc = await store.loadDoc({ force: true });
      if (doc.occurrences[0]?.state === 'running') { process.stdout.write('RUNNING\\n'); break; }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    setInterval(() => {}, 1000);
  `
  const child = spawn(process.execPath, ['--input-type=module', '-e', childSource, file], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  })
  await waitForOutput(child, 'RUNNING')
  const exited = new Promise((resolve) => child.once('exit', resolve))
  child.kill('SIGKILL')
  await exited

  const restartInvoker = createFakeInvoker()
  const restarted = new Scheduler({ store: new JobStore(file), invoker: restartInvoker })
  await restarted.start({ autoStart: false, catchup: false })
  const [record] = restarted.listOccurrences(job.id)
  assert.equal(record.state, 'outcome_unknown')
  assert.equal(restarted.isFenced(job.id), true)
  assert.equal(restartInvoker.calls.length, 0)
  await restarted.stop()
})

test('ACC-027 CONCURRENT_CLI_DISABLE_DURING_ADMITTED_OCCURRENCE uses a separate CLI process', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-cli-disable-'))
  const file = join(dir, 'jobs.json')
  const clock = { value: 1_000 }
  const entered = deferred()
  const completion = deferred()
  const invoke = async (request) => {
    request.onStart()
    entered.resolve()
    return completion.promise
  }
  invoke.assertRunnable = () => true
  const scheduler = new Scheduler({
    store: new JobStore(file), invoker: invoke, nowMs: () => clock.value,
  })
  await scheduler.start({ autoStart: false, catchup: false })
  const job = await scheduler.createJob({
    name: 'disable race', agentId: 'agent-a',
    schedule: { kind: 'at', at: new Date(2_000).toISOString() },
    payload: { kind: 'agentTurn', message: 'work' }, delivery: { mode: 'none' },
    deleteAfterRun: false,
  })
  clock.value = 2_000
  await scheduler.tick()
  await entered.promise
  const disabled = spawnSync(process.execPath, [cli, 'disable', job.id, '--store', file], {
    cwd: root, encoding: 'utf8',
  })
  assert.equal(disabled.status, 0, disabled.stderr)
  completion.resolve({ status: 'ok', summary: 'done' })
  await scheduler.whenIdle()
  await scheduler.load()
  assert.equal((await scheduler.getJob(job.id)).enabled, false)
  assert.equal(scheduler.listOccurrences(job.id)[0].state, 'succeeded')
  await scheduler.stop()
})
