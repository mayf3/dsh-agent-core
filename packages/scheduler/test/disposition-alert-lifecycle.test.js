import assert from 'node:assert/strict'
import { test } from 'node:test'

import { evaluateRunHealth, findingFingerprint, updateAlertState } from '../src/watchdog.js'

const NOW = Date.parse('2026-09-10T00:00:00.000Z')
const HOUR = 60 * 60 * 1000
const M = 60 * 1000

// A terminal-failed occurrence inside the 24h failedWindow, WITHOUT any
// disposition bookkeeping (the plain FACT-layer case).
const plainFailedFinding = () => ({
  class: 'RUN_FAILED', jobId: 'job-1', runId: 'run:occ:a1', endedAt: new Date(NOW - 30 * M).toISOString(),
})
// Same occurrence AFTER a formal operator disposition (--reconcile wrote
// lateSettlement.basis=operator-reconcile; the detector still emits the fact,
// now passively enriched).
const dispositionedFailedFinding = () => ({
  ...plainFailedFinding(),
  disposition: { basis: 'operator-reconcile', resolvedTo: 'failed', resolvedAt: NOW - 10 * M },
})
const fpOf = (f) => findingFingerprint(f)

test('D1: disposition on a notified incident -> exactly one acknowledged, then silence forever while the fact persists', () => {
  let state = {}
  let notes = []
  // t0: plain failure alerts NEW
  let r = updateAlertState(state, [plainFailedFinding()], { nowMs: NOW })
  state = r.state; notes.push(...r.notifications)
  assert.deepEqual(notes.map((n) => n.kind), ['new'])
  // t0+30m: operator disposition lands; next W1 cycle closes the incident ONCE
  r = updateAlertState(state, [dispositionedFailedFinding()], { nowMs: NOW + 30 * M })
  state = r.state; notes.push(...r.notifications)
  assert.deepEqual(notes.slice(-1).map((n) => n.kind), ['acknowledged'])
  assert.equal(Object.keys(state.active).length, 0, 'incident left active')
  assert.equal(state.acknowledged[fpOf(dispositionedFailedFinding())].basis, 'operator-reconcile')
  // t0+35m .. t0+5h: the fact is still detected every cycle (durable) — zero notifications
  for (let t = 35 * M; t <= 5 * HOUR; t += 5 * M) {
    r = updateAlertState(state, [dispositionedFailedFinding()], { nowMs: NOW + t })
    state = r.state
    notes.push(...r.notifications)
  }
  assert.deepEqual(notes.map((n) => n.kind), ['new', 'acknowledged'], 'no reminder/re-NEW/second closure may follow an acknowledgment')
})

test('D2: disposition present from first sight -> NEW still fires first (no silent-first path), acknowledged second, then silence', () => {
  let state = {}
  const r1 = updateAlertState(state, [dispositionedFailedFinding()], { nowMs: NOW })
  state = r1.state
  assert.deepEqual(r1.notifications.map((n) => n.kind), ['new'], 'first sighting of a failed fact always notifies')
  const r2 = updateAlertState(state, [dispositionedFailedFinding()], { nowMs: NOW + 5 * M })
  assert.deepEqual(r2.notifications.map((n) => n.kind), ['acknowledged'])
  const r3 = updateAlertState(r2.state, [dispositionedFailedFinding()], { nowMs: NOW + 2 * HOUR })
  assert.deepEqual(r3.notifications, [])
})

test('D3: plain (undispositioned) failure keeps the legacy lifecycle — NEW -> bounded reminders -> one RECOVERED (regression guard)', () => {
  let state = {}
  let notes = []
  let r = updateAlertState(state, [plainFailedFinding()], { nowMs: NOW })
  state = r.state; notes.push(...r.notifications)
  for (let t = 5 * M; t <= 3 * HOUR; t += 5 * M) {
    r = updateAlertState(state, [plainFailedFinding()], { nowMs: NOW + t })
    state = r.state; notes.push(...r.notifications)
  }
  // fact ages out of the 24h window at t=24h: exactly one recovery, bounded reminders before it
  r = updateAlertState(state, [], { nowMs: NOW + 24 * HOUR + M })
  notes.push(...r.notifications)
  assert.equal(notes.filter((n) => n.kind === 'new').length, 1)
  assert.equal(notes.filter((n) => n.kind === 'reminder').length, 3, 'bounded reminders unchanged (1h/2h/3h)')
  assert.deepEqual(notes.filter((n) => n.kind === 'recovered').length, 1)
  assert.equal(notes.filter((n) => n.kind === 'acknowledged').length, 0, 'no lifecycle transition without a disposition')
})

test('D4: acknowledged fact aging out of the window -> silent GC, NO second closure notification', () => {
  let state = updateAlertState({}, [plainFailedFinding()], { nowMs: NOW }).state
  let r = updateAlertState(state, [dispositionedFailedFinding()], { nowMs: NOW + 30 * M })
  state = r.state
  assert.deepEqual(r.notifications.map((n) => n.kind), ['acknowledged'])
  // 24h window expires: the finding disappears
  r = updateAlertState(state, [], { nowMs: NOW + 25 * HOUR })
  assert.deepEqual(r.notifications, [], 'an acknowledged incident never fires a second closure (no recovered)')
  assert.equal(r.state.acknowledged[fpOf(dispositionedFailedFinding())], undefined, 'acknowledged entry garbage-collected once the fact is gone')
})

