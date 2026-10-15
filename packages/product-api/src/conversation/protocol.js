import { createHash, randomBytes } from 'node:crypto'
export const CONTRACT_VERSION = 'native-conversation-v1'
export const requestIdValid = value => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value)
export const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}' : JSON.stringify(value)
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex')
export const nativeId = (subject, scope, request) => 'mcpnc-' + hash([subject, scope, request])
export function fault(className, httpStatus = 400) { return Object.assign(new Error(className), { className, httpStatus }) }
export function failure(error, request_id) {
  const classification = error?.className ?? 'UPSTREAM_UNAVAILABLE'
  return { status: error?.httpStatus ?? 503, body: { status: 'ERROR', contract_version: CONTRACT_VERSION,
    ...(requestIdValid(request_id) ? { request_id } : {}), error: { class: classification },
    diagnostic_id: randomBytes(8).toString('hex'), retryable: false,
    retry_preconditions: ['RESULT_PERSIST_FAILED','RESULT_UNRECOVERABLE','UPSTREAM_UNAVAILABLE','OUTCOME_UNKNOWN'].includes(classification) ? ['query_original_request_only'] : [] } }
}
export function exactObject(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || required.some(k => !Object.hasOwn(value,k))
    || Object.keys(value).some(k => !required.includes(k) && !optional.includes(k))) throw fault('INVALID_ARGUMENTS')
}
export const opaque = (value, max = 4096) => typeof value === 'string' && value.length >= 1 && value.length <= max
export function validateArgs(operation, body) {
  if (operation === 'resolve') {
    exactObject(body, ['target'])
    exactObject(body.target, [], ['agent_id','workflow_instance_id'])
    if (Object.keys(body.target).length !== 1) throw fault('INVALID_ARGUMENTS')
    if (body.target.workflow_instance_id !== undefined) throw fault('NOT_SUPPORTED', 501)
    if (typeof body.target.agent_id !== 'string' || !/^agt_[A-Za-z0-9_-]{1,124}$/.test(body.target.agent_id)) throw fault('INVALID_ARGUMENTS')
  } else if (operation === 'send') {
    exactObject(body, ['request_id','target_handle','message'], ['reply_to','workflow_refs'])
    if (!requestIdValid(body.request_id) || !opaque(body.target_handle) || typeof body.message !== 'string'
      || Buffer.byteLength(body.message,'utf8') < 1 || Buffer.byteLength(body.message,'utf8') > 65536 || body.message.includes('\0')) throw fault('INVALID_ARGUMENTS')
    if (body.reply_to !== undefined || (body.workflow_refs !== undefined && (!Array.isArray(body.workflow_refs) || body.workflow_refs.length))) throw fault('NOT_SUPPORTED', 501)
  } else if (operation === 'result') {
    exactObject(body, ['request_id'], ['reply_cursor'])
    if (!requestIdValid(body.request_id) || (body.reply_cursor !== undefined && !opaque(body.reply_cursor))) throw fault('INVALID_ARGUMENTS')
  } else throw fault('NOT_SUPPORTED', 501)
}
