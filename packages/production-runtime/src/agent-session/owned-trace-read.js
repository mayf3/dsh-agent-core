/** Shared caller-owned audit eligibility and bounded canonical Session read. */

import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { TextDecoder } from 'node:util'

export const INSPECTION_AUDIT_MAX_BYTES = 8 * 1024 * 1024
export const INSPECTION_SESSION_MAX_BYTES = 8 * 1024 * 1024
export const INSPECTION_SESSION_MAX_RECORDS = 10_000
export const INSPECTION_RECORD_MAX_BYTES = 1024 * 1024

const TARGET_AGENT_ID_RE = /^agt_[a-z0-9-]+$/
const UTF8 = new TextDecoder('utf-8', { fatal: true })

export function failure(code, detail) { return { ok: false, error: { code, detail } } }

export function unavailable() { return failure('inspection_unavailable', 'the bounded authoritative inspection surface is unavailable') }

export function unresolvable() {
  return failure('trace_unresolvable', 'the retained coordinate cannot be resolved to one exact native turn')
}

export function notOwned() {
  return failure('not_found_or_not_owned', 'the trace coordinate was not found or is not owned by the caller')
}

export function validateInspectArgs(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, detail: 'arguments must be an object with exactly targetAgentId, sessionId, messageId' }
  }
  const expected = ['targetAgentId', 'sessionId', 'messageId']
  const keys = Object.keys(input)
  if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) {
    return { ok: false, detail: 'arguments must contain exactly targetAgentId, sessionId, messageId' }
  }
  const { targetAgentId, sessionId, messageId } = input
  if (typeof targetAgentId !== 'string' || targetAgentId.length < 5
    || targetAgentId.length > 128 || !TARGET_AGENT_ID_RE.test(targetAgentId)) {
    return { ok: false, detail: 'targetAgentId must match ^agt_[a-z0-9-]+$ (5..128 chars)' }
  }
  for (const [name, value] of [['sessionId', sessionId], ['messageId', messageId]]) {
    if (typeof value !== 'string' || value === '') return { ok: false, detail: `${name} must be a non-empty opaque string` }
  }
  return { ok: true, args: { targetAgentId, sessionId, messageId } }
}

export function encodeSessionSegment(raw) {
  if (typeof raw !== 'string' || raw === '') throw new TypeError('session id must be non-empty')
  if (raw === '.') return '~002E'
  if (raw === '..') return '~002E~002E'
  let out = ''
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i)
    const ch = String.fromCharCode(code)
    out += ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)
      ? ch
      : `~${code.toString(16).toUpperCase().padStart(4, '0')}`
  }
  return out
}

export function sessionProjectKey(cwd) {
  if (typeof cwd !== 'string' || cwd === '') throw new TypeError('canonical workspace must be non-empty')
  let readable = ''
  let separatorRun = false
  for (let i = 0; i < cwd.length; i += 1) {
    const code = cwd.charCodeAt(i)
    const ch = String.fromCharCode(code)
    if (ch === '/' || ch === '\\' || ch === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
      readable += ch
      separatorRun = false
    } else {
      readable += `~${code.toString(16).toUpperCase().padStart(4, '0')}`
      separatorRun = false
    }
  }
  const slug = readable.replace(/^-+/, '') || 'root'
  return `--${slug.slice(0, 251)}--`
}

export function locateSessionArtifact({ dshHome, canonicalWorkspace, sessionId }) {
  if (!isAbsolute(dshHome) || !isAbsolute(canonicalWorkspace)) {
    throw new TypeError('trusted DSH home and canonical workspace must be absolute')
  }
  const sessionsRoot = resolve(dshHome, 'sessions')
  const artifact = join(sessionsRoot, sessionProjectKey(canonicalWorkspace), encodeSessionSegment(sessionId), 'session.jsonl')
  if (artifact !== sessionsRoot && !artifact.startsWith(`${sessionsRoot}/`)) {
    throw new TypeError('derived session artifact escaped the trusted sessions root')
  }
  return artifact
}

function defaultIo() {
  return {
    existsSync,
    statSync,
    readFileBoundedSync(path, maxBytes) {
      const fd = openSync(path, 'r')
      try {
        const buffer = Buffer.allocUnsafe(maxBytes + 1)
        let offset = 0
        while (offset < buffer.length) {
          const read = readSync(fd, buffer, offset, buffer.length - offset, null)
          if (read === 0) break
          offset += read
        }
        return buffer.subarray(0, offset)
      } finally {
        closeSync(fd)
      }
    },
  }
}

