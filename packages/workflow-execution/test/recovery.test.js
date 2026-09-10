/**
 * WORKFLOW_AGENT_EXECUTION_V2 — the controlled-recovery acceptance matrix
 * (CTR-WAE-011/012/013; Owner-ruled cases A–F plus the entry-state dispatch
 * table, the write-ahead fence discipline, the reconcile exemption, and the
 * negative surface assertions).
 *
 * Frozen invariants every case re-asserts implicitly:
 *   SECOND_ATTEMPT_ID = FORBIDDEN, SECOND_RUN = FORBIDDEN,
 *   UNKNOWN_DELIVERY != ZERO, no automatic retry of any kind.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ExecutionLedger, attemptIdFor } from '../src/ledger.js'
import { createWorkflowExecutionEngine } from '../src/engine.js'

const VISIT = 'ca11ef0a-0000-4a7e-9a3f-5d1c2b0a9e11'
const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const OWNER = '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66'
const AGENT = 'agt_writing-style-analyst-agent'
const AUTHORITY = 'OWNER_RULING_TEST_AUTHORITATION'
const STILL_CURRENT = () => ({ ok: true, body: { visibility: 'full', detail: { instance: {}, current_node_visit_id: VISIT } } })

/**
 * Engine fixture with fully mutable seams. `state.resolve.ok` models the
 * identity repair; `state.correlation` is the fresh Router correlation
 * answer; `state.detail` is the instance-detail probe body factory.
 */
function makeFixture({
  resolveOk = false,
  resolveCode = 'agent_mapping_missing',
  correlation = () => ({ state: 'never_existed' }),
  detail = STILL_CURRENT,
  deliver = () => ({ ok: true, sessionId: 'main', reconciliationHandle: 'turn:recovered-1' }),
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-recovery-'))
  const ledger = new ExecutionLedger({ dir })
  const calls = { resolves: 0, delivers: [], probes: 0, dueRequests: 0 }
  const state = { resolveOk, resolveCode, correlation, detail }
  const engine = createWorkflowExecutionEngine({
    ledger,
    log: { log: () => {}, warn: () => {}, error: () => {} },
    fetchDuePage: async () => {
      calls.dueRequests += 1
      // First page carries the due intent; the short page ends the sweep.
      return calls.dueRequests === 1
        ? { ok: true, items: [{
            dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE,
            ownerPrincipalId: OWNER, nextEligibleAt: '2026-09-10T01:00:00Z',
            createdAt: '2026-09-10T00:00:00Z', updatedAt: '2026-09-10T00:30:00Z',
          }] }
        : { ok: true, items: [] }
    },
    resolvePrincipalToAgent: async () => {
      calls.resolves += 1
      return state.resolveOk ? { ok: true, agentId: AGENT } : { ok: false, code: state.resolveCode }
    },
    deliverRun: async (req) => {
      calls.delivers.push(req)
      return deliver(req)
    },
    getTurnReconciliation: () => ({ state: 'never_existed' }),
    resolveCallerCorrelation: ({ requestId }) => state.correlation({ requestId }),
    readInstanceDetail: async () => {
      calls.probes += 1
      return state.detail()
    },
  })
  const eventsFile = () => join(dir, 'attempts.jsonl')
  const eventsBytes = () => (statSync(eventsFile(), { throwIfNoEntry: false })?.size ?? 0)
  const cleanup = () => rmSync(dir, { recursive: true, force: true })
  return { engine, ledger, calls, state, eventsFile, eventsBytes, cleanup }
}

/** Drive one failing poll so the attempt exists in the blocked phase. */
async function seedBlocked(engine) {
  const pass = await engine.pollOnce()
  assert.equal(pass.admissions[0].action, 'blocked')
  return attemptIdFor(VISIT)
}

test('A: resolve fail → zero Run → identity repaired → explicit recovery → exactly ONE Run, same attemptId', async () => {
  const fx = makeFixture({ resolveOk: false })
  try {
    const attemptId = await seedBlocked(fx.engine)
    fx.state.resolveOk = true // the identity repair, through its own authority
    assert.equal(fx.calls.delivers.length, 0)
    assert.equal(fx.ledger.get(VISIT).delivered, undefined)

    fx.state.resolveOk = true // the identity repair, through its own authority
    const result = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })
    assert.equal(result.outcome, 'RECOVERED_RUN_ADMITTED')
    assert.equal(result.attemptId, attemptId, 'the SAME deterministic attempt continues')
    assert.equal(fx.calls.delivers.length, 1)
    assert.equal(fx.calls.delivers[0].requestId, attemptId)

    const attempt = fx.ledger.get(VISIT)
    assert.equal(attempt.phase, 'run_delivered')
    assert.equal(attempt.attemptId, attemptId)
    // The write-ahead ordering is visible in the file: delivery_started is
    // durably on disk BEFORE the run_delivered linkage line.
    const raw = readFileSync(fx.eventsFile(), 'utf8')
    assert.ok(raw.indexOf('"kind":"delivery_started"') < raw.indexOf('"kind":"run_delivered"'),
      'delivery_started must precede run_delivered in the append-only stream')
    assert.ok(raw.includes('"kind":"recovery_authorized"'))
    assert.ok(raw.includes(`"authorityRef":"${AUTHORITY}"`))
  } finally {
    fx.cleanup()
  }
})

