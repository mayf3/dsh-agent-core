import test from 'node:test'
import assert from 'node:assert/strict'
import { appendFileSync, chmodSync, linkSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

import { restartSchedulerProductionRuntime } from '../../src/scheduler/deployment-runtime-restart.js'
import { withRestartProof } from '../compose-fixture.js'

test('runtime restart replaces stale provenance coordinates and reads back the exact deployed SHA', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'scheduler-runtime-restart-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const launchdDir = join(root, 'launchd')
  const artifactsDir = join(root, 'artifacts')
  const binDir = join(root, 'bin')
  mkdirSync(launchdDir); mkdirSync(binDir)
  const plistPath = join(launchdDir, 'ai.agent-core.runtime.plist')
  writeFileSync(plistPath, '<plist><dict><key>AGENT_CORE_DEPLOYED_SHA</key><string>0000000000000000000000000000000000000000</string><key>HOME</key><string>/Users/authsvc</string></dict></plist>\n')
  chmodSync(plistPath, 0o600)
  if (process.platform === 'darwin') execFileSync('/usr/bin/xattr', ['-c', plistPath])
  const curl = join(binDir, 'curl')
  writeFileSync(curl, '#!/bin/sh\nprintf \'%s\\n\' \'{"ok":true}\'\n')
  chmodSync(curl, 0o700)
  const oldPath = process.env.PATH
  process.env.PATH = `${binDir}:${oldPath}`
  t.after(() => { process.env.PATH = oldPath })
  const phases = []
  const durability = []
  const receipts = []
  let loaded = true
  const sha = '1234567890abcdef1234567890abcdef12345678'
  const result = restartSchedulerProductionRuntime({
    ctx: withRestartProof({
      launchdDir, artifactsDir, authsvcUid: process.getuid(), authsvcGid: 601, runtimeReaderGid: 20,
      isLoaded: () => loaded,
      bootout: (label) => { phases.push(`bootout:${label}`); loaded = false },
      bootstrap: (path, label) => { phases.push(`bootstrap:${path}:${label}`); loaded = true },
      runtimeReceipt: (receipt) => receipts.push(receipt),
      onDurabilityStage: (stage) => durability.push(stage),
    }, root),
    phase: (name, ok) => phases.push(`${name}:${ok}`), sourceSha: sha,
  })
  assert.equal(result.deployedSha, sha)
  assert.match(readFileSync(plistPath, 'utf8'), new RegExp(`<key>AGENT_CORE_DEPLOYED_SHA</key><string>${sha}</string>`))
  assert.match(readFileSync(plistPath, 'utf8'), /<key>SCHEDULER_ROUTING_READER_GID<\/key><string>601<\/string>/)
  assert.match(readFileSync(plistPath, 'utf8'), /<key>SCHEDULER_INCIDENT_OWNER_GID<\/key><string>20<\/string>/)
  assert.equal(statSync(plistPath).mode & 0o777, 0o600)
  assert.deepEqual(receipts.map((receipt) => receipt.status), ['INSTALLING', 'INSTALLED'])
  assert.equal(receipts[0].installedSha256, receipts[1].installedSha256)
  assert.deepEqual(durability, ['preimage-file-synced', 'preimage-renamed', 'preimage-directory-synced', 'candidate-file-synced', 'candidate-renamed', 'target-directory-synced'])
  assert.deepEqual(phases, [
    'bootout:system/ai.agent-core.runtime',
    `bootstrap:${plistPath}:system/ai.agent-core.runtime`,
    'runtime:true',
  ])
})

