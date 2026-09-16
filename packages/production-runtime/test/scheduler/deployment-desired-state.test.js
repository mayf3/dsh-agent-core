import test from 'node:test'
import assert from 'node:assert/strict'
import { chmod, chown, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

import { installSchedulerDesiredState } from '../../src/scheduler/deployment-desired-state.js'

const plain = (path) => { if (process.platform === 'darwin') execFileSync('/usr/bin/xattr', ['-c', path]) }

test('desired-state install splits control gids (candidate/preimage) from the installed target gid', async (t) => {
  const controlGid = process.getgid()
  const targetGid = process.getgroups().find((gid) => gid !== controlGid)
  if (targetGid === undefined) return t.skip('no secondary group available for control/target gid split proof')
  const { chown } = await import('node:fs/promises')
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-desired-split-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const targetPath = join(root, 'config', 'scheduler-desired-state.json')
  const candidatePath = join(root, 'control', 'candidates', 'scheduler-desired-state.json')
  const preimagePath = join(root, 'control', 'rollback', 'scheduler-desired-state.json.preimage')
  await mkdir(join(root, 'config')); await mkdir(join(root, 'control', 'candidates'), { recursive: true, mode: 0o700 }); await mkdir(join(root, 'control', 'rollback'), { recursive: true, mode: 0o700 })
  await writeFile(targetPath, '{"version":"old"}\n', { mode: 0o640 })
  plain(targetPath)
  await chown(targetPath, process.getuid(), targetGid)
  // simulate the apply controller: candidate/preimage are created by the root apply
  // process (creator gid = controlGid) while the installed target carries authsvcGid
  const bytes = Buffer.from('{"version":1,"jobs":[]}\n')
  const result = installSchedulerDesiredState({
    bytes, expectedJobs: [], targetPath, candidatePath, preimagePath,
    expectedUid: process.getuid(), expectedGid: targetGid, controlUid: process.getuid(), controlGid,
    writeReceipt: () => {},
  })
  assert.equal(result.status, 'INSTALLED')
  const final = await lstat(targetPath)
  assert.equal(final.gid, targetGid)
  assert.equal(final.mode & 0o777, 0o640)
  assert.equal(await readFile(targetPath, 'utf8'), bytes.toString())
})

test('desired-state install preserves exact predecessor and replay retains first receipt', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-desired-install-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const targetPath = join(root, 'config', 'scheduler-desired-state.json')
  const candidatePath = join(root, 'control', 'candidates', 'scheduler-desired-state.json')
  const preimagePath = join(root, 'control', 'rollback', 'scheduler-desired-state.json.preimage')
  await mkdir(join(root, 'config')); await mkdir(join(root, 'control', 'candidates'), { recursive: true, mode: 0o700 }); await mkdir(join(root, 'control', 'rollback'), { recursive: true, mode: 0o700 })
  await writeFile(targetPath, '{"version":"old"}\n', { mode: 0o640 })
  plain(targetPath)
  const bytes = Buffer.from('{"version":1,"jobs":[]}\n')
  let receipt
  const args = { bytes, expectedJobs: [], targetPath, candidatePath, preimagePath, expectedUid: process.getuid(), expectedGid: process.getgid(), writeReceipt: (value) => { receipt = value } }
  assert.equal(installSchedulerDesiredState(args).status, 'INSTALLED')
  assert.equal(await readFile(targetPath, 'utf8'), bytes.toString())
  assert.equal(await readFile(preimagePath, 'utf8'), '{"version":"old"}\n')
  assert.equal(installSchedulerDesiredState({ ...args, receipt }).status, 'ALREADY_INSTALLED')
})

