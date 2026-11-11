import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { projectSchedulerHealth } from '../../src/watchdog/health.js'
import { normalizeJob } from '../../src/job-model.js'
import { computeNextRunAtMsV2 } from '../../src/eligibility.js'
import { applyTransition, buildOccurrenceRecord, rebuildFences } from '../../src/occurrence-model.js'
import { compileIncidents } from '../../src/watchdog/incident-compiler.js'
import { updateIncidentState, bindNotificationDelivery, markNotificationDelivery } from '../../src/watchdog/incident-lifecycle.js'
import { projectIncidentDelivery } from '../../src/watchdog/delivery-projection.js'
import { providerIdempotencyKey, retryableOutboxIntents, stableNotificationText } from '../../src/watchdog/delivery.js'
import { resolveNotificationRoute } from '../../src/watchdog/routing.js'
import { validateIncidentState } from '../../src/watchdog/durable-state.js'

const NOW = Date.parse('2026-11-03T00:00:00Z')
const MINUTE = 60_000
const PROBE_CLASS = 'JOB_CONFIGURATION_INVALID'
const MANIFEST = {
  version: 1, canonicalOpsTarget: { channel: 'feishu', to: 'ops-fixture' },
  ownerTargets: {}, jobFailureTargets: {},
}

function job(overrides = {}) {
  return normalizeJob({
    id: 'probe-job', logicalKey: 'owner:probe', name: 'Probe fixture', agentId: 'agt_probe',
    enabled: true, schedule: { kind: 'every', everyMs: MINUTE, anchorMs: NOW },
    payload: { kind: 'agentTurn', message: 'isolated fixture' }, delivery: { mode: 'none' },
    createdAtMs: NOW - MINUTE, updatedAtMs: NOW - MINUTE, revisionActivatedAtMs: NOW - MINUTE,
    state: { nextRunAtMs: NOW + MINUTE }, ...overrides,
  })
}

function health(target, occurrences = [], nowMs = NOW) {
  return projectSchedulerHealth({
    version: 3, jobs: [target], occurrences, fences: rebuildFences(occurrences), generatedAt: nowMs,
    credentials: { agt_probe: true }, routes: { [target.id]: { ready: true } }, incidents: {},
    provenance: { canonicalPair: true, runtime: 'isolated-runtime', store: 'isolated-store' },
    generations: [{ source: 'fixture', trusted: true, start: 'same', end: 'same' }],
  })
}

function probes(result) { return result.findings.filter((finding) => finding.class === PROBE_CLASS) }

function occurrence(target, state) {
  const record = buildOccurrenceRecord({ job: target, kind: 'natural', nominalScheduledAt: NOW - MINUTE, admittedAt: NOW - 1_000 })
  if (state === 'running') applyTransition(record, { to: state, at: NOW - 900, reason: 'started', startedAt: NOW - 900 })
  if (state === 'failed') applyTransition(record, {
    to: state, at: NOW - 500, reason: 'rejected', endedAt: NOW - 500, executionOutcome: 'failed',
    terminalEvidence: { kind: 'pre-start-rejection', detailRef: 'fixture-rejection' },
  })
  if (state === 'outcome_unknown') applyTransition(record, { to: state, at: NOW - 500, reason: 'unknown', endedAt: NOW - 500 })
  return record
}

function transition(state, result, nowMs = NOW) {
  return updateIncidentState(state, compileIncidents(result.findings).incidents, { nowMs })
}

function delivered(state, intent, at) {
  const route = resolveNotificationRoute({ routeClass: intent.routeClass, job: job(), manifest: MANIFEST })
  const bound = bindNotificationDelivery(state, intent.notificationKey, {
    producer: 'w1', route: route.route, routeSource: route.routeSource, routingSha256: 'a'.repeat(64),
    payload: stableNotificationText(intent), providerKey: providerIdempotencyKey(intent.notificationKey),
  }, at)
  const attempted = markNotificationDelivery(bound, intent.notificationKey, 'OUTCOME_UNKNOWN', at)
  return markNotificationDelivery(attempted, intent.notificationKey, 'DELIVERED', at)
}