test('B: replaying the recovery command after completion → NO_OP_TERMINAL, zero appends', async () => {
  const fx = makeFixture({ resolveOk: false })
  try {
    await seedBlocked(fx.engine)
    fx.state.resolveOk = true // the identity repair, through its own authority
    const first = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })
    assert.equal(first.outcome, 'RECOVERED_RUN_ADMITTED')
    const sizeBefore = fx.eventsBytes()

    const replay = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })
    assert.equal(replay.outcome, 'RECOVERY_INAPPLICABLE')
    assert.equal(replay.evidenceClass, 'delivery_domain:run_delivered',
      'the admitted Run linkage is delivery-domain evidence — zero recovery append/admission')
    assert.equal(fx.eventsBytes(), sizeBefore, 'a replayed recovery appends nothing')
    assert.equal(fx.calls.delivers.length, 1, 'never a second Run')
  } finally {
    fx.cleanup()
  }
})

test('C: two concurrent recovery invocations → one recovery owner, at most one Run', async () => {
  const fx = makeFixture({ resolveOk: false })
  try {
    await seedBlocked(fx.engine)
    fx.state.resolveOk = true // the identity repair, through its own authority
    const [a, b] = await Promise.all([
      fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY }),
      fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: `${AUTHORITY}-2` }),
    ])
    const outcomes = [a.outcome, b.outcome]
    const admitted = outcomes.filter((o) => o === 'RECOVERED_RUN_ADMITTED')
    assert.equal(admitted.length, 1, 'exactly one recovery owner')
    assert.ok(outcomes.includes('RECOVERED_RUN_ADMITTED'))
    assert.equal(fx.calls.delivers.length, 1, 'the loser never prepares a second delivery')
    const raw = readFileSync(fx.eventsFile(), 'utf8')
    assert.equal(raw.split('"kind":"delivery_started"').length - 1, 1, 'at most one delivery_started')
    assert.equal(raw.split('"kind":"run_delivered"').length - 1, 1)
  } finally {
    fx.cleanup()
  }
})

test('D: crash after authorization but before delivery_started → still recoverable, later invocation proceeds', async () => {
  const fx = makeFixture({ resolveOk: false })
  try {
    await seedBlocked(fx.engine)
    fx.state.resolveOk = true // the identity repair, through its own authority
    // A prior authorized recovery crashed between its authorization append
    // and any delivery-side effect (nothing durable beyond the event).
    await fx.ledger.recordRecoveryAuthorized({ nodeVisitId: VISIT, authorityRef: 'EARLIER_CRASHED_RUN' })

    fx.state.resolveOk = true
    const result = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })
    assert.equal(result.outcome, 'RECOVERED_RUN_ADMITTED')
    const raw = readFileSync(fx.eventsFile(), 'utf8')
    assert.equal(raw.split('"kind":"recovery_authorized"').length - 1, 2, 'both authorizations are on the record')
    assert.equal(raw.split('"kind":"run_delivered"').length - 1, 1)
  } finally {
    fx.cleanup()
  }
})

test('E: crash after delivery_started before run_delivered → NOT recoverable, reconcile lands NEEDS_REVIEW', async () => {
  const fx = makeFixture({ resolveOk: false })
  try {
    await seedBlocked(fx.engine)
    fx.state.resolveOk = true // the identity repair, through its own authority
    await fx.ledger.recordRecoveryAuthorized({ nodeVisitId: VISIT, authorityRef: 'CRASHED_MID_DELIVERY' })
    await fx.ledger.recordDeliveryStarted({ nodeVisitId: VISIT }) // crash here

    const result = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })
    assert.equal(result.outcome, 'RECOVERY_INAPPLICABLE')
    assert.equal(result.evidenceClass, 'delivery_domain:delivery_started')
    assert.equal(fx.calls.delivers.length, 0, 'never a second delivery')

    // The unchanged V1 machinery owns it: reconcile lands delivery_unverified.
    const reconciled = await fx.engine.reconcileOnce()
    assert.equal(reconciled.needsReview.length, 1)
    assert.equal(fx.ledger.get(VISIT).state, 'NEEDS_REVIEW')
  } finally {
    fx.cleanup()
  }
})

