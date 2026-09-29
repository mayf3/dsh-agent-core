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
 *
 * Operation-scope binding: every declarationId is durably registered with
 * its EXACT original scope (the handle set captured when the operation was
 * first declared) BEFORE any record is stamped. A retry of a known
 * declarationId therefore only completes records of that original scope
 * (crash-between-stamps recovery) and can never adopt a turn that appeared
 * after the operation completed. The registry is durably persisted in its
 * own sibling file next to the recovery store, which binaries that predate
 * the registry never read or write — an old-binary rewrite of the recovery
 * file therefore cannot strand an unstamped scope (review finding: a
 * top-level registry field inside the recovery file is silently dropped by
 * the parent binary's fixed-shape rewrite). When the registry file is
 * absent entirely, the scope is reconstructed from the per-record markers,
 * which survive every durable round-trip.
 *
 * Scope = the admission blocker projection: a record fences NEW-request
 * admission while its initial outcome is unknown, its fence is not cleared
 * and it carries no abandonment marker — regardless of whether the record
 * itself is settled (a settled terminated_without_outcome record can still
 * fence admission while registry cleanup is pending). The captured scope
 * and the retry completion path use exactly that predicate, so a declared
 * reset always unblocks what the blocker projection actually blocks.
 */

import { ReconciliationCapacityError } from './capacity.js'

/** Bounded number of durable declaration operations (closed store budget). */
export const MAX_ADMIN_ABANDONMENT_DECLARATIONS = 32

/**
 * Fallback scope reconstruction when a durable file carries no declaration
 * registry: group the per-record markers (which survive every durable
 * round-trip, including rewrites by binaries that predate the registry).
 */
export function reconstructAdminAbandonmentDeclarations(records) {
  const byDeclarationId = new Map()
  for (const record of records.values()) {
    const marker = record.adminAbandonment
    if (marker === null || marker === undefined) continue
    const entry = byDeclarationId.get(marker.declarationId) ?? {
      declarationId: marker.declarationId,
      agentId: record.agentId,
      handles: [],
      declaredAt: marker.declaredAt,
    }
    entry.handles.push(record.handle)
    entry.declaredAt = Math.min(entry.declaredAt, marker.declaredAt)
    byDeclarationId.set(marker.declarationId, entry)
  }
  return [...byDeclarationId.values()]
}

function stuckAdmissionHandles(store, agentId) {
  return [...store.records.values()]
    .filter(record => record.agentId === agentId
      && record.initialOutcome === 'outcome_unknown' && record.fenceState !== 'cleared'
      && (record.adminAbandonment ?? null) === null)
    .map(record => record.handle)
}

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
   * Non-consuming read projection of the agent's durable abandonment
   * operations (for the authenticated admin entry's GET surface).
   */
  adminAbandonmentsForAgent(agentId) {
    return (this.adminAbandonmentDeclarations ?? [])
      .filter(declaration => declaration.agentId === agentId)
      .map(declaration => ({
        declarationId: declaration.declarationId,
        declaredAt: declaration.declaredAt,
        handles: [...declaration.handles],
        pendingHandles: declaration.handles.filter(handle => this.records.get(handle)?.state !== 'settled'),
        settledHandles: declaration.handles.filter(handle => this.records.get(handle)?.state === 'settled'),
      }))
  },

  /**
   * Entry-gate projection (review finding: an EMPTY lifecycle slot after a
   * controller restart is NOT termination evidence). Returns the agent's
   * first stuck fence record that carries NO durable exit/termination
   * evidence (no observed exit, no terminationEvidence kind): the exact
   * restart-lost class where the old execution's termination is unproven and
   * the authenticated admin entry must fail closed. Records bearing durable
   * evidence (child_real_exit via a durably recorded observed exit, or an
   * accepted quiescence-proof settlement) are NOT reported.
   */
  stuckFenceWithoutDurableExitEvidenceForAgent(agentId) {
    for (const record of this.records.values()) {
      if (record.agentId !== agentId || record.initialOutcome !== 'outcome_unknown'
          || record.fenceState === 'cleared'
          || (record.adminAbandonment ?? null) !== null) continue
      if ((record.exitObservedAt ?? null) === null && (record.terminationEvidence ?? null) === null) {
        return { handle: record.handle, failureReason: record.failureReason ?? null }
      }
    }
    return null
  },

  /**
   * Explicit administrator abandonment of the agent's current stuck turns.
   *
   * NEW declarationId: the exact stuck scope is captured and durably
   * registered BEFORE any stamp, then each covered record is stamped through
   * the transactional mutateRecord machinery (per-record durable persist
   * with preimage/rollback). A crash mid-operation leaves the scope durable,
   * so the SAME declarationId re-invocation completes exactly that scope.
   * KNOWN declarationId (retry): only records of the original scope may be
   * completed — a turn that became unknown after the operation completed is
   * NEVER adopted by a retry (it stays fenced until its own explicit
   * declaration). Already-stamped records are never restamped. Rebinding a
   * known declarationId to a different Agent fails loud.
   *
   * ownerRiskAcceptance (spec AGENT_PROCESS_ADMIN_TURN_ABANDONMENT_V1 D6):
   * strictly `true` | undefined. When true, every stamped record also gets a
   * bounded audit entry recording the EXPLICIT owner decision to accept the
   * restart-lost class whose termination observation is uncollectable (the
   * owning controller is gone). This is an owner DECISION recorded as a
   * decision — never termination evidence: exitObservedAt and
   * terminationEvidence stay untouched, the record stays fenced +
   * outcome_unknown, and only admission is unblocked.
   */
  declareAdminAbandonment({ agentId, declarationId, ownerRiskAcceptance }) {
    this.assertBusinessAdmissionReady()
    if (typeof agentId !== 'string' || agentId === '') {
      throw new TypeError('declareAdminAbandonment: agentId must be a non-empty string')
    }
    if (typeof declarationId !== 'string' || declarationId === '' || declarationId.length > 128) {
      throw new TypeError('declareAdminAbandonment: declarationId must be a non-empty string of at most 128 chars')
    }
    if (ownerRiskAcceptance !== undefined && ownerRiskAcceptance !== true) {
      throw new TypeError('declareAdminAbandonment: ownerRiskAcceptance must be exactly true when present')
    }
    const known = (this.adminAbandonmentDeclarations ?? [])
      .find(declaration => declaration.declarationId === declarationId)
    if (known !== undefined) {
      if (known.agentId !== agentId) {
        throw Object.assign(new Error(`declareAdminAbandonment: declarationId ${declarationId} is already bound to agent ${known.agentId}`), {
          code: 'RECONCILIATION_DECLARATION_CONFLICT',
        })
      }
      const completedHandles = []
      for (const handle of known.handles) {
        const record = this.records.get(handle)
        if (record === undefined
            || record.initialOutcome !== 'outcome_unknown' || record.fenceState === 'cleared'
            || (record.adminAbandonment ?? null) !== null) continue
        this.mutateRecord(record, (candidate) => {
          candidate.adminAbandonment = { declarationId, declaredAt: known.declaredAt }
        })
        if (ownerRiskAcceptance === true) {
          this.appendAudit(record, { kind: 'owner_risk_acceptance_unproven_termination' })
        }
        completedHandles.push(handle)
      }
      return { agentId, declarationId, abandonedHandles: [], completedHandles, scopeHandles: [...known.handles] }
    }
    if ((this.adminAbandonmentDeclarations?.length ?? 0) >= MAX_ADMIN_ABANDONMENT_DECLARATIONS) {
      throw new ReconciliationCapacityError(`reconciliation: admin abandonment declaration budget exhausted (${MAX_ADMIN_ABANDONMENT_DECLARATIONS} distinct declaration ids per durable store; ids are never recycled and replay protection is never traded for capacity — retries of existing declaration ids remain possible)`)
    }
    const scopeHandles = stuckAdmissionHandles(this, agentId)
    const declaredAt = Date.now()
    // Scope-first durability: the operation's exact target set is durable
    // before the first stamp, so any later retry completes THIS scope only.
    this.adminAbandonmentDeclarations = [...(this.adminAbandonmentDeclarations ?? []), {
      declarationId, agentId, handles: scopeHandles, declaredAt,
    }]
    this.adminAbandonmentDeclarationsDirty = true
    this.persistDurable()
    for (const handle of scopeHandles) {
      const record = this.records.get(handle)
      this.mutateRecord(record, (candidate) => {
        candidate.adminAbandonment = { declarationId, declaredAt }
      })
      if (ownerRiskAcceptance === true) {
        this.appendAudit(record, { kind: 'owner_risk_acceptance_unproven_termination' })
      }
    }
    return { agentId, declarationId, abandonedHandles: [...scopeHandles], completedHandles: [], scopeHandles }
  },
}
