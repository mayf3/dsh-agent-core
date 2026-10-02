/**
 * C11-R3 (Product #426) — startup previous-epoch convergence matrix, Router
 * side (DONE_WHEN B5–B7, C8; matrix rows 2, 4, 5, 6, 8).
 *
 * These are the existing-authority behaviors the restart-safety goal depends
 * on, pinned against the REAL durable store:
 *
 *   row 2 — crash/restart after prompt write classifies the previous epoch
 *           WITHOUT replay: outcome_unknown + blocked +
 *           runtime_restart_ownership_unavailable + active fence; never a
 *           settled business outcome, never fabricated exit evidence.
 *   row 4 — durable real-exit observation routes termination-only: a record
 *           with a durably observed child exit settles (only) as
 *           terminated_without_outcome + child_real_exit.
 *   row 5 — HR restart-lost abandonment stays exceptional and honest: the
 *           accepted admin authority stamps a DECISION (never termination
 *           evidence), keeps business UNKNOWN + fence, and unblocks exactly
 *           that agent's NEW-request admission.
 *   row 6 — repeated restart is idempotent: reclassification settles once,
 *           audit does not grow, fence state does not flap.
 *   row 8 — an unrelated Agent is unaffected: another agent with no records
 *           (or its own settled history) keeps open admission throughout.
 *
 * The model/Agent never chooses among recovery paths: every classification
 * here is produced by the store's own startup machinery from durable
 * evidence + accepted policy.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { TurnReconciliationStore } from '../../../agent-router/src/reconciliation-store.js'

function tempFile(t, name) {
  const root = mkdtempSync(join(tmpdir(), 'restart-convergence-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return join(root, name)
}

/** Seed one turn that wrote its prompt and then lost its runtime (crash). */
function seedPromptWriteCrash(file, { agentId = 'agt_a', epoch = 'epoch-1' } = {}) {
  const store = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: epoch })
  const handle = store.mintTurnExecution({ agentId, processGeneration: 7, sessionId: 'normal' })
  store.markAdmitted(handle, { eventWatermarkSeq: 2, promptRequestId: `req:${handle}`, deadlineAtWallMs: Date.now() + 60_000 })
  store.markPromptWriteAttempted(handle)
  return { handle, agentId, epoch }
}

test('row 2: crash after prompt write classifies the previous epoch without replay', (t) => {
  const file = tempFile(t, 'turn-recovery-v3.json')
  const seeded = seedPromptWriteCrash(file)

  // Next epoch boots: the constructor loads the durable store and runs the
  // real startup classification (restoreCrashInterruptedRecords).
  const next = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'epoch-2' })
  const query = next.getTurnReconciliation(seeded.handle)
  assert.equal(query.state, 'recovering', 'the handle stays queryable across epochs — never restart_lost for V3 records')
  const snapshot = query.snapshot
  assert.equal(snapshot.initialOutcome, 'outcome_unknown')
  assert.equal(snapshot.initialSource, 'runtime_restart_after_prompt_write')
  assert.equal(snapshot.recoveryState, 'blocked')
  assert.equal(snapshot.failureReason, 'runtime_restart_ownership_unavailable')
  assert.equal(snapshot.fenceState, 'active', 'the agent fence stays armed')
  assert.equal(snapshot.outcome, null, 'NO business outcome is invented')
  assert.equal(snapshot.lateOutcome, null, 'NO late outcome is invented')
  assert.equal(snapshot.terminationEvidence, null, 'NO termination evidence is invented')
  assert.equal(snapshot.exitObservedAt, null, 'NO exit observation is invented')
  assert.deepEqual(snapshot.missingEvidence, ['live_generation_ownership'])

  // No replay: the record never settles by itself and cannot be re-admitted.
  assert.equal(next.admissionBlockerForAgent(seeded.agentId)?.handle, seeded.handle,
    'NEW admission for the agent stays fail-closed until an accepted authority acts')
  assert.equal(next.businessAdmissionStatus().ready, true, 'the durable store itself is healthy (per-agent fence, not store-level lock)')
})

test('row 4: durable real-exit observation routes termination-only (child_real_exit), never business', (t) => {
  const file = tempFile(t, 'turn-recovery-v3.json')
  const seeded = seedPromptWriteCrash(file)
  // The OLD runtime observed the exact child real exit before it died — the
  // only path that ever stamps exitObservedAt.
  const dying = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: seeded.epoch })
  dying.markExitObserved(seeded.handle)

  const next = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'epoch-2' })
  const snapshot = next.getTurnReconciliation(seeded.handle).snapshot
  assert.equal(next.getTurnReconciliation(seeded.handle).state, 'settled')
  assert.equal(snapshot.lateOutcome, 'terminated_without_outcome',
    'termination-only: the business outcome stays unknown, the termination is declared')
  assert.equal(snapshot.terminationEvidence, 'child_real_exit')
  assert.equal(snapshot.outcome, null, 'still no business outcome exists')
  assert.ok(snapshot.exitObservedAt !== null, 'the exact real-exit observation is the ONLY exit stamp')
})