test('STORE-FALSE-NEGATIVE: delivery_started present + Router answers never_existed → STILL not recoverable', async () => {
  const fx = makeFixture({ resolveOk: false, correlation: () => ({ state: 'never_existed' }) })
  try {
    await seedBlocked(fx.engine)
    fx.state.resolveOk = true // the identity repair, through its own authority
    await fx.ledger.recordDeliveryStarted({ nodeVisitId: VISIT }) // crashed mid-delivery; correlation index lost

    const result = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })
    assert.equal(result.outcome, 'RECOVERY_INAPPLICABLE')
    assert.equal(result.evidenceClass, 'delivery_domain:delivery_started',
      'the ledger write-ahead record is the PRIMARY fence; the store answer can never override it')
    assert.equal(fx.calls.delivers.length, 0)
  } finally {
    fx.cleanup()
  }
})

test('E1: no authorityRef → the call is refused with zero ledger effect', async () => {
  const fx = makeFixture({ resolveOk: false })
  try {
    await seedBlocked(fx.engine)
    fx.state.resolveOk = true // the identity repair, through its own authority
    const sizeBefore = fx.eventsBytes()
    for (const args of [{ nodeVisitId: VISIT }, { nodeVisitId: VISIT, authorityRef: '' }]) {
      const result = await fx.engine.recoverAttempt(args)
      assert.equal(result.outcome, 'REFUSED_CALL')
    }
    assert.equal(fx.eventsBytes(), sizeBefore)
  } finally {
    fx.cleanup()
  }
})

test('E2/E3: no attempt → NO_OP_NO_ATTEMPT; terminal attempt → NO_OP_TERMINAL with zero appends', async () => {
  const fx = makeFixture({ resolveOk: false })
  try {
    assert.equal((await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })).outcome, 'NO_OP_NO_ATTEMPT')

    await seedBlocked(fx.engine)
    fx.state.resolveOk = true // the identity repair, through its own authority
    await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY }) // completes → run_delivered
    await fx.ledger.recordReconciled({ nodeVisitId: VISIT, expectedPhase: 'run_delivered', verdict: 'SETTLED', judgment: 'business_commitment_observed', reason: 'node_visit_no_longer_current' })
    const sizeBefore = fx.eventsBytes()
    const replay = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })
    assert.equal(replay.outcome, 'NO_OP_TERMINAL')
    assert.equal(fx.eventsBytes(), sizeBefore)
  } finally {
    fx.cleanup()
  }
})

test('E4 classes: planned-only shape, pending correlation, missing correlation seam, delivery-domain phases', async () => {
  // planned-only (no resolution_blocked evidence) is NOT eligible — the V1
  // reconcile path owns it (conservative: retroactive zero-proof is unprovable).
  {
    const fx = makeFixture({ resolveOk: false })
    try {
      await fx.ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
      const result = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })
      assert.equal(result.outcome, 'RECOVERY_INAPPLICABLE')
      assert.equal(result.evidenceClass, 'not_pre_admission_blocked')
    } finally { fx.cleanup() }
  }
  // Router correlation answers anything but never_existed → refuse.
  for (const state of ['pending', 'settled', 'evicted', 'restart_lost']) {
    const fx = makeFixture({ resolveOk: false, correlation: () => ({ state }) })
    try {
      await seedBlocked(fx.engine)
      fx.state.resolveOk = true // the identity repair, through its own authority
      const result = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })
      assert.equal(result.outcome, 'RECOVERY_INAPPLICABLE')
      assert.equal(result.evidenceClass, `router_correlation:${state}`)
      assert.equal(fx.calls.delivers.length, 0)
    } finally { fx.cleanup() }
  }
  // Missing correlation seam → fail closed.
  {
    const fx = makeFixture({ resolveOk: false })
    try {
      await seedBlocked(fx.engine)
      fx.state.resolveOk = true // the identity repair, through its own authority
      // Replace the engine with one built without the correlation seam.
      const bare = createWorkflowExecutionEngine({
        ledger: fx.ledger,
        log: {},
        fetchDuePage: async () => ({ ok: true, items: [] }),
        resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
        deliverRun: async () => ({ ok: true, sessionId: 'main' }),
        getTurnReconciliation: () => ({ state: 'never_existed' }),
        readInstanceDetail: async () => STILL_CURRENT(),
      })
      const result = await bare.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })
      assert.equal(result.outcome, 'RECOVERY_INAPPLICABLE')
      assert.equal(result.evidenceClass, 'router_correlation_unavailable')
    } finally { fx.cleanup() }
  }
  // delivery_rejected stays terminal (NO_OP_TERMINAL, not INAPPLICABLE).
  {
    const fx = makeFixture({ resolveOk: false, deliver: () => ({ ok: false, code: 'AGENT_DISABLED' }) })
    try {
      await seedBlocked(fx.engine)
      fx.state.resolveOk = true // the identity repair, through its own authority
      const rejected = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })
      assert.equal(rejected.outcome, 'DELIVERY_REJECTED:AGENT_DISABLED')
      assert.equal(fx.ledger.get(VISIT).state, 'NEEDS_REVIEW')
      const replay = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })
      assert.equal(replay.outcome, 'NO_OP_TERMINAL')
    } finally { fx.cleanup() }
  }
})

