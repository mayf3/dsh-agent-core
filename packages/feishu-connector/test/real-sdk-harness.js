import { createLarkChannel } from '@larksuite/channel'

import { FOUNDATION_LARK_CHANNEL_OPTIONS } from '../src/core.js'

export const TEST_BOT_IDENTITY = Object.freeze({ openId: 'ou_bot_self', name: 'my-bot' })

/**
 * Offline injection through the reviewed runtime's real EventDispatcher and
 * SafetyPipeline. Private members are touched only to replace network setup;
 * assertions use the public message/error observer surfaces.
 */
export function realSdkChannel({ safety, onMessage, onError, logger } = {}) {
  const channel = createLarkChannel({
    appId: 'cli_real_sdk_test',
    appSecret: 'test',
    transport: 'webhook',
    ...FOUNDATION_LARK_CHANNEL_OPTIONS,
    ...(safety === undefined ? {} : {
      safety: { ...FOUNDATION_LARK_CHANNEL_OPTIONS.safety, ...safety },
    }),
    logger: logger ?? { debug() {}, info() {}, warn() {}, error() {} },
  })
  if (onMessage) channel.on('message', onMessage)
  if (onError) channel.on('error', onError)
  channel.botIdentity = TEST_BOT_IDENTITY
  channel.safety.setBotIdentity(TEST_BOT_IDENTITY)
  channel.registerDispatcherHandlers()
  return channel
}

export function dispatchEnvelope(channel, envelope) {
  return channel.dispatcher.invoke(envelope, { needCheck: false })
}

export function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve))
}
