import { test } from 'node:test'
import assert from 'node:assert/strict'

import { compileIncidents } from '../../src/watchdog/incident-compiler.js'
import { markNotificationDelivery, updateIncidentState } from '../../src/watchdog/incident-lifecycle.js'
import { projectSchedulerHealth } from '../../src/watchdog/health.js'
import { ROUTE_CLASSES, resolveNotificationRoute } from '../../src/watchdog/routing.js'

const fact = { class: 'SCHEDULER_RUNTIME_UNHEALTHY', subjectKind: 'runtime', stableSubjectId: 'scheduler-runtime' }
const manifest = { version: 1, canonicalOpsTarget: { channel: 'feishu', to: 'ops' }, ownerTargets: {}, jobFailureTargets: {} }

test('T31 valid route creates one opening intent; invalid route remains durable, failed, and health-visible', () => {
  const [incident] = compileIncidents([fact]).incidents
  const opened = updateIncidentState({}, [incident], { nowMs: 1 })
  assert.equal(opened.notifications.length, 1)
  assert.equal(Object.keys(opened.state.outbox).length, 1)
  assert.equal(resolveNotificationRoute({ routeClass: ROUTE_CLASSES.SCHEDULER_CONTROL_PLANE_INCIDENT, manifest }).route.to, 'ops')
  assert.equal(updateIncidentState(opened.state, [incident], { nowMs: 2 }).notifications.length, 0)

  const invalidRoute = resolveNotificationRoute({
    routeClass: ROUTE_CLASSES.SCHEDULER_CONTROL_PLANE_INCIDENT,
    manifest: { ...manifest, canonicalOpsTarget: null },
  })
  assert.equal(invalidRoute.delivery, 'FAILED')
  const key = opened.notifications[0].notificationKey
  const failed = markNotificationDelivery(opened.state, key, 'FAILED', 2)
  assert.equal(failed.outbox[key].delivery, 'FAILED')
  const health = projectSchedulerHealth({
    generatedAt: 2,
    jobs: [{ id: 'job-a', agentId: 'agt-a', logicalKey: 'a', enabled: true, schedule: { kind: 'every', everyMs: 1 }, state: {} }],
    occurrences: [], fences: {}, credentials: { 'agt-a': true }, routes: { 'job-a': { ready: false, source: 'local_ops_sink', status: 'CONFIG_MISSING' } },
    incidents: failed.incidents,
    provenance: { canonicalPair: true, runtime: 'r', store: 's' },
    generations: [{ source: 'all', trusted: true, start: 'g', end: 'g' }],
  })
  assert.equal(health.degraded, 1)
  assert.equal(health.jobs[0].notificationRoute.status, 'CONFIG_MISSING')
})
