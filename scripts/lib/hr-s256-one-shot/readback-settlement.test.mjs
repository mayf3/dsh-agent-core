/** Disposable actual V3 store/consumer readback. No host/root action. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { closeSync, openSync, readFileSync } from 'node:fs'
import { fixedR2Fixture } from '../../../packages/agent-router/test/helpers/fixed-r2-consumer-fixture.js'
import { readSettlement } from './readback-settlement.mjs'

test('actual pinned-validator readback projects only exact settled s256 and never writes', t => {
  const fx = fixedR2Fixture(cleanup => t.after(cleanup))
  let fd = openSync(fx.persistenceFile, 'r')
  const blocked = readFileSync(fx.persistenceFile)
  assert.throws(() => readSettlement(`/dev/fd/${fd}`), /EXACT_S256_SETTLEMENT_UNKNOWN/)
  assert.deepEqual(readFileSync(fx.persistenceFile), blocked)
  closeSync(fd)
  assert.deepEqual(fx.store.consumeStartupQuiescence(fx).map(row => row.status), ['settled'])
  const settled = readFileSync(fx.persistenceFile)
  fd = openSync(fx.persistenceFile, 'r')
  try {
    const projection = readSettlement(`/dev/fd/${fd}`)
    assert.deepEqual(projection.subject, fx.bundle.subject)
    assert.deepEqual(projection.settlement, { reconciliationHandle: fx.handle,
      queryState: 'settled', fenceState: 'cleared', initialOutcome: 'outcome_unknown',
      terminationEvidence: 'restart_quiescence_proven' })
    assert.deepEqual(readFileSync(fx.persistenceFile), settled)
  } finally { closeSync(fd) }
})

test('readback accepts only inherited FD form, never caller file or handle', () => {
  assert.throws(() => readSettlement('/Users/authsvc/.agent-core/control/turn-recovery-v3.json'),
    /FIXED_STORE_FD_REQUIRED/)
})
