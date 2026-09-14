import { test } from 'node:test'
import assert from 'node:assert/strict'

import { compileIncidents, incidentRootIdentity } from '../../src/watchdog/incident-compiler.js'
import {
  migrateLegacyAlertState,
  markNotificationDelivery,
  notificationKey,
  updateIncidentState,
} from '../../src/watchdog/incident-lifecycle.js'

const T0 = Date.parse('2026-09-14T00:00:00Z')

function unknownFacts(jobId, occurrenceId) {
  return [
    { class: 'EXPECTED_RUN_MISSED', jobId, occurrenceId, derivedUnderAdmissionBlock: true },
    { class: 'ADMISSION_BLOCKED_UNKNOWN', jobId, occurrenceId, blockedSince: new Date(T0).toISOString() },
  ]
}

test('T01 paired missed/block facts for six occurrences compile to exactly six root incidents', () => {
  const facts = Array.from({ length: 6 }, (_, index) => unknownFacts(`job-${index}`, `occ-${index}`)).flat()
  const result = compileIncidents(facts)
  assert.equal(result.facts.length, 12)
  assert.equal(result.incidents.length, 6)
  assert.ok(result.incidents.every((incident) => incident.rootCauseClass === 'RUN_STUCK_OUTCOME_UNKNOWN'))
  assert.ok(result.incidents.every((incident) => incident.symptoms.includes('EXPECTED_RUN_MISSED')))
})

test('T25 root identity is closed and stable; no suffix/name/chat/time identity', () => {
  assert.equal(
    incidentRootIdentity({ rootCauseClass: 'RUN_STUCK_OUTCOME_UNKNOWN', jobId: 'job-a', occurrenceId: 'occ-full' }),
    'occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-a|occ-full',
  )
  assert.equal(
    incidentRootIdentity({ rootCauseClass: 'JOB_CONFIGURATION_INVALID', jobId: 'job-a', jobRevision: 7 }),
    'job|JOB_CONFIGURATION_INVALID|job-a|7',
  )
  assert.equal(
    incidentRootIdentity({ rootCauseClass: 'SCHEDULER_RUNTIME_UNHEALTHY', subjectKind: 'runtime', stableSubjectId: 'scheduler-runtime' }),
    'control|SCHEDULER_RUNTIME_UNHEALTHY|runtime|scheduler-runtime',
  )
  assert.throws(() => incidentRootIdentity({ rootCauseClass: 'X', stableSubjectId: String(T0) }), /subjectKind/)
})

test('T10/T21 unchanged incident across ticks/restart emits one deterministic opening only', () => {
  const [incident] = compileIncidents(unknownFacts('job-a', 'occ-a')).incidents
  const first = updateIncidentState({}, [incident], { nowMs: T0 })
  assert.equal(first.notifications.length, 1)
  assert.equal(first.notifications[0].transitionKind, 'OPEN')
  const replay = updateIncidentState(JSON.parse(JSON.stringify(first.state)), [incident], { nowMs: T0 + 86_400_000 })
  assert.equal(replay.notifications.length, 0)
  assert.equal(Object.keys(replay.state.outbox).length, 1)
  assert.equal(first.notifications[0].notificationKey, notificationKey(first.notifications[0]))
})

test('T21/T26 delivery readback updates the same outbox key without minting another intent', () => {
  const [incident] = compileIncidents(unknownFacts('job-a', 'occ-a')).incidents
  const opened = updateIncidentState({}, [incident], { nowMs: T0 })
  const key = opened.notifications[0].notificationKey
  const delivered = markNotificationDelivery(opened.state, key, 'DELIVERED', T0 + 1)
  assert.deepEqual(Object.keys(delivered.outbox), [key])
  assert.equal(delivered.outbox[key].delivery, 'DELIVERED')
  assert.equal(delivered.incidents[incident.rootIdentity].alertState.delivery, 'DELIVERED')
})

test('T11/T32 acknowledgment and recovery closures are deterministic and mutually exclusive', () => {
  const [incident] = compileIncidents(unknownFacts('job-a', 'occ-a')).incidents
  const opened = updateIncidentState({}, [incident], { nowMs: T0 })
  const acknowledged = updateIncidentState(opened.state, [incident], {
    nowMs: T0 + 1,
    acknowledgments: new Set([incident.rootIdentity]),
  })
  assert.deepEqual(acknowledged.notifications.map((item) => item.transitionKind), ['CLOSED_ACKNOWLEDGED'])
  const gone = updateIncidentState(acknowledged.state, [], { nowMs: T0 + 2 })
  assert.equal(gone.notifications.length, 0)

  const openedAgain = updateIncidentState({}, [incident], { nowMs: T0 })
  const recovered = updateIncidentState(openedAgain.state, [], { nowMs: T0 + 1 })
  assert.deepEqual(recovered.notifications.map((item) => item.transitionKind), ['CLOSED_RECOVERED'])
})

