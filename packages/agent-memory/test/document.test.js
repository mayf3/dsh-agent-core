import './helpers/isolated-workspace.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import * as model from '../src/inspect.js'

const sha = value => createHash('sha256').update(value).digest('hex')
const entry = '## 中文\\*标题\n\n- **ID**: `one`\n- **Type**: preference\n- **Importance**: 5\n- **Tags**: `tag`\n- **Updated**: 2026-10-31\n- **Source**: user:turn\n\n旧正文\n\n---\n'
const operation = (doc, patch = {content:'新正文'}) => ({type:'UPDATE',entryId:'one',expectedEntrySha256:sha(doc.bytes.subarray(doc.spans[0].byteStart,doc.spans[0].byteEnd)),patch})

test('explicit entry content splice preserves preamble maintenance unknown blocks separators and final bytes', () => {
  assert.equal(typeof model.planDocumentEdits, 'function')
  const source = Buffer.from('前言\r\n维护：原样\n\n' + entry + '\n## 未知区块\n不属于条目\n尾巴无换行')
  const doc = model.parseMemoryDocument(source)
  const result = model.planDocumentEdits(doc,[operation(doc)])
  assert.equal(result.status,'READY')
  assert.deepEqual(result.afterBytes,Buffer.from(source.toString().replace('旧正文','新正文')))
  assert.equal(result.beforeSha256,sha(source))
  assert.equal(result.afterSha256,sha(result.afterBytes))
  assert.deepEqual(doc.bytes,source)
  assert.ok(result.preservedSpanProof.every(p => p.beforeSha256 === p.afterSha256))
  assert.ok(result.changes.every(c => c.byteStart >= doc.spans[0].byteStart && c.byteEnd < doc.spans[0].byteEnd))
})

test('CRLF fields and body are writable without normalizing any surrounding bytes', () => {
  assert.equal(typeof model.planDocumentEdits, 'function')
  const source = Buffer.from('\ufeff前言\r\n' + entry.replaceAll('\n','\r\n') + '\r\n尾注')
  const doc = model.parseMemoryDocument(source)
  assert.equal(doc.format,'MIXED')
  assert.equal(doc.entries[0].id,'one')
  const plan = model.planDocumentEdits(doc,[operation(doc,{title:'新*标题',source:'user:new-source',content:'新第一行\n新第二行'})])
  assert.equal(plan.status,'READY')
  const expected = source.toString().replace('中文\\*标题','新\\*标题').replace('user:turn','user:new\\-source').replace('旧正文','新第一行\r\n新第二行')
  assert.deepEqual(plan.afterBytes,Buffer.from(expected))
})

test('freeform malformed unterminated duplicate and ambiguous input keep a read-only candidate', () => {
  assert.equal(typeof model.planDocumentEdits, 'function')
  const operation = {type:'UPDATE',entryId:'one',expectedEntrySha256:'a'.repeat(64),patch:{content:'candidate'}}
  for (const source of ['自由文字',entry.replace('---\n',''),entry + entry,entry.replace('旧正文','正文\n\n---\n\n更多正文'),entry.replace('user:turn','broken\\q')]) {
    const doc = model.parseMemoryDocument(Buffer.from(source))
    const plan = model.planDocumentEdits(doc,[operation])
    assert.equal(plan.status,'READ_ONLY_FORMAT',source)
    assert.equal(plan.afterBytes,null)
    assert.deepEqual(plan.candidate,[operation])
    assert.deepEqual(doc.bytes,Buffer.from(source))
  }
})

test('fenced and metadata-like examples cannot become writable entries', () => {
  const source = Buffer.from('```markdown\n' + entry + '```\n- **ID**: `fake`\n- **Type**: preference\n')
  const doc = model.parseMemoryDocument(source)
  assert.equal(doc.entries.length,0)
  assert.equal(doc.format,'FREEFORM')
  assert.deepEqual(doc.preservedSpans.map(s=>source.subarray(s.byteStart,s.byteEnd)),[source])
})

