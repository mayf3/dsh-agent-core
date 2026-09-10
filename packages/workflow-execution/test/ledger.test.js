/**
 * WORKFLOW_AGENT_EXECUTION_V1 — ledger tests: the atomic one-attempt fence,
 * deterministic attempt ids, restart replay, and terminal-append refusal.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { ExecutionLedger, attemptIdFor } from '../src/ledger.js'

const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const VISIT_2 = '1d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e22'
const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
const INTENT_2 = '3d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e44'
const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const OWNER = '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66'

function tempLedger(log = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-ledger-'))
  return { ledger: new ExecutionLedger({ dir, clock: (() => { let n = 1000; return () => ++n })(), log }), dir }
}

function cleanup({ dir }) {
  rmSync(dir, { recursive: true, force: true })
}

test('attemptIdFor is deterministic per NodeVisit and grammar-checked', () => {
  const id = attemptIdFor(VISIT)
  assert.match(id, /^wfeat-[0-9a-f]{24}$/)
  assert.equal(id, attemptIdFor(VISIT.toLowerCase()))
  assert.equal(id, attemptIdFor(VISIT.toUpperCase()))
  assert.notEqual(id, attemptIdFor(VISIT_2))
  assert.throws(() => attemptIdFor('nope'), TypeError)
})

test('beginAttemptIfAbsent: first call creates, ANY existing attempt blocks a second (no re-run after NEEDS_REVIEW)', async () => {
  const fixture = tempLedger()
  try {
    const { ledger } = fixture
    const first = await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    assert.equal(first.created, true)
    assert.equal(first.attempt.state, 'ACTIVE')
    assert.equal(first.attempt.attemptId, attemptIdFor(VISIT))

    // A re-poll of the SAME intent never re-attempts.
    const same = await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    assert.equal(same.created, false)
    assert.equal(same.cause, 'already_attempted')

    // A DIFFERENT dispatch intent for the SAME NodeVisit (duplicate trigger
    // via HR/Scheduler/poll) also never re-attempts.
    const other = await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT_2, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    assert.equal(other.created, false)

    // A failed attempt (NEEDS_REVIEW) still blocks — outcome unknown is never
    // automatically rerun.
    await ledger.recordDeliveryFailed({ nodeVisitId: VISIT, reason: 'delivery_rejected:AGENT_DISABLED' })
    const afterFailure = await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    assert.equal(afterFailure.created, false)
  } finally {
    cleanup(fixture)
  }
})

test('concurrent beginAttemptIfAbsent for one NodeVisit mints exactly one attempt', async () => {
  const fixture = tempLedger()
  try {
    const { ledger } = fixture
    const results = await Promise.all([
      ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER }),
      ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER }),
      ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT_2, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER }),
    ])
    assert.equal(results.filter((r) => r.created).length, 1, 'exactly one winner')
    assert.equal(ledger.snapshot().length, 1)
  } finally {
    cleanup(fixture)
  }
})

test('full lifecycle: planned -> delivered -> reconciled SETTLED; terminal attempts refuse further appends', async () => {
  const fixture = tempLedger()
  try {
    const { ledger } = fixture
    await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    await ledger.recordRunDelivered({
      nodeVisitId: VISIT,
      agentId: 'agt_target-agent',
      requestId: attemptIdFor(VISIT),
      sessionId: 'main',
      reconciliationHandle: 'turn:1:a:g:s',
    })
    const delivered = ledger.get(VISIT)
    assert.equal(delivered.phase, 'run_delivered')
    assert.equal(delivered.delivered.agentId, 'agt_target-agent')
    assert.equal(delivered.delivered.requestId, attemptIdFor(VISIT))

    await ledger.recordReconciled({ nodeVisitId: VISIT, expectedPhase: 'run_delivered', verdict: 'SETTLED', judgment: 'business_commitment_observed', reason: 'node_visit_no_longer_current' })
    assert.equal(ledger.get(VISIT).state, 'SETTLED')
    assert.deepEqual(ledger.listActive(), [])

    await assert.rejects(
      () => ledger.recordReconciled({ nodeVisitId: VISIT, expectedPhase: 'reconciled', verdict: 'NEEDS_REVIEW', judgment: 'x', reason: 'late writer' }),
      /terminal/,
      'late writers on settled visits must fail loud, never be absorbed',
    )
    await assert.rejects(
      () => ledger.recordRunDelivered({ nodeVisitId: VISIT, agentId: 'agt_x', requestId: 'r', sessionId: 'main' }),
      /terminal/,
    )
  } finally {
    cleanup(fixture)
  }
})

test('reconciled verdict ACTIVE is not a ledger event (only terminal verdicts land)', async () => {
  const fixture = tempLedger()
  try {
    const { ledger } = fixture
    await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    await assert.rejects(
      () => ledger.recordReconciled({ nodeVisitId: VISIT, expectedPhase: 'planned', verdict: 'ACTIVE', judgment: 'run_running', reason: 'x' }),
      TypeError,
    )
  } finally {
    cleanup(fixture)
  }
})

test('restart replay: a fresh ledger over the same dir restores the exact projection (dedupe survives restarts)', async () => {
  const fixture = tempLedger()
  try {
    const { ledger, dir } = fixture
    await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    await ledger.recordRunDelivered({ nodeVisitId: VISIT, agentId: 'agt_target-agent', requestId: 'r1', sessionId: 'main', reconciliationHandle: 'turn:h1' })
    await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT_2, nodeVisitId: VISIT_2, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    // Seed a HISTORICAL V1-era event as raw bytes, exactly as the V1 binary
    // would have left it on disk (the V2 write guard refuses new-path
    // resolve_failed deliveries — this is replayed history, not a new fact).
    appendFileSync(ledger.eventsFile, `${JSON.stringify({ kind: 'delivery_failed', attemptId: attemptIdFor(VISIT_2), nodeVisitId: VISIT_2, reason: 'resolve_failed:principal_not_found', atMs: 1002 })}\n`)

    const revived = new ExecutionLedger({ dir })
    assert.equal(revived.get(VISIT).state, 'ACTIVE')
    assert.equal(revived.get(VISIT).delivered.reconciliationHandle, 'turn:h1')
    // V2 CTR-WAE-011 (projection-only reclassification): the HISTORICAL
    // V1-era delivery_failed{resolve_failed:*} event on disk is unchanged;
    // its projected state mapping is now the recoverable-blocked live phase.
    assert.equal(revived.get(VISIT_2).state, 'ACTIVE')
    assert.equal(revived.get(VISIT_2).phase, 'resolution_blocked')
    assert.equal(revived.get(VISIT_2).blockedCode, 'principal_not_found')
    assert.equal(revived.get(VISIT_2).historicalBlocked, true)
    assert.equal(revived.listActive().length, 2)

    const again = await revived.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    assert.equal(again.created, false, 'restart does not un-block the one-attempt fence')
  } finally {
    cleanup(fixture)
  }
})

test('torn tail: repair under lock preserves the next fence across another restart', async () => {
  const fixture = tempLedger()
  try {
    const { ledger, dir } = fixture
    await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    const { appendFileSync, readFileSync } = await import('node:fs')
    appendFileSync(ledger.eventsFile, '{"kind":"attempt_planned","nodeVis') // torn tail

    const revived = new ExecutionLedger({ dir })
    assert.equal(revived.snapshot().length, 1)
    const second = await revived.beginAttemptIfAbsent({ dispatchIntentId: INTENT_2, nodeVisitId: VISIT_2, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    assert.equal(second.created, true, 'mutation truncates the ignored tail before appending')

    const bytes = readFileSync(ledger.eventsFile, 'utf8')
    assert.equal(bytes.endsWith('\n'), true)
    assert.doesNotThrow(() => bytes.trimEnd().split('\n').forEach((line) => JSON.parse(line)))

    const restartedAgain = new ExecutionLedger({ dir })
    assert.equal(restartedAgain.snapshot().length, 2)
    const duplicate = await restartedAgain.beginAttemptIfAbsent({ dispatchIntentId: INTENT_2, nodeVisitId: VISIT_2, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    assert.equal(duplicate.created, false, 'the post-tail fence survives restart')
  } finally {
    cleanup(fixture)
  }
})

test('complete tail without newline is sealed before the next durable append', async () => {
  const fixture = tempLedger()
  try {
    const { ledger, dir } = fixture
    await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    const { readFileSync, writeFileSync } = await import('node:fs')
    const completeRecordWithoutNewline = readFileSync(ledger.eventsFile, 'utf8').trimEnd()
    writeFileSync(ledger.eventsFile, completeRecordWithoutNewline)

    const revived = new ExecutionLedger({ dir })
    const second = await revived.beginAttemptIfAbsent({ dispatchIntentId: INTENT_2, nodeVisitId: VISIT_2, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    assert.equal(second.created, true)

    const bytes = readFileSync(ledger.eventsFile, 'utf8')
    assert.equal(bytes.endsWith('\n'), true)
    assert.equal(bytes.trimEnd().split('\n').length, 2)
    assert.doesNotThrow(() => bytes.trimEnd().split('\n').forEach((line) => JSON.parse(line)))
  } finally {
    cleanup(fixture)
  }
})

test('newline seal I/O failure aborts the locked mutation before event append', async () => {
  const fixture = tempLedger()
  try {
    const { ledger, dir } = fixture
    await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    writeFileSync(ledger.eventsFile, readFileSync(ledger.eventsFile, 'utf8').trimEnd())

    let injectSealFailure = true
    const revived = new ExecutionLedger({
      dir,
      io: {
        appendFileSync: (path, value) => {
          if (injectSealFailure && value === '\n') {
            injectSealFailure = false
            const error = new Error('injected newline seal I/O failure')
            error.code = 'EIO'
            throw error
          }
          appendFileSync(path, value)
        },
      },
    })
    await assert.rejects(
      () => revived.beginAttemptIfAbsent({ dispatchIntentId: INTENT_2, nodeVisitId: VISIT_2, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER }),
      /injected newline seal I\/O failure/,
      'a failed newline seal must abort before the requested event append',
    )
    assert.equal(readFileSync(ledger.eventsFile, 'utf8').trimEnd().split('\n').length, 1)

    const retry = await revived.beginAttemptIfAbsent({ dispatchIntentId: INTENT_2, nodeVisitId: VISIT_2, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    assert.equal(retry.created, true, 'the queue remains usable after the fail-loud I/O error')
    const repaired = readFileSync(ledger.eventsFile, 'utf8')
    assert.equal(repaired.trimEnd().split('\n').length, 2)
    assert.doesNotThrow(() => repaired.trimEnd().split('\n').forEach((line) => JSON.parse(line)))
  } finally {
    cleanup(fixture)
  }
})

test('first fence syncs the ledger directory and fails loud when publication durability is unavailable', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-ledger-dir-sync-'))
  const syncPaths = []
  let failLedgerDirectorySync = true
  const ledger = new ExecutionLedger({
    dir,
    io: {
      syncDirectorySync: (path) => {
        syncPaths.push(path)
        if (path === dir && failLedgerDirectorySync) {
          failLedgerDirectorySync = false
          throw Object.assign(new Error('injected directory fsync failure'), { code: 'EIO' })
        }
      },
    },
  })
  try {
    await assert.rejects(
      () => ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER }),
      /injected directory fsync failure/,
      'the first fence is not reported committed without durable directory publication',
    )
    assert.deepEqual(syncPaths, [dirname(dir), dir])

    const sameProcessDuplicate = await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    assert.equal(sameProcessDuplicate.created, false)
    assert.deepEqual(syncPaths, [dirname(dir), dir, dir], 'the next mutation re-confirms a failed event-file publication')

    // The bytes written before the injected failure remain a fence. A fresh
    // replay must block a second attempt rather than append a duplicate.
    const restarted = new ExecutionLedger({ dir })
    const duplicate = await restarted.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    assert.equal(duplicate.created, false)
    assert.equal(duplicate.cause, 'already_attempted')
    assert.equal(restarted.snapshot().length, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('new ledger directory is published before the first event-file directory entry', async () => {
  const root = mkdtempSync(join(tmpdir(), 'wfe-ledger-directory-order-'))
  const dir = join(root, 'workflow-execution')
  const syncPaths = []
  try {
    const ledger = new ExecutionLedger({
      dir,
      io: { syncDirectorySync: (path) => { syncPaths.push(path) } },
    })
    await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    assert.deepEqual(syncPaths, [root, dir])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('records for unknown NodeVisits fail loud (never fabricate linkage)', async () => {
  const fixture = tempLedger()
  try {
    const { ledger } = fixture
    await assert.rejects(
      () => ledger.recordRunDelivered({ nodeVisitId: VISIT, agentId: 'agt_x', requestId: 'r', sessionId: 'main' }),
      /no attempt exists/,
    )
  } finally {
    cleanup(fixture)
  }
})
