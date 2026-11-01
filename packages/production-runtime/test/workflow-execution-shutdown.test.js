/**
 * DSH_SHUTDOWN_CONTRACT — production-runtime drain propagation regression.
 *
 * The engine's stop() returns a bounded drain promise (packages/workflow-
 * execution/src/engine.js: "Callers that await stop() get a truthful
 * 'nothing is still running' result"). The runtime wrapper returned by
 * mountWorkflowExecutionRuntime is the object compose.stop() awaits BEFORE
 * scheduler.stop() and ctx.disposeAll(), so the wrapper must PRESERVE that
 * wait semantics: while a poll is in flight, workflowExecution.stop() stays
 * pending, and once it resolves no further page is fetched and the ledger is
 * quiescent — nothing may deliver or write after the composition's await
 * moves on.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { mountWorkflowExecutionRuntime } from '../src/workflow-execution-runtime.js'
import { composeProductionRuntime } from '../src/compose.js'
import { createPluginContext } from '../src/context.js'
import { shutdownResultFor } from '../src/shutdown-result.js'
import { AGT_ID, FakeProc, seedRuntime } from './compose-fixture.js'

const silentLog = { log() {}, warn() {}, error() {} }
const POLLER = 'agt_workflow-poller'

async function settledWithin(promise, ms) {
  let settled = false
  const mark = promise.then(() => { settled = true }, () => { settled = true })
  await Promise.race([mark, new Promise((r) => setTimeout(r, ms))])
  return settled
}

test('runtime stop(): the engine drain stays pending while a poll is in flight, and the runtime is quiescent once it resolves', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'prt-wfe-shutdown-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  let releasePage
  const pageParked = new Promise((r) => { releasePage = r })
  let signalInFlight
  const inFlight = new Promise((r) => { signalInFlight = r })
  const fetches = []
  const deliveries = []
  const gateway = {
    execute: async (call) => {
      if (call?.capabilityId === 'workflow_dispatch_intents' && call?.operation === 'list_ready') {
        fetches.push(call)
        signalInFlight()
        await pageParked
        return { ok: true, result: { items: [] } }
      }
      return { ok: false, error: { code: 'instance_detail_failed' } }
    },
  }
  const principalAccess = {
    handlers: {
      agent_resolve_principal: {
        resolve: async () => { throw new Error('no admission must happen in this test') },
      },
    },
  }
  const router = {
    deliver: async (...args) => { deliveries.push(args) },
    getTurnReconciliation: async () => ({ status: 'terminal' }),
  }

  const runtime = mountWorkflowExecutionRuntime({
    ctx: {
      get: (name) => (name === 'brokerGateway' ? gateway : name === 'agentPrincipalResolutionAccess' ? principalAccess : undefined),
    },
    layout: { workflowExecutionDir: join(dir, 'ledger') },
    router,
    log: silentLog,
    config: { pollerAgentId: POLLER },
  })
  assert.equal(runtime.enabled, true)

  // intervalMs 1s: the parked poll must survive until stop() reads the
  // engine's in-flight work — a short interval could fire a no-op guard tick
  // in between (under parallel test load) and that is an ENGINE-side drain
  // attribution gap, not the wrapper propagation this regression pins.
  runtime.start({ intervalMs: 1000 })
  // The single in-flight poll parks inside the due-feed page read — the
  // engine tracks it as its in-flight work.
  await Promise.race([inFlight, new Promise((_, rej) => setTimeout(() => rej(new Error('poll never reached the due feed')), 10000))])

  const stopPromise = runtime.stop()
  assert.equal(typeof stopPromise?.then, 'function',
    'workflowExecution.stop() must return the engine drain promise (not undefined)')
  assert.equal(await settledWithin(stopPromise, 50), false,
    'stop() must stay pending while the in-flight poll has not drained')

  // Release the parked page; the bounded drain may then resolve.
  releasePage()
  await stopPromise

  // Post-drain invariants: nothing may fetch, deliver or write afterwards.
  assert.equal(fetches.length, 1, 'no further due-feed page is fetched once stopped')
  await new Promise((r) => setTimeout(r, 60))
  assert.equal(fetches.length, 1, 'the stopped engine starts no new poll tick')
  assert.deepEqual(deliveries, [], 'no deliverRun may happen after the drain resolved')
  assert.equal(runtime.ledger.snapshot().length, 0, 'the ledger is quiescent — no post-shutdown write')
})

for (const failedStage of ['workflowExecution', 'scheduler']) {
  test(`runtime stop drains the owned worker after ${failedStage} stop rejects`, async (t) => {
    const { layout } = await seedRuntime(t)
    const runtime = await composeProductionRuntime({
      layout, globalRoute: { provider: 'oc-go', model: 'deepseek-v4-flash' },
      productApi: { enabled: false, port: 0 }, notificationIngress: { enabled: false, port: 0 },
      processFactory: (opts) => new FakeProc(opts), log: silentLog,
    })
    const proc = await runtime.router.ensureRunning(AGT_ID)
    const originals = Object.fromEntries(['workflowExecution', 'scheduler'].map(stage => [stage, runtime[stage].stop.bind(runtime[stage])]))
    const failure = new Error(`${failedStage} drain failed`)
    const calls = []
    for (const stage of Object.keys(originals)) runtime[stage].stop = async () => {
      calls.push(stage)
      await originals[stage]()
      if (stage === failedStage) throw failure
    }
    let releaseExit
    const exitGate = new Promise(resolve => { releaseExit = resolve })
    const shutdown = proc.shutdown.bind(proc)
    proc.shutdown = async () => {
      calls.push('worker')
      await exitGate
      return shutdown()
    }
    let settled = false
    const stopped = runtime.stop('SIGTERM').then(
      () => { settled = true; return null }, error => { settled = true; return error },
    )
    try {
      await new Promise(resolve => setImmediate(resolve))
      assert.deepEqual(calls, ['workflowExecution', 'scheduler', 'worker'], 'earlier failure cannot skip owned cleanup')
      assert.equal(settled, false, 'runtime must await worker exit even after an earlier stop error')
      assert.equal(proc.exit, undefined)
      releaseExit()
      const error = await stopped
      assert.ok(error instanceof AggregateError)
      assert.ok(error.errors.includes(failure))
      assert.deepEqual(proc.exit, { code: 0, signal: null })
      assert.equal(shutdownResultFor(error).exitCode, 1, 'drained worker does not turn a failed stop into clean success')
      const end = readFileSync(layout.restartBoundaryLog, 'utf8').trim().split('\n').map(JSON.parse).at(-1)
      assert.equal(end.stopResult, 'stop_failed', 'a finally receipt must expose the failed stop result')
    } finally {
      releaseExit()
      await stopped
      await originals.workflowExecution()
      await originals.scheduler()
      await runtime.ctx.disposeAll().catch(() => {})
    }
  })
}

test('plugin disposal waits every cleanup and propagates all failures', async () => {
  const ctx = createPluginContext()
  const first = new Error('first disposer failed')
  const second = new Error('second disposer failed')
  let release
  const gate = new Promise(resolve => { release = resolve })
  let laterStarted = false
  ctx.effect(() => () => { throw first })
  ctx.effect(() => async () => { laterStarted = true; await gate; throw second })
  let settled = false
  const stopped = ctx.disposeAll().then(
    () => { settled = true; return null }, error => { settled = true; return error },
  )
  assert.equal(laterStarted, true)
  assert.equal(settled, false, 'a failed disposer cannot skip a later pending cleanup')
  release()
  const error = await stopped
  assert.ok(error instanceof AggregateError)
  assert.deepEqual(error.errors, [first, second])
  assert.equal(shutdownResultFor(error).exitCode, 1)
})

test('concurrent plugin disposal callers wait the same owned cleanup', async () => {
  const ctx = createPluginContext()
  let release
  const gate = new Promise(resolve => { release = resolve })
  ctx.effect(() => () => gate)
  const first = ctx.disposeAll()
  const second = ctx.disposeAll()
  let secondSettled = false
  void second.then(() => { secondSettled = true })
  await new Promise(resolve => setImmediate(resolve))
  try {
    assert.equal(secondSettled, false, 'a concurrent stop must not report success while another caller drains')
  } finally {
    release()
    await Promise.all([first, second])
  }
})

test('runtime stop never reports clean success after an owned worker shutdown rejects', async (t) => {
  const { layout } = await seedRuntime(t)
  const runtime = await composeProductionRuntime({
    layout, globalRoute: { provider: 'oc-go', model: 'deepseek-v4-flash' },
    productApi: { enabled: false, port: 0 }, notificationIngress: { enabled: false, port: 0 },
    processFactory: (opts) => new FakeProc(opts), log: silentLog,
  })
  const proc = await runtime.router.ensureRunning(AGT_ID)
  proc.shutdown = () => { throw new Error('controlled worker shutdown refused') }
  let settled = false
  const stopped = runtime.stop('SIGTERM').then(
    () => { settled = true; return null }, error => { settled = true; return error },
  )
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(settled, false, 'shutdown rejection is not an observed child exit')
  proc.exit = { code: 0, signal: null }
  proc.exitResolve(proc.exit)
  const error = await stopped
  assert.ok(error instanceof AggregateError, 'runtime preserves the worker cleanup failure')
  assert.deepEqual(shutdownResultFor(error), {
    evidenceKind: 'stop_failed', exitCode: 1, summary: 'exited with stop failure',
  })
})
