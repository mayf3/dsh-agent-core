import test from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { installSchedulerDesiredState } from '../../src/scheduler/deployment-desired-state.js'

test('desired-state install preserves exact predecessor and replay retains first receipt', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-desired-install-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const targetPath = join(root, 'config', 'scheduler-desired-state.json')
  const preimagePath = join(root, 'control', 'rollback', 'scheduler-desired-state.json.preimage')
  await mkdir(join(root, 'config')); await writeFile(targetPath, '{"version":"old"}\n', { mode: 0o640 })
  const bytes = Buffer.from('{"version":1,"jobs":[]}\n')
  let receipt
  const args = { bytes, targetPath, preimagePath, expectedUid: process.getuid(), expectedGid: process.getgid(), writeReceipt: (value) => { receipt = value } }
  assert.equal(installSchedulerDesiredState(args).status, 'INSTALLED')
  assert.equal(await readFile(targetPath, 'utf8'), bytes.toString())
  assert.equal(await readFile(preimagePath, 'utf8'), '{"version":"old"}\n')
  assert.equal(installSchedulerDesiredState({ ...args, receipt }).status, 'ALREADY_INSTALLED')
})

test('desired-state install rejects unsafe ancestor before target or preimage write', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-desired-unsafe-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await chmod(root, 0o700)
  const unsafe = join(root, 'unsafe'); await mkdir(unsafe); await chmod(unsafe, 0o777)
  const targetPath = join(unsafe, 'scheduler-desired-state.json')
  assert.throws(() => installSchedulerDesiredState({
    bytes: Buffer.from('{}\n'), targetPath, preimagePath: join(root, 'control', 'preimage'),
    expectedUid: process.getuid(), expectedGid: process.getgid(), writeReceipt: () => assert.fail('no receipt write'),
  }), /unsafe desired-state parent/)
  await assert.rejects(readFile(targetPath), /ENOENT/)
})
