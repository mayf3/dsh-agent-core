import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtempSync,rmSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

test('source owner retains exact native reply before publication, survives reset and restart',async t=>{
  const modulePath=new URL('../../src/conversation/source.js',import.meta.url)
  assert.ok(existsSync(modulePath),'native source retention is implemented')
  const {createConversationSource,readConversationSource}=await import(modulePath)
  const dir=mkdtempSync(join(tmpdir(),'native-source-'))
  t.after(()=>rmSync(dir,{recursive:true,force:true}))
  const owner=createConversationSource({directory:dir,agentId:'agt_pilot'})
  const session={id:'main',header:{id:'main',createdAt:11,version:1,cwd:'/fixture/workspace'}}
  owner.reserve({requestId:'mcpnc-fixture',session,message:{id:'user-1',content:[{type:'text',text:'question'}]}})
  const emit=(type,data,seq)=>owner.onEvent(session,{type,data,seq,time:100+seq})
  emit('agent/inbox/spliced',{inserted:[{id:'user-1'}]},1)
  emit('turn/start',{turn:7},2)
  emit('user/message',{id:'user-1'},3)
  emit('assistant/message',{turn:6,message:{id:'wrong',content:[{type:'text',text:'must not leak'}]}},4)
  emit('assistant/message',{turn:7,message:{content:[{type:'reasoning',text:'hidden'},{type:'text',text:'answer'}]}},5)
  emit('turn/end',{turn:7,reason:{kind:'completed'}},6)
  const result=readConversationSource({directory:dir,agentId:'agt_pilot',requestId:'mcpnc-fixture'})
  assert.equal(result.reply_body,'answer')
  assert.equal(result.turn_id,7)
  assert.equal(result.reply_message_id,null)
  assert.equal(result.source_retained,true)
  session.header.createdAt=999
  const restarted=readConversationSource({directory:dir,agentId:'agt_pilot',requestId:'mcpnc-fixture'})
  assert.deepEqual(restarted,result)
  assert.notEqual(result.session_generation,'main')
  assert.equal(result.message_id,'user-1')
})

test('source reserve fails before followup when durable retention is unavailable',async t=>{
  const modulePath=new URL('../../src/conversation/source.js',import.meta.url)
  assert.ok(existsSync(modulePath),'native source retention is implemented')
  const {createConversationSource}=await import(modulePath)
  const owner=createConversationSource({directory:'/not-a-configured-retention-root',agentId:'agt_pilot',write:()=>{throw Error('disk-full')}})
  assert.throws(()=>owner.reserve({requestId:'new',session:{id:'main',header:{id:'main',createdAt:1}},message:{id:'u'}}))
})

test('B002: visible text and its native ID survive an empty completion anchor in the same exact turn',async t=>{
  const {createConversationSource,readConversationSource}=await import('../../src/conversation/source.js')
  const dir=mkdtempSync(join(tmpdir(),'native-empty-anchor-'))
  t.after(()=>rmSync(dir,{recursive:true,force:true}))
  const owner=createConversationSource({directory:dir,agentId:'agt_pilot'})
  const session={id:'main',header:{id:'main',createdAt:12}}
  owner.reserve({requestId:'visible-empty',session,message:{id:'user'}})
  const events=[['agent/inbox/spliced',{inserted:[{id:'user'}]}],['turn/start',{turn:8}],['user/message',{id:'user'}],
    ['assistant/message',{turn:8,message:{id:'visible',content:[{type:'text',text:'visible business answer'},{type:'tool-call',id:'tool'}]}}],
    ['assistant/message',{turn:8,message:{id:'usage-only',content:[]}}],['turn/end',{turn:8,reason:{kind:'completed'}}]]
  events.forEach(([type,data],seq)=>owner.onEvent(session,{type,data,seq,time:100+seq}))
  const row=readConversationSource({directory:dir,agentId:'agt_pilot',requestId:'visible-empty'})
  assert.equal(row.reply_body,'visible business answer')
  assert.equal(row.reply_message_id,'visible')
  assert.equal(row.reply_created_at,103)
  assert.equal(row.source_retained,true)
})

test('B002: a wholly-empty native completion records no visible reply rather than retaining an empty business answer',async t=>{
  const {createConversationSource,readConversationSource}=await import('../../src/conversation/source.js')
  const dir=mkdtempSync(join(tmpdir(),'native-wholly-empty-'))
  t.after(()=>rmSync(dir,{recursive:true,force:true}))
  const owner=createConversationSource({directory:dir,agentId:'agt_pilot'})
  const session={id:'main',header:{id:'main',createdAt:13}}
  owner.reserve({requestId:'wholly-empty',session,message:{id:'user'}})
  const events=[['agent/inbox/spliced',{inserted:[{id:'user'}]}],['turn/start',{turn:9}],['user/message',{id:'user'}],
    ['assistant/message',{turn:9,message:{id:'empty',content:[]}}],['turn/end',{turn:9,reason:{kind:'completed'}}]]
  events.forEach(([type,data],seq)=>owner.onEvent(session,{type,data,seq,time:100+seq}))
  const row=readConversationSource({directory:dir,agentId:'agt_pilot',requestId:'wholly-empty'})
  assert.equal(row.state,'completed')
  assert.equal(row.reply_body,null)
  assert.equal(row.reply_message_id,null)
  assert.equal(row.source_retained,false)
  assert.equal(row.reply_coverage.reason,'no_visible_reply')
})
