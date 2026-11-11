import './helpers/isolated-workspace.js'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink, truncate, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import * as history from '../src/history.js'
import { normalizeEntry, renderEntries } from '../src/memory.js'
const sha = b => createHash('sha256').update(b).digest('hex')
const ARCHIVE = 'MEMORY.md.bloated-20261022'
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'memory-history-'))
  t.after(()=>rm(root,{recursive:true,force:true}))
  await mkdir(join(root,'memory'))
  const core = renderEntries([normalizeEntry({type:'decision',title:'current',content:'current fact'})])
  const archive = '归档独有事实\n\n第二段：归档独有事实\n'
  await writeFile(join(root,'MEMORY.md'),core)
  await writeFile(join(root,ARCHIVE),archive)
  await writeFile(join(root,'memory/2026-10-31.md'),'今日事实\n')
  await writeFile(join(root,'memory/2026-10-30.md'),'昨天事实\n')
  await writeFile(join(root,'memory/2026-02-30.md'),'forbidden fact')
  await writeFile(join(root,'memory/dispatcher.jsonl'),'forbidden fact')
  const manifest = {schema:'AGENT_MEMORY_HISTORY_MANIFEST_V1',archives:[{relativePath:ARCHIVE,sha256:sha(archive),bytes:Buffer.byteLength(archive)}]}
  await writeFile(join(root,'memory/history-manifest.json'),JSON.stringify(manifest))
  const binding={workspace:root,primaryWorkspace:root,workspaceKey:sha(root),resolverOrigin:'primary',status:'COMPLETE',equality:true}
  const search=history.createHistorySearch({binding,now:()=>new Date('2026-10-31T12:00:00Z')})
  return {root,binding,search,archive,core,manifest}
}
test('explicit allowlist finds archive-only UTF-8 with full hash and exact byte/line provenance, zero writes',async t=>{
  const f=await fixture(t)
  const before=await readFile(join(f.root,'memory/history-manifest.json'))
  const result=await f.search({query:'归档独有事实'})
  assert.equal(result.status,'COMPLETE')
  assert.equal(result.items.length,2)
  const hit=result.items[0]
  assert.equal(hit.sourceSha256,sha(f.archive))
  assert.equal(hit.relativePath,ARCHIVE)
  assert.equal(hit.eventTime,null)
  assert.equal(hit.byteStart,0)
  assert.equal(hit.lineStart,1)
  assert.equal(Buffer.from(f.archive).subarray(hit.byteStart,hit.byteEnd).toString(),hit.excerpt)
  assert.equal(result.exhausted,true)
  assert.equal((await f.search({query:'forbidden fact'})).items.length,0)
  assert.deepEqual(await readFile(join(f.root,'memory/history-manifest.json')),before)
  assert.deepEqual((await readdir(f.root)).sort(),['MEMORY.md',ARCHIVE,'memory'].sort())
})
test('literal validation, real UTC dates and fixed source selection reject injected paths',async t=>{
  const {search}=await fixture(t)
  for(const args of [{query:''},{query:'a',path:'/etc/passwd'},{query:'a',sources:['../other']},{query:'a',fromDate:'2026-02-30'},{query:'a',fromDate:'2020-01-01',toDate:'2026-10-31'},{query:'a',limit:51}])
    assert.equal((await search(args)).status,'REFUSED',JSON.stringify(args))
  assert.equal((await search({query:'今日事实',sources:['core']})).items.length,0)
  assert.equal((await search({query:'今日事实',sources:['daily']})).items.length,1)
})
test('pagination authenticates scope and revalidates all prior source hashes including deletion',async t=>{
  const {search,root}=await fixture(t)
  const args={query:'归档独有事实',sources:['archive'],limit:1}
  const one=await search(args)
  assert.ok(one.nextCursor)
  assert.equal(one.exhausted,false)
  const two=await search({...args,cursor:one.nextCursor})
  assert.equal(two.items.length,1)
  assert.ok(two.items[0].byteStart>one.items[0].byteStart)
  assert.equal(two.exhausted,true)
  assert.equal((await search({...args,query:'different',cursor:one.nextCursor})).status,'REFUSED')
  assert.equal((await search({...args,cursor:one.nextCursor+'x'})).status,'REFUSED')
  await writeFile(join(root,ARCHIVE),'changed')
  assert.equal((await search({...args,cursor:one.nextCursor})).status,'STALE')
  await unlink(join(root,ARCHIVE))
  assert.equal((await search({...args,cursor:one.nextCursor})).status,'STALE')
})
test('manifest refuses arbitrary archives and symlink files/directories without following',async t=>{
  const f=await fixture(t)
  await writeFile(join(f.root,'memory/history-manifest.json'),JSON.stringify({...f.manifest,archives:[{...f.manifest.archives[0],relativePath:'../settings.json'}]}))
  assert.equal((await f.search({query:'a'})).status,'REFUSED')
  await writeFile(join(f.root,'memory/history-manifest.json'),JSON.stringify(f.manifest))
  await unlink(join(f.root,ARCHIVE))
  await symlink('MEMORY.md',join(f.root,ARCHIVE))
  const r=await f.search({query:'current',sources:['archive']})
  assert.equal(r.status,'PARTIAL');assert.equal(r.items.length,0)
  await rm(join(f.root,'memory'),{recursive:true})
  await mkdir(join(f.root,'outside'))
  await writeFile(join(f.root,'outside/2026-10-31.md'),'outside secret')
  await symlink('outside',join(f.root,'memory'))
  assert.notEqual((await f.search({query:'outside secret'})).status,'COMPLETE')
})
test('unverified oversized sources yield PARTIAL with no half-hash items; extended is explicit',async t=>{
  const f=await fixture(t)
  const file=join(f.root,'memory/2026-10-31.md')
  await writeFile(file,'oversized needle\n')
  await truncate(file,9*1024*1024)
  const r=await f.search({query:'oversized needle',sources:['daily']})
  assert.equal(r.status,'PARTIAL');assert.equal(r.items.length,0);assert.equal(r.exhausted,false)
  assert.ok(r.coverage.unsearchedSources.some(s=>s.reason==='SOURCE_VERIFICATION_BUDGET'))
  assert.equal((await f.search({query:'oversized needle',sources:['daily'],scanBudget:'extended'})).items.length,1)
})
test('UTF-8 across 64KiB chunks and source hash stay exact; snippets redact obvious secrets',async t=>{
  const f=await fixture(t)
  const bytes='x'.repeat(65535)+'中文事实\n\napi_key=sk-abcdefghijklmnopqrstuvwxyz0123456789\n'
  await writeFile(join(f.root,'memory/2026-10-31.md'),bytes)
  const r=await f.search({query:'中文事实',sources:['daily']})
  assert.equal(r.items.length,1);assert.equal(r.items[0].sourceSha256,sha(bytes))
  assert.ok(r.items[0].excerpt.length<=800);assert.equal(r.items[0].excerptTruncated,true)
  const secret=await f.search({query:'api_key',sources:['daily']})
  assert.match(secret.items[0].excerpt,/REDACTED/)
  assert.doesNotMatch(secret.items[0].excerpt,/abcdefghijklmnopqrstuvwxyz/)
})
test('reviewed tombstone excludes overlapping history but reports retained source scope',async t=>{
  const f=await fixture(t)
  f.manifest.tombstones=[{relativePath:ARCHIVE,sourceSha256:sha(f.archive),byteStart:0,byteEnd:Buffer.byteLength(f.archive)}]
  await writeFile(join(f.root,'memory/history-manifest.json'),JSON.stringify(f.manifest))
  const r=await f.search({query:'归档独有事实'})
  assert.equal(r.items.length,0);assert.ok(r.coverage.retainedEvidence.length)
})