test('desired-state install accepts root-owned legacy 0644 preimage and narrows the installed mode to 0640', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-desired-legacy-mode-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const targetPath = join(root, 'config', 'scheduler-desired-state.json')
  const candidatePath = join(root, 'control', 'candidates', 'scheduler-desired-state.json')
  const preimagePath = join(root, 'control', 'rollback', 'scheduler-desired-state.json.preimage')
  await mkdir(join(root, 'config'))
  await mkdir(join(root, 'control', 'candidates'), { recursive: true, mode: 0o700 })
  await mkdir(join(root, 'control', 'rollback'), { recursive: true, mode: 0o700 })
  await writeFile(targetPath, '{"version":"legacy"}\n', { mode: 0o644 })
  plain(targetPath)
  const bytes = Buffer.from('{"version":1,"jobs":[]}\n')
  let receipt
  const result = installSchedulerDesiredState({
    bytes, expectedJobs: [], targetPath, candidatePath, preimagePath,
    expectedUid: process.getuid(), expectedGid: process.getgid(), writeReceipt: (value) => { receipt = value },
  })
  assert.equal(result.status, 'INSTALLED')
  assert.equal((await lstat(targetPath)).mode & 0o777, 0o640)
  assert.equal(await readFile(targetPath, 'utf8'), bytes.toString())
  assert.equal(await readFile(preimagePath, 'utf8'), '{"version":"legacy"}\n')
  assert.equal(receipt.preimageMetadata.mode, 0o644)
})

test('desired-state replay narrows an already-installed candidate from legacy 0644 to 0640', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-desired-replay-mode-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const targetPath = join(root, 'config', 'scheduler-desired-state.json')
  const candidatePath = join(root, 'control', 'candidates', 'scheduler-desired-state.json')
  const preimagePath = join(root, 'control', 'rollback', 'scheduler-desired-state.json.preimage')
  await mkdir(join(root, 'config'))
  await mkdir(join(root, 'control', 'candidates'), { recursive: true, mode: 0o700 })
  await mkdir(join(root, 'control', 'rollback'), { recursive: true, mode: 0o700 })
  const bytes = Buffer.from('{"version":1,"jobs":[]}\n')
  await writeFile(targetPath, bytes, { mode: 0o644 })
  let receipt
  assert.throws(() => installSchedulerDesiredState({
    bytes, expectedJobs: [], targetPath, candidatePath, preimagePath,
    expectedUid: process.getuid(), expectedGid: process.getgid(),
    writeReceipt: (value) => { receipt = value; throw new Error('crash after receipt') },
  }), /crash after receipt/)
  const replay = installSchedulerDesiredState({
    bytes, expectedJobs: [], targetPath, candidatePath, preimagePath, receipt,
    expectedUid: process.getuid(), expectedGid: process.getgid(), writeReceipt: (value) => { receipt = value },
  })
  assert.equal(replay.status, 'INSTALLED')
  assert.equal((await lstat(targetPath)).mode & 0o777, 0o640)
  assert.equal(receipt.preimageMetadata.mode, 0o644)
})

test('desired-state install rejects a legacy target with an unsupported extended attribute', { skip: process.platform !== 'darwin' }, async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-desired-xattr-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const targetPath = join(root, 'config', 'scheduler-desired-state.json')
  const candidatePath = join(root, 'control', 'candidates', 'scheduler-desired-state.json')
  const preimagePath = join(root, 'control', 'rollback', 'scheduler-desired-state.json.preimage')
  await mkdir(join(root, 'config'))
  await mkdir(join(root, 'control', 'candidates'), { recursive: true, mode: 0o700 })
  await mkdir(join(root, 'control', 'rollback'), { recursive: true, mode: 0o700 })
  await writeFile(targetPath, '{"version":"legacy"}\n', { mode: 0o644 })
  execFileSync('/usr/bin/xattr', ['-w', 'user.scheduler-desired-state-test', 'test', targetPath])
  assert.throws(() => installSchedulerDesiredState({
    bytes: Buffer.from('{"version":1,"jobs":[]}\n'), expectedJobs: [], targetPath, candidatePath, preimagePath,
    expectedUid: process.getuid(), expectedGid: process.getgid(), writeReceipt: () => assert.fail('no receipt write'),
  }), /protected preimage ACL\/xattrs are unsupported/)
  assert.equal(await readFile(targetPath, 'utf8'), '{"version":"legacy"}\n')
})

