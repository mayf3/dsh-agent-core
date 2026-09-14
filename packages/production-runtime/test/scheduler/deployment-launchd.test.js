import test from 'node:test'
import assert from 'node:assert/strict'

import { quiesceLaunchdServices } from '../../src/scheduler/deployment-launchd.js'

test('launchd quiesce records prior state and proves every service absent', () => {
  const loaded = new Set(['w1'])
  const prior = quiesceLaunchdServices(['w1', 'w2'], {
    isLoaded: (label) => loaded.has(label),
    bootout: (label) => loaded.delete(label),
  })
  assert.deepEqual(prior, { w1: true, w2: false })
})

test('launchd quiesce fails on bootout refusal or still-loaded readback', () => {
  assert.throws(() => quiesceLaunchdServices(['w1'], { isLoaded: () => true, bootout: () => { throw new Error('EPERM') } }), /EPERM/)
  assert.throws(() => quiesceLaunchdServices(['w1'], { isLoaded: () => true, bootout: () => undefined }), /remained loaded/)
})
