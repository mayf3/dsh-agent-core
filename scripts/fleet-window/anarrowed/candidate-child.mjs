// Child of candidate-state.mjs. All paths are the caller's new isolated copy.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import net from 'node:net'
import { syncBuiltinESMExports } from 'node:module'
import { checkCandidateCopies } from './candidate-oracle.mjs'

const config = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const { app, directory, root, unrelated, mode } = config
const report = { checks: {}, processSpawnAttempts: 0, outboundAttempts: 0, businessDispatchAttempts: 0,
  probeScope: 'real candidate Production Runtime + Router durable store/admission, synthetic empty scheduler; no business request' }
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const save = () => writeFileSync(join(directory, 'child-result.json'), `${JSON.stringify(report)}\n`, { mode: 0o600 })
const load = relative => import(pathToFileURL(join(app, relative)).href)
const recoveryFile = join(root, 'control/turn-recovery-v3.json')
const probeFile = join(directory, 'admission-probe.json')
const jobsFile = join(directory, 'jobs-copy.json')
const protectedFiles = [recoveryFile, probeFile, jobsFile]
const beforeBytes = protectedFiles.map(file => readFileSync(file))
report.nodeVersion = process.version
report.codeBindings = Object.fromEntries((mode === 'boot'
  ? ['packages/production-runtime/src/entry.js', 'packages/production-runtime/src/compose.js',
    'packages/agent-router/src/reconciliation/store.js', 'packages/agent-router/src/reconciliation/admission.js',
    'packages/agent-router/src/reconciliation/durable-file.js', 'packages/scheduler/src/store.js']
  : ['packages/agent-router/src/reconciliation/durable-file.js', 'packages/scheduler/src/store.js'])
  .map(relative => [relative, { path: join(app, relative), sha256: digest(join(app, relative)) }]))
// Deny outbound connections, including loopback service calls. Listeners are
// separately limited to ephemeral loopback ports by the composition options.
net.Socket.prototype.connect = function () { report.outboundAttempts++; throw new Error('ISOLATED_OUTBOUND_FORBIDDEN') }
globalThis.fetch = async () => { report.outboundAttempts++; throw new Error('ISOLATED_OUTBOUND_FORBIDDEN') }
syncBuiltinESMExports()

async function validateReaders() {
  const { readDurableRecoveryStore } = await load('packages/agent-router/src/reconciliation/durable-file.js')
  const decoded = readDurableRecoveryStore(recoveryFile)
  assert(decoded !== null, 'candidate recovery reader did not load the copied authority')
  const { JobStore } = await load('packages/scheduler/src/store.js')
  const jobs = new JobStore(jobsFile)
  const read = await jobs._readDocRaw({ repairFences: false })
  const raw = JSON.parse(readFileSync(jobsFile, 'utf8'))
  assert(raw.version === 3 && read.status === 'v3', 'candidate must read current v3 without migration/downgrade')
  report.checks.routerReaderCompatible = true
  report.checks.schedulerReaderCompatible = true
  return decoded
}

function unknownProjection(record) {
  return Object.fromEntries(['handle', 'runtimeEpoch', 'agentId', 'processGeneration', 'sessionId', 'initialOutcome',
    'outcome', 'outcomeEvidence', 'lateOutcome', 'terminationEvidence', 'exitObservedAt', 'fenceState', 'reapClaim',
    'attemptedActions', 'createdAt', 'hardDeadlineAt', 'callerCorrelation', 'initialSource', 'recoveryState',
    'settlementResult', 'failureReason', 'nextSafeAction'].map(key => [key, record[key] ?? null]))
}

async function probeAdmission(decoded) {
  const { TurnReconciliationStore } = await load('packages/agent-router/src/reconciliation/store.js')
  const { createRecoveryAdmission } = await load('packages/agent-router/src/reconciliation/admission.js')
  const store = new TurnReconciliationStore({ persistenceFile: probeFile })
  assert(typeof store.admissionBlockerForAgent === 'function', 'candidate lacks agent-scoped admission projection')
  const admission = createRecoveryAdmission(store, { recordBlockedDelivery() {} })
  admission.assertReady()
  const unknown = [...decoded.records.values()].filter(record => record.initialOutcome === 'outcome_unknown')
  report.unknownRecords = unknown.length
  report.checks.originalUnknownPreserved = unknown.every(record =>
    JSON.stringify(unknownProjection(record)) === JSON.stringify(unknownProjection(store.records.get(record.handle) ?? {})))
  const affected = [...new Set(unknown.filter(record => record.fenceState !== 'cleared'
    && (record.adminAbandonment ?? null) === null).map(record => record.agentId))]
  report.affectedAgents = affected.length
  report.checks.affectedBlocked = affected.every(agentId => {
    if (store.admissionBlockerForAgent(agentId) === null) return false
    try { admission.assertUnfenced(agentId); return false } catch (error) {
      return error.code === 'AGENT_PROCESS_TURN_FENCED'
    }
  })
  assert(store.admissionBlockerForAgent(unrelated) === null, 'unrelated agent falsely fenced')
  admission.assertUnfenced(unrelated)
  report.checks.unrelatedAllowed = true
  report.checks.globalStoreReady = store.businessAdmissionStatus().ready === true
  assert(report.checks.originalUnknownPreserved && report.checks.affectedBlocked, 'UNKNOWN/admission projection changed')
  return unknown
}

