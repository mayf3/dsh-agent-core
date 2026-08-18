/**
 * @agent-core/feishu-connector/src/bridge.js
 *
 * The Agent Core thin adapter over the official @larksuite/channel SDK
 * (AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1 Phase A — Foundation cutover,
 * spec §6.3 IngressEvent mapping contract + §8 pipeline ordering).
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
 *      (stale[disabled] → dedup+lock → PolicyGate requireMention=true) and
 *      BEFORE any Router involvement:
 *
 *        self-echo residual guard (sender_type bot/app — V0 classifyIngress
 *          self_echo semantics)
 *        → bot-identity fail-closed guard for group messages (spec §9: never
 *          adjudicate a group message with an unknown identity)
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
    name: typeof msg.senderName === 'string' ? msg.senderName : undefined,
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
  const mentions = msg.mentions.map((m) => ({
    key: m.key,
    openId: m.openId || '',
    name: typeof m.name === 'string' ? m.name : '',
    type: m.isBot ? 'bot' : 'user',
  }))
  if (msg.mentionAll) {
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
    text: msg.content,
    mentions,
    mentioned,
    addressed,
    attachments: (msg.resources ?? []).map(resourceAttachment),
    raw,
    timestamp: msg.createTime || (opts.now ?? Date.now()),
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
function resourceAttachment(r) {
  const isImage = r.type === 'image'
  return {
    type: r.type,
    fileKey: r.fileKey,
    name: r.fileName || undefined,
    duration: r.durationMs,
    coverImageKey: r.coverImageKey || undefined,
    downloadHint: {
      kind: isImage ? 'image' : 'file',
      endpoint: isImage ? 'im/v1/images' : 'im/v1/files',
      key: r.fileKey,
    },
  }
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

    if (typeof config.onEvent === 'function') {
      try {
        // Await the FULL turn (V0 onEvent semantics — the Router's onIngress
        // runs the agent turn and the reply before this handler resolves).
        await config.onEvent(ingress, { classify: { forward: true, reason: 'sdk_policy_admitted' } })
      } catch (error) {
        log('error', `[feishu] onEvent callback error: ${error?.message ?? error}`)
      }
    }
  }
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
