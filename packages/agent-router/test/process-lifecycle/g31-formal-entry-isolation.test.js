// R131/g31 isolated formal-entry coverage check.
// This is a local fixture only: no production abandonment is executed.
import assert from 'node:assert/strict'
import test from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation-store.js'

const AGENT = 'agt_article-publisher-agent-g31s841'
const OTHER = 'agt_other-agent'
const DECLARATION = 'fence-repair-20261107-auto-fence-agt_article-publisher-agent-g31s841'

function unknownFence(store, agentId, requestId) {
  const handle = store.mintTurnExecution({
    agentId,
    processGeneration: 31,
    sessionId: 's841',
    callerCorrelation: { requestId },
  })
  store.markPromptWriteAttempted(handle)
  store.markOutcomeUnknown(handle, { source: 'g31-isolated-fixture' })
  store.markRecoveryBlocked(handle, ['live_generation_ownership'], 'runtime_restart_ownership_unavailable')
  return handle
}

test('g31 formal entry: declaration-only marker is COMPLETED by same-declaration re-entry with owner acceptance', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'g31-isolated-epoch' })
  const g31 = unknownFence(store, AGENT, 'g31-s841-request')
  const other = unknownFence(store, OTHER, 'other-request')

  // Reproduce the reported production shape through the formal entry: marker
  // exists, audit is empty, missingEvidence is live_generation_ownership, fence active.
  const first = store.declareAdminAbandonment({ agentId: AGENT, declarationId: DECLARATION })
  assert.deepEqual(first.abandonedHandles, [g31])
  const before = store.records.get(g31)
  assert.deepEqual(before.adminAbandonment.declarationId, DECLARATION)
  assert.equal(before.audit.length, 0)
  assert.equal(before.missingEvidence[0], 'live_generation_ownership')
  assert.equal(before.fenceState, 'active')

  // R131 succession (#1374 2026-11-10): the SAME declarationId re-entry with
  // the explicit owner decision COMPLETES the declaration-only scope — the
  // acceptance audit lands atomically, admission stays unblocked, and the
  // UNKNOWN / active-fence / no-replay invariants are untouched.
  const retry = store.declareAdminAbandonment({
    agentId: AGENT,
    declarationId: DECLARATION,
    ownerRiskAcceptance: true,
  })
  const after = store.records.get(g31)
  assert.deepEqual(retry.scopeHandles, [g31])
  assert.deepEqual(retry.completedHandles, [g31], 'declaration-only marker is completed by owner acceptance')
  assert.equal(after.audit.some(e => e.kind === 'owner_risk_acceptance_unproven_termination'), true,
    'acceptance audit lands via the formal entry')
  assert.equal(after.adminAbandonment.declarationId, DECLARATION)
  assert.equal(after.fenceState, 'active', 'fence stays active (never cleared without termination proof)')
  assert.equal(after.initialOutcome, 'outcome_unknown', 'UNKNOWN preserved (no fabricated termination)')
  assert.equal(after.terminationEvidence ?? null, null)
  assert.equal(after.exitObservedAt ?? null, null)
  assert.equal(store.activeFenceForAgent(AGENT)?.handle, g31)
  assert.throws(() => store.mintTurnExecution({
    agentId: AGENT,
    processGeneration: 31,
    sessionId: 's841',
    callerCorrelation: { requestId: 'g31-s841-request' },
  }), error => error.code === 'RECONCILIATION_CORRELATION_CONFLICT')

  // Idempotent: a further retry never restamps.
  const auditLen = after.audit.length
  const retry2 = store.declareAdminAbandonment({
    agentId: AGENT,
    declarationId: DECLARATION,
    ownerRiskAcceptance: true,
  })
  assert.deepEqual(retry2.completedHandles, [], 'already-accepted record is never restamped')
  assert.equal(store.records.get(g31).audit.length, auditLen)

  // Scope does not spill to another record/agent.
  assert.equal(store.admissionBlockerForAgent(OTHER)?.handle, other)
  assert.equal(store.records.get(other).adminAbandonment ?? null, null)
  assert.equal(store.records.get(other).audit.length, 0)

  // A different declarationId cannot complete the existing declaration scope.
  const different = store.declareAdminAbandonment({ agentId: AGENT, declarationId: `${DECLARATION}-different` })
  assert.deepEqual(different.abandonedHandles, [])
  assert.equal(store.records.get(g31).adminAbandonment.declarationId, DECLARATION)
})

test('g31 declaration-only retry WITHOUT owner decision stays a no-op (no fabricated acceptance)', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'g31-isolated-epoch-no-acceptance' })
  const g31 = unknownFence(store, AGENT, 'g31-s841-request')
  const first = store.declareAdminAbandonment({ agentId: AGENT, declarationId: DECLARATION })
  assert.deepEqual(first.abandonedHandles, [g31])

  const retry = store.declareAdminAbandonment({ agentId: AGENT, declarationId: DECLARATION })
  assert.deepEqual(retry.completedHandles, [], 'declaration-only retry without owner decision records nothing')
  const after = store.records.get(g31)
  assert.equal(after.audit.length, 0, 'no acceptance audit without the owner decision')
  assert.equal(after.fenceState, 'active')
  assert.equal(store.admissionBlockerForAgent(AGENT), null, 'admission projection unchanged (marker exclusion)')
})
