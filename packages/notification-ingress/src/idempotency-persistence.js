import { randomUUID } from 'node:crypto'
import {
  appendFileSync, closeSync, existsSync, fsyncSync, ftruncateSync, mkdirSync,
  openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { constants } from 'node:fs'
import { dirname } from 'node:path'

import {
  DEFAULT_ROTATE_BYTES, STORE_VERSION, parseDocument, snapshotRecords, storeError,
} from './idempotency-record.js'

const LOCK_RETRY_MS = 10
const LOCK_TIMEOUT_MS = 15000
const LOCK_STALE_MS = 30000
const PRIVATE_DIRECTORY_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600

/**
 * Persistence mechanics shared by the idempotency authority: validated reload,
 * cross-process locking, atomic replacement, serialized mutation and evidence.
 * The subclass owns the record state machine and initializes the referenced
 * fields before invoking these methods.
 */
export class IdempotencyPersistence {
  reloadFromDiskSync() {
    if (!existsSync(this.storeFile)) {
      this.fileExists = false
      this.records = new Map()
      return
    }
    let raw
    try {
      raw = readFileSync(this.storeFile, 'utf8')
    } catch (error) {
      throw storeError(`notification-ingress: idempotency store is unreadable: ${this.storeFile} (${error.message})`)
    }
    const document = parseDocument(raw, this.storeFile)
    this.fileExists = true
    this.records = new Map()
    for (const [clientId, perRequest] of Object.entries(document.records)) {
      this.records.set(clientId, new Map(Object.entries(perRequest)))
    }
  }

  async reloadLatest() {
    this.reloadFromDiskSync()
  }

  acquireLockSync(purpose = 'mutation') {
    const start = this.clockMs()
    for (;;) {
      let fd
      try {
        mkdirSync(dirname(this.lockPath), { recursive: true, mode: PRIVATE_DIRECTORY_MODE })
        fd = openSync(this.lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR, PRIVATE_FILE_MODE)
        writeFileSync(fd, `${process.pid} ${purpose} ${this.now()}\n`, 'utf8')
        return fd
      } catch (error) {
        if (fd !== undefined) closeSync(fd)
        if (error?.code !== 'EEXIST') {
          throw storeError(`notification-ingress: cannot acquire idempotency lock ${this.lockPath} (${error.message})`)
        }
        try {
          const stat = statSync(this.lockPath)
          if (this.clockMs() - stat.mtimeMs > LOCK_STALE_MS) {
            rmSync(this.lockPath, { force: true })
            this.log.log('notification-ingress: broke a stale idempotency lock')
            continue
          }
        } catch { /* lock vanished — retry */ }
        if (this.clockMs() - start > LOCK_TIMEOUT_MS) {
          throw Object.assign(new Error(`notification-ingress: idempotency lock timeout on ${this.lockPath}`), { code: 'IDEMPOTENCY_STORE_LOCKED' })
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_RETRY_MS)
      }
    }
  }

  releaseLockSync(fd) {
    try { closeSync(fd) } catch { /* already closed */ }
    try { rmSync(this.lockPath, { force: true }) } catch { /* best effort */ }
  }

  serializeDocument() {
    const records = {}
    for (const [clientId, perRequest] of this.records.entries()) {
      records[clientId] = Object.fromEntries([...perRequest.entries()].map(([rid, row]) => [rid, { ...row }]))
    }
    return `${JSON.stringify({ version: STORE_VERSION, records }, null, 2)}\n`
  }

  persistSync() {
    const serialized = this.serializeDocument()
    mkdirSync(dirname(this.storeFile), { recursive: true, mode: PRIVATE_DIRECTORY_MODE })
    const tmp = `${this.storeFile}.tmp-${process.pid}-${randomUUID()}`
    let fd
    try {
      fd = openSync(tmp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, PRIVATE_FILE_MODE)
      writeFileSync(fd, serialized, 'utf8')
      ftruncateSync(fd, serialized.length)
      fsyncSync(fd)
      closeSync(fd)
      fd = undefined
      renameSync(tmp, this.storeFile)
      this.fileExists = true
      const dirFd = openSync(dirname(this.storeFile), constants.O_RDONLY)
      try { fsyncSync(dirFd) } catch { /* not supported on some FS */ }
      closeSync(dirFd)
    } catch (error) {
      if (fd !== undefined) { try { closeSync(fd) } catch { /* best effort */ } }
      try { rmSync(tmp, { force: true }) } catch { /* best effort */ }
      throw storeError(`notification-ingress: idempotency store persist failed: ${this.storeFile} (${error.message})`)
    }
  }

  enqueue(mutate) {
    const run = this.queue.then(async () => {
      const fd = this.acquireLockSync()
      const snapshot = snapshotRecords(this.records)
      const fileExisted = this.fileExists
      try {
        await this.reloadLatest()
        const result = await mutate()
        this.persistSync()
        return result
      } catch (error) {
        this.records = snapshot
        this.fileExists = fileExisted
        throw error
      } finally {
        this.releaseLockSync(fd)
      }
    })
    this.queue = run.then(() => undefined, () => undefined)
    return run
  }

  appendEvidence(event) {
    try {
      mkdirSync(dirname(this.evidenceFile), { recursive: true, mode: PRIVATE_DIRECTORY_MODE })
      let size = 0
      try {
        size = statSync(this.evidenceFile).size
      } catch { /* not created yet */ }
      if (size >= (this.rotateBytes ?? DEFAULT_ROTATE_BYTES)) {
        const gen1 = `${this.evidenceFile}.1`
        try { rmSync(gen1, { force: true }) } catch { /* best effort */ }
        try { renameSync(this.evidenceFile, gen1) } catch { /* best effort */ }
      }
      appendFileSync(this.evidenceFile, `${JSON.stringify({ ...event, at: this.now() })}\n`, 'utf8')
    } catch (error) {
      this.log.error(`notification-ingress: evidence append failed: ${error?.message ?? error}`)
    }
  }

  evidenceLines() {
    try {
      return readFileSync(this.evidenceFile, 'utf8').trim().split('\n').filter((line) => line !== '').map((line) => JSON.parse(line))
    } catch {
      return []
    }
  }
}
