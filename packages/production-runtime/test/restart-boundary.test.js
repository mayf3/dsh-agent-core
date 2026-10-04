/**
 * C11-R3 (Product #426) — restart-boundary receipt (DONE_WHEN A4 + the
 * "never stamp exit evidence" guard).
 *
 * A4: an emergency rollback/recovery restart may still cut over for
 * availability, but the old process — whenever it is still observable (the
 * graceful SIGTERM path) — must persist an exact restart-boundary receipt
 * describing the previous epoch, the lifecycle slots and the unresolved
 * handles before/at cutover. The receipt is the runtime's OWN census at the
 * controlled-stop boundary; it is EVIDENCE ONLY — the next startup's
 * classification still reads the durable TurnReconciliationStore, never the
 * receipt (no new trust path).
 *
 * Guard: writing the receipt is strictly read-only over the recovery store.
 * Starting a quiesce must NEVER stamp `exitObservedAt` (or any termination
 * evidence) — that fact exists only through the exact child/generation
 * real-exit observation path.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { TurnReconciliationStore } from '../../agent-router/src/reconciliation-store.js'
import { composeProductionRuntime } from '../src/compose.js'
import { collectRuntimeRestartCensus, appendRestartBoundaryReceipt } from '../src/restart-boundary.js'
import { AGT_ID, FakeProc, seedRuntime, silentLog } from './compose-fixture.js'

function fixtureCensusInputs(t) {
  const root = mkdtempSync(join(tmpdir(), 'restart-boundary-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const turnFile = join(root, 'control', 'turn-recovery-v3.json')
  mkdirSync(join(root, 'control'), { recursive: true })
  // One blocked previous-crash handle (classified through the real startup
  // path) + one still-pending unknown of the CURRENT epoch.
  const first = new TurnReconciliationStore({ persistenceFile: turnFile, runtimeEpoch: 'epoch-now' })
  const lost = first.mintTurnExecution({ agentId: AGT_ID, processGeneration: 3, sessionId: 'normal' })
  first.markAdmitted(lost, { eventWatermarkSeq: 0, promptRequestId: 'req-lost', deadlineAtWallMs: Date.now() + 60_000 })
  first.markPromptWriteAttempted(lost)
  const live = new TurnReconciliationStore({ persistenceFile: turnFile, runtimeEpoch: 'epoch-now' })
  const pending = live.mintTurnExecution({ agentId: AGT_ID, processGeneration: 3, sessionId: 'normal' })
  live.markAdmitted(pending, { eventWatermarkSeq: 0, promptRequestId: 'req-live', deadlineAtWallMs: Date.now() + 60_000 })
  live.markOutcomeUnknown(pending, { source: 'turn_deadline_exceeded' })

  const jobsFile = join(root, 'scheduler', 'jobs.json')
  mkdirSync(join(root, 'scheduler'), { recursive: true })
  writeFileSync(jobsFile, `${JSON.stringify({ version: 3, jobs: [], occurrences: [
    { occurrenceId: 'occ:b1', jobId: 'job-b', runId: 'run:occ:b1', requestId: 'req:occ:b1', state: 'running', ownerAgentId: AGT_ID, payloadHash: 'p', scheduleRevision: 0 },
  ], fences: { 'job-b': 'occ:b1' } })}\n`)

  const router = {
    reconciliationRuntimeStatus: () => ({ generationId: 'epoch-now', health: 'healthy', businessAdmission: 'open', blockedReason: null, unresolvedRecoveries: 2 }),
    // The registry's REAL slot projection shape ({ state, generation, entryId }).
    lifecycleSlotSnapshot: (agentId) => (agentId === AGT_ID
      ? { state: 'READY', generation: 3, entryId: 'e1' }
      : { state: 'EMPTY' }),
  }
  return { root, turnFile, jobsFile, router, lostHandle: lost, pendingHandle: pending }
}

test('A4: the runtime census names the epoch, the lifecycle slots and every unresolved handle class', (t) => {
  const { turnFile, jobsFile, router, lostHandle, pendingHandle } = fixtureCensusInputs(t)
  const census = collectRuntimeRestartCensus({
    turnRecoveryStore: turnFile, jobsStore: jobsFile, router, agentIds: [AGT_ID, 'agt_other'],
  })
  assert.equal(census.epoch, 'epoch-now')
  assert.deepEqual(census.slots, [{ agentId: AGT_ID, slot: 'READY', generation: 3, entryId: 'e1', cause: null }],
    'the STARTUP/READY/REAP lifecycle slots are censused (non-EMPTY only)')
  // The pending unknown of the current epoch is the drainable in-flight turn;
  // the crash-lost one is already classified (recoveryState blocked).
  assert.deepEqual(census.inflightTurns.map((h) => h.handle), [pendingHandle])
  assert.deepEqual(census.unresolvedLostTurns.map((h) => h.handle), [lostHandle])
  assert.deepEqual(census.inflightOccurrences.map((o) => o.occurrenceId), ['occ:b1'])
})

test('GUARD: taking the census and writing the boundary receipt never touches the recovery store', (t) => {
  const { turnFile, jobsFile, router } = fixtureCensusInputs(t)
  const before = readFileSync(turnFile)
  const census = collectRuntimeRestartCensus({
    turnRecoveryStore: turnFile, jobsStore: jobsFile, router, agentIds: [AGT_ID],
  })
  const boundaryLog = join(turnFile, '..', 'restart-boundary.jsonl')
  appendRestartBoundaryReceipt({ boundaryLog, entry: { kind: 'restart_boundary', phase: 'quiesce_begin', census } })
  assert.equal(readFileSync(turnFile).equals(before), true,
    'quiesce started is NOT exit evidence: the store bytes are untouched')
  const reopened = JSON.parse(readFileSync(turnFile, 'utf8'))
  for (const record of reopened.records) {
    assert.equal(record.exitObservedAt ?? null, null,
      'exitObservedAt is only ever stamped by the exact real-exit path')
    assert.equal(record.terminationEvidence ?? null, null)
  }
  const lines = readFileSync(boundaryLog, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  assert.equal(lines.length, 1)
  assert.equal(lines[0].kind, 'restart_boundary')
  assert.equal(lines[0].phase, 'quiesce_begin')
  assert.equal(lines[0].census.epoch, 'epoch-now')
})

test('compose stop persists the boundary receipt across the controlled shutdown (quiesce begin/end)', async (t) => {
  const { layout } = await seedRuntime(t)
  const runtime = await composeProductionRuntime({
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: false, port: 0 },
    processFactory: (opts) => new FakeProc(opts),
    log: silentLog,
  })
  await runtime.stop('SIGTERM')
  const boundaryLog = layout.restartBoundaryLog
  assert.ok(existsSync(boundaryLog), 'the boundary receipt file exists after the controlled stop')
  const lines = readFileSync(boundaryLog, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  assert.deepEqual(lines.map((line) => line.phase), ['quiesce_begin', 'quiesce_end'])
  for (const line of lines) {
    assert.equal(line.kind, 'restart_boundary')
    assert.equal(line.signal, 'SIGTERM')
    assert.ok(typeof line.census.epoch === 'string' && line.census.epoch.length > 0, 'the previous epoch is named')
    assert.ok(Array.isArray(line.census.slots) && Array.isArray(line.census.inflightTurns))
  }
  // Post-drain the in-flight census is empty: the controlled stop drained
  // through the existing dispose path (no fake processes were busy).
  assert.deepEqual(lines[1].census.inflightTurns, [])
})
