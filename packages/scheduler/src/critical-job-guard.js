/**
 * AMENDMENT_1 — CRITICAL_JOB_SELF_DISABLE_GUARD implementation module
 * (AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2 AMENDMENT_1 accepted @ ba4c0a8;
 * structure split authorized by AMENDMENT_2, CTR closure four-file list).
 *
 * Owns the authorization & evidence seam of the critical-job guard:
 *   - stable denial reason codes and the fixed production inventory path;
 *   - inventory parsing / pure classification;
 *   - the store-coupled factory: mutation-time inventory load, the locked
 *     assert composition (`guardFor`), and sanitized denial evidence
 *     (`appendDenialAudit` via the existing run-event ledger channel).
 *
 * The guard is consulted ONLY on the ordinary self path (no scheduler.manage:any
 * proof); ownership itself remains the access layer's concern. Denials carry
 * zero job/definition content and perform zero store mutation.
 */

import { readFileSync } from 'node:fs'

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

/**
 * Parse the critical desired-state inventory (the reliability authority's
 * frozen §5.4 manifest). Returns the Set of critical logicalKeys, or throws on
 * any unreadable/invalid/unsupported-version input (caller maps that to the
 * fail-closed `critical_inventory_unavailable` class).
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
 * Pure guard decision: `null` = not blocked; otherwise the stable denial
 * reason. Only the SELF path (no manage:any proof) ever reaches this. Identity
 * is EXACTLY the job's persisted logicalKey against the inventory — never
 * name/substring/prompt. `inventory.state`:
 *   'unavailable' → source unreadable/invalid/unsupported version → FAIL_CLOSED
 *                   for disable/remove (critical_inventory_unavailable)
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
 * Store-coupled guard factory. Resolution for the inventory source: explicit
 * argument > SCHEDULER_DESIRED_STATE env > DEFAULT_CRITICAL_INVENTORY_PATH.
 * The inventory is re-read fresh at every guarded mutation (read-only, never
 * cached as authority); ANY read/parse failure ⇒ 'unavailable' (fail-closed,
 * never fail-open).
 *
 * @param {object} opts
 * @param {import('./store.js').JobStore} opts.store - evidence channel (run-event ledger append only)
 * @param {string} [opts.criticalInventoryPath]
 * @param {(path:string)=>string} [opts.readInventoryFile] - test seam
 * @param {(event:{operation:string,jobId:string})=>void} [opts.onAuditFailure]
 */
export function createCriticalJobGuard({ store, criticalInventoryPath = process.env.SCHEDULER_DESIRED_STATE ?? DEFAULT_CRITICAL_INVENTORY_PATH, readInventoryFile = (p) => readFileSync(p, 'utf8'), onAuditFailure = () => {} }) {
  if (store === undefined || store === null) throw new TypeError('critical-job-guard: store is required')

  function loadInventory() {
    try {
      return { state: 'ok', logicalKeys: parseCriticalInventory(readInventoryFile(criticalInventoryPath)) }
    } catch {
      return { state: 'unavailable' }
    }
  }

  /**
   * Locked-current classification assert (AMENDMENT_1, Owner B2 repair): the
   * control ops invoke the returned fn with the LOCKED re-read-latest job, so
   * the logicalKey used for the decision is exactly the job version being
   * disabled/removed. Denial throws BEFORE any write. `captureCurrent` (when
   * provided) observes the same locked current for the caller's audit
   * preimage after the classification passes.
   */
  function guardFor(operation, allowAny, captureCurrent) {
    return (current) => {
      if (!allowAny) {
        const reason = evaluateCriticalJobGuard({ operation, logicalKey: current.logicalKey, inventory: loadInventory() })
        if (reason !== null) {
          throw Object.assign(new Error(`${reason}: critical jobs cannot be ${operation === 'remove' ? 'removed' : 'disabled'} via self-service`), {
            code: 'CRITICAL_SELF_MUTATION_DENIED',
            reason,
            guardOperation: operation,
          })
        }
      }
      if (typeof captureCurrent === 'function') captureCurrent(current)
    }
  }

  /**
   * T9 durable denial attribution: sanitized evidence-only event on the
   * EXISTING run-event ledger channel — whitelisted fields, zero
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

  return { guardFor, appendDenialAudit, loadInventory }
}
