import { randomUUID } from 'node:crypto'
export const VERSION = 'website-human-inquiry-v1'
const statuses = {
  UNAUTHENTICATED: 401, FORBIDDEN: 403, VALIDATION_ERROR: 400,
  NOT_FOUND_OR_NOT_VISIBLE: 404, REQUEST_CONFLICT: 409, BINDING_CHANGED: 409,
  SESSION_GENERATION_CHANGED: 409, CURSOR_STALE: 409, EVENT_CURSOR_EXPIRED: 409,
  RESOURCE_LIMIT: 413, RESULT_EXPIRED: 410,
}
export function fail(code = 'VALIDATION_ERROR') {
  throw Object.assign(new Error(code), { code, status: statuses[code] ?? 503 })
}
export function errorEnvelope(error) {
  const code = Object.hasOwn(statuses, error?.code) || [
    'NOT_SUPPORTED', 'NOT_PROVISIONED', 'AUTH_INCONCLUSIVE', 'SOURCE_UNAVAILABLE',
    'TRACE_UNRESOLVABLE', 'EVENT_CONFLICT', 'RESULT_PERSIST_FAILED', 'RESULT_UNRECOVERABLE',
  ].includes(error?.code) ? error.code : 'SOURCE_UNAVAILABLE'
  return { status: statuses[code] ?? 503, body: { contract_version: VERSION,
    error: { class: code, diagnostic_id: randomUUID(), retryable: false, retry_preconditions: [] } } }
}
export const ridValid = value => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value) && !['.', '..'].includes(value)
export const tokenValid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,2048}$/.test(value)
export const uuidValid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
export function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail()
}
function messageValid(message) {
  return typeof message === 'string' && message.trim() !== '' && !message.includes('\0')
    && Buffer.byteLength(message) <= 65536 && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(message)
}
export function validateBody(operation, body) {
  if (operation === 'resolve') {
    if (Object.hasOwn(body ?? {}, 'workflow_instance_id')) {
      exact(body, ['workflow_instance_id'])
      if (!uuidValid(body.workflow_instance_id)) fail()
    } else exact(body, [])
    return body
  }
  const keys = operation === 'authorize'
    ? ['request_id', 'target_handle', 'message', 'purpose', 'context_refs', 'allow_create_main']
    : ['message', 'context_refs']
  exact(body, keys)
  if (!messageValid(body.message) || !Array.isArray(body.context_refs) || body.context_refs.length > 20) fail()
  for (const ref of body.context_refs) {
    exact(ref, ['ref_id', 'version', 'digest'])
    if (typeof ref.ref_id !== 'string' || !/^ctx_whi1_[A-Za-z0-9_-]+$/.test(ref.ref_id) || ref.ref_id.length > 128
      || typeof ref.version !== 'string' || !ref.version || Buffer.byteLength(ref.version) > 128
      || typeof ref.digest !== 'string' || !/^[a-f0-9]{64}$/.test(ref.digest)) fail()
  }
  if (operation === 'authorize' && (!ridValid(body.request_id) || !tokenValid(body.target_handle)
    || body.purpose !== 'workflow_facts' || typeof body.allow_create_main !== 'boolean')) fail()
  return body
}
export function parseWebsiteRoute(method, raw) {
  const match = /^(\/internal)?\/v1\/website-inquiries(\/[^?]*)?(?:\?([^#]*))?$/.exec(raw)
  if (!match || raw.includes('%') || raw.includes('#') || raw.includes('\\')) fail()
  const internal = Boolean(match[1])
  const path = match[2] ?? ''
  const query = new URLSearchParams(match[3] ?? '')
  if (method === 'POST' && raw.includes('?')) fail()
  let operation
  let requestId
  if (!internal && method === 'POST' && path === '/resolve') operation = 'resolve'
  if (!internal && method === 'POST' && path === '/authorizations') operation = 'authorize'
  if (!internal && method === 'GET' && path === '/history') operation = 'history'
  if (method === 'GET' && path === '/events') operation = 'events'
  const request = /^\/requests\/([A-Za-z0-9._:-]+)(\/redeem)?$/.exec(path)
  if (request && ridValid(request[1])) {
    requestId = request[1]
    if (method === 'GET' && !request[2]) operation = 'read'
    if (internal && method === 'POST' && request[2]) operation = 'redeem'
  }
  if (!operation) fail()
  const allowed = { read: ['content_cursor'], history: ['limit', 'before', 'agent_id', 'workflow_instance_id', 'request_id'],
    events: ['limit', 'cursor', 'request_id'] }[operation] ?? []
  const seen = new Set()
  for (const [key, value] of query) {
    if (!allowed.includes(key) || seen.has(key)) fail()
    seen.add(key)
    if (key === 'limit' && !/^(?:[1-9][0-9]?|100)$/.test(value)) fail()
    if (['before', 'cursor', 'content_cursor'].includes(key) && !tokenValid(value)) fail()
    if (key === 'request_id' && !ridValid(value)) fail()
    if (key === 'workflow_instance_id' && !uuidValid(value)) fail()
    if (key === 'agent_id' && (value.length > 128 || !/^agt_[A-Za-z0-9_-]+$/.test(value))) fail()
  }
  return { internal, operation, requestId, query: Object.fromEntries(query) }
}
