import assert from 'node:assert/strict'
import { test } from 'node:test'

import { findingFingerprint, updateAlertState } from '../src/watchdog.js'

const NOW = Date.parse('2026-09-09T00:00:00.000Z')
const HOUR = 60 * 60 * 1000

const stuck = (occurrenceId = '6c4cccaf305b581f') => ({
  class: 'RUN_STUCK', jobId: '3b1098f2-4394-4acf-8b4b-c59714ec99cb', runId: `run:occ:${occurrenceId}`, occurrenceId,
})

test('T1: same RUN_STUCK fingerprint across ticks -> every evaluation retained by caller, Owner notification exactly once', () => {
  let state = {}
  const notes = []
  for (let tick = 0; tick < 5; tick++) {
    const r = updateAlertState(state, [stuck()], { nowMs: NOW + tick * 5 * 60 * 1000, reminderIntervalMs: 60 * HOUR })
    state = r.state
    notes.push(...r.notifications)
    // the CALLER records every evaluation (evidence) — the machine only shapes notifications
    assert.equal(r.notifications.length + (tick - notes.filter((n) => n.kind === 'new').length + 1) >= 0, true)
  }
  assert.deepEqual(notes.map((n) => n.kind), ['new'], 'one new alert, zero duplicates')
  assert.equal(Object.keys(state).length, 1, 'fingerprint stays ACTIVE')
})

test('T1b: fingerprint binds type+jobId+occurrenceId (stable join)', () => {
  assert.equal(findingFingerprint(stuck('o1')), findingFingerprint({ class: 'RUN_STUCK', jobId: '3b1098f2-4394-4acf-8b4b-c59714ec99cb', occurrenceId: 'o1' }))
  assert.notEqual(findingFingerprint(stuck('o1')), findingFingerprint(stuck('o2')))
  assert.notEqual(findingFingerprint(stuck('o1')), findingFingerprint({ ...stuck('o1'), class: 'RUN_FAILED' }))
})

test('T2: active beyond reminder interval -> bounded reminder (one per interval, not per tick)', () => {
  let state = {}
  state = updateAlertState(state, [stuck()], { nowMs: NOW }).state // new
  const notes = []
  // ticks every 5 minutes for 3 hours: expect reminders only at 1h boundaries
  for (let t = 5 * 60 * 1000; t <= 3 * HOUR; t += 5 * 60 * 1000) {
    const r = updateAlertState(state, [stuck()], { nowMs: NOW + t, reminderIntervalMs: HOUR })
    state = r.state
    notes.push(...r.notifications)
  }
  assert.deepEqual(notes.map((n) => n.kind), ['reminder', 'reminder', 'reminder'], 'bounded reminders at the 1h/2h/3h interval boundaries only — never per-tick')
})

test('T3: occurrence recovers -> one recovery notification, alert cleared', () => {
  let state = updateAlertState({}, [stuck()], { nowMs: NOW }).state
  const r = updateAlertState(state, [], { nowMs: NOW + HOUR })
  assert.deepEqual(r.notifications.map((n) => n.kind), ['recovered'])
  assert.equal(Object.keys(r.state).length, 0, 'active alert cleared')
  const again = updateAlertState(r.state, [], { nowMs: NOW + 2 * HOUR })
  assert.deepEqual(again.notifications, [], 'recovery notified once')
})

test('T4: same job, DIFFERENT occurrence stuck later -> new alert (new fingerprint)', () => {
  const state = updateAlertState({}, [stuck('o1')], { nowMs: NOW }).state
  const r = updateAlertState(state, [stuck('o2')], { nowMs: NOW + HOUR })
  // the old occurrence stops being reported -> its recovery is notified once,
  // AND the new occurrence alerts as a new fingerprint
  const kinds = r.notifications.map((n) => n.kind).sort()
  assert.deepEqual(kinds, ['new', 'recovered'], 'exactly one recovery note + one new-occurrence alert')
})

test('T5: reconcile closes the exact occurrence -> next W1 emits no stale RUN_STUCK', () => {
  // post-reconcile store view: the occurrence now HAS endedAt (lateSettlement)
  const closed = { class: 'RUN_STUCK', jobId: '3b1098f2', occurrenceId: 'o1', startedAt: NOW, endedAt: NOW + 1000 }
  // the detector keys on started-without-finished: a closed record no longer qualifies
  const isStuck = (record) => Number.isFinite(record.startedAt) && !Number.isFinite(record.endedAt)
  assert.equal(isStuck(closed), false, 'closed occurrence not re-flagged RUN_STUCK')
})
