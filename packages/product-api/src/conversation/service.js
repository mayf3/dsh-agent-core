import { existsSync } from 'node:fs'
import { redactInspectionText } from '../../../production-runtime/src/agent-session/projection-redaction.js'
import { authenticate, validateConfig } from './auth.js'
import { originalNativeProof } from './native-proof.js'
import { ConversationStore } from './store.js'
import { CONTRACT_VERSION, failure, fault, hash, validateArgs } from './protocol.js'

const targetHandle = (p,t) => 'target_nc1_' + hash([p.subject_id,p.communication_scope_id,t])
const sessionHandle = row => 'session_nc1_' + hash([row.subject_id,row.communication_scope_id,row.agent_id,row.session_id,row.session_generation])
const time = value => Number.isSafeInteger(value) && value >= 0 ? value : null
function bodyPage(text, cursor, row) {
  const bytes = Buffer.from(text,'utf8'), tag = hash([row.key,text])
  let offset = 0
  if (cursor !== undefined) {
    let parsed
    try { parsed = JSON.parse(Buffer.from(cursor,'base64url').toString('utf8')) } catch { throw fault('CURSOR_STALE',409) }
    if (parsed.tag !== tag || !Number.isSafeInteger(parsed.offset) || parsed.offset < 0 || parsed.offset >= bytes.length) throw fault('CURSOR_STALE',409)
    offset = parsed.offset
    if ((bytes[offset] & 0xc0) === 0x80) throw fault('CURSOR_STALE',409)
  }
  let end = Math.min(bytes.length,offset+6144)
  while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1
  return { reply_body: bytes.subarray(offset,end).toString('utf8'), reply_body_sha256: hash(bytes.toString('utf8')),
    reply_body_bytes: bytes.length, reply_body_offset: offset, reply_body_complete: end === bytes.length,
    next_reply_cursor: end < bytes.length ? Buffer.from(JSON.stringify({tag,offset:end})).toString('base64url') : null }
}

