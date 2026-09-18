/**
 * @agent-core/execution-history/src/loaders/runtime-evidence.js — the
 * control/runtime-evidence.jsonl loader (scheduler invoker `invocation` rows
 * carrying sessionId/reconciliationHandle; also surfaces WPA-1 archive
 * failure markers as evidence-integrity facts).
 */

import { readJsonlFile } from './lines.js'

function toRecord(row, line) {
  const refs = {}
  for (const key of ['sessionId', 'reconciliationHandle', 'requestId', 'occurrenceId', 'jobId']) {
    if (typeof row[key] === 'string' && row[key] !== '') refs[key] = row[key]
  }
  return {
    source: 'runtime_evidence',
    kind: `evidence_${row.kind ?? 'unknown'}`,
    provenanceClass: 'PRIMARY_PERSISTED',
    atMs: Number.isFinite(row.ts) ? row.ts : null,
    nativeRefs: refs,
    dedupeKey: line.sha256,
    data: row,
  }
}

export function loadRuntimeEvidence({ evidenceLog, maxFileBytes }) {
  const read = readJsonlFile(evidenceLog, { maxFileBytes })
  if (read.absent) {
    return { status: { status: 'ABSENT', reason: 'runtime evidence absent' }, records: [], files: [], rowsRead: 0 }
  }
  const records = []
  for (let i = 0; i < read.lines.length; i += 1) {
    records.push(toRecord(read.parsed[i], read.lines[i]))
  }
  records.sort((a, b) => (a.atMs ?? 0) - (b.atMs ?? 0))
  return {
    status: { status: 'OK', badLines: read.badLines, truncated: read.truncated },
    records,
    files: [{ file: evidenceLog, size: read.size, mtimeMs: read.mtimeMs }],
    rowsRead: read.lines.length,
  }
}
