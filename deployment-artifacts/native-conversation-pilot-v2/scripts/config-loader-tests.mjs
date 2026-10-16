import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,chmod,rm,symlink} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {pathToFileURL} from 'node:url'
import http from 'node:http'
const root=resolve(process.env.PILOT_RELEASE_ROOT??'/Users/yanfenma/workspace/project/pilot1156-fixed-v2')
const {callNativeConversation}=await import(pathToFileURL(join(root,'mcp/src/native-conversation.mjs')))
const {validateConfig}=await import(pathToFileURL(join(root,'real-candidate/source/packages/product-api/src/conversation/auth.js')))
const subject='d58a98f0-0000-4000-8000-000000000001' // synthetic fixture only

test('actual MCP loader accepts only safe matching files and authenticated original transport',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'pilot1156-loader-'));let calls=0
  const server=http.createServer((req,res)=>{calls++;req.resume();res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({status:'OK',contract_version:'native-conversation-v1',agent_id:'agt_build-in-public-agent',target_handle:'target-fixture',allowed_operations:['resolve','send','result']}))})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const config={enabled:true,connector_subject:subject,endpoint:`http://127.0.0.1:${server.address().port}`,credential_file:'native-conversation.client.json'}
  const credential={connector_subject:subject,client_id:'fixture_native_client',client_secret:'synthetic-fixture-value'}
  const cases=[
    ['valid',{}, {},true,true],
    ['nonloopback',{endpoint:'http://localhost:8788'}, {},true,false],
    ['https_endpoint',{endpoint:'https://127.0.0.1:8788'}, {},true,false],
    ['extra_config_key',{principal_id:'forbidden'}, {},true,false],
    ['mismatched_subject',{}, {connector_subject:'d58a98f0-0000-4000-8000-000000000002'},true,false],
    ['newline_secret',{}, {client_secret:'fixture\nvalue'},true,false],
    ['invalid_client_charset',{}, {client_id:'invalid:client'},true,false],
    ['disabled',{enabled:false}, {},true,false],
    ['unauthenticated_transport',{}, {},false,false],
  ]
  try {
    for(const [name,c,p,authenticated,accepted]of cases)await t.test(name,async()=>{
      await writeFile(join(dir,'native-conversation.json'),JSON.stringify({...config,...c}),{mode:0o600})
      await writeFile(join(dir,'native-conversation.client.json'),JSON.stringify({...credential,...p}),{mode:0o600})
      const before=calls,result=await callNativeConversation('resolve_agent_target',{target:{agent_id:'agt_build-in-public-agent'}},{configDir:dir,authenticatedTransport:authenticated})
      assert.equal(result.status==='OK',accepted);assert.equal(calls-before,accepted?1:0)
    })
    await t.test('unsafe mode and symlink rejected by actual file loader',async()=>{
      const cfg=join(dir,'native-conversation.json')
      await writeFile(cfg,JSON.stringify(config));await chmod(cfg,0o644)
      let before=calls
      assert.equal((await callNativeConversation('resolve_agent_target',{target:{agent_id:'agt_build-in-public-agent'}},{configDir:dir,authenticatedTransport:true})).status,'NOT_PROVISIONED')
      assert.equal(calls,before)
      await chmod(cfg,0o600);await rm(cfg);await writeFile(join(dir,'other.json'),JSON.stringify(config),{mode:0o600});await symlink('other.json',cfg)
      assert.equal((await callNativeConversation('resolve_agent_target',{target:{agent_id:'agt_build-in-public-agent'}},{configDir:dir,authenticatedTransport:true})).status,'NOT_PROVISIONED')
      assert.equal(calls,before)
    })
  }finally{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
})

test('actual DSH validator preserves single client/target, HTTPS and send-only withdrawal',async t=>{
  const config={enabled:true,authServiceOrigin:'https://127.0.0.1:4443',retentionMs:604800000,maxRecords:1000,
    clients:[{clientId:'fixture_native_client',subject_id:subject,communication_scope_id:'mcp-native-conversation-pilot-v1',principal_id:'fixture-product-principal',operations:['resolve','send','result'],
      targets:[{agent_id:'agt_build-in-public-agent',principal_id:'d5b3aeb2-e754-49a9-9914-b963521c0985',domain_id:'f9b5682c-1c9c-5ace-a7b1-01b9a3be5965',binding_id:'mcp:owner-prebound-pilot',routing_version:'1'}]}]}
  const cases=[['valid',c=>c,true],['http',c=>({...c,authServiceOrigin:'http://127.0.0.1:4001'}),false],
    ['two_clients',c=>({...c,clients:[...c.clients,...c.clients]}),false],
    ['two_targets',c=>{c.clients[0].targets.push({...c.clients[0].targets[0]});return c},false],
    ['disabled',c=>({...c,enabled:false}),false],
    ['send_withdrawn',c=>{c.clients[0].operations=['resolve','result'];return c},true]]
  for(const[name,change,accepted]of cases)await t.test(name,()=>{const value=change(structuredClone(config));if(accepted)assert.ok(validateConfig(value));else assert.throws(()=>validateConfig(value),e=>e.className==='NOT_PROVISIONED')})
})
