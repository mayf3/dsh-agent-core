/**
 * Deterministic unit tests for the Router reconciliation store
 * (CLAUSE-PROC-RECONCILIATION C-017..C-019 + reconciliation caps of
 * CLAUSE-PROC-BOUNDED) — packages/agent-router/src/reconciliation-store.js.
 *
 * Covers the §10.3 metadata-only rows:
 *   QUERY_PENDING_REPEATABLE, QUERY_NO_OUTPUT_REPEATABLE,
 *   QUERY_EVICTED_REPEATABLE, QUERY_RESTART_LOST_REPEATABLE,
 *   QUERY_NEVER_EXISTED_REPEATABLE, CALLER_CORRELATION_RESTORE,
 *   UNRESOLVED_RECONCILIATION_CAP_PRESSURE, ROUTER_GLOBAL_RECONCILIATION_CAP
 * plus settle-once / duplicate-conflict audit and the eviction invariants
 * (unresolved records are never evicted).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { RECONCILIATION_CAPS, TurnReconciliationStore } from '../src/reconciliation-store.js'

function minted(store, { agentId = 'agt_a', processGeneration = 1, sessionId = 'main', correlation = null } = {}) {
  return store.mintTurnExecution({ agentId, processGeneration, sessionId, callerCorrelation: correlation })
}

test('handle embeds epoch/discriminator/generation/monotonic seq; seq is continuous per agent', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-x' })
  const h1 = minted(store)
  const h2 = minted(store)
  const h3 = minted(store, { processGeneration: 2 })
  assert.match(h1, /^turn:epoch-x:a1:g1:s1$/)
  assert.match(h2, /^turn:epoch-x:a1:g1:s2$/)
  assert.match(h3, /^turn:epoch-x:a1:g2:s3$/)
  assert.deepEqual([...store.records.keys()], [h1, h2, h3])
})

test('QUERY_PENDING_REPEATABLE: two reads are byte-identical and non-consuming', () => {
  const store = new TurnReconciliationStore()
  const handle = minted(store)
  store.markAdmitted(handle, { eventWatermarkSeq: 4, promptRequestId: 'req-1' })
  store.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded', deadlineAtWallMs: 123 })
  const first = store.getTurnReconciliation(handle)
  const second = store.getTurnReconciliation(handle)
  assert.equal(first.state, 'pending')
  assert.equal(first.snapshot.initialOutcome, 'outcome_unknown')
  assert.deepEqual(first, second, 'byte-identical, non-consuming repeated read')
  assert.equal(store.occupancy().records, 1, 'the read did not delete or settle anything')
})

test('QUERY_NO_OUTPUT_REPEATABLE: settled failed record reads no_output twice, byte-identical', () => {
  const store = new TurnReconciliationStore()
  const handle = minted(store)
  store.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
  store.settleLate(handle, { lateOutcome: 'late_failed', outcomeEvidence: 'exact_turn_end_failure', terminationEvidence: 'exact_terminal_then_idle' })
  const first = store.readFinalAssistantOutput(handle)
  const second = store.readFinalAssistantOutput(handle)
  assert.deepEqual(first, second)
  assert.equal(first.state, 'no_output')
  assert.equal(first.terminalState, 'late_failed', 'no_output is distinct from an empty string')
})

test('QUERY_EVICTED_REPEATABLE: a legally issued + resolved + evicted handle reads evicted twice', () => {
  const store = new TurnReconciliationStore()
  const handles = []
  for (let index = 0; index < RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_PER_AGENT; index += 1) {
    const handle = minted(store)
    store.settleDirect(handle, { outcome: 'completed', outcomeEvidence: 'exact_turn_end_success', terminationEvidence: 'exact_terminal_then_idle' })
    handles.push(handle)
  }
  // Cap is now full of RESOLVED records; the next mint evicts oldest-first.
  const extra = minted(store)
  store.settleDirect(extra, { outcome: 'completed', outcomeEvidence: 'exact_turn_end_success', terminationEvidence: 'exact_terminal_then_idle' })
  assert.equal(store.getTurnReconciliation(handles[0]).state, 'evicted', 'oldest resolved record evicted')
  const first = store.getTurnReconciliation(handles[0])
  const second = store.getTurnReconciliation(handles[0])
  assert.deepEqual(first, second)
  assert.equal(store.readFinalAssistantOutput(handles[0]).state, 'evicted')
})

test('QUERY_RESTART_LOST_REPEATABLE: a foreign runtimeEpoch handle uniformly reads restart_lost', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'current-epoch' })
  minted(store)
  const stale = 'turn:another-epoch:a1:g1:s1'
  assert.deepEqual(store.getTurnReconciliation(stale), { state: 'restart_lost' })
  assert.deepEqual(store.getTurnReconciliation(stale), { state: 'restart_lost' })
  assert.deepEqual(store.readFinalAssistantOutput(stale), { state: 'restart_lost' })
})

test('QUERY_NEVER_EXISTED_REPEATABLE: seq beyond the high-water / unknown agent / malformed format', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'e' })
  minted(store)
  minted(store)
  for (const bad of ['turn:e:a1:g1:s3', 'turn:e:a99:g1:s1', 'not-a-handle']) {
    assert.deepEqual(store.getTurnReconciliation(bad), { state: 'never_existed' }, bad)
    assert.deepEqual(store.readFinalAssistantOutput(bad), { state: 'never_existed' }, bad)
  }
})

test('CALLER_CORRELATION_RESTORE: exact triple restores the same handle without any admission', () => {
  const store = new TurnReconciliationStore()
  const triple = { occurrenceId: 'occ-1', runId: 'run-1', requestId: 'req-1' }
  const handle = minted(store, { correlation: triple })
  store.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
  // "Restart" loses the in-memory caller reference; the exact triple restores.
  const restored = store.resolveCallerCorrelation(triple)
  assert.equal(restored.handle, handle)
  assert.equal(restored.state, 'pending')
  assert.equal(store.occupancy().records, 1, 'no new admission happened')
  assert.deepEqual(store.resolveCallerCorrelation({ occurrenceId: 'x', runId: 'y', requestId: 'z' }), { state: 'never_existed' })
})

test('caller correlation: same triple + same handle idempotent; different handle fails loud', () => {
  const store = new TurnReconciliationStore()
  const triple = { occurrenceId: 'o', runId: 'r', requestId: 'q' }
  const handle = minted(store, { correlation: triple })
  assert.equal(store.bindCallerCorrelation(triple, handle), handle, 'rebinding the same pair is idempotent')
  const other = minted(store)
  assert.throws(() => store.bindCallerCorrelation(triple, other), /already bound.*refusing rebind/)
})

test('settle-once: first winning settlement wins; duplicate + conflicting evidence only append audit', () => {
  const store = new TurnReconciliationStore()
  const handle = minted(store)
  store.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
  const won = store.settleLate(handle, { lateOutcome: 'late_completed', outcomeEvidence: 'exact_turn_end_success', terminationEvidence: 'exact_terminal_then_idle' })
  assert.equal(won.won, true)
  const duplicate = store.settleLate(handle, { lateOutcome: 'late_completed', outcomeEvidence: 'exact_turn_end_success', terminationEvidence: 'exact_terminal_then_idle' })
  assert.equal(duplicate.won, false)
  const conflict = store.settleLate(handle, { lateOutcome: 'terminated_without_outcome', terminationEvidence: 'child_real_exit' })
  assert.equal(conflict.won, false)
  const snapshot = store.getTurnReconciliation(handle).snapshot
  assert.equal(snapshot.lateOutcome, 'late_completed', 'state unchanged by duplicate/conflict')
  assert.deepEqual(snapshot.audit.map(entry => entry.kind), ['duplicate_ignored', 'conflict_ignored'])
})

test('settleDirect rejects records that already entered the late machine and vice versa', () => {
  const store = new TurnReconciliationStore()
  const handle = minted(store)
  store.markOutcomeUnknown(handle, { source: 'child_exit_without_parsed_outcome' })
  assert.throws(() => store.settleDirect(handle, { outcome: 'completed' }), /already entered outcome_unknown/)
  const direct = minted(store)
  store.settleDirect(direct, { outcome: 'completed', outcomeEvidence: 'exact_turn_end_success', terminationEvidence: 'exact_terminal_then_idle' })
  assert.equal(store.getTurnReconciliation(direct).snapshot.outcome, 'completed')
})

test('onTurnReconciled emits exactly once per winning settlement', () => {
  const store = new TurnReconciliationStore()
  const events = []
  store.onTurnReconciled((event) => events.push(event))
  const handle = minted(store)
  store.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
  store.settleLate(handle, { lateOutcome: 'late_failed', outcomeEvidence: 'exact_turn_end_failure', terminationEvidence: 'exact_terminal_then_idle' })
  store.settleLate(handle, { lateOutcome: 'late_failed', outcomeEvidence: 'exact_turn_end_failure', terminationEvidence: 'exact_terminal_then_idle' })
  assert.equal(events.length, 1)
  assert.equal(events[0].lateOutcome, 'late_failed')
})

test('UNRESOLVED_RECONCILIATION_CAP_PRESSURE: unresolved records are not evictable; the next mint fails pre-reservation', () => {
  const store = new TurnReconciliationStore()
  for (let index = 0; index < RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_PER_AGENT; index += 1) {
    const handle = minted(store)
    store.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
  }
  assert.throws(() => store.assertMintCapacity('agt_a'), /RECONCILIATION_CAPACITY_EXHAUSTED|record capacity exhausted/)
  try {
    minted(store)
    assert.fail('mint must fail loud')
  } catch (error) {
    assert.equal(error.code, 'RECONCILIATION_CAPACITY_EXHAUSTED')
  }
  assert.equal(store.occupancy().records, RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_PER_AGENT, 'existing unknowns unchanged — no eviction of unresolved')
  // A DIFFERENT agent is unaffected until the GLOBAL cap binds.
  assert.notEqual(minted(store, { agentId: 'agt_b' }), undefined)
})

test('ROUTER_GLOBAL_RECONCILIATION_CAP: global record cap rejects a mint on another agent, no eviction of unresolved', () => {
  const store = new TurnReconciliationStore()
  // Fill agents with UNRESOLVED records until the global cap binds.
  const agents = Math.ceil(RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_GLOBAL / RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_PER_AGENT) + 1
  fill: for (let agentIndex = 0; agentIndex < agents; agentIndex += 1) {
    const agentId = `agt_g${agentIndex}`
    for (let index = 0; index < RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_PER_AGENT; index += 1) {
      try {
        const handle = store.mintTurnExecution({ agentId, processGeneration: 1, sessionId: 'main' })
        store.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
      } catch {
        break fill
      }
    }
  }
  assert.equal(store.occupancy().records, RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_GLOBAL)
  assert.throws(() => store.assertMintCapacity('agt_fresh'), /record capacity exhausted/)
  assert.equal(store.occupancy().records, RECONCILIATION_CAPS.MAX_RECONCILIATION_RECORDS_GLOBAL, 'nothing was evicted to make room')
})

test('resolved eviction frees capacity: settled records are evictable, unresolved are not', () => {
  const store = new TurnReconciliationStore()
  const resolved = []
  for (let index = 0; index < 40; index += 1) {
    const handle = minted(store)
    store.settleDirect(handle, { outcome: 'completed', outcomeEvidence: 'exact_turn_end_success', terminationEvidence: 'exact_terminal_then_idle' })
    resolved.push(handle)
  }
  const unresolved = minted(store)
  store.markOutcomeUnknown(unresolved, { source: 'turn_deadline_exceeded' })
  store.evictResolvedForCapacity()
  // Resolved records remain until a cap actually forces eviction:
  assert.equal(store.occupancy().records, 41)
  assert.equal(store.getTurnReconciliation(unresolved).state, 'pending')
})
