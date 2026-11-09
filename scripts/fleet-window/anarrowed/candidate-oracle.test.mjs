import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { TurnReconciliationStore } from '../../../packages/agent-router/src/reconciliation/store.js'
import { checkCandidateCopies, checkRecoveryPreserved } from './candidate-oracle.mjs'

const encode = value => Buffer.from(JSON.stringify(value))

test('oracle accepts only append-only startup diagnostics and preserves every authority field', () => {
  const directory = mkdtempSync('/usr/local/v5-boot-isolation/anarrowed-oracle-')
  const file = join(directory, 'recovery.json')
  const original = new TurnReconciliationStore({ runtimeEpoch: 'old-oracle-epoch', persistenceFile: file })
  const handle = original.mintTurnExecution({ agentId: 'agt_oracle', processGeneration: 1,
    sessionId: 'oracle-session', callerCorrelation: null })
  original.markOutcomeUnknown(handle, { source: 'timeout', deadlineAtWallMs: Date.now() })
  original.markRecoveryBlocked(handle, ['live_generation_ownership'], 'fixture_old_epoch')
  const beforeBytes = readFileSync(file), before = JSON.parse(beforeBytes)
  const restarted = new TurnReconciliationStore({ runtimeEpoch: 'new-oracle-epoch', persistenceFile: file })
  restarted.markRecoveryBlocked(handle, ['live_generation_ownership'], 'runtime_restart_ownership_unavailable')
  const allowedBytes = readFileSync(file), allowed = JSON.parse(allowedBytes)
  assert.equal(checkRecoveryPreserved(beforeBytes, beforeBytes).ok, true)
  const accepted = checkRecoveryPreserved(beforeBytes, allowedBytes)
  assert.equal(accepted.ok, true, JSON.stringify(accepted))
  assert.equal(accepted.diagnosticAppends, 1)
  assert.equal(accepted.preservedActionEntries, before.records[0].attemptedActions.length)
  const rejected = []
  function reject(label, mutate, source = allowed) {
    const after = structuredClone(source)
    mutate(after, after.records[0])
    const result = checkRecoveryPreserved(beforeBytes, encode(after))
    assert.equal(result.ok, false, label)
    rejected.push(label)
  }
  const mutable = ['attemptedActions', 'updatedAt', 'failureReason', 'bytes']
  for (const key of Object.keys(before.records[0]).filter(key => !mutable.includes(key))) {
    reject('immutable-record-' + key, (_, record) => { record[key] = record[key] === null ? 'forbidden' : null })
  }
  reject('new-business-field', (_, record) => { record.newBusinessField = 'forbidden' })
  reject('removed-record', after => { after.records = [] })
  reject('added-record', after => { after.records.push(structuredClone(after.records[0])) })
  reject('top-level-authority', after => { after.discriminatorSeq++ })
  reject('new-top-level-field', after => { after.newAuthority = true })
  reject('epoch-history-loss', after => { after.runtimeEpochs = [after.runtimeEpoch] })
  reject('old-action-overwrite', (_, record) => { record.attemptedActions[0].reasonCode = 'forbidden' })
  reject('old-action-drop', (_, record) => { record.attemptedActions.shift() })
  reject('old-action-reorder', (_, record) => { record.attemptedActions.reverse() })
  for (const [key, value] of Object.entries({ action: 'settlement', result: 'succeeded',
    reasonCode: 'unlisted_reason', observedAtWallMs: -1, payload: 'unlisted-field' })) {
    reject('diagnostic-' + key, (_, record) => { record.attemptedActions.at(-1)[key] = value })
  }
  reject('diagnostic-time-after-update', (_, record) => { record.attemptedActions.at(-1).observedAtWallMs = record.updatedAt + 1 })
  reject('failure-reason-outside-whitelist', (_, record) => { record.failureReason = 'unlisted_reason' })
  reject('failure-reason-without-append', (_, record) => { record.failureReason = 'runtime_restart_ownership_unavailable' }, before)
  reject('timestamp-regression', (_, record) => { record.updatedAt = before.records[0].updatedAt - 1 })
  reject('timestamp-without-append', (_, record) => { record.updatedAt++ }, before)
  reject('numeric-bytes-tamper', (_, record) => { record.bytes++ })
  reject('numeric-bytes-stale', (_, record) => { record.bytes = before.records[0].bytes })
  reject('byte-payload-replacement', (_, record) => { record.bytes = 'overwritten-prefix' })
  const protectedBytes = Buffer.from('immutable jobs/admission UTF-8 前缀')
  const copies = [beforeBytes, protectedBytes, protectedBytes]
  assert.equal(checkCandidateCopies(copies, [allowedBytes, protectedBytes, protectedBytes], true).ok, true)
  assert.equal(checkCandidateCopies(copies, [allowedBytes, protectedBytes, protectedBytes], false).ok, false)
  for (const index of [1, 2]) {
    const changed = [allowedBytes, protectedBytes, protectedBytes]
    changed[index] = Buffer.concat([protectedBytes, Buffer.from('append')])
    assert.equal(checkCandidateCopies(copies, changed, true).ok, false)
  }
  console.log(JSON.stringify({ scenario: 'closed-startup-diagnostic-oracle', accepted, rejected,
    rollbackByteEqualityRetained: true, admissionAndJobsByteEqualityRetained: true, productionExecution: 'NONE' }))
})
