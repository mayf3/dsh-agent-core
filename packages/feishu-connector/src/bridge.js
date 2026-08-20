/**
 * @agent-core/feishu-connector/src/bridge.js
 *
 * The Agent Core thin adapter over the official @larksuite/channel SDK
 * (AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2 Phase A — Foundation cutover,
 * spec §3–§6 mapping, admission and full-turn contracts).
 *
 * Two pure, unit-testable pieces:
 *
 *   1. normalizedToIngressEvent(msg) — maps ONE SDK NormalizedMessage onto
 *      the EXISTING IngressEvent shape (the Router / gate / downstream
 *      contract is unchanged). No workspace/session injection (V2 §5); the
 *      dedupKey stays informational only (dedup authority = the SDK safety
 *      pipeline, which already ran before this mapping executes).
 *
 *   2. createBridgeHandler() — the SDK `message` event handler: the Agent
 *      Core admission segment that runs AFTER the SDK safety pipeline
 *      (stale[disabled] → dedup+lock → PolicyGate requireMention=false) and
 *      BEFORE any Router involvement:
 *
 *        self-echo residual guard (sender_type bot/app — V0 classifyIngress
 *          self_echo semantics)
 *        → bot-identity fail-closed guard for group messages (spec §9: never
 *          adjudicate a group message with an unknown identity)
 *        → Agent Core p2p/@bot/@all eligibility
 *        → PREBOUND_ONLY gate (the composition layer's injectable predicate;
 *          absent gate = fail-closed drop, NEVER legacy forward — spec §9
 *          startup ordering: callback + gate must be installed before the
 *          connector admits messages)
 *        → config.onEvent (the Router's onIngress; awaited for the full
 *          turn — V0 semantics).
 *
 * ZERO DSH / Cordis dependency, ZERO network I/O (the `reply` receipt sender
 * and the `resolveBotIdentity` thunk are injected).
 */

import {
  resolveConversation,
  replyTargetFor,
  replyTargetToSdkSend,
  INGRESS_GATE_REJECTED_REPLY,
} from './core.js'

// ---------------------------------------------------------------------------
// NormalizedMessage → IngressEvent (pure mapping, spec §6.3)
// ---------------------------------------------------------------------------

/**
 * Map an @larksuite/channel NormalizedMessage onto the existing IngressEvent
 * shape. Router-consumed fields keep their V0 semantics; the conversation
 * identity derivation goes through resolveConversation (V0 semantics,
 * byte-identical Binding keys).
 *
 * The SDK attaches the raw dispatcher-flattened wire event on `msg.raw`
 * (includeRawEvent: true) — it carries `event_id` and the full
 * `sender.sender_id` triple, which the NormalizedMessage surface itself
 * folds into a single `senderId`. Reading those two off the raw event is
 * field lookup, NOT re-normalization.
 *
 * @param {object} msg - SDK NormalizedMessage.
 * @param {object} [opts]
 * @param {{openId:string, name?:string}} [opts.botIdentity] - the resolved
 *   bot identity (isBotSelf flag on the sender).
 * @param {number} [opts.now] - receipt-time fallback for a missing
 *   createTime (V0 timestamp semantics).
 * @returns {object} IngressEvent (V0 shape).
 * @throws {Error} when the event is not a recognizable Feishu message event
 *   (missing message_id / invalid chat_type) — V0's drop-non-message guard.
 */
