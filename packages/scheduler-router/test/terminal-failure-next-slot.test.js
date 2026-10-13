/** Real AgentProcess -> bridge -> durable Scheduler acceptance, C-004/C-009.
 * The optional module override exercises an existing bridge's compatibility
 * without adding a selector or a legacy implementation to production code.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { makeFx } from '../../agent-router/test/helpers/fake-child.js'
import { TurnReconciliationStore } from '../../agent-router/src/reconciliation-store.js'
import { Scheduler } from '../../scheduler/src/scheduler.js'
import { JobStore } from '../../scheduler/src/store.js'

const { createRouterInvoker } = await import(
  process.env.SCHEDULER_TEST_BRIDGE_MODULE ?? '../src/index.js'
)

for (const [index, retry] of [undefined, { auto: false }].entries()) {
  test(`terminal provider failure skips a round and next natural slot succeeds (retry ${index === 0 ? 'absent' : 'disabled'})`, async (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'scheduler-failure-next-slot-'))
    const failingAgent = `agt_generic_dispatcher_${index}`
    const peerAgent = `agt_generic_peer_${index}`
    const persistenceFile = join(dir, 'router.json')
    const routerStore = new TurnReconciliationStore({ persistenceFile })
    const fixtures = new Map([failingAgent, peerAgent].map(agentId => [
      agentId, makeFx({ agentId, reconciliationStore: routerStore }),
    ]))
    for (const fx of fixtures.values()) await fx.readyNow()
    const clock = { value: 1_000 }
    const attempts = new Map()
    const failure = index === 0
      ? { code: 'PI_AI_ERROR', message: 'Internal Server Error' }
      : { code: 'ANOTHER_PROVIDER_ERROR', message: 'different provider failure' }
    const invokeAgent = createRouterInvoker({
      async runTurnWithRouteChain(agentId, args) {
        const fx = fixtures.get(agentId)
        assert.ok(fx, 'the requested generic Agent must exist')
        const attempt = (attempts.get(agentId) ?? 0) + 1
        attempts.set(agentId, attempt)
        args.opts.onDispatch()
        const turn = fx.proc.turn(args.sessionId, args.message, args.opts, args.deadlineMs)
        await fx.tick()
        const messageId = `message-${agentId}-${attempt}`
        fx.respondTo('session/prompt', { messageId })
        await fx.tick()
        if (agentId === failingAgent && attempt === 1) {
          fx.emitEvent(args.sessionId, { type: 'turn/start', data: { turn: 1 } })
          fx.emitEvent(args.sessionId, { type: 'user/message', data: { id: messageId } })
          fx.emitEvent(args.sessionId, { type: 'turn/end', data: {
            turn: 1, reason: { kind: 'error', error: failure },
          } })
          fx.emitStatus(args.sessionId, 'idle')
        } else {
          fx.completeTurn(args.sessionId, messageId, 'natural slot completed')
        }
        return turn
      },
    }, { admissions: new Map() })
    const scheduler = new Scheduler({
      store: new JobStore(join(dir, 'jobs.json')),
      invoker: invokeAgent,
      nowMs: () => clock.value,
    })
    t.after(async () => {
      await scheduler.stop()
      rmSync(dir, { recursive: true, force: true })
    })
    await scheduler.start({ autoStart: false, catchup: false })
    const create = agentId => scheduler.createJob({
      name: `generic recurring ${agentId}`, agentId,
      schedule: { kind: 'every', everyMs: 10_000, anchorMs: 1_000 },
      payload: { kind: 'agentTurn', message: 'scan scheduled work' },
      delivery: { mode: 'none' },
      ...(retry === undefined ? {} : { retry }),
    })
    const failedJob = await create(failingAgent)
    const peerJob = await create(peerAgent)
    clock.value = 11_000
    await Promise.all([scheduler.tick(), scheduler.tick()])
    await scheduler.whenIdle()
    await scheduler.load()
    const [first] = scheduler.listOccurrences(failedJob.id)
    assert.equal(first.state, 'failed')
    assert.equal(first.kind, 'natural')
    assert.equal(scheduler.isFenced(failedJob.id), false)
    assert.equal((await scheduler.getJob(failedJob.id)).enabled, true)
    assert.equal(scheduler.listOccurrences(peerJob.id)[0].state, 'succeeded')
    const call = invokeAgent.calls.find(entry => entry.agentId === failingAgent)
    assert.equal(call.outcome.evidence.terminationEvidence, 'exact_terminal_then_idle')
    assert.equal(call.outcome.evidence.phase, 'terminal')
    const routerRecord = fixtures.get(failingAgent).store.getTurnReconciliation(call.outcome.reconciliationHandle)
    assert.equal(routerRecord.state, 'settled')
    assert.equal(routerRecord.snapshot.outcome, 'failed')
    assert.equal(routerRecord.snapshot.terminationEvidence, 'exact_terminal_then_idle')
    const durableRecord = new TurnReconciliationStore({ persistenceFile })
      .getTurnReconciliation(call.outcome.reconciliationHandle)
    assert.equal(durableRecord.state, 'settled')
    assert.equal(durableRecord.snapshot.outcome, 'failed')
    assert.equal(durableRecord.snapshot.terminationEvidence, call.outcome.evidence.terminationEvidence)

    clock.value = 11_500
    await scheduler.tick()
    await scheduler.whenIdle()
    assert.equal(attempts.get(failingAgent), 1, 'failure is not retried between natural slots')
    clock.value = 21_000
    await scheduler.tick()
    await scheduler.whenIdle()
    await scheduler.load()
    const rows = scheduler.listOccurrences(failedJob.id)
    assert.deepEqual(rows.map(row => row.state), ['failed', 'succeeded'])
    assert.deepEqual(rows.map(row => row.kind), ['natural', 'natural'])
    assert.deepEqual(rows.map(row => row.nominalScheduledAt), [11_000, 21_000])
    assert.deepEqual(rows[0], first, 'the old failed occurrence is retained unchanged')
    assert.notEqual(rows[1].occurrenceId, rows[0].occurrenceId)
    assert.notEqual(rows[1].requestId, rows[0].requestId)
    assert.notEqual(rows[1].nativeSessionId, rows[0].nativeSessionId)
    assert.equal(attempts.get(failingAgent), 2)
    assert.deepEqual(scheduler.listOccurrences(peerJob.id).map(row => row.state), ['succeeded', 'succeeded'])
    assert.equal(scheduler.isFenced(failedJob.id), false)
    for (const fx of fixtures.values()) {
      assert.equal(fx.counts().promptWriteAttempts, 2, 'exactly one prompt per natural occurrence')
      assert.equal(fx.child.killSignals.length, 0)
    }
  })
}

test('missing termination proof remains unknown and blocks only its job without replay', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'scheduler-unknown-isolation-'))
  const unknownAgent = 'agt_generic_unknown'
  const peerAgent = 'agt_generic_healthy'
  const routerStore = new TurnReconciliationStore({ persistenceFile: join(dir, 'router.json') })
  const fixtures = new Map([unknownAgent, peerAgent].map(agentId => [
    agentId, makeFx({ agentId, reconciliationStore: routerStore, deadlines: { turnTimeoutMs: 5_000 } }),
  ]))
  for (const fx of fixtures.values()) await fx.readyNow()
  const clock = { value: 1_000 }
  const invokeAgent = createRouterInvoker({
    async runTurnWithRouteChain(agentId, args) {
      const fx = fixtures.get(agentId)
      args.opts.onDispatch()
      const turn = fx.proc.turn(args.sessionId, args.message, args.opts,
        agentId === unknownAgent ? 100 : args.deadlineMs)
      await fx.tick()
      const messageId = `message-${agentId}-${fx.counts().promptWriteAttempts}`
      fx.respondTo('session/prompt', { messageId })
      await fx.tick()
      if (agentId === peerAgent) fx.completeTurn(args.sessionId, messageId, 'peer completed')
      return turn
    },
  }, { admissions: new Map() })
  const scheduler = new Scheduler({
    store: new JobStore(join(dir, 'jobs.json')), invoker: invokeAgent, nowMs: () => clock.value,
  })
  t.after(async () => {
    await scheduler.stop()
    rmSync(dir, { recursive: true, force: true })
  })
  await scheduler.start({ autoStart: false, catchup: false })
  const create = agentId => scheduler.createJob({
    name: `generic recurring ${agentId}`, agentId,
    schedule: { kind: 'every', everyMs: 10_000, anchorMs: 1_000 },
    payload: { kind: 'agentTurn', message: 'scan scheduled work' }, delivery: { mode: 'none' },
  })
  const unknownJob = await create(unknownAgent)
  const peerJob = await create(peerAgent)
  clock.value = 11_000
  await scheduler.tick()
  // Keep the test event loop alive while the real caller-bound timer is unref'ed.
  await Promise.all([scheduler.whenIdle(), fixtures.get(unknownAgent).sleep(150)])
  await scheduler.load()
  const [first] = scheduler.listOccurrences(unknownJob.id)
  assert.equal(first.state, 'outcome_unknown')
  assert.equal(scheduler.isFenced(unknownJob.id), true)
  const call = invokeAgent.calls.find(entry => entry.agentId === unknownAgent)
  assert.equal(call.outcome.status, 'outcome_unknown')
  assert.equal(call.outcome.evidence.terminationEvidence, null)
  assert.equal(routerStore.getTurnReconciliation(call.outcome.reconciliationHandle).state, 'pending')

  clock.value = 21_000
  await scheduler.tick()
  await scheduler.whenIdle()
  await scheduler.load()
  assert.deepEqual(scheduler.listOccurrences(unknownJob.id), [first])
  assert.deepEqual(scheduler.listOccurrences(peerJob.id).map(row => row.state), ['succeeded', 'succeeded'])
  assert.equal(fixtures.get(unknownAgent).counts().promptWriteAttempts, 1)
  assert.equal(fixtures.get(peerAgent).counts().promptWriteAttempts, 2)
  assert.equal(fixtures.get(unknownAgent).child.killSignals.length, 0)
})
