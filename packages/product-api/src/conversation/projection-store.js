import { fault, hash, nativeId, requestIdValid } from './protocol.js'

// Validation is shared by writable and strictly read-only views. It never heals.
export function validateDocument(doc) {
  if (![1, 2].includes(doc?.version) || !Array.isArray(doc.records)
    || doc.records.some(row => !requestIdValid(row.request_id)
      || row.key !== hash([row.subject_id, row.communication_scope_id, row.request_id])
      || !row.subject_id || !row.communication_scope_id || !row.digest
      || row.native_request_id !== nativeId(row.subject_id, row.communication_scope_id, row.request_id)
      || row.agent_id !== row.target?.agent_id
      || (row.reply_status === 'available' && (typeof row.reply_body !== 'string'
        || row.reply_projection_id !== 'reply_nc1_' + hash([row.native_request_id, row.message_id, row.native_turn_id, row.reply_body]))))
    || new Set(doc.records.map(row => row.key)).size !== doc.records.length) throw fault('RESULT_STORE_INVALID', 503)
  if (doc.version === 1) return doc
  if (!Array.isArray(doc.events) || !Number.isSafeInteger(doc.event_seq) || doc.event_seq < 0
    || doc.events.some((e, i) => !Number.isSafeInteger(e.seq) || e.seq < 1 || e.seq > doc.event_seq
      || !e.event_id || !e.kind || !e.request_id || !e.scope_key || !Number.isSafeInteger(e.persisted_at)
      || (i > 0 && e.seq <= doc.events[i - 1].seq))) throw fault('RESULT_STORE_INVALID', 503)
  if (doc.projection_seq !== undefined) {
    const positions = doc.records.flatMap(r => [r.user_position, r.assistant_position]).filter(p => p != null)
    if (!Number.isSafeInteger(doc.projection_seq) || doc.projection_seq < 0
      || positions.some(p => !Number.isSafeInteger(p) || p < 1 || p > doc.projection_seq)
      || new Set(positions).size !== positions.length) throw fault('RESULT_STORE_INVALID', 503)
  }
  return doc
}

// Called only inside the existing writer lock. No historical events/times are invented.
export function upgradeProjection(doc, now) {
  if (doc.version === 1) Object.assign(doc, { version: 2, events: [], event_seq: 0 })
  doc.event_dropped_through ??= {}
  doc.events_coverage_started_at ??= now
  if (doc.projection_seq === undefined) {
    doc.projection_seq = 0
    for (const row of doc.records) {
      row.user_position = row.session_generation ? ++doc.projection_seq : null
      if (row.result_persisted_at != null) row.assistant_position = ++doc.projection_seq
    }
  }
  return doc
}

export function appendEvent(doc, row, kind, occurredAt, now) {
  const seq = ++doc.event_seq
  doc.events.push({ seq, event_id: 'evt_nc1_' + hash([row.subject_id, row.communication_scope_id, seq, kind, row.key]),
    scope_key: hash([row.subject_id, row.communication_scope_id]), kind, request_id: row.request_id,
    native_request_id: row.native_request_id, agent_id: row.agent_id, session_generation: row.session_generation,
    message_id: row.message_id, reply_message_id: row.reply_message_id ?? null, native_turn_id: row.native_turn_id ?? null,
    occurred_at: occurredAt ?? null, persisted_at: now,
    field_availability: occurredAt == null ? { occurred_at: { status: 'unknown', reason: 'source_field_not_available' } } : {} })
  const removed = doc.events.splice(0, Math.max(0, doc.events.length - 5000))
  for (const event of removed) doc.event_dropped_through[event.scope_key] = event.seq
}
