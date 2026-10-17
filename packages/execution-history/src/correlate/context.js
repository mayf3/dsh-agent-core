/**
 * @agent-core/execution-history/src/correlate/context.js — shared query
 * context: lazy source loading + journal cache + small join helpers used by
 * the four root builders. All loads are bounded and fail-soft per source.
 */

import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

import { loadAsmAudit } from '../loaders/asm-audit.js'
import { loadAttemptsLedger, projectAttempts } from '../loaders/attempts-ledger.js'
import { loadSchedulerHistory } from '../loaders/scheduler-history.js'
import { loadSchedulerStore, findJob, occurrencesOf, jobRoutingAgent } from '../loaders/scheduler-store.js'
import { loadRuntimeEvidence } from '../loaders/runtime-evidence.js'
import { resolveSessionFile, loadSessionJournal, projectJournal } from '../loaders/session-journal.js'
import { ensureFreshSessionIndex, indexLookups } from '../session-index.js'

export const DEFAULT_CAPS = Object.freeze({
  maxAuditFileBytes: 64 * 1024 * 1024,
  maxLedgerFileBytes: 64 * 1024 * 1024,
  maxHistoryFileBytes: 64 * 1024 * 1024,
  maxEvidenceFileBytes: 64 * 1024 * 1024,
  maxJournalFileBytes: 8 * 1024 * 1024,
  maxJournalRecords: 10_000,
  maxSessionsPerQuery: 12,
  briefMaxChars: 400,
})

/**
 * @param {object} opts
 * @param {object} opts.paths - {homesRoot, controlDir, historyDir, jobsStore, workflowExecutionDir, evidenceLog, turnRecoveryStore}
 * @param {object} [opts.caps]
 * @param {{agentId: string, audit: boolean}} opts.viewer
 * @param {(agentId: string, req: {method, path, query?}) => Promise<{ok:true, body:object}|{ok:false, code:string, detail?:string}>} [opts.svcRequest]
 */
export function createQueryContext({ paths, caps, viewer, svcRequest }) {
  const effectiveCaps = { ...DEFAULT_CAPS, ...(caps ?? {}) }
  const ctx = {
    paths,
    caps: effectiveCaps,
    viewer,
    svcRequest: svcRequest ?? null,
    _sources: new Map(),
    _journals: new Map(),
    index: null,
    lookups: null,
  }

  ctx.source = (name) => {
    if (ctx._sources.has(name)) return ctx._sources.get(name)
    let loaded
    switch (name) {
      case 'asm_audit':
        loaded = loadAsmAudit({ auditFile: join(paths.controlDir, 'agent-session-messaging-audit.jsonl'), maxFileBytes: effectiveCaps.maxAuditFileBytes })
        break
      case 'attempts_ledger':
        loaded = loadAttemptsLedger({ workflowExecutionDir: paths.workflowExecutionDir, maxFileBytes: effectiveCaps.maxLedgerFileBytes })
        break
      case 'scheduler_history':
        loaded = loadSchedulerHistory({ historyDir: paths.historyDir, maxFileBytes: effectiveCaps.maxHistoryFileBytes })
        break
      case 'scheduler_store':
        loaded = loadSchedulerStore({ jobsStore: paths.jobsStore })
        break
      case 'runtime_evidence':
        loaded = loadRuntimeEvidence({ evidenceLog: paths.evidenceLog, maxFileBytes: effectiveCaps.maxEvidenceFileBytes })
        break
      default:
        throw new Error(`unknown source ${name}`)
    }
    ctx._sources.set(name, loaded)
    return loaded
  }

  ctx.ensureIndex = () => {
    if (ctx.index === null) {
      const indexDir = join(paths.controlDir, 'execution-history-index')
      const fresh = ensureFreshSessionIndex({ homesRoot: paths.homesRoot, indexDir, maxScanBytes: effectiveCaps.maxJournalFileBytes * 4 })
      ctx.index = fresh.entries
      ctx.indexCoverage = fresh.coverage
      ctx.indexRebuilt = fresh.rebuilt
      ctx.lookups = indexLookups(fresh.entries)
    }
    return ctx.lookups
  }

  /** Load + project one journal (cached). Returns null when unresolvable. */
  ctx.journal = (agentId, sessionId) => {
    const cacheKey = `${agentId}::${sessionId}`
    if (ctx._journals.has(cacheKey)) return ctx._journals.get(cacheKey)
    const found = resolveSessionFile(paths.homesRoot, agentId, sessionId)
    let result = null
    if (found !== null) {
      const raw = loadSessionJournal({ file: found.file, maxFileBytes: effectiveCaps.maxJournalFileBytes, maxRecords: effectiveCaps.maxJournalRecords })
      const projected = projectJournal(raw.events, { briefMaxChars: effectiveCaps.briefMaxChars })
      result = { ...found, raw, projected }
    }
    ctx._journals.set(cacheKey, result)
    return result
  }

  /** Sessions of one agent that mention a coordinate (via the index). */
  ctx.sessionsMatching = (finder) => {
    const lookups = ctx.ensureIndex()
    return (finder(lookups) ?? []).slice(0, effectiveCaps.maxSessionsPerQuery)
  }

  ctx.attemptProjections = () => {
    if (ctx._attemptProjections === undefined) {
      ctx._attemptProjections = projectAttempts(ctx.source('attempts_ledger').records)
    }
    return ctx._attemptProjections
  }

  ctx.asmRowsByMessage = () => {
    if (ctx._asmByMessage === undefined) {
      const map = new Map()
      for (const rec of ctx.source('asm_audit').records) {
        const id = rec.nativeRefs.messageId
        if (id !== undefined) {
          if (!map.has(id)) map.set(id, [])
          map.get(id).push(rec)
        }
      }
      ctx._asmByMessage = map
    }
    return ctx._asmByMessage
  }

  ctx.turnRecoveryHits = (needle) => {
    const store = paths.turnRecoveryStore ?? join(paths.controlDir, 'turn-recovery-v3.json')
    if (!existsSync(store)) return { absent: true, hits: [] }
    try {
      const parsed = JSON.parse(readFileSync(store, 'utf8'))
      const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : []
      const text = needle
      const hits = rows.filter((row) => row?.reconciliationHandle === text || row?.turnExecutionId === text)
      return { absent: false, hits }
    } catch {
      return { absent: false, hits: [], corrupt: true }
    }
  }

  ctx.schedulerHelpers = { findJob, occurrencesOf, jobRoutingAgent }
  return ctx
}

/** Standard gap entry. */
export function gap(code, stage, extra = {}) {
  return { code, stage, ...extra }
}

/** Standard correlation entry (R1..R9). */
export function correlation(rule, from, to, evidenceRefs = []) {
  return { rule, from, to, evidenceRefs }
}

/** Timeline entry from a SourceRecord. */
export function timelineEntry(rec, briefFn) {
  return {
    source: rec.source,
    kind: rec.kind,
    atMs: rec.atMs,
    nativeSeq: rec.nativeSeq,
    provenanceClass: rec.provenanceClass,
    nativeRefs: rec.nativeRefs,
    brief: briefFn ? briefFn(rec) : undefined,
    dedupeKey: rec.dedupeKey,
  }
}
