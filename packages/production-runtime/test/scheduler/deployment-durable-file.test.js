import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { atomicInstallDurableFile, durableCopyPreimage, verifyAndSyncPreimage, verifyReceiptedPreimage } from '../../src/scheduler/deployment-durable-file.js'
import { verifyWatchdogReplayReceipt } from '../../src/scheduler/deployment-watchdog-replay.js'
import { clearGeneratedFileXattrs, listFileXattrs } from '../../src/scheduler/deployment-file-metadata.js'

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

test('receipted preimage binds exact path, bytes and metadata before replay', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'receipted-preimage-')); t.after(() => rmSync(root, { recursive: true, force: true }))
  const path = join(root, 'preimage'); writeFileSync(path, 'old'); chmodSync(path, 0o600)
  clearGeneratedFileXattrs(path)
  const stat = statSync(path), metadata = { uid: stat.uid, gid: stat.gid, mode: 0o600, acl: 'NONE', xattrs: 'NONE' }
  const expectedSha256 = createHash('sha256').update('old').digest('hex')
  const expectedXattrs = listFileXattrs(path)
  assert.doesNotThrow(() => verifyReceiptedPreimage({ path, expectedPath: path, expectedSha256, expectedMetadata: metadata, expectedXattrs }))
  assert.throws(() => verifyReceiptedPreimage({ path, expectedPath: `${path}-other`, expectedSha256, expectedMetadata: metadata, expectedXattrs }), /path mismatch/)
  assert.throws(() => verifyReceiptedPreimage({ path: `${path}-missing`, expectedPath: `${path}-missing`, expectedSha256, expectedMetadata: metadata, expectedXattrs }), /missing or malformed/)
  assert.throws(() => verifyReceiptedPreimage({ path, expectedPath: path, expectedSha256: '0'.repeat(64), expectedMetadata: metadata, expectedXattrs }), /generation mismatch/)
  assert.throws(() => verifyReceiptedPreimage({ path, expectedPath: path, expectedSha256, expectedMetadata: { ...metadata, mode: 0o644 }, expectedXattrs }), /generation mismatch/)
})

test('watchdog replay validates both W1/W2 rollback generations from the frozen receipt', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'watchdog-receipted-preimages-')); t.after(() => rmSync(root, { recursive: true, force: true }))
  const launchdDir = join(root, 'launchd'), artifactsDir = join(root, 'artifacts')
  mkdirSync(join(artifactsDir, 'rollback'), { recursive: true })
  const plists = ['w1', 'w2'].map((role) => {
    const label = `ai.agent-core.scheduler-watchdog-${role}`
    const path = join(launchdDir, `${label}.plist`), preimage = join(artifactsDir, 'rollback', `${label}.plist.preimage`)
    writeFileSync(preimage, `old-${role}`); clearGeneratedFileXattrs(preimage)
    const stat = statSync(preimage)
    return { role, label, path, preimage, existed: true, installedSha256: '1'.repeat(64),
      preimageSha256: createHash('sha256').update(`old-${role}`).digest('hex'),
      preimageMetadata: { uid: stat.uid, gid: stat.gid, mode: stat.mode & 0o777, acl: 'NONE', xattrs: 'NONE' }, preimageXattrs: listFileXattrs(preimage) }
  })
  const receipt = { sourceSha: 'a'.repeat(40), plists }
  assert.doesNotThrow(() => verifyWatchdogReplayReceipt(receipt, { sourceSha: receipt.sourceSha, launchdDir, artifactsDir }))
  writeFileSync(plists[0].preimage, 'drift')
  assert.throws(() => verifyWatchdogReplayReceipt(receipt, { sourceSha: receipt.sourceSha, launchdDir, artifactsDir }), /generation mismatch/)
})
