/**
 * @agent-core/production-runtime/src/restart-boundary.js — the runtime-side
 * restart-boundary receipt (C11-R3, Product #426 DONE_WHEN A4).
 *
 * Whenever the old process is still observable (the graceful SIGTERM/SIGINT
 * controlled-stop path), the runtime persists an exact receipt of the
 * restart boundary into <root>/control/restart-boundary.jsonl: one
 * `quiesce_begin` line before the drain starts (the previous epoch, the
 * STARTUP/READY/REAP lifecycle slots, every unresolved handle class, the
 * in-flight scheduler occurrences) and one `quiesce_end` line after the
 * existing controlled shutdown settled everything it could. An emergency
 * cutover that kills the process mid-drain therefore still leaves the
 * begin-line evidence at the boundary.
 *
 * The receipt is EVIDENCE ONLY and strictly read-only over the recovery
 * store: the next startup's classification reads the durable
 * TurnReconciliationStore through the accepted startup machinery — never
 * the receipt (no new trust path), and quiescing NEVER stamps
 * `exitObservedAt` or any termination evidence (that fact exists only
 * through the exact child/generation real-exit observation path).
 */

import { appendFileSync, closeSync, constants, fstatSync, mkdirSync, openSync, readSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { readRestartDrainCensus } from './scheduler/restart-drain.js'

/**
 * Collect the runtime's own restart census: the epoch and admission state
 * from the Router's published runtime status, the non-EMPTY lifecycle slots
 * (STARTUP/READY/REAP) from the registry, and the shared durable census
 * (in-flight turn handles + in-flight scheduler occurrences + the
 * already-classified restart-lost set). The durable census is best-effort
 * here — a corrupt store is reported in the receipt, never thrown past the
 * controlled-stop path (startup fails closed on it anyway).
 */
export function collectRuntimeRestartCensus({ turnRecoveryStore, jobsStore, router, agentIds = [] } = {}) {
  let runtimeStatus = {}
  try {
    runtimeStatus = typeof router?.reconciliationRuntimeStatus === 'function'
      ? (router.reconciliationRuntimeStatus() ?? {})
      : {}
  } catch { /* the receipt reports what is observable */ }
  const slots = []
  for (const agentId of agentIds) {
    try {
      // The registry's real slot projection is { state: EMPTY|STARTUP|READY|REAP, ... }.
      const slot = typeof router?.lifecycleSlotSnapshot === 'function' ? router.lifecycleSlotSnapshot(agentId) : null
      if (slot?.state === undefined || slot.state === 'EMPTY') continue
      slots.push({
        agentId,
        slot: slot.state,
        generation: slot.generation ?? null,
        entryId: slot.entryId ?? null,
        cause: slot.cause ?? null,
      })
    } catch (error) {
      slots.push({ agentId, slot: 'unknown', error: String(error?.message ?? error) })
    }
  }
  let census
  try {
    census = readRestartDrainCensus({ turnRecoveryStore, jobsStore })
  } catch (error) {
    census = {
      epoch: null, inflightTurns: [], unresolvedLostTurns: [], inflightOccurrences: [],
      drained: false, censusError: String(error?.message ?? error),
    }
  }
  return {
    ...census,
    epoch: runtimeStatus.generationId ?? census.epoch ?? null,
    durableEpoch: census.epoch,
    routerHealth: runtimeStatus.health ?? null,
    businessAdmission: runtimeStatus.businessAdmission ?? null,
    slots,
  }
}

const RUNTIME_LABEL = 'system/ai.agent-core.runtime'
const unavailable = (reason, retryable = false) => Object.assign(new Error(`runtime restart exit proof unavailable: ${reason}`), { code: 'RESTART_EXIT_PROOF_UNAVAILABLE', retryable })
function instanceKey(instance) {
  if (!instance || !['pid', 'uid', 'gid'].every(key => Number.isSafeInteger(instance[key]) && instance[key] >= (key === 'pid' ? 1 : 0))
      || typeof instance.started !== 'string' || !Number.isFinite(Date.parse(instance.started))
      || typeof instance.program !== 'string' || !isAbsolute(instance.program)) throw unavailable('invalid native process identity')
  return JSON.stringify(['pid', 'uid', 'gid', 'started', 'program'].map(key => instance[key]))
}

function readBoundaryWindow(path, instance, prior = null) {
  let fd
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  } catch (error) {
    if (error.code === 'ENOENT' && prior === null) return { offset: 0, dev: null, ino: null }
    throw unavailable('boundary log unavailable', error.code === 'ENOENT')
  }
  try {
    const stat = fstatSync(fd)
    if (!stat.isFile() || stat.uid !== instance.uid || (stat.mode & 0o022) !== 0 || stat.nlink !== 1) throw unavailable('boundary log custody')
    if (prior === null) return { offset: stat.size, dev: stat.dev, ino: stat.ino }
    const size = stat.size - prior.offset
    if (size === 0) throw unavailable('awaiting fresh boundary receipts', true)
    if ((prior.ino !== null && (prior.ino !== stat.ino || prior.dev !== stat.dev)) || size < 0 || size > 8 * 1024 * 1024) throw unavailable('no bounded fresh boundary window')
    const bytes = Buffer.alloc(size)
    if (readSync(fd, bytes, 0, size, prior.offset) !== size || fstatSync(fd).size !== stat.size) throw unavailable('boundary changed during read')
    if (bytes.at(-1) !== 10) throw unavailable('incomplete boundary receipt', true)
    return bytes.toString('utf8').trim().split('\n').map(line => JSON.parse(line))
  } finally { closeSync(fd) }
}

