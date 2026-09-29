// HR_RESET_AND_RESUME_V1 — admin-controlled turn abandonment store contract.
// The declaration unblocks NEW-request admission for exactly one Agent while
// the abandoned records stay blocked + fenced + outcome_unknown forever, keep
// their correlation entries (no-replay), and late evidence still settles only
// the exact abandoned handles.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation-store.js'

const HR = 'agt_hr-agent'
const OTHER = 'agt_abandonment-control'
/** Raw durable record (getTurnReconciliation returns a {state, snapshot} projection). */
const rawRecord = (store, handle) => store.records.get(handle)

function stuckTurn(store, agentId, { generation = 1, requestId = null } = {}) {
  const handle = store.mintTurnExecution({
    agentId,
    processGeneration: generation,
    sessionId: 'main',
    ...(requestId === null ? {} : { callerCorrelation: { requestId } }),
  })
  store.markPromptWriteAttempted(handle)
  store.markOutcomeUnknown(handle, { source: 'unit-fixture' })
  return handle
}

test('declaration unblocks admission for one agent; historical fence query and other agents unchanged', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-abandon-1' })
  const hrHandle = stuckTurn(store, HR, { requestId: 'req-hr-1' })
  const otherHandle = stuckTurn(store, OTHER)
  assert.equal(store.admissionBlockerForAgent(HR)?.handle, hrHandle)

  const result = store.declareAdminAbandonment({ agentId: HR, declarationId: 'decl-1' })
  assert.deepEqual(result.abandonedHandles, [hrHandle])
  assert.equal(store.admissionBlockerForAgent(HR), null, 'new-request admission unblocked for HR')
  assert.equal(store.activeFenceForAgent(HR)?.handle, hrHandle, 'historical fence query stays unchanged and queryable')
  assert.equal(store.admissionBlockerForAgent(OTHER)?.handle, otherHandle, 'other agents keep their fence')
  const record = rawRecord(store, hrHandle)
  assert.equal(record.initialOutcome, 'outcome_unknown', 'business result stays UNKNOWN')
  assert.equal(record.state, 'pending')
  assert.equal(record.fenceState, 'active', 'record keeps its honest blocked/fenced state')
  assert.deepEqual(record.adminAbandonment, { declarationId: 'decl-1', declaredAt: record.adminAbandonment.declaredAt })
  assert.ok(Number.isSafeInteger(record.adminAbandonment.declaredAt))
})

test('declaration is idempotent per declarationId and does not restamp', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-abandon-2' })
  const handle = stuckTurn(store, HR)
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'decl-1' })
  const before = rawRecord(store, handle)
  const repeat = store.declareAdminAbandonment({ agentId: HR, declarationId: 'decl-1' })
  assert.deepEqual(repeat.abandonedHandles, [])
  const after = rawRecord(store, handle)
  assert.deepEqual(after, before, 'repeated reset is a byte-identical no-op')
  assert.equal(after.adminAbandonment.declaredAt, before.adminAbandonment.declaredAt)
})

test('a NEW unknown after a declaration fences the agent again; a further declaration abandons only it', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-abandon-3' })
  const first = stuckTurn(store, HR, { generation: 1 })
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'decl-1' })
  assert.equal(store.admissionBlockerForAgent(HR), null)
  const second = stuckTurn(store, HR, { generation: 2 })
  assert.equal(store.admissionBlockerForAgent(HR)?.handle, second, 'new unknown fences again after the declaration')
  const second1 = store.declareAdminAbandonment({ agentId: HR, declarationId: 'decl-2' })
  assert.deepEqual(second1.abandonedHandles, [second], 'further declaration abandons only the new stuck turn')
  assert.equal(store.admissionBlockerForAgent(HR), null)
  assert.equal(rawRecord(store, first).adminAbandonment.declarationId, 'decl-1')
  assert.equal(rawRecord(store, second).adminAbandonment.declarationId, 'decl-2')
})

