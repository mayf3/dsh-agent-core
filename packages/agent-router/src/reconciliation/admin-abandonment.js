/**
 * Admin-controlled turn abandonment (HR_RESET_AND_RESUME_V1) on the one
 * reconciliation store.
 *
 * One explicit, idempotent, durably persisted administrator declaration that
 * a stuck unresolved `outcome_unknown` turn's business result is ABANDONED.
 * The declaration NEVER settles the record, NEVER clears its fence state and
 * NEVER deletes anything: the old record stays blocked + fenced + outcome
 * unknown forever (honest — no termination was proven), its caller
 * correlation entry keeps resolving (no-replay marker), and later evidence
 * still settles that exact handle only. The declaration's single effect is
 * on ADMISSION: `admissionBlockerForAgent` stops treating abandoned records
 * as a fence, so the SAME Agent through the SAME user entry can accept and
 * complete a NEW task while every other Agent and every non-abandoned
 * unknown stays fenced. Abandonments survive restarts through the durable
 * record field; a turn that goes unknown AFTER a declaration fences the
 * Agent again until a further explicit declaration.
 */

export const adminAbandonmentMethods = {
  /**
   * Admission projection: the agent's active fence that must block a NEW
   * request, honoring admin abandonment declarations. The historical
   * `activeFenceForAgent` stays unchanged and queryable (it still reports
   * the abandoned record); only NEW-request admission consults this.
   */
  admissionBlockerForAgent(agentId) {
    for (const record of this.records.values()) {
      if (record.agentId !== agentId || record.initialOutcome !== 'outcome_unknown'
          || record.fenceState === 'cleared'
          || (record.adminAbandonment ?? null) !== null) continue
      return record
    }
    return null
  },

  /**
   * Explicit administrator abandonment of the agent's current stuck turns
   * (every unsettled outcome_unknown record that still fences admission).
   * Each covered record is stamped with the closed declaration marker
   * through the transactional mutateRecord machinery (per-record durable
   * persist with preimage/rollback); a crash mid-declaration leaves a
   * partial set that the SAME declarationId re-invocation completes, and an
   * already-abandoned record is never restamped (idempotent). Returns the
   * exact handles this call abandoned.
   */
  declareAdminAbandonment({ agentId, declarationId }) {
    this.assertBusinessAdmissionReady()
    if (typeof agentId !== 'string' || agentId === '') {
      throw new TypeError('declareAdminAbandonment: agentId must be a non-empty string')
    }
    if (typeof declarationId !== 'string' || declarationId === '' || declarationId.length > 128) {
      throw new TypeError('declareAdminAbandonment: declarationId must be a non-empty string of at most 128 chars')
    }
    const abandonedHandles = []
    for (const record of this.records.values()) {
      if (record.agentId !== agentId || record.state === 'settled'
          || record.initialOutcome !== 'outcome_unknown' || record.fenceState === 'cleared'
          || (record.adminAbandonment ?? null) !== null) continue
      this.mutateRecord(record, (candidate) => {
        candidate.adminAbandonment = { declarationId, declaredAt: Date.now() }
      })
      abandonedHandles.push(record.handle)
    }
    return { agentId, declarationId, abandonedHandles }
  },
}
