/**
 * WORKFLOW_AGENT_EXECUTION_V1 CTR-WAE-001b — the consumer-side keyset
 * continuation proofs (B2 starvation closure):
 *
 *   - full-page cursor handoff with BYTE-EXACT cursor round-trip
 *   - NO finite page cap (a stub feed with >100 full pages is consumed to
 *     exhaustion — the Owner B-O1 regression guard)
 *   - STARVATION: >100 due intents with the first 100 already attempted ⇒
 *     intents 101+ are still discovered and admitted (never re-attempted)
 *   - per-request error stops the sweep loud (next tick retries)
 *   - a feed that ignores the cursor (identical full page repeated) stops
 *     loud instead of spinning (deploy-order safety)
 *   - both-or-neither cursor propagation (the engine never sends a half
 *     cursor), and a well-formed last record is required before advancing
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ExecutionLedger, attemptIdFor } from '../src/ledger.js'
import { createWorkflowExecutionEngine, DUE_PAGE_LIMIT } from '../src/engine.js'
import { completeCurrentActivationDetail } from '../test-support/current-activation-detail.js'

// #1364: real engine + durable ledger; only external policy/detail/Router I/O is synthetic.
function budgetFixture(badCount, { healthyCount = 1, config = {}, deliveryOk = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-budget-'))
  const items = makeIntents(1, badCount + healthyCount)
  const bad = new Set(items.slice(0, badCount).map(item => item.nodeVisitId))
  const calls = { probes: [], deliveries: [], pages: [] }
  const ledger = new ExecutionLedger({ dir, resolveManagedAttempt: async intent => {
    calls.probes.push(intent.nodeVisitId)
    return bad.has(intent.nodeVisitId) ? undefined : false
  } })
  const engine = createWorkflowExecutionEngine({
    ledger, config,
    fetchDuePage: async request => {
      calls.pages.push(request)
      if (calls.pageErrorAfter !== undefined && request.afterDispatchIntentId !== undefined) {
        return { ok: false, code: 'synthetic_read_error' }
      }
      const start = request.afterDispatchIntentId === undefined ? 0
        : items.findIndex(item => item.dispatchIntentId === request.afterDispatchIntentId) + 1
      return { ok: true, items: items.slice(start, start + request.limit) }
    },
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
    deliverRun: async request => {
      assert.equal(bad.has(request.messageOrigin.nodeVisitId), false, 'unavailable policy is never delivered')
      assert.equal(ledger.get(request.messageOrigin.nodeVisitId).phase, 'delivery_started', 'WAL precedes delivery')
      calls.deliveries.push(request)
      return deliveryOk ? { ok: true, sessionId: 'main', reconciliationHandle: `turn:${request.requestId}` }
        : { ok: false, code: 'synthetic_rejection' }
    },
    getTurnReconciliation: () => ({ state: 'pending' }),
    readInstanceDetail: async ({ workflowInstanceId }) => ({ ok: true, body: completeCurrentActivationDetail({
      visibility: 'full', detail: {
        instance: { workflow_state_version: 1 },
        current_node_visit_id: items.find(item => item.workflowInstanceId === workflowInstanceId)?.nodeVisitId,
      },
    }, { workflowInstanceId, ownerPrincipalId: OWNER }) }),
  })
  return { engine, ledger, items, calls, restorePolicy: nodeVisitId => bad.delete(nodeVisitId),
    cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

test('#1364 RED/GREEN: 25 stable pre-plan failures cannot starve the healthy 26th intent for three polls', async () => {
  const fixture = budgetFixture(25)
  try {
    const rounds = []
    for (let round = 1; round <= 3; round += 1) {
      const before = fixture.calls.probes.length
      const result = await fixture.engine.pollOnce()
      assert.equal(result.ok, true)
      rounds.push({ round, probes: fixture.calls.probes.length - before,
        failures: result.admissions.filter(item => item.action === 'pre_plan_unavailable').length,
        attempts: fixture.ledger.snapshot().length, deliveries: fixture.calls.deliveries.length })
    }
    console.log(`#1364 observations ${JSON.stringify(rounds)}`)
    assert.equal(fixture.calls.deliveries.length, 1, 'healthy tail must receive exactly one opportunity within three polls')
    assert.equal(fixture.ledger.snapshot().length, 1, 'failed pre-plans mint no attempts')
  } finally { fixture.cleanup() }
})

test('#1364 control: 24 stable pre-plan failures leave the healthy 25th reachable', async () => {
  const fixture = budgetFixture(24)
  try {
    await fixture.engine.pollOnce()
    assert.equal(fixture.calls.deliveries.length, 1)
    assert.equal(fixture.ledger.snapshot().length, 1)
  } finally { fixture.cleanup() }
})

test('#1364 bounded rotation passes 250 abnormal heads across pages and returns to repaired heads', async () => {
  const fixture = budgetFixture(250, { healthyCount: 2 })
  try {
    const bound = Math.ceil(fixture.items.length / 25)
    for (let round = 1; round <= bound; round += 1) {
      const before = fixture.calls.probes.length
      const result = await fixture.engine.pollOnce()
      assert.equal(result.ok, true)
      assert.equal(result.pages, 3, 'discovery remains exhaustive even when probe budget is spent')
      assert.ok(fixture.calls.probes.length - before <= 50, 'finite admission-scan budget S')
      assert.ok(result.admissionBudget.failed <= 25, 'finite failure budget F')
      assert.ok(result.admissionBudget.created <= 25, 'separate actual-mint budget A')
      assert.equal(result.admissionBudget.scanned, fixture.calls.probes.length - before)
    }
    assert.equal(fixture.calls.deliveries.length, 2, `healthy tail reached within ${bound} polls`)
    assert.equal(fixture.ledger.snapshot().length, 2)
    const firstHead = fixture.items[0]
    fixture.restorePolicy(firstHead.nodeVisitId)
    await fixture.engine.pollOnce()
    assert.ok(fixture.ledger.get(firstHead.nodeVisitId), 'a completed cycle must revisit a repaired head')
    assert.equal(fixture.calls.deliveries.length, 3, 'already admitted tail is never delivered again')
  } finally { fixture.cleanup() }
})

test('#1364 scan cap also bounds already-attempted ledger probes; refusals are not new attempts', async () => {
  const fixture = budgetFixture(0, { healthyCount: 8, config: { maxAdmissionsPerPoll: 2 } })
  try {
    for (let round = 0; round < 4; round += 1) {
      const result = await fixture.engine.pollOnce()
      assert.equal(result.admissionBudget.created, 2)
    }
    assert.equal(fixture.calls.deliveries.length, 8)
    const before = fixture.calls.probes.length
    const replay = await fixture.engine.pollOnce()
    assert.equal(replay.admissionBudget.scanned, 4)
    assert.equal(fixture.calls.probes.length - before, 4)
    assert.equal(replay.admissionBudget.created, 0)
    assert.equal(replay.admissionBudget.failed, 0)
    assert.equal(fixture.calls.deliveries.length, 8)
  } finally { fixture.cleanup() }
})

test('#1364 minted delivery failures still consume the actual new-attempt budget', async () => {
  const fixture = budgetFixture(0, { healthyCount: 6, config: { maxAdmissionsPerPoll: 2 }, deliveryOk: false })
  try {
    const result = await fixture.engine.pollOnce()
    assert.deepEqual(result.admissions.map(item => item.action), ['needs_review', 'needs_review'])
    assert.equal(result.admissionBudget.created, 2)
    assert.equal(result.admissionBudget.failed, 2)
    assert.equal(fixture.ledger.snapshot().length, 2)
  } finally { fixture.cleanup() }
})

test('#1364 unknown post-mint exception halts probes but preserves exhaustive discovery and the fence', async () => {
  const fixture = budgetFixture(0, { healthyCount: 201, config: { maxAdmissionsPerPoll: 2 } })
  const begin = fixture.ledger.beginAttemptIfAbsent.bind(fixture.ledger)
  fixture.ledger.beginAttemptIfAbsent = async (...args) => {
    await begin(...args)
    throw new Error('synthetic failure after mint and delivery')
  }
  try {
    const result = await fixture.engine.pollOnce()
    assert.equal(result.pages, 3)
    assert.equal(result.admissionBudget.unknown, 1)
    assert.equal(result.admissionBudget.created, 0, 'missing return is not fabricated created evidence')
    assert.equal(fixture.calls.probes.length, 1, 'unknown mint stops further admission probes')
    assert.equal(fixture.calls.deliveries.length, 1)
    assert.equal(fixture.ledger.snapshot().length, 1)
    fixture.ledger.beginAttemptIfAbsent = begin
    await fixture.engine.pollOnce()
    const requests = fixture.calls.deliveries.map(item => item.requestId)
    assert.equal(new Set(requests).size, requests.length, 'UNKNOWN is never replayed')
  } finally { fixture.cleanup() }
})

test('#1364 incomplete discovery commits no probe rotation; the next sweep retries from page one', async () => {
  const fixture = budgetFixture(100)
  try {
    fixture.calls.pageErrorAfter = 1
    const failed = await fixture.engine.pollOnce()
    assert.equal(failed.ok, false)
    assert.equal(failed.code, 'synthetic_read_error')
    const before = fixture.calls.probes.length
    fixture.calls.pageErrorAfter = undefined
    const result = await fixture.engine.pollOnce()
    assert.equal(result.ok, true)
    assert.equal(fixture.calls.probes[before], fixture.items[0].nodeVisitId)
    assert.equal(result.admissionBudget.rotated, 0, 'partial sweep did not commit the cycle')
    assert.equal(fixture.calls.pages[2].afterDispatchIntentId, undefined)
  } finally { fixture.cleanup() }
})

const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const OWNER = '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66'
const AGENT = 'agt_target-agent'

/** Deterministic synthetic due intents (count-sized batches, unique ids). */
function makeIntents(start, count) {
  const out = []
  for (let i = start; i < start + count; i += 1) {
    const hex = String(i).padStart(12, '0')
    out.push({
      dispatchIntentId: `bd5c2f0a-3f19-4a7e-9a3f-${hex}`.slice(0, 36),
      nodeVisitId: `cd5c2f0a-3f19-4a7e-9a3f-${hex}`.slice(0, 36),
      workflowInstanceId: `ed5c2f0a-3f19-4a7e-9a3f-${hex}`,
      ownerPrincipalId: OWNER,
      nextEligibleAt: `2026-09-09T00:00:${String(i % 60).padStart(2, '0')}.${String(i).padStart(6, '0')}Z`,
      createdAt: '2026-09-09T00:00:00Z',
      updatedAt: '2026-09-09T00:00:00Z',
    })
  }
  return out
}

