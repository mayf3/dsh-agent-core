import assert from 'node:assert/strict'
import { test } from 'node:test'

import { findingFingerprint, updateAlertState } from '../../src/watchdog/index.js'

const NOW = Date.parse('2026-09-09T00:00:00.000Z')
const HOUR = 60 * 60 * 1000
const stuck = (occurrenceId = 'occ-a') => ({ class: 'RUN_STUCK', jobId: 'job-a', runId: `run:${occurrenceId}`, occurrenceId })

test('T10 unchanged root incident remains Owner-silent forever, including after restart', () => {
  let state = {}
  const notes = []
  for (let tick = 0; tick < 5; tick += 1) {
    const result = updateAlertState(state, [stuck()], { nowMs: NOW + tick * HOUR })
    state = JSON.parse(JSON.stringify(result.state))
    notes.push(...result.notifications)
  }
  assert.deepEqual(notes.map((item) => item.kind), ['new'])
  assert.equal(Object.values(state.incidents)[0].lifecycle, 'OPEN')
})

test('T25 root fingerprint binds exact full job and occurrence identity', () => {
  assert.equal(findingFingerprint(stuck('occ-a')), 'occurrence|RUN_STUCK|job-a|occ-a')
  assert.notEqual(findingFingerprint(stuck('occ-a')), findingFingerprint(stuck('occ-b')))
  assert.notEqual(findingFingerprint(stuck('occ-a')), findingFingerprint({ ...stuck('occ-a'), class: 'RUN_FAILED' }))
})

test('T32 disappearance closes with one recovery; occurrence-bound root never reopens', () => {
  let state = updateAlertState({}, [stuck()], { nowMs: NOW }).state
  let result = updateAlertState(state, [], { nowMs: NOW + HOUR })
  state = result.state
  assert.deepEqual(result.notifications.map((item) => item.kind), ['recovered'])
  result = updateAlertState(state, [], { nowMs: NOW + 2 * HOUR })
  assert.deepEqual(result.notifications, [])
  result = updateAlertState(result.state, [stuck()], { nowMs: NOW + 3 * HOUR })
  assert.deepEqual(result.notifications, [], 'same occurrence is terminally closed')
})

test('T25 a different occurrence on the same Job is a new root incident', () => {
  const state = updateAlertState({}, [stuck('occ-a')], { nowMs: NOW }).state
  const result = updateAlertState(state, [stuck('occ-b')], { nowMs: NOW + HOUR })
  assert.deepEqual(result.notifications.map((item) => item.kind).sort(), ['new', 'recovered'])
})
