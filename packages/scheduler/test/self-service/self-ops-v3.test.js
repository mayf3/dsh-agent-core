import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { JobStore } from '../../src/store.js'
import { applyTransition, buildOccurrenceRecord, rebuildFences } from '../../src/occurrence-model.js'
import { naturalCandidate } from '../../src/eligibility.js'
import { createSelfOpsAccess } from '../../src/self-ops/index.js'
import { reconcileOccurrence } from '../../src/control.js'

const AGENT = 'agt_self'

async function fixture(t, { kind = 'cron', unknowns = 1 } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'scheduler-self-ops-v3-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  let now = 1_800_000_000_000
  const store = new JobStore(path.join(dir, 'jobs.json'), { clock: () => now })
  const job = {
    id: 'job-own', name: 'owned', agentId: AGENT, enabled: true, scheduleRevision: 1,
    createdAtMs: now, updatedAtMs: now, revisionActivatedAtMs: now,
    schedule: kind === 'at'
      ? { kind: 'at', at: now + 60_000 }
      : kind === 'every'
        ? { kind: 'every', everyMs: 60_000, anchorMs: now }
        : { kind: 'cron', expr: '* * * * *', tz: 'UTC' },
    payload: { kind: 'agentTurn', message: 'secret body' }, state: {},
  }
  const occurrences = []
  for (let i = 0; i < unknowns; i += 1) {
    const admittedAt = now + i * 1000
    const record = buildOccurrenceRecord({ job, kind: 'natural', nominalScheduledAt: admittedAt, admittedAt })
    applyTransition(record, { to: 'outcome_unknown', at: admittedAt + 10, reason: 'timeout' })
    occurrences.push(record)
  }
  await store.mutateDoc((doc) => {
    doc.jobs = [structuredClone(job)]
    doc.occurrences = structuredClone(occurrences)
    doc.fences = rebuildFences(doc.occurrences)
  })
  const router = new Map(occurrences.map((record) => [record.occurrenceId, {
    state: 'settled',
    handle: `turn:opaque:${record.occurrenceId}`,
    snapshot: {
      agentId: AGENT,
      callerCorrelation: {
        occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.requestId,
      },
      lateOutcome: 'terminated_without_outcome',
      terminationEvidence: 'child_real_exit',
    },
  }]))
  const access = createSelfOpsAccess({
    store,
    resolveCallerCorrelation: ({ occurrenceId }) => router.get(occurrenceId) ?? { state: 'never_existed' },
    runtimeStatus: () => ({ generationId: 'gen-opaque', health: 'healthy' }),
    clock: () => now + 10_000,
  })
  return { store, job, occurrences, router, access, file: path.join(dir, 'jobs.json'), tick: () => { now += 100 } }
}

test('status is bounded, self-only and secret-free', async (t) => {
  const fx = await fixture(t, { unknowns: 22 })
  await fx.store.mutateDoc((doc) => {
    const foreignJob = { ...structuredClone(fx.job), id: 'job-foreign', agentId: 'agt_foreign', name: 'foreign-secret' }
    const foreign = buildOccurrenceRecord({
      job: foreignJob, kind: 'natural', nominalScheduledAt: 1_800_000_100_000, admittedAt: 1_800_000_100_000,
    })
    applyTransition(foreign, { to: 'outcome_unknown', at: 1_800_000_100_010, reason: 'foreign timeout' })
    doc.jobs.push(foreignJob)
    doc.occurrences.push(foreign)
    doc.fences = rebuildFences(doc.occurrences)
  })
  const status = await fx.access.status(AGENT)
  assert.equal(status.scheduler.ownedJobCount, 1)
  assert.equal(status.scheduler.activeFenceCount, 1)
  assert.equal(status.scheduler.unresolvedUnknownCount, 22)
  assert.equal(status.scheduler.reconciliationCandidateCount, 22)
  assert.equal(status.scheduler.blockers.length, 20)
  assert.equal(status.scheduler.truncated, true)
  assert.deepEqual(
    status.scheduler.blockers.map((row) => row.occurrenceId),
    fx.occurrences.slice().sort((a, b) => b.admittedAt - a.admittedAt).slice(0, 20).map((row) => row.occurrenceId),
  )
  assert.equal(status.scheduler.blockers[0].routerDisposition, 'terminated_without_outcome')
  assert.equal(/secret body|foreign-secret|job-foreign|agt_foreign/.test(JSON.stringify(status)), false)
})

