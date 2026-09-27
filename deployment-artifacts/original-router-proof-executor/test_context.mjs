import test from 'node:test'
import assert from 'node:assert/strict'
import processes from 'node:child_process'
import fs from 'node:fs'
import * as processModule from 'node:child_process'
import * as fsModule from 'node:fs'
import * as crypto from 'node:crypto'
import * as url from 'node:url'
import * as net from 'node:net'
import { syncBuiltinESMExports } from 'node:module'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import { memoryModule } from './memory_loader.mjs'

const originalURL=new URL('../../packages/production-runtime/src/native-arm64/hr-s256-r2-startup-context.mjs',import.meta.url)
const exactSource=fs.readFileSync(originalURL,'utf8')
const ingressURL=new URL('../../packages/agent-router/src/ingress-delivery.js',import.meta.url)
const ingressSource=fs.readFileSync(ingressURL,'utf8')
const cached=new Map([['node:child_process',processModule],['node:fs',fsModule],
  ['node:crypto',crypto],['node:url',url],['node:net',net]])

const calls = []
const originals = []
const promises=fs.promises
for (const object of [processes,fs,promises,net.default]) {
  const names=Object.keys(object).filter(name=>typeof object[name] === 'function')
  for (const name of names) {
    originals.push([object,name,Object.getOwnPropertyDescriptor(object,name)])
    Object.defineProperty(object,name,{configurable:true,enumerable:true,writable:true,
      value:(...args) => { calls.push([name,args]); throw new Error('TEST_HOST_HARD_DENY') }})
  }
}
syncBuiltinESMExports()
const context = await memoryModule(exactSource,originalURL.href,cached)
let ownedContext
test.after(() => { for (const [o,n,v] of originals) Object.defineProperty(o,n,v); syncBuiltinESMExports() })

test('qualification reply observer is inert without authenticated qualification', () => {
  assert.equal(context.qualificationReplyObserver({}),undefined)
  assert.deepEqual(calls,[])
})

test('qualification private descriptor grammar stays separate from HR context', () => {
  const args=['--hr-qf-context-sha256','a'.repeat(64),'--hr-qf-challenge-fd','3',
    '--hr-qf-window-fd','4','--hr-qf-context-fd','5','--root','/fixed/runtime']
  const parsed=context.parsedQualificationInvocation(args)
  assert.deepEqual(parsed.runtimeArgs,['--root','/fixed/runtime'])
  assert.equal(context.getFixedStartupContext(),undefined)
  for (const invalid of [[],args.slice(2),[...args,'--hr-r2-receipt-sha256','b'.repeat(64)],
      [...args,'--hr-qf-extra','PASS']]) assert.throws(() => context.parsedQualificationInvocation(invalid))
  assert.deepEqual(calls,[])
})

test('gated authentication joins separate root-context descriptors without HR installation', async () => {
  const body={role:'original_executor_qualification',phase:'restart_a',consumingBinarySha256:'a'.repeat(64),
    validatorSha256:'c'.repeat(64),entryManifestSha256:'e'.repeat(64),
    procedureSha256:'d8cfc5a3925c29ee843258a8077f57f4d8223f44bf697bbd24edba011753911e',startupNonce:'b'.repeat(64)}
  const raw=Buffer.from(JSON.stringify(body,Object.keys(body).sort()))
  const digest=crypto.createHash('sha256').update(raw).digest('hex')
  const commands=[]
  const argv=process.argv
  const denialFS={fstatSync:fs.fstatSync,readSync:fs.readSync},denialSpawn=processes.spawnSync
  fs.fstatSync=()=>({uid:0,nlink:1,mode:0o100600,size:raw.length,dev:1,ino:8,mtimeMs:1,ctimeMs:1,isFile:()=>true})
  fs.readSync=(fd,buffer,offset,length,position)=>raw.copy(buffer,offset,position,position+length)
  processes.spawnSync=(...args)=>{commands.push(args);return {status:0,stdout:JSON.stringify(body)}}
  syncBuiltinESMExports()
  try {
    const owned=await memoryModule(exactSource,originalURL.href,cached)
    ownedContext=owned
    process.argv=['node','gated','--hr-qf-context-sha256',digest,'--hr-qf-challenge-fd','3',
      '--hr-qf-window-fd','4','--hr-qf-context-fd','5','--root','/fixed/runtime']
    assert.deepEqual(Array.from(await owned.authenticateFixedStartupContext()),['--root','/fixed/runtime'])
    assert.equal(owned.getFixedStartupContext(),undefined)
    assert.equal(commands.length,1)
    assert.equal(commands[0][0],'/usr/bin/python3')
    assert.equal(commands[0][1][3],'--qualification-prove')
    assert.equal(commands[0][2].timeout,750)
    await assert.rejects(owned.authenticateFixedStartupContext(),/NO_REPLAY/)
    assert.deepEqual(calls,[])
  } finally {
    process.argv=argv
    fs.fstatSync=denialFS.fstatSync;fs.readSync=denialFS.readSync;processes.spawnSync=denialSpawn
    syncBuiltinESMExports()
  }
})


