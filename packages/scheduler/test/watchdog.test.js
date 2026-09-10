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
  findingFingerprint,
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

test('TEST-8b: terminal failed stays RUN_FAILED-detectable regardless of lateSettlement basis (suppression withdrawn 2026-09-10 — Owner ruling NOT_AUTHORIZED_YET)', () => {
  const reconciledOcc = { runId: 'run:a', jobId: 'job-1', executionOutcome: 'failed', startedAt: NOW - 5_000, endedAt: NOW - 4_000, lateSettlement: { basis: 'operator-reconcile', resolvedTo: 'failed' } }
  // Accepted spec §5.5/§6 semantics: the failure FACT is detectable no matter
  // what disposition bookkeeping the record carries. Silence for dispositioned
  // failures must come from an accepted alert-LIFECYCLE authority, not here.
  const findings = evaluateRunHealth(
    { jobs: [liveJob({ state: { nextRunAtMs: NOW + 60_000 } })], occurrences: [reconciledOcc] },
    { nowMs: NOW },
  )
  assert.deepEqual(findings.map((f) => f.class), ['RUN_FAILED'])

  const plainFailed = evaluateRunHealth(
    { jobs: [liveJob({ state: { nextRunAtMs: NOW + 60_000 } })], occurrences: [{ ...reconciledOcc, lateSettlement: undefined }] },
    { nowMs: NOW },
  )
  assert.deepEqual(plainFailed.map((f) => f.class), ['RUN_FAILED'])
})

test('TEST-9: settled outcome_unknown admission block -> ADMISSION_BLOCKED_UNKNOWN per occurrence (2026-09-09 W1 structural blindness)', () => {
  // NOW = 2026-09-07T15:00Z = 23:00 CST; the job's 22:00 CST slot settled unknown at 22:10.
  const unknownOcc = {
    occurrenceId: 'occ:u1', runId: 'run:occ:u1', jobId: 'job-1', state: 'outcome_unknown',
    startedAt: NOW - 60 * 60 * 1000, endedAt: NOW - 50 * 60 * 1000,
  }
  const blockedJob = liveJob({ state: {}, createdAtMs: NOW - 30 * 24 * 60 * 60 * 1000 })
  const blocked = evaluateRunHealth({ jobs: [blockedJob], occurrences: [unknownOcc] }, { nowMs: NOW })
  const admission = blocked.filter((f) => f.class === 'ADMISSION_BLOCKED_UNKNOWN')
  assert.equal(admission.length, 1, 'exactly one finding for the one blocking occurrence')
  assert.equal(admission[0].occurrenceId, 'occ:u1')
  assert.equal(admission[0].jobId, 'job-1')
  assert.match(admission[0].detail, /reconcile/)

  // A lateSettlement NOTE without terminality still holds the fence: stay loud.
  const noted = evaluateRunHealth(
    { jobs: [blockedJob], occurrences: [{ ...unknownOcc, lateSettlement: { basis: 'operator-review', resolvedTo: 'failed' } }] },
    { nowMs: NOW },
  )
  assert.equal(noted.filter((f) => f.class === 'ADMISSION_BLOCKED_UNKNOWN').length, 1, 'note is not release')

  // Terminal + operator-reconciled = fence released: the admission finding is
  // gone; the failure FACT stays detectable as RUN_FAILED (accepted §5.5 —
  // silence for dispositioned failures needs its own alert-lifecycle authority).
  const released = evaluateRunHealth(
    {
      jobs: [liveJob({ state: { nextRunAtMs: NOW + 60_000 } })],
      occurrences: [{ ...unknownOcc, state: 'failed', executionOutcome: 'failed', lateSettlement: { basis: 'operator-reconcile', resolvedTo: 'failed' } }],
    },
    { nowMs: NOW },
  )
  assert.equal(released.filter((f) => f.class === 'ADMISSION_BLOCKED_UNKNOWN').length, 0, 'fence released')
  assert.deepEqual(released.map((f) => f.class), ['RUN_FAILED'], 'fact layer stays detectable')

  // A disabled job's unknown is JOB_DISABLED territory — no second alert class.
  const disabled = evaluateRunHealth(
    { jobs: [liveJob({ enabled: false, state: {} })], occurrences: [unknownOcc] },
    { nowMs: NOW },
  )
  assert.equal(disabled.filter((f) => f.class === 'ADMISSION_BLOCKED_UNKNOWN').length, 0)

  // Per-occurrence fingerprints: each reconcile quiets exactly its own alert.
  const twoUnknowns = evaluateRunHealth(
    { jobs: [blockedJob], occurrences: [unknownOcc, { ...unknownOcc, occurrenceId: 'occ:u2', runId: 'run:occ:u2' }] },
    { nowMs: NOW },
  )
  const fps = new Set(twoUnknowns.filter((f) => f.class === 'ADMISSION_BLOCKED_UNKNOWN').map(findingFingerprint))
  assert.equal(fps.size, 2)
})

