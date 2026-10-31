/** #1248 M1: explicit file-first, read-only history. No index or filesystem writes. */
import { constants } from 'node:fs'
import { open, lstat, realpath } from 'node:fs/promises'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { performance } from 'node:perf_hooks'
import { parseMemoryDocument } from './inspect.js'

const MiB = 1024 * 1024
const MAX_SOURCE_BYTES = 32 * MiB
const MANIFEST = 'memory/history-manifest.json'
const ARCHIVE = 'MEMORY.md.bloated-20261022'
const CURSOR_KEY = randomBytes(32) // process-local capability; no durable state
const hash = value => createHash('sha256').update(value).digest('hex')
const same = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs
const fixedReason = e => ({ENOENT:'MISSING',EACCES:'REFUSED',EPERM:'REFUSED',ELOOP:'SYMLINK_REFUSED',ENOTDIR:'SOURCE_REFUSED'})[e?.code] ?? 'SOURCE_UNAVAILABLE'
const inside = (root, target) => { const rel = relative(root, target); return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)) }

/** Open fixed relative sources without following members, then verify every identity.
 * The workspace itself inherits the trusted resolver's legal root mapping.
 * A pre-open lstat/fstat comparison prevents swapped intermediate dirs from
 * changing the opened file before any content is read; postchecks reject drift.
 */
export async function readVerifiedSource(binding, relativePath, {maxBytes = MAX_SOURCE_BYTES, deadline = Infinity} = {}) {
  let handle
  let size = null
  let cutoff = 0
  const failure = reason => ({status:reason === 'MISSING' ? 'MISSING' : reason === 'STALE' ? 'STALE' : 'PARTIAL',bytes:null,sha256:null,size,reason,cutoff})
  if (typeof relativePath !== 'string' || isAbsolute(relativePath) || relativePath.split(/[\\/]/).some(p=>!p || p === '.' || p === '..')) return failure('SOURCE_REFUSED')
  try {
    if (!binding?.workspace || !isAbsolute(binding.workspace)) return failure('BINDING_REFUSED')
    const root = await realpath(binding.workspace)
    if (binding.realWorkspace && binding.realWorkspace !== root) return failure('STALE')
    const rootInfo = await lstat(root)
    if (binding.rootIdentity && (String(rootInfo.dev) !== binding.rootIdentity.dev || String(rootInfo.ino) !== binding.rootIdentity.ino)) return failure('STALE')
    const parts = relativePath.split('/')
    const dirs = []
    let dir = root
    for (const p of parts.slice(0,-1)) {
      dir = join(dir,p)
      const info = await lstat(dir)
      if (!info.isDirectory() || info.isSymbolicLink()) return failure('SYMLINK_REFUSED')
      dirs.push([dir,info])
    }
    const path = join(root,...parts)
    const before = await lstat(path)
    size = before.size
    if (!before.isFile() || before.isSymbolicLink()) return failure('SOURCE_REFUSED')
    if (size > MAX_SOURCE_BYTES) return failure('SOURCE_TOO_LARGE')
    if (size > maxBytes) return failure('SOURCE_VERIFICATION_BUDGET')
    if (performance.now() >= deadline) return failure('TIME_BUDGET')
    handle = await open(path,constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    if (!same(before,await handle.stat()) || !inside(root,await realpath(path))) return failure('STALE')
    for (const [p,info] of dirs) if (!same(info,await lstat(p))) return failure('STALE')
    const digest = createHash('sha256')
    const chunks = []
    while (cutoff < size) {
      if (performance.now() >= deadline) return failure('TIME_BUDGET')
      const buffer = Buffer.allocUnsafe(Math.min(65536,size-cutoff))
      const {bytesRead} = await handle.read(buffer,0,buffer.length,cutoff)
      if (!bytesRead) return failure('STALE')
      const bytes = buffer.subarray(0,bytesRead)
      chunks.push(bytes);digest.update(bytes);cutoff += bytesRead
      if (!same(before,await handle.stat())) return failure('STALE')
    }
    if (!same(before,await handle.stat()) || !same(before,await lstat(path)) || root !== await realpath(binding.workspace)) return failure('STALE')
    for (const [p,info] of dirs) if (!same(info,await lstat(p))) return failure('STALE')
    const rootAfter = await lstat(root)
    if (rootAfter.dev !== rootInfo.dev || rootAfter.ino !== rootInfo.ino) return failure('STALE')
    return {status:'COMPLETE',bytes:Buffer.concat(chunks,size),sha256:digest.digest('hex'),size,cutoff,reason:null}
  } catch (e) { return failure(fixedReason(e)) }
  finally { await handle?.close().catch(()=>{}) }
}

/** Maintainer-reviewed metadata only. Query arguments can never supply paths. */
export async function readHistoryManifest(binding) {
  const source = await readVerifiedSource(binding,MANIFEST,{maxBytes:65536})
  if (source.status === 'MISSING') return {status:'COMPLETE',digest:null,archives:[],tombstones:[],enabled:false,reason:null}
  const refuse = reason => ({status:'REFUSED',digest:source.sha256,archives:[],tombstones:[],enabled:false,reason})
  if (source.status !== 'COMPLETE') return refuse(source.reason)
  try {
    const doc = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(source.bytes))
    if (!doc || doc.schema !== 'AGENT_MEMORY_HISTORY_MANIFEST_V1' || Object.keys(doc).some(k=>!['schema','archives','tombstones'].includes(k)) || !Array.isArray(doc.archives) || doc.archives.length > 1) return refuse('MANIFEST_INVALID')
    for (const a of doc.archives) {
      if (!a || Object.keys(a).some(k=>!['relativePath','sha256','bytes'].includes(k)) || a.relativePath !== ARCHIVE || !/^[a-f0-9]{64}$/.test(a.sha256) || !Number.isSafeInteger(a.bytes) || a.bytes < 0) return refuse('MANIFEST_INVALID')
    }
    const tombstones = doc.tombstones ?? []
    if (!Array.isArray(tombstones) || tombstones.length > 128) return refuse('MANIFEST_INVALID')
    for (const t of tombstones) if (!t || Object.keys(t).some(k=>!['relativePath','sourceSha256','byteStart','byteEnd'].includes(k)) || !validTombstonePath(t.relativePath) || !/^[a-f0-9]{64}$/.test(t.sourceSha256) || !Number.isSafeInteger(t.byteStart) || !Number.isSafeInteger(t.byteEnd) || t.byteStart < 0 || t.byteEnd <= t.byteStart) return refuse('MANIFEST_INVALID')
    return {status:'COMPLETE',digest:source.sha256,archives:doc.archives,tombstones,enabled:true,reason:null}
  } catch { return refuse('MANIFEST_INVALID') }
}

