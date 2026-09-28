import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { makeFx } from '../fake-child.js'
import { TurnReconciliationStore } from '../../../src/reconciliation-store.js'
import { readDurableRecoveryStore } from '../../../src/reconciliation/durable-file.js'
import { fixedAdminCanaryProjection } from '../../../../production-runtime/src/native-arm64/hr-s256-r2-startup-context.mjs'
import { fixedR2Fixture } from '../fixed-r2-consumer-fixture.js'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../')
const sealScript = join(rootDir, 'deployment-artifacts/original-router-proof-executor/admin_seal_fixture.py')
const sha = value => 'a'.repeat(64)
const phases = ['deployment_start', 'restart_a', 'restart_b']

async function actualPhase(persistenceFile, phase, generation) {
  const store = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: `synthetic-admin-phase-${generation}` })
  assert.equal(store.startupBlockedReason, null)
  const binding = {
    role: 'original_executor_admin_qualification', phase,
    consumingBinarySha256: sha(), validatorSha256: 'b'.repeat(64),
    entryManifestSha256: 'c'.repeat(64),
    procedureSha256: 'b1a1d5e148143c5ddf43fd644cb377cf7f74a4c561354b9098d80bd8c6933d44',
    startupNonce: 'd'.repeat(64),
  }
  const fx = makeFx({ agentId: 'agt_efficiency-agent', generation,
    reconciliationStore: store,
    fixedAdminQualification: { role: 'fixed_admin_qualification', agentId: 'agt_efficiency-agent',
      phase, hostId: 'FF99ABD5-79A0-5EE0-9E0B-B62671271560',
      packageSha256: binding.entryManifestSha256,
      consumingBinarySha256: binding.consumingBinarySha256,
      startupNonce: binding.startupNonce, processGeneration: generation } })
  const ready = fx.proc.ready()
  await fx.tick()
  fx.respondTo('initialize', { registeredProviders: [fx.proc.provider],
    fixedAdminToolPolicy: { armed: true, startupNonce: binding.startupNonce } })
  await ready
  const query = { context: binding, challenge: 'e'.repeat(32),
    deadlineMonotonicNs: String(process.hrtime.bigint() + 5_000_000_000n) }
  const service = { reconciliationRuntimeStatus: () => ({
    generationId: store.occupancy().runtimeEpoch, health: 'healthy', businessAdmission: 'open',
  }) }
  const pending = fixedAdminCanaryProjection(query, service, binding, store, async () => fx.proc)
  await fx.tick()
  const prompt = fx.writes.find(write => write.method === 'session/prompt')
  assert.ok(prompt)
  fx.respondTo('session/prompt', { messageId: `native-admin-${generation}` })
  fx.completeTurn(prompt.params.sessionId, `native-admin-${generation}`, 'completed')
  const frame = await pending
  const durable = readDurableRecoveryStore(persistenceFile)
  const record = durable.records.get(frame.handle)
  const issued = durable.issuance.get('agt_efficiency-agent')
  assert.equal(record.state, 'settled')
  assert.equal(record.runtimeEpoch, frame.runtimeGeneration)
  assert.equal(record.messageId, `native-admin-${generation}`)
  const live = [...issued.generations.entries()].map(([g, range]) =>
    ({ generation: g, minSeq: range.minSeq, maxSeq: range.maxSeq })).sort((a, b) => a.generation - b.generation)
  const evicted = [...issued.evictedGenerations.entries()]
  const floor = Math.max(live.at(-1)?.generation ?? 0,
    ...evicted.map(([g]) => g), issued.evictedThroughGeneration ?? 0)
  return { runtime: frame.runtimeGeneration, observation: {
    floor, maxIssuedTurnSeq: issued.maxIssuedTurnSeq, live, evicted,
    watermark: issued.evictedThroughGeneration,
    turnExecutionId: record.handle, processGeneration: record.processGeneration,
    nativeMessageSha256: frame.nativeMessageSha256,
    nativeReceiptSha256: frame.nativeReceiptSha256,
    completedAtWallMs: record.updatedAt,
  } }
}

test('three actual private canary durables feed the original closed seal, without supplied proof bytes', async t => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-qualification-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const persistenceFile = join(root, 'turn-recovery-v3.json')
  const observed = []
  for (let i = 0; i < phases.length; i++) observed.push(await actualPhase(persistenceFile, phases[i], i + 1))
  const result = spawnSync('python3', ['-B', sealScript], { input: JSON.stringify({
    disposableRoot: root, binarySha256: sha(),
    observations: observed.map(item => item.observation), runtimes: observed.map(item => item.runtime),
  }), encoding: 'utf8', timeout: 5000 })
  assert.equal(result.status, 0, result.stderr)
  const sealed = JSON.parse(result.stdout)
  assert.equal(sealed.floor.deployedBinarySha256, sha())
  assert.equal(sealed.validator.deployedBinarySha256, sha())
  assert.match(sealed.floorSha256, /^[a-f0-9]{64}$/)
  assert.match(sealed.validatorSha256, /^[a-f0-9]{64}$/)
  const lostRoot = mkdtempSync(join(tmpdir(), 'hr-admin-lost-child-'))
  t.after(() => rmSync(lostRoot, { recursive: true, force: true }))
  const lost = spawnSync('python3', ['-B', sealScript], { input: JSON.stringify({
    disposableRoot: lostRoot, binarySha256: sha(), fault: 'final_child_still_live',
    observations: observed.map(item => item.observation), runtimes: observed.map(item => item.runtime),
  }), encoding: 'utf8', timeout: 5000 })
  assert.notEqual(lost.status, 0)
  assert.match(lost.stderr, /ORIGINAL_STOP_TIMEOUT/)
  assert.equal(existsSync(join(lostRoot, 'deployment/floor-proven.json')), false)
  assert.equal(existsSync(join(lostRoot, 'deployment/validator-installed.json')), false)
  const cut = fixedR2Fixture(cleanup => t.after(cleanup), { adminProofDir: join(root, 'deployment') })
  const consumed = cut.store.consumeStartupQuiescence(cut)
  assert.deepEqual(consumed.map(row => row.status), ['settled'], JSON.stringify(consumed))
  assert.equal(cut.store.records.get(cut.handle).fenceState, 'cleared')
  assert.deepEqual(cut.store.consumeStartupQuiescence(cut).map(row => row.status), ['duplicate_ignored'])
  for (const fault of ['wrong_agent', 'old_turn']) {
    assert.throws(() => fixedR2Fixture(cleanup => t.after(cleanup),
      { adminProofDir: join(root, 'deployment'), adminFault: fault }),
    /LAUNCH_AUTHORIZATION_BINDING_INVALID/, fault)
  }
  for (const fault of ['old_worker_alive']) {
    const rejected = fixedR2Fixture(cleanup => t.after(cleanup), { adminProofDir: join(root, 'deployment'), adminFault: fault })
    const before = readFileSync(rejected.persistenceFile)
    const outcome = rejected.store.consumeStartupQuiescence(rejected)
    assert.equal(outcome.some(row => row.status === 'settled' || row.status === 'duplicate_ignored'), false,
      `${fault}: ${JSON.stringify(outcome)}`)
    assert.deepEqual(readFileSync(rejected.persistenceFile), before, fault)
    assert.equal(rejected.store.records.get(rejected.handle).fenceState, 'active', fault)
  }
})
