/**
 * Product #468 (EPIC D / D3) — "HR reset as a complete product operation"
 * DONE_WHEN convergence evidence, VERIFY_ONLY (no source change).
 *
 * The existing suites pin the store contract (admin-abandonment.test.js), the
 * startup classification matrix (restart-convergence-matrix.test.js) and the
 * HTTP entry gates (admin-turn-abandonment-api.test.js). This file adds the
 * one end-to-end pass those suites do not pin TOGETHER: after a SUCCESSFUL
 * reset, every reset-owned surface converges at once through the REAL wired
 * rig (durable store + process registry + ingress delivery):
 *
 *   no-join      — the next HR request completes on a NEW reconciliation
 *                  handle; the old handle is never adopted, never replayed,
 *                  and its caller-correlation entry keeps resolving as the
 *                  no-replay marker (an identical correlation mint conflicts).
 *   occupancy    — the reset carries no process/queue occupancy (EMPTY slot,
 *                  zero prompts sent by the reset itself) and the post-reset
 *                  request runs on a fresh generation whose live executions
 *                  never contain the old handle.
 *   session/join — the SAME agent through the SAME user entry resumes on the
 *                  SAME session id with a NEW handle (no cross-attribution).
 *   records      — the abandoned record keeps its honest state (fenced +
 *                  UNKNOWN, or settled-terminated with its evidence intact).
 *   audit        — the D6 owner-decision audit stays on the record; the
 *                  declaration registry stays readable through the entry.
 *   radius       — an unrelated Agent completes its own turns before AND
 *                  after the HR-only reset.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  call,
  CTO_TOKEN,
  evidencedStuckTurn,
  hrRig,
  HR,
  mount,
  OTHER,
  restartLostRig,
  TurnReconciliationStore,
} from './admin-turn-abandonment-helpers.mjs'

const OLD_CORRELATION = { occurrenceId: 'occ-d3', runId: 'run-d3', requestId: 'req-d3-old' }

/** Evidence-bearing restart class whose old turn carries a caller correlation. */
function correlatedEvidencedRestartRig(t, root) {
  const persistenceFile = join(root, 'turn-recovery.json')
  const crashed = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'd3-epoch-crashed' })
  const oldHandle = crashed.mintTurnExecution({
    agentId: HR, processGeneration: 1, sessionId: 'main', callerCorrelation: OLD_CORRELATION,
  })
  crashed.markPromptWriteAttempted(oldHandle)
  crashed.markOutcomeUnknown(oldHandle, { source: 'd3-fixture' })
  crashed.claimRecovery(oldHandle, { operationId: 'd3-reap-fixture', claimantRuntimeEpoch: 'd3-epoch-crashed' })
  crashed.markExitObserved(oldHandle)
  const rig = hrRig(root, 'd3-epoch-restarted')
  assert.equal(rig.store.records.get(oldHandle)?.state, 'settled')
  assert.equal(rig.store.records.get(oldHandle)?.fenceState, 'active')
  assert.equal(rig.store.admissionBlockerForAgent(HR)?.handle, oldHandle,
    'the fence blocks NEW admission before the reset')
  return { rig, oldHandle }
}

