#!/usr/bin/env node
/** Evidence-bound production acceptance. Creates one retained, delivery:none canary through the canonical CLI. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { atomicReplacePrivateFile, ensureProtectedDirectoryTree, readPrivateFile } from '../../packages/scheduler/src/watchdog/private-state-io.js'
import { assertSuccessfulCanaryRun, publishVerifiedPostdeployReceipt } from '../../packages/production-runtime/src/scheduler/deployment-postdeploy-finalize.js'
import { readProtectedPlainFile } from '../../packages/production-runtime/src/scheduler/deployment-file-metadata.js'
import { readProtectedRoutingManifest } from '../../packages/scheduler/src/watchdog/routing.js'

const A = '/private/var/db/agent-core/deployments/SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1'
const STORE = '/Users/authsvc/.agent-core/scheduler/jobs.json'
const CLI = '/usr/local/bin/agentcore-cron'
const CANARY_CONTROL = '/usr/local/libexec/agent-core/app/scripts/lib/scheduler-postdeploy-canary-control.mjs'
const RUNTIME_NODE = '/usr/local/libexec/agent-core/node-runtime/bin/node'
const API = 'http://127.0.0.1:8787/scheduler/health'
const AUDIT_TOKEN = join(A, 'credentials', 'scheduler-audit.token')
const INCIDENTS = '/Users/authsvc/.agent-core/control/scheduler-watchdog/incidents.json'
const ROUTING_RECEIPT = join(A, 'rollback', 'routing-install-receipt.json')
const argv = process.argv.slice(2)
const value = (name) => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : undefined }
const sourceSha = value('--source-sha')
const canaryAgentId = value('--canary-agent-id')
if (process.getuid?.() !== 0 || !/^[0-9a-f]{40}$/.test(sourceSha ?? '') || canaryAgentId !== 'agt_scheduler-postdeploy-canary') {
  throw new Error('usage: sudo scheduler-postdeploy-finalize --source-sha <40hex> --canary-agent-id agt_scheduler-postdeploy-canary')
}

const rootOwnership = { expectedUid: 0, expectedGid: 0 }
const authsvcUid = Number(execFileSync('id', ['-u', 'authsvc'], { encoding: 'utf8' }).trim())
const authsvcGid = Number(execFileSync('id', ['-g', 'authsvc'], { encoding: 'utf8' }).trim())
ensureProtectedDirectoryTree(A, { ...rootOwnership, boundary: '/private/var/db' })
const readControl = (name, allowMissing = false) => {
  const loaded = readPrivateFile(join(A, name), { ...rootOwnership, allowMissing })
  return loaded ? JSON.parse(loaded.bytes.toString('utf8')) : null
}
const writeControl = (name, object) => atomicReplacePrivateFile(join(A, name), Buffer.from(`${JSON.stringify(object, null, 2)}\n`), rootOwnership)
const readStoreSnapshot = () => {
  const bytes = readPrivateFile(STORE, { expectedUid: authsvcUid, expectedGid: authsvcGid }).bytes
  return { store: JSON.parse(bytes.toString('utf8')), sha256: createHash('sha256').update(bytes).digest('hex') }
}
const readStore = () => readStoreSnapshot().store
const readIncidentSnapshot = () => {
  const bytes = readPrivateFile(INCIDENTS, { expectedUid: authsvcUid, expectedGid: authsvcGid }).bytes
  return { state: JSON.parse(bytes.toString('utf8')), sha256: createHash('sha256').update(bytes).digest('hex') }
}
const asAuthsvc = (command, args) => execFileSync('sudo', ['-u', 'authsvc', 'env', '-i',
  'HOME=/Users/authsvc', 'PATH=/usr/local/libexec/agent-core/node-runtime/bin:/usr/local/bin:/usr/bin:/bin',
  `AGENTCORE_EXPECTED_STORE=${STORE}`, command, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

const token = readProtectedPlainFile(AUDIT_TOKEN, { boundary: '/', expectedUid: 0, expectedGid: 0, mode: 0o600 }).bytes.toString('utf8').trim()
if (token === '' || /\s/.test(token)) throw new Error('audit token file must contain exactly one bearer token')
const health = async () => {
  const response = await fetch(API, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`canonical health HTTP ${response.status}`)
  return response.json()
}

const accepted = readControl('postdeploy-acceptance-receipt.json', true)
if (accepted) {
  if (accepted.status !== 'ACCEPTED' || accepted.sourceSha !== sourceSha) throw new Error('postdeploy acceptance receipt generation mismatch')
  process.stdout.write(`[postdeploy] already accepted source ${sourceSha}; no canary replay\n`)
  process.exit(0)
}

const phaseReceipt = readControl('deployment-phase-receipt.json')
const routingReceipt = JSON.parse(readProtectedPlainFile(ROUTING_RECEIPT, { boundary: '/', expectedUid: 0, expectedGid: authsvcGid, mode: 0o600 }).bytes.toString('utf8'))
const protectedRouting = readProtectedRoutingManifest(process.env.SCHEDULER_ROUTING_MANIFEST ?? '/usr/local/libexec/agent-core/config/scheduler-routing.json', {
  expectedUid: 0, allowedGids: [authsvcGid], maxMode: 0o640, parentBoundary: '/',
})
const migrationReceipt = readControl('incident-migration-receipt.json')
const incidentMigrationAuthority = { legacySha256: migrationReceipt.legacySha256,
  evidenceSha256: migrationReceipt.evidenceSha256, factsSha256: migrationReceipt.factsSha256 }
let plan = readControl('postdeploy-canary-plan.json', true)
if (!plan) {
  const now = Date.now()
  plan = { status: 'PLANNED', sourceSha, canaryAgentId, logicalKey: `scheduler-postdeploy:${sourceSha}`,
    at: new Date(now + 15_000).toISOString(), notAfter: now + 5 * 60_000, canaryJobId: null }
  writeControl('postdeploy-canary-plan.json', plan)
} else if (plan.sourceSha !== sourceSha || plan.canaryAgentId !== canaryAgentId) throw new Error('postdeploy canary plan generation mismatch')

let beforeEvidence = readControl('postdeploy-before-evidence.json', true)
if (!beforeEvidence) {
  const liveSnapshot = readStoreSnapshot(), live = liveSnapshot.store
  if (live.jobs.some((job) => job.logicalKey === plan.logicalKey)) throw new Error('canary exists without frozen before-evidence; preserve state and investigate')
  const incident = readIncidentSnapshot()
  beforeEvidence = { sourceSha, health: await health(), store: live, storeSha256: liveSnapshot.sha256,
    incidentState: incident.state, incidentSha256: incident.sha256 }
  writeControl('postdeploy-before-evidence.json', beforeEvidence)
} else if (beforeEvidence.sourceSha !== sourceSha) throw new Error('postdeploy before-evidence generation mismatch')
const beforeHealth = beforeEvidence.health
const beforeStore = beforeEvidence.store
let canaryJobId = plan.canaryJobId
const plannedJob = readStore().jobs.find((job) => job.logicalKey === plan.logicalKey)
if (canaryJobId === null && plannedJob) {
  canaryJobId = plannedJob.id
  plan = { ...plan, status: 'CREATED', canaryJobId }
  writeControl('postdeploy-canary-plan.json', plan)
}
if (canaryJobId === null) {
  if (Date.now() >= Date.parse(plan.at)) throw new Error('canary add outcome cannot be proven absent after its due time; no blind retry')
  const created = JSON.parse(asAuthsvc(RUNTIME_NODE, [CANARY_CONTROL, 'create', '--source-sha', sourceSha, '--agent', canaryAgentId, '--at', plan.at]))
  canaryJobId = created.id
  plan = { ...plan, status: 'CREATED', canaryJobId }
  writeControl('postdeploy-canary-plan.json', plan)
} else if (plannedJob && plannedJob.id !== canaryJobId) throw new Error('canary logical identity conflicts with receipted job id')

let runReadback = JSON.parse(asAuthsvc(CLI, ['runs', '--id', canaryJobId, '--limit', '10', '--json']))
while (Date.now() < plan.notAfter) {
  const rows = runReadback.runs ?? runReadback.occurrences ?? []
  if (rows.some((row) => ['failed', 'cancelled', 'outcome_unknown'].includes(row.outcome ?? row.state ?? row.executionOutcome))) break
  if (rows.some((row) => (row.outcome ?? row.state ?? row.executionOutcome) === 'succeeded')) break
  sleep(2000)
  runReadback = JSON.parse(asAuthsvc(CLI, ['runs', '--id', canaryJobId, '--limit', '10', '--json']))
}
const currentStore = readStore()
assertSuccessfulCanaryRun(runReadback, canaryJobId, sourceSha)
const retained = currentStore.jobs.find((job) => job.id === canaryJobId)
if (retained) asAuthsvc(CLI, ['rm', canaryJobId, '--expected-schedule-revision', String(retained.scheduleRevision), '--expected-updated-at', String(retained.updatedAtMs)])
const afterStoreSnapshot = readStoreSnapshot(), afterStore = afterStoreSnapshot.store
const afterIncidentSnapshot = readIncidentSnapshot()
const afterHealth = await health()
const evidence = { phaseReceipt, routingReceipt, sourceSha, beforeHealth, afterHealth, beforeStore, afterStore,
  beforeStoreSha256: beforeEvidence.storeSha256, afterStoreSha256: afterStoreSnapshot.sha256,
  beforeIncidentState: beforeEvidence.incidentState, afterIncidentState: afterIncidentSnapshot.state,
  beforeIncidentSha256: beforeEvidence.incidentSha256, afterIncidentSha256: afterIncidentSnapshot.sha256,
  incidentMigrationAuthority, routingManifest: protectedRouting.manifest,
  routingManifestSha256: protectedRouting.readback.sha256, canaryJobId, runReadback }
const receipt = publishVerifiedPostdeployReceipt(evidence, {
  writeReceipt: (valueToWrite) => writeControl('postdeploy-acceptance-receipt.json', valueToWrite),
  readReceipt: () => readControl('postdeploy-acceptance-receipt.json'),
})
writeControl('postdeploy-canary-plan.json', { ...plan, status: 'ACCEPTED', occurrenceId: receipt.canary.occurrenceId })
process.stdout.write(`[postdeploy] ACCEPTED source=${sourceSha} canaryJob=${canaryJobId} occurrence=${receipt.canary.occurrenceId}; currentSixAuthorized=${receipt.currentSixAuthorized}\n`)
