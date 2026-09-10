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
      workflowInstanceId: INSTANCE,
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
    readInstanceDetail: async () => ({ ok: true, body: { visibility: 'full', detail: { instance: {}, current_node_visit_id: 'aaaaaaaa-3f19-4a7e-9a3f-5d1c2b0a9e11' } } }),
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
    readInstanceDetail: async () => ({ ok: true, body: { visibility: 'full', detail: { instance: {}, current_node_visit_id: 'aaaaaaaa-3f19-4a7e-9a3f-5d1c2b0a9e11' } } }),
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
    readInstanceDetail: async () => ({ ok: true, body: { visibility: 'full', detail: { instance: {}, current_node_visit_id: 'aaaaaaaa-3f19-4a7e-9a3f-5d1c2b0a9e11' } } }),
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
    readInstanceDetail: async () => ({ ok: true, body: { visibility: 'full', detail: { instance: {}, current_node_visit_id: 'aaaaaaaa-3f19-4a7e-9a3f-5d1c2b0a9e11' } } }),
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