test('actual provided Router binds qualification completion to its own runtime only', () => {
  const binding={role:'original_executor_qualification',phase:'restart_a',
    consumingBinarySha256:'a'.repeat(64),validatorSha256:'b'.repeat(64),
    entryManifestSha256:'c'.repeat(64),startupNonce:'b'.repeat(64),
    procedureSha256:'d8cfc5a3925c29ee843258a8077f57f4d8223f44bf697bbd24edba011753911e'}
  const query={context:binding,challenge:'e'.repeat(32),handle:'turn-owned',
    deadlineMonotonicNs:String(process.hrtime.bigint()+15_000_000_000n)}
  const runtime={generationId:'actual-owned-runtime',health:'healthy',businessAdmission:'open'}
  const record={handle:'turn-owned',runtimeEpoch:'actual-owned-runtime',agentId:'agt_cto-agent',
    processGeneration:2,settlementResult:'completed',fenceState:'cleared',
    finalAssistantOutput:{originalBytes:3},messageId:'native-receipt',updatedAt:10,
    ingressCorrelation:{channelNamespace:'feishu',feishuMessageId:'new-native-message'}}
  const service={reconciliationRuntimeStatus:()=>runtime,
    getTurnReconciliation:handle=>{assert.equal(handle,'turn-owned');return {state:'settled',snapshot:record}}}
  let lateReads=0
  assert.throws(()=>ownedContext.qualificationRuntimeProjection({...query,deadlineMonotonicNs:'1'},
    {reconciliationRuntimeStatus:()=>{lateReads++;return runtime}},binding),/QF_READBACK_DEADLINE/)
  assert.equal(lateReads,0)
  const store={occupancy:()=>({runtimeEpoch:runtime.generationId}),
    getTurnReconciliation:service.getTurnReconciliation}
  assert.throws(()=>ownedContext.qualificationRuntimeProjection(query,service,binding,store),/QF_REPLY_COMPLETION_UNKNOWN/)
  const returnedReply={messageId:'actual-outbound-reply',chatId:'actual-chat',method:'reply'}
  ownedContext.qualificationReplyObserver(store)('turn-owned',returnedReply)
  const actual=ownedContext.qualificationRuntimeProjection(query,service,binding,store)
  assert.equal(actual.runtimeGeneration,'actual-owned-runtime')
  assert.equal(actual.nativeReceiptSha256,crypto.createHash('sha256').update('native-receipt').digest('hex'))
  assert.equal(actual.replyReceiptSha256,crypto.createHash('sha256').update(JSON.stringify(returnedReply)).digest('hex'))
  for(const change of [{runtimeEpoch:'other-runtime'},{agentId:'other-agent'},
    {settlementResult:'failed'},{finalAssistantOutput:null},{messageId:''}]) {
    assert.throws(()=>ownedContext.qualificationRuntimeProjection(query,
      {...service,getTurnReconciliation:()=>({state:'settled',snapshot:{...record,...change}})},binding,store),/QF_OWNED_TURN_UNKNOWN/)
  }
  for(const change of [{phase:'fourth'},{startupNonce:'f'.repeat(64)},{PASS:true}])
    assert.throws(()=>ownedContext.qualificationRuntimeProjection({...query,context:{...binding,...change}},service,binding,store),/QF_READBACK_BINDING/)
  for (const returned of [undefined,{}, {...returnedReply,messageId:''},{...returnedReply,method:'create'},
    {...returnedReply,PASS:true}]) {
    const badStore={...store}
    ownedContext.qualificationReplyObserver(badStore)('turn-owned',returned)
    assert.throws(()=>ownedContext.qualificationRuntimeProjection(query,service,binding,badStore),/QF_REPLY_COMPLETION_UNKNOWN/)
  }
  ownedContext.qualificationReplyObserver(store)('turn-owned',returnedReply)
  assert.throws(()=>ownedContext.qualificationRuntimeProjection(query,service,binding,store),/QF_REPLY_COMPLETION_UNKNOWN/)
  assert.deepEqual(calls,[])
})

