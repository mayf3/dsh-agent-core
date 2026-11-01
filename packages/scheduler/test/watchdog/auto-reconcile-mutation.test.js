import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { JobStore } from '../../src/store.js'
import { normalizeJob } from '../../src/job-model.js'
import { buildOccurrenceRecord, applyTransition, rebuildFences, validateOccurrenceRecord } from '../../src/occurrence-model.js'
import { naturalCandidate, retryCandidate } from '../../src/eligibility.js'
import { planAutoReconcilePass } from '../../src/watchdog/auto-reconcile.js'

async function fixture(t, { secondUnknown = false } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ctr-s4-batch-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const store = new JobStore(path.join(dir, 'jobs.json'))
  const job = normalizeJob({ id: 'recurring', name: 'fixture', agentId: 'agent-a',
    schedule: { kind: 'every', everyMs: 60_000, anchorMs: 0 },
    payload: { kind: 'agentTurn', message: 'work' }, retry: { auto: true }, delivery: { mode: 'none' } }, { nowMs: 1_000 })
  function unknown(slot) {
    const record = buildOccurrenceRecord({ job, kind: 'natural', nominalScheduledAt: slot, admittedAt: slot + 1, timeoutMs: 100 })
    applyTransition(record, { to: 'outcome_unknown', at: slot + 200, endedAt: slot + 200, reason: 'timeout without proof' })
    return record
  }
  const record = unknown(60_000)
  const occurrences = [record, ...(secondUnknown ? [unknown(120_000)] : [])]
  await store.mutateDoc(doc => {
    doc.jobs = [job]
    doc.occurrences = occurrences
    doc.fences = rebuildFences(occurrences)
  })
  const evidence = { occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.requestId,
    agentId: job.agentId, runtimeEpoch: 'epoch-current', reconciliationHandle: 'turn:epoch-current:a1:g1:s1',
    lateOutcome: 'terminated_without_outcome', outcomeEvidence: null, terminationEvidence: 'child_real_exit' }
  const lookup = rec => rec.occurrenceId === record.occurrenceId ? structuredClone(evidence) : null
  const plan = planAutoReconcilePass(await store.loadDoc({ force: true }), lookup)
  const batch = await import('../../src/watchdog/auto-reconcile-mutation.js').catch(() => ({}))
  return { store, job, record, evidence, lookup, plan, batch, bytes: () => fs.readFile(store.filePath, 'utf8') }
}

test('CTR-S4 batch termination policy failed retains UNKNOWN provenance and only future natural scheduling', async t => {
  const f = await fixture(t)
  assert.equal(typeof f.batch.autoReconcileOccurrences, 'function', 'batch wiring must exist')
  const out = await f.batch.autoReconcileOccurrences(f.store, { settlements: f.plan.targets, evidenceLookup: f.lookup, nowMs: 180_000 })
  assert.equal(out.results[0].outcome, 'settled')
  assert.equal(out.results[0].evidenceStatus.ok, true)
  const doc = await f.store.loadDoc({ force: true })
  const record = doc.occurrences[0]
  assert.equal(record.state, 'failed')
  assert.equal(record.executionOutcome, undefined, 'policy failed must not fabricate a business failure')
  assert.equal(record.lateSettlement.businessStateAtCommit, 'outcome_unknown')
  assert.equal(record.lateSettlement.policyReason, 'child_exit_without_outcome')
  assert.equal(record.lateSettlement.actorKind, 'machine')
  assert.equal(record.lateSettlement.actorId, 'system:fence-auto-reconcile')
  assert.equal(record.lateSettlement.scheduleDisposition, 'recurring_future_natural_only')
  assert.equal(record.lateSettlement.runtimeEpoch, 'epoch-current')
  assert.ok(record.lateSettlement.evidenceRef.startsWith('ev:'))
  assert.equal(doc.fences[f.job.id], undefined)
  assert.equal(record.history[1].to, 'outcome_unknown')
  assert.equal(doc.occurrences.length, 1)
  assert.equal(retryCandidate({ job: doc.jobs[0], occurrences: doc.occurrences, nowMs: 999_999 }), null)
  assert.equal(naturalCandidate({ job: doc.jobs[0], occurrences: doc.occurrences, nowMs: 180_000 }).due, false)
  assert.equal(naturalCandidate({ job: doc.jobs[0], occurrences: doc.occurrences, nowMs: 240_000 }).nominal, 240_000)
  validateOccurrenceRecord(record)
  const missingProvenance = structuredClone(record)
  delete missingProvenance.lateSettlement.businessStateAtCommit
  assert.throws(() => validateOccurrenceRecord(missingProvenance), /corrupt|authority|terminal/)
})