test('desired-state install rejects a legacy target with an extended ACL', { skip: process.platform !== 'darwin' }, async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-desired-acl-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const targetPath = join(root, 'config', 'scheduler-desired-state.json')
  const candidatePath = join(root, 'control', 'candidates', 'scheduler-desired-state.json')
  const preimagePath = join(root, 'control', 'rollback', 'scheduler-desired-state.json.preimage')
  await mkdir(join(root, 'config'))
  await mkdir(join(root, 'control', 'candidates'), { recursive: true, mode: 0o700 })
  await mkdir(join(root, 'control', 'rollback'), { recursive: true, mode: 0o700 })
  await writeFile(targetPath, '{"version":"legacy"}\n', { mode: 0o644 })
  execFileSync('/bin/chmod', ['+a', 'everyone deny write', targetPath])
  assert.throws(() => installSchedulerDesiredState({
    bytes: Buffer.from('{"version":1,"jobs":[]}\n'), expectedJobs: [], targetPath, candidatePath, preimagePath,
    expectedUid: process.getuid(), expectedGid: process.getgid(), writeReceipt: () => assert.fail('no receipt write'),
  }), /protected preimage ACL\/xattrs are unsupported/)
})

test('desired-state install rejects a legacy target with the wrong owner identity', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-desired-owner-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const targetPath = join(root, 'config', 'scheduler-desired-state.json')
  const candidatePath = join(root, 'control', 'candidates', 'scheduler-desired-state.json')
  const preimagePath = join(root, 'control', 'rollback', 'scheduler-desired-state.json.preimage')
  await mkdir(join(root, 'config'))
  await mkdir(join(root, 'control', 'candidates'), { recursive: true, mode: 0o700 })
  await mkdir(join(root, 'control', 'rollback'), { recursive: true, mode: 0o700 })
  await writeFile(targetPath, '{"version":"legacy"}\n', { mode: 0o644 })
  plain(targetPath)
  assert.throws(() => installSchedulerDesiredState({
    bytes: Buffer.from('{"version":1,"jobs":[]}\n'), expectedJobs: [], targetPath, candidatePath, preimagePath,
    expectedUid: process.getuid() + 1, expectedGid: process.getgid(), writeReceipt: () => assert.fail('no receipt write'),
  }), /unsafe desired-state target/)
})

test('desired-state install rejects a symlink target before receipt or replacement', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-desired-symlink-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const targetPath = join(root, 'config', 'scheduler-desired-state.json')
  const victimPath = join(root, 'config', 'victim.json')
  const candidatePath = join(root, 'control', 'candidates', 'scheduler-desired-state.json')
  const preimagePath = join(root, 'control', 'rollback', 'scheduler-desired-state.json.preimage')
  await mkdir(join(root, 'config'))
  await mkdir(join(root, 'control', 'candidates'), { recursive: true, mode: 0o700 })
  await mkdir(join(root, 'control', 'rollback'), { recursive: true, mode: 0o700 })
  await writeFile(victimPath, '{"version":"victim"}\n', { mode: 0o644 })
  await symlink(victimPath, targetPath)
  assert.throws(() => installSchedulerDesiredState({
    bytes: Buffer.from('{"version":1,"jobs":[]}\n'), expectedJobs: [], targetPath, candidatePath, preimagePath,
    expectedUid: process.getuid(), expectedGid: process.getgid(), writeReceipt: () => assert.fail('no receipt write'),
  }))
  assert.equal(await readFile(victimPath, 'utf8'), '{"version":"victim"}\n')
})

