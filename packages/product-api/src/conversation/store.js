import { atomicPrivateJson, lockedPrivateMutation, readPrivateJson } from '../../../agent-router/src/conversation/persistence.js'
import { redactInspectionText } from '../../../production-runtime/src/agent-session/projection-redaction.js'
import { fault, hash, nativeId } from './protocol.js'
import { appendEvent, upgradeProjection, validateDocument } from './projection-store.js'
export class ConversationStore {
  constructor(file, now = Date.now) {
    this.file = file
    this.now = now
    this.read()
    this.mutate(doc => {
      for (const row of doc.records) {
        if (row.request_status === 'reserved') {
          row.request_status = 'unknown'
          this.appendEvent(doc, row, 'request_state_changed', null)
        }
        if (row.execution_status === 'running') {
          row.execution_status = 'unknown'
          this.appendEvent(doc, row, 'execution_state_changed', null)
        }
      }
    })
  }
  // A read never constructs, migrates, recovers or persists the store.
  static snapshot(file) {
    try {
      const doc = readPrivateJson(file)
      return doc ? { ...validateDocument(doc), store_format: doc.version } : null
    } catch { throw fault('RESULT_STORE_INVALID', 503) }
  }
  read() {
    const doc = readPrivateJson(this.file) ?? { version: 2, records: [], events: [], event_seq: 0 }
    return validateDocument(doc)
  }
  appendEvent(doc, row, kind, occurredAt) { appendEvent(doc, row, kind, occurredAt, this.now()) }
  mutate(fn) {
    return lockedPrivateMutation(this.file, () => { const doc = upgradeProjection(this.read(), this.now()), result = fn(doc); atomicPrivateJson(this.file, doc); return structuredClone(result ?? null) })
  }
  key(principal, request_id) { return hash([principal.subject_id, principal.communication_scope_id, request_id]) }
  get(principal, request_id) { return this.read().records.find(row => row.key === this.key(principal, request_id)) }
  all() { return this.read().records }
  reserve(principal, body, target, config) {
    const key = this.key(principal, body.request_id), digest = hash({ agent_id: target.agent_id, message: body.message, reply_to: null, workflow_refs: body.workflow_refs ?? [] })
    return this.mutate(doc => {
      const old = doc.records.find(row => row.key === key)
      if (old) { if (old.digest !== digest) throw fault('REQUEST_CONFLICT', 409); return { fresh: false, row: old } }
      if (doc.records.length >= config.maxRecords) throw fault('RESOURCE_LIMIT', 429)
      const submittedAt = this.now()
      // CTR-NC-006: the caller's own message text is projected for the
      // request-bound history of the SAME subject, redacted with the same
      // rules as replies, with bounded content retention even before completion.
      const userBody = redactInspectionText(typeof body.message === 'string' ? body.message : '')
      const row = { key, subject_id: principal.subject_id, communication_scope_id: principal.communication_scope_id,
        request_id: body.request_id, native_request_id: nativeId(principal.subject_id, principal.communication_scope_id, body.request_id),
        digest, target: structuredClone(target), agent_id: target.agent_id, request_status: 'reserved', execution_status: 'not_started', reply_status: 'pending',
        submitted_at: submittedAt, retention_ms: config.retentionMs, accepted_at: null, started_at: null, finished_at: null,
        reply_created_at: null, result_persisted_at: null, session_id: null, session_generation: null, message_id: null, reconciliation_handle: null,
        user_position: null, user_expires_at: submittedAt + config.retentionMs,
        user_message_id: 'user_nc1_' + hash([key, 'user']), user_body: userBody, user_body_redacted: userBody !== body.message, user_body_bytes: Buffer.byteLength(userBody, 'utf8') }
      doc.records.push(row)
      this.appendEvent(doc, row, 'request_reserved', submittedAt)
      return { fresh: true, row }
    })
  }
  update(key, fn) {
    return this.mutate(doc => {
      const row = doc.records.find(row => row.key === key)
      if (!row) throw fault('NOT_FOUND_OR_NOT_VISIBLE', 404)
      const before = { request_status: row.request_status, execution_status: row.execution_status, reply_status: row.reply_status, result_persisted_at: row.result_persisted_at }
      fn(row)
      if (row.session_generation && row.user_position == null) row.user_position = ++doc.projection_seq
      if (row.result_persisted_at != null && row.assistant_position == null) row.assistant_position = ++doc.projection_seq
      // CTR-NC-007: state and its readable events commit in one document.
      // Repeated identical callbacks produce no new business reply event.
      if (before.reply_status !== row.reply_status && row.reply_status === 'available') this.appendEvent(doc, row, 'reply_available', row.reply_created_at ?? null)
      else if (before.reply_status !== row.reply_status) this.appendEvent(doc, row, 'reply_state_changed', row.result_persisted_at ?? null)
      if (before.result_persisted_at !== row.result_persisted_at && row.result_persisted_at !== null) this.appendEvent(doc, row, 'result_persisted', row.result_persisted_at)
      if (before.request_status !== row.request_status) this.appendEvent(doc, row, 'request_state_changed', null)
      else if (before.execution_status !== row.execution_status) this.appendEvent(doc, row, 'execution_state_changed', row.started_at ?? null)
      return row
    })
  }
}
