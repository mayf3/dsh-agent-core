/**
 * @agent-core/execution-history/src/loaders/session-journal.js — DSH session
 * journal loader: `<homesRoot>/<agentId>/sessions/<projectKey>/<sessionId>/session.jsonl`.
 * Layout matches session-history/locator + turn-inspection; parsing is
 * tolerant (a bad line degrades, never fails). Content stays in the loader
 * output; redaction happens at projection time (redact.js), never here.
 */

import { join } from 'node:path'
import { readdirSync, statSync, existsSync, openSync, readSync, closeSync } from 'node:fs'

export const SESSION_FILE_NAME = 'session.jsonl'

/** List the session files of one agent home (newest first). */
export function listAgentSessionFiles(homesRoot, agentId) {
  const sessionsRoot = join(homesRoot, agentId, 'sessions')
  let projectDirs = []
  try { projectDirs = readdirSync(sessionsRoot, { withFileTypes: true }) } catch { return [] }
  const out = []
  for (const proj of projectDirs) {
    if (!proj.isDirectory()) continue
    let sessionDirs = []
    try { sessionDirs = readdirSync(join(sessionsRoot, proj.name), { withFileTypes: true }) } catch { continue }
    for (const sd of sessionDirs) {
      if (!sd.isDirectory()) continue
      const file = join(sessionsRoot, proj.name, sd.name, SESSION_FILE_NAME)
      if (!existsSync(file)) continue
      let st
      try { st = statSync(file) } catch { continue }
      out.push({ agentId, projectKey: proj.name, sessionId: sd.name, file, size: Number(st.size), mtimeMs: Number(st.mtimeMs) })
    }
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return out
}

/**
 * Resolve a session: exact dir-name match, else header-id match (newest wins).
 * The DSH header id is the native session id (e.g. 'main', 'cron-run-occ:<id>'
 * with ':' dir-encoded as '~'); both spellings are accepted.
 */
export function resolveSessionFile(homesRoot, agentId, sessionId, { maxHeaderScan = 400 } = {}) {
  const candidates = listAgentSessionFiles(homesRoot, agentId)
  const encoded = String(sessionId).replace(/[^A-Za-z0-9._-]/g, '~')
  const byDir = candidates.filter((c) => c.sessionId === sessionId || c.sessionId === encoded)
  if (byDir.length > 0) return byDir[0]
  for (const candidate of candidates.slice(0, maxHeaderScan)) {
    const header = readSessionHeader(candidate.file)
    if (header?.id === sessionId) return candidate
  }
  return null
}

export function readSessionHeader(file) {
  try {
    const fd = openSync(file, 'r')
    try {
      const buffer = Buffer.allocUnsafe(4096)
      const n = readSync(fd, buffer, 0, buffer.length, 0)
      const firstLine = buffer.subarray(0, n).toString('utf8').split('\n')[0]
      const parsed = JSON.parse(firstLine)
      return parsed?.type === 'session' ? parsed : null
    } finally { closeSync(fd) }
  } catch { return null }
}

const EVENT_TYPE_RE = /^[a-z]+[a-z0-9]*([/.][a-z0-9-]+)*$/

/**
 * Load and parse one journal, bounded. Returns events in file order with
 * {lineNo, seq, timeMs, type, data}; oversized/corrupt lines degrade.
 */
export function loadSessionJournal({ file, maxFileBytes = 8 * 1024 * 1024, maxRecords = 10_000, maxRecordBytes = 1024 * 1024 }) {
  let st
  try { st = statSync(file) } catch (error) { return { absent: true, events: [], skipped: 0, truncated: false, size: 0, mtimeMs: 0 } }
  const size = Number(st.size)
  const mtimeMs = Number(st.mtimeMs)
  const scanBytes = Math.min(size, maxFileBytes)
  let truncated = scanBytes < size
  const fd = openSync(file, 'r')
  let text = ''
  try {
    const buffer = Buffer.allocUnsafe(scanBytes)
    let off = 0
    while (off < buffer.length) {
      const n = readSync(fd, buffer, off, buffer.length - off, off)
      if (n === 0) break
      off += n
    }
    text = buffer.subarray(0, off).toString('utf8')
  } finally { closeSync(fd) }
  const events = []
  let skipped = 0
  const rawLines = text.split('\n')
  const complete = text.endsWith('\n') ? rawLines.length - 1 : rawLines.length - 1
  for (let i = 0; i < complete; i += 1) {
    const line = rawLines[i]
    if (line.trim() === '') continue
    if (Buffer.byteLength(line, 'utf8') > maxRecordBytes) { skipped += 1; continue }
    let row
    try {
      row = JSON.parse(line)
      if (row === null || typeof row !== 'object' || Array.isArray(row) || typeof row.type !== 'string' || !EVENT_TYPE_RE.test(row.type)) throw new Error('bad event')
    } catch { skipped += 1; continue }
    if (events.length >= maxRecords) { truncated = true; break }
    events.push({
      lineNo: i + 1,
      seq: Number.isInteger(row.seq) ? row.seq : undefined,
      timeMs: Date.parse(row.time ?? '') || (Number.isFinite(row.ts) ? row.ts : undefined),
      type: row.type,
      data: row.data ?? {},
    })
  }
  return { absent: false, events, skipped, truncated, size, mtimeMs, header: rawLines.length > 0 ? tryHeader(rawLines[0]) : null }
}

function tryHeader(line) {
  try {
    const parsed = JSON.parse(line)
    return parsed?.type === 'session' ? parsed : null
  } catch { return null }
}

/** Parse tool/call arguments and pull the business-coordinate fields (R4). */
export function toolCallCoordinates(name, args) {
  if (typeof args === 'string') {
    try { args = JSON.parse(args) } catch { return {} }
  }
  if (args === null || typeof args !== 'object') return {}
  const out = {}
  for (const key of ['workflowInstanceId', 'transitionDefinitionId', 'expectedWorkflowStateVersion', 'domainId', 'definitionVersionId', 'jobId', 'occurrenceId']) {
    if (args[key] !== undefined) out[key] = args[key]
  }
  if (typeof name === 'string' && name !== '') out.tool = name
  return out
}

/**
 * Project the journal into the coordinate model used by correlate/report.
 * Full message/tool-result text is RETAINED here within the load caps
 * (§4.3 owned sessions get full content up to the turn_inspect-magnitude
 * caps); the FOREIGN reduction to briefs/coordinates happens only in
 * redact.projectForViewer — never in this loader.
 */
export function projectJournal(events, { briefMaxChars = 400 } = {}) {
  const messages = []
  const turns = []
  const toolCalls = []
  const spliced = []
  const workflowCoordinates = []
  let currentTurn = null
  const textOf = (value) => {
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value.map((block) => (typeof block?.text === 'string' ? block.text : '')).join('')
    return ''
  }
  const brief = (value) => {
    const compact = textOf(value).replace(/\s+/g, ' ').trim()
    return compact.length > briefMaxChars ? `${compact.slice(0, briefMaxChars)}…` : compact
  }
  for (const ev of events) {
    if (ev.type === 'agent/inbox/spliced' && typeof ev.data?.messageId === 'string') {
      spliced.push({ seq: ev.seq ?? ev.lineNo, messageId: ev.data.messageId, timeMs: ev.timeMs })
      continue
    }
    if (ev.type === 'user/message') {
      messages.push({
        seq: ev.seq ?? ev.lineNo, role: 'user', timeMs: ev.timeMs,
        messageId: typeof ev.data?.messageId === 'string' ? ev.data.messageId : undefined,
        source: ev.data?.source && typeof ev.data.source === 'object' ? ev.data.source : undefined,
        text: textOf(ev.data?.content),
        brief: brief(ev.data?.content),
      })
      continue
    }
    if (ev.type === 'assistant/message') {
      const text = textOf(ev.data?.message?.content)
      messages.push({ seq: ev.seq ?? ev.lineNo, role: 'assistant', timeMs: ev.timeMs, text, brief: brief(text) })
      continue
    }
    if (ev.type === 'turn/start') {
      currentTurn = { turn: ev.data?.turn ?? turns.length + 1, startSeq: ev.seq ?? ev.lineNo, startTimeMs: ev.timeMs, messageSeqs: [], toolCallSeqs: [], endSeq: null, stopReason: null }
      turns.push(currentTurn)
      continue
    }
    if (ev.type === 'turn/end') {
      if (currentTurn !== null) { currentTurn.endSeq = ev.seq ?? ev.lineNo; currentTurn.endTimeMs = ev.timeMs; currentTurn.stopReason = ev.data?.reason?.kind ?? null }
      currentTurn = null
      continue
    }
    if (ev.type === 'tool/call') {
      const coords = toolCallCoordinates(ev.data?.name, ev.data?.arguments)
      const record = { seq: ev.seq ?? ev.lineNo, turn: ev.data?.turn, callId: ev.data?.callId, name: ev.data?.name, timeMs: ev.timeMs, coordinates: coords }
      toolCalls.push(record)
      if (currentTurn !== null) currentTurn.toolCallSeqs.push(record.seq)
      if (coords.workflowInstanceId) {
        workflowCoordinates.push({ seq: record.seq, kind: 'tool_call', workflowInstanceId: coords.workflowInstanceId, tool: coords.tool, transitionDefinitionId: coords.transitionDefinitionId, expectedWorkflowStateVersion: coords.expectedWorkflowStateVersion })
      }
      continue
    }
    if (ev.type === 'tool/result') {
      const blocks = Array.isArray(ev.data?.message?.content) ? ev.data.message.content : []
      const resultBlock = blocks.find((b) => b?.type === 'tool-result')
      const resultText = textOf(resultBlock?.content ?? resultBlock?.text)
      toolCalls.push({
        seq: ev.seq ?? ev.lineNo, turn: ev.data?.turn, kind: 'result',
        callId: resultBlock?.toolCallId ?? ev.data?.message?.source?.callId,
        isError: resultBlock?.isError,
        timeMs: ev.timeMs,
        resultText,
        resultBrief: brief(resultText),
        coordinates: extractResultCoordinates(resultBlock),
      })
      const coords = extractResultCoordinates(resultBlock)
      if (coords.workflowInstanceId) {
        workflowCoordinates.push({ seq: ev.seq ?? ev.lineNo, kind: 'tool_result', workflowInstanceId: coords.workflowInstanceId, workflowStateVersion: coords.workflowStateVersion })
      }
    }
  }
  return { messages, turns, toolCalls, spliced, workflowCoordinates }
}

function extractResultCoordinates(resultBlock) {
  const out = {}
  let payload = resultBlock?.content ?? resultBlock
  if (typeof payload === 'string') { try { payload = JSON.parse(payload) } catch { return out } }
  if (payload === null || typeof payload !== 'object') return out
  const candidate = payload.result !== undefined ? payload.result : payload
  if (candidate === null || typeof candidate !== 'object') return out
  for (const key of ['workflowInstanceId', 'workflowStateVersion']) {
    if (candidate[key] !== undefined) out[key] = candidate[key]
  }
  return out
}
