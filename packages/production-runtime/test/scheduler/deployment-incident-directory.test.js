import test from 'node:test'
import assert from 'node:assert/strict'
import { chmod, lstat, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { preparePrivateRuntimeDirectory } from '../../src/scheduler/deployment-incident-directory.js'

test('incident migration narrows an existing runtime-owned 0755 directory to 0700', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'scheduler-incident-dir-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const target = join(root, 'watchdog')
  await mkdir(target, { mode: 0o755 })
  await chmod(target, 0o755)

  assert.equal(preparePrivateRuntimeDirectory({
    path: target, expectedUid: process.getuid(), expectedGid: process.getgid(),
  }).status, 'NARROWED')
  assert.equal((await lstat(target)).mode & 0o777, 0o700)
})

test('incident migration directory preparation is idempotent at 0700', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'scheduler-incident-dir-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const target = join(root, 'watchdog')
  await mkdir(target, { mode: 0o700 })
  await chmod(target, 0o700)

  assert.equal(preparePrivateRuntimeDirectory({
    path: target, expectedUid: process.getuid(), expectedGid: process.getgid(),
  }).status, 'READY')
})

test('incident migration refuses symlink, wrong owner authority, and writable legacy mode', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'scheduler-incident-dir-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const real = join(root, 'real')
  const link = join(root, 'link')
  await mkdir(real, { mode: 0o700 })
  await symlink(real, link)
  assert.throws(() => preparePrivateRuntimeDirectory({
    path: link, expectedUid: process.getuid(), expectedGid: process.getgid(),
  }), /unsafe incident state directory/)
  assert.throws(() => preparePrivateRuntimeDirectory({
    path: real, expectedUid: process.getuid() + 1, expectedGid: process.getgid(),
  }), /unsafe incident state directory/)
  await chmod(real, 0o777)
  assert.throws(() => preparePrivateRuntimeDirectory({
    path: real, expectedUid: process.getuid(), expectedGid: process.getgid(),
  }), /unsafe incident state directory/)
})
