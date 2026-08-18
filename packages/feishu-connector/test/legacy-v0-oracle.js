/**
 * TEST-ONLY legacy differential oracle — the V0 (pre-cutover) Feishu
 * normalization, copied verbatim from the old src/core.js.
 *
 * AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1 §7.2-3 allows keeping the old
 * normalizeIngressEvent/buildConversationId as TEST-ONLY code to
 * differentially assert that the new chain (SDK normalize → thin adapter)
 * derives the SAME conversation identity. This file is NEVER imported by
 * production code (src/*) — only by tests.
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

export function resolveConversation(event) {
  const message = event?.message ?? {}
  const chatId = (message.chat_id ?? '').trim()
  const chatType = message.chat_type === 'p2p' ? 'p2p' : 'group'
  const threadId = (message.thread_id ?? '').trim() || undefined
  const rootMsgId = (message.root_id ?? '').trim() || undefined

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

function asPositiveInt(value) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

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

export function parseSender(event, botOpenId) {
  const sender = event?.sender ?? {}
  const senderId = sender?.sender_id ?? {}
  const openId = senderId.open_id ?? ''
  const unionId = senderId.union_id ?? ''
  const userId = senderId.user_id ?? ''
  const senderType = sender.sender_type ?? 'user'
  const name = typeof sender.name === 'string' ? sender.name : undefined

  const isBotSelf = Boolean(botOpenId && openId && openId === botOpenId)
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

  const mentioned =
    mentions.some(m => m.type === 'all') ||
    (botOpenId ? mentions.some(m => m.type === 'bot') : false)
  const addressed = chatType === 'p2p' ? true : mentioned

  const now = opts.now ?? Date.now()

  return {
    eventId: providerEventId,
    type: 'message',
    subType: normalizeMessageSubtype(message.message_type),
    channel: conv.channel,
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
    dedupKey: providerEventId || `message:${messageId}`,
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

function messageTypeText(message, content) {
  const messageType = message?.message_type ?? 'text'
  if (messageType === 'text') {
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
    return n > 1e12 ? n : n * 1000
  }
  return fallback
}
