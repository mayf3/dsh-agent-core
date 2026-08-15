/**
 * @agent-core/scheduler — persistent store.
 *
 * V1 persistence is deliberately simple and single-writer:
 *
 *   - `jobs.json`  — `{ version: 1, jobs: [...] }`, atomic replace (write tmp,
 *     fsync, rename), fail-loud. The Control Plane is the only writer; the
 *     thin CLI seam (scripts/agentcore-cron.mjs) opens the same file through
 *     the same atomic protocol, so a job added by a daemon while the Control
 *     Plane runs is picked up on the next reload (the engine re-reads the
 *     file when its mtime changes).
 *   - `runs.jsonl` — append-only run event log (started/finished), one line
 *     per event; bounded by an optional maxSizeBytes with truncation to the
 *     newest lines (default 10 MB). Evidence for restart behavior and a cheap
 *     run history without becoming a Workflow.
 *
 * No Redis / Kafka / distributed locks (documented decision D-005): the
 * deployment is one Control Plane process on one machine.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

export const STORE_VERSION = 1

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
   */
  constructor(filePath, opts = {}) {
    this.filePath = filePath
    this.runLogPath = opts.runLogPath ?? path.join(path.dirname(filePath), 'runs.jsonl')
    this.maxRunLogBytes = opts.maxRunLogBytes ?? 10 * 1024 * 1024
    this._cache = null
    this._mtimeMs = -1
    this._writeChain = Promise.resolve()
    this._tmpSeq = 0
  }

  get dir() {
    return path.dirname(this.filePath)
  }

  async _ensureDir() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await fs.mkdir(path.dirname(this.runLogPath), { recursive: true })
  }

  /** Atomically write the whole store. Never partially visible; serialized. */
  async persist(jobs) {
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
      this._cache = jobs
      this._mtimeMs = Date.now()
    })
    // keep the chain alive even when a persist fails (the caller still sees
    // the rejection through `run`)
    this._writeChain = run.catch(() => {})
    return run
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
    let raw
    try {
      raw = await fs.readFile(this.filePath, 'utf8')
    } catch (error) {
      failLoud(`read ${this.filePath}`, error)
    }
    let data
    try {
      data = JSON.parse(raw)
    } catch (error) {
      failLoud(`parse ${this.filePath}`, error)
    }
    const jobs = Array.isArray(data) ? data : Array.isArray(data?.jobs) ? data.jobs : []
    this._cache = jobs
    this._mtimeMs = stat.mtimeMs
    return JSON.parse(JSON.stringify(jobs))
  }

  /** Append one run event line (fire-and-forget durability: fsync before resolving). */
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
