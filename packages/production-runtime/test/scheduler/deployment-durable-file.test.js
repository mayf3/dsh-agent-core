import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { atomicInstallDurableFile, durableCopyPreimage, verifyAndSyncPreimage } from '../../src/scheduler/deployment-durable-file.js'

test('preimage is file-and-directory durable before candidate installation frontier', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'durable-plist-')); t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'source'), preimage = join(root, 'preimage'), target = join(root, 'target')
  writeFileSync(source, 'old'); writeFileSync(target, 'old')
  const stat = statSync(source), metadata = { uid: stat.uid, gid: stat.gid, mode: stat.mode & 0o777, acl: 'NONE', xattrs: 'NONE' }
  const stages = []
  durableCopyPreimage(source, preimage, metadata, { onStage: (stage) => stages.push(stage) })
  assert.deepEqual(stages, ['preimage-file-synced', 'preimage-renamed', 'preimage-directory-synced'])
  assert.throws(() => atomicInstallDurableFile(target, Buffer.from('new'), metadata, { crashAt: 'after-candidate-rename' }), /injected crash/)
  assert.equal(readFileSync(preimage, 'utf8'), 'old')
})

for (const crashAt of ['before-preimage-copy', 'during-preimage-copy', 'after-preimage-file-fsync']) {
  test(`preimage ${crashAt} leaves no authoritative final and retry can rebuild`, (t) => {
    const root = mkdtempSync(join(tmpdir(), 'durable-preimage-crash-')); t.after(() => rmSync(root, { recursive: true, force: true }))
    const source = join(root, 'source'), target = join(root, 'preimage'); writeFileSync(source, 'old')
    const stat = statSync(source), metadata = { uid: stat.uid, gid: stat.gid, mode: stat.mode & 0o777, acl: 'NONE', xattrs: 'NONE' }
    assert.throws(() => durableCopyPreimage(source, target, metadata, { crashAt }), /injected crash/)
    assert.throws(() => readFileSync(target), /ENOENT/)
    durableCopyPreimage(source, target, metadata)
    assert.equal(readFileSync(target, 'utf8'), 'old')
  })
}

test('crash after preimage rename is resumed by validating and syncing the complete final', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'durable-preimage-rename-')); t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'source'), target = join(root, 'preimage'); writeFileSync(source, 'old')
  const stat = statSync(source), metadata = { uid: stat.uid, gid: stat.gid, mode: stat.mode & 0o777, acl: 'NONE', xattrs: 'NONE' }
  assert.throws(() => durableCopyPreimage(source, target, metadata, { crashAt: 'after-preimage-rename' }), /injected crash/)
  assert.equal(readFileSync(target, 'utf8'), 'old')
  verifyAndSyncPreimage(source, target, metadata)
})

test('abandoned uncommitted preimage temp is removed and rebuilt', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'durable-preimage-abandoned-')); t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'source'), target = join(root, 'preimage'); writeFileSync(source, 'old'); writeFileSync(`${target}.incoming`, 'partial')
  const stat = statSync(source), metadata = { uid: stat.uid, gid: stat.gid, mode: stat.mode & 0o777, acl: 'NONE', xattrs: 'NONE' }
  const stages = []; durableCopyPreimage(source, target, metadata, { onStage: (stage) => stages.push(stage) })
  assert.equal(stages[0], 'abandoned-preimage-cleaned')
  assert.equal(readFileSync(target, 'utf8'), 'old')
})
