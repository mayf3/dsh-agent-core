import test from 'node:test'
import assert from 'node:assert/strict'
import processBoundary from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'

test('fixed context rejects descriptorless startup before any process or Router import', async t => {
  const original = processBoundary.spawnSync, calls = []
  processBoundary.spawnSync = (...argv) => { calls.push(argv); throw new Error('TEST_PROCESS_HARD_DENY') }
  syncBuiltinESMExports()
  t.after(() => { processBoundary.spawnSync = original; syncBuiltinESMExports() })
  const context = await import('../../src/native-arm64/hr-s256-r2-startup-context.mjs')
  assert.equal(context.getFixedStartupContext(), undefined)
  await assert.rejects(context.authenticateFixedStartupContext(), /R2_INVOCATION_INVALID/)
  assert.equal(context.getFixedStartupContext(), undefined)
  assert.deepEqual(calls, [])
})

test('fixed descriptor grammar is closed and receipt IO cannot select a host path', async () => {
  const context = await import('../../src/native-arm64/hr-s256-r2-startup-context.mjs')
  const descriptors = Array.from({ length: context.FIXED_RECEIPT_NAMES.length + 4 }, (_, n) => n + 5)
  for (const index of [17, 18, 19, 20]) descriptors[index] = -1
  const args = table => ['--hr-r2-receipt-sha256', 'a'.repeat(64), '--hr-r2-challenge-fd', '3',
    '--hr-r2-window-fd', '4', '--hr-r2-receipt-fds', JSON.stringify(table), '--root', '/fixed/root']
  const parsed = context.parsedStartupInvocation(args(descriptors))
  assert.deepEqual(parsed.runtimeArgs, ['--root', '/fixed/root'])
  for (const value of [true, '5', 1.5, null, -1]) {
    const wrong = [...descriptors]; wrong[0] = value
    assert.throws(() => context.parsedStartupInvocation(args(wrong)), /R2_DESCRIPTOR_INVALID/)
  }
  const duplicate = [...descriptors]; duplicate[0] = 3
  assert.throws(() => context.parsedStartupInvocation(args(duplicate)), /R2_DESCRIPTOR_INVALID/)
  assert.throws(() => context.parsedStartupInvocation([...args(descriptors), '--hr-r2-private-path', '/unknown']), /R2_INVOCATION_INVALID/)
  const io = context.readonlyReceiptIO(parsed)
  assert.throws(() => io.stat('/Users/authsvc/.agent-core/control/turn-recovery-v3.json'), /R2_RECEIPT_PATH_INVALID/)
  assert.throws(() => io.challengeWindow(3, {}), /R2_STARTUP_PROOF_REJECTED/)
})
