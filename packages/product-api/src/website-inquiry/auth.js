import { createPublicKey, verify } from 'node:crypto'
import { fail, uuidValid } from './protocol.js'
const HUMAN = 'agent-core-website-human-v1'
const MACHINE = 'agent-core-website-transport-v1'
const scopes = { redeem: 'conversation.intent.redeem', read: 'conversation.own_result.read', events: 'conversation.own_events.read' }
const COMMON = ['iss', 'sub', 'aud', 'principal_type', 'client_id', 'token_use', 'type', 'version', 'jti', 'iat', 'nbf', 'exp']
export function createInquiryAuthenticator({ jwksUrl, fetchImpl = fetch, now = Date.now } = {}) {
  let cache
  async function keys(signal) {
    if (!jwksUrl || !jwksUrl.startsWith('https://')) fail('NOT_PROVISIONED')
    try {
      const response = await fetchImpl(jwksUrl, { redirect: 'error', signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(5000)]) })
      if (!response.ok) fail('AUTH_INCONCLUSIVE')
      const data = await response.json()
      if (!Array.isArray(data.keys) || data.keys.length > 100) fail('AUTH_INCONCLUSIVE')
      cache = { at: now(), keys: data.keys }
    } catch { fail('AUTH_INCONCLUSIVE') }
    return cache.keys
  }
  async function claims(token, kind, signal) {
    let header, payload
    const parts = typeof token === 'string' ? token.split('.') : []
    try {
      if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p)) || token.length > 16384) fail('UNAUTHENTICATED')
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    } catch { fail('UNAUTHENTICATED') }
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid || header.crit) fail('UNAUTHENTICATED')
    let jwks = cache && now() - cache.at < 300000 ? cache.keys : await keys(signal)
    let matches = jwks.filter(key => key.kid === header.kid)
    if (matches.length === 0) { jwks = await keys(signal); matches = jwks.filter(key => key.kid === header.kid) }
    if (matches.length !== 1) fail('UNAUTHENTICATED')
    const key = matches[0]
    if (key.kty !== 'RSA' || (key.alg && key.alg !== 'RS256') || (key.use && key.use !== 'sig')) fail('UNAUTHENTICATED')
    try {
      if (!verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) fail('UNAUTHENTICATED')
    } catch { fail('UNAUTHENTICATED') }
    const allowed = kind === 'human' ? COMMON : [...COMMON, 'scope']
    if (!payload || Array.isArray(payload) || Object.keys(payload).length !== allowed.length
      || allowed.some(k => !Object.hasOwn(payload, k)) || Object.keys(payload).some(k => !allowed.includes(k))) fail('UNAUTHENTICATED')
    if (payload.iss !== 'auth-service' || !uuidValid(payload.sub) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(payload.sub) || payload.aud !== (kind === 'human' ? HUMAN : MACHINE)
      || payload.principal_type !== (kind === 'human' ? 'user' : 'service') || payload.token_use !== 'access'
      || payload.type !== 'access' || payload.version !== 'v1' || typeof payload.jti !== 'string' || payload.jti.length < 16
      || typeof payload.client_id !== 'string' || !payload.client_id) fail('UNAUTHENTICATED')
    const clock = now() / 1000
    if (['iat', 'nbf', 'exp'].some(k => !Number.isSafeInteger(payload[k]) || payload[k] < 0)
      || payload.nbf > payload.iat || payload.iat >= payload.exp || payload.exp - payload.iat > (kind === 'human' ? 900 : 600)
      || payload.iat > clock + 60 || payload.nbf > clock + 60 || payload.exp <= clock - 60) fail('UNAUTHENTICATED')
    if (kind === 'human' && payload.client_id !== 'project-progress-desk-web-v1') fail('FORBIDDEN')
    // SERVICE client/Principal eligibility is exact current registry authority,
    // checked by service.access before any target/result read or admission.
    return payload
  }
  return {
    async human(authorization, signal) {
      if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9_.-]+$/.test(authorization)) fail('UNAUTHENTICATED')
      const value = await claims(authorization.slice(7), 'human', signal)
      return Object.freeze({ kind: 'human', principalId: value.sub, clientId: value.client_id, exp: value.exp })
    },
    async controller(authorization, operation, signal) {
      if (!scopes[operation]) fail('FORBIDDEN')
      if (typeof authorization !== 'string' || !/^Basic [A-Za-z0-9+/]+={0,2}$/.test(authorization)) fail('UNAUTHENTICATED')
      let response
      try {
        response = await fetchImpl('https://auth.mayf3.com/oauth/token', { method: 'POST', redirect: 'error',
          headers: { authorization, 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'client_credentials', resource: MACHINE, scope: scopes[operation] }),
          signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(5000)]) })
      } catch { fail('AUTH_INCONCLUSIVE') }
      if (response.status === 401) fail('UNAUTHENTICATED')
      if (response.status === 403) fail('FORBIDDEN')
      if (!response.ok) fail('AUTH_INCONCLUSIVE')
      let issuance
      try { issuance = await response.json() } catch { fail('AUTH_INCONCLUSIVE') }
      if (issuance.token_type !== 'Bearer' || typeof issuance.access_token !== 'string') fail('AUTH_INCONCLUSIVE')
      let value
      try { value = await claims(issuance.access_token, 'controller', signal) }
      catch (error) { if (error.code === 'FORBIDDEN') throw error; fail('AUTH_INCONCLUSIVE') }
      if (value.scope !== scopes[operation]) fail('FORBIDDEN')
      return Object.freeze({ kind: 'controller', principalId: value.sub, clientId: value.client_id })
    },
  }
}
