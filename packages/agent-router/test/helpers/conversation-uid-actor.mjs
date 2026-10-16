import {readConversationSource,acknowledgeConversationSource} from '../../src/conversation/source.js'
import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {join,dirname} from 'node:path'
const [directory,requestId,action,arg]=process.argv.slice(2)
const tag=createHash('sha256').update(JSON.stringify(requestId)).digest('hex')
const sourceFile=join(directory,tag+'.json'),ackFile=join(dirname(directory),'acks',tag+'.json')
try {
  let value
  if(action==='read')value=readConversationSource({directory,agentId:'agt_pilot',requestId,...(arg?{now:()=>Number(arg)}:{})})
  else if(action==='ack'){acknowledgeConversationSource({directory,agentId:'agt_pilot',requestId,expiresAt:Number(arg)});value={acknowledged:true}}
  else if(action==='write-source'){writeFileSync(sourceFile,'forbidden');value={unexpectedWrite:true}}
  else if(action==='tamper-ack'){const row=JSON.parse(readFileSync(ackFile));row.source_sha256='0'.repeat(64);writeFileSync(ackFile,JSON.stringify(row));value={tampered:true}}
  else throw new Error('unknown fixture action')
  process.stdout.write(JSON.stringify({ok:true,value}))
}catch(error){process.stdout.write(JSON.stringify({ok:false,code:error.code??null,message:error.message}))}
