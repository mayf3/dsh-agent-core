import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import {
  logicalCoordinates,
  rebuildFences,
  validateOccurrenceRecord,
} from './occurrence-model.js'
import { OwnerLock } from './lock.js'
import { storeMigrationMethods } from './store-migration.js'

export const STORE_VERSION = 2
export const UPGRADEABLE_VERSIONS = new Set([1])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const clone = (value) => structuredClone(value)
const digestJSON = (value) => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')

function failLoud(context, error) {
  const wrapped = new Error(`scheduler store: ${context}: ${error?.message ?? error}`)
  wrapped.cause = error
  throw wrapped
}

function emptyDoc() {
  return { version: STORE_VERSION, jobs: [], occurrences: [], fences: {} }
}

/** Single-document Scheduler V2 authority store. */
export class JobStore {
  constructor(filePath, opts = {}) {
    this.filePath = filePath
    this.runLogPath = opts.runLogPath ?? path.join(path.dirname(filePath), 'runs.jsonl')
    this.maxRunLogBytes = opts.maxRunLogBytes ?? 10 * 1024 * 1024
    this.lockTimeoutMs = opts.lockTimeoutMs ?? 15_000
    this.lockStaleMs = opts.lockStaleMs ?? 30_000
    this.clock = opts.clock ?? (() => Date.now())
    this.lockPath = `${filePath}.lock`
    this.engineLockPath = `${filePath}.engine.lock`
    this.upgradeMetaPath = `${filePath}.upgrade-v2.json`
    this.beforeCommit = opts.beforeCommit ?? null
    this._cacheDoc = null
    this._mtimeMs = -1
    this._writeChain = Promise.resolve()
    this._mutexChain = Promise.resolve()
    this._tmpSeq = 0
    const evidenceSink = (event) => this.appendRunEvent(event).catch(() => {})
    this._mutationLock = new OwnerLock(this.lockPath, {
      timeoutMs: this.lockTimeoutMs, clock: this.clock, onEvidence: evidenceSink,
    })
    this._engineLock = new OwnerLock(this.engineLockPath, {
      timeoutMs: this.lockTimeoutMs, clock: this.clock, onEvidence: evidenceSink,
    })
  }

  get dir() {
    return path.dirname(this.filePath)
  }

  _emptyDoc() {
    return emptyDoc()
  }

