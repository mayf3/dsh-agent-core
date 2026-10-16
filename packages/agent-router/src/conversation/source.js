/** Source-owned retention of explicitly registered Product Surface turns.
 * Called before demo-server publishes each native event; never a history reader.
 */
import {createHash} from 'node:crypto'
import {join,isAbsolute,dirname,basename} from 'node:path'
import {atomicPrivateJson,readPrivateJson,privateDirectory} from './persistence.js'
import {sourceWriterUid,readOwnedSourceJson} from './source-ownership.js'
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
const digest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
const fileFor=(directory,requestId)=>join(directory,digest(requestId)+'.json')
const generation=session=>'trajectory_header_v1:'+digest(session.header)
const stamp=value=>Number.isSafeInteger(value)&&value>=0?value:null
function sourceError(){return Object.assign(new Error('native source retention unavailable'),{code:'CONVERSATION_SOURCE_UNAVAILABLE',status:'not_admitted',proven:'zero_byte'})}
function readSource(directory,requestId,writerUid){return readOwnedSourceJson({directory,filename:basename(fileFor(directory,requestId)),ownerUid:writerUid})}
function readAck(directory,requestId){return readOwnedSourceJson({directory:join(dirname(directory),'acks'),filename:basename(fileFor(directory,requestId)),ownerUid:process.getuid?.(),maxBytes:4096})}
export function readConversationSource({directory,agentId,requestId,now=Date.now,writerUid=sourceWriterUid()}){
  if(!directory||!isAbsolute(directory))return {state:'unrecoverable'}
  const source=readSource(directory,requestId,writerUid),row=source?.value
  if(!source)return {state:'not_found'}
  if(row.version!==1||row.agent_id!==agentId||row.request_id!==requestId) return {state:'unrecoverable'}
  const ack=readAck(directory,requestId)?.value
  if(ack) {
    if(Object.keys(ack).sort().join()!=='agent_id,expires_at,request_id,source_sha256,version'||ack.version!==1
      ||ack.agent_id!==agentId||ack.request_id!==requestId||ack.source_sha256!==source.sha256
      ||!Number.isSafeInteger(ack.expires_at)||ack.expires_at<=0)return {state:'unrecoverable'}
    if(now()>=ack.expires_at)return {state:'expired'}
  }
  return structuredClone(row)
}
export function acknowledgeConversationSource({directory,agentId,requestId,expiresAt,writerUid=sourceWriterUid()}){
  const source=readSource(directory,requestId,writerUid),row=source?.value
  if(!row||row.version!==1||row.agent_id!==agentId||row.request_id!==requestId)throw sourceError()
  if(!['completed','failed','interrupted'].includes(row.state))return
  if(!Number.isSafeInteger(expiresAt)||expiresAt<=0)throw sourceError()
  const ack={version:1,agent_id:agentId,request_id:requestId,source_sha256:source.sha256,expires_at:expiresAt}
  const existing=readAck(directory,requestId)?.value
  if(existing&&JSON.stringify(existing)!==JSON.stringify(ack))throw sourceError()
  if(!existing)atomicPrivateJson(join(dirname(directory),'acks',basename(fileFor(directory,requestId))),ack)
}
export function createConversationSource({directory,agentId,write=atomicPrivateJson}={}){
  if(!directory||!isAbsolute(directory)||!/^agt_[A-Za-z0-9_-]+$/.test(agentId??''))return null
  try {if(sourceWriterUid()!==process.getuid?.())return null;privateDirectory(directory)}catch{return null}
  const tracked=new Map()
  return {
    reserve({requestId,session,message,mainResolution}){
      if(typeof requestId!=='string'||requestId.length>256||String(session?.id)!=='main'||String(session?.header?.id)!=='main'||!message?.id
        ||!Number.isSafeInteger(session?.header?.createdAt))throw sourceError()
      const path=fileFor(directory,requestId)
      if(readPrivateJson(path))throw sourceError()
      const row={version:1,request_id:requestId,agent_id:agentId,session_id:String(session.id),
        session_generation:generation(session),message_id:message.id,state:'pending',turn_id:null,
        main_resolution:structuredClone(mainResolution??{disposition:'unknown',reason:'source_field_not_available',generation_change_reason:null}),
        reply_coverage:{selection:'last_nonempty_visible_assistant_message',limit_bytes:1048576,original_bytes:0,reason:'pending'},
        inserted_seen:false,user_seen:false,last_seq:-1,accepted_at:null,started_at:null,finished_at:null,reply_created_at:null,
        reply_message_id:null,reply_body:null,truncated:false,source_retained:false}
      try{write(path,row)}catch{throw sourceError()}
      tracked.set(requestId,row)
      return {sessionGeneration:row.session_generation,sourceRetentionVersion:1,mainResolution:structuredClone(row.main_resolution)}
    },
    onEvent(session,event){
      for(const row of tracked.values()){
        if(row.state!=='pending'||String(session.id)!==row.session_id)continue
        if(generation(session)!==row.session_generation){row.state='unrecoverable';write(fileFor(directory,row.request_id),row);continue}
        if(!Number.isSafeInteger(event?.seq)||event.seq<0||event.seq<=row.last_seq)continue
        const type=event.type,data=event.data??{}
        if(type==='agent/inbox/spliced'&&data.inserted?.some(message=>message.id===row.message_id)){
          if(data.inserted.some(message=>message.id!==row.message_id)){row.state='unrecoverable';write(fileFor(directory,row.request_id),row);tracked.delete(row.request_id);continue}
          row.inserted_seen=true;row.accepted_at=stamp(event.time)
        }
        else if(type==='turn/start'&&row.inserted_seen&&row.turn_id===null&&Number.isSafeInteger(data.turn)){row.turn_id=data.turn;row.started_at=stamp(event.time)}
        else if(type==='user/message'&&(data.id===row.message_id||data.message?.id===row.message_id)&&row.turn_id!==null)row.user_seen=true
        else if(type==='assistant/message'&&row.user_seen&&data.turn===row.turn_id){
          const text=(data.message?.content??[]).filter(block=>block.type==='text'&&typeof block.text==='string').map(block=>block.text).join('')
          if(text.length===0)continue // Empty/usage/reasoning/tool-only anchors are not visible replies.
          row.reply_coverage.original_bytes=Buffer.byteLength(text,'utf8')
          row.truncated=row.reply_coverage.original_bytes>1024*1024
          row.reply_coverage.reason=row.truncated?'truncated':'visible_reply'
          row.reply_body=row.truncated?null:text
          row.reply_message_id=typeof data.message?.id==='string'&&data.message.id?data.message.id:null
          row.reply_created_at=stamp(event.time)
        }else if(type==='turn/end'&&row.user_seen&&data.turn===row.turn_id){
          row.state=data.reason?.kind==='completed'?'completed':data.reason?.kind==='error'?'failed':'interrupted'
          row.finished_at=stamp(event.time)
          row.source_retained=typeof row.reply_body==='string'&&row.reply_body.length>0&&!row.truncated
          if(!row.source_retained&&!row.truncated)row.reply_coverage.reason='no_visible_reply'
        }else continue
        row.last_seq=event.seq
        // A failed write escapes to the owner, which continues Router facts
        // but emits source failure explicitly. No available result is invented.
        try{write(fileFor(directory,row.request_id),row);if(row.state!=='pending')tracked.delete(row.request_id)}catch(error){row.state='unrecoverable';row.source_retained=false;throw error}
      }
    },
  }
}
