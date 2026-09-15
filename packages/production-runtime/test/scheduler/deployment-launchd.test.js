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
