/**
 * @agent-core/execution-history/src/loaders/asm-audit.js — ASM L1 send-audit
 * loader (live + .1 + WPA-1 archive), whole-line-hash deduped (Spec §6.3).
 * `agent_session_send_reconcile` keeps its own live+.1 window (unchanged);
 * this reader is for history queries only.
 */

import { join } from 'node:path'
import { readJsonlFile, mergeStatus } from './lines.js'

/** Same derivation as auditArchivePaths() in production-runtime (kept local to avoid a cross-package import). */
export function auditArchivePaths(auditFile) {
  const base = String(auditFile).replace(/\.jsonl$/, '')
  return { archiveFile: `${base}-archive.jsonl`, posFile: `${base}-archive.pos` }
}

function toRecord(row, line) {
  const refs = {}
  for (const key of ['requestId', 'messageId', 'reconciliationHandle', 'invocationCorrelation', 'sourceAgentId', 'targetAgentId', 'sessionId']) {
    if (typeof row[key] === 'string' && row[key] !== '') refs[key] = row[key]
  }
  return {
    source: 'asm_audit',
    kind: `send_${row.phase ?? 'unknown'}`,
    provenanceClass: 'PRIMARY_PERSISTED',
    nativeSeq: row.ts,
    atMs: Number.isFinite(row.ts) ? row.ts : null,
    nativeRefs: refs,
    dedupeKey: line.sha256,
    data: row,
  }
}

/**
 * @param {object} opts
 * @param {string} opts.auditFile - absolute path of the live audit JSONL.
 * @param {number} [opts.maxFileBytes] - per-generation cap (archive streams via caps too).
 */
export function loadAsmAudit({ auditFile, maxFileBytes }) {
  const { archiveFile } = auditArchivePaths(auditFile)
  const generations = [
    { file: archiveFile, label: 'archive' },
    { file: `${auditFile}.1`, label: '.1' },
    { file: auditFile, label: 'live' },
  ]
  const records = []
  const files = []
  const statuses = []
  const seen = new Set()
  let rowsRead = 0
  for (const gen of generations) {
    const read = readJsonlFile(gen.file, { maxFileBytes })
    if (read.absent) { statuses.push({ status: 'ABSENT', reason: `${gen.label} absent` }); continue }
    if (read.readFailed !== undefined) {
      statuses.push({ status: 'DEGRADED', reason: `${gen.label} unreadable: ${read.readFailed}`, truncated: true })
      continue
    }
    files.push({ file: gen.file, size: read.size, mtimeMs: read.mtimeMs, label: gen.label })
    statuses.push({ status: 'OK', badLines: read.badLines, truncated: read.truncated })
    for (let i = 0; i < read.lines.length; i += 1) {
      rowsRead += 1
      if (seen.has(read.lines[i].sha256)) continue
      seen.add(read.lines[i].sha256)
      const row = read.parsed[i]
      if (row.kind === 'agent_session_send' || row.phase === 'denial') records.push(toRecord(row, read.lines[i]))
    }
  }
  records.sort((a, b) => (a.atMs ?? 0) - (b.atMs ?? 0))
  return { status: mergeStatus(statuses), records, files, rowsRead, archivePresent: files.some((f) => f.label === 'archive') }
}
