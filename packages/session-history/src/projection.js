/**
 * Allowlisted final-text projection (MOBILE_SESSION_HISTORY_V1 CTR-SH-004 /
 * CTR-SH-005 / CTR-SH-011 message ceilings).
 *
 * User: exactly `type = user/message` + `surfaceOp = append` +
 * `data.source.kind = user`; relevant events fail closed on malformed
 * payloads; text-only blocks concatenate in block order; empty text omits the
 * message. Assistant: per-turn grouping on positive safe-integer
 * `data.turn` (missing/unsafe turns drop the event, never fatal); a turn is
 * eligible only with exactly one later `turn/end` whose `reason.kind =
 * completed`; the projected candidate is the highest-seq qualifying (non-empty
 * text) append `assistant/message`; correlated-but-malformed payloads,
 * duplicate terminals and candidates at/after their terminal are committed
 * corruption (INTERNAL_ERROR). Everything else is an ignored internal event.
 */

import { internalError, resourceLimit } from './errors.js'
import {
  MAX_CONTENT_BLOCKS_PER_MESSAGE,
  MAX_PROJECTED_TEXT_BYTES_PER_MESSAGE,
} from './constants.js'

const isPositiveSafeTurn = (value) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && !Object.is(value, -0)

/**
 * Validate every content item shape and concatenate non-empty text blocks in
 * block order. A relevant event's malformed content (non-object item, empty or
 * non-string `type`, `text` next to `type = 'text'` that is not a string) is
 * INTERNAL_ERROR, never a silent exclusion; non-text block types are ignored.
 */
function projectTextBlocks(content) {
  if (content.length > MAX_CONTENT_BLOCKS_PER_MESSAGE) throw resourceLimit()
  let text = ''
  let textBytes = 0
  for (const block of content) {
    if (block === null || typeof block !== 'object' || Array.isArray(block)
      || typeof block.type !== 'string' || block.type === '') {
      throw internalError()
    }
    if (block.type !== 'text') continue
    if (typeof block.text !== 'string') throw internalError()
    if (block.text === '') continue
    textBytes += Buffer.byteLength(block.text, 'utf8')
    if (textBytes > MAX_PROJECTED_TEXT_BYTES_PER_MESSAGE) throw resourceLimit()
    text += block.text
  }
  return text
}

/**
 * Create the per-request projection state machine. `handleEvent(event,
 * recordDigestHex)` returns the projected message for a relevant user event or
 * null; `finalize()` returns every projected message (user immediately,
 * assistant per eligible completed turn) unsorted — the caller orders by seq.
 */
export function createProjector() {
  const userMessages = []
  const turns = new Map()

  const turnState = (turn) => {
    let state = turns.get(turn)
    if (state === undefined) {
      state = { terminalSeen: false, completed: false, candidate: null }
      turns.set(turn, state)
    }
    return state
  }

  function handleEvent(event, recordDigestHex) {
    if (event.type === 'user/message') {
      const data = event.data
      const relevant = event.surfaceOp === 'append'
        && data !== null && typeof data === 'object'
        && data.source !== null && typeof data.source === 'object'
        && data.source.kind === 'user'
      if (!relevant) return null
      if (typeof data.id !== 'string' || data.id === '' || !Array.isArray(data.content)) {
        throw internalError()
      }
      const text = projectTextBlocks(data.content)
      if (text === '') return null
      const message = {
        seq: event.seq,
        role: 'user',
        rawId: data.id,
        time: event.time,
        text,
        recordDigest: recordDigestHex,
      }
      userMessages.push(message)
      return message
    }

    if (event.type === 'assistant/message') {
      const data = event.data
      const turn = data?.turn
      // Missing / non-integer / unsafe / -0 / zero / negative correlation key:
      // non-correlatable, dropped as an ignored internal event (never fatal).
      if (!isPositiveSafeTurn(turn)) return null
      // Present-but-malformed correlated payload: committed corruption.
      const message = data?.message
      if (message === null || typeof message !== 'object' || Array.isArray(message)
        || typeof message.id !== 'string' || message.id === ''
        || !Array.isArray(message.content)) {
        throw internalError()
      }
      if (event.surfaceOp !== 'append') return null
      const state = turnState(turn)
      // A candidate at/after its matching terminal is committed corruption.
      if (state.terminalSeen) throw internalError()
      const text = projectTextBlocks(message.content)
      // Tool-only / empty-text messages do not qualify and never displace an
      // earlier qualifying candidate: the projected one is the LAST with
      // non-empty text.
      if (text === '') return null
      const candidate = {
        seq: event.seq,
        role: 'assistant',
        rawId: message.id,
        time: event.time,
        text,
        recordDigest: recordDigestHex,
      }
      if (state.candidate === null || candidate.seq > state.candidate.seq) {
        state.candidate = candidate
      }
      return null
    }

    if (event.type === 'turn/end') {
      const data = event.data
      const turn = data?.turn
      if (!isPositiveSafeTurn(turn)) return null
      const reason = data?.reason
      if (reason === null || typeof reason !== 'object' || Array.isArray(reason)
        || typeof reason.kind !== 'string' || reason.kind === '') {
        throw internalError()
      }
      const state = turnState(turn)
      if (state.terminalSeen) throw internalError() // duplicate terminal
      state.terminalSeen = true
      state.completed = reason.kind === 'completed'
      return null
    }

    return null // any other event type: ignored internal event
  }

  function finalize() {
    const assistantMessages = []
    for (const state of turns.values()) {
      if (state.completed && state.candidate !== null) assistantMessages.push(state.candidate)
    }
    return [...userMessages, ...assistantMessages]
  }

  return { handleEvent, finalize }
}