function requireReadyStopCapability(ctx, instance, identity) {
  let fd
  try {
    fd = openSync(join(dirname(ctx.turnRecoveryStore), 'runtime-evidence.jsonl'), constants.O_RDONLY | constants.O_NOFOLLOW)
    const stat = fstatSync(fd)
    if (!stat.isFile() || stat.uid !== instance.uid || (stat.mode & 0o022) !== 0 || stat.nlink !== 1) throw unavailable('ready evidence custody')
    const deadline = performance.now() + (ctx.unloadTimeoutMs ?? 10_000)
    const bytes = Buffer.alloc(65536), decoder = new StringDecoder('utf8')
    let offset = 0, pending = '', dropping = false, found = false
    while (offset < stat.size) {
      if (performance.now() >= deadline) throw unavailable('ready evidence read exceeded existing unload budget')
      const size = readSync(fd, bytes, 0, Math.min(bytes.length, stat.size - offset), offset)
      if (size === 0) throw unavailable('ready evidence truncated')
      offset += size
      const lines = (pending + decoder.write(bytes.subarray(0, size))).split('\n')
      pending = lines.pop()
      if (dropping && lines.length > 0) { lines.shift(); dropping = false }
      for (const line of lines) {
        if (line.length > 65536) continue
        try {
          const entry = JSON.parse(line)
          if (entry.kind === 'ready' && entry.pid === instance.pid && entry.stopProof?.version === 1
              && instanceKey(entry.stopProof.instance) === identity) found = true
        } catch { /* unrelated/partial historical evidence never grants a capability */ }
      }
      if (pending.length > 65536 || dropping) { pending = ''; dropping = true }
    }
    if (!found) throw unavailable('exact running producer has no supported ready stop-proof capability; producer-first rollout required')
  } catch (error) {
    if (error.code === 'RESTART_EXIT_PROOF_UNAVAILABLE') throw error
    throw unavailable('ready stop-proof capability unavailable; predecessor left running')
  } finally { if (fd !== undefined) closeSync(fd) }
}

/** Bind the old native instance and a fresh append window before mutation. */
export function captureRuntimeStopProof(ctx, census) {
  if (typeof ctx.readRuntimeInstance !== 'function' || typeof ctx.readProcessInstance !== 'function'
      || typeof ctx.turnRecoveryStore !== 'string' || !isAbsolute(ctx.turnRecoveryStore)
      || typeof census?.epoch !== 'string' || census.epoch === '') throw unavailable('exact readback and durable census are required')
  const instance = ctx.readRuntimeInstance(RUNTIME_LABEL)
  const identity = instanceKey(instance)
  if (instance.uid !== ctx.authsvcUid || instance.gid !== ctx.authsvcGid) throw unavailable('unexpected native runtime principal')
  requireReadyStopCapability(ctx, instance, identity)
  const path = join(dirname(ctx.turnRecoveryStore), 'restart-boundary.jsonl')
  return { instance, identity, path, window: readBoundaryWindow(path, instance),
    lostHandles: new Set(census.unresolvedLostTurns.map(record => record.handle)) }
}