  async _ensureDir() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await fs.mkdir(path.dirname(this.runLogPath), { recursive: true })
  }

  async _syncDir(dir) {
    let handle
    try {
      handle = await fs.open(dir, 'r')
      await handle.sync()
    } catch (error) {
      // Some platforms/filesystems reject directory fsync. Only tolerate the
      // documented unsupported-operation classes; persistence errors fail loud.
      if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EBADF'].includes(error.code)) {
        failLoud(`fsync directory ${dir}`, error)
      }
    } finally {
      await handle?.close().catch(() => {})
    }
  }

  /**
   * Mutation + engine-lease locks (src/lock.js): owner-carrying artifacts
   * created ATOMICALLY with their identity — no reachable identity-less
   * state; dead owners reaped only on mechanical pid proof; bounded
   * lock_recovery / lock_unverifiable evidence through runs.jsonl.
   */
  _withLock(fn) {
    return this._mutationLock.runExclusive(fn)
  }

  /**
   * Engine lease: the single-live-engine authority over this store. Acquire
   * = atomic creation of an owner-carrying artifact (pid + token); a dead
   * prior engine is reaped ONLY on mechanical pid-death proof, after which
   * the acquiring engine still runs the full store recovery (unresolved
   * sweep) before any admission. `verify` lets the running engine detect a
   * lost/superseded lease and halt admission (no second live engine).
   * @returns {{token: string, release: Function, verify: Function}}
   */
  async acquireEngineLease() {
    const token = await this._engineLock.acquire()
    let released = false
    const release = async () => {
      if (released) return
      released = true
      await this._engineLock.release(token)
    }
    const verify = async () => {
      if (released) return false
      return this._engineLock.isHeldBy(token)
    }
    return { token, release, verify }
  }

  async mutateDoc(fn) {
    const run = this._mutexChain.then(() => this._mutateDocLocked(fn))
    this._mutexChain = run.catch(() => {})
    return run
  }

  async _mutateDocLocked(fn) {
    let committed = false
    try {
      return await this._withLock(async () => {
        let loaded
        let doc
        let value
        try {
          loaded = await this._loadDocForMutation()
          doc = loaded.doc
          const beforeJobsDigest = digestJSON(doc.jobs)
          const result = await fn(doc, {
            existed: loaded.existed,
            sourceStatus: loaded.sourceStatus,
            upgrade: loaded.upgrade ?? null,
          })
          if (result && typeof result === 'object') {
            if (Array.isArray(result.jobs)) doc.jobs = result.jobs
            if (Array.isArray(result.occurrences)) doc.occurrences = result.occurrences
            if (result.fences && typeof result.fences === 'object' && !Array.isArray(result.fences)) {
              doc.fences = result.fences
            }
            value = result.value
          }
          this._validateDocument(doc)
          const jobsChanged = digestJSON(doc.jobs) !== beforeJobsDigest
          if (jobsChanged) await this._markV2JobMutation()
          if (typeof this.beforeCommit === 'function') await this.beforeCommit()
        } catch (error) {
          if (error?.mutationOutcome === undefined) error.mutationOutcome = 'not_committed'
          throw error
        }
        try {
          await this._writeAtomicDoc(doc)
          committed = true
        } catch (error) {
          if (error?.mutationOutcome === 'committed') {
            error.committedDoc = clone(doc)
            error.committedValue = clone(value)
          }
          throw error
        }
        this._cacheDoc = clone(doc)
        try {
          this._mtimeMs = (await fs.stat(this.filePath)).mtimeMs
        } catch (error) {
          error.mutationOutcome = 'committed'
          error.committedDoc = clone(doc)
          error.committedValue = clone(value)
          throw error
        }
        let upgrade = loaded.upgrade ?? null
        if (upgrade) {
          const evidenceStatus = await this.appendRunEvent({
            ts: this.clock(), action: 'store_upgrade', from: 1, to: STORE_VERSION,
            backupFile: upgrade.backupFile, report: upgrade.report,
          })
          upgrade = { ...upgrade, evidenceStatus }
        }
        return { doc: clone(doc), value, upgrade }
      })
    } catch (error) {
      if (error?.mutationOutcome === undefined) {
        error.mutationOutcome = committed ? 'committed' : 'not_committed'
      }
      throw error
    }
  }

  async mutate(fn) {
    const { doc, value } = await this.mutateDoc(async (latest) => {
      const result = await fn(latest.jobs)
      if (Array.isArray(result)) latest.jobs = result
      else if (result && typeof result === 'object') {
        if (Array.isArray(result.jobs)) latest.jobs = result.jobs
        return { value: result.value }
      }
      return undefined
    })
    return { jobs: doc.jobs, value }
  }

  async exists() {
    try {
      await fs.stat(this.filePath)
      return true
    } catch (error) {
      if (error.code === 'ENOENT') return false
      failLoud(`stat ${this.filePath}`, error)
    }
  }

  async _readDocRaw({ repairFences = false } = {}) {
    let raw
    try {
      raw = await fs.readFile(this.filePath, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') return { status: 'empty' }
      failLoud(`read ${this.filePath}`, error)
    }
    let data
    try {
      data = JSON.parse(raw)
    } catch (error) {
      failLoud(`parse ${this.filePath} (corrupt document — not treating as empty store)`, error)
    }
    if (Array.isArray(data)) return { status: 'v1', raw: data, jobs: data }
    if (!data || typeof data !== 'object') {
      failLoud('validate document', new Error('document is neither an array nor an object'))
    }
    if (data.version === STORE_VERSION) {
      const validated = repairFences && Array.isArray(data.occurrences)
        ? { ...data, fences: rebuildFences(data.occurrences) }
        : data
      this._validateDocument(validated)
      return { status: 'v2', raw: data, doc: data }
    }
    if (UPGRADEABLE_VERSIONS.has(data.version)) {
      if (!Array.isArray(data.jobs)) {
        failLoud('validate v1 document', new Error('version 1 jobs must be an array'))
      }
      return { status: 'v1', raw: data, jobs: data.jobs }
    }
    failLoud('validate document', new Error(`unsupported store version ${JSON.stringify(data.version)}`))
  }

  _validateDocument(doc) {
    if (doc.version !== STORE_VERSION || !Array.isArray(doc.jobs)
      || !Array.isArray(doc.occurrences) || !doc.fences
      || typeof doc.fences !== 'object' || Array.isArray(doc.fences)) {
      failLoud('validate document', new Error('version 2 document missing/malformed jobs/occurrences/fences collection(s)'))
    }
    const ids = new Map()
    const coordinateKeys = new Map()
    for (const record of doc.occurrences) {
      try {
        validateOccurrenceRecord(record)
      } catch (error) {
        failLoud('occurrence authority corrupted (fail loud, not an empty store)', error)
      }
      if (ids.has(record.occurrenceId)) {
        failLoud('occurrence authority corrupted', new Error(`duplicate occurrenceId ${record.occurrenceId}`))
      }
      ids.set(record.occurrenceId, record)
      const coords = logicalCoordinates(record)
      const slot = coords.kind === 'catchup' ? 'natural' : coords.kind
      const key = JSON.stringify({ ...coords, kind: slot })
      if (coordinateKeys.has(key)) {
        failLoud('occurrence authority corrupted', new Error(`duplicate logical occurrence coordinates ${key}`))
      }
      coordinateKeys.set(key, record.occurrenceId)
    }
    for (const record of doc.occurrences) {
      if (record.kind !== 'retry') continue
      const predecessor = ids.get(record.retryOfOccurrenceId)
      if (!predecessor || predecessor.state !== 'failed'
        || predecessor.jobId !== record.jobId
        || predecessor.scheduleRevision !== record.scheduleRevision) {
        failLoud('occurrence authority corrupted', new Error(`invalid retry predecessor for ${record.occurrenceId}`))
      }
    }
    for (const [jobId, fence] of Object.entries(doc.fences)) {
      if (!fence || typeof fence !== 'object' || typeof fence.occurrenceId !== 'string'
        || typeof fence.runId !== 'string' || typeof fence.activatedAtMs !== 'number') {
        failLoud('fence projection corrupted', new Error(`malformed fence for ${jobId}`))
      }
    }
    const expectedFences = rebuildFences(doc.occurrences)
    const actualKeys = Object.keys(doc.fences).sort()
    const expectedKeys = Object.keys(expectedFences).sort()
    const exact = JSON.stringify(actualKeys) === JSON.stringify(expectedKeys)
      && actualKeys.every((jobId) => {
        const actual = doc.fences[jobId]
        const expected = expectedFences[jobId]
        return Object.keys(actual).length === 4
          && actual.occurrenceId === expected.occurrenceId && actual.runId === expected.runId
          && actual.activatedAtMs === expected.activatedAtMs && actual.reason === expected.reason
      })
    if (!exact) failLoud('fence projection corrupted', new Error('fences do not exactly match unresolved outcome_unknown authority'))
  }

  async _writeDocFile(doc) {
    await this._writeRawAtomic(`${JSON.stringify(doc, null, 2)}\n`)
  }

  async _writeRawAtomic(payload) {
    const seq = ++this._tmpSeq
    const run = this._writeChain.then(async () => {
      await this._ensureDir()
      const tmp = `${this.filePath}.tmp-${process.pid}-${seq}-${this.clock()}`
      let renameAttempted = false
      let renamed = false
      try {
        const handle = await fs.open(tmp, 'wx')
        try {
          await handle.writeFile(payload, 'utf8')
          await handle.sync()
        } finally {
          await handle.close()
        }
        renameAttempted = true
        await fs.rename(tmp, this.filePath)
        renamed = true
        await this._syncDir(path.dirname(this.filePath))
      } catch (error) {
        await fs.rm(tmp, { force: true }).catch(() => {})
        const wrapped = new Error(`scheduler store: atomic write ${tmp} -> ${this.filePath}: ${error?.message ?? error}`)
        wrapped.cause = error
        wrapped.mutationOutcome = renamed ? 'committed' : (renameAttempted ? 'unknown' : 'not_committed')
        throw wrapped
      }
    })
    this._writeChain = run.catch(() => {})
    return run
  }

  async _writeAtomicDoc(doc) {
    await this._writeDocFile(doc)
  }

  /** Compatibility write surface, now routed through the one mutation authority. */
  async persist(jobs) {
    await this.mutateDoc((doc) => { doc.jobs = jobs })
  }

  async loadDoc({ force = false } = {}) {
    let stat
    try {
      stat = await fs.stat(this.filePath)
    } catch (error) {
      if (error.code === 'ENOENT') return emptyDoc()
      failLoud(`stat ${this.filePath}`, error)
    }
    if (!force && this._cacheDoc && stat.mtimeMs === this._mtimeMs) return clone(this._cacheDoc)
    const classified = await this._readDocRaw()
    if (classified.status === 'v1') {
      await this.ensureUpgraded()
      return this.loadDoc({ force: true })
    }
    const doc = classified.status === 'v2' ? classified.doc : emptyDoc()
    this._cacheDoc = clone(doc)
    this._mtimeMs = stat.mtimeMs
    return clone(doc)
  }

  async load({ force = false } = {}) {
    return (await this.loadDoc({ force })).jobs
  }

  async rebuildProjections({ buildJobSummary } = {}) {
    const run = this._mutexChain.then(() => this._withLock(async () => {
      const classified = await this._readDocRaw({ repairFences: true })
      if (classified.status !== 'v2') {
        failLoud('rebuild projections', new Error('store must be upgraded to v2 first'))
      }
      const doc = clone(classified.doc)
      const before = JSON.stringify({ fences: doc.fences, states: doc.jobs.map((job) => job.state ?? {}) })
      doc.fences = rebuildFences(doc.occurrences)
      if (typeof buildJobSummary === 'function') {
        for (const job of doc.jobs) job.state = buildJobSummary(job, doc.occurrences)
      }
      this._validateDocument(doc)
      await this._writeAtomicDoc(doc)
      this._cacheDoc = clone(doc)
      this._mtimeMs = (await fs.stat(this.filePath)).mtimeMs
      const after = JSON.stringify({ fences: doc.fences, states: doc.jobs.map((job) => job.state ?? {}) })
      return { changed: before !== after, fences: clone(doc.fences) }
    }))
    this._mutexChain = run.catch(() => {})
    return run
  }

  async rebuildFences() {
    return (await this.rebuildProjections()).fences
  }

  async appendRunEvent(event) {
    try {
      await this._ensureDir()
      const handle = await fs.open(this.runLogPath, 'a')
      try {
        await handle.writeFile(`${JSON.stringify(event)}\n`, 'utf8')
        await handle.sync()
      } finally {
        await handle.close()
      }
      await this._truncateRunLog()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: `${error?.code ?? ''}: ${error?.message ?? error}` }
    }
  }

  async _truncateRunLog() {
    try {
      const stat = await fs.stat(this.runLogPath)
      if (stat.size <= this.maxRunLogBytes) return
      const handle = await fs.open(this.runLogPath, 'r')
      let tail
      try {
        const result = await handle.read(
          Buffer.alloc(this.maxRunLogBytes),
          0,
          this.maxRunLogBytes,
          Math.max(0, stat.size - this.maxRunLogBytes),
        )
        tail = result.buffer.subarray(0, result.bytesRead)
      } finally {
        await handle.close()
      }
      const newline = tail.indexOf('\n')
      const keep = newline >= 0 ? tail.subarray(newline + 1) : tail
      const tmp = `${this.runLogPath}.tmp-${process.pid}-${++this._tmpSeq}`
      const output = await fs.open(tmp, 'wx')
      try {
        await output.writeFile(keep)
        await output.sync()
      } finally {
        await output.close()
      }
      await fs.rename(tmp, this.runLogPath)
      await this._syncDir(path.dirname(this.runLogPath))
    } catch {
      // Evidence rotation is best effort and never authority.
    }
  }

  async readRunEvents({ limit = 100 } = {}) {
    try {
      const lines = (await fs.readFile(this.runLogPath, 'utf8')).split('\n').filter(Boolean)
      return lines.slice(-limit).flatMap((line) => {
        try { return [JSON.parse(line)] } catch { return [] }
      })
    } catch (error) {
      if (error.code === 'ENOENT') return []
      failLoud(`read ${this.runLogPath}`, error)
    }
  }
}

Object.assign(JobStore.prototype, storeMigrationMethods)
