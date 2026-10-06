/**
 * Ingress → runtime restart-handoff pin (Product #455 / A6, TEST_IDENTITY).
 *
 * The two halves of the bounded ingress handoff each had coverage, but never
 * across their seam at the FULL runtime composition level:
 *
 *   - packages/notification-ingress crash windows (C-IDM-009 W1..W4,
 *     real SIGKILL) run the plugin standalone against a STUB router;
 *   - the compose-level stop/receipt tests either disable the ingress
 *     (restart-boundary.test.js) or stop with no delivery in flight
 *     (compose.test.js 'graceful stop closes the HTTP surfaces').
 *
 * These tests pin the missing seam: an AUTHENTICATED /v1/deliver parked
 * in flight (durably RESERVED, router call unresolved) while the runtime
 * takes its controlled SIGTERM stop. The handoff must be BOUNDED and
 * RESTART-SAFE at the composition level, with zero source authority
 * change:
 *
 *   1. the admission is durable BEFORE the boundary (C-IDM-004 reserve
 *      commits before the Router is ever called) and survives the stop
 *      untouched (never answered, never rewritten);
 *   2. the stop persists its quiesce_begin/quiesce_end receipts around
 *      the drain (C11-R3) and closes the ingress HTTP surface;
 *   3. a fresh runtime booted on the SAME root sweeps the unresolved
 *      reservation to outcome_unknown (restart_unresolved) and replays
 *      the SAME (caller, requestId) IDEMPOTENTLY — outcome reuse, zero
 *      Router re-admission (C-IDM-010 restart sweep; nothing ever auto
 *      re-delivers a reserved record).
 *
 * The parked router call is deliberately NEVER released in the restart
 * scenario: it models the old process vanishing mid-admission, which is
 * exactly the crash window the boot sweep exists for. PRODUCTION_MUTATION
 * = NO — everything runs on a throwaway production layout root with a
 * fake agent process.
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { composeProductionRuntime } from '../src/compose.js'
import {
  AGT_ID,
  FORUM,
  FakeProc,
  basic,
  okTokenFetch,
  seedRuntime,
  silentLog,
  writeNotificationAuthConfig,
} from './compose-fixture.js'

const GLOBAL_ROUTE = Object.freeze({ provider: 'oc-go', model: 'deepseek-v4-flash' })
const REQUEST_ID = 'req-a6-restart-handoff'
const MESSAGE = 'in flight across the restart boundary'

/** A FakeProc whose FIRST deliver() parks until released — the in-flight
 *  router call that crosses the stop boundary. `parked` resolves once the
 *  call is INSIDE deliver() (Router startup — spawn/ready/route chain — has
 *  completed), so a stop taken after that cannot reject the admission
 *  mid-startup; the only unresolved thing left is the parked inbox-accept. */
class GatedProc extends FakeProc {
  constructor(opts) {
    super(opts)
    this.parked = new Promise((resolve) => { this.parkedResolve = resolve })
    this.gate = new Promise((resolve) => { this.gateResolve = resolve })
  }

  async deliver(sessionId, text) {
    this.parkedResolve()
    await this.gate
    return super.deliver(sessionId, text)
  }
}

function post(port, body) {
  return fetch(`http://127.0.0.1:${port}/v1/deliver`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: basic(FORUM.clientId, FORUM.clientSecret) },
    body: JSON.stringify({ requestId: REQUEST_ID, agentId: AGT_ID, sessionMode: 'main', message: MESSAGE }),
  }).then(
    async (res) => ({ status: res.status, body: await res.json() }),
    (error) => ({ error: String(error?.cause?.code ?? error?.message ?? error) }),
  )
}

function storeRecord(layout) {
  const doc = JSON.parse(readFileSync(layout.notificationIdempotencyStore, 'utf8'))
  return doc.records?.[FORUM.clientId]?.[REQUEST_ID]
}

/** The handler reserves durably BEFORE calling the Router (C-IDM-004); wait
 *  until the in-flight delivery is visibly past that point, and until the
 *  Router's admission has finished starting the agent process and is parked
 *  inside proc.deliver — the state that actually crosses the boundary. */
async function waitForInFlightDelivery(layout, spawned, { timeoutMs = 5000 } = {}) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (spawned.length > 0) break
    if (Date.now() > deadline) throw new Error('router admission never started the agent process')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  const proc = spawned[0]
  for (;;) {
    if (existsSync(layout.notificationIdempotencyStore)) {
      const record = storeRecord(layout)
      if (record?.state === 'reserved') break
    }
    if (Date.now() > deadline) throw new Error('in-flight delivery never reached the durable reserved state')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  await Promise.race([
    proc.parked,
    new Promise((resolve, reject) => setTimeout(() => reject(new Error('delivery never parked inside proc.deliver')), timeoutMs)),
  ])
}

/** Compose one runtime with the ingress mounted and one gated agent process. */
async function composeWithIngress(t, layout, spawned) {
  const runtime = await composeProductionRuntime({
    globalRoute: GLOBAL_ROUTE,
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: true, host: '127.0.0.1', port: 0, fetchImpl: okTokenFetch() },
    processFactory: (opts) => { const proc = new GatedProc(opts); spawned.push(proc); return proc },
    log: silentLog,
  })
  t.after(async () => {
    for (const proc of spawned) proc.gateResolve?.()
    await runtime.stop().catch(() => { /* already stopped */ })
  })
  await runtime.start()
  return runtime
}

