/**
 * ADMISSION_ASSISTANCE_RESUME_REPRODUCTION_20261019 r2 — SOURCE-only
 * isolation reproduction for mayf3/agent-control#1214, corrected per the
 * #1215 independent static review:
 *
 *   r1 ERRATUM (retracted): the gen-2 event assertion used
 *   `ledger.snapshot().events ?? []`, but snapshot() returns the ATTEMPT
 *   array (ledger.js snapshot()), so the filter scanned `undefined.events`
 *   fallback `[]` and was vacuously green. r2 reads the fixture's OWN
 *   events file (`<tmpdir>/attempts.jsonl`, LEDGER_EVENTS_FILE) strictly
 *   line-by-line and asserts exact attempt_planned counts, plus a fresh
 *   ExecutionLedger replay for state/generation (anti-vacuous).
 *
 * Scope discipline (unchanged): synthetic same-visit version 7→8→9 probes —
 * NOT a real svc Assistance transaction; "refused by every engine path"
 * means the engine-visible paths covered by the already-reviewed semantics
 * (stale scan, run-ended fast continuation, ledger fence, recovery-op
 * E-gates), nothing more. Feed OPEN→RESOLVED phases are SIMULATED due-feed
 * shapes, not the svc dispatch-intent transaction. The same-visit assignee
 * is not mutated in synthetic detail (immutable in the real schema);
 * ownership drift is covered through the REAL historical_participant
 * visibility path and the ledger's CTR-SRE-003 identity refusal instead.
 *
 * Real engine (createWorkflowExecutionEngine) + real ExecutionLedger over a
 * temp dir; only transport seams are fakes; synthetic ids throughout; no
 * svc/network/production contact.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ExecutionLedger, attemptIdFor, STALE_NO_PROGRESS_JUDGMENT, LEDGER_EVENTS_FILE } from '../src/ledger.js'
import { createWorkflowExecutionEngine } from '../src/engine.js'
import { createRecoveryOperation } from '../src/recovery.js'

const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const VISIT_NEXT = 'ad5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77'
const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const OWNER = '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66'
const OWNER_OTHER = '9d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e88'
const AGENT = 'agt_target-agent'
const T0 = 1_700_000_000_000

function dueIntent(overrides = {}) {
  return {
    dispatchIntentId: INTENT,
    nodeVisitId: VISIT,
    workflowInstanceId: INSTANCE,
    ownerPrincipalId: OWNER,
    nextEligibleAt: '2026-09-09T01:00:00Z',
    createdAt: '2026-09-09T00:00:00Z',
    updatedAt: '2026-09-09T00:30:00Z',
    ...overrides,
  }
}

function fullDetail({ version, visit, isTerminal = false, visibility = 'full' } = {}) {
  if (visibility !== 'full') return { visibility, detail: { instance: {} } }
  return {
    visibility: 'full',
    detail: {
      instance: { workflow_state_version: version, is_terminal: isTerminal },
      current_node_visit_id: visit,
    },
  }
}

/** Strict line-by-line reader over the fixture's own append-only events file. */
function readPlannedEvents(eventsFile) {
  const text = readFileSync(eventsFile, 'utf8')
  const lines = text.split('\n').filter((l) => l.trim() !== '')
  const events = lines.map((line, i) => {
    try {
      return JSON.parse(line)
    } catch (error) {
      throw new Error(`attempts.jsonl line ${i + 1} is not valid JSON: ${error.message}`)
    }
  })
  return { totalLines: lines.length, planned: events.filter((e) => e.kind === 'attempt_planned') }
}

/**
 * Shared fixture: one mutable clock, temp-dir ledger, engine over fake
 * seams. `mutable.feedItems` drives fetchDuePage (OPEN=[] vs RESOLVED=[due]
 * feed phases are SIMULATIONS); every detail read must address the resolved
 * target agent (seam-level visibility invariant).
 */
