/** Source-owned retention of explicitly registered Product Surface turns.
 * Called before demo-server publishes each native event; never a history reader.
 */
import {createHash} from 'node:crypto'
import {join,isAbsolute} from 'node:path'
import {atomicPrivateJson,readPrivateJson} from './persistence.js'
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
const digest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
const fileFor=(directory,requestId)=>join(directory,digest(requestId)+'.json')
const generation=session=>'trajectory_header_v1:'+digest(session.header)
const stamp=value=>Number.isSafeInteger(value)&&value>=0?value:null
function sourceError(){return Object.assign(new Error('native source retention unavailable'),{code:'CONVERSATION_SOURCE_UNAVAILABLE',status:'not_admitted',proven:'zero_byte'})}
export function readConversationSource({directory,agentId,requestId,now=Date.now}){
  if(!directory||!isAbsolute(directory))return {state:'unrecoverable'}
  const row=readPrivateJson(fileFor(directory,requestId),3*1024*1024)
  if(!row)return {state:'not_found'}
  if(row.version!==1||row.agent_id!==agentId||row.request_id!==requestId) return {state:'unrecoverable'}
  if(row.expires_at&&now()>=row.expires_at){
    atomicPrivateJson(fileFor(directory,requestId),{...row,reply_body:null,state:'expired'})
    return {state:'expired'}
  }
  return structuredClone(row)
}
export function acknowledgeConversationSource({directory,agentId,requestId,expiresAt}){
  const row=readConversationSource({directory,agentId,requestId})
  if(!['completed','failed','interrupted'].includes(row.state)||!Number.isSafeInteger(expiresAt))return
  atomicPrivateJson(fileFor(directory,requestId),{...row,expires_at:expiresAt})
}
export function createConversationSource({directory,agentId,write=atomicPrivateJson}={}){
  if(!directory||!isAbsolute(directory)||!/^agt_[A-Za-z0-9_-]+$/.test(agentId??''))return null
  const tracked=new Map()
  return {
    reserve({requestId,session,message}){
      if(typeof requestId!=='string'||requestId.length>256||String(session?.id)!=='main'||!message?.id
        ||!Number.isSafeInteger(session?.header?.createdAt))throw sourceError()
      const path=fileFor(directory,requestId)
      if(readPrivateJson(path))throw sourceError()
      const row={version:1,request_id:requestId,agent_id:agentId,session_id:String(session.id),
        session_generation:generation(session),message_id:message.id,state:'pending',turn_id:null,
        inserted_seen:false,user_seen:false,last_seq:-1,accepted_at:null,started_at:null,finished_at:null,reply_created_at:null,
        reply_message_id:null,reply_body:null,truncated:false,source_retained:false}
      try{write(path,row)}catch{throw sourceError()}
      tracked.set(requestId,row)
      return {sessionGeneration:row.session_generation,sourceRetentionVersion:1}
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
          row.truncated=Buffer.byteLength(text,'utf8')>1024*1024
          row.reply_body=row.truncated?null:text
          row.reply_message_id=typeof data.message?.id==='string'&&data.message.id?data.message.id:null
          row.reply_created_at=stamp(event.time)
        }else if(type==='turn/end'&&row.user_seen&&data.turn===row.turn_id){
          row.state=data.reason?.kind==='completed'?'completed':data.reason?.kind==='error'?'failed':'interrupted'
          row.finished_at=stamp(event.time)
          row.source_retained=typeof row.reply_body==='string'&&!row.truncated
        }else continue
        row.last_seq=event.seq
        // A failed write escapes to the owner, which continues Router facts
        // but emits source failure explicitly. No available result is invented.
        try{write(fileFor(directory,row.request_id),row);if(row.state!=='pending')tracked.delete(row.request_id)}catch(error){row.state='unrecoverable';row.source_retained=false;throw error}
      }
    },
  }
}