test('actual authenticated ingress captures only its resolved original reply return', async () => {
  const links=new Map([
    ['node:crypto',crypto],
    ['./channel-conversation.js',{ingressBindingNamespace:()=> 'feishu',feishuReplyOwed:()=>true}],
    ['./route-chain.js',{ROUTE_HOP_FAILURE_CLASSES:{}}],
    ['./process/state-machine.js',{fencedRejection:()=>{throw Error('unexpected fence')}}],
    ['./reconciliation/query.js',{outerFailureProjection:()=>{throw Error('unexpected fence')}}],
    ['./ingress-authenticated.js',{authenticatedFeishuFields:()=>({}),ingressTurnOpts:()=>({}),authenticatedCorrelation:()=>({})}],
  ])
  const module=new SourceTextModule(ingressSource,{identifier:ingressURL.href,
    initializeImportMeta(meta){meta.url=ingressURL.href},
    importModuleDynamically(){throw Error('MEMORY_DYNAMIC_IMPORT_DENIED')}})
  await module.link(specifier=>{
    if(!links.has(specifier))throw Error('MEMORY_IMPORT_DENIED')
    const target=links.get(specifier),names=Object.keys(target)
    return new SyntheticModule(names,function(){for(const name of names)this.setExport(name,target[name])})
  })
  await module.evaluate()
  const record={handle:'turn-owned',agentId:'agt_cto-agent',runtimeEpoch:'owned-runtime',settlementResult:'completed'}
  for(const mode of ['success','void','throw','wrong-child']) {
    const store={assertMintCapacity(){},occupancy:()=>({runtimeEpoch:'owned-runtime'}),
      getTurnReconciliation:()=>({snapshot:{...record,...(mode==='wrong-child'?{runtimeEpoch:'other-child'}:{})}})}
    const captured=[]
    const actualObserver=ownedContext.qualificationReplyObserver(store)
    const result={messageId:'actual-transport-receipt',chatId:'fixed-chat',method:'reply'}
    let replies=0
    const ingress=module.namespace.createIngressDelivery({
      log:{log(){},error(){}},store:{},reconciliationStore:store,workspaceBootstrap:{},
      feishu:{replyTargetFor:()=>({replyTo:()=>({})}),reply:async()=>{
        replies++;if(mode==='throw')throw Error('actual transport unknown');return mode==='void'?undefined:result}},
      routeChain:{runTurnWithRouteChain:async()=>({reply:'actual reply',pid:1,reconciliationHandle:'turn-owned'})},
      resolveChannelConversation:async()=>({channelConversation:{id:'actual-conversation'},
        binding:{activeAgentId:'agt_cto-agent',activeSessionId:'fixed-session'}}),
      resolveEffectiveWorkspace:()=>({workspaceId:null,workspacePath:'/disposable'}),
      registerAuthenticatedIngress(){},observeQualificationReply:(...args)=>{captured.push(args);actualObserver(...args)},
    })
    const returned=await ingress.onAuthenticatedFeishuIngress({conversationId:'fixed-chat',messageId:'incoming',text:'legal natural input'})
    if(mode==='throw') {
      assert.equal(returned.replyDelivery,'unknown');assert.equal(captured.length,0)
    } else {
      assert.equal(replies,1);assert.equal(captured.length,1)
      assert.equal(captured[0][0],'turn-owned');assert.equal(captured[0][1],mode==='void'?undefined:result)
    }
  }
  assert.deepEqual(calls,[])
})

