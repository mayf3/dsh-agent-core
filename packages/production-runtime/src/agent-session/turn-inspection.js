/** Bounded, read-only full projection of one caller-owned native Agent turn. */
import { canonicalArguments, redactInspectionText, toolResultText, visibleText } from './projection-redaction.js'
import { unavailable, unresolvable, readOwnedAgentSessionTrace } from './owned-trace-read.js'
import { resolveExactTurn, safeSeq, safeTime } from './exact-turn-resolution.js'
export { redactInspectionText } from './projection-redaction.js'
export {
  INSPECTION_AUDIT_MAX_BYTES, INSPECTION_SESSION_MAX_BYTES, INSPECTION_SESSION_MAX_RECORDS,
  INSPECTION_RECORD_MAX_BYTES, encodeSessionSegment, sessionProjectKey, locateSessionArtifact,
  scanAuditEligibility, validateInspectArgs,
} from './owned-trace-read.js'
export const INSPECTION_RESPONSE_MAX_BYTES = 1024 * 1024

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

export function projectExactTurn(input) {
  const resolved = resolveExactTurn(input)
  if (!resolved.ok) return resolved
  const { targetAgentId, sessionId, messageId } = input
  const { anchor, start, user, events } = resolved
  if (start === null) {
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
export function inspectAgentSessionTurn(deps) {
  const loaded = readOwnedAgentSessionTrace(deps)
  return loaded.ok ? projectExactTurn(loaded) : loaded
}