function readBounded(io, path, maxBytes) {
  if (!io.existsSync(path)) return { absent: true, buffer: Buffer.alloc(0) }
  const before = io.statSync(path)
  const size = Number(before.size)
  if ((typeof before.isFile === 'function' && !before.isFile())
    || !Number.isSafeInteger(size) || size < 0 || size > maxBytes) throw new Error('bounded file size exceeded')
  const raw = typeof io.readFileBoundedSync === 'function'
    ? io.readFileBoundedSync(path, maxBytes)
    : io.readFileSync(path)
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
  const after = io.statSync(path)
  if (buffer.byteLength !== size || buffer.byteLength > maxBytes
    || Number(after.size) !== size
    || (before.ino !== undefined && after.ino !== before.ino)
    || (before.mtimeMs !== undefined && after.mtimeMs !== before.mtimeMs)) {
    throw new Error('bounded file changed during read')
  }
  return { absent: false, buffer }
}

function parseJsonl(buffer, { maxRecords = Number.MAX_SAFE_INTEGER, maxRecordBytes = Number.MAX_SAFE_INTEGER } = {}) {
  if (buffer.byteLength === 0) return []
  let text
  try { text = UTF8.decode(buffer) } catch { throw new Error('invalid UTF-8') }
  if (!text.endsWith('\n')) throw new Error('incomplete JSONL record')
  const lines = text.slice(0, -1).split('\n')
  if (lines.length > maxRecords) throw new Error('record cap exceeded')
  const records = []
  for (const line of lines) {
    if (line === '' || Buffer.byteLength(line, 'utf8') > maxRecordBytes) throw new Error('invalid or oversized record')
    let record
    try { record = JSON.parse(line) } catch { throw new Error('malformed JSONL record') }
    if (record === null || typeof record !== 'object' || Array.isArray(record)) throw new Error('record must be an object')
    records.push(record)
  }
  return records
}

/**
 * Scan `.1` then live fully. Repeated outcome rows for one requestId count as
 * one dispatch; two distinct requestIds claiming one coordinate fail closed.
 */
export function scanAuditEligibility({ auditFile, callerAgentId, targetAgentId, sessionId, messageId, io = defaultIo() }) {
  const matchingRequests = new Set()
  try {
    for (const path of [`${auditFile}.1`, auditFile]) {
      const { buffer } = readBounded(io, path, INSPECTION_AUDIT_MAX_BYTES)
      for (const row of parseJsonl(buffer)) {
        if (row.kind !== 'agent_session_send' || row.phase !== 'outcome') continue
        if (row.targetAgentId !== targetAgentId || row.sessionId !== sessionId || row.messageId !== messageId) continue
        if (row.sourceAgentId !== callerAgentId || typeof row.requestId !== 'string' || row.requestId === '') continue
        matchingRequests.add(row.requestId)
      }
    }
  } catch {
    return { status: 'unavailable' }
  }
  return matchingRequests.size === 1 ? { status: 'eligible' } : { status: 'not_found_or_not_owned' }
}

export function readOwnedAgentSessionTrace({
  args,
  callerAgentId,
  auditFile,
  resolveTarget,
  resolveDshHome,
  resolveCanonicalWorkspace,
  io = defaultIo(),
}) {
  const checked = validateInspectArgs(args)
  if (!checked.ok) return failure('invalid_arguments', checked.detail)
  if (typeof callerAgentId !== 'string' || !/^agt_[A-Za-z0-9_-]+$/.test(callerAgentId)) {
    return failure('internal_error', 'trusted caller identity is unavailable')
  }
  if (typeof auditFile !== 'string' || auditFile === '') return failure('internal_error', 'trusted audit path is unavailable')
  const coordinate = checked.args
  const eligibility = scanAuditEligibility({ auditFile, callerAgentId, ...coordinate, io })
  if (eligibility.status === 'unavailable') return unavailable()
  if (eligibility.status !== 'eligible') return notOwned()

  let canonicalWorkspace
  let dshHome
  let artifact
  try {
    const target = resolveTarget(coordinate.targetAgentId)
    if (target?.id !== coordinate.targetAgentId) return unavailable()
    canonicalWorkspace = resolveCanonicalWorkspace(coordinate.targetAgentId)
    dshHome = resolveDshHome(coordinate.targetAgentId)
    artifact = locateSessionArtifact({ dshHome, canonicalWorkspace, sessionId: coordinate.sessionId })
  } catch {
    return unavailable()
  }
  let records
  try {
    const selected = readBounded(io, artifact, INSPECTION_SESSION_MAX_BYTES)
    if (selected.absent) return unavailable()
    records = parseJsonl(selected.buffer, {
      maxRecords: INSPECTION_SESSION_MAX_RECORDS,
      maxRecordBytes: INSPECTION_RECORD_MAX_BYTES,
    })
  } catch {
    return unavailable()
  }
  return { ok: true, records, callerAgentId, ...coordinate, canonicalWorkspace }
}
