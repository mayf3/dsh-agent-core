import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { createConnection, createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { mountFixedHrCut } from '../../../agent-router/src/fresh-hr-cut-startup.js'

import {
  HR_FRESH_LINEAGE_STARTUP_SOCKET,
  acceptFixedHrStartupChallenge,
  fixedHrFrameChannel,
  fixedHrNonceFromSecret,
} from '../../src/native-arm64/hr-fresh-lineage-startup-context.mjs'

const OPERATION = 'hr-fresh-lineage-cut-20260929-0d8235e7'
const SECRET = 'ab'.repeat(32)
const RECEIPT_SHA = 'c'.repeat(64)
const ACK_SHA = 'd'.repeat(64)
const WINDOW = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
const expected = () => ({
  preparedReceiptSha256: RECEIPT_SHA,
  receipt: {
    cutOperationId: OPERATION,
    windowId: WINDOW,
    nonce: fixedHrNonceFromSecret(SECRET),
    newRuntimeEpoch: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    newSessionId: '11111111-1111-1111-1111-111111111111',
  },
})
const challenge = (overrides = {}) => ({
  schema: 'HR_FRESH_LINEAGE_STARTUP_CHALLENGE_V1',
  cutOperationId: OPERATION,
  preparedReceiptSha256: RECEIPT_SHA,
  windowId: WINDOW,
  secret: SECRET,
  ...overrides,
})

test('fixed startup transport and nonce commitment match the one DS operation', () => {
  assert.equal(HR_FRESH_LINEAGE_STARTUP_SOCKET,
    '/Users/authsvc/.agent-core/control/hr-fresh-lineage-start-20260929-0d8235e7.sock')
  const hex = createHash('sha256').update(Buffer.from(SECRET, 'hex')).digest('hex').slice(0, 32)
  assert.equal(fixedHrNonceFromSecret(SECRET),
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`)
})

test('real Unix channel keeps HR closed until exact root COMPLETE on same connection', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hr-fresh-socket-'))
  const path = join(dir, 'cut.sock')
  const server = createServer()
  try {
    server.listen(path)
    await once(server, 'listening')
    const accepted = once(server, 'connection')
    const rootSocket = createConnection(path)
    const [routerSocket] = await accepted
    const root = fixedHrFrameChannel(rootSocket)
    const router = fixedHrFrameChannel(routerSocket)
    root.send(challenge())
    const context = await acceptFixedHrStartupChallenge(router, expected(), 12345)
    const ready = await root.next()
    assert.deepEqual(ready, {
      schema: 'HR_FRESH_LINEAGE_STARTUP_READY_V1',
      cutOperationId: OPERATION,
      preparedReceiptSha256: RECEIPT_SHA,
      runtimePid: 12345,
    })
    assert.equal(context.assertLive(), true)
    const events = []
    const prepared = { ...expected(), receiptSha256: RECEIPT_SHA,
      cut: { operationId: OPERATION, agentId: 'agt_hr-agent' } }
    const completion = mountFixedHrCut({ prepared, context,
      reconciliationStore: {
        validateTrustedFreshHrLineage: () => events.push('validate'),
        activateTrustedFreshHrLineage: () => events.push('activate'),
        issueFreshHrStartupToken: () => 'startup-token',
        completeTrustedFreshHrMount: () => events.push('admitted'),
      },
      bindingStore: { commitFreshHrBindingCut: async () => ({}) },
      registry: { ensureRunning: async () => ({ processGeneration: 2, pid: 2222 }) },
      writeAck: () => ({ acknowledgementSha256: ACK_SHA }),
    })
    assert.deepEqual(await root.next(), {
      schema: 'HR_FRESH_LINEAGE_MOUNT_ACK_CANDIDATE_V1',
      cutOperationId: OPERATION,
      preparedReceiptSha256: RECEIPT_SHA,
      routerAckSha256: ACK_SHA,
    })
    assert.equal(events.includes('admitted'), false)
    root.send({ schema: 'HR_FRESH_LINEAGE_COMPLETE_V1',
      cutOperationId: OPERATION, preparedReceiptSha256: RECEIPT_SHA,
      disposition: 'COMPLETE', oldFenceRetained: true })
    assert.equal((await completion).disposition, 'COMPLETE')
    assert.equal(events.at(-1), 'admitted')
    await assert.rejects(context.awaitComplete(ACK_SHA), /COMPLETE channel unavailable/)
    root.close()
  } finally {
    server.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('wrong secret, disconnect, or false COMPLETE cannot authorize HR admission', async () => {
  const fake = ({ incoming, close = false }) => {
    let live = true
    const writes = []
    return { writes, channel: {
      live: () => live,
      next: async () => {
        if (close) { live = false; throw new Error('owned channel closed') }
        return incoming.shift()
      },
      send: value => writes.push(value),
    } }
  }
  await assert.rejects(
    acceptFixedHrStartupChallenge(fake({ incoming: [challenge({ secret: '00'.repeat(32) })] }).channel,
      expected(), 1), /challenge commitment invalid/)
  const broken = fake({ incoming: [challenge()], close: true })
  await assert.rejects(acceptFixedHrStartupChallenge(broken.channel, expected(), 1), /owned channel closed/)
  const denied = fake({ incoming: [challenge(), {
    schema: 'HR_FRESH_LINEAGE_COMPLETE_V1', cutOperationId: OPERATION,
    preparedReceiptSha256: RECEIPT_SHA, disposition: 'UNKNOWN', oldFenceRetained: true,
  }] })
  const context = await acceptFixedHrStartupChallenge(denied.channel, expected(), 1)
  await assert.rejects(context.awaitComplete(ACK_SHA), /root COMPLETE invalid/)
})
