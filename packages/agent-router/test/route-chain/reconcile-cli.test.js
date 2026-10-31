import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TurnReconciliationStore } from '../../../agent-router/src/reconciliation-store.js'
import { readDurableRecoveryStore } from '../../src/reconciliation/durable-file.js'

const cli = fileURLToPath(new URL('../../../../scripts/availability-recovery/turn-recovery.mjs', import.meta.url))
const loader = fileURLToPath(new URL('../../src/reconciliation/durable-file.js', import.meta.url))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

function fixture(t, proof = true, correlated = false) {
  const root = mkdtempSync(join(tmpdir(), '1257-reconcile-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const file = join(root, 'source.json')
  const output = join(root, 'candidate.json')
  const auth = join(root, 'owner.json')
  const store = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'old-runtime' })
  const handles = []
  for (const agentId of ['agt_hr', 'agt_search', 'agt_investment', 'agt_unrelated']) {
    const callerCorrelation = correlated ? { occurrenceId: `occ-${agentId}`, runId: `run-${agentId}`, requestId: `caller-${agentId}` } : null
    const handle = store.mintTurnExecution({ agentId, processGeneration: 7, sessionId: 'main', callerCorrelation })
    store.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: `req-${agentId}`, deadlineAtWallMs: Date.now() + 60000 })
    store.markPromptWriteAttempted(handle)
    store.markOutcomeUnknown(handle, { source: 'caller_wait_exceeded' })
    if (proof && agentId !== 'agt_unrelated') store.markExitObserved(handle)
    handles.push(handle)
  }
  const authorize = (handle = handles[0], overrides = {}) => {
    const record = readDurableRecoveryStore(file).records.get(handle)
    const authorization = { version: 1, operationId: 'owner-1257-one-handle', ownerUid: process.getuid(),
      sourceSha256: hash(readFileSync(file)), loaderSha256: hash(readFileSync(loader)),
      handle, runtimeEpoch: record.runtimeEpoch, agentId: record.agentId,
      processGeneration: record.processGeneration, evidence: 'child_real_exit',
      exitObservedAt: record.exitObservedAt, ...overrides }
    writeFileSync(auth, JSON.stringify(authorization), { mode: 0o600 })
    return authorization
  }
  const run = (args = []) => spawnSync(process.execPath,
    [cli, 'reconcile', '--store', file, '--loader', loader, '--loader-sha256', hash(readFileSync(loader)),
      '--authorization', auth, '--out', output, ...args], { encoding: 'utf8' })
  return { root, file, output, auth, store, handles, authorize, run }
}

test('R2 CLI: three evidence-backed incident-shaped turns settle individually; unrelated UNKNOWN stays exact', t => {
  const f = fixture(t)
  const original = readFileSync(f.file)
  const firstDocument = JSON.parse(original)
  for (let i = 0; i < 3; i += 1) {
    const sourceBefore = readFileSync(f.file)
    f.authorize(f.handles[i])
    const run = f.run()
    assert.equal(run.status, 0, run.stderr)
    assert.deepEqual(readFileSync(f.file), sourceBefore, 'CLI never rewrites the source')
    const document = JSON.parse(readFileSync(f.output))
    const selected = document.records.find(row => row.handle === f.handles[i])
    assert.equal(selected.queryState, 'settled')
    assert.equal(selected.initialOutcome, 'outcome_unknown')
    assert.equal(selected.settlementResult, 'terminated_without_outcome')
    assert.equal(selected.terminationEvidence, 'child_real_exit')
    assert.equal(selected.outcome, null)
    assert.equal(selected.fenceState, 'cleared')
    assert.ok(selected.attemptedActions.every(row => Number.isSafeInteger(row.observedAtWallMs)))
    for (const row of document.records.filter(row => row.handle !== selected.handle)) {
      assert.deepEqual(row, JSON.parse(sourceBefore).records.find(old => old.handle === row.handle))
    }
    assert.notEqual(readDurableRecoveryStore(f.output), null)
    const receipt = JSON.parse(readFileSync(`${f.output}.receipt.json`))
    assert.equal(receipt.disposition, 'validated_candidate_only')
    assert.equal(receipt.sourceSha256, hash(sourceBefore))
    assert.equal(receipt.candidateSha256, hash(readFileSync(f.output)))
    assert.equal(receipt.sourceModified, false)
    assert.equal(receipt.handle, f.handles[i])
    // Continue only with a local fixture copy; no service/recovery-store install.
    writeFileSync(f.file, readFileSync(f.output))
    rmSync(f.output); rmSync(`${f.output}.receipt.json`)
  }
  const remaining = JSON.parse(readFileSync(f.file)).records.find(row => row.handle === f.handles[3])
  assert.deepEqual(remaining, firstDocument.records[3])
  assert.equal(remaining.fenceState, 'active')
})