test('E5: world drift (visit no longer current) → recovery_refused → terminal NEEDS_REVIEW', async () => {
  const fx = makeFixture({
    resolveOk: false,
    detail: () => ({ ok: true, body: { visibility: 'full', detail: { instance: {}, current_node_visit_id: 'dddc2f0a-3f19-4a7e-9a3f-5d1c2b0a9eee' } } }),
  })
  try {
    await seedBlocked(fx.engine)
    fx.state.resolveOk = true // the identity repair, through its own authority
    const result = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })
    assert.equal(result.outcome, 'RECOVERY_REFUSED')
    assert.equal(result.refused, 'node_visit_no_longer_current')
    assert.equal(fx.calls.delivers.length, 0)
    assert.equal(fx.ledger.get(VISIT).state, 'NEEDS_REVIEW')
    assert.match(fx.ledger.get(VISIT).reason, /^recovery_refused:node_visit_no_longer_current$/)
  } finally {
    fx.cleanup()
  }
})

test('E5: unreadable instance state → refused (fail-closed), zero admission', async () => {
  const fx = makeFixture({ resolveOk: false, detail: () => ({ ok: false, code: 'gateway_503' }) })
  try {
    await seedBlocked(fx.engine)
    fx.state.resolveOk = true // the identity repair, through its own authority
    const result = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })
    assert.equal(result.outcome, 'RECOVERY_REFUSED')
    assert.equal(result.refused, 'instance_state_unavailable:gateway_503')
    assert.equal(fx.calls.delivers.length, 0)
  } finally {
    fx.cleanup()
  }
})

test('Identity NOT yet repaired: recovery re-blocks with zero Runs (designed interim behavior)', async () => {
  const fx = makeFixture({ resolveOk: false })
  try {
    await seedBlocked(fx.engine)
    // identity stays UNREPAIRED here — that is the case under test
    const blockedBefore = fx.ledger.get(VISIT).blockedCount ?? 0
    const result = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: AUTHORITY })
    assert.equal(result.outcome, 'STILL_BLOCKED:agent_mapping_missing')
    assert.equal(fx.calls.delivers.length, 0, 'zero Runs while identity is unrepaired')
    assert.equal(fx.ledger.get(VISIT).state, 'ACTIVE')
    assert.equal(fx.ledger.get(VISIT).phase, 'resolution_blocked')
    assert.equal(fx.ledger.get(VISIT).blockedCount, blockedBefore + 1, 'a fresh blocked fact is appended')
  } finally {
    fx.cleanup()
  }
})

test('Ledger discipline: at-most-one delivery_started (second = corrupt fail-loud); resolve_failed: is not a writable delivery_failed reason', async () => {
  const fx = makeFixture()
  try {
    await fx.ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    await fx.ledger.recordDeliveryStarted({ nodeVisitId: VISIT })
    await assert.rejects(() => fx.ledger.recordDeliveryStarted({ nodeVisitId: VISIT }), /corrupt ledger — delivery_started twice/)
    await assert.rejects(() => fx.ledger.recordDeliveryFailed({ nodeVisitId: VISIT, reason: 'resolve_failed:agent_mapping_missing' }), /recordResolutionBlocked/)
  } finally {
    fx.cleanup()
  }
})

test('Surface discipline: recovery is engine/runtime-component surface only — no broker capability exposes it', async () => {
  const fx = makeFixture()
  try {
    assert.equal(typeof fx.engine.recoverAttempt, 'function')
    const capabilitiesDir = join(import.meta.dirname, '../../broker/src/capabilities')
    const offenders = []
    for (const file of readdirSync(capabilitiesDir).filter((f) => f.endsWith('.js'))) {
      const text = readFileSync(join(capabilitiesDir, file), 'utf8')
      if (/workflow[_-]?(execution[_-]?)?recover|recoverAttempt|recovery_authorized/i.test(text)) offenders.push(file)
    }
    assert.deepEqual(offenders, [], 'no model-facing broker capability may expose recovery')
  } finally {
    fx.cleanup()
  }
})