test('desired-state replay rejects same-byte predecessor metadata drift', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-desired-replay-drift-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const targetPath = join(root, 'config', 'scheduler-desired-state.json')
  const candidatePath = join(root, 'control', 'candidates', 'scheduler-desired-state.json')
  const preimagePath = join(root, 'control', 'rollback', 'scheduler-desired-state.json.preimage')
  await mkdir(join(root, 'config'))
  await mkdir(join(root, 'control', 'candidates'), { recursive: true, mode: 0o700 })
  await mkdir(join(root, 'control', 'rollback'), { recursive: true, mode: 0o700 })
  await writeFile(targetPath, '{"version":"legacy"}\n', { mode: 0o644 })
  const bytes = Buffer.from('{"version":1,"jobs":[]}\n')
  let receipt
  assert.throws(() => installSchedulerDesiredState({
    bytes, expectedJobs: [], targetPath, candidatePath, preimagePath,
    expectedUid: process.getuid(), expectedGid: process.getgid(),
    writeReceipt: (value) => { receipt = value; throw new Error('crash after receipt') },
  }), /crash after receipt/)
  await chmod(targetPath, 0o600)
  assert.throws(() => installSchedulerDesiredState({
    bytes, expectedJobs: [], targetPath, candidatePath, preimagePath, receipt,
    expectedUid: process.getuid(), expectedGid: process.getgid(), writeReceipt: () => assert.fail('no receipt rewrite'),
  }), /desired-state deployment generation mismatch/)
  assert.equal(await readFile(targetPath, 'utf8'), '{"version":"legacy"}\n')
  assert.equal((await lstat(targetPath)).mode & 0o777, 0o600)
})

test('desired-state install still rejects a writable legacy target', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-desired-writable-mode-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const targetPath = join(root, 'config', 'scheduler-desired-state.json')
  const candidatePath = join(root, 'control', 'candidates', 'scheduler-desired-state.json')
  const preimagePath = join(root, 'control', 'rollback', 'scheduler-desired-state.json.preimage')
  await mkdir(join(root, 'config'))
  await mkdir(join(root, 'control', 'candidates'), { recursive: true, mode: 0o700 })
  await mkdir(join(root, 'control', 'rollback'), { recursive: true, mode: 0o700 })
  await writeFile(targetPath, '{"version":"unsafe"}\n', { mode: 0o664 })
  await chmod(targetPath, 0o664)
  plain(targetPath)
  let wroteReceipt = false
  assert.throws(() => installSchedulerDesiredState({
    bytes: Buffer.from('{"version":1,"jobs":[]}\n'), expectedJobs: [], targetPath, candidatePath, preimagePath,
    expectedUid: process.getuid(), expectedGid: process.getgid(), writeReceipt: () => { wroteReceipt = true },
  }), /unsafe desired-state target/)
  assert.equal(wroteReceipt, false)
  assert.equal(await readFile(targetPath, 'utf8'), '{"version":"unsafe"}\n')
  assert.equal((await lstat(targetPath)).mode & 0o777, 0o664)
})

test('desired-state crash after INSTALLING receipt replays from the frozen candidate, not predecessor target', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-desired-crash-')))
  t.after(() => rm(root, { recursive: true, force: true })); await chmod(root, 0o700)
  const targetPath = join(root, 'config', 'scheduler-desired-state.json'), candidatePath = join(root, 'control', 'candidates', 'desired.json')
  const preimagePath = join(root, 'control', 'rollback', 'desired.preimage'); await mkdir(join(root, 'config'))
  await mkdir(join(root, 'control', 'candidates'), { recursive: true, mode: 0o700 }); await mkdir(join(root, 'control', 'rollback'), { recursive: true, mode: 0o700 })
  await writeFile(targetPath, '{"version":"old"}\n', { mode: 0o640 })
  plain(targetPath)
  const bytes = Buffer.from('{"version":1,"jobs":[]}\n'); let receipt
  const args = { bytes, expectedJobs: [], targetPath, candidatePath, preimagePath, expectedUid: process.getuid(), expectedGid: process.getgid() }
  assert.throws(() => installSchedulerDesiredState({ ...args, writeReceipt: (value) => { receipt = value; throw new Error('crash after receipt') } }), /crash after receipt/)
  assert.equal(await readFile(targetPath, 'utf8'), '{"version":"old"}\n')
  const replay = installSchedulerDesiredState({ ...args, bytes: Buffer.from('{"version":1,"jobs":[],"_frozenAt":"later"}\n'), receipt, writeReceipt: (value) => { receipt = value } })
  assert.equal(replay.status, 'INSTALLED')
  assert.equal(await readFile(targetPath, 'utf8'), bytes.toString())
})

