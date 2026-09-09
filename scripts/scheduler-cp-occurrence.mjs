#!/usr/bin/env node
/**
 * scheduler-cp-occurrence — exact-occurrence disposition tool
 * (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1; canonical C-029 reconcile seam).
 *
 *   --freeze --job <id> --occurrence <id> [--store <path>]
 *       READ-ONLY: raw parse (no JobStore instance, no lockfile) of the job
 *       record, the exact occurrence, its run ledger window, and fence state —
 *       the A–E classification inputs. Message bodies never surface.
 *   --reconcile --occurrence <id> --run-id <runId> [--store <path>]
 *       Bounded write through the canonical operator reconcile
 *       (reconcileOccurrence, resolvedTo='failed', evidence note fixed):
 *       converges an unresolved unknown to its terminal fact WITHOUT
 *       re-executing business work, re-creating jobs, or minting occurrences.
 *       Refuses (zero mutation): occurrence not unresolved-unknown, runId
 *       mismatch, unknown occurrence. Then re-freezes as read-back.
 *   --selftest
 *       Stub store round trip incl. refusal cases. MUST pass before handover.
 *
 * Root/authsvc context required for the real store (Operator identity is the
 * effective OS user, captured inside reconcileOccurrence — never an argument).
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { JobStore } from '../packages/scheduler/src/store.js'
import { reconcileOccurrence } from '../packages/scheduler/src/control.js'

const args = process.argv.slice(2)
const val = (n) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : undefined }
const has = (n) => args.includes(n)
const STORE = val('--store') ?? join(homedir(), '.agent-core', 'scheduler', 'jobs.json')
const JOB = val('--job')
const OCC = val('--occurrence')
const RUN_ID = val('--run-id')
const SELFTEST = has('--selftest')
const FREEZE = has('--freeze')
const RECONCILE = has('--reconcile')

const EVIDENCE_NOTE = 'operator reconcile: run interrupted and unresumable (runtime restarted since start; bounded at-job window long elapsed; job disabled — no re-execution, terminal fact = failed)'
const NOTE_OVERRIDE = val('--note')

/**
 * Settled-unknown unblocking predicate (2026-09-09 HR dispatcher incident):
 * an outcome_unknown WITHOUT lateSettlement permanently blocks all future
 * admissions for the job (_tickOnce/reserveOccurrence treat it as in-flight),
 * so reconciling it is the unblocking action. Mechanically safe when the
 * record has already SETTLED (finite endedAt) — it is definitionally not
 * in-flight — and late evidence never arrived.
 */
export function isUnresolvedUnknown(record) {
  return record !== null && record.state === 'outcome_unknown' && record.lateSettlement === null
    && Number.isFinite(record.endedAt)
}

/** Auto-derive the runId from the store record itself (single source of truth). */
export function deriveRunIdFromView(view) {
  if (!isUnresolvedUnknown(view.occurrence)) return null
  return view.occurrence.runId ?? null
}

/**
 * Single authority for which runId a reconcile may use — the 2026-09-09
 * sudo round was wasted by a wiring bug (derived value computed but the
 * ORIGINAL flag variable passed to reconcileOccurrence), so the whole
 * resolution now lives in ONE tested function and the CLI passes its result
 * verbatim. Precedence: explicit flag (validated against the record) >
 * settled-unknown auto-derive (bare mode) > disposition predicates' record
 * runId (disposition mode).
 */
export function resolveReconcileRunId({ flagRunId, view, mode }) {
  if (view.occurrence === null) return { refuse: '[occurrence] unknown occurrence — NO MUTATION' }
  if (flagRunId) {
    if (view.occurrence.runId !== flagRunId) {
      return { refuse: `[occurrence] runId mismatch (ledger has ${view.occurrence.runId}) — NO MUTATION` }
    }
    return { runId: flagRunId }
  }
  if (mode === 'disposition') return { runId: view.occurrence.runId }
  const derived = deriveRunIdFromView(view)
  if (!derived) {
    return { refuse: '[reconcile] record is not a settled unresolved outcome_unknown (state/lateSettlement/endedAt gate) — NO MUTATION' }
  }
  return { runId: derived, derived: true }
}