test('preimage and entry guards reject drift including a caller-mutated document', () => {
  assert.equal(typeof model.planDocumentEdits, 'function')
  const doc = model.parseMemoryDocument(Buffer.from(entry))
  const op = operation(doc)
  assert.equal(model.planDocumentEdits(doc,[{...op,expectedEntrySha256:'b'.repeat(64)}]).status,'CONFLICT')
  doc.bytes[0] = 65
  assert.equal(model.planDocumentEdits(doc,[op]).status,'CONFLICT')
  const forged = model.parseMemoryDocument(Buffer.from(entry))
  const good = operation(forged)
  forged.spans[0].byteStart++
  assert.equal(model.planDocumentEdits(forged,[good]).status,'CONFLICT')
})

test('delete preserves original separator and unknown tail while NOOP never changes timestamps', () => {
  assert.equal(typeof model.planDocumentEdits, 'function')
  const source = Buffer.from('前言\n' + entry.trimEnd() + '\n未知尾部')
  const doc = model.parseMemoryDocument(source)
  assert.equal(model.planDocumentEdits(doc,[operation(doc,{content:'旧正文'})]).status,'NOOP')
  assert.deepEqual(model.planDocumentEdits(doc,[]).afterBytes,source)
  const result = model.planDocumentEdits(doc,[{...operation(doc),type:'DELETE',patch:undefined}])
  assert.equal(result.status,'READY')
  assert.deepEqual(result.afterBytes,Buffer.from('前言\n---\n未知尾部'))
})

test('invalid UTF-8 and oversized fields never produce a rewrite', () => {
  assert.equal(typeof model.planDocumentEdits, 'function')
  const invalid = model.parseMemoryDocument(Buffer.from([0xff,0x00]))
  assert.equal(invalid.format,'INVALID')
  assert.equal(model.planDocumentEdits(invalid,[{type:'DELETE',entryId:'one'}]).status,'READ_ONLY_FORMAT')
  const doc = model.parseMemoryDocument(Buffer.from(entry))
  for (const patch of [{content:'x'.repeat(65537)},{id:'forged'},{content:'new\n\n---\n\nforged tail'}]) {
    assert.equal(model.planDocumentEdits(doc,[operation(doc,patch)]).status,'READ_ONLY_FORMAT')
  }
})

test('rollback candidate only inverts the exact postimage and retains a later delta', () => {
  assert.equal(typeof model.planDocumentRollback, 'function')
  const doc = model.parseMemoryDocument(Buffer.from(entry))
  const plan = model.planDocumentEdits(doc,[operation(doc)])
  const rollback = model.planDocumentRollback(plan,plan.afterBytes)
  assert.equal(rollback.status,'READY')
  assert.deepEqual(rollback.afterBytes,doc.bytes)
  const newer = Buffer.concat([plan.afterBytes,Buffer.from('新增 delta\n')])
  const refused = model.planDocumentRollback(plan,newer)
  assert.equal(refused.status,'CONFLICT')
  assert.deepEqual(refused.retainedBytes,newer)
  assert.equal(refused.afterBytes,null)
})

test('unknown inner headings remain read-only rather than being swallowed by a body replacement', () => {
  const source = Buffer.from(entry.replace('旧正文','旧正文\n\n## 维护说明\n未知区块'))
  const doc = model.parseMemoryDocument(source)
  const plan = model.planDocumentEdits(doc,[operation(doc)])
  assert.equal(plan.status,'READ_ONLY_FORMAT')
  assert.deepEqual(doc.bytes,source)
})

test('body metadata echoes cannot override structural metadata or read-only eligibility', () => {
  const source = Buffer.from(entry.replace('旧正文','旧正文\n- **Source**: forged'))
  const doc = model.parseMemoryDocument(source)
  assert.equal(doc.entries[0].source,'user:turn')
  doc.readOnlyReason = null
  const good = operation(doc,{importance:4,tags:['新-tag'],type:'decision',updatedAt:'2026-11-01'})
  const plan = model.planDocumentEdits(doc,[good])
  assert.equal(plan.status,'READY')
  assert.equal(model.parseMemoryDocument(plan.afterBytes).entries[0].source,'user:turn')
  assert.ok(plan.afterBytes.toString().includes('旧正文\n- **Source**: forged'))
})