test('runtime restart rejects a same-byte preimage with different predecessor metadata', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'scheduler-runtime-preimage-metadata-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const launchdDir = join(root, 'launchd')
  const artifactsDir = join(root, 'artifacts')
  const plistPath = join(launchdDir, 'ai.agent-core.runtime.plist')
  const preimage = join(artifactsDir, 'rollback', 'ai.agent-core.runtime.plist.preimage')
  mkdirSync(launchdDir, { recursive: true }); mkdirSync(join(artifactsDir, 'rollback'), { recursive: true })
  const bytes = '<plist><dict><key>HOME</key><string>/Users/authsvc</string></dict></plist>\n'
  writeFileSync(plistPath, bytes); writeFileSync(preimage, bytes)
  chmodSync(plistPath, 0o644); chmodSync(preimage, 0o600)
  if (process.platform === 'darwin') {
    execFileSync('/usr/bin/xattr', ['-c', plistPath]); execFileSync('/usr/bin/xattr', ['-c', preimage])
  }
  const receipts = []
  assert.throws(() => restartSchedulerProductionRuntime({ ctx: withRestartProof({
    launchdDir, artifactsDir, authsvcUid: process.getuid(), authsvcGid: 20,
    runtimeReceipt: (receipt) => receipts.push(receipt),
  }, root), phase: () => assert.fail('phase must not run'), sourceSha: '1'.repeat(40) }), /preimage metadata differs/)
  assert.deepEqual(receipts, [])
  assert.equal(statSync(plistPath).mode & 0o777, 0o644)
})

test('runtime replay rejects rollback preimage drift against the frozen receipt', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'scheduler-runtime-receipt-preimage-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const launchdDir = join(root, 'launchd'), artifactsDir = join(root, 'artifacts')
  const plistPath = join(launchdDir, 'ai.agent-core.runtime.plist')
  const preimage = join(artifactsDir, 'rollback', 'ai.agent-core.runtime.plist.preimage')
  mkdirSync(launchdDir, { recursive: true }); mkdirSync(join(artifactsDir, 'rollback'), { recursive: true })
  writeFileSync(plistPath, '<plist><dict><key>HOME</key><string>/Users/authsvc</string></dict></plist>\n')
  writeFileSync(preimage, 'wrong rollback bytes'); chmodSync(plistPath, 0o600); chmodSync(preimage, 0o600)
  if (process.platform === 'darwin') {
    execFileSync('/usr/bin/xattr', ['-c', plistPath]); execFileSync('/usr/bin/xattr', ['-c', preimage])
  }
  const metadata = { uid: statSync(preimage).uid, gid: statSync(preimage).gid, mode: 0o644, acl: 'NONE', xattrs: 'NONE' }
  assert.throws(() => restartSchedulerProductionRuntime({ ctx: withRestartProof({
    launchdDir, artifactsDir, authsvcUid: process.getuid(), authsvcGid: 20,
    runtimePriorReceipt: { sourceSha: '1'.repeat(40), plistPath, preimage, preimageSha256: '0'.repeat(64),
      preimageMetadata: metadata, preimageXattrs: [], installedSha256: createHash('sha256').update(readFileSync(plistPath)).digest('hex') },
    runtimeReceipt: () => assert.fail('replacement receipt must not be written'),
  }, root), phase: () => assert.fail('phase must not run'), sourceSha: '1'.repeat(40) }), /preimage generation mismatch/)
})

function proofFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'runtime-exit-proof-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const launchdDir = join(root, 'launchd'), artifactsDir = join(root, 'artifacts')
  mkdirSync(launchdDir)
  const plistPath = join(launchdDir, 'ai.agent-core.runtime.plist')
  writeFileSync(plistPath, '<plist><dict><key>HOME</key><string>/Users/authsvc</string></dict></plist>\n', { mode: 0o600 })
  if (process.platform === 'darwin') execFileSync('/usr/bin/xattr', ['-c', plistPath])
  const calls = []
  let loaded = true
  const ctx = withRestartProof({
    launchdDir, artifactsDir, authsvcUid: process.getuid(), authsvcGid: 601, unloadTimeoutMs: 40,
    isLoaded: () => loaded,
    bootout: () => { calls.push('bootout'); loaded = false },
    bootstrap: () => { calls.push('bootstrap'); throw new Error('test stopped after verified bootstrap boundary') },
  }, root)
  const boundary = join(ctx.turnRecoveryStore, '..', 'restart-boundary.jsonl')
  return { ctx, calls, boundary, plistPath }
}

