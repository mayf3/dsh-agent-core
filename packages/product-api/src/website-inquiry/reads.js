import { fail } from './protocol.js'
import { digest } from './codec.js'
import { ownRecord, event } from './records.js'
const WEEK = 7 * 86400000
export function createReads({ access, store, codec, now, envelope }) {
  const owner = entry => digest([entry.human_principal_id, entry.site_owner_id, entry.communication_scope_id, entry.binding_id])
  function decode(token, entry, type, queryHash) {
    const cursor = codec.decode(token)
    if (cursor.v !== 1 || cursor.owner !== owner(entry) || cursor.type !== type || cursor.query !== queryHash) fail('CURSOR_STALE')
    if (!Number.isSafeInteger(cursor.pos) || cursor.pos < 0 || !Number.isSafeInteger(cursor.high)) fail('CURSOR_STALE')
    return cursor
  }
  const encode = (entry, type, query, high, pos, extra = {}) => codec.encode({ v: 1, owner: owner(entry), type, query, high, pos, ...extra })
  const coverage = (state, records) => ({ scope: 'website_request_owned', start_at: records[0]?.shell.times.authorized_at ?? null,
    end_at: records.at(-1)?.shell.times.authorized_at ?? null, source_high_water: state.requestSeq, complete: true, gaps: [] })
  function expire(entry) {
    store.transaction(entry.communication_scope_id, state => {
      for (const record of Object.values(state.requests)) {
        if (record.result && Date.parse(record.result.expires_at) <= now() && record.shell.reply_status !== 'EXPIRED') {
          record.content = null
          record.shell.reply_status = 'EXPIRED'
          event(state, record, 'RESULT_EXPIRED', now())
        }
      }
      state.events = state.events.filter(item => Date.parse(item.persisted_at) > now() - WEEK)
    })
  }
  async function read(caller, rid, query = {}) {
    const entry = access(caller, 'read')
    expire(entry)
    const record = ownRecord(store.snapshot(entry.communication_scope_id), entry, rid)
    if (record.shell.reply_status === 'EXPIRED') fail('RESULT_EXPIRED')
    let body_page = null
    if (record.result) {
      const hash = digest([rid, record.result.projection_id])
      let position = 0
      if (query.content_cursor) position = decode(query.content_cursor, entry, 'body', hash).pos
      const bytes = Buffer.from(record.content)
      if (position > bytes.length || (position < bytes.length && (bytes[position] & 0xc0) === 0x80)) fail('CURSOR_STALE')
      let end = Math.min(position + 6144, bytes.length)
      while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--
      body_page = { content: bytes.subarray(position, end).toString('utf8'),
        content_cursor: encode(entry, 'body', hash, bytes.length, position),
        next_cursor: end < bytes.length ? encode(entry, 'body', hash, bytes.length, end) : null,
        has_more: end < bytes.length, complete: true, projection_sha256: record.result.projection_sha256 }
    } else if (query.content_cursor) fail('CURSOR_STALE')
    return envelope({ request: record.shell, result: record.result, body_page })
  }
  async function history(caller, query = {}) {
    const entry = access(caller, 'history')
    if (query.workflow_instance_id) fail('NOT_SUPPORTED')
    expire(entry)
    const state = store.snapshot(entry.communication_scope_id)
    const { before, limit: ignored, ...filters } = query
    const hash = digest(filters)
    const cursor = before ? decode(before, entry, 'history', hash) : { high: state.requestSeq, pos: state.requestSeq + 1 }
    if (cursor.high > state.requestSeq) fail('CURSOR_STALE')
    const records = Object.values(state.requests).filter(record => record.human === entry.human_principal_id
      && record.shell.site_owner_binding_id === entry.binding_id && record.seq <= cursor.high && record.seq < cursor.pos
      && (!query.request_id || record.shell.request_id === query.request_id)
      && (!query.agent_id || record.shell.trace.agent_id === query.agent_id)).sort((a, b) => a.seq - b.seq)
    const page = records.slice(-Number(query.limit ?? 20))
    const has_more = page.length < records.length
    return envelope({ requests: page.map(record => ({ ...record.shell, result: record.result })), has_more,
      next_cursor: has_more ? encode(entry, 'history', hash, cursor.high, page[0].seq) : null,
      coverage: coverage(state, records) })
  }
  async function events(caller, query = {}) {
    const entry = access(caller, 'events')
    expire(entry)
    const state = store.snapshot(entry.communication_scope_id)
    const hash = digest({ request_id: query.request_id ?? null })
    const cursor = query.cursor ? decode(query.cursor, entry, 'events', hash) : { high: state.eventSeq, pos: 0, at: now() }
    if (cursor.at <= now() - WEEK) fail('EVENT_CURSOR_EXPIRED')
    if (cursor.high > state.eventSeq || cursor.pos > state.eventSeq) fail('CURSOR_STALE')
    const high = cursor.tail ? state.eventSeq : cursor.high
    const visible = new Set(Object.values(state.requests).filter(r => r.human === entry.human_principal_id && r.shell.site_owner_binding_id === entry.binding_id).map(r => r.shell.request_id))
    const rows = state.events.filter(e => e.seq > cursor.pos && e.seq <= high && visible.has(e.request_id)
      && (!query.request_id || query.request_id === e.request_id))
    const page = rows.slice(0, Number(query.limit ?? 50))
    const has_more = rows.length > page.length
    const pos = has_more ? page.at(-1).seq : high
    return envelope({ events: page, has_more,
      next_cursor: encode(entry, 'events', hash, high, pos, { tail: !has_more, at: has_more ? cursor.at : now() }),
      coverage: { scope: 'website_request_owned', start_at: state.events[0]?.persisted_at ?? null,
        end_at: state.events.at(-1)?.persisted_at ?? null, source_high_water: high, complete: true, gaps: [] } })
  }
  return { read, history, events }
}