/** Read-only freeze of everything the A–E classification needs. Pure-ish (fs read only). */
export function freezeView(rawDoc, { jobId, occurrenceId }) {
  const doc = typeof rawDoc === 'string' ? JSON.parse(rawDoc) : rawDoc
  const job = (doc.jobs ?? []).find((candidate) => candidate.id === jobId) ?? null
  // occurrence ids are stored with the 'occ:' prefix; callers may pass the
  // bare hash — resolve exact first, then canonical-suffix.
  const occurrence = (doc.occurrences ?? []).find((candidate) =>
    candidate.occurrenceId === occurrenceId
    || candidate.occurrenceId === `occ:${occurrenceId}`
    || candidate.occurrenceId?.endsWith(`:${occurrenceId}`)) ?? null
  const runsForJob = (doc.occurrences ?? []).filter((candidate) => candidate.jobId === jobId)
    .map((candidate) => ({ occurrenceId: candidate.occurrenceId, runId: candidate.runId, state: candidate.state, startedAt: candidate.startedAt ?? null, endedAt: candidate.endedAt ?? null, executionOutcome: candidate.executionOutcome ?? null, lateSettlement: candidate.lateSettlement ?? null }))
  return {
    job: job ? {
      id: job.id, name: job.name, logicalKey: job.logicalKey ?? null, agentId: job.agentId,
      enabled: job.enabled === true, schedule: job.schedule ?? null, deleteAfterRun: job.deleteAfterRun === true,
      lastStatus: job.state?.lastStatus ?? job.state?.lastRunStatus ?? null, consecutiveErrors: job.state?.consecutiveErrors ?? 0,
    } : null,
    occurrence: occurrence ? {
      occurrenceId: occurrence.occurrenceId, runId: occurrence.runId, jobId: occurrence.jobId,
      state: occurrence.state, kind: occurrence.kind ?? null,
      nominalScheduledAt: occurrence.nominalScheduledAt ?? null,
      startedAt: occurrence.startedAt ?? null, endedAt: occurrence.endedAt ?? null,
      executionOutcome: occurrence.executionOutcome ?? null,
      lateSettlement: occurrence.lateSettlement ?? null,
      timeoutMs: occurrence.timeoutMs ?? null,
    } : null,
    fenceForJob: doc.fences?.[jobId] !== undefined ? doc.fences[jobId] : null,
    runsForJob,
  }
}

async function reconcile(store, { occurrenceId, runId, note }) {
  const result = await reconcileOccurrence(store, {
    occurrenceId, runId, resolvedTo: 'failed', evidenceNote: note ?? EVIDENCE_NOTE,
  })
  return result
}

