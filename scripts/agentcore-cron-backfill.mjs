#!/usr/bin/env node
/**
 * agentcore-cron-backfill — ONE-SHOT logicalKey backfill tool
 * (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 RUNBOOK §3.1).
 *
 * Assigns the Owner-frozen logicalKey mapping to EXISTING canonical jobs that
 * predate the logical-key contract. This is the ONLY sanctioned mass key
 * assignment; it runs on the SAME control-op mutation face as everything else
 * (updateJobOp under the cross-process lock), is audited per job
 * (appendRunEvent 'logical_key_backfill' with before/after digests), is
 * IDEMPOTENT (jobs already carrying the identical key are skipped;
 * conflicting bindings fail closed listing both jobs), and is DRY-RUN BY
 * DEFAULT (--apply is the explicit mutation consent).
 *
 * Mapping file (JSON): [{"jobId": "<uuid>", "logicalKey": "<owner:key>"}, ...]
 *   - every jobId must exist; every key non-empty; keys unique within the file;
 *   - a key already bound to a DIFFERENT job -> CONFLICT, nothing applied.
 *
 * Owner discipline: --selftest MUST pass (stub store, full round trip) before
 * this tool is handed over for a production run.
 *
 * Usage:
 *   agentcore-cron-backfill --mapping <file> [--store <path>] [--dry-run] [--apply] [--selftest] [--json]
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { JobStore } from '../packages/scheduler/src/store.js'
import { updateJobOp } from '../packages/scheduler/src/control.js'
import { canonicalJSON } from '../packages/scheduler/src/occurrence-model.js'
import { createHash } from 'node:crypto'

const args = process.argv.slice(2)
const flag = (name) => (args.includes(name) ? true : undefined)
const value = (name) => {
  const idx = args.indexOf(name)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : undefined
}
const APPLY = flag('--apply') === true
const SELFTEST = flag('--selftest') === true
const JSON_OUT = flag('--json') === true
const MAPPING = value('--mapping')
const STORE_ARG = value('--store') ?? process.env.AGENTCORE_SCHEDULER_STORE
  ?? join(homedir(), '.agent-core', 'scheduler', 'jobs.json')

const sha = (job) => `sha256:${createHash('sha256').update(canonicalJSON(job)).digest('hex')}`
const storedDefinition = (job) => {
  const { state, ...rest } = job
  for (const k of ['nextRunAtMs', 'lastRunAtMs', 'lastStatus', 'lastRunStatus', 'lastDurationMs', 'lastDeliveryStatus', 'lastError', 'consecutiveErrors']) delete rest[k]
  return rest
}

function parseMapping(raw) {
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new TypeError('mapping must be a JSON array of {jobId, logicalKey}')
  const seenJobs = new Set()
  const seenKeys = new Map()
  for (const entry of parsed) {
    if (entry === null || typeof entry !== 'object') throw new TypeError('mapping entries must be objects')
    if (typeof entry.jobId !== 'string' || entry.jobId.trim() === '') throw new TypeError('mapping entry requires non-empty jobId')
    if (typeof entry.logicalKey !== 'string' || entry.logicalKey.trim() === '') throw new TypeError('mapping entry requires non-empty logicalKey')
    if (seenJobs.has(entry.jobId)) throw new TypeError(`duplicate jobId in mapping: ${entry.jobId}`)
    if (seenKeys.has(entry.logicalKey)) throw new TypeError(`duplicate logicalKey in mapping: ${entry.logicalKey} (also -> ${seenKeys.get(entry.logicalKey)})`)
    seenJobs.add(entry.jobId)
    seenKeys.set(entry.logicalKey, entry.jobId)
  }
  return parsed
}

/** Plan (and, with --apply, execute) the backfill. Returns the report object. */
async function backfill(store, mapping, { apply }) {
  const doc = await store.loadDoc({ force: true })
  const byId = new Map(doc.jobs.map((job) => [job.id, job]))
  const keyIndex = new Map(doc.jobs.filter((job) => job.logicalKey !== undefined).map((job) => [job.logicalKey, job.id]))
  const report = { apply, results: [], conflicts: [], skipped: 0, applied: 0 }
  for (const entry of mapping) {
    const base = { jobId: entry.jobId, logicalKey: entry.logicalKey }
    const job = byId.get(entry.jobId)
    if (job === undefined) {
      report.conflicts.push({ ...base, reason: 'job_not_found' })
      continue
    }
    if (job.logicalKey === entry.logicalKey) {
      report.skipped += 1
      report.results.push({ ...base, outcome: 'already_keyed' })
      continue
    }
    if (job.logicalKey !== undefined) {
      report.conflicts.push({ ...base, reason: `job already keyed '${job.logicalKey}'` })
      continue
    }
    const holder = keyIndex.get(entry.logicalKey)
    if (holder !== undefined && holder !== entry.jobId) {
      report.conflicts.push({ ...base, reason: `logical key already bound to job ${holder}` })
      continue
    }
    if (!apply) {
      report.results.push({ ...base, outcome: 'planned' })
      continue
    }
    const before = sha(storedDefinition(job))
    const updated = await updateJobOp(store, entry.jobId, { logicalKey: entry.logicalKey })
    const after = sha(storedDefinition(updated))
    // logicalKey is OUTSIDE the D-007 semantic surface: scheduleRevision must
    // not move — a backfill must never mint a new future-slot space.
    if (updated.scheduleRevision !== job.scheduleRevision) {
      throw new Error(`backfill bumped scheduleRevision on ${entry.jobId} — aborting invariant`)
    }
    await store.appendRunEvent({
      ts: Date.now(), action: 'logical_key_backfill', jobId: entry.jobId,
      logicalKey: entry.logicalKey, beforeDigest: before, afterDigest: after,
    })
    keyIndex.set(entry.logicalKey, entry.jobId)
    report.applied += 1
    report.results.push({ ...base, outcome: 'applied', scheduleRevision: updated.scheduleRevision })
  }
  report.ok = report.conflicts.length === 0
  return report
}

