/**
 * @agent-core/feishu-connector/src/core.js
 *
 * Pure channel-layer semantics for the Feishu connector on the official
 * @larksuite/channel foundation (AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1
 * Phase A — Foundation cutover).
 *
 * The SDK now owns the protocol layer: WebSocket lifecycle, first-handshake
 * readiness + bot identity, 21-type event normalization, dedup
 * (SeenCache + ProcessingLock) and the outbound protocol primitives. This
 * module keeps ONLY the Agent Core semantics that must survive the cutover
 * byte-identically, plus the two thin pure mappings at the adapter seam:
 *
 *   1. conversation identity derivation (buildConversationId /
 *      resolveConversation) — the Binding-continuity lifeline. The
 *      derivation logic is KEPT from V0 unchanged; only the INPUT source
 *      changed (SDK NormalizedMessage fields instead of raw wire fields).
 *   2. the ReplyTarget family + its mapping onto SDK send options
 *      (replyTargetToSdkSend) — the outbound seam `feishu.reply(replyTarget,
 *      text)` keeps its V0 contract while the transport under it is the SDK.
 *
 * Frozen Foundation SDK configuration lives here too
 * (FOUNDATION_LARK_CHANNEL_OPTIONS) so the connector shell, the standalone
 * driver and the tests all share ONE definition of the frozen values.
 *
 * Removed from V0 (SDK owns them now; the old implementations survive only
 * as the test-only differential oracle, see test/legacy-v0-oracle.js):
 * normalizeIngressEvent, LruDedup/dedupEvent, classifyIngress,
 * createIngressPipeline.
 *
 * This module carries ZERO DSH / Cordis dependency and NO network I/O.
 */

// ---------------------------------------------------------------------------
// Foundation frozen SDK configuration (spec §6.5 — SEMANTIC CONTRACT)
// ---------------------------------------------------------------------------

/**
 * The frozen @larksuite/channel 0.5.0 configuration for the Foundation
 * cutover. Every value here exists to keep Agent Core's product behavior
 * identical to the pre-cutover connector; NONE of the SDK defaults that
 * would silently change behavior are left implicit:
 *
 *   safety.batch.text.delayMs = 0        no cross-message merging (the SDK
 *                                        default 600ms batches by chatId,
 *                                        which would merge two different
 *                                        conversationIds that share a chatId).
 *   safety.chatQueue.enabled = false     no per-chat serialization (V0 had
 *                                        none; the single serialization
 *                                        authority stays the AgentProcess
 *                                        per-agent single-flight). Disabling
 *                                        the queue also bypasses batching
 *                                        entirely (safety/index.ts dispatches
 *                                        straight to the handler).
 *   safety.staleMessageWindowMs =
 *     Number.POSITIVE_INFINITY           stale-drop disabled (SDK default
 *                                        30min would silently drop
 *                                        redeliveries after downtime; V0 had
 *                                        no stale behavior).
 *   policy.requireMention = true         undeclared-group no-mention messages
 *                                        keep being dropped (must be pinned
 *                                        explicitly so a future SDK default
 *                                        change cannot drift it).
 *   policy.respondToMentionAll = true    V0 treats an @all mention as a
 *                                        mention; the SDK default (false)
 *                                        would additionally DROP @all+@bot
 *                                        group messages V0 processed
 *                                        (mention_all_blocked). This pin only
 *                                        removes that extra drop — it enables
 *                                        nothing and lets no more through
 *                                        than V0 did.
 *   includeRawEvent = true               attach the raw (dispatcher-flattened)
 *                                        wire event on each NormalizedMessage
 *                                        so the thin adapter can read
 *                                        event_id + the full sender_id triple
 *                                        without re-normalizing anything.
 *
 * @type {object} LarkChannelOptions fragment (frozen; do not extend without
 *   a governing Spec change).
 */
export const FOUNDATION_LARK_CHANNEL_OPTIONS = Object.freeze({
  safety: Object.freeze({
    batch: Object.freeze({ text: Object.freeze({ delayMs: 0 }) }),
    chatQueue: Object.freeze({ enabled: false }),
    staleMessageWindowMs: Number.POSITIVE_INFINITY,
  }),
  policy: Object.freeze({
    requireMention: true,
    respondToMentionAll: true,
  }),
  includeRawEvent: true,
})

