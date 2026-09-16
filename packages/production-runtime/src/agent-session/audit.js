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
 *   sessionId / messageId (V2 proven-receipt outcomes only)
 *   reconciliationHandle (outcome only — internal evidence)
 *   startedAtWallMs / durationMs / ts
 *
 * Message text, credentials, token material, Session history and external
 * reply targets are structurally excluded: append* only persist the exact
 * fields they are given, and every caller above this module passes
 * identifiers and hashes only.
 *
 * Bounded: each fully serialized row is byte-counted before mutation. The
 * JSONL file rotates once (`.1`) before an append that would exceed the cap;
 * a failed rotation, oversized row, or append reports `append_failed` and
 * never leaves a successfully appended live generation above the cap.
 */

import { appendFileSync, closeSync, existsSync, fstatSync, openSync, readSync, renameSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { TextDecoder } from 'node:util'

/** Rotating cap for the JSONL evidence file (bytes). */
export const AUDIT_FILE_MAX_BYTES = 8 * 1024 * 1024
const AUDIT_RECORD_MAX_BYTES = 1024 * 1024
const AUDIT_MAX_RECORDS = 10_000
const UTF8 = new TextDecoder('utf-8', { fatal: true })

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

  function rotateIfNeeded(rowBytes) {
    if (!existsSync(auditFile)) return
    if (statSync(auditFile).size + rowBytes <= maxBytes) return
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
      const line = `${JSON.stringify({ ...entry, ts: now() })}\n`
      const rowBytes = Buffer.byteLength(line, 'utf8')
      if (!Number.isInteger(maxBytes) || maxBytes < 1 || rowBytes > maxBytes) return 'append_failed'
      rotateIfNeeded(rowBytes)
      // A failed rotation leaves the old live file in place. Re-check the
      // exact preimage so append success can never mean an over-cap file.
      if (existsSync(auditFile) && statSync(auditFile).size + rowBytes > maxBytes) return 'append_failed'
      appendFileSync(auditFile, line)
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
  function appendIntent({ sourceAgentId, targetAgentId, requestId, correlation, timeoutMode, invocationCorrelation }) {
    return append({
      kind: 'agent_session_send',
      phase: 'intent',
      sourceAgentId,
      targetAgentId,
      requestId,
      correlationHash: correlationHash(correlation),
      ...(invocationCorrelation === undefined ? {} : { invocationCorrelation }),
      timeoutMode,
      startedAtWallMs: now(),
    })
  }

  /**
   * L1 outcome row — appended after a real receipt or a definitive
   * pre-receipt failure. The V2 caller requires the first coordinate-bearing
   * receipt row before returning a normal success; later append degradation
   * is surfaced through the sanitized onAuditFailure signal.
   */
  function appendOutcome({ sourceAgentId, targetAgentId, requestId, correlation, timeoutMode, result, reconciliationHandle, startedAtWallMs, sessionId, messageId, invocationCorrelation, failureCode, failureReason, failureSource, exitReason }) {
    return append({
      kind: 'agent_session_send',
      phase: 'outcome',
      sourceAgentId,
      targetAgentId,
      requestId,
      correlationHash: correlationHash(correlation),
      ...(invocationCorrelation === undefined ? {} : { invocationCorrelation }),
      timeoutMode,
      result,
      ...(failureCode === undefined ? {} : { failureCode }),
      ...(failureReason === undefined ? {} : { failureReason }),
      ...(failureSource === undefined ? {} : { failureSource }),
      ...(exitReason === undefined ? {} : { exitReason }),
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(messageId === undefined ? {} : { messageId }),
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

  function readGeneration(path) {
    if (!existsSync(path)) return []
    const fd = openSync(path, 'r')
    try {
      const before = fstatSync(fd)
      if (!before.isFile() || before.size > maxBytes) throw new Error('audit generation exceeds bound')
      const buffer = Buffer.allocUnsafe(maxBytes + 1)
      let offset = 0
      while (offset < buffer.length) {
        const count = readSync(fd, buffer, offset, buffer.length - offset, null)
        if (count === 0) break
        offset += count
      }
      const after = fstatSync(fd)
      if (offset !== before.size || after.size !== before.size || offset > maxBytes) {
        throw new Error('audit generation changed during bounded read')
      }
      const text = UTF8.decode(buffer.subarray(0, offset))
      if (text !== '' && !text.endsWith('\n')) throw new Error('incomplete audit record')
      const lines = text === '' ? [] : text.slice(0, -1).split('\n')
      if (lines.length > AUDIT_MAX_RECORDS) throw new Error('audit record bound exceeded')
      return lines.map((line) => {
        if (Buffer.byteLength(line, 'utf8') > AUDIT_RECORD_MAX_BYTES) throw new Error('audit record too large')
        const row = JSON.parse(line)
        if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new Error('invalid audit row')
        return row
      })
    } finally {
      closeSync(fd)
    }
  }

  /** Bounded caller-bound lookup over exactly `.1` and live L1 evidence. */
  function findInvocation({ sourceAgentId, invocationCorrelation }) {
    let intent = null
    let outcome = null
    let oldestRetainedIntentTs = null
    try {
      for (const path of [`${auditFile}.1`, auditFile]) {
        for (const row of readGeneration(path)) {
          if (row.kind !== 'agent_session_send') continue
          if (row.phase === 'intent' && Number.isFinite(row.ts)) {
            oldestRetainedIntentTs = oldestRetainedIntentTs === null
              ? row.ts
              : Math.min(oldestRetainedIntentTs, row.ts)
          }
          if (row.sourceAgentId !== sourceAgentId || row.invocationCorrelation !== invocationCorrelation) continue
          if (row.phase === 'intent' && (intent === null || row.ts >= intent.ts)) intent = row
          if (row.phase === 'outcome' && (outcome === null || row.ts >= outcome.ts)) outcome = row
        }
      }
    } catch {
      return { available: false }
    }
    return {
      available: true,
      intentFound: intent !== null,
      oldestRetainedIntentTs,
      retentionIntegrity: 'clean',
      outcome: outcome === null ? null : {
        result: outcome.result,
        ...(outcome.failureCode === undefined ? {} : { failureCode: outcome.failureCode }),
        ...(outcome.failureReason === undefined ? {} : { failureReason: outcome.failureReason }),
        ...(outcome.targetAgentId === undefined ? {} : { targetAgentId: outcome.targetAgentId }),
        ...(outcome.sessionId === undefined ? {} : { sessionId: outcome.sessionId }),
        ...(outcome.messageId === undefined ? {} : { messageId: outcome.messageId }),
      },
    }
  }

  return { appendIntent, appendOutcome, appendDenial, findInvocation }
}
