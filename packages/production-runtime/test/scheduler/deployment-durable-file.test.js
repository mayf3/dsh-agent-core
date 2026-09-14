import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { atomicInstallDurableFile, durableCopyPreimage } from '../../src/scheduler/deployment-durable-file.js'

test('preimage is file-and-directory durable before candidate installation frontier', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'durable-plist-')); t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'source'), preimage = join(root, 'preimage'), target = join(root, 'target')
  writeFileSync(source, 'old'); writeFileSync(target, 'old')
  const stat = statSync(source), metadata = { uid: stat.uid, gid: stat.gid, mode: stat.mode & 0o777 }
  const stages = []
  durableCopyPreimage(source, preimage, metadata, { onStage: (stage) => stages.push(stage) })
  assert.deepEqual(stages, ['preimage-file-synced', 'preimage-directory-synced'])
  assert.throws(() => atomicInstallDurableFile(target, Buffer.from('new'), metadata, { crashAt: 'after-candidate-rename' }), /injected crash/)
  assert.equal(readFileSync(preimage, 'utf8'), 'old')
})