// ---------------------------------------------------------------------------
// Identifier helpers (V0 semantics, byte-identical — Binding continuity)
// ---------------------------------------------------------------------------

/**
 * Feishu conversation scopes. `group` is a whole chat; `group_topic` narrows
 * a group chat to a topic thread; `group_sender` is a group narrowed to one
 * sender (used for per-sender DMs inside a group). Only p2p / group /
 * group_topic materialize on the normal path, but the encoding stays
 * consistent with the legacy agent-core + OpenClaw feishu convention.
 *
 * @typedef {'p2p'|'group'|'group_topic'|'group_sender'|'group_topic_sender'} ConversationScope
 */

/**
 * Build a canonical conversation identifier from its parts.
 * p2p  => chatId is the peer conversation id directly.
 * group=> chatId directly.
 * group_topic => `${chatId}:topic:${threadId}`.
 * group_sender=> `${chatId}:sender:${openId}`.
 *
 * An empty `chatId` falls back to `"unknown"` so the returned string is always
 * stable and usable as a key.
 *
 * @param {object} p
 * @param {string} p.chatId - Feishu chat_id (oc_*) for groups or the p2p chat id.
 * @param {ConversationScope} p.scope
 * @param {string} [p.threadId] - Feishu thread_id (omt_*) when scope is thread/topic.
 * @param {string} [p.senderOpenId] - when scope is sender-scoped.
 * @returns {string} canonical conversation identifier.
 */
export function buildConversationId(p) {
  const chatId = (p.chatId ?? '').trim() || 'unknown'
  switch (p.scope) {
    case 'group_topic':
    case 'thread':
      return p.threadId ? `${chatId}:topic:${p.threadId.trim()}` : chatId
    case 'group_sender':
      return p.senderOpenId ? `${chatId}:sender:${p.senderOpenId.trim()}` : chatId
    case 'group_topic_sender':
      if (p.threadId && p.senderOpenId) {
        return `${chatId}:topic:${p.threadId.trim()}:sender:${p.senderOpenId.trim()}`
      }
      return buildConversationId({ chatId, scope: 'group_topic', threadId: p.threadId, senderOpenId: p.senderOpenId })
    case 'p2p':
    case 'group':
    default:
      return chatId
  }
}

/**
 * Resolve the conversation shape for one inbound message, from the fields the
 * SDK NormalizedMessage already carries (chatId / chatType / threadId /
 * rootId). Same derivation semantics as V0's resolveConversation — only the
 * input source changed from raw wire fields to the SDK-normalized fields
 * (spec §6.2: KEEP, byte-identical).
 *
 * Feishu distinguishes a "topic thread" (`thread_id`, omt_*) from an inline
 * reply (`root_id` / `parent_id`). A message that carries a thread_id AND is
 * a group message lives in a topic thread; otherwise it belongs to the group
 * or p2p conversation. A p2p chat carrying a thread_id stays p2p.
 *
 * @param {object} p
 * @param {string} p.chatId - SDK NormalizedMessage.chatId.
 * @param {'p2p'|'group'} p.chatType - SDK NormalizedMessage.chatType.
 * @param {string} [p.threadId] - SDK NormalizedMessage.threadId (omt_*).
 * @param {string} [p.rootId] - SDK NormalizedMessage.rootId (root message id).
 * @returns {{
 *   channel: 'p2p'|'group'|'thread',
 *   chatType: 'p2p'|'group',
 *   conversationId: string,
 *   chatId: string,
 *   threadId?: string,
 *   rootMsgId?: string,
 * }}
 */
export function resolveConversation({ chatId, chatType, threadId, rootId }) {
  const trimmedChatId = (chatId ?? '').trim()
  const typedChatType = chatType === 'p2p' ? 'p2p' : 'group'
  const trimmedThreadId = (threadId ?? '').trim() || undefined
  const trimmedRootMsgId = (rootId ?? '').trim() || undefined

  const isThread = typedChatType === 'group' && trimmedThreadId !== undefined

  const scope = isThread ? 'group_topic' : typedChatType
  return {
    channel: isThread ? 'thread' : typedChatType,
    chatType: typedChatType,
    conversationId: buildConversationId({
      chatId: trimmedChatId,
      scope,
      threadId: trimmedThreadId,
    }),
    chatId: trimmedChatId,
    threadId: trimmedThreadId,
    rootMsgId: trimmedRootMsgId,
  }
}