test('abandonment persists across restarts; late old results stay isolated; no-replay keeps correlation', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-admin-abandonment-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-abandon-a' })
    const oldHandle = stuckTurn(store, HR, { requestId: 'req-hr-old' })
    store.declareAdminAbandonment({ agentId: HR, declarationId: 'decl-restart' })
    const newHandleInOldEpoch = store.mintTurnExecution({ agentId: HR, processGeneration: 1, sessionId: 'main' })
    store.markOutcomeUnknown(newHandleInOldEpoch, { source: 'unit-fixture' })
    store.declareAdminAbandonment({ agentId: HR, declarationId: 'decl-restart-2' })

    // Controller restart: fresh runtime epoch, same durable file.
    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-abandon-b' })
    assert.equal(reopened.admissionBlockerForAgent(HR), null, 'abandonment markers survive restart; no re-declaration needed')
    assert.ok(reopened.activeFenceForAgent(HR), 'historical fence query unchanged after restart (abandoned records stay fenced)')

    // No-replay: the old correlation entry still resolves to the abandoned
    // handle, and replaying the identical caller correlation cannot mint a
    // second authority.
    assert.equal(reopened.resolveCallerCorrelation({ requestId: 'req-hr-old' }).handle, oldHandle)
    assert.throws(() => reopened.mintTurnExecution({
      agentId: HR, processGeneration: 1, sessionId: 'main', callerCorrelation: { requestId: 'req-hr-old' },
    }), error => error.code === 'RECONCILIATION_CORRELATION_CONFLICT')

    // Late old results isolate: late evidence settles only the abandoned handle.
    const late = reopened.settleLate(oldHandle, { lateOutcome: 'late_completed', terminationEvidence: 'exact_terminal_then_idle' })
    assert.equal(late.won, true)
    const oldAfter = rawRecord(reopened, oldHandle)
    assert.equal(oldAfter.lateOutcome, 'late_completed')
    assert.equal(oldAfter.adminAbandonment?.declarationId, 'decl-restart', 'abandonment marker kept beside the late settlement')
    const otherAfter = rawRecord(reopened, newHandleInOldEpoch)
    assert.equal(otherAfter.state, 'pending', 'the later turn is untouched by the old late settlement')
    assert.equal(otherAfter.lateOutcome, null)
    assert.equal(reopened.admissionBlockerForAgent(HR), null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('declaration validation: arguments and admission readiness fail loud', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-abandon-4' })
  assert.throws(() => store.declareAdminAbandonment({ agentId: '', declarationId: 'decl' }), TypeError)
  assert.throws(() => store.declareAdminAbandonment({ agentId: HR, declarationId: '' }), TypeError)
  assert.throws(() => store.declareAdminAbandonment({ agentId: HR, declarationId: 'x'.repeat(129) }), TypeError)
  const blocked = new TurnReconciliationStore({ runtimeEpoch: 'epoch-abandon-5' })
  blocked.startupBlockedReason = 'durable_store_invalid'
  assert.throws(() => blocked.declareAdminAbandonment({ agentId: HR, declarationId: 'decl' }),
    error => error.code === 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED')
})

test('durable validator rejects a malformed abandonment marker and accepts the closed shape', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-abandonment-durable-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-abandon-durable' })
    const handle = stuckTurn(store, HR)
    store.declareAdminAbandonment({ agentId: HR, declarationId: 'decl-durable' })
    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-abandon-durable-2' })
    assert.equal(rawRecord(reopened, handle).adminAbandonment.declarationId, 'decl-durable')

    const fs = await import('node:fs')
    const raw = JSON.parse(fs.readFileSync(persistenceFile, 'utf8'))
    const target = raw.records.find(record => record.reconciliationHandle === handle)
    target.adminAbandonment = { declarationId: 'x', declaredAt: 'not-a-number' }
    fs.writeFileSync(persistenceFile, `${JSON.stringify(raw)}\n`)
    const rejected = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-abandon-durable-3' })
    assert.equal(rejected.startupBlockedReason, 'durable_store_invalid', 'malformed abandonment marker fails the durable load closed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('review r4130766501 regression: retrying a COMPLETED declaration never adopts a later unknown turn', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-abandon-retry' })
  const turnA = stuckTurn(store, HR, { generation: 1 })
  const first = store.declareAdminAbandonment({ agentId: HR, declarationId: 'reset-1' })
  assert.deepEqual(first.abandonedHandles, [turnA])
  // A later, independent turn becomes unknown AFTER reset-1 completed.
  const turnB = stuckTurn(store, HR, { generation: 2 })
  const retry = store.declareAdminAbandonment({ agentId: HR, declarationId: 'reset-1' })
  assert.deepEqual(retry.abandonedHandles, [], 'retry of a completed declaration abandons nothing new')
  assert.deepEqual(retry.scopeHandles, [turnA], 'retry stays bound to the original operation scope')
  const recordB = rawRecord(store, turnB)
  assert.equal(recordB.adminAbandonment ?? null, null, 'the later task is never marked by the old operation')
  assert.equal(store.admissionBlockerForAgent(HR)?.handle, turnB, 'the later task keeps fencing admission')
  assert.equal(rawRecord(store, turnA).adminAbandonment.declarationId, 'reset-1')
  // Only an explicit NEW declaration may reset the later task.
  const second = store.declareAdminAbandonment({ agentId: HR, declarationId: 'reset-2' })
  assert.deepEqual(second.abandonedHandles, [turnB])
  assert.equal(store.admissionBlockerForAgent(HR), null)
})

