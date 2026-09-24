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
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { mountWorkflowExecutionRuntime } from '../src/workflow-execution-runtime.js'

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
      if (call?.capabilityId === 'workflow_dispatch_intents' && call?.operation === 'list') {
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
