import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, copyFileSync, writeFileSync, symlinkSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { inspectNativeClosure } from '../../src/native-arm64/inventory.js'

const nativeNode = realpathSync(process.execPath)
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'arm-closure-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return root
}
function inspect(root) {
  return inspectNativeClosure([root, dirname(dirname(nativeNode))], { nodePath: nativeNode })
}
function rejected(root, code) {
  assert.throws(() => inspect(root), error => error.result?.failures.some(f => f.code === code))
}
test('actual arm64 Node and internal links pass closure inspection', () => {
  const result = inspectNativeClosure([dirname(dirname(nativeNode))], { nodePath: nativeNode })
  assert.equal(result.compatible, true)
  assert.ok(result.files.some(f => f.classification === 'ARM64_NATIVE'))
})
test('substituted x64 native bytes reject the candidate', { skip: !process.env.ARM_TEST_X64_NODE }, t => {
  const root = fixture(t)
  copyFileSync(realpathSync(process.env.ARM_TEST_X64_NODE), join(root, 'substituted.node'))
  rejected(root, 'INCOMPATIBLE_NATIVE_FILE')
})
test('mixed native tree rejects even when the selected Node is arm64', { skip: !process.env.ARM_TEST_X64_NODE }, t => {
  const root = fixture(t)
  symlinkSync(nativeNode, join(root, 'arm-node'))
  copyFileSync(realpathSync(process.env.ARM_TEST_X64_NODE), join(root, 'unselected-x64'))
  rejected(root, 'INCOMPATIBLE_NATIVE_FILE')
})
test('missing native binding and escaped closure cannot pass', t => {
  const root = fixture(t)
  symlinkSync(join(root, 'missing-binding.node'), join(root, 'binding.node'))
  rejected(root, 'BROKEN_LINK')
  rmSync(join(root, 'binding.node'))
  symlinkSync('/usr/bin/true', join(root, 'external'))
  rejected(root, 'EXTERNAL_LINK')
})
test('unknown native contents reject rather than infer architecture from name', t => {
  const root = fixture(t)
  writeFileSync(join(root, 'darwin-arm64.node'), 'not a native binding')
  rejected(root, 'UNKNOWN_NATIVE_FILE')
})
test('foreign node-pty path cannot hide unknown or unproven native contents', t => {
  const root = fixture(t)
  const directory = join(root, 'node-pty/prebuilds/linux-x64')
  mkdirSync(directory, { recursive: true })
  const binding = join(directory, 'pty.node')
  writeFileSync(binding, 'not a native binding')
  rejected(root, 'UNKNOWN_NATIVE_FILE')
  writeFileSync(binding, Buffer.from('7f454c4602010100', 'hex'))
  rejected(root, 'UNKNOWN_NATIVE_FILE')
})
