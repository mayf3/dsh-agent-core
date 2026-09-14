/** Bounded, read-only projection of one caller-owned native Agent turn. */

import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { TextDecoder } from 'node:util'

import { canonicalArguments, redactInspectionText, toolResultText, visibleText } from './projection-redaction.js'
export { redactInspectionText } from './projection-redaction.js'

export const INSPECTION_AUDIT_MAX_BYTES = 8 * 1024 * 1024
export const INSPECTION_SESSION_MAX_BYTES = 8 * 1024 * 1024
export const INSPECTION_SESSION_MAX_RECORDS = 10_000
export const INSPECTION_RECORD_MAX_BYTES = 1024 * 1024
export const INSPECTION_RESPONSE_MAX_BYTES = 1024 * 1024

const TARGET_AGENT_ID_RE = /^agt_[a-z0-9-]+$/
const UTF8 = new TextDecoder('utf-8', { fatal: true })

function failure(code, detail) { return { ok: false, error: { code, detail } } }

function unavailable() { return failure('inspection_unavailable', 'the bounded authoritative inspection surface is unavailable') }

function unresolvable() {
  return failure('trace_unresolvable', 'the retained coordinate cannot be resolved to one exact native turn')
}

function notOwned() {
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

function safeSeq(record) {
  return Number.isSafeInteger(record?.seq) && record.seq >= 0 ? record.seq : null
}

function safeTime(record) {
  return Number.isSafeInteger(record?.time) && record.time >= 0 ? record.time : null
}

function insertedMatches(record, messageId) {
  if (record?.type !== 'agent/inbox/spliced' || !Array.isArray(record.data?.inserted)) return []
  return record.data.inserted.filter((message) => message?.id === messageId)
}

function hasCompetingInsertion(record, messageId) {
  if (record?.type !== 'agent/inbox/spliced' || !Array.isArray(record.data?.inserted)) return false
  return record.data.inserted.some((message) => typeof message?.id === 'string' && message.id !== messageId)
}

function resultShell(coordinate, turn) {
  return {
    status: 'found',
    targetAgentId: coordinate.targetAgentId,
    sessionId: coordinate.sessionId,
    messageId: coordinate.messageId,
    resolvedTurnId: turn.resolvedTurnId,
    turnState: turn.turnState,
    startedAt: turn.startedAt,
    endedAt: turn.endedAt,
    stopReason: turn.stopReason,
    messages: turn.messages,
    toolCalls: turn.toolCalls,
    toolResults: turn.toolResults,
    finalResponse: turn.finalResponse,
    truncated: false,
    originalBytes: 0,
    omittedRecords: [],
  }
}

function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

function recordId(kind, record) {
  if (kind === 'messages') return record.messageId
  return record.callId
}

function omission(kind, record) {
  return {
    kind,
    seq: record.seq,
    id: recordId(kind, record),
    reason: 'record_exceeds_budget',
    redactedBytes: jsonBytes(record),
  }
}

function boundedResult(full) {
  const measurement = { ...full, originalBytes: 0 }
  const originalBytes = jsonBytes(measurement)
  const untruncated = { ...full, originalBytes }
  if (jsonBytes(untruncated) <= INSPECTION_RESPONSE_MAX_BYTES) return untruncated

  const bounded = {
    ...full,
    messages: [],
    toolCalls: [],
    toolResults: [],
    finalResponse: null,
    truncated: true,
    originalBytes,
    omittedRecords: [],
  }
  const candidates = []
  if (full.finalResponse !== null) {
    candidates.push({ kind: 'finalResponse', seq: null, value: full.finalResponse })
  }
  for (const kind of ['messages', 'toolCalls', 'toolResults']) {
    for (const record of full[kind]) candidates.push({ kind, seq: record.seq, value: record })
  }
  const tail = candidates.slice(full.finalResponse === null ? 0 : 1).sort((a, b) => b.seq - a.seq)
  const ordered = full.finalResponse === null ? tail : [candidates[0], ...tail]
  let currentBytes = jsonBytes(bounded)
  for (let index = 0; index < ordered.length; index += 1) {
    const candidate = ordered[index]
    const valueBytes = jsonBytes(candidate.value)
    const delta = candidate.kind === 'finalResponse'
      ? valueBytes - jsonBytes(null)
      : valueBytes + (bounded[candidate.kind].length === 0 ? 0 : 1)
    if (currentBytes + delta <= INSPECTION_RESPONSE_MAX_BYTES) {
      if (candidate.kind === 'finalResponse') bounded.finalResponse = candidate.value
      else bounded[candidate.kind].push(candidate.value)
      currentBytes += delta
      continue
    }
    const omitted = candidate.kind === 'finalResponse'
      ? { kind: 'finalResponse', seq: null, id: null, reason: 'record_exceeds_budget', redactedBytes: jsonBytes(candidate.value) }
      : omission(candidate.kind, candidate.value)
    const omittedDelta = jsonBytes(omitted) + (bounded.omittedRecords.length === 0 ? 0 : 1)
    if (currentBytes + omittedDelta <= INSPECTION_RESPONSE_MAX_BYTES) {
      bounded.omittedRecords.push(omitted)
      currentBytes += omittedDelta
      continue
    }
    const aggregate = { kind: 'remaining', reason: 'metadata_budget', count: ordered.length - index }
    const aggregateDelta = jsonBytes(aggregate) + (bounded.omittedRecords.length === 0 ? 0 : 1)
    if (currentBytes + aggregateDelta > INSPECTION_RESPONSE_MAX_BYTES) return null
    bounded.omittedRecords.push(aggregate)
    currentBytes += aggregateDelta
    break
  }
  for (const kind of ['messages', 'toolCalls', 'toolResults']) bounded[kind].sort((a, b) => a.seq - b.seq)
  return jsonBytes(bounded) <= INSPECTION_RESPONSE_MAX_BYTES ? bounded : null
}

export function projectExactTurn({ records, callerAgentId, targetAgentId, sessionId, messageId, canonicalWorkspace }) {
  if (!Array.isArray(records) || records.length === 0) return unavailable()
  const header = records[0]
  if (header.type !== 'session' || header.id !== sessionId || header.cwd !== canonicalWorkspace) return unavailable()
  const events = records.slice(1)
  const spliceMatches = []
  for (let index = 0; index < events.length; index += 1) {
    for (const message of insertedMatches(events[index], messageId)) spliceMatches.push({ index, record: events[index], message })
  }
  if (spliceMatches.length !== 1) return unresolvable()
  const anchor = spliceMatches[0]
  if (hasCompetingInsertion(anchor.record, messageId)) return unresolvable()
  if (anchor.message?.source?.kind !== 'inter_agent' || anchor.message.source.sourceAgentId !== callerAgentId) return notOwned()

  let start = null
  for (let index = anchor.index + 1; index < events.length; index += 1) {
    const event = events[index]
    if (hasCompetingInsertion(event, messageId)) return unresolvable()
    if (event?.type === 'turn/start') {
      if (!Number.isSafeInteger(event.data?.turn) || event.data.turn < 0) return unresolvable()
      start = { index, record: event, turn: event.data.turn }
      break
    }
  }

  const allUsers = events
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => record?.type === 'user/message' && record.data?.id === messageId)
  if (start === null) {
    if (allUsers.length !== 0) return unresolvable()
    const promptSeq = safeSeq(anchor.record)
    if (promptSeq === null) return unresolvable()
    const full = resultShell({ targetAgentId, sessionId, messageId }, {
      resolvedTurnId: null,
      turnState: 'accepted_not_started',
      startedAt: null,
      endedAt: null,
      stopReason: null,
      messages: [{ seq: promptSeq, role: 'user', messageId, text: visibleText(anchor.message.content) }],
      toolCalls: [],
      toolResults: [],
      finalResponse: null,
    })
    const bounded = boundedResult(full)
    return bounded === null ? unavailable() : { ok: true, result: bounded }
  }
  if (allUsers.length !== 1 || allUsers[0].index <= start.index) return unresolvable()
  const user = allUsers[0]
  for (let index = start.index + 1; index < user.index; index += 1) {
    if (events[index]?.type === 'turn/start' || hasCompetingInsertion(events[index], messageId)) return unresolvable()
  }
  if (user.record.data?.source?.kind !== 'inter_agent' || user.record.data.source.sourceAgentId !== callerAgentId) return notOwned()

  const turn = start.turn
  const userSeq = safeSeq(user.record)
  if (userSeq === null) return unresolvable()
  const messages = [{ seq: userSeq, role: 'user', messageId, text: visibleText(user.record.data.content) }]
  const toolCalls = []
  const toolResults = []
  let endedAt = null
  let stopReason = null
  let endCount = 0
  for (let index = start.index + 1; index < events.length; index += 1) {
    const event = events[index]
    if (event?.data?.turn !== turn) continue
    if (!['assistant/message', 'tool/call', 'tool/result', 'turn/end'].includes(event.type)) continue
    const seq = safeSeq(event)
    if (seq === null) return unresolvable()
    if (event.type === 'assistant/message') {
      messages.push({ seq, role: 'assistant', messageId: null, text: visibleText(event.data?.message?.content) })
    } else if (event.type === 'tool/call') {
      if (typeof event.data?.callId !== 'string' || event.data.callId === ''
        || typeof event.data?.name !== 'string' || event.data.name === '') return unresolvable()
      toolCalls.push({
        seq,
        callId: redactInspectionText(event.data.callId),
        name: redactInspectionText(event.data.name),
        argumentsJson: canonicalArguments(event.data.arguments),
      })
    } else if (event.type === 'tool/result') {
      const resultBlock = Array.isArray(event.data?.message?.content)
        ? event.data.message.content.find((block) => block?.type === 'tool-result')
        : undefined
      const callId = resultBlock?.toolCallId ?? event.data?.message?.source?.callId
      if (typeof callId !== 'string' || callId === '' || typeof resultBlock?.isError !== 'boolean') return unresolvable()
      toolResults.push({ seq, callId: redactInspectionText(callId), text: toolResultText(event.data.message.content), isError: resultBlock.isError })
    } else if (event.type === 'turn/end') {
      endCount += 1
      endedAt = safeTime(event)
      if (endedAt === null || typeof event.data?.reason?.kind !== 'string' || event.data.reason.kind === '') return unresolvable()
      stopReason = redactInspectionText(event.data.reason.kind)
      // The exact projection ends at this native terminal boundary. Events
      // appended for later turns (or any corrupt late reuse of the turn
      // number) are outside this dispatch and are never inspected.
      break
    }
  }
  if (endCount > 1) return unresolvable()
  messages.sort((a, b) => a.seq - b.seq)
  toolCalls.sort((a, b) => a.seq - b.seq)
  toolResults.sort((a, b) => a.seq - b.seq)
  const assistant = messages.filter((message) => message.role === 'assistant')
  const full = resultShell({ targetAgentId, sessionId, messageId }, {
    resolvedTurnId: turn,
    turnState: endCount === 0 ? 'running' : stopReason === 'completed' ? 'completed' : 'failed',
    startedAt: safeTime(start.record),
    endedAt,
    stopReason,
    messages,
    toolCalls,
    toolResults,
    finalResponse: assistant.length === 0 ? null : assistant.at(-1).text,
  })
  if (full.startedAt === null) return unresolvable()
  const bounded = boundedResult(full)
  return bounded === null ? unavailable() : { ok: true, result: bounded }
}

/** Complete read-only seam; Broker authorization precedes ownership proof. */
export function inspectAgentSessionTurn({
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
  return projectExactTurn({ records, callerAgentId, ...coordinate, canonicalWorkspace })
}
