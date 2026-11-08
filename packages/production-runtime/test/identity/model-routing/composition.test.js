import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { composeProductionRuntime } from '../../../src/compose.js'
import { FakeProc, seedRuntime } from '../../compose-fixture.js'
import { A, B, C, GLOBAL, config, entry, badB } from './support.js'

/** Existing fake transport with the real registry's shutdown CAS callbacks. */
class RoutedProc extends FakeProc {
  constructor(options) {
    super(options)
    Object.assign(this, options)
    this.turnQueueEntries = []
    this.turnInFlight = false
  }
  async shutdown() {
    this.registryIntegration.casReap(this, 'fixture_shutdown')
    const outcome = await super.shutdown()
    this.registryIntegration.casEmpty(this)
    return outcome
  }
}

async function compose(t, initial = config()) {
  const { root, layout } = await seedRuntime(t, { agents: [[A, 'A'], [B, 'B'], [C, 'C']] })
  const write = value => writeFileSync(layout.agentModelOverrides, JSON.stringify(value))
  write(initial)
  const spawned = []
  const messages = []
  const options = {
    layout, globalRoute: GLOBAL,
    productApi: { enabled: false }, notificationIngress: { enabled: false },
    processFactory: options => {
      const proc = new RoutedProc(options)
      spawned.push(proc)
      return proc
    },
    provisionHome() {},
    log: Object.fromEntries(['log', 'warn', 'error'].map(key => [key, (...parts) => messages.push(parts.join(' '))])),
  }
  const runtime = await composeProductionRuntime(options)
  let stopped = false
  const stop = async () => { if (!stopped) { stopped = true; await runtime.stop() } }
  t.after(stop)
  const run = (agentId = A, message = 'fixture-turn') => runtime.router.runTurnWithRouteChain(agentId, {
    sessionId: 'main', message, opts: {},
  })
  const final = () => runtime.router.routeChainJournalSnapshot().filter(row => row.kind === 'route_chain_final').at(-1)
  return { runtime, root, layout, spawned, messages, options, write, stop, run, final }
}

test('ACC-RCG-002/004: real composition rejects A r1 plus bad B before spawn or turn', async t => {
  const f = await compose(t)
  const g0 = f.runtime.routingConfig.resolveChain(A)
  const next = badB()
  next.overrides[A] = entry('r1')
  next.routeCatalog.r1.model = 'candidate-marker-model'
  f.write(next)
  await assert.rejects(f.run(), error => error.code === 'AGENT_MODEL_OVERRIDE_INVALID')
  assert.equal(f.spawned.length, 0)
  assert.equal(f.final().configInvalid, true)
  assert.equal(f.final().totalRouteAttempts, 0)
  assert.equal(f.final().configGeneration.decision, 'refuse')
  assert.equal(f.final().configGeneration.activeGenerationId, g0.generationId)
  assert.equal(f.messages.join('\n').includes('candidate-marker-model'), false)
})

test('ACC-RCG-003/005: real child start and running-child reuse consume qualified G0; B has zero attempts', async t => {
  const f = await compose(t)
  const g0 = f.runtime.routingConfig.resolveChain(A)
  f.write(badB())
  const first = await f.run(A, 'first-G0-turn')
  const second = await f.run(A, 'second-G0-turn')
  assert.equal(first.routeRef, 'r0')
  assert.equal(second.pid, first.pid)
  assert.equal(f.spawned.length, 1)
  assert.equal(f.spawned[0].model, 'model-r0')
  assert.deepEqual(f.spawned[0].turns.map(turn => turn.text), ['first-G0-turn', 'second-G0-turn'])
  assert.equal(f.final().totalRouteAttempts, 1)
  assert.equal(f.final().fallbackActivated, false)
  assert.equal(f.final().configGeneration.decision, 'continue')
  assert.equal(f.final().configGeneration.activeGenerationId, g0.generationId)
  await assert.rejects(f.run(B), error => error.code === 'AGENT_MODEL_OVERRIDE_INVALID')
  assert.equal(f.spawned.length, 1)
  assert.equal(f.final().totalRouteAttempts, 0)
  assert.equal(f.final().configInvalid, true)
})

test('ACC-RCG-001/005: valid whole publication switches real composition to a new child and full generation', async t => {
  const f = await compose(t)
  const first = await f.run()
  const old = f.runtime.routingConfig.resolveChain(A)
  const next = config()
  next.overrides[A] = entry('r1')
  next.overrides[B] = entry('r3')
  f.write(next)
  const second = await f.run()
  const activated = f.runtime.routingConfig.resolveChain(A)
  assert.equal(second.routeRef, 'r1')
  assert.notEqual(second.pid, first.pid)
  assert.equal(f.spawned[0].exit.code, 0)
  assert.equal(f.spawned[1].model, 'model-r1')
  assert.notEqual(activated.generationId, old.generationId)
  assert.equal(f.runtime.routingConfig.resolveChain(B).generationId, activated.generationId)
  assert.equal(f.runtime.routingConfig.resolveChain(B).routes[0].routeRef, 'r3')
  assert.equal(old.routes[0].routeRef, 'r0')
})

