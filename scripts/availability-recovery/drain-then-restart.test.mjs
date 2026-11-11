import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drainThenRestart } from './drain-then-restart.mjs'
import { TurnReconciliationStore } from '../../packages/agent-router/src/reconciliation-store.js'
import { withRestartProof } from '../../packages/production-runtime/test/compose-fixture.js'

const sourceSha = '230de798e340cc6c157e6b21822f0b1fda77e51e'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), '1257-drain-restart-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const launchdDir = join(root, 'launchd')
  const artifactsDir = join(root, 'artifacts')
  const bin = join(root, 'bin')
  mkdirSync(launchdDir)
  mkdirSync(bin)
  const plistPath = join(launchdDir, 'ai.agent-core.runtime.plist')
  writeFileSync(plistPath, '<plist><dict><key>HOME</key><string>/fixture/home</string></dict></plist>\n', { mode: 0o600 })
  if (process.platform === 'darwin') execFileSync('/usr/bin/xattr', ['-c', plistPath])
  // The existing restart probes health using curl; this fixture never opens
  // the production loopback endpoint or starts a native service.
  const curl = join(bin, 'curl')
  writeFileSync(curl, '#!/bin/sh\nprintf \'%s\\n\' \'{"ok":true}\'\n', { mode: 0o700 })
  chmodSync(curl, 0o700)
  const oldPath = process.env.PATH
  process.env.PATH = `${bin}:${oldPath}`
  t.after(() => { process.env.PATH = oldPath })
  const events = []
  let loaded = true
  const ctx = withRestartProof({
    launchdDir, artifactsDir, authsvcUid: process.getuid(), authsvcGid: process.getgid(),
    restartDrainWindowMs: 30, restartDrainPollMs: 1,
    isLoaded: () => loaded,
    bootout: () => { events.push('SIGTERM'); loaded = false },
    bootstrap: () => { events.push('bootstrap'); loaded = true },
  }, root)
  const store = new TurnReconciliationStore({ persistenceFile: ctx.turnRecoveryStore, runtimeEpoch: 'epoch-live' })
  const handle = store.mintTurnExecution({ agentId: 'agt_fixture', processGeneration: 1, sessionId: 'main' })
  store.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'request-fixture', deadlineAtWallMs: Date.now() + 60_000 })
  store.markPromptWriteAttempted(handle)
  const phase = (_name, ok, message) => { assert.equal(ok, true, message) }
  return { ctx, store, handle, events, phase, plistPath }
}

test('R1 named adapter: undrained execution refuses before stop or replacement', t => {
  const f = fixture(t)
  const before = readFileSync(f.plistPath)
  assert.throws(() => drainThenRestart({ ...f, sourceSha }), error => error.code === 'RESTART_DRAIN_UNDRAINED')
  assert.deepEqual(f.events, [])
  assert.deepEqual(readFileSync(f.plistPath), before)
})

test('R1 named adapter: undrained bypass is refused before entering deployment', t => {
  const f = fixture(t)
  f.ctx.acceptUndrainedRestart = true
  assert.throws(() => drainThenRestart({ ...f, sourceSha }), error => error.code === 'RESTART_UNDRAINED_BYPASS_FORBIDDEN')
  assert.deepEqual(f.events, [])
})

test('R1 named adapter: absent producer stop capability leaves old runtime running', t => {
  const f = fixture(t)
  f.store.settleDirect(f.handle, { outcome: 'completed', outcomeEvidence: 'fixture-completion' })
  unlinkSync(join(f.ctx.turnRecoveryStore, '..', 'runtime-evidence.jsonl'))
  const before = readFileSync(f.plistPath)
  assert.throws(() => drainThenRestart({ ...f, sourceSha }), error => error.code === 'RESTART_EXIT_PROOF_UNAVAILABLE')
  assert.deepEqual(f.events, [])
  assert.deepEqual(readFileSync(f.plistPath), before)
})

test('R1 named adapter: remaining worker slot blocks replacement after SIGTERM', t => {
  const f = fixture(t)
  f.store.settleDirect(f.handle, { outcome: 'completed', outcomeEvidence: 'fixture-completion' })
  const bootout = f.ctx.bootout
  f.ctx.bootout = (...args) => {
    bootout(...args)
    const boundary = join(f.ctx.turnRecoveryStore, '..', 'restart-boundary.jsonl')
    const entries = readFileSync(boundary, 'utf8').trim().split('\n').map(line => JSON.parse(line))
    entries[1].census.slots = [{ agentId: 'agt_fixture', slot: 'REAP', generation: 1 }]
    writeFileSync(boundary, `${entries.map(entry => JSON.stringify(entry)).join('\n')}\n`)
  }
  assert.throws(() => drainThenRestart({ ...f, sourceSha }), error => error.code === 'RESTART_EXIT_PROOF_UNAVAILABLE')
  assert.deepEqual(f.events, ['SIGTERM'])
})

test('R1 complete simulated restart waits for drain and exact exit; zero new outcome_unknown', t => {
  const f = fixture(t)
  f.ctx.restartDrainWindowMs = 5_000
  let drained = false
  f.ctx.restartDrainSleep = () => {
    assert.deepEqual(f.events, [], 'replacement cannot precede durable drain')
    f.store.settleDirect(f.handle, { outcome: 'completed', outcomeEvidence: 'fixture-completion' })
    f.events.push('drained')
    drained = true
  }
  const instance = f.ctx.readRuntimeInstance()
  let readbacks = 0
  f.ctx.readProcessInstance = () => {
    assert.equal(drained, true)
    assert.equal(f.events.includes('bootstrap'), false, 'replacement cannot precede exact old exit')
    if (++readbacks < 3) return instance
    f.events.push('old-instance-exited')
    return null
  }
  f.ctx.waitAfterBootout = () => {
    assert.equal(f.events.includes('bootstrap'), false)
  }
  const beforeUnknown = JSON.parse(readFileSync(f.ctx.turnRecoveryStore)).records
    .filter(record => record.initialOutcome === 'outcome_unknown').length
  const result = drainThenRestart({ ...f, sourceSha })
  assert.equal(result.healthy, true)
  assert.deepEqual(f.events, ['drained', 'SIGTERM', 'old-instance-exited', 'bootstrap'])
  // Exercise the real startup loader after the simulated native replacement.
  const restarted = new TurnReconciliationStore({ persistenceFile: f.ctx.turnRecoveryStore, runtimeEpoch: 'epoch-next' })
  assert.equal(restarted.getTurnReconciliation(f.handle).snapshot.outcome, 'completed')
  const records = JSON.parse(readFileSync(f.ctx.turnRecoveryStore)).records
  assert.equal(records.filter(record => record.initialOutcome === 'outcome_unknown').length - beforeUnknown, 0)
  assert.equal(records.filter(record => record.queryState === 'pending').length, 0)
  assert.equal(records.filter(record => record.fenceState === 'active').length, 0)
})
