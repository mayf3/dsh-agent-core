import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync, existsSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../../src/index.js'

const agent = 'agt_pilot'
const credential = 'Basic ' + Buffer.from('pilot-client:fixture-secret').toString('base64')
export const pilotConfig = () => ({ enabled: true, authServiceOrigin: 'https://auth.example', retentionMs: 3600000,
  maxRecords: 100, clients: [{ clientId: 'pilot-client', subject_id: 'dot-subject', communication_scope_id: 'pilot-scope',
    principal_id: 'product-principal', operations: ['resolve', 'send', 'result'], targets: [{ agent_id: agent,
      principal_id: 'agent-principal', domain_id: 'pilot-domain', binding_id: 'mcp:pilot', routing_version: '1' }] }] })

async function fixture(t) {
  const modulePath = new URL('../../src/conversation/service.js', import.meta.url)
  assert.ok(existsSync(modulePath), 'native conversation service is implemented')
  const { createConversationService } = await import(modulePath)
  const dir = mkdtempSync(join(tmpdir(), 'native-pilot-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const calls = [], sources = new Map(), listeners = new Set()
  const router = {
    getBinding: () => ({ activeAgentId: agent, activeSessionId: 'main', workspace: null }),
    sendProductSurface: async ({ requestId }) => { calls.push(requestId); return { accepted: true, sessionId: 'main',
      messageId: 'user-' + calls.length, sessionGeneration: 'trajectory:fixture', reconciliationHandle: 'turn-' + calls.length } },
    readConversationSource: ({ requestId }) => sources.get(requestId) ?? { state: 'pending' },
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    onTurnReconciled: fn => { listeners.add(fn); return () => listeners.delete(fn) },
  }
  const config = pilotConfig()
  const authCalls = []
  const fetchImpl = async (url, options) => { authCalls.push({ url, options }); return { ok: true, status: 200,
    json: async () => ({ access_token: 'fixture-ignored-token', token_type: 'Bearer', expires_in: 60 }) } }
  const make = () => createConversationService({ router, definition: { getAgent: id => ({ id, disabled: false }) },
    storeFile: join(dir, 'requests.json'), configProvider: () => config, fetchImpl })
  const service = make()
  t.after(() => service.close())
  const resolve = () => service.invoke('resolve', { target: { agent_id: agent } }, credential)
  const finish = (nativeId, text, messageId = 'reply-native') => {
    sources.set(nativeId, { state: 'completed', agent_id: agent, session_id: 'main', session_generation: 'trajectory:fixture',
      message_id: 'user-' + (calls.indexOf(nativeId) + 1), turn_id: calls.indexOf(nativeId) + 1, reply_message_id: messageId,
      reply_body: text, started_at: 100, finished_at: 200, reply_created_at: 199, source_retained: true })
  }
  return { service, make, calls, sources, listeners, resolve, finish, config, authCalls, router, dir }
}

test('native HTTP routes fail closed while unconfigured; no Router target read', async t => {
  const services = new Map([['agentRouter', {}], ['agentDefinition', {}]])
  const disposers = []
  const ctx = { get: key => services.get(key), provide: (k,v) => services.set(k,v), effect: fn => disposers.push(fn()) }
  const api = apply(ctx, { port: 0 })
  t.after(() => disposers.forEach(fn => fn?.()))
  await new Promise(resolve => setImmediate(resolve))
  const res = await fetch('http://127.0.0.1:' + api.address().port + '/v1/conversation/send', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.equal(res.status, 503)
  const body = await res.json()
  assert.equal(body.error.class, 'NOT_PROVISIONED')
  assert.ok(body.diagnostic_id)
})

test('principal-scoped request key survives restart, duplicates do not send, payload conflict is explicit', async t => {
  const f = await fixture(t)
  const resolved = await f.resolve()
  assert.equal(resolved.status, 200)
  const payload = { request_id: 'new-pilot-1', target_handle: resolved.body.target_handle, message: 'progress?' }
  const [a,b] = await Promise.all([f.service.invoke('send', payload, credential), f.service.invoke('send', payload, credential)])
  assert.equal(a.body.request_id, payload.request_id)
  assert.equal(b.body.request_id, payload.request_id)
  assert.equal(f.calls.length, 1)
  assert.equal((await f.service.invoke('send', { ...payload, message: 'changed' }, credential)).status, 409)
  f.finish(f.calls[0], 'owner report')
  const result = await f.service.invoke('result', { request_id: payload.request_id }, credential)
  assert.equal(result.body.reply_status, 'available')
  assert.equal(result.body.reply_body, 'owner report')
  assert.equal(result.body.reply_to, 'user-1')
  f.service.close()
  const restarted = f.make()
  t.after(() => restarted.close())
  assert.equal((await restarted.invoke('result', { request_id: payload.request_id }, credential)).body.reply_body, 'owner report')
  assert.equal(f.calls.length, 1)
})

test('two reverse-order replies use native request coordinates; automatic callback persists results', async t => {
  const f = await fixture(t), resolved = await f.resolve()
  for (const request_id of ['one','two']) await f.service.invoke('send', { request_id, target_handle: resolved.body.target_handle, message: request_id }, credential)
  f.finish(f.calls[1], 'second reply', 'reply-2')
  for (const fn of f.listeners) fn({ handle: 'turn-2' })
  await new Promise(resolve => setImmediate(resolve))
  f.finish(f.calls[0], 'first reply', 'reply-1')
  for (const fn of f.listeners) fn({ handle: 'turn-1' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal((await f.service.invoke('result', { request_id: 'one' }, credential)).body.reply_body, 'first reply')
  assert.equal((await f.service.invoke('result', { request_id: 'two' }, credential)).body.reply_body, 'second reply')
})

test('authorization revalidated per request and grants/targets are not borrowed from a handle', async t => {
  const f = await fixture(t), target = await f.resolve()
  f.config.clients[0].operations = ['resolve']
  const denied = await f.service.invoke('send', { request_id: 'denied', target_handle: target.body.target_handle, message: 'x' }, credential)
  assert.equal(denied.status, 403)
  assert.equal(f.calls.length, 0)
  assert.equal(f.authCalls.length, 2)
  assert.equal(new URLSearchParams(f.authCalls[0].options.body).get('resource'), 'agent-core-mcp-conversation-v1')
  assert.equal(new URLSearchParams(f.authCalls[0].options.body).get('scope'), 'conversation.access')
  assert.equal((await f.service.invoke('resolve', { target: { workflow_instance_id: '00000000-0000-4000-8000-000000000000' } }, credential)).body.error.class, 'NOT_SUPPORTED')
})

test('reserved/unknown original is recovered from source after lost receipt, never routed again',async t=>{
  const f=await fixture(t),target=await f.resolve()
  const payload={request_id:'receipt-lost',target_handle:target.body.target_handle,message:'one new question'}
  const original=f.service
  // The source is still correlated by the deterministic native request even
  // if the HTTP transport disappears after sending and before reading it.
  const deliver=f.router.sendProductSurface
  f.router.sendProductSurface=async args=>{await deliver(args);throw Error('receipt transport lost')}
  const uncertain=await original.invoke('send',payload,credential)
  assert.equal(uncertain.body.request_status,'unknown')
  f.finish(f.calls[0],'reply retained before facade restart')
  original.close()
  const restored=f.make()
  t.after(()=>restored.close())
  const result=await restored.invoke('result',{request_id:payload.request_id},credential)
  assert.equal(result.body.reply_status,'available')
  assert.equal(result.body.reply_body,'reply retained before facade restart')
  assert.equal(f.calls.length,1)
})

test('missing auth and stale target are denied without sending or exposing source',async t=>{
  const f=await fixture(t)
  const denied=await f.service.invoke('resolve',{target:{agent_id:agent}},'')
  assert.equal(denied.status,401)
  assert.ok(denied.body.diagnostic_id)
  assert.equal(JSON.stringify(denied).includes('fixture-secret'),false)
  const target=await f.resolve()
  f.config.clients[0].targets[0].routing_version='2'
  assert.equal((await f.service.invoke('send',{request_id:'stale',target_handle:target.body.target_handle,message:'x'},credential)).status,403)
  assert.equal(f.calls.length,0)
})

test('pagination gives UTF8-safe complete reply with stable projection ID when native assistant ID is unknown',async t=>{
  const f=await fixture(t),target=await f.resolve()
  await f.service.invoke('send',{request_id:'long',target_handle:target.body.target_handle,message:'x'},credential)
  f.finish(f.calls[0],'业务回复'.repeat(2000),null)
  let cursor,body='',id
  do{
    const result=await f.service.invoke('result',{request_id:'long',...(cursor?{reply_cursor:cursor}:{})},credential)
    assert.equal(result.body.reply_status,'available')
    assert.equal(result.body.native_reply_message_id,null)
    assert.ok(result.body.reply_message_id.startsWith('reply_nc1_'))
    if(id)assert.equal(result.body.reply_message_id,id)
    id=result.body.reply_message_id
    assert.ok(Buffer.byteLength(result.body.reply_body)<=6144)
    body+=result.body.reply_body
    cursor=result.body.next_reply_cursor
  }while(cursor)
  assert.equal(body,'业务回复'.repeat(2000))
})


test('a settled native turn with source still pending is an explicit unrecoverable failure, not perpetual pending',async t=>{
  const f=await fixture(t),target=await f.resolve()
  await f.service.invoke('send',{request_id:'source-fault',target_handle:target.body.target_handle,message:'x'},credential)
  f.router.getTurnReconciliation=()=>({state:'settled',snapshot:{agentId:agent,sessionId:'main',messageId:'user-1',outcome:'completed'}})
  const result=await f.service.invoke('result',{request_id:'source-fault'},credential)
  assert.equal(result.body.error.class,'RESULT_UNRECOVERABLE')
  assert.equal(result.body.execution_status,'completed')
  assert.equal(result.body.reply_status,'unknown')
  assert.ok(result.body.diagnostic_id)
  assert.equal(f.calls.length,1)
})

test('source retained but facade disk write fails: original result can be repaired, never resent',async t=>{
  const f=await fixture(t),target=await f.resolve()
  await f.service.invoke('send',{request_id:'persist-fault',target_handle:target.body.target_handle,message:'x'},credential)
  f.finish(f.calls[0],'source survived')
  chmodSync(f.dir,0o500)
  let failed
  try{failed=await f.service.invoke('result',{request_id:'persist-fault'},credential)}finally{chmodSync(f.dir,0o700)}
  assert.equal(failed.body.error.class,'RESULT_PERSIST_FAILED')
  assert.equal(f.calls.length,1)
  const repaired=await f.service.invoke('result',{request_id:'persist-fault'},credential)
  assert.equal(repaired.body.reply_body,'source survived')
  assert.equal(f.calls.length,1)
})

test('native turn-end content waits for original Router reconciliation rather than claiming process completion early',async t=>{
  const f=await fixture(t),target=await f.resolve()
  await f.service.invoke('send',{request_id:'settlement',target_handle:target.body.target_handle,message:'x'},credential)
  f.finish(f.calls[0],'reply source retained')
  f.router.getTurnReconciliation=()=>({state:'pending'})
  assert.equal((await f.service.invoke('result',{request_id:'settlement'},credential)).body.reply_status,'pending')
  f.router.getTurnReconciliation=()=>({state:'settled',snapshot:{agentId:agent,sessionId:'main',messageId:'user-1',outcome:'completed'}})
  assert.equal((await f.service.invoke('result',{request_id:'settlement'},credential)).body.reply_status,'available')
})

test('B001: original native unknown, termination and source EIO preserve exact facts with diagnostics and zero replay',async t=>{
  const f=await fixture(t),target=await f.resolve()
  const payload={request_id:'native-unknown',target_handle:target.body.target_handle,message:'original question'}
  await f.service.invoke('send',payload,credential)
  const snapshot={agentId:agent,sessionId:'main',messageId:'user-1',initialOutcome:'outcome_unknown'}
  f.router.getTurnReconciliation=()=>({state:'pending',snapshot})
  let result=await f.service.invoke('result',{request_id:payload.request_id},credential)
  assert.equal(result.body.execution_status,'unknown')
  assert.equal(result.body.reply_status,'unknown')
  assert.equal(result.body.error.class,'OUTCOME_UNKNOWN')
  assert.ok(result.body.diagnostic_id)
  assert.deepEqual(result.body.retry_preconditions,['query_original_request_only'])
  f.router.getTurnReconciliation=()=>({state:'settled',snapshot:{...snapshot,lateOutcome:'terminated_without_outcome',terminationEvidence:'child_real_exit'}})
  result=await f.service.invoke('result',{request_id:payload.request_id},credential)
  assert.equal(result.body.execution_status,'interrupted')
  assert.equal(result.body.native_outcome,'terminated_without_outcome')
  assert.equal(result.body.message_id,'user-1')
  const originalSourceReader=f.router.readConversationSource
  f.router.readConversationSource=()=>{throw Object.assign(new Error('/private/secret/source EIO'),{code:'EIO'})}
  result=await f.service.invoke('result',{request_id:payload.request_id},credential)
  assert.equal(result.body.error.class,'UPSTREAM_UNAVAILABLE')
  assert.equal(result.body.execution_status,'interrupted')
  assert.equal(result.body.request_id,payload.request_id)
  assert.equal(JSON.stringify(result).includes('/private/secret'),false)
  f.router.readConversationSource=originalSourceReader
  const recoveredRead=await f.service.invoke('result',{request_id:payload.request_id},credential)
  assert.equal(recoveredRead.body.error.class,'OUTCOME_UNKNOWN')
  assert.equal(recoveredRead.body.source_read_state,'available')
  await f.service.invoke('send',payload,credential)
  assert.equal(f.calls.length,1)
})

test('B002: completed wholly-empty native turn is not an available empty business reply',async t=>{
  const f=await fixture(t),target=await f.resolve()
  await f.service.invoke('send',{request_id:'empty-anchor',target_handle:target.body.target_handle,message:'x'},credential)
  f.finish(f.calls[0],'','usage-only')
  const result=await f.service.invoke('result',{request_id:'empty-anchor'},credential)
  assert.notEqual(result.body.reply_status,'available')
  assert.equal(result.body.error.class,'REPLY_UNAVAILABLE')
  assert.equal(result.body.reply_coverage.reason,'no_visible_reply')
})

test('auth redirect rejection keeps the fixed canonical token endpoint and never follows a management target',async t=>{
  const {createConversationService}=await import('../../src/conversation/service.js')
  const dir=mkdtempSync(join(tmpdir(),'native-auth-redirect-'))
  t.after(()=>rmSync(dir,{recursive:true,force:true}))
  const paths=[],config=pilotConfig()
  config.authServiceOrigin+='/'
  const service=createConversationService({router:{onTurnReconciled:()=>()=>{}},definition:{},storeFile:join(dir,'requests.json'),configProvider:()=>config,
    fetchImpl:async(url,options)=>{
      paths.push(new URL(url).pathname)
      if(options.redirect==='error')throw new TypeError('redirect forbidden')
      paths.push('/forbidden-management')
      return {ok:true,status:200,json:async()=>({access_token:'fixture',token_type:'Bearer',expires_in:60})}
    }})
  t.after(()=>service.close())
  const result=await service.invoke('resolve',{target:{agent_id:agent}},credential)
  assert.equal(result.body.error.class,'AUTH_INCONCLUSIVE')
  assert.deepEqual(paths,['/oauth/token'])
})

test('B003: retained native main resolution and scoped lawful continuation survive result persistence',async t=>{
  const f=await fixture(t),target=await f.resolve()
  await f.service.invoke('send',{request_id:'main-resolution',target_handle:target.body.target_handle,message:'x'},credential)
  f.finish(f.calls[0],'reply')
  const source=f.sources.get(f.calls[0])
  source.main_resolution={disposition:'created',reason:'main_artifact_absent',generation_change_reason:null,
    generation_change_reason_availability:'unknown_no_native_reset_cause'}
  const result=await f.service.invoke('result',{request_id:'main-resolution'},credential)
  assert.equal(result.body.main_resolution.disposition,'created')
  assert.equal(result.body.main_resolution.generation_change_reason,null)
  assert.equal(result.body.continuation.session_handle,result.body.session_handle)
  assert.equal(result.body.continuation.read_result_request_id,'main-resolution')
  assert.equal(result.body.continuation.followup.resume_original_generation,false)
  assert.equal(result.body.continuation.followup.requires_current_authorization,true)
  f.service.close()
  const reopened=f.make()
  t.after(()=>reopened.close())
  assert.deepEqual((await reopened.invoke('result',{request_id:'main-resolution'},credential)).body.main_resolution,result.body.main_resolution)
})
