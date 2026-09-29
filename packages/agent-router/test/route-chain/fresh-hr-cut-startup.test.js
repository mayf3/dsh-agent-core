import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  HR_CUT_OPERATION_ID, HR_CUT_OLD_HANDLE, HR_CUT_V4_SPEC_SHA256,
  buildFixedHrMountAck, hrOldRecordSha256, joinLiveHrCutContext,
  mountFixedHrCut, readHrDurableFileSha256, readFixedPreparedHrCut,
  validatePreparedHrCutBytes,
} from '../../src/fresh-hr-cut-startup.js'

const SHA = value => value.repeat(64)
const NEW_EPOCH = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const NEW_SESSION = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
function receipt(overrides = {}) {
  return {
    schema: 'HR_FRESH_LINEAGE_CUT_RECEIPT_V1', phase: 'PREPARED_CUT',
    cutOperationId: HR_CUT_OPERATION_ID, hostId: 'test-host',
    authoritySha256: HR_CUT_V4_SPEC_SHA256, producerSha256: SHA('a'),
    consumerSha256: SHA('b'), oldAgentId: 'agt_hr-agent',
    oldTurnHandle: HR_CUT_OLD_HANDLE, oldRuntimeEpoch: 'old-epoch',
    oldProcessGeneration: 1, oldSessionId: 'old-session',
    oldRecordSha256: SHA('c'), oldFenceRetained: true,
    newRuntimeEpoch: NEW_EPOCH, newSessionId: NEW_SESSION,
    issuanceFloor: 1, sourceProofSha256: SHA('d'),
    localCutProofSha256: SHA('e'), preimageSha256: SHA('f'),
    rollbackSha256: SHA('1'),
    windowId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    nonce: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    sequence: 1, committedAtMs: 1_000,
    ...overrides,
  }
}
const validate = object => validatePreparedHrCutBytes(Buffer.from(JSON.stringify(object)),
  { hostId: 'test-host', consumerSha256: SHA('b') })

test('V4 fixed PREPARED projection maps only bounded root facts into the Router cut', () => {
  const projected = validate(receipt())
  assert.equal(projected.receipt.cutOperationId, HR_CUT_OPERATION_ID)
  assert.equal(projected.cut.operationId, HR_CUT_OPERATION_ID)
  assert.equal(projected.cut.oldHandle, HR_CUT_OLD_HANDLE)
  assert.equal(projected.cut.oldSessionId, 'old-session')
  assert.equal(projected.cut.newRuntimeEpoch, NEW_EPOCH)
  assert.equal(projected.cut.rootReceiptSha256.length, 64)
})

test('a stale static PREPARED projection without live DS startup context is inert', () => {
  assert.equal(readFixedPreparedHrCut(), null)
  const prepared = validate(receipt())
  const context = {
    operationId: HR_CUT_OPERATION_ID,
    preparedReceiptSha256: prepared.receiptSha256,
    nonce: prepared.receipt.nonce, windowId: prepared.receipt.windowId,
    newRuntimeEpoch: NEW_EPOCH, newSessionId: NEW_SESSION,
    assertLive: () => false, awaitComplete: async () => null,
  }
  assert.throws(() => joinLiveHrCutContext(prepared, context), /live trusted startup/)
  context.assertLive = () => true
  assert.equal(joinLiveHrCutContext(prepared, context), prepared)
  assert.throws(() => joinLiveHrCutContext(prepared,
    { ...context, preparedReceiptSha256: SHA('0') }), /live trusted startup/)
})

test('V4 projection rejects wrong operation, host, consumer, old identity, partial proof or schema extension', () => {
  for (const bad of [
    { cutOperationId: 'another-cut' }, { hostId: 'another-host' },
    { consumerSha256: SHA('0') }, { oldTurnHandle: 'another-handle' },
    { oldFenceRetained: false }, { sourceProofSha256: '' },
    { localCutProofSha256: '' }, { newRuntimeEpoch: 'old-epoch' },
    { newSessionId: 'old-session' }, { issuanceFloor: 0 },
    { sequence: 2 }, { nonce: 'caller-given' },
    { extraField: 'untrusted' },
  ]) assert.throws(() => validate(receipt(bad)))
  assert.throws(() => validatePreparedHrCutBytes(Buffer.alloc(4097)), /bounded bytes/)
})