test('runtime restart without exact old-instance readback refuses before mutation', t => {
  const { ctx, calls, plistPath } = proofFixture(t)
  const before = readFileSync(plistPath)
  delete ctx.readRuntimeInstance
  assert.throws(() => restartSchedulerProductionRuntime({ ctx, phase() {}, sourceSha: '1'.repeat(40) }),
    error => error.code === 'RESTART_EXIT_PROOF_UNAVAILABLE')
  assert.deepEqual(calls, [])
  assert.deepEqual(readFileSync(plistPath), before)
})

for (const field of ['uid', 'gid']) test(`runtime restart rejects unexpected native ${field} before mutation`, t => {
  const { ctx, calls, plistPath } = proofFixture(t)
  const before = readFileSync(plistPath)
  const instance = ctx.readRuntimeInstance()
  ctx.readRuntimeInstance = () => ({ ...instance, [field]: instance[field] + 1 })
  assert.throws(() => restartSchedulerProductionRuntime({ ctx, phase() {}, sourceSha: '1'.repeat(40) }),
    error => error.code === 'RESTART_EXIT_PROOF_UNAVAILABLE')
  assert.deepEqual(calls, [])
  assert.deepEqual(readFileSync(plistPath), before)
})

for (const scenario of ['missing-capability', 'wrong-instance-capability', 'writable-capability-log']) {
  test(`runtime restart leaves an unqualified predecessor running on ${scenario}`, t => {
    const { ctx, calls, plistPath } = proofFixture(t)
    const before = readFileSync(plistPath)
    const path = join(ctx.turnRecoveryStore, '..', 'runtime-evidence.jsonl')
    const entry = JSON.parse(readFileSync(path, 'utf8'))
    if (scenario === 'missing-capability') delete entry.stopProof
    if (scenario === 'wrong-instance-capability') entry.stopProof.instance.started = 'Wed Oct 28 11:00:00 2026'
    writeFileSync(path, JSON.stringify(entry) + '\n')
    if (scenario === 'writable-capability-log') chmodSync(path, 0o666)
    assert.throws(() => restartSchedulerProductionRuntime({ ctx, phase() {}, sourceSha: '1'.repeat(40) }),
      error => error.code === 'RESTART_EXIT_PROOF_UNAVAILABLE')
    assert.deepEqual(calls, [], 'an unsupported old producer is not stopped to discover its missing capability')
    assert.deepEqual(readFileSync(plistPath), before)
  })
}

for (const scenario of ['missing-end', 'failed-stop', 'wrong-pid', 'wrong-epoch', 'reap-slot', 'duplicate-end', 'old-instance-alive', 'writable-log', 'hardlinked-log', 'store-deleted']) {
  test(`runtime restart refuses bootstrap on ${scenario} stop proof`, t => {
    const { ctx, calls, boundary } = proofFixture(t)
    const bootout = ctx.bootout
    ctx.bootout = (...args) => {
      bootout(...args)
      const entries = readFileSync(boundary, 'utf8').trim().split('\n').map(JSON.parse)
      const end = entries[1]
      if (scenario === 'missing-end') entries.pop()
      if (scenario === 'failed-stop') end.stopResult = 'stop_failed'
      if (scenario === 'wrong-pid') end.pid += 1
      if (scenario === 'wrong-epoch') end.census.epoch = 'another-epoch'
      if (scenario === 'reap-slot') end.census.slots = [{ agentId: 'agt_a', slot: 'REAP', generation: 1 }]
      if (scenario === 'duplicate-end') entries.push(end)
      if (scenario === 'store-deleted') { unlinkSync(ctx.turnRecoveryStore); end.census.durableEpoch = null }
      writeFileSync(boundary, entries.map(entry => JSON.stringify(entry) + '\n').join(''))
      if (scenario === 'writable-log') chmodSync(boundary, 0o666)
      if (scenario === 'hardlinked-log') linkSync(boundary, boundary + '.second-link')
    }
    if (scenario === 'old-instance-alive') ctx.readProcessInstance = () => ctx.readRuntimeInstance()
    assert.throws(() => restartSchedulerProductionRuntime({ ctx, phase() {}, sourceSha: '1'.repeat(40) }),
      error => error.code === 'RESTART_EXIT_PROOF_UNAVAILABLE')
    assert.deepEqual(calls, ['bootout'], 'no replacement starts without complete exact old-generation exit proof')
  })
}