export function createConversationService({ router, definition, storeFile, configProvider = () => null, fetchImpl = fetch, now = Date.now }) {
  let store, closed = false
  const ensureStore = () => { if (!store) store = new ConversationStore(storeFile,now); return store }
  const reconcile = async row => {
    const native=originalNativeProof(row,router)
    const retainFacts=fields=>{
      if(Object.entries(fields).some(([key,value])=>JSON.stringify(row[key])!==JSON.stringify(value))) {
        try { row=ensureStore().update(row.key,current=>Object.assign(current,fields)) }
        catch { throw Object.assign(fault('RESULT_PERSIST_FAILED',503),{knownFacts:{...row,...fields}}) }
      }
      return row
    }
    const executionDiagnostic = () => native.facts.error_class ? {
      class:native.facts.error_class,diagnostic_id:hash([row.key,'execution',native.facts]).slice(0,16),
      retryable:false,retry_preconditions:['query_original_request_only'],
    } : native.completed ? null : row.execution_diagnostic??null
    if(row.reply_status==='available') {
      // Canonical reply bytes and their TTL are immutable. The original Router
      // may still settle later; refreshing its facts never clears its fence.
      const {reply_status,error_class,...executionFacts}=native.facts
      return retainFacts({...executionFacts,execution_diagnostic:executionDiagnostic()})
    }
    if(row.result_persisted_at!==null)return row
    retainFacts(native.facts)
    let source
    try { source=await router.readConversationSource({requestId:row.native_request_id,agentId:row.agent_id}) }
    catch {
      retainFacts({error_class:'UPSTREAM_UNAVAILABLE',source_read_state:'unavailable',reply_status:'unknown'})
      throw fault('UPSTREAM_UNAVAILABLE',503)
    }
    retainFacts({source_read_state:'available'})
    if(native.read_failed)throw fault('UPSTREAM_UNAVAILABLE',503)
    if(native.facts.error_class && native.facts.error_class!=='OUTCOME_UNKNOWN')throw fault(native.facts.error_class,503)
    // A recovered read clears only a transient read error. Original execution
    // uncertainty remains separate from any exact reply recovered below.
    if(row.error_class==='UPSTREAM_UNAVAILABLE')retainFacts({error_class:null,source_read_state:'available'})
    if (!source || ['pending','not_found'].includes(source.state)) {
      if(native.facts.error_class)throw fault(native.facts.error_class,503)
      if(native.completed){
        retainFacts({request_status:'accepted',execution_status:'completed',reply_status:'unknown',error_class:'RESULT_UNRECOVERABLE'})
        throw fault('RESULT_UNRECOVERABLE',503)
      }
      if(source?.agent_id===row.agent_id&&source.message_id===row.message_id&&source.session_id==='main'&&time(source.started_at)!==null){
        retainFacts({execution_status:'running',started_at:time(source.started_at)})
      }
      return row
    }
    if (source.agent_id !== row.agent_id || (row.message_id !== null && source.message_id !== row.message_id)
      || !source.message_id || !source.session_generation || source.session_id !== 'main'
      || (row.session_generation!==null&&row.session_generation!==source.session_generation)
      || !Number.isSafeInteger(source.turn_id)) {
      retainFacts({reply_status:'unknown',error_class:'RESULT_UNRECOVERABLE'})
      throw fault('RESULT_UNRECOVERABLE',503)
    }
    if (source.state === 'unrecoverable') {
      retainFacts({reply_status:'unknown',error_class:'RESULT_UNRECOVERABLE'})
      throw fault('RESULT_UNRECOVERABLE',503)
    }
    if (!['completed','failed','interrupted'].includes(source.state)) {
      if(native.facts.error_class)throw fault(native.facts.error_class,503)
      return row
    }
    const safeText=typeof source.reply_body==='string'?redactInspectionText(source.reply_body):null
    const noVisible=safeText===''||source.reply_coverage?.reason==='no_visible_reply'
    const coverage=source.reply_coverage??{selection:'last_nonempty_visible_assistant_message',limit_bytes:1048576,
      reason:noVisible?'no_visible_reply':source.truncated?'truncated':safeText===null?'source_not_available':'visible_reply'}
    try {
      const committed=ensureStore().update(row.key,current=>{
        if(current.result_persisted_at!==null)return
        current.request_status='accepted'
        current.execution_status=native.facts.execution_status??(source.state==='completed'?current.execution_status:source.state)
        current.execution_diagnostic=executionDiagnostic()
        current.session_id=source.session_id
        current.session_generation=source.session_generation
        current.main_resolution=source.main_resolution??current.main_resolution??{disposition:'unknown',reason:'source_field_not_available',generation_change_reason:null}
        current.message_id=source.message_id
        current.native_turn_id=source.turn_id??null
        current.accepted_at=current.accepted_at??time(source.accepted_at)
        current.started_at=time(source.started_at)
        current.finished_at=time(source.finished_at)
        current.reply_created_at=time(source.reply_created_at)
        current.reply_status=source.state!=='completed'?'incomplete':source.truncated===true||safeText===null||noVisible||!source.source_retained?'unavailable':'available'
        current.reply_coverage=coverage
        current.reply_body=current.reply_status==='available'?safeText:null
        current.reply_message_id=source.reply_message_id??null
        current.reply_projection_id='reply_nc1_'+hash([current.native_request_id,current.message_id,current.native_turn_id,safeText])
        current.redacted=safeText!==source.reply_body
        current.result_persisted_at=now()
        current.expires_at=current.result_persisted_at+current.retention_ms
        current.error_class=source.state==='failed'?'TARGET_RUN_FAILED':source.state==='interrupted'?'OUTCOME_UNKNOWN':current.reply_status==='unavailable'
          ?source.truncated?'TRUNCATED':noVisible?'REPLY_UNAVAILABLE':'RESULT_UNRECOVERABLE':null
      })
      try { router.acknowledgeConversationSource?.({requestId:row.native_request_id,agentId:row.agent_id,expiresAt:committed.expires_at}) } catch { /* durable result committed; original source stays retained */ }
      return committed
    } catch { throw fault('RESULT_PERSIST_FAILED',503) }
  }
  if (storeFile && existsSync(storeFile)) ensureStore()
  const scan = async handle => {
    if (!store || closed) return
    for (const row of store.all()) {
      if (handle && row.reconciliation_handle !== handle) continue
      try { await reconcile(row) } catch { /* canonical read reports the persisted/source condition; never resends */ }
    }
  }
  queueMicrotask(() => { void scan() })
  const dispose = typeof router?.onTurnReconciled === 'function' ? router.onTurnReconciled(event => { void scan(event?.handle) }) : () => {}

  function targetFor(principal, agentId) {
    const target = principal.targets.find(t => t.agent_id === agentId)
    if (!target) throw fault('NOT_FOUND_OR_NOT_VISIBLE',404)
    const agent = definition.getAgent(agentId)
    const binding = router.getBinding(target.binding_id)
    if (agent?.id !== agentId || agent.disabled === true || binding?.activeAgentId !== agentId || binding?.activeSessionId !== 'main') throw fault('NOT_FOUND_OR_NOT_VISIBLE',404)
    return target
  }
  function present(row, cursor) {
    if (row.error_class && row.error_class !== 'RESULT_EXPIRED') throw fault(row.error_class,503)
    if (row.expires_at !== undefined && now() >= row.expires_at) {
      if (row.reply_body !== null) ensureStore().update(row.key,current => { current.reply_body = null; current.reply_status = 'unavailable'; current.error_class = 'RESULT_EXPIRED' })
      throw fault('RESULT_EXPIRED',410)
    }
    const unknown = ['message_id','accepted_at','started_at','finished_at','reply_created_at','session_generation','reply_message_id','native_turn_id'].filter(key => row[key] === null || row[key] === undefined)
    if (!row.session_generation) unknown.push('session_handle')
    return { status: 'OK', contract_version: CONTRACT_VERSION, request_id: row.request_id, agent_id: row.agent_id,
      session_handle: row.session_generation ? sessionHandle(row) : null, session_generation: row.session_generation,
      session_generation_namespace: 'dsh_trajectory_header_sha256_v1', message_id: row.message_id,
      reply_to: row.reply_status === 'available' ? row.message_id : null, relation_source: row.reply_status === 'available' ? 'native_turn' : null,
      native_parent_id: null, workflow_refs: [], submitted_at: row.submitted_at, accepted_at: row.accepted_at,
      started_at: row.started_at, finished_at: row.finished_at, reply_created_at: row.reply_created_at,
      result_persisted_at: row.result_persisted_at, served_at: now(), request_status: row.request_status,
      execution_status: row.execution_status, reply_status: row.reply_status, reply_message_id: row.reply_message_id ?? row.reply_projection_id ?? null,
      reply_message_id_namespace: row.reply_message_id ? 'native_dsh' : 'request_owned_native_turn_v1', native_reply_message_id: row.reply_message_id ?? null,
      reply_projection_id: row.reply_projection_id ?? null, reply_projection_namespace: 'request_owned_native_turn_v1',
      native_turn_id: row.native_turn_id ?? null, main_resolution:row.main_resolution??{disposition:'unknown',reason:'source_field_not_available',generation_change_reason:null},
      continuation:{session_handle:row.session_generation?sessionHandle(row):null,read_result_request_id:row.request_id,
        followup:{operation:'resolve_agent_target',agent_id:row.agent_id,session_policy:'current_main',resume_original_generation:false,requires_current_authorization:true}},
      reply_coverage:row.reply_coverage??null,native_reconciliation_state:row.native_reconciliation_state??null,
      execution_diagnostic:row.execution_diagnostic??null,
      native_outcome:row.native_outcome??null,native_termination_evidence:row.native_termination_evidence??null,retention_ms: row.retention_ms, expires_at: row.expires_at ?? null,
      provenance: 'OWNER_REPORT', business_goal_status: 'unknown', redacted: row.redacted ?? false,
      field_availability: Object.fromEntries(unknown.map(key => [key,{status:'unknown',reason:'source_field_not_available'}])),
      ...(row.reply_status === 'available' ? bodyPage(row.reply_body,cursor,row) : { reply_body:null,next_reply_cursor:null }),
      error: row.error_class ? {class:row.error_class} : null, retryable:false, retry_preconditions:[] }
  }
  return {
    async invoke(operation, body, authorization) {
      let principal
      try {
        if (closed) throw fault('NOT_PROVISIONED',503)
        const config = validateConfig(await configProvider())
        principal = await authenticate({authorization,config,operation,fetchImpl})
        validateArgs(operation,body)
        if (operation === 'resolve') {
          const target = targetFor(principal,body.target.agent_id)
          return { status:200, body:{status:'OK',contract_version:CONTRACT_VERSION,target_handle:targetHandle(principal,target),
            agent_id:target.agent_id,principal_id:target.principal_id,domain:target.domain_id,node_owner:null,
            mapping_provenance:'owner_controlled_config_and_exact_definition',allowed_operations:[...principal.operations],
            sessions:[{mode:'main',history_scope:'request_bound_only'}],unsupported:['fresh','archive','workflow_resolution','history','events']} }
        }
        const db = ensureStore()
        if (operation === 'result') {
          const original = db.get(principal,body.request_id)
          if (!original || !principal.targets.some(t => t.agent_id === original.agent_id)) throw fault('NOT_FOUND_OR_NOT_VISIBLE',404)
          const row = await reconcile(original)
          return {status:200,body:present(row,body.reply_cursor)}
        }
        const old = db.get(principal,body.request_id)
        const target = old && body.target_handle === targetHandle(principal,old.target) ? old.target : principal.targets.find(t => body.target_handle === targetHandle(principal,t))
        if (!target || !principal.targets.some(t => t.agent_id === target.agent_id)) throw fault('NO_ACCESS',403)
        const reservation = db.reserve(principal,body,target,config)
        if (!reservation.fresh) return {status:200,body:present(await reconcile(reservation.row))}
        let receipt
        try {
          targetFor(principal,target.agent_id)
          receipt = await router.sendProductSurface({ requestId:reservation.row.native_request_id,
            bindingId:target.binding_id,agentId:target.agent_id,message:body.message })
        } catch (cause) {
          // AC1159 TEMP DIAGNOSTIC (revert after triage): bounded stderr line
          // for the unclassified send stop. Owner-side log only — the remote
          // response stays the contract UNKNOWN envelope, never this content.
          process.stderr.write(`[conversation] send diagnostic (temp): ${JSON.stringify({
            name: cause?.name ?? null, code: cause?.code ?? null, proven: cause?.proven ?? null,
            status: cause?.status ?? null, routeChain: cause?.routeChain ?? null,
            message: String(cause?.message ?? cause).slice(0, 600),
          })}\n`)
          const noAdmission = cause?.proven === 'zero_byte' || cause?.status === 'not_admitted'
          const row = db.update(reservation.row.key,current => {current.request_status=noAdmission?'not_executed':'unknown'; current.execution_status=noAdmission?'not_started':'unknown'; current.reply_status='unknown'})
          return {status:200,body:present(row)}
        }
        if (receipt?.accepted !== true || !receipt.messageId || !receipt.reconciliationHandle || !receipt.sessionGeneration || receipt.sessionId !== 'main') {
          // AC1159 TEMP DIAGNOSTIC (revert after triage): receipt-shape stop.
          process.stderr.write(`[conversation] send diagnostic (temp): receipt shape stop ${JSON.stringify({
            accepted: receipt?.accepted ?? null, hasMessageId: receipt?.messageId != null,
            hasReconciliationHandle: receipt?.reconciliationHandle != null,
            hasSessionGeneration: receipt?.sessionGeneration != null, sessionId: receipt?.sessionId ?? null,
          })}\n`)
          const row = db.update(reservation.row.key,current => {current.request_status='unknown';current.execution_status='unknown';current.reply_status='unknown'})
          return {status:200,body:present(row)}
        }
        let row
        try {
          row = db.update(reservation.row.key,current => {current.request_status='accepted';current.execution_status='unknown';
            current.accepted_at=time(receipt.acceptedAt) ?? now();current.session_id=receipt.sessionId;
            current.session_generation=receipt.sessionGeneration ?? null;current.message_id=receipt.messageId;current.reconciliation_handle=receipt.reconciliationHandle;
            current.main_resolution=receipt.mainResolution??{disposition:'unknown',reason:'source_field_not_available',generation_change_reason:null}})
        } catch { throw fault('RESULT_PERSIST_FAILED',503) }
        row = await reconcile(row)
        return {status:202,body:present(row)}
      } catch (error) {
        const response = failure(error,body?.request_id)
        if (principal && store && ['RESULT_PERSIST_FAILED','RESULT_UNRECOVERABLE','RESULT_EXPIRED','UPSTREAM_UNAVAILABLE','OUTCOME_UNKNOWN','TARGET_RUN_FAILED','NOT_EXECUTED','REPLY_UNAVAILABLE','TRUNCATED'].includes(error?.className)) {
          const row = error.knownFacts ?? store.get(principal,body?.request_id)
          if (row && principal.targets.some(t => t.agent_id === row.agent_id)) Object.assign(response.body,{
            agent_id:row.agent_id,message_id:row.message_id,request_status:row.request_status,
            execution_status:row.execution_status,reply_status:row.reply_status,reply_body:null,
            session_handle:row.session_generation?sessionHandle(row):null,session_generation:row.session_generation,
            native_reconciliation_state:row.native_reconciliation_state??null,native_outcome:row.native_outcome??null,
            native_termination_evidence:row.native_termination_evidence??null,reply_coverage:row.reply_coverage??null,
            source_read_state:row.source_read_state??null,main_resolution:row.main_resolution??{disposition:'unknown',reason:'source_field_not_available',generation_change_reason:null},
            submitted_at:row.submitted_at,accepted_at:row.accepted_at,started_at:row.started_at,
            finished_at:row.finished_at,reply_created_at:row.reply_created_at,result_persisted_at:row.result_persisted_at,
          })
        }
        return response
      }
    },
    close() {closed=true;dispose()},
    reconcilePending: () => scan(),
  }
}
