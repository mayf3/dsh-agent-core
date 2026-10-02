/**
 * C11-R3 (Product #426) — planned-restart drain gate (DONE_WHEN A1–A3).
 *
 * The defect on current main: `restartSchedulerProductionRuntime` bootouts
 * the runtime unconditionally. A Router/Scheduler turn in flight at bootout
 * loses live generation ownership with the old epoch and re-surfaces as
 * restart-lost `outcome_unknown` (the recurring HR s338 failure mode) — a
 * PLANNED restart must never create one.
 *
 * The gate under test: before ANY mutation (plist preimage capture included),
 * the restart path takes one authoritative census over the durable
 * turn-recovery store (admitted in-flight Router turn handles +
 * runtimeEpoch/generation) and the scheduler jobs store (admitted/running
 * occurrences bound to those turns), waits a bounded window for the existing
 * shutdown/reap/settlement paths to drain them, and REFUSES the ordinary
 * restart before stopping the runtime when identifiable execution remains
 * undrained. An explicit emergency acceptance (`acceptUndrainedRestart`, the
 * A4 escape hatch) proceeds ONLY with a restart-boundary receipt naming the
 * previous epoch and the unresolved handles. Census-unavailable (corrupt
 * store) refuses fail-closed: quiescence cannot be proven.
 *
 * Fixtures are real artifacts: the turn-recovery store is written by the real
 * TurnReconciliationStore; no production identity, paths or services.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

import { restartSchedulerProductionRuntime } from '../../src/scheduler/deployment-runtime-restart.js'
import { TurnReconciliationStore } from '../../../agent-router/src/reconciliation-store.js'

const SHA = '1234567890abcdef1234567890abcdef12345678'

/** Production-shaped restart ctx over a tmp launchd dir, with launchd mocked. */
function baseCtx(t) {
  const root = mkdtempSync(join(tmpdir(), 'restart-drain-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const launchdDir = join(root, 'launchd')
  const artifactsDir = join(root, 'artifacts')
  mkdirSync(launchdDir); mkdirSync(join(root, 'bin'))
  const plistPath = join(launchdDir, 'ai.agent-core.runtime.plist')
  const plistBytes = '<plist><dict><key>HOME</key><string>/Users/authsvc</string></dict></plist>\n'
  writeFileSync(plistPath, plistBytes)
  chmodSync(plistPath, 0o600)
  if (process.platform === 'darwin') execFileSync('/usr/bin/xattr', ['-c', plistPath])
  const curl = join(root, 'bin', 'curl')
  writeFileSync(curl, '#!/bin/sh\nprintf \'%s\\n\' \'{"ok":true}\'\n')
  chmodSync(curl, 0o700)
  const oldPath = process.env.PATH
  process.env.PATH = `${join(root, 'bin')}:${oldPath}`
  t.after(() => { process.env.PATH = oldPath })
  const calls = { bootout: 0, bootstrap: 0, receipts: [], drainReceipts: [], phases: [], loaded: true }
  const ctx = {
    launchdDir, artifactsDir, authsvcUid: 501, authsvcGid: 601, runtimeReaderGid: 20,
    isLoaded: () => calls.loaded,
    bootout: () => { calls.bootout += 1; calls.loaded = false },
    bootstrap: () => { calls.bootstrap += 1; calls.loaded = true },
    runtimeReceipt: (receipt) => calls.receipts.push(receipt),
    runtimeDrainReceipt: (receipt) => calls.drainReceipts.push(receipt),
  }
  return { root, ctx, calls, plistPath, plistBytes }
}

/** Real durable turn-recovery store fixture; `reopen` classifies through the
 *  real startup path (promptWriteAttempted without outcome -> blocked). */
function seedTurnStore(file, { epoch = 'epoch-live', kind = 'inflight', agentId = 'agt_a' } = {}) {
  mkdirSync(join(file, '..'), { recursive: true })
  const seq = `${kind}-${Math.random().toString(36).slice(2, 8)}`
  const first = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: epoch })
  const handle = first.mintTurnExecution({ agentId, processGeneration: 4, sessionId: 'normal' })
  first.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: `req-${seq}`, deadlineAtWallMs: Date.now() + 60_000 })
  if (kind === 'inflight') first.markPromptWriteAttempted(handle)
  if (kind === 'unknown') first.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
  if (kind === 'settled') first.settleDirect(handle, { outcome: 'completed', outcomeEvidence: 'fixture' })
  if (kind === 'blocked') {
    const reopened = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: epoch })
    return { handle, store: reopened, epoch }
  }
  return { handle, store: first, epoch }
}