export function normalizedToIngressEvent(msg, opts = {}) {
  const messageId = (msg?.messageId ?? '').trim() || ''
  const chatType = msg?.chatType

  if (chatType !== 'p2p' && chatType !== 'group') {
    throw new Error(`invalid_or_missing_chat_type: got ${String(chatType)}`)
  }
  if (!messageId) {
    throw new Error('invalid_or_missing_message_id')
  }

  const raw = msg.raw
  const rawSenderIds = raw?.sender?.sender_id ?? {}
  const providerEventId = String(raw?.event_id ?? '').trim()

  const conv = resolveConversation({
    chatId: msg.chatId,
    chatType: msg.chatType,
    threadId: msg.threadId,
    rootId: msg.rootId,
  })

  const openId = rawSenderIds.open_id || msg.senderId || ''
  const unionId = rawSenderIds.union_id || ''
  const userId = rawSenderIds.user_id || ''
  const senderType = msg.senderType ?? 'user'
  const botOpenId = opts.botIdentity?.openId
  const isBotSelf = Boolean(botOpenId && openId && openId === botOpenId)

  const sender = {
    openId,
    unionId: unionId || undefined,
    userId: userId || undefined,
    name: typeof msg.senderName === 'string'
      ? msg.senderName
      : (typeof raw?.sender?.name === 'string' ? raw.sender.name : undefined),
    senderType,
    isBotSelf,
    // If the sender itself is the bot/app, its own echo is not a user turn
    // (V0 parseSender semantics; consumed by the bridge self-echo guard).
    selfSent: senderType === 'bot' || senderType === 'app',
    senderId: msg.senderId || openId || unionId || userId || '',
  }

  // V0 mentions shape: the SDK mention list (@all entries excluded, bot
  // mention flagged) plus a synthesized '@_all' entry when the SDK detected
  // an @all — so `mentioned` and the mention list stay V0-shaped.
  const rawMessage = raw?.message ?? {}
  const rawMentions = Array.isArray(rawMessage.mentions) ? rawMessage.mentions : []
  const normalizedMentionByKey = new Map((msg.mentions ?? []).map((mention) => [mention?.key, mention]))
  const mentions = rawMentions.flatMap((rawMention) => {
    const m = normalizedMentionByKey.get(rawMention?.key) ?? {}
    const ids = rawMention?.id ?? {}
    const openId = m.openId || ids.open_id || rawMention?.open_id || ''
    if (!openId && !String(rawMention?.key ?? '').toLowerCase().startsWith('@_all')) return []
    if (!openId) {
      return [{ key: rawMention.key, openId: '', name: typeof rawMention.name === 'string' ? rawMention.name : '', type: 'all' }]
    }
    return [{
      key: rawMention.key,
      openId,
      unionId: ids.union_id || undefined,
      userId: m.userId || ids.user_id || undefined,
      name: typeof rawMention.name === 'string' ? rawMention.name : (typeof m.name === 'string' ? m.name : ''),
      type: m.isBot || (opts.botIdentity?.openId && openId === opts.botIdentity.openId) ? 'bot' : 'user',
    }]
  })
  if (msg.mentionAll && !mentions.some((mention) => mention.type === 'all')) {
    mentions.push({ key: '@_all', openId: '', name: '', type: 'all' })
  }

  const mentioned = msg.mentionAll || msg.mentionedBot === true
  const addressed = conv.chatType === 'p2p' ? true : mentioned

  return {
    // Pure ingress event shape (V0 contract — Router/downstream unchanged).
    eventId: providerEventId,
    type: 'message',
    subType: normalizeMessageSubtype(msg.rawContentType),
    channel: conv.channel, // 'p2p' | 'group' | 'thread' — message subtype, NOT a Binding namespace
    chatType: conv.chatType,
    conversationId: conv.conversationId,
    chatId: conv.chatId,
    threadId: conv.threadId,
    rootMsgId: conv.rootMsgId,
    parentMsgId: (msg.replyToMessageId ?? '').trim() || undefined,
    messageId,
    messageType: msg.rawContentType ?? 'text',
    sender,
    text: ingressText(msg),
    mentions,
    mentioned,
    addressed,
    attachments: ingressAttachments(msg.resources, rawMessage.content, msg.rawContentType),
    raw,
    timestamp: normalizeTimestamp(msg.createTime, opts.now ?? Date.now()),
    // AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC §5 (accepted): the V2
    // normal Feishu path MUST NOT inject or select a conversation workspace /
    // session. No `workspace` / `session` fields are attached.
    // Informational only — the dedup authority is the SDK safety pipeline
    // (SeenCache + ProcessingLock, by messageId); the connector never re-
    // dedups on this key.
    dedupKey: providerEventId || `message:${messageId}`,
  }
}

