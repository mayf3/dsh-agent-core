/**
 * AGENT_CORE_AGENT_SESSION_MESSAGING_V1 R8 + R9 — unit tests for the closed
 * outcome mapping and the race-safe reconciliation wait helper. Every R8
 * table row (including the F19 `terminated_without_outcome` rows) and every
 * R9 ordering (already-settled / settle-between-read-and-subscribe /
 * event-after-subscribe / timeout vs final-read race) is exercised with an
 * in-memory fake store — deterministic, no sleeps.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createFinalReplyWaiter, mapFinalAssistantOutputToOutcome } from '../src/agent-session-reply-wait.js'

function fakeTimer() {
  const pending = []
  let seq = 0
  return {
    pending,
    set(fn, ms) {
      const handle = { id: ++seq, ms, fn }
      pending.push(handle)
      return handle
    },
    clear(handle) {
      const index = pending.indexOf(handle)
      if (index !== -1) pending.splice(index, 1)
      handle.cleared = true
    },
    fireAll() {
      for (const handle of pending.splice(0)) handle.fn()
    },
  }
}

/** Fake reconciliation authority: readable states + a listener set. */
function makeStore(initialStates = {}) {
  const listeners = new Set()
  const states = new Map(Object.entries(initialStates))
  const store = {
    reads: 0,
    disposals: 0,
    read(handle) {
      store.reads += 1
      return states.get(handle) ?? { state: 'never_existed' }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { store.disposals += 1; listeners.delete(listener) }
    },
    emit(handle, event = {}) {
      for (const listener of [...listeners]) listener({ handle, ...event })
    },
    subscriberCount: () => listeners.size,
    set(handle, state) { states.set(handle, state) },
  }
  return store
}

// ------------------------------------------------------------- R8 mapping

test('R8 available rows: completed/late_completed reply; truncated never becomes success', () => {
  assert.deepEqual(
    mapFinalAssistantOutputToOutcome({ state: 'available', text: 'hello', truncated: false, originalBytes: 5, terminalState: 'completed' }),
    { kind: 'replied', reply: 'hello' },
  )
  assert.deepEqual(
    mapFinalAssistantOutputToOutcome({ state: 'available', text: 'late', truncated: false, originalBytes: 4, terminalState: 'late_completed' }),
    { kind: 'replied', reply: 'late' },
  )
  assert.deepEqual(
    mapFinalAssistantOutputToOutcome({ state: 'available', text: 'partial', truncated: true, originalBytes: 99, terminalState: 'completed' }),
    { kind: 'reply_unavailable', reason: 'truncated' },
  )
})

test('R8 failed rows: retained text is never returned as success', () => {
  assert.deepEqual(
    mapFinalAssistantOutputToOutcome({ state: 'available', text: 'so far', truncated: false, originalBytes: 6, terminalState: 'failed' }),
    { kind: 'target_run_failed' },
  )
  assert.deepEqual(
    mapFinalAssistantOutputToOutcome({ state: 'no_output', terminalState: 'late_failed' }),
    { kind: 'target_run_failed' },
  )
})

test('R8 F19 rows: terminated_without_outcome maps to outcome_unknown in both shapes', () => {
  assert.deepEqual(
    mapFinalAssistantOutputToOutcome({ state: 'available', text: 'text before vanish', truncated: false, originalBytes: 10, terminalState: 'terminated_without_outcome' }),
    { kind: 'outcome_unknown' },
  )
  assert.deepEqual(
    mapFinalAssistantOutputToOutcome({ state: 'no_output', terminalState: 'terminated_without_outcome' }),
    { kind: 'outcome_unknown' },
  )
})

test('R8 no_output / not_admitted / absence rows', () => {
  assert.deepEqual(mapFinalAssistantOutputToOutcome({ state: 'no_output', terminalState: 'completed' }), { kind: 'reply_unavailable', reason: 'no_output' })
  assert.deepEqual(mapFinalAssistantOutputToOutcome({ state: 'no_output', terminalState: 'not_admitted' }), { kind: 'not_admitted' })
  assert.deepEqual(mapFinalAssistantOutputToOutcome({ state: 'available', text: 'x', truncated: false, originalBytes: 1, terminalState: 'not_admitted' }), { kind: 'not_admitted' })
  assert.deepEqual(mapFinalAssistantOutputToOutcome({ state: 'evicted' }), { kind: 'reply_unavailable', reason: 'evicted' })
  assert.deepEqual(mapFinalAssistantOutputToOutcome({ state: 'restart_lost' }), { kind: 'reply_unavailable', reason: 'restart_lost' })
  assert.deepEqual(mapFinalAssistantOutputToOutcome({ state: 'never_existed' }), { kind: 'reply_unavailable', reason: 'never_existed' })
  assert.deepEqual(mapFinalAssistantOutputToOutcome({ state: 'pending' }), null)
  assert.deepEqual(mapFinalAssistantOutputToOutcome(undefined), { kind: 'reply_unavailable', reason: 'never_existed' })
})

// ------------------------------------------------------------ R9 waiter

