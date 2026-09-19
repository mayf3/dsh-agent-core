#!/usr/bin/env node
/**
 * EXECUTION_HISTORY_QUERY_V1 — Phase A real-sample acceptance runner (§9 A1-A4).
 *
 * STRICTLY READ-ONLY on production data: reads the world-readable session
 * corpus under /Users/authsvc/.agent-core/homes; ALL writes go to a temp
 * control dir (index + outputs). authsvc-only stores (ASM audit, attempts
 * ledger, scheduler store/history, runtime evidence) are intentionally
 * pointed at an EMPTY temp dir — they surface as SOURCE_ABSENT/DEGRADED,
 * which is exactly the honest access-boundary behavior the Spec §2/§5 freeze.
 * The artifact summary carries COORDINATES ONLY (no message text).
 *
 * Usage: node phase-a-run.mjs --homes <homesRoot> --out <outDir>
 */
import { mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { queryExecutionTrace } from '../../../packages/execution-history/src/index.js'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : fallback
}
const homesRoot = arg('homes', '/Users/authsvc/.agent-core/homes')
const outDir = arg('out', join(tmpdir(), `ehq-phase-a-${Date.now()}`))
const workControl = join(tmpdir(), `ehq-phase-a-control-${process.pid}`)
mkdirSync(join(workControl, 'execution-history-index'), { recursive: true })
mkdirSync(outDir, { recursive: true })

const paths = {
  homesRoot,
  controlDir: workControl,
  historyDir: join(workControl, 'history-absent'),
  jobsStore: join(workControl, 'jobs-absent.json'),
  workflowExecutionDir: join(workControl, 'wfexec-absent'),
  evidenceLog: join(workControl, 'evidence-absent.jsonl'),
  turnRecoveryStore: join(workControl, 'turn-recovery-absent.json'),
}
const VIEWER = { agentId: 'agt_operator_phase_a', audit: true }
const t0 = Date.now()

// Locate real samples inside the corpus (read-only, coordinate greps).
function firstFileMatching(agent, predicate) {
  const root = join(homesRoot, agent, 'sessions')
  let projects = []
  try { projects = readdirSync(root, { withFileTypes: true }) } catch { return null }
  for (const p of projects) {
    if (!p.isDirectory()) continue
    let sessions = []
    try { sessions = readdirSync(join(root, p.name), { withFileTypes: true }) } catch { continue }
    for (const s of sessions) {
      if (!s.isDirectory()) continue
      const file = join(root, p.name, s.name, 'session.jsonl')
      try {
        const text = readSlice(file, 4 * 1024 * 1024)
        if (predicate(text)) return { agentId: agent, sessionId: s.name, file }
      } catch { /* skip */ }
    }
  }
  return null
}
import { openSync, readSync, closeSync, existsSync } from 'node:fs'
function readSlice(file, maxBytes) {
  if (!existsSync(file)) return ''
  const fd = openSync(file, 'r')
  try {
    const buffer = Buffer.allocUnsafe(Math.min(statSync(file).size, maxBytes))
    const n = readSync(fd, buffer, 0, buffer.length, 0)
    return buffer.subarray(0, n).toString('utf8')
  } finally { closeSync(fd) }
}

const a2a = firstFileMatching('agt_product-manager', (t) => t.includes('"kind":"inter_agent"'))
const wfSample = firstFileMatching('agt_cto-agent', (t) => t.includes('workflowInstanceId'))
// Tool args/results pass through as ESCAPED-JSON strings in real journals
// (\"workflowInstanceId\":\"<uuid>\") — match the escaped form, fall back to
// the plain form.
function extractInstanceUuid(text) {
  const escaped = /\\\"workflowInstanceId\\\":\\\"([0-9a-f-]{36})\\\"/.exec(text)
  if (escaped !== null) return escaped[1]
  const plain = /\"workflowInstanceId\":\"([0-9a-f-]{36})\"/.exec(text)
  return plain !== null ? plain[1] : null
}
const wfUuid = wfSample === null ? null : extractInstanceUuid(readSlice(wfSample.file, 8 * 1024 * 1024))

// Extract one real A2A correlation coordinate (source turnExecutionId sidecar).
function extractCorrelation(text) {
  const m = /\"correlation\":\"(turn:[^\"]{1,160})\"/.exec(text)
  return m !== null ? m[1] : null
}
const a2aCorrelation = a2a === null ? null : extractCorrelation(readSlice(a2a.file, 8 * 1024 * 1024))

function summarize(result) {
  const sidecars = []
  for (const entry of result.timeline) {
    if (entry.source !== 'session_journal' || entry.data === undefined) continue
    for (const m of entry.data.messages ?? []) {
      const kind = m.source?.kind ?? m.sourceKind
      if (kind === undefined || kind === null) continue
      sidecars.push({ seq: m.seq, kind, sourceAgentId: m.source?.sourceAgentId ?? m.sourceAgentId ?? null, correlation: m.source?.correlation ?? m.correlation ?? null, workflowInstanceId: m.source?.workflowInstanceId ?? m.workflowInstanceId ?? null })
    }
  }
  return {
    reportId: result.reportId,
    asOfUtc: result.readBoundary.asOfUtc,
    fiveDimensions: result.summary.fiveDimensions,
    sources: result.readBoundary.sources.map((s) => ({ name: s.name, status: s.status, reason: s.reason ?? null })),
    timelineCount: result.timeline.length,
    timelineKinds: [...new Set(result.timeline.map((e) => `${e.source}/${e.kind}`))],
    correlations: result.correlations,
    gaps: result.gaps,
    // Coordinates only — native refs and provenance sidecars, never content.
    sampleRefs: result.timeline.slice(0, 8).map((e) => ({ source: e.source, kind: e.kind, nativeRefs: e.nativeRefs, atUtc: e.atUtc, provenanceClass: e.provenanceClass })),
    sidecarCoordinates: sidecars.slice(0, 10),
  }
}
async function run(label, root, args) {
  const outcome = await queryExecutionTrace({ root, args, viewer: VIEWER, paths })
  const record = { chain: label, root, args, ok: outcome.ok, ...(outcome.ok ? { result: summarize(outcome.result) } : { code: outcome.code, detail: outcome.detail }) }
  writeFileSync(join(outDir, `${label}.json`), JSON.stringify(record, null, 2) + '\n')
  return record
}

