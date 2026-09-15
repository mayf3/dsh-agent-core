import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chmod, lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { restoreRollbackFile } from '../../src/scheduler/deployment-rollback-file.js'

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

test('rollback restores exact 0644 metadata even under a restrictive process umask', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'scheduler-rollback-file-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const preimagePath = join(root, 'preimage')
  const targetPath = join(root, 'target')
  const before = Buffer.from('before\n')
  const installed = Buffer.from('installed\n')
  await writeFile(preimagePath, before, { mode: 0o600 })
  await writeFile(targetPath, installed, { mode: 0o640 })
  const oldUmask = process.umask(0o077)
  try {
    assert.equal(restoreRollbackFile({
      preimagePath, targetPath,
      installedSha256: sha256(installed), preimageSha256: sha256(before),
      preimageMetadata: { uid: process.getuid(), gid: process.getgid(), mode: 0o644, acl: 'NONE', xattrs: 'NONE' },
    }).status, 'RESTORED')
  } finally { process.umask(oldUmask) }
  assert.equal(await readFile(targetPath, 'utf8'), 'before\n')
  assert.equal((await lstat(targetPath)).mode & 0o777, 0o644)
})

test('rollback repairs same-byte predecessor metadata drift after a partial rollback', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'scheduler-rollback-file-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const preimagePath = join(root, 'preimage')
  const targetPath = join(root, 'target')
  const before = Buffer.from('before\n')
  await writeFile(preimagePath, before, { mode: 0o600 })
  await writeFile(targetPath, before, { mode: 0o600 })
  await chmod(targetPath, 0o600)

  assert.equal(restoreRollbackFile({
    preimagePath, targetPath,
    installedSha256: sha256(Buffer.from('installed\n')), preimageSha256: sha256(before),
    preimageMetadata: { uid: process.getuid(), gid: process.getgid(), mode: 0o644, acl: 'NONE', xattrs: 'NONE' },
  }).status, 'METADATA_REPAIRED')
  assert.equal((await lstat(targetPath)).mode & 0o777, 0o644)
})
