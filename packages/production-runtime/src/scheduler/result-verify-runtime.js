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
 * as verification.
 *
 * Hardening contract (release blockers per the Owner 2026-11-12 ruling):
 *
 *  B1 — CONCURRENCY AND RECOVERY SAFETY. The exact original run can never
 *  have two valid verify writers: every dispatch+record cycle holds a
 *  per-run OwnerLock (the scheduler's SIGKILL-safe cross-process mutation
 *  authority primitive — atomic identity publish, mechanical-only stale
 *  verdict via pid liveness, no wrongful seizure). A second tick or a second
 *  runtime process that cannot prove the claim busy-holder dead skips the
 *  run for that tick (the run stays in the scan set — responsibility is not
 *  dropped). Attempt state lives in a PER-RUN state file persisted atomically
 *  BEFORE the turn is dispatched (the attempt is consumed durably first), so
 *  a crash mid-turn leaves a resumable state, never a duplicate
 *  (runKey, attempt) identity. The requestId/sessionId identity is derived
 *  from the durable attempt number — restart-stable, monotonic.
 *
 *  B2 — RESULT AUTHENTICITY (#1379 M1: completion verdicts pass a
 *  deterministic server-side gate; the model's reply alone never projects to
 *  business completion). An ingested ```scheduler-result block with a legal
 *  final_status binds as the run's business verdict ONLY when its `evidence`
 *  array carries at least one anchor the SERVER can mechanically resolve:
 *  `{kind:'history_run', run_id|occurrence_id}` — matched against a FRESH
 *  server-side re-read of the run's own monthly projection (the run record
 *  is server-written; the worker cannot fabricate it), identity must be the
 *  exact run under verification, and the record must show outcome
 *  'succeeded'. Any other anchor kind, a mismatched identity, or no anchors
 *  at all → the report is recorded as REPORTED-ONLY in the per-run state and
 *  the run STAYS in the scan set (UNKNOWN/待证 per M1 — the successor is
 *  kept; the next attempt re-asks with the anchor contract). Server-side
 *  ingestion rejections (result_error_code, closed set) are still bound
 *  durably as error facts — they are the seam's judgment, not the worker's
 *  self-report. Scope is separated from subject capability (M1: "Scope与主体
 *  能力分开"): the verify turn keeps the agent's own enforced trusted
 *  nativeToolPolicy (per-agent, route-bound, mechanically enforced on every
 *  turn including verify turns); the verify-only boundary is the SERVER-SIDE
 *  GATE — the reply's scope to close business state is constrained by the
 *  gate, not by prompt wording. A per-request tool allowlist does not exist
 *  in the current turn seam and is NOT invented here.
 *
 * Contract (frozen):
 *  - scans ONLY runs with outcome 'succeeded' and result_status null, from
 *    the CURRENT and PREVIOUS monthly history projections, named by the
 *    authoritative historyMonth() (runs-YYYYMM.json — Owner audit defect 2:
 *    the reader must never guess a filename format the writer does not use);
 *  - a month file that fails to read/parse (anything other than ENOENT)
 *    fails the whole tick CLOSED: zero dispatches on an incomplete scan —
 *    the consumer never verifies against a history it could not fully read;
 *  - pre-activation history is classified, never mass-dispatched: runs
 *    started before `verifyNotBeforeMs` (the activation watermark the
 *    installer pins; null = no exclusion) are counted as scopeExcluded and
 *    stay in the scan set untouched;
 *  - verify attempts are paced per RUN with capped exponential backoff and
 *    the run NEVER leaves the scan set before a durable verdict — invalid,
 *    missing, evidence-less or timed-out reports cannot permanently skip
 *    responsibility;
 *  - never invents a PASS: no block / empty reply / unresolvable anchors
 *    leave the run unverified;
 *  - a bound verdict binds to the exact (runId, occurrenceId, jobId) triple
 *    via HistoryStore.runResultRecorded — restart-safe: the scan set is
 *    re-derived from history every tick, attempt state survives the process;
 *  - UNKNOWN turn outcomes are out of scope here (they belong to the D-009
 *    fence/auto-reconcile authority, not to business verification).
 */

import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { OwnerLock } from '../../../scheduler/src/store/lock.js'
import { historyMonth } from '../../../scheduler/src/history/history-model.js'
import { deriveNativeSessionId } from '../../../scheduler/src/index.js'

const MAX_VERIFY_TURNS_PER_TICK = 3
const DEFAULT_VERIFY_RETRY_BASE_MS = 30 * 60_000
const DEFAULT_VERIFY_RETRY_CAP_MS = 24 * 3600_000
const PREVIOUS_MONTH_MS = 31 * 86_400_000
const CLAIM_TIMEOUT_MS = 5_000 // a live claim holder skips this run for this tick; never a long stall
const DEFAULT_VERIFY_TURN_TIMEOUT_MS = 600_000

export function createResultVerifyRuntime({
  layout, store, history, invoker, log = console, nowMs = Date.now, stateDir,
  verifyRetryBaseMs = DEFAULT_VERIFY_RETRY_BASE_MS, verifyRetryCapMs = DEFAULT_VERIFY_RETRY_CAP_MS,
  verifyNotBeforeMs = null, verifyTurnTimeoutMs = DEFAULT_VERIFY_TURN_TIMEOUT_MS,
  claimTimeoutMs = CLAIM_TIMEOUT_MS,
}) {
  if (typeof invoker !== 'function') throw new TypeError('result-verify: invoker (the Router agent-turn seam) is required — a Feishu announcement is not a verify turn')
  if (history === undefined || typeof history.runResultRecorded !== 'function') throw new TypeError('result-verify: history (HistoryStore.runResultRecorded) is required — verdicts bind to the original run, not a second ledger')
  const baseDir = stateDir ?? layout.controlDir ?? layout.root ?? '/tmp'
  const runsDir = join(baseDir, 'result-verify', 'runs')
  const claimsDir = join(baseDir, 'result-verify', 'claims')

  // Stable per-run file identity: human-readable prefix + short digest of the
  // exact runKey, so distinct run keys can never collide on the filesystem.
  function fileKey(runKey) {
    const safe = String(runKey).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'run'
    return `${safe}.${createHash('sha256').update(String(runKey)).digest('hex').slice(0, 12)}`
  }
  const statePath = (runKey) => join(runsDir, `${fileKey(runKey)}.json`)
  const claimPath = (runKey) => join(claimsDir, `${fileKey(runKey)}.lock`)

  function loadState(runKey) {
    try {
      const s = JSON.parse(readFileSync(statePath(runKey), 'utf8'))
      return (s !== null && typeof s === 'object' && Number.isSafeInteger(s.attempts)) ? s : null
    } catch { return null }
  }

  /** Atomic per-run state write (tmp + rename): no torn state survives a crash. */
  function persistState(runKey, state) {
    try {
      mkdirSync(runsDir, { recursive: true })
      const p = statePath(runKey)
      const tmp = `${p}.${process.pid}.tmp`
      writeFileSync(tmp, JSON.stringify(state))
      renameSync(tmp, p)
    } catch (e) {
      // Evidence-only failure: the durable verdict lives in history; a lost
      // state file only costs pacing precision, never responsibility.
      log.error?.(`[result-verify] state persist failed for ${runKey}: ${String(e?.message ?? e).slice(0, 120)}`)
    }
  }

  function readMonthRecords(monthKey, readErrors) {
    let raw
    try {
      raw = readFileSync(join(layout.historyDir, `runs-${monthKey}.json`), 'utf8')
    } catch (e) {
      if (e?.code === 'ENOENT') return [] // month with no history yet is legitimately empty
      readErrors.push({ month: monthKey, error: String(e?.message ?? e).slice(0, 160) })
      return []
    }
    try {
      const doc = JSON.parse(raw)
      return Array.isArray(doc?.records) ? doc.records : []
    } catch (e) {
      readErrors.push({ month: monthKey, error: `parse: ${String(e?.message ?? e).slice(0, 140)}` })
      return []
    }
  }

  function scanWithErrors() {
    const readErrors = []
    const now = nowMs()
    const recs = [
      ...readMonthRecords(historyMonth(now), readErrors),
      ...readMonthRecords(historyMonth(now - PREVIOUS_MONTH_MS), readErrors),
    ]
    return {
      records: recs.filter(r => r.outcome === 'succeeded'
        && (r.result_status === null || r.result_status === undefined)),
      readErrors,
    }
  }

  /** Public scan surface (unchanged shape): the unverified run records. */
  function scanUnverifiedRuns() {
    return scanWithErrors().records
  }

  /**
   * M1 server-side evidence gate. Only the run's own server-written record
   * resolves an anchor: identity must be the exact run under verification,
   * matched against a FRESH month-partition re-read (not the scan snapshot),
   * with outcome 'succeeded'. Everything else is unproven (fail-closed).
   */
  function evaluateVerdict(outcome, rec) {
    const result = outcome?.result
    if (result === undefined) return { bindable: false, reason: 'no_block' }
    if (typeof result?.final_status !== 'string') return { bindable: false, reason: 'no_final_status' }
    const anchors = Array.isArray(result.evidence) ? result.evidence : []
    let resolved = 0
    for (const a of anchors) {
      if (a === null || typeof a !== 'object') continue
      if (a.kind !== 'history_run') continue // only server-written run records resolve; fail closed on unknown kinds
      const identityMatches = (a.run_id !== undefined && a.run_id !== null && a.run_id === rec.run_id)
        || (a.occurrence_id !== undefined && a.occurrence_id !== null && a.occurrence_id === rec.occurrence_id)
      if (!identityMatches) continue // an anchor for a different run proves nothing about this one
      const readErrors = []
      const serverRecords = scanWithErrorsOf(readErrors)
      if (readErrors.length > 0) continue // cannot resolve against a history we cannot fully read
      const serverRec = serverRecords.find(r => (rec.run_id !== null && r.run_id === rec.run_id)
        || (rec.occurrence_id !== null && r.occurrence_id === rec.occurrence_id))
      if (serverRec && serverRec.outcome === 'succeeded') resolved += 1
    }
    return resolved > 0
      ? { bindable: true, resolvedAnchors: resolved, finalStatus: result.final_status }
      : { bindable: false, reason: 'no_resolving_anchor', reported: { finalStatus: result.final_status, anchors: anchors.length } }
  }

  function scanWithErrorsOf(readErrors) {
    const now = nowMs()
    return [
      ...readMonthRecords(historyMonth(now), readErrors),
      ...readMonthRecords(historyMonth(now - PREVIOUS_MONTH_MS), readErrors),
    ]
  }

  /** Record start time in ms — the projection stores ISO strings (started_at/admitted_at/ended_at). */
  function recordStartedMs(rec) {
    for (const v of [rec.started_at, rec.admitted_at, rec.ended_at, rec.ts]) {
      if (typeof v === 'number' && Number.isFinite(v)) return v
      if (typeof v === 'string' && v !== '') {
        const ms = Date.parse(v)
        if (Number.isFinite(ms)) return ms
      }
    }
    return null // unclassifiable record: never silently excluded, stays dispatchable
  }

  async function tick() {
    const { records: unverified, readErrors } = scanWithErrors()
    if (readErrors.length > 0) {
      // Fail CLOSED: a partially readable history must never drive dispatch.
      log.error?.(`[result-verify] history read failed — tick aborted (fail-closed): ${JSON.stringify(readErrors)}`)
      return { scanned: 0, delivered: 0, readErrors, failClosed: true }
    }
    if (unverified.length === 0) return { scanned: 0, delivered: 0 }
    const jobs = await store.readJobs()
    let delivered = 0
    let scopeExcluded = 0
    let skippedBusy = 0
    for (const rec of unverified) {
      if (delivered >= MAX_VERIFY_TURNS_PER_TICK) break
      const jobId = rec.job_id
      const runKey = rec.run_id ?? rec.occurrence_id ?? jobId
      // Activation-watermark classification: pre-activation history is never
      // mass-dispatched (#1379 review: the historical null backlog is
      // classified, not blindly re-driven). The run stays in the scan set.
      const startedMs = recordStartedMs(rec)
      if (verifyNotBeforeMs !== null && startedMs !== null && startedMs < verifyNotBeforeMs) {
        scopeExcluded += 1
        continue
      }
      // Pacing pre-check outside the claim (cheap); re-checked under the claim.
      const pre = loadState(runKey) ?? { attempts: 0 }
      if (pre.verdict !== undefined) continue
      const preDelay = Math.min(verifyRetryBaseMs * 2 ** ((pre.attempts || 1) - 1), verifyRetryCapMs)
      if (pre.attempts > 0 && nowMs() - pre.atMs < preDelay) continue
      const job = (Array.isArray(jobs) ? jobs : []).find(j => j.id === jobId)
      if (job?.enabled === false) continue // live definition disabled: the gate holds
      // The definition may already be gone (one-shot deleteAfterRun removes
      // it post-run) — the responsibility lives on the RUN record, and
      // rec.agent_id carries the responsible agent.
      const agentId = rec.agent_id ?? job?.agent_id
      if (!agentId) continue

      // B1: the per-run OwnerLock is the cross-process/cross-tick claim —
      // one valid verify writer per original run, SIGKILL-safe (mechanical
      // dead-owner reaping; live or unverifiable holders are never seized).
      const lock = new OwnerLock(claimPath(runKey), {
        timeoutMs: claimTimeoutMs,
        onEvidence: (ev) => log.error?.(`[result-verify] claim evidence ${runKey}: ${JSON.stringify(ev)}`),
      })
      let token
      try {
        token = await lock.acquire()
      } catch {
        skippedBusy += 1 // a live holder owns this run's verify cycle; skip this tick, run stays in the scan set
        continue
      }
      try {
        // Re-check under the claim: another writer may have settled or paced
        // this run between the scan snapshot and the claim acquisition.
        const fresh = loadState(runKey) ?? { attempts: 0 }
        if (fresh.verdict !== undefined) continue
        const delay = Math.min(verifyRetryBaseMs * 2 ** ((fresh.attempts || 1) - 1), verifyRetryCapMs)
        if (fresh.attempts > 0 && nowMs() - fresh.atMs < delay) continue
        const attempt = fresh.attempts + 1
        const requestId = `rv:${runKey}:${attempt}`
        const sessionId = deriveNativeSessionId(requestId)
        // Consume the attempt durably BEFORE dispatching: a crash mid-turn
        // leaves a resumable state and a monotonic identity — never a
        // duplicate (runKey, attempt) writer pair.
        persistState(runKey, { attempts: attempt, atMs: nowMs(), requestId, sessionId, status: 'in_flight', runId: rec.run_id ?? null })
        const text = [
          `【结果核验】任务 "${job?.name ?? jobId}" (run ${rec.run_id ?? rec.occurrence_id ?? '?'}) 的业务结果尚未核验。`,
          '请回复该任务的最终结果，并在回复末尾附 ```scheduler-result 结果块',
          '(final_status=PASS|PARTIAL|FAIL 按验收标准如实判定, counters 含核心计数)。',
          `evidence 数组至少含一个服务端可核锚点：{ "kind": "history_run", "run_id": "${rec.run_id ?? ''}" }`,
          '（服务端将机械核验锚点与本 run 的权威记录；无可核锚点的结论只记为已报告，不会绑定业务完成。）',
        ].join('\n')
        let outcome
        try {
          outcome = await invoker({
            agentId,
            message: text,
            requestId,
            sessionId,
            jobId,
            runId: rec.run_id ?? null,
            occurrenceId: rec.occurrence_id ?? null,
            timeoutMs: verifyTurnTimeoutMs,
          })
        } catch (e) {
          log.error?.(`[result-verify] verify turn failed for run ${runKey}: ${String(e?.message ?? e).slice(0, 120)}`)
          // A failed turn still consumed its attempt slot (persisted before
          // dispatch): backoff paces the next try; the run never leaves the
          // scan set without a verdict.
          persistState(runKey, { attempts: attempt, atMs: nowMs(), requestId, status: 'turn_failed', lastError: String(e?.message ?? e).slice(0, 160) })
          delivered += 1
          continue
        }
        const gate = evaluateVerdict(outcome, rec)
        const verify = { requestId, sessionId, attempt, turnStatus: outcome?.status ?? null }
        if (gate.bindable) {
          // B2: the verdict passed the deterministic server-side gate — bind
          // it to the original run through the EXISTING result_recorded event.
          await history.runResultRecorded({
            record: { occurrenceId: rec.occurrence_id, runId: rec.run_id, jobId },
            outcome,
            verify: { ...verify, gate: 'm1-anchor-verified' },
          })
          persistState(runKey, { attempts: attempt, atMs: nowMs(), requestId, status: 'settled', verdict: outcome.result.final_status, settledAtMs: nowMs() })
        } else if (outcome?.result_error_code !== undefined) {
          // Server-side ingestion rejection (closed error-code set) — the
          // seam's own judgment, durably bound as an error fact (never a
          // verdict); the run stays in the scan set.
          await history.runResultRecorded({
            record: { occurrenceId: rec.occurrence_id, runId: rec.run_id, jobId },
            outcome,
            verify: { ...verify, gate: 'ingestion-rejected' },
          })
          persistState(runKey, { attempts: attempt, atMs: nowMs(), requestId, status: 'ingestion_rejected', lastErrorCode: outcome.result_error_code })
        } else {
          // Reported-only: a legal block whose anchors did not resolve (or no
          // block at all). NOT a business verdict; the run stays in the scan
          // set (M1: UNKNOWN/待证, successor kept) and the next paced attempt
          // re-asks with the anchor contract.
          persistState(runKey, { attempts: attempt, atMs: nowMs(), requestId, status: 'awaiting_evidence', reported: gate.reported ?? null, gateReason: gate.reason })
        }
        delivered += 1
      } finally {
        await lock.release(token)
      }
    }
    const result = { scanned: unverified.length, delivered, scopeExcluded, skippedBusy }
    log.log?.(`[result-verify] ${JSON.stringify(result)}`)
    return result
  }

  return { tick, scanUnverifiedRuns }
}