const chains = []
// A1 — real workflow instance coordinate, selected via THE PRODUCT'S OWN
// session index path (same builder the broker tool uses at query time).
let indexStats = null
{
  const { buildSessionIndex, indexLookups: lookupsFn } = await import('../../../packages/execution-history/src/session-index.js')
  const tIdx = Date.now()
  const built = buildSessionIndex({ homesRoot, indexDir: join(workControl, 'execution-history-index'), maxScanBytes: 2 * 1024 * 1024 })
  indexStats = { ...built.coverage, buildMs: Date.now() - tIdx, withWorkflowCoordinates: built.entries.filter((e) => e.coordinates.workflowInstanceIds.length > 0).length, withInterAgent: built.entries.filter((e) => e.coordinates.hasInterAgent).length }
  const wfEntry = built.entries.find((e) => e.coordinates.workflowInstanceIds.length > 0)
  const wfUuid = wfEntry?.coordinates.workflowInstanceIds[0]
  if (wfUuid !== undefined) chains.push(await run('A1_workflow_instance', 'workflow_instance', { workflowInstanceId: wfUuid }))
  else chains.push({ chain: 'A1_workflow_instance', skipped: 'no indexed workflow coordinate' })
}
// A2 — real scheduler occurrence (from the agt_hr-agent cron-run session dir).
{
  let occ = null
  const hrRoot = join(homesRoot, 'agt_hr-agent', 'sessions')
  try {
    outer: for (const p of readdirSync(hrRoot, { withFileTypes: true })) {
      if (!p.isDirectory()) continue
      for (const s of readdirSync(join(hrRoot, p.name), { withFileTypes: true })) {
        if (!s.isDirectory()) continue
        const m = /^cron-run-occ~(.+)$/.exec(s.name)
        if (m !== null) { occ = `occ:${m[1]}`; break outer }
      }
    }
  } catch { /* no hr sessions */ }
  if (occ !== null) chains.push(await run('A2_scheduler_occurrence', 'scheduler_run', { occurrenceId: occ }))
  else chains.push({ chain: 'A2_scheduler_occurrence', skipped: 'no cron-run session found' })
}
// A3 — real inter_agent receive side (source sidecar coordinate visible in
// the target journal; caller-side ASM rows are authsvc-only offline).
if (a2a !== null) {
  chains.push(await run('A3_a2a_receive_side', 'agent_session', { agentId: a2a.agentId, sessionId: a2a.sessionId }))
} else {
  chains.push({ chain: 'A3_a2a_receive_side', skipped: 'no inter_agent sample found' })
}
// A4 — an independent (non-workflow) session: prefer the literal main.
{
  let stock = null
  const stockRoot = join(homesRoot, 'agt_stock_agent', 'sessions')
  try {
    outer: for (const p of readdirSync(stockRoot, { withFileTypes: true })) {
      if (!p.isDirectory()) continue
      for (const s of readdirSync(join(stockRoot, p.name), { withFileTypes: true })) {
        if (!s.isDirectory() || s.name !== 'main') continue
        const file = join(stockRoot, p.name, s.name, 'session.jsonl')
        if (existsSync(file) && readSlice(file, 65536).includes('"type":"user/message"')) { stock = { agentId: 'agt_stock_agent', sessionId: 'main' }; break outer }
      }
    }
  } catch { /* none */ }
  if (stock === null) stock = firstFileMatching('agt_stock_agent', (t) => t.includes('"type":"user/message"'))
  if (stock !== null) chains.push(await run('A4_independent_session', 'agent_session', { agentId: stock.agentId, sessionId: stock.sessionId }))
  else chains.push({ chain: 'A4_independent_session', skipped: 'no stock session found' })
}
// A3b — reverse lookup from the real A2A correlation coordinate (the source
// turnExecutionId carried by the target journal's inserted[] sidecar).
if (a2aCorrelation !== null) {
  chains.push(await run('A3b_correlation_reverse', 'message', { reconciliationHandle: a2aCorrelation }))
} else {
  chains.push({ chain: 'A3b_correlation_reverse', skipped: 'no real correlation coordinate found' })
}

const summary = {
  phase: 'A (offline read-only; authsvc-only stores intentionally absent → honest SOURCE_ABSENT)',
  homesRoot,
  durationMs: Date.now() - t0,
  indexStats,
  chains,
}
writeFileSync(join(outDir, 'PHASE_A_SUMMARY.json'), JSON.stringify(summary, null, 2) + '\n')
process.stdout.write(JSON.stringify(summary, null, 2) + '\n')