test('scope binding survives restart: retry after reopen still cannot adopt a later unknown', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-abandonment-scope-restart-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-scope-a' })
    const turnA = stuckTurn(store, HR)
    store.declareAdminAbandonment({ agentId: HR, declarationId: 'reset-1' })
    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-scope-b' })
    const turnB = stuckTurn(reopened, HR, { generation: 1 })
    const retry = reopened.declareAdminAbandonment({ agentId: HR, declarationId: 'reset-1' })
    assert.deepEqual(retry.abandonedHandles, [])
    assert.deepEqual(retry.scopeHandles, [turnA], 'durable registry keeps the original scope across restarts')
    assert.equal((rawRecord(reopened, turnB).adminAbandonment) ?? null, null)
    assert.equal(reopened.admissionBlockerForAgent(HR)?.handle, turnB)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('partial-write recovery: retry completes exactly the registered original scope', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-abandonment-partial-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-partial-a' })
    const turnA = stuckTurn(store, HR)
    const declaredAt = 1700000000000
    // Crash seam: scope registered + persisted, stamps not yet written.
    store.adminAbandonmentDeclarations = [{
      declarationId: 'partial-1', agentId: HR, handles: [turnA], declaredAt,
    }]
    store.adminAbandonmentDeclarationsDirty = true
    store.persistDurable()
    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-partial-b' })
    assert.equal(rawRecord(reopened, turnA).adminAbandonment ?? null, null, 'stamp missing before the crash')
    const retry = reopened.declareAdminAbandonment({ agentId: HR, declarationId: 'partial-1' })
    assert.deepEqual(retry.abandonedHandles, [])
    assert.deepEqual(retry.completedHandles, [turnA], 'retry completes the original scope only')
    assert.deepEqual(rawRecord(reopened, turnA).adminAbandonment, { declarationId: 'partial-1', declaredAt }, 'completion restamps with the ORIGINAL declaredAt')
    assert.equal(reopened.admissionBlockerForAgent(HR), null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a declarationId bound to another agent fails loud and never restamps', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-abandon-xagent' })
  const hrHandle = stuckTurn(store, HR)
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'shared-1' })
  const otherHandle = stuckTurn(store, OTHER)
  assert.throws(() => store.declareAdminAbandonment({ agentId: OTHER, declarationId: 'shared-1' }),
    error => error.code === 'RECONCILIATION_DECLARATION_CONFLICT')
  assert.equal((rawRecord(store, otherHandle).adminAbandonment) ?? null, null)
  assert.equal(rawRecord(store, hrHandle).adminAbandonment.declarationId, 'shared-1')
})

test('marker-only reconstruction: a store with no registry file still binds retries to the marker scope', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-abandonment-reconstruct-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-recon-a' })
    const turnA = stuckTurn(store, HR)
    store.declareAdminAbandonment({ agentId: HR, declarationId: 'reset-1' })
    // Simulate a store whose registry file does not exist (pre-registry era):
    // reconstruction falls back to the per-record markers, which survive
    // every durable round-trip.
    rmSync(`${persistenceFile}.abandonment-declarations.json`, { force: true })
    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-recon-b' })
    const turnB = stuckTurn(reopened, HR, { generation: 1 })
    const retry = reopened.declareAdminAbandonment({ agentId: HR, declarationId: 'reset-1' })
    assert.deepEqual(retry.abandonedHandles, [])
    assert.deepEqual(retry.scopeHandles, [turnA], 'reconstructed scope keeps the retry bound')
    assert.equal((rawRecord(reopened, turnB).adminAbandonment) ?? null, null)
    assert.equal(reopened.admissionBlockerForAgent(HR)?.handle, turnB)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('empty-scope declaration registers its (empty) operation: later turns are never adopted', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-abandon-empty' })
  const first = store.declareAdminAbandonment({ agentId: HR, declarationId: 'pre-1' })
  assert.deepEqual(first.abandonedHandles, [])
  const turnB = stuckTurn(store, HR)
  const retry = store.declareAdminAbandonment({ agentId: HR, declarationId: 'pre-1' })
  assert.deepEqual(retry.abandonedHandles, [])
  assert.deepEqual(retry.scopeHandles, [])
  assert.equal((rawRecord(store, turnB).adminAbandonment) ?? null, null)
  assert.equal(store.admissionBlockerForAgent(HR)?.handle, turnB)
})

