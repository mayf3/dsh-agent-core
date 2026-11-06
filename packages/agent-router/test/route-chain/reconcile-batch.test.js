import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TurnReconciliationStore } from '../../src/reconciliation-store.js'
import { readDurableRecoveryStore } from '../../src/reconciliation/durable-file.js'

const cli = fileURLToPath(new URL('../../../../scripts/availability-recovery/turn-recovery.mjs', import.meta.url))
const loader = fileURLToPath(new URL('../../src/reconciliation/durable-file.js', import.meta.url))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), '1257-batch-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'copy.json')
  const output = join(root, 'candidate.json')
  const authorization = join(root, 'owner.json')
  const store = new TurnReconciliationStore({ persistenceFile: source, runtimeEpoch: 'fixture-epoch' })
  const proofs = ['child_real_exit', 'exact_started_then_idle', 'exact_queued_removal', null]
  const handles = proofs.map((proof, index) => {
    const handle = store.mintTurnExecution({ agentId: `agt_fixture${index}`, processGeneration: 1, sessionId: 'main' })
    store.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: `req-${index}`, deadlineAtWallMs: Date.now() + 60_000 })
    store.markPromptWriteAttempted(handle)
    store.markOutcomeUnknown(handle, { source: 'caller_wait_exceeded' })
    if (proof === 'child_real_exit') store.markExitObserved(handle)
    else if (proof !== null) store.mutateRecord(store.requireRecord(handle), record => { record.terminationEvidence = proof })
    if (proof !== null) store.markRecoveryBlocked(handle, ['live_generation_ownership'], 'runtime_restart_ownership_unavailable')
    return handle
  })
  const document = JSON.parse(readFileSync(source))
  for (const record of document.records.slice(0, 3)) record.fenceState = 'cleared'
  writeFileSync(source, JSON.stringify(document))
  const authorize = (transform = value => value) => {
    const raw = JSON.parse(readFileSync(source))
    const auth = { version: 2, operationId: '1257-three-exact-fixtures', ownerUid: process.getuid(),
      sourceSha256: sha(readFileSync(source)), loaderSha256: sha(readFileSync(loader)),
      records: raw.records.slice(0, 3).map((record, index) => ({ handle: record.handle,
        runtimeEpoch: record.runtimeEpoch, agentId: record.agentId, processGeneration: record.processGeneration,
        evidence: proofs[index], exitObservedAt: record.exitObservedAt, restoreBlockedFence: true })) }
    writeFileSync(authorization, JSON.stringify(transform(auth)), { mode: 0o600 })
  }
  const run = () => spawnSync(process.execPath, [cli, 'reconcile-batch', '--store', source,
    '--loader', loader, '--loader-sha256', sha(readFileSync(loader)),
    '--authorization', authorization, '--out', output], { encoding: 'utf8' })
  return { source, output, authorization, authorize, run, handles, proofs }
}

