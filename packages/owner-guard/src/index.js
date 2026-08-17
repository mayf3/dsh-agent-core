/**
 * @agent-core/owner-guard — single-owner guard for the process-model demo.
 *
 * Enforces the "one Agent → one DSH process" write exclusivity contract at
 * process boot time: the first plugin to apply in the composition acquires an
 * exclusive owner lock (O_EXCL lock file) for the agent's home and keeps it
 * for the process lifetime; any second process booting the same agent home
 * fails fast with a loud error and never serves.
 *
 * Crash recovery: the lock records the holder's PID. A later boot that finds
 * a lock whose PID is no longer alive (kill -9, machine crash) treats it as
 * stale, removes it, and takes over — that is exactly the cold-resume path
 * after an evicted/dead owner.
 *
 * Known demo-grade caveats (documented in docs/history/reports/process-model-demo-v0.md):
 * - PID-liveness is the staleness test, so a recycled PID belonging to an
 *   unrelated live process would block takeover until it dies (production
 *   would use flock(2) or a supervisor registry).
 * - Unlink-on-exit is best-effort: SIGKILL leaves the file behind by design
 *   (that is what the stale path is for).
 *
 * Zero DSH dependencies on purpose: only node builtins, so the guard works in
 * any composition without extra package wiring.
 */

import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Stable plugin name referenced by bundle patches. */
export const name = 'demo-owner-guard'

/** No service dependencies: the guard must run before anything else mounts. */
export const inject = []

/** No config: the lock path is always `<DSH_HOME>/demo-owner.lock`. */

/** True when `pid` refers to a live process (ESRCH = dead, EPERM = alive). */
function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error?.code === 'ESRCH') return false
    return true // EPERM: exists but owned by another user — alive.
  }
}

/** Read the holder PID recorded in the lock file, or undefined when unreadable. */
function readHolderPid(lockPath) {
  try {
    const raw = readFileSync(lockPath, 'utf8')
    const pid = Number.parseInt(raw.trim().split('\n')[0] ?? '', 10)
    return Number.isSafeInteger(pid) && pid > 0 ? pid : undefined
  } catch {
    return undefined
  }
}

/** Acquire the owner lock; throws when another live process owns this home. */
function acquire(lockPath, logger) {
  const payload = `${process.pid}\n`
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      writeFileSync(lockPath, payload, { flag: 'wx', mode: 0o600 })
      logger?.info?.(`demo-owner-guard: acquired ${lockPath} (pid ${process.pid})`)
      return
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      const holderPid = readHolderPid(lockPath)
      if (holderPid === undefined) continue // vanished between write and read; retry
      if (holderPid === process.pid) return // re-entry inside this process
      if (pidAlive(holderPid)) {
        throw new Error(
          `demo-owner-guard: agent home is already owned by live process ${holderPid} `
          + `(lock ${lockPath}); refusing to start a second owner process`,
        )
      }
      logger?.warn?.(
        `demo-owner-guard: removing stale owner lock ${lockPath} held by dead pid ${holderPid}`,
      )
      try {
        unlinkSync(lockPath)
      } catch (unlinkError) {
        if (unlinkError?.code !== 'ENOENT') throw unlinkError
      }
    }
  }
  throw new Error(`demo-owner-guard: could not acquire owner lock ${lockPath}`)
}

/** Best-effort release: unlink only when this process still holds the lock. */
function release(lockPath) {
  try {
    if (readHolderPid(lockPath) === process.pid) unlinkSync(lockPath)
  } catch {
    // ENOENT already released; anything else is best-effort by contract.
  }
}

/**
 * Mount the guard: acquire synchronously (fail-fast before serving) and
 * release on teardown.
 * @param ctx - plugin context.
 */
export function apply(ctx) {
  const lockPath = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'demo-owner.lock')
  acquire(lockPath, ctx.logger)
  ctx.effect(() => () => release(lockPath))
}
