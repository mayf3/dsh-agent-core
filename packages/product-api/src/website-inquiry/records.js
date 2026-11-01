import { randomUUID } from 'node:crypto'
import { redactInspectionText } from '../../../production-runtime/src/agent-session/projection-redaction.js'
import { VERSION, fail } from './protocol.js'
import { digest, opaque, resolutionBinding } from './codec.js'
export const iso = ms => new Date(ms).toISOString()
export const recordKey = (human, rid) => digest([human, rid])
export function authorizationDigest(entry, body, resolution, version = entry.version) {
  return digest({ contract_version: VERSION, human_principal_id: entry.human_principal_id,
    site_owner_binding_id: entry.binding_id, site_owner_binding_version: version,
    communication_scope_id: entry.communication_scope_id, request_id: body.request_id,
    purpose: body.purpose, resolution_binding: resolutionBinding(resolution), message: body.message,
    context_refs: body.context_refs, allow_create_main: body.allow_create_main })
}
export function makeRecord(entry, caller, body, resolution, now, seq) {
  const at = iso(now)
  const shell = { request_id: body.request_id, authorization_ref: `auth_whi1_${opaque()}`,
    payload_digest: authorizationDigest(entry, body, resolution), communication_scope_id: entry.communication_scope_id,
    site_owner_binding_id: entry.binding_id, resolution, purpose: body.purpose, allow_create_main: body.allow_create_main,
    authorization_expires_at: iso(Math.min(caller.exp * 1000, now + 600000)), request_status: 'AUTHORIZED',
    delivery_status: 'NOT_ATTEMPTED', execution_status: 'NOT_STARTED', reply_status: 'PENDING', side_effect_status: 'NOT_ASSESSED',
    trace: { agent_id: resolution.canonical_agent_id, session_id: 'main', session_generation: resolution.main_generation,
      native_user_message_id: null, native_turn_id: null, native_assistant_message_id: null },
    times: { submitted_at: at, authorized_at: at, attempted_at: null, inbox_accepted_at: null,
      started_at: null, finished_at: null, reply_created_at: null, result_persisted_at: null }, failure: null,
    field_availability: ['trace.native_user_message_id', 'trace.native_turn_id', 'trace.native_assistant_message_id',
      'times.attempted_at', 'times.inbox_accepted_at', 'times.started_at', 'times.finished_at', 'times.reply_created_at',
      'times.result_persisted_at'].map(field => ({ field, reason: 'NOT_STARTED' })) }
  return { shell, human: entry.human_principal_id, bindingVersion: entry.version, transport: entry.transport_principal_id,
    message: body.message, context_refs: body.context_refs, seq, result: null, content: null }
}
export function event(state, record, kind, now) {
  const value = { request_id: record.shell.request_id, kind, trace: structuredClone(record.shell.trace),
    occurred_at: iso(now), persisted_at: iso(now), result_projection_id: record.result?.projection_id ?? null }
  const event_id = `evt_whi1_${digest([record.shell.communication_scope_id, value.request_id, kind, value.trace, value.result_projection_id])}`
  if (state.events.some(e => e.event_id === event_id)) return
  state.events.push({ event_id, seq: ++state.eventSeq, ...value })
}
export function failure(record, code, stage, recovery = 'QUERY_ORIGINAL') {
  record.shell.failure = { class: code, stage, diagnostic_id: randomUUID(), recovery_owner: 'RUNTIME_OWNER', allowed_recovery: [recovery] }
}
export function ownRecord(state, entry, rid) {
  const key = recordKey(entry.human_principal_id, rid)
  const record = Object.hasOwn(state.requests, key) ? state.requests[key] : null
  if (!record || record.shell.site_owner_binding_id !== entry.binding_id) fail('NOT_FOUND_OR_NOT_VISIBLE')
  return record
}
export function commitProjection(state, record, proof, now) {
  if (!proof || proof.userMessageId !== record.shell.trace.native_user_message_id
    || proof.message !== record.message || !Number.isSafeInteger(proof.turnId) || proof.turnId < 0 || !proof.assistantMessageId) fail('TRACE_UNRESOLVABLE')
  if (proof.status !== 'completed' || typeof proof.content !== 'string' || proof.truncated || !proof.complete) fail('TRACE_UNRESOLVABLE')
  const content = redactInspectionText(proof.content)
  const projectionHash = digest(content)
  const id = `reply_whi1_${digest([record.shell.request_id, proof.userMessageId, proof.turnId, proof.assistantMessageId, projectionHash])}`
  if (record.result) {
    if (record.result.projection_id !== id) fail('EVENT_CONFLICT')
    return
  }
  record.content = content
  record.result = { projection_id: id, reply_to: proof.userMessageId, relation_source: 'exact_native_turn_projection',
    native_parent_id: proof.nativeParentId ?? null, content_bytes: Buffer.byteLength(content), projection_sha256: projectionHash,
    redacted: proof.redacted === true || content !== proof.content, truncated: false, expires_at: iso(now + 30 * 86400000), artifact_refs: [],
    field_availability: proof.nativeParentId ? [] : [{ field: 'native_parent_id', reason: 'NOT_PROJECTED' }] }
  Object.assign(record.shell.trace, { native_turn_id: proof.turnId, native_assistant_message_id: proof.assistantMessageId })
  Object.assign(record.shell, { execution_status: 'COMPLETED', reply_status: 'AVAILABLE' })
  Object.assign(record.shell.times, { result_persisted_at: iso(now), started_at: proof.startedAt ?? null, finished_at: proof.finishedAt ?? null, reply_created_at: proof.replyCreatedAt ?? null })
  record.shell.field_availability = record.shell.field_availability.filter(item => item.reason !== 'NOT_STARTED'
    || item.field.split('.').reduce((value, key) => value?.[key], record.shell) === null)
  event(state, record, 'REPLY_PERSISTED', now)
}
