/**
 * @agent-core/agent-router/src/reconciliation/state-machine.js — the
 * settle-once record state machine of AGENT_PROCESS_LIFECYCLE_HARDENING_V2
 * (C-017 direct + late settlement, C-015 termination evidence vocabulary).
 *
 * These methods compose onto TurnReconciliationStore.prototype (store.js);
 * they operate on the store's own record fields through `this` and stay the
 * SINGLE settlement authority — the AgentProcess local matcher is bounded
 * working state only, never a second truth source.
 */

/** The mutually exclusive late outcomes (C-017). */
export const LATE_OUTCOMES = Object.freeze(['late_completed', 'late_failed', 'terminated_without_outcome'])
/** Direct (in-deadline) terminal outcomes (C-010 closed envelope). */
export const DIRECT_OUTCOMES = Object.freeze(['completed', 'failed', 'not_admitted'])
/** The trusted termination evidence types (C-015). */
export const TERMINATION_EVIDENCE_TYPES = Object.freeze([
  'exact_terminal_then_idle',
  'exact_queued_removal',
  'child_real_exit',
  'cancellation_ack',
])

export const settlementMethods = {
  /** Initial outcome for every unresolved-unknown source (C-017). Idempotent. */
  markOutcomeUnknown(handle, { source, deadlineAtWallMs }) {
    const record = this.requireRecord(handle)
    if (record.state === 'settled') {
      this.appendAudit(record, { kind: 'conflict_ignored', evidenceType: `initial_unknown_after_${record.lateOutcome}` })
      return
    }
    if (record.initialOutcome === 'outcome_unknown') return
    record.initialOutcome = 'outcome_unknown'
    record.initialSource = source ?? null
    record.deadlineAtWallMs = deadlineAtWallMs ?? record.deadlineAtWallMs
    this.retally(record)
  },

  /**
   * Direct in-deadline terminal settlement (C-010 closed envelope):
   * `completed` / `failed` with exact outcome+termination evidence, or
   * `not_admitted` with proven pre-send rejection. Also settle-once; a
   * record that already entered `outcome_unknown` must use settleLate.
   * @returns {{won:boolean, outcome?:string}}
   */
  settleDirect(handle, { outcome, outcomeEvidence = null, terminationEvidence = null, errorClass = null }) {
    if (!DIRECT_OUTCOMES.includes(outcome)) {
      throw new TypeError(`settleDirect: illegal outcome ${JSON.stringify(outcome)}`)
    }
    const record = this.requireRecord(handle)
    if (record.state === 'settled') {
      const duplicate = (record.outcome ?? record.lateOutcome) === outcome
      this.appendAudit(record, {
        kind: duplicate ? 'duplicate_ignored' : 'conflict_ignored',
        evidenceType: outcome,
      })
      return { won: false, outcome: record.outcome ?? record.lateOutcome }
    }
    if (record.initialOutcome === 'outcome_unknown') {
      throw new Error(`settleDirect: handle ${handle} already entered outcome_unknown — use settleLate (late machine)`)
    }
    record.state = 'settled'
    record.outcome = outcome
    record.outcomeEvidence = outcomeEvidence
    record.terminationEvidence = terminationEvidence
    record.errorClass = errorClass
    record.settledAtWallMs = Date.now()
    this.refreshGenerationUnresolved(record)
    for (const listener of this.listeners) {
      try { listener({ handle, ...this.settledSnapshot(record) }) } catch { /* listener isolation */ }
    }
    return { won: true, outcome }
  },

  /**
   * The single settle-once late-state-machine transition (C-017).
   * `lateOutcome` ∈ late_completed | late_failed | terminated_without_outcome.
   * The CALLER owns evidence precedence (parsed exact outcome must beat
   * child_real_exit); this store only guarantees: first settlement wins,
   * later evidence never rewrites state or output, duplicates/conflicts
   * append bounded audit entries.
   * @returns {{won:boolean, lateOutcome?:string}}
   */
  settleLate(handle, { lateOutcome, outcomeEvidence = null, terminationEvidence = null, finalAssistantOutput = undefined }) {
    if (!LATE_OUTCOMES.includes(lateOutcome)) {
      throw new TypeError(`settleLate: illegal lateOutcome ${JSON.stringify(lateOutcome)}`)
    }
    if (terminationEvidence !== null && !TERMINATION_EVIDENCE_TYPES.includes(terminationEvidence)) {
      throw new TypeError(`settleLate: illegal terminationEvidence ${JSON.stringify(terminationEvidence)}`)
    }
    const record = this.requireRecord(handle)
    if (record.state === 'settled') {
      const duplicate = record.lateOutcome === lateOutcome
        && (record.terminationEvidence ?? null) === (terminationEvidence ?? null)
      this.appendAudit(record, {
        kind: duplicate ? 'duplicate_ignored' : 'conflict_ignored',
        evidenceType: terminationEvidence ?? lateOutcome,
      })
      return { won: false, lateOutcome: record.lateOutcome }
    }
    if (record.initialOutcome !== 'outcome_unknown') {
      // Direct terminal without an intermediate unknown is only legal for
      // ordinary in-deadline completion/failure — those do not pass through
      // the late machine. Late settlement requires the unknown source first.
      throw new Error(`settleLate: handle ${handle} has no outcome_unknown source (initialOutcome=${JSON.stringify(record.initialOutcome)})`)
    }
    record.state = 'settled'
    record.lateOutcome = lateOutcome
    record.outcomeEvidence = outcomeEvidence
    record.terminationEvidence = terminationEvidence
    record.settledAtWallMs = Date.now()
    if (finalAssistantOutput !== undefined) {
      this.updateFinalOutput(handle, finalAssistantOutput)
    }
    this.refreshGenerationUnresolved(record)
    for (const listener of this.listeners) {
      try { listener({ handle, ...this.settledSnapshot(record) }) } catch { /* listener isolation */ }
    }
    return { won: true, lateOutcome }
  },

  refreshGenerationUnresolved(record) {
    const issuance = this.issuance.get(record.agentId)
    if (issuance === undefined) return
    const generationEntry = issuance.generations.get(record.processGeneration)
    if (generationEntry === undefined) return
    generationEntry.unresolvedCount = Math.max(0, generationEntry.unresolvedCount - 1)
  },
}