// ---------------------------------------------------------------------------
// TRANSITIONAL compatibility carriers (V2 — kept, never on the normal path)
// ---------------------------------------------------------------------------

/**
 * TRANSITIONAL compatibility helper (AGENT_WORKSPACE_SESSION_MODEL_V2 §22/§26.3:
 * the old "same Agent -> per-conversation workspace" product model's carrier).
 * The V2 normal Feishu path never calls it (the bridge attaches no workspace);
 * it stays exported so historical compatibility state and existing
 * Router-level mechanism tests keep resolving the same deterministic ids. Its
 * eventual removal is a separate future Spec decision.
 *
 * Maps one Feishu conversation identity onto one stable, deterministic
 * workspaceId (`feishu-<normalized conversation id>`).
 *
 * @param {string} conversationId - the uniform conversation id.
 * @returns {string} the stable workspaceId for this conversation.
 */
export function conversationWorkspaceId(conversationId) {
  if (typeof conversationId !== 'string' || conversationId.trim() === '') {
    throw new TypeError('conversationWorkspaceId: conversationId must be a non-empty string')
  }
  const normalized = conversationId.trim().replace(/[^A-Za-z0-9_-]/g, '-')
  return `feishu-${normalized}`
}

/**
 * TRANSITIONAL compatibility helper — the session half of the same old
 * per-conversation policy (see conversationWorkspaceId above). Kept exported
 * for the transitional state and Router-level mechanism tests only.
 *
 * @param {string} conversationId - the uniform conversation id.
 * @returns {string} the stable initial session id for this conversation.
 */
export function conversationMainSessionId(conversationId) {
  if (typeof conversationId !== 'string' || conversationId.trim() === '') {
    throw new TypeError('conversationMainSessionId: conversationId must be a non-empty string')
  }
  const normalized = conversationId.trim().replace(/[^A-Za-z0-9_-]/g, '-')
  return `main-${normalized}`
}

// ---------------------------------------------------------------------------
// Ingress gate receipt (V2 §4.5 — byte-frozen)
// ---------------------------------------------------------------------------

/**
 * The FIXED receipt the connector itself sends when the pre-forward ingress
 * gate rejects an event (AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC §4.5:
 * structured rejection — one deterministic text, never per-reason variants).
 * @type {string}
 */
export const INGRESS_GATE_REJECTED_REPLY =
  '[agent-core] 该会话未完成绑定（not bound）：消息未送达任何 Agent，也未创建任何绑定。请联系管理员完成会话与 Agent 的预绑定。'

// ---------------------------------------------------------------------------
// ReplyTarget (V0 family, unchanged) + SDK send mapping
// ---------------------------------------------------------------------------

/**
 * Build a uniform outbound ReplyTarget for an ingress event or explicit parts.
 *
 * A ReplyTarget answers "where and how should a reply go?":
 *   - replyTo(message): reply inline under a message (im.message.reply).
 *   - asThread(): reply inside a topic thread (thread context).
 *   - directChat(): fire a top-level message into a chat (im.message.create).
 *
 * @param {object} p
 * @param {string} p.conversationId - canonical conversation id.
 * @param {string} p.chatId - Feishu chat_id / p2p conversation id given to receive_id.
 * @param {'p2p'|'group'|'thread'} p.channel
 * @param {string} [p.messageId] - source message id to reply under.
 * @param {string} [p.threadId] - Feishu topic thread id.
 * @param {string} [p.rootMsgId] - root message id of a thread.
 * @returns {object} ReplyTarget
 */
