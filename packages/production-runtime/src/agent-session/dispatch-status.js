/** ASM V2 r5: small metadata-only read of one exact caller-owned dispatch. */
import { failure, unavailable, unresolvable, validateInspectArgs, readOwnedAgentSessionTrace } from './owned-trace-read.js'
import { resolveExactTurn, safeSeq, safeTime } from './exact-turn-resolution.js'
import { visibleText } from './projection-redaction.js'

const ARGUMENT_MAX_BYTES = 2048
const RESULT_MAX_BYTES = 4096
const TERMINAL_KINDS = new Set(['completed', 'aborted', 'blocked', 'error', 'max-tokens', 'interrupted'])
const ABORT_CAUSES = new Set(['user', 'parent', 'hook', 'disposed', 'legacy'])

export function validateDispatchStatusArgs(input) {
  const checked = validateInspectArgs(input)
  if (!checked.ok) return checked
  if (Buffer.byteLength(JSON.stringify(checked.args), 'utf8') > ARGUMENT_MAX_BYTES) {
    return { ok: false, detail: 'status arguments exceed the bounded UTF-8 input budget' }
  }
  return checked
}

export function projectDispatchStatus(input) {
  const resolved = resolveExactTurn(input)
  if (!resolved.ok) return resolved
  const { start, terminal, events } = resolved
  const rawKind = terminal?.record.data.reason.kind
  const kind = TERMINAL_KINDS.has(rawKind) ? rawKind : 'other'
  const rawCause = terminal?.record.data.reason.reason?.kind
  const stopReason = terminal === null ? null : {
    kind,
    abortCause: kind === 'aborted' ? (ABORT_CAUSES.has(rawCause) ? rawCause : 'other') : null,
  }
  const turnState = start === null ? 'accepted_not_started'
    : terminal === null ? 'running' : rawKind === 'completed' ? 'completed' : 'failed'
  let reply = { state: turnState === 'failed' ? 'not_successful' : 'pending', reference: null }
  if (turnState === 'completed') {
    let last = null
    for (let index = start.index + 1; index < terminal.index; index += 1) {
      const event = events[index]
      if (event?.type !== 'assistant/message' || event?.data?.turn !== start.turn) continue
      const seq = safeSeq(event)
      if (seq === null) return unresolvable()
      if (last === null || seq >= last.seq) last = { seq, record: event }
    }
    const available = last !== null && visibleText(last.record.data?.message?.content) !== ''
    reply = { state: available ? 'available' : 'absent', reference: available ? { assistantMessageSeq: last.seq } : null }
  }
  const result = {
    status: 'found',
    targetAgentId: input.targetAgentId,
    sessionId: input.sessionId,
    messageId: input.messageId,
    resolvedTurnId: start?.turn ?? null,
    turnState,
    startedAt: start === null ? null : safeTime(start.record),
    endedAt: terminal === null ? null : safeTime(terminal.record),
    stopReason,
    reply,
  }
  return Buffer.byteLength(JSON.stringify(result), 'utf8') <= RESULT_MAX_BYTES
    ? { ok: true, result } : unavailable()
}

export function readAgentSessionDispatchStatus(deps) {
  const checked = validateDispatchStatusArgs(deps.args)
  if (!checked.ok) return failure('invalid_arguments', checked.detail)
  const loaded = readOwnedAgentSessionTrace({ ...deps, args: checked.args })
  return loaded.ok ? projectDispatchStatus(loaded) : loaded
}