function readBoundaryReceipts(layout) {
  return readFileSync(layout.restartBoundaryLog, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
}

test('A6: a delivery parked in flight at the controlled stop leaves a durable reserved admission, quiesce receipts, and a closed ingress surface', async (t) => {
  const { layout } = await seedRuntime(t)
  writeNotificationAuthConfig(layout)
  const spawned = []
  const runtime = await composeWithIngress(t, layout, spawned)
  const { port } = runtime.notificationIngress.address()

  // Park one authenticated delivery in flight (router call held by the gate).
  const inflight = post(port)
  await waitForInFlightDelivery(layout, spawned)
  assert.equal(storeRecord(layout)?.state, 'reserved', 'the in-flight admission is durably reserved BEFORE the boundary')

  // The controlled stop crosses the in-flight delivery.
  await runtime.stop('SIGTERM')

  // Bounded: the stop wrote its quiesce receipts around the drain.
  const receipts = readBoundaryReceipts(layout)
  assert.deepEqual(receipts.map((line) => line.phase), ['quiesce_begin', 'quiesce_end'])
  for (const line of receipts) {
    assert.equal(line.signal, 'SIGTERM')
    assert.equal(line.kind, 'restart_boundary')
    assert.ok(Array.isArray(line.census.slots), 'quiesce census carries the lifecycle slots')
    assert.ok(Array.isArray(line.census.inflightTurns), 'quiesce census carries the in-flight turn class')
    assert.ok(Array.isArray(line.census.inflightOccurrences), 'quiesce census carries the in-flight occurrence class')
  }

  // Restart-safe: the reserved admission survived the stop untouched —
  // never answered, never rewritten by the shutdown path.
  assert.equal(storeRecord(layout)?.state, 'reserved', 'the reservation outlives the boundary exactly as reserved')

  // Bounded: the ingress HTTP surface is closed after the stop.
  await assert.rejects(
    () => fetch(`http://127.0.0.1:${port}/health`),
    /fetch failed|ECONNREFUSED/,
    'ingress closed after stop',
  )

  // The old admission attempt never resolves (gate stays held): settle it
  // quietly so the parked continuation cannot leak past the test.
  for (const proc of spawned) proc.gateResolve?.()
  await inflight
  await new Promise((resolve) => setTimeout(resolve, 20))
})

test('A6: runtime restart on the same root reuses the in-flight admission idempotently — outcome_unknown, zero Router re-admission', async (t) => {
  const { layout } = await seedRuntime(t)
  writeNotificationAuthConfig(layout)

  // ── boot #1: park the delivery, then take the controlled stop ──────────
  const spawned1 = []
  const runtime1 = await composeWithIngress(t, layout, spawned1)
  const inflight = post(runtime1.notificationIngress.address().port)
  await waitForInFlightDelivery(layout, spawned1)
  await runtime1.stop('SIGTERM')
  assert.equal(storeRecord(layout)?.state, 'reserved')
  // Model the vanished old process: the parked router call is never released.

  // ── boot #2: same root, fresh runtime ──────────────────────────────────
  const spawned2 = []
  const runtime2 = await composeWithIngress(t, layout, spawned2)
  const health = await fetch(`http://127.0.0.1:${runtime2.notificationIngress.address().port}/health`)
  assert.equal(health.status, 200)
  assert.equal((await health.json()).storeReady, true)

  // The boot sweep migrated the unresolved reservation (restart_unresolved).
  assert.equal(storeRecord(layout)?.state, 'outcome_unknown')
  assert.equal(storeRecord(layout)?.outcomeUnknown?.source, 'restart_unresolved')
  const ingressEvidence = readFileSync(layout.notificationEvidence, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  assert.ok(
    ingressEvidence.some((line) => line.kind === 'boot_unresolved_sweep' && line.count >= 1),
    'boot sweep evidence recorded for the carried-over reservation',
  )

  // Replay the SAME (caller, requestId): the durable outcome is REUSED —
  // never a second delivery (C-IDM-010 restart contract).
  const replay = await post(runtime2.notificationIngress.address().port)
  assert.equal(replay.status, 200)
  assert.equal(replay.body.outcome, 'outcome_unknown')
  assert.equal(replay.body.duplicate, true)
  assert.equal(replay.body.accepted, false)

  // Zero Router re-admission across the restart: the replay never reaches
  // the Router, so no process is spawned and no inbox receives anything.
  assert.equal(
    spawned2.reduce((count, proc) => count + proc.deliveries.length, 0),
    0,
    'the replay never re-admitted into any agent inbox',
  )
  const evidence = readFileSync(layout.evidenceLog, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  assert.ok(
    !evidence.some((line) => line.kind === 'deliver' && line.requestId === REQUEST_ID),
    'no Router admission evidence for the replayed requestId on either side of the restart',
  )

  // The replay answered from the durable authority, not from the old
  // process: the parked boot-#1 handler is still parked and stays parked.
  await inflight
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(
    spawned2.reduce((count, proc) => count + proc.deliveries.length, 0),
    0,
    'still zero re-admission after the old attempt settled quiet',
  )
})
