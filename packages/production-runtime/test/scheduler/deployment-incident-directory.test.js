import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, chown, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { normalizeLegacyIncidentStateFiles, preparePrivateRuntimeDirectory } from '../../src/scheduler/deployment-incident-directory.js'

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

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

test('incident migration converts only an explicitly allowed legacy runtime group', async (t) => {
  const expectedGid = process.getgroups().find((gid) => gid !== process.getgid())
  if (expectedGid === undefined) return t.skip('no secondary group available for gid migration proof')
  const root = await mkdtemp(join(tmpdir(), 'scheduler-incident-dir-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const target = join(root, 'watchdog')
  await mkdir(target, { mode: 0o700 })

  assert.equal(preparePrivateRuntimeDirectory({
    path: target, expectedUid: process.getuid(), expectedGid, allowedLegacyGids: [process.getgid()],
  }).status, 'OWNERSHIP_MIGRATED')
  const final = await lstat(target)
  assert.equal(final.gid, expectedGid)
  assert.equal(final.mode & 0o777, 0o700)
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

test('incident migration refuses a mode-0700 directory with a permissive macOS ACL', { skip: process.platform !== 'darwin' }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'scheduler-incident-dir-acl-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const target = join(root, 'watchdog')
  await mkdir(target, { mode: 0o700 })
  execFileSync('/bin/chmod', ['+a', 'everyone allow list,search,add_file,delete_child', target])

  assert.throws(() => preparePrivateRuntimeDirectory({
    path: target, expectedUid: process.getuid(), expectedGid: process.getgid(),
  }), /unsafe incident state directory/)
})

test('incident ownership migration preserves provenance-only xattr', { skip: process.platform !== 'darwin' }, async (t) => {
  const expectedGid = process.getgroups().find((gid) => gid !== process.getgid())
  if (expectedGid === undefined) return t.skip('no secondary group available for gid migration proof')
  const root = await mkdtemp(join(tmpdir(), 'scheduler-incident-dir-provenance-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const target = join(root, 'watchdog')
  await mkdir(target, { mode: 0o700 })
  execFileSync('/usr/bin/xattr', ['-w', 'com.apple.provenance', 'test', target])

  assert.equal(preparePrivateRuntimeDirectory({
    path: target, expectedUid: process.getuid(), expectedGid, allowedLegacyGids: [process.getgid()],
  }).status, 'OWNERSHIP_MIGRATED')
  assert.match(execFileSync('/usr/bin/xattr', [target], { encoding: 'utf8' }), /com\.apple\.provenance/)
})

test('incident state file normalization migrates exactly the authorized legacy-gid set and converges on rerun', async (t) => {
  const canonicalGid = process.getgroups().find((gid) => gid !== process.getgid())
  if (canonicalGid === undefined) return t.skip('no secondary group available for gid migration proof')
  const root = await mkdtemp(join(tmpdir(), 'scheduler-incident-files-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const stateDir = join(root, 'watchdog')
  const backupDir = join(stateDir, 'migration-backups')
  await mkdir(stateDir, { mode: 0o700 })
  await chown(stateDir, process.getuid(), canonicalGid)
  await mkdir(backupDir, { mode: 0o700 })

  const incidentsBytes = Buffer.from(JSON.stringify({ committed: 'gen-1' }), 'utf8')
  await writeFile(join(stateDir, 'incidents.json'), incidentsBytes, { mode: 0o600 })
  await writeFile(join(stateDir, 'incidents.json.lock'), Buffer.from('lock\n'), { mode: 0o600 })
  await writeFile(join(stateDir, 'incidents.json.lock.reaped.1.a.tmp'), Buffer.from('reaped\n'), { mode: 0o600 })
  const backupBytes = new Map()
  for (const name of ['legacy-a.json', 'evidence-b.jsonl', 'facts-c.json']) {
    const bytes = Buffer.from(`${name}\n`)
    backupBytes.set(name, sha256(bytes))
    await writeFile(join(backupDir, name), bytes, { mode: 0o600 })
  }
  execFileSync('/usr/bin/xattr', ['-w', 'com.apple.provenance', 'test', join(stateDir, 'incidents.json')])
  const legacyGid = process.getgid()
  for (const path of [join(stateDir, 'incidents.json'), join(stateDir, 'incidents.json.lock'),
    join(stateDir, 'incidents.json.lock.reaped.1.a.tmp'), backupDir,
    join(backupDir, 'legacy-a.json'), join(backupDir, 'evidence-b.jsonl'), join(backupDir, 'facts-c.json')]) {
    await chown(path, process.getuid(), legacyGid)
  }
  const outOfSet = join(stateDir, 'alert-state.json')
  await writeFile(outOfSet, Buffer.from('legacy raw\n'), { mode: 0o644 })
  await chown(outOfSet, process.getuid(), legacyGid)

  const receipt = normalizeLegacyIncidentStateFiles({
    stateDir, expectedUid: process.getuid(), expectedGid: canonicalGid, allowedLegacyGids: [legacyGid],
  })
  assert.equal(receipt.status, 'NORMALIZED')
  assert.deepEqual([...receipt.repaired].sort(), [
    'incidents.json', 'incidents.json.lock', 'incidents.json.lock.reaped.1.a.tmp',
    'migration-backups', 'migration-backups/evidence-b.jsonl', 'migration-backups/facts-c.json', 'migration-backups/legacy-a.json',
  ])
  for (const path of [join(stateDir, 'incidents.json'), join(stateDir, 'incidents.json.lock'),
    join(stateDir, 'incidents.json.lock.reaped.1.a.tmp'), backupDir,
    join(backupDir, 'legacy-a.json'), join(backupDir, 'evidence-b.jsonl'), join(backupDir, 'facts-c.json')]) {
    const final = await lstat(path)
    assert.equal(final.gid, canonicalGid)
    assert.equal(final.mode & 0o777, path === backupDir ? 0o700 : 0o600)
  }
  assert.equal(sha256(await readFile(join(stateDir, 'incidents.json'))), sha256(incidentsBytes))
  for (const [name, hash] of backupBytes) assert.equal(sha256(await readFile(join(backupDir, name))), hash)
  assert.match(execFileSync('/usr/bin/xattr', [join(stateDir, 'incidents.json')], { encoding: 'utf8' }), /com\.apple\.provenance/)
  const untouched = await lstat(outOfSet)
  assert.equal(untouched.gid, legacyGid)
  assert.equal(untouched.mode & 0o777, 0o644)

  const rerun = normalizeLegacyIncidentStateFiles({
    stateDir, expectedUid: process.getuid(), expectedGid: canonicalGid, allowedLegacyGids: [legacyGid],
  })
  assert.equal(rerun.status, 'READY')
  assert.deepEqual(rerun.repaired, [])
})

test('incident state file normalization refuses unauthorized metadata and never recurses blindly', async (t) => {
  const canonicalGid = process.getgroups().find((gid) => gid !== process.getgid())
  if (canonicalGid === undefined) return t.skip('no secondary group available for gid migration proof')
  const root = await mkdtemp(join(tmpdir(), 'scheduler-incident-refuse-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const stateDir = join(root, 'watchdog')
  const backupDir = join(stateDir, 'migration-backups')
  await mkdir(stateDir, { mode: 0o700 })
  await mkdir(backupDir, { mode: 0o700 })
  const legacyGid = process.getgid()
  await writeFile(join(stateDir, 'incidents.json'), Buffer.from('x\n'), { mode: 0o600 })
  await writeFile(join(backupDir, 'legacy-a.json'), Buffer.from('a\n'), { mode: 0o600 })
  await mkdir(join(backupDir, 'stale-subdir'), { mode: 0o700 })

  assert.throws(() => normalizeLegacyIncidentStateFiles({
    stateDir, expectedUid: process.getuid(), expectedGid: canonicalGid, allowedLegacyGids: [],
  }), /unsafe incident state directory/)
  const refused = await lstat(join(stateDir, 'incidents.json'))
  assert.equal(refused.gid, legacyGid)

  assert.throws(() => normalizeLegacyIncidentStateFiles({
    stateDir, expectedUid: process.getuid() + 1, expectedGid: canonicalGid, allowedLegacyGids: [legacyGid],
  }), /unsafe incident state directory/)

  const modeDrift = join(stateDir, 'incidents.json.lock')
  await writeFile(modeDrift, Buffer.from('lock\n'), { mode: 0o644 })
  await chown(modeDrift, process.getuid(), legacyGid)
  assert.throws(() => normalizeLegacyIncidentStateFiles({
    stateDir, expectedUid: process.getuid(), expectedGid: canonicalGid, allowedLegacyGids: [legacyGid],
  }), /unsafe incident state directory/)
  await rm(modeDrift)
  await chown(join(stateDir, 'incidents.json'), process.getuid(), legacyGid)

  const receipt = normalizeLegacyIncidentStateFiles({
    stateDir, expectedUid: process.getuid(), expectedGid: process.getgid(), allowedLegacyGids: [],
  })
  assert.deepEqual(receipt.skipped, ['migration-backups/stale-subdir'])
  const subdir = await lstat(join(backupDir, 'stale-subdir'))
  assert.equal(subdir.isDirectory(), true)
})
