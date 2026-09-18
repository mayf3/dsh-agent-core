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
  return {
    source: 'attempts_ledger',
    kind: `attempt_${row.kind ?? 'unknown'}`,
    provenanceClass: 'PRIMARY_PERSISTED',
    nativeSeq: Number.isFinite(row.ts) ? row.ts : undefined,
    atMs: Number.isFinite(row.ts) ? row.ts : null,
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
 */
export function projectAttempts(records) {
  const byVisit = new Map()
  for (const rec of records) {
    const visitId = String(rec.data.nodeVisitId ?? '').toLowerCase()
    if (visitId === '') continue
    let proj = byVisit.get(visitId)
    if (rec.kind === 'attempt_attempt_planned') {
      const prev = proj
      proj = {
        nodeVisitId: visitId,
        attemptId: rec.data.attemptId,
        dispatchIntentId: rec.data.dispatchIntentId,
        workflowInstanceId: rec.data.workflowInstanceId,
        ownerPrincipalId: rec.data.ownerPrincipalId,
        generation: Number.isInteger(rec.data.generation) ? rec.data.generation : (prev?.generation != null ? prev.generation + 1 : 1),
        events: [],
      }
      byVisit.set(visitId, proj)
    }
    if (proj === undefined) { proj = { nodeVisitId: visitId, events: [] }; byVisit.set(visitId, proj) }
    proj.events.push(rec)
  }
  return [...byVisit.values()]
}
