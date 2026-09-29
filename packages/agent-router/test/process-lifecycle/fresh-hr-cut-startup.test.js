import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  HR_CUT_OPERATION_ID, HR_CUT_OLD_HANDLE, HR_CUT_V4_SPEC_SHA256,
  buildFixedHrMountAck, readHrDurablePreimageSha256, validatePreparedHrCutBytes,
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

test('V4 oldRecordSha256 domain is exact pre-start durable-file bytes, not parsed record JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hr-cut-preimage-'))
  try {
    const file = join(dir, 'turn-recovery.json')
    const bytes = Buffer.from('{"version":3,"records":[{"handle":"old"}]}\n')
    writeFileSync(file, bytes, { mode: 0o600 })
    assert.equal(readHrDurablePreimageSha256(file),
      createHash('sha256').update(bytes).digest('hex'))
    assert.notEqual(readHrDurablePreimageSha256(file),
      createHash('sha256').update(JSON.stringify(JSON.parse(bytes))).digest('hex'))
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
