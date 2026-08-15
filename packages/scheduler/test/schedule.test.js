import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeNextRunAtMs, computePreviousRunAtMs, parseAtToMs, parseDurationMs, parseAbsoluteTimeMs, resolveCronStaggerMs } from '../src/schedule.js'

const SH = (s) => new Date(`2026-08-15T${s}Z`).getTime()

test('cron: next run with explicit timezone', () => {
  const next = computeNextRunAtMs({ kind: 'cron', expr: '0 9 * * *', tz: 'Asia/Shanghai' }, SH('00:00:00'))
  // 09:00 Asia/Shanghai = 01:00 UTC
  assert.equal(next, SH('01:00:00'))
})

test('cron: occurrence exactly at now is not re-returned (same-second guard)', () => {
  // now == 01:00:00Z, which IS the 09:00 Asia/Shanghai occurrence -> next is tomorrow
  const next = computeNextRunAtMs({ kind: 'cron', expr: '0 9 * * *', tz: 'Asia/Shanghai' }, SH('01:00:00'))
  assert.equal(next, SH('01:00:00') + 86_400_000)
  const at = computeNextRunAtMs({ kind: 'cron', expr: '*/5 * * * *' }, SH('00:00:00'))
  assert.equal(at, SH('00:05:00'))
})

test('cron: previous run (missed-run catch-up basis)', () => {
  const prev = computePreviousRunAtMs({ kind: 'cron', expr: '0 9 * * *', tz: 'Asia/Shanghai' }, SH('03:00:00'))
  assert.equal(prev, SH('01:00:00'))
})

test('cron: top-of-hour expression gets the 300s default stagger', () => {
  assert.equal(resolveCronStaggerMs({ kind: 'cron', expr: '0 */3 * * *' }), 300_000)
  assert.equal(resolveCronStaggerMs({ kind: 'cron', expr: '0 9 * * *' }), 0)
  assert.equal(resolveCronStaggerMs({ kind: 'cron', expr: '0 */3 * * *', staggerMs: 600_000 }), 600_000)
})

test('cron: staggered next run is a stable per-job offset inside the window', () => {
  const jobA = computeNextRunAtMs({ kind: 'cron', expr: '0 */3 * * *', tz: 'Asia/Shanghai' }, SH('00:00:00'), { jobId: 'aaaa' })
  const jobB = computeNextRunAtMs({ kind: 'cron', expr: '0 */3 * * *', tz: 'Asia/Shanghai' }, SH('00:00:00'), { jobId: 'bbbb' })
  // staggerMs: 1 forces a zero offset (window <= 1ms) -> the un-staggered base
  const base = computeNextRunAtMs({ kind: 'cron', expr: '0 */3 * * *', tz: 'Asia/Shanghai', staggerMs: 1 }, SH('00:00:00'))
  assert.ok(jobA >= base && jobA < base + 300_000)
  assert.ok(jobB >= base && jobB < base + 300_000)
  assert.equal(jobA, computeNextRunAtMs({ kind: 'cron', expr: '0 */3 * * *', tz: 'Asia/Shanghai' }, SH('00:00:00'), { jobId: 'aaaa' }))
})

test('at: absolute ISO instant', () => {
  const t = '2026-08-16T02:00:00.000Z'
  assert.equal(computeNextRunAtMs({ kind: 'at', at: t }, SH('00:00:00')), Date.parse(t))
  // now after the instant -> no next run
  assert.equal(computeNextRunAtMs({ kind: 'at', at: t }, Date.parse('2026-08-16T03:00:00Z')), undefined)
})

test('at: parse absolute + relative durations', () => {
  assert.equal(parseAbsoluteTimeMs('2026-08-16T02:00:00Z'), Date.parse('2026-08-16T02:00:00Z'))
  assert.equal(parseAbsoluteTimeMs('2026-08-16'), Date.parse('2026-08-16T00:00:00Z'))
  assert.equal(parseDurationMs('15m'), 15 * 60_000)
  assert.equal(parseDurationMs('1h'), 3_600_000)
  assert.equal(parseDurationMs('90s'), 90_000)
  assert.equal(parseAtToMs('15m', 1_000_000), 1_000_000 + 15 * 60_000)
  assert.equal(parseAtToMs('2026-08-16T02:00:00Z', 0), Date.parse('2026-08-16T02:00:00Z'))
  assert.equal(parseAtToMs('garbage', 0), null)
})

test('every: anchored fixed-rate next run', () => {
  const sched = { kind: 'every', everyMs: 86_400_000, anchorMs: SH('00:00:00') }
  assert.equal(computeNextRunAtMs(sched, SH('00:00:00')), SH('00:00:00') + 86_400_000)
  assert.equal(computeNextRunAtMs(sched, SH('12:00:00')), SH('00:00:00') + 86_400_000)
  assert.equal(computeNextRunAtMs(sched, SH('23:59:59')), SH('00:00:00') + 86_400_000)
  assert.equal(computeNextRunAtMs(sched, SH('00:00:00') + 86_400_000 + 1), SH('00:00:00') + 2 * 86_400_000)
})

test('every: future anchor returns the anchor itself', () => {
  const sched = { kind: 'every', everyMs: 3_600_000, anchorMs: SH('05:00:00') }
  assert.equal(computeNextRunAtMs(sched, SH('00:00:00')), SH('05:00:00'))
})