function seedJobsStore(t, file, occurrences = []) {
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, `${JSON.stringify({ version: 3, jobs: [], occurrences, fences: {} })}\n`)
}

const runningOccurrence = (occurrenceId = 'occ:restart-drain:1') => ({
  occurrenceId, jobId: 'job-r1', runId: `run:${occurrenceId}`, requestId: `req:${occurrenceId}`,
  state: 'running', ownerAgentId: 'agt_a', payloadHash: 'p', scheduleRevision: 0,
})

test('A1/A3: ordinary restart with an in-flight admitted turn REFUSES before any runtime mutation', (t) => {
  const { root, ctx, calls, plistPath, plistBytes } = baseCtx(t)
  const turnFile = join(root, 'control', 'turn-recovery-v3.json')
  const seeded = seedTurnStore(turnFile, { kind: 'inflight' })
  ctx.turnRecoveryStore = turnFile
  ctx.storePath = join(root, 'scheduler', 'jobs.json')
  seedJobsStore(t, ctx.storePath, [])
  ctx.restartDrainWindowMs = 20

  assert.throws(() => restartSchedulerProductionRuntime({ ctx, phase: (n, ok, msg) => calls.phases.push([n, ok, msg]), sourceSha: SHA }),
    (error) => error?.code === 'RESTART_DRAIN_UNDRAINED')
  // Fail-closed BEFORE stopping the runtime: no bootout/bootstrap, no plist
  // mutation, no install receipt — and the refusal is receipted with the
  // exact census (epoch + in-flight handle + generation).
  assert.equal(calls.bootout, 0)
  assert.equal(calls.bootstrap, 0)
  assert.equal(readFileSync(plistPath, 'utf8'), plistBytes, 'plist untouched by the refused restart')
  assert.deepEqual(calls.receipts, [], 'the single-slot INSTALL receipt is never touched by a refusal')
  const refused = calls.drainReceipts.filter((r) => r.status === 'DRAIN_REFUSED')
  assert.equal(refused.length, 1, 'exactly one refusal receipt on the DEDICATED drain receipt channel')
  assert.equal(refused[0].census.epoch, seeded.epoch)
  assert.deepEqual(refused[0].census.inflightTurns.map((h) => h.handle), [seeded.handle])
  assert.equal(refused[0].census.inflightTurns[0].processGeneration, 4)
  assert.equal(refused[0].census.drained, false)
})

test('A1: an admitted/running scheduler occurrence is identifiable execution and refuses too', (t) => {
  const { root, ctx, calls } = baseCtx(t)
  const turnFile = join(root, 'control', 'turn-recovery-v3.json')
  seedTurnStore(turnFile, { kind: 'settled' })
  ctx.turnRecoveryStore = turnFile
  ctx.storePath = join(root, 'scheduler', 'jobs.json')
  seedJobsStore(t, ctx.storePath, [runningOccurrence()])
  ctx.restartDrainWindowMs = 20

  assert.throws(() => restartSchedulerProductionRuntime({ ctx, phase: () => {}, sourceSha: SHA }),
    (error) => error?.code === 'RESTART_DRAIN_UNDRAINED')
  assert.equal(calls.bootout, 0)
  const refused = calls.drainReceipts.filter((r) => r.status === 'DRAIN_REFUSED')[0]
  assert.deepEqual(refused.census.inflightOccurrences.map((o) => o.occurrenceId), ['occ:restart-drain:1'])
})

test('A2: a quiescent runtime restarts; the gate receipts one DRAIN_OBSERVED census', (t) => {
  const { root, ctx, calls } = baseCtx(t)
  const turnFile = join(root, 'control', 'turn-recovery-v3.json')
  seedTurnStore(turnFile, { kind: 'settled' })
  ctx.turnRecoveryStore = turnFile
  ctx.storePath = join(root, 'scheduler', 'jobs.json')
  seedJobsStore(t, ctx.storePath, [])

  const result = restartSchedulerProductionRuntime({ ctx, phase: () => {}, sourceSha: SHA })
  assert.equal(result.healthy, true)
  assert.equal(calls.bootout, 1)
  assert.deepEqual(calls.receipts.map((r) => r.status), ['INSTALLING', 'INSTALLED'],
    'the install receipt channel carries only INSTALLING/INSTALLED (rollback lane intact)')
  assert.deepEqual(calls.drainReceipts.map((r) => r.status), ['DRAIN_OBSERVED'])
  assert.equal(calls.drainReceipts[0].census.drained, true)
})

