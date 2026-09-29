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
