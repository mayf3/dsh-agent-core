import { createHash } from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import { chmod, lstat, mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { installSchedulerRoutingManifest } from '../../src/scheduler/deployment-routing.js'

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')

test('routing deployment freezes explicit candidate and atomically preserves the exact preimage', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'scheduler-routing-deploy-'))
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
  await writeFile(targetPath, prior, { mode: 0o640 })
  const args = {
    candidatePath, expectedSha256: sha(candidate), targetPath, artifactsDir,
    jobs: [{ id: 'job-a', agentId: 'agent-a', logicalKey: 'daily', enabled: true }],
    expectedUid: process.getuid(), expectedGid: process.getgid(), mode: 'apply',
  }
  const result = installSchedulerRoutingManifest(args)
  assert.equal(result.candidateSha256, sha(candidate))
  assert.equal(result.preimageSha256, sha(prior))
  assert.deepEqual(await readFile(targetPath), candidate)
  assert.deepEqual(await readFile(join(artifactsDir, 'rollback', 'scheduler-routing.json.preimage')), prior)
  const metadata = await stat(targetPath)
  assert.equal(metadata.mode & 0o777, 0o640)
  const replay = installSchedulerRoutingManifest(args)
  assert.equal(replay.status, 'ALREADY_INSTALLED')
  assert.equal(replay.preimageSha256, sha(prior), 'rerun retains the original predecessor generation')
  assert.throws(() => installSchedulerRoutingManifest({ ...args, expectedSha256: '0'.repeat(64), mode: 'plan' }), /generation mismatch/)
})

test('routing deployment rejects missing canonical ops target before any write', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'scheduler-routing-invalid-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const candidatePath = join(root, 'candidate.json')
  const bytes = Buffer.from(`${JSON.stringify({ version: 1, canonicalOpsTarget: null, ownerTargets: {}, jobFailureTargets: {} })}\n`)
  await writeFile(candidatePath, bytes, { mode: 0o600 })
  assert.throws(() => installSchedulerRoutingManifest({
    candidatePath, expectedSha256: sha(bytes), targetPath: join(root, 'target.json'), artifactsDir: join(root, 'artifacts'),
    jobs: [], expectedUid: process.getuid(), expectedGid: process.getgid(), mode: 'plan',
  }), /canonicalOpsTarget/)
})

test('routing deployment rejects a target symlink before reading or replacing it', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'scheduler-routing-symlink-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const candidatePath = join(root, 'candidate.json')
  const victimPath = join(root, 'victim.json')
  const targetPath = join(root, 'target.json')
  const bytes = Buffer.from(`${JSON.stringify({ version: 1, canonicalOpsTarget: { channel: 'feishu', to: 'ops' }, ownerTargets: {}, jobFailureTargets: {} })}\n`)
  await writeFile(candidatePath, bytes, { mode: 0o600 })
  await writeFile(victimPath, 'do-not-read-or-replace\n', { mode: 0o640 })
  await symlink(victimPath, targetPath)
  assert.throws(() => installSchedulerRoutingManifest({
    candidatePath, expectedSha256: sha(bytes), targetPath, artifactsDir: join(root, 'artifacts'), jobs: [],
    expectedUid: process.getuid(), expectedGid: process.getgid(), mode: 'apply',
  }), /unsafe protected path metadata/)
  assert.equal((await lstat(targetPath)).isSymbolicLink(), true)
  assert.equal((await readFile(victimPath, 'utf8')), 'do-not-read-or-replace\n')
})