test('D3: after a successful reset the next HR turn mints a NEW handle — the old handle is never joined', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-d3-nojoin-'))
  const { rig, oldHandle } = correlatedEvidencedRestartRig(t, root)
  const { base } = await mount(t, { routerFacade: rig })

  // No-replay marker survives the restart: the old correlation still resolves
  // to the old handle, and replaying it cannot mint a second authority.
  assert.equal(rig.store.resolveCallerCorrelation(OLD_CORRELATION).handle, oldHandle)
  assert.throws(() => rig.store.mintTurnExecution({
    agentId: HR, processGeneration: 1, sessionId: 'main', callerCorrelation: OLD_CORRELATION,
  }), error => error.code === 'RECONCILIATION_CORRELATION_CONFLICT')

  const pre = await rig.request('HR request before reset')
  assert.equal(pre?.reply, undefined, 'pre-reset HR request does not complete')
  assert.equal(rig.store.admissionBlockerForAgent(HR)?.handle, oldHandle,
    'the old handle is the exact pre-reset admission blocker')

  const reset = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'd3-nojoin-1' }, token: CTO_TOKEN,
  })
  assert.equal(reset.status, 200, JSON.stringify(reset.body))
  assert.deepEqual(reset.body.abandonedHandles, [oldHandle])

  const next = await rig.request('HR request after reset')
  assert.equal(next?.reply, 'fixture-ok', JSON.stringify(next))
  assert.equal(next.agentId, HR)
  assert.equal(next.sessionId, 'main', 'SAME user entry, SAME session — continuity by design')
  assert.ok(next.reconciliationHandle, 'the completed turn carries its own reconciliation handle')
  assert.notEqual(next.reconciliationHandle, oldHandle, 'the new turn NEVER joins the old handle')

  // The old record keeps its honest state and identity; its no-replay marker
  // still wins over any later mint.
  const oldRecord = rig.store.records.get(oldHandle)
  assert.equal(oldRecord.handle, oldHandle)
  assert.equal(oldRecord.state, 'settled', 'the abandonment never rewrites the settlement')
  assert.equal(oldRecord.terminationEvidence, 'child_real_exit', 'evidence untouched')
  assert.equal(oldRecord.fenceState, 'active')
  assert.equal(oldRecord.adminAbandonment?.declarationId, 'd3-nojoin-1')
  assert.equal(rig.store.resolveCallerCorrelation(OLD_CORRELATION).handle, oldHandle)
  assert.throws(() => rig.store.mintTurnExecution({
    agentId: HR, processGeneration: 2, sessionId: 'main', callerCorrelation: OLD_CORRELATION,
  }), error => error.code === 'RECONCILIATION_CORRELATION_CONFLICT')

  // Declarations stay readable through the entry, bound to the exact scope.
  const read = await call(base, `/agent-process/turn-abandonment?agentId=${encodeURIComponent(HR)}`, { token: CTO_TOKEN })
  assert.equal(read.status, 200)
  assert.deepEqual(read.body.declarations[0].handles, [oldHandle])
  rmSync(root, { recursive: true, force: true })
})

