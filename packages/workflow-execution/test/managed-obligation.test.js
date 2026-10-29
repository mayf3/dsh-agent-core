import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ExecutionLedger, attemptIdFor } from '../src/ledger.js'
import { createTerminalAttemptOperations } from '../src/terminal-attempt-operations.js'
const id = n => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`
const seed = { dispatchIntentId: id(1), nodeVisitId: id(2), workflowInstanceId: id(3), ownerPrincipalId: id(4) }
async function terminal(ledger) {
  const a = ledger.get(seed.nodeVisitId)
  await ledger.recordRunDelivered({ nodeVisitId: seed.nodeVisitId, agentId: 'agt_test', requestId: a.attemptId, sessionId: 'main' })
  await ledger.recordStaleSuperseded({ nodeVisitId: seed.nodeVisitId,
    expected: { state: 'ACTIVE', phase: 'run_delivered', deliveredAtMs: ledger.get(seed.nodeVisitId).delivered.atMs }, observedWorkflowStateVersion: 1 })
}
test('managed cap is three under the actual lock despite global 99, concurrent triggers, and restart', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'managed-cap-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const reads = []
  const opts = { dir, maxAttemptsPerVisit: 99, resolveManagedAttempt: async context => { reads.push(context); return true } }
  const ledger = new ExecutionLedger(opts)
  for (let i = 1; i <= 3; i++) {
    const result = await ledger.beginAttemptIfAbsent(seed, undefined, () => true)
    assert.equal(result.created, true)
    assert.equal(result.attempt.attemptId, attemptIdFor(seed.nodeVisitId, i))
    await terminal(ledger)
  }
  const restarted = new ExecutionLedger(opts)
  const attempts = await Promise.all([ledger, restarted].map(l => l.beginAttemptIfAbsent(seed, undefined, () => true)))
  assert.deepEqual(attempts.map(r => r.cause), ['attempt_limit_reached', 'attempt_limit_reached'])
  assert.equal(restarted.get(seed.nodeVisitId).generation, 3)
  assert.ok(reads.length >= 5)
  const escalations = []
  await createTerminalAttemptOperations({ ledger, escalateAttemptLimit: async p => escalations.push(p) })
    .maybeEscalateAtLimit(ledger.get(seed.nodeVisitId))
  assert.equal(escalations.length, 1)
})
test('unknown classification admits zero attempts; explicit unmanaged retains configured bound', async t => {
  for (const managed of [undefined, false]) {
    const dir = mkdtempSync(join(tmpdir(), 'managed-cap-'))
    t.after(() => rmSync(dir, { recursive: true, force: true }))
    const ledger = new ExecutionLedger({ dir, maxAttemptsPerVisit: 5, resolveManagedAttempt: async () => managed })
    const r = await ledger.beginAttemptIfAbsent(seed)
    assert.equal(r.created, managed === false)
    if (managed === undefined) { assert.equal(r.cause, 'pre_plan_unavailable'); assert.deepEqual(ledger.snapshot(), []) }
  }
})
