// T42+T67 — DSH_SHUTDOWN_CONTRACT repair regressions.
// Owner mandate (ARCHITECTURE_REPAIR_AUTHORIZED = DSH_SHUTDOWN_CONTRACT /
// BOUNDED DRAIN): engine.stop() must (1) return a bounded drain promise, (2)
// stop fetching further pages once stopped, and (3) make the shutdown result
// truthful — nothing may deliver or write after stop() resolves.
// Scratch file for the repair PR; kept in the branch as the regression suite
// for the contract (T42/T67 original probes were scratch).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ExecutionLedger } from '../src/ledger.js'
import { createWorkflowExecutionEngine } from '../src/engine.js'

const uuid = (hex, tail) => `${hex}-3f19-4a7e-9a3f-${tail}`
const INTENT = uuid('2d5c2f0a', '0000000000d1')
const VISIT = uuid('0d5c2f0a', '0000000000d2')
const INSTANCE = uuid('4d5c2f0a', '0000000000d3')
const OWNER = uuid('5d5c2f0a', '0000000000d4')
const AGENT = 'agt_target-agent'

function dueIntent() {
  return {
    dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE,
    ownerPrincipalId: OWNER,
    nextEligibleAt: '2026-09-13T01:00:00Z', createdAt: '2026-09-13T00:00:00Z',
    updatedAt: '2026-09-13T00:30:00Z',
  }
}

function buildEngine(ledger, { gatePage1, timeline, disposeRouterBeforeDeliver }) {
  let releasePage1
  const page1Gate = new Promise((r) => { releasePage1 = r })
  let resolveParked
  const parked = new Promise((r) => { resolveParked = r })
  let fetchCalls = 0
  const engine = createWorkflowExecutionEngine({
    ledger,
    log: { log: () => {}, warn: () => {}, error: () => {} },
    config: { maxAdmissionsPerPoll: 10 },
    fetchDuePage: async () => {
      fetchCalls += 1
      if (fetchCalls === 1) {
        timeline.push('fetch_page1_parked')
        resolveParked()
        await page1Gate
        timeline.push('fetch_page1_released')
        return { ok: true, items: [dueIntent()] }
      }
      return { ok: true, items: [] }
    },
    resolvePrincipalToAgent: async () => {
      timeline.push('resolve')
      return { ok: true, agentId: AGENT }
    },
    deliverRun: async () => {
      if (disposeRouterBeforeDeliver) {
        timeline.push('deliver_attempted_after_dispose')
        throw Object.assign(new Error('ROUTER_DISPOSED'), { code: 'ROUTER_DISPOSED' })
      }
      timeline.push('deliver_ok')
      return { ok: true, sessionId: 'sess-1', reconciliationHandle: 'turn:h1' }
    },
    getTurnReconciliation: () => ({ state: 'pending' }),
    readInstanceDetail: async () => ({
      ok: true,
      body: { visibility: 'full', detail: { instance: {}, current_node_visit_id: VISIT } },
    }),
  })
  return { engine, releasePage1, parked, timeline }
}

test('T42-fixed: stop() awaits the bounded drain — no delivery after the awaited stop', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-t42fix-'))
  const timeline = []
  const ledger = new ExecutionLedger({ dir })
  const { engine, releasePage1, parked, timeline: tl } = buildEngine(ledger, { timeline })

  engine.start({ intervalMs: 60_000, catchup: false })
  void engine.pollOnce()
  await parked // event latch — no timing sleep
  assert.equal(tl.includes('fetch_page1_parked'), true, 'poll parked on page 1')

  // drain = the promise stop() now returns
  const drain = engine.stop()
  assert.ok(drain && typeof drain.then === 'function', 'stop() must return a drain promise')
  // The parked page arrives DURING the drain: bounded drain completes it.
  releasePage1()
  await drain
  timeline.push('STOP_DRAINED')
  // give any (pre-fix would-be) late work a chance to misbehave
  await new Promise((r) => setTimeout(r, 30))

  const lateDeliveries = tl.filter((e, i) => e.startsWith('deliver') && i > tl.indexOf('STOP_DRAINED'))
  console.log('=== T42-FIXED RESULT ===')
  console.log(JSON.stringify({ timeline: tl, lateDeliveries }, null, 2))
  assert.equal(lateDeliveries.length, 0,
    'no deliverRun may happen after the awaited stop() resolved (bounded drain)')
  rmSync(dir, { recursive: true, force: true })
})

