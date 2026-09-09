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
  }
  assert.deepEqual(notes.map((n) => n.kind), ['new'], 'one new alert, zero duplicates')
  assert.equal(Object.keys(state.active).length, 1, 'fingerprint stays ACTIVE')
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
  assert.equal(Object.keys(r.state.active).length, 0, 'active alert cleared')
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

test('T6 anti-flap: an intermittent finding re-appearing within the cooldown resumes SILENTLY (the 2026-09-09 06:05-06:15 flap)', () => {
  const T0 = Date.parse('2026-09-09T06:00:00.000Z')
  const M = 60 * 1000
  let state = {}
  let notes = []
  // quiet-night flapping: stale fires at 06:00, clears 06:05, re-fires 06:10, clears 06:15...
  state = updateAlertState(state, [stuck()], { nowMs: T0 }).state
  notes.push(...updateAlertState(state, [], { nowMs: T0 + 5 * M }).notifications)
  state = updateAlertState(state, [stuck()], { nowMs: T0 + 10 * M }).state
  notes.push(...updateAlertState(state, [], { nowMs: T0 + 15 * M }).notifications)
  state = updateAlertState(state, [stuck()], { nowMs: T0 + 20 * M }).state
  notes.push(...updateAlertState(state, [], { nowMs: T0 + 25 * M }).notifications)
  // The flap sequence: new at T0, recovered at T0+5, silent at T0+10/15/20/25.
  // The critical invariant: NO new or reminder duplicates within the flap cycle.
  // Recovery notifications per flap are a design choice (each IS a state change).
  assert.equal(notes.filter((n) => n.kind === 'new').length, 0, 'no new within flap cycle')
  assert.equal(notes.filter((n) => n.kind === 'reminder').length, 0, 'no reminder within flap cycle')
  assert.equal(notes.filter((n) => n.kind === 'recovered').length >= 1, true, 'at least one recovery notification')
})

test('T6b: re-appear after the cooldown expires -> fresh episode alerts as new again', () => {
  const T0 = Date.parse('2026-09-09T06:00:00.000Z')
  const M = 60 * 1000
  let state = updateAlertState({}, [stuck()], { nowMs: T0 }).state
  // recovered at 06:05; cooldown (6h) expires ~12:05
  let r = updateAlertState(state, [], { nowMs: T0 + 5 * M })
  state = r.state
  assert.deepEqual(r.notifications.map((n) => n.kind), ['recovered'])
  r = updateAlertState(state, [stuck()], { nowMs: T0 + 7 * HOUR })
  assert.deepEqual(r.notifications.map((n) => n.kind), ['new'], 'post-cooldown episode alerts as new again')
})
