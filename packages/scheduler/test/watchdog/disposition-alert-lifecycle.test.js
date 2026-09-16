import assert from 'node:assert/strict'
import { test } from 'node:test'

import { evaluateRunHealth, findingFingerprint, updateAlertState } from '../../src/watchdog/index.js'

const NOW = Date.parse('2026-09-10T00:00:00.000Z')
const MINUTE = 60 * 1000
const plainFailure = (occurrenceId = 'occ-a') => ({
  class: 'RUN_FAILED', jobId: 'job-a', occurrenceId, runId: `run:${occurrenceId}`,
  endedAt: new Date(NOW - 30 * MINUTE).toISOString(),
})
const acknowledgedFailure = (occurrenceId = 'occ-a') => ({
  ...plainFailure(occurrenceId),
  disposition: { basis: 'operator-reconcile', resolvedTo: 'failed', resolvedAt: NOW - 10 * MINUTE },
})

test('T32 formal acknowledgment closes exactly once and consumes later recovery', () => {
  let state = updateAlertState({}, [plainFailure()], { nowMs: NOW }).state
  let result = updateAlertState(state, [acknowledgedFailure()], { nowMs: NOW + MINUTE })
  state = result.state
  assert.deepEqual(result.notifications.map((item) => item.kind), ['acknowledged'])
  result = updateAlertState(state, [acknowledgedFailure()], { nowMs: NOW + 2 * MINUTE })
  assert.deepEqual(result.notifications, [])
  result = updateAlertState(result.state, [], { nowMs: NOW + 3 * MINUTE })
  assert.deepEqual(result.notifications, [], 'acknowledgment and recovery are mutually exclusive')
})

test('T10 failure without disposition opens once and has no elapsed-time reminders', () => {
  let state = {}
  const notes = []
  for (let hour = 0; hour < 24; hour += 1) {
    const result = updateAlertState(state, [plainFailure()], { nowMs: NOW + hour * 60 * MINUTE })
    state = result.state
    notes.push(...result.notifications)
  }
  assert.deepEqual(notes.map((item) => item.kind), ['new'])
})

test('T32 disposition present on first sight opens and acknowledges, then stays silent', () => {
  let result = updateAlertState({}, [acknowledgedFailure()], { nowMs: NOW })
  assert.deepEqual(result.notifications.map((item) => item.kind), ['new', 'acknowledged'])
  result = updateAlertState(result.state, [acknowledgedFailure()], { nowMs: NOW + MINUTE })
  assert.deepEqual(result.notifications, [])
})

test('detector keeps durable failure fact and adds only passive disposition evidence', () => {
  const job = { id: 'job-a', logicalKey: 'k', agentId: 'agt-a', enabled: true, schedule: { kind: 'every', everyMs: 60 * MINUTE }, createdAtMs: NOW - 5 * 60 * MINUTE, state: { nextRunAtMs: NOW + MINUTE } }
  const occurrence = { occurrenceId: 'occ-a', runId: 'run:occ-a', jobId: 'job-a', state: 'failed', executionOutcome: 'failed', startedAt: NOW - 31 * MINUTE, endedAt: NOW - 30 * MINUTE }
  const plain = evaluateRunHealth({ jobs: [job], occurrences: [occurrence] }, { nowMs: NOW })
  assert.equal(plain[0].class, 'RUN_FAILED')
  assert.equal(plain[0].disposition, undefined)
  const disposed = evaluateRunHealth({ jobs: [job], occurrences: [{ ...occurrence, lateSettlement: { basis: 'operator-reconcile', resolvedTo: 'failed', resolvedAt: NOW - 10 * MINUTE } }] }, { nowMs: NOW })
  assert.equal(disposed[0].class, 'RUN_FAILED')
  assert.equal(disposed[0].disposition.basis, 'operator-reconcile')
  assert.equal(findingFingerprint(disposed[0]), 'occurrence|RUN_FAILED|job-a|occ-a')
})

test('new occurrence remains distinct after an acknowledged sibling', () => {
  let state = updateAlertState({}, [plainFailure()], { nowMs: NOW }).state
  state = updateAlertState(state, [acknowledgedFailure()], { nowMs: NOW + MINUTE }).state
  const result = updateAlertState(state, [acknowledgedFailure(), plainFailure('occ-b')], { nowMs: NOW + 2 * MINUTE })
  assert.deepEqual(result.notifications.map((item) => item.kind), ['new'])
})
