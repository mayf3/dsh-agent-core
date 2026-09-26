import test from 'node:test'
import assert from 'node:assert/strict'
import processAPI from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
for (const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']) {
  processAPI[name] = () => { throw new Error('PROCESS_DISPATCH_DENIED') }
}
syncBuiltinESMExports()
const { runtimeAdmissionProjection } = await import('../../src/native-arm64/hr-s256-r2-startup-context.mjs')
const { apply } = await import('../../../agent-router/src/index.js')
const op='hr-s256-trusted-quiescence-cut-20260925-v1'
const handle='turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256'
function providedRuntime(t, poisoned=false) {
  const root=mkdtempSync(join(tmpdir(),'hr-h5-router-'))
  t.after(()=>rmSync(root,{recursive:true,force:true}))
  const provided=new Map(), disposers=[]
  const services=new Map([
    ['workspaceBootstrap',{resolveWorkspace:()=>root,resolveDshHome:()=>root,ensure:async()=>({workspace:root,dshHome:root})}],
    ['agentDefinition',{listAgents:()=>[{id:'agt_hr-agent'}],getAgent:()=>({id:'agt_hr-agent'}),getDefaultAgent:()=>({id:'agt_hr-agent'})}],
  ])
  const ctx={get:name=>services.get(name)??provided.get(name),provide:(name,value)=>provided.set(name,value),
    effect:fn=>{const close=fn();disposers.push(close);return close}}
  t.after(()=>{for(const close of disposers.reverse())close?.()})
  const store=join(root,'recovery.json')
  if(poisoned)writeFileSync(store,'{invalid')
  const service=apply(ctx,{bindingsStoreFile:join(root,'bindings.json'),reconciliationStoreFile:store,
    defaultAgentId:'agt_hr-agent',defaultSessionId:'main',provisionHome:()=>{},
    processFactory:()=>{throw new Error('CHILD_CREATION_FORBIDDEN')}})
  assert.equal(provided.get('agentRouter'),service)
  return service
}
const binding={hostId:'fixture-host',startupNonce:'fixture-nonce',receipt:'a'.repeat(64)}
const request=()=>({operationId:op,hostId:binding.hostId,startupNonce:binding.startupNonce,
  challenge:'b'.repeat(32),launchAuthorizationReceiptSha256:binding.receipt,reconciliationHandle:handle})
test('H5 projection reads actual provided Router gate; fail_closed is never inferred open', t=>{
  const open=providedRuntime(t)
  const actual=open.reconciliationRuntimeStatus()
  assert.equal(actual.businessAdmission,'open')
  assert.deepEqual(runtimeAdmissionProjection(request(),open,binding).runtime,actual)
  const blocked=providedRuntime(t,true)
  const result=runtimeAdmissionProjection(request(),blocked,binding)
  assert.equal(result.runtime.businessAdmission,'fail_closed')
  assert.equal(result.runtime.blockedReason,'durable_store_invalid')
})
test('each private request queries the actual provided service, never a cached health success', t=>{
  const service=providedRuntime(t)
  const original=service.reconciliationRuntimeStatus.bind(service)
  let calls=0
  service.reconciliationRuntimeStatus=()=>{calls++;return original()}
  const fresh=request()
  assert.equal(runtimeAdmissionProjection(fresh,service,binding).runtime.generationId,original().generationId)
  runtimeAdmissionProjection({...fresh,challenge:'c'.repeat(32)},service,binding)
  assert.equal(calls,2)
  assert.equal(typeof fresh.challenge,'string')
  assert.equal(Object.keys(runtimeAdmissionProjection(fresh,service,binding)).length,7)
})
test('private request rejects wrong attempt, receipt, handle and unclosed shapes', t=>{
  const service=providedRuntime(t)
  for(const field of ['operationId','hostId','startupNonce','launchAuthorizationReceiptSha256','reconciliationHandle','challenge']) {
    assert.throws(()=>runtimeAdmissionProjection({...request(),[field]:'wrong'},service,binding),/R2_ADMISSION_BINDING/)
  }
  const missing=request();delete missing.challenge
  assert.throws(()=>runtimeAdmissionProjection(missing,service,binding),/R2_ADMISSION_BINDING/)
  assert.throws(()=>runtimeAdmissionProjection({...request(),privatePayload:'private'},service,binding),/R2_ADMISSION_BINDING/)
})
// All process APIs remain denied through target construction and every disposer.
