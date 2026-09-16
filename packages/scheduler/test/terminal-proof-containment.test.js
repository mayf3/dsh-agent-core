/**
 * @agent-core/scheduler — SCHEDULER_TERMINAL_PROOF_AND_UNKNOWN_CONTAINMENT_V1
 *
 * Live-path classification contract (SCHEDULER_TIMEOUT_OUTCOME_V3 C-001,
 * C-003, C-004, C-028/C-039; Owner P1 ruling 2026-09-16 —
 * BUSINESS_OUTCOME_PROOF != TERMINATION_PROOF):
 *   PROVEN_BUSINESS_FAILURE (router failed envelope)      => failed
 *   PROVEN_PRE_START_REJECTION (not_admitted envelope)    => failed, no fence
 *   BUSINESS_OUTCOME_UNKNOWN + TRUSTED_EXACT_TERMINATION_PROOF
 *     => outcome_unknown + terminated_without_outcome settlement
 *        + fence release + no automatic retry
 *   BUSINESS_OUTCOME_UNKNOWN + NO_TERMINATION_PROOF
 *     => outcome_unknown + fence retained
 *   a fence-rejected shift on a shared agent => deterministic pre-start
 *   failed disposition — one occurrence's unknown must never reproduce into
 *   another Job's occurrence (UNKNOWN CONTAINMENT).
 *
 * The invoker fakes below return the BRIDGE OUTCOME SHAPES (the scheduler
 * consumes the seam contract, not the Router); the bridge shapes themselves
 * are pinned in scheduler-router/test/terminal-envelope.test.js.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Scheduler } from '../src/scheduler.js'
import { JobStore } from '../src/store.js'

const immediateDeadline = (fn) => { fn(); return 0 }

async function makeScheduler({ invoker, nowMs, deadlineSetTimeout }) {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-terminal-proof-'))
  const scheduler = new Scheduler({
    store: new JobStore(join(dir, 'jobs.json')),
    invoker,
    nowMs,
    deadlineSetTimeout: deadlineSetTimeout ?? setTimeout,
    deadlineClearTimeout: clearTimeout,
  })
  await scheduler.start({ autoStart: false, catchup: false })
  return scheduler
}

const atJob = (id, atMs) => ({
  id, name: id, agentId: 'agent-a',
  schedule: { kind: 'at', at: new Date(atMs).toISOString() },
  payload: { kind: 'agentTurn', message: `work-${id}`, timeoutSeconds: 1 },
  delivery: { mode: 'none' },
  deleteAfterRun: false,
})

test('CONTAINMENT: a fence-rejected shift (not_admitted after dispatch) settles failed — never a second outcome_unknown', async () => {
  const clock = { value: 1_000 }
  const invoker = async (request) => {
    request.onStart() // chain dispatch fired (acquire succeeded) ...
    // ... then the process admission fence rejected the exact prompt.
    return {
      status: 'error', started: false, routerEnvelope: 'not_admitted',
      routerCode: 'AGENT_PROCESS_TURN_FENCED',
      error: 'agent agent-a has an unresolved outcome_unknown turn; new prompt admission is forbidden',
    }
  }
  invoker.assertRunnable = () => true
  const scheduler = await makeScheduler({ invoker, nowMs: () => clock.value })
  const job = await scheduler.createJob(atJob('fenced-shift', 2_000))
  clock.value = 2_000
  await scheduler.tick()
  await scheduler.whenIdle()
  const [record] = scheduler.listOccurrences(job.id)
  assert.equal(record.state, 'failed', 'deterministic NOT_ADMITTED disposition — no new unknown (UNKNOWN CONTAINMENT)')
  assert.equal(record.executionOutcome, 'failed')
  assert.equal(record.terminalEvidence.kind, 'pre-start-rejection')
  assert.match(record.terminalEvidence.detailRef, /new prompt admission is forbidden/)
  assert.equal(scheduler.isFenced(job.id), false, 'a deterministic failed disposition never fences')
  await scheduler.stop()
})

test('TERMINAL_PROOF A: an authoritative terminal RPC failure envelope (no terminationEvidence kind) settles failed', async () => {
  const clock = { value: 1_000 }
  const invoker = async (request) => {
    request.onStart()
    return {
      status: 'error', started: true, routerEnvelope: 'failed',
      error: 'structured session/prompt RPC error response',
      evidence: { terminationEvidence: null, promptReceipt: 'accepted' },
    }
  }
  invoker.assertRunnable = () => true
  const scheduler = await makeScheduler({ invoker, nowMs: () => clock.value })
  const job = await scheduler.createJob(atJob('rpc-failure', 2_000))
  clock.value = 2_000
  await scheduler.tick()
  await scheduler.whenIdle()
  const [record] = scheduler.listOccurrences(job.id)
  assert.equal(record.state, 'failed', 'the Router settled this run failed — the proof must not degrade to unknown')
  assert.equal(record.executionOutcome, 'failed')
  assert.equal(record.terminalEvidence.kind, 'turn-terminal')
  assert.equal(scheduler.isFenced(job.id), false)
  await scheduler.stop()
})

test('TERMINATION_ONLY B: child_real_exit (no business outcome) => outcome_unknown + terminationSettlement + fence released', async () => {
  const clock = { value: 1_000 }
  // The bridge stamps this shape after the trusted router disposition readback
  // proves the exact run settled terminated_without_outcome — a termination
  // proof is NEVER upgraded to a business outcome (Owner P1 ruling, C-039).
  const invoker = async (request) => {
    request.onStart()
    return {
      status: 'outcome_unknown', started: true,
      error: 'agent exited (signal=SIGTRAP) without an exact parsed outcome',
      evidence: { terminationEvidence: 'child_real_exit', source: 'router_disposition_readback' },
      reconciliationHandle: 'turn:exit',
    }
  }
  invoker.assertRunnable = () => true
  const scheduler = await makeScheduler({ invoker, nowMs: () => clock.value })
  const job = await scheduler.createJob(atJob('child-exit', 2_000))
  clock.value = 2_000
  await scheduler.tick()
  await scheduler.whenIdle()
  const [record] = scheduler.listOccurrences(job.id)
  assert.equal(record.state, 'outcome_unknown', 'business state stays unknown — termination != business failure')
  assert.equal(record.executionOutcome, undefined, 'no business outcome is claimed from a termination proof')
  const settlement = record.terminationSettlement
  assert.equal(settlement?.kind, 'terminated_without_outcome')
  assert.equal(settlement?.businessStateAtCommit, 'outcome_unknown')
  assert.equal(settlement?.evidenceKind, 'child_real_exit')
  assert.equal(settlement?.actorKind, 'self-agent')
  assert.equal(settlement?.actorId, record.ownerAgentId)
  assert.equal(settlement?.fenceBefore, true)
  assert.equal(settlement?.fenceAfter, false)
  assert.equal(settlement?.scheduleDisposition, 'one_shot_disabled')
  assert.match(settlement?.operationId ?? '', /^op:[0-9a-f]{16}$/)
  assert.equal(record.terminalEvidence?.kind, 'termination-only')
  assert.equal(scheduler.isFenced(job.id), false, 'the trusted termination settlement releases the fence (C-028/C-044)')
  assert.equal((await scheduler.getJob(job.id)).enabled, false, 'the exhausted one-shot definition is disabled in the settlement commit (C-044)')
  await scheduler.stop()
})

test('TERMINATION_ONLY: no automatic retry after a termination-only settlement (even with explicit retry.auto)', async () => {
  const clock = { value: 1_000 }
  const invoker = async (request) => {
    request.onStart()
    return {
      status: 'outcome_unknown', started: true,
      error: 'agent exited without an exact parsed outcome',
      evidence: { terminationEvidence: 'child_real_exit', source: 'router_disposition_readback' },
      reconciliationHandle: 'turn:exit-retry',
    }
  }
  invoker.assertRunnable = () => true
  const scheduler = await makeScheduler({ invoker, nowMs: () => clock.value })
  const job = await scheduler.createJob({
    ...atJob('no-retry', 2_000),
    retry: { auto: true },
  })
  clock.value = 2_000
  await scheduler.tick()
  await scheduler.whenIdle()
  const [record] = scheduler.listOccurrences(job.id)
  assert.equal(record.state, 'outcome_unknown')
  assert.notEqual(record.terminationSettlement, undefined)
  assert.equal(scheduler.listOccurrences(job.id).length, 1, 'termination-only settlements never mint a retry occurrence')
  clock.value += 60 * 1000
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.equal(scheduler.listOccurrences(job.id).length, 1, 'no retry: retryCandidate requires a failed terminal (C-009)')
  await scheduler.stop()
})

test('TERMINATION_ONLY late: a late trusted termination readback settles a timed-out unknown and releases the fence', async () => {
  const clock = { value: 1_000 }
  let releaseLate
  const invocation = new Promise((resolve) => { releaseLate = resolve })
  const invoker = async (request) => {
    request.onStart()
    return invocation
  }
  invoker.assertRunnable = () => true
  const scheduler = await makeScheduler({ invoker, nowMs: () => clock.value, deadlineSetTimeout: immediateDeadline })
  const job = await scheduler.createJob(atJob('late-termination', 2_000))
  clock.value = 2_000
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.equal(scheduler.listOccurrences(job.id)[0].state, 'outcome_unknown')
  assert.equal(scheduler.isFenced(job.id), true)
  releaseLate({
    status: 'outcome_unknown', started: true, reconciliationHandle: 'turn:late-exit',
    error: 'agent exited (signal=SIGTRAP) without an exact parsed outcome',
    evidence: { terminationEvidence: 'child_real_exit', source: 'router_disposition_readback' },
  })
  const deadline = Date.now() + 2_000
  while (Date.now() < deadline) {
    await scheduler.load()
    if (scheduler.listOccurrences(job.id)[0].terminationSettlement !== undefined) break
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  const [record] = scheduler.listOccurrences(job.id)
  assert.equal(record.state, 'outcome_unknown', 'business state never flips from a termination proof')
  assert.equal(record.terminationSettlement?.evidenceKind, 'child_real_exit')
  assert.equal(scheduler.isFenced(job.id), false, 'the settlement releases the fence — the next natural shift resumes (C-044)')
  await scheduler.stop()
})

test('REGRESSION C: timeout without termination proof stays outcome_unknown and fences', async () => {
  const clock = { value: 1_000 }
  const invoker = async (request) => {
    request.onStart()
    return new Promise(() => {}) // the turn outlives the deadline; no proof ever arrives
  }
  invoker.assertRunnable = () => true
  const scheduler = await makeScheduler({ invoker, nowMs: () => clock.value, deadlineSetTimeout: immediateDeadline })
  const job = await scheduler.createJob(atJob('silent-timeout', 2_000))
  clock.value = 2_000
  await scheduler.tick()
  await scheduler.whenIdle()
  const [record] = scheduler.listOccurrences(job.id)
  assert.equal(record.state, 'outcome_unknown', 'C-001: termination not proven => unknown')
  assert.equal(record.executionOutcome, undefined)
  assert.equal(scheduler.isFenced(job.id), true)
  await scheduler.stop()
})

test('CONTAINMENT E: one agent unknown does not reproduce into another Job on the same agent', async () => {
  const clock = { value: 1_000 }
  const calls = []
  const invoker = async (request) => {
    request.onStart()
    calls.push(request.message)
    if (calls.length === 1) {
      // Job 1: turn vanished without proof (deadline race at the seam) — unknown.
      return { status: 'outcome_unknown', started: true, reconciliationHandle: 'turn:x', error: 'unproven' }
    }
    // Job 2: explicitly rejected by the same agent's unresolved-unknown fence.
    return {
      status: 'error', started: false, routerEnvelope: 'not_admitted',
      routerCode: 'AGENT_PROCESS_TURN_FENCED', error: 'admission forbidden while an unknown is unresolved',
    }
  }
  invoker.assertRunnable = () => true
  const scheduler = await makeScheduler({ invoker, nowMs: () => clock.value })
  const job1 = await scheduler.createJob(atJob('unknown-job', 2_000))
  const job2 = await scheduler.createJob(atJob('fenced-job', 2_000))
  clock.value = 2_000
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.equal(scheduler.listOccurrences(job1.id)[0].state, 'outcome_unknown')
  const [job2Record] = scheduler.listOccurrences(job2.id)
  assert.equal(job2Record.state, 'failed', 'the fence rejection is deterministic — the unknown did not reproduce')
  assert.equal(job2Record.terminalEvidence.kind, 'pre-start-rejection')
  assert.equal(scheduler.isFenced(job1.id), true, 'the original unknown keeps its own job fenced')
  assert.equal(scheduler.isFenced(job2.id), false, 'the neighbouring job must never inherit the fence')
  await scheduler.stop()
})

test('TERMINAL_PROOF: a late deterministic failure envelope resolves a timed-out unknown and releases the fence', async () => {
  const clock = { value: 1_000 }
  let releaseLate
  const invocation = new Promise((resolve) => { releaseLate = resolve })
  const invoker = async (request) => {
    request.onStart()
    return invocation
  }
  invoker.assertRunnable = () => true
  const scheduler = await makeScheduler({ invoker, nowMs: () => clock.value, deadlineSetTimeout: immediateDeadline })
  const job = await scheduler.createJob(atJob('late-failure', 2_000))
  clock.value = 2_000
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.equal(scheduler.listOccurrences(job.id)[0].state, 'outcome_unknown')
  assert.equal(scheduler.isFenced(job.id), true)
  releaseLate({
    status: 'error', started: true, routerEnvelope: 'failed',
    error: 'structured rpc error response', evidence: { terminationEvidence: null },
  })
  const deadline = Date.now() + 2_000
  while (Date.now() < deadline) {
    await scheduler.load()
    if (scheduler.listOccurrences(job.id)[0].state === 'failed') break
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  const [record] = scheduler.listOccurrences(job.id)
  assert.equal(record.state, 'failed', 'trusted late settlement: unknown -> failed')
  assert.equal(record.lateSettlement?.basis, 'trusted-late-evidence')
  assert.equal(scheduler.isFenced(job.id), false, 'settlement releases the fence — the next natural shift resumes (C-044)')
  await scheduler.stop()
})
