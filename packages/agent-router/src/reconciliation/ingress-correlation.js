// The only durable Feishu ingress provenance shape. The producer and V3
// validator share this exact closed vocabulary; public ingressContext is not
// an authority for these fields.
const CAPS = Object.freeze({
  channelConversationId: 256,
  feishuConversationId: 256,
  feishuMessageId: 128,
  feishuSenderOpenId: 256,
})
const KEYS = Object.freeze(['channelNamespace', ...Object.keys(CAPS)])

export function validatedIngressCorrelation(value) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || Object.keys(value).length !== KEYS.length
      || KEYS.some(key => !Object.hasOwn(value, key)
        || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))) {
    throw new TypeError('ingress correlation schema is invalid')
  }
  if (value.channelNamespace !== 'feishu') throw new TypeError('ingress correlation namespace is invalid')
  for (const [key, cap] of Object.entries(CAPS)) {
    if (typeof value[key] !== 'string' || value[key] === ''
        || Buffer.byteLength(value[key], 'utf8') > cap) {
      throw new TypeError(`ingress correlation ${key} is invalid`)
    }
  }
  if (!/^ou_[A-Za-z0-9_-]+$/u.test(value.feishuSenderOpenId)) {
    throw new TypeError('ingress correlation raw OpenID is invalid')
  }
  return Object.freeze(Object.fromEntries(KEYS.map(key => [key, value[key]])))
}
