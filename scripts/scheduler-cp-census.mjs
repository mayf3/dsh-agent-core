#!/usr/bin/env node
/**
 * scheduler-cp-census — READ-ONLY canonical store census
 * (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1, RUNBOOK §1.2 privileged seam).
 *
 * ZERO MUTATION BY CONSTRUCTION: the store file is opened read-only; no
 * lockfile is taken; no JobStore instance is created (raw JSON parse). Used
 * to disambiguate the critical-job predicate before any admission write.
 * Message bodies are stripped — payload.message never leaves the host.
 *
 *   --store <path>   (default /Users/authsvc/.agent-core/scheduler/jobs.json)
 *   --json <file>    also write the full stripped census to a file
 *   --selftest       parser fixtures (CI-safe)
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const val = (n) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : undefined }
const SELFTEST = args.includes('--selftest')
const STORE = val('--store') ?? join(homedir(), '.agent-core', 'scheduler', 'jobs.json')
const JSON_OUT = val('--json')

/** Strip everything sensitive from a raw store doc. Pure. */
export function censusView(doc) {
  const jobs = (Array.isArray(doc?.jobs) ? doc.jobs : []).map((job) => ({
    id: job.id,
    name: job.name,
    logicalKey: job.logicalKey ?? null,
    agentId: job.agentId,
    enabled: job.enabled === true,
    schedule: job.schedule ?? null,
    deleteAfterRun: job.deleteAfterRun === true,
    delivery: job.delivery ? { mode: job.delivery.mode, channel: job.delivery.channel ?? null, to: job.delivery.to ?? null } : null,
    createdAtMs: job.createdAtMs,
    updatedAtMs: job.updatedAtMs,
    scheduleRevision: job.scheduleRevision,
    lastStatus: job.state?.lastStatus ?? job.state?.lastRunStatus ?? null,
    lastRunAtMs: job.state?.lastRunAtMs ?? null,
    consecutiveErrors: job.state?.consecutiveErrors ?? 0,
  }))
  return {
    version: doc?.version,
    jobCount: jobs.length,
    jobs,
    occurrenceCount: Array.isArray(doc?.occurrences) ? doc.occurrences.length : 0,
  }
}

if (SELFTEST) {
  const view = censusView(JSON.parse('{"version":2,"jobs":[{"id":"a","name":"n","agentId":"agt_x","enabled":true,"schedule":{"kind":"cron","expr":"0 22 * * *","tz":"Asia/Shanghai"},"payload":{"kind":"agentTurn","message":"SECRET-BODY"},"state":{"lastStatus":"ok","lastRunAtMs":5}}],"occurrences":[1,2]}'))
  const assert = (c, l) => { if (!c) { process.stderr.write(`[census selftest FAIL] ${l}\n`); process.exit(1) } }
  assert(view.jobCount === 1 && view.occurrenceCount === 2, 'counts')
  assert(!('payloadPreview' in view.jobs[0]), 'no payload field at all (strictest no-broadening)')
  assert(!JSON.stringify(view).includes('SECRET-BODY'), 'message body absent from the entire census view')
  assert(view.jobs[0].lastStatus === 'ok', 'state projected')
  process.stdout.write('[census selftest] PASS\n')
  process.exit(0)
}

const raw = readFileSync(STORE, 'utf8')
const view = censusView(JSON.parse(raw))
if (JSON_OUT) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(JSON_OUT, `${JSON.stringify(view, null, 2)}\n`)
  process.stdout.write(`[census] written ${JSON_OUT}\n`)
}
const iso = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : '-')
for (const job of view.jobs) {
  process.stdout.write(
    `${job.enabled ? 'enabled ' : 'DISABLED'} ${job.id.slice(0, 8)} key=${job.logicalKey ?? '-'} ${job.agentId} `
    + `${job.schedule?.kind ?? '?'}:${job.schedule?.kind === 'cron' ? `${job.schedule.expr}@${job.schedule.tz ?? '-'}` : job.schedule?.kind === 'at' ? job.schedule.at : job.schedule?.everyMs ?? '?'} `
    + `rev${job.scheduleRevision} last=${job.lastStatus ?? '-'}@${iso(job.lastRunAtMs).slice(0, 16)} name="${job.name}" ${job.payloadPreview}\n`)
}
process.stdout.write(`[census] store=v${view.version} jobs=${view.jobCount} occurrences=${view.occurrenceCount}\n`)
