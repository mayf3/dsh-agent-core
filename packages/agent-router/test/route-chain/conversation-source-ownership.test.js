import assert from 'node:assert/strict'
import {test} from 'node:test'
import {execFileSync} from 'node:child_process'
import {mkdirSync,readFileSync,writeFileSync,unlinkSync,symlinkSync,linkSync,statSync,existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {createConversationSource} from '../../src/conversation/source.js'

const node=process.execPath,actor=fileURLToPath(new URL('../helpers/conversation-uid-actor.mjs',import.meta.url))
const tag=requestId=>createHash('sha256').update(JSON.stringify(requestId)).digest('hex')
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex')
const sudo=(...args)=>execFileSync('/usr/bin/sudo',['-n','-u','authsvc',...args],{encoding:'utf8'}).trim()

test('source owner UID comes only from trusted spawn configuration, with a same-UID default',async()=>{
  const modulePath=new URL('../../src/conversation/source-ownership.js',import.meta.url)
  assert.ok(existsSync(modulePath),'source-specific ownership policy is implemented')
  const {sourceWriterUid}=await import(modulePath)
  assert.equal(sourceWriterUid({env:{},readerUid:505}),505)
  assert.equal(sourceWriterUid({env:{DSH_AGENT_CHILD_UID:'502'},readerUid:505}),502)
  for(const bad of ['502junk','-1','1.2','','9007199254740992'])assert.throws(()=>sourceWriterUid({env:{DSH_AGENT_CHILD_UID:bad},readerUid:505}))
})

test('real UID502 source and UID505 reader use exact ownership, read-only ACL, immutable body and parent-owned ACK',async t=>{
  assert.equal(process.getuid(),502,'this fixture requires the actual Agent UID')
  assert.equal(sudo('/usr/bin/id','-u'),'505','the reader is a real authsvc process')
  const root=sudo(node,'-e',"process.stdout.write(require('node:fs').mkdtempSync('/private/tmp/pilot-native-uids-'))")
  assert.ok(root.startsWith('/private/tmp/pilot-native-uids-'))
  const directory=join(root,'source'),requestId='mcpnc-real-uids',file=join(directory,tag(requestId)+'.json')
  const rootCreate='user:yanfenma allow search,add_subdirectory'
  const dirRead='user:authsvc allow search,readattr,readsecurity'
  const fileRead='user:authsvc allow read,readattr,readsecurity,file_inherit,only_inherit'
  try {
    sudo('/bin/chmod','+a',rootCreate,root)
    mkdirSync(directory,{mode:0o700})
    sudo('/bin/chmod','-a',rootCreate,root)
    sudo('/bin/chmod','+a','user:yanfenma allow search',root)
    execFileSync('/bin/chmod',['+a',dirRead,directory])
    execFileSync('/bin/chmod',['+a',fileRead,directory])
    const owner=createConversationSource({directory,agentId:'agt_pilot'})
    const session={id:'main',header:{id:'main',createdAt:11,cwd:'/fixture/workspace'}}
    owner.reserve({requestId,session,message:{id:'user-real'}})
    const emit=(type,data,seq)=>owner.onEvent(session,{type,data,seq,time:100+seq})
    emit('agent/inbox/spliced',{inserted:[{id:'user-real'}]},1)
    emit('turn/start',{turn:7},2)
    emit('user/message',{id:'user-real'},3)
    emit('assistant/message',{turn:7,message:{id:'reply-real',content:[{type:'text',text:'exact source reply'}]}},4)
    emit('turn/end',{turn:7,reason:{kind:'completed'}},5)
    owner.reserve({requestId:'mcpnc-retained-unknown',session,message:{id:'unknown-user'}})
    const run=(action,arg,writer='502')=>JSON.parse(sudo('/usr/bin/env','DSH_AGENT_CHILD_UID='+writer,node,actor,directory,requestId,action,...(arg===undefined?[]:[String(arg)])))
    const original=readFileSync(file),before=sha(file)
    assert.equal(statSync(file).uid,502)
    assert.equal(statSync(file).mode&0o7777,0o600)
    const read=run('read')
    assert.equal(read.ok,true,JSON.stringify(read))
    assert.equal(read.value.reply_body,'exact source reply')
    const denied=run('write-source')
    assert.equal(denied.ok,false)
    assert.ok(['EACCES','EPERM'].includes(denied.code))
    const expiresAt=Date.now()+60000
    assert.equal(run('ack',expiresAt).ok,true)
    const ackFile=join(dirname(directory),'acks',tag(requestId)+'.json')
    assert.throws(()=>writeFileSync(ackFile,'forbidden'),error=>['EACCES','EPERM'].includes(error.code))
    assert.equal(sha(file),before,'reader ACK never changes source owner or bytes')
    const expired=run('read',expiresAt+1)
    assert.equal(expired.value.state,'expired')
    assert.equal(sha(file),before,'expiry changes visibility, never source or UNKNOWN bytes')
    const unknown=JSON.parse(sudo('/usr/bin/env','DSH_AGENT_CHILD_UID=502',node,actor,directory,'mcpnc-retained-unknown','read',String(expiresAt+1)))
    assert.equal(unknown.value.state,'pending','an uncommitted/unknown source has no TTL acknowledgement and is retained')
    assert.equal(run('read',Date.now(),'505').ok,false,'a wrong configured source owner is rejected')
    const alias=join(directory,'hardlink.json')
    linkSync(file,alias)
    assert.equal(run('read').ok,false,'hard-linked source is rejected')
    unlinkSync(alias)
    const alternate=join(directory,'alternate.json')
    writeFileSync(alternate,original,{mode:0o600})
    unlinkSync(file)
    symlinkSync(alternate,file)
    assert.equal(run('read').ok,false,'source symlink is rejected')
    unlinkSync(file)
    writeFileSync(file,original,{mode:0o600})
    execFileSync('/bin/chmod',['-a',dirRead,directory])
    assert.equal(run('read').ok,false,'missing directory search ACL fails closed')
    execFileSync('/bin/chmod',['+a',dirRead,directory])
    assert.equal(run('tamper-ack').ok,true)
    assert.equal(run('read').value.state,'unrecoverable','ACK hash mismatch cannot silently extend source TTL')
    assert.equal(sha(file),before)
  } finally {
    if(existsSync(directory))execFileSync('/bin/chmod',['+a','user:authsvc allow list,delete_child',directory])
    sudo('/bin/rm','-rf',root)
  }
})
