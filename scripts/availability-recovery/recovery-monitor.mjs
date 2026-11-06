#!/usr/bin/env node
/** #1257 R3: read-only consumer of the existing structured failure feed. */
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_TAIL_BYTES = 1_048_576
const MAX_LINE_BYTES = 65_536
const CHUNK_BYTES = 16_384
const STARTUP_CODES = new Set(['AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED', 'RECOVERY_STARTUP_BLOCKED'])
const STARTUP_REASONS = new Set(['durable_store_invalid', 'durable_store_unavailable', 'recovery_startup_blocked'])

function failureObservation(line) {
  // Accept the existing marker, optionally preceded by bounded logger labels.
  // Never search arbitrary message bodies for the words "outcome_unknown".
  const match = /^(?:\[[^\]\r\n]{1,128}\]\s*)*(?:ERROR\s+)?(?:(?:agent-router|router)\s+)?delivery-failure (\{.*\})$/u.exec(line)
  if (!match) return null
  let event
  try { event = JSON.parse(match[1]) } catch { return null }
  if (event?.kind !== 'delivery_failure' || event.category !== 'other'
      || !Number.isSafeInteger(event.sequence) || event.sequence < 1
      || !Number.isSafeInteger(event.tsWallMs) || event.tsWallMs < 0) return null
  if (STARTUP_CODES.has(event.code) && STARTUP_REASONS.has(event.reason)) {
    return { category: 'recoveryStartupBlocked', code: event.code, reason: event.reason }
  }
  if (event.code === 'AGENT_PROCESS_TURN_FENCED' && event.reason === 'unresolved_turn_fence') {
    return { category: 'outcomeUnknownFence', code: event.code, reason: event.reason }
  }
  return null
}

/** Counts observed blocked delivery events, not distinct active store fences.
 *  No durable store, remote destination, input log or service is mutated. */
export function createRecoveryLogMonitor({ logFile, notify, now = Date.now }) {
  if (typeof logFile !== 'string' || !isAbsolute(logFile) || typeof notify !== 'function') {
    throw Object.assign(new Error('ARGUMENTS_INVALID'), { code: 'ARGUMENTS_INVALID' })
  }
  let identity = null
  let offset = 0
  let generation = 0
  let partial = Buffer.alloc(0)
  let anchor = Buffer.alloc(0)
  let dropping = false
  let skippedInitialBytes = 0
  let oversizedLines = 0
  const counts = { recoveryStartupBlocked: 0, outcomeUnknownFence: 0 }
  const snapshot = () => ({ counts: { ...counts }, countScope: 'observed_blocked_delivery_events',
    generation, offset, skippedInitialBytes, oversizedLines, partialBytes: partial.length })
  function consume(bytes) {
    const joined = partial.length === 0 ? bytes : Buffer.concat([partial, bytes])
    partial = Buffer.alloc(0)
    let start = 0
    for (let end = joined.indexOf(10); end !== -1; end = joined.indexOf(10, start)) {
      const length = end - start
      if (!dropping && length <= MAX_LINE_BYTES) {
        const observation = failureObservation(joined.subarray(start, end).toString('utf8').replace(/\r$/u, ''))
        if (observation !== null) {
          counts[observation.category] += 1
          notify({ kind: 'recovery_governance_notice', ...observation, counts: { ...counts },
            countScope: 'observed_blocked_delivery_events', observedAtWallMs: now(), generation })
        }
      } else if (!dropping) oversizedLines += 1
      dropping = false
      start = end + 1
    }
    if (joined.length - start > MAX_LINE_BYTES) {
      if (!dropping) oversizedLines += 1
      dropping = true
    } else if (!dropping) partial = Buffer.from(joined.subarray(start))
  }
  function poll() {
    let fd
    try {
      fd = openSync(logFile, constants.O_RDONLY | constants.O_NOFOLLOW)
      const stat = fstatSync(fd)
      if (!stat.isFile()) throw new Error('not regular')
      const current = `${stat.dev}:${stat.ino}`
      let rewritten = false
      if (identity === current && stat.size >= offset && anchor.length > 0) {
        const check = Buffer.alloc(anchor.length)
        rewritten = readSync(fd, check, 0, check.length, offset - check.length) !== check.length
          || !check.equals(anchor)
      }
      if (identity !== current || stat.size < offset || rewritten) {
        const first = identity === null
        identity = current
        generation += 1
        offset = first ? Math.max(0, stat.size - MAX_TAIL_BYTES) : 0
        skippedInitialBytes = first ? offset : skippedInitialBytes
        partial = Buffer.alloc(0)
        anchor = Buffer.alloc(0)
        dropping = offset > 0
      }
      const until = Math.min(stat.size, offset + MAX_TAIL_BYTES)
      const buffer = Buffer.alloc(CHUNK_BYTES)
      while (offset < until) {
        const size = readSync(fd, buffer, 0, Math.min(buffer.length, until - offset), offset)
        if (size === 0) throw new Error('truncated during read')
        offset += size
        consume(buffer.subarray(0, size))
      }
      anchor = Buffer.alloc(Math.min(offset, 64))
      if (anchor.length > 0 && readSync(fd, anchor, 0, anchor.length, offset - anchor.length) !== anchor.length) {
        throw new Error('cursor changed during read')
      }
      return snapshot()
    } catch {
      throw Object.assign(new Error('MONITOR_LOG_UNAVAILABLE'), { code: 'MONITOR_LOG_UNAVAILABLE' })
    } finally { if (fd !== undefined) closeSync(fd) }
  }
  return { poll, snapshot }
}

async function main(argv) {
  if (argv.shift() !== 'monitor') throw new Error('ARGUMENTS_INVALID')
  let logFile
  let once = false
  let pollMs = 1000
  const seen = new Set()
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]
    if (!['--log', '--once', '--poll-ms'].includes(key) || seen.has(key)) throw new Error('ARGUMENTS_INVALID')
    seen.add(key)
    if (key === '--once') once = true
    else {
      const value = argv[++i]
      if (!value || value.startsWith('--')) throw new Error('ARGUMENTS_INVALID')
      if (key === '--log') logFile = value
      else if (!/^\d+$/u.test(value) || Number(value) < 20 || Number(value) > 60_000) throw new Error('ARGUMENTS_INVALID')
      else pollMs = Number(value)
    }
  }
  const monitor = createRecoveryLogMonitor({ logFile,
    notify: entry => process.stdout.write(`${JSON.stringify(entry)}\n`) })
  let stopped = false
  const stop = () => { stopped = true }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  try {
    do {
      const result = monitor.poll()
      if (once) {
        process.stdout.write(`${JSON.stringify({ kind: 'recovery_monitor_summary', ...result })}\n`)
        break
      }
      await new Promise(resolveWait => setTimeout(resolveWait, pollMs))
    } while (!stopped)
  } finally {
    process.removeListener('SIGTERM', stop)
    process.removeListener('SIGINT', stop)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { await main(process.argv.slice(2)) } catch (error) {
    const code = ['ARGUMENTS_INVALID', 'MONITOR_LOG_UNAVAILABLE'].includes(error?.code ?? error?.message)
      ? error.code ?? error.message : 'MONITOR_REFUSED'
    process.stderr.write(`recovery-monitor: ${code}\n`)
    process.exitCode = 1
  }
}