test('R2 CLI: missing durable exit proof is refused even with explicit owner authorization', t => {
  const f = fixture(t, false)
  f.authorize(undefined, { exitObservedAt: Date.now() })
  const before = readFileSync(f.file)
  const run = f.run()
  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /DURABLE_PROOF_REQUIRED/)
  assert.deepEqual(readFileSync(f.file), before)
  assert.equal(existsSync(f.output), false)
})

for (const [name, alter, reason] of [
  ['stale preimage', f => f.authorize(undefined, { sourceSha256: '0'.repeat(64) }), 'PREIMAGE_MISMATCH'],
  ['wrong tuple', f => f.authorize(undefined, { processGeneration: 8 }), 'AUTHORIZATION_MISMATCH'],
  ['new evidence kind', f => f.authorize(undefined, { evidence: 'pid_absent' }), 'AUTHORIZATION_INVALID'],
  ['owner-writable by group', f => { f.authorize(); chmodSync(f.auth, 0o660) }, 'UNSAFE_FILE'],
  ['missing authorization', () => {}, 'AUTHORIZATION_UNAVAILABLE'],
]) {
  test(`R2 CLI: ${name} refuses without changing source or emitting candidate`, t => {
    const f = fixture(t)
    alter(f)
    const before = readFileSync(f.file)
    const run = f.run()
    assert.notEqual(run.status, 0)
    assert.match(run.stderr, new RegExp(reason))
    assert.deepEqual(readFileSync(f.file), before)
    assert.equal(existsSync(f.output), false)
  })
}

for (const [name, corrupt] of [
  ['missing observedAtWallMs', raw => { delete raw.records[0].attemptedActions[0].observedAtWallMs }],
  ['state instead of queryState', raw => { raw.records[0].state = 'pending'; delete raw.records[0].queryState }],
]) {
  test(`R2 deployed loader rejects incident schema mistake: ${name}`, t => {
    const f = fixture(t)
    f.authorize()
    const raw = JSON.parse(readFileSync(f.file))
    corrupt(raw)
    writeFileSync(f.file, JSON.stringify(raw))
    const authorization = JSON.parse(readFileSync(f.auth))
    authorization.sourceSha256 = hash(readFileSync(f.file))
    writeFileSync(f.auth, JSON.stringify(authorization))
    const before = readFileSync(f.file)
    const run = f.run()
    assert.notEqual(run.status, 0)
    assert.match(run.stderr, /STORE_INVALID/)
    assert.deepEqual(readFileSync(f.file), before)
    assert.equal(existsSync(f.output), false)
  })
}

test('R2 CLI: existing candidate or symlink output is never overwritten', t => {
  const f = fixture(t)
  f.authorize()
  const sentinel = join(f.root, 'sentinel')
  writeFileSync(sentinel, 'retain-original')
  symlinkSync(sentinel, f.output)
  const run = f.run()
  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /OUTPUT_EXISTS/)
  assert.equal(readFileSync(sentinel, 'utf8'), 'retain-original')
})

