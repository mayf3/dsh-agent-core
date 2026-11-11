/** Native exact-message/turn association shared by full and compact reads. */
import { unavailable, unresolvable, notOwned } from './owned-trace-read.js'

export function safeSeq(record) {
  return Number.isSafeInteger(record?.seq) && record.seq >= 0 ? record.seq : null
}

export function safeTime(record) {
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

export function resolveExactTurn({ records, callerAgentId, targetAgentId, sessionId, messageId, canonicalWorkspace }) {
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
    if (allUsers.length !== 0 || safeSeq(anchor.record) === null) return unresolvable()
    return { ok: true, anchor, start: null, user: null, events, terminal: null }
  }
  if (allUsers.length !== 1 || allUsers[0].index <= start.index) return unresolvable()
  const user = allUsers[0]
  for (let index = start.index + 1; index < user.index; index += 1) {
    if (events[index]?.type === 'turn/start' || hasCompetingInsertion(events[index], messageId)) return unresolvable()
  }
  if (user.record.data?.source?.kind !== 'inter_agent' || user.record.data.source.sourceAgentId !== callerAgentId) return notOwned()
  if (safeSeq(user.record) === null || safeTime(start.record) === null) return unresolvable()
  let terminal = null
  for (let index = start.index + 1; index < events.length; index += 1) {
    const event = events[index]
    if (event?.type !== 'turn/end' || event?.data?.turn !== start.turn) continue
    if (safeSeq(event) === null || safeTime(event) === null
      || typeof event.data?.reason?.kind !== 'string' || event.data.reason.kind === '') return unresolvable()
    terminal = { index, record: event }
    break
  }
  return { ok: true, anchor, start, user, events, terminal }
}