test('row 5: HR restart-lost abandonment stays exceptional and honest', (t) => {
  const file = tempFile(t, 'turn-recovery-v3.json')
  const seeded = seedPromptWriteCrash(file)
  const store = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'epoch-2' })
  assert.equal(store.stuckFenceWithoutDurableExitEvidenceForAgent(seeded.agentId)?.handle, seeded.handle,
    'the restart-lost class is the admin entry-gate class (no durable exit evidence)')

  const declarationId = 'hr-reset-test-b0-r1'
  const result = store.declareAdminAbandonment({ agentId: seeded.agentId, declarationId, ownerRiskAcceptance: true })
  assert.deepEqual(result.abandonedHandles, [seeded.handle])

  const snapshot = store.getTurnReconciliation(seeded.handle).snapshot
  assert.equal(snapshot.initialOutcome, 'outcome_unknown', 'the business outcome stays UNKNOWN')
  assert.equal(snapshot.terminationEvidence, null, 'the risk acceptance is a DECISION, never fabricated evidence')
  assert.equal(snapshot.exitObservedAt, null)
  assert.equal(snapshot.fenceState, 'active', 'the record stays fenced (no-replay)')
  const declarations = store.adminAbandonmentsForAgent(seeded.agentId)
  assert.equal(declarations.length, 1)
  assert.equal(declarations[0].declarationId, declarationId)
  assert.deepEqual(declarations[0].handles, [seeded.handle])
  assert.equal(store.admissionBlockerForAgent(seeded.agentId), null,
    'C8: after the accepted recovery action, the abandoned turn no longer blocks NEW admission')

  // Idempotent retry of the SAME declaration; a KNOWN declarationId rebinds
  // never (a different agent with the same id conflicts loud).
  const retry = store.declareAdminAbandonment({ agentId: seeded.agentId, declarationId, ownerRiskAcceptance: true })
  assert.equal(retry.abandonedHandles.length, 0)
  assert.throws(() => store.declareAdminAbandonment({ agentId: 'agt_other', declarationId, ownerRiskAcceptance: true }),
    (error) => error?.code === 'RECONCILIATION_DECLARATION_CONFLICT')
})

test('row 6: repeated restart reclassifies idempotently (settle-once, no audit growth, no fence flap)', (t) => {
  const file = tempFile(t, 'turn-recovery-v3.json')
  const seeded = seedPromptWriteCrash(file)
  const projectionAfter = (store) => {
    const snapshot = store.getTurnReconciliation(seeded.handle).snapshot
    return JSON.stringify([snapshot.initialOutcome, snapshot.recoveryState, snapshot.failureReason,
      snapshot.fenceState, snapshot.attemptedActions.length, snapshot.audit.length])
  }
  const first = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'epoch-2' })
  const projection = projectionAfter(first)
  for (let i = 0; i < 3; i += 1) {
    const again = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: `epoch-reopen-${i}` })
    assert.equal(projectionAfter(again), projection, `reopen #${i + 1}: identical classification`)
  }
  // The abandoned variant is equally stable across restarts.
  first.declareAdminAbandonment({ agentId: seeded.agentId, declarationId: 'idem-decl', ownerRiskAcceptance: true })
  const stamped = JSON.stringify(first.getTurnReconciliation(seeded.handle).snapshot)
  const reopened = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'epoch-final' })
  assert.equal(JSON.stringify(reopened.getTurnReconciliation(seeded.handle).snapshot), stamped,
    'the abandonment stamp survives restart byte-stable')
  assert.equal(reopened.admissionBlockerForAgent(seeded.agentId), null)
})

test('row 8: an unrelated Agent is unaffected by another agent\'s unresolved fence', (t) => {
  const file = tempFile(t, 'turn-recovery-v3.json')
  const blocked = seedPromptWriteCrash(file, { agentId: 'agt_blocked' })
  const store = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'epoch-2' })
  assert.notEqual(store.admissionBlockerForAgent('agt_blocked'), null)

  // A fresh agent with no records at all keeps open admission.
  assert.equal(store.admissionBlockerForAgent('agt_unrelated'), null)
  // ...and so does an agent whose only history is a settled turn.
  const fresh = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'epoch-2' })
  const okHandle = fresh.mintTurnExecution({ agentId: 'agt_settled', processGeneration: 1, sessionId: 'normal' })
  fresh.markAdmitted(okHandle, { eventWatermarkSeq: 0, promptRequestId: `req:${okHandle}`, deadlineAtWallMs: Date.now() + 60_000 })
  fresh.settleDirect(okHandle, { outcome: 'completed', outcomeEvidence: 'ok' })
  assert.equal(fresh.admissionBlockerForAgent('agt_settled'), null)
  assert.notEqual(fresh.admissionBlockerForAgent('agt_blocked')?.handle, undefined,
    'the blocked agent stays blocked; the others stay open — per-agent fault radius')

  // Recovery for the blocked agent never touches the settled history.
  fresh.declareAdminAbandonment({ agentId: 'agt_blocked', declarationId: 'scope-decl', ownerRiskAcceptance: true })
  assert.deepEqual(fresh.adminAbandonmentsForAgent('agt_settled'), [])
  void blocked
})
