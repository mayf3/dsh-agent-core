#!/usr/bin/env node
/**
 * openclaw-job-import — migrate the real OpenClaw cron inventory into the
 * Agent Core scheduler store (dry-run by default).
 *
 *   node scripts/openclaw-job-import.mjs                  # report only
 *   node scripts/openclaw-job-import.mjs --write          # write V1 store
 *   node scripts/openclaw-job-import.mjs --force          # allow overwriting
 *                                                         # an existing store
 *   node scripts/openclaw-job-import.mjs --fixture        # use the redacted
 *                                                         # fixture instead of
 *                                                         # ~/.openclaw/cron/jobs.json
 *   node scripts/openclaw-job-import.mjs --store <path>   # target store
 *
 * EXISTING-STORE GUARD (audit FIX 5): once the Agent Core scheduler store
 * exists (i.e. the Control Plane may already be executing jobs), `--write`
 * REFUSES by default — importing an old OpenClaw snapshot over a live store
 * could resurrect already-executed one-shots or roll back state. Overwrite
 * requires an explicit `--force` after stopping/draining the Control Plane.
 *
 * In-flight jobs in the source (state.runningAtMs set) are reported, never
 * silently treated as safe: the migration sequence is
 *
 *   stop/drain the stock-agent OpenClaw write path (daemons, scheduler)
 *   -> snapshot (~/.openclaw/cron/jobs.json)
 *   -> import ONCE (this tool)
 *   -> Agent Core takes over execution
 *
 * No continuous sync is built or planned.
 *
 * The compatibility number expresses STRUCTURAL compatibility / importability
 * (every imported job is V1-valid and lossless in field mapping); it is not a
 * claim of semantic equivalence for every future execution.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { importOpenClawJobs } from '../packages/scheduler/src/import-openclaw.js'
import { JobStore } from '../packages/scheduler/src/store.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const fixturePath = join(root, 'packages', 'scheduler', 'fixtures', 'openclaw-jobs-enabled.json')

const args = process.argv.slice(2)
const write = args.includes('--write')
const force = args.includes('--force')
const useFixture = args.includes('--fixture')
const storeIdx = args.indexOf('--store')
const storePath = storeIdx >= 0 && args[storeIdx + 1]
  ? args[storeIdx + 1]
  : process.env.AGENTCORE_SCHEDULER_STORE
    ?? join(homedir(), '.agent-core', 'scheduler', 'jobs.json')

let source
let sourceLabel
if (useFixture) {
  source = JSON.parse(readFileSync(fixturePath, 'utf8')).jobs
  sourceLabel = `redacted fixture (${source.length} enabled jobs)`
} else {
  const livePath = join(homedir(), '.openclaw', 'cron', 'jobs.json')
  if (!existsSync(livePath)) {
    process.stderr.write(`[openclaw-job-import] ${livePath} not found (use --fixture)\n`)
    process.exit(2)
  }
  const live = JSON.parse(readFileSync(livePath, 'utf8'))
  source = (live.jobs ?? []).filter((j) => j.enabled === true)
  sourceLabel = `~/.openclaw/cron/jobs.json (${source.length} enabled jobs)`
}

const { jobs, report } = importOpenClawJobs(source, { nowMs: Date.now() })
const pct = report.total === 0 ? 0 : Math.round((report.imported / report.total) * 1000) / 10

console.log(`== OpenClaw → Agent Core scheduler V1 import report ==`)
console.log(`source : ${sourceLabel}`)
console.log(`store  : ${storePath} (${write ? 'WRITE' : 'dry-run'})`)
console.log(`structurally compatible / importable: ${report.imported}/${report.total} (${pct}%)`)
console.log(`gaps   : ${report.gaps.length}`)
for (const gap of report.gaps) {
  console.log(`  GAP ${gap.name} (${gap.id}): ${gap.reason}`)
}
if (report.inFlight.count > 0) {
  console.log(`in-flight (runningAtMs set in source — NOT treated as safe): ${report.inFlight.count}`)
  for (const j of report.inFlight.jobs) {
    console.log(`  RUNNING ${j.name} (${j.id}) agent=${j.agentId} — drain/decide before Agent Core takes over`)
  }
} else {
  console.log('in-flight (runningAtMs set in source): 0')
}
if (report.warnings.length > 0) {
  const byJob = new Map()
  for (const w of report.warnings) {
    if (!byJob.has(w.name)) byJob.set(w.name, [])
    byJob.get(w.name).push(w.detail)
  }
  console.log(`warnings: ${report.warnings.length} (dormant fields dropped)`)
  for (const [name, details] of byJob) {
    console.log(`  ${name}: ${[...new Set(details)].join('; ')}`)
  }
}

if (write) {
  const store = new JobStore(storePath)
  try {
    // TOCTOU guard (audit round 3): the existence check runs INSIDE the
    // mutation lock against the LATEST store — a job created by the resident
    // engine or the CLI while this import was starting is seen here and
    // refuses the import instead of being overwritten. No pre-lock check.
    await store.mutate(async (latest) => {
      if (!force && (latest.length > 0 || await store.exists())) {
        const error = new Error('target store already exists / already has jobs')
        error.code = 'IMPORT_REFUSED'
        throw error
      }
      return jobs // whole-store replace (explicit --force overwrite semantics)
    })
  } catch (error) {
    if (error?.code === 'IMPORT_REFUSED') {
      process.stderr.write(
        `\n[openclaw-job-import] REFUSED: target store ${storePath} already exists / already has jobs — the Control Plane `
        + `may be executing jobs; importing an old OpenClaw snapshot could resurrect `
        + `already-executed one-shots or roll back state (audit FIX 5 / TOCTOU guard).\n`
        + `Stop/drain the Control Plane, then retry with --force for an explicit overwrite.\n`,
      )
      process.exit(3)
    }
    throw error
  }
  console.log(`\nwrote ${jobs.length} jobs to ${storePath} (atomic replace under store lock)`)
  console.log('next: start the Control Plane scheduler over this store; jobs resume with their')
  console.log('      imported nextRunAtMs / lastRunAtMs (missed occurrences catch up at most once).')
} else {
  console.log('\n(dry-run: pass --write to persist; --force to overwrite an existing store)')
}