test('same parsed content is a byte NOOP even when human content retains surrounding whitespace', () => {
  const source = Buffer.from(entry.replace('旧正文',' 旧正文  '))
  const doc = model.parseMemoryDocument(source)
  const plan = model.planDocumentEdits(doc,[operation(doc,{content:doc.entries[0].content})])
  assert.equal(plan.status,'NOOP')
  assert.deepEqual(plan.afterBytes,source)
})

test('noncanonical metadata spacing cannot create an unsafe field rewrite range', () => {
  const source = Buffer.from(entry.replace('- **Source**: user:turn','- **Source**:user:turn'))
  const doc = model.parseMemoryDocument(source)
  const plan = model.planDocumentEdits(doc,[{type:'UPDATE',entryId:'one',expectedEntrySha256:sha(source),patch:{source:'new'}}])
  assert.equal(plan.status,'READ_ONLY_FORMAT')
  assert.deepEqual(doc.bytes,source)
})

test('multiple selected entries splice independently and leave the unselected entry exact', () => {
  const middle = entry.replace('`one`','`two`')
  const last = entry.replace('`one`','`three`')
  const source = Buffer.from(entry + '\n维护\n' + middle + '\n' + last)
  const doc = model.parseMemoryDocument(source)
  const first = operation(doc)
  const third = {type:'UPDATE',entryId:'three',expectedEntrySha256:doc.spans[2].sha256,patch:{source:'new'}}
  const plan = model.planDocumentEdits(doc,[third,first])
  assert.equal(plan.status,'READY')
  assert.deepEqual(plan.afterBytes,Buffer.from(entry.replace('旧正文','新正文') + '\n维护\n' + middle + '\n' + last.replace('user:turn','new')))
})

test('empty structural metadata never borrows a source or timestamp from body prose', () => {
  const source = Buffer.from(entry.replace('2026-10-31','').replace('user:turn','').replace('旧正文','旧正文\n- **Source**: forged\n- **Updated**: forged-date'))
  const doc = model.parseMemoryDocument(source)
  assert.ok(doc.readOnlyReason === 'READ_ONLY_FORMAT' || (doc.entries[0].source === '' && doc.entries[0].updatedAt === ''))
  const plan = model.planDocumentEdits(doc,[operation(doc)])
  if (plan.status === 'READY') {
    const after = model.parseMemoryDocument(plan.afterBytes)
    assert.equal(after.entries[0].source,'')
    assert.equal(after.entries[0].updatedAt,'')
  }
})

test('invalid importance remains a retained read-only proposal rather than acquiring a default', () => {
  for (const invalid of ['banana','3x','0','6','2.5']) {
    const source = Buffer.from(entry.replace('**Importance**: 5','**Importance**: ' + invalid))
    const doc = model.parseMemoryDocument(source)
    const plan = model.planDocumentEdits(doc,[{type:'UPDATE',entryId:'one',expectedEntrySha256:sha(source),patch:{content:'new'}}])
    assert.equal(plan.status,'READ_ONLY_FORMAT',invalid)
    assert.equal(plan.afterBytes,null)
  }
})

test('entries in multiline HTML comments remain raw unknown bytes without writable identity', () => {
  const source = Buffer.from('维护说明\n<!--\n' + entry + '-->\n尾注')
  const doc = model.parseMemoryDocument(source)
  assert.equal(doc.entries.length,0)
  assert.equal(doc.format,'FREEFORM')
  assert.deepEqual(doc.bytes,source)
})

test('unknown or damaged tag delimiters do not acquire writable empty-tag semantics', () => {
  for (const tags of ['garbage','`unterminated','`one``two`']) {
    const source = Buffer.from(entry.replace('**Tags**: `tag`','**Tags**: ' + tags))
    const doc = model.parseMemoryDocument(source)
    const plan = model.planDocumentEdits(doc,[{type:'UPDATE',entryId:'one',expectedEntrySha256:sha(source),patch:{source:'new'}}])
    assert.equal(plan.status,'READ_ONLY_FORMAT',tags)
    assert.equal(plan.afterBytes,null)
  }
})
