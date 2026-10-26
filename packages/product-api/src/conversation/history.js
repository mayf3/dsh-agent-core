import { ConversationStore } from './store.js'
import { CONTRACT_VERSION, fault, hash } from './protocol.js'

const MAX_RESPONSE = 1024 * 1024
const PAGE_BYTES = 6144
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const scopeKey = p => hash([p.subject_id, p.communication_scope_id])
export const sessionHandle = row => 'session_nc1_' + hash([row.subject_id, row.communication_scope_id, row.agent_id, row.session_id, row.session_generation])
const messageId = (row, part) => 'msg_nc1_' + hash([row.key, part])
function decode(value) {
  try {
    const result = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (result && !Array.isArray(result) && typeof result === 'object') return result
  } catch { /* opaque malformed cursor */ }
  throw fault('CURSOR_STALE', 409)
}
function owned(row, p) { return row.subject_id === p.subject_id && row.communication_scope_id === p.communication_scope_id }
function authorized(row, p, targetFor) {
  if (!owned(row, p)) return false
  try { targetFor(p, row.agent_id); return true } catch { return false }
}
function expiresAt(row, part) {
  if (part === 'assistant') return row.expires_at ?? null
  const pendingExpiry = row.user_expires_at ?? (Number.isSafeInteger(row.retention_ms) ? row.submitted_at + row.retention_ms : null)
  return row.expires_at == null ? pendingExpiry : pendingExpiry == null ? row.expires_at : Math.min(row.expires_at, pendingExpiry)
}
function textFor(row, part, now) {
  const expiry = expiresAt(row, part)
  if (expiry != null && now >= expiry) throw fault('RESULT_EXPIRED', 410)
  if (part === 'user' && typeof row.user_body === 'string' && expiry != null) return row.user_body
  if (part === 'assistant' && row.reply_status === 'available' && typeof row.reply_body === 'string' && expiry != null) return row.reply_body
  return null
}
function contentTag(row, part, text) { return hash([row.key, part, row.session_generation, expiresAt(row, part), text]) }
function contentPage(row, part, text, offset = 0) {
  const bytes = Buffer.from(text, 'utf8')
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > bytes.length
    || (offset === bytes.length && offset !== 0) || (bytes[offset] & 0xc0) === 0x80) throw fault('CURSOR_STALE', 409)
  let end = Math.min(bytes.length, offset + PAGE_BYTES)
  while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1
  return { body: bytes.subarray(offset, end).toString('utf8'), body_sha256: hash(text), body_bytes: bytes.length,
    body_offset: offset, body_page_sha256: hash(bytes.subarray(offset, end).toString('utf8')),
    body_hash_scope: 'complete_projected_text', content_complete: end === bytes.length,
    content_cursor: end < bytes.length ? encode({ kind: 'content', scope_key: hash([row.subject_id, row.communication_scope_id]),
      request_id: row.request_id, request_key: row.key, part, generation: row.session_generation,
      tag: contentTag(row, part, text), offset: end }) : null }
}
function item(row, part, position, now) {
  const native = part === 'user' ? row.message_id : row.reply_message_id
  const result = { message_id: messageId(row, part), message_id_namespace: 'request_owned_projection_v1',
    native_message_id: native ?? null, native_message_id_known: native != null, position, role: part,
    created_at: part === 'user' ? row.submitted_at ?? null : row.reply_created_at ?? null,
    session_generation: row.session_generation, request_id: row.request_id,
    request_status: row.request_status, execution_status: row.execution_status, reply_status: row.reply_status,
    reply_relation: { reply_to: part === 'assistant' ? row.message_id ?? null : null,
      relation_source: part === 'assistant' && row.message_id != null ? 'native_turn' : null,
      native_parent_id: part === 'assistant' ? row.native_parent_id ?? null : null,
      reply_projection_id: part === 'assistant' ? row.reply_projection_id ?? null : null },
    field_availability: { attachments: { status: 'not_projected', reason: 'attachment_metadata_not_projected' } }, attachments: [], redacted: part === 'user' ? row.user_body_redacted === true : row.redacted === true }
  if (native == null) result.field_availability.native_message_id = { status: 'unknown', reason: 'source_field_not_available' }
  if (result.created_at == null) result.field_availability.created_at = { status: 'unknown', reason: 'source_field_not_available' }
  let text, expired = false
  try { text = textFor(row, part, now) } catch { expired = true }
  if (text != null) Object.assign(result, contentPage(row, part, text), { incomplete: false })
  else Object.assign(result, { body: null, content_cursor: null, content_complete: false,
    body_availability: { status: 'not_projected', reason: expired ? 'RESULT_EXPIRED' : part === 'user'
      ? 'record_predates_user_body_projection' : row.error_class ?? 'reply_not_readable' },
    incomplete: !expired && part === 'assistant', error_class: expired ? 'RESULT_EXPIRED' : row.error_class ?? null })
  if (expired && part === 'assistant') result.reply_status = 'unavailable'
  if (part === 'user') result.source = 'request_owner_submitted'
  return result
}

function view(snapshot) {
  // Legacy snapshots are read without healing. Their deterministic positions are
  // explicitly legacy-only; an upgrade invalidates these cursors instead of
  // silently rebasing them onto a new projection. Historical events stay absent.
  if (snapshot.projection_seq !== undefined) return { records: snapshot.records, upper: snapshot.projection_seq, epoch: 'durable_v2' }
  let seq = 0
  const records = snapshot.records.map(row => ({ ...row, user_position: ++seq,
    assistant_position: row.result_persisted_at != null ? ++seq : null }))
  return { records, upper: seq, epoch: 'legacy_' + hash(snapshot.records.map(r => [r.key, r.result_persisted_at])) }
}
function boundedPage(window, limit, envelope) {
  const items = []
  for (const next of window.slice(0, limit)) {
    // Reserve space for cursor/coverage envelope, including multibyte content.
    if (Buffer.byteLength(JSON.stringify({ ...envelope, items: [...items, next] })) > MAX_RESPONSE - 16384) break
    items.push(next)
  }
  if (!items.length && window.length) throw fault('RESOURCE_LIMIT', 429)
  return items
}

