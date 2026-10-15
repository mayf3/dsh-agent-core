import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtempSync,rmSync,chmodSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createConversationSource,readConversationSource} from '../../../agent-router/src/conversation/source.js'
import {atomicPrivateJson} from '../../../agent-router/src/conversation/persistence.js'
import {createConversationService} from '../../src/conversation/service.js'

test('real source turn-end disk fault is reported through original request; no perpetual pending and no replay',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'native-source-fault-')),sourceDir=join(dir,'source'),agentId='agt_pilot'
  t.after(()=>rmSync(dir,{recursive:true,force:true}))
  const source=createConversationSource({directory:sourceDir,agentId,write(path,row){
    if(row.state!=='completed')return atomicPrivateJson(path,row)
    chmodSync(sourceDir,0o500)
    try{return atomicPrivateJson(path,row)}finally{chmodSync(sourceDir,0o700)}
  }})
  let sent=0,nativeId
  const router={getBinding:()=>({activeAgentId:agentId,activeSessionId:'main'}),onTurnReconciled:()=>()=>{},
    getTurnReconciliation:()=>({state:'settled',snapshot:{agentId,sessionId:'main',messageId:'native-user',outcome:'completed'}}),
    readConversationSource:({requestId})=>readConversationSource({directory:sourceDir,agentId,requestId}),
    async sendProductSurface({requestId}){
      sent+=1
      nativeId=requestId
      const session={id:'main',header:{id:'main',createdAt:11}}
      const receipt=source.reserve({requestId,session,message:{id:'native-user'}})
      const events=[['agent/inbox/spliced',{inserted:[{id:'native-user'}]}],['turn/start',{turn:1}],['user/message',{id:'native-user'}],
        ['assistant/message',{turn:1,message:{content:[{type:'text',text:'retained text without terminal commit'}]}}],['turn/end',{turn:1,reason:{kind:'completed'}}]]
      events.forEach(([type,data],seq)=>{try{source.onEvent(session,{type,data,seq,time:100+seq})}catch{/* original Router facts still flow */}})
      return{accepted:true,sessionId:'main',messageId:'native-user',reconciliationHandle:'native-turn',...receipt}
    }}
  const config={enabled:true,authServiceOrigin:'https://auth.example',retentionMs:10000,maxRecords:10,clients:[{
    clientId:'client',subject_id:'subject',communication_scope_id:'scope',principal_id:'product',operations:['resolve','send','result'],
    targets:[{agent_id:agentId,principal_id:'agent',domain_id:'domain',binding_id:'mcp:pilot',routing_version:'1'}]}]}
  const service=createConversationService({router,definition:{getAgent:()=>({id:agentId})},storeFile:join(dir,'requests.json'),configProvider:()=>config,
    fetchImpl:async()=>({status:200,ok:true,json:async()=>({access_token:'fixture-only',token_type:'Bearer',expires_in:60})})})
  t.after(()=>service.close())
  const auth='Basic '+Buffer.from('client:fixture-only').toString('base64')
  const resolved=await service.invoke('resolve',{target:{agent_id:agentId}},auth)
  const payload={request_id:'source-write-failure',target_handle:resolved.body.target_handle,message:'new request'}
  const result=await service.invoke('send',payload,auth)
  assert.equal(result.body.error.class,'RESULT_UNRECOVERABLE')
  assert.equal(result.body.execution_status,'completed')
  assert.equal(result.body.reply_status,'unknown')
  assert.ok(result.body.diagnostic_id)
  assert.equal(readConversationSource({directory:sourceDir,agentId,requestId:nativeId}).state,'pending')
  await service.invoke('send',payload,auth)
  await service.invoke('result',{request_id:payload.request_id},auth)
  assert.equal(sent,1)
})
