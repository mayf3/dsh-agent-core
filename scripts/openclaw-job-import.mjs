#!/usr/bin/env node
/**
 * openclaw-job-import — migrate the real OpenClaw cron inventory into the
 * Agent Core scheduler store (dry-run by default).
 *
 *   node scripts/openclaw-job-import.mjs                  # report only
 *   node scripts/openclaw-job-import.mjs --write          # write V1 store
 *   node scripts/openclaw-job-import.mjs --fixture        # use the redacted
 *                                                         # fixture instead of
 *                                                         # ~/.openclaw/cron/jobs.json
 *   node scripts/openclaw-job-import.mjs --store <path>   # target store
 *
 * The report shows exactly which jobs are lossless and which cannot be
 * expressed (real gaps), so the migration decision stays evidence-based.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { importOpenClawJobs } from '../packages/scheduler/src/import-openclaw.js'
import { JobStore } from '../packages/scheduler/src/store.js'
import { normalizeState } from '../packages/scheduler/src/job-model.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const fixturePath = join(root, 'packages', 'scheduler', 'fixtures', 'openclaw-jobs-enabled.json')

const args = process.argv.slice(2)
const write = args.includes('--write')
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
console.log(`lossless: ${report.imported}/${report.total} (${pct}%)`)
console.log(`gaps   : ${report.gaps.length}`)
for (const gap of report.gaps) {
  console.log(`  GAP ${gap.name} (${gap.id}): ${gap.reason}`)
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
  const stored = jobs.map((job) => ({ ...job, state: normalizeState(job.state ?? {}) }))
  await store.persist(stored)
  console.log(`\nwrote ${stored.length} jobs to ${storePath} (atomic replace)`)
  console.log('next: run the Control Plane scheduler over this store; jobs resume with their')
  console.log('      imported nextRunAtMs / lastRunAtMs (missed occurrences catch up at most once).')
} else {
  console.log('\n(dry-run: pass --write to persist)')
}