export function buildReplyTarget(p) {
  const replyTo = (messageId) => ({
    kind: 'reply',
    conversationId: p.conversationId,
    chatId: p.chatId,
    channel: p.channel,
    receiveIdType: 'chat_id',
    receiveId: p.chatId,
    replyMsgId: messageId ?? p.messageId ?? undefined,
    threadId: p.threadId,
    rootMsgId: p.rootMsgId,
    // inline reply within a topic thread: reply_in_thread true when we are in a thread
    replyInThread: p.channel === 'thread',
  })
  const asThread = () => ({
    kind: 'create_thread',
    conversationId: p.conversationId,
    chatId: p.chatId,
    channel: 'thread',
    receiveIdType: 'chat_id',
    receiveId: p.chatId,
    threadId: p.threadId,
    rootMsgId: p.rootMsgId,
    replyInThread: true,
  })
  const directChat = (receiveId, receiveIdType = 'chat_id') => ({
    kind: 'create',
    conversationId: p.conversationId,
    chatId: p.chatId,
    channel: 'group' === p.channel ? 'group' : p.channel,
    receiveIdType,
    receiveId: receiveId ?? p.chatId,
    threadId: p.threadId,
    rootMsgId: p.rootMsgId,
    replyInThread: false,
  })

  return { replyTo, asThread, directChat }
}

/**
 * Convenience: build a ReplyTarget straight from a normalized IngressEvent.
 * @param {object} ev - IngressEvent from the bridge mapping.
 * @returns {object} ReplyTarget with replyTo/... helpers.
 */
export function replyTargetFor(ev) {
  return buildReplyTarget({
    conversationId: ev.conversationId,
    chatId: ev.chatId,
    channel: ev.channel,
    messageId: ev.messageId,
    threadId: ev.threadId,
    rootMsgId: ev.rootMsgId,
  })
}

/**
 * Map a ReplyTarget + text onto the @larksuite/channel send plan
 * (`channel.send(to, { text }, opts)`). Pure data in, pure plan out — the
 * shell invokes the SDK with whatever this returns.
 *
 * kind mapping (spec §10 REPLY_SEAM — behavior-compatible):
 *   'reply'         → SDK send with replyTo = replyMsgId and
 *                     replyInThread when the target is a topic thread
 *                     (im.message.reply with reply_in_thread).
 *   'create_thread' → SDK send anchored at the thread root: replyTo =
 *                     rootMsgId + replyInThread = true — the Feishu-native
 *                     "open/join the topic thread under that root" path
 *                     (the SDK send surface has no literal create+root_id
 *                     form; this is its equivalent thread-anchored
 *                     primitive, and the reply can never escape to the
 *                     group main conversation). Without a rootMsgId it
 *                     degrades to a plain create, exactly like V0.
 *   'create'        → SDK send into receiveId (receive_id_type derived by
 *                     the SDK from the id prefix — oc_→chat_id, ou_→open_id,
 *                     on_→union_id — the same values V0 passed explicitly).
 *
 * @param {object} replyTarget - a ReplyTarget object.
 * @param {string} text - message text.
 * @returns {{to:string, input:{text:string}, opts:{replyTo?:string, replyInThread?:boolean}, method:string}}
 * @throws {Error} on an unknown ReplyTarget kind (V0 parity).
 */
export function replyTargetToSdkSend(replyTarget, text) {
  const kind = replyTarget?.kind
  const body = String(text ?? '')

  if (kind === 'reply') {
    return {
      to: replyTarget.receiveId ?? replyTarget.chatId,
      input: { text: body },
      opts: {
        ...(replyTarget.replyMsgId ? { replyTo: replyTarget.replyMsgId } : {}),
        replyInThread: replyTarget.replyInThread === true,
      },
      method: 'reply',
    }
  }

  if (kind === 'create_thread') {
    const to = replyTarget.receiveId ?? replyTarget.chatId
    if (replyTarget.rootMsgId) {
      return {
        to,
        input: { text: body },
        opts: { replyTo: replyTarget.rootMsgId, replyInThread: true },
        method: 'create_thread',
      }
    }
    return { to, input: { text: body }, opts: {}, method: 'create_thread' }
  }

  if (kind === 'create') {
    return {
      to: replyTarget.receiveId ?? replyTarget.chatId,
      input: { text: body },
      opts: {},
      method: 'create',
    }
  }

  throw new Error(`feishu-connector: unknown ReplyTarget kind "${kind}"`)
}
