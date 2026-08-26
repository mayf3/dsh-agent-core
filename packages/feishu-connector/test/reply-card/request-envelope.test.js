import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildReplyTarget } from '../../src/core.js'
import {
  composeReplyCard,
  measureReplyCardRequestEnvelope,
  replyCardSendPlan,
  REPLY_CARD_MAX_REQUEST_BYTES,
  CARD_NOT_ATTEMPTED_REQUEST_BODY_OUT_OF_ENVELOPE,
} from '../../src/reply-card.js'

const groupTarget = () => buildReplyTarget({
  conversationId: 'oc_g',
  chatId: 'oc_g',
  channel: 'group',
}).replyTo('om_in_group')

function exactBodies(card, to, replyInThread) {
  const cardContent = JSON.stringify(card)
  const reply = JSON.stringify({
    content: cardContent,
    msg_type: 'interactive',
    reply_in_thread: replyInThread,
  })
  const createFallback = JSON.stringify({
    receive_id: to,
    msg_type: 'interactive',
    content: cardContent,
  })
  return {
    raw: Buffer.byteLength(cardContent, 'utf8'),
    reply: Buffer.byteLength(reply, 'utf8'),
    createFallback: Buffer.byteLength(createFallback, 'utf8'),
  }
}

test('request envelope counts final UTF-8 bytes for required character classes', () => {
  const cases = {
    ascii: 'plain ASCII body 123',
    chinese: '中文正文与标点。',
    emoji: '😀🚀🧪✨',
    quotes: '"'.repeat(200),
    backslashes: '\\'.repeat(200),
    newlines: 'line\n'.repeat(200),
    fencedCode: '```js\nconst path = "C:\\\\tmp\\\\file"\nconsole.log("ok")\n```',
    mixedUtf8: 'ASCII 中文 😀 "quoted" \\ path\n第二行 café',
  }

  for (const [name, body] of Object.entries(cases)) {
    const { card } = composeReplyCard(body)
    const expected = exactBodies(card, 'oc_g', false)
    const measured = measureReplyCardRequestEnvelope(card, 'oc_g', false)
    assert.equal(measured.rawCardJsonBytes, expected.raw, `${name}: raw card bytes`)
    assert.equal(measured.replyRequestBytes, expected.reply, `${name}: reply body bytes`)
    assert.equal(measured.createFallbackRequestBytes, expected.createFallback, `${name}: create fallback body bytes`)
    assert.equal(measured.wireBytes, Math.max(expected.reply, expected.createFallback), `${name}: max body authority`)
    assert.equal(card.body.elements[0].content, body, `${name}: body remains verbatim`)
  }
})

test('wire boundary is inclusive at 29000 and rejects 29001', () => {
  const one = replyCardSendPlan(groupTarget(), 'x')
  const overhead = one.wireBytes - 1
  const atLimitBody = 'x'.repeat(REPLY_CARD_MAX_REQUEST_BYTES - overhead)
  const atLimit = replyCardSendPlan(groupTarget(), atLimitBody)
  assert.equal(atLimit.wireBytes, 29000)
  assert.ok(atLimit.plan, 'wire body exactly at 29000 is attempted')

  const overLimit = replyCardSendPlan(groupTarget(), `${atLimitBody}x`)
  assert.equal(overLimit.wireBytes, 29001)
  assert.equal(overLimit.plan, undefined)
  assert.equal(overLimit.notAttempted, CARD_NOT_ATTEMPTED_REQUEST_BODY_OUT_OF_ENVELOPE)
})

test('short cards remain attemptable under the final request-body authority', () => {
  const result = replyCardSendPlan(groupTarget(), '正常短卡片 😀')
  assert.ok(result.plan)
  assert.ok(result.wireBytes <= REPLY_CARD_MAX_REQUEST_BYTES)
})

test('both reply and create-fallback envelopes participate in the maximum', () => {
  const { card } = composeReplyCard('envelope selection')

  const replyDominates = measureReplyCardRequestEnvelope(card, 'x', true)
  assert.ok(replyDominates.replyRequestBytes > replyDominates.createFallbackRequestBytes)
  assert.equal(replyDominates.wireBytes, replyDominates.replyRequestBytes)

  const createDominates = measureReplyCardRequestEnvelope(card, `oc_${'x'.repeat(200)}`, false)
  assert.ok(createDominates.createFallbackRequestBytes > createDominates.replyRequestBytes)
  assert.equal(createDominates.wireBytes, createDominates.createFallbackRequestBytes)
})

test('audit pathological quotes case proves raw-card bytes are not size authority', () => {
  const result = replyCardSendPlan(groupTarget(), '"'.repeat(14900))
  assert.ok(result.rawCardJsonBytes < 30000)
  assert.ok(result.wireBytes > 30000)
  assert.equal(result.notAttempted, CARD_NOT_ATTEMPTED_REQUEST_BODY_OUT_OF_ENVELOPE)
})