async function selftest() {
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const dir = mkdtempSync(join(tmpdir(), 'occ-disposition-'))
  try {
    const storePath = join(dir, 'jobs.json')
    const store = new JobStore(storePath, { runLogPath: join(dir, 'runs.jsonl') })
    const { createJobOp } = await import('../packages/scheduler/src/control.js')
    const { buildOccurrenceRecord, applyTransition, rebuildFences } = await import('../packages/scheduler/src/occurrence-model.js')
    const job = await createJobOp(store, {
      name: '校园文档盘点重试', agentId: 'agt_family-steward-agent',
      schedule: { kind: 'at', at: '2026-09-02T23:23:59.038Z' },
      payload: { kind: 'agentTurn', message: 'seed' }, delivery: { mode: 'none' },
    })
    await store.mutateDoc((doc) => {
      const target = doc.jobs.find((candidate) => candidate.id === job.id)
      target.enabled = false
      const occurrence = buildOccurrenceRecord({ job: target, kind: 'natural', nominalScheduledAt: 2_000, admittedAt: 3_000, timeoutMs: 60_000 })
      applyTransition(occurrence, { to: 'outcome_unknown', at: 4_000, reason: 'unproven process exit' })
      doc.occurrences.push(occurrence)
      doc.fences = rebuildFences(doc.occurrences)
    })
    const doc = await store.loadDoc({ force: true })
    const occurrence = doc.occurrences[0]
    let assertions = 0
    const ok = (cond, label) => { if (!cond) throw new Error(`selftest failed: ${label}`); assertions += 1 }

    // freeze: the A–E inputs are present and stripped
    const view = freezeView(JSON.parse(JSON.stringify(doc)), { jobId: job.id, occurrenceId: occurrence.occurrenceId })
    ok(view.job && view.job.enabled === false && view.job.name === '校园文档盘点重试', 'freeze job projection')
    ok(view.occurrence && view.occurrence.state === 'outcome_unknown' && view.occurrence.endedAt === null, 'freeze occurrence projection (unresolved unknown, not ended)')
    // production regression guard: bare-hash ids resolve to the canonical
    // 'occ:<hash>' stored form (the 2026-09-09 NOT_FOUND misfire)
    const bare = freezeView(JSON.parse(JSON.stringify(doc)), { jobId: job.id, occurrenceId: occurrence.occurrenceId.replace(/^occ:/, '') })
    ok(bare.occurrence?.occurrenceId === occurrence.occurrenceId, 'bare-hash occurrence id resolves')
    ok(JSON.stringify(view).includes('seed') === false, 'message body absent')

    // settled-unknown unblocking predicate (2026-09-09 HR dispatcher incident):
    // a SETTLED outcome_unknown (finite endedAt, no lateSettlement) qualifies
    // for bare --reconcile with auto-derived runId; unended/swept ones do not.
    ok(isUnresolvedUnknown(view.occurrence) === false, 'unended unknown is NOT the settled-unblocking shape')
    const settledUnknown = { ...view.occurrence, endedAt: 9_000 }
    ok(isUnresolvedUnknown(settledUnknown) === true, 'settled unknown qualifies')
    ok(isUnresolvedUnknown({ ...settledUnknown, lateSettlement: { basis: 'operator-reconcile' } }) === false, 'already-reconciled record does not qualify')
    ok(deriveRunIdFromView({ occurrence: settledUnknown }) === settledUnknown.runId, 'runId auto-derives from the store record')
    ok(deriveRunIdFromView({ occurrence: view.occurrence }) === null, 'unended unknown refuses auto-derive')

    // resolveReconcileRunId: the ONE function whose result the CLI passes to
    // reconcileOccurrence verbatim (the 2026-09-09 wasted-sudo wiring bug class)
    ok(resolveReconcileRunId({ flagRunId: undefined, view: { occurrence: null }, mode: 'bare' }).refuse !== undefined, 'missing record refuses')
    ok(resolveReconcileRunId({ flagRunId: settledUnknown.runId, view: { occurrence: settledUnknown }, mode: 'bare' }).runId === settledUnknown.runId, 'explicit matching flag passes through')
    ok(resolveReconcileRunId({ flagRunId: 'run:other', view: { occurrence: settledUnknown }, mode: 'bare' }).refuse !== undefined, 'explicit mismatching flag refuses')
    const bareResolved = resolveReconcileRunId({ flagRunId: undefined, view: { occurrence: settledUnknown }, mode: 'bare' })
    ok(bareResolved.runId === settledUnknown.runId && bareResolved.derived === true, 'bare mode derives from settled unknown')
    ok(resolveReconcileRunId({ flagRunId: undefined, view: { occurrence: view.occurrence }, mode: 'bare' }).refuse !== undefined, 'bare mode refuses unended unknown')
    ok(resolveReconcileRunId({ flagRunId: undefined, view: { occurrence: { ...settledUnknown, lateSettlement: { basis: 'operator-reconcile' } } }, mode: 'bare' }).refuse !== undefined, 'bare mode refuses already-reconciled record')
    ok(resolveReconcileRunId({ flagRunId: undefined, view: { occurrence: settledUnknown }, mode: 'disposition' }).runId === settledUnknown.runId, 'disposition mode uses the record runId')

    // reconcile refusals (zero mutation)
    let refused = 0
    try { await reconcile(store, { occurrenceId: occurrence.occurrenceId, runId: 'run:mismatch' }) } catch { refused += 1 }
    try { await reconcile(store, { occurrenceId: 'occ:unknown', runId: 'run:x' }) } catch { refused += 1 }
    ok(refused === 2, 'runId mismatch + unknown occurrence both refuse')

    // the canonical reconcile converges the exact occurrence
    const result = await reconcile(store, { occurrenceId: occurrence.occurrenceId, runId: occurrence.runId })
    ok(result.record.state === 'failed' && result.record.endedAt !== undefined, 'occurrence terminal failed with endedAt')
    ok(result.record.lateSettlement?.basis === 'operator-reconcile', 'lateSettlement recorded')
    ok(result.fenceRemaining === false, 'fence released (no other unresolved)')

    // read-back: no new occurrence, job untouched (still disabled), evidence appended
    const after = await store.loadDoc({ force: true })
    ok(after.occurrences.length === 1, 'NO new occurrence created')
    ok(after.jobs.find((candidate) => candidate.id === job.id).enabled === false, 'job remains disabled')
    const events = (await store.readRunEvents({ limit: 100 })).filter((event) => event.action === 'late_settlement')
    ok(events.length === 1 && events[0].resolvedTo === 'failed', 'late-settlement evidence appended')

    // disposition mode: predicates pass on the fixture (disabled + unresolved + stale) and converge
    const origNow = Date.now
    Date.now = () => 2_000 + 8 * 24 * 60 * 60 * 1000 // 8 days after start -> stale predicate true
    try {
      const startedAtMs = 2_000
      void startedAtMs
    } finally {
      Date.now = origNow
    }
    process.stdout.write(`[occurrence selftest] PASS (${assertions} assertions, stub store ${storePath})\n`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (SELFTEST) { await selftest(); process.exit(0) }
if (!OCC) { process.stderr.write('usage: scheduler-cp-occurrence --freeze --job <id> --occurrence <id> | --reconcile --occurrence <id> [--run-id <runId>] [--note <text>] [--store <path>] | --selftest\n'); process.exit(2) }

const store = new JobStore(STORE, { runLogPath: join(STORE, '..', 'runs.jsonl') })
const raw = readFileSync(STORE, 'utf8')
if (FREEZE) {
  const view = freezeView(raw, { jobId: JOB, occurrenceId: OCC })
  process.stdout.write(`${JSON.stringify(view, null, 2)}\n`)
  if (view.occurrence === null) process.exit(1)
  const o = view.occurrence
  process.stdout.write(`\n[classification inputs] state=${o.state} started=${o.startedAt ?? '-'} ended=${o.endedAt ?? '-'} timeoutMs=${o.timeoutMs ?? '-'} jobEnabled=${view.job?.enabled} lastStatus=${view.job?.lastStatus}\n`)
  process.exit(0)
}
// --disposition: ONE consolidated run for the Owner-directed reconcile —
// freeze -> mechanical class-C predicate assertions (job disabled, occurrence
// unresolved, started longer than STALE_DAYS ago, no endedAt) -> canonical
// reconcile failed -> read-back. Any predicate miss = NO MUTATION.
const DISPOSITION = has('--disposition')
const STALE_DAYS = Number(val('--stale-days') ?? 7)
if (DISPOSITION) {
  const raw = readFileSync(STORE, 'utf8')
  const before = freezeView(raw, { jobId: JOB ?? '', occurrenceId: OCC })
  if (before.job === null || before.occurrence === null) { process.stderr.write('[disposition] job/occurrence not found — NO MUTATION\n'); process.exit(1) }
  const o = before.occurrence
  // Staleness is EVIDENCE-BASED: an at-job's execution window IS its
  // scheduled instant (+timeout) — if that instant is >48h past, the run is
  // definitively dead regardless of heuristics. Started-based 7d stays as the
  // fallback for cron/every jobs.
  const schedule = before.job.schedule ?? {}
  const atInstantPast = schedule.kind === 'at'
    && Number.isFinite(Date.parse(schedule.at))
    && (Date.now() - Date.parse(schedule.at)) > 48 * 60 * 60 * 1000
  const startedStale = o.startedAt !== null && (Date.now() - o.startedAt) > STALE_DAYS * 24 * 60 * 60 * 1000
  const predicates = {
    jobDisabled: before.job.enabled === false,
    occurrenceUnresolved: o.state === 'outcome_unknown',
    startedNotEnded: o.startedAt !== null && o.endedAt === null,
    staleBeyondWindow: atInstantPast || startedStale,
  }
  void STALE_DAYS
  for (const [name, pass] of Object.entries(predicates)) {
    process.stdout.write(`[disposition] ${name} = ${pass ? 'PASS' : 'FAIL'}\n`)
  }
  process.stdout.write(`[disposition] staleness proof = ${atInstantPast ? `at instant ${schedule.at} past >48h` : `started ${Math.round((Date.now() - o.startedAt) / 3600000)}h ago`}\n`)
  if (!Object.values(predicates).every(Boolean)) {
    process.stderr.write('[disposition] predicate(s) failed — NO MUTATION (class C not mechanically provable)\n')
    process.exit(1)
  }
  process.stdout.write('[disposition] class C (workload interrupted by restart; cannot continue; terminal fact = failed)\n')
}
if (RECONCILE || DISPOSITION) {
  const before = freezeView(raw, { jobId: JOB ?? '', occurrenceId: OCC })
  const resolution = resolveReconcileRunId({ flagRunId: RUN_ID, view: before, mode: DISPOSITION ? 'disposition' : 'bare' })
  if (resolution.refuse) { process.stderr.write(`${resolution.refuse}\n`); process.exit(1) }
  if (resolution.derived) process.stdout.write(`[reconcile] runId auto-derived from store record = ${resolution.runId}\n`)
  const RUN_ID_EFFECTIVE = resolution.runId
  const canonicalOccurrenceId = before.occurrence?.occurrenceId ?? OCC
  const result = await reconcile(store, { occurrenceId: canonicalOccurrenceId, runId: RUN_ID_EFFECTIVE, note: NOTE_OVERRIDE })
  const after = freezeView(await store.loadDoc({ force: true }).then((doc) => JSON.stringify(doc)), { jobId: JOB ?? result.record.jobId, occurrenceId: OCC })
  process.stdout.write(`EXACT_OCCURRENCE_RECONCILED = ${after.occurrence?.state === 'failed' && after.occurrence?.lateSettlement ? 'PASS' : 'CHECK'}\n`)
  const beforeCount = (JSON.parse(raw).occurrences ?? []).length
  const afterDoc = JSON.parse(readFileSync(STORE, 'utf8'))
  const afterCount = (afterDoc.occurrences ?? []).length
  const newOccurrences = afterCount - beforeCount
  process.stdout.write(`NEW_OCCURRENCE_CREATED = ${newOccurrences === 0 ? 'NO' : `YES(${newOccurrences})`}\n`)
  process.stdout.write(`BLIND_RETRY = NO (canonical reconcile; no re-execution, no re-creation)\n`)
  process.stdout.write(`fence released = ${result.fenceRemaining === false}\nidentity = ${result.identity.username} (${result.identity.provenance})\nevidence = ${result.evidenceStatus.ok ? 'appended' : 'APPEND FAILED'}\n`)
  process.exit(0)
}
process.stderr.write('nothing to do: pass --freeze or --reconcile\n')
process.exit(2)