test('termination-only reconcile preserves unknown, releases only the settled fence, and is idempotent', async (t) => {
  const fx = await fixture(t, { unknowns: 2 })
  const [first, second] = fx.occurrences
  const definitionUpdatedAt = fx.job.updatedAtMs
  const one = await fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: first.occurrenceId, runId: first.runId,
  })
  assert.equal(one.ok, true)
  assert.equal(one.result.businessState, 'outcome_unknown')
  assert.equal(one.result.fenceAfter, true)
  let doc = await fx.store.loadDoc({ force: true })
  assert.equal(doc.occurrences[0].state, 'outcome_unknown')
  assert.equal(doc.fences[fx.job.id].occurrenceId, second.occurrenceId)
  assert.equal(doc.jobs[0].updatedAtMs, definitionUpdatedAt, 'recurring settlement does not mutate the definition revision token')

  const bytes = await readFile(fx.file, 'utf8')
  const retry = await fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: first.occurrenceId, runId: first.runId,
  })
  assert.deepEqual(retry, one)
  assert.equal(await readFile(fx.file, 'utf8'), bytes)

  const two = await fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: second.occurrenceId, runId: second.runId,
  })
  assert.equal(two.result.fenceAfter, false)
  doc = await fx.store.loadDoc({ force: true })
  assert.deepEqual(doc.fences, {})
  assert.equal(doc.occurrences.length, 2, 'settlement does not mint backlog or retry occurrences')
  assert.ok(doc.jobs[0].state.nextRunAtMs > 1_800_000_010_000, 'recurring projection waits for a strictly-future slot')
  assert.equal(naturalCandidate({
    job: doc.jobs[0], occurrences: doc.occurrences, nowMs: 1_800_000_010_000,
  }).due, false, 'the settlement instant cannot re-admit a past slot')
  const future = naturalCandidate({
    job: doc.jobs[0], occurrences: doc.occurrences, nowMs: doc.jobs[0].state.nextRunAtMs + 60_001,
  })
  assert.equal(future.due, true)
  assert.ok(future.nominal > two.result.committedAt, 'clock advance selects only a post-settlement natural slot')
})

test('deleted, retargeted and spoofed coordinates are opaque and byte-for-byte zero-write', async (t) => {
  const deleted = await fixture(t)
  const [deletedRecord] = deleted.occurrences
  await deleted.store.mutateDoc((doc) => { doc.jobs = [] })
  const deletedBytes = await readFile(deleted.file, 'utf8')
  const deletedAnswer = await deleted.access.reconcileTurn(AGENT, {
    jobId: deleted.job.id, occurrenceId: deletedRecord.occurrenceId, runId: deletedRecord.runId,
  })
  assert.equal(deletedAnswer.error.code, 'not_found_or_not_owned')
  assert.equal(await readFile(deleted.file, 'utf8'), deletedBytes)
  assert.equal((await deleted.access.status(AGENT)).scheduler.unresolvedUnknownCount, 0)

  const retargeted = await fixture(t)
  const [retargetedRecord] = retargeted.occurrences
  await retargeted.store.mutateDoc((doc) => { doc.jobs[0].agentId = 'agt_new_owner' })
  const retargetedBytes = await readFile(retargeted.file, 'utf8')
  for (const caller of [AGENT, 'agt_new_owner']) {
    const answer = await retargeted.access.reconcileTurn(caller, {
      jobId: retargeted.job.id, occurrenceId: retargetedRecord.occurrenceId, runId: retargetedRecord.runId,
    })
    assert.equal(answer.error.code, 'not_found_or_not_owned')
    assert.equal(await readFile(retargeted.file, 'utf8'), retargetedBytes)
  }
  const spoof = await retargeted.access.reconcileTurn(AGENT, {
    jobId: retargeted.job.id, occurrenceId: retargetedRecord.occurrenceId, runId: 'run:spoofed',
  })
  assert.equal(spoof.error.code, 'not_found_or_not_owned')
  assert.equal(await readFile(retargeted.file, 'utf8'), retargetedBytes)
})