function makeFixture({ maxAttemptsPerVisit, retryDelayMs = 60_000, thresholdMs = 3_600_000 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-assist-'))
  const state = { now: T0 }
  const clock = () => state.now
  const ledger = new ExecutionLedger({ dir, clock, ...(maxAttemptsPerVisit ? { maxAttemptsPerVisit } : {}) })
  const calls = { delivers: [], detailReads: [] }
  const mutable = { detailVersion: 7, detailVisit: VISIT, isTerminal: false, visibility: 'full', turnState: () => 'pending', feedItems: [dueIntent()] }
  const engine = createWorkflowExecutionEngine({
    ledger,
    clock,
    log: { log: () => {}, warn: () => {}, error: () => {} },
    config: { staleNoProgressThresholdMs: thresholdMs, retryDelayMs },
    fetchDuePage: async () => ({ ok: true, items: mutable.feedItems }),
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
    deliverRun: async (req) => {
      calls.delivers.push(req)
      return { ok: true, sessionId: 'main', reconciliationHandle: `turn:handle-${calls.delivers.length}` }
    },
    getTurnReconciliation: (handle) => ({ state: mutable.turnState(handle) }),
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    readInstanceDetail: async (req) => {
      calls.detailReads.push(req)
      assert.equal(req.agentId, AGENT, 'detail probes must read AS the resolved target agent')
      assert.equal(req.workflowInstanceId, INSTANCE)
      return { ok: true, body: fullDetail({ version: mutable.detailVersion, visit: mutable.detailVisit, isTerminal: mutable.isTerminal, visibility: mutable.visibility }) }
    },
  })
  const recovery = createRecoveryOperation({
    ledger,
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
    deliverRun: async () => { throw new Error('recovery must not deliver in this reproduction') },
    readInstanceDetail: async (req) => ({ ok: true, body: fullDetail({ version: mutable.detailVersion, visit: mutable.detailVisit }) }),
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    buildInstruction: () => ({}),
    provenanceFor: () => ({}),
  })
  return {
    engine, ledger, recovery, calls, dir, state, mutable,
    eventsFile: join(dir, LEDGER_EVENTS_FILE),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}

async function dispatchOnce(fixture) {
  const pass = await fixture.engine.pollOnce()
  assert.equal(pass.ok, true)
  assert.deepEqual(pass.admissions.map((a) => a.action), ['admitted'])
  assert.equal(fixture.calls.delivers.length, 1)
  const attempt = fixture.ledger.get(VISIT)
  assert.equal(attempt.phase, 'run_delivered')
  assert.equal(attempt.workflowStateVersionAtDispatch, 7, 'dispatch-time baseline recorded')
  return attempt
}

test('M1 — synthetic same-visit v7→8→9 (open then resolve): re-entry refused on every covered engine path', async (t) => {
  const fx = makeFixture()
  t.after(() => fx.cleanup())
  await dispatchOnce(fx)
  fx.state.now += 61 * 60_000
  fx.mutable.turnState = () => 'settled'
  // Observation 1: assistance OPEN (version 8, visit unchanged).
  fx.mutable.detailVersion = 8
  const r1 = await fx.engine.reconcileOnce()
  assert.deepEqual(r1.staleReentry, [], 'open assistance must not stale-reenter')
  assert.deepEqual(r1.needsReview, [VISIT])
  // Observation 2: Owner RESOLVED (version 9, still same visit/assignee).
  fx.mutable.detailVersion = 9
  const r2 = await fx.engine.reconcileOnce()
  assert.deepEqual(r2.staleReentry, [], 'resolved assistance must not stale-reenter either (version gate)')
  const afterResolve = fx.ledger.get(VISIT)
  assert.equal(afterResolve.state, 'NEEDS_REVIEW')
  assert.equal(afterResolve.judgment, 'run_ended_no_submission')
  assert.equal(fx.calls.delivers.length, 1, 'no second delivery through either loop')
  fx.state.now += 10 * 60_000
  const r3 = await fx.engine.reconcileOnce()
  assert.deepEqual(r3.staleReentry, [])
  assert.equal(fx.calls.delivers.length, 1)
  const poll = await fx.engine.pollOnce()
  assert.deepEqual(poll.admissions.map((a) => a.action), ['already_attempted'])
  const attempt = fx.ledger.get(VISIT)
  assert.notEqual(attempt.judgment, STALE_NO_PROGRESS_JUDGMENT)
  const direct = await fx.ledger.beginAttemptIfAbsent({
    dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER,
  })
  assert.equal(direct.created, false)
  assert.equal(direct.cause, 'already_attempted')
  const rec = await fx.recovery.recoverAttempt({ nodeVisitId: VISIT, authorityRef: 'authority-test-ref' })
  assert.equal(rec.outcome, 'NO_OP_TERMINAL')
  // REAL events-file evidence (r2: replaces the vacuous snapshot.events read):
  const { totalLines, planned } = readPlannedEvents(fx.eventsFile)
  assert.ok(totalLines > 0, 'events file must be non-empty')
  assert.equal(planned.length, 1, 'exactly one attempt_planned (generation 1)')
  assert.equal(planned[0].nodeVisitId, VISIT)
  assert.equal(planned.filter((e) => (e.generation ?? 1) > 1).length, 0, 'no generation>1 attempt_planned ever appended')
})

test('M2 control — version unchanged: stale_no_progress re-entry delivers generation 2 (file + replay proven)', async (t) => {
  const fx = makeFixture()
  t.after(() => fx.cleanup())
  await dispatchOnce(fx)
  fx.state.now += 61 * 60_000
  fx.mutable.turnState = () => 'settled'
  fx.mutable.detailVersion = 7
  const r = await fx.engine.reconcileOnce()
  assert.deepEqual(r.staleReentry, [VISIT], 'unchanged version is stale_confirmed')
  const settled = fx.ledger.get(VISIT)
  assert.equal(settled.state, 'SETTLED')
  assert.equal(settled.judgment, STALE_NO_PROGRESS_JUDGMENT)
  const pass = await fx.engine.pollOnce()
  assert.deepEqual(pass.admissions.map((a) => a.action), ['admitted'])
  assert.equal(fx.calls.delivers.length, 2, 'gen-2 legally delivered for the same visit')
  assert.equal(fx.ledger.get(VISIT).generation, 2)
  // Events file: exactly two attempt_planned rows, generations 1 then 2.
  const { planned } = readPlannedEvents(fx.eventsFile)
  assert.equal(planned.length, 2)
  assert.deepEqual(planned.map((e) => e.generation ?? 1), [1, 2])
  // Fresh replay over the same dir reproduces state/generation (no memory-only illusion).
  const replayed = new ExecutionLedger({ dir: fx.dir, clock: fx.state.clock ?? (() => fx.state.now) })
  const replayedAttempt = replayed.get(VISIT)
  assert.equal(replayedAttempt.state, 'ACTIVE')
  assert.equal(replayedAttempt.generation, 2)
  assert.equal(replayedAttempt.dispatchCount, 2)
})

test('M2 negative — real ownership-drift surrogates: historical_participant visibility and identity refusal', async (t) => {
  // (a) historical_participant probe: the REAL visibility the svc detail
    // surface reports when the reader is no longer the current participant.
  {
    const fx = makeFixture()
    t.after(() => fx.cleanup())
    await dispatchOnce(fx)
    fx.state.now += 61 * 60_000
    fx.mutable.turnState = () => 'settled'
    fx.mutable.visibility = 'historical_participant'
    fx.mutable.detailVersion = 9
    const r = await fx.engine.reconcileOnce()
    assert.deepEqual(r.staleReentry, [], 'historical_participant is progressed, never stale')
    assert.equal(fx.calls.delivers.length, 1)
    const poll = await fx.engine.pollOnce()
    assert.deepEqual(poll.admissions.map((a) => a.action), ['already_attempted'])
  }
  // (b) CTR-SRE-003 identity refusal: a different owner for the same visit
  // is thrown out even past a legitimate stale settlement (no cross-owner
  // re-dispatch). Same-visit assignee is NOT fabricatable as a dynamic
  // detail field — this identity gate is the real contract surface.
  {
    const fx = makeFixture()
    t.after(() => fx.cleanup())
    await dispatchOnce(fx)
    fx.state.now += 61 * 60_000
    fx.mutable.turnState = () => 'settled'
    fx.mutable.detailVersion = 7
    await fx.engine.reconcileOnce()
    await assert.rejects(
      () => fx.ledger.beginAttemptIfAbsent({
        dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER_OTHER,
      }),
      /identity triple differs/,
    )
    const { planned } = readPlannedEvents(fx.eventsFile)
    assert.equal(planned.length, 1, 'refused cross-owner attempt appended nothing')
  }
})

test('M3 — durable turn UNKNOWN: NEEDS_REVIEW run_outcome_unknown; resolve bump cannot clear it', async (t) => {
  const fx = makeFixture()
  t.after(() => fx.cleanup())
  await dispatchOnce(fx)
  fx.state.now += 61 * 60_000
  fx.mutable.turnState = () => 'unknown'
  const r = await fx.engine.reconcileOnce()
  assert.deepEqual(r.staleReentry, [], 'unknown outcome never stale-reenters')
  const attempt = fx.ledger.get(VISIT)
  assert.equal(attempt.state, 'NEEDS_REVIEW', 'durable unknown settles to NEEDS_REVIEW')
  assert.equal(attempt.judgment, 'run_outcome_unknown', 'UNKNOWN judgment recorded')
  assert.equal(fx.calls.delivers.length, 1)
  fx.mutable.detailVersion = 9
  const r2 = await fx.engine.reconcileOnce()
  assert.deepEqual(r2.staleReentry, [])
  const after = fx.ledger.get(VISIT)
  assert.equal(after.state, 'NEEDS_REVIEW', 'resolve does not clear UNKNOWN')
  assert.equal(after.judgment, 'run_outcome_unknown')
  const poll = await fx.engine.pollOnce()
  assert.deepEqual(poll.admissions.map((a) => a.action), ['already_attempted'])
  assert.equal(fx.calls.delivers.length, 1)
})

test('M4a — budget exhausted, unchanged-version control: real SETTLED/judgment then attempt_limit_reached', async (t) => {
  const fx = makeFixture({ maxAttemptsPerVisit: 1 })
  t.after(() => fx.cleanup())
  await dispatchOnce(fx)
  fx.state.now += 61 * 60_000
  fx.mutable.turnState = () => 'settled'
  fx.mutable.detailVersion = 7
  const r = await fx.engine.reconcileOnce()
  assert.deepEqual(r.staleReentry, [VISIT], 'stale settlement itself still happens')
  const settled = fx.ledger.get(VISIT)
  assert.equal(settled.state, 'SETTLED', 'actual terminal state asserted')
  assert.equal(settled.judgment, STALE_NO_PROGRESS_JUDGMENT)
  const poll = await fx.engine.pollOnce()
  assert.deepEqual(poll.admissions.map((a) => a.action), ['attempt_limit_reached'], 'budget refusal inside the fence')
  assert.equal(fx.calls.delivers.length, 1, 'no delivery past the cap')
})

test('M4b — resolve version-bump with exhausted budget: fence (not budget) refuses; nothing minted', async (t) => {
  const fx = makeFixture({ maxAttemptsPerVisit: 1 })
  t.after(() => fx.cleanup())
  await dispatchOnce(fx)
  fx.state.now += 61 * 60_000
  fx.mutable.turnState = () => 'settled'
  fx.mutable.detailVersion = 9 // assistance open + resolve
  const r = await fx.engine.reconcileOnce()
  assert.deepEqual(r.staleReentry, [], 'version gate wins before any budget question')
  const attempt = fx.ledger.get(VISIT)
  assert.equal(attempt.state, 'NEEDS_REVIEW')
  assert.notEqual(attempt.judgment, STALE_NO_PROGRESS_JUDGMENT)
  const poll = await fx.engine.pollOnce()
  assert.deepEqual(poll.admissions.map((a) => a.action), ['already_attempted'], 'fence cause, distinct from attempt_limit_reached')
  assert.equal(fx.calls.delivers.length, 1)
  const { planned } = readPlannedEvents(fx.eventsFile)
  assert.equal(planned.length, 1, 'budget consumed: zero new generations minted')
})

test('M4c — quiescence gate: stale-settled but unresolved turn defers (UNKNOWN stays safe)', async (t) => {
  const fx = makeFixture()
  t.after(() => fx.cleanup())
  await dispatchOnce(fx)
  fx.state.now += 61 * 60_000
  fx.mutable.detailVersion = 7
  const r = await fx.engine.reconcileOnce()
  assert.deepEqual(r.staleReentry, [VISIT], 'stale settlement (turn pending)')
  const poll = await fx.engine.pollOnce()
  assert.deepEqual(poll.admissions.map((a) => a.action), ['deferred_quiescence'], 'unresolved turn defers, never bypasses')
  assert.equal(fx.calls.delivers.length, 1)
  assert.equal(fx.ledger.get(VISIT).generation, 1, 'no generation minted on deferral')
  const { planned } = readPlannedEvents(fx.eventsFile)
  assert.equal(planned.length, 1)
})

test('M5 — SIMULATED due-feed phases: OPEN excludes, RESOLVED releases, visit fence still holds', async (t) => {
  const fx = makeFixture()
  t.after(() => fx.cleanup())
  await dispatchOnce(fx)
  // OPEN phase: assistance open → the due feed carries NOTHING for this
  // intent (simulated shape of the OPEN exclusion; NOT the svc transaction).
  fx.mutable.feedItems = []
  fx.state.now += 61 * 60_000
  fx.mutable.turnState = () => 'settled'
  fx.mutable.detailVersion = 8
  const openPass = await fx.engine.pollOnce()
  assert.deepEqual(openPass.admissions, [], 'OPEN-phase feed is empty')
  assert.equal(fx.calls.delivers.length, 1)
  // RESOLVED phase: resolve releases the feed filter — the intent reappears.
  fx.mutable.detailVersion = 9
  fx.mutable.feedItems = [dueIntent()]
  const resolvedPass = await fx.engine.pollOnce()
  assert.deepEqual(resolvedPass.admissions.map((a) => a.action), ['already_attempted'], 'released feed still hits the visit fence')
  assert.equal(fx.calls.delivers.length, 1, 'feed release alone never re-delivers')
  const { planned } = readPlannedEvents(fx.eventsFile)
  assert.equal(planned.length, 1)
})

test('reader self-check — strict line reader bites: counts a synthetic gen-2 and throws on torn lines', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-assist-reader-'))
  try {
    const file = join(dir, LEDGER_EVENTS_FILE)
    const good1 = JSON.stringify({ kind: 'attempt_planned', nodeVisitId: VISIT, generation: 1 })
    const bad = '{"kind":"attempt_planned","nodeVisitId":' // torn tail
    const good2 = JSON.stringify({ kind: 'attempt_planned', nodeVisitId: VISIT, generation: 2 })
    writeFileSync(file, `${good1}\n${good2}\n`)
    const ok = readPlannedEvents(file)
    assert.equal(ok.totalLines, 2)
    assert.equal(ok.planned.length, 2, 'reader MUST count a real gen-2 line (mutation-bite sensitivity)')
    writeFileSync(file, `${good1}\n${bad}\n`)
    assert.throws(() => readPlannedEvents(file), /not valid JSON/, 'torn line must throw, never silently skip')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
