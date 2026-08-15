import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { importOpenClawJobs } from '../src/import-openclaw.js'
import { normalizeJob, toPublicJob } from '../src/job-model.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(here, '..', 'fixtures', 'openclaw-jobs-enabled.json')
const FIXTURE = JSON.parse(readFileSync(fixturePath, 'utf8'))

test('fixture: 140 enabled real OpenClaw jobs captured', () => {
  assert.equal(FIXTURE.jobs.length, 140)
})

test('compatibility scan: 137/140 lossless, gaps are exactly the 3 no-agentId legacy jobs', () => {
  const { jobs, report } = importOpenClawJobs(FIXTURE.jobs, { nowMs: Date.now() })
  assert.equal(report.total, 140)
  assert.equal(report.imported, 137)
  assert.equal(report.gaps.length, 3)
  for (const gap of report.gaps) {
    assert.match(gap.reason, /no agentId/)
  }
  assert.deepEqual(report.gaps.map((g) => g.name).sort(), [
    'PPT设计师双周应用检查',
    'PPT设计师周内化',
    'PPT设计师每日学习',
  ])
  // every imported job is V1-valid by construction
  assert.equal(jobs.length, 137)
  for (const job of jobs) {
    assert.equal(job.agentId !== undefined, true)
    assert.ok(['cron', 'at', 'every'].includes(job.schedule.kind))
  }
})

test('compatibility scan: schedule kind + delivery mode distribution preserved', () => {
  const { jobs, report } = importOpenClawJobs(FIXTURE.jobs, { nowMs: Date.now() })
  const kinds = {}
  const modes = {}
  for (const job of jobs) {
    kinds[job.schedule.kind] = (kinds[job.schedule.kind] ?? 0) + 1
    modes[job.delivery.mode] = (modes[job.delivery.mode] ?? 0) + 1
  }
  // 117 cron in fixture; 3 gaps are cron jobs without agentId
  assert.equal(kinds.cron, 114)
  assert.equal(kinds.at, 15)
  assert.equal(kinds.every, 8)
  assert.equal(modes.announce, 90)
  assert.equal(modes.none, 45) // 48 in fixture minus the 3 no-agentId gaps (all mode:none)
  assert.equal(modes.silent, 2)
  // every imported job keeps its original id (identity preservation)
  const ids = new Set(jobs.map((j) => j.id))
  assert.equal(ids.size, 137)
})

test('compatibility scan: announce target chat ids survive verbatim', () => {
  const { jobs } = importOpenClawJobs(FIXTURE.jobs, { nowMs: Date.now() })
  const announce = jobs.filter((j) => j.delivery.mode === 'announce')
  assert.equal(announce.length, 90)
  const targets = new Set(announce.map((j) => j.delivery.to))
  // the real chat ids must appear unchanged
  assert.ok(targets.has('chat:oc_0480991b97f1e27c96514ac66b4f122c'))
  assert.ok(targets.has('chat:oc_2b5cfb7fca287c81cba3397ca9e07ce5'))
  // 1 announce job has no explicit target (channel last, bestEffort) — opaque passthrough
  const noTo = announce.filter((j) => !j.delivery.to)
  assert.equal(noTo.length, 1)
  assert.equal(noTo[0].name, '每日羊毛扫描')
  assert.equal(noTo[0].delivery.bestEffort, true)
})

test('import: recurring every jobs keep anchorMs; timeout fields normalize', () => {
  const { jobs } = importOpenClawJobs(FIXTURE.jobs, { nowMs: Date.now() })
  const every = jobs.find((j) => j.schedule.kind === 'every')
  assert.ok(every.schedule.everyMs >= 1)
  const withTimeout = jobs.find((j) => j.payload.timeoutSeconds !== undefined)
  assert.ok(withTimeout.payload.timeoutSeconds > 0)
  // no dormant top-level timeout fields survive
  for (const job of jobs) {
    assert.equal(job.timeoutSec, undefined)
    assert.equal(job.timeoutMs, undefined)
    assert.equal(job.runTimeoutMs, undefined)
  }
})

test('import: one-shot daemon jobs keep model + lightContext + deleteAfterRun', () => {
  const { jobs } = importOpenClawJobs(FIXTURE.jobs, { nowMs: Date.now() })
  const atJobs = jobs.filter((j) => j.schedule.kind === 'at')
  assert.equal(atJobs.length, 15)
  for (const job of atJobs) {
    assert.equal(job.deleteAfterRun, true, 'daemon one-shot jobs delete after run')
  }
  const withModel = atJobs.filter((j) => j.payload.model)
  assert.equal(withModel.length, 15, 'all one-shot jobs pin the flash model')
  assert.equal(atJobs.filter((j) => j.payload.lightContext).length, 10)
})

test('import: sessionKey jobs are carried as opaque session override', () => {
  const { jobs } = importOpenClawJobs(FIXTURE.jobs, { nowMs: Date.now() })
  const withKey = jobs.filter((j) => j.sessionKey)
  assert.equal(withKey.length, 7)
  for (const job of withKey) {
    // opaque session key: feishu-group sessions and parent cron sessions both
    // occur; prefix may differ from agentId (dispatcher-created jobs run in
    // the dispatcher's session) — V1 passes it through verbatim
    assert.ok(job.sessionKey.length > 8)
    assert.ok(job.sessionKey.includes(':'))
  }
})

test('normalizeJob: preserves input id; rejects unknown delivery modes', () => {
  const job = normalizeJob({
    id: 'keep-me', name: 'x', agentId: 'a1',
    schedule: { kind: 'at', at: '2026-09-01T00:00:00Z' },
    payload: { message: 'x' },
  })
  assert.equal(job.id, 'keep-me')
  assert.throws(() => normalizeJob({
    id: 'y', name: 'x', agentId: 'a1',
    schedule: { kind: 'at', at: '2026-09-01T00:00:00Z' },
    payload: { message: 'x' },
    delivery: { mode: 'telegram' },
  }), /delivery.mode/)
  assert.throws(() => normalizeJob({
    id: 'y', name: 'x', agentId: 'a1',
    schedule: { kind: 'cron', expr: '0 9 * *' }, // 4 fields
    payload: { message: 'x' },
  }), /5 fields/)
})

test('toPublicJob: exposes execution state but not raw state internals', () => {
  const job = normalizeJob({
    id: 'p', name: 'x', agentId: 'a1',
    schedule: { kind: 'at', at: '2026-09-01T00:00:00Z' },
    payload: { message: 'x' },
  })
  job.state = { nextRunAtMs: 123, lastRunAtMs: 100, lastStatus: 'ok', lastError: 'boom', consecutiveErrors: 2 }
  const pub = toPublicJob(job)
  assert.equal(pub.nextRunAtMs, 123)
  assert.equal(pub.lastStatus, 'ok')
  assert.equal(pub.lastError, 'boom')
  assert.equal(pub.consecutiveErrors, 2)
  assert.equal(pub.state, undefined)
})
