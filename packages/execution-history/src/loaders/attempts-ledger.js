/**
 * @agent-core/execution-history/src/loaders/attempts-ledger.js — the
 * workflow-execution attempts.jsonl loader (append-only evidence; R2/R3).
 * The ledger is authoritative for attempt facts; attemptId derivation stays
 * an optimization for generation 1 only (Spec R2).
 */

import { join } from 'node:path'
import { readJsonlFile } from './lines.js'

export function attemptsLedgerFile(workflowExecutionDir) {
  return join(workflowExecutionDir, 'attempts.jsonl')
}

function toRecord(row, line) {
  const refs = {}
  for (const key of ['attemptId', 'nodeVisitId', 'dispatchIntentId', 'workflowInstanceId', 'ownerPrincipalId', 'agentId', 'requestId', 'sessionId', 'messageId', 'reconciliationHandle']) {
    if (typeof row[key] === 'string' && row[key] !== '') refs[key] = row[key]
  }
  // Real producer rows carry atMs (ledger.js clock seam); ts kept for
  // forward-compat with any older/foreign writer.
  const atMs = Number.isFinite(row.atMs) ? row.atMs : Number.isFinite(row.ts) ? row.ts : null
  return {
    source: 'attempts_ledger',
    kind: `attempt_${row.kind ?? 'unknown'}`,
    provenanceClass: 'PRIMARY_PERSISTED',
    nativeSeq: atMs ?? undefined,
    atMs,
    nativeRefs: refs,
    dedupeKey: line.sha256,
    data: row,
  }
}

export function loadAttemptsLedger({ workflowExecutionDir, maxFileBytes }) {
  const file = attemptsLedgerFile(workflowExecutionDir)
  const read = readJsonlFile(file, { maxFileBytes })
  if (read.absent) {
    return { status: { status: 'ABSENT', reason: 'attempts ledger absent' }, records: [], files: [], rowsRead: 0 }
  }
  if (read.readFailed !== undefined) {
    return { status: { status: 'DEGRADED', reason: `attempts ledger unreadable: ${read.readFailed}`, truncated: true }, records: [], files: [], rowsRead: 0 }
  }
  const records = []
  for (let i = 0; i < read.lines.length; i += 1) {
    const row = read.parsed[i]
    if (typeof row?.kind !== 'string') { continue }
    records.push(toRecord(row, read.lines[i]))
  }
  records.sort((a, b) => (a.atMs ?? 0) - (b.atMs ?? 0))
  return {
    status: { status: 'OK', badLines: read.badLines, truncated: read.truncated },
    records,
    files: [{ file, size: read.size, mtimeMs: read.mtimeMs }],
    rowsRead: read.lines.length,
  }
}

/**
 * Project attempts per nodeVisit from raw events (the same identity model as
 * ledger-events.js applyLedgerEvent, read-only and lossy-tolerant).
 * T1 invariant: EVERY generation's events are preserved — a re-plan
 * (attempt_planned for an already-known visit, CTR-SRE-003) appends a new
 * generation entry and never discards the previous generation's evidence
 * (its run_delivered receipt is the R3/R1 join anchor).
 */
export function projectAttempts(records) {
  const byVisit = new Map()
  for (const rec of records) {
    const visitId = String(rec.data.nodeVisitId ?? '').toLowerCase()
    if (visitId === '') continue
    let proj = byVisit.get(visitId)
    if (proj === undefined) {
      proj = { nodeVisitId: visitId, dispatchIntentId: undefined, workflowInstanceId: undefined, ownerPrincipalId: undefined, attemptId: undefined, generation: 0, generations: [], events: [] }
      byVisit.set(visitId, proj)
    }
    proj.events.push(rec)
    if (rec.kind === 'attempt_attempt_planned') {
      const generation = Number.isInteger(rec.data.generation) ? rec.data.generation : proj.generation + 1
      proj.dispatchIntentId = rec.data.dispatchIntentId ?? proj.dispatchIntentId
      proj.workflowInstanceId = rec.data.workflowInstanceId ?? proj.workflowInstanceId
      proj.ownerPrincipalId = rec.data.ownerPrincipalId ?? proj.ownerPrincipalId
      proj.attemptId = rec.data.attemptId
      proj.generation = Math.max(proj.generation, generation)
      proj.generations.push({ attemptId: rec.data.attemptId, generation, events: [rec] })
    } else if (proj.generations.length > 0) {
      // Non-planned events attach to the newest open generation (the ledger
      // appends strictly per attempt lifecycle) AND stay in the flat list.
      proj.generations[proj.generations.length - 1].events.push(rec)
    }
  }
  return [...byVisit.values()]
}
