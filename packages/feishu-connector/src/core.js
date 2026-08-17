/**
 * @agent-core/feishu-connector/src/core.js
 *
 * Pure channel-layer logic for the Feishu connector V0. This module carries
 * ZERO DSH / Cordis dependency and NO network I/O: everything it does is
 * deterministic data transformation over the raw Feishu event envelope
 * (`im.message.receive_v1`) plus the dedup bookkeeping and ReplyTarget
 * construction. That makes it trivially unit-testable in isolation.
 *
 * It owns four responsibilities from the V0 contract:
 *   1. ingress normalization  → a JSON-serializable `IngressEvent`
 *   2. sender / mention / attachment metadata extraction
 *   3. chat / thread identifier unification (p2p vs group vs thread)
 *   4. dedup (in-process LRU, swappable backend via interface)
 *
 * It does NOT own: DSH session delivery, auth/principal, process lifecycle.
 */

// ---------------------------------------------------------------------------
// Identifier helpers
// ---------------------------------------------------------------------------

/**
 * Feishu conversation scopes. `group` is a whole chat; `group_topic` narrows
 * a group chat to a topic thread; `group_sender` is a group narrowed to one
 * sender (used for per-sender DMs inside a group). V0 only materializes
 * p2p / group / thread, but the encoding is consistent with the legacy
 * agent-core + OpenClaw feishu conversation-id convention.
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
 * Resolve the conversation shape for one inbound Feishu message event.
 *
 * @param {object} event - the raw `im.message.receive_v1` payload (see normalizeIngressEvent).
 * @returns {{
 *   channel: 'p2p'|'group'|'thread',
 *   chatType: 'p2p'|'group',
 *   conversationId: string,
 *   chatId: string,
 *   threadId?: string,
 *   rootMsgId?: string,
 * }}
 */
export function resolveConversation(event) {
  const message = event?.message ?? {}
  const chatId = (message.chat_id ?? '').trim()
  const chatType = message.chat_type === 'p2p' ? 'p2p' : 'group'
  const threadId = (message.thread_id ?? '').trim() || undefined
  const rootMsgId = (message.root_id ?? '').trim() || undefined

  // Feishu distinguishes a "topic thread" (`thread_id`, omt_*) from an inline
  // reply (`root_id` / `parent_id`). A message that carries a thread_id lives
  // in a topic thread; otherwise it belongs to the group or p2p conversation.
  const isThread = chatType === 'group' && threadId !== undefined

  const scope = isThread ? 'group_topic' : chatType
  return {
    channel: isThread ? 'thread' : chatType,
    chatType,
    conversationId: buildConversationId({ chatId, scope, threadId }),
    chatId,
    threadId,
    rootMsgId,
  }
}

// ---------------------------------------------------------------------------
// Content parsing
// ---------------------------------------------------------------------------

/**
 * Parse the Feishu `message.content` string, which is JSON for every message
 * type except `text` (which is a plain string). Returns a plain object.
 */
export function parseContent(message) {
  const messageType = message?.message_type ?? 'text'
  const raw = message?.content
  if (raw == null) return {}
  if (messageType === 'text') return { text: String(raw) }
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch {
    return { text: String(raw) }
  }
}

/**
 * Extract an array of unified attachment descriptors from a parsed message.
 * Only metadata is captured; downloading content is out of scope for V0.
 *
 * @param {object} message - raw Feishu message (message_type + content).
 * @returns {Array<{type:string, fileKey:string, name?:string, sizeBytes?:number,
 *   duration?:number, coverImageKey?:string, downloadHint:object}>}
 */
