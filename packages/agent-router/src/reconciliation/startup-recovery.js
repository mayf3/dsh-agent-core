/** Crash-restart reconciliation for the V3 durable recovery authority. */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ownedDirectory, ownedFile, sha256, verifyCurrentWindow } from './quiescence-custody.js'
import { verifyQuiescenceBundle } from './quiescence-bundle.js'

export const startupRecoveryMethods = {
  consumeStartupQuiescence({ evidenceDir, deploymentDir, startup, io } = {}) {
    if (evidenceDir === undefined || evidenceDir === null) return []
    const results = []
    const audit = entry => {
      this.startupQuiescenceAudit = [...(this.startupQuiescenceAudit ?? []), entry].slice(-32)
      results.push(entry)
    }
    if (this.startupBlockedReason !== null) {
      audit({ status: 'rejected', reason: 'durable_store_invalid' })
      return results
    }
    let files
    try {
      ownedDirectory(evidenceDir, io)
      ownedDirectory(deploymentDir, io)
      files = readdirSync(evidenceDir).filter(name => name.endsWith('.bundle.json')).sort()
    } catch (error) {
      audit({ status: 'rejected', reason: error.code ?? 'evidence_directory_unavailable' })
      return results
    }
    if (files.length > 128) {
      audit({ status: 'rejected', reason: 'bundle_directory_capacity_exceeded' })
      return results
    }
    // Discover duplicate subjects before mutating any one record. Every scan
    // reads only bounded root-custodied bytes, including malformed bundles.
    const observed = new Map(files.map(file => [file, new Set()]))
    const windows = new Map(files.map(file => [file, new Set()]))
    const scannedDigests = new Map()
    const changedFiles = new Set()
    const failedWindows = new Set()
    const observe = (file, handle) => {
      if (typeof handle === 'string') observed.get(file).add(handle)
    }
    const observeWindow = (file, cut) => {
      if (typeof cut?.operationId === 'string' && typeof cut.hostId === 'string'
          && typeof cut.startupNonce === 'string' && typeof cut.exclusiveWindowReceiptSha256 === 'string') {
        windows.get(file).add(JSON.stringify([cut.operationId, cut.hostId,
          cut.startupNonce, cut.exclusiveWindowReceiptSha256]))
      }
    }
    for (const file of files) {
      try {
        const bytes = ownedFile(join(evidenceDir, file), 65536, io)
        scannedDigests.set(file, sha256(bytes))
        const raw = JSON.parse(bytes.toString('utf8'))
        observe(file, raw?.subject?.reconciliationHandle)
        observeWindow(file, raw?.recoveryCutover)
      } catch { /* verifier records the exact file error below */ }
    }
    // Complete the bounded batch before settling: a file changed between
    // scan and verification can otherwise contaminate a later subject.
    const checked = new Map()
    for (const file of files) {
      const path = join(evidenceDir, file)
      try {
        const proof = verifyQuiescenceBundle(this, path, { evidenceDir, deploymentDir, startup, io })
        observe(file, proof.handle)
        observeWindow(file, proof.bundle.recoveryCutover)
        if (scannedDigests.get(file) !== proof.bundleSha256) changedFiles.add(file)
        checked.set(file, { proof })
      } catch (error) {
        checked.set(file, { error })
        if (error.code?.startsWith('window_')) {
          for (const window of windows.get(file)) failedWindows.add(window)
        }
      }
      try {
        const bytes = ownedFile(path, 65536, io)
        if (scannedDigests.get(file) !== sha256(bytes)) changedFiles.add(file)
        const raw = JSON.parse(bytes.toString('utf8'))
        observe(file, raw?.subject?.reconciliationHandle)
        observeWindow(file, raw?.recoveryCutover)
      } catch { changedFiles.add(file) }
    }
    const owners = new Map()
    const polluted = new Set()
    for (const [file, subjects] of observed) {
      if (subjects.size > 1 || changedFiles.has(file)) {
        for (const handle of subjects) polluted.add(handle)
      }
      for (const handle of subjects) {
        if (!owners.has(handle)) owners.set(handle, new Set())
        owners.get(handle).add(file)
      }
    }
    for (const [handle, names] of owners) if (names.size > 1) polluted.add(handle)
    // A successful earlier challenge is not proof of continuity after the
    // rest of the batch has run. Recheck before any record mutation and keep
    // each observed window failure sticky for all proofs sharing that cut.
    for (const file of files) {
      const proof = checked.get(file).proof
      if (!proof || [...observed.get(file)].some(subject => polluted.has(subject))) continue
      try {
        verifyCurrentWindow(evidenceDir, proof.bundle, startup, io)
      } catch {
        for (const window of windows.get(file)) failedWindows.add(window)
      }
    }
    for (const file of files) {
      const subjects = observed.get(file)
      const handle = checked.get(file).proof?.handle ?? [...subjects][0]
      if ([...subjects].some(subject => polluted.has(subject))) {
        const duplicate = [...subjects].some(subject => owners.get(subject)?.size > 1)
        audit({ file, handle, status: 'rejected', reason: duplicate ? 'duplicate_subject_bundle' : 'bundle_subject_scan_changed' })
        continue
      }
      if ([...windows.get(file)].some(window => failedWindows.has(window))) {
        audit({ file, handle, status: 'rejected', reason: checked.get(file).error?.code ?? 'window_continuity_lost' })
        continue
      }
      const { proof, error } = checked.get(file)
      if (error) {
        audit({ file, status: 'rejected', reason: error.code ?? 'proof_verification_failed' })
        continue
      }
      try {
        const result = this.settleLate(proof.handle, {
          lateOutcome: 'terminated_without_outcome',
          terminationEvidence: 'restart_quiescence_proven',
          exitObserved: false,
          restartQuiescence: true,
        })
        audit({ file, handle: proof.handle, status: result.won ? 'settled' : 'duplicate_ignored' })
      } catch (error) {
        audit({ file, status: 'rejected', reason: error.code ?? 'proof_verification_failed' })
      }
    }
    return results
  },
  restoreCrashInterruptedRecords() {
    let changed = false
    for (const record of this.records.values()) {
      if (record.state === 'settled') {
        if (record.initialOutcome === 'outcome_unknown' && record.fenceState === 'active') {
          const registryCleanupProven = record.attemptedActions?.some(action =>
            action.action === 'registry_cleanup' && action.result === 'succeeded') === true
          const mayFinishCleanup = record.terminationEvidence !== null
            && (record.reapClaim === null || registryCleanupProven)
          if (mayFinishCleanup) {
            record.fenceState = 'cleared'
            record.recoveryState = 'settled'
            record.failureReason = null
            record.nextSafeAction = 'send_new_request_after_reopened'
            record.attemptedActions = [...(record.attemptedActions ?? []), {
              action: 'fence_cleanup', result: 'succeeded', observedAtWallMs: Date.now(), reasonCode: 'startup_completed_proven_cleanup',
            }].slice(-32)
          } else {
            record.recoveryState = 'blocked'
            record.failureReason = 'registry_cleanup_proof_unavailable'
            record.nextSafeAction = 'operator_exact_generation_recovery'
          }
          record.updatedAt = Date.now()
          changed = true
        }
        continue
      }
      if (record.exitObservedAt !== null && record.exitObservedAt !== undefined) {
        record.state = 'settled'
        record.lateOutcome = 'terminated_without_outcome'
        record.terminationEvidence = 'child_real_exit'
        record.settledAtWallMs = record.settledAtWallMs ?? Date.now()
        record.recoveryState = 'settled'
        record.settlementResult = 'terminated_without_outcome'
        record.missingEvidence = []
        const reapCleanupPending = record.reapClaim !== null && record.reapClaim !== undefined
        record.nextSafeAction = reapCleanupPending ? 'operator_exact_generation_recovery' : 'send_new_request_after_reopened'
        record.fenceState = reapCleanupPending ? 'active' : 'cleared'
        record.failureReason = reapCleanupPending ? 'registry_cleanup_proof_unavailable' : null
        if (reapCleanupPending) record.recoveryState = 'blocked'
        record.updatedAt = Date.now()
        if (record.reapClaim !== null && record.reapClaim !== undefined) {
          record.reapClaim = { ...record.reapClaim, phase: 'settled' }
        }
        changed = true
        continue
      }
      if (record.promptWriteAttempted === true && record.initialOutcome === null) {
        record.initialOutcome = 'outcome_unknown'
        record.initialSource = 'runtime_restart_after_prompt_write'
        record.recoveryState = 'blocked'
        record.missingEvidence = ['live_generation_ownership']
        record.failureReason = 'runtime_restart_ownership_unavailable'
        record.nextSafeAction = 'reestablish_exact_ownership'
        record.fenceState = 'active'
        record.updatedAt = Date.now()
        changed = true
      }
      if (record.promptWriteAttempted !== true && record.initialOutcome === null) {
        record.state = 'settled'
        record.outcome = 'not_admitted'
        record.outcomeEvidence = 'prompt_write_not_attempted'
        record.settledAtWallMs = Date.now()
        record.recoveryState = 'settled'
        record.settlementResult = 'not_admitted'
        record.missingEvidence = []
        record.nextSafeAction = 'send_new_request_after_reopened'
        record.fenceState = 'cleared'
        record.updatedAt = Date.now()
        changed = true
      }
    }
    if (changed) {
      this.recountCapacity()
      this.persistDurable()
    }
  },
}
