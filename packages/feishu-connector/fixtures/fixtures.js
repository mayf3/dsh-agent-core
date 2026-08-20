/**
 * Fixtures for the Feishu connector V0 tests — real-shaped `im.message.receive_v1`
 * envelopes, closely modeled on the SDK's WS event payload shape.
 */

// A p2p (private chat between a user and the bot) text event.
export const p2pTextEvent = {
  schema: '2.0',
  header: {
    event_id: 'evt_p2p_001',
    event_type: 'im.message.receive_v1',
    create_time: '1712000000000',
    token: 'x',
    tenant_key: 'tenant_x',
    app_id: 'cli_test',
  },
  event: {
    sender: {
      sender_id: {
        open_id: 'ou_sender_p2p',
        union_id: 'on_sender_p2p',
        user_id: 'u_sender_p2p',
      },
      sender_type: 'user',
      tenant_key: 'tenant_x',
    },
    message: {
      message_id: 'om_p2p_msg_001',
      root_id: '',
      parent_id: '',
      create_time: '1712000000000',
      chat_id: 'oc_p2p_001',
      chat_type: 'p2p',
      message_type: 'text',
      content: '{"text":"hello bot, please multiply 6 by 7"}',
      mentions: [],
    },
  },
}

// A group text event where the bot is @-mentioned.
export const groupMentionedEvent = {
  schema: '2.0',
  header: {
    event_id: 'evt_group_001',
    event_type: 'im.message.receive_v1',
    create_time: '1712000001000',
    token: 'x',
    tenant_key: 'tenant_x',
    app_id: 'cli_test',
  },
  event: {
    sender: {
      sender_id: { open_id: 'ou_sender_group', union_id: 'on_sender_group', user_id: 'u_sender_group' },
      sender_type: 'user',
    },
    message: {
      message_id: 'om_group_msg_001',
      root_id: '',
      parent_id: '',
      create_time: '1712000001000',
      chat_id: 'oc_group_001',
      chat_type: 'group',
      message_type: 'text',
      content: '{"text":"@_user_1 hi bot"}',
      mentions: [
        { key: '@_user_1', id: { open_id: 'ou_bot_self', user_id: 'u_bot', union_id: 'on_bot' }, name: 'my-bot' },
      ],
    },
  },
}

// A group event WITHOUT bot mention — should be classified not-forwarded.
export const groupUnmentionedEvent = {
  schema: '2.0',
  header: { event_id: 'evt_group_002', event_type: 'im.message.receive_v1' },
  event: {
    sender: { sender_id: { open_id: 'ou_other' }, sender_type: 'user' },
    message: {
      message_id: 'om_group_msg_002',
      root_id: '',
      parent_id: 'om_group_msg_001',
      create_time: '1712000002000',
      chat_id: 'oc_group_001',
      chat_type: 'group',
      message_type: 'text',
      content: '{"text":"just chatting among ourselves"}',
      mentions: [],
    },
  },
}

// A topic-thread reply inside a group (thread_id present).
export const threadReplyEvent = {
  schema: '2.0',
  header: { event_id: 'evt_thread_001', event_type: 'im.message.receive_v1' },
  event: {
    sender: { sender_id: { open_id: 'ou_sender_thread' }, sender_type: 'user' },
    message: {
      message_id: 'om_thread_msg_001',
      root_id: 'om_thread_root',
      parent_id: 'om_thread_root',
      create_time: '1712000003000',
      chat_id: 'oc_group_002',
      chat_type: 'group',
      thread_id: 'omt_thread_001',
      message_type: 'text',
      content: '{"text":"replying in the topic thread"}',
      mentions: [
        { key: '@_user_1', id: { open_id: 'ou_bot_self' }, name: 'my-bot' },
      ],
    },
  },
}

// A message with an image attachment.
export const imageEvent = {
  schema: '2.0',
  header: { event_id: 'evt_img_001', event_type: 'im.message.receive_v1' },
  event: {
    sender: { sender_id: { open_id: 'ou_sender_img' }, sender_type: 'user' },
    message: {
      message_id: 'om_img_msg_001',
      root_id: '',
      parent_id: '',
      create_time: '1712000004000',
      chat_id: 'oc_p2p_002',
      chat_type: 'p2p',
      message_type: 'image',
      content: '{"image_key":"img_v2_abcd","width":800,"height":600}',
      mentions: [],
    },
  },
}

// A message with a file attachment (name + size known).
export const fileEvent = {
  schema: '2.0',
  header: { event_id: 'evt_file_001', event_type: 'im.message.receive_v1' },
  event: {
    sender: { sender_id: { open_id: 'ou_sender_file' }, sender_type: 'user' },
    message: {
      message_id: 'om_file_msg_001',
      root_id: '',
      parent_id: '',
      create_time: '1712000005000',
      chat_id: 'oc_p2p_002',
      chat_type: 'p2p',
      message_type: 'file',
      content: '{"file_key":"file_v2_efgh","file_name":"report.pdf","file_size":2048}',
      mentions: [],
    },
  },
}

/** Bot self-echo: the bot sends a message, receives its own event back. */
export const botEchoEvent = {
  schema: '2.0',
  header: { event_id: 'evt_bot_001', event_type: 'im.message.receive_v1' },
  event: {
    sender: { sender_id: { open_id: 'ou_bot_self' }, sender_type: 'app' },
    message: {
      message_id: 'om_bot_msg_001',
      root_id: '',
      parent_id: '',
      create_time: '1712000006000',
      chat_id: 'oc_p2p_003',
      chat_type: 'p2p',
      message_type: 'text',
      content: '{"text":"I am the bot"}',
      mentions: [],
    },
  },
}

// The bot's own open_id, used to resolve isBotSelf / mentions-of-bot.
export const BOT_OPEN_ID = 'ou_bot_self'

/**
 * Flatten a v2 wire ENVELOPE ({schema, header, event}) into the shape the
 * Lark node-sdk EventDispatcher actually hands to event handlers
 * (RequestHandle.parse: {...rest, ...header, ...event} — header fields
 * hoisted to top level, sender/message kept nested). This is the input the
 * @larksuite/channel builtin message handler — and therefore normalize() —
 * receives in production. Test-support helper only.
 */
export function flattenV2Event(envelope) {
  const { header, event, ...rest } = envelope ?? {}
  return { ...rest, ...(header ?? {}), ...(event ?? {}) }
}