export function parseAttachments(message) {
  const messageType = message?.message_type ?? 'text'
  const content = parseContent(message)
  const attachments = []

  if (messageType === 'image') {
    if (content.image_key) {
      attachments.push({
        type: 'image',
        fileKey: content.image_key,
        downloadHint: { kind: 'image', endpoint: 'im/v1/images', key: content.image_key },
      })
    }
  } else if (messageType === 'file') {
    if (content.file_key) {
      const size = asPositiveInt(content.file_size)
      attachments.push({
        type: 'file',
        fileKey: content.file_key,
        name: content.file_name || undefined,
        sizeBytes: size,
        downloadHint: { kind: 'file', endpoint: 'im/v1/files', key: content.file_key },
      })
    }
  } else if (messageType === 'audio') {
    if (content.file_key) {
      attachments.push({
        type: 'audio',
        fileKey: content.file_key,
        duration: asPositiveInt(content.duration),
        downloadHint: { kind: 'file', endpoint: 'im/v1/files', key: content.file_key },
      })
    }
  } else if (messageType === 'video') {
    if (content.file_key) {
      attachments.push({
        type: 'video',
        fileKey: content.file_key,
        name: content.file_name || undefined,
        duration: asPositiveInt(content.duration),
        coverImageKey: content.image_key || undefined,
        downloadHint: { kind: 'file', endpoint: 'im/v1/files', key: content.file_key },
      })
    }
  } else if (messageType === 'sticker') {
    if (content.file_key || content.image_key) {
      attachments.push({
        type: 'sticker',
        fileKey: content.file_key || content.image_key,
        downloadHint: {
          kind: content.file_key ? 'file' : 'image',
          endpoint: content.file_key ? 'im/v1/files' : 'im/v1/images',
          key: content.file_key || content.image_key,
        },
      })
    }
  } else if (messageType === 'post' && Array.isArray(content.content)) {
    // Rich text: flatten any embedded media links into descriptor placeholders.
    for (const line of content.content) {
      for (const block of Array.isArray(line) ? line : []) {
        const tag = block?.tag
        if (tag === 'img' && block.image_key) {
          attachments.push({
            type: 'image',
            fileKey: block.image_key,
            name: block.alt || undefined,
            downloadHint: { kind: 'image', endpoint: 'im/v1/images', key: block.image_key },
          })
        } else if ((tag === 'a' || tag === 'url') && block.href?.startsWith('file/')) {
          attachments.push({
            type: 'file',
            fileKey: block.href.replace(/^file\//, ''),
            name: block.text || undefined,
            downloadHint: { kind: 'file', endpoint: 'im/v1/files', key: block.href.replace(/^file\//, '') },
          })
        }
      }
    }
  }

  return attachments
}

function asPositiveInt(value) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

// ---------------------------------------------------------------------------
// Sender / mention metadata
// ---------------------------------------------------------------------------

/**
 * Extract sender metadata from a Feishu message event.
 *
 * @param {object} event - raw event.
 * @param {string} [botOpenId] - the receiving bot's open_id; when supplied the
 *   `isBotSelf` flag is resolved and mentions of the bot are marked.
 * @returns {{
 *   openId: string, unionId?: string, userId?: string, name?: string,
 *   senderType: string, isBotSelf: boolean, mentioned: boolean,
 *   senderId: string,
 * }}
 */
export function parseSender(event, botOpenId) {
  const sender = event?.sender ?? {}
  const senderId = sender?.sender_id ?? {}
  const openId = senderId.open_id ?? ''
  const unionId = senderId.union_id ?? ''
  const userId = senderId.user_id ?? ''
  const senderType = sender.sender_type ?? 'user'
  // Feishu carries `tenant_key` for bot senders; body/name lookups are out of
  // scope for V0 so the name is sourced from the raw sender if present.
  const name = typeof sender.name === 'string' ? sender.name : undefined

  const isBotSelf = Boolean(botOpenId && openId && openId === botOpenId)
  // If the sender itself is the bot, we don't process its own echo as a user turn.
  const selfSent = senderType === 'bot' || senderType === 'app'

  return {
    openId,
    unionId: unionId || undefined,
    userId: userId || undefined,
    name,
    senderType,
    isBotSelf,
    selfSent,
    senderId: openId || unionId || userId || '',
  }
}

/**
 * Normalize the `message.mentions` array into a uniform mention list.
 *
 * @returns {Array<{key:string, openId:string, unionId?:string, userId?:string,
 *   name:string, type:'all'|'user'|'bot'}>}
 */
export function parseMentions(message, botOpenId) {
  const mentions = Array.isArray(message?.mentions) ? message.mentions : []
  const out = []
  for (const m of mentions) {
    const id = m?.id ?? {}
    const openId = (id.open_id ?? m?.open_id ?? '').trim()
    const name = typeof m.name === 'string' ? m.name : ''
    if (!openId && m.key?.toLowerCase().startsWith('@_all')) {
      out.push({ key: m.key, openId: '', name, type: 'all' })
      continue
    }
    if (!openId) continue
    out.push({
      key: m.key,
      openId,
      unionId: id.union_id || undefined,
      userId: id.user_id || undefined,
      name,
      type: botOpenId && openId === botOpenId ? 'bot' : 'user',
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Ingress normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a raw Feishu `im.message.receive_v1` envelope into a uniform,
 * JSON-serializable `IngressEvent`.
 *
 * The SDK's WS event dispatcher calls the registered handler with `data` that
 * already points at the event body primed with `sender` / `message`, but the
 * `header.event_id` is on the envelope. We defensively read both shapes:
 *   { header, event }, { event }, or plain { sender, message }.
 *
 * @param {object} raw - the event data passed to the dispatcher handler.
 * @param {object} [opts] - { botOpenId, now }
 * @returns {object} IngressEvent (see JSDoc on the function below for shape).
 * @throws {Error} when the event is not a recognizable Feishu message event.
 */
export function normalizeIngressEvent(raw, opts = {}) {
  const header = raw?.header ?? raw?.event?.header ?? {}
  const event = raw?.event ?? raw
  const message = event?.message ?? {}
  const botOpenId = opts.botOpenId

  const messageId = (message.message_id ?? '').trim() || ''
  const chatType = message.chat_type

  if (chatType !== 'p2p' && chatType !== 'group') {
    throw new Error(`invalid_or_missing_chat_type: got ${String(chatType)}`)
  }
  if (!messageId) {
    throw new Error('invalid_or_missing_message_id')
  }

  const providerEventId = (header.event_id ?? '').trim()
  const sender = parseSender(event, botOpenId)
  const mentions = parseMentions(message, botOpenId)
  const conv = resolveConversation(event)
  const content = parseContent(message)
  const text = messageTypeText(message, content)
  const attachments = parseAttachments(message)

  // A bot is "mentioned" if the message carries an @all or any mention of the bot.
  const mentioned =
    mentions.some(m => m.type === 'all') ||
    (botOpenId ? mentions.some(m => m.type === 'bot') : false)
  // For p2p, an inbound human message counts as addressed to the bot by default.
  const addressed = chatType === 'p2p' ? true : mentioned

  const now = opts.now ?? Date.now()

  return {
    // Pure ingress event shape (V0 contract).
    eventId: providerEventId,
    type: 'message',
    subType: normalizeMessageSubtype(message.message_type),
    channel: conv.channel, // 'p2p' | 'group' | 'thread'
    chatType: conv.chatType,
    conversationId: conv.conversationId,
    chatId: conv.chatId,
    threadId: conv.threadId,
    rootMsgId: conv.rootMsgId,
    parentMsgId: (message.parent_id ?? '').trim() || undefined,
    messageId,
    messageType: message.message_type ?? 'text',
    sender,
    text,
    mentions,
    mentioned,
    addressed,
    attachments,
    raw: event,
    timestamp: createdAtOf(message, now),
    // AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC §5 (accepted): the V2
    // normal Feishu path MUST NOT inject or select a conversation workspace /
    // session. No `workspace` / `session` fields are attached: the Router's
    // first-contact rule then stores Binding.workspace = null (Default
    // Workspace Rule -> resolveWorkspace(agentId) = Agent primary workspace)
    // and the deployment default session ('main' = canonical main). The
    // conversationWorkspaceId / conversationMainSessionId helpers below stay
    // exported as TRANSITIONAL compatibility carriers (old p2p state keeps
    // matching); the normal path simply never calls them.
    // Deterministic dedup key: prefer the Feishu event_id, fall back to the
    // message_id (stable across redeliveries of the same message).
    dedupKey: providerEventId || `message:${messageId}`,
  }
}

/**
 * TRANSITIONAL compatibility helper (AGENT_WORKSPACE_SESSION_MODEL_V2 §22/§26.3:
 * the old "same Agent -> per-conversation workspace" product model's carrier).
 * The V2 normal Feishu path no longer calls it (normalizeIngressEvent attaches
 * no workspace); it stays exported so historical compatibility state and
 * existing Router-level mechanism tests keep resolving the same deterministic
 * ids. Its eventual removal is a separate future Spec decision.
 *
 * Maps one Feishu conversation identity onto one stable, deterministic
 * workspaceId (`feishu-<normalized conversation id>`), always a
 * workspace-bootstrap-safe single component: characters outside [A-Za-z0-9_-]
 * (the topic/sender scope separators `:` in thread/sender-scoped conversation
 * ids) normalize to `-`.
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
 * per-conversation policy (see conversationWorkspaceId above). The V2 normal
 * path no longer calls it; canonical main is the deployment default session
 * ('main'), not `main-<conversationId>`. Kept exported for the transitional
 * state and Router-level mechanism tests only.
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

function normalizeMessageSubtype(messageType) {
  switch (messageType) {
    case 'text':
    case 'post':
      return 'text'
    case 'image':
    case 'file':
    case 'audio':
    case 'video':
    case 'sticker':
      return messageType
    default:
      return 'other'
  }
}

function messageTypeText(message, content) {
  const messageType = message?.message_type ?? 'text'
  if (messageType === 'text') {
    // Feishu text message content is normally a plain string; some SDK/legacy
    // variants carry it JSON-wrapped as {"text": "..."}. Handle both.
    const candidate = content.text ?? content ?? ''
    if (typeof candidate === 'string' && candidate.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(candidate)
        if (typeof parsed?.text === 'string') return parsed.text
      } catch { /* fall through */ }
    }
    return String(candidate)
  }
  if (messageType === 'post') {
    // Flatten rich text into readable plain text.
    const pieces = []
    for (const line of Array.isArray(content.content) ? content.content : []) {
      const cells = []
      for (const block of Array.isArray(line) ? line : []) {
        if (block?.tag === 'text') cells.push(block.text ?? '')
        else if (block?.tag === 'a') cells.push(block.text ?? block.href ?? '')
        else if (block?.text) cells.push(block.text)
      }
      pieces.push(cells.join(' '))
    }
    return pieces.join('\n').trim()
  }
  // Non-text types: keep the attachment placeholder as text.
  if (messageType === 'image') return '[image]'
  if (messageType === 'file') return `[file${content.file_name ? ' ' + content.file_name : ''}]`
  if (messageType === 'audio') return '[audio]'
  if (messageType === 'video') return '[video]'
  if (messageType === 'sticker') return '[sticker]'
  return content.text ?? ''
}

function createdAtOf(message, fallback) {
  const raw = message?.create_time ?? message?.createTime
  if (raw == null) return fallback
  const n = Number(raw)
  if (Number.isFinite(n)) {
    // Feishu create_time is millisecond epoch; string values are also ms.
    return n > 1e12 ? n : n * 1000
  }
  return fallback
}

// ---------------------------------------------------------------------------
// ReplyTarget
// ---------------------------------------------------------------------------

/**
 * Build a uniform outbound ReplyTarget for an ingress event or explicit parts.
 *
 * A ReplyTarget answers "where and how should a reply go?":
 *   - replyTo(message): reply inline under a message (uses the im reply endpoint).
 *   - asThread(): reply inside a topic thread (sets root_id / thread context).
 *   - directChat(): fire a top-level message into a chat (im/message create).
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
 * @param {object} ev - IngressEvent from normalizeIngressEvent.
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

// ---------------------------------------------------------------------------
// Dedup
// ---------------------------------------------------------------------------

/**
 * In-process LRU dedup store with an explicit interface (`check` / `record` /
 * `size` / `reset`) so a different backend (persistent JSONL, redis, ...) can
 * be swapped in without touching callers.
 */
export class LruDedup {
  /**
   * @param {object} [opts]
   * @param {number} [opts.maxSize=10000] - max distinct dedup keys kept in memory.
   * @param {number} [opts.ttlMs=0] - 0 => keys never expire by time.
   */
  constructor(opts = {}) {
    this.maxSize = opts.maxSize ?? 10000
    this.ttlMs = opts.ttlMs ?? 0
    this._seen = new Map() // key -> timestamp (ms)
    this.dropped = 0
    this.accepted = 0
  }

  /**
   * Return true if `key` was already recorded (duplicate). Does not mutate.
   */
  check(key) {
    if (!key) return false
    const t = this._seen.get(key)
    if (t === undefined) return false
    if (this.ttlMs > 0 && Date.now() - t >= this.ttlMs) {
      this._seen.delete(key)
      return false
    }
    return true
  }

  /**
   * Return true if `key` was accepted (new). Records it and evicts LRU head
   * once the store is over capacity.
   */
  record(key) {
    if (!key) return true
    if (this.check(key)) return false
    if (this._seen.has(key)) {
      // refresh recency
      const t = this._seen.get(key)
      this._seen.delete(key)
      this._seen.set(key, t)
      return false
    }
    this._seen.set(key, Date.now())
    this.accepted++
    if (this._seen.size > this.maxSize) {
      const oldest = this._seen.keys().next().value
      if (oldest !== undefined) this._seen.delete(oldest)
    }
    return true
  }

  get size() {
    return this._seen.size
  }

  reset() {
    this._seen.clear()
    this.dropped = 0
    this.accepted = 0
  }
}

/**
 * Dedup an event: if its dedupKey was already seen, it is dropped and counted.
 * Pure function — the `store` may be any object exposing check/record.
 *
 * @param {object} ev - normalized IngressEvent.
 * @param {object} store - dedup store (check/record).
 * @returns {'accepted'|'duplicate'}
 */
export function dedupEvent(ev, store) {
  const key = ev?.dedupKey
  if (!key) return 'accepted' // missing key: never block
  if (store.check(key)) return 'duplicate'
  store.record(key)
  return 'accepted'
}

// ---------------------------------------------------------------------------
// Event classification
// ---------------------------------------------------------------------------

/**
 * Classify which events the channel should forward downstream. V0 forwards
 * human-sent text-ish messages that are addressed to the bot. Everything else
 * (bot self-echo, or unattended mentions in a group when not mentioned) is
 * classified but not forwarded (caller decides).
 *
 * @param {object} ev - normalized IngressEvent.
 * @returns {{forward:boolean, reason:string}}
 */
export function classifyIngress(ev) {
  if (ev.sender.selfSent || ev.sender.isBotSelf) {
    return { forward: false, reason: 'self_echo' }
  }
  if (ev.channel === 'p2p') {
    return { forward: true, reason: 'p2p' }
  }
  if (ev.channel === 'group') {
    if (ev.mentioned) return { forward: true, reason: 'group_mentioned' }
    return { forward: false, reason: 'group_not_mentioned' }
  }
  // thread: forward only when addressed (mentioned or the thread already engages us)
  if (ev.addressed) return { forward: true, reason: 'thread_addressed' }
  return { forward: false, reason: 'thread_not_addressed' }
}

// ---------------------------------------------------------------------------
// Ingress gate (V2 PREBOUND_ONLY)
// ---------------------------------------------------------------------------

/**
 * The FIXED receipt the connector itself sends when the pre-forward ingress
 * gate rejects an event (AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC §4.5:
 * structured rejection — one deterministic text, never per-reason variants).
 * @type {string}
 */
export const INGRESS_GATE_REJECTED_REPLY =
  '[agent-core] 该会话未完成绑定（not bound）：消息未送达任何 Agent，也未创建任何绑定。请联系管理员完成会话与 Agent 的预绑定。'

/**
 * Build the post-normalization ingress pipeline:
 * dedup → classify → pre-forward GATE → onEvent.
 *
 * The gate is a programmatically injected async predicate
 * (`config.ingressGate(ingress, { classify }) -> { allowed: boolean,
 * reason?: string }`), read from the LIVE config object on every event so a
 * later `setIngressGate()` (like `setCallback()`) takes effect immediately.
 * When the predicate rejects (`allowed !== true`-style: exactly
 * `allowed === false`) or THROWS, the event is dropped FAIL-CLOSED: `onEvent`
 * (the Router's onIngress) is never called — so the Router's first-contact
 * path never runs and no default Binding can be created — and the connector
 * itself replies with the fixed {@link INGRESS_GATE_REJECTED_REPLY} receipt
 * through the injected `reply(ingress)` sender (best effort).
 *
 * Pure channel-layer logic: no DSH/Router dependency, fully unit-testable.
 *
 * @param {object} p
 * @param {object} p.dedup - dedup store (check/record; see LruDedup).
 * @param {object} p.config - the LIVE plugin config object; `config.onEvent`
 *   and `config.ingressGate` are read per event.
 * @param {Function} [p.reply] - async sender for the fixed rejection receipt,
 *   invoked as `reply(ingress)`.
 * @param {Function} [p.log] - `(level, ...args)` logger.
 * @returns {Function} `async handleIngress(ingress)` — consume one normalized
 *   IngressEvent.
 */
export function createIngressPipeline({ dedup, config, reply, log = () => {} }) {
  return async function handleIngress(ingress) {
    // dedup first
    const verdict = dedupEvent(ingress, dedup)
    if (verdict === 'duplicate') {
      dedup.dropped += 1
      log('debug', `[feishu] duplicate dropped (${ingress.dedupKey})`)
      return
    }
    // classify
    const cls = classifyIngress(ingress)
    if (!cls.forward) {
      log('debug', `[feishu] not addressed, skipped (${cls.reason})`)
      return
    }
    // V2 pre-forward gate: after classify decided forward, BEFORE onEvent.
    if (typeof config.ingressGate === 'function') {
      let gateVerdict
      try {
        gateVerdict = await config.ingressGate(ingress, { classify: cls })
      } catch (error) {
        log('warn', `[feishu] ingress gate error (fail closed): ${error?.message ?? error}`)
        gateVerdict = { allowed: false, reason: 'gate_error' }
      }
      if (gateVerdict?.allowed === false) {
        log('warn', `[feishu] ingress rejected by gate (${gateVerdict.reason ?? 'unspecified'}) — not forwarded`)
        if (typeof reply === 'function') {
          try {
            await reply(ingress)
          } catch (error) {
            log('warn', `[feishu] rejection receipt failed: ${error?.message ?? error}`)
          }
        }
        return
      }
    }
    if (typeof config.onEvent === 'function') {
      try {
        await config.onEvent(ingress, { classify: cls })
      } catch (error) {
        log('error', `[feishu] onEvent callback error: ${error?.message ?? error}`)
      }
    }
  }
}