test('R2 atomic batch repairs three blocked+pending+cleared fixtures using their own durable evidence', t => {
  const f = fixture(t)
  assert.throws(() => readDurableRecoveryStore(f.source), /state invariants/)
  f.authorize()
  const before = readFileSync(f.source)
  const result = f.run()
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(readFileSync(f.source), before)
  const candidate = JSON.parse(readFileSync(f.output))
  const decoded = readDurableRecoveryStore(f.output)
  assert.equal(decoded.records.size, 4)
  for (let i = 0; i < 3; i += 1) {
    const record = candidate.records[i]
    assert.equal(record.state, 'settled')
    assert.equal(record.queryState, 'settled')
    assert.equal(record.fenceState, 'cleared')
    assert.equal(record.initialOutcome, 'outcome_unknown')
    assert.equal(record.settlementResult, 'terminated_without_outcome')
    assert.equal(record.lateOutcome, 'terminated_without_outcome')
    assert.equal(record.outcome, null)
    assert.equal(record.terminationEvidence, f.proofs[i])
    assert.equal(record.exitObservedAt, JSON.parse(before).records[i].exitObservedAt)
    assert.ok(record.attemptedActions.every(action => Number.isSafeInteger(action.observedAtWallMs)))
    if (i > 0) assert.equal(record.exitObservedAt, null, 'idle/queue proof never becomes child exit')
  }
  assert.deepEqual(candidate.records[3], JSON.parse(before).records[3])
  for (const key of ['issuance', 'correlationIndex', 'runtimeEpochs', 'discriminatorSeq']) {
    assert.deepEqual(candidate[key], JSON.parse(before)[key])
  }
  const receipt = JSON.parse(readFileSync(`${f.output}.receipt.json`))
  assert.equal(receipt.repairs.length, 3)
  assert.equal(receipt.settlements.length, 3)
  assert.equal(receipt.sourceSha256, sha(before))
  assert.equal(receipt.candidateSha256, sha(readFileSync(f.output)))
  const validate = spawnSync(process.execPath, [cli, 'validate', '--store', f.output,
    '--loader', loader, '--loader-sha256', sha(readFileSync(loader))], { encoding: 'utf8' })
  assert.equal(validate.status, 0, validate.stderr)
  assert.equal(JSON.parse(validate.stdout).valid, true)
})

const faults = [
  ['missing mandatory field', raw => { delete raw.records[0].shutdownRequestedAt }, null, 'STORE_INVALID'],
  ['wrong query enum', raw => { raw.records[0].queryState = 'recovering' }, null, 'REPAIR_SHAPE_MISMATCH'],
  ['wrong settlement enum', raw => { raw.records[0].settlementResult = 'success' }, null, 'REPAIR_SHAPE_MISMATCH'],
  ['wrong action enum', raw => { raw.records[0].attemptedActions[0].result = 'ok' }, null, 'STORE_INVALID'],
  ['missing action timestamp', raw => { delete raw.records[0].attemptedActions[0].observedAtWallMs }, null, 'STORE_INVALID'],
  ['missing exact termination proof', raw => { raw.records[1].terminationEvidence = null }, null, 'DURABLE_PROOF_REQUIRED'],
  ['outcome evidence has precedence', raw => { raw.records[1].outcomeEvidence = 'exact_turn_end_success' }, null, 'OUTCOME_PRECEDENCE_REQUIRES_RUNTIME'],
  ['unproven root-quiescence assertion', raw => { raw.records[1].terminationEvidence = 'restart_quiescence_proven' },
    auth => { auth.records[1].evidence = 'restart_quiescence_proven'; return auth }, 'AUTHORIZATION_INVALID'],
  ['null exit cannot be asserted as child exit', null,
    auth => { auth.records[1].evidence = 'child_real_exit'; return auth }, 'DURABLE_PROOF_REQUIRED'],
  ['unselected malformed record stays invalid', null,
    auth => { auth.records.pop(); return auth }, 'STORE_INVALID'],
  ['duplicate target is refused', null,
    auth => { auth.records.push(auth.records[0]); return auth }, 'AUTHORIZATION_INVALID'],
  ['wrong target identity', null,
    auth => { auth.records[0].processGeneration = 2; return auth }, 'AUTHORIZATION_MISMATCH'],
]
for (const [name, mutate, transform, code] of faults) {
  test(`R2 atomic batch refuses ${name}: no source mutation or partial candidate`, t => {
    const f = fixture(t)
    if (mutate) {
      const document = JSON.parse(readFileSync(f.source))
      mutate(document)
      writeFileSync(f.source, JSON.stringify(document))
    }
    f.authorize(transform ?? undefined)
    const before = readFileSync(f.source)
    const result = f.run()
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, new RegExp(code))
    assert.deepEqual(readFileSync(f.source), before)
    assert.equal(existsSync(f.output), false)
    assert.equal(existsSync(`${f.output}.receipt.json`), false)
  })
}
