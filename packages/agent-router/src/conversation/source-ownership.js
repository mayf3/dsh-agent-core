// The original Router derives the source writer from its trusted child-spawn
// configuration. This exception is source-only; request/config storage keeps
// the general same-UID private JSON rules unchanged.
import {constants,lstatSync,openSync,fstatSync,readFileSync,closeSync} from 'node:fs'
import {isAbsolute,join} from 'node:path'
import {createHash} from 'node:crypto'

function invalid(){return Object.assign(new Error('conversation source ownership unavailable'),{code:'CONVERSATION_SOURCE_UNAVAILABLE'})}
export function sourceWriterUid({env=process.env,readerUid=process.getuid?.()}={}) {
  const configured=env.DSH_AGENT_CHILD_UID
  if(configured===undefined) {
    if(!Number.isSafeInteger(readerUid)||readerUid<0)throw invalid()
    return readerUid
  }
  if(typeof configured!=='string'||!/^(0|[1-9][0-9]*)$/.test(configured))throw invalid()
  const uid=Number(configured)
  if(!Number.isSafeInteger(uid)||uid<0)throw invalid()
  return uid
}
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino
function checkDirectory(stat,uid){if(!stat.isDirectory()||stat.isSymbolicLink()||stat.uid!==uid||(stat.mode&0o7777)!==0o700)throw invalid()}
function checkFile(stat,uid,maxBytes){if(!stat.isFile()||stat.isSymbolicLink()||stat.uid!==uid||(stat.mode&0o7777)!==0o600||stat.nlink!==1||stat.size>maxBytes)throw invalid()}
export function readOwnedSourceJson({directory,filename,ownerUid,maxBytes=9*1024*1024}) {
  if(typeof directory!=='string'||!isAbsolute(directory)||!/^[a-f0-9]{64}\.json$/.test(filename)
    ||!Number.isSafeInteger(ownerUid)||ownerUid<0||typeof constants.O_NOFOLLOW!=='number')throw invalid()
  let directoryBefore,entry
  const path=join(directory,filename)
  try {directoryBefore=lstatSync(directory);checkDirectory(directoryBefore,ownerUid);entry=lstatSync(path)}
  catch(error){if(error.code==='ENOENT')return null;throw error}
  checkFile(entry,ownerUid,maxBytes)
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW)
  try {
    const opened=fstatSync(fd);checkFile(opened,ownerUid,maxBytes)
    if(!same(entry,opened))throw invalid()
    const bytes=readFileSync(fd),after=fstatSync(fd),directoryAfter=lstatSync(directory)
    checkFile(after,ownerUid,maxBytes);checkDirectory(directoryAfter,ownerUid)
    if(!same(opened,after)||!same(directoryBefore,directoryAfter)||bytes.length!==after.size||bytes.length>maxBytes)throw invalid()
    return {value:JSON.parse(bytes.toString('utf8')),sha256:createHash('sha256').update(bytes).digest('hex')}
  } finally {closeSync(fd)}
}
