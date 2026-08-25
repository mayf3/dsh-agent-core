#!/usr/bin/env node
/**
 * openclaw-job-import — migrate the real OpenClaw cron inventory into the
 * Agent Core scheduler store (dry-run by default, V2 semantics).
 *
 *   node scripts/openclaw-job-import.mjs                  # report only
 *   node scripts/openclaw-job-import.mjs --write          # write definitions
 *   node scripts/openclaw-job-import.mjs --force          # definitions-only
 *                                                         # replacement over an
 *                                                         # existing store
 *   node scripts/openclaw-job-import.mjs --fixture        # use the redacted
 *                                                         # fixture instead of
 *                                                         # ~/.openclaw/cron/jobs.json
 *   node scripts/openclaw-job-import.mjs --store <path>   # target store
 *
 * V2 GUARD (SCHEDULER_TIMEOUT_OUTCOME_V2 C-034 / D-007 §15):
 *   - `--write` REFUSES when the target store exists or contains
 *     jobs/occurrences (checked against the LATEST state inside the mutation
 *     lock — no TOCTOU).
 *   - `--force` authorizes a DEFINITIONS-ONLY replacement: `jobs` is
 *     replaced; `occurrences` / `fences` / occurrence `history` are preserved
 *     VERBATIM (occurrence authority is never deleted). An unsafe merge
 *     (rebinding live occurrence semantics) fails loud. stop/drain of the
 *     Control Plane is a prerequisite, NOT an authority waiver; --force is
 *     still bound by no-catch-up / state-strip / keep-disabled / restore gate.
 *   - Definition-only import: legacy execution state and legacy session
 *     fields are stripped + reported; in-flight markers are reported and
 *     never become running truth; stale one-shots are not imported; missed
 *     occurrences are NEVER replayed (NO_CATCH_UP).
 *
 * The compatibility number expresses STRUCTURAL compatibility / importability
 * (every imported job is V2-valid and lossless in field mapping); it is not a
 * claim of semantic equivalence for every future execution.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { importOpenClawJobs, writeImportToStore } from '../packages/scheduler/src/import-openclaw.js'
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
  source = live.jobs ?? []
  sourceLabel = `~/.openclaw/cron/jobs.json (${source.length} definitions; enabled state preserved only as report input)`
}

const { jobs, report } = importOpenClawJobs(source, { nowMs: Date.now() })
const pct = report.total === 0 ? 0 : Math.round((report.imported / report.total) * 1000) / 10

console.log(`== OpenClaw → Agent Core scheduler V2 import report (definition-only) ==`)
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
    // C-034: the guard + definitions-only replacement run INSIDE the mutation
    // lock against the LATEST target state — occurrence authority
    // (occurrences/fences/history) is preserved verbatim under --force.
    const result = await writeImportToStore(store, jobs, { force })
    console.log(`wrote ${jobs.length} definition(s); preserved occurrence authority: `
      + `${result.preserved.occurrences} occurrence record(s), ${result.preserved.fences} fence(s)`)
  } catch (error) {
    if (error?.code === 'IMPORT_REFUSED') {
      process.stderr.write(
        `\n[openclaw-job-import] REFUSED: target store ${storePath} already exists / already has jobs or occurrence authority.\n`
        + `Stop/drain the Control Plane first; --force performs a DEFINITIONS-ONLY replacement that still\n`
        + `preserves occurrence records, fences and history verbatim (C-034).\n`,
      )
      process.exit(3)
    }
    if (error?.code === 'IMPORT_UNSAFE_MERGE') {
      process.stderr.write(`\n[openclaw-job-import] UNSAFE MERGE: ${error.message}\n`)
      process.exit(4)
    }
    throw error
  }
  console.log(`\nwrote ${jobs.length} disabled definitions to ${storePath} (atomic replace under store lock)`)
  console.log('restore gate remains CLOSED: no imported definition was enabled, no legacy execution')
  console.log('state was carried, and no missed or one-shot occurrence was replayed.')
} else {
  console.log('\n(dry-run: pass --write to persist; --force to overwrite an existing store)')
}