/**
 * Map an SDK ResourceDescriptor onto the V0 attachment descriptor shape
 * (metadata only; content delivery is Phase B, out of scope).
 */
function resourceAttachment(r, rawContent, messageType) {
  const isImage = r.type === 'image'
  const metadata = findRawResourceMetadata(rawContent, r.fileKey)
  const base = {
    type: r.type,
    fileKey: r.fileKey,
    downloadHint: {
      kind: isImage ? 'image' : 'file',
      endpoint: isImage ? 'im/v1/images' : 'im/v1/files',
      key: r.fileKey,
    },
  }
  if (r.type === 'image') {
    return messageType === 'post'
      ? { ...base, name: r.fileName || metadata?.alt || undefined }
      : base
  }
  if (r.type === 'file') {
    return {
      ...base,
      name: r.fileName || metadata?.file_name || undefined,
      sizeBytes: positiveInt(metadata?.file_size),
    }
  }
  if (r.type === 'audio') {
    return { ...base, duration: positiveInt(r.durationMs) ?? positiveInt(metadata?.duration) }
  }
  if (r.type === 'video') {
    return {
      ...base,
      name: r.fileName || metadata?.file_name || undefined,
      duration: positiveInt(r.durationMs) ?? positiveInt(metadata?.duration),
      coverImageKey: r.coverImageKey || metadata?.image_key || undefined,
    }
  }
  return base
}

/**
 * Keep the SDK resource list authoritative, then mechanically add only post
 * file-link metadata that the pinned SDK does not expose as a resource. Raw
 * content is never used to select text, mentions, eligibility, conversation
 * identity or message dispatch.
 */
function ingressAttachments(resources, rawContent, messageType) {
  const attachments = (resources ?? []).map((resource) => resourceAttachment(resource, rawContent, messageType))
  if (messageType === 'post') {
    attachments.push(...projectPostFileLinkAttachments(rawContent))
  }
  return attachments
}

/**
 * Project `<a href="file/...">` / `url` blocks from includeRawEvent into the
 * existing attachment ABI. Duplicate file keys remain separate occurrences:
 * collapsing them would itself discard link-level attachment information.
 */
function projectPostFileLinkAttachments(rawContent) {
  let parsed = rawContent
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed) } catch { return [] }
  }

  const attachments = []
  const visit = (value) => {
    if (value === null || typeof value !== 'object') return
    if (!Array.isArray(value)) {
      const href = typeof value.href === 'string' ? value.href : ''
      if ((value.tag === 'a' || value.tag === 'url') && href.startsWith('file/')) {
        const fileKey = href.slice('file/'.length)
        if (fileKey) {
          attachments.push({
            type: 'file',
            fileKey,
            name: typeof value.text === 'string' && value.text ? value.text : undefined,
            sizeBytes: positiveInt(value.file_size),
            downloadHint: { kind: 'file', endpoint: 'im/v1/files', key: fileKey },
          })
        }
        return
      }
    }
    for (const child of Array.isArray(value) ? value : Object.values(value)) visit(child)
  }
  visit(parsed)
  return attachments
}

/**
 * Keep the SDK as the only Agent-facing text normalizer. Non-text placeholders
 * are derived solely from the SDK's normalized type/resources. Post text is
 * the SDK-normalized Markdown byte-for-byte (never rebuilt from raw content);
 * raw projection remains attachment-metadata-only.
 */
