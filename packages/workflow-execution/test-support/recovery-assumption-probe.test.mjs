import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { createInterface } from 'node:readline'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const entry = fileURLToPath(new URL('./recovery-assumption-probe.mjs', import.meta.url))

function check(code, ...args) {
  const execution = spawnSync(process.execPath, [entry, ...args], { encoding: 'utf-8', timeout: 20000 })
  assert.ifError(execution.error)
  assert.equal(execution.status, code, execution.stdout)
  assert.equal(execution.stderr, '')
  return JSON.parse(execution.stdout)
}

test('isolated writer SIGKILL leaves the same delivery fence for a fresh reader', () => {
  const { result, evidence } = check(0, 'ledger')
  assert.equal(result, 'PASS')
  assert.ok(evidence.same_attempt && evidence.writer_sigkill_observed && evidence.separate_reader)
  assert.ok(evidence.delivery_fence_replayed && evidence.identical_native_bytes)
  assert.match(evidence.native_ledger_sha256, /^[a-f0-9]{64}$/)
})

test('fresh child reports the three selected loader byte digests and actual Node release', () => {
  const { result, evidence } = check(0, 'runtime')
  assert.equal(result, 'PASS')
  assert.equal(evidence.loaded_source_count, 3)
  assert.ok(evidence.exact_loaded_sources && evidence.exact_node_version && evidence.separate_process)
})

test('a single isolated Router serves the same receipt after a real HTTP 503', { timeout: 12000 }, async t => {
  const child = spawn(process.execPath, [entry, 'router-fixture'], {
    stdio: ['pipe', 'pipe', 'ignore'], signal: t.signal,
  })
  const closed = once(child, 'exit')
  const receiver = createInterface({ input: child.stdout })
  const lines = receiver[Symbol.asyncIterator]()
  try {
    const { port } = JSON.parse((await lines.next()).value)
    const before = check(0, 'router', String(port))
    child.stdin.write('unavailable\n')
    assert.deepEqual(JSON.parse((await lines.next()).value), { available: false })
    assert.deepEqual(check(1, 'router', String(port)), {
      result: 'FAIL', evidence: { http_status: 503, receipt_observed: false },
    })
    child.stdin.write('ready\n')
    assert.deepEqual(JSON.parse((await lines.next()).value), { available: true })
    assert.deepEqual(check(0, 'router', String(port)), before)
  } finally {
    receiver.close()
    child.stdin.end('stop\n')
    assert.deepEqual(await closed, [0, null])
  }
  assert.deepEqual(check(2, 'router', '0'), { result: 'UNKNOWN', evidence: { observation_available: false } })
})
