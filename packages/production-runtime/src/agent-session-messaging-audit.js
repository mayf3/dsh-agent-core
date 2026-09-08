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

import { appendFileSync, existsSync, readFileSync, renameSync, statSync } from 'node:fs'
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
   * caller abort with zero Router deliveries. `invocationCorrelation`
   * (AMENDMENT_1 §5.2/§5.3) is the opaque child-minted logical-send anchor,
   * persisted verbatim when the trusted boundary carried one.
   */
  function appendIntent({ sourceAgentId, targetAgentId, requestId, correlation, timeoutMode, invocationCorrelation }) {
    return append({
      kind: 'agent_session_send',
      phase: 'intent',
      sourceAgentId,
      targetAgentId,
      requestId,
      correlationHash: correlationHash(correlation),
      ...(typeof invocationCorrelation === 'string' && invocationCorrelation.length > 0
        ? { invocationCorrelation }
        : {}),
      timeoutMode,
      startedAtWallMs: now(),
    })
  }

  /**
   * L1 outcome row — appended after a real receipt or a definitive
   * pre-receipt failure. An append failure NEVER rewrites the proven
   * business result; the caller surfaces the sanitized onAuditFailure
   * signal instead. `failureCode`/`failureReason` (AMENDMENT_1 §5.2) keep
   * the structured failure class — today's bare `result:'failed'` bundles
   * all reply-side failures and no persisted surface records the reason.
   */
  function appendOutcome({ sourceAgentId, targetAgentId, requestId, correlation, timeoutMode, result, reconciliationHandle, startedAtWallMs, invocationCorrelation, failureCode, failureReason }) {
    return append({
      kind: 'agent_session_send',
      phase: 'outcome',
      sourceAgentId,
      targetAgentId,
      requestId,
      correlationHash: correlationHash(correlation),
      ...(typeof invocationCorrelation === 'string' && invocationCorrelation.length > 0
        ? { invocationCorrelation }
        : {}),
      timeoutMode,
      result,
      ...(typeof failureCode === 'string' && failureCode.length > 0 ? { failureCode } : {}),
      ...(typeof failureReason === 'string' && failureReason.length > 0 ? { failureReason } : {}),
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

  /**
   * AMENDMENT_1 §5.3 — bounded read-only lookup of ONE logical send's L1
   * rows by the gateway-caller-bound correlation anchor. Reads the LIVE file
   * and the one-deep `.1` rotation (the file-backed chain SURVIVES control-
   * plane restarts; rotation is the only evidence loss). Bounded: both files
   * are byte-capped (AUDIT_FILE_MAX_BYTES) and parsed line-by-line; corrupt
   * lines are skipped. `oldestRetainedIntentTs` is the coverage anchor for
   * the NOT_DELIVERED decision (§5.3: absence converts NOT_DELIVERED only
   * when the retained window provably covers the invocation; a rotation-
   * expired anchor resolves UNKNOWN — never the duplicate-licensing
   * direction).
   *
   * @returns {{intentFound:boolean, outcome:object|null, oldestRetainedIntentTs:number|null}}
   */
  function findInvocation({ sourceAgentId, invocationCorrelation }) {
    const files = [auditFile, `${auditFile}.1`]
    let intent = null
    let outcome = null
    let oldestRetainedIntentTs = null
    let retentionIntegrity = 'clean'
    for (const file of files) {
      let text = ''
      try {
        text = readFileSync(file, 'utf8')
      } catch {
        continue // absent (or unreadable) rotation file — retained window is what it is
      }
      for (const line of text.split('\n')) {
        if (line === '') continue
        let row
        try {
          row = JSON.parse(line)
        } catch {
          // Corrupt retained evidence weakens the "provable retention
          // coverage" bar (§5.3): a skipped line could be THIS invocation's
          // intent row, so absence must never license NOT_DELIVERED. Report
          // the degradation; the relay resolves UNKNOWN instead.
          retentionIntegrity = 'corrupt'
          continue
        }
        if (row?.kind !== 'agent_session_send') continue
        if (row.phase === 'intent' && typeof row.ts === 'number') {
          oldestRetainedIntentTs = oldestRetainedIntentTs === null ? row.ts : Math.min(oldestRetainedIntentTs, row.ts)
        }
        if (row.sourceAgentId !== sourceAgentId || row.invocationCorrelation !== invocationCorrelation) continue
        if (row.phase === 'intent' && (intent === null || row.ts >= intent.ts)) intent = row
        if (row.phase === 'outcome' && (outcome === null || row.ts >= outcome.ts)) outcome = row
      }
    }
    return {
      intentFound: intent !== null,
      outcome: outcome === null
        ? null
        : {
            result: outcome.result,
            ...(outcome.failureCode === undefined ? {} : { failureCode: outcome.failureCode }),
            ...(outcome.failureReason === undefined ? {} : { failureReason: outcome.failureReason }),
          },
      oldestRetainedIntentTs,
      retentionIntegrity,
    }
  }

  return { appendIntent, appendOutcome, appendDenial, findInvocation }
}
