import { readStableArtifact, resolveCanonicalTarget } from '../../../../session-history/src/locator.js'
import { parseHeaderRecord, iterateRecords } from '../../../../session-history/src/snapshot.js'
import { decodeStorageRecord, expandedEventCount } from '../../../../session-history/src/dsh-compat.js'
import { currentMainGenerationDigest, sha256Hex } from '../../../../session-history/src/ids.js'
const text = value => (Array.isArray(value) ? value : []).filter(block => block?.type === 'text').map(block => block.text).join('')
const invalid = () => { throw new Error('website native trace unavailable') }
export function projectWebsiteNativeEvents(events, record) {
  const id = record.shell.trace.native_user_message_id
  const anchors = events.map((event, index) => ({ event, index })).filter(({ event }) => event.type === 'agent/inbox/spliced' && event.data?.inserted?.some(item => item.id === id))
  if (anchors.length !== 1) invalid()
  const anchor = anchors[0]
  const user = anchor.event.data.inserted
  if (user.length !== 1 || user[0].source?.kind !== 'user' || text(user[0].content) !== record.message) invalid()
  let turn = null
  let seenUser = false
  let startedAt = null
  let assistant = null
  for (const event of events.slice(anchor.index + 1)) {
    if (event.type === 'agent/inbox/spliced' && event.data?.inserted?.length) invalid()
    if (event.type === 'turn/start') {
      if (turn !== null || !Number.isSafeInteger(event.data?.turn)) invalid()
      turn = event.data.turn
      startedAt = new Date(event.time).toISOString()
    }
    if (event.type === 'user/message' && event.data?.id === id) {
      if (seenUser || turn === null || event.data.source?.kind !== 'user' || text(event.data.content) !== record.message) invalid()
      seenUser = true
    }
    if (event.type === 'assistant/message' && seenUser && event.data?.turn === turn
      && !event.data.message?.content?.some(block => block.type === 'tool-call')) assistant = event
    if (event.type === 'turn/end' && seenUser && event.data?.turn === turn) {
      const status = event.data.reason?.kind === 'completed' ? 'completed' : 'failed'
      return { userMessageId: id, message: record.message, turnId: turn, assistantMessageId: assistant?.data.message?.id ?? null,
        status, content: assistant ? text(assistant.data.message.content) : null, complete: status === 'completed' && Boolean(assistant?.data.message?.id),
        truncated: false, startedAt, finishedAt: new Date(event.time).toISOString(), replyCreatedAt: assistant ? new Date(assistant.time).toISOString() : null }
    }
  }
  return { status: 'pending', userMessageId: id, turnId: turn, complete: false }
}
export function recoverNativeProjection(workspaceBootstrap, record) {
  const agentId = record.shell.trace.agent_id
  const workspaceDir = workspaceBootstrap.resolveWorkspace(agentId)
  const target = resolveCanonicalTarget({ agentHome: workspaceBootstrap.resolveDshHome(agentId), workspaceDir })
  const bytes = readStableArtifact(target.artifactPath, target.sessionRoot)
  const rows = iterateRecords(bytes)
  const first = rows.next().value
  if (!first) invalid()
  const header = parseHeaderRecord(first)
  if (header.cwd !== workspaceDir || currentMainGenerationDigest(header, sha256Hex(first)) !== record.shell.trace.session_generation) invalid()
  const events = []
  for (const row of rows) {
    if (row.length > 1048576) invalid()
    const raw = JSON.parse(row.toString())
    if (events.length + expandedEventCount(raw) > 10000) invalid()
    for (const event of decodeStorageRecord(raw)) {
      if (event.seq !== events.length || !Number.isSafeInteger(event.time)) invalid()
      events.push(event)
    }
  }
  return projectWebsiteNativeEvents(events, record)
}