test('D3 (D6 restart-lost class): reset converges with zero occupancy — nothing replayed, nothing carried, unrelated Agent unaffected', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-d3-occupancy-'))
  const { rig, oldHandle } = await restartLostRig(t, root)
  const { base } = await mount(t, { routerFacade: rig })

  // While HR is fenced, an unrelated Agent completes its own turn normally.
  const otherBefore = await rig.request('unrelated agent before reset', OTHER)
  assert.equal(otherBefore?.reply, 'fixture-ok', JSON.stringify(otherBefore))

  const entryGate = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'd3-occ-0' }, token: CTO_TOKEN,
  })
  assert.equal(entryGate.status, 409, 'the unproven restart-lost class fails closed without the Owner flag')
  assert.equal(entryGate.body.error.code, 'restart_lost_termination_evidence_unavailable')

  const reset = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST',
    body: { agentId: HR, declarationId: 'd3-occ-1', acceptUnprovenTerminationRisk: true },
    token: CTO_TOKEN,
  })
  assert.equal(reset.status, 200, JSON.stringify(reset.body))
  assert.deepEqual(reset.body.abandonedHandles, [oldHandle])

  // Occupancy convergence: the reset itself drained nothing and carries no
  // process/queue state — the HR slot is EMPTY until the next real request.
  assert.equal(rig.lifecycleSlotSnapshot(HR).state, 'EMPTY')
  const promptsAfterReset = readFileSync(join(root, 'fixture-prompts.jsonl'), 'utf8').trim().split('\n')
  assert.equal(promptsAfterReset.length, 1, 'exactly the unrelated Agent prompt: the reset sent and replayed nothing')

  const next = await rig.request('HR request after accepted reset')
  assert.equal(next?.reply, 'fixture-ok', JSON.stringify(next))
  assert.notEqual(next.reconciliationHandle, oldHandle, 'new handle, never a join to the abandoned one')

  // The fresh generation holds no stale occupancy: no live execution and no
  // unknown fence may reference the abandoned handle.
  const slot = rig.registry.lifecycleSlots.get(HR)
  assert.equal(slot?.processRef?.executions?.has(oldHandle), false, 'the old handle never joins the new process')
  assert.equal(slot?.processRef?.activeUnknownFences?.size, 0, 'no unknown fence survives into the new generation')

  // The abandoned record stays honest + audited; the D6 decision is on it.
  const oldRecord = rig.store.records.get(oldHandle)
  assert.equal(oldRecord.initialOutcome, 'outcome_unknown', 'business result stays UNKNOWN')
  assert.equal(oldRecord.exitObservedAt ?? null, null, 'no fabricated exit observation')
  assert.equal(oldRecord.terminationEvidence ?? null, null, 'no fabricated termination evidence')
  assert.equal(oldRecord.fenceState, 'active')
  assert.ok(oldRecord.audit.some(entry => entry.kind === 'owner_risk_acceptance_unproven_termination'),
    'the D6 decision stays on the record audit')

  // Radius: the unrelated Agent still completes after the HR-only reset, and
  // the declaration scope never crossed agents.
  const otherAfter = await rig.request('unrelated agent after reset', OTHER)
  assert.equal(otherAfter?.reply, 'fixture-ok', JSON.stringify(otherAfter))
  assert.equal(rig.store.admissionBlockerForAgent(OTHER), null)
  const read = await call(base, `/agent-process/turn-abandonment?agentId=${encodeURIComponent(HR)}`, { token: CTO_TOKEN })
  assert.deepEqual(read.body.declarations[0].handles, [oldHandle], 'scope is exactly the abandoned HR handle')
  assert.equal(rig.store.adminAbandonmentsForAgent(OTHER).length, 0, 'no declaration ever bound to the unrelated Agent')
  rmSync(root, { recursive: true, force: true })
})

test('D3: an evidenced later stuck turn is only reset by an explicit NEW declaration (scope stays exact)', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-d3-scope-'))
  const { rig, oldHandle } = correlatedEvidencedRestartRig(t, root)
  const { base } = await mount(t, { routerFacade: rig })

  const first = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'd3-scope-1' }, token: CTO_TOKEN,
  })
  assert.equal(first.status, 200)
  assert.deepEqual(first.body.abandonedHandles, [oldHandle])

  const laterHandle = evidencedStuckTurn(rig.store, HR, { generation: 1 })
  const retry = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'd3-scope-1' }, token: CTO_TOKEN,
  })
  assert.equal(retry.status, 200)
  assert.deepEqual(retry.body.abandonedHandles, [], 'the retry never adopts the later unknown turn')
  assert.equal(rig.store.records.get(laterHandle).adminAbandonment ?? null, null)
  assert.equal(rig.store.admissionBlockerForAgent(HR)?.handle, laterHandle, 'the later turn keeps fencing admission')

  const second = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'd3-scope-2' }, token: CTO_TOKEN,
  })
  assert.equal(second.status, 200)
  assert.deepEqual(second.body.abandonedHandles, [laterHandle])
  assert.equal(rig.store.admissionBlockerForAgent(HR), null)

  const next = await rig.request('HR request after both scopes reset')
  assert.equal(next?.reply, 'fixture-ok', JSON.stringify(next))
  assert.notEqual(next.reconciliationHandle, oldHandle)
  assert.notEqual(next.reconciliationHandle, laterHandle)
  rmSync(root, { recursive: true, force: true })
})
