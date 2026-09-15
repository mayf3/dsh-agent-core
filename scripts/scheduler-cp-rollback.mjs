#!/usr/bin/env node
/** Generation-safe, phase-aware rollback. Incident evidence and occurrence/fence authority are preserved. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync, openSync, readFileSync, renameSync, rmSync,
} from 'node:fs'
import { normalize, resolve, join } from 'node:path'

import { ensureProtectedDirectoryTree, readPrivateFile } from '../packages/scheduler/src/watchdog/private-state-io.js'
import { buildSchedulerRollbackPlan } from '../packages/production-runtime/src/scheduler/deployment-rollback.js'
import { restoreRollbackFile } from '../packages/production-runtime/src/scheduler/deployment-rollback-file.js'
import { createLaunchdAdapter, quiesceLaunchdServices } from '../packages/production-runtime/src/scheduler/deployment-launchd.js'
import { capturePlainFileMetadata } from '../packages/production-runtime/src/scheduler/deployment-file-metadata.js'
import { inOverlayUniverse } from './lib/admission-lib.mjs'

const A = '/var/db/agent-core/deployments/SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1'
const LIVE = '/usr/local/libexec/agent-core/app'
const RUNTIME_PLIST = '/Library/LaunchDaemons/ai.agent-core.runtime.plist'
const WATCHDOG_LABELS = ['ai.agent-core.scheduler-watchdog-w1', 'ai.agent-core.scheduler-watchdog-w2']
const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'], ...opts })
const say = (message) => process.stdout.write(`[rollback] ${message}\n`)
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const sha256 = (path) => digest(readFileSync(path))
const controlOwnership = { expectedUid: 0, expectedGid: 0 }

if (process.getuid?.() !== 0) throw new Error('rollback requires root')
ensureProtectedDirectoryTree(A, { ...controlOwnership, boundary: '/var/db' })
const readControl = (name, allowMissing = false) => {
  ensureProtectedDirectoryTree(A, { ...controlOwnership, boundary: '/var/db' })
  const loaded = readPrivateFile(join(A, name), { ...controlOwnership, allowMissing })
  return loaded ? JSON.parse(loaded.bytes.toString('utf8')) : null
}
function frozenBytes(path) {
  const before = lstatSync(path)
  if (!before.isFile() || before.isSymbolicLink() || before.uid !== 0 || (before.mode & 0o022) !== 0) throw new Error(`unsafe rollback preimage: ${path}`)
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const after = fstatSync(fd)
    if (before.dev !== after.dev || before.ino !== after.ino) throw new Error(`rollback preimage changed: ${path}`)
    return readFileSync(fd)
  } finally { closeSync(fd) }
}
function removeInstalledFile(path) {
  capturePlainFileMetadata(path); rmSync(path)
  const fd = openSync(resolve(path, '..'), constants.O_RDONLY); try { fsyncSync(fd) } finally { closeSync(fd) }
  if (existsSync(path)) throw new Error(`rollback removal readback mismatch: ${path}`)
}
function safeLivePath(path) {
  if (typeof path !== 'string' || normalize(path) !== path || path.startsWith('/') || path.includes('..') || !inOverlayUniverse(path)) throw new Error(`unsafe overlay receipt path: ${path}`)
  const target = resolve(LIVE, path)
  if (!target.startsWith(`${LIVE}/`)) throw new Error(`overlay path escaped live root: ${path}`)
  return target
}
const launchd = createLaunchdAdapter()

const progress = readControl('phase-progress-receipt.json')
const serviceState = readControl('service-state-preimage.json', true)
if (!serviceState) { say('no service-state preimage; no mutable phase crossed'); process.exit(0) }
if (serviceState.sourceSha !== progress.sourceSha || serviceState.loaded === null || typeof serviceState.loaded !== 'object') throw new Error('invalid service-state preimage')
const serviceLabels = [...WATCHDOG_LABELS.map((label) => `system/${label}`), 'system/ai.agent-core.runtime']
if (Object.keys(serviceState.loaded).sort().join() !== [...serviceLabels].sort().join()
  || serviceLabels.some((label) => typeof serviceState.loaded[label] !== 'boolean')) throw new Error('invalid service-state preimage')
const runtimePreimage = join(A, 'rollback', 'ai.agent-core.runtime.plist.preimage')
const runtimeReceipt = readControl('runtime-install-receipt.json', true)
const watchdog = readControl('watchdog-install-receipt.json', true)
const routingReceiptPath = join(A, 'rollback', 'routing-install-receipt.json')
const desired = readControl('desired-state-install-receipt.json', true)
const overlay = readControl('overlay-manifest.json', true)
const operator = readControl('operator-cutover-receipt.json', true)
const plan = buildSchedulerRollbackPlan({ progress, receipts: {
  runtime: runtimeReceipt !== null, watchdog: watchdog !== null, routing: existsSync(routingReceiptPath), desired: desired !== null,
  overlay: overlay !== null, operator: operator !== null,
} })
const planned = (action) => plan.actions.includes(action)
quiesceLaunchdServices(serviceLabels, launchd)

if (planned('RESTORE_RUNTIME')) {
  const current = sha256(RUNTIME_PLIST)
  if (![runtimeReceipt.installedSha256, runtimeReceipt.preimageSha256].includes(current)) throw new Error('rollback generation advanced')
  const result = restoreRollbackFile({ preimagePath: runtimePreimage, targetPath: RUNTIME_PLIST,
    installedSha256: runtimeReceipt.installedSha256, preimageSha256: runtimeReceipt.preimageSha256,
    preimageMetadata: runtimeReceipt.preimageMetadata })
  if (result.status !== 'ALREADY_RESTORED') say('runtime plist restored')
}

for (const item of planned('RESTORE_WATCHDOGS') ? watchdog.plists ?? [] : []) {
  if (!WATCHDOG_LABELS.includes(item.label) || item.path !== `/Library/LaunchDaemons/${item.label}.plist`) throw new Error('unsafe watchdog receipt target')
  if (item.preimage !== join(A, 'rollback', `${item.label}.plist.preimage`)) throw new Error('unsafe watchdog preimage coordinate')
  const current = existsSync(item.path) ? sha256(item.path) : null
  if (item.existed) {
    if (![item.installedSha256, item.preimageSha256].includes(current)) throw new Error(`watchdog generation advanced: ${item.label}`)
    restoreRollbackFile({ preimagePath: item.preimage, targetPath: item.path,
      installedSha256: item.installedSha256, preimageSha256: item.preimageSha256, preimageMetadata: item.preimageMetadata })
  } else if (current === item.installedSha256) removeInstalledFile(item.path)
  else if (current !== null) throw new Error(`watchdog generation advanced: ${item.label}`)
}

if (planned('RESTORE_ROUTING')) {
  const routing = JSON.parse(frozenBytes(routingReceiptPath).toString('utf8'))
  const target = '/usr/local/libexec/agent-core/config/scheduler-routing.json'
  const current = existsSync(target) ? sha256(target) : null
  if (routing.preimageSha256 === null) {
    if (current === routing.candidateSha256) removeInstalledFile(target)
    else if (current !== null) throw new Error('routing generation advanced')
  } else {
    if (![routing.candidateSha256, routing.preimageSha256].includes(current)) throw new Error('routing generation advanced')
    restoreRollbackFile({ preimagePath: join(A, 'rollback', 'scheduler-routing.json.preimage'), targetPath: target,
      installedSha256: routing.candidateSha256, preimageSha256: routing.preimageSha256, preimageMetadata: routing.preimageMetadata })
  }
}

if (planned('RESTORE_DESIRED_STATE')) {
  if (desired.targetPath !== '/usr/local/libexec/agent-core/config/scheduler-desired-state.json'
    || desired.preimagePath !== join(A, 'rollback', 'scheduler-desired-state.json.preimage')) throw new Error('unsafe desired-state receipt coordinate')
  const current = existsSync(desired.targetPath) ? sha256(desired.targetPath) : null
  if (desired.preimageSha256 === null) {
    if (current === desired.candidateSha256) removeInstalledFile(desired.targetPath)
    else if (current !== null) throw new Error('desired-state generation advanced')
  } else {
    if (![desired.candidateSha256, desired.preimageSha256].includes(current)) throw new Error('desired-state generation advanced')
    restoreRollbackFile({ preimagePath: desired.preimagePath, targetPath: desired.targetPath,
      installedSha256: desired.candidateSha256, preimageSha256: desired.preimageSha256, preimageMetadata: desired.preimageMetadata })
  }
}

if (planned('RESTORE_OVERLAY')) {
  if (overlay.base !== '68008e83142bdb637c4fa61c2a65db73c64b2eb1' || overlay.source !== progress.sourceSha || !Array.isArray(overlay.entries)) throw new Error('invalid overlay receipt')
  for (const entry of overlay.entries) {
    if (!['add', 'update', 'delete'].includes(entry.kind) || !/^[0-9a-f]{64}$/.test(entry.kind === 'delete' ? entry.preimageSha : entry.sha)) throw new Error('invalid overlay receipt entry')
    const target = safeLivePath(entry.path), current = existsSync(target) ? sha256(target) : undefined
    const allowed = entry.kind === 'add' ? [entry.sha, undefined] : entry.kind === 'update' ? [entry.sha, entry.preimageSha] : [undefined, entry.preimageSha]
    if (!allowed.includes(current)) throw new Error(`overlay generation advanced: ${entry.path}`)
    if (entry.kind === 'add' && current === entry.sha) rmSync(target)
  }
  const changed = overlay.entries.filter((entry) => entry.kind !== 'add')
  if (changed.length) {
    const archive = join(A, 'rollback', 'overlay-preimage.tar.gz')
    const listed = run('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).map((path) => path.replace(/^\.\//, '')).sort()
    const expected = changed.map((entry) => entry.path).sort()
    if (JSON.stringify(listed) !== JSON.stringify(expected)) throw new Error('overlay rollback archive manifest mismatch')
    run('tar', ['-xzf', archive, '-C', LIVE])
    for (const entry of changed) if (sha256(safeLivePath(entry.path)) !== entry.preimageSha) throw new Error(`overlay preimage mismatch: ${entry.path}`)
  }
}

if (planned('RESTORE_OPERATOR')) {
  const current = sha256('/usr/local/bin/agentcore-cron')
  if (current === operator.newSha256) {
    if (!existsSync(operator.previousLink) || sha256(operator.previousLink) !== operator.previousSha256) throw new Error('operator predecessor unavailable')
    const temp = `/usr/local/bin/agentcore-cron.rollback-${process.pid}`
    run('ln', ['-s', operator.previousLink, temp]); renameSync(temp, '/usr/local/bin/agentcore-cron')
  } else if (current !== operator.previousSha256) throw new Error('operator generation advanced')
}

if (serviceState.loaded['system/ai.agent-core.runtime'] === true) run('launchctl', ['bootstrap', 'system', RUNTIME_PLIST])
for (const label of WATCHDOG_LABELS) {
  const plist = `/Library/LaunchDaemons/${label}.plist`
  if (serviceState.loaded[`system/${label}`] === true && existsSync(plist)) run('launchctl', ['bootstrap', 'system', plist])
}
let healthy = serviceState.loaded['system/ai.agent-core.runtime'] !== true
for (let attempt = 0; attempt < 30; attempt += 1) {
  try { if (JSON.parse(run('curl', ['-s', '-m', '3', 'http://127.0.0.1:8790/health'], { encoding: 'utf8' }))?.ok === true) { healthy = true; break } } catch { /* bounded retry */ }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000)
}
say(`health=${healthy ? 'ok; restored process loaded after all disk preimages' : 'failed; preserve evidence and escalate'}`)
process.exit(healthy ? 0 : 1)