export function readHistory({ storeFile, principal, body, targetFor, now }) {
  const snapshot = ConversationStore.snapshot(storeFile)
  if (body.content_cursor !== undefined) {
    const c = decode(body.content_cursor)
    if (c.kind !== 'content' || c.scope_key !== scopeKey(principal) || !['user', 'assistant'].includes(c.part)
      || typeof c.request_id !== 'string') throw fault('CURSOR_STALE', 409)
    const row = snapshot?.records.find(r => owned(r, principal) && r.request_id === c.request_id && r.key === c.request_key)
    if (!row || !authorized(row, principal, targetFor)) throw fault('NOT_FOUND_OR_NOT_VISIBLE', 404)
    if (c.generation !== row.session_generation) throw fault('SESSION_GENERATION_CHANGED', 409)
    const text = textFor(row, c.part, now)
    if (text == null || c.tag !== contentTag(row, c.part, text)) throw fault('CURSOR_STALE', 409)
    const page = contentPage(row, c.part, text, c.offset)
    return { status: 'OK', contract_version: CONTRACT_VERSION, request_id: row.request_id, role: c.part,
      message_id: messageId(row, c.part), message_id_namespace: 'request_owned_projection_v1',
      ...page, next_content_cursor: page.content_cursor, has_more: !page.content_complete,
      redacted: c.part === 'user' ? row.user_body_redacted === true : row.redacted === true }
  }
  const c = body.cursor === undefined ? null : decode(body.cursor)
  const query = hash([body.session_handle, body.direction, body.limit ?? 50])
  if (c && (c.kind !== 'history' || c.scope_key !== scopeKey(principal) || c.query !== query
    || c.session_handle !== body.session_handle || c.direction !== body.direction
    || !Number.isSafeInteger(c.position) || c.position < 0
    || (c.upper !== null && (!Number.isSafeInteger(c.upper) || c.upper + (body.direction === 'older' ? 1 : 0) < c.position)))) throw fault('CURSOR_STALE', 409)
  if (!snapshot) throw fault('NOT_FOUND_OR_NOT_VISIBLE', 404)
  const source = view(snapshot)
  if (c && c.epoch !== source.epoch) throw fault('CURSOR_STALE', 409)
  const scoped = source.records.filter(row => owned(row, principal) && row.session_generation
    && sessionHandle(row) === body.session_handle && authorized(row, principal, targetFor))
  if (!scoped.length) throw fault(c ? 'SESSION_GENERATION_CHANGED' : 'NOT_FOUND_OR_NOT_VISIBLE', c ? 409 : 404)
  if (c && c.generation !== scoped[0].session_generation) throw fault('SESSION_GENERATION_CHANGED', 409)
  const upper = c?.upper ?? source.upper
  if (upper > source.upper || (c && c.position > source.upper)) throw fault('CURSOR_STALE', 409)
  const ordered = scoped.flatMap(row => [item(row, 'user', row.user_position, now),
    ...(row.assistant_position == null ? [] : [item(row, 'assistant', row.assistant_position, now)])])
    .filter(i => i.position <= upper).sort((a, b) => a.position - b.position)
  const window = body.direction === 'older'
    ? ordered.reverse().filter(i => !c || i.position < c.position)
    : ordered.filter(i => !c || i.position > c.position)
  const coverage = { scope: 'request_bound_only', store_format: snapshot.store_format,
    session_generation: scoped[0].session_generation, records_in_scope: scoped.length,
    pending_requests: scoped.filter(r => r.result_persisted_at == null).length,
    history_availability: snapshot.store_format === 1 ? 'not_projected' : 'request_bound_projection',
    user_content: scoped.some(r => typeof r.user_body !== 'string') ? 'partially_not_projected' : 'projected',
    coverage_start: ordered.length ? Math.min(...ordered.map(i => i.position)) : null,
    coverage_end: ordered.length ? Math.max(...ordered.map(i => i.position)) : null,
    events_seq_start: snapshot.events?.find(e => e.scope_key === scopeKey(principal))?.seq ?? null,
    unsupported: ['fresh', 'archive', 'full_main', 'attachment_binary'],
    ordering: 'durable_projection_appearance', boundary: upper }
  const envelope = { status: 'OK', contract_version: CONTRACT_VERSION, session_handle: body.session_handle,
    direction: body.direction, coverage, incomplete: scoped.some(r => r.result_persisted_at == null || r.reply_status === 'incomplete') }
  const items = boundedPage(window, body.limit ?? 50, envelope)
  const hasMore = window.length > items.length
  const cursor = (direction, position, frozenUpper) => encode({ kind: 'history', scope_key: scopeKey(principal),
    session_handle: body.session_handle, generation: scoped[0].session_generation,
    query: hash([body.session_handle, direction, body.limit ?? 50]), direction,
    epoch: source.epoch, position, upper: frozenUpper })
  const after = cursor('newer', upper, null)
  const next = body.direction === 'newer' && !hasMore ? after
    : cursor(body.direction, items.at(-1)?.position ?? c?.position ?? upper + 1, upper)
  return { ...envelope, items, has_more: hasMore, next_cursor: next, cursor: next, after_cursor: after,
    truncated: items.length < Math.min(window.length, body.limit ?? 50) }
}
