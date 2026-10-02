/**
 * UNKNOWN/no-replay and fence persistence through the generic runtime
 * (Product #434 acceptance): after the one-off incident modules are gone,
 * the standing generic machinery must still
 *   - keep a crash-orphaned outcome_unknown record fenced across restarts
 *     (admission, spawn and prompt gates all block; history stays queryable);
 *   - never replay the lost turn (caller correlation keeps resolving and
 *     refuses a second authority mint; the record settles only on exact
 *     termination evidence — here none exists, so nothing settles);
 *   - keep the accepted administrator abandonment channel working through
 *     the SAME generic projections (admission unblocks for that agent only;
 *     the historical fence stays active and queryable; the record is never
 *     settled, deleted or rewritten).
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation/index.js'
import { createProcessRegistry } from '../../src/process-registry.js'
import { promptFenceError } from '../../src/process/state-machine.js'

async function tmpFile(t, name) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-unknown-fence-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return join(dir, name)
}

const log = { log: () => {}, error: () => {} }

function fakeRegistryDeps(store, overrides = {}) {
  return {
    log,
    cfg: { agentProfile: 'test-profile' },
    workspaceBootstrap: { ensure: async () => {}, resolveWorkspace: () => '/tmp/w', resolveDshHome: () => '/tmp/h' },
    agentDefinition: { getAgent: (id) => ({ id, disabled: false }) },
    deadlineConfig: { perAgent: () => ({ turnTimeoutMs: 1000, promptReceiptTimeoutMs: 1000, initializeTimeoutMs: 1000, shutdownGraceMs: 1000 }) },
    reconciliationStore: store,
    processFactory: overrides.processFactory ?? (() => { throw new Error('must never spawn past the fence') }),
    resolveProcessConfig: () => ({}),
    provisionHome: () => {},
    switchAgent: async () => ({}),
    getBrokerGateway: () => undefined,
  }
}

test('crash-orphaned UNKNOWN stays fenced across restarts; no gate replays or settles it', async (t) => {
  const persistenceFile = await tmpFile(t, 'turn-recovery.json')
  const correlation = { occurrenceId: 'occ-1', runId: 'run-1', requestId: 'req-1' }
  let handle
  {
    const first = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-before' })
    handle = first.mintTurnExecution({
      agentId: 'agt_subject', processGeneration: 1, sessionId: 'main', callerCorrelation: correlation,
    })
    first.markPromptWriteAttempted(handle)
    // Prompt bytes were written, then the runtime died: no terminal evidence.
  }
  // Restart on a fresh runtime epoch: the record must come back restart-lost
  // and fenced, and every new-request gate must block on it.
  const restarted = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-after' })
  const record = restarted.records.get(handle)
  assert.equal(record.initialOutcome, 'outcome_unknown')
  assert.equal(record.fenceState, 'active')
  assert.equal(record.failureReason, 'runtime_restart_ownership_unavailable')
  assert.equal(restarted.admissionBlockerForAgent('agt_subject')?.handle, handle)
  const promptGate = promptFenceError(restarted, 'agt_subject')
  assert.equal(promptGate?.code, 'AGENT_PROCESS_TURN_FENCED')
  assert.equal(promptGate?.fencedBy, handle)

  // No replay: the durable caller correlation still resolves to the lost
  // handle and a second authority mint for the same coordinates is refused.
  assert.equal(restarted.resolveCallerCorrelation(correlation).handle, handle)
  assert.throws(() => restarted.mintTurnExecution({
    agentId: 'agt_subject', processGeneration: 2, sessionId: 'main', callerCorrelation: correlation,
  }), error => error.code === 'RECONCILIATION_CORRELATION_CONFLICT')

  // The spawn gate blocks through the registry: ensureRunning rejects with a
  // fenced rejection naming the exact old handle, before any process spawn.
  const registry = createProcessRegistry(fakeRegistryDeps(restarted))
  await assert.rejects(registry.ensureRunning('agt_subject'),
    error => error.code === 'AGENT_PROCESS_TURN_FENCED' && error.fencedBy === handle)

  // Restart again: the fence persists (durable, not in-memory state).
  const again = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-after-2' })
  assert.equal(again.admissionBlockerForAgent('agt_subject')?.handle, handle)
  assert.equal(again.activeFenceForAgent('agt_subject')?.handle, handle)
  // History read stays non-consuming and repeatable.
  assert.equal(again.getTurnReconciliation(handle).snapshot.handle, handle)
  assert.equal(again.unresolvedRecoveryRecords().length, 1)
  assert.equal(again.getTurnReconciliation(handle).state, 'recovering')
})

test('admin abandonment unblocks admission only; the UNKNOWN record is never settled or erased', async (t) => {
  const persistenceFile = await tmpFile(t, 'turn-recovery.json')
  let handle
  {
    const first = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-1' })
    handle = first.mintTurnExecution({ agentId: 'agt_subject', processGeneration: 1, sessionId: 'main' })
    first.markPromptWriteAttempted(handle)
  }
  const restarted = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-2' })
  const declaration = restarted.declareAdminAbandonment({
    agentId: 'agt_subject', declarationId: 'decl-1', ownerRiskAcceptance: true,
  })
  assert.deepEqual(declaration.abandonedHandles, [handle])

  // Admission unblocks for THIS agent; the historical fence stays active.
  assert.equal(restarted.admissionBlockerForAgent('agt_subject'), null)
  assert.equal(restarted.activeFenceForAgent('agt_subject')?.handle, handle)
  const record = restarted.records.get(handle)
  assert.equal(record.initialOutcome, 'outcome_unknown')
  assert.equal(record.state !== 'settled', true)
  assert.equal(record.adminAbandonment?.declarationId, 'decl-1')
  assert.equal(record.audit.some(entry => entry.kind === 'owner_risk_acceptance_unproven_termination'), true)

  // Other agents are untouched; a NEW unknown for the same agent (a turn
  // that goes unknown AFTER the declaration) fences the agent again, and a
  // declaration retry completes only its original scope.
  assert.equal(promptFenceError(restarted, 'agt_other'), null)
  const secondHandle = restarted.mintTurnExecution({ agentId: 'agt_subject', processGeneration: 2, sessionId: 'main' })
  restarted.markPromptWriteAttempted(secondHandle)
  const afterRestart = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-3' })
  assert.equal(afterRestart.records.get(secondHandle).initialOutcome, 'outcome_unknown')
  assert.equal(afterRestart.admissionBlockerForAgent('agt_subject')?.handle, secondHandle)
  const retry = afterRestart.declareAdminAbandonment({
    agentId: 'agt_subject', declarationId: 'decl-1', ownerRiskAcceptance: true,
  })
  assert.deepEqual(retry.abandonedHandles, [])
  // Every original-scope record is already durably stamped: the retry adopts
  // nothing new and never restamps.
  assert.deepEqual(retry.completedHandles, [])
  assert.equal(afterRestart.admissionBlockerForAgent('agt_subject')?.handle, secondHandle)
})

test('restart-quiescence evidence without an authenticated context settles nothing (fail-closed)', async (t) => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-now' })
  // Any evidence directory scan under a plain-process startup carries
  // startupNonce === undefined: every bundle must be rejected and no record
  // may settle, mutate or appear.
  const results = store.consumeStartupQuiescence({
    evidenceDir: '/nonexistent-evidence',
    deploymentDir: '/nonexistent-deployment',
    startup: { hostId: 'host', startupNonce: undefined, consumingBinarySha256: undefined,
      windowFd: undefined, challengeFd: undefined, recoveryPlanStopsRuntime: undefined },
  })
  assert.equal(results.length, 1)
  assert.equal(results[0].status, 'rejected')
  assert.equal(store.records.size, 0)
  assert.equal(store.businessAdmissionStatus().ready, true)
})