test('T25 occurrence incidents never reopen; recurrent control-plane roots increment episode', () => {
  const [occurrence] = compileIncidents(unknownFacts('job-a', 'occ-a')).incidents
  let transition = updateIncidentState({}, [occurrence], { nowMs: T0 })
  transition = updateIncidentState(transition.state, [], { nowMs: T0 + 1 })
  const noReopen = updateIncidentState(transition.state, [occurrence], { nowMs: T0 + 2 })
  assert.equal(noReopen.notifications.length, 0)

  const [control] = compileIncidents([
    { class: 'SCHEDULER_RUNTIME_UNHEALTHY', reason: 'down', subjectKind: 'runtime', stableSubjectId: 'scheduler-runtime' },
  ]).incidents
  let cp = updateIncidentState({}, [control], { nowMs: T0 })
  cp = updateIncidentState(cp.state, [], { nowMs: T0 + 1 })
  cp = updateIncidentState(cp.state, [control], { nowMs: T0 + 2 })
  assert.equal(cp.notifications[0].incident.episode, 2)
})

test('T27 legacy paired symptoms collapse without re-alert when any member has delivery proof', () => {
  const facts = unknownFacts('job-a', 'occ-a')
  const legacy = {
    active: {
      'EXPECTED_RUN_MISSED|job-a|occ-a': { firstSeenAt: T0, notifiedCount: 1 },
      'ADMISSION_BLOCKED_UNKNOWN|job-a|occ-a': { firstSeenAt: T0, notifiedCount: 0 },
    },
  }
  const migrated = migrateLegacyAlertState(legacy, facts, {
    deliveredFingerprints: new Set(['EXPECTED_RUN_MISSED|job-a|occ-a']),
    nowMs: T0 + 1,
  })
  assert.equal(Object.keys(migrated.incidents).length, 1)
  assert.equal(Object.values(migrated.incidents)[0].alertState.delivery, 'DELIVERED')
  assert.equal(Object.keys(migrated.outbox).length, 0)
})

test('T27 acknowledged and retired legacy roots migrate closed without fabricating alerts', () => {
  const acknowledgedFact = { class: 'RUN_FAILED', jobId: 'job-f', occurrenceId: 'occ-f' }
  const retiredFact = { class: 'SCHEDULER_RUNTIME_UNHEALTHY', subjectKind: 'runtime', stableSubjectId: 'scheduler-runtime' }
  const migrated = migrateLegacyAlertState({
    active: {},
    acknowledged: { 'RUN_FAILED|job-f|occ-f': { acknowledgedAt: T0 } },
    retired: { 'SCHEDULER_RUNTIME_UNHEALTHY|scheduler-runtime': { retiredAt: T0 } },
  }, [], {
    legacyFacts: new Map([
      ['RUN_FAILED|job-f|occ-f', acknowledgedFact],
      ['SCHEDULER_RUNTIME_UNHEALTHY|scheduler-runtime', retiredFact],
    ]),
    nowMs: T0 + 1,
  })
  const rows = Object.values(migrated.incidents)
  assert.equal(rows.find((row) => row.rootCauseClass === 'RUN_FAILED').lifecycle, 'CLOSED_ACKNOWLEDGED')
  assert.equal(rows.find((row) => row.rootCauseClass === 'SCHEDULER_RUNTIME_UNHEALTHY').lifecycle, 'CLOSED_RECOVERED')
  assert.deepEqual(migrated.outbox, {})
})

test('T27/T28 ambiguous delivery evidence and malformed state fail loud without empty reset', () => {
  assert.throws(() => migrateLegacyAlertState({ active: { bad: {} } }, unknownFacts('job-a', 'occ-a'), {
    deliveredFingerprints: new Set(), nowMs: T0,
  }), /legacy fingerprint/)
  assert.throws(() => updateIncidentState({ version: 99 }, [], { nowMs: T0 }), /unsupported incident state/)
})