export function assertRuntimeStopProofCurrent(ctx, proof) {
  if (instanceKey(ctx.readRuntimeInstance(RUNTIME_LABEL)) !== proof.identity) throw unavailable('old runtime instance changed before stop')
}

/** Receipts are a restart barrier only; they never settle or mint exit evidence. */
function readRuntimeStopProof(ctx, proof, deadlineMono) {
  try {
    const entries = readBoundaryWindow(proof.path, proof.instance, proof.window)
    if (entries.length === 1 && entries[0].phase === 'quiesce_begin' && entries[0].pid === proof.instance.pid) throw unavailable('awaiting end receipt', true)
    if (entries.length !== 2) throw unavailable('ambiguous boundary receipts')
    const [begin, end] = entries
    const liveEpoch = begin.census?.epoch
    if (typeof liveEpoch !== 'string' || liveEpoch === '' || begin.phase !== 'quiesce_begin' || end.phase !== 'quiesce_end'
        || !entries.every(entry => entry.kind === 'restart_boundary' && entry.pid === proof.instance.pid
          && entry.census?.epoch === liveEpoch && ['SIGTERM', 'SIGINT'].includes(entry.signal))
        || end.stopResult !== 'stopped' || end.census.drained !== true
        || !['slots', 'inflightTurns', 'inflightOccurrences'].every(key => Array.isArray(end.census[key]) && end.census[key].length === 0)) throw unavailable('old runtime cleanup did not complete')
    const after = readRestartDrainCensus({ turnRecoveryStore: ctx.turnRecoveryStore, jobsStore: ctx.storePath })
    if (!after.drained || typeof after.epoch !== 'string' || after.epoch === '' || after.epoch !== end.census.durableEpoch
        || after.unresolvedLostTurns.some(record => !proof.lostHandles.has(record.handle))) throw unavailable('new unresolved work remains after stop')
    const remaining = deadlineMono - performance.now()
    if (remaining <= 0) throw unavailable('existing unload deadline expired before native readback')
    const current = ctx.readProcessInstance(proof.instance.pid, { timeoutMs: Math.ceil(remaining) })
    if (current !== null && instanceKey(current) === proof.identity) throw unavailable('old native process still exists', true)
    if (performance.now() >= deadlineMono) throw unavailable('native exit readback completed after existing unload deadline')
    return { instance: proof.instance, liveEpoch, durableEpoch: after.epoch }
  } catch (error) {
    if (error.code === 'RESTART_EXIT_PROOF_UNAVAILABLE') throw error
    throw unavailable('missing, invalid or unreadable stop evidence')
  }
}

export function verifyRuntimeStopProof(ctx, proof, deadlineMono) {
  for (;;) {
    const remaining = deadlineMono - performance.now()
    if (remaining <= 0) throw unavailable('existing unload deadline expired without completed stop proof')
    try { return readRuntimeStopProof(ctx, proof, deadlineMono) } catch (error) {
      if (error.retryable !== true) throw error
      const wait = Math.min(250, deadlineMono - performance.now())
      if (wait <= 0) throw error
      if (typeof ctx.waitAfterBootout === 'function') ctx.waitAfterBootout(wait)
      else Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait)
    }
  }
}

/**
 * Append one boundary receipt line (JSONL, bounded by the restart count).
 * Throws only on an invalid log path — callers on the stop path wrap this
 * best-effort and downgrade failures to evidence lines.
 */
export function appendRestartBoundaryReceipt({ boundaryLog, entry } = {}) {
  if (typeof boundaryLog !== 'string' || boundaryLog === '') {
    throw new TypeError('restart boundary receipt requires the layout boundary log path')
  }
  mkdirSync(dirname(boundaryLog), { recursive: true })
  appendFileSync(boundaryLog, `${JSON.stringify({ ...entry, ts: Date.now() })}\n`, { encoding: 'utf8' })
}
