// Test oracle only: preserve authority while allowing one closed startup diagnostic.
import { isDeepStrictEqual } from 'node:util'
import { recordByteSize } from '../../../packages/agent-router/src/reconciliation/capacity.js'

const equal = isDeepStrictEqual
const omit = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)))
const assert = (ok, message) => { if (!ok) throw new Error(message) }
const reason = 'runtime_restart_ownership_unavailable'
const time = value => Number.isSafeInteger(value) && value >= 0

function decodedRecord(raw) {
  // Same durable aliases as the accepted reader; bytes is a numeric owned-state
  // counter, never payload. Recount must match exactly, not merely increase.
  const record = omit(raw, ['queryState', 'reconciliationHandle', 'turnExecutionId'])
  return { ...record, ingressCorrelation: raw.ingressCorrelation ?? null,
    adminAbandonment: raw.adminAbandonment ?? null, recoveryState: raw.state, state: raw.queryState }
}

export function checkRecoveryPreserved(beforeBytes, afterBytes) {
  const result = { ok: false, diagnosticAppends: 0, preservedActionEntries: 0 }
  try {
    const before = JSON.parse(beforeBytes), after = JSON.parse(afterBytes)
    assert(equal(omit(before, ['records', 'runtimeEpoch', 'runtimeEpochs']),
      omit(after, ['records', 'runtimeEpoch', 'runtimeEpochs'])), 'top-level authority changed')
    assert(typeof after.runtimeEpoch === 'string' && after.runtimeEpoch.length > 0
      && after.runtimeEpoch.length <= 128, 'invalid runtime epoch')
    const epochs = after.runtimeEpoch === before.runtimeEpoch ? before.runtimeEpochs
      : [after.runtimeEpoch, ...before.runtimeEpochs.filter(epoch => epoch !== after.runtimeEpoch)]
    assert(equal(after.runtimeEpochs, epochs), 'runtime epoch history changed')
    assert(Array.isArray(before.records) && Array.isArray(after.records)
      && before.records.length === after.records.length, 'record set changed')
    for (const [index, old] of before.records.entries()) {
      const next = after.records[index]
      const mutable = ['attemptedActions', 'updatedAt', 'failureReason', 'bytes']
      assert(equal(omit(old, mutable), omit(next, mutable)), `record ${index} business/semantic fields changed`)
      assert(Array.isArray(old.attemptedActions) && Array.isArray(next.attemptedActions)
        && equal(next.attemptedActions.slice(0, old.attemptedActions.length), old.attemptedActions),
      `record ${index} action prefix changed`)
      const appended = next.attemptedActions.slice(old.attemptedActions.length)
      for (const entry of appended) {
        assert(equal(Object.keys(entry).sort(), ['action', 'observedAtWallMs', 'reasonCode', 'result'])
          && entry.action === 'ownership_check' && entry.result === 'blocked' && entry.reasonCode === reason
          && time(entry.observedAtWallMs) && entry.observedAtWallMs >= old.updatedAt
          && entry.observedAtWallMs <= next.updatedAt, `record ${index} non-whitelisted diagnostic append`)
      }
      assert(time(next.updatedAt) && next.updatedAt >= old.updatedAt, `record ${index} invalid updatedAt`)
      assert(next.failureReason === old.failureReason || (appended.length > 0 && next.failureReason === reason),
        `record ${index} non-whitelisted failureReason`)
      assert(next.updatedAt === old.updatedAt || appended.length > 0, `record ${index} timestamp without diagnostic`)
      assert(time(old.bytes) && time(next.bytes)
        && (appended.length === 0 ? next.bytes === old.bytes : next.bytes >= old.bytes
          && next.bytes === recordByteSize(decodedRecord(next))), `record ${index} byte accounting/prefix changed`)
      result.diagnosticAppends += appended.length
      result.preservedActionEntries += old.attemptedActions.length
    }
    result.ok = true
  } catch (error) { result.error = error.message }
  return result
}

export function checkCandidateCopies(before, after, allowStartupDiagnostics) {
  const recovery = allowStartupDiagnostics ? checkRecoveryPreserved(before[0], after[0])
    : { ok: before[0].equals(after[0]), diagnosticAppends: 0 }
  return { ...recovery, ok: recovery.ok && before.slice(1).every((bytes, index) => bytes.equals(after[index + 1])) }
}
