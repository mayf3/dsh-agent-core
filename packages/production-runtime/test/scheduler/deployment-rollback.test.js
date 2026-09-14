import test from 'node:test'
import assert from 'node:assert/strict'

import { buildSchedulerRollbackPlan, classifyRollbackGeneration } from '../../src/scheduler/deployment-rollback.js'

const sourceSha = 'a'.repeat(40)
const restoreOrder = ['RESTORE_RUNTIME', 'RESTORE_WATCHDOGS', 'RESTORE_ROUTING', 'RESTORE_DESIRED_STATE', 'RESTORE_OVERLAY', 'RESTORE_OPERATOR']

test('phase-aware rollback accepts interruption after every phase without future receipts', () => {
  const receiptNames = ['runtime', 'watchdog', 'routing', 'desired', 'overlay', 'operator']
  for (let completed = 0; completed <= receiptNames.length; completed += 1) {
    const receipts = Object.fromEntries(receiptNames.map((name, index) => [name, index < completed]))
    const plan = buildSchedulerRollbackPlan({ progress: { sourceSha, phases: Object.fromEntries(receiptNames.slice(0, completed).map((name) => [name, { ok: true }])) }, receipts })
    assert.deepEqual(plan.actions.filter((action) => action.startsWith('RESTORE_')), restoreOrder.slice(0, completed))
    assert.ok(plan.actions.indexOf('STOP_RUNTIME') < plan.actions.findIndex((action) => action.startsWith('RESTORE_') || action === 'START_RUNTIME'))
    assert.ok(plan.actions.indexOf('START_RUNTIME') > Math.max(...plan.actions.map((action, index) => action.startsWith('RESTORE_') ? index : -1)))
    assert.ok(plan.actions.indexOf('START_WATCHDOGS') > plan.actions.indexOf('START_RUNTIME'))
    assert.equal(plan.actions.at(-1), 'VERIFY_HEALTH')
  }
})

test('rollback progress and receipt schema fail closed', () => {
  assert.throws(() => buildSchedulerRollbackPlan(), /progress authority/)
  assert.throws(() => buildSchedulerRollbackPlan({ progress: { sourceSha: 'bad', phases: {} } }), /progress authority/)
  assert.throws(() => buildSchedulerRollbackPlan({ progress: { sourceSha, phases: {} }, receipts: { terminal: true } }), /receipt coordinate/)
  assert.throws(() => buildSchedulerRollbackPlan({ progress: { sourceSha, phases: {} }, receipts: { overlay: 'yes' } }), /receipt coordinate/)
})

test('rollback refuses unrelated postimage bytes even when semantic fields still resemble the candidate', () => {
  assert.equal(classifyRollbackGeneration({ currentSha256: 'new', installedSha256: 'new', preimageSha256: 'old' }), 'RESTORE')
  assert.equal(classifyRollbackGeneration({ currentSha256: 'old', installedSha256: 'new', preimageSha256: 'old' }), 'ALREADY_RESTORED')
  assert.throws(() => classifyRollbackGeneration({ currentSha256: 'advanced-with-same-sha-field', installedSha256: 'new', preimageSha256: 'old' }), /generation advanced/)
})
