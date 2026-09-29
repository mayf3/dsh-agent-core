/** V4 fresh HR cut and admission methods on the one reconciliation store. */
const FRESH_HR_AGENT_ID = 'agt_hr-agent'
const FRESH_HR_CUT_OPERATION_ID = 'hr-fresh-lineage-cut-20260929-0d8235e7'
const DIGEST = /^[a-f0-9]{64}$/

export class FreshHrLineageMethods {
  /** Install only the one exact, already authenticated HR cut at startup.
   * This validates its binding to the loaded old record; root custody,
   * Scheduler inhibition and worker/tool isolation are established before
   * the private startup consumer invokes this method, not by digest syntax.
   */
  validateTrustedFreshHrLineage(cut) {
    this.assertBusinessAdmissionReady()
    if (this.freshHrLineage !== null || cut === null || typeof cut !== 'object'
        || Array.isArray(cut)) throw new TypeError('fresh HR lineage: cut unavailable or already installed')
    const keys = [
      'version', 'operationId', 'agentId', 'oldHandle', 'oldRuntimeEpoch',
      'oldProcessGeneration', 'oldSessionId', 'newRuntimeEpoch', 'newSessionId',
      'issuanceFloor', 'cutCommittedAtMs', 'oldWorkerIsolationReceiptSha256',
      'schedulerDisabledReceiptSha256', 'rootReceiptSha256',
    ]
    if (Object.keys(cut).sort().join(',') !== keys.sort().join(',')
        || cut.version !== 1 || cut.operationId !== FRESH_HR_CUT_OPERATION_ID
        || cut.agentId !== FRESH_HR_AGENT_ID
        || cut.newRuntimeEpoch !== this.runtimeEpoch
        || typeof cut.oldSessionId !== 'string' || cut.oldSessionId === ''
        || typeof cut.newSessionId !== 'string' || cut.newSessionId === ''
        || cut.newSessionId === cut.oldSessionId
        || !Number.isSafeInteger(cut.issuanceFloor) || cut.issuanceFloor < 1
        || cut.issuanceFloor !== this.highestIssuedGeneration(FRESH_HR_AGENT_ID)
        || typeof cut.oldRuntimeEpoch !== 'string' || cut.oldRuntimeEpoch === this.runtimeEpoch
        || !Number.isSafeInteger(cut.oldProcessGeneration) || cut.oldProcessGeneration < 1
        || !Number.isSafeInteger(cut.cutCommittedAtMs) || cut.cutCommittedAtMs < 1
        || !DIGEST.test(cut.oldWorkerIsolationReceiptSha256 ?? '')
        || !DIGEST.test(cut.schedulerDisabledReceiptSha256 ?? '')
        || !DIGEST.test(cut.rootReceiptSha256 ?? '')) {
      throw new TypeError('fresh HR lineage: exact cut binding invalid')
    }
    const old = this.records.get(cut.oldHandle)
    if (old === undefined || old.agentId !== FRESH_HR_AGENT_ID
        || old.runtimeEpoch !== cut.oldRuntimeEpoch
        || old.processGeneration !== cut.oldProcessGeneration
        || old.sessionId !== cut.oldSessionId
        || old.initialOutcome !== 'outcome_unknown'
        || old.fenceState !== 'active'
        || !this.runtimeEpochs.has(cut.oldRuntimeEpoch)) {
      throw new TypeError('fresh HR lineage: old unresolved subject mismatch')
    }
    const active = [...this.records.values()].filter(record => record.agentId === FRESH_HR_AGENT_ID
      && record.initialOutcome === 'outcome_unknown' && record.fenceState !== 'cleared')
    if (active.length !== 1 || active[0] !== old) {
      throw new TypeError('fresh HR lineage: ambiguous old active fences')
    }
    return true
  }

  activateTrustedFreshHrLineage(cut) {
    this.validateTrustedFreshHrLineage(cut)
    this.freshHrLineage = Object.freeze({ ...cut })
  }

  /** Only the startup coordinator can use this private token to start one
   * child before business admission opens. It cannot cross the prompt gate. */
  issueFreshHrStartupToken(cut) {
    if (this.freshHrLineage === null || this.freshHrMount !== null
        || cut?.operationId !== this.freshHrLineage.operationId
        || cut?.newRuntimeEpoch !== this.runtimeEpoch
        || cut?.rootReceiptSha256 !== this.freshHrLineage.rootReceiptSha256) {
      throw new TypeError('fresh HR lineage: private startup unavailable')
    }
    const token = Object.freeze({ kind: 'fresh-hr-startup',
      agentId: FRESH_HR_AGENT_ID, operationId: cut.operationId,
      runtimeEpoch: this.runtimeEpoch })
    this.freshHrStartupTokens.add(token)
    return token
  }