test('A2: the bounded drain window observes the existing settlement path drain the turn', (t) => {
  const { root, ctx, calls } = baseCtx(t)
  const turnFile = join(root, 'control', 'turn-recovery-v3.json')
  const seeded = seedTurnStore(turnFile, { kind: 'inflight' })
  ctx.turnRecoveryStore = turnFile
  ctx.storePath = join(root, 'scheduler', 'jobs.json')
  seedJobsStore(t, ctx.storePath, [])
  ctx.restartDrainWindowMs = 5_000
  ctx.restartDrainPollMs = 1
  // The "runtime" drains through its EXISTING settlement path while the
  // deployment-side gate polls the durable census — simulated synchronously
  // on the first poll (the gate re-reads the durable store every poll).
  let polls = 0
  ctx.restartDrainSleep = () => {
    polls += 1
    if (polls === 1) seeded.store.settleDirect(seeded.handle, { outcome: 'completed', outcomeEvidence: 'drained-during-window' })
  }

  restartSchedulerProductionRuntime({ ctx, phase: () => {}, sourceSha: SHA })
  assert.equal(calls.bootout, 1)
  const observed = calls.drainReceipts.filter((r) => r.status === 'DRAIN_OBSERVED')[0]
  assert.equal(observed.census.drained, true)
  assert.ok(observed.drain?.waitedMs >= 0 && observed.drain?.polls >= 1, 'the wait is receipted')
})

test('A3: a turn still undrained at window expiry refuses — the window is bounded', (t) => {
  const { root, ctx, calls } = baseCtx(t)
  const turnFile = join(root, 'control', 'turn-recovery-v3.json')
  seedTurnStore(turnFile, { kind: 'inflight' })
  ctx.turnRecoveryStore = turnFile
  ctx.storePath = join(root, 'scheduler', 'jobs.json')
  seedJobsStore(t, ctx.storePath, [])
  ctx.restartDrainWindowMs = 30
  ctx.restartDrainPollMs = 5

  assert.throws(() => restartSchedulerProductionRuntime({ ctx, phase: () => {}, sourceSha: SHA }),
    (error) => error?.code === 'RESTART_DRAIN_UNDRAINED')
  assert.equal(calls.bootout, 0)
})

test('A4: emergency restart (acceptUndrainedRestart) proceeds ONLY with a restart-boundary receipt', (t) => {
  const { root, ctx, calls } = baseCtx(t)
  const turnFile = join(root, 'control', 'turn-recovery-v3.json')
  const seeded = seedTurnStore(turnFile, { kind: 'inflight' })
  ctx.turnRecoveryStore = turnFile
  ctx.storePath = join(root, 'scheduler', 'jobs.json')
  seedJobsStore(t, ctx.storePath, [])
  ctx.restartDrainWindowMs = 20
  ctx.acceptUndrainedRestart = true

  restartSchedulerProductionRuntime({ ctx, phase: () => {}, sourceSha: SHA })
  assert.equal(calls.bootout, 1, 'the emergency restart still restarts (availability)')
  const boundary = calls.drainReceipts.filter((r) => r.status === 'RESTART_BOUNDARY')
  assert.equal(boundary.length, 1, 'exactly one boundary receipt on the dedicated channel')
  assert.equal(boundary[0].census.epoch, seeded.epoch)
  assert.deepEqual(boundary[0].census.inflightTurns.map((h) => h.handle), [seeded.handle])
  assert.deepEqual(calls.receipts.map((r) => r.status), ['INSTALLING', 'INSTALLED'],
    'the emergency cutover still produces a normal install receipt generation')
})

test('fail-closed: a census-unavailable (corrupt) turn-recovery store refuses the restart', (t) => {
  const { root, ctx, calls } = baseCtx(t)
  const turnFile = join(root, 'control', 'turn-recovery-v3.json')
  mkdirSync(join(turnFile, '..'), { recursive: true })
  writeFileSync(turnFile, '{"version":3,"runtimeEpoch":"epoch-x","records":"not-an-array"}')
  ctx.turnRecoveryStore = turnFile
  ctx.storePath = join(root, 'scheduler', 'jobs.json')
  seedJobsStore(t, ctx.storePath, [])
  ctx.restartDrainWindowMs = 20

  assert.throws(() => restartSchedulerProductionRuntime({ ctx, phase: () => {}, sourceSha: SHA }),
    (error) => error?.code === 'RESTART_DRAIN_CENSUS_UNAVAILABLE')
  assert.equal(calls.bootout, 0)
})

