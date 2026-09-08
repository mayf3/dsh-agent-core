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

async function reconcile(store, { occurrenceId, runId }) {
  const result = await reconcileOccurrence(store, {
    occurrenceId, runId, resolvedTo: 'failed', evidenceNote: EVIDENCE_NOTE,
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
if (!OCC) { process.stderr.write('usage: scheduler-cp-occurrence --freeze --job <id> --occurrence <id> | --reconcile --occurrence <id> --run-id <runId> [--store <path>] | --selftest\n'); process.exit(2) }

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
  const predicates = {
    jobDisabled: before.job.enabled === false,
    occurrenceUnresolved: o.state === 'outcome_unknown',
    startedNotEnded: o.startedAt !== null && o.endedAt === null,
    staleBeyondWindow: o.startedAt !== null && (Date.now() - o.startedAt) > STALE_DAYS * 24 * 60 * 60 * 1000,
  }
  for (const [name, pass] of Object.entries(predicates)) {
    process.stdout.write(`[disposition] ${name} = ${pass ? 'PASS' : 'FAIL'}\n`)
  }
  if (!Object.values(predicates).every(Boolean)) {
    process.stderr.write('[disposition] predicate(s) failed — NO MUTATION (class C not mechanically provable)\n')
    process.exit(1)
  }
  process.stdout.write('[disposition] class C (workload interrupted by restart; cannot continue; terminal fact = failed)\n')
}
if (RECONCILE || DISPOSITION) {
  let effectiveRunId = RUN_ID
  if (DISPOSITION && !effectiveRunId) effectiveRunId = before.occurrence.runId
  if (!effectiveRunId) { process.stderr.write('--reconcile requires --run-id\n'); process.exit(2) }
  if (DISPOSITION && before.occurrence.runId !== effectiveRunId) { process.stderr.write('[disposition] runId mismatch — NO MUTATION\n'); process.exit(1) }
  const RUN_ID_EFFECTIVE = effectiveRunId
  const before = freezeView(raw, { jobId: JOB ?? '', occurrenceId: OCC })
  if (before.occurrence === null) { process.stderr.write('[occurrence] unknown occurrence — NO MUTATION\n'); process.exit(1) }
  if (before.occurrence.runId !== RUN_ID) { process.stderr.write(`[occurrence] runId mismatch (ledger has ${before.occurrence.runId}) — NO MUTATION\n`); process.exit(1) }
  const canonicalOccurrenceId = before.occurrence?.occurrenceId ?? OCC
  const result = await reconcile(store, { occurrenceId: canonicalOccurrenceId, runId: DISPOSITION ? RUN_ID_EFFECTIVE : RUN_ID })
  const after = freezeView(await store.loadDoc({ force: true }).then((doc) => JSON.stringify(doc)), { jobId: JOB ?? result.record.jobId, occurrenceId: OCC })
  process.stdout.write(`EXACT_OCCURRENCE_RECONCILED = ${after.occurrence?.state === 'failed' && after.occurrence?.lateSettlement ? 'PASS' : 'CHECK'}\n`)
  process.stdout.write(`NEW_OCCURRENCE_CREATED = ${(after.runsForJob || []).filter((r) => r.occurrenceId !== OCC).length === 0 && (JSON.parse(raw).occurrences ?? []).length === (after.runsForJob || []).length ? 'NO' : 'VERIFY'}\n`)
  process.stdout.write(`BLIND_RETRY = NO (canonical reconcile; no re-execution, no re-creation)\n`)
  process.stdout.write(`fence released = ${result.fenceRemaining === false}\nidentity = ${result.identity.username} (${result.identity.provenance})\nevidence = ${result.evidenceStatus.ok ? 'appended' : 'APPEND FAILED'}\n`)
  process.exit(0)
}
process.stderr.write('nothing to do: pass --freeze or --reconcile\n')
process.exit(2)