function validTombstonePath(path) {
  return path === 'MEMORY.md' || path === ARCHIVE || (typeof path === 'string' && /^memory\/\d{4}-\d{2}-\d{2}\.md$/.test(path) && validDate(path.slice(7,-3)))
}

export function validDate(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const date = new Date(`${day}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === day
}
function normalizeArgs(args, today) {
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(k=>!['query','sources','fromDate','toDate','limit','scanBudget','cursor'].includes(k))) return null
  const {query} = args
  if (typeof query !== 'string' || !query.trim() || query.length > 256) return null
  const sources = args.sources ?? ['core','daily','archive']
  if (!Array.isArray(sources) || !sources.length || sources.length > 3 || new Set(sources).size !== sources.length || sources.some(s=>!['core','daily','archive'].includes(s))) return null
  const toDate = args.toDate ?? today
  if (!validDate(toDate)) return null
  const end = Date.parse(`${toDate}T00:00:00Z`)
  const fromDate = args.fromDate ?? new Date(end-6*86400000).toISOString().slice(0,10)
  if (!validDate(fromDate)) return null
  const days = (end-Date.parse(`${fromDate}T00:00:00Z`))/86400000+1
  if (days < 1 || days > 366) return null
  const limit = args.limit ?? 10
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || !['default','extended'].includes(args.scanBudget ?? 'default') || (args.cursor !== undefined && (typeof args.cursor !== 'string' || args.cursor.length > 65536))) return null
  return {query,sources:['core','daily','archive'].filter(s=>sources.includes(s)),fromDate,toDate,days,limit,scanBudget:args.scanBudget ?? 'default'}
}
const idFor = source => hash(`${source.kind}:${source.relativePath}`).slice(0,24)
function planSources(query, manifest) {
  const out = []
  if (query.sources.includes('core')) out.push({kind:'core',relativePath:'MEMORY.md'})
  if (query.sources.includes('daily')) for (let i=0;i<query.days;i++) {
    const date = new Date(Date.parse(`${query.toDate}T00:00:00Z`)-i*86400000).toISOString().slice(0,10)
    out.push({kind:'daily',relativePath:`memory/${date}.md`,date})
  }
  if (query.sources.includes('archive')) for (const a of manifest.archives) out.push({kind:'archive',...a})
  return out.map(s=>({...s,id:idFor(s)}))
}
function encodeCursor(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${data}.${createHmac('sha256',CURSOR_KEY).update(data).digest('base64url')}`
}
function decodeCursor(token) {
  try {
    const [data,signature,...extra] = token.split('.')
    const expected = createHmac('sha256',CURSOR_KEY).update(data).digest()
    const received = Buffer.from(signature,'base64url')
    if (extra.length || received.length !== expected.length || !timingSafeEqual(received,expected)) return null
    return JSON.parse(Buffer.from(data,'base64url').toString('utf8'))
  } catch { return null }
}
function redact(text) {
  return text.replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*["']?[^\s"']{8,}|Bearer\s+[A-Za-z0-9._-]{16,})/gi,'[REDACTED]')
}
/** Source offsets always address original bytes, including redacted excerpts. */
function* matches(source, snapshot, query, tombstones, deadline) {
  const check=()=>{if(performance.now()>=deadline) throw Object.assign(new Error('TIME_BUDGET'),{code:'TIME_BUDGET'})}
  check()
  // UTF-8 is validated for the complete hash-bound snapshot before any item.
  new TextDecoder('utf-8',{fatal:true}).decode(snapshot.bytes)
  const doc=parseMemoryDocument(snapshot.bytes,{deadline})
  const spans=[...(doc.spans ?? []),...(doc.preservedSpans ?? [])].sort((a,b)=>a.byteStart-b.byteStart)
  const needle=query.toLowerCase()
  let line=1
  for(const span of spans) {
    check()
    const piece=snapshot.bytes.subarray(span.byteStart,span.byteEnd).toString('utf8')
    const entry=span.entryId ?? span.entry?.id ?? null
    const paragraphs=entry ? [{index:0,0:piece}] : piece.matchAll(/[^\r\n]+(?:\r?\n(?!\r?\n)[^\r\n]+)*/g)
    let previousChar=0,byteOffset=span.byteStart,spanLine=line
    for(const match of paragraphs) {
      check()
      const gap=piece.slice(previousChar,match.index)
      byteOffset+=Buffer.byteLength(gap)
      spanLine+=(gap.match(/\n/g)?.length ?? 0)
      const byteStart=byteOffset,byteEnd=byteStart+Buffer.byteLength(match[0])
      const lineStart=spanLine
      byteOffset=byteEnd
      previousChar=match.index+match[0].length
      const newlines=match[0].match(/\n/g)?.length ?? 0
      spanLine+=newlines
      const found=match[0].toLowerCase().indexOf(needle)
      if(found<0 || tombstones.some(t=>t.relativePath===source.relativePath && t.sourceSha256===snapshot.sha256 && byteStart<t.byteEnd && byteEnd>t.byteStart)) continue
      const start=Math.max(0,found-200)
      const excerpt=redact(match[0].slice(start,start+800))
      yield {sourceId:source.id,sourceKind:source.kind,sourceSha256:snapshot.sha256,sourceBytes:snapshot.size,relativePath:source.relativePath,byteStart,byteEnd,lineStart,lineEnd:lineStart+newlines-(match[0].endsWith('\n')?1:0),entryId:entry,eventTime:source.date?`${source.date}T00:00:00Z`:null,excerpt,excerptTruncated:start>0||start+800<match[0].length,matchKind:excerpt.includes('[REDACTED]')?'REDACTED':entry?'entry':'paragraph'}
    }
    line+=(piece.match(/\n/g)?.length ?? 0)
  }
  check()
}

/** Each request re-verifies full source snapshots. No retained corpus cache. */
export function createHistorySearch({binding,now = ()=>new Date(),onCoverage} = {}) {
  return async function search(args) {
    const query = normalizeArgs(args,now().toISOString().slice(0,10))
    const result = {schema:'AGENT_MEMORY_HISTORY_SEARCH_V1',status:'REFUSED',scope:{sources:query?.sources ?? [],dateRange:query ? {fromDate:query.fromDate,toDate:query.toDate} : null,workspaceKey:binding?.workspaceKey ?? null},corpusManifestDigest:null,coverage:{filesPlanned:0,filesVerified:0,bytesRead:0,searchedSources:[],unsearchedSources:[],retainedEvidence:[],reasons:[]},items:[],nextCursor:null,exhausted:false}
    let plannedSources=[]
    const finish = reason => {
      for (const source of plannedSources) if (!result.coverage.searchedSources.some(s=>s.sourceId === source.id) && !result.coverage.unsearchedSources.some(s=>s.sourceId === source.id)) result.coverage.unsearchedSources.push({sourceId:source.id,relativePath:source.relativePath,cutoff:0,reason:'NOT_REACHED'})
      if(reason)result.coverage.reasons.push(reason);onCoverage?.({...result.coverage,observedAt:now().toISOString()});return result}
    if (!query) return finish('INVALID_ARGUMENTS')
    if (!binding?.workspace || binding.status === 'REFUSED' || binding.equality === false || binding.equality === 'WORKSPACE_MISMATCH') return finish('WORKSPACE_MISMATCH')
    const manifest = await readHistoryManifest(binding)
    result.corpusManifestDigest = manifest.digest
    if (manifest.status !== 'COMPLETE') return finish(manifest.reason)
    result.coverage.retainedEvidence = manifest.tombstones.map(t=>({relativePath:t.relativePath,sourceSha256:t.sourceSha256,byteStart:t.byteStart,byteEnd:t.byteEnd,disposition:'EXCLUDED_RETAINED'}))
    const sources = planSources(query,manifest)
    plannedSources=sources
    result.coverage.filesPlanned = sources.length
    const {scanBudget:_budget,limit:_limit,...boundQuery}=query
    const scopeHash = hash(JSON.stringify({schema:result.schema,workspaceKey:binding.workspaceKey,query:boundQuery}))
    let cursor
    if (args.cursor) {
      cursor = decodeCursor(args.cursor)
      if (!cursor || cursor.schema !== result.schema || cursor.scopeHash !== scopeHash) return finish('CURSOR_INVALID_OR_EXPIRED')
      if (cursor.manifest !== manifest.digest) {result.status='STALE';return finish('MANIFEST_CHANGED')}
    }
    const budget = query.scanBudget === 'extended' ? {bytes:64*MiB,files:256,ms:5000} : {bytes:8*MiB,files:32,ms:1000}
    const deadline = performance.now()+budget.ms
    const verified = new Map()
    const versions = new Map(cursor?.versions ?? [])
    let filesRead = 0
    let stopIndex = cursor?.fileIndex ?? 0
    let offset = cursor?.itemOffset ?? 0
    let blocked = false
    const read = async source => {
      if (verified.has(source.id)) return verified.get(source.id)
      if (filesRead >= budget.files || performance.now() >= deadline) return {status:'PARTIAL',reason:filesRead >= budget.files ? 'FILE_BUDGET' : 'TIME_BUDGET',size:null,cutoff:0}
      const snap = await readVerifiedSource(binding,source.relativePath,{maxBytes:budget.bytes-result.coverage.bytesRead,deadline})
      result.coverage.bytesRead += snap.cutoff ?? 0
      filesRead++
      if (snap.status === 'COMPLETE' || snap.status === 'MISSING') {
        verified.set(source.id,snap)
        result.coverage.filesVerified++
        result.coverage.searchedSources.push({sourceId:source.id,relativePath:source.relativePath,sourceSha256:snap.sha256,bytes:snap.size,cutoff:snap.cutoff,status:snap.status})
      }
      return snap
    }
    // A continuation can never mix previously returned facts with new bytes.
    for (const [id,sha256] of versions) {
      const source = sources.find(s=>s.id === id)
      if (!source) {result.status='STALE';return finish('SOURCE_CHANGED')}
      const snap = await read(source)
      if (snap.status !== 'COMPLETE' && snap.status !== 'MISSING') {result.status=snap.reason === 'SOURCE_VERIFICATION_BUDGET' ? 'PARTIAL' : 'STALE';return finish(snap.reason)}
      if (snap.sha256 !== sha256) {result.status='STALE';return finish('SOURCE_CHANGED')}
    }
    result.status = 'COMPLETE'
    let totalChars = 0
    for (let i=stopIndex;i<sources.length;i++) {
      stopIndex=i
      const source=sources[i]
      const snap=await read(source)
      if (snap.status !== 'COMPLETE' && snap.status !== 'MISSING') {
        result.status=snap.status === 'STALE' ? 'STALE' : 'PARTIAL';blocked=true
        result.coverage.unsearchedSources.push({sourceId:source.id,relativePath:source.relativePath,bytes:snap.size,cutoff:snap.cutoff,reason:snap.reason})
        for (const rest of sources.slice(i+1)) result.coverage.unsearchedSources.push({sourceId:rest.id,relativePath:rest.relativePath,cutoff:0,reason:'NOT_REACHED'})
        break
      }
      versions.set(source.id,snap.sha256)
      if (snap.status === 'MISSING') {stopIndex=i+1;offset=0;continue}
      if (source.kind === 'archive' && (snap.sha256 !== source.sha256 || snap.size !== source.bytes)) {result.status='STALE';blocked=true;result.coverage.reasons.push('ARCHIVE_CHANGED');break}
      if (manifest.tombstones.some(t=>t.relativePath === source.relativePath && t.sourceSha256 !== snap.sha256)) {
        result.status='PARTIAL'
        blocked=true
        result.coverage.unsearchedSources.push({sourceId:source.id,relativePath:source.relativePath,cutoff:0,reason:'TOMBSTONE_SOURCE_CHANGED'})
        continue
      }
      let n=0
      try {
        for (const item of matches(source,snap,query.query,manifest.tombstones,deadline)) {
          if (n++ < offset) continue
          if (result.items.length >= query.limit || totalChars+item.excerpt.length > 12000) {
            offset=n-1
            result.status='PARTIAL'
            result.coverage.reasons.push(result.items.length >= query.limit ? 'RESULT_LIMIT' : 'EXCERPT_BUDGET')
            result.coverage.unsearchedSources.push({sourceId:source.id,relativePath:source.relativePath,cutoff:snap.size,resultOffset:offset,reason:'RESULT_PAGE_REMAINS'})
            for (const rest of sources.slice(i+1)) result.coverage.unsearchedSources.push({sourceId:rest.id,relativePath:rest.relativePath,cutoff:0,reason:'NOT_REACHED'})
            result.nextCursor=encodeCursor({schema:result.schema,scopeHash,manifest:manifest.digest,fileIndex:i,itemOffset:offset,versions:[...versions]})
            return finish()
          }
          result.items.push(item);totalChars+=item.excerpt.length
          if (performance.now() >= deadline) {result.status='PARTIAL';offset=n;result.nextCursor=encodeCursor({schema:result.schema,scopeHash,manifest:manifest.digest,fileIndex:i,itemOffset:offset,versions:[...versions]});return finish('TIME_BUDGET')}
        }
      } catch (error) {result.status='PARTIAL';blocked=true;result.coverage.unsearchedSources.push({sourceId:source.id,relativePath:source.relativePath,cutoff:snap.size,reason:error?.code==='TIME_BUDGET'?'TIME_BUDGET':'INVALID_UTF8'});break}
      stopIndex=i+1;offset=0
      if (performance.now() >= deadline) {result.status='PARTIAL';blocked=true;result.coverage.reasons.push('TIME_BUDGET');break}
    }
    if (result.status === 'STALE') result.items=[]
    result.exhausted=!blocked && stopIndex === sources.length
    // An unverified oversized source has no mid-file continuation capability.
    const nonprogress = cursor && stopIndex === cursor.fileIndex && offset === (cursor.itemOffset ?? 0) && blocked
    if (nonprogress) result.coverage.reasons.push('CONTINUATION_REVALIDATION_BUDGET')
    const tombstoneBlocked=result.coverage.unsearchedSources.some(s=>s.reason === 'TOMBSTONE_SOURCE_CHANGED')
    if (!tombstoneBlocked && !nonprogress && blocked && result.status === 'PARTIAL' && result.coverage.unsearchedSources[0]?.reason !== 'SOURCE_VERIFICATION_BUDGET' && result.coverage.unsearchedSources[0]?.reason !== 'SOURCE_TOO_LARGE') {
      result.nextCursor=encodeCursor({schema:result.schema,scopeHash,manifest:manifest.digest,fileIndex:stopIndex,itemOffset:0,versions:[...versions]})
    }
    return finish()
  }
}
