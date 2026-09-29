// Outcome acceptance probe, not a production rollout or an authorization bypass.
// Run explicitly: node --test scripts/availability-recovery/recovery.acceptance.test.mjs
// A failing restart case stays failing: never delete its record, change HR identity,
// emit an invented exit receipt, or weaken the assertion to make this suite green.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { rig, HR, OTHER, until, sleep } from './harness.mjs'

for (const [mode, rounds] of [['cancel', 10], ['timeout', 5], ['child-crash', 5]]) {
  test(`same HR completes a new request after ${mode}: ${rounds} real-child cycles`, { timeout: 30000 }, async t => {
    const root = mkdtempSync(join(tmpdir(), 'hr-availability-'))
    const fx = rig(root)
    t.after(async () => { await fx.close(); rmSync(root, { recursive: true, force: true }) })
    const times = []
    let generation = 0
    for (let i = 0; i < rounds; i += 1) {
      const start = performance.now()
      const pending = fx.request(`${mode === 'child-crash' ? 'CRASH' : 'STALL'} ${mode}-${i}`)
      await until(() => fx.current()?.processGeneration > generation && fx.current()?.counters.promptWriteAttempts > 0
        || fx.current()?.processGeneration === generation && fx.current()?.executions.size > 0)
      const old = fx.current()
      generation = old.processGeneration
      if (mode === 'cancel') await old.shutdown(500)
      const result = await pending
      assert.notEqual(result.reply, 'fixture-ok', 'fault must really interrupt the old request')
      await until(() => old.state === 'EXITED')
      const next = await fx.request(`NEW independent request ${i}`)
      assert.equal(next.reply, 'fixture-ok', JSON.stringify(next))
      assert.equal(next.agentId, HR)
      assert.equal(next.sessionId, 'main')
      assert.ok(fx.current().processGeneration > generation)
      generation = fx.current().processGeneration
      assert.equal(fx.store.activeFenceForAgent(HR), null)
      const elapsed = performance.now() - start
      assert.ok(elapsed < 3000, `fixture recovery exceeded 3000ms: ${elapsed}`)
      times.push(Number(elapsed.toFixed(2)))
    }
    const actualPrompts = readFileSync(join(root, 'fixture-prompts.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
    assert.equal(actualPrompts.length, rounds * 2, 'exactly one old and one new prompt per cycle; no replay')
    assert.equal(fx.processes.reduce((n,p) => n + p.counters.promptWriteAttempts, 0), actualPrompts.length)
    const sorted = [...times].sort((a,b) => a-b)
    console.log('RECOVERY_OBSERVATION ' + JSON.stringify({ scope: 'isolated-real-child-tool-free-provider', mode, cycles: rounds,
      completed: times.length, actualPromptCount: actualPrompts.length, sameAgent: HR, sameSession: 'main', maxMs: Math.max(...times), p95Ms: sorted[Math.ceil(.95*sorted.length)-1],
      manualRecoveryEdits: 0, governanceChanges: 0, productionAcceptance: false, userCancelEndpointVerified: false }))
  })
}

test('controller crash must not leave the same HR unusable after owned tool-free worker exits', { timeout: 15000 }, async t => {
  const root = mkdtempSync(join(tmpdir(), 'hr-controller-crash-'))
  const driver = fileURLToPath(new URL('./harness.mjs', import.meta.url))
  const child = spawn(process.execPath, [driver, 'crash-controller', root], {
    cwd: root, env: { PATH: '/usr/bin:/bin', HOME: root }, stdio: ['ignore','pipe','pipe'],
  })
  let stderr = ''; child.stderr.on('data', b => { stderr += b.toString().slice(0,2000) })
  const [exitCode] = await once(child, 'exit')
  assert.equal(exitCode, 77, stderr)
  const { pid } = JSON.parse(readFileSync(join(root, 'owned-worker.json'), 'utf8'))
  await until(() => { try { process.kill(pid, 0); return false } catch (e) { if(e.code === 'ESRCH') return true; throw e } }, 5000)
  const fx = rig(root, 'controller-after-crash')
  t.after(async () => { await fx.close(); rmSync(root, { recursive: true, force: true }) })
  const old = fx.store.activeFenceForAgent(HR)
  assert.ok(old, 'real crash must reproduce persisted HR fence')
  const control = await fx.request('NEW unrelated Agent request', OTHER)
  assert.equal(control.reply, 'fixture-ok', 'unaffected Agent must remain usable')
  const start = performance.now()
  let next
  do {
    next = await fx.request('NEW independent HR request after restart')
    if (next.reply === 'fixture-ok') break
    await sleep(50)
  } while (performance.now() - start < 3000)
  console.log('RECOVERY_OBSERVATION ' + JSON.stringify({ scope: 'isolated-real-controller-crash-tool-free-provider',
    mode: 'controller-crash', workerActuallyExited: true, sameAgent: HR, oldRecordPreserved: !!fx.store.getTurnReconciliation(old.handle),
    unrelatedAgentCompleted: true, newHrRequestCompleted: next.reply === 'fixture-ok', elapsedMs: Math.round(performance.now()-start),
    rejection: next.error?.code ?? next.code ?? next.failureCode ?? null, diagnostic: next.nextSafeAction ?? null,
    manualRecoveryEdits: 0, productionAcceptance: false }))
  assert.equal(next.reply, 'fixture-ok', 'AVAILABILITY_GAP: real controller/worker exit leaves same HR blocked; implement supported recovery, do not erase the fence to pass')
})
