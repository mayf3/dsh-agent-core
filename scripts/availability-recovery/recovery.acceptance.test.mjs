// Outcome acceptance probe, not a production rollout or an authorization bypass.
// Run explicitly: node --test scripts/availability-recovery/recovery.acceptance.test.mjs
// Same-HR/same-entry recovery after a controller crash is the explicit,
// idempotent, durably persisted ADMIN ABANDONMENT of the stuck old task
// (HR_RESET_AND_RESUME_V1). The old record is never deleted, never settled by
// the declaration, never replayed, and the Agent identity never changes; late
// old results stay isolated; non-abandoned unknowns and other Agents stay fenced.
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

test('controller crash: explicit admin abandonment restores same-HR same-entry recovery repeatedly', { timeout: 20000 }, async t => {
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
  const fenceBefore = fx.store.admissionBlockerForAgent(HR)
  assert.ok(fenceBefore, 'before abandonment the stuck old task still blocks new HR admission')
  // HR_RESET_AND_RESUME_V1: the administrator explicitly abandons the stuck old
  // task through the delivery admin surface. Idempotent by declarationId.
  const declarationId = 'hr-admin-abandon-crash-20260929'
  const declaration = fx.abandonPendingTurns({ agentId: HR, declarationId })
  assert.deepEqual(declaration.abandonedHandles, [old.handle])
  const historical = fx.store.activeFenceForAgent(HR)
  assert.equal(historical?.handle, old.handle, 'historical fence query stays unchanged and queryable')
  const oldRecord = fx.store.records.get(old.handle)
  assert.equal(oldRecord?.initialOutcome, 'outcome_unknown', 'old business result stays UNKNOWN (never settled by the declaration)')
  assert.equal(oldRecord?.fenceState, 'active', 'old record keeps its honest blocked/fenced state (never deleted, never erased)')
  assert.equal(oldRecord?.adminAbandonment?.declarationId, declarationId, 'minimal durable audit / no-replay marker kept on the old record')
  const repeat = fx.abandonPendingTurns({ agentId: HR, declarationId })
  assert.deepEqual(repeat.abandonedHandles, [], 'repeated reset with the same declarationId is a no-op')
  const start = performance.now()
  let next
  do {
    next = await fx.request('NEW independent HR request after restart')
    if (next.reply === 'fixture-ok') break
    await sleep(50)
  } while (performance.now() - start < 3000)
  console.log('RECOVERY_OBSERVATION ' + JSON.stringify({ scope: 'isolated-real-controller-crash-tool-free-provider',
    mode: 'controller-crash-admin-abandonment', workerActuallyExited: true, sameAgent: HR, sameSession: next.sessionId ?? 'main',
    oldRecordPreserved: !!fx.store.records.get(old.handle),
    oldResultRemainsUnknown: fx.store.records.get(old.handle)?.initialOutcome === 'outcome_unknown',
    unrelatedAgentCompleted: true, newHrRequestCompleted: next.reply === 'fixture-ok', elapsedMs: Math.round(performance.now()-start),
    repeatedResetIdempotent: repeat.abandonedHandles.length === 0, manualRecoveryEdits: 0, productionAcceptance: false }))
  assert.equal(next.reply, 'fixture-ok', `same HR / same entry must complete a new request after the explicit admin abandonment: ${JSON.stringify(next)}`)
  assert.equal(next.agentId, HR)
  assert.equal(next.sessionId, 'main')
  // No replay: the abandoned old prompt reached a real worker exactly once
  // (1 old HR + 1 unrelated control + 1 new HR; no retry/replay of the old task).
  const prompts = readFileSync(join(root, 'fixture-prompts.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
  assert.equal(prompts.length, 3, 'exactly one old, one control and one new prompt total')
  assert.equal(prompts.filter(p => JSON.stringify(p.params).includes('STALL controller-crash')).length, 1, 'the abandoned old request is never replayed')
  // Late-old-result isolation: late evidence settles ONLY the abandoned handle.
  const late = fx.store.settleLate(old.handle, { lateOutcome: 'late_completed', terminationEvidence: 'exact_terminal_then_idle' })
  assert.equal(late.won, true, 'late evidence still settles the abandoned old handle (honest late settlement)')
  assert.equal(fx.store.records.get(old.handle)?.lateOutcome, 'late_completed')
  // Restart persistence: reopen the same durable store again (fresh epoch);
  // the abandonment marker survives and a further new request completes
  // WITHOUT any re-declaration.
  const fx2 = rig(root, 'controller-after-second-restart')
  t.after(async () => { await fx2.close() })
  const lateSettledOld = fx2.store.records.get(old.handle)
  assert.equal(lateSettledOld?.lateOutcome, 'late_completed', 'late settlement survives restart')
  const again = await fx2.request('NEW independent HR request after second restart')
  assert.equal(again.reply, 'fixture-ok', 'abandonment persists across controller restarts; no re-declaration needed')
  assert.equal(again.agentId, HR)
})