test('runtime restart rejects stale receipts even for the same epoch and PID', t => {
  const { ctx, calls, boundary } = proofFixture(t)
  const bootout = ctx.bootout
  bootout()
  calls.length = 0
  ctx.bootout = () => { calls.push('bootout') }
  ctx.isLoaded = () => !calls.includes('bootout')
  assert.throws(() => restartSchedulerProductionRuntime({ ctx, phase() {}, sourceSha: '1'.repeat(40) }),
    error => error.code === 'RESTART_EXIT_PROOF_UNAVAILABLE')
  assert.deepEqual(calls, ['bootout'])
  assert.equal(readFileSync(boundary, 'utf8').trim().split('\n').length, 2)
})

test('runtime restart rejects a changed old instance before sending bootout', t => {
  const { ctx, calls } = proofFixture(t)
  const instance = ctx.readRuntimeInstance()
  let reads = 0
  ctx.readRuntimeInstance = () => ({ ...instance, started: reads++ === 0 ? instance.started : 'Wed Oct 28 13:00:00 2026' })
  assert.throws(() => restartSchedulerProductionRuntime({ ctx, phase() {}, sourceSha: '1'.repeat(40) }),
    error => error.code === 'RESTART_EXIT_PROOF_UNAVAILABLE')
  assert.deepEqual(calls, [])
})

test('runtime restart waits within the existing unload budget for the old native instance to exit', t => {
  const { ctx, calls } = proofFixture(t)
  let reads = 0
  ctx.readProcessInstance = () => reads++ === 0 ? ctx.readRuntimeInstance() : null
  ctx.waitAfterBootout = () => { calls.push('wait') }
  assert.throws(() => restartSchedulerProductionRuntime({ ctx, phase() {}, sourceSha: '1'.repeat(40) }),
    /test stopped after verified bootstrap boundary/)
  assert.deepEqual(calls, ['bootout', 'wait', 'bootstrap'])
})

test('runtime restart waits for this stop to finish writing its fresh end receipt', t => {
  const { ctx, calls, boundary } = proofFixture(t)
  const bootout = ctx.bootout
  let end
  ctx.bootout = (...args) => {
    bootout(...args)
    const lines = readFileSync(boundary, 'utf8').trim().split('\n')
    end = lines.pop()
    writeFileSync(boundary, lines.join('\n') + '\n')
  }
  ctx.waitAfterBootout = () => { calls.push('wait'); appendFileSync(boundary, end + '\n') }
  assert.throws(() => restartSchedulerProductionRuntime({ ctx, phase() {}, sourceSha: '1'.repeat(40) }),
    /test stopped after verified bootstrap boundary/)
  assert.deepEqual(calls, ['bootout', 'wait', 'bootstrap'])
})

test('runtime restart refuses a successful native readback that completes after the shared unload deadline', t => {
  const { ctx, calls } = proofFixture(t)
  ctx.unloadTimeoutMs = 5
  ctx.readProcessInstance = () => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 35)
    return null
  }
  assert.throws(() => restartSchedulerProductionRuntime({ ctx, phase() {}, sourceSha: '1'.repeat(40) }),
    error => error.code === 'RESTART_EXIT_PROOF_UNAVAILABLE')
  assert.deepEqual(calls, ['bootout'], 'late proof cannot authorize replacement')
})