function render(report) {
  for (const conflict of report.conflicts) {
    process.stderr.write(`[backfill] CONFLICT ${conflict.jobId} -> ${conflict.logicalKey}: ${conflict.reason}\n`)
  }
  for (const r of report.results) {
    process.stdout.write(`[backfill] ${r.outcome.padEnd(13)} ${r.jobId} -> ${r.logicalKey}${r.scheduleRevision !== undefined ? ` (rev ${r.scheduleRevision})` : ''}\n`)
  }
  process.stdout.write(`[backfill] mode=${report.apply ? 'APPLY' : 'DRY-RUN'} applied=${report.applied} skipped=${report.skipped} conflicts=${report.conflicts.length} ok=${report.ok}\n`)
}

async function selftest() {
  const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const dir = mkdtempSync(join(tmpdir(), 'backfill-selftest-'))
  try {
    const storePath = join(dir, 'jobs.json')
    const store = new JobStore(storePath, { runLogPath: join(dir, 'runs.jsonl') })
    // Seed THREE keyless jobs through the normal create op.
    const created = []
    for (const name of ['alpha', 'beta', 'gamma']) {
      created.push(await (await import('../packages/scheduler/src/control.js')).createJobOp(store, {
        name, agentId: `agt_${name}`, schedule: { kind: 'cron', expr: '0 22 * * *', tz: 'Asia/Shanghai' },
        payload: { kind: 'agentTurn', message: 'seed' }, delivery: { mode: 'none' },
      }))
    }
    const mappingFile = join(dir, 'mapping.json')
    writeFileSync(mappingFile, JSON.stringify([
      { jobId: created[0].id, logicalKey: 'owner:alpha' },
      { jobId: created[1].id, logicalKey: 'owner:beta' },
      { jobId: created[2].id, logicalKey: 'owner:beta' }, // duplicate key inside file
    ]))
    let assertions = 0
    const ok = (cond, label) => { if (!cond) throw new Error(`selftest assertion failed: ${label}`); assertions += 1 }

    // 1. duplicate key inside the mapping file -> parse fail
    let threw = false
    try { parseMapping(readFileSync(mappingFile, 'utf8')) } catch { threw = true }
    ok(threw, 'duplicate key rejected at parse')

    // 2. dry-run plans without writing
    writeFileSync(mappingFile, JSON.stringify([
      { jobId: created[0].id, logicalKey: 'owner:alpha' },
      { jobId: created[1].id, logicalKey: 'owner:beta' },
    ]))
    const mapping = parseMapping(readFileSync(mappingFile, 'utf8'))
    const plan = await backfill(store, mapping, { apply: false })
    ok(plan.ok && plan.results.every((r) => r.outcome === 'planned'), 'dry-run plans')
    ok((await store.loadDoc({ force: true })).jobs.every((job) => job.logicalKey === undefined), 'dry-run writes nothing')

    // 3. apply -> keys landed, revision NOT bumped, audit events appended
    const applied = await backfill(store, mapping, { apply: true })
    ok(applied.applied === 2 && applied.ok, 'apply lands both keys')
    const doc = await store.loadDoc({ force: true })
    ok(doc.jobs.find((job) => job.name === 'alpha').logicalKey === 'owner:alpha', 'alpha keyed')
    ok(doc.jobs.every((job) => job.scheduleRevision === 1), 'backfill never bumps scheduleRevision')
    const events = (await store.readRunEvents({ limit: 100 })).filter((e) => e.action === 'logical_key_backfill')
    ok(events.length === 2 && events.every((e) => e.beforeDigest && e.afterDigest), 'audited with digests')

    // 4. idempotent re-run -> skipped
    const rerun = await backfill(store, mapping, { apply: true })
    ok(rerun.skipped === 2 && rerun.applied === 0, 're-run skips already-keyed')

    // 5. conflict: key already bound to a DIFFERENT job -> fail closed, zero write
    const conflict = await backfill(store, [{ jobId: created[2].id, logicalKey: 'owner:alpha' }], { apply: true })
    ok(!conflict.ok && conflict.conflicts[0].reason.includes('already bound'), 'cross-job binding conflict fails closed')
    ok((await store.loadDoc({ force: true })).jobs.find((job) => job.name === 'gamma').logicalKey === undefined, 'conflict writes nothing')

    const unknown = await backfill(store, [{ jobId: 'no-such-job', logicalKey: 'owner:x' }], { apply: true })
    ok(!unknown.ok && unknown.conflicts[0].reason === 'job_not_found', 'unknown job fails closed')

    process.stdout.write(`[backfill selftest] PASS (${assertions} assertions, stub store ${storePath})\n`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (SELFTEST) {
  await selftest()
  process.exit(0)
}
if (MAPPING === undefined) {
  process.stderr.write('usage: agentcore-cron-backfill --mapping <file> [--store <path>] [--apply] [--json] | --selftest\n')
  process.exit(2)
}
const report = await backfill(new JobStore(STORE_ARG, { runLogPath: join(STORE_ARG, '..', 'runs.jsonl') }), parseMapping(readFileSync(MAPPING, 'utf8')), { apply: APPLY })
if (JSON_OUT) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
else render(report)
process.exit(report.ok ? 0 : 1)
