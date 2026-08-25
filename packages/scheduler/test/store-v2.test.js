/**
 * Store V2 tests — SCHEDULER_TIMEOUT_OUTCOME_V2:
 *   ACC-021 (layout & fail-loud), ACC-026 (reserve atomicity under
 *   concurrency, store level), ACC-028 (projection rebuild from the ledger),
 *   ACC-030 (legacy state demotion), ACC-033 (v1->v2 upgrade + guarded
 *   rollback + restart recovery semantics), ACC-035 (evidence append),
 *   plus legacy jobs-only mutate() compatibility.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JobStore, STORE_VERSION } from '../src/store.js'
import { buildOccurrenceRecord, applyTransition, deriveJobStateSummary, rebuildFences, enableJobOp } from '../src/index.js'

function tempStore(name, opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), name))
  return { dir, store: new JobStore(join(dir, 'jobs.json'), opts) }
}
const deferred = () => {
  let resolve
  const promise = new Promise((yes) => { resolve = yes })
  return { promise, resolve }
}

const JOB = (over = {}) => ({
  id: 'j1', name: 'job', agentId: 'a1', enabled: true, scheduleRevision: 1,
  revisionActivatedAtMs: 1000, createdAtMs: 1000, updatedAtMs: 1000,
  schedule: { kind: 'cron', expr: '0 9 * * *' },
  payload: { kind: 'agentTurn', message: 'm' },
  delivery: { mode: 'none' }, state: {}, ...over,
})

const RECORD = (over = {}) => ({
  ...buildOccurrenceRecord({ job: JOB(), kind: 'natural', nominalScheduledAt: 2000, admittedAt: 3000, timeoutMs: 60_000 }),
  ...over,
})

// ── ACC-021 layout + fail-loud ────────────────────────────────────────────

test('ACC-021 document layout {version:2, jobs, occurrences, fences}; single mutation authority', async () => {
  const { store } = tempStore('sched-v2-layout-')
  await store.mutateDoc((doc) => { doc.jobs.push(JOB()) })
  const raw = JSON.parse(readFileSync(store.filePath, 'utf8'))
  assert.equal(raw.version, STORE_VERSION)
  assert.ok(Array.isArray(raw.jobs))
  assert.ok(Array.isArray(raw.occurrences))
  assert.deepEqual(raw.fences, {})
  assert.equal(STORE_VERSION, 2)
})

test('ACC-021 corrupt document fails loud (never an empty store)', async () => {
  const { store } = tempStore('sched-v2-corrupt-')
  writeFileSync(store.filePath, '{ not json !!!', 'utf8')
  await assert.rejects(() => store.loadDoc(), /corrupt document/)
})

test('ACC-021 unsupported version fails loud', async () => {
  const { store } = tempStore('sched-v2-ver-')
  writeFileSync(store.filePath, JSON.stringify({ version: 99, jobs: [] }), 'utf8')
  await assert.rejects(() => store.loadDoc(), /unsupported store version 99/)
})

test('ACC-021 malformed v2 (missing collections) fails loud', async () => {
  const { store } = tempStore('sched-v2-malformed-')
  writeFileSync(store.filePath, JSON.stringify({ version: 2, jobs: [] }), 'utf8')
  await assert.rejects(() => store.loadDoc(), /missing\/malformed jobs\/occurrences\/fences/)
})

test('ACC-021 CORRUPT_OCCURRENCE_STORE_FAIL_LOUD (authority corruption, not warn-drop)', async () => {
  const { store } = tempStore('sched-v2-occ-corrupt-')
  await assert.rejects(() => store.mutateDoc((doc) => {
    const record = RECORD()
    delete record.payloadHash
    doc.occurrences.push(record)
  }), /occurrence authority corrupted/)
})

test('ACC-021 runs.jsonl rotation keeps authoritative state in the document (not the log)', async () => {
  const { store } = tempStore('sched-v2-evidence-rot-', { maxRunLogBytes: 400 })
  for (let i = 0; i < 40; i += 1) {
    await store.appendRunEvent({ ts: i, action: 'outcome', filler: 'x'.repeat(30) })
  }
  const stat = readFileSync(store.runLogPath, 'utf8')
  assert.ok(stat.length <= 800, 'run log bounded')
  // authority state is unaffected by log rotation
  await store.mutateDoc((doc) => { doc.occurrences.push(RECORD()) })
  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.occurrences.length, 1)
})

// ── ACC-035 evidence append ───────────────────────────────────────────────

test('ACC-035 evidence failure is observable but never an authority change; commit failure fails the transition', async () => {
  const { store } = tempStore('sched-v2-evfail-')
  await store.mutateDoc((doc) => { doc.jobs.push(JOB()) })
  // evidence failure observable: the run log path sits UNDER a regular file
  // (ENOTDIR on every write) — never silently swallowed.
  store.runLogPath = join(store.dir, 'jobs.json', 'nested')
  const result = await store.appendRunEvent({ action: 'x' })
  assert.equal(result.ok, false)
  assert.ok(result.error, 'error is observable, not silently swallowed')

  // authoritative commit failure -> transition fails, RAM untouched
  const { store: store2 } = tempStore('sched-v2-commit-fail-')
  store2.beforeCommit = () => { throw new Error('injected commit failure') }
  await assert.rejects(() => store2.mutateDoc((doc) => { doc.occurrences.push(RECORD()) }), /injected commit failure/)
  store2.beforeCommit = null
  const doc2 = await store2.loadDoc({ force: true })
  assert.equal(doc2.occurrences.length, 0, 'RAM/disk unchanged after failed commit')
})

// ── ACC-026 reserve atomicity under concurrency (store level) ─────────────

test('ACC-026 concurrent mutations serialize: one record per slot, no torn admission view', async () => {
  const { store } = tempStore('sched-v2-concurrent-')
  const attempts = await Promise.all(Array.from({ length: 8 }, () =>
    store.mutateDoc((doc) => {
      const record = RECORD()
      const existing = doc.occurrences.find((r) => r.occurrenceId === record.occurrenceId)
      if (existing) return { value: { deduped: true } }
      doc.occurrences.push(record)
      return { value: { deduped: false } }
    })))
  assert.equal(attempts.filter((a) => a.value.deduped === false).length, 1, 'exactly one write won')
  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.occurrences.length, 1)
})

test('ACC-026 same-process FIFO ordering: enqueued ops observe each other', async () => {
  const { store } = tempStore('sched-v2-fifo-')
  const seen = []
  const first = store.mutateDoc((doc) => { doc.jobs.push(JOB({ id: 'a' })); return { value: 1 } })
  const second = store.mutateDoc((doc) => { seen.push(doc.jobs.length); return { value: 2 } })
  await Promise.all([first, second])
  assert.deepEqual(seen, [1], 'second mutation observed the first (FIFO, not stale snapshot)')
})

test('ACC-026 live long-running writer lock is never stolen as stale', async () => {
  const { store } = tempStore('sched-v2-live-lock-', { lockTimeoutMs: 120, lockStaleMs: 1 })
  const peer = new JobStore(store.filePath, { lockTimeoutMs: 120, lockStaleMs: 1 })
  const entered = deferred()
  const release = deferred()
  const first = store.mutateDoc(async (doc) => {
    doc.jobs.push(JOB({ id: 'owner' }))
    entered.resolve()
    await release.promise
  })
  await entered.promise
  await assert.rejects(
    () => peer.mutateDoc((doc) => { doc.jobs.push(JOB({ id: 'peer' })) }),
    /held by a live or unverifiable owner/,
  )
  release.resolve()
  await first
  const doc = await store.loadDoc({ force: true })
  assert.deepEqual(doc.jobs.map((job) => job.id), ['owner'])
})

// ── legacy jobs-only mutate() compatibility ───────────────────────────────

test('ACC-026 dead lock owner is recovered without stealing a live token', async () => {
  const { store } = tempStore('sched-v2-dead-lock-')
  writeFileSync(store.lockPath, `${JSON.stringify({ pid: 2_147_483_647, token: 'dead', createdAtMs: 1 })}\n`, 'utf8')
  await store.mutateDoc((doc) => { doc.jobs.push(JOB()) })
  assert.equal((await store.loadDoc({ force: true })).jobs.length, 1)
})

test('ACC-021 crashed dead-lock reaper fails loud instead of spinning forever', async () => {
  const { store } = tempStore('sched-v2-stale-reaper-', { lockTimeoutMs: 120 })
  writeFileSync(store.lockPath, `${JSON.stringify({ pid: 2_147_483_647, token: 'dead', createdAtMs: 1 })}\n`, 'utf8')
  writeFileSync(`${store.lockPath}.reap`, 'crashed reaper\n', 'utf8')
  await assert.rejects(() => store.mutateDoc(() => {}), /lock timeout/)
})

test('ACC-026 concurrent dead-lock reapers cannot delete the replacement owner token', async () => {
  const { store } = tempStore('sched-v2-reaper-race-')
  const peer = new JobStore(store.filePath)
  writeFileSync(store.lockPath, `${JSON.stringify({ pid: 2_147_483_647, token: 'dead', createdAtMs: 1 })}\n`, 'utf8')
  await Promise.all([
    store.mutateDoc((doc) => { doc.jobs.push(JOB({ id: 'first' })) }),
    peer.mutateDoc((doc) => { doc.jobs.push(JOB({ id: 'second' })) }),
  ])
  assert.deepEqual((await store.loadDoc({ force: true })).jobs.map((job) => job.id).sort(), ['first', 'second'])
})

test('legacy mutate(jobsOnly) preserves occurrences/fences verbatim', async () => {
  const { store } = tempStore('sched-v2-legacy-')
  await store.mutateDoc((doc) => { doc.occurrences.push(RECORD()) })
  await store.mutate((jobs) => { jobs.push(JOB()) })
  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.occurrences.length, 1, 'occurrence authority untouched by legacy jobs-only mutate')
  assert.deepEqual(doc.fences, {}, 'canonical fences untouched')
  assert.equal(doc.jobs.length, 1)
  assert.deepEqual(await store.load(), [doc.jobs[0]], 'legacy load() returns the jobs array')
})

// ── ACC-033 v1 -> v2 upgrade ──────────────────────────────────────────────

function v1Store(store, jobs) {
  writeFileSync(store.filePath, JSON.stringify({ version: 1, jobs }, null, 2), 'utf8')
}

test('ACC-033 STORE_UPGRADE_V1_TO_V2: in-lock upgrade, generation backup, strip report, no fabricated occurrences', async () => {
  const { dir, store } = tempStore('sched-v2-upg-')
  v1Store(store, [
    JOB({
      id: 'inflight', state: { runningAtMs: Date.now() - 5000, lastStatus: 'ok' },
      sessionTarget: 'isolated',
    }),
    JOB({ id: 'mainsession', enabled: true, sessionTarget: 'main', sessionKey: undefined }),
    JOB({ id: 'clean', enabled: false, state: { lastRunAtMs: 123, consecutiveErrors: 2 } }),
  ])
  const { upgraded, report } = await store.ensureUpgraded()
  assert.equal(upgraded, true)
  const raw = JSON.parse(readFileSync(store.filePath, 'utf8'))
  assert.equal(raw.version, 2)
  assert.ok(Array.isArray(raw.occurrences) && raw.occurrences.length === 0, 'NO fabricated occurrences')
  assert.deepEqual(raw.fences, {})

  // generation-specific backup exists and holds the original v1 bytes
  const backups = readdirSync(dir).filter((n) => n.startsWith('jobs.json.v1.') && n.endsWith('.bak'))
  assert.equal(backups.length, 1, 'one generation backup')
  const backupRaw = JSON.parse(readFileSync(join(dir, backups[0]), 'utf8'))
  assert.equal(backupRaw.version, 1)

  // in-flight job: runningAtMs stripped, disabled pending review, reported
  const inflight = raw.jobs.find((j) => j.id === 'inflight')
  assert.equal(inflight.state.runningAtMs, undefined, 'in-flight marker stripped')
  assert.equal(inflight.enabled, false, 'in-flight job NOT auto-restored')
  assert.equal(inflight.migrationRestoreBlocked, true, 'ambiguous legacy execution is durably restore-blocked')
  await assert.rejects(() => enableJobOp(store, inflight.id), (error) => error.code === 'RESTORE_GATE_CLOSED')
  assert.equal(inflight.sessionTarget, undefined, 'legacy session field stripped')
  assert.ok(report.inFlightJobs.some((j) => j.id === 'inflight'))
  assert.ok(report.jobs.find((j) => j.id === 'inflight').strippedExecutionState.length > 0)
  assert.equal(report.fabricatedOccurrences, 0)

  // main-session intent: disabled + reported
  const mainSession = raw.jobs.find((j) => j.id === 'mainsession')
  assert.equal(mainSession.enabled, false, 'main-session job blocked pending migration review')
  assert.ok(report.strippedSessionFields.some((s) => s.id === 'mainsession' && s.sessionTarget === 'main'))

  // disabled stays disabled; ungrounded legacy projections are stripped.
  const clean = raw.jobs.find((j) => j.id === 'clean')
  assert.equal(clean.enabled, false)
  assert.deepEqual(clean.state, {})
  assert.ok(report.jobs.find((j) => j.id === 'clean').strippedExecutionState.length > 0)

  // upgrade evidence recorded
  const events = await store.readRunEvents()
  assert.ok(events.some((e) => e.action === 'store_upgrade' && e.from === 1 && e.to === 2))

  // idempotent: second open reports no upgrade
  const again = await store.ensureUpgraded()
  assert.equal(again.upgraded, false)
})

test('ACC-033 bare-array v1 documents upgrade too', async () => {
  const { store } = tempStore('sched-v2-upg-bare-')
  writeFileSync(store.filePath, JSON.stringify([JOB()]), 'utf8')
  const { upgraded } = await store.ensureUpgraded()
  assert.equal(upgraded, true)
  assert.equal(JSON.parse(readFileSync(store.filePath, 'utf8')).version, 2)
})

test('ACC-033 read surfaces cannot bypass the locked one-time v1 upgrade', async () => {
  const { dir, store } = tempStore('sched-v2-read-upgrade-')
  v1Store(store, [JOB()])
  const doc = await store.loadDoc()
  assert.equal(doc.version, 2)
  assert.equal(JSON.parse(readFileSync(store.filePath, 'utf8')).version, 2)
  assert.ok(readdirSync(dir).some((name) => name.endsWith('.bak')))
  assert.ok((await store.readRunEvents()).some((event) => event.action === 'store_upgrade'))
})

test('ACC-033 same-transaction v1 upgrade plus Job mutation permanently blocks rollback', async () => {
  const { store } = tempStore('sched-v2-upgrade-mutation-')
  v1Store(store, [JOB()])
  await store.mutateDoc((doc) => { doc.jobs[0].name = 'mutated during upgrade' })
  await assert.rejects(() => store.rollbackToV1(), /V2-era Job mutation/)
})

// ── ACC-033 guarded rollback ──────────────────────────────────────────────

async function upgradeFreshStore(store) {
  v1Store(store, [JOB({ id: 'j1' })])
  await store.ensureUpgraded()
}

test('ACC-033 rollback allowed only in the narrow safe form', async () => {
  const { dir, store } = tempStore('sched-v2-rollback-')
  await upgradeFreshStore(store)

  // 1) untouched v2 -> rollback allowed; archives the V2 document; consumes the backup
  const result = await store.rollbackToV1({ operator: 'test' })
  assert.ok(result.archiveFile.includes('.v2.'), 'V2 authority document archived before rollback')
  assert.ok(existsSync(result.archiveFile))
  assert.equal(JSON.parse(readFileSync(store.filePath, 'utf8')).version, 1, 'v1 restored')
  assert.ok(readdirSync(dir).some((n) => n.endsWith('.bak.consumed')), 'backup marked consumed')

  // 2) re-upgrade starts from the CURRENT truth with a NEW backup generation
  const second = await store.ensureUpgraded()
  assert.equal(second.upgraded, true)
  const backups = readdirSync(dir).filter((n) => n.startsWith('jobs.json.v1.') && n.endsWith('.bak'))
  assert.equal(backups.length, 1, 'new generation backup (consumed one not reused)')

  // 3) occurrence records present -> refuse
  await store.mutateDoc((doc) => { doc.occurrences.push(RECORD()) })
  await assert.rejects(() => store.rollbackToV1(), (err) => {
    assert.equal(err.code, 'ROLLBACK_REFUSED')
    assert.match(err.message, /occurrence authority exists/)
    assert.match(err.message, /forward-fix-or-reconcile/)
    return true
  })
  await store.mutateDoc((doc) => { doc.occurrences = [] })

  // 4) unresolved outcome_unknown -> refuse (even with occurrences array emptied elsewhere this simulates the direct case)
  await store.mutateDoc((doc) => {
    doc.occurrences.push(RECORD({
      state: 'outcome_unknown',
      history: [{ at: 3000, from: null, to: 'admitted', reason: 'reserve' }, { at: 3001, from: 'admitted', to: 'outcome_unknown', reason: 'unproven' }],
    }))
    doc.fences = rebuildFences(doc.occurrences)
  })
  await assert.rejects(() => store.rollbackToV1(), /unresolved outcome_unknown/)

  // 5) V2-era job mutation -> refuse (digest differs from post-upgrade digest)
  await store.mutateDoc((doc) => { doc.occurrences = []; doc.fences = {} })
  await store.mutate((jobs) => { jobs[0].name = 'mutated-in-v2-era' })
  await assert.rejects(() => store.rollbackToV1(), (err) => {
    assert.equal(err.code, 'ROLLBACK_REFUSED')
    assert.match(err.message, /V2-era Job mutation/)
    return true
  })
})

test('ACC-033 rollback digest guard catches direct V2 Job mutation even if sidecar flag is false', async () => {
  const { store } = tempStore('sched-v2-rollback-digest-')
  await upgradeFreshStore(store)
  const raw = JSON.parse(readFileSync(store.filePath, 'utf8'))
  raw.jobs[0].name = 'direct mutation bypass attempt'
  writeFileSync(store.filePath, JSON.stringify(raw), 'utf8')
  await assert.rejects(() => store.rollbackToV1(), /V2-era Job mutation/)
})

test('ACC-033 rollback rejects tampered or wrong-generation backup authority', async () => {
  const { dir, store } = tempStore('sched-v2-rollback-tamper-')
  await upgradeFreshStore(store)
  const backup = readdirSync(dir).find((name) => name.endsWith('.bak'))
  writeFileSync(join(dir, backup), JSON.stringify({ version: 1, jobs: [JOB({ name: 'tampered' })] }), 'utf8')
  await assert.rejects(() => store.rollbackToV1(), /backup digest does not match sidecar/)
  assert.equal(JSON.parse(readFileSync(store.filePath, 'utf8')).version, 2)
})

// ── ACC-028 projection rebuild ────────────────────────────────────────────

test('ACC-028 PROJECTION_REBUILD_FROM_OCCURRENCE_LEDGER: fences + state summaries rebuild identically, no admission', async () => {
  const { store } = tempStore('sched-v2-rebuild-')
  const unknown = RECORD({
    state: 'outcome_unknown',
    history: [
      { at: 3000, from: null, to: 'admitted', reason: 'reserve' },
      { at: 3001, from: 'admitted', to: 'outcome_unknown', reason: 'unproven' },
    ],
  })
  const succeeded = buildOccurrenceRecord({
    job: JOB({ id: 'j2' }), kind: 'natural', nominalScheduledAt: 2000,
    admittedAt: 3000, timeoutMs: 60_000,
  })
  applyTransition(succeeded, { to: 'running', at: 3010, reason: 'started', startedAt: 3010 })
  applyTransition(succeeded, {
    to: 'succeeded', at: 3020, reason: 'terminal success', endedAt: 3020,
    executionOutcome: 'succeeded', deliveryStatus: 'delivered',
  })
  const corruptProjection = {
    version: 2,
    jobs: [JOB(), JOB({ id: 'j2' })],
    occurrences: [unknown, succeeded],
    fences: { someStaleGarbage: { occurrenceId: 'x', runId: 'y', activatedAtMs: 0, reason: 'stale' } },
  }
  writeFileSync(store.filePath, JSON.stringify(corruptProjection), 'utf8')
  await assert.rejects(() => store.loadDoc({ force: true }), /fences do not exactly match/)

  const { changed } = await store.rebuildProjections({
    buildJobSummary: (job, occurrences) => deriveJobStateSummary(job, occurrences, 5000),
  })
  assert.equal(changed, true)
  const doc = await store.loadDoc({ force: true })
  assert.deepEqual(Object.keys(doc.fences), ['j1'], 'stale fence entries dropped, unknown fences rebuilt')
  assert.equal(doc.fences.j1.occurrenceId, unknown.occurrenceId)

  const j2 = doc.jobs.find((j) => j.id === 'j2')
  assert.equal(j2.state.lastRunAtMs, 3020, 'summary rebuilt from ledger')
  assert.equal(j2.state.lastStatus, 'succeeded')
  assert.equal(j2.state.lastDelivered, true)

  // rebuild again -> idempotent (projection == derived truth)
  const again = await store.rebuildProjections({
    buildJobSummary: (job, occurrences) => deriveJobStateSummary(job, occurrences, 5000),
  })
  assert.equal(again.changed, false)
  assert.deepEqual(doc.fences, rebuildFences(doc.occurrences))
  // and no admissions happened (no new occurrences)
  assert.equal(doc.occurrences.length, 2)
})

// ── ACC-030 legacy state demotion (mechanical level) ──────────────────────

test('ACC-030 admission inputs never read legacy state: normalizeState drops runningAtMs entirely', async () => {
  const { normalizeState } = await import('../src/job-model.js')
  const state = normalizeState({ runningAtMs: 123, nextRunAtMs: 999, lastStatus: 'error', consecutiveErrors: 3 })
  assert.equal(state.runningAtMs, undefined, 'runningAtMs is not even persistable in V2 normalized state')
  assert.equal(state.nextRunAtMs, 999, 'nextRunAtMs kept as projection cache')
})

test('ACC-030 STUCK_RUN_MS 2h clear-and-rerun path does not exist in V2', async () => {
  const schedulerSource = readFileSync(new URL('../src/scheduler.js', import.meta.url), 'utf8')
  assert.ok(!schedulerSource.includes('STUCK_RUN_MS'), 'no stuck-run constant')
  assert.ok(!/normalizeJobTickState/.test(schedulerSource), 'no tick-state stuck-clear function')
})
