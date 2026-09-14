import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

import { resolveProductionLayout } from '../../src/paths.js'
import { assertSchedulerStartupReady, createSchedulerHealthRuntime } from '../../src/scheduler/health-runtime.js'
import { compileIncidents } from '../../../scheduler/src/watchdog/incident-compiler.js'
import { bindNotificationDelivery, updateIncidentState } from '../../../scheduler/src/watchdog/incident-lifecycle.js'
import { providerIdempotencyKey, stableNotificationText } from '../../../scheduler/src/watchdog/delivery.js'

const RUNTIME_SHA = '1234567890abcdef1234567890abcdef12345678'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'scheduler-health-runtime-'))
  const layout = resolveProductionLayout(root)
  await mkdir(join(root, 'scheduler'), { recursive: true })
  await mkdir(join(root, 'control', 'scheduler-watchdog'), { recursive: true })
  await chmod(join(root, 'control', 'scheduler-watchdog'), 0o700)
  await writeFile(layout.jobsStore, JSON.stringify({ version: 3, jobs: [{ id: 'a', name: 'a', agentId: 'agt_a', logicalKey: 'a', enabled: true, scheduleRevision: 1, createdAtMs: 0, updatedAtMs: 0, revisionActivatedAtMs: 0, schedule: { kind: 'every', everyMs: 1000 }, payload: { kind: 'agentTurn', message: 'fixture' }, delivery: { mode: 'none' }, state: { nextRunAtMs: 2 } }], occurrences: [], fences: {} }))
  await writeFile(layout.runsLog, '')
  await writeFile(layout.schedulerRoutingManifest, JSON.stringify({ version: 1, canonicalOpsTarget: { channel: 'feishu', to: 'ops' }, ownerTargets: { agt_a: { channel: 'feishu', to: 'owner-a' } }, jobFailureTargets: {} }), { mode: 0o600 })
  await writeFile(layout.schedulerIncidentState, JSON.stringify({ version: 1, incidents: {}, outbox: {} }), { mode: 0o600 })
  const credentialStoreFile = join(root, 'credentials.json')
  await writeFile(credentialStoreFile, JSON.stringify({ version: 1, credentials: { agt_a: { clientId: 'id', clientSecret: 'secret' } } }), { mode: 0o600 })
  return { layout, credentialStoreFile, routingSecurity: { expectedUid: process.getuid(), allowedGids: [process.getgid()], maxMode: 0o600, parentBoundary: root } }
}

test('T15/T29 runtime reads one generation-bound complete census', async () => {
  const { layout, routingSecurity, credentialStoreFile } = await fixture()
  const runtime = createSchedulerHealthRuntime({ layout, routingSecurity, credentialStoreFile, runtimeGeneration: RUNTIME_SHA, nowMs: () => 1 })
  const health = await runtime.read()
  assert.equal(health.complete, true, JSON.stringify(health))
  assert.equal(health.enabled, 1)
  assert.equal(health.healthy, 1)
  assert.equal(health.jobs[0].runtime, RUNTIME_SHA)
})

test('T33 a missing secondary source returns complete=false and UNKNOWN row, never false green', async () => {
  const { layout, routingSecurity, credentialStoreFile } = await fixture()
  await writeFile(layout.schedulerRoutingManifest, '')
  const runtime = createSchedulerHealthRuntime({ layout, routingSecurity, credentialStoreFile, runtimeGeneration: RUNTIME_SHA, nowMs: () => 1 })
  const health = await runtime.read()
  assert.equal(health.complete, false)
  assert.equal(health.unknown, 1)
  assert.equal(health.healthy, 0)
})