function ingressText(msg) {
  switch (msg.rawContentType) {
    case 'text':
      return msg.content
    case 'post':
      return msg.content
    case 'image':
      return '[image]'
    case 'file': {
      const name = msg.resources?.find((resource) => resource.type === 'file')?.fileName
      return `[file${name ? ` ${name}` : ''}]`
    }
    case 'audio':
      return '[audio]'
    case 'video':
      return '[video]'
    case 'sticker':
      return '[sticker]'
    default:
      return msg.content ?? ''
  }
}

function normalizeTimestamp(value, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n > 1e12 ? n : n * 1000
}

function positiveInt(value) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

/**
 * Raw-event use is deliberately metadata-only: locate the SDK resource's
 * already-selected file key and mechanically project fields the public
 * ResourceDescriptor omits. This function never chooses a message converter,
 * mention eligibility, conversation identity or supported msg_type.
 */
function findRawResourceMetadata(rawContent, fileKey) {
  let parsed = rawContent
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed) } catch { return undefined }
  }
  const visit = (value) => {
    if (value === null || typeof value !== 'object') return undefined
    if (value.file_key === fileKey || value.image_key === fileKey) return value
    for (const child of Array.isArray(value) ? value : Object.values(value)) {
      const found = visit(child)
      if (found !== undefined) return found
    }
    return undefined
  }
  return visit(parsed)
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

// ---------------------------------------------------------------------------
// Bridge admission handler (spec §8 pipeline ordering + §9 lifecycle)
// ---------------------------------------------------------------------------

/**
 * Build the SDK `message` event handler. Runs AFTER the SDK safety pipeline;
 * owns the Agent Core admission segment:
 *
 *   self-echo drop → group identity fail-closed → PREBOUND_ONLY gate →
 *   onEvent (awaited for the full turn).
 *
 * @param {object} p
 * @param {() => {openId:string, name?:string}} p.resolveBotIdentity - thunk
 *   returning the resolved bot identity; THROWS when unresolved (the SDK's
 *   getBotIdentity contract — connect() resolves it before any event).
 * @param {object} p.config - the LIVE plugin config object; `config.onEvent`
 *   and `config.ingressGate` are read per event (setCallback /
 *   setIngressGate take effect immediately).
 * @param {Function} [p.reply] - async sender for the fixed rejection
 *   receipt, invoked as `reply(ingressEvent)`.
 * @param {Function} [p.log] - `(level, ...args)` logger.
 * @returns {Function} `async onSdkMessage(normalizedMessage)` — consume one
 *   SDK NormalizedMessage.
 */
