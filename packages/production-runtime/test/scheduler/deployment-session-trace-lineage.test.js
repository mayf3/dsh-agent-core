import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'

const repo = join(dirname(new URL(import.meta.url).pathname), '../../../..')
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim()

test('watchdog deployment source retains the accepted Session Trace lineage in its overlay', () => {
  const sessionMerge = '49a5d42c053401036550aac84d2427a61832a457'
  const watchdogOverlayBase = '68008e83142bdb637c4fa61c2a65db73c64b2eb1'
  assert.doesNotThrow(() => git('merge-base', '--is-ancestor', sessionMerge, 'HEAD'))
  const overlayPaths = new Set(git('diff', '--name-only', watchdogOverlayBase, 'HEAD', '--', 'packages/', 'scripts/').split('\n'))
  for (const path of [
    'packages/production-runtime/src/agent-session/turn-inspection.js',
    'packages/production-runtime/src/agent-session/projection-redaction.js',
    'packages/broker/src/capabilities/agent-session-reconcile.js',
  ]) {
    assert.equal(git('rev-parse', `${sessionMerge}:${path}`), git('rev-parse', `HEAD:${path}`), `Session Trace bytes changed: ${path}`)
    assert.equal(git('rev-parse', `${watchdogOverlayBase}:${path}`), git('rev-parse', `HEAD:${path}`), `overlay base lacks Session Trace bytes: ${path}`)
    assert.equal(overlayPaths.has(path), false, `Watchdog overlay unexpectedly rewrites Session Trace path: ${path}`)
  }
})
