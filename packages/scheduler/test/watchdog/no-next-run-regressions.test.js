import { test } from 'node:test'
import assert from 'node:assert/strict'

import { normalizeJob } from '../../src/job-model.js'
import { projectSchedulerHealth } from '../../src/watchdog/health.js'
import { applyTransition, buildOccurrenceRecord, rebuildFences } from '../../src/occurrence-model.js'

const NOW = Date.parse('2026-11-03T00:00:00Z')
const MINUTE = 60_000

function job(overrides = {}) {
  return normalizeJob({
    id: 'one-shot', name: 'Catch-up fixture', agentId: 'agt_fixture', enabled: true,
    schedule: { kind: 'at', at: new Date(NOW - MINUTE).toISOString() },
    payload: { kind: 'agentTurn', message: 'isolated fixture' }, delivery: { mode: 'none' },
    createdAtMs: NOW - 60 * MINUTE, updatedAtMs: NOW - 60 * MINUTE,
    revisionActivatedAtMs: NOW - 60 * MINUTE, state: { nextRunAtMs: NOW - MINUTE },
    ...overrides,
  })
}

function health(target, occurrences = [], overrides = {}) {
  return projectSchedulerHealth({
    version: 3, jobs: [target], occurrences, fences: rebuildFences(occurrences), generatedAt: NOW,
    credentials: { agt_fixture: true }, routes: { [target.id]: { ready: true } }, incidents: {},
    provenance: { canonicalPair: true },
    generations: [{ source: 'fixture', trusted: true, start: 'same', end: 'same' }],
    ...overrides,
  })
}

function probeReasons(result) {
  return result.findings.filter((fact) => fact.class === 'JOB_CONFIGURATION_INVALID').map((fact) => fact.reason)
}

test('#527 invalid cron returns incomplete UNKNOWN without throwing with or without cached nextRun', () => {
  for (const state of [{ nextRunAtMs: NOW + MINUTE }, {}]) {
    const target = { ...job(), schedule: { kind: 'cron', expr: 'not cron', tz: 'Asia/Shanghai' }, state }
    const before = structuredClone(target)
    const result = health(target)
    assert.equal(result.complete, false)
    assert.equal(result.jobs[0].health, 'UNKNOWN')
    assert.equal(result.unknown, 1)
    assert.equal(result.readbackAvailable, true)
    assert.equal(result.watchdogRunnable, true)
    assert.deepEqual(probeReasons(result), [])
    assert.deepEqual(target, before)
  }
})

test('#527 valid authority with incomplete generations retains the missing-projection finding', () => {
  const result = health(job({ schedule: { kind: 'every', everyMs: MINUTE }, state: {} }), [], { generations: [] })
  assert.equal(result.complete, false)
  assert.equal(result.jobs[0].health, 'UNKNOWN')
  assert.deepEqual(probeReasons(result), ['next_run_projection_missing'])
})

test('#527 unrecorded one-shot remains healthy through the native catch-up window including its boundary', () => {
  for (const ageMs of [0, MINUTE, 15 * MINUTE]) {
    const due = NOW - ageMs
    const target = job({ schedule: { kind: 'at', at: new Date(due).toISOString() }, state: { nextRunAtMs: due } })
    const before = structuredClone(target)
    const result = health(target)
    assert.equal(result.complete, true)
    assert.equal(result.jobs[0].health, 'HEALTHY')
    assert.deepEqual(result.findings, [])
    assert.deepEqual(target, before)
  }
})

test('#527 eligible catch-up with missing cache remains a projection observation rather than no remaining run', () => {
  const result = health(job({ state: {} }))
  assert.equal(result.jobs[0].health, 'DEGRADED')
  assert.deepEqual(probeReasons(result), ['next_run_projection_missing'])
})

test('#527 stale and pre-activation one-shots do not gain catch-up eligibility', () => {
  const targets = [
    job({ schedule: { kind: 'at', at: new Date(NOW - 15 * MINUTE - 1).toISOString() } }),
    job({ revisionActivatedAtMs: NOW - MINUTE }),
    job({ revisionActivatedAtMs: NOW }),
  ]
  for (const target of targets) {
    const result = health(target)
    assert.equal(result.jobs[0].health, 'DEGRADED')
    assert.deepEqual(probeReasons(result), ['no_remaining_run'])
  }
})

test('#527 an existing occurrence prevents a one-shot catch-up exemption even when it predates activation', () => {
  const target = job()
  const record = buildOccurrenceRecord({
    job: target, kind: 'natural', nominalScheduledAt: NOW - 62 * MINUTE, admittedAt: NOW - 62 * MINUTE,
  })
  applyTransition(record, {
    to: 'failed', at: NOW - 61 * MINUTE, reason: 'rejected', endedAt: NOW - 61 * MINUTE, executionOutcome: 'failed',
    terminalEvidence: { kind: 'pre-start-rejection', detailRef: 'fixture-rejection' },
  })
  const result = health(target, [record])
  assert.equal(result.complete, true)
  assert.deepEqual(probeReasons(result), ['no_remaining_run'])
})
