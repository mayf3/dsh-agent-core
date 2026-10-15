import { mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, readFileSync, lstatSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { custodyKey, validateWebsiteAdmission } from './website-admission.js'
const MAX = 8388608
const visible = blocks => (Array.isArray(blocks) ? blocks : []).filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('')
function atomic(file, value) {
  const bytes = JSON.stringify(value)
  if (Buffer.byteLength(bytes) > MAX) throw new Error('website source custody capacity')
  const temporary = `${file}.${process.pid}.tmp`
  const fd = openSync(temporary, 'w', 0o600)
  try { writeFileSync(fd, bytes); fsyncSync(fd) } finally { closeSync(fd) }
  renameSync(temporary, file)
  const directory = openSync(join(file, '..'), 'r')
  try { fsyncSync(directory) } finally { closeSync(directory) }
}
function load(file) {
  const stat = lstatSync(file)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX) throw new Error('website custody unavailable')
  return JSON.parse(readFileSync(file, 'utf8'))
}
/** Original source-owner event observer. Persists only the exact own user,
 * final-text candidates and native association; never tool/reasoning events.
 * Files survive main replacement and are not expired while pending.
 */
export class WebsiteSourceCustody {
  constructor(home) {
    this.directory = join(home, 'website-inquiry-custody')
    mkdirSync(this.directory, { recursive: true, mode: 0o700 })
    if (!lstatSync(this.directory).isDirectory() || lstatSync(this.directory).isSymbolicLink()) throw new Error('website custody unavailable')
    this.pending = new Map()
    for (const file of readdirSync(this.directory)) {
      if (!/^[a-f0-9]{64}\.json$/.test(file)) continue
      const record = load(join(this.directory, file))
      if (!record.terminal) this.pending.set(file.slice(0, -5), record)
    }
  }
  register(carrier, message) {
    validateWebsiteAdmission(carrier)
    if (message?.source?.kind !== 'user' || typeof message.id !== 'string') throw new Error('website native message invalid')
    const key = custodyKey(carrier)
    const file = join(this.directory, `${key}.json`)
    try { load(file); throw new Error('website custody already exists') } catch (error) { if (error.code !== 'ENOENT') throw error }
    const record = { carrier, userMessageId: message.id, message: visible(message.content), inbox: false, userSeen: false,
      turnId: null, assistantMessageId: null, content: null, terminal: false, status: 'pending', lastSeq: -1, records: 0 }
    atomic(file, record)
    this.pending.set(key, record)
  }
  observe(sessionId, event) {
    if (sessionId !== 'main') return
    for (const [key, original] of this.pending) {
      const record = structuredClone(original)
      if (!Number.isSafeInteger(event?.seq) || event.seq <= record.lastSeq || (record.lastSeq >= 0 && event.seq !== record.lastSeq + 1)) throw new Error('website source order conflict')
      record.lastSeq = event.seq
      if (++record.records > 10000) throw new Error('website source record cap')
      const data = event.data
      if (event.type === 'agent/inbox/spliced') {
        const items = data?.inserted ?? []
        if (items.some(item => item.id === record.userMessageId)) {
          if (record.inbox || items.length !== 1 || visible(items[0].content) !== record.message || items[0].source?.kind !== 'user') record.status = 'unresolvable'
          record.inbox = true
        } else if (record.inbox && items.length > 0) record.status = 'unresolvable'
      }
      if (event.type === 'turn/start' && record.inbox) {
        if (record.turnId !== null || !Number.isSafeInteger(data?.turn)) record.status = 'unresolvable'
        else { record.turnId = data.turn; record.startedAt = new Date(event.time).toISOString() }
      }
      if (event.type === 'user/message' && data?.id === record.userMessageId) {
        if (record.turnId === null || record.userSeen || visible(data.content) !== record.message || data.source?.kind !== 'user') record.status = 'unresolvable'
        record.userSeen = true
      }
      if (event.type === 'assistant/message' && record.userSeen && data?.turn === record.turnId
        && !data.message?.content?.some(block => block.type === 'tool-call')) {
        record.assistantMessageId = data.message?.id ?? null
        record.content = visible(data.message?.content)
        record.replyCreatedAt = new Date(event.time).toISOString()
      }
      if (event.type === 'turn/end' && record.userSeen && data?.turn === record.turnId) {
        record.terminal = true
        record.finishedAt = new Date(event.time).toISOString()
        if (record.status !== 'unresolvable') record.status = data.reason?.kind === 'completed' ? 'completed' : 'failed'
      }
      atomic(join(this.directory, `${key}.json`), record)
      if (record.terminal) this.pending.delete(key)
      else this.pending.set(key, record)
    }
  }
}
export function readCustodyProjection(home, carrier) {
  const record = load(join(home, 'website-inquiry-custody', `${custodyKey(validateWebsiteAdmission(carrier))}.json`))
  if (JSON.stringify(record.carrier) !== JSON.stringify(carrier)) throw new Error('website source mismatch')
  return { userMessageId: record.userMessageId, message: record.message, turnId: record.turnId,
    assistantMessageId: record.assistantMessageId, content: record.content, status: record.status,
    complete: record.terminal && record.status === 'completed' && record.assistantMessageId !== null && record.content !== null,
    truncated: false, startedAt: record.startedAt ?? null, finishedAt: record.finishedAt ?? null, replyCreatedAt: record.replyCreatedAt ?? null }
}

/** Custody is a projection observer. Its disk/order failure cannot intercept
 * the original native event stream; the same-coordinate reader may repair it.
 */
export function forwardWebsiteSessionEvent(custody, sessionId, event, forward) {
  try { custody?.observe(sessionId, event) } catch { /* no raw source/error logging */ }
  forward({ sessionId, event })
}