test('later trusted business settlement does not change the immutable termination receipt', async (t) => {
  const fx = await fixture(t)
  const [record] = fx.occurrences
  const first = await fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  await fx.store.mutateDoc((doc) => {
    const current = doc.occurrences[0]
    applyTransition(current, {
      to: 'succeeded',
      at: 1_800_000_020_000,
      reason: 'trusted late business outcome',
      endedAt: 1_800_000_020_000,
      executionOutcome: 'succeeded',
      terminalEvidence: { kind: 'late-settlement', detailRef: 'ev:late' },
      lateSettlement: {
        resolvedTo: 'succeeded', resolvedAt: 1_800_000_020_000,
        basis: 'trusted-late-evidence', evidenceRef: 'ev:late',
      },
    })
  })
  const bytes = await readFile(fx.file, 'utf8')
  const replay = await fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.deepEqual(replay, first)
  assert.equal(await readFile(fx.file, 'utf8'), bytes)
})

test('negative Router disposition and foreign caller are byte-for-byte zero-write', async (t) => {
  const fx = await fixture(t)
  const [record] = fx.occurrences
  fx.router.set(record.occurrenceId, { state: 'restart_lost' })
  const before = await readFile(fx.file, 'utf8')
  const negative = await fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(negative.error.code, 'termination_not_proven')
  assert.equal(await readFile(fx.file, 'utf8'), before)
  const foreign = await fx.access.reconcileTurn('agt_foreign', {
    jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(foreign.error.code, 'not_found_or_not_owned')
  assert.equal(await readFile(fx.file, 'utf8'), before)
})

test('every non-positive Router disposition is closed and byte-for-byte zero-write', async (t) => {
  const fx = await fixture(t)
  const [record] = fx.occurrences
  const before = await readFile(fx.file, 'utf8')
  const cases = [
    [{ state: 'pending' }, 'termination_not_proven'],
    [{ state: 'restart_lost' }, 'termination_not_proven'],
    [{ state: 'evicted' }, 'termination_not_proven'],
    [{ state: 'never_existed' }, 'termination_not_proven'],
    [{ state: 'unsupported' }, 'termination_not_proven'],
    [{ state: 'conflict' }, 'correlation_mismatch'],
    [{ state: 'mismatch' }, 'correlation_mismatch'],
  ]
  for (const [routerResult, code] of cases) {
    fx.router.set(record.occurrenceId, routerResult)
    const answer = await fx.access.reconcileTurn(AGENT, {
      jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
    })
    assert.equal(answer.error.code, code, routerResult.state)
    assert.equal(await readFile(fx.file, 'utf8'), before, routerResult.state)
  }
  for (const lateOutcome of ['late_completed', 'late_failed']) {
    fx.router.set(record.occurrenceId, {
      state: 'settled',
      snapshot: {
        agentId: AGENT,
        callerCorrelation: {
          occurrenceId: record.occurrenceId, runId: record.runId, requestId: record.requestId,
        },
        lateOutcome,
      },
    })
    const answer = await fx.access.reconcileTurn(AGENT, {
      jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
    })
    assert.equal(answer.error.code, 'business_outcome_available', lateOutcome)
    assert.equal(await readFile(fx.file, 'utf8'), before, lateOutcome)
  }
})

test('one-shot definition is disabled in the settlement commit', async (t) => {
  const fx = await fixture(t, { kind: 'at' })
  const [record] = fx.occurrences
  const result = await fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(result.result.scheduleDisposition, 'one_shot_disabled')
  const doc = await fx.store.loadDoc({ force: true })
  assert.equal(doc.jobs[0].enabled, false)
})

test('pre-commit reconcile crash is zero-write, including one-shot enable state', async (t) => {
  const fx = await fixture(t, { kind: 'at' })
  const [record] = fx.occurrences
  const before = await readFile(fx.file, 'utf8')
  fx.store.beforeCommit = () => { throw new Error('injected before settlement commit') }
  await assert.rejects(() => fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  }), /injected before settlement commit/)
  assert.equal(await readFile(fx.file, 'utf8'), before)
  assert.equal((await fx.store.loadDoc({ force: true })).jobs[0].enabled, true)
})