test('durable validator rejects a malformed scope registry fail-closed', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-abandonment-registry-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-registry-a' })
    const handle = stuckTurn(store, HR)
    store.declareAdminAbandonment({ agentId: HR, declarationId: 'decl-registry' })
    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-registry-b' })
    assert.deepEqual(reopened.adminAbandonmentDeclarations[0].handles, [handle])
    const fs = await import('node:fs')
    const registryFile = `${persistenceFile}.abandonment-declarations.json`
    const raw = JSON.parse(fs.readFileSync(registryFile, 'utf8'))
    raw.declarations[0].handles = 'not-an-array'
    fs.writeFileSync(registryFile, `${JSON.stringify(raw)}\n`)
    const rejected = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-registry-c' })
    assert.equal(rejected.startupBlockedReason, 'durable_store_invalid', 'malformed scope registry fails the durable load closed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('rollback/reupgrade regression: the scope registry survives an old-binary rewrite of the recovery file', async () => {
  // Review finding: crash between the scope persist and the stamps, then a
  // rollback to the parent binary. The old binary rewrites the recovery file
  // WITHOUT unknown top-level fields, so a registry stored there would be
  // lost and the reupgrade retry could never complete the original scope
  // (silent partial reset). The registry therefore lives in its own sibling
  // file that old binaries never read or write.
  const root = mkdtempSync(join(tmpdir(), 'agent-core-abandonment-rollback-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-rollback-a' })
    const turnA = stuckTurn(store, HR)
    const turnB = stuckTurn(store, HR, { generation: 1 })
    store.declareAdminAbandonment({ agentId: HR, declarationId: 'rollback-1' })
    // Crash window: turnB's stamp never reached the disk before the crash —
    // hand-write exactly that on-disk state.
    const fs = await import('node:fs')
    const raw = JSON.parse(fs.readFileSync(persistenceFile, 'utf8'))
    const recordB = raw.records.find(record => record.reconciliationHandle === turnB)
    delete recordB.adminAbandonment
    // And the rollback itself: the old binary rewrites the recovery file
    // WITHOUT unknown top-level fields, dropping any registry stored there.
    delete raw.adminAbandonmentDeclarations
    fs.writeFileSync(persistenceFile, `${JSON.stringify(raw)}\n`)
    // Rollback + reupgrade: the recovery file has been rewritten by the old
    // binary (it never carries the registry); the sibling registry survives.
    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-rollback-b' })
    assert.equal(rawRecord(reopened, turnA).adminAbandonment?.declarationId, 'rollback-1')
    assert.equal(rawRecord(reopened, turnB).adminAbandonment ?? null, null, 'crash window left turnB unstamped')
    const retry = reopened.declareAdminAbandonment({ agentId: HR, declarationId: 'rollback-1' })
    assert.deepEqual(retry.scopeHandles, [turnA, turnB], 'the registry still knows the FULL original scope')
    assert.deepEqual(retry.completedHandles, [turnB], 'the retry completes exactly the unstamped remainder')
    assert.equal(reopened.admissionBlockerForAgent(HR), null, 'no silent partial reset')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('entry-gate projection: stuck fences without durable exit evidence are reported; observed exits are not', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-abandonment-gate-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const crashed = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-gate-a' })
    const lost = stuckTurn(crashed, HR)
    const restarted = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-gate-b' })
    const unproven = restarted.stuckFenceWithoutDurableExitEvidenceForAgent(HR)
    assert.equal(unproven?.handle, lost, 'the restart-lost unknown fence has NO durable exit evidence')
    assert.ok(restarted.markExitObserved(lost), 'fixture records the observed real exit')
    assert.equal(restarted.stuckFenceWithoutDurableExitEvidenceForAgent(HR), null,
      'durable child_real_exit evidence satisfies the entry gate')
    assert.equal(restarted.stuckFenceWithoutDurableExitEvidenceForAgent('agt_unknown-agent'), null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('declaration scope matches the admission blocker: settled records with an active fence are abandonable', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-abandonment-settled-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  try {
    const crashed = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-scope-settled-a' })
    const handle = stuckTurn(crashed, HR)
    crashed.claimRecovery(handle, { operationId: 'reap-fixture', claimantRuntimeEpoch: 'epoch-scope-settled-a' })
    crashed.markExitObserved(handle)
    const reopened = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-scope-settled-b' })
    const record = rawRecord(reopened, handle)
    assert.equal(record.state, 'settled', 'the observed exit settled the record as terminated_without_outcome')
    assert.equal(record.terminationEvidence, 'child_real_exit')
    assert.equal(record.fenceState, 'active', 'registry-cleanup-pending fence stays active')
    assert.ok(reopened.admissionBlockerForAgent(HR)?.handle === handle, 'the settled fence still blocks NEW-request admission')
    const result = reopened.declareAdminAbandonment({ agentId: HR, declarationId: 'settled-1' })
    assert.deepEqual(result.abandonedHandles, [handle], 'the blocker-aligned scope covers the settled fence')
    assert.equal(reopened.admissionBlockerForAgent(HR), null, 'admission unblocked — no silent no-op reset')
    assert.equal(record.state, 'settled', 'settlement itself is untouched by the abandonment')
    assert.equal(record.terminationEvidence, 'child_real_exit')
    assert.equal(record.adminAbandonment?.declarationId, 'settled-1')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
