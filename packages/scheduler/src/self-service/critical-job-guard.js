/**
 * AMENDMENT_1 — CRITICAL_JOB_SELF_DISABLE_GUARD: the guard-cohesive face of
 * the self-service access layer.
 *
 * AMENDMENT_3 C2 mechanical split from src/self-service.js: every body is
 * byte-verbatim (reorganized into createCriticalJobGuard); only module
 * placement and import specifiers changed. This module carries ONLY the guard
 * responsibility AMENDMENT_1 authorized and absorbs no non-guard member.
 */

import { readFileSync } from 'node:fs'

import { cloneJob } from '../job-model.js'

export const CRITICAL_GUARD_REASONS = {
  SELF_DISABLE: 'critical_job_self_disable',
  INVENTORY_UNAVAILABLE: 'critical_inventory_unavailable',
}

/**
 * AMENDMENT_1 (Owner B1 repair, 2026-09-10): the production default critical
 * inventory is FIXED at the accepted path — an absent/unreadable manifest is
 * `critical_inventory_unavailable` (FAIL_CLOSED), never "guard disabled".
 * There is no unconfigured/inert product state; tests inject an explicit path.
 */
export const DEFAULT_CRITICAL_INVENTORY_PATH = '/usr/local/libexec/agent-core/config/scheduler-desired-state.json'

export function ownershipGuard(callerAgentId, allowAny, captureCurrent) {
  return (current) => {
    if (!allowAny && current.agentId !== callerAgentId) {
      throw Object.assign(new Error('job ownership changed before mutation'), { code: 'SELF_SERVICE_ACCESS_DENIED' })
    }
    if (typeof captureCurrent === 'function') captureCurrent(cloneJob(current))
  }
}

/**
 * AMENDMENT_1 — CRITICAL_JOB_SELF_DISABLE_GUARD (accepted, PR #249): parse the
 * critical desired-state inventory (the reliability authority's frozen §5.4
 * manifest). Returns the Set of critical logicalKeys, or throws on any
 * unreadable/invalid/unsupported-version input (caller maps that to the
 * fail-closed `critical_inventory_unavailable` class). Read-only; no caching —
 * the inventory is consulted fresh at mutation time.
 */
export function parseCriticalInventory(raw) {
  const parsed = JSON.parse(raw)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('critical inventory must be an object')
  }
  if (parsed.version !== 1) throw new TypeError(`unsupported critical inventory version: ${String(parsed.version)}`)
  if (!Array.isArray(parsed.jobs)) throw new TypeError('critical inventory jobs must be an array')
  const logicalKeys = new Set()
  for (const entry of parsed.jobs) {
    if (entry === null || typeof entry !== 'object' || typeof entry.logicalKey !== 'string' || entry.logicalKey.trim() === '') {
      throw new TypeError('critical inventory job entry requires a non-empty logicalKey')
    }
    logicalKeys.add(entry.logicalKey)
  }
  return logicalKeys
}

/**
 * Pure guard decision (AMENDMENT_1, B1 repair): `null` = not blocked;
 * otherwise the stable denial reason. Only the SELF path (no manage:any
 * proof) ever reaches this. Identity is EXACTLY the job's persisted
 * logicalKey against the inventory — never name/substring/prompt.
 * `inventory.state`:
 *   'unavailable' → configured source unreadable/invalid/unsupported version
 *                   → FAIL_CLOSED for disable/remove
 *                     (critical_inventory_unavailable)
 *   'ok'          → exact match ⇒ critical_job_self_disable; absent ⇒ null
 * There is NO inert/unconfigured state: the inventory defaults to the fixed
 * production path and always classifies.
 */
export function evaluateCriticalJobGuard({ operation, logicalKey, inventory }) {
  if (operation !== 'disable' && operation !== 'remove') return null
  if (inventory.state === 'unavailable') return CRITICAL_GUARD_REASONS.INVENTORY_UNAVAILABLE
  if (inventory.logicalKeys.has(logicalKey)) return CRITICAL_GUARD_REASONS.SELF_DISABLE
  return null
}

/**
 * AMENDMENT_1 guard factory (AMENDMENT_3 C2): composes the mutation-time
 * fresh critical-inventory read, the locked-current CRITICAL_SELF_MUTATION_DENIED
 * classification, and the durable sanitized denial audit. The access layer
 * composes ownershipGuard FIRST and the returned critical assert SECOND
 * (exact order and the captureCurrent(cloneJob(current)) semantics are
 * preserved there); guardFor is invoked before the locked mutation, which
 * keeps the inventory load eager for disable/remove.
 */
export function createCriticalJobGuard({ store, criticalInventoryPath = process.env.SCHEDULER_DESIRED_STATE ?? DEFAULT_CRITICAL_INVENTORY_PATH, readInventoryFile = (p) => readFileSync(p, 'utf8'), onAuditFailure = () => {} }) {
  /**
   * Mutation-time critical-inventory read (AMENDMENT_1 A3): fresh, read-only,
   * zero caching; ANY read/parse/version failure ⇒ 'unavailable' (fail-closed,
   * never fail-open — Owner B1: there is no inert state).
   */
  function loadCriticalInventory() {
    try {
      return { state: 'ok', logicalKeys: parseCriticalInventory(readInventoryFile(criticalInventoryPath)) }
    } catch {
      return { state: 'unavailable' }
    }
  }

  /**
   * T9 durable denial attribution (AMENDMENT_1): sanitized evidence-only event
   * on the EXISTING run-event ledger channel — whitelisted fields, zero
   * payload/credential bytes; best-effort exactly like mutation audit.
   */
  async function appendDenialAudit(operation, { jobId, operatorAgentId, reason }) {
    let status
    try {
      status = await store.appendRunEvent({
        ts: Date.now(),
        action: 'self_service_denied',
        operation,
        jobId,
        operatorAgentId,
        reason,
      })
    } catch {
      status = { ok: false }
    }
    if (status?.ok === true) return 'appended'
    try { onAuditFailure({ operation, jobId }) } catch {}
    return 'append_failed'
  }

  /**
   * AMENDMENT_1 (Owner B2 repair, 2026-09-10): the critical classification runs
   * INSIDE the mutation serialization boundary — the assertJob seam is invoked
   * by the control ops with the LOCKED, re-read-latest job, so the logicalKey
   * used for the decision is exactly the job version being mutated (no
   * unlocked-snapshot TOCTOU; expected_revision is irrelevant to this
   * invariant). Ownership first (composed by the caller), then (SELF path
   * only) the guard; a denial throws BEFORE any write (mutateDoc leaves disk
   * untouched), with the stable reason carried on the error for the caller's
   * evidence append. `captureCurrent` is satisfied by the ownership phase of
   * the composition in the access layer, before this assert runs.
   */
  function guardFor(operation, allowAny, captureCurrent) {
    const inventory = loadCriticalInventory()
    return (current) => {
      if (!allowAny) {
        const reason = evaluateCriticalJobGuard({ operation, logicalKey: current.logicalKey, inventory })
        if (reason !== null) {
          throw Object.assign(new Error(`${reason}: critical jobs cannot be ${operation === 'remove' ? 'removed' : 'disabled'} via self-service`), {
            code: 'CRITICAL_SELF_MUTATION_DENIED',
            reason,
            guardOperation: operation,
          })
        }
      }
    }
  }

  return { guardFor, appendDenialAudit }
}
