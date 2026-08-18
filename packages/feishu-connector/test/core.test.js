/**
 * Core semantics tests (Foundation cutover): conversation identity
 * derivation (Binding-continuity lifeline), the ReplyTarget family and its
 * SDK send mapping, the transitional compatibility carriers, and the frozen
 * Foundation SDK configuration.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  FOUNDATION_LARK_CHANNEL_OPTIONS,
  buildConversationId,
  resolveConversation,
  buildReplyTarget,
  replyTargetFor,
  replyTargetToSdkSend,
  conversationWorkspaceId,
  conversationMainSessionId,
} from '../src/core.js'

// ---------------------------------------------------------------------------
// conversation identity derivation (V0 semantics, byte-identical)
// ---------------------------------------------------------------------------

test('buildConversationId: p2p / group = chatId', () => {
  assert.equal(buildConversationId({ chatId: 'oc_p2p_001', scope: 'p2p' }), 'oc_p2p_001')
  assert.equal(buildConversationId({ chatId: 'oc_group_001', scope: 'group' }), 'oc_group_001')
})

test('buildConversationId: topic thread = chatId:topic:trim(threadId)', () => {
  assert.equal(
    buildConversationId({ chatId: 'oc_g', scope: 'group_topic', threadId: ' omt_t1 ' }),
    'oc_g:topic:omt_t1',
  )
  // missing threadId degrades to the group conversation
  assert.equal(buildConversationId({ chatId: 'oc_g', scope: 'group_topic' }), 'oc_g')
})

test('buildConversationId: empty chatId falls back to "unknown"', () => {
  assert.equal(buildConversationId({ chatId: '  ', scope: 'p2p' }), 'unknown')
})

test('resolveConversation: thread requires group chatType (p2p+thread stays p2p)', () => {
  const thread = resolveConversation({ chatId: 'oc_g', chatType: 'group', threadId: 'omt_t1' })
  assert.equal(thread.channel, 'thread')
  assert.equal(thread.conversationId, 'oc_g:topic:omt_t1')

  const p2pWithThread = resolveConversation({ chatId: 'oc_p', chatType: 'p2p', threadId: 'omt_t1' })
  assert.equal(p2pWithThread.channel, 'p2p')
  assert.equal(p2pWithThread.conversationId, 'oc_p')
  assert.equal(p2pWithThread.threadId, 'omt_t1', 'threadId still carried as an event field')
})

test('resolveConversation: root_id without thread_id is NOT a topic thread', () => {
  const inline = resolveConversation({ chatId: 'oc_g', chatType: 'group', rootId: 'om_root' })
  assert.equal(inline.channel, 'group')
  assert.equal(inline.conversationId, 'oc_g')
  assert.equal(inline.rootMsgId, 'om_root', 'root carried as an event field only')
})

test('resolveConversation: whitespace-only thread_id counts as absent', () => {
  const ev = resolveConversation({ chatId: 'oc_g', chatType: 'group', threadId: '   ' })
  assert.equal(ev.channel, 'group')
  assert.equal(ev.conversationId, 'oc_g')
  assert.equal(ev.threadId, undefined)
})

// ---------------------------------------------------------------------------
// ReplyTarget family (V0, unchanged) + SDK send mapping
// ---------------------------------------------------------------------------

test('ReplyTarget from a thread ingress replies inside the thread', () => {
  const target = buildReplyTarget({ conversationId: 'oc_g:topic:omt_t1', chatId: 'oc_g', channel: 'thread', messageId: 'om_1', threadId: 'omt_t1', rootMsgId: 'om_root' })
  const reply = target.replyTo('om_2')
  assert.equal(reply.kind, 'reply')
  assert.equal(reply.replyMsgId, 'om_2')
  assert.equal(reply.replyInThread, true)
  assert.equal(reply.threadId, 'omt_t1')
})

test('replyTargetFor works off a mapped IngressEvent shape', () => {
  const target = replyTargetFor({ conversationId: 'oc_p', chatId: 'oc_p', channel: 'p2p', messageId: 'om_1' })
  const reply = target.replyTo()
  assert.equal(reply.kind, 'reply')
  assert.equal(reply.replyMsgId, 'om_1')
  assert.equal(reply.replyInThread, false)
})

test('replyTargetToSdkSend: reply kind maps to replyTo + replyInThread', () => {
  const plan = replyTargetToSdkSend(
    { kind: 'reply', chatId: 'oc_g', receiveId: 'oc_g', replyMsgId: 'om_9', replyInThread: true },
    'hi',
  )
  assert.equal(plan.method, 'reply')
  assert.equal(plan.to, 'oc_g')
  assert.deepEqual(plan.input, { text: 'hi' })
  assert.equal(plan.opts.replyTo, 'om_9')
  assert.equal(plan.opts.replyInThread, true)
})

test('replyTargetToSdkSend: p2p reply carries replyInThread=false', () => {
  const plan = replyTargetToSdkSend(
    { kind: 'reply', chatId: 'oc_p', receiveId: 'oc_p', replyMsgId: 'om_1', replyInThread: false },
    'answer',
  )
  assert.equal(plan.opts.replyTo, 'om_1')
  assert.equal(plan.opts.replyInThread, false)
})

test('replyTargetToSdkSend: create_thread anchors at rootMsgId with replyInThread', () => {
  const plan = replyTargetToSdkSend(
    { kind: 'create_thread', chatId: 'oc_g', receiveId: 'oc_g', rootMsgId: 'om_root' },
    'thread reply',
  )
  assert.equal(plan.method, 'create_thread')
  assert.equal(plan.opts.replyTo, 'om_root')
  assert.equal(plan.opts.replyInThread, true)
})

test('replyTargetToSdkSend: create_thread without root degrades to a plain create (V0 parity)', () => {
  const plan = replyTargetToSdkSend(
    { kind: 'create_thread', chatId: 'oc_g', receiveId: 'oc_g', rootMsgId: undefined },
    'x',
  )
  assert.equal(plan.method, 'create_thread')
  assert.deepEqual(plan.opts, {})
})

test('replyTargetToSdkSend: create maps receiveId through (SDK derives receive_id_type by prefix)', () => {
  const oc = replyTargetToSdkSend({ kind: 'create', chatId: 'oc_g', receiveId: 'oc_g', receiveIdType: 'chat_id' }, 'x')
  assert.equal(oc.to, 'oc_g')
  assert.deepEqual(oc.opts, {})
  const ou = replyTargetToSdkSend({ kind: 'create', chatId: 'oc_g', receiveId: 'ou_u', receiveIdType: 'open_id' }, 'x')
  assert.equal(ou.to, 'ou_u')
})

test('replyTargetToSdkSend: unknown kind throws (V0 parity)', () => {
  assert.throws(() => replyTargetToSdkSend({ kind: 'nope' }, 'x'), /ReplyTarget kind/)
})

// ---------------------------------------------------------------------------
// transitional compatibility carriers
// ---------------------------------------------------------------------------

test('conversation policy helpers stay exported and deterministic (transitional compat)', () => {
  assert.equal(conversationWorkspaceId('oc_X'), 'feishu-oc_X')
  assert.equal(conversationMainSessionId('oc_X'), 'main-oc_X')
  assert.equal(conversationWorkspaceId('oc_X'), conversationWorkspaceId('oc_X'))
  assert.equal(conversationWorkspaceId('oc_g:topic:omt_t1'), 'feishu-oc_g-topic-omt_t1')
})

// ---------------------------------------------------------------------------
// frozen Foundation SDK configuration (spec §6.5)
// ---------------------------------------------------------------------------

test('FOUNDATION options freeze the six Foundation semantics', () => {
  assert.equal(FOUNDATION_LARK_CHANNEL_OPTIONS.safety.batch.text.delayMs, 0, 'SDK_BATCH_DELAY_MS=0')
  assert.equal(FOUNDATION_LARK_CHANNEL_OPTIONS.safety.chatQueue.enabled, false, 'SDK_CHAT_QUEUE=DISABLED')
  assert.equal(FOUNDATION_LARK_CHANNEL_OPTIONS.safety.staleMessageWindowMs, Number.POSITIVE_INFINITY, 'SDK_STALE_DROP=DISABLED (window=Infinity)')
  assert.equal(FOUNDATION_LARK_CHANNEL_OPTIONS.policy.requireMention, true, 'SDK_REQUIRE_MENTION=true')
  assert.equal(FOUNDATION_LARK_CHANNEL_OPTIONS.policy.respondToMentionAll, true, 'V0 @all-mention parity pin')
  assert.equal(FOUNDATION_LARK_CHANNEL_OPTIONS.includeRawEvent, true)
  // no queue/batch knobs smuggled open, no dedup config (authority = SDK)
  assert.equal(FOUNDATION_LARK_CHANNEL_OPTIONS.safety.dedup, undefined)
  assert.equal(FOUNDATION_LARK_CHANNEL_OPTIONS.safety.chatQueue.mergeWhileBusy, undefined)
})
