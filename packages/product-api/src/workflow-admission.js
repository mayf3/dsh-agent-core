import { performance } from 'node:perf_hooks'
import { createJwksTokenVerifier } from './scheduler-auth.js'

// AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1 (CTR-IAD-001..004): the superseded
// dedicated-caller admission route (route prefix /v1/workflow-admission/agents,
// pinned SERVICE principal/client, audience workflow-agent-admission, scope
// agent.definition.admission.read, 5-second issued-at pin) is retired. This is
// now the generic internal directory read for ANY authenticated canonical
// agent or service principal; the verifier's own time policy is authoritative.
const PREFIX = '/v1/directory/agents'
const AUDIENCE = 'agent-directory'
const SCOPE = 'agent.directory.read'
const validId = id => typeof id === 'string' && id.length <= 128 && /^agt_[a-z0-9-]+$/.test(id)
const failure = (status, error) => ({ status, body: { error } })

/** Production-only exact observation; the existing verifier owns JWT semantics. */
export function createWorkflowAdmissionHandler({ definition, jwksUrl, nowMs = Date.now,
  fetchImpl = fetch, timeoutMs = 1000 }) {
  if (!(timeoutMs > 0 && timeoutMs <= 1000)) throw new TypeError('Invalid admission timeout')
  const verifier = jwksUrl ? createJwksTokenVerifier({
    jwksUrl, issuer: 'auth-service', audience: AUDIENCE, nowMs, fetchImpl,
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
      } catch { return failure(401, 'UNAUTHORIZED') }
      if (expired()) return failure(504, 'AGENT_DEFINITION_TIMEOUT')
      // CTR-IAD-002: generic internal callers — machine principals only. The
      // verifier profile already 401s human tokens; this predicate stays as
      // defense in depth. No principalId/clientId pinning: eligibility is the
      // principal type plus the baseline directory scope (presence-checked,
      // not exact-single — CTR-IAD-002 pins the audience, not a scope count).
      if (caller.principalType !== 'agent' && caller.principalType !== 'service') {
        return failure(403, 'ACCESS_DENIED')
      }
      if (!caller.scopes.has(SCOPE)) return failure(403, 'ACCESS_DENIED')
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
        // CTR-IAD-003: existence is the authorized minimal datum — a missing
        // exact ID is a 200 observation {exists:false}, not an error shape;
        // enabled reflects disabled != true. No digest, no other fields.
        return {
          status: 200,
          body: { agentId, exists: row !== undefined, enabled: row !== undefined && row.disabled !== true },
        }
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
