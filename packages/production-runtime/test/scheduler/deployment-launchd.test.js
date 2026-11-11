import test from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createLaunchdAdapter, quiesceLaunchdServices } from '../../src/scheduler/deployment-launchd.js'

test('launchd quiesce records prior state and proves every service absent', () => {
  const loaded = new Set(['w1'])
  const prior = quiesceLaunchdServices(['w1', 'w2'], {
    isLoaded: (label) => loaded.has(label),
    bootout: (label) => loaded.delete(label),
  })
  assert.deepEqual(prior, { w1: true, w2: false })
})

test('launchd quiesce fails on bootout refusal or still-loaded readback', () => {
  assert.throws(() => quiesceLaunchdServices(['w1'], { isLoaded: () => true, bootout: () => { throw new Error('EPERM') } }), /EPERM/)
  assert.throws(() => quiesceLaunchdServices(['w1'], {
    isLoaded: () => true,
    bootout: () => undefined,
    waitAfterBootout: () => undefined,
    maxUnloadReadbacks: 2,
  }), /remained loaded/)
})

test('launchd quiesce tolerates a bounded asynchronous bootout visibility window', () => {
  let bootedOut = false
  let transientLoadedReadbacks = 2
  let waits = 0
  const prior = quiesceLaunchdServices(['runtime'], {
    isLoaded: () => !bootedOut || transientLoadedReadbacks-- > 0,
    bootout: () => { bootedOut = true },
    waitAfterBootout: () => { waits += 1 },
    maxUnloadReadbacks: 3,
  })
  assert.deepEqual(prior, { runtime: true })
  assert.equal(waits, 2)
})

test('launchd quiesce terminates a launchctl command that exceeds the absolute deadline', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'scheduler-launchctl-hang-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const launchctl = join(root, 'launchctl')
  await writeFile(launchctl, '#!/bin/sh\nsleep 30\n', { mode: 0o700 })
  await chmod(launchctl, 0o700)
  const started = performance.now()
  assert.throws(() => quiesceLaunchdServices(['runtime'], {
    ...createLaunchdAdapter({ launchctl }),
    unloadTimeoutMs: 150,
  }), (error) => error?.code === 'ETIMEDOUT')
  assert.ok(performance.now() - started < 1500)
})

test('terminated launchctl cannot masquerade as an unloaded not-found readback', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'scheduler-launchctl-partial-not-found-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const launchctl = join(root, 'launchctl')
  const count = join(root, 'count')
  await writeFile(launchctl, `#!/bin/sh
if [ ! -e '${count}' ]; then
  : > '${count}'
  echo 'Could not find service'
  exit 113
fi
echo 'Could not find service'
exec sleep 30
`, { mode: 0o700 })
  await chmod(launchctl, 0o700)
  if (process.platform === 'darwin') execFileSync('/usr/bin/xattr', ['-c', launchctl])
  assert.throws(() => quiesceLaunchdServices(['runtime'], {
    ...createLaunchdAdapter({ launchctl }),
    unloadTimeoutMs: 1000,
  }), (error) => error?.code === 'ETIMEDOUT' || error?.signal !== null)
})

test('native runtime instance readback binds repeated launchd PID and native process start identity', () => {
  const calls = []
  const adapter = createLaunchdAdapter({ runCommand: (file, args) => {
    calls.push([file, args])
    if (file === '/bin/ps') return '824201 501 20 Wed Oct 28 12:00:00 2026 /fixture/node\n'
    return 'system/ai.agent-core.runtime = {\n pid = 824201\n}\n'
  } })
  assert.deepEqual(adapter.readRuntimeInstance('system/ai.agent-core.runtime'), {
    pid: 824201, uid: 501, gid: 20, started: 'Wed Oct 28 12:00:00 2026', program: '/fixture/node',
  })
  assert.equal(calls.filter(([file]) => file === '/bin/ps').length, 2)
})

test('native runtime instance readback rejects a changed PID or start identity', () => {
  let reads = 0
  const adapter = createLaunchdAdapter({ runCommand: file => file === '/bin/ps'
    ? `824201 501 20 Wed Oct 28 ${reads++ === 0 ? '12' : '13'}:00:00 2026 /fixture/node\n`
    : 'system/ai.agent-core.runtime = {\n pid = 824201\n}\n' })
  assert.throws(() => adapter.readRuntimeInstance('system/ai.agent-core.runtime'),
    error => error.code === 'RESTART_EXIT_PROOF_UNAVAILABLE')
})

test('an interrupted native process query cannot masquerade as old-instance absence', () => {
  const interrupted = Object.assign(new Error('native query interrupted'), { status: 1, signal: 'SIGKILL', stdout: '', stderr: '' })
  const adapter = createLaunchdAdapter({ runCommand() { throw interrupted } })
  assert.throws(() => adapter.readProcessInstance(824201), error => error === interrupted)
})

test('native process identity queries use the C locale even when the parent default is localized', () => {
  let nativeEnv
  const adapter = createLaunchdAdapter({ runCommand(file, args, options) {
    assert.equal(file, '/bin/ps')
    nativeEnv = options.env
    return options.env?.LC_ALL === 'C' && options.env?.LANG === 'C'
      ? '824201 501 20 Wed Oct 28 12:00:00 2026 /fixture/node\n'
      : '824201 501 20 三 10月 28 12:00:00 2026 /fixture/node\n'
  } })
  assert.deepEqual(adapter.readProcessInstance(824201), {
    pid: 824201, uid: 501, gid: 20, started: 'Wed Oct 28 12:00:00 2026', program: '/fixture/node',
  })
  assert.equal(nativeEnv.LC_ALL, 'C')
  assert.equal(nativeEnv.LANG, 'C')
})