test('CTR-S4 batch locks out identity definition and evidence drift with byte-identical negative writes', async t => {
  const changes = [
    doc => { doc.jobs[0].schedule = { kind: 'at', at: '2030-01-01T00:00:00.000Z' } },
    doc => { doc.jobs[0].agentId = 'foreign-agent' },
    doc => { doc.jobs[0].scheduleRevision += 1 },
    doc => { doc.jobs[0].payload.message = 'changed' },
    doc => { doc.jobs[0].enabled = false },
    doc => { doc.jobs = [] },
  ]
  for (const change of changes) {
    const f = await fixture(t)
    assert.equal(typeof f.batch.autoReconcileOccurrences, 'function')
    await f.store.mutateDoc(change)
    const before = await f.bytes()
    const out = await f.batch.autoReconcileOccurrences(f.store, { settlements: f.plan.targets, evidenceLookup: f.lookup, nowMs: 180_000 })
    assert.equal(out.results[0].outcome, 'skipped')
    assert.equal(await f.bytes(), before)
  }
  for (const change of [e => { e.runtimeEpoch = 'stale-epoch' }, e => { e.runId = 'foreign-run' },
    e => { e.requestId = 'foreign-request' }, e => { e.agentId = 'foreign-agent' },
    e => { e.outcomeEvidence = 'exact_turn_end_success' }]) {
    const f = await fixture(t)
    const before = await f.bytes()
    change(f.evidence)
    const out = await f.batch.autoReconcileOccurrences(f.store, { settlements: f.plan.targets, evidenceLookup: f.lookup, nowMs: 180_000 })
    assert.equal(out.results[0].outcome, 'skipped')
    assert.equal(await f.bytes(), before)
  }
})

test('CTR-S4 batch rechecks inside lock and preserves another unknown aggregate fence', async t => {
  const f = await fixture(t, { secondUnknown: true })
  assert.equal(typeof f.batch.autoReconcileOccurrences, 'function')
  let release
  let entered
  const inLock = new Promise(resolve => { entered = resolve })
  const gate = new Promise(resolve => { release = resolve })
  const blocker = f.store.mutateDoc(async doc => { entered(); await gate; doc.jobs[0].scheduleRevision += 1 })
  await inLock
  const pending = f.batch.autoReconcileOccurrences(f.store, { settlements: f.plan.targets, evidenceLookup: f.lookup, nowMs: 180_000 })
  release()
  await blocker
  const before = await f.bytes()
  assert.equal((await pending).results[0].outcome, 'skipped')
  assert.equal(await f.bytes(), before)
  const g = await fixture(t, { secondUnknown: true })
  const out = await g.batch.autoReconcileOccurrences(g.store, { settlements: g.plan.targets, evidenceLookup: g.lookup, nowMs: 180_000 })
  assert.equal(out.fencesRemaining, 1)
  assert.ok((await g.store.loadDoc({ force: true })).fences[g.job.id])
})

test('CTR-S4 batch committed acknowledgement loss returns canonical receipt and repeat is zero-write', async t => {
  const f = await fixture(t)
  assert.equal(typeof f.batch.autoReconcileOccurrences, 'function')
  const originalWrite = f.store._writeAtomicDoc.bind(f.store)
  f.store._writeAtomicDoc = async doc => { await originalWrite(doc); throw Object.assign(new Error('lost ack'), { mutationOutcome: 'committed' }) }
  const out = await f.batch.autoReconcileOccurrences(f.store, { settlements: f.plan.targets, evidenceLookup: f.lookup, nowMs: 180_000 })
  assert.equal(out.committedAckLost, true)
  assert.equal(out.results[0].outcome, 'settled')
  const before = await f.bytes()
  f.store._writeAtomicDoc = originalWrite
  const replay = await f.batch.autoReconcileOccurrences(f.store, { settlements: f.plan.targets, evidenceLookup: f.lookup, nowMs: 200_000 })
  assert.equal(replay.results[0].outcome, 'already_settled')
  assert.deepEqual(replay.results[0].receipt, out.results[0].receipt)
  assert.equal(await f.bytes(), before)
  const events = await f.store.readRunEvents({ limit: null })
  assert.equal(events.filter(e => e.basis === 'policy-auto-reconcile').length, 1)
})

