import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  acquireConsistentHealthSnapshot,
  filterHealthForPrincipal,
  projectSchedulerHealth,
} from '../../src/watchdog/health.js'

const T0 = Date.parse('2026-09-14T00:00:00Z')

function job(id, agentId = `agt_${id}`) {
  return {
    id, agentId, logicalKey: `logical.${id}`, enabled: true,
    schedule: { kind: 'every', everyMs: 60_000 },
    delivery: { mode: 'none' },
    state: { nextRunAtMs: T0 + 60_000 },
  }
}

function snapshot(overrides = {}) {
  return {
    generatedAt: T0,
    jobs: [job('a'), job('b'), job('c'), job('d')],
    occurrences: [], fences: {}, history: [],
    credentials: { agt_a: true, agt_b: true, agt_c: false, agt_d: true },
    routes: { a: { ready: true }, b: { ready: true }, c: { ready: true }, d: { ready: false } },
    incidents: {},
    provenance: { canonicalPair: true, runtime: 'runtime-gen', store: 'store-gen' },
    generations: [
      { source: 'jobs', trusted: true, start: 'j1', end: 'j1' },
      { source: 'history', trusted: true, start: 'h1', end: 'h1' },
      { source: 'routing', trusted: true, start: 'r1', end: 'r1' },
    ],
    ...overrides,
  }
}

test('T15/T16 complete census is exclusive and exposes the canonical row contract', () => {
  const unknown = {
    occurrenceId: 'occ-b', jobId: 'b', runId: 'run-b', state: 'outcome_unknown',
    startedAt: T0 - 30_000, endedAt: T0 - 20_000,
  }
  const result = projectSchedulerHealth(snapshot({ occurrences: [unknown], fences: { b: ['occ-b'] } }))
  assert.equal(result.complete, true)
  assert.equal(result.enabled, 4)
  assert.deepEqual({ healthy: result.healthy, degraded: result.degraded, blocked: result.blocked, unknown: result.unknown }, { healthy: 1, degraded: 1, blocked: 2, unknown: 0 })
  assert.equal(result.healthy + result.degraded + result.blocked + result.unknown, result.enabled)
  const row = result.jobs.find((item) => item.jobId === 'b')
  for (const field of ['lastExpectedAt', 'lastStartAt', 'lastFinishAt', 'lastSuccessAt', 'lastOutcome', 'currentOccurrence', 'currentBlocker', 'blockedAgeMs', 'credentialReadiness', 'nextExpectedAt', 'notificationRoute', 'runtime', 'store', 'blockedSince', 'lastReconciliationAt', 'lastKnownExecutionEvidence', 'fenceReason', 'alertState']) {
    assert.ok(Object.hasOwn(row, field), `row field ${field}`)
  }
  assert.equal(row.state, 'QUARANTINED_UNKNOWN')
  assert.equal(row.currentBlocker, 'OUTCOME_UNKNOWN')
  assert.deepEqual(row.currentOccurrence, { occurrenceId: 'occ-b', state: 'outcome_unknown' })
  assert.deepEqual(Object.keys(row.notificationRoute).sort(), ['class', 'source', 'status', 'targetRef'])
})

test('T18 missing credential blocks only its Job; invalid routing degrades only its Job', () => {
  const result = projectSchedulerHealth(snapshot())
  assert.equal(result.jobs.find((row) => row.jobId === 'c').classification, 'blocked')
  assert.equal(result.jobs.find((row) => row.jobId === 'd').classification, 'degraded')
  assert.equal(result.jobs.find((row) => row.jobId === 'a').classification, 'healthy')
  assert.equal(result.jobs.find((row) => row.jobId === 'c').currentBlocker, 'CREDENTIAL_UNAVAILABLE')
  const invalidSchedule = projectSchedulerHealth(snapshot({ jobs: [{ ...job('a'), schedule: { kind: 'every', everyMs: 0 } }] }))
  assert.equal(invalidSchedule.jobs[0].classification, 'degraded')
})

test('T19/T22 one quarantined Job leaves watchdog/readback and unrelated Jobs healthy', () => {
  const occurrence = { occurrenceId: 'occ-a', jobId: 'a', state: 'outcome_unknown', endedAt: T0 - 10 }
  const result = projectSchedulerHealth(snapshot({ occurrences: [occurrence], fences: { a: ['occ-a'] } }))
  assert.equal(result.jobs.filter((row) => row.state === 'QUARANTINED_UNKNOWN').length, 1)
  assert.equal(result.jobs.find((row) => row.jobId === 'b').classification, 'healthy')
  assert.equal(result.readbackAvailable, true)
  assert.equal(result.watchdogRunnable, true)
})

test('T29 generation drift retries whole capture then succeeds without mixing generations', async () => {
  let generation = 0
  const source = {
    name: 'jobs',
    token: async () => `g${generation}`,
    capture: async () => {
      const value = { jobs: [job('a')] }
      if (generation === 0) generation = 1
      return value
    },
  }
  const result = await acquireConsistentHealthSnapshot([source], { maxAttempts: 3 })
  assert.equal(result.complete, true)
  assert.equal(result.attempts, 2)
  assert.equal(result.generations[0].start, 'g1')
  assert.equal(result.generations[0].end, 'g1')
})

test('T29 third drift or untrusted token fails closed and never manufactures unknown=0', async () => {
  let generation = 0
  const result = await acquireConsistentHealthSnapshot([{
    name: 'jobs', token: async () => `g${generation++}`, capture: async () => ({ jobs: [job('a')] }),
  }], { maxAttempts: 3 })
  assert.equal(result.complete, false)
  const projected = projectSchedulerHealth(snapshot({ generations: result.generations }))
  assert.equal(projected.complete, false)
  assert.equal(projected.unknown, 4)
})

test('T18 fence projection mismatch fails complete health closed', () => {
  const result = projectSchedulerHealth(snapshot({ fences: { a: { occurrenceId: 'missing' } } }))
  assert.equal(result.complete, false)
  assert.equal(result.unknown, 4)
})

test('T33 unreadable Job document returns null counts and empty rows', () => {
  const result = projectSchedulerHealth(snapshot({ jobs: null, censusError: 'jobs unreadable' }))
  assert.equal(result.complete, false)
  assert.deepEqual(result.jobs, [])
  for (const field of ['enabled', 'healthy', 'degraded', 'blocked', 'unknown']) assert.equal(result[field], null)
  assert.equal(result.censusError, 'jobs unreadable')
})

test('T33 readable Jobs plus missing secondary source keeps complete rows classified UNKNOWN', () => {
  const result = projectSchedulerHealth(snapshot({ generations: [{ source: 'routing', trusted: false, start: null, end: null }] }))
  assert.equal(result.complete, false)
  assert.equal(result.jobs.length, 4)
  assert.equal(result.unknown, 4)
  assert.ok(result.jobs.every((row) => row.classification === 'unknown'))
})

test('T17 scheduler.read sees only own health while scheduler.audit sees all; auth result is required', () => {
  const health = projectSchedulerHealth(snapshot())
  assert.equal(filterHealthForPrincipal(health, { agentId: 'agt_a', scopes: new Set(['scheduler.read']) }).jobs.length, 1)
  assert.equal(filterHealthForPrincipal(health, { agentId: null, scopes: new Set(['scheduler.audit']) }).jobs.length, 4)
  assert.throws(() => filterHealthForPrincipal(health, { agentId: 'agt_a', scopes: new Set() }), /forbidden/)
})
