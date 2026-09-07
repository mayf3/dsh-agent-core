import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  parseDesiredState,
  evaluateDesiredState,
  evaluateRunHealth,
  evaluateReconciliationEvidence,
  evaluateCredentialProvider,
  heartbeatStale,
  formatFindings,
} from '../src/watchdog.js'

const NOW = Date.parse('2026-09-07T15:00:00.000Z')

const DESIRED = parseDesiredState({
  version: 1,
  jobs: [{
    logicalKey: 'owner:daily-summary-check',
    expectedEnabled: true,
    expectedSchedule: { kind: 'cron', expr: '0 22 * * *', tz: 'Asia/Shanghai' },
    expectedAgentId: 'agt_daily-thought-agent',
    runPolicy: { graceMinutes: 30, maxConsecutiveFailures: 2 },
  }],
})

function liveJob(overrides = {}) {
  return {
    id: 'job-1',
    logicalKey: 'owner:daily-summary-check',
    name: '每日摘要检查',
    agentId: 'agt_daily-thought-agent',
    enabled: true,
    schedule: { kind: 'cron', expr: '0 22 * * *', tz: 'Asia/Shanghai' },
    payload: { kind: 'agentTurn', message: 'backfill' },
    delivery: { mode: 'announce', channel: 'feishu', to: 'chat:oc_x' },
    state: { nextRunAtMs: NOW + 60_000 },
    ...overrides,
  }
}

test('desired-state manifest schema validation (§5.4.2)', () => {
  assert.throws(() => parseDesiredState({ version: 2, jobs: [] }), /version/)
  assert.throws(() => parseDesiredState({ version: 1, jobs: [{ expectedEnabled: true }] }), /logicalKey/)
  assert.throws(() => parseDesiredState({ version: 1, jobs: [{ logicalKey: 'k', expectedSchedule: { kind: 'wat' } }] }), /kind/)
  const parsed = parseDesiredState({ version: 1, jobs: [{ logicalKey: 'k', expectedSchedule: { kind: 'every' } }] })
  assert.equal(parsed.jobs[0].expectedEnabled, true, 'enabled defaults to true')
  assert.equal(parsed.jobs[0].runPolicy.graceMinutes, 30, 'grace defaults to 30 minutes')
})

test('TEST-5: critical job missing -> JOB_MISSING', () => {
  const findings = evaluateDesiredState({ jobs: [] }, DESIRED)
  assert.deepEqual(findings.map((f) => f.class), ['JOB_MISSING'])
})

test('TEST-6: disabled / schedule / timezone / agent drift each detected; healthy job silent', () => {
  const ok = evaluateDesiredState({ jobs: [liveJob()] }, DESIRED)
  assert.deepEqual(ok, [])

  const disabled = evaluateDesiredState({ jobs: [liveJob({ enabled: false })] }, DESIRED)
  assert.deepEqual(disabled.map((f) => f.class), ['JOB_DISABLED'])

  const drifted = evaluateDesiredState({ jobs: [liveJob({ schedule: { kind: 'cron', expr: '30 5 * * *', tz: 'Asia/Shanghai' } })] }, DESIRED)
  assert.deepEqual(drifted.map((f) => f.class), ['SCHEDULE_DRIFT'])

  const tzDrift = evaluateDesiredState({ jobs: [liveJob({ schedule: { kind: 'cron', expr: '0 22 * * *', tz: 'UTC' } })] }, DESIRED)
  assert.deepEqual(tzDrift.map((f) => f.class), ['TIMEZONE_DRIFT'])

  const agentDrift = evaluateDesiredState({ jobs: [liveJob({ agentId: 'agt_other' })] }, DESIRED)
  assert.deepEqual(agentDrift.map((f) => f.class), ['TARGET_AGENT_DRIFT'])

  const duplicated = evaluateDesiredState({ jobs: [liveJob(), liveJob({ id: 'job-2' })] }, DESIRED)
  assert.deepEqual(duplicated.map((f) => f.class), ['JOB_DUPLICATED'])
})

test('TEST-7: expected occurrence absent past grace -> EXPECTED_RUN_MISSED; fresh nextRun silent', () => {
  const overdue = evaluateRunHealth(
    { jobs: [liveJob({ state: { nextRunAtMs: NOW - 61 * 60 * 1000 } })], occurrences: [] },
    { nowMs: NOW },
  )
  assert.deepEqual(overdue.map((f) => f.class), ['EXPECTED_RUN_MISSED'])
  assert.ok(overdue[0].overdueMs > 0)

  const fresh = evaluateRunHealth({ jobs: [liveJob()], occurrences: [] }, { nowMs: NOW })
  assert.deepEqual(fresh, [])
})

