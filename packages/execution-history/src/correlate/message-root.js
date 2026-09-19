/**
 * @agent-core/execution-history/src/correlate/message-root.js — root=message
 * (Spec §4.1, R6/R9): reverse location from native messageId,
 * reconciliationHandle or requestId across session journals (index), the ASM
 * audit, the attempts ledger and turn-recovery-v3.json (PRIMARY_PERSISTED
 * with coverage-write/unlink/missing-caller-fields caveats, F1).
 */

import { observation, classifySendOutcome, VERDICTS } from '../rules.js'
import { gap, correlation } from './context.js'
import { projectForViewer } from '../redact.js'

export async function buildMessageRoot(ctx, args) {
  const records = []
  const correlations = []
  const gaps = []
  const observations = []

  const needle = args.messageId ?? args.reconciliationHandle ?? args.requestId
  const needleKind = args.messageId !== undefined ? 'messageId' : args.reconciliationHandle !== undefined ? 'reconciliationHandle' : 'requestId'

  // 1) ASM audit rows (caller side of any send).
  const asm = ctx.source('asm_audit')
  const asmHits = asm.records.filter((r) => r.nativeRefs[needleKind] === needle
    || (needleKind === 'messageId' && r.nativeRefs.messageId === needle))
  for (const row of asmHits) {
    records.push(row)
    const obs = classifySendOutcome(row)
    if (obs !== null) observations.push(obs)
  }
  if (asmHits.length === 0) {
    // §三 gap taxonomy — each cause speaks for itself, none over-claims:
    //   DEGRADED  = read/permission failure in this boundary;
    //   ABSENT    = source not present/readable here (never "didn't happen",
    //               never "proven lost");
    //   RETENTION_LOSS_PRE_V1 = STRUCTURALLY proven loss only: rotations are
    //               visible (live + .1 both readable) while no WPA-1 archive
    //               exists — generations older than the retained .1 were
    //               discarded by the pre-amendment rotation;
    //   otherwise = plain correlation gap (outside window / not a send).
    const auditStatus = asm.status?.status
    const labels = (asm.files ?? []).map((f) => f.label)
    const rotationsVisible = labels.includes('live') && labels.includes('.1')
    if (auditStatus === 'DEGRADED') {
      gaps.push(gap('SOURCE_DEGRADED', 'asm_audit', { reason: `send-audit source unreadable in this boundary (${asm.status?.reason ?? 'degraded'}) — caller-side rows neither confirmed nor disproven` }))
    } else if (auditStatus === 'ABSENT') {
      gaps.push(gap('SOURCE_ABSENT', 'asm_audit', { reason: 'send-audit source not present/readable in this boundary — caller-side rows neither confirmed nor disproven' }))
    } else if (!asm.archivePresent && rotationsVisible) {
      gaps.push({ code: 'RETENTION_LOSS_PRE_V1', stage: 'asm_audit', reason: `no send-audit row matches ${needleKind}=${needle}; rotations are visible (live + .1) but no WPA-1 archive exists — generations older than the retained .1 were discarded by the pre-amendment rotation` })
    } else {
      gaps.push(gap('CORRELATION_GAP', 'asm_audit', { reason: `no send-audit row matches ${needleKind}=${needle} (outside live/.1/archive window, or not a send coordinate)` }))
    }
  }

  // 2) Attempts ledger (workflow dispatch side).
  for (const proj of ctx.attemptProjections()) {
    const hit = proj.events.find((e) => e.nativeRefs?.[needleKind] === needle || e.nativeRefs?.requestId === needle)
    if (hit === undefined) continue
    records.push(...proj.events.map((rec) => ({ ...rec, dedupeKey: `att:${proj.nodeVisitId}:${rec.dedupeKey}` })))
    correlations.push(correlation('R6', { source: needleKind === 'messageId' ? 'asm_audit' : 'turn_recovery', nativeRef: String(needle) }, { source: 'attempts_ledger', nativeRef: proj.attemptId }, [proj.attemptId]))
    if (proj.workflowInstanceId) {
      correlations.push(correlation('R4', { source: 'attempts_ledger', nativeRef: proj.attemptId }, { source: 'svc_timeline', nativeRef: `workflowInstance:${String(proj.workflowInstanceId).toLowerCase()}` }, [String(proj.workflowInstanceId).toLowerCase()]))
    }
    observations.push(observation('agentExecution', hit.kind === 'attempt_run_delivered' ? VERDICTS.ACCEPTED : VERDICTS.OUTCOME_UNKNOWN, { ruleId: 'R6', evidenceRefs: [proj.attemptId] }))
  }

  // 3) Session journals via the index (target side).
  const lookups = ctx.ensureIndex()
  let candidates = []
  if (needleKind === 'messageId') {
    candidates = lookups.byMessageId(needle)
  } else {
    // Handle-shaped needles: ASM rows name the target session; the source
    // turnExecutionId (ASM V2 correlation, R1) is ALSO a direct journal
    // coordinate via the inserted[] sidecar index — this is what makes the
    // reverse lookup work even when the caller-side audit rows are outside
    // the readable boundary.
    const sessionIds = new Set(asmHits.map((row) => row.nativeRefs.sessionId).filter(Boolean))
    candidates = [...sessionIds].flatMap((sessionId) => lookups.bySessionId(sessionId))
    if (candidates.length === 0) candidates = lookups.byCorrelation(String(needle))
  }
  let matchedSidecar = false
  for (const entry of uniqueByFile(candidates).slice(0, ctx.caps.maxSessionsPerQuery)) {
    const loaded = ctx.journal(entry.agentId, entry.sessionId)
    if (loaded === null) continue
    const view = projectForViewer({ sessionAgentId: entry.agentId, viewerAgentId: ctx.viewer.agentId, audit: ctx.viewer.audit === true, journal: loaded.projected })
    records.push({
      source: 'session_journal', kind: 'session_view', provenanceClass: 'PRIMARY_PERSISTED',
      atMs: loaded.raw.events[0]?.timeMs ?? null, nativeRefs: { agentId: entry.agentId, sessionId: entry.sessionId, file: entry.file },
      dedupeKey: `journal:${entry.file}`, data: view,
    })
    const splicedHit = loaded.projected.spliced.find((s) => s.messageId === needle)
    if (splicedHit !== undefined) {
      // R6 from-side honesty: 'asm_audit' only when a caller-side audit row
      // was actually observed; otherwise the needle itself is the coordinate.
      const asmObserved = asmHits.length > 0
      correlations.push({
        rule: 'R6',
        from: { source: asmObserved ? 'asm_audit' : 'query', nativeRef: String(needle) },
        to: { source: 'session_journal', nativeRef: `${entry.agentId}/${entry.sessionId}#${splicedHit.seq}` },
        evidenceRefs: [String(needle)],
        ...(asmObserved ? {} : { strength: 'SIDECAR_PROVENANCE_ONLY' }),
      })
      // The turn that consumed this message (next user message + turn/start).
      const start = view.turns?.find((t) => t.startSeq > splicedHit.seq)
      observations.push(observation('agentExecution', start !== undefined ? VERDICTS.STARTED : VERDICTS.UNKNOWN, { ruleId: 'R6', evidenceRefs: [`${entry.agentId}/${entry.sessionId}`], note: start !== undefined ? `consumed at turn starting seq=${start.startSeq}` : 'message spliced but no subsequent turn observed' }))
    }
    // R1 reverse join: ASM requestId rows ↔ the exact target message. A row
    // here was OBSERVED — asm_audit provenance is honest for this arm.
    for (const row of asmHits) {
      const rowMessageId = row.nativeRefs.messageId
      if (rowMessageId === undefined) continue
      const anchor = loaded.projected.spliced.find((s) => s.messageId === rowMessageId)
        ?? loaded.projected.messages.find((m) => m.messageId === rowMessageId)
      if (anchor !== undefined) {
        correlations.push(correlation('R1', { source: 'asm_audit', nativeRef: row.nativeRefs.requestId ?? rowMessageId }, { source: 'session_journal', nativeRef: `${entry.agentId}/${entry.sessionId}#${rowMessageId}` }, [rowMessageId]))
      }
    }
    // Sidecar-provenance arm: the RECEIVE-side journal record itself carries
    // the parent-turn correlation. That proves the message ↔ parent-turn
    // linkage — it does NOT identify the specific caller send invocation, so
    // the evidence source is THIS session record (never a synthesized ASM
    // row) and the precise-caller gap stays open.
    for (const msg of view.messages ?? []) {
      const correlation = msg.source?.correlation ?? msg.correlation
      if (correlation !== needle) continue
      correlations.push({
        rule: 'R1',
        from: { source: 'session_journal', nativeRef: `${entry.agentId}/${entry.sessionId}#${msg.seq} (inserted source sidecar)` },
        to: { source: 'query', nativeRef: String(needle) },
        evidenceRefs: [String(needle)],
        strength: 'SIDECAR_PROVENANCE_ONLY',
      })
      matchedSidecar = true
    }
  }
  if (matchedSidecar && asmHits.length === 0) {
    gaps.push(gap('CORRELATION_GAP', 'caller_send_invocation', { reason: `parent-turn correlation ${needle} anchors the receive side only; no caller-side send invocation row was observed in the readable boundary — the precise dispatch call is unproven (kept open, not synthesized)` }))
  }

  // 4) turn-recovery durable records (handle-shaped needles only).
  if (needleKind !== 'messageId') {
    const recovery = ctx.turnRecoveryHits(String(needle))
    if (recovery.corrupt === true) gaps.push(gap('SOURCE_DEGRADED', 'turn_recovery', { reason: 'turn-recovery store unreadable' }))
    for (const hit of recovery.hits) {
      records.push({
        source: 'turn_recovery', kind: 'turn_recovery_record', provenanceClass: 'PRIMARY_PERSISTED',
        atMs: Number.isFinite(hit.settledAtMs ?? hit.startedAtMs) ? (hit.settledAtMs ?? hit.startedAtMs) : null,
        nativeRefs: { reconciliationHandle: hit.reconciliationHandle ?? hit.turnExecutionId, sessionId: hit.sessionId },
        dedupeKey: `recovery:${hit.reconciliationHandle ?? hit.turnExecutionId}`,
        data: { ...hit, caveats: ['coverage-write', 'post-settlement unlink', 'missing callerCorrelation/messageId fields (F1)'] },
      })
      correlations.push(correlation('R6', { source: 'turn_recovery', nativeRef: String(hit.reconciliationHandle ?? hit.turnExecutionId) }, { source: 'session_journal', nativeRef: `${hit.sessionId ?? '?'}` }, [String(hit.reconciliationHandle ?? hit.turnExecutionId)]))
    }
    if (recovery.absent !== true && recovery.hits.length === 0 && recovery.corrupt !== true && records.length === 0) {
      gaps.push(gap('CORRELATION_GAP', 'turn_recovery', { reason: 'no durable recovery record for this handle (settled+unlinked, or pre-V3 epoch)' }))
    }
  }

  if (records.length === 0) {
    return { notFound: { code: 'message_not_found', detail: `${needleKind}=${needle}` }, records, correlations, gaps, observations }
  }
  return { records, correlations, gaps, observations }
}

function uniqueByFile(entries) {
  const seen = new Set()
  const out = []
  for (const entry of entries) {
    if (entry === null || entry === undefined || seen.has(entry.file)) continue
    seen.add(entry.file)
    out.push(entry)
  }
  return out
}
