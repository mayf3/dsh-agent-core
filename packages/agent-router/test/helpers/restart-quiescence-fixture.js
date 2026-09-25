import { createHash } from 'node:crypto'
import { closeSync, mkdirSync, mkdtempSync, openSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TurnReconciliationStore } from '../../src/reconciliation-store.js'

const sha = value => createHash('sha256').update(value).digest('hex')
export const json = value => `${JSON.stringify(value)}\n`

export function proofFixture(registerCleanup) {
  const root = mkdtempSync(join(tmpdir(), 'agent-core-rq-'))
  registerCleanup(() => rmSync(root, { recursive: true, force: true }))
  const evidenceDir = join(root, 'evidence')
  const deploymentDir = join(root, 'deployment')
  mkdirSync(evidenceDir)
  mkdirSync(deploymentDir)
  const persistenceFile = join(root, 'recovery.json')
  const old = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'old-epoch' })
  const handle = old.mintTurnExecution({ agentId: 'agt_subject', processGeneration: 1, sessionId: 'main' })
  old.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'old-prompt', deadlineAtWallMs: Date.now() + 1000 })
  old.markPromptWriteAttempted(handle)
  const blocked = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'intermediate-epoch' })
  if (blocked.records.get(handle).failureReason !== 'runtime_restart_ownership_unavailable') throw new Error('fixture old record did not block')
  const record = blocked.records.get(handle)
  const recordDigest = sha(JSON.stringify(record))
  const cutClock = record.updatedAt + 1000
  const operationId = 'op-rq-1'
  const hostId = 'test-host'
  const startupNonce = 'nonce-rq-1'
  const binary = 'a'.repeat(64)
  const windowPath = join(evidenceDir, 'window.lock')
  writeFileSync(windowPath, 'held\n', { mode: 0o600 })
  const windowFd = openSync(windowPath, 'r')
  registerCleanup(() => closeSync(windowFd))
  const writeReceipt = (dir, name, value) => {
    const bytes = json(value)
    writeFileSync(join(dir, name), bytes, { mode: 0o600 })
    return sha(bytes)
  }
  const windowDigest = writeReceipt(evidenceDir, 'exclusive-window.json', {
    operationId, hostId, startupNonce, windowLockPath: windowPath, windowOpenedAtWallMs: cutClock,
  })
  const inhibitedDigest = writeReceipt(evidenceDir, 'launch-sources-inhibited.json', {
    operationId, hostId, startupNonce, atWallMs: cutClock + 10, complete: true,
  })
  const quiescedDigest = writeReceipt(evidenceDir, 'old-tree-quiesced.json', {
    operationId, hostId, startupNonce, atWallMs: cutClock + 20, complete: true,
  })
  const psOutput = 'zero old runtime processes\n'
  const lsofOutput = 'zero workspace holders\n'
  const psHash = writeReceipt(evidenceDir, 'census-ps.txt', psOutput.trimEnd())
  const lsofHash = writeReceipt(evidenceDir, 'census-lsof.txt', lsofOutput.trimEnd())
  const archive = { operationId, hostId, tools: ['ps', 'lsof'], outputsSha256: [psHash, lsofHash], runtimeTreeProcessCount: 0 }
  const archiveHash = writeReceipt(evidenceDir, 'census-archive.json', archive)
  const holderCheck = { operationId, executedAtWallMs: cutClock + 35, method: 'lsof', paths: ['/tmp/subject-workspace'], openHolderCount: 0 }
  const authorizationDigest = writeReceipt(evidenceDir, 'launch-authorization.json', {
    operationId, hostId, startupNonce, consumingBinarySha256: binary,
    archiveSha256: archiveHash, outputsSha256: [psHash, lsofHash], holderCheck,
    authorizedStartupAtWallMs: cutClock + 50,
  })
  const floorDigest = writeReceipt(deploymentDir, 'floor-proven.json', {
    status: 'ROUTER_RESTART_SAFETY=PROVEN', deployedBinarySha256: binary, floorCommit: '2097e4f9', provedAtWallMs: cutClock - 20,
  })
  const validatorDigest = writeReceipt(deploymentDir, 'validator-installed.json', {
    deployedBinarySha256: binary, evidenceKind: 'restart_quiescence_proven', installedAtWallMs: cutClock - 10,
  })
  const bundle = {
    bundleSchemaVersion: 2,
    subject: { reconciliationHandle: handle, turnExecutionId: handle, runtimeEpoch: 'old-epoch', agentId: 'agt_subject', processGeneration: 1 },
    epochRetirement: { retiredEpoch: 'old-epoch' },
    recoveryCutover: {
      operationId, hostId, startupNonce, subjectPreimageSha256: recordDigest,
      exclusiveWindowReceiptSha256: windowDigest, launchSourcesInhibitedReceiptSha256: inhibitedDigest,
      oldTreeQuiescedReceiptSha256: quiescedDigest, launchAuthorizationReceiptSha256: authorizationDigest,
      windowOpenedAtWallMs: cutClock, oldTreeQuiescedAtWallMs: cutClock + 20, authorizedStartupAtWallMs: cutClock + 50,
      consumingBinarySha256: binary,
    },
    deploymentProof: { floorProvenReceiptSha256: floorDigest, validatorInstalledReceiptSha256: validatorDigest, deployedBinarySha256: binary },
    hostCensus: { operationId, executedAtWallMs: cutClock + 30, hostId, tools: ['ps', 'lsof'], outputsSha256: [psHash, lsofHash], archiveRef: 'census-archive.json', runtimeTreeProcessCount: 0 },
    holderCheck,
    custody: { executedAs: 'root', producedBy: 'trusted_cp_recovery_evidence_collector_v1', evidenceDir },
    controlledStop: null,
  }
  const bundleFile = join(evidenceDir, 'subject.bundle.json')
  writeFileSync(bundleFile, json(bundle), { mode: 0o600 })
  const io = {
    stat: path => ({ ...statSync(path), uid: 0 }),
    fstat: fd => ({ ...statSync(windowPath), uid: 0 }),
    challengeWindow: (fd, challenge) => ({
      ...challenge, exclusiveWindowHeld: true, launchSourcesStillInhibited: true, windowClosed: false,
    }),
  }
  const startup = {
    hostId, startupNonce, consumingBinarySha256: binary, windowFd, challengeFd: windowFd,
    recoveryPlanStopsRuntime: false,
  }
  return { persistenceFile, evidenceDir, deploymentDir, bundleFile, bundle, io, startup, handle }
}