function pageEngine({
  pages, // array of item-arrays served in order
  resolve = () => ({ ok: true, agentId: AGENT }),
  deliver = () => ({ ok: true, sessionId: 'main', reconciliationHandle: `turn:${Math.random()}` }),
  config = {},
  ledger: ledgerOverride,
}) {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-continuation-'))
  const ledger = ledgerOverride ?? new ExecutionLedger({ dir })
  const calls = { dueRequests: [], delivers: [] }
  const engine = createWorkflowExecutionEngine({
    ledger,
    log: { log: () => {}, warn: () => {}, error: () => {} },
    fetchDuePage: async (req) => {
      calls.dueRequests.push({ ...req })
      const idx = calls.dueRequests.length - 1
      const page = pages[idx]
      if (page === undefined) throw new Error(`unexpected page request #${idx + 1}`)
      return { ok: true, items: page }
    },
    resolvePrincipalToAgent: async (principalId) => {
      calls.resolves = calls.resolves ?? []
      return resolve(principalId)
    },
    deliverRun: async (req) => {
      calls.delivers.push(req)
      return deliver(req)
    },
    getTurnReconciliation: () => ({ state: 'pending' }),
    readInstanceDetail: async ({ workflowInstanceId }) => ({ ok: true, body: completeCurrentActivationDetail({
      visibility: 'full', detail: {
        instance: { workflow_state_version: 1 },
        current_node_visit_id: pages.flat().find((intent) => intent.workflowInstanceId === workflowInstanceId)?.nodeVisitId,
      },
    }, { workflowInstanceId, ownerPrincipalId: OWNER }) }),
    config,
  })
  return { engine, ledger, calls, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

test('full-page handoff: cursor is the EXACT last-item strings; short page ends the sweep', async () => {
  const page1 = makeIntents(1, DUE_PAGE_LIMIT) // FULL page
  const page2 = makeIntents(101, 40) // short page
  const fixture = pageEngine({ pages: [page1, page2], config: { maxAdmissionsPerPoll: 200 } })
  try {
    const result = await fixture.engine.pollOnce()
    assert.equal(result.ok, true)
    assert.equal(result.pages, 2)
    assert.equal(fixture.calls.dueRequests.length, 2)
    // First request: NO cursor (both-or-neither => neither).
    assert.equal(fixture.calls.dueRequests[0].afterNextEligibleAt, undefined)
    assert.equal(fixture.calls.dueRequests[0].afterDispatchIntentId, undefined)
    assert.equal(fixture.calls.dueRequests[0].limit, DUE_PAGE_LIMIT)
    // Second request: cursor = EXACT strings of page 1's last item.
    const last = page1[page1.length - 1]
    assert.equal(fixture.calls.dueRequests[1].afterNextEligibleAt, last.nextEligibleAt, 'byte-exact nextEligibleAt round-trip')
    assert.equal(fixture.calls.dueRequests[1].afterDispatchIntentId, last.dispatchIntentId, 'byte-exact dispatchIntentId round-trip')
    // Every admitted attempt is unique across the whole sweep.
    const admitted = result.admissions.filter((a) => a.action === 'admitted')
    assert.equal(admitted.length, DUE_PAGE_LIMIT + 40)
    const ids = new Set(admitted.map((a) => a.nodeVisitId))
    assert.equal(ids.size, admitted.length)
  } finally {
    fixture.cleanup()
  }
})

test('NO finite page cap: >100 FULL pages are consumed to exhaustion (B-O1 guard)', async () => {
  const pages = []
  for (let p = 0; p < 105; p += 1) pages.push(makeIntents(p * DUE_PAGE_LIMIT + 1, DUE_PAGE_LIMIT)) // 105 FULL pages
  pages.push(makeIntents(105 * DUE_PAGE_LIMIT + 1, 1)) // terminal SHORT page
  const fixture = pageEngine({ pages, config: { maxAdmissionsPerPoll: 1 } })
  try {
    const result = await fixture.engine.pollOnce()
    assert.equal(result.ok, true)
    assert.equal(result.pages, 106, 'swept 105 full pages + the terminal short page — no page budget')
    assert.equal(fixture.calls.dueRequests.length, 106)
    assert.equal(result.admissions.filter((a) => a.action === 'admitted').length, 1, 'bound counts only NEW attempts')
  } finally {
    fixture.cleanup()
  }
})

test('STARVATION (goal-required, consumer side): >100 due with the first 100 attempted => 101+ still discovered and admitted, never re-attempted', async () => {
  const first100 = makeIntents(1, 100)
  const rest = makeIntents(101, 50)
  const dir = mkdtempSync(join(tmpdir(), 'wfe-starvation-'))
  const ledger = new ExecutionLedger({ dir })
  try {
    // Pass 1: the first 100 items get attempts (page short => single fetch).
    const pass1 = pageEngine({
      pages: [first100.map((it) => ({ ...it })), []],
      ledger,
      config: { maxAdmissionsPerPoll: 100 },
    })
    const r1 = await pass1.engine.pollOnce()
    assert.equal(r1.admissions.filter((a) => a.action === 'admitted').length, 100)
    pass1.cleanup()

    // Pass 2 (the starvation scenario): the feed re-returns the SAME first
    // 100 (all attempted -> blocked, free) PLUS 50 new ones behind them.
    const pass2 = pageEngine({
      pages: [first100.map((it) => ({ ...it })), rest.map((it) => ({ ...it }))],
      ledger,
      config: { maxAdmissionsPerPoll: 100 },
    })
    const r2 = await pass2.engine.pollOnce()
    assert.equal(r2.ok, true)
    assert.equal(r2.pages, 2, 'the sweep continued past the blocked first window')
    const admitted2 = r2.admissions.filter((a) => a.action === 'admitted')
    assert.equal(admitted2.length, 50, 'ALL of intents 101-150 admitted')
    const attemptedVisits = new Set(r2.admissions.filter((a) => a.action === 'already_attempted').map((a) => a.nodeVisitId))
    assert.equal(attemptedVisits.size, 100, 'the first 100 were re-observed and blocked, free')
    // Intent #101 (the first invisible one) is among the admitted.
    assert.equal(
      admitted2.some((a) => a.nodeVisitId === rest[0].nodeVisitId),
      true,
      'intent 101 is discovered ONLY via the continuation',
    )
    // The fence holds: still exactly 150 attempts total.
    assert.equal(ledger.snapshot().length, 150)
    pass2.cleanup()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('per-request error stops the sweep loud; page-1 admissions stand', async () => {
  const page1 = makeIntents(1, DUE_PAGE_LIMIT)
  const fixture = pageEngine({
    pages: [page1],
    dueError: undefined,
    config: { maxAdmissionsPerPoll: 100 },
  })
  // Wrap the fake: serve page 1, then fail.
  let calls = 0
  fixture.engine // engine already built with pages; patch via dueRequests count
  const failing = pageEngine({
    pages: [page1],
    config: { maxAdmissionsPerPoll: 100 },
  })
  failing.cleanup()
  // Rebuild cleanly with an erroring fetch:
  const dir = mkdtempSync(join(tmpdir(), 'wfe-err-'))
  const ledger = new ExecutionLedger({ dir })
  let n = 0
  const engine = createWorkflowExecutionEngine({
    ledger,
    log: { log: () => {}, warn: () => {}, error: () => {} },
    fetchDuePage: async () => {
      n += 1
      if (n === 1) return { ok: true, items: page1 }
      return { ok: false, code: 'service_unavailable', detail: 'down' }
    },
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
    deliverRun: async (req) => { fixture.calls.delivers.push(req); return { ok: true, sessionId: 'main' } },
    getTurnReconciliation: () => ({ state: 'pending' }),
    readInstanceDetail: async () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 1 }, current_node_visit_id: 'aaaaaaaa-3f19-4a7e-9a3f-5d1c2b0a9e11' } } }),
  })
  try {
    const result = await engine.pollOnce()
    assert.equal(result.ok, false)
    assert.equal(result.phase, 'list_due_intents')
    assert.equal(result.code, 'service_unavailable')
    assert.equal(result.pages, 1)
    assert.ok(result.admissions.length > 0, 'page-1 admissions stand')
  } finally {
    rmSync(dir, { recursive: true, force: true })
    void calls
  }
})

