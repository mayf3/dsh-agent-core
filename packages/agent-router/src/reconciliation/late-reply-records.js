/** W2 delivery dispositions only; never a second turn/outcome authority. */
import { createHash, randomUUID } from 'node:crypto'
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u

export function lateReplyId(handle) {
  const hex = createHash('sha256').update(`late-reply:${handle}`).digest('hex')
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-')
}

export function createLateReplyRecords({ directory, failure, log, now = Date.now }) {
  function read(id) {
    if (!UUID.test(id)) throw new TypeError('exact late-reply id required')
    return JSON.parse(readFileSync(join(directory, `${id}.json`), 'utf8'))
  }
  function write(record, exclusive = false) {
    if (!directory) throw new Error('late-reply disposition directory unavailable')
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    const path = join(directory, `${record.id}.json`)
    const temp = exclusive ? path : `${path}.${randomUUID()}.tmp`
    const fd = openSync(temp, 'wx', 0o600)
    try {
      writeFileSync(fd, JSON.stringify(record) + '\n', 'utf8')
      fsyncSync(fd)
    } finally { closeSync(fd) }
    if (!exclusive) renameSync(temp, path)
    const dirFd = openSync(directory, 'r')
    try { fsyncSync(dirFd) } finally { closeSync(dirFd) }
    return record
  }
  function register({ handle, agentId, sessionId, target }) {
    const id = lateReplyId(handle)
    try {
      return write({ schemaVersion: 1, kind: 'late_reply_delivery', id,
        reconciliationHandle: handle, agentId, sessionId, target,
        createdAtWallMs: now(), disposition: 'late_reply_pending' }, true)
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      const record = read(id)
      if (record.kind !== 'late_reply_delivery' || record.reconciliationHandle !== handle) {
        throw new Error('late-reply disposition identity mismatch')
      }
      return record
    }
  }
  function update(id, disposition, fields = {}) {
    return write({ ...read(id), ...fields, disposition, updatedAtWallMs: now() })
  }
  function claim(id) {
    if (read(id).disposition !== 'late_reply_pending') return false
    // Single Router writer: persist consumption synchronously BEFORE external IO.
    update(id, 'late_reply_attempted')
    return true
  }
  function failed(id, reason, output = null) {
    const record = update(id, 'late_reply_dead_letter', { reason, category: 'caller_bound_exceeded', output })
    failure({ source: 'caller_wait_exceeded' }, { agentId: record.agentId,
      reconciliationHandle: record.reconciliationHandle, deadLetterId: id, stage: 'late_reply', reason })
    log.error?.(`late-reply-disposition ${JSON.stringify({ id, disposition: record.disposition, reason })}`)
  }
  function pending() {
    if (!directory) return []
    let names
    try { names = readdirSync(directory) } catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }
    const active = []
    for (const name of names) {
      if (!name.endsWith('.json') || !UUID.test(name.slice(0, -5))) continue
      const id = name.slice(0, -5)
      try {
        const record = read(id)
        if (record?.kind === 'late_reply_delivery'
            && ['late_reply_pending', 'late_reply_attempted'].includes(record.disposition)) active.push(record)
      } catch {
        // A crashed legacy dead-letter write must not hide unrelated W2 work.
        failure({ source: 'caller_wait_exceeded' }, { deadLetterId: id,
          stage: 'late_reply_record', reason: 'disposition_unreadable' })
        log.error?.(`late-reply-record-unreadable ${JSON.stringify({ id })}`)
      }
    }
    return active
  }
  return { register, read, claim, update, failed, pending,
    unavailable: handle => failure({ source: 'caller_wait_exceeded' }, { reconciliationHandle: handle, stage: 'late_reply_record' }),
  }
}
