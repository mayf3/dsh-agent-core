/**
 * @agent-core/agent-router/src/channel-conversation.js — the pure
 * ChannelConversation identity surface of the Router channel model
 * (D-002 AGENT_SESSION_CHANNEL_MODEL_V1 + merge audit FIX 1 frozen
 * namespace semantics).
 *
 * These helpers are module-level pure functions with no service
 * dependencies: thin adapters (Feishu connector, Product API surface
 * mapping M13) and the Router's own binding-resolution / ingress-delivery
 * modules share exactly one owner of the id format and of the
 * Feishu-vs-mobile namespace/reply-owed classification.
 */

/**
 * The ChannelConversation id for one (channel, externalId) pair — the
 * canonical `${channel}:${externalId}` form. Used by resolveChannelConversation
 * and by thin adapters (e.g. the Product API's surface mapping, M13:
 * `surfaceId -> ChannelConversation(channel='mobile', externalId=surfaceId)`)
 * so the id format has exactly one owner.
 * @param {string} channel - opaque channel id (feishu / mobile / …).
 * @param {string} externalId - channel-native conversation key (Feishu
 *   chatId, Android surfaceId, …).
 * @returns {string} the ChannelConversation id.
 */
export function channelConversationId(channel, externalId) {
  if (typeof channel !== 'string' || channel === ''
      || typeof externalId !== 'string' || externalId === '') {
    throw new TypeError('channelConversationId: channel and externalId (non-empty strings) are required')
  }
  return `${channel}:${externalId}`
}

/**
 * The BINDING NAMESPACE of one ingress (merge audit FIX 1, frozen semantics):
 * the Feishu connector classifies `ingress.channel` as the MESSAGE SUBTYPE
 * ('p2p' | 'group' | 'thread') — transport detail, never a Binding
 * namespace. Every Feishu ingress binds under 'feishu'
 * (`feishu:<conversationId>` durable Bindings keep matching; nothing is
 * migrated or orphaned). Only the mobile Product API entry carries its own
 * namespace ('mobile' -> `mobile:<surfaceId>`).
 * @param {{channel?: string}} ingress
 * @returns {string} 'feishu' | 'mobile'
 */
export function ingressBindingNamespace(ingress) {
  return ingress?.channel === 'mobile' ? 'mobile' : 'feishu'
}

/**
 * Whether this ingress belongs to the Feishu entry (and therefore owes a
 * Feishu reply): exactly the Feishu binding namespace. p2p/group/thread
 * subtypes all qualify; mobile Product API ingresses never do.
 * @param {{channel?: string}} ingress
 * @returns {boolean}
 */
export function feishuReplyOwed(ingress) {
  return ingressBindingNamespace(ingress) === 'feishu'
}

/**
 * Normalize a bindingContext into a ChannelConversation id. Accepts the raw
 * ccId string or the D-002-shaped `{ channelConversationId }` object so both
 * the connector (which knows the id) and a future Product API (which may
 * carry the full object) call the same domain operation.
 * @param {string | {channelConversationId?: string}} bindingContext
 * @returns {string} the ChannelConversation id.
 */
export function channelConversationIdOf(bindingContext) {
  const ccId = typeof bindingContext === 'string'
    ? bindingContext
    : bindingContext?.channelConversationId
  if (typeof ccId !== 'string' || ccId === '') {
    throw new TypeError('bindingContext must be a ChannelConversation id string or {channelConversationId}')
  }
  return ccId
}
