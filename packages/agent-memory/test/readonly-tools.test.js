import './helpers/isolated-workspace.js'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { apply } from '../src/index.js'
import { normalizeEntry, renderEntries } from '../src/memory.js'
async function mount(t) {
 const root=await mkdtemp(join(tmpdir(),'memory-tools-'));t.after(()=>rm(root,{recursive:true,force:true}))
 const values=new Map(),tools=[],prompts=[]
 values.set('tools',{register(x){tools.push(x);return()=>{}}})
 values.set('systemPrompt',{context(x){prompts.push(x);return()=>{}}})
 const ctx={provide:(n,v)=>values.set(n,v),get:n=>values.get(n),inject:(ns,cb)=>cb(Object.fromEntries(ns.map(n=>[n,values.get(n)]))),on:()=>()=>{}}
 const dispose=apply(ctx,{agentId:'synthetic',workspaceRoot:root,autoConsolidate:false});t.after(dispose)
 const workspace=join(root,'synthetic');await mkdir(join(workspace,'memory'),{recursive:true})
 const invoke=(name,args={})=>{const tool=tools.find(t=>t.name===name);assert.ok(tool,`${name} registered`);return tool.execute(args,{agent:{session:{header:{cwd:workspace}}}})}
 return {root,workspace,invoke,prompts,service:values.get('agentMemory')}
}
test('read-only tools report UNKNOWN loaded state, core-only old search and no source changes',async t=>{
 const f=await mount(t)
 const raw=renderEntries([normalizeEntry({type:'preference',title:'core',content:'current fact'})])
 await writeFile(join(f.workspace,'MEMORY.md'),raw)
 await writeFile(join(f.workspace,'memory',new Date().toISOString().slice(0,10)+'.md'),'daily-only fact')
 const before=await readdir(f.workspace)
 const inspect=await f.invoke('memory_inspect')
 assert.equal(inspect.schema,'AGENT_MEMORY_INSPECT_V1');assert.equal(inspect.version.loadedSource,null)
 assert.equal((await f.invoke('memory_search',{query:'daily-only fact'})).items.length,0)
 assert.equal((await f.invoke('memory_history_search',{query:'daily-only fact'})).items.length,1)
 assert.equal((await f.invoke('memory_inspect',{path:'/etc/passwd'})).status,'REFUSED')
 assert.equal(await readFile(join(f.workspace,'MEMORY.md'),'utf8'),raw)
 assert.deepEqual(await readdir(f.workspace),before)
})
test('real prompt assembly records EMPTY, INJECTED and REFUSED receipts without exposing content',async t=>{
 const f=await mount(t)
 const before=await f.invoke('memory_inspect');assert.equal(before.injection.lastObservedAssembly,null)
 assert.equal(f.prompts[0].text(),'')
 assert.equal((await f.invoke('memory_inspect')).injection.lastObservedAssembly.result,'EMPTY')
 const raw=renderEntries([normalizeEntry({type:'preference',title:'private title',content:'private fact'})])
 await writeFile(join(f.workspace,'MEMORY.md'),raw)
 assert.match(f.prompts[0].text(),/private fact/)
 const receipt=(await f.invoke('memory_inspect')).injection.lastObservedAssembly
 assert.equal(receipt.result,'INJECTED');assert.equal(receipt.selectedCount,1)
 assert.equal(receipt.coreSha256,createHash('sha256').update(raw).digest('hex'))
 assert.doesNotMatch(JSON.stringify(receipt),/private fact|private title/)
 await writeFile(join(f.workspace,'MEMORY.md'),raw.replace('**Source**: manual','**Source**: '+'x'.repeat(9000)))
 assert.equal(f.prompts[0].text(),'')
 assert.equal((await f.invoke('memory_inspect')).injection.lastObservedAssembly.result,'REFUSED')
})

test('inspect tool refuses scalar or array parameters rather than treating them as summary objects',async t=>{
  const f=await mount(t)
  for(const args of [[],1,'x']) await assert.rejects(()=>f.invoke('memory_inspect',args),{code:'INVALID_ARGS'})
})