test('semantic-corrupt open incident without outbox makes canonical health incomplete', async () => {
  const { layout, routingSecurity, credentialStoreFile } = await fixture()
  await writeFile(layout.schedulerIncidentState, JSON.stringify({ version: 1, incidents: {
    root: { rootIdentity: 'root', rootCauseClass: 'RUN_STUCK_OUTCOME_UNKNOWN', incidentId: 'root|episode:1', episode: 1,
      transitionRevision: 1, lifecycle: 'OPEN', alertState: { incidentKey: 'root', lifecycle: 'OPEN', delivery: 'PENDING' } },
  }, outbox: {} }), { mode: 0o600 })
  const health = await createSchedulerHealthRuntime({ layout, routingSecurity, credentialStoreFile, runtimeGeneration: RUNTIME_SHA }).read()
  assert.equal(health.complete, false)
  assert.equal(health.unknown, 1)
})

test('persisted control-plane binding to a non-canonical chat makes canonical health incomplete', async () => {
  const { layout, routingSecurity, credentialStoreFile } = await fixture()
  const [incident] = compileIncidents([{ class: 'SCHEDULER_RUNTIME_UNHEALTHY', subjectKind: 'runtime', stableSubjectId: 'scheduler-runtime' }]).incidents
  const opened = updateIncidentState({}, [incident], { nowMs: 1 })
  const key = Object.keys(opened.state.outbox)[0]
  const routingSha256 = createHash('sha256').update(await readFile(layout.schedulerRoutingManifest)).digest('hex')
  const bound = bindNotificationDelivery(opened.state, key, { producer: opened.state.outbox[key].producer,
    route: { channel: 'feishu', to: 'daily-thought-agent-group' }, routeSource: 'canonicalOpsTarget', routingSha256,
    payload: stableNotificationText(opened.state.outbox[key]), providerKey: providerIdempotencyKey(key) }, 2)
  await writeFile(layout.schedulerIncidentState, JSON.stringify(bound), { mode: 0o600 })
  const health = await createSchedulerHealthRuntime({ layout, routingSecurity, credentialStoreFile, runtimeGeneration: RUNTIME_SHA }).read()
  assert.equal(health.complete, false)
  assert.match(health.censusError, /binding.*routing authority mismatch/)
})

test('T29 arbitrary runtime provenance cannot produce complete=true', async () => {
  const { layout, routingSecurity, credentialStoreFile } = await fixture()
  const runtime = createSchedulerHealthRuntime({ layout, routingSecurity, credentialStoreFile, runtimeGeneration: 'unbound-label', nowMs: () => 1 })
  const health = await runtime.read()
  assert.equal(health.complete, false)
  assert.equal(health.unknown, 1)
})

test('T33 authority-invalid occurrence returns incomplete census, never false green', async () => {
  const { layout, routingSecurity, credentialStoreFile } = await fixture()
  const document = JSON.parse(await readFile(layout.jobsStore, 'utf8'))
  document.occurrences = [{ occurrenceId: 'fabricated', jobId: 'a', state: 'outcome_unknown' }]
  document.fences = { a: { occurrenceId: 'fabricated' } }
  await writeFile(layout.jobsStore, JSON.stringify(document))
  const health = await createSchedulerHealthRuntime({ layout, routingSecurity, credentialStoreFile, runtimeGeneration: RUNTIME_SHA }).read()
  assert.equal(health.complete, false)
  assert.equal(health.healthy, null)
  assert.match(health.censusError, /occurrence.*missing authority field/)
})

test('production layout exposes dedicated route, incident and local sink paths', () => {
  const layout = resolveProductionLayout('/var/lib/agent-core-test')
  assert.equal(layout.schedulerRoutingManifest, '/var/lib/agent-core-test/scheduler/routing.json')
  assert.equal(layout.schedulerIncidentState, '/var/lib/agent-core-test/control/scheduler-watchdog/incidents.json')
  assert.equal(layout.schedulerLocalOpsSink, '/var/lib/agent-core-test/control/scheduler-watchdog/local-ops.jsonl')
})

test('startup fails only on incomplete global provenance, not one Job-local block', () => {
  assert.equal(assertSchedulerStartupReady({ complete: true, blocked: 1 }), true)
  assert.throws(() => assertSchedulerStartupReady({ complete: false, censusError: 'routing generation unavailable' }), (error) => error.code === 'SCHEDULER_HEALTH_INCOMPLETE')
})