test('V4 oldRecordSha256 matches decoded exact old subject, while raw file digest only guards drift', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hr-cut-preimage-'))
  try {
    const file = join(dir, 'turn-recovery.json')
    const record = { handle: HR_CUT_OLD_HANDLE, sessionId: 'old', state: 'pending' }
    const bytes = Buffer.from(`${JSON.stringify({ version: 3, records: [record] })}\n`)
    writeFileSync(file, bytes, { mode: 0o600 })
    assert.equal(hrOldRecordSha256(record),
      createHash('sha256').update(JSON.stringify(record)).digest('hex'))
    assert.equal(readHrDurableFileSha256(file), createHash('sha256').update(bytes).digest('hex'))
    assert.notEqual(hrOldRecordSha256(record), readHrDurableFileSha256(file))
    assert.throws(() => hrOldRecordSha256({ ...record, handle: 'other' }))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('mount ACK binds actual READY child generation but does not self-attest authentication', () => {
  const prepared = validate(receipt())
  const binding = {
    operationId: HR_CUT_OPERATION_ID, channelConversationId: 'feishu:oc_hr',
    newRuntimeEpoch: NEW_EPOCH, newSessionId: NEW_SESSION,
    bindingCutSha256: SHA('2'),
  }
  const store = {
    runtimeEpoch: NEW_EPOCH, freshHrLineage: prepared.cut,
    activeFenceForAgent: () => ({ handle: HR_CUT_OLD_HANDLE }),
  }
  const child = { pid: 2222 }
  const proc = { agentId: 'agt_hr-agent', state: 'READY', pid: 2222,
    processGeneration: 2, child, ownership: { childObject: child, pid: 2222 },
    exit: undefined }
  const ack = buildFixedHrMountAck(prepared, binding, store, proc,
    { runtimePid: 1111, nowMs: 12345, runtimeStartAtMs: 10000 })
  assert.equal(ack.receiptSha256, prepared.receiptSha256)
  assert.equal(ack.processGeneration, 2)
  assert.equal(ack.childPid, 2222)
  assert.equal(ack.runtimePid, 1111)
  assert.equal(ack.oldAgentId, 'agt_hr-agent')
  assert.equal(ack.newSessionId, NEW_SESSION)
  assert.equal(ack.authenticated, undefined, 'Router must not self-certify root verification')
  assert.throws(() => buildFixedHrMountAck(prepared, binding, store,
    { ...proc, processGeneration: 1 }, { runtimePid: 1111, nowMs: 12345,
      runtimeStartAtMs: 10000 }))
  assert.throws(() => buildFixedHrMountAck(prepared, binding, store,
    { ...proc, state: 'EXITED' }, { runtimePid: 1111, nowMs: 12345,
      runtimeStartAtMs: 10000 }))
  assert.throws(() => buildFixedHrMountAck(prepared, binding, store,
    { ...proc, ownership: { childObject: {}, pid: 2222 } },
    { runtimePid: 1111, nowMs: 12345, runtimeStartAtMs: 10000 }))
})

test('live startup prepares Binding and child but cannot open HR before root COMPLETE', async () => {
  const prepared = validate(receipt())
  const calls = []
  let settle
  const rootComplete = new Promise((resolve, reject) => { settle = { resolve, reject } })
  const context = {
    operationId: HR_CUT_OPERATION_ID,
    preparedReceiptSha256: prepared.receiptSha256,
    nonce: prepared.receipt.nonce, windowId: prepared.receipt.windowId,
    newRuntimeEpoch: NEW_EPOCH, newSessionId: NEW_SESSION,
    assertLive: () => true,
    awaitComplete: async digest => { calls.push(['awaitComplete', digest]); return rootComplete },
  }
  const store = {
    validateTrustedFreshHrLineage: () => calls.push('validate'),
    activateTrustedFreshHrLineage: () => calls.push('activate'),
    issueFreshHrStartupToken: () => { calls.push('startupToken'); return 'startup-token' },
    completeTrustedFreshHrMount: () => calls.push('admitted'),
  }
  const binding = { commitFreshHrBindingCut: async () => {
    calls.push('bindingCut')
    return { operationId: HR_CUT_OPERATION_ID }
  } }
  const registry = { ensureRunning: async (agentId, token) => {
    assert.equal(agentId, 'agt_hr-agent')
    assert.equal(token, 'startup-token')
    calls.push('childReady')
    return { processGeneration: 2, pid: 2222 }
  } }
  const writeAck = () => { calls.push('ackPersisted'); return { acknowledgementSha256: SHA('a') } }
  const pending = mountFixedHrCut({ prepared, context, reconciliationStore: store,
    bindingStore: binding, registry, writeAck })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls.includes('admitted'), false)
  assert.deepEqual(calls.at(-1), ['awaitComplete', SHA('a')])
  settle.reject(new Error('owned window lost'))
  await assert.rejects(pending, /owned window lost/)
  assert.equal(calls.includes('admitted'), false)

  const allowed = mountFixedHrCut({ prepared,
    context: { ...context, awaitComplete: async () => ({ disposition: 'COMPLETE',
      cutOperationId: HR_CUT_OPERATION_ID,
      preparedReceiptSha256: prepared.receiptSha256, oldFenceRetained: true }) },
    reconciliationStore: store, bindingStore: binding, registry, writeAck })
  await allowed
  assert.equal(calls.at(-1), 'admitted')
})