test('R2 CLI: exact REAP registry cleanup must already be proven', t => {
  const f = fixture(t)
  // A real recovery claim plus exit still does not prove registry EMPTY.
  const handle = f.handles[0]
  const file = join(f.root, 'reap.json')
  const store = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'reap-runtime' })
  const h = store.mintTurnExecution({ agentId: 'agt_reap', processGeneration: 1, sessionId: 'main' })
  store.markOutcomeUnknown(h, { source: 'caller_wait_exceeded' })
  store.claimRecovery(h, { operationId: 'reap-op', claimantRuntimeEpoch: 'reap-runtime' })
  store.markExitObserved(h)
  const raw = JSON.parse(readFileSync(f.file))
  const replacement = JSON.parse(readFileSync(file)).records[0]
  // Use the original exact handle/identity, preserving a valid claim tuple.
  const old = raw.records.find(row => row.handle === handle)
  old.reapClaim = { ...replacement.reapClaim, agentId: old.agentId, runtimeEpoch: old.runtimeEpoch,
    processGeneration: old.processGeneration, turnExecutionId: handle, reconciliationHandle: handle }
  writeFileSync(f.file, JSON.stringify(raw))
  f.authorize()
  const run = f.run()
  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /REGISTRY_CLEANUP_UNPROVEN/)
  assert.equal(existsSync(f.output), false)
})

test('R2 CLI: durable late success cleanup retains outcome and answer digest; repeated candidate is unchanged', t => {
  const f = fixture(t)
  const handle = f.handles[0]
  f.store.settleLate(handle, { lateOutcome: 'late_completed', outcomeEvidence: 'exact_turn_end_success',
    terminationEvidence: 'exact_terminal_then_idle', finalAssistantOutput: { text: 'retained original reply' } })
  f.authorize(handle, { evidence: 'durable_settlement_cleanup' })
  const before = JSON.parse(readFileSync(f.file)).records[0]
  assert.equal(f.run().status, 0)
  let after = JSON.parse(readFileSync(f.output)).records[0]
  assert.equal(after.lateOutcome, 'late_completed')
  assert.equal(after.outcomeEvidence, 'exact_turn_end_success')
  assert.deepEqual(after.finalAssistantOutputEvidence, before.finalAssistantOutputEvidence)
  assert.equal(after.fenceState, 'cleared')
  writeFileSync(f.file, readFileSync(f.output))
  rmSync(f.output); rmSync(`${f.output}.receipt.json`)
  f.authorize(handle, { evidence: 'durable_settlement_cleanup' })
  assert.equal(f.run().status, 0)
  assert.deepEqual(JSON.parse(readFileSync(f.output)), JSON.parse(readFileSync(f.file)))
})

test('R2 CLI: durable exact outcome evidence cannot be downgraded by exit-only recovery', t => {
  const f = fixture(t)
  f.store.mutateRecord(f.store.requireRecord(f.handles[0]), row => { row.outcomeEvidence = 'exact_turn_end_success' })
  f.authorize()
  const before = readFileSync(f.file)
  const run = f.run()
  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /OUTCOME_PRECEDENCE_REQUIRES_RUNTIME/)
  assert.deepEqual(readFileSync(f.file), before)
  assert.equal(existsSync(f.output), false)
})

test('R2 CLI: wrong deployed loader digest refuses without source mutation', t => {
  const f = fixture(t)
  f.authorize()
  const run = spawnSync(process.execPath, [cli, 'validate', '--store', f.file, '--loader', loader,
    '--loader-sha256', '0'.repeat(64)], { encoding: 'utf8' })
  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /LOADER_MISMATCH/)
})

test('R2 CLI: validate uses deployed loader without triggering startup restoration', t => {
  const f = fixture(t)
  const before = readFileSync(f.file)
  const run = spawnSync(process.execPath, [cli, 'validate', '--store', f.file, '--loader', loader,
    '--loader-sha256', hash(readFileSync(loader))], { encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr)
  assert.equal(JSON.parse(run.stdout).records, 4)
  assert.equal(JSON.parse(run.stdout).sourceModified, false)
  assert.deepEqual(readFileSync(f.file), before)
})

test('R2 CLI: single-handle resume preserves other Scheduler caller correlations', t => {
  const f = fixture(t, true, true)
  f.authorize()
  const before = JSON.parse(readFileSync(f.file))
  const run = f.run()
  assert.equal(run.status, 0, run.stderr)
  const after = JSON.parse(readFileSync(f.output))
  assert.deepEqual(after.correlationIndex, before.correlationIndex)
  assert.deepEqual(after.issuance, before.issuance)
  assert.deepEqual(after.records.slice(1), before.records.slice(1))
})
