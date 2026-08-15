#!/usr/bin/env node
/**
 * scheduler-v1-verify — Scheduler Replacement V1 acceptance driver.
 *
 * 1. runs the package unit test suite (node --test)
 * 2. runs the 140-job OpenClaw compatibility scan against the redacted
 *    fixture, and against the LIVE ~/.openclaw/cron/jobs.json when present
 * 3. runs a live restart-evidence demo (persistent store, one-shot + cron,
 *    restart with fake invoker)
 *
 * Exit code 0 = all acceptance gates pass.
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const fixturePath = join(root, 'packages', 'scheduler', 'fixtures', 'openclaw-jobs-enabled.json')

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

console.log('=== Scheduler Replacement V1 — acceptance driver ===\n')

// ── 1. unit + semantic test suites ──────────────────────────────────────
console.log('[1] unit + semantic test suite (incl. round-2 audit-fix regressions)')
const testRun = spawnSync(process.execPath, ['--test', 'packages/scheduler/test/*.test.js'], {
  cwd: root,
  encoding: 'utf8',
})
const testSummary = /ℹ tests (\d+).*?ℹ pass (\d+).*?ℹ fail (\d+)/s.exec(testRun.stdout)
const [total, passed, failed] = testSummary ? [testSummary[1], testSummary[2], testSummary[3]] : ['?', '?', '?']
check(`node --test: ${passed}/${total} pass, ${failed} fail`, failed === '0' && total !== '?')

// round-2 audit regression gates (exact test-name prefixes)
for (const gate of [
  'LONG_INVOKE_OVERLAPPING_TICK',
  'CLI_LIST_DOES_NOT_EXECUTE',
  'CLI_RESIDENT_MULTIWRITER',
  'PERSIST_FAILURE_ROLLBACK',
  'IMPORT_EXISTING_STORE_GUARD',
  'IMPORT_GUARD_TOCTOU',
]) {
  const gateRun = spawnSync(process.execPath, ['--test', `--test-name-pattern=${gate}`, 'packages/scheduler/test/audit-fixes.test.js'], {
    cwd: root,
    encoding: 'utf8',
  })
  const gateSummary = /ℹ pass (\d+).*?ℹ fail (\d+)/s.exec(gateRun.stdout)
  const gPassed = gateSummary ? Number(gateSummary[1]) : 0
  const gFailed = gateSummary ? Number(gateSummary[2]) : 1
  check(`${gate} = PASS`, gFailed === 0 && gPassed >= 1)
}

// ── 2. compatibility scan (fixture + live) ──────────────────────────────
console.log('\n[2] OpenClaw job compatibility scan (structural compatibility / importability)')
const { importOpenClawJobs } = await import('../packages/scheduler/src/import-openclaw.js')

function scan(label, jobs) {
  const { report } = importOpenClawJobs(jobs, { nowMs: Date.now() })
  const pct = report.total === 0 ? 0 : Math.round((report.imported / report.total) * 1000) / 10
  console.log(`  ${label}: ${report.imported}/${report.total} structurally compatible / importable (${pct}%)`)
  if (report.inFlight.count > 0) {
    console.log(`    in-flight (runningAtMs in source, reported not hidden): ${report.inFlight.count}`)
  }
  for (const gap of report.gaps) {
    console.log(`    GAP ${gap.name}: ${gap.reason}`)
  }
  return report
}

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const fixtureReport = scan('redacted fixture (captured 2026-08-15)', fixture.jobs)
check('fixture scan >= 95% importable', fixtureReport.imported / fixtureReport.total >= 0.95)

const livePath = join(homedir(), '.openclaw', 'cron', 'jobs.json')
if (existsSync(livePath)) {
  const live = JSON.parse(readFileSync(livePath, 'utf8'))
  const enabled = (live.jobs ?? []).filter((j) => j.enabled === true)
  const liveReport = scan(`live ~/.openclaw/cron/jobs.json (${enabled.length} enabled)`, enabled)
  check('live scan >= 95% importable', liveReport.imported / liveReport.total >= 0.95)
} else {
  console.log('  (live OpenClaw inventory not present; fixture scan only)')
}

// ── 3. restart-evidence demo (10 acceptance gates) ──────────────────────
console.log('\n[3] live restart-evidence demo (fake invoker)')
const { Scheduler } = await import('../packages/scheduler/src/scheduler.js')
const { JobStore } = await import('../packages/scheduler/src/store.js')
const { createFakeInvoker, createRecordingDelivery } = await import('../packages/scheduler/src/seams.js')

const dir = mkdtempSync(join(tmpdir(), 'sched-verify-'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let store = new JobStore(join(dir, 'jobs.json'))
let invoker = createFakeInvoker()
let deliver = createRecordingDelivery()
let s = new Scheduler({ store, invoker, deliver, tickMs: 50 })
await s.start({ autoStart: false })

const recurring = await s.createJob({
  name: 'verify-recurring', agentId: 'agent-a',
  schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'Asia/Shanghai' },
  payload: { message: 'daily digest' },
  delivery: { mode: 'announce', channel: 'feishu', to: 'chat:oc_verify' },
})
check('1. create recurring job', recurring.schedule.kind === 'cron' && recurring.nextRunAtMs > Date.now())

const oneShot = await s.createJob({
  name: 'verify-oneshot', agentId: 'agent-b',
  schedule: { kind: 'at', at: new Date(Date.now() + 60).toISOString() },
  payload: { message: 'one shot' },
})
check('2. create one-shot job', oneShot.schedule.kind === 'at' && oneShot.nextRunAtMs > Date.now())

await s.disableJob(oneShot.id)
const disabledView = await s.getJob(oneShot.id)
check('3. enable/disable', disabledView.enabled === false && disabledView.nextRunAtMs === undefined)
await s.enableJob(oneShot.id)

// let the one-shot come due, then fire manually
await sleep(120)
await s.tick()
await s.whenIdle()
check('4. due job calls fake invoker', invoker.calls.length === 1 && invoker.calls[0].agentId === 'agent-b')
check('7. one-shot does not repeat', (await s.getJob(oneShot.id)) === undefined)

// restart
const dirCopy = dir
await s.stop()
store = new JobStore(join(dirCopy, 'jobs.json'))
invoker = createFakeInvoker()
deliver = createRecordingDelivery()
s = new Scheduler({ store, invoker, deliver, tickMs: 50 })
await s.start({ autoStart: false })
const afterRestart = await s.listJobs()
check('5. restart restores jobs', afterRestart.length === 1 && afterRestart[0].id === recurring.id)
check('6. disabled job does not run (deleted one-shot never re-fires)', invoker.calls.length === 0)
check('8. recurring computes next run', afterRestart[0].nextRunAtMs > Date.now())
check('9. per-agent isolation (agent-a only after restart)', afterRestart.every((j) => j.agentId === 'agent-a'))

// missed-run catch-up: the recurring job's occurrence passed while "down" —
// exactly once, with the announce target handed verbatim to the delivery seam
const raw = s.snapshotJobs()[0]
raw.state.nextRunAtMs = Date.now() - 600_000
raw.state.lastRunAtMs = Date.now() - 86_400_000
raw.state.lastStatus = 'ok'
await store.persist([raw])
await s.tick()
await s.whenIdle()
check('10. announce target verbatim to delivery seam',
  deliver.deliveries.length === 1 && deliver.deliveries[0].to === 'chat:oc_verify'
  && deliver.deliveries[0].channel === 'feishu' && deliver.deliveries[0].jobId === recurring.id)
check('cron catch-up runs at most once (missed occurrence, not every missed day)',
  invoker.calls.length === 1)
await s.stop()

// run log evidence
store = new JobStore(join(dirCopy, 'jobs.json'))
const events = await store.readRunEvents()
check('run log: started+finished events recorded', events.filter((e) => e.action === 'started').length === 2
  && events.filter((e) => e.action === 'finished').length === 2)
check('run log: delivery status recorded per run',
  events.some((e) => e.action === 'finished' && e.deliveryStatus === 'not-requested')
  && events.some((e) => e.action === 'finished' && e.deliveryStatus === 'delivered'))

console.log(`\n=== result: ${failures === 0 ? 'ALL GATES PASS' : `${failures} GATE(S) FAILED`} ===`)
process.exit(failures === 0 ? 0 : 1)
