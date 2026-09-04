/**
 * @agent-core/production-runtime/src/agent-session-messaging-audit.js — the
 * NEW bounded L0/L1 capability-evidence append surface for agent_session_send
 * (AGENT_CORE_AGENT_SESSION_MESSAGING_V1 R12).
 *
 * BASE has no durable capability-audit surface in Broker or Router; this
 * module follows the scheduler self-service precedent (appendAudit with an
 * explicit appended/append_failed status, plus a sanitized operations-visible
 * onAuditFailure signal wired by the composition) WITHOUT reusing the
 * scheduler's store: scheduler audit events remain scheduler-owned.
 *
 * Shape (closed, secret-free):
 *   kind = 'agent_session_send'
 *   phase = 'intent' | 'outcome' | 'denial'   (denial = L0, pre-handler)
 *   sourceAgentId / targetAgentId
 *   requestId (opaque runtime id) / correlationHash (sha256 prefix of the
 *     exact source turnExecutionId — never the id itself)
 *   timeoutMode = 'receipt_only' | 'wait_reply'
 *   result = accepted | replied | timeout | failed   (outcome only; 'denied'
 *     denials are L0 rows recorded by the gateway hook path)
 *   reconciliationHandle (outcome only — internal evidence)
 *   startedAtWallMs / durationMs / ts
 *
 * Message text, credentials, token material, Session history and external
 * reply targets are structurally excluded: append* only persist the exact
 * fields they are given, and every caller above this module passes
 * identifiers and hashes only.
 *
 * Bounded: the JSONL file rotates once (`.1`) when it exceeds the byte cap;
 * a failed rotation or append reports 'append_failed' and never throws.
 */

import { appendFileSync, existsSync, renameSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'

/** Rotating cap for the JSONL evidence file (bytes). */
export const AUDIT_FILE_MAX_BYTES = 8 * 1024 * 1024

/** Hash the exact source turnExecutionId into a bounded opaque correlation. */
export function correlationHash(turnExecutionId) {
  return createHash('sha256').update(String(turnExecutionId)).digest('hex').slice(0, 16)
}

/**
 * Create the audit surface.
 * @param {object} opts
 * @param {string} opts.auditFile - absolute JSONL evidence path (inside the
 *   production control dir; created lazily by the caller's layout).
 * @param {() => number} [opts.now] - wall-clock seam.
 * @param {number} [opts.maxBytes] - rotation cap (tests).
 */
export function createAgentSessionMessagingAudit({ auditFile, now = () => Date.now(), maxBytes = AUDIT_FILE_MAX_BYTES }) {
  if (typeof auditFile !== 'string' || auditFile === '') {
    throw new TypeError('agent-session-messaging-audit: auditFile is required')
  }

  function rotateIfNeeded() {
    if (!existsSync(auditFile)) return
    if (statSync(auditFile).size < maxBytes) return
    try {
      renameSync(auditFile, `${auditFile}.1`)
    } catch {
      // A stuck rotation must not crash the capability; the append below
      // reports 'append_failed' and the onAuditFailure signal stays visible.
    }
  }

  /**
   * Append one bounded evidence row.
   * @returns {'appended' | 'append_failed'}
   */
  function append(entry) {
    try {
      rotateIfNeeded()
      appendFileSync(auditFile, `${JSON.stringify({ ...entry, ts: now() })}\n`)
      return 'appended'
    } catch {
      return 'append_failed'
    }
  }

  /**
   * L1 intent row — committed AFTER authoritative argument/auth checks and
   * BEFORE Router delivery (R12 commit order). A failure here makes the
   * caller abort with zero Router deliveries.
   */
  function appendIntent({ sourceAgentId, targetAgentId, requestId, correlation, timeoutMode }) {
    return append({
      kind: 'agent_session_send',
      phase: 'intent',
      sourceAgentId,
      targetAgentId,
      requestId,
      correlationHash: correlationHash(correlation),
      timeoutMode,
      startedAtWallMs: now(),
    })
  }

  /**
   * L1 outcome row — appended after a real receipt or a definitive
   * pre-receipt failure. An append failure NEVER rewrites the proven
   * business result; the caller surfaces the sanitized onAuditFailure
   * signal instead.
   */
  function appendOutcome({ sourceAgentId, targetAgentId, requestId, correlation, timeoutMode, result, reconciliationHandle, startedAtWallMs }) {
    return append({
      kind: 'agent_session_send',
      phase: 'outcome',
      sourceAgentId,
      targetAgentId,
      requestId,
      correlationHash: correlationHash(correlation),
      timeoutMode,
      result,
      ...(reconciliationHandle === undefined ? {} : { reconciliationHandle }),
      ...(startedAtWallMs === undefined ? {} : { startedAtWallMs }),
      durationMs: Math.max(0, now() - (startedAtWallMs ?? now())),
    })
  }

  /**
   * L0 denial row — recorded by the gateway auditDenial hook for
   * pre-handler denials (missing handler, credential, grant). Zero business
   * detail: ids and the coarse denial code only.
   */
  function appendDenial({ capabilityId, agentId, code }) {
    return append({
      kind: capabilityId,
      phase: 'denial',
      sourceAgentId: agentId,
      code,
    })
  }

  return { appendIntent, appendOutcome, appendDenial }
}
