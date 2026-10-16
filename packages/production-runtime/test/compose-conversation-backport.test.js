import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {composeProductionRuntime} from '../src/compose.js'
import {resolveProductionLayout} from '../src/paths.js'

test('installed composition keeps conversation default off and reuses the original Router recovery authority when enabled',async t=>{
  for(const enabled of [false,true]) {
    const root=mkdtempSync(join(tmpdir(),'pilot-backport-compose-'))
    t.after(()=>rmSync(root,{recursive:true,force:true}))
    mkdirSync(join(root,'scheduler'),{recursive:true})
    const layout=resolveProductionLayout(root),captured=[]
    writeFileSync(layout.agentsConfig,JSON.stringify({version:1,defaultAgentId:'agt_pilot',agents:[{id:'agt_pilot',name:'Pilot fixture'}]}))
    let finish
    const runtime=await composeProductionRuntime({layout,globalRoute:{provider:'opencode-go',model:'deepseek-v4-flash'},
      productApi:{enabled:false,...(enabled?{conversation:{enabled:true,authConfigFile:join(root,'missing-auth.json')}}:{})},
      notificationIngress:{enabled:false},feishuCredsPath:join(root,'missing-feishu.json'),
      provisionHome:()=>{},processFactory:opts=>{
        captured.push(opts)
        return {pid:12345,state:'READY',exit:undefined,spawn(){},ready:async()=>0,
          exitPromise:new Promise(resolve=>{finish=resolve}),async shutdown(){this.exit={code:0,signal:null};finish(this.exit);return this.exit}}
      },log:{log(){},warn(){},error(){}}})
    try {
      assert.equal(Boolean(runtime.ctx.get('nativeConversation')),enabled)
      await runtime.router.ensureRunning('agt_pilot')
      assert.equal(captured.length,1)
      assert.equal(captured[0].reconciliationStore.persistenceFile,layout.turnRecoveryStore)
      assert.equal(captured[0].env.DSH_CONVERSATION_SOURCE_DIR,enabled?join(layout.controlDir,'native-conversation','source'):undefined)
      if(enabled) {
        const response=await runtime.ctx.get('nativeConversation').invoke('resolve',{target:{agent_id:'agt_pilot'}},undefined)
        assert.equal(response.status,503)
        assert.equal(response.body.error.class,'NOT_PROVISIONED')
      }
    } finally { await runtime.stop() }
  }
})
