/**
 * @agent-core/scheduler — cross-process owner lock (SIGKILL-safe).
 *
 * SCHEDULER_TIMEOUT_OUTCOME_V2 mutation-authority primitive; hardened by the
 * SIGKILL_LOCK_FILE_WINDOW fix (PR #71 audit):
 *
 *   ATOMIC IDENTITY PUBLISH — a lock artifact is created by writing the full
 *   owner identity ({pid, token, createdAtMs}) + fsync under a UNIQUE temp
 *   name, then publishing it with `link()`, which fails EEXIST iff the lock
 *   name is taken. There is NO reachable state where the lock path exists
 *   without complete parseable identity: a SIGKILL at any instant leaves
 *   either (a) only temp garbage (lock absent — the next owner acquires
 *   cleanly) or (b) a full-identity artifact whose dead owner is MECHANICALLY
 *   provable via pid liveness. The pre-fix two-step `open(wx)` + `writeFile`
 *   could strand an identity-less artifact that no process could prove dead,
 *   bricking the store (independently reproduced against the pre-fix code).
 *
 *   MECHANICAL-ONLY STALE VERDICT — a lock is reaped exclusively when
 *   `kill(pid, 0)` proves the owner dead (ESRCH). Time thresholds are NEVER
 *   a stale verdict; they only bound how long a contender waits before
 *   failing loud.
 *
 *   NO WRONGFUL SEIZURE — an artifact without parseable identity (foreign /
 *   legacy producers only; unreachable from this code) is never removed by
 *   this code: its owner cannot be proven dead, so acquisition fails loud
 *   with one bounded evidence event per attempt.
 *
 *   BOUNDED RECOVERY EVIDENCE — every actual reap appends one
 *   `lock_recovery` event through the injected evidence sink (runs.jsonl is
 *   size-bounded); the reap marker itself is an owner-carrying artifact
 *   created atomically, so a SIGKILL mid-reap can never strand an
 *   identity-less marker blocking future reapers.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function failLoud(context, error) {
  const wrapped = new Error(`scheduler lock: ${context}: ${error?.message ?? error}`)
  wrapped.cause = error
  throw wrapped
}

export class OwnerLock {
  /**
   * @param {string} lockPath
   * @param {object} [opts]
   * @param {number} [opts.timeoutMs] - give-up bound for acquisition (15s).
   * @param {Function} [opts.clock] - () => ms.
   * @param {Function} [opts.onEvidence] - bounded event sink (never throws).
   */
  constructor(lockPath, opts = {}) {
    this.lockPath = lockPath
    this.dir = path.dirname(lockPath)
    this.timeoutMs = opts.timeoutMs ?? 15_000
    this.clock = opts.clock ?? (() => Date.now())
    this.onEvidence = typeof opts.onEvidence === 'function' ? opts.onEvidence : () => {}
  }

  /** Mechanical owner liveness: true/false, or null when unverifiable. */
  ownerAlive(pid) {
    if (!Number.isSafeInteger(pid) || pid <= 0) return null
    try {
      process.kill(pid, 0)
      return true
    } catch (error) {
      if (error.code === 'ESRCH') return false
      if (error.code === 'EPERM') return true
      return null
    }
  }

  async _ensureDir() {
    await fs.mkdir(this.dir, { recursive: true })
  }

  async _syncDirBestEffort() {
    try {
      const handle = await fs.open(this.dir, 'r')
      try {
        await handle.sync()
      } finally {
        await handle.close().catch(() => {})
      }
    } catch {
      // best-effort durability for the link; never blocks locking
    }
  }

  /** Remove the artifact only if its content is still the observed bytes. */
  async _removeIfUnchanged(observedRaw) {
    let current
    try {
      current = await fs.readFile(this.lockPath, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') return true
      failLoud(`read lock ${this.lockPath}`, error)
    }
    if (current !== observedRaw) return false
    await fs.rm(this.lockPath, { force: true })
    return true
  }

  /**
   * Atomically create a lock artifact at `targetPath` carrying the full
   * `serialized` owner identity (see module doc).
   * @returns {boolean} true when THIS caller created it.
   */
  async _createArtifactAtomic(targetPath, serialized) {
    const tmpPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`
    try {
      const handle = await fs.open(tmpPath, 'wx')
      try {
        await handle.writeFile(serialized, 'utf8')
        await handle.sync()
      } finally {
        await handle.close()
      }
    } catch (error) {
      await fs.rm(tmpPath, { force: true }).catch(() => {})
      failLoud(`stage lock identity ${tmpPath}`, error)
    }
    try {
      await fs.link(tmpPath, targetPath)
    } catch (error) {
      await fs.rm(tmpPath, { force: true }).catch(() => {})
      if (error.code === 'EEXIST') return false
      failLoud(`publish lock artifact ${targetPath}`, error)
    }
    await fs.rm(tmpPath, { force: true }).catch(() => {})
    await this._syncDirBestEffort()
    return true
  }

  /** Reap a mechanically-proven-dead owner's artifact under a reap marker. */
  async _reapDead(observedRaw, deadPid) {
    const reaperPath = `${this.lockPath}.reap`
    // The reap marker is itself an owner-carrying artifact, created
    // atomically: a SIGKILL mid-reap can never strand an identity-less
    // marker that would block all future reapers.
    let created = await this._createArtifactAtomic(reaperPath, `${process.pid}\n`)
    if (!created) {
      // Marker taken. It may be a DEAD reaper's leftover — prove ITS owner
      // mechanically dead before reclaiming it (same identity discipline;
      // a live reaper's marker is respected, an unprovable one is not).
      const reclaimed = await this._reclaimDeadReaperMarker(reaperPath)
      if (!reclaimed) return false
      created = await this._createArtifactAtomic(reaperPath, `${process.pid}\n`)
      if (!created) return false
    }
    try {
      // Marker-holding re-verification: the marker must still carry THIS
      // process's identity immediately before the exclusive compare-remove.
      // (Layered guard: identity publish is atomic, reaping is pid-proven
      // and marker-exclusive; this re-check bounds any residual reclaim
      // race to an unrepresentable-narrow window and fails safe by abort.)
      let markerRaw
      try {
        markerRaw = await fs.readFile(reaperPath, 'utf8')
      } catch (error) {
        if (error.code === 'ENOENT') return false
        failLoud(`verify reap marker ${reaperPath}`, error)
      }
      if (markerRaw?.trim() !== String(process.pid)) return false
      const removed = await this._removeIfUnchanged(observedRaw)
      if (removed) {
        await this.onEvidence({
          ts: this.clock(),
          action: 'lock_recovery',
          lockPath: this.lockPath,
          deadPid: deadPid ?? null,
          reaperPid: process.pid,
          outcome: 'dead-owner-reaped',
        })
      }
      return removed
    } finally {
      await fs.rm(reaperPath, { force: true }).catch(() => {})
    }
  }

  /** Remove a reap marker ONLY when its recorded owner is provably dead. */
  async _reclaimDeadReaperMarker(reaperPath) {
    let markerRaw
    try {
      markerRaw = await fs.readFile(reaperPath, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') return true
      failLoud(`read reap marker ${reaperPath}`, error)
    }
    const markerPid = Number.parseInt(String(markerRaw).trim(), 10)
    if (!Number.isSafeInteger(markerPid) || markerPid <= 0) return false // unprovable: never touched
    if (this.ownerAlive(markerPid) !== false) return false              // live reaper at work
    let current
    try {
      current = await fs.readFile(reaperPath, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') return true
      failLoud(`re-read reap marker ${reaperPath}`, error)
    }
    if (current !== markerRaw) return false // marker changed under us
    await fs.rm(reaperPath, { force: true })
    await this.onEvidence({
      ts: this.clock(),
      action: 'lock_recovery',
      lockPath: reaperPath,
      deadPid: markerPid,
      reaperPid: process.pid,
      outcome: 'dead-reaper-marker-reclaimed',
    })
    return true
  }

  /**
   * Acquire the lock. Returns the owner token (needed for release/verify).
   * Fails loud after timeoutMs when the holder is alive or unverifiable;
   * identity-less foreign artifacts are NEVER seized (see module doc).
   */
  async acquire() {
    await this._ensureDir()
    const startedAt = Date.now()
    const owner = { pid: process.pid, token: randomUUID(), createdAtMs: Date.now() }
    const serialized = `${JSON.stringify(owner)}\n`
    let unverifiableReported = false
    for (;;) {
      if (await this._createArtifactAtomic(this.lockPath, serialized)) return owner.token
      let observedRaw
      try {
        observedRaw = await fs.readFile(this.lockPath, 'utf8')
      } catch (readError) {
        if (readError.code === 'ENOENT') continue
        failLoud(`read lock ${this.lockPath}`, readError)
      }
      let observed
      try { observed = JSON.parse(observedRaw) } catch { observed = null }
      if (observed !== null && Number.isSafeInteger(observed.pid) && observed.pid > 0) {
        // Mechanical owner liveness — the ONLY stale verdict; never time.
        if (this.ownerAlive(observed.pid) === false) {
          if (await this._reapDead(observedRaw, observed.pid)) continue
        }
      } else if (!unverifiableReported) {
        unverifiableReported = true
        await this.onEvidence({
          ts: this.clock(),
          action: 'lock_unverifiable',
          lockPath: this.lockPath,
          contentSnapshot: String(observedRaw).slice(0, 80),
          reason: 'lock artifact carries no parseable owner identity — death cannot be proven mechanically',
        })
      }
      if (Date.now() - startedAt > this.timeoutMs) {
        failLoud(`lock timeout on ${this.lockPath}`, new Error('held by a live or unverifiable owner'))
      }
      await sleep(25 + Math.floor(Math.random() * 50))
    }
  }

  /** Release only when the artifact still carries this process's token. */
  async release(token) {
    let raw
    try {
      raw = await fs.readFile(this.lockPath, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') return
      failLoud(`read lock for release ${this.lockPath}`, error)
    }
    let owner
    try { owner = JSON.parse(raw) } catch { owner = null }
    if (owner?.token !== token || owner?.pid !== process.pid) return
    await this._removeIfUnchanged(raw)
  }

  /** True iff the artifact still carries THIS process's token. */
  async isHeldBy(token) {
    let raw
    try {
      raw = await fs.readFile(this.lockPath, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') return false
      failLoud(`read lock for verify ${this.lockPath}`, error)
    }
    let owner
    try { owner = JSON.parse(raw) } catch { owner = null }
    return owner?.token === token && owner?.pid === process.pid
  }

  /** Acquire -> fn -> always release. */
  async runExclusive(fn) {
    const token = await this.acquire()
    try {
      return await fn()
    } finally {
      await this.release(token)
    }
  }
}
