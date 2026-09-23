// T67 r2 zero-model regression (DAY_DSH_SCOUT_QUEUE_RECONCILIATION_20260920_V1):
// the shutdown result surface is TRUTHFUL — pre-r2 the entry script caught
// runtime.stop() failures and still wrote evidence kind 'stopped' +
// 'stopped cleanly' + exit(0).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyShutdownResult, shutdownResultFor } from '../src/shutdown-result.js'

test('T67-r2: stop failure => stop_failed evidence + exit 1 (never clean)', () => {
  const result = shutdownResultFor(new Error('disposer threw'))
  assert.equal(result.evidenceKind, 'stop_failed')
  assert.equal(result.exitCode, 1)
  assert.match(result.summary, /stop failure/)
})

test('T67-r2: clean stop => stopped evidence + exit 0 (unchanged)', () => {
  const result = shutdownResultFor(undefined)
  assert.equal(result.evidenceKind, 'stopped')
  assert.equal(result.exitCode, 0)
  assert.equal(result.summary, 'stopped cleanly')
})

test('T67-r2 entry integration: applyShutdownResult drives evidence/log/exit truthfully', () => {
  const events = []
  const writeEvidence = (e) => events.push({ surface: 'evidence', kind: e.kind })
  const log = { log: (m) => events.push({ surface: 'log', message: m }) }
  const processLike = { pid: 4242, exit: (code) => events.push({ surface: 'exit', code }) }

  applyShutdownResult({ writeEvidence, log, processLike, signal: 'SIGTERM', stopError: new Error('boom') })
  assert.deepEqual(events, [
    { surface: 'evidence', kind: 'stop_failed' },
    { surface: 'log', message: 'exited with stop failure' },
    { surface: 'exit', code: 1 },
  ])

  events.length = 0
  applyShutdownResult({ writeEvidence, log, processLike, signal: 'SIGINT', stopError: undefined })
  assert.deepEqual(events, [
    { surface: 'evidence', kind: 'stopped' },
    { surface: 'log', message: 'stopped cleanly' },
    { surface: 'exit', code: 0 },
  ])
})