test('a feed that ignores the cursor (identical full page repeated) stops loud instead of spinning', async () => {
  const page = makeIntents(1, DUE_PAGE_LIMIT)
  const dir = mkdtempSync(join(tmpdir(), 'wfe-loop-'))
  const ledger = new ExecutionLedger({ dir })
  const engine = createWorkflowExecutionEngine({
    ledger,
    log: { log: () => {}, warn: () => {}, error: () => {} },
    fetchDuePage: async () => ({ ok: true, items: page.map((it) => ({ ...it })) }), // ignores cursor
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
    deliverRun: async () => ({ ok: true, sessionId: 'main' }),
    getTurnReconciliation: () => ({ state: 'pending' }),
    readInstanceDetail: async () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 1 }, current_node_visit_id: 'aaaaaaaa-3f19-4a7e-9a3f-5d1c2b0a9e11' } } }),
    config: { maxAdmissionsPerPoll: 0 },
  })
  try {
    const result = await engine.pollOnce()
    assert.equal(result.ok, false)
    assert.equal(result.phase, 'due_feed_cursor')
    assert.equal(result.code, 'cursor_not_advancing')
    assert.equal(result.pages, 2, 'stopped after the repeat, not a spin')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('cursor protocol violation: a full page whose last record is malformed stops the sweep', async () => {
  const page1 = makeIntents(1, DUE_PAGE_LIMIT)
  const broken = page1.map((it) => ({ ...it }))
  delete broken[broken.length - 1].nextEligibleAt
  const dir = mkdtempSync(join(tmpdir(), 'wfe-proto-'))
  const ledger = new ExecutionLedger({ dir })
  const engine = createWorkflowExecutionEngine({
    ledger,
    log: { log: () => {}, warn: () => {}, error: () => {} },
    fetchDuePage: async () => ({ ok: true, items: broken }),
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
    deliverRun: async () => ({ ok: true, sessionId: 'main' }),
    getTurnReconciliation: () => ({ state: 'pending' }),
    readInstanceDetail: async () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 1 }, current_node_visit_id: 'aaaaaaaa-3f19-4a7e-9a3f-5d1c2b0a9e11' } } }),
    config: { maxAdmissionsPerPoll: 0 },
  })
  try {
    const result = await engine.pollOnce()
    assert.equal(result.ok, false)
    assert.equal(result.phase, 'due_feed_cursor')
    assert.equal(result.code, 'cursor_protocol_violation')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('both-or-neither propagation: the engine never sends a half cursor', async () => {
  const page1 = makeIntents(1, DUE_PAGE_LIMIT)
  const page2 = makeIntents(101, 5)
  const fixture = pageEngine({ pages: [page1, page2] })
  try {
    await fixture.engine.pollOnce()
    for (const req of fixture.calls.dueRequests) {
      const hasTs = req.afterNextEligibleAt !== undefined
      const hasId = req.afterDispatchIntentId !== undefined
      assert.equal(hasTs, hasId, `both-or-neither violated: ${JSON.stringify(req)}`)
    }
  } finally {
    fixture.cleanup()
  }
})