  /** Runs only after the real READY child and fixed mount-ACK file have been
   * observed locally. The root producer independently verifies host/process
   * identity under its window before it may claim COMPLETE. */
  completeTrustedFreshHrMount(cut, acknowledgement) {
    if (this.freshHrLineage === null || this.freshHrMount !== null
        || cut?.operationId !== this.freshHrLineage.operationId
        || cut?.newRuntimeEpoch !== this.runtimeEpoch
        || cut?.rootReceiptSha256 !== this.freshHrLineage.rootReceiptSha256
        || !Number.isSafeInteger(acknowledgement?.processGeneration)
        || acknowledgement.processGeneration <= this.freshHrLineage.issuanceFloor
        || !Number.isSafeInteger(acknowledgement?.childPid)
        || acknowledgement.childPid < 1
        || !DIGEST.test(acknowledgement?.acknowledgementSha256 ?? '')
        || this.activeFenceForAgent(FRESH_HR_AGENT_ID)?.handle !== cut.oldHandle) {
      throw new TypeError('fresh HR lineage: mounted child/ACK not proven')
    }
    this.freshHrMount = Object.freeze({ ...acknowledgement })
  }

  /** Historical activeFenceForAgent remains unchanged and queryable. This
   * projection is only for new-lineage admission after a trusted cut. */
  admissionFenceForAgent(agentId, { sessionId, freshMappingCreatedAt,
    freshMappingLineageOperationId } = {}) {
    const cut = this.freshHrLineage
    if (cut === null || agentId !== cut.agentId) return this.activeFenceForAgent(agentId)
    if (this.freshHrMount === null) return this.activeFenceForAgent(agentId)
    const mappedAt = typeof freshMappingCreatedAt === 'string'
      ? Date.parse(freshMappingCreatedAt) : freshMappingCreatedAt
    const eligible = sessionId === cut.newSessionId
      || (typeof sessionId === 'string' && sessionId.startsWith('fresh-')
        && freshMappingLineageOperationId === cut.operationId
        && Number.isSafeInteger(mappedAt) && mappedAt > cut.cutCommittedAtMs)
    for (const record of this.records.values()) {
      if (record.agentId !== agentId || record.initialOutcome !== 'outcome_unknown'
          || record.fenceState === 'cleared') continue
      if (eligible && record.handle === cut.oldHandle) continue
      return record
    }
    return null
  }

  /** An opaque, mount-local capability issued only after the ingress has
   * resolved the durable post-cut Binding or mapping. A session string alone
   * must never authorize the public direct route to bypass the old fence. */
  issueFreshHrAdmissionToken(agentId, binding) {
    const cut = this.freshHrLineage
    if (cut === null || this.freshHrMount === null || agentId !== cut.agentId
        || typeof binding?.sessionId !== 'string'
        || binding.sessionId === '' || this.admissionFenceForAgent(agentId, binding) !== null) {
      throw Object.assign(new Error('fresh HR lineage: admission not proven'),
        { code: 'HR_FRESH_LINEAGE_ADMISSION_DENIED' })
    }
    const token = Object.freeze({ agentId, sessionId: binding.sessionId,
      operationId: cut.operationId, runtimeEpoch: this.runtimeEpoch })
    this.freshHrLineageTokens.add(token)
    return token
  }

  hasFreshHrAdmissionToken(agentId, sessionId, token) {
    const cut = this.freshHrLineage
    return cut !== null && agentId === cut.agentId && token !== null
      && typeof token === 'object' && this.freshHrLineageTokens.has(token)
      && token.agentId === agentId && token.sessionId === sessionId
      && token.operationId === cut.operationId && token.runtimeEpoch === this.runtimeEpoch
  }

  promptFenceForAgent(agentId, sessionId, token) {
    return this.hasFreshHrAdmissionToken(agentId, sessionId, token)
      ? this.spawnFenceForAgent(agentId, token) : this.activeFenceForAgent(agentId)
  }

  /** Registry may start a new generation only after the trusted cut; all
   * new unknowns still fence the Agent and the durable generation allocator
   * continues above the old issuance floor. */
  spawnFenceForAgent(agentId, token) {
    const cut = this.freshHrLineage
    if (cut !== null && agentId === cut.agentId && this.freshHrMount === null
        && token !== null && typeof token === 'object'
        && this.freshHrStartupTokens.has(token)
        && token.operationId === cut.operationId
        && token.runtimeEpoch === this.runtimeEpoch) {
      for (const record of this.records.values()) {
        if (record.agentId === agentId && record.initialOutcome === 'outcome_unknown'
            && record.fenceState !== 'cleared' && record.handle !== cut.oldHandle) return record
      }
      return null
    }
    if (cut === null || agentId !== cut.agentId
        || !this.hasFreshHrAdmissionToken(agentId, token?.sessionId, token)) {
      return this.activeFenceForAgent(agentId)
    }
    for (const record of this.records.values()) {
      if (record.agentId === agentId && record.initialOutcome === 'outcome_unknown'
          && record.fenceState !== 'cleared' && record.handle !== cut.oldHandle) return record
    }
    return null
  }

}