test('#527 missing nextRun is a degraded projection observation, not inferred execution failure', () => {
  const target = job({ state: {} })
  const before = structuredClone(target)
  const result = health(target)
  assert.equal(result.complete, true)
  assert.equal(result.jobs[0].health, 'DEGRADED')
  assert.equal(probes(result)[0]?.reason, 'next_run_projection_missing')
  assert.equal(probes(result).length, 1)
  assert.ok(Number.isFinite(computeNextRunAtMsV2({ job: target, occurrences: [], nowMs: NOW })))
  assert.deepEqual(target, before, 'probe never repairs the Job or projection')
})

test('#527 legal never-firing cron and elapsed enabled one-shot emit actionable no-remaining-run facts', () => {
  for (const schedule of [
    { kind: 'cron', expr: '0 0 30 2 *', tz: 'UTC', staggerMs: 0 },
    { kind: 'at', at: new Date(NOW - 60 * MINUTE).toISOString() },
  ]) {
    const target = job({ schedule, state: {} })
    assert.equal(probes(health(target))[0]?.reason, 'no_remaining_run')
    // A finite but stale/corrupt projection cannot hide a never-fire definition.
    target.state.nextRunAtMs = NOW + MINUTE
    assert.equal(probes(health(target))[0]?.reason, 'no_remaining_run')
  }
})

test('#527 normal cron, every, future one-shot and disabled Jobs produce no probe', () => {
  const schedules = [
    { kind: 'cron', expr: '0 0 1 1 *', tz: 'UTC', staggerMs: 0 },
    { kind: 'every', everyMs: MINUTE, anchorMs: NOW },
    { kind: 'at', at: new Date(NOW + MINUTE).toISOString() },
  ]
  for (const schedule of schedules) {
    const result = health(job({ schedule }))
    assert.equal(result.jobs[0].health, 'HEALTHY')
    assert.deepEqual(probes(result), [])
  }
  const disabled = health(job({ enabled: false, state: {} }))
  assert.equal(disabled.enabled, 0)
  assert.deepEqual(probes(disabled), [])
})

test('#527 admitted/running one-shots and authorized retry projection are not never-fire incidents', () => {
  const target = job({ schedule: { kind: 'at', at: new Date(NOW - MINUTE).toISOString() }, state: {} })
  for (const state of ['admitted', 'running']) assert.deepEqual(probes(health(target, [occurrence(target, state)])), [])
  target.retry = { auto: true }
  const failed = occurrence(target, 'failed')
  target.state.nextRunAtMs = computeNextRunAtMsV2({ job: target, occurrences: [failed], nowMs: NOW })
  assert.ok(target.state.nextRunAtMs > NOW)
  const retryHealth = health(target, [failed])
  assert.equal(retryHealth.complete, true)
  assert.deepEqual(probes(retryHealth), [])
})

test('#527 unresolved UNKNOWN keeps its one existing actionable incident and its fence', () => {
  const target = job({ state: {} })
  const record = occurrence(target, 'outcome_unknown')
  const before = structuredClone(record)
  const result = health(target, [record])
  assert.equal(result.jobs[0].health, 'BLOCKED')
  assert.deepEqual(probes(result), [])
  const compiled = compileIncidents(result.findings)
  assert.equal(compiled.incidents.length, 1)
  assert.equal(compiled.incidents[0].rootCauseClass, 'RUN_STUCK_OUTCOME_UNKNOWN')
  assert.deepEqual(record, before)
})

