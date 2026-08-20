/**
 * Golden vectors GV1–GV6 (AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1 §7 —
 * Contract 1: conversation identity compatibility).
 *
 * Per vector, the FULL production derivation chain runs offline:
 *
 *   raw wire event (dispatcher-flattened shape)
 *     → normalize()  [PINNED @larksuite/channel 0.5.0, offline injection —
 *                     the same entry point the channel's builtin message
 *                     handler calls]
 *     → normalizedToIngressEvent()  [thin adapter]
 *     → conversationId / channel / threadId / rootMsgId
 *     → channelConversationId('feishu', conversationId)  [REAL agent-router
 *       id owner] → ccId
 *
 * Assertions are byte-equal against fixtures/golden-vectors.json, plus a
 * differential assertion against the TEST-ONLY V0 oracle (old
 * normalizeIngressEvent derivation must produce the SAME conversationId).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalize } from '@larksuite/channel'
import { channelConversationId } from '../../agent-router/src/index.js'
import { normalizedToIngressEvent } from '../src/bridge.js'
import { replyTargetFor } from '../src/core.js'
import { normalizeIngressEvent as legacyNormalize } from './legacy-v0-oracle.js'

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'golden-vectors.json')
const golden = JSON.parse(readFileSync(fixturePath, 'utf8'))
const botIdentity = golden.botIdentity

test('golden fixture covers GV1–GV6 (spec §7.1 frozen set)', () => {
  const ids = golden.vectors.map((v) => v.id)
  for (const required of ['GV1', 'GV2', 'GV3', 'GV4', 'GV5a', 'GV5b', 'GV6']) {
    assert.ok(ids.includes(required), `fixture must include ${required}`)
  }
})

for (const vector of golden.vectors) {
  test(`${vector.id}: ${vector.describe}`, async () => {
    // 1. pinned SDK normalize, offline-injected with the raw wire event
    const msg = await normalize(vector.input, { botIdentity, includeRaw: true })

    // 2. thin adapter mapping
    const ev = normalizedToIngressEvent(msg, { botIdentity })

    // 3. byte-equal assertions against the frozen expectations
    assert.equal(ev.conversationId, vector.expected.conversationId)
    assert.equal(ev.channel, vector.expected.channel)
    assert.equal(ev.chatType, vector.expected.chatType)
    assert.equal(ev.threadId ?? null, vector.expected.threadId)
    assert.equal(ev.rootMsgId ?? null, vector.expected.rootMsgId)
    assert.equal(ev.chatId || null, vector.expected.chatId)

    // replyInThread: the outbound seam's thread-stickiness for this event
    const target = replyTargetFor(ev).replyTo(ev.messageId)
    assert.equal(target.replyInThread, vector.expected.replyInThread)

    // 4. ccId through the REAL Router id owner (byte-equal)
    const ccId = channelConversationId('feishu', ev.conversationId)
    assert.equal(ccId, vector.expected.ccId)

    // 5. differential oracle: the V0 derivation must agree byte-for-byte
    const legacy = legacyNormalize(vector.input, { botOpenId: botIdentity.openId })
    assert.equal(legacy.conversationId, ev.conversationId, `${vector.id}: old vs new conversationId drift`)
    assert.equal(legacy.channel, ev.channel, `${vector.id}: old vs new channel drift`)
    assert.equal(legacy.threadId ?? null, ev.threadId ?? null, `${vector.id}: old vs new threadId drift`)
    assert.equal(legacy.rootMsgId ?? null, ev.rootMsgId ?? null, `${vector.id}: old vs new rootMsgId drift`)

    // 6. the IngressEvent stays pure JSON-serializable data with no
    //    workspace/session injection (V2 §5) — spot assertions
    assert.equal(ev.workspace, undefined)
    assert.equal(ev.session, undefined)
    assert.doesNotThrow(() => JSON.stringify(ev))
  })
}

test('GV3 thread trim: the raw thread_id whitespace never reaches conversationId', async () => {
  const gv3 = golden.vectors.find((v) => v.id === 'GV3')
  const msg = await normalize(gv3.input, { botIdentity, includeRaw: true })
  // the SDK passes thread_id through untrimmed; the adapter owns the trim
  assert.equal(msg.threadId, ' omt_2a8d40c1 ')
  const ev = normalizedToIngressEvent(msg, { botIdentity })
  assert.equal(ev.threadId, 'omt_2a8d40c1')
  assert.ok(!ev.conversationId.includes(' '), 'conversationId must contain no whitespace')
})

test('ReplyTarget for a thread event stays thread-anchored (reply_in_thread)', async () => {
  const gv3 = golden.vectors.find((v) => v.id === 'GV3')
  const msg = await normalize(gv3.input, { botIdentity, includeRaw: true })
  const ev = normalizedToIngressEvent(msg, { botIdentity })
  const target = replyTargetFor(ev).replyTo(ev.messageId)
  assert.equal(target.kind, 'reply')
  assert.equal(target.replyMsgId, ev.messageId)
  assert.equal(target.replyInThread, true, 'thread replies must not escape to the group main conversation')
  assert.equal(target.threadId, 'omt_2a8d40c1')
})

test('dedupKey is informational only (event_id when the raw event carries it)', async () => {
  const gv1 = golden.vectors.find((v) => v.id === 'GV1')
  const msg = await normalize(gv1.input, { botIdentity, includeRaw: true })
  const ev = normalizedToIngressEvent(msg, { botIdentity })
  assert.equal(ev.dedupKey, 'evt_gv1_p2p')
})
