import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {apply as applyRouter} from '../../src/index.js'
import {createConversationSource} from '../../src/conversation/source.js'
import {makeFx} from '../helpers/fake-child.js'

test('real Router ProductSurface seam preserves dedicated binding/main and hands source metadata to original chain',async t=>{
  const root=mkdtempSync(join(tmpdir(),'native-router-'))
  t.after(()=>rmSync(root,{recursive:true,force:true}))
  const sourceDirectory=join(root,'source'),agentId='agt_pilot',calls=[]
  let owner
  const target={id:agentId,name:'Pilot'}
  const definition={getAgent:id=>id===agentId?target:undefined,listAgents:()=>[target],getDefaultAgent:()=>target,resolveAgentRef:()=>target}
  const bootstrap={resolveWorkspace:()=>'/fixture/workspace',resolveDshHome:()=>'/fixture/home',ensure:async()=>({workspace:'/fixture/workspace',dshHome:'/fixture/home'}),
    validateWorkspaceId:id=>id,resolveWorkspacePath:id=>'/fixture/'+id,ensureWorkspace:async()=>{}}
  const ctx={get:key=>({agentDefinition:definition,workspaceBootstrap:bootstrap})[key],provide(){},effect:fn=>fn()}
  const processFactory=opts=>({pid:12345,exit:undefined,state:'READY',spawn(){},ready:async()=>0,shutdown:async()=>{},
    deliver:async(sessionId,text,options)=>{
      calls.push({sessionId,text,options,opts})
      owner=createConversationSource({directory:opts.env.DSH_CONVERSATION_SOURCE_DIR,agentId})
      const session={id:sessionId,header:{id:sessionId,createdAt:44,cwd:'/fixture/workspace'}}
      const retained=owner.reserve({requestId:options.conversationSource.requestId,session,message:{id:'native-user'}})
      const events=[['agent/inbox/spliced',{inserted:[{id:'native-user'}]}],['turn/start',{turn:4}],['user/message',{id:'native-user'}],
        ['assistant/message',{turn:4,message:{id:'native-reply',content:[{type:'text',text:'actual retained reply'}]}}],['turn/end',{turn:4,reason:{kind:'completed'}}]]
      events.forEach(([type,data],i)=>owner.onEvent(session,{type,data,seq:i,time:100+i}))
      return{accepted:true,sessionId,messageId:'native-user',reconciliationHandle:'fixture-handle',...retained}
    }})
  const router=applyRouter(ctx,{bindingsStoreFile:join(root,'bindings.json'),agentProfile:'fixture',defaultSessionId:'main',conversationSourceDir:sourceDirectory,processFactory,provisionHome:async()=>({})})
  await router.switchAgent('mcp:pilot',agentId)
  const before=router.bindingsSnapshot()
  const receipt=await router.sendProductSurface({requestId:'mcpnc-runtime',bindingId:'mcp:pilot',agentId,message:'question'})
  assert.equal(receipt.accepted,true)
  assert.equal(calls[0].options.productSurface,true)
  assert.equal(calls[0].options.bindingContext,'mcp:pilot')
  assert.equal(calls[0].options.callerCorrelation.requestId,'mcpnc-runtime')
  assert.equal(calls[0].options.messageOrigin,undefined,'human provenance is not ASM')
  assert.deepEqual(router.bindingsSnapshot(),before)
  assert.equal(router.readConversationSource({requestId:'mcpnc-runtime',agentId}).reply_body,'actual retained reply')
  await assert.rejects(router.sendProductSurface({requestId:'must-not-send',bindingId:'mobile:other',agentId,message:'x'}))
  assert.equal(calls.length,1)
})

test('real AgentProcess receipt-only product surface holds trusted context until original terminal',async()=>{
  const fx=makeFx()
  await fx.readyNow()
  fx.proc.initializeEvidence.conversationSource={version:1}
  const pending=fx.proc.deliver('main','question',{bindingContext:'mcp:pilot',productSurface:true,
    conversationSource:{requestId:'mcpnc-process'},callerCorrelation:{requestId:'mcpnc-process'}})
  await fx.tick()
  assert.equal(fx.proc.activeBindingContext,'mcp:pilot')
  const prompt=fx.respondTo('session/prompt',{messageId:'source-user',sessionGeneration:'trajectory-not-process-generation'})
  const receipt=await pending
  assert.equal(prompt.params.conversationSource.requestId,'mcpnc-process')
  assert.equal(receipt.sessionGeneration,'trajectory-not-process-generation')
  assert.equal(fx.proc.activeBindingContext,'mcp:pilot','inbox receipt does not clear active surface')
  fx.completeTurn('main','source-user','answer')
  await fx.tick()
  assert.equal(fx.proc.activeBindingContext,undefined)
  assert.equal(fx.store.resolveCallerCorrelation({requestId:'mcpnc-process'}).snapshot.messageId,'source-user')
  fx.childExit()
})
