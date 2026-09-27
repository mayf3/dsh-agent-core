import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import cp from 'node:child_process'
import * as crypto from 'node:crypto'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import { syncBuiltinESMExports } from 'node:module'

const originalURL = new URL('./observation.mjs',import.meta.url)
const source = fs.readFileSync(originalURL,'utf8')
const saved=[];const calls=[]
for (const object of [fs,fs.promises,cp]) {
  for (const name of Object.keys(object).filter(key=>typeof object[key] === 'function')) {
    saved.push([object,name,Object.getOwnPropertyDescriptor(object,name)])
    Object.defineProperty(object,name,{configurable:true,enumerable:true,writable:true,
      value:(...args)=>{calls.push([name,args]);throw new Error('TEST_HOST_HARD_DENY')}})
  }
}
syncBuiltinESMExports()
test.after(()=>{assert.equal(calls.length,0);for(const [o,n,d] of saved)Object.defineProperty(o,n,d);syncBuiltinESMExports()})

const sender='ou_original_owner_fixture'
const owner=crypto.createHash('sha256').update(sender).digest('hex')
const fresh=()=>({agentId:'agt_cto-agent',createdAt:101,state:'settled',
  settlementResult:'completed',fenceState:'cleared',messageId:'private-native-receipt',
  finalAssistantOutputEvidence:{sha256:'a'.repeat(64),originalBytes:4,truncated:false},
  handle:'turn:fixture:a1:g2:s8',processGeneration:2,updatedAt:103,
  ingressCorrelation:{channelNamespace:'feishu',feishuSenderOpenId:sender,feishuMessageId:'native-new'}})
async function observe(records) {
  const store={records:new Map(records.map((r,i)=>[i,r])),issuance:new Map([['agt_cto-agent',{
    generations:new Map([[2,{minSeq:8,maxSeq:8}]]),evictedGenerations:new Map([[1,7]]),
    evictedThroughGeneration:0,maxIssuedTurnSeq:8}]])}
  let output='';const oldArgv=process.argv,oldWrite=process.stdout.write
  const module=new SourceTextModule(source,{identifier:originalURL.href,
    initializeImportMeta(meta){meta.url=originalURL.href},
    importModuleDynamically(){throw new Error('MEMORY_DYNAMIC_IMPORT_DENIED')}})
  await module.link(specifier=>{
    if(specifier==='node:crypto')return new SyntheticModule(['createHash'],function(){this.setExport('createHash',crypto.createHash)})
    if(specifier==='/usr/local/libexec/agent-core/app/packages/agent-router/src/reconciliation/durable-file.js')
      return new SyntheticModule(['readDurableRecoveryStore'],function(){this.setExport('readDurableRecoveryStore',file=>{
        assert.equal(file,'/dev/fd/14');return store // Explicit disposable validator boundary, never host proof.
      })})
    throw new Error('MEMORY_IMPORT_DENIED')
  })
  try {
    process.argv=['node',originalURL.pathname,'/dev/fd/14',owner,'100']
    process.stdout.write=raw=>{output+=raw;return true}
    await module.evaluate()
    return JSON.parse(output)
  } finally {process.argv=oldArgv;process.stdout.write=oldWrite}
}

test('only a fresh attributable same-agent completed native turn projects',async()=>{
  const result=await observe([fresh()]);assert.equal(result.floor,2)
  assert.equal(result.completedAtWallMs,103);assert.equal(result.processGeneration,2)
  for(const changed of [{createdAt:99},{agentId:'other'},
    {ingressCorrelation:{...fresh().ingressCorrelation,feishuSenderOpenId:'ou_other'}}])
    assert.deepEqual(await observe([{...fresh(),...changed}]),{waiting:true})
})
test('pending or absent Owner event waits without seal or sending',async()=>{
  assert.deepEqual(await observe([]),{waiting:true})
  assert.deepEqual(await observe([{...fresh(),state:'pending'}]),{waiting:true})
})
test('ambiguous, failed, receiptless or empty output cannot qualify',async()=>{
  await assert.rejects(observe([fresh(),fresh()]),/ORIGINAL_NATIVE_AMBIGUOUS/)
  for(const changed of [{settlementResult:'failed'},{messageId:''},{finalAssistantOutputEvidence:null},
    {finalAssistantOutputEvidence:{sha256:'a'.repeat(64),originalBytes:0,truncated:false}}])
    await assert.rejects(observe([{...fresh(),...changed}]),/ORIGINAL_TURN_INCOMPLETE/)
})