test('CTR-S4 batch audit append failure remains observable without undoing authority', async t => {
  for (const throws of [false, true]) {
    const f = await fixture(t)
    assert.equal(typeof f.batch.autoReconcileOccurrences, 'function')
    f.store.appendRunEvent = async () => { if (throws) throw new Error('disk full'); return { ok: false, error: 'disk full' } }
    const out = await f.batch.autoReconcileOccurrences(f.store, { settlements: f.plan.targets, evidenceLookup: f.lookup, nowMs: 180_000 })
    assert.equal(out.results[0].outcome, 'settled')
    assert.equal(out.results[0].evidenceStatus.ok, false)
    assert.match(out.results[0].evidenceStatus.error, /disk full/)
    assert.equal((await f.store.loadDoc({ force: true })).occurrences[0].state, 'failed')
    const before = await f.bytes()
    const replay = await f.batch.autoReconcileOccurrences(f.store, { settlements: f.plan.targets, evidenceLookup: f.lookup, nowMs: 200_000 })
    assert.equal(replay.results[0].evidenceStatus.ok, false, 'replay cannot turn a missing audit into success')
    assert.equal(await f.bytes(), before)
  }
})

test('CTR-S4 batch exact business outcomes retain their proven execution result', async t => {
  for (const [outcome, marker, disposition] of [['succeeded', 'exact_turn_end_success', 'late_completed'], ['failed', 'exact_turn_end_failure', 'late_failed']]) {
    const f = await fixture(t)
    assert.equal(typeof f.batch.autoReconcileOccurrences, 'function')
    Object.assign(f.evidence, { outcomeEvidence: marker, lateOutcome: disposition, terminationEvidence: 'exact_terminal_then_idle' })
    const plan = planAutoReconcilePass(await f.store.loadDoc({ force: true }), f.lookup)
    const out = await f.batch.autoReconcileOccurrences(f.store, { settlements: plan.targets, evidenceLookup: f.lookup, nowMs: 180_000 })
    assert.equal(out.results[0].outcome, 'settled')
    const record = (await f.store.loadDoc({ force: true })).occurrences[0]
    assert.equal(record.executionOutcome, outcome)
    assert.equal(record.lateSettlement.businessStateAtCommit, outcome)
    validateOccurrenceRecord(record)
  }
})

test('CTR-S4 batch accepts coherent direct business and child-exit late evidence without losing provenance', async t => {
  for (const [outcome, marker, direct, late, termination] of [
    ['succeeded', 'exact_turn_end_success', 'completed', null, 'exact_terminal_then_idle'],
    ['failed', 'exact_turn_end_failure', 'failed', null, 'exact_terminal_then_idle'],
    ['succeeded', 'exact_turn_end_success', null, 'late_completed', 'child_real_exit'],
    ['failed', 'exact_turn_end_failure', null, 'late_failed', 'child_real_exit'],
  ]) {
    const f = await fixture(t)
    Object.assign(f.evidence, { outcome: direct, outcomeEvidence: marker, lateOutcome: late, terminationEvidence: termination })
    const plan = planAutoReconcilePass(await f.store.loadDoc({ force: true }), f.lookup)
    assert.equal(plan.targets.length, 1)
    const out = await f.batch.autoReconcileOccurrences(f.store, { settlements: plan.targets, evidenceLookup: f.lookup, nowMs: 180_000 })
    assert.equal(out.results[0].outcome, 'settled')
    assert.equal((await f.store.loadDoc({ force: true })).occurrences[0].executionOutcome, outcome)
  }
})
