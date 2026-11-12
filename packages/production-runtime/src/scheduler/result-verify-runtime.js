/**
 * @agent-core/production-runtime/src/scheduler/result-verify-runtime.js —
 * E4→E5 programmatic business-result verification consumer (#1379 M1/M2,
 * five-event chain). NOT a new scheduler/state machine: it is a recurring
 * consumer over the EXISTING runs history that (1) finds successful runs
 * whose business result was never verified (result_status === null),
 * (2) re-delivers the job's own verify instruction to the SAME responsible
 * agent through the EXISTING scheduler delivery seam, and (3) leaves the
 * verdict entirely to the next ingest — the agent's ```scheduler-result
 * block lands via attachSchedulerResult exactly like any turn result.
 *
 * Contract (frozen):
 *  - scans ONLY runs with state 'succeeded' and result_status null;
 *  - one pending re-verify per job at a time (dedupe by job_id marker);
 *  - never invents a PASS: no block / empty reply / bad receipt leaves the
 *    run unverified (it stays in the scan set — responsibility not dropped);
 *  - the verify instruction asks the worker to restate its outcome WITH the
 *    ```scheduler-result block and point at its artifacts;
 *  - UNKNOWN outcomes are out of scope here (they belong to the D-009
 *    fence/auto-reconcile authority, not to business verification).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SCAN_TAIL_BYTES = 512 * 1024
const MAX_VERIFY_DELIVERIES_PER_TICK = 3

export function createResultVerifyRuntime({ layout, deliver, store, log = console, nowMs = Date.now, stateDir }) {
  const markerFile = join(stateDir ?? layout.controlDir ?? layout.root ?? '/tmp', 'result-verify-state.json')

  function loadMarkers() {
    try { return JSON.parse(readFileSync(markerFile, 'utf8')) } catch { return { verifiedDelivered: {} } }
  }
  function saveMarkers(markers) {
    try {
      mkdirSync(markerFile.substring(0, markerFile.lastIndexOf('/')), { recursive: true })
      writeFileSync(markerFile, JSON.stringify(markers))
    } catch { /* evidence-only failure: next tick rescans */ }
  }

  function scanUnverifiedRuns() {
    // Run records live in the monthly history projection (records[]), not the
    // events log. Scan the current month's projection for succeeded runs with
    // a null business result.
    const now = new Date(nowMs())
    const proj = historyMonth(now.getTime())
    let doc
    try { doc = JSON.parse(readFileSync(join(layout.historyDir, `runs-${proj}.json`), 'utf8')) } catch { return [] }
    const recs = doc.records ?? []
    return recs.filter(r => r.outcome === 'succeeded'
      && (r.result_status === null || r.result_status === undefined))
  }

  async function tick() {
    const markers = loadMarkers()
    const unverified = scanUnverifiedRuns()
    if (unverified.length === 0) return { scanned: 0, delivered: 0 }
    let delivered = 0
    for (const rec of unverified) {
      if (delivered >= MAX_VERIFY_DELIVERIES_PER_TICK) break
      const jobId = rec.job_id
      if (markers.verifiedDelivered[jobId]) continue // one pending re-verify per job
      const jobs = store.readAll?.() ?? store.readDoc?.()?.jobs ?? []
      const job = (Array.isArray(jobs) ? jobs : []).find(j => j.id === jobId)
      if (!job || job.enabled === false) continue
      const agentId = rec.agent_id ?? job.agent_id
      if (!agentId) continue
      const text = [
        `【结果核验】任务 "${job.name ?? jobId}" (run ${rec.run_id ?? rec.occurrence_id ?? '?'}) 的业务结果尚未核验。`,
        '请回复该任务的最终结果，并在回复末尾附 ```scheduler-result 结果块',
        '(final_status=PASS|PARTIAL|FAIL 按验收标准如实判定, counters 含核心计数)。',
        '无结果块、空回复或无证据的 PASS 不会被记录为业务完成。',
      ].join('\n')
      try {
        await deliver({ job: { ...job, agent_id: agentId }, payload: { text } })
        markers.verifiedDelivered[jobId] = { atMs: nowMs(), runId: rec.run_id ?? null }
        delivered += 1
      } catch (e) {
        log.error?.(`[result-verify] deliver failed for job ${jobId}: ${String(e?.message ?? e).slice(0, 120)}`)
      }
    }
    saveMarkers(markers)
    log.log?.(`[result-verify] scanned=${unverified.length} delivered=${delivered}`)
    return { scanned: unverified.length, delivered }
  }

  return { tick, scanUnverifiedRuns }
}
