import { createHash } from 'node:crypto'

/** CIB complete-body wire checks shared by mapping and the trusted handler. */
export const COMPLETE_BODY_ID = 'workflow_current_task_body_complete'
export const COMPLETE_LIMITS = Object.freeze({ body: 131072, page: 8192, entity: 65536,
  total: 2097152, attempts: 32, deadline: 30000, success: 1048576, failure: 4096 })
export const COMPLETE_ERRORS = ['current_task_body_protocol_error', 'current_task_body_digest_mismatch',
  'current_task_body_limit_exceeded', 'current_task_body_deadline_exceeded']
const uuidFields = ['workflowInstanceId', 'expectedDefinitionVersionId', 'expectedNodeVisitId',
  'expectedContextRevisionId', 'bodyId']
const requestKeys = [...uuidFields, 'expectedWorkflowStateVersion', 'bodyKind', 'expectedBodySha256']

export function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}

export function canonicalUuid(value) {
  if (typeof value !== 'string') return undefined
  let text = value
  if (text.startsWith('urn:uuid:')) text = text.slice(9)
  else if (text.startsWith('{') && text.endsWith('}')) text = text.slice(1, -1)
  if (!/^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(text)) return undefined
  const h = text.replaceAll('-', '').toLowerCase()
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function completeArguments(input) {
  if (!exactKeys(input, requestKeys)) return undefined
  const args = { ...input }
  for (const field of uuidFields) {
    args[field] = canonicalUuid(input[field])
    if (!args[field]) return undefined
  }
  if (!Number.isSafeInteger(args.expectedWorkflowStateVersion) || args.expectedWorkflowStateVersion < 1
    || !['CURRENT_DETAIL', 'SUBMISSION_PAYLOAD'].includes(args.bodyKind)
    || typeof args.expectedBodySha256 !== 'string' || !/^[0-9a-f]{64}$/.test(args.expectedBodySha256)
    || (args.bodyKind === 'CURRENT_DETAIL' && args.bodyId !== args.expectedNodeVisitId)) return undefined
  return args
}

/** Parent RPC success is data, not authority to relabel an incomplete original. */
export function validCompleteResult(result, input) {
  const args = completeArguments(input)
  if (!args || !exactKeys(result, ['view', 'binding', 'body', 'verification']) || result.view !== 'complete_body') return false
  const binding = { workflow_instance_id: args.workflowInstanceId, definition_version_id: args.expectedDefinitionVersionId,
    node_visit_id: args.expectedNodeVisitId, workflow_state_version: args.expectedWorkflowStateVersion, context_revision_id: args.expectedContextRevisionId }
  if (!exactKeys(result.binding, Object.keys(binding)) || Object.entries(binding).some(([key, value]) => result.binding[key] !== value)) return false
  const b = result.body, v = result.verification
  if (!exactKeys(b, ['kind', 'id', 'sha256', 'encoding', 'serialization', 'total_bytes', 'offset', 'text', 'next_offset', 'content_status'])
    || b.kind !== args.bodyKind || b.id !== args.bodyId || b.sha256 !== args.expectedBodySha256
    || b.encoding !== 'utf-8' || b.serialization !== 'JCS' || b.offset !== 0 || b.next_offset !== null || b.content_status !== 'COMPLETE'
    || !Number.isSafeInteger(b.total_bytes) || b.total_bytes < 0 || b.total_bytes > COMPLETE_LIMITS.body
    || typeof b.text !== 'string' || b.text.length > COMPLETE_LIMITS.body || !b.text.isWellFormed()
    || !exactKeys(v, ['sha256_verified', 'page_count']) || v.sha256_verified !== true
    || !Number.isSafeInteger(v.page_count) || v.page_count < 1 || v.page_count > COMPLETE_LIMITS.attempts) return false
  const bytes = Buffer.from(b.text, 'utf8')
  return bytes.length === b.total_bytes && createHash('sha256').update(bytes).digest('hex') === b.sha256
    && Buffer.byteLength(JSON.stringify({ ok: true, result })) <= COMPLETE_LIMITS.success
}

export function completeFailure(error, manifest) {
  const declared = new Set((manifest?.errors ?? []).map(e => e.code))
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : undefined
  const fallback = status ? (status < 500 ? 'http_4xx' : 'http_5xx') : 'invalid_arguments'
  const code = declared.has(error?.code) ? error.code : fallback
  const safe = { code, detail: 'Complete original read failed; no partial original is available.' }
  if (status !== undefined) safe.status = status
  if (typeof error?.requestId === 'string' && /^[\x21-\x7e]{1,128}$/.test(error.requestId)) safe.requestId = error.requestId
  return { ok: false, error: safe }
}