test('same authenticated query waits for actual reply once and honors its original absolute deadline', async () => {
  const body={role:'original_executor_qualification',phase:'restart_a',consumingBinarySha256:'a'.repeat(64),
    validatorSha256:'c'.repeat(64),entryManifestSha256:'e'.repeat(64),
    procedureSha256:'d8cfc5a3925c29ee843258a8077f57f4d8223f44bf697bbd24edba011753911e',startupNonce:'b'.repeat(64)}
  const raw=Buffer.from(JSON.stringify(body,Object.keys(body).sort()))
  const digest=crypto.createHash('sha256').update(raw).digest('hex')
  for(const mode of ['success','void','late','wrong-child']) {
    const argv=process.argv
    const originalsHere={fstat:fs.fstatSync,read:fs.readSync,spawn:processes.spawnSync,Socket:net.default.Socket}
    let channel,reads=0
    const writes=[]
    class SyntheticSocket {
      constructor(){channel=this;this.events={};this.closed=false}
      on(name,fn){this.events[name]=fn;return this}
      unref(){}
      write(raw){writes.push(JSON.parse(raw))}
      destroy(){this.closed=true;this.events.close?.()}
    }
    fs.fstatSync=()=>({uid:0,nlink:1,mode:0o100600,size:raw.length,dev:1,ino:8,mtimeMs:1,ctimeMs:1,isFile:()=>true})
    fs.readSync=(fd,buffer,offset,length,position)=>raw.copy(buffer,offset,position,position+length)
    processes.spawnSync=()=>({status:0,stdout:JSON.stringify(body)})
    net.default.Socket=SyntheticSocket;syncBuiltinESMExports()
    try {
      const own=await memoryModule(exactSource,originalURL.href,cached)
      process.argv=['node','gated','--hr-qf-context-sha256',digest,'--hr-qf-challenge-fd','3',
        '--hr-qf-window-fd','4','--hr-qf-context-fd','5']
      await own.authenticateFixedStartupContext()
      const record={handle:'turn-owned',runtimeEpoch:'owned-runtime',agentId:'agt_cto-agent',
        processGeneration:2,settlementResult:'completed',fenceState:'cleared',
        finalAssistantOutput:{originalBytes:3},messageId:'native-receipt',updatedAt:10,
        ingressCorrelation:{channelNamespace:'feishu',feishuMessageId:'actual-incoming'}}
      const store={occupancy:()=>({runtimeEpoch:'owned-runtime'}),getTurnReconciliation:()=>({snapshot:
        {...record,...(mode==='wrong-child'?{runtimeEpoch:'wrong-runtime'}:{})}})}
      const service={reconciliationRuntimeStatus:()=>{reads++;return {generationId:'owned-runtime',health:'healthy',businessAdmission:'open'}},
        getTurnReconciliation:()=>({state:'settled',snapshot:record})}
      const capture=own.qualificationReplyObserver(store)
      own.publishFixedRuntimeAdmission(service,store)
      const query={context:body,challenge:'f'.repeat(32),handle:'turn-owned',deadlineMonotonicNs:
        mode==='late'?'1':String(process.hrtime.bigint()+1_000_000_000n)}
      const pending=channel.events.data(Buffer.from(JSON.stringify(query)+'\n'))
      assert.equal(writes.length,0)
      if(mode!=='late')capture('turn-owned',mode==='void'?undefined:{messageId:'actual-outbound',chatId:'actual-chat',method:'reply'})
      await pending
      if(mode==='success') {
        assert.equal(writes.length,1);assert.equal(writes[0].handle,'turn-owned')
        await channel.events.data(Buffer.from(JSON.stringify(query)+'\n'))
        assert.equal(writes.length,1);assert.equal(channel.closed,true)
      } else {assert.equal(writes.length,0);assert.equal(channel.closed,true)}
      if(mode==='late')assert.equal(reads,0)
      channel.destroy()
    } finally {
      process.argv=argv
      fs.fstatSync=originalsHere.fstat;fs.readSync=originalsHere.read
      processes.spawnSync=originalsHere.spawn;net.default.Socket=originalsHere.Socket
      syncBuiltinESMExports()
    }
  }
  assert.deepEqual(calls,[])
})
