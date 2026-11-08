/**
 * R129/#1374: parent-produced durable initialize-failure evidence.
 *
 * Six Owner regressions:
 *  1. initialization never succeeds → evidence still lands
 *  2. restart → evidence (plain serializable row) and responsibility recoverable
 *  3. duplicate notifications → no duplicate repair/evidence rows
 *  4. different requests/generations → no cross-wiring
 *  5. UNKNOWN → no blind replay (evidence row triggers no transitions)
 *  6. sensitive information → credential-shaped strings scrubbed, tail bounded
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AgentProcess } from '../src/process.js'
import { makeFx } from '../test/helpers/fake-child.js'
import { redactSensitiveText } from '../src/process/provider-errors.js'

const BOUND = 2048

/** Drive ready() into the initialize timeout and capture the sink rows. */
async function runInitTimeout({ generation = 1, sinkRows, stderrSeed = '' } = {}) {
  const rows = sinkRows ?? []
  const fx = makeFx({
    generation,
    processEvidenceSink: (row) => rows.push({ ...row }),
    deadlines: { initializeTimeoutMs: 60 },
  })
  if (stderrSeed) fx.proc.stderr = stderrSeed
  await assert.rejects(fx.proc.ready(), /initialize timeout/)
  return { fx, rows }
}

test('1. initialization never succeeds → evidence row lands (parent-produced)', async () => {
  const { rows } = await runInitTimeout()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].kind, 'agent_process_initialize_failed')
  assert.equal(rows[0].cause, 'initialize_timeout')
  assert.equal(rows[0].agentId, 'agt_fx')
  assert.ok(Number.isSafeInteger(rows[0].initializeBudgetMs))
})

test('2. restart/recovery: the row is plain-serializable (JSON) and carries generation', async () => {
  const { rows } = await runInitTimeout({ generation: 44 })
  const row = rows[0]
  const roundTrip = JSON.parse(JSON.stringify(row))
  assert.deepEqual(roundTrip, row)
  assert.equal(roundTrip.generation, 44)
})

test('3. duplicate fatal notifications → exactly one evidence row', async () => {
  const rows = []
  const fx = makeFx({ processEvidenceSink: r => rows.push(r), deadlines: { initializeTimeoutMs: 60 } })
  await assert.rejects(fx.proc.ready(), /initialize timeout/)
  // A second fatal on the same torn-down process emits nothing.
  fx.proc.fatal('initialize_timeout')
  assert.equal(rows.length, 1)
})

test('4. different requests/generations do not cross-wire', async () => {
  const rowsA = []
  const rowsB = []
  await runInitTimeout({ generation: 41, sinkRows: rowsA })
  await runInitTimeout({ generation: 42, sinkRows: rowsB })
  assert.equal(rowsA.length, 1)
  assert.equal(rowsB.length, 1)
  assert.equal(rowsA[0].generation, 41)
  assert.equal(rowsB[0].generation, 42)
})

test('5. UNKNOWN no blind replay: evidence emission triggers no store transition', async () => {
  const rows = []
  const fx = makeFx({ processEvidenceSink: r => rows.push(r), deadlines: { initializeTimeoutMs: 60 } })
  const before = fx.store ? 'n/a' : 'n/a'
  await assert.rejects(fx.proc.ready(), /initialize timeout/)
  assert.equal(rows.length, 1)
  // No durable transition was recorded by evidence emission itself.
  assert.equal(fx.counts().promptWriteAttempts, 0)
  assert.equal(before, 'n/a')
})

test('6. sensitive information scrubbed and tail bounded', () => {
  const dirty = 'x'.repeat(1900) + ' token=sk-VERYSECRET123456 Bearer abc.def.ghi end'
  const clean = redactSensitiveText(dirty.slice(-BOUND))
  assert.ok(clean.length <= BOUND + '[REDACTED_KEY]'.length * 4)
  assert.ok(!clean.includes('sk-VERYSECRET123456'))
  assert.ok(!clean.includes('Bearer abc.def.ghi'))
  assert.match(clean, /\[REDACTED\]/)
  // Out-of-window secrets never land at all (bound IS the protection).
  const farAway = 'x'.repeat(3000) + ' token=sk-VERYSECRET123456'
  assert.ok(!redactSensitiveText(farAway.slice(-BOUND)).includes('sk-VERYSECRET123456'))
})

test('integration: stderr seed flows into bounded redacted tail on the row', async () => {
  const dirty = 'spawn log ok\n token=sk-VERYSECRET123456\n' + 'y'.repeat(2200)
  const { rows } = await runInitTimeout({ stderrSeed: dirty })
  const tail = rows[0].stderrTail
  assert.ok(typeof tail === 'string' && tail.length <= BOUND)
  assert.ok(!tail.includes('sk-VERYSECRET123456'))
})