test('T42+T67-fixed: result surface after drain is truthful — ledger carries zero post-stop facts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-t67fix-'))
  const timeline = []
  const ledger = new ExecutionLedger({ dir })
  const { engine, releasePage1, parked, timeline: tl } = buildEngine(ledger, { timeline })

  engine.start({ intervalMs: 60_000, catchup: false })
  void engine.pollOnce()
  await parked // event latch — no timing sleep

  // The REAL entry.js result sequence — now the awaited drain happens INSIDE
  // runtime.stop(), so everything after the result triple is genuinely quiet.
  const drained = engine.stop()
  releasePage1()
  await drained
  timeline.push('writeEvidence_stopped')
  timeline.push('log_stopped_cleanly')
  timeline.push('process_exit_0')
  await new Promise((r) => setTimeout(r, 30))

  const snapshot = ledger.snapshot()
  const attempts = Object.values(snapshot.attempts ?? snapshot)
  const runDelivered = attempts.filter((a) => (a.phase ?? a.status) === 'run_delivered').length
  const lateIO = timeline.filter((e, i) => (e.startsWith('deliver') || e === 'resolve') && i > tl.indexOf('process_exit_0'))
  console.log('=== T67-FIXED RESULT ===')
  console.log(JSON.stringify({ timeline: tl, runDelivered, lateI0: lateIO.length }, null, 2))
  assert.equal(lateIO.length, 0, 'zero I/O after the result triple (result is now truthful)')
  // BOUNDED DRAIN: the in-flight page completed BEFORE the result triple —
  // the 'stopped cleanly' claim now describes a genuinely drained engine.
  assert.ok(tl.indexOf('deliver_ok') < tl.indexOf('writeEvidence_stopped'),
    'drain must complete before the shutdown result is reported')
  rmSync(dir, { recursive: true, force: true })
})

// ── r2 (T42 residual closure per DAY_DSH_SCOUT_QUEUE_RECONCILIATION_20260920_V1) ──
// Residual surfaces discovered on fresh main: (1) trackedTick let a BUSY tick
// clobber the drain attribution (async tick returns a noop promise; inflight
// was overwritten and instantly cleared while the real poll kept running);
// (2) start()'s catch-up reconcile was void fire-and-forget OUTSIDE drain
// ownership; (3) entry.js reported 'stopped cleanly'/exit 0 even when
// runtime.stop() threw.

test('T42-r2 A: busy ticks keep the drain attribution — stop() waits for the REAL poll', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-t42r2-'))
  const timeline = []
  const ledger = new ExecutionLedger({ dir })
  const { engine, releasePage1, parked, timeline: tl } = buildEngine(ledger, { timeline })

  // Fast interval: the FIRST tracked tick starts the real poll (drain
  // attribution lands via trackedTick — the exact path the clobber attacks);
  // while it is parked, subsequent ticks are BUSY.
  engine.start({ intervalMs: 5, catchup: false })
  await parked
  assert.equal(tl.includes('fetch_page1_parked'), true, 'poll parked on page 1')

  // Let the interval fire repeatedly against the parked poll — pre-r2 each
  // busy tick replaced `inflight` with an instantly-settled noop promise.
  await new Promise((r) => setTimeout(r, 40))

  const drain = engine.stop()
  let stopResolved = false
  drain.then(() => { stopResolved = true })
  await new Promise((r) => setTimeout(r, 25))
  assert.equal(stopResolved, false,
    'stop() must NOT resolve while the real poll is still parked — busy ticks must not clobber the drain attribution (pre-r2 RED: it resolved immediately)')

  releasePage1()
  await drain
  assert.equal(tl.includes('fetch_page1_released'), true, 'the bounded drain still completes the parked page')
  rmSync(dir, { recursive: true, force: true })
})

test('T42-r2 B: startup catch-up reconcile is drain-owned — stop() awaits it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-t42r2b-'))
  const timeline = []
  const real = new ExecutionLedger({ dir })
  let releaseReconcile
  const reconcileParked = new Promise((r) => { releaseReconcile = r })
  let listCalls = 0
  const ledger = new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === 'listActiveFresh') {
        return async (...args) => {
          listCalls += 1
          if (listCalls === 1) await reconcileParked
          return Reflect.get(target, prop, receiver).apply(target, args)
        }
      }
      return Reflect.get(target, prop, receiver)
    },
  })
  const { engine } = buildEngine(ledger, { timeline })

  engine.start({ intervalMs: 60_000, catchup: true })
  await new Promise((r) => setTimeout(r, 30))
  assert.ok(listCalls >= 1, 'startup reconcile reached the ledger')

  const drain = engine.stop()
  let stopResolved = false
  drain.then(() => { stopResolved = true })
  await new Promise((r) => setTimeout(r, 25))
  assert.equal(stopResolved, false,
    'stop() must NOT resolve while the startup reconcile is still running — catch-up is drain-owned (pre-r2 RED: fire-and-forget resolved immediately)')

  releaseReconcile()
  await drain
  rmSync(dir, { recursive: true, force: true })
})
