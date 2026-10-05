import { ingressBindingNamespace, feishuReplyOwed } from './channel-conversation.js'
import { validatedIngressCorrelation } from './reconciliation/ingress-correlation.js'

function ownData(object, key) {
  if (object === null || typeof object !== 'object') return undefined
  const descriptor = Object.getOwnPropertyDescriptor(object, key)
  return descriptor !== undefined && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined
}

// Called only by the private connector callback. Public Router routes never
// invoke this validator or register its result in the exact-opts WeakMap.
export function authenticatedFeishuFields(ingress) {
  if (!['p2p', 'group', 'thread'].includes(ownData(ingress, 'channel'))
      || ingressBindingNamespace(ingress) !== 'feishu' || !feishuReplyOwed(ingress)) {
    throw new TypeError('authenticated Feishu ingress namespace is invalid')
  }
  const rawOpenId = ownData(ownData(ownData(ownData(ingress, 'raw'), 'sender'), 'sender_id'), 'open_id')
  const normalizedOpenId = ownData(ownData(ingress, 'sender'), 'openId')
  const conversationId = ownData(ingress, 'conversationId')
  const messageId = ownData(ingress, 'messageId')
  if (typeof rawOpenId !== 'string' || rawOpenId !== normalizedOpenId) {
    throw new TypeError('authenticated Feishu raw sender does not match normalized OpenID')
  }
  if (!/^ou_[A-Za-z0-9_-]+$/u.test(rawOpenId)
      || Buffer.byteLength(rawOpenId, 'utf8') > 256
      || typeof conversationId !== 'string' || conversationId === ''
      || Buffer.byteLength(conversationId, 'utf8') > 256
      || typeof messageId !== 'string' || messageId === ''
      || Buffer.byteLength(messageId, 'utf8') > 128) {
    throw new TypeError('authenticated Feishu ingress identity is invalid')
  }
  return { rawOpenId, conversationId, messageId }
}

export function ingressTurnOpts(ingress, namespace, channelConversationId, workspacePath, isFeishuEntry) {
  return {
    bindingContext: channelConversationId,
    // Existing public context remains an informational/canary surface. Its
    // frozen shape is never used as durable authenticated provenance.
    ingressContext: Object.freeze({
      channelNamespace: namespace,
      channelConversationId,
      feishuChatId: isFeishuEntry ? ingress.chatId : undefined,
      feishuConversationId: isFeishuEntry ? ingress.conversationId : undefined,
      feishuMessageId: isFeishuEntry ? ingress.messageId : undefined,
      feishuSenderOpenId: isFeishuEntry ? ingress.sender?.openId : undefined,
    }),
    cwd: workspacePath,
  }
}

export function authenticatedCorrelation(trusted, channelConversationId) {
  return validatedIngressCorrelation({
    channelNamespace: 'feishu',
    channelConversationId,
    feishuConversationId: trusted.conversationId,
    feishuMessageId: trusted.messageId,
    feishuSenderOpenId: trusted.rawOpenId,
  })
}