export function createBridgeHandler({ resolveBotIdentity, config, reply, log = () => {} }) {
  return async function onSdkMessage(msg) {
    let ingress
    try {
      ingress = normalizedToIngressEvent(msg, {
        botIdentity: safeBotIdentity(resolveBotIdentity),
        now: Date.now(),
      })
    } catch (error) {
      log('warn', `[feishu] drop non-message event: ${error?.message ?? error}`)
      return
    }

    // Self-echo residual guard (the only classifyIngress semantics the SDK
    // does not own): the bot's own outgoing messages echo back through the
    // connection and must never become user turns.
    if (ingress.sender.selfSent || ingress.sender.isBotSelf) {
      log('debug', `[feishu] self-echo dropped (${ingress.messageId})`)
      return
    }

    // BOT_IDENTITY_BEFORE_INGRESS, defense-in-depth (spec §9): a group
    // message must never be adjudicated/forwarded while the bot identity is
    // unknown (V0's silent null-identity defect). Normal ordering makes this
    // unreachable (connect() resolves identity before the WS handshake); if
    // the impossible happens anyway — error log + fail-closed drop.
    if (ingress.chatType === 'group') {
      const identity = safeBotIdentity(resolveBotIdentity)
      if (!identity?.openId) {
        log('error', `[feishu] bot identity unresolved before group ingress (${ingress.conversationId}) — fail-closed drop ${ingress.messageId}`)
        return
      }
    }

    // The SDK's global PolicyGate deliberately uses requireMention=false so
    // it does not erase V0 @all-only messages. Agent Core owns the residual
    // product eligibility after the SDK lease is acquired: p2p, @bot and
    // @all proceed; an ordinary group/topic no-mention is a silent drop.
    if (ingress.chatType !== 'p2p' && ingress.mentioned !== true) {
      log('debug', `[feishu] ordinary no-mention message dropped (${ingress.messageId})`)
      return
    }

    // PREBOUND_ONLY gate is REQUIRED before anything reaches the Router
    // callback (spec §9 startup ordering: a message admitted with no gate
    // installed would bypass V2 admission entirely — fail closed, never the
    // V0 legacy forward).
    if (typeof config.ingressGate !== 'function') {
      log('error', '[feishu] ingress gate not installed — fail-closed drop (wire setIngressGate before admitting messages)')
      return
    }

    let gateVerdict
    try {
      gateVerdict = await config.ingressGate(ingress, { classify: { forward: true, reason: 'sdk_policy_admitted' } })
    } catch (error) {
      log('warn', `[feishu] ingress gate error (fail closed): ${error?.message ?? error}`)
      gateVerdict = { allowed: false, reason: 'gate_error' }
    }
    const gateAllowed = gateVerdict !== null
      && typeof gateVerdict === 'object'
      && !Array.isArray(gateVerdict)
      && gateVerdict.allowed === true
    if (!gateAllowed) {
      log('warn', `[feishu] ingress rejected by gate (${gateVerdict?.reason ?? 'invalid_or_unspecified'}) — not forwarded`)
      if (typeof reply === 'function') {
        try {
          await reply(ingress)
        } catch (error) {
          log('warn', `[feishu] rejection receipt failed: ${error?.message ?? error}`)
        }
      }
      return
    }

    if (typeof config.onEvent !== 'function') return

    // Await the FULL current-main Router turn, including AgentProcess.turn
    // and final success/error reply handling. Router's current public seam
    // returns `{error}` after its best-effort failure reply; preserve that as
    // a rejected handler Promise so the reviewed SDK emits channel.error
    // exactly once while retaining the renewable ProcessingLease through
    // handler settlement and cleanup.
    const outcome = await config.onEvent(ingress, { classify: { forward: true, reason: 'sdk_policy_admitted' } })
    if (outcome !== null && typeof outcome === 'object' && outcome.error !== undefined) {
      throw asError(outcome.error)
    }
    return outcome
  }
}

function asError(value) {
  if (value instanceof Error) return value
  return new Error(typeof value?.message === 'string' ? value.message : String(value))
}

/** Resolve the bot identity without letting a not-yet-resolved throw escape. */
function safeBotIdentity(resolveBotIdentity) {
  if (typeof resolveBotIdentity !== 'function') return undefined
  try {
    return resolveBotIdentity()
  } catch {
    return undefined
  }
}

/**
 * Build the fixed-rejection-receipt sender over an SDK channel (the bridge's
 * injected `reply`): replies into the SAME conversation the rejected message
 * came from, with the byte-frozen INGRESS_GATE_REJECTED_REPLY text.
 *
 * @param {object} channel - the @larksuite/channel instance (send surface).
 * @param {Function} [log] - logger.
 * @returns {Function} `async receiptReply(ingressEvent)`.
 */
export function createReceiptReply(channel, log = () => {}) {
  return async function receiptReply(ingress) {
    const target = replyTargetFor(ingress).replyTo(ingress.messageId)
    const { to, input, opts } = replyTargetToSdkSend(target, INGRESS_GATE_REJECTED_REPLY)
    const result = await channel.send(to, input, opts)
    if (!result?.messageId) {
      throw new Error('feishu-connector: rejection receipt returned no message_id')
    }
    log('info', `[feishu] rejection receipt sent (${result.messageId})`)
    return result
  }
}
