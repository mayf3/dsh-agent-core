/**
 * @agent-core/scheduler — persistent store with a single mutation authority.
 *
 * V1 persistence stays deliberately simple:
 *
 *   - `jobs.json`  — `{ version: 1, jobs: [...] }`, atomic replace (write tmp,
 *     fsync, rename), fail-loud.
 *   - `runs.jsonl` — append-only run event log, bounded by maxRunLogBytes
 *     (default 10 MB). Evidence for restart behavior, not a Workflow.
 *
 * MUTATION PROTOCOL (decision D-005 addendum, audit FIX 3/4):
 *
 *   Every mutation — from the resident Scheduler AND from the
 *   agentcore-cron CLI seam — must go through `mutate(fn)`:
 *
 *     cross-process lock (lockfile, O_EXCL, stale-break)
 *       -> re-read the LATEST store from disk
 *       -> apply only this mutation to the fresh array
 *       -> atomic persist
 *       -> release lock
 *
 *   Consequences:
 *     - a CLI `add/rm/enable/disable` can never be clobbered by the resident
 *       engine's stale whole-store snapshot, and vice versa (FIX 3);
 *     - a failed persist leaves BOTH the on-disk store and the caller's RAM
 *       untouched — the mutated array is a throwaway copy, committed only
 *       after the atomic write succeeds (FIX 4).
 *
 * No Redis / Kafka / DB / leader election: one machine, one lockfile.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

export const STORE_VERSION = 1

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function failLoud(context, error) {
  const err = new Error(`scheduler store: ${context}: ${error?.message ?? error}`)
  err.cause = error
  throw err
}

export class JobStore {
  /**
   * @param {string} filePath - jobs.json path (default ~/.agent-core/scheduler/jobs.json).
   * @param {object} [opts]
   * @param {string} [opts.runLogPath] - runs.jsonl path.
   * @param {number} [opts.maxRunLogBytes] - truncation bound for the run log.
   * @param {number} [opts.lockTimeoutMs] - max wait for the mutation lock (15s).
   * @param {number} [opts.lockStaleMs] - break a lock older than this (30s).
   */
  constructor(filePath, opts = {}) {
    this.filePath = filePath
    this.runLogPath = opts.runLogPath ?? path.join(path.dirname(filePath), 'runs.jsonl')
    this.maxRunLogBytes = opts.maxRunLogBytes ?? 10 * 1024 * 1024
    this.lockTimeoutMs = opts.lockTimeoutMs ?? 15_000
    this.lockStaleMs = opts.lockStaleMs ?? 30_000
    this.lockPath = `${filePath}.lock`
    this._cache = null
    this._mtimeMs = -1
    this._writeChain = Promise.resolve()
    this._mutexChain = Promise.resolve() // in-process FIFO for mutate() calls
    this._tmpSeq = 0
    /**
     * Test seam: when set, called right before the atomic rename inside
     * `mutate`; throwing here simulates a persist failure (FIX 4 tests).
     */
    this.beforeCommit = opts.beforeCommit ?? null
  }

  get dir() {
    return path.dirname(this.filePath)
  }

  async _ensureDir() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await fs.mkdir(path.dirname(this.runLogPath), { recursive: true })
  }

  // ── cross-process mutation lock ─────────────────────────────────────────

  /**
   * Exclusive lock (single machine): create `<jobs.json>.lock` with O_EXCL.
   * Held only for the duration of one mutate() — commits are short, so
   * holders never block each other for long. A lock older than lockStaleMs
   * (e.g. crashed holder) is broken and retried.
   */
  async _withLock(fn) {
    await this._ensureDir()
    const start = Date.now()
    for (;;) {
      let fh = null
      try {
        fh = await fs.open(this.lockPath, 'wx')
        await fh.writeFile(`${JSON.stringify({ pid: process.pid, ts: Date.now() })}\n`, 'utf8')
      } catch (error) {
        if (error.code !== 'EEXIST') failLoud(`acquire lock ${this.lockPath}`, error)
        // held by another writer: break stale locks, else wait and retry
        let stat = null
        try {
          stat = await fs.stat(this.lockPath)
        } catch {
          continue // holder just released; retry immediately
        }
        if (Date.now() - stat.mtimeMs > this.lockStaleMs) {
          await fs.rm(this.lockPath, { force: true }).catch(() => {})
          continue
        }
        if (Date.now() - start > this.lockTimeoutMs) {
          failLoud(`lock timeout on ${this.lockPath}`, new Error('held by another writer'))
        }
        await sleep(25 + Math.floor(Math.random() * 50))
        continue
      }
      try {
        return await fn()
      } finally {
        await fh.close().catch(() => {})
        await fs.rm(this.lockPath, { force: true }).catch(() => {})
      }
    }
  }

  // ── mutation authority ──────────────────────────────────────────────────

  /**
   * THE only mutation path. Contract:
   *
   *   fn(latestJobs) -> undefined | newArray | { jobs?, value? }
   *
   * `latestJobs` is a fresh deep copy read from disk under the lock; fn
   * mutates it in place (or returns a replacement array). After fn returns,
   * the array is persisted atomically; on success the store cache is updated
   * and `{ jobs, value }` is returned. Any throw (fn or the write) leaves
   * disk AND every caller's RAM untouched.
   *
   * SAME-PROCESS calls are serialized in FIFO call order (a promise chain)
   * before the cross-process file lock — the engine's own commits (e.g. a
   * completion) therefore always observe an earlier-enqueued domain op
   * (e.g. updateJob) instead of overtaking it. The file lock then only
   * arbitrates against OTHER processes, where any serialization order is
   * correct because every mutate re-reads the latest store first.
   */
  async mutate(fn) {
    const run = this._mutexChain.then(() => this._mutateLocked(fn))
    this._mutexChain = run.catch(() => {})
    return run
  }

  async _mutateLocked(fn) {
    return this._withLock(async () => {
      const latest = await this._loadFresh()
      let result = await fn(latest)
      let jobs = latest
      let value
      if (Array.isArray(result)) {
        jobs = result
      } else if (result !== undefined && result !== null && typeof result === 'object') {
        if (Array.isArray(result.jobs)) jobs = result.jobs
        value = result.value
      }
      if (typeof this.beforeCommit === 'function') this.beforeCommit() // test seam
      await this._writeAtomic(jobs)
      this._cache = jobs
      this._mtimeMs = Date.now()
      return { jobs, value }
    })
  }

  /** True when the store file exists (import guard / CLI checks). */
  async exists() {
    try {
      await fs.stat(this.filePath)
      return true
    } catch (error) {
      if (error.code === 'ENOENT') return false
      failLoud(`stat ${this.filePath}`, error)
    }
  }

  // ── low-level IO (internal; `mutate` is the mutation authority) ─────────

  async _loadFresh() {
    let raw
    try {
      raw = await fs.readFile(this.filePath, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') return []
      failLoud(`read ${this.filePath}`, error)
    }
    let data
    try {
      data = JSON.parse(raw)
    } catch (error) {
      failLoud(`parse ${this.filePath}`, error)
    }
    const jobs = Array.isArray(data) ? data : Array.isArray(data?.jobs) ? data.jobs : []
    return JSON.parse(JSON.stringify(jobs))
  }

  /** Atomic write of the whole store; serialized in-process. Never partially visible. */
  async _writeAtomic(jobs) {
    this._tmpSeq += 1
    const seq = this._tmpSeq
    const run = this._writeChain.then(async () => {
      await this._ensureDir()
      const tmp = `${this.filePath}.tmp-${process.pid}-${seq}-${Date.now()}`
      const payload = `${JSON.stringify({ version: STORE_VERSION, jobs }, null, 2)}\n`
      try {
        const fh = await fs.open(tmp, 'w')
        try {
          await fh.writeFile(payload, 'utf8')
          await fh.sync()
        } finally {
          await fh.close()
        }
        await fs.rename(tmp, this.filePath)
      } catch (error) {
        await fs.rm(tmp, { force: true }).catch(() => {})
        failLoud(`atomic write ${tmp} -> ${this.filePath}`, error)
      }
    })
    // keep the chain alive even when a write fails (the caller still sees
    // the rejection through `run`)
    this._writeChain = run.catch(() => {})
    return run
  }

  /**
   * Low-level atomic write of a full snapshot. DO NOT use for concurrent
   * mutation with a resident engine — use `mutate()` so the latest store is
   * re-read under the lock. Kept for tests, the import tool and repairs.
   */
  async persist(jobs) {
    await this._writeAtomic(jobs)
    this._cache = jobs
    this._mtimeMs = Date.now()
  }

  /**
   * Load jobs. `force` re-reads the file even when the mtime is unchanged.
   * Returns a fresh array of plain job objects (never the internal cache).
   */
  async load({ force = false } = {}) {
    let stat = null
    try {
      stat = await fs.stat(this.filePath)
    } catch (error) {
      if (error.code === 'ENOENT') return []
      failLoud(`stat ${this.filePath}`, error)
    }
    if (!force && this._cache !== null && stat.mtimeMs === this._mtimeMs) {
      return JSON.parse(JSON.stringify(this._cache))
    }
    const jobs = await this._loadFresh()
    this._cache = jobs
    this._mtimeMs = stat.mtimeMs
    return JSON.parse(JSON.stringify(jobs))
  }

  // ── run log (append-only evidence) ──────────────────────────────────────

  /** Append one run event line (durability: fsync before resolving). */
  async appendRunEvent(event) {
    await this._ensureDir()
    const line = `${JSON.stringify(event)}\n`
    try {
      const fh = await fs.open(this.runLogPath, 'a')
      try {
        await fh.writeFile(line, 'utf8')
        await fh.sync()
      } finally {
        await fh.close()
      }
    } catch (error) {
      // The run log must never take the scheduler down; job state is the
      // source of truth, the log is evidence only.
      return
    }
    await this._truncateRunLog()
  }

  async _truncateRunLog() {
    try {
      const stat = await fs.stat(this.runLogPath)
      if (stat.size <= this.maxRunLogBytes) return
      const fh = await fs.open(this.runLogPath, 'r')
      let tail
      try {
        const { buffer, bytesRead } = await fh.read(Buffer.alloc(this.maxRunLogBytes), 0, this.maxRunLogBytes, Math.max(0, stat.size - this.maxRunLogBytes))
        tail = buffer.subarray(0, bytesRead)
      } finally {
        await fh.close()
      }
      const firstNewline = tail.indexOf('\n')
      const keep = firstNewline >= 0 ? tail.subarray(firstNewline + 1) : tail
      const tmp = `${this.runLogPath}.tmp-${process.pid}-${Date.now()}`
      const out = await fs.open(tmp, 'w')
      try {
        await out.writeFile(keep)
        await out.sync()
      } finally {
        await out.close()
      }
      await fs.rename(tmp, this.runLogPath)
    } catch {
      // best effort; never throw from the log path
    }
  }

  /** Read the newest `limit` run events (newest first). */
  async readRunEvents({ limit = 100 } = {}) {
    try {
      const raw = await fs.readFile(this.runLogPath, 'utf8')
      const lines = raw.split('\n').filter(Boolean)
      const events = []
      for (const line of lines.slice(-limit)) {
        try {
          events.push(JSON.parse(line))
        } catch {
          // skip corrupt line
        }
      }
      return events
    } catch (error) {
      if (error.code === 'ENOENT') return []
      failLoud(`read ${this.runLogPath}`, error)
    }
  }
}
