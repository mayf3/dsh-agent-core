/**
 * @agent-core/feishu-connector/src/api.js
 *
 * Outbound Feishu IM API wrapper. Maps a uniform ReplyTarget into the actual
 * Lark node-sdk calls:
 *   - reply kind          → `im.message.reply`  with reply_in_thread when in a thread
 *   - create_thread kind  → `im.message.create` + root_id (starts/stays in the thread)
 *   - create kind         → `im.message.create` into a chat / dm, typed by receive_id_type
 *
 * V0 sends text messages (`msg_type: "text"`). Media send is out of scope.
 */

/**
 * Build a text message content JSON string for the Feishu API.
 * @param {string} text
 * @returns {string} JSON string, e.g. {"text":"hello"}.
 */
export function textContent(text) {
  return JSON.stringify({ text: String(text ?? '') })
}

/**
 * @param {object} client - Lark Client (exposes client.im.message.reply / create).
 * @param {object} replyTarget - a ReplyTarget object (returned by replyTo()/asThread()/directChat()).
 * @param {string} text - message text.
 * @param {object} [opts]
 * @param {object} [opts.log] - (level, msg) => void
 * @returns {Promise<{messageId:string, chatId:string, method:string, code?:number, msg?:string}>}
 */
export async function reply(client, replyTarget, text, opts = {}) {
  const { log = console.log } = opts
  const content = textContent(text)
  const kind = replyTarget?.kind

  if (kind === 'reply') {
    const path = { message_id: replyTarget.replyMsgId }
    const data = { content, msg_type: 'text' }
    if (replyTarget.replyInThread) data.reply_in_thread = true
    log('info', `feishu-api: reply target=${replyTarget.replyMsgId} inThread=${replyTarget.replyInThread ?? false}`)
    const response = await client.im.message.reply({ path, data })
    return toResult(response, 'reply', replyTarget)
  }

  if (kind === 'create_thread' || kind === 'create') {
    const data = { receive_id: replyTarget.receiveId, content, msg_type: 'text' }
    // Starting a new topic thread: root_id must be set when creating a message that
    // should open (or join) a Feishu topic thread. When undefined we just create a normal message.
    if (replyTarget.rootMsgId && kind === 'create_thread') {
      data.root_id = replyTarget.rootMsgId
    }
    log('info', `feishu-api: create receive_id=${replyTarget.receiveId} type=${replyTarget.receiveIdType} root=${replyTarget.rootMsgId ?? '-'}`)
    const response = await client.im.message.create({
      params: { receive_id_type: replyTarget.receiveIdType ?? 'chat_id' },
      data,
    })
    return toResult(response, 'create', replyTarget)
  }

  throw new Error(`feishu-api: unknown ReplyTarget kind "${kind}"`)
}

function toResult(response, method, replyTarget) {
  return {
    messageId: response?.data?.message_id ?? '',
    chatId: response?.data?.chat_id ?? replyTarget?.chatId ?? '',
    method,
    code: response?.code,
    msg: response?.msg,
  }
}
