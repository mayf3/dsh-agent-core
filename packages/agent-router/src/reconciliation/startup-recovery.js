/** Crash-restart reconciliation for the V3 durable recovery authority. */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ownedDirectory, ownedFile } from './quiescence-custody.js'
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
    const handles = new Map()
    for (const file of files) {
      try {
        const raw = JSON.parse(ownedFile(join(evidenceDir, file), 65536, io).toString('utf8'))
        const handle = raw?.subject?.reconciliationHandle
        if (typeof handle === 'string') handles.set(handle, (handles.get(handle) ?? 0) + 1)
      } catch { /* verifier records the exact file error below */ }
    }
    for (const file of files) {
      try {
        const path = join(evidenceDir, file)
        const checked = verifyQuiescenceBundle(this, path, { evidenceDir, deploymentDir, startup, io })
        if (handles.get(checked.handle) !== 1) {
          audit({ file, handle: checked.handle, status: 'rejected', reason: 'duplicate_subject_bundle' })
          continue
        }
        const result = this.settleLate(checked.handle, {
          lateOutcome: 'terminated_without_outcome',
          terminationEvidence: 'restart_quiescence_proven',
          exitObserved: false,
          restartQuiescence: true,
        })
        audit({ file, handle: checked.handle, status: result.won ? 'settled' : 'duplicate_ignored' })
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
