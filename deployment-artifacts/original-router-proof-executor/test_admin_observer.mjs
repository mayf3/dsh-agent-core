import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import processes from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readDurableRecoveryStore } from '../../packages/agent-router/src/reconciliation/durable-file.js'
import { makeFx } from '../../packages/agent-router/test/helpers/fake-child.js'

const sourcePath=fileURLToPath(new URL('./admin_observation.mjs',import.meta.url))
const source=readFileSync(sourcePath,'utf8')
const context={role:'fixed_admin_qualification',agentId:'agt_efficiency-agent',
  phase:'deployment_start',hostId:'961534a5-8c94-487d-8e55-d324a54e821a',
  packageSha256:'a'.repeat(64),consumingBinarySha256:'b'.repeat(64),
  startupNonce:'c'.repeat(64),processGeneration:1}

test('original private store observer reads actual durable-issued terminal canary',async()=>{
  const dispatch=[]
  const originals=[]
  for (const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']) {
    originals.push([name,processes[name]])
    processes[name]=(...args)=>{dispatch.push([name,args]);throw new Error('HOST_PROCESS_DENIED')}
  }
  const root=mkdtempSync(join(tmpdir(),'qf-admin-observer-'))
  const path=join(root,'turn-recovery-v3.json')
  const fx=makeFx({agentId:'agt_efficiency-agent',fixedAdminQualification:context})
  const oldArgs=process.argv,oldWrite=process.stdout.write
  try {
    fx.store.persistenceFile=path
    fx.store.persistDurable()
    const ready=fx.proc.ready();await fx.tick()
    fx.respondTo('initialize',{registeredProviders:[fx.proc.provider],
      fixedAdminToolPolicy:{armed:true,startupNonce:context.startupNonce}})
    await ready
    const pending=fx.proc.qualifyFixedTurn();await fx.tick()
    const prompt=fx.writes.find(item=>item.method==='session/prompt')
    fx.respondTo('session/prompt',{messageId:'native-admin-1'})
    fx.completeTurn(prompt.params.sessionId,'native-admin-1','completed')
    const result=await pending
    const record=fx.store.getTurnReconciliation(result.reconciliationHandle).snapshot
    const original=readDurableRecoveryStore(path)
    assert.equal(original.records.get(record.handle).state,'settled')
    const durableRecord=original.records.get(record.handle)
    assert.equal(durableRecord.settlementResult,'completed')
    assert.equal(durableRecord.fenceState,'armed')
    assert.ok(durableRecord.finalAssistantOutputEvidence?.originalBytes>0)
    assert.ok(durableRecord.messageId)
    const output=[]
    process.stdout.write=(data)=>{output.push(String(data));return true}
    process.argv=['node','source','/dev/fd/7',record.handle,record.runtimeEpoch,String(durableRecord.createdAt)]
    assert.match(record.handle,/^turn:[^:]{1,128}:a[0-9]+:g[0-9]+:s[0-9]+$/)
    assert.ok(record.runtimeEpoch.length>0 && record.runtimeEpoch.length<=128)
    assert.match(String(durableRecord.createdAt),/^[0-9]+$/)
    const module=new SourceTextModule(source,{identifier:sourcePath})
    await module.link(async specifier=>{
      if (specifier==='node:crypto') return new SyntheticModule(['createHash'],function(){this.setExport('createHash',createHash)})
      if (specifier==='/usr/local/libexec/agent-core/app/packages/agent-router/src/reconciliation/durable-file.js') {
        return new SyntheticModule(['readDurableRecoveryStore'],function(){
          this.setExport('readDurableRecoveryStore',descriptor=>{
            assert.equal(descriptor,'/dev/fd/7')
            return readDurableRecoveryStore(path)
          })
        })
      }
      throw new Error('UNEXPECTED_OBSERVER_IMPORT')
    })
    await module.evaluate()
    const value=JSON.parse(output.join(''))
    assert.equal(value.turnExecutionId,record.handle)
    assert.equal(value.processGeneration,1)
    assert.equal(value.nativeMessageSha256,createHash('sha256').update(record.messageId).digest('hex'))
    assert.equal(value.nativeReceiptSha256,createHash('sha256').update(`${record.handle}\0${record.messageId}`).digest('hex'))
    assert.equal(value.replySha256,durableRecord.finalAssistantOutputEvidence.sha256)
    assert.deepEqual(dispatch,[])
  } finally {
    process.argv=oldArgs;process.stdout.write=oldWrite
    rmSync(root,{recursive:true,force:true})
    for (const [name,original] of originals) processes[name]=original
  }
})
