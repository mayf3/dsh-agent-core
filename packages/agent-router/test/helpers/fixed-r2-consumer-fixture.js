/** Actual Python journal -> Node reader, explicit synthetic root/host surrogate. */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { closeSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TurnReconciliationStore } from '../../src/reconciliation-store.js'

export const FIXED_HANDLE = 'turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256'
const epoch = '961534a5-8c94-487d-8e55-d324a54e821a'
const operationId = 'hr-s256-trusted-quiescence-cut-20260925-v1'
const sha = raw => createHash('sha256').update(raw).digest('hex')
const json = value => JSON.stringify(value) + '\n'

export function fixedR2Fixture(cleanup) {
  const root = mkdtempSync(join(tmpdir(), 'hr-fixed-r2-surrogate-'))
  cleanup(() => rmSync(root, { recursive: true, force: true }))
  const stateRoot = join(root, 'journal')
  const evidenceDir = join(stateRoot, operationId)
  const deploymentDir = join(root, 'deployment')
  mkdirSync(stateRoot)
  mkdirSync(deploymentDir)
  const persistenceFile = join(root, 'store.json')
  const old = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: epoch })
  old.mintTurnExecution({ agentId: 'agt_dummy', processGeneration: 1, sessionId: 'main' })
  let handle
  for (let i = 0; i < 256; i++) handle = old.mintTurnExecution({ agentId: 'agt_hr-agent', processGeneration: 1, sessionId: 'main' })
  if (handle !== FIXED_HANDLE) throw new Error('fixed handle fixture mismatch')
  old.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'synthetic-only', deadlineAtWallMs: Date.now() + 1000 })
  old.markPromptWriteAttempted(handle)
  const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'synthetic-consuming-epoch' })
  const subjectPreimageSha256 = sha(JSON.stringify(store.records.get(handle)))
  const clock = store.records.get(handle).updatedAt + 1000
  const hostId = 'explicit-synthetic-host'
  const startupNonce = 'synthetic-startup-nonce-000001'
  const binary = 'a'.repeat(64)
  const receipts = {}
  const receipt = (name, value) => { const raw = json(value); receipts[name] = raw; return sha(raw) }
  const cut = { operationId, hostId, startupNonce, subjectPreimageSha256,
    exclusiveWindowReceiptSha256: receipt('exclusive-window.json', { operationId, hostId, startupNonce,
      windowLockPath: join(evidenceDir, 'window.lock'), windowOpenedAtWallMs: clock }),
    launchSourcesInhibitedReceiptSha256: receipt('launch-sources-inhibited.json', { operationId, hostId, startupNonce, atWallMs: clock + 10, complete: true }),
    oldTreeQuiescedReceiptSha256: receipt('old-tree-quiesced.json', { operationId, hostId, startupNonce, atWallMs: clock + 20, complete: true }),
    launchAuthorizationReceiptSha256: '0'.repeat(64), windowOpenedAtWallMs: clock,
    oldTreeQuiescedAtWallMs: clock + 20, authorizedStartupAtWallMs: clock + 50, consumingBinarySha256: binary }
  const outputsSha256 = [receipt('census-ps.txt', { tool: 'ps', scannedProcessCount: 1, oldTreeProcessCount: 0, rawSha256: 'b'.repeat(64) }),
    receipt('census-lsof.txt', { tool: 'lsof', scannedFileCount: 1, openHolderCount: 0, rawSha256: 'c'.repeat(64) })]
  const archiveSha256 = receipt('census-archive.json', { operationId, hostId, tools: ['ps', 'lsof'], outputsSha256,
    runtimeTreeProcessCount: 0, psAtWallMs: clock + 30, lsofAtWallMs: clock + 35 })
  const holderCheck = { operationId, executedAtWallMs: clock + 35, method: 'lsof', paths: [join(root, 'synthetic-workspace')], openHolderCount: 0 }
  const subject = { reconciliationHandle: handle, turnExecutionId: handle, runtimeEpoch: epoch, agentId: 'agt_hr-agent', processGeneration: 1 }
  const deployed = (name, value) => { const raw = json(value); writeFileSync(join(deploymentDir, name), raw, { mode: 0o600 }); return sha(raw) }
  const bundle = { bundleSchemaVersion: 2, subject, epochRetirement: { retiredEpoch: epoch }, recoveryCutover: cut,
    deploymentProof: { floorProvenReceiptSha256: deployed('floor-proven.json', { status: 'ROUTER_RESTART_SAFETY=PROVEN', floorCommit: '2097e4f9', deployedBinarySha256: binary, provedAtWallMs: clock - 20 }),
      validatorInstalledReceiptSha256: deployed('validator-installed.json', { evidenceKind: 'restart_quiescence_proven', deployedBinarySha256: binary, installedAtWallMs: clock - 10 }), deployedBinarySha256: binary },
    hostCensus: { operationId, hostId, executedAtWallMs: clock + 30, tools: ['ps', 'lsof'], outputsSha256, archiveRef: 'census-archive.json', runtimeTreeProcessCount: 0 },
    holderCheck, custody: { executedAs: 'root', producedBy: 'trusted_cp_recovery_evidence_collector_v1', evidenceDir }, controlledStop: null }
  const authorization = { operationId, hostId, startupNonce, subjectPreimageSha256, authorizedStartupAtWallMs: clock + 50,
    subject, consumingBinarySha256: binary, archiveSha256, outputsSha256, holderCheck }
  const script = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../deployment-artifacts/hr-s256-trusted-cut-v1/consumer-fixture.py')
  const result = spawnSync('python3', [script], { input: JSON.stringify({ stateRoot, authorization, bundle, receipts }), encoding: 'utf8', timeout: 5000 })
  if (result.status !== 0) throw new Error(`synthetic Python producer failed: ${result.stderr}`)
  const produced = JSON.parse(result.stdout)
  const windowPath = join(evidenceDir, 'window.lock')
  writeFileSync(windowPath, 'synthetic-not-a-host-proof\n', { mode: 0o600 })
  const windowFd = openSync(windowPath, 'r')
  cleanup(() => closeSync(windowFd))
  const io = { stat: path => ({ ...lstatSync(path), uid: 0 }), fstat: fd => ({ ...fstatSync(fd), uid: 0 }),
    challengeWindow: (_fd, challenge) => ({ ...challenge, exclusiveWindowHeld: true, launchSourcesStillInhibited: true, windowClosed: false }) }
  return { store, handle, persistenceFile, evidenceDir, deploymentDir, bundleFile: join(evidenceDir, 'bundle.json'),
    bundle: produced.bundle, io, startup: { hostId, startupNonce, consumingBinarySha256: binary, windowFd, challengeFd: windowFd, recoveryPlanStopsRuntime: false } }
}