test('TEST-8 store half: failed run / stuck run / consecutive failures detected', () => {
  const doc = {
    jobs: [liveJob({ state: { nextRunAtMs: NOW + 60_000, consecutiveErrors: 3 } })],
    occurrences: [
      { runId: 'run:a', jobId: 'job-1', executionOutcome: 'failed', startedAt: NOW - 5_000, endedAt: NOW - 4_000 },
      { runId: 'run:b', jobId: 'job-1', startedAt: NOW - 3 * 60 * 60 * 1000 },
    ],
  }
  const findings = evaluateRunHealth(doc, { nowMs: NOW })
  const classes = findings.map((f) => f.class).sort()
  assert.deepEqual(classes, ['CONSECUTIVE_FAILURE', 'RUN_FAILED', 'RUN_STUCK'])
})

test('SCHEDULER_RUNTIME_UNHEALTHY from health probe and evidence staleness (TEST-H store half)', () => {
  const findings = evaluateRunHealth({ jobs: [], occurrences: [] }, {
    nowMs: NOW,
    runtimeHealth: { healthOk: false, evidenceAgeMs: null },
  })
  assert.equal(findings.filter((f) => f.class === 'SCHEDULER_RUNTIME_UNHEALTHY').length, 2)
})

test('TEST-G: W2 heartbeat staleness is the W1-death signal; fresh heartbeat silent', () => {
  const graceMs = 15 * 60 * 1000
  assert.equal(heartbeatStale(NOW - graceMs - 1, NOW, graceMs), true)
  assert.equal(heartbeatStale(NOW - 60_000, NOW, graceMs), false)
  assert.equal(heartbeatStale(undefined, NOW, graceMs), true, 'missing heartbeat file = stale')
})

test('alert text carries coordinates and never message bodies', () => {
  const text = formatFindings(
    [{ class: 'JOB_MISSING', logicalKey: 'owner:daily-summary-check' }],
    { nowMs: NOW },
  )
  assert.match(text, /JOB_MISSING/)
  assert.match(text, /owner:daily-summary-check/)
  assert.equal(text.includes('backfill'), false)
})

test('audit Blocker-3: reconciliation evidence entries become Owner-visible findings; stale entries silent', () => {
  const recent = { ts: NOW - 60_000, operation: 'create', logicalKey: 'owner:daily-summary-check', reason: 'read-back transport failed' }
  const fresh = evaluateReconciliationEvidence([recent], { nowMs: NOW })
  assert.deepEqual(fresh.map((f) => f.class), ['MUTATION_STILL_UNKNOWN'])
  assert.equal(fresh[0].logicalKey, 'owner:daily-summary-check')

  const stale = evaluateReconciliationEvidence([{ ...recent, ts: NOW - 25 * 60 * 60 * 1000 }], { nowMs: NOW })
  assert.deepEqual(stale, [])

  const corrupt = evaluateReconciliationEvidence([null, 'junk', { ts: 'x' }], { nowMs: NOW })
  assert.deepEqual(corrupt, [])
})

test('audit: desired-state runPolicy grace is plumbed into EXPECTED_RUN_MISSED', () => {
  const tightDesired = parseDesiredState({
    version: 1,
    jobs: [{
      logicalKey: 'owner:daily-summary-check',
      expectedSchedule: { kind: 'cron', expr: '0 22 * * *', tz: 'Asia/Shanghai' },
      runPolicy: { graceMinutes: 1 },
    }],
  })
  const slightlyOverdue = { jobs: [liveJob({ state: { nextRunAtMs: NOW - 5 * 60 * 1000 } })], occurrences: [] }
  assert.deepEqual(evaluateRunHealth(slightlyOverdue, { nowMs: NOW }), [], 'default 30m grace: silent')
  const findings = evaluateRunHealth(slightlyOverdue, { nowMs: NOW, desired: tightDesired })
  assert.deepEqual(findings.map((f) => f.class), ['EXPECTED_RUN_MISSED'], 'manifest grace 1m: detected')
})

test('audit FOLLOW_UP closure: credential provider degraded is Owner-visible (§5.6 self-probe)', () => {
  assert.deepEqual(evaluateCredentialProvider(undefined), [])
  assert.deepEqual(evaluateCredentialProvider({ exists: true, bytes: 1024 }), [])
  const missing = evaluateCredentialProvider({ exists: false }, { path: '/x/agent-credentials.json' })
  assert.deepEqual(missing.map((f) => f.class), ['CREDENTIAL_PROVIDER_DEGRADED'])
  assert.match(missing[0].reason, /missing/)
  const empty = evaluateCredentialProvider({ exists: true, bytes: 0 }, { path: '/x/agent-credentials.json' })
  assert.deepEqual(empty.map((f) => f.class), ['CREDENTIAL_PROVIDER_DEGRADED'])
  assert.match(empty[0].reason, /empty/)
})