test('desired-state replay finalizes an INSTALLING receipt after the candidate rename frontier', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-desired-receipt-finalize-')))
  t.after(() => rm(root, { recursive: true, force: true })); await chmod(root, 0o700)
  const targetPath = join(root, 'config', 'scheduler-desired-state.json'), candidatePath = join(root, 'control', 'candidates', 'desired.json')
  const preimagePath = join(root, 'control', 'rollback', 'desired.preimage'); await mkdir(join(root, 'config'))
  await mkdir(join(root, 'control', 'candidates'), { recursive: true, mode: 0o700 }); await mkdir(join(root, 'control', 'rollback'), { recursive: true, mode: 0o700 })
  await writeFile(targetPath, '{"version":"old"}\n', { mode: 0o644 }); plain(targetPath)
  const bytes = Buffer.from('{"version":1,"jobs":[]}\n'); let persistedReceipt; let writes = 0
  const args = { bytes, expectedJobs: [], targetPath, candidatePath, preimagePath, expectedUid: process.getuid(), expectedGid: process.getgid() }
  assert.throws(() => installSchedulerDesiredState({ ...args, writeReceipt: (value) => {
    writes += 1
    if (writes === 1) persistedReceipt = value
    else throw new Error('crash before installed receipt')
  } }), /crash before installed receipt/)
  assert.equal((await lstat(targetPath)).mode & 0o777, 0o640)
  assert.equal(persistedReceipt.status, 'INSTALLING')
  const replay = installSchedulerDesiredState({ ...args, receipt: persistedReceipt, writeReceipt: (value) => { persistedReceipt = value } })
  assert.equal(replay.status, 'ALREADY_INSTALLED')
  assert.equal(persistedReceipt.status, 'INSTALLED')
})

test('desired-state install rejects unsafe ancestor before target or preimage write', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-desired-unsafe-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const unsafe = join(root, 'unsafe'); await mkdir(unsafe); await chmod(unsafe, 0o777)
  await mkdir(join(root, 'control')); await chmod(join(root, 'control'), 0o700)
  const targetPath = join(unsafe, 'scheduler-desired-state.json')
  assert.throws(() => installSchedulerDesiredState({
    bytes: Buffer.from('{"jobs":[]}\n'), expectedJobs: [], targetPath, candidatePath: join(root, 'control', 'candidate'), preimagePath: join(root, 'control', 'preimage'),
    expectedUid: process.getuid(), expectedGid: process.getgid(), writeReceipt: () => assert.fail('no receipt write'),
  }), /unsafe desired-state parent/)
  await assert.rejects(readFile(targetPath), /ENOENT/)
})

test('desired-state install accepts only the root-owned macOS /var system alias', { skip: process.platform !== 'darwin' }, async (t) => {
  assert.equal((await lstat('/var')).isSymbolicLink(), true)
  const root = await mkdtemp(join(tmpdir(), 'scheduler-desired-var-alias-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const targetPath = join(root, 'config', 'scheduler-desired-state.json')
  const candidatePath = join(root, 'control', 'candidate.json')
  const preimagePath = join(root, 'control', 'preimage.json')
  await mkdir(join(root, 'config'))
  await mkdir(join(root, 'control'), { mode: 0o700 })
  const bytes = Buffer.from('{"version":1,"jobs":[]}\n')
  let receipt
  const result = installSchedulerDesiredState({
    bytes, expectedJobs: [], targetPath, candidatePath, preimagePath,
    expectedUid: process.getuid(), expectedGid: process.getgid(), writeReceipt: (value) => { receipt = value },
  })
  assert.equal(result.status, 'INSTALLED')
  assert.equal(receipt.status, 'INSTALLED')
  assert.equal(await readFile(targetPath, 'utf8'), bytes.toString())
})
