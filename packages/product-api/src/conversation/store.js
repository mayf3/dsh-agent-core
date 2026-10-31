import { atomicPrivateJson, lockedPrivateMutation, readPrivateJson } from '../../../agent-router/src/conversation/persistence.js'
import { fault, hash, nativeId, requestIdValid } from './protocol.js'
export class ConversationStore {
  constructor(file, now = Date.now) {
    this.file = file
    this.now = now
    this.read()
    this.mutate(doc => {
      for (const row of doc.records) {
        if (row.request_status === 'reserved') row.request_status = 'unknown'
        if (row.execution_status === 'running') row.execution_status = 'unknown'
      }
    })
  }
  read() {
    const doc = readPrivateJson(this.file) ?? { version: 1, records: [] }
    if (doc.version !== 1 || !Array.isArray(doc.records) || doc.records.some(row => !row.key || !row.native_request_id || !row.digest || !row.subject_id || !row.communication_scope_id || !row.request_id)
      || doc.records.some(row => !requestIdValid(row.request_id) || row.key !== hash([row.subject_id,row.communication_scope_id,row.request_id])
        || row.native_request_id !== nativeId(row.subject_id,row.communication_scope_id,row.request_id) || row.agent_id !== row.target?.agent_id
        || (row.reply_status === 'available' && (typeof row.reply_body !== 'string' || row.reply_projection_id !== 'reply_nc1_' + hash([row.native_request_id,row.message_id,row.native_turn_id,row.reply_body]))))
      || new Set(doc.records.map(row => row.key)).size !== doc.records.length) throw fault('RESULT_STORE_INVALID', 503)
    return doc
  }
  mutate(fn) {
    return lockedPrivateMutation(this.file, () => { const doc = this.read(), result = fn(doc); atomicPrivateJson(this.file, doc); return structuredClone(result ?? null) })
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
      const row = { key, subject_id: principal.subject_id, communication_scope_id: principal.communication_scope_id,
        request_id: body.request_id, native_request_id: nativeId(principal.subject_id, principal.communication_scope_id, body.request_id),
        digest, target: structuredClone(target), agent_id: target.agent_id, request_status: 'reserved', execution_status: 'not_started', reply_status: 'pending',
        submitted_at: this.now(), retention_ms: config.retentionMs, accepted_at: null, started_at: null, finished_at: null,
        reply_created_at: null, result_persisted_at: null, session_id: null, session_generation: null, message_id: null, reconciliation_handle: null }
      doc.records.push(row)
      return { fresh: true, row }
    })
  }
  update(key, fn) { return this.mutate(doc => { const row = doc.records.find(row => row.key === key); if (!row) throw fault('NOT_FOUND_OR_NOT_VISIBLE',404); fn(row); return row }) }
}
