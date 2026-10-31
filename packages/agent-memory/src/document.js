/** Lossless byte model and pure, hash-bound entry splices. Never publishes files. */
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { ENTRY_TYPES, MEMORY_GUARD_LIMITS, MEMORY_HEADER, parseEntries, renderEntry } from './codec.js'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const models = new WeakMap()
const plans = new WeakMap()
const FIELDS = ['ID','Type','Importance','Tags','Updated','Source']
const PATCH_FIELDS = new Set(['title','type','importance','tags','updatedAt','source','content'])

function malformedEscape(field) {
  const allowed = new Set('\\`*_[\]{}()#+.!|>~-')
  for (let i = 0; i < field.length; i++) {
    if (field[i] === '\\' && !allowed.has(field[++i])) return true
  }
  return false
}

/** All ranges refer to the original UTF-8 bytes, including original line endings. */
export function parseMemoryDocument(buffer, { deadline = Infinity } = {}) {
  const check = () => {
    if (performance.now() >= deadline) throw Object.assign(new Error('TIME_BUDGET'),{code:'TIME_BUDGET'})
  }
  check()
  const bytes = Buffer.from(buffer ?? '')
  const doc = {bytes,format:'FREEFORM',entries:[],spans:[],preservedSpans:[],
    coverage:{bytes:bytes.length,parsedBytes:0,unparsedBytes:bytes.length},issues:[],sha256:hash(bytes),readOnlyReason:null}
  const invalid = code => {
    doc.format = 'INVALID'
    doc.readOnlyReason = 'READ_ONLY_FORMAT'
    doc.issues.push({code})
    if (bytes.length) doc.preservedSpans.push({byteStart:0,byteEnd:bytes.length,kind:'unparsed'})
    models.set(doc,{bytes:Buffer.from(bytes),spans:'[]'})
    return doc
  }
  if (bytes.length > MEMORY_GUARD_LIMITS.maxFileBytes) return invalid('SOURCE_TOO_LARGE')
  let text
  try { text = new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes) }
  catch { return invalid('INVALID_UTF8') }
  const lines = []
  let offset = 0
  let fence = null
  for (const match of text.matchAll(/[^\n]*\n|[^\n]+$/g)) {
    if ((lines.length & 1023) === 0) check()
    const raw = match[0]
    const value = raw.replace(/\r?\n$/,'')
    const eol = raw.slice(value.length)
    const mark = value.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    const fenced = fence !== null
    if (mark && !fence) fence = {char:mark[1][0],length:mark[1].length}
    else if (mark && fence && mark[1][0] === fence.char && mark[1].length >= fence.length && !mark[2].trim()) fence = null
    const length = Buffer.byteLength(raw)
    lines.push({text:value,byteStart:offset,byteEnd:offset+length,eol,fenced:fenced || Boolean(mark)})
    offset += length
  }
  const candidates = []
  for (let i = 0; i < lines.length; i++) {
    if ((i & 1023) === 0) check()
    if (lines[i].fenced || !lines[i].text.startsWith('## ')) continue
    let meta = i+1
    while (meta < lines.length && lines[meta].text === '') meta++
    if (/^- \*\*ID\*\*: `[^`]+`$/.test(lines[meta]?.text ?? '') && /^- \*\*Type\*\*:/.test(lines[meta+1]?.text ?? '')) candidates.push({line:i,meta})
  }
  for (const [index,candidate] of candidates.entries()) {
    check()
    const {line:start,meta} = candidate
    const boundary = candidates[index+1]?.line ?? lines.length
    const separators = []
    for (let j = meta+2; j < boundary; j++) {
      if ((j & 1023) === 0) check()
      if (!lines[j].fenced && /^---[ \t]*$/.test(lines[j].text)) separators.push(j)
    }
    const separator = separators[0] ?? -1
    const end = separator === -1 ? boundary : separator+1
    const byteStart = lines[start].byteStart
    const byteEnd = lines[end-1]?.byteEnd ?? bytes.length
    const fail = code => doc.issues.push({code,byteStart,byteEnd})
    const metadata = FIELDS.map((field,i) => lines[meta+i]?.text.match(new RegExp(`^- \\*\\*${field}\\*\\*: (.*)$`)))
    if (metadata.some(value=>!value) || lines[meta+6]?.text !== '') { fail('INVALID_ENTRY_STRUCTURE'); continue }
    const rawFields = [lines[start].text.slice(3),...metadata.map(value=>value[1])]
    if (rawFields.some(value=>value.length > MEMORY_GUARD_LIMITS.maxFieldChars)) { fail('ENTRY_GUARD_LIMIT'); continue }
    if ([rawFields[0],metadata[3][1],metadata[5][1]].some(malformedEscape)) { fail('INVALID_ENTRY_ESCAPE'); continue }
    let entry
    try {
      const parsed = parseEntries(bytes.subarray(byteStart,byteEnd).toString('utf8').replaceAll('\r\n','\n'))
      if (parsed.length !== 1 || !parsed[0].title || !ENTRY_TYPES.has(parsed[0].type)) { fail('INVALID_ENTRY_STRUCTURE'); continue }
      entry = parsed[0]
      renderEntry(entry) // apply existing codec field/content/render guards
    } catch { fail('ENTRY_GUARD_LIMIT'); continue }
    const range = (lineIndex,prefix) => ({byteStart:lines[lineIndex].byteStart+Buffer.byteLength(prefix),byteEnd:lines[lineIndex].byteEnd-Buffer.byteLength(lines[lineIndex].eol)})
    const fields = {title:range(start,'## ')}
    for (const [key,i] of [['type',1],['importance',2],['tags',3],['updatedAt',4],['source',5]]) fields[key] = range(meta+i,`- **${FIELDS[i]}**: `)
    const bodyStart = lines[meta+7]?.byteStart ?? byteEnd
    const bodyEnd = separator === -1 ? byteEnd : lines[separator-1]?.text === '' ? lines[separator-1].byteStart-Buffer.byteLength(lines[separator-2]?.eol ?? '') : lines[separator].byteStart
    fields.content = {byteStart:bodyStart,byteEnd:Math.max(bodyStart,bodyEnd)}
    const editableEnd = separator === -1 ? byteEnd : lines[separator].byteStart
    const span = {byteStart,byteEnd,entryId:entry.id,entry,fields,editableEnd,eol:lines[meta].eol || '\n',sha256:hash(bytes.subarray(byteStart,byteEnd))}
    doc.entries.push(entry)
    doc.spans.push(span)
    if (separator === -1 || separators.length > 1 || lines[separator-1]?.text !== '' || entry.importance < 1 || entry.importance > 5 || lines.slice(meta+7,end).some(line=>!line.fenced && line.text.startsWith('## '))) doc.readOnlyReason = 'READ_ONLY_FORMAT'
  }
  offset = 0
  for (const span of doc.spans) {
    if (span.byteStart > offset) doc.preservedSpans.push({byteStart:offset,byteEnd:span.byteStart,kind:'preserved'})
    offset = span.byteEnd
    doc.coverage.parsedBytes += span.byteEnd-span.byteStart
  }
  if (offset < bytes.length) doc.preservedSpans.push({byteStart:offset,byteEnd:bytes.length,kind:'preserved'})
  doc.coverage.unparsedBytes = bytes.length-doc.coverage.parsedBytes
  const unknown = doc.preservedSpans.some(({byteStart,byteEnd}) => bytes.subarray(byteStart,byteEnd).toString('utf8').replace(MEMORY_HEADER.trimEnd(),'').trim() !== '')
  doc.format = doc.issues.length ? 'INVALID' : doc.entries.length ? unknown ? 'MIXED' : 'STRUCTURED' : 'FREEFORM'
  if (doc.issues.length || !doc.entries.length || new Set(doc.entries.map(e=>e.id)).size !== doc.entries.length) doc.readOnlyReason = 'READ_ONLY_FORMAT'
  models.set(doc,{bytes:Buffer.from(bytes),spans:JSON.stringify(doc.spans)})
  check()
  return doc
}

function splice(bytes,changes) {
  const chunks = []
  const proof = []
  let before = 0
  let after = 0
  for (const change of changes) {
    const retained = bytes.subarray(before,change.byteStart)
    chunks.push(retained,change.replacement)
    if (retained.length) proof.push({byteStart:before,byteEnd:change.byteStart,afterByteStart:after,beforeSha256:hash(retained),afterSha256:hash(retained)})
    after += retained.length+change.replacement.length
    before = change.byteEnd
  }
  const tail = bytes.subarray(before)
  chunks.push(tail)
  if (tail.length) proof.push({byteStart:before,byteEnd:bytes.length,afterByteStart:after,beforeSha256:hash(tail),afterSha256:hash(tail)})
  return {afterBytes:Buffer.concat(chunks),preservedSpanProof:proof}
}

/** Operations are proposals, not authority to write a workspace or publish a revision. */
export function planDocumentEdits(document, operations = []) {
  const snapshot = models.get(document)
  const base = {beforeSha256:document?.sha256 ?? null,afterBytes:null,afterSha256:null,changes:[],preservedSpanProof:[],candidate:operations,reasons:[]}
  const refuse = (status,reason) => ({...base,status,reasons:[reason]})
  if (!snapshot || !Buffer.isBuffer(document.bytes) || hash(document.bytes) !== document.sha256 || !document.bytes.equals(snapshot.bytes) || JSON.stringify(document.spans) !== snapshot.spans) return refuse('CONFLICT','DOCUMENT_PREIMAGE_CHANGED')
  // Parse a fresh trusted snapshot: mutable caller metadata cannot grant write eligibility.
  const doc = parseMemoryDocument(snapshot.bytes)
  if (!Array.isArray(operations) || operations.length > 128) return refuse('READ_ONLY_FORMAT','INVALID_OPERATIONS')
  if (operations.length && doc.readOnlyReason) return refuse('READ_ONLY_FORMAT','READ_ONLY_FORMAT')
  const changes = []
  const selected = new Set()
  for (const operation of operations) {
    if (!operation || !['UPDATE','DELETE'].includes(operation.type) || selected.has(operation.entryId)) return refuse('READ_ONLY_FORMAT','INVALID_OPERATION')
    selected.add(operation.entryId)
    const span = doc.spans.find(span=>span.entryId === operation.entryId)
    if (!span) return refuse('READ_ONLY_FORMAT','ENTRY_NOT_FOUND')
    if (operation.expectedEntrySha256 !== span.sha256) return refuse('CONFLICT','ENTRY_PREIMAGE_CHANGED')
    if (operation.type === 'DELETE') {
      changes.push({byteStart:span.byteStart,byteEnd:span.editableEnd,replacement:Buffer.alloc(0),entryId:span.entryId})
      continue
    }
    const patch = operation.patch
    if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key=>!PATCH_FIELDS.has(key))) return refuse('READ_ONLY_FORMAT','INVALID_PATCH')
    const entry = {...span.entry,...patch}
    if (!ENTRY_TYPES.has(entry.type) || !Number.isInteger(entry.importance) || entry.importance < 1 || entry.importance > 5 || !Array.isArray(entry.tags) || !entry.tags.every(t=>typeof t === 'string' && !/[\r\n`]/.test(t))) return refuse('READ_ONLY_FORMAT','INVALID_PATCH')
    if (['title','content','source','updatedAt'].some(key=>typeof entry[key] !== 'string') || !entry.title.trim() || ['title','source','updatedAt'].some(key=>/[\r\n]/.test(entry[key]))) return refuse('READ_ONLY_FORMAT','INVALID_PATCH')
    let rendered
    try { rendered = renderEntry(entry).split('\n') }
    catch { return refuse('READ_ONLY_FORMAT','ENTRY_GUARD_LIMIT') }
    const replacements = {title:rendered[0].slice(3),type:entry.type,importance:String(entry.importance),tags:rendered[5].slice('- **Tags**: '.length),updatedAt:entry.updatedAt,source:rendered[7].slice('- **Source**: '.length),content:entry.content.replace(/\r?\n/g,span.eol)}
    for (const key of Object.keys(patch)) {
      if (JSON.stringify(patch[key]) === JSON.stringify(span.entry[key])) continue
      const range = span.fields[key]
      const replacement = Buffer.from(replacements[key])
      if (!replacement.equals(doc.bytes.subarray(range.byteStart,range.byteEnd))) changes.push({...range,replacement,entryId:span.entryId})
    }
  }
  changes.sort((a,b)=>a.byteStart-b.byteStart)
  if (changes.some((change,i)=>i && change.byteStart < changes[i-1].byteEnd)) return refuse('READ_ONLY_FORMAT','OVERLAPPING_EDITS')
  const result = {...base,...splice(doc.bytes,changes),status:changes.length ? 'READY' : 'NOOP',changes}
  if (result.afterBytes.length > MEMORY_GUARD_LIMITS.maxFileBytes) return refuse('READ_ONLY_FORMAT','DOCUMENT_GUARD_LIMIT')
  const after = parseMemoryDocument(result.afterBytes)
  const expected = doc.entries.filter(entry=>!operations.some(op=>op.type === 'DELETE' && op.entryId === entry.id)).map(entry=>entry.id)
  if (after.issues.length || (expected.length && after.readOnlyReason) || JSON.stringify(after.entries.map(entry=>entry.id)) !== JSON.stringify(expected)) return refuse('READ_ONLY_FORMAT','EDIT_CHANGES_STRUCTURE')
  result.afterSha256 = hash(result.afterBytes)
  plans.set(result,{beforeBytes:Buffer.from(doc.bytes),afterBytes:Buffer.from(result.afterBytes)})
  return result
}

/** Rollback is a candidate only; never discard a later revision to restore old bytes. */
export function planDocumentRollback(plan, currentBytes) {
  const retainedBytes = Buffer.from(currentBytes)
  const snapshot = plans.get(plan)
  if (!snapshot || !retainedBytes.equals(snapshot.afterBytes)) return {status:'CONFLICT',afterBytes:null,retainedBytes,reasons:['POSTIMAGE_CHANGED']}
  return {status:'READY',beforeSha256:hash(retainedBytes),afterBytes:Buffer.from(snapshot.beforeBytes),afterSha256:hash(snapshot.beforeBytes),retainedBytes,reasons:[]}
}