test('TEST-10: undefined nextRunAtMs re-derives EXPECTED_RUN_MISSED from schedule+ledger instead of going blind', () => {
  // Daily 22:00 CST job: yesterday's slot ran terminal, TODAY's slot settled
  // unknown 50 minutes ago, deriveJobStateSummary dropped nextRunAtMs — the
  // exact state under which the old Number.isFinite guard never fired.
  const unknownOcc = {
    occurrenceId: 'occ:u1', runId: 'run:occ:u1', jobId: 'job-1', state: 'outcome_unknown',
    startedAt: NOW - 60 * 60 * 1000, endedAt: NOW - 50 * 60 * 1000,
  }
  const terminalYesterday = {
    occurrenceId: 'occ:y', runId: 'run:occ:y', jobId: 'job-1', state: 'succeeded', executionOutcome: 'succeeded',
    startedAt: NOW - 25 * 60 * 60 * 1000, endedAt: NOW - 25 * 60 * 60 * 1000 + 4_000,
  }
  const findings = evaluateRunHealth(
    { jobs: [liveJob({ state: {}, createdAtMs: NOW - 30 * 24 * 60 * 60 * 1000 })], occurrences: [terminalYesterday, unknownOcc] },
    { nowMs: NOW },
  )
  const missed = findings.filter((f) => f.class === 'EXPECTED_RUN_MISSED')
  assert.equal(missed.length, 1)
  assert.equal(missed[0].derivedUnderAdmissionBlock, true)
  assert.equal(missed[0].dueAt, '2026-09-07T14:00:00.000Z', 'dueAt = today 22:00 CST, the slot after the last terminal run')
  assert.ok(missed[0].overdueMs > 30 * 60 * 1000)

  // Healthy projection stays on the plain path: finite future nextRun = silent.
  const healthy = evaluateRunHealth(
    { jobs: [liveJob({ state: { nextRunAtMs: NOW + 23 * 60 * 60 * 1000 } })], occurrences: [terminalYesterday] },
    { nowMs: NOW },
  )
  assert.deepEqual(healthy, [])

  // every-kind grid derives too: last terminal 3h ago on a 30m grid, block since.
  const everyJob = liveJob({
    schedule: { kind: 'every', everyMs: 30 * 60 * 1000, anchorMs: NOW - 8 * 60 * 60 * 1000 },
    state: {},
    createdAtMs: NOW - 30 * 24 * 60 * 60 * 1000,
  })
  const everyFindings = evaluateRunHealth(
    {
      jobs: [everyJob],
      occurrences: [
        { ...terminalYesterday, endedAt: NOW - 3 * 60 * 60 * 1000, startedAt: NOW - 3 * 60 * 60 * 1000 - 4_000 },
        { ...unknownOcc, endedAt: NOW - 2 * 60 * 60 * 1000 },
      ],
    },
    { nowMs: NOW },
  )
  const everyMissed = everyFindings.filter((f) => f.class === 'EXPECTED_RUN_MISSED')
  assert.equal(everyMissed.length, 1)
  assert.equal(everyMissed[0].derivedUnderAdmissionBlock, true)
  assert.ok(everyMissed[0].overdueMs > 30 * 60 * 1000)
})

test('SCHEDULER_RUNTIME_UNHEALTHY from health probe (TEST-H store half); evidence staleness is not a finding', () => {
  const findings = evaluateRunHealth({ jobs: [], occurrences: [] }, {
    nowMs: NOW,
    runtimeHealth: { healthOk: false },
  })
  assert.equal(findings.filter((f) => f.class === 'SCHEDULER_RUNTIME_UNHEALTHY').length, 1)
  // evidence-heartbeat staleness was deliberately removed: the evidence log
  // only gains entries on activity, so quiet nights would trip it forever.
  assert.equal(evaluateRunHealth({ jobs: [], occurrences: [] }, {
    nowMs: NOW,
    runtimeHealth: { evidenceAgeMs: null },
  }).length, 0)
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
