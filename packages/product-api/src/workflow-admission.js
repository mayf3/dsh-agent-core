import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { createJwksTokenVerifier } from './scheduler-auth.js'

const PREFIX = '/v1/workflow-admission/agents'
const CALLER = 'cedb954a-3d99-4e5a-b568-d312441bcc56'
const CLIENT = 'svc-workflow-canonical-admission-v1'
const SCOPE = 'agent.definition.admission.read'
const validId = id => typeof id === 'string' && id.length <= 128 && /^agt_[a-z0-9-]+$/.test(id)
const failure = (status, error) => ({ status, body: { error } })

/** Production-only exact observation; the existing verifier owns JWT semantics. */
export function createWorkflowAdmissionHandler({ definition, jwksUrl, nowMs = Date.now,
  fetchImpl = fetch, timeoutMs = 1000 }) {
  if (!(timeoutMs > 0 && timeoutMs <= 1000)) throw new TypeError('Invalid admission timeout')
  const verifier = jwksUrl ? createJwksTokenVerifier({
    jwksUrl, issuer: 'auth-service', audience: 'workflow-agent-admission', nowMs, fetchImpl,
  }) : null

  return async function handle(req, url) {
    if (url.pathname !== PREFIX && !url.pathname.startsWith(PREFIX + '/')) return null
    const deadline = performance.now() + timeoutMs
    const expired = () => performance.now() >= deadline
    let timer
    const work = async () => {
      const header = req.headers.authorization
      const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : ''
      let caller
      try {
        if (!verifier) throw new Error('Unavailable verifier')
        caller = await verifier.verify(token)
        // The exact token was already signature/profile verified above. Read
        // its signed iat only to impose this resource's stricter age limit.
        const { iat } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
        if (nowMs() / 1000 - iat > 5) return failure(401, 'UNAUTHORIZED')
        if (caller.principalType !== 'service') return failure(401, 'UNAUTHORIZED')
      } catch { return failure(401, 'UNAUTHORIZED') }
      if (expired()) return failure(504, 'AGENT_DEFINITION_TIMEOUT')
      if (caller.principalId !== CALLER || caller.clientId !== CLIENT
        || caller.scopes.size !== 1 || !caller.scopes.has(SCOPE)) return failure(403, 'ACCESS_DENIED')
      let agentId
      try { agentId = decodeURIComponent(url.pathname.slice(PREFIX.length + 1)) }
      catch { return failure(400, 'INVALID_AGENT_ID') }
      if (req.method !== 'GET' || url.search !== '' || !validId(agentId)
        || req.headers['transfer-encoding'] !== undefined
        || (req.headers['content-length'] !== undefined && req.headers['content-length'] !== '0')) {
        return failure(400, 'INVALID_AGENT_ID')
      }
      try {
        // One synchronous, authoritative runtime snapshot. No await between
        // snapshot acquisition, uniqueness validation and enabled observation.
        const snapshot = definition.listAgents()
        if (!Array.isArray(snapshot) || snapshot.some(row => !row || !validId(row.id)
          || (row.disabled !== undefined && typeof row.disabled !== 'boolean'))
          || new Set(snapshot.map(row => row.id)).size !== snapshot.length) {
          return failure(409, 'AGENT_DEFINITION_AMBIGUOUS')
        }
        const row = snapshot.find(row => row.id === agentId)
        if (expired()) return failure(504, 'AGENT_DEFINITION_TIMEOUT')
        if (!row) return failure(404, 'AGENT_NOT_FOUND')
        if (row.disabled === true) return failure(409, 'AGENT_DISABLED')
        const observed = { agentId, enabled: true }
        const observationDigest = createHash('sha256').update(JSON.stringify(observed)).digest('hex')
        return { status: 200, body: { ...observed, observationDigest } }
      } catch { return failure(500, 'AGENT_DEFINITION_QUERY_FAILED') }
    }
    try {
      const result = await Promise.race([work(), new Promise(resolve => {
        timer = setTimeout(() => resolve(failure(504, 'AGENT_DEFINITION_TIMEOUT')), timeoutMs)
      })])
      return expired() ? failure(504, 'AGENT_DEFINITION_TIMEOUT') : result
    } finally { clearTimeout(timer) }
  }
}
