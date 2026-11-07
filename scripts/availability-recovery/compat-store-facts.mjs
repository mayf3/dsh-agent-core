import assert from 'node:assert/strict'
import { isDeepStrictEqual } from 'node:util'
import { RECONCILIATION_CAPS } from '../../packages/agent-router/src/reconciliation/capacity.js'

// Router V4 C-019 and CLAUSE-PROC-BOUNDED: append, then retain the bounded tail.
// D-009's separate 10 MB runs.jsonl ceiling does not apply to this Router ring.
function assertAuditAppend(before, after, index) {
  const cap = RECONCILIATION_CAPS.MAX_RECONCILIATION_AUDIT_ENTRIES_PER_RECORD
  assert.ok(Array.isArray(after) && after.length <= cap, `record ${index}: audit count cap`)
  assert.ok(Buffer.byteLength(JSON.stringify(after), 'utf8')
    <= RECONCILIATION_CAPS.MAX_RECONCILIATION_AUDIT_BYTES_PER_RECORD,
  `record ${index}: audit byte cap`)
  if (isDeepStrictEqual(before, after)) return false
  // Keep an observable old suffix; a wholly replaced ring cannot prove append.
  const dropped = Array.from({ length: before.length || 1 }, (_, n) => n).find(n => {
    const retained = before.length - n
    const added = after.length - retained
    return added > 0 && after.length === Math.min(before.length + added, cap)
      && isDeepStrictEqual(before.slice(n), after.slice(0, retained))
  })
  assert.notEqual(dropped, undefined, `record ${index}: audit must append without rewriting retained entries`)
  for (const entry of after.slice(before.length - dropped)) {
    assert.deepEqual(Object.keys(entry).sort(), ['action', 'observedAtWallMs', 'reasonCode', 'result'])
    assert.ok(['coordinator_scheduled', 'ownership_check', 'reap_claim', 'graceful_shutdown',
      'forced_termination', 'exit_wait', 'settlement', 'registry_cleanup', 'fence_cleanup'].includes(entry.action))
    assert.ok(['started', 'succeeded', 'failed', 'blocked'].includes(entry.result))
    assert.ok(Number.isSafeInteger(entry.observedAtWallMs) && entry.observedAtWallMs >= 0)
    assert.ok(typeof entry.reasonCode === 'string' && entry.reasonCode.length <= 256)
  }
  return true
}

/** Startup may rotate epochs/recount capacity/append bounded audit, never facts. */
export function assertRouterFacts(before, after) {
  const rootFacts = ({ runtimeEpoch, runtimeEpochs, records, ...facts }) => facts
  assert.deepEqual(rootFacts(after), rootFacts(before), 'store indexes/authority unchanged')
  assert.equal(after.records.length, before.records.length, 'no lost/added records')
  assert.ok(after.runtimeEpochs.includes(after.runtimeEpoch))
  assert.ok(after.runtimeEpochs.length <= 256)
  const referenced = new Set(before.records.map(record => record.runtimeEpoch))
  for (const epoch of referenced) assert.ok(after.runtimeEpochs.includes(epoch), 'record epoch retained')
  for (const epoch of after.runtimeEpochs) {
    assert.ok(before.runtimeEpochs.includes(epoch) || epoch === after.runtimeEpoch, 'no invented epoch')
  }
  for (const [index, original] of before.records.entries()) {
    const current = after.records[index]
    const facts = ({ bytes, updatedAt, attemptedActions, ...record }) => record
    assert.deepEqual(facts(current), facts(original), `record ${index}: every business/evidence field preserved`)
    const appended = assertAuditAppend(original.attemptedActions, current.attemptedActions, index)
    assert.ok(Number.isSafeInteger(current.bytes) && current.bytes > 0)
    if (current.updatedAt !== original.updatedAt) {
      assert.ok(Number.isSafeInteger(current.updatedAt) && current.updatedAt >= original.updatedAt)
      if (appended) continue
      // Existing startup cleanup rechecks this already-settled blocked record.
      // No settlement, termination, recovery state or fence change is allowed.
      assert.equal(original.queryState, 'settled')
      assert.equal(original.initialOutcome, 'outcome_unknown')
      assert.equal(original.fenceState, 'active')
      assert.equal(original.state, 'blocked')
      assert.equal(original.failureReason, 'registry_cleanup_proof_unavailable')
      assert.ok(original.reapClaim !== null)
      assert.equal(original.attemptedActions.some(action => action.action === 'registry_cleanup'
        && action.result === 'succeeded'), false)
    }
  }
}
