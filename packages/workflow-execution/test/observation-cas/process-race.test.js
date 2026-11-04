import assert from 'node:assert/strict'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import { test } from 'node:test'

import { fixture, delivered, advance, identity, snapshot, assertUnchanged,
  assertStale, receipt, VISIT } from './fixture.js'

test('P0-A real process: old disk observation cannot settle the parent next generation', { timeout: 15_000 }, async (t) => {
  const fx = fixture()
  let child
  let exit
  try {
    const old = await delivered(fx.writer)
    child = fork(new URL('./observer-process.js', import.meta.url), [fx.dir], {
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: { ...process.env, EKR_P0A_OBSERVER_CHILD: '1' },
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk })
    exit = once(child, 'exit')
    const [message] = await once(child, 'message')
    assert.equal(message.stage, 'observed', JSON.stringify(message))
    assert.equal(message.attempt.attemptId, old.attemptId)
    const current = await advance(fx.writer, old)
    const before = await snapshot(fx.writer)
    const submitted = once(child, 'message')
    child.send({ stage: 'release' })
    const [reply] = await submitted
    assert.equal(reply.stage, 'submitted', JSON.stringify(reply))
    assertStale(reply.result, old, 'reconciled')
    assert.deepEqual(await exit, [0, null], stderr)
    await assertUnchanged(fx.writer, before)
    assert.equal((await fx.writer.recordReconciled({ nodeVisitId: VISIT, ...identity(current),
      expectedPhase: current.phase, verdict: 'SETTLED', judgment: 'business_commitment_observed',
      reason: 'fresh parent observation for generation2' })).committed, true)
    receipt(t, 'real-process/OwnerLock/fresh-disk-replay', old, current, reply.result)
    t.diagnostic('realProcessConcurrency=true; child observed generation1 before parent settled/planned/delivered generation2; child rejection did not append; same-generation parent commit succeeded')
  } finally {
    if (child?.exitCode === null) child.kill('SIGKILL')
    await exit?.catch(() => {})
    fx.cleanup()
  }
})
