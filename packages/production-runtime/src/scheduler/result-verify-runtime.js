/**
 * @agent-core/production-runtime/src/scheduler/result-verify-runtime.js —
 * E4→E5 programmatic business-result verification consumer (#1379 M1/M2,
 * five-event chain). NOT a new scheduler/state machine: it is a recurring
 * consumer over the EXISTING runs history that (1) finds successful runs
 * whose business result was never verified (result_status === null),
 * (2) starts a REAL verify Agent Turn for the SAME responsible agent through
 * the EXISTING scheduler invoker seam (createRouterInvoker → the Router's
 * single runTurnWithRouteChain executor behind onIngress and Delivery V0) —
 * a Feishu outbound announcement is NOT a verify turn (#1379 owner audit),
 * and (3) binds the verdict back onto the ORIGINAL run through the EXISTING
 * HistoryStore `result_recorded` event — delivery success is NEVER treated
 * as verification; only an ingested ```scheduler-result block is.
 *
 * Contract (frozen):
 *  - scans ONLY runs with outcome 'succeeded' and result_status null, from
 *    the CURRENT and PREVIOUS monthly history projections, named by the
 *    authoritative historyMonth() (runs-YYYYMM.json — Owner audit defect 2:
 *    the reader must never guess a filename format the writer does not use);
 *  - verify attempts are paced per RUN with capped exponential backoff and
 *    the run NEVER leaves the scan set before a durable verdict — invalid,
 *    missing or timed-out receipts cannot permanently skip responsibility;
 *  - never invents a PASS: no block / empty reply / bad receipt leaves the
 *    run unverified (it stays in the scan set — responsibility not dropped);
 *  - the verify instruction asks the worker to restate its outcome WITH the
 *    ```scheduler-result block and point at its artifacts;
 *  - a verdict binds to the exact (runId, occurrenceId, jobId) triple via
 *    HistoryStore.runResultRecorded — restart-safe: attempts persist in the
 *    marker file and the scan set is re-derived from history every tick;
 *  - UNKNOWN outcomes are out of scope here (they belong to the D-009
 *    fence/auto-reconcile authority, not to business verification).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { historyMonth } from '../../../scheduler/src/history/history-model.js'
import { deriveNativeSessionId } from '../../../scheduler/src/index.js'

const MAX_VERIFY_TURNS_PER_TICK = 3
const DEFAULT_VERIFY_RETRY_BASE_MS = 30 * 60_000
const DEFAULT_VERIFY_RETRY_CAP_MS = 24 * 3600_000
const PREVIOUS_MONTH_MS = 31 * 86_400_000

export function createResultVerifyRuntime({
  layout, store, history, invoker, log = console, nowMs = Date.now, stateDir,
  verifyRetryBaseMs = DEFAULT_VERIFY_RETRY_BASE_MS, verifyRetryCapMs = DEFAULT_VERIFY_RETRY_CAP_MS,
}) {
  if (typeof invoker !== 'function') throw new TypeError('result-verify: invoker (the Router agent-turn seam) is required — a Feishu announcement is not a verify turn')
  if (history === undefined || typeof history.runResultRecorded !== 'function') throw new TypeError('result-verify: history (HistoryStore.runResultRecorded) is required — verdicts bind to the original run, not a second ledger')
  const markerFile = join(stateDir ?? layout.controlDir ?? layout.root ?? '/tmp', 'result-verify-state.json')

  function loadMarkers() {
    try { return JSON.parse(readFileSync(markerFile, 'utf8')) } catch { return { verifyAttempts: {} } }
  }
  function saveMarkers(markers) {
    try {
      mkdirSync(markerFile.substring(0, markerFile.lastIndexOf('/')), { recursive: true })
      writeFileSync(markerFile, JSON.stringify(markers))
    } catch { /* evidence-only failure: next tick rescans */ }
  }

  function readMonthRecords(monthKey) {
    let doc
    try { doc = JSON.parse(readFileSync(join(layout.historyDir, `runs-${monthKey}.json`), 'utf8')) } catch { return [] }
    return Array.isArray(doc?.records) ? doc.records : []
  }

  function scanUnverifiedRuns() {
    // Run records live in the monthly history projection (records[]) — the
    // same files the HistoryStore itself writes (writeHistoryPartition:
    // `runs-${historyMonth(...)}.json`). Scan the current and previous month
    // so month rollover cannot strand an unverified run.
    const now = nowMs()
    const recs = [...readMonthRecords(historyMonth(now)), ...readMonthRecords(historyMonth(now - PREVIOUS_MONTH_MS))]
    return recs.filter(r => r.outcome === 'succeeded'
      && (r.result_status === null || r.result_status === undefined))
  }

  async function tick() {
    const markers = loadMarkers()
    markers.verifyAttempts ??= {}
    const unverified = scanUnverifiedRuns()
    if (unverified.length === 0) return { scanned: 0, delivered: 0 }
    const jobs = await store.readJobs()
    let delivered = 0
    for (const rec of unverified) {
      if (delivered >= MAX_VERIFY_TURNS_PER_TICK) break
      const jobId = rec.job_id
      const runKey = rec.run_id ?? rec.occurrence_id ?? jobId
      const attemptState = markers.verifyAttempts[runKey]
      // A durable verdict lives in the history itself (result_status set ⇒
      // the run already left the scan set); the marker verdict is only a
      // fast-path for the same fact.
      if (attemptState?.verdict !== undefined) continue
      // Paced retry: capped exponential backoff — never a permanent skip.
      if (attemptState !== undefined) {
        const delay = Math.min(verifyRetryBaseMs * 2 ** (attemptState.attempts - 1), verifyRetryCapMs)
        if (nowMs() - attemptState.atMs < delay) continue
      }
      const job = (Array.isArray(jobs) ? jobs : []).find(j => j.id === jobId)
      if (job?.enabled === false) continue // live definition disabled: the gate holds
      // The definition may already be gone (one-shot deleteAfterRun removes
      // it post-run) — the responsibility lives on the RUN record, and
      // rec.agent_id carries the responsible agent.
      const agentId = rec.agent_id ?? job?.agent_id
      if (!agentId) continue
      const attempt = (attemptState?.attempts ?? 0) + 1
      const requestId = `rv:${runKey}:${attempt}`
      const sessionId = deriveNativeSessionId(requestId)
      const text = [
        `【结果核验】任务 "${job?.name ?? jobId}" (run ${rec.run_id ?? rec.occurrence_id ?? '?'}) 的业务结果尚未核验。`,
        '请回复该任务的最终结果，并在回复末尾附 ```scheduler-result 结果块',
        '(final_status=PASS|PARTIAL|FAIL 按验收标准如实判定, counters 含核心计数)。',
        '无结果块、空回复或无证据的 PASS 不会被记录为业务完成。',
      ].join('\n')
      try {
        // A REAL verify turn: the same Router executor behind onIngress and
        // Delivery V0, on a fresh non-main session, correlated to the exact
        // original run. attachSchedulerResult inside the observed invoker
        // ingests the ```scheduler-result block onto outcome.result.
        const outcome = await invoker({
          agentId,
          message: text,
          requestId,
          sessionId,
          jobId,
          runId: rec.run_id ?? null,
          occurrenceId: rec.occurrence_id ?? null,
        })
        markers.verifyAttempts[runKey] = { atMs: nowMs(), attempts: attempt, runId: rec.run_id ?? null, requestId }
        if (outcome?.result !== undefined || outcome?.result_error_code !== undefined) {
          await history.runResultRecorded({
            record: { occurrenceId: rec.occurrence_id, runId: rec.run_id, jobId },
            outcome,
            verify: { requestId, sessionId, attempt, turnStatus: outcome.status ?? null },
          })
          if (typeof outcome.result?.final_status === 'string') {
            markers.verifyAttempts[runKey].verdict = outcome.result.final_status
          }
        }
        delivered += 1
      } catch (e) {
        log.error?.(`[result-verify] verify turn failed for run ${runKey}: ${String(e?.message ?? e).slice(0, 120)}`)
        // A failed turn still consumes the attempt slot: backoff paces the
        // next try; the run never leaves the scan set without a verdict.
        markers.verifyAttempts[runKey] = { atMs: nowMs(), attempts: attempt, runId: rec.run_id ?? null, requestId }
      }
    }
    saveMarkers(markers)
    log.log?.(`[result-verify] scanned=${unverified.length} verifyTurns=${delivered}`)
    return { scanned: unverified.length, delivered }
  }

  return { tick, scanUnverifiedRuns }
}
