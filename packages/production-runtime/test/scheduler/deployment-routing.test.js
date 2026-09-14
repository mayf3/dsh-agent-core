import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import assert from 'node:assert/strict'
import { chmod, lstat, mkdtemp, mkdir, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { installSchedulerRoutingManifest } from '../../src/scheduler/deployment-routing.js'

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const plain = (path) => { if (process.platform === 'darwin') execFileSync('/usr/bin/xattr', ['-c', path]) }

test('routing deployment freezes explicit candidate and atomically preserves the exact preimage', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-routing-deploy-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const candidatePath = join(root, 'candidate.json')
  const targetPath = join(root, 'config', 'scheduler-routing.json')
  const artifactsDir = join(root, 'artifacts')
  await mkdir(join(root, 'config'))
  const prior = Buffer.from('{"version":"old"}\n')
  const candidate = Buffer.from(`${JSON.stringify({
    version: 1, canonicalOpsTarget: { channel: 'feishu', to: 'ops-exact' },
    ownerTargets: {}, jobFailureTargets: {},
  })}\n`)
  await writeFile(candidatePath, candidate, { mode: 0o600 })
  await writeFile(targetPath, prior, { mode: 0o600 })
  plain(candidatePath); plain(targetPath)
  const args = {
    candidatePath, expectedSha256: sha(candidate), targetPath, artifactsDir,
    jobs: [{ id: 'job-a', agentId: 'agent-a', logicalKey: 'daily', enabled: true }],
    expectedUid: process.getuid(), expectedGid: process.getgid(), targetBoundary: '/', mode: 'apply',
  }
  const result = installSchedulerRoutingManifest(args)
  assert.equal(result.candidateSha256, sha(candidate))
  assert.equal(result.preimageSha256, sha(prior))
  assert.deepEqual(await readFile(targetPath), candidate)
  assert.deepEqual(await readFile(join(artifactsDir, 'rollback', 'scheduler-routing.json.preimage')), prior)
  assert.equal(result.preimageMetadata.mode, 0o600)
  const metadata = await stat(targetPath)
  assert.equal(metadata.mode & 0o777, 0o640)
  const replay = installSchedulerRoutingManifest(args)
  assert.equal(replay.status, 'ALREADY_INSTALLED')
  assert.equal(replay.preimageSha256, sha(prior), 'rerun retains the original predecessor generation')
  assert.throws(() => installSchedulerRoutingManifest({ ...args, expectedSha256: '0'.repeat(64), mode: 'plan' }), /generation mismatch/)
})

test('routing deployment rejects missing canonical ops target before any write', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-routing-invalid-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  const candidatePath = join(root, 'candidate.json')
  const bytes = Buffer.from(`${JSON.stringify({ version: 1, canonicalOpsTarget: null, ownerTargets: {}, jobFailureTargets: {} })}\n`)
  await writeFile(candidatePath, bytes, { mode: 0o600 })
  plain(candidatePath)
  assert.throws(() => installSchedulerRoutingManifest({
    candidatePath, expectedSha256: sha(bytes), targetPath: join(root, 'target.json'), artifactsDir: join(root, 'artifacts'),
    jobs: [], expectedUid: process.getuid(), expectedGid: process.getgid(), targetBoundary: '/', mode: 'plan',
  }), /canonicalOpsTarget/)
})

test('routing deployment rejects a target symlink before reading or replacing it', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-routing-symlink-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const candidatePath = join(root, 'candidate.json')
  const victimPath = join(root, 'victim.json')
  const targetPath = join(root, 'target.json')
  const bytes = Buffer.from(`${JSON.stringify({ version: 1, canonicalOpsTarget: { channel: 'feishu', to: 'ops' }, ownerTargets: {}, jobFailureTargets: {} })}\n`)
  await writeFile(candidatePath, bytes, { mode: 0o600 })
  plain(candidatePath)
  await writeFile(victimPath, 'do-not-read-or-replace\n', { mode: 0o640 })
  await symlink(victimPath, targetPath)
  assert.throws(() => installSchedulerRoutingManifest({
    candidatePath, expectedSha256: sha(bytes), targetPath, artifactsDir: join(root, 'artifacts'), jobs: [],
    expectedUid: process.getuid(), expectedGid: process.getgid(), targetBoundary: '/', mode: 'apply',
  }), /unsafe protected path metadata/)
  assert.equal((await lstat(targetPath)).isSymbolicLink(), true)
  assert.equal((await readFile(victimPath, 'utf8')), 'do-not-read-or-replace\n')
})

test('routing deployment rejects a symlink parent before creating an absent target', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-routing-parent-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const candidatePath = join(root, 'candidate.json')
  const realDir = join(root, 'real'), linkedDir = join(root, 'linked')
  await mkdir(realDir); await symlink(realDir, linkedDir)
  const targetPath = join(linkedDir, 'scheduler-routing.json')
  const bytes = Buffer.from('{"version":1,"canonicalOpsTarget":{"channel":"feishu","to":"ops"},"ownerTargets":{},"jobFailureTargets":{}}\n')
  await writeFile(candidatePath, bytes, { mode: 0o600 })
  plain(candidatePath)
  assert.throws(() => installSchedulerRoutingManifest({
    candidatePath, expectedSha256: sha(bytes), targetPath, targetBoundary: '/',
    artifactsDir: join(root, 'artifacts'), jobs: [], expectedUid: process.getuid(), expectedGid: process.getgid(), mode: 'apply',
  }), /unsafe routing target parent chain/)
  assert.equal(await readFile(join(realDir, 'scheduler-routing.json')).catch((error) => error.code), 'ENOENT')
})

test('routing deployment rejects an unsafe grandparent before creating an absent target', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-routing-grandparent-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const candidatePath = join(root, 'candidate.json')
  const unsafe = join(root, 'unsafe'), privateParent = join(unsafe, 'private')
  await mkdir(privateParent, { recursive: true }); await chmod(unsafe, 0o777); await chmod(privateParent, 0o700)
  const targetPath = join(privateParent, 'scheduler-routing.json')
  const bytes = Buffer.from('{"version":1,"canonicalOpsTarget":{"channel":"feishu","to":"ops"},"ownerTargets":{},"jobFailureTargets":{}}\n')
  await writeFile(candidatePath, bytes, { mode: 0o600 })
  plain(candidatePath)
  assert.throws(() => installSchedulerRoutingManifest({
    candidatePath, expectedSha256: sha(bytes), targetPath, targetBoundary: '/',
    artifactsDir: join(root, 'artifacts'), jobs: [], expectedUid: process.getuid(), expectedGid: process.getgid(), mode: 'apply',
  }), /unsafe routing target parent chain/)
  assert.equal(await readFile(targetPath).catch((error) => error.code), 'ENOENT')
})
