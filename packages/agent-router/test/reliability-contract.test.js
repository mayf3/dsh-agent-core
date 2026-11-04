import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  AdmissionJournal,
  AdmissionRejectionLedger,
  BindingHealthMonitor,
  SessionInjectionReceiptLog,
} from '../src/reliability-contract.js'

async function tempFile(name) {
  const dir = await mkdtemp(join(tmpdir(), 'r21-contract-'))
  return { dir, file: join(dir, name) }
}

const binding = {
  channelConversationId: 'oc_test', activeAgentId: 'agt_test', activeSessionId: 'sess_test',
}

test('restart recovery detects only stale incomplete turns and drives the same identity', async () => {
  const { dir, file } = await tempFile('journal.jsonl')
  try {
    let now = '2026-11-04T00:00:00.000Z'
    const journal = new AdmissionJournal({ file, now: () => now })
    await journal.recordAdmitted({ turnId: 'turn-old', requestId: 'req-1', sessionId: 'sess-1' })
    now = '2026-11-04T00:30:00.000Z'
    await journal.recordAdmitted({ turnId: 'turn-new', requestId: 'req-2', sessionId: 'sess-2' })
    await journal.recordCompleted({ turnId: 'turn-new', resultDigest: 'sha256:new' })
    const recovered = await journal.recover({ staleBefore: '2026-11-04T00:15:00.000Z', drive: async turn => ({ turnId: turn.turnId, requestId: turn.requestId }) })
    assert.deepEqual(recovered, [{ turnId: 'turn-old', requestId: 'req-1' }])
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('binding health probe alerts once per loss and clears after recovery', async () => {
  const alerts = []
  let healthy = false
  const monitor = new BindingHealthMonitor({
    registry: { list: () => [binding] },
    probe: async () => healthy,
    alert: async event => alerts.push(event),
    now: () => '2026-11-04T00:00:00.000Z',
  })
  await monitor.check(); await monitor.check()
  assert.equal(alerts.length, 1)
  healthy = true; await monitor.check()
  healthy = false; await monitor.check()
  assert.equal(alerts.length, 2)
})

test('admission rejection ledger preserves structured fence reasons', async () => {
  const { dir, file } = await tempFile('admission.jsonl')
  try {
    const ledger = new AdmissionRejectionLedger({ file, now: () => '2026-11-04T00:00:00.000Z' })
    const event = await ledger.record({ requestId: 'req-1', agentId: 'agt-1', fenceId: 'fence-7', code: 'FENCE_ACTIVE', detail: 'owner fence' })
    assert.equal(event.code, 'FENCE_ACTIVE')
    assert.equal((await ledger.list()).at(0).fenceId, 'fence-7')
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('journal excludes completed turns after restart', async () => {
  const { dir, file } = await tempFile('journal.jsonl')
  try {
    const journal = new AdmissionJournal({ file, now: () => '2026-11-04T00:00:00.000Z' })
    await journal.recordStarted({ turnId: 'turn-done', requestId: 'req-done', sessionId: 'sess-done' })
    await journal.recordCompleted({ turnId: 'turn-done' })
    assert.deepEqual(await journal.interrupted({ staleBefore: '2026-11-04T01:00:00.000Z' }), [])
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('journal recovery preserves request, session, and turn identity', async () => {
  const { dir, file } = await tempFile('journal.jsonl')
  try {
    const journal = new AdmissionJournal({ file, now: () => '2026-11-04T00:00:00.000Z' })
    await journal.recordStarted({ turnId: 'turn-1', requestId: 'req-1', sessionId: 'sess-1' })
    const seen = []
    await journal.recover({ staleBefore: '2026-11-04T01:00:00.000Z', drive: async turn => { seen.push(turn); return true } })
    assert.equal(seen[0].recovery, true); assert.equal(seen[0].requestId, 'req-1')
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('binding monitor reports healthy state without alert', async () => {
  let alerts = 0
  const monitor = new BindingHealthMonitor({ registry: { list: () => [binding] }, probe: async () => true, alert: async () => { alerts++ } })
  const result = await monitor.check()
  assert.equal(result[0].type, 'binding.healthy'); assert.equal(alerts, 0)
})

test('binding monitor checks every registered binding', async () => {
  const second = { ...binding, channelConversationId: 'oc_second' }
  let probes = 0
  const monitor = new BindingHealthMonitor({ registry: { list: () => [binding, second] }, probe: async () => { probes++; return true }, alert: async () => {} })
  await monitor.check(); assert.equal(probes, 2)
})

test('admission ledger rejects incomplete identity', async () => {
  const { dir, file } = await tempFile('admission.jsonl')
  try {
    const ledger = new AdmissionRejectionLedger({ file })
    await assert.rejects(() => ledger.record({ requestId: '', agentId: 'agt', code: 'FENCE_ACTIVE' }), TypeError)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('admission ledger retains optional session and null fence', async () => {
  const { dir, file } = await tempFile('admission.jsonl')
  try {
    const ledger = new AdmissionRejectionLedger({ file })
    await ledger.record({ requestId: 'r', agentId: 'a', code: 'SESSION_NOT_READY' })
    const [event] = await ledger.list(); assert.equal(event.sessionId, null); assert.equal(event.fenceId, null)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('injection receipt lookup does not accept a different message identity', async () => {
  const { dir, file } = await tempFile('receipts.jsonl')
  try {
    const log = new SessionInjectionReceiptLog({ file })
    await log.record({ requestId: 'r', messageId: 'm', agentId: 'a', sessionId: 's', status: 'INJECTED' })
    assert.equal(await log.find({ requestId: 'r', messageId: 'other' }), null)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('injection receipt requires transport and session identities', async () => {
  const { dir, file } = await tempFile('receipts.jsonl')
  try {
    const log = new SessionInjectionReceiptLog({ file })
    await assert.rejects(() => log.record({ requestId: 'r', messageId: 'm', agentId: 'a', status: 'INJECTED' }), TypeError)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('session injection receipt binds message identity to session and turn', async () => {
  const { dir, file } = await tempFile('receipts.jsonl')
  try {
    const log = new SessionInjectionReceiptLog({ file, now: () => '2026-11-04T00:00:00.000Z' })
    await log.record({ requestId: 'req-1', messageId: 'msg-1', agentId: 'agt-1', sessionId: 'sess-1', turnId: 'turn-1', status: 'INJECTED' })
    assert.deepEqual(await log.find({ requestId: 'req-1', messageId: 'msg-1' }), {
      type: 'session.injection_receipt', at: '2026-11-04T00:00:00.000Z', requestId: 'req-1', messageId: 'msg-1',
      agentId: 'agt-1', sessionId: 'sess-1', turnId: 'turn-1', status: 'INJECTED', source: 'router',
    })
    assert.match(await readFile(file, 'utf8'), /session\.injection_receipt/)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