test('#527 C11-R4 OPEN, unchanged tick, delivery/restart and RECOVERED use existing ops channel', () => {
  const result = health(job({ state: {} }))
  const opened = transition({}, result)
  const open = projectIncidentDelivery(opened.state, retryableOutboxIntents(opened.state)).deliverable
  assert.equal(open.length, 1)
  assert.equal(open[0].incident.rootIdentity, 'job|JOB_CONFIGURATION_INVALID|probe-job|1')
  assert.equal(open[0].routeClass, 'SCHEDULER_CONTROL_PLANE_INCIDENT')
  const route = resolveNotificationRoute({ routeClass: open[0].routeClass, job: job(), manifest: MANIFEST })
  assert.equal(route.routeSource, 'canonicalOpsTarget')
  const text = stableNotificationText(open[0])
  assert.match(text, /next.run projection missing/i)
  assert.match(text, /Action:.*inspect/i)
  assert.match(text, /Agent: agt_probe.*owner:probe/)
  assert.match(text, /Evidence:/)
  let state = delivered(opened.state, open[0], NOW)
  state = validateIncidentState(JSON.parse(JSON.stringify(state)))
  const unchanged = transition(state, result, NOW + MINUTE)
  assert.equal(unchanged.notifications.length, 0)
  assert.equal(projectIncidentDelivery(unchanged.state, retryableOutboxIntents(unchanged.state)).deliverable.length, 0)
  const recovered = transition(unchanged.state, health(job()), NOW + 2 * MINUTE)
  const close = projectIncidentDelivery(recovered.state, retryableOutboxIntents(recovered.state)).deliverable
  assert.equal(close.length, 1)
  assert.equal(close[0].transitionKind, 'CLOSED_RECOVERED')
  assert.match(stableNotificationText(close[0]), /RECOVERED/)
  state = delivered(recovered.state, close[0], NOW + 2 * MINUTE)
  state = validateIncidentState(JSON.parse(JSON.stringify(state)))
  assert.equal(transition(state, health(job()), NOW + 3 * MINUTE).notifications.length, 0)
})

test('#527 recovery before delivery suppresses stale OPEN and keeps the raw facts', () => {
  const opened = transition({}, health(job({ state: {} })))
  const recovered = transition(opened.state, health(job()), NOW + MINUTE)
  const projected = projectIncidentDelivery(recovered.state, retryableOutboxIntents(recovered.state))
  assert.deepEqual(projected.deliverable.map((intent) => intent.transitionKind), ['CLOSED_RECOVERED'])
  assert.equal(projected.suppressed.length, 1)
  assert.equal(projected.suppressed[0].code, 'stale_new_incident_recovered')
  assert.equal(Object.values(recovered.state.outbox).find((intent) => intent.transitionKind === 'OPEN').incident.facts[0].reason, 'next_run_projection_missing')
})

test('#527 distinct job identity is retained despite matching names and missing delivery target', () => {
  const first = job({ state: {} })
  const second = { ...first, id: 'another-job', logicalKey: 'owner:another' }
  const facts = [...health(first).findings, ...health(second).findings]
  assert.equal(compileIncidents(facts).incidents.length, 2)
  assert.equal(resolveNotificationRoute({
    routeClass: 'SCHEDULER_CONTROL_PLANE_INCIDENT', job: first, manifest: { ...MANIFEST, canonicalOpsTarget: null },
  }).localOpsSinkRequired, true)
})

test('#527 W1 retains its existing 300s cadence and consumes the canonical health findings', () => {
  const template = readFileSync(new URL('../../../../deployment-artifacts/scheduler-control-plane-reliability-v1/ai.agent-core.scheduler-watchdog-w1.plist.tmpl', import.meta.url), 'utf8')
  assert.match(template, /<key>StartInterval<\/key>\s*<integer>300<\/integer>/)
  const runner = readFileSync(new URL('../../../../scripts/scheduler-watchdog.mjs', import.meta.url), 'utf8')
  assert.match(runner, /createSchedulerHealthRuntime/)
  assert.match(runner, /health\.findings/)
})