test('ACC-RCG-005: restart after a rejected candidate cannot resurrect the prior runtime trust', async t => {
  const f = await compose(t)
  f.write(badB())
  await f.run()
  await f.stop()
  const spawnCount = f.spawned.length
  await assert.rejects(composeProductionRuntime(f.options), error => error.code === 'AGENT_MODEL_OVERRIDE_INVALID')
  assert.equal(f.spawned.length, spawnCount)
})

for (const mode of ['changed_commit', 'missing_stamp']) {
  test(`ACC-RCG-004/005: real same-path Harness identity ${mode} cancels G0 continuation`, async t => {
    const previous = process.env.DSH_HARNESS_ROOT
    t.after(() => {
      if (previous === undefined) delete process.env.DSH_HARNESS_ROOT
      else process.env.DSH_HARNESS_ROOT = previous
    })
    // seedRuntime creates the isolated root before the actual composition.
    const { root: harness } = await seedRuntime(t)
    writeFileSync(join(harness, 'package.json'), JSON.stringify({ version: 'fixture-version' }))
    const stamp = join(harness, '.source-stamp')
    writeFileSync(stamp, JSON.stringify({ commit: 'a'.repeat(40), dirtyCount: 0 }))
    process.env.DSH_HARNESS_ROOT = harness
    const f = await compose(t)
    f.write(badB())
    await f.run()
    assert.equal(f.final().configGeneration.decision, 'continue')
    const before = f.spawned[0].turns.length
    if (mode === 'changed_commit') writeFileSync(stamp, JSON.stringify({ commit: 'b'.repeat(40), dirtyCount: 0 }))
    else unlinkSync(stamp)
    await assert.rejects(f.run(), error => error.configGeneration?.decision === 'refuse')
    assert.equal(f.spawned.length, 1)
    assert.equal(f.spawned[0].turns.length, before)
    assert.equal(f.final().configInvalid, true)
    assert.equal(f.final().totalRouteAttempts, 0)
  })
}

for (const [label, extra] of [
  ['outcome_unknown', { envelope: 'outcome_unknown', status: 'outcome_unknown' }],
  ['output started', { envelope: 'failed', evidence: { promptReceipt: 'accepted', partialOutput: true } }],
  ['tool started', { envelope: 'failed', evidence: { promptReceipt: 'accepted', toolStarted: true } }],
]) {
  test(`ACC-RCG-006: qualified G0 preserves STOP_CHAIN after ${label}`, async t => {
    const initial = config()
    initial.overrides[A] = entry('r0', ['r1'])
    const f = await compose(t, initial)
    const proc = await f.runtime.router.ensureRunning(A)
    const error = Object.assign(new Error('fixture-stop'), { code: 'account_quota_exhausted', ...extra })
    proc.turn = async () => { proc.turns.push({ sessionId: 'main', text: 'stop-turn' }); throw error }
    f.write(badB(structuredClone(initial)))
    await assert.rejects(f.run(), thrown => thrown === error)
    assert.equal(f.spawned.length, 1)
    assert.equal(proc.turns.length, 1)
    assert.equal(f.final().totalRouteAttempts, 1)
    assert.equal(f.final().fallbackActivated, false)
    assert.match(f.final().finalOutcome, /^stop:/)
    assert.equal(f.final().configGeneration.decision, 'continue')
  })
}

test('ACC-RCG-006: configuration publication never settles, replays, or removes an existing UNKNOWN fence', async t => {
  const f = await compose(t)
  const proc = await f.runtime.router.ensureRunning(A)
  const store = proc.reconciliationStore
  const handle = store.mintTurnExecution({ agentId: A, processGeneration: proc.processGeneration, sessionId: 'main' })
  store.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'fixture-old-prompt' })
  store.markOutcomeUnknown(handle, { source: 'fixture-unresolved-old-turn' })
  const beforeRecord = store.getTurnReconciliation(handle)
  const beforeBytes = readFileSync(f.layout.turnRecoveryStore)
  f.write(badB())
  await assert.rejects(f.run(), error => error.code === 'AGENT_PROCESS_TURN_FENCED')
  assert.equal(f.spawned.length, 1)
  assert.equal(proc.turns.length, 0)
  assert.equal(f.final().fallbackActivated, false)
  assert.equal(f.final().totalRouteAttempts, 1)
  assert.equal(f.final().configGeneration.decision, 'continue')
  assert.deepEqual(store.getTurnReconciliation(handle), beforeRecord)
  assert.deepEqual(readFileSync(f.layout.turnRecoveryStore), beforeBytes)
})
