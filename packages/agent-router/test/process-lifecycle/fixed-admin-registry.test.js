import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createProcessRegistry } from '../../src/process-registry.js'

const ROOT = Object.freeze({ role:'original_executor_admin_qualification',phase:'restart_a',
  consumingBinarySha256:'a'.repeat(64),validatorSha256:'b'.repeat(64),
  entryManifestSha256:'c'.repeat(64),
  procedureSha256:'b1a1d5e148143c5ddf43fd644cb377cf7f74a4c561354b9098d80bd8c6933d44',
  startupNonce:'d'.repeat(64) })

test('only private authenticated registry closure may allocate the fixed canary child once', async () => {
  const created=[]
  const registry=createProcessRegistry({
    log:{log(){},error(){}},cfg:{agentProfile:'production',productionRoot:'/synthetic/root'},
    workspaceBootstrap:{ensure:async()=>{},resolveWorkspace:()=>'/synthetic/workspace',
      resolveDshHome:()=>'/synthetic/home'},
    agentDefinition:{getAgent:id=>({id,disabled:false})},
    deadlineConfig:{perAgent:()=>({initializeTimeoutMs:90000,promptReceiptTimeoutMs:30000,
      turnTimeoutMs:300000,shutdownGraceMs:30000})},
    reconciliationStore:{assertBusinessAdmissionReady(){},activeFenceForAgent(){return null},
      highestIssuedGeneration(){return 2},unresolvedRecoveryRecords(){return []}},
    processFactory:options=>{
      created.push(options)
      return { ...options,exit:undefined,ownership:null,ownershipToken:'owned-token',
        spawn(){this.ownership={childObject:{}}},ready:async()=>{},exitPromise:new Promise(()=>{}) }
    },
    resolveProcessConfig:()=>({}),provisionHome(){},switchAgent(){},getBrokerGateway(){},
    fixedAdminRootContext:ROOT,
  })
  await assert.rejects(registry.ensureRunning('agt_efficiency-agent'),
    error=>error.code==='FIXED_ADMIN_CANARY_PRIVATE_ONLY')
  assert.equal(created.length,0)
  const proc=await registry.ensureFixedAdminProcess()
  assert.equal(created.length,1)
  assert.equal(proc.fixedAdminQualification.startupNonce,ROOT.startupNonce)
  assert.equal(created[0].processGeneration,3)
  assert.equal(created[0].fixedAdminQualification.packageSha256,ROOT.entryManifestSha256)
  assert.equal(created[0].fixedAdminQualification.startupNonce,ROOT.startupNonce)
  await assert.rejects(registry.ensureFixedAdminProcess(),
    error=>error.code==='FIXED_ADMIN_CANARY_NO_REPLAY')
  await assert.rejects(registry.ensureRunning('agt_efficiency-agent'),
    error=>error.code==='FIXED_ADMIN_CANARY_PRIVATE_ONLY')
  assert.equal(created.length,1)
})