async function bootRuntime(unknown) {
  const { runProductionRuntime } = await load('packages/production-runtime/src/entry.js')
  const { composeProductionRuntime } = await load('packages/production-runtime/src/compose.js')
  const runtime = await runProductionRuntime(['--root', root, '--tick-ms', '500', '--concurrency', '1',
    '--catchup', '0', '--website-inquiry-enabled', 'false'], process, {
    compose: options => composeProductionRuntime({ ...options,
      productApi: { host: '127.0.0.1', port: 0 }, notificationIngress: { host: '127.0.0.1', port: 0 },
      schedulerRoutingSecurity: { expectedUid: process.getuid(), allowedGids: [process.getgid()],
        maxMode: 0o600, parentBoundary: directory },
      processFactory: () => { report.processSpawnAttempts++; throw new Error('BUSINESS_SPAWN_FORBIDDEN') },
    }),
  })
  // Track actual runtime dispatch seams; no probe invokes a business request.
  for (const method of ['deliver', 'turn', 'invoke']) {
    if (typeof runtime.router[method] !== 'function') continue
    runtime.router[method] = () => { report.businessDispatchAttempts++; throw new Error('BUSINESS_DISPATCH_FORBIDDEN') }
  }
  const status = runtime.router.reconciliationRuntimeStatus()
  report.checks.fullRuntimeReady = status.health === 'healthy' && status.businessAdmission === 'open'
  report.checks.runtimeUnknownPreserved = unknown.every(record => {
    const snapshot = runtime.router.getTurnReconciliation(record.handle)?.snapshot
    return snapshot?.initialOutcome === 'outcome_unknown' && snapshot.fenceState === record.fenceState
      && snapshot.agentId === record.agentId && snapshot.runtimeEpoch === record.runtimeEpoch
  })
  const health = await runtime.schedulerHealth.read()
  report.checks.schedulerHealthComplete = health.complete === true
  report.listeners = [runtime.productApi, runtime.notificationIngress].map(service => service?.address?.()).map(address => ({
    address: address?.host, port: address?.port,
  }))
  report.checks.ephemeralLoopbackListeners = report.listeners.every(address => address.address === '127.0.0.1'
    && Number.isInteger(address.port) && address.port > 0 && ![8788, 8790].includes(address.port))
  assert(report.checks.fullRuntimeReady && report.checks.runtimeUnknownPreserved
    && report.checks.schedulerHealthComplete && report.checks.ephemeralLoopbackListeners,
  'real candidate runtime did not preserve authority/readiness/listener boundaries')
  report.runtimeStatus = { health: status.health, businessAdmission: status.businessAdmission,
    unresolvedRecoveries: status.unresolvedRecoveries }
}

try {
  const decoded = await validateReaders()
  if (mode === 'boot') await bootRuntime(await probeAdmission(decoded))
  report.childPreservation = checkCandidateCopies(beforeBytes,
    protectedFiles.map(file => readFileSync(file)), mode === 'boot')
  report.checks.candidateUnchanged = report.childPreservation.ok
  report.checks.noReplay = report.businessDispatchAttempts === 0 && report.processSpawnAttempts === 0
  report.checks.noOverwrite = report.checks.candidateUnchanged
  report.checks.noOutbound = report.outboundAttempts === 0
  assert(report.checks.candidateUnchanged && report.checks.noReplay && report.checks.noOutbound,
    report.childPreservation.error ?? 'candidate probe overwrote/replayed/contacted a service')
  report.ok = true
  save()
  if (mode === 'boot') process.kill(process.pid, 'SIGTERM')
} catch (error) {
  report.ok = false
  report.error = error.message
  save()
  process.stderr.write(`${error.stack ?? error}\n`)
  process.exit(5)
}
