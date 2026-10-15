import { VERSION, fail, validateBody } from './protocol.js'
import { digest, opaque, cursorCodec } from './codec.js'
import { selectRegistry, resolveBound, assertSameTarget } from './resolution.js'
import { authorizationDigest, makeRecord, ownRecord, recordKey, event, failure, iso, commitProjection } from './records.js'
import { createReads } from './reads.js'

export function createInquiryService({ enabled = false, registry, store, router, definition, native, now = Date.now, cursorKey }) {
  const codec = cursorCodec(cursorKey)
  function access(caller, operation) {
    if (caller?.signal?.aborted) fail('SOURCE_UNAVAILABLE')
    if (!enabled || !registry || !store) fail('NOT_PROVISIONED')
    if (!caller || !['human', 'controller'].includes(caller.kind)) fail('UNAUTHENTICATED')
    if (['resolve', 'authorize', 'history'].includes(operation) && caller.kind !== 'human') fail('FORBIDDEN')
    if (operation === 'redeem' && caller.kind !== 'controller') fail('FORBIDDEN')
    const entry = selectRegistry(registry(), caller, operation)
    store.assertIdentity(entry)
    return entry
  }
  const target = entry => resolveBound({ entry, router, definition, native, now })
  const envelope = body => ({ contract_version: VERSION, served_at: iso(now()), ...body })
  const reads = createReads({ access, store, codec, now, envelope })
  async function resolve(caller, body) {
    validateBody('resolve', body)
    const entry = access(caller, 'resolve')
    if (body.workflow_instance_id) fail('NOT_SUPPORTED')
    const resolution = await target(entry)
    const handle = opaque()
    store.saveHandle(handle, { human: caller.principalId, scope: entry.communication_scope_id,
      binding: entry.binding_id, version: entry.version, expires: now() + 600000, resolution })
    return envelope({ target_handle: handle, resolution })
  }
  async function authorize(caller, body) {
    validateBody('authorize', body)
    const entry = access(caller, 'authorize')
    const handle = store.getHandle(body.target_handle)
    if (!handle || handle.human !== caller.principalId || handle.scope !== entry.communication_scope_id || handle.binding !== entry.binding_id) fail('NOT_FOUND_OR_NOT_VISIBLE')
    if (handle.resolution.resolution_mode !== 'BOUND_AGENT_PILOT') fail('NOT_SUPPORTED')
    if (body.context_refs.length !== 0) fail('REQUEST_CONFLICT')
    const key = recordKey(caller.principalId, body.request_id)
    const existing = store.snapshot(entry.communication_scope_id).requests[key]
    const same = record => {
      if (authorizationDigest(entry, body, handle.resolution, record.bindingVersion) !== record.shell.payload_digest) fail('REQUEST_CONFLICT')
      return envelope({ status: 200, request: structuredClone(record.shell) })
    }
    if (existing) return same(existing)
    if (handle.expires <= now()) fail('BINDING_CHANGED')
    if (handle.version !== entry.version) fail('BINDING_CHANGED')
    const resolution = await target(entry)
    access(caller, 'authorize')
    assertSameTarget(handle.resolution, resolution)
    if (resolution.main_state === 'absent' && body.allow_create_main !== true) fail('SESSION_GENERATION_CHANGED')
    if (caller.exp * 1000 <= now()) fail('UNAUTHENTICATED')
    return store.transaction(entry.communication_scope_id, state => {
      if (state.requests[key]) return same(state.requests[key])
      if (Object.keys(state.requests).length >= 10000) fail('RESOURCE_LIMIT')
      const record = makeRecord(entry, caller, body, handle.resolution, now(), ++state.requestSeq)
      state.requests[key] = record
      event(state, record, 'AUTHORIZED', now())
      return envelope({ status: 201, request: structuredClone(record.shell) })
    })
  }
  async function redeem(caller, rid, body) {
    validateBody('redeem', body)
    const entry = access(caller, 'redeem')
    const initial = ownRecord(store.snapshot(entry.communication_scope_id), entry, rid)
    if (initial.transport !== caller.principalId) fail('FORBIDDEN')
    if (digest([body.message, body.context_refs]) !== digest([initial.message, initial.context_refs])) fail('REQUEST_CONFLICT')
    if (initial.shell.request_status !== 'AUTHORIZED') return envelope({ status: 200, request: initial.shell })
    if (Date.parse(initial.shell.authorization_expires_at) <= now()) fail('BINDING_CHANGED')
    if (entry.version !== initial.bindingVersion) fail('BINDING_CHANGED')
    assertSameTarget(initial.shell.resolution, await target(entry))
    if (!native.admit || !native.custodyReady?.()) fail('NOT_PROVISIONED')
    const won = store.transaction(entry.communication_scope_id, state => {
      const record = ownRecord(state, entry, rid)
      if (record.shell.request_status !== 'AUTHORIZED') return false
      access(caller, 'redeem')
      if (Date.parse(record.shell.authorization_expires_at) <= now()) fail('BINDING_CHANGED')
      record.shell.request_status = 'ATTEMPT_STARTED'
      record.shell.delivery_status = 'UNKNOWN'
      record.shell.times.attempted_at = iso(now())
      event(state, record, 'ATTEMPT_STARTED', now())
      return true
    })
    if (won) {
      const carrier = Object.freeze({ namespace: VERSION, human_principal_id: entry.human_principal_id,
        communication_scope_id: entry.communication_scope_id, request_id: rid, payload_digest: initial.shell.payload_digest,
        site_owner_binding_version: initial.bindingVersion })
      // HTTP deadlines do not abort the consumed original-runtime work. Only
      // its exact callbacks can improve this durable UNKNOWN state.
      void native.admit({ carrier, record: initial, recheck: async () => {
        const current = access({ ...caller, signal: undefined }, 'redeem')
        if (current.version !== initial.bindingVersion) fail('BINDING_CHANGED')
        assertSameTarget(initial.shell.resolution, await target(current))
      }, map: coordinate => store.transaction(entry.communication_scope_id, state => {
        const record = ownRecord(state, entry, rid)
        if (!coordinate.messageId || coordinate.agentId !== record.shell.trace.agent_id || !coordinate.generation) fail('TRACE_UNRESOLVABLE')
        if (record.shell.trace.native_user_message_id && record.shell.trace.native_user_message_id !== coordinate.messageId) fail('EVENT_CONFLICT')
        record.shell.trace.native_user_message_id = coordinate.messageId
        record.shell.trace.session_generation = coordinate.generation
      }), receipt: receipt => store.transaction(entry.communication_scope_id, state => {
        const record = ownRecord(state, entry, rid)
        if (receipt.messageId !== record.shell.trace.native_user_message_id) fail('TRACE_UNRESOLVABLE')
        record.shell.request_status = 'INBOX_ACCEPTED'
        record.shell.delivery_status = 'DELIVERED'
        record.shell.times.inbox_accepted_at = iso(now())
        event(state, record, 'INBOX_ACCEPTED', now())
      }), settle: proof => store.transaction(entry.communication_scope_id, state => {
        commitProjection(state, ownRecord(state, entry, rid), proof, now())
      }) }).catch(() => {
        store.transaction(entry.communication_scope_id, state => {
          const record = ownRecord(state, entry, rid)
          if (record.shell.delivery_status !== 'DELIVERED') record.shell.request_status = 'UNKNOWN'
          failure(record, 'NATIVE_OUTCOME_UNKNOWN', 'ADMISSION')
          event(state, record, 'FAILURE', now())
        })
      })
    }
    return envelope({ status: won ? 202 : 200, request: ownRecord(store.snapshot(entry.communication_scope_id), entry, rid).shell })
  }
  async function read(caller, rid, query) {
    const entry = access(caller, 'read')
    const record = ownRecord(store.snapshot(entry.communication_scope_id), entry, rid)
    if (record.shell.trace.native_user_message_id && !record.result && native.recover) {
      try {
        const proof = await native.recover(record)
        store.transaction(entry.communication_scope_id, state => {
          const current = ownRecord(state, entry, rid)
          if (proof.status === 'completed' && proof.complete) commitProjection(state, current, proof, now())
          else if (proof.status === 'completed') {
            current.shell.execution_status = 'COMPLETED'
            current.shell.reply_status = proof.content === null ? 'NO_OUTPUT' : 'UNAVAILABLE'
          } else if (proof.status === 'failed') {
            current.shell.execution_status = 'FAILED'
            current.shell.reply_status = 'UNAVAILABLE'
            failure(current, 'NATIVE_FAILED', 'EXECUTION')
          } else if (proof.status === 'pending' && Number.isSafeInteger(proof.turnId)) {
            current.shell.execution_status = 'RUNNING'
            current.shell.trace.native_turn_id = proof.turnId
            current.shell.times.started_at = proof.startedAt ?? null
            event(state, current, 'EXECUTION_CHANGED', now())
          } else if (proof.status === 'unresolvable') {
            current.shell.reply_status = 'UNAVAILABLE'
            failure(current, 'TRACE_UNRESOLVABLE', 'RESULT_READ')
          }
        })
      } catch {
        store.transaction(entry.communication_scope_id, state => {
          const current = ownRecord(state, entry, rid)
          current.shell.reply_status = 'UNRECOVERABLE'
          failure(current, 'RESULT_UNRECOVERABLE', 'RESULT_READ', 'REPAIR_ORIGINAL_PROJECTION')
        })
      }
    }
    return reads.read(caller, rid, query)
  }
  return { resolve, authorize, redeem, ...reads, read }
}