test('audit append failure is observable without rewriting a committed receipt', async (t) => {
  const fx = await fixture(t)
  const [record] = fx.occurrences
  let failure
  fx.store.appendRunEvent = async () => ({ ok: false, error: 'injected' })
  const access = createSelfOpsAccess({
    store: fx.store,
    resolveCallerCorrelation: ({ occurrenceId }) => fx.router.get(occurrenceId),
    runtimeStatus: () => ({ generationId: 'gen-opaque', health: 'healthy' }),
    clock: () => 1_800_000_010_000,
    onAuditFailure: (coordinates) => { failure = coordinates },
  })
  const result = await access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(result.ok, true)
  assert.equal(failure.operationId, result.result.operationId)
  assert.equal(failure.jobId, fx.job.id)
})

test('operator termination-only settlement is idempotent and self path cannot adopt it', async (t) => {
  const fx = await fixture(t)
  const [record] = fx.occurrences
  const first = await reconcileOccurrence(fx.store, {
    occurrenceId: record.occurrenceId,
    runId: record.runId,
    resolvedTo: 'terminated_without_outcome',
    evidenceNote: 'trusted operator observation',
    nowMs: 1_800_000_010_000,
  })
  assert.equal(first.record.state, 'outcome_unknown')
  assert.equal(first.record.terminationSettlement.actorKind, 'operator')
  assert.equal(first.fenceRemaining, false)
  const bytes = await readFile(fx.file, 'utf8')
  const replay = await reconcileOccurrence(fx.store, {
    occurrenceId: record.occurrenceId,
    runId: record.runId,
    resolvedTo: 'terminated_without_outcome',
    evidenceNote: 'ignored on exact replay',
    nowMs: 1_800_000_020_000,
  })
  assert.equal(replay.record.terminationSettlement.operationId, first.record.terminationSettlement.operationId)
  assert.equal(await readFile(fx.file, 'utf8'), bytes)
  const self = await fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(self.error.code, 'not_reconcilable')
})

test('operator business outcome can settle after termination without changing its receipt snapshot', async (t) => {
  const fx = await fixture(t)
  const [record] = fx.occurrences
  const terminated = await fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  await reconcileOccurrence(fx.store, {
    occurrenceId: record.occurrenceId,
    runId: record.runId,
    resolvedTo: 'succeeded',
    evidenceNote: 'trusted late result',
    nowMs: 1_800_000_020_000,
  })
  const replay = await fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.deepEqual(replay, terminated)
})

test('late business evidence does not move the recurring operational termination boundary', async (t) => {
  const fx = await fixture(t, { kind: 'every' })
  const [record] = fx.occurrences
  const terminated = await fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(terminated.result.committedAt, 1_800_000_010_000)
  await reconcileOccurrence(fx.store, {
    occurrenceId: record.occurrenceId, runId: record.runId,
    resolvedTo: 'succeeded', evidenceNote: 'business result arrived much later',
    nowMs: 1_800_000_070_000,
  })
  const doc = await fx.store.loadDoc({ force: true })
  const candidate = naturalCandidate({
    job: doc.jobs[0], occurrences: doc.occurrences, nowMs: 1_800_000_070_001,
  })
  assert.equal(candidate.due, true)
  assert.equal(candidate.nominal, 1_800_000_060_000, 'the first post-termination slot remains eligible')
  assert.equal(doc.occurrences.length, 1, 'late evidence itself creates no backlog or retry')
  assert.deepEqual(await fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  }), terminated)
})

test('concurrent self reconciles converge to one settlement and one immutable receipt', async (t) => {
  const fx = await fixture(t)
  const [record] = fx.occurrences
  const calls = await Promise.all(Array.from({ length: 4 }, () => fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })))
  for (const answer of calls) assert.deepEqual(answer, calls[0])
  const current = (await fx.store.loadDoc({ force: true })).occurrences[0]
  assert.equal(current.history.filter((entry) => entry.from === 'outcome_unknown' && entry.to === 'outcome_unknown').length, 1)
})