test('R9: an already-settled Run settles from the first read without subscribing', async () => {
  const store = makeStore({ 'turn:1': { state: 'available', text: 'done', truncated: false, originalBytes: 4, terminalState: 'completed' } })
  const wait = createFinalReplyWaiter({ read: store.read, subscribe: store.subscribe, timer: fakeTimer(), now: () => 1000 })
  const result = await wait('turn:1', 2000)
  assert.deepEqual(result, { timedOut: false, outcome: { kind: 'replied', reply: 'done' } })
  assert.equal(store.subscriberCount(), 0)
})

test('R9: settle between read and subscribe returns the same exact reply', async () => {
  const store = makeStore({ 'turn:2': { state: 'pending' } })
  // The Run settles AFTER the first read but BEFORE the post-subscribe read:
  // the fake store settles inside subscribe(), between the two internal reads.
  const subscribe = (listener) => {
    const disposer = store.subscribe(listener)
    store.set('turn:2', { state: 'available', text: 'exact', truncated: false, originalBytes: 5, terminalState: 'late_completed' })
    return disposer
  }
  const wait = createFinalReplyWaiter({ read: store.read, subscribe, timer: fakeTimer(), now: () => 1000 })
  const result = await wait('turn:2', 2000)
  assert.deepEqual(result, { timedOut: false, outcome: { kind: 'replied', reply: 'exact' } })
  assert.equal(store.disposals, 1, 'listener disposed on settle')
})

test('R9: a matching event settles through a fresh authoritative read', async () => {
  const store = makeStore({ 'turn:3': { state: 'pending' } })
  const timer = fakeTimer()
  const wait = createFinalReplyWaiter({ read: store.read, subscribe: store.subscribe, timer, now: () => 1000 })
  const promise = wait('turn:3', 5000)
  await Promise.resolve()
  assert.equal(store.subscriberCount(), 1)
  assert.equal(timer.pending.length, 1, 'the remaining-deadline timer is installed')
  store.set('turn:3', { state: 'no_output', terminalState: 'failed' })
  store.emit('turn:3')
  const result = await promise
  assert.deepEqual(result, { timedOut: false, outcome: { kind: 'target_run_failed' } })
  assert.equal(timer.pending.length, 0, 'timer cleared on settle')
  assert.equal(store.disposals, 1, 'listener disposed on settle')
})

test('R9: events for other handles are ignored', async () => {
  const store = makeStore({ 'turn:4': { state: 'pending' } })
  const wait = createFinalReplyWaiter({ read: store.read, subscribe: store.subscribe, timer: fakeTimer(), now: () => 1000 })
  const promise = wait('turn:4', 5000)
  await Promise.resolve()
  store.set('turn:other', { state: 'available', text: 'x', truncated: false, originalBytes: 1, terminalState: 'completed' })
  store.emit('turn:other')
  store.set('turn:4', { state: 'available', text: 'mine', truncated: false, originalBytes: 4, terminalState: 'completed' })
  store.emit('turn:4')
  const result = await promise
  assert.deepEqual(result, { timedOut: false, outcome: { kind: 'replied', reply: 'mine' } })
})

test('R9: deadline fires timeout only after one final authoritative read', async () => {
  const store = makeStore({ 'turn:5': { state: 'pending' } })
  const timer = fakeTimer()
  const wait = createFinalReplyWaiter({ read: store.read, subscribe: store.subscribe, timer, now: () => 1000 })
  const promise = wait('turn:5', 1300)
  await Promise.resolve()
  assert.equal(timer.pending[0].ms, 300, 'the timer uses the remaining deadline')
  timer.fireAll()
  const result = await promise
  assert.deepEqual(result, { timedOut: true })
  assert.equal(store.disposals, 1, 'listener disposed on timeout')
  assert.equal(timer.pending.length, 0, 'timer entry consumed')
})

test('R9: terminal settle racing the timer wins over timeout (once-guard)', async () => {
  const store = makeStore({ 'turn:6': { state: 'pending' } })
  const timer = fakeTimer()
  const wait = createFinalReplyWaiter({ read: store.read, subscribe: store.subscribe, timer, now: () => 1000 })
  const promise = wait('turn:6', 1100)
  await Promise.resolve()
  // The Run settles, and THEN the stale deadline fires — the settle must win.
  store.set('turn:6', { state: 'available', text: 'won', truncated: false, originalBytes: 3, terminalState: 'completed' })
  store.emit('turn:6')
  const result = await promise
  timer.fireAll()
  assert.deepEqual(result, { timedOut: false, outcome: { kind: 'replied', reply: 'won' } })
})

test('R9: a late terminal read at deadline time is honored (never mislabeled timeout)', async () => {
  const store = makeStore({ 'turn:7': { state: 'pending' } })
  const timer = fakeTimer()
  const wait = createFinalReplyWaiter({ read: store.read, subscribe: store.subscribe, timer, now: () => 1000 })
  const promise = wait('turn:7', 1500)
  await Promise.resolve()
  // The store settles without emitting (missed event); the deadline's FINAL
  // read must still return the outcome.
  store.set('turn:7', { state: 'available', text: 'late but exact', truncated: false, originalBytes: 14, terminalState: 'late_completed' })
  timer.fireAll()
  const result = await promise
  assert.deepEqual(result, { timedOut: false, outcome: { kind: 'replied', reply: 'late but exact' } })
})
