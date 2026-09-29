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
 * after the operation completed. When the durable scope registry is absent
 * (pre-registry durable file, or a file rewritten by an older binary), the
 * scope is reconstructed from the per-record markers, which survive every
 * durable round-trip.
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
    .filter(record => record.agentId === agentId && record.state !== 'settled'
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
   * declaration). Already-stamped or settled records are never restamped.
   * Rebinding a known declarationId to a different Agent fails loud.
   */
  declareAdminAbandonment({ agentId, declarationId }) {
    this.assertBusinessAdmissionReady()
    if (typeof agentId !== 'string' || agentId === '') {
      throw new TypeError('declareAdminAbandonment: agentId must be a non-empty string')
    }
    if (typeof declarationId !== 'string' || declarationId === '' || declarationId.length > 128) {
      throw new TypeError('declareAdminAbandonment: declarationId must be a non-empty string of at most 128 chars')
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
        if (record === undefined || record.state === 'settled'
            || record.initialOutcome !== 'outcome_unknown' || record.fenceState === 'cleared'
            || (record.adminAbandonment ?? null) !== null) continue
        this.mutateRecord(record, (candidate) => {
          candidate.adminAbandonment = { declarationId, declaredAt: known.declaredAt }
        })
        completedHandles.push(handle)
      }
      return { agentId, declarationId, abandonedHandles: [], completedHandles, scopeHandles: [...known.handles] }
    }
    if ((this.adminAbandonmentDeclarations?.length ?? 0) >= MAX_ADMIN_ABANDONMENT_DECLARATIONS) {
      throw new ReconciliationCapacityError('reconciliation: admin abandonment declaration budget exhausted')
    }
    const scopeHandles = stuckAdmissionHandles(this, agentId)
    const declaredAt = Date.now()
    // Scope-first durability: the operation's exact target set is durable
    // before the first stamp, so any later retry completes THIS scope only.
    this.adminAbandonmentDeclarations = [...(this.adminAbandonmentDeclarations ?? []), {
      declarationId, agentId, handles: scopeHandles, declaredAt,
    }]
    this.persistDurable()
    for (const handle of scopeHandles) {
      const record = this.records.get(handle)
      this.mutateRecord(record, (candidate) => {
        candidate.adminAbandonment = { declarationId, declaredAt }
      })
    }
    return { agentId, declarationId, abandonedHandles: [...scopeHandles], completedHandles: [], scopeHandles }
  },
}
