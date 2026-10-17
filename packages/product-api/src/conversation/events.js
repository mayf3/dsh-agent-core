import { ConversationStore } from './store.js'
import { CONTRACT_VERSION, fault, hash } from './protocol.js'

const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
export function readEvents({ storeFile, principal, body, targetFor }) {
  const snapshot = ConversationStore.snapshot(storeFile)
  const scope = hash([principal.subject_id, principal.communication_scope_id])
  const query = hash(['events', body.request_id ?? null, body.limit ?? 50])
  let after = 0
  if (body.cursor !== undefined) {
    let c
    try { c = JSON.parse(Buffer.from(body.cursor, 'base64url').toString('utf8')) } catch { throw fault('CURSOR_STALE', 409) }
    if (c?.kind !== 'events' || c.scope_key !== scope || c.query !== query
      || c.request_filter !== (body.request_id ?? null) || !Number.isSafeInteger(c.after_seq) || c.after_seq < 0) throw fault('CURSOR_STALE', 409)
    after = c.after_seq
  }
  const records = new Map()
  for (const row of snapshot?.records ?? []) {
    if (row.subject_id !== principal.subject_id || row.communication_scope_id !== principal.communication_scope_id) continue
    try { targetFor(principal, row.agent_id); records.set(row.request_id, row) } catch { /* current grant/binding excludes this record */ }
  }
  if (body.request_id !== undefined && !records.has(body.request_id)) throw fault('NOT_FOUND_OR_NOT_VISIBLE', 404)
  const visible = (snapshot?.events ?? []).filter(e => e.scope_key === scope && records.has(e.request_id)
    && (body.request_id === undefined || body.request_id === e.request_id))
  const dropped = snapshot?.event_dropped_through?.[scope] ?? 0
  const coverage = { scope: 'request_owned_events', store_format: snapshot?.store_format ?? null,
    filtered_request_id: body.request_id ?? null, seq_start: visible.at(0)?.seq ?? null,
    seq_end: visible.at(-1)?.seq ?? null, dropped_through: dropped,
    history_availability: snapshot?.store_format === 2 ? 'since_projection_start_only' : 'not_projected',
    projection_started_at: snapshot?.events_coverage_started_at ?? null,
    note: 'No pre-migration events; query original request after a retention gap. No notification or latency guarantee.' }
  if (body.cursor !== undefined && after < dropped) throw Object.assign(fault('EVENT_CURSOR_EXPIRED', 410), { coverage })
  if (after > (snapshot?.event_seq ?? 0)) throw fault('CURSOR_STALE', 409)
  const remaining = visible.filter(e => e.seq > after)
  const items = remaining.slice(0, body.limit ?? 50).map(({ scope_key, ...event }) => event)
  const high = items.at(-1)?.seq ?? after
  const cursor = encode({ kind: 'events', scope_key: scope, request_filter: body.request_id ?? null, query, after_seq: high })
  return { status: 'OK', contract_version: CONTRACT_VERSION, items, has_more: remaining.length > items.length,
    next_cursor: cursor, cursor, coverage }
}