test('concurrent self/operator termination converges to one authoritative settlement', async (t) => {
  const fx = await fixture(t)
  const [record] = fx.occurrences
  await Promise.all([
    fx.access.reconcileTurn(AGENT, {
      jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
    }),
    reconcileOccurrence(fx.store, {
      occurrenceId: record.occurrenceId, runId: record.runId,
      resolvedTo: 'terminated_without_outcome', evidenceNote: 'concurrent operator proof',
      nowMs: 1_800_000_010_001,
    }),
  ])
  const current = (await fx.store.loadDoc({ force: true })).occurrences[0]
  assert.ok(['self-agent', 'operator'].includes(current.terminationSettlement.actorKind))
  assert.equal(current.history.filter((entry) => entry.from === 'outcome_unknown' && entry.to === 'outcome_unknown').length, 1)
})

test('concurrent self and trusted late outcome serialize without conflicting authority', async (t) => {
  const fx = await fixture(t)
  const [record] = fx.occurrences
  await Promise.allSettled([
    fx.access.reconcileTurn(AGENT, {
      jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
    }),
    reconcileOccurrence(fx.store, {
      occurrenceId: record.occurrenceId, runId: record.runId,
      resolvedTo: 'succeeded', evidenceNote: 'concurrent trusted business result',
      nowMs: 1_800_000_010_001,
    }),
  ])
  const current = (await fx.store.loadDoc({ force: true })).occurrences[0]
  assert.equal(current.state, 'succeeded')
  assert.equal(current.lateSettlement.resolvedTo, 'succeeded')
  assert.ok(current.terminationSettlement === undefined || current.terminationSettlement.kind === 'terminated_without_outcome')
  assert.ok(current.history.filter((entry) => entry.from === 'outcome_unknown' && entry.to === 'outcome_unknown').length <= 1)
})

test('post-commit response loss returns the exact receipt through later outcome and replay', async (t) => {
  const fx = await fixture(t, { kind: 'at' })
  const [record] = fx.occurrences
  const originalWrite = fx.store._writeAtomicDoc.bind(fx.store)
  let injected = false
  fx.store._writeAtomicDoc = async (doc) => {
    await originalWrite(doc)
    if (!injected) {
      injected = true
      throw Object.assign(new Error('injected response loss after rename'), { mutationOutcome: 'committed' })
    }
  }
  const recovered = await fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.equal(recovered.ok, true)
  const committed = await fx.store.loadDoc({ force: true })
  assert.equal(committed.jobs[0].enabled, false, 'one-shot disable and settlement commit atomically')
  await reconcileOccurrence(fx.store, {
    occurrenceId: record.occurrenceId, runId: record.runId,
    resolvedTo: 'succeeded', evidenceNote: 'late result after response loss',
    nowMs: 1_800_000_020_000,
  })
  const replay = await fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: record.occurrenceId, runId: record.runId,
  })
  assert.deepEqual(replay, recovered)
  const events = await fx.store.readRunEvents()
  assert.equal(events.filter((event) => event.action === 'self_reconcile_termination').length, 1)
})

test('V2 migration marks records legacy without inventing owner or request identity', async (t) => {
  const fx = await fixture(t)
  const doc = await fx.store.loadDoc({ force: true })
  const legacy = structuredClone(doc.occurrences[0])
  delete legacy.recordSchemaVersion
  delete legacy.ownerAgentId
  delete legacy.requestId
  await writeFile(fx.file, `${JSON.stringify({ version: 2, jobs: doc.jobs, occurrences: [legacy], fences: doc.fences }, null, 2)}\n`)
  const upgraded = await fx.store.loadDoc({ force: true })
  assert.equal(upgraded.version, 3)
  assert.equal(upgraded.occurrences[0].recordSchemaVersion, 2)
  assert.equal(upgraded.occurrences[0].ownerAgentId, undefined)
  const denied = await fx.access.reconcileTurn(AGENT, {
    jobId: fx.job.id, occurrenceId: legacy.occurrenceId, runId: legacy.runId,
  })
  assert.equal(denied.error.code, 'not_found_or_not_owned')
})