test('legacy callers without census paths are unarmed: restart behaves exactly as before', (t) => {
  const { ctx, calls } = baseCtx(t)
  const result = restartSchedulerProductionRuntime({ ctx, phase: () => {}, sourceSha: SHA })
  assert.equal(result.healthy, true)
  assert.equal(calls.bootout, 1)
  assert.deepEqual(calls.receipts.map((r) => r.status), ['INSTALLING', 'INSTALLED'],
    'no install-channel change when the gate is not armed')
  assert.deepEqual(calls.drainReceipts, [], 'no drain receipts when the gate is not armed')
})

test('previous-epoch unresolved turns do NOT block a planned restart (the startup matrix owns them)', (t) => {
  const { root, ctx, calls } = baseCtx(t)
  const turnFile = join(root, 'control', 'turn-recovery-v3.json')
  // Epoch 1 mints an admitted turn that ends pending_unknown, then dies
  // unobserved. Epoch 2 boots (its startup classification leaves the record
  // pending_unknown of the PREVIOUS epoch) and while epoch 2 is live, a
  // planned restart must not wait forever on a process that no longer exists.
  const seed = new TurnReconciliationStore({ persistenceFile: turnFile, runtimeEpoch: 'epoch-1' })
  const handle = seed.mintTurnExecution({ agentId: 'agt_a', processGeneration: 2, sessionId: 'normal' })
  seed.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'req-prev', deadlineAtWallMs: Date.now() + 60_000 })
  seed.markPromptWriteAttempted(handle)
  seed.markOutcomeUnknown(handle, { source: 'turn_deadline_exceeded' })
  // Epoch 2 boots and runs REAL live work (one settled turn — this is what
  // persists the new epoch as the store's current one, exactly like a live
  // runtime's own mutations do).
  const live = new TurnReconciliationStore({ persistenceFile: turnFile, runtimeEpoch: 'epoch-2' })
  assert.equal(live.getTurnReconciliation(handle).snapshot.recoveryState, 'pending_unknown')
  const epoch2Handle = live.mintTurnExecution({ agentId: 'agt_b', processGeneration: 1, sessionId: 'normal' })
  live.markAdmitted(epoch2Handle, { eventWatermarkSeq: 0, promptRequestId: 'req-e2', deadlineAtWallMs: Date.now() + 60_000 })
  live.settleDirect(epoch2Handle, { outcome: 'completed', outcomeEvidence: 'epoch-2-work' })

  ctx.turnRecoveryStore = turnFile
  ctx.storePath = join(root, 'scheduler', 'jobs.json')
  seedJobsStore(t, ctx.storePath, [])

  restartSchedulerProductionRuntime({ ctx, phase: () => {}, sourceSha: SHA })
  assert.equal(calls.bootout, 1, 'the restart proceeds: a previous-epoch unknown is not drainable work')
  const observed = calls.drainReceipts.filter((r) => r.status === 'DRAIN_OBSERVED')[0]
  assert.equal(observed.census.epoch, 'epoch-2', 'the census names the CURRENT live epoch')
  assert.deepEqual(observed.census.inflightTurns, [], 'no current-epoch in-flight turn')
  assert.deepEqual(observed.census.unresolvedLostTurns.map((h) => h.handle), [handle],
    'the previous-epoch unknown is receipted as already-lost, not as in-flight')
})

test('row 6 (repeated restart): after a drained restart the next armed restart proceeds again', (t) => {
  const { root, ctx, calls } = baseCtx(t)
  const turnFile = join(root, 'control', 'turn-recovery-v3.json')
  seedTurnStore(turnFile, { kind: 'settled' })
  ctx.turnRecoveryStore = turnFile
  ctx.storePath = join(root, 'scheduler', 'jobs.json')
  seedJobsStore(t, ctx.storePath, [])

  restartSchedulerProductionRuntime({ ctx, phase: () => {}, sourceSha: SHA })
  restartSchedulerProductionRuntime({ ctx, phase: () => {}, sourceSha: SHA })
  assert.equal(calls.bootout, 2)
  assert.equal(calls.drainReceipts.filter((r) => r.status === 'DRAIN_OBSERVED').length, 2,
    'every armed restart takes its own census; no residue')
})