test('zero-hit many-paragraph scan stays within the bounded default and reports exact coverage',async t=>{
  const f=await fixture(t)
  const text='段落内容\n\n'.repeat(150893)
  await writeFile(join(f.root,'MEMORY.md'),text)
  const start=performance.now()
  const r=await f.search({query:'absent-zero-hit',sources:['core']})
  assert.ok(performance.now()-start<1800,'default query must interrupt work near its 1s deadline')
  assert.equal(r.status,'COMPLETE');assert.equal(r.exhausted,true);assert.equal(r.items.length,0)
  assert.equal(r.coverage.bytesRead,Buffer.byteLength(text))
})
test('complete-source UTF-8 validation refuses invalid bytes and nofollow refuses oversized sources',async t=>{
  const f=await fixture(t)
  await writeFile(join(f.root,'MEMORY.md'),Buffer.from([0xc3,0x28]))
  let r=await f.search({query:'x',sources:['core']})
  assert.equal(r.status,'PARTIAL');assert.equal(r.exhausted,false);assert.equal(r.items.length,0)
  assert.equal(r.coverage.unsearchedSources[0].reason,'INVALID_UTF8')
  await truncate(join(f.root,'MEMORY.md'),33*1024*1024)
  r=await f.search({query:'x',sources:['core'],scanBudget:'extended'})
  assert.equal(r.status,'PARTIAL');assert.equal(r.items.length,0);assert.equal(r.nextCursor,null)
  assert.equal(r.coverage.unsearchedSources[0].reason,'SOURCE_TOO_LARGE')
})
test('expired verification never returns a partial hash as evidence',async t=>{
  const f=await fixture(t)
  const r=await history.readVerifiedSource(f.binding,'MEMORY.md',{deadline:0})
  assert.equal(r.reason,'TIME_BUDGET');assert.equal(r.sha256,null);assert.equal(r.bytes,null);assert.equal(r.cutoff,0)
})

test('continuation cannot loop forever when revalidation consumes the file budget',async t=>{
 const f=await fixture(t)
 const args={query:'missing',sources:['daily'],fromDate:'2026-09-28',toDate:'2026-10-31'}
 const first=await f.search(args)
 assert.equal(first.status,'PARTIAL');assert.ok(first.nextCursor)
 const next=await f.search({...args,cursor:first.nextCursor})
 assert.equal(next.status,'PARTIAL');assert.equal(next.nextCursor,null)
 assert.ok(next.coverage.reasons.includes('CONTINUATION_REVALIDATION_BUDGET'))
 const explicit=await f.search({...args,cursor:first.nextCursor,scanBudget:'extended'})
 assert.equal(explicit.status,'COMPLETE');assert.equal(explicit.exhausted,true)
})

test('explicit-forget exclusion fails closed when its source later changes',async t=>{
 const f=await fixture(t)
 const path='memory/2026-10-31.md',text='forgotten fact\n'
 await writeFile(join(f.root,path),text)
 f.manifest.tombstones=[{relativePath:path,sourceSha256:sha(text),byteStart:0,byteEnd:Buffer.byteLength(text)}]
 await writeFile(join(f.root,'memory/history-manifest.json'),JSON.stringify(f.manifest))
 let result=await f.search({query:'forgotten fact',sources:['daily']})
 assert.equal(result.status,'COMPLETE');assert.equal(result.items.length,0)
 await writeFile(join(f.root,path),text+'new episode\n')
 result=await f.search({query:'forgotten fact',sources:['daily']})
 assert.equal(result.status,'PARTIAL');assert.equal(result.items.length,0)
 assert.ok(result.coverage.unsearchedSources.some(s=>s.reason==='TOMBSTONE_SOURCE_CHANGED'))
})