test('D5: restart durability — acknowledged state survives a state-file JSON round-trip (W1 restart mid-episode)', () => {
  let state = updateAlertState({}, [plainFailedFinding()], { nowMs: NOW }).state
  const r = updateAlertState(state, [dispositionedFailedFinding()], { nowMs: NOW + 30 * M })
  // simulate W1 restart: persist + reload the exact JSON the runner writes
  const persisted = JSON.parse(JSON.stringify(r.state))
  for (let t = 35 * M; t <= 4 * HOUR; t += 5 * M) {
    const next = updateAlertState(persisted, [dispositionedFailedFinding()], { nowMs: NOW + t })
    persisted.acknowledged = next.state.acknowledged
    persisted.active = next.state.active
    persisted.retired = next.state.retired
    assert.deepEqual(next.notifications, [], `silence survives restart at t=+${t}ms`)
  }
})

test('D6: detector emits the failure fact UNCONDITIONALLY — enrichment is passive, plain records carry no disposition key', () => {
  const job = { id: 'job-1', logicalKey: 'k', agentId: 'agt_x', enabled: true, schedule: { kind: 'every', everyMs: HOUR, anchorMs: NOW - 5 * HOUR }, createdAtMs: NOW - 5 * HOUR, state: { nextRunAtMs: NOW + HOUR } }
  const base = { occurrenceId: 'occ:a1', runId: 'run:occ:a1', jobId: 'job-1', state: 'failed', executionOutcome: 'failed', startedAt: NOW - 31 * M, endedAt: NOW - 30 * M }
  const plain = evaluateRunHealth({ jobs: [job], occurrences: [base] }, { nowMs: NOW })
  assert.deepEqual(plain.map((f) => f.class), ['RUN_FAILED'], 'fact emitted')
  assert.equal(plain[0].disposition, undefined, 'no disposition enrichment without a formal record')
  const reconciled = evaluateRunHealth({ jobs: [job], occurrences: [{ ...base, lateSettlement: { basis: 'operator-reconcile', resolvedTo: 'failed', resolvedAt: NOW - 10 * M } }] }, { nowMs: NOW })
  assert.deepEqual(reconciled.map((f) => f.class), ['RUN_FAILED'], 'fact STILL emitted after disposition — zero suppression in the detector')
  assert.deepEqual(reconciled[0].disposition, { basis: 'operator-reconcile', resolvedTo: 'failed', resolvedAt: NOW - 10 * M })
  // other bases are NOT formal operator dispositions — no enrichment, still emitted
  const otherBasis = evaluateRunHealth({ jobs: [job], occurrences: [{ ...base, lateSettlement: { basis: 'engine-retry' } }] }, { nowMs: NOW })
  assert.equal(otherBasis[0].disposition, undefined)
  assert.equal(otherBasis.length >= 1, true)
})

test('D7: a NEW occurrence after an acknowledged one is a new fingerprint and alerts normally', () => {
  let state = updateAlertState({}, [plainFailedFinding()], { nowMs: NOW }).state
  const r = updateAlertState(state, [dispositionedFailedFinding()], { nowMs: NOW + 30 * M })
  state = r.state
  const fresh = { class: 'RUN_FAILED', jobId: 'job-1', runId: 'run:occ:b2', endedAt: new Date(NOW + HOUR).toISOString() }
  assert.notEqual(fpOf(fresh), fpOf(dispositionedFailedFinding()))
  const r2 = updateAlertState(state, [dispositionedFailedFinding(), fresh], { nowMs: NOW + 2 * HOUR })
  assert.deepEqual(r2.notifications.map((n) => n.kind), ['new'], 'new occurrence alerts as NEW despite the acknowledged sibling')
})

test('D8: anti-flap silently-resumed entry + disposition -> silent close (no NEW duplicate, no stray notification)', () => {
  const T0 = Date.parse('2026-09-10T06:00:00.000Z')
  let state = updateAlertState({}, [plainFailedFinding()], { nowMs: T0 }).state
  // flap: recovered at +5m, fact re-appears within the 6h cooldown at +10m -> silent resume (notifiedCount=0)
  state = updateAlertState(state, [], { nowMs: T0 + 5 * M }).state
  let r = updateAlertState(state, [plainFailedFinding()], { nowMs: T0 + 10 * M })
  state = r.state
  assert.deepEqual(r.notifications, [])
  // disposition lands while silently resumed: incident closes with NO notification (none was ever sent)
  r = updateAlertState(state, [dispositionedFailedFinding()], { nowMs: T0 + 15 * M })
  assert.deepEqual(r.notifications, [])
  assert.equal(r.state.active[fpOf(dispositionedFailedFinding())], undefined)
  assert.notEqual(r.state.acknowledged[fpOf(dispositionedFailedFinding())], undefined)
})

test('D9: legacy persisted state (pre-lifecycle, {active,retired} or flat) loads with an empty acknowledged namespace', () => {
  const shapeA = { active: { 'RUN_FAILED|job-1|run:occ:a1': { firstSeenAt: NOW, lastSeenAt: NOW, notifiedCount: 1, severity: 'RUN_FAILED' } }, retired: {} }
  const rA = updateAlertState(shapeA, [dispositionedFailedFinding()], { nowMs: NOW + M })
  assert.deepEqual(rA.notifications.map((n) => n.kind), ['acknowledged'])
  const flat = { 'RUN_FAILED|job-1|run:occ:a1': { firstSeenAt: NOW, lastSeenAt: NOW, notifiedCount: 1, severity: 'RUN_FAILED' } }
  const rB = updateAlertState(flat, [dispositionedFailedFinding()], { nowMs: NOW + M })
  assert.deepEqual(rB.notifications.map((n) => n.kind), ['acknowledged'], 'legacy flat state still acknowledges exactly once')
})
