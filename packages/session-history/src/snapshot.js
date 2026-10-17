/**
 * Cold-read decode pipeline over one stable snapshot (MOBILE_SESSION_HISTORY_V1
 * CTR-SH-003 / CTR-SH-011 / CTR-SH-012): closed-shape v0 header, bounded
 * count-before-expand record decoding through the pinned DSH decoder, contiguous
 * zero-based seq envelope validation, incremental ceilings with a monotonic
 * deadline, torn-tail tolerance, committed-corruption fail-closure, and the
 * generation inputs (PREFIX_ANCHOR from the first complete record's exact bytes).
 */

import {
  decodeStorageRecord,
  expandedEventCount,
  sha256Hex,
  SESSION_FORMAT_VERSION,
} from './dsh-compat.js'
import { internalError, resourceLimit } from './errors.js'
import { createProjector } from './projection.js'
import {
  LOGICAL_MAIN,
  MAX_DECODE_WALL_TIME_MS,
  MAX_EXPANDED_EVENT_COUNT,
  MAX_RECORD_BYTES,
} from './constants.js'

const HEADER_ALLOWED_KEYS = new Set([
  'type', 'version', 'id', 'createdAt', 'delegationDepth', 'cwd', 'parentSession', 'agentPreset', 'origin', 'seedLength',
])

const safeNonNegativeInteger = (value) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0)

/**
 * Closed-header validation: only the known fields, `type = 'session'`,
 * `version = 0`, non-empty string `id`, non-negative safe integers
 * `createdAt`/`delegationDepth`/`seedLength`, optional string
 * `cwd`/`parentSession`/`agentPreset`, optional `origin = 'subagent'`.
 * Unknown fields, `-0` and invalid optional values are malformed
 * (committed corruption). The canonical main trajectory's header `id` MUST be
 * the literal `main` (CTR-SH-007 step 8).
 */
export function parseHeaderRecord(recordBytes) {
  if (recordBytes.length === 0 || recordBytes.at(-1) !== 0x0a) throw internalError()
  let parsed
  try {
    parsed = JSON.parse(recordBytes.subarray(0, -1).toString('utf8'))
  } catch {
    throw internalError()
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw internalError()
  for (const key of Object.keys(parsed)) {
    if (!HEADER_ALLOWED_KEYS.has(key)) throw internalError()
  }
  if (parsed.type !== 'session' || parsed.version !== SESSION_FORMAT_VERSION) throw internalError()
  if (typeof parsed.id !== 'string' || parsed.id === '') throw internalError()
  if (!safeNonNegativeInteger(parsed.createdAt) || !safeNonNegativeInteger(parsed.delegationDepth)) {
    throw internalError()
  }
  for (const key of ['cwd', 'parentSession', 'agentPreset']) {
    if (parsed[key] !== undefined && typeof parsed[key] !== 'string') throw internalError()
  }
  if (parsed.origin !== undefined && parsed.origin !== 'subagent') throw internalError()
  if (parsed.seedLength !== undefined && !safeNonNegativeInteger(parsed.seedLength)) throw internalError()
  if (parsed.id !== LOGICAL_MAIN) throw internalError()
  return parsed
}

/** Split one snapshot buffer into complete (newline-terminated) record slices. */
export function* iterateRecords(bytes) {
  let start = 0
  while (true) {
    const newline = bytes.indexOf(0x0a, start)
    if (newline === -1) break // torn tail (if any) is ignored — never repaired
    yield bytes.subarray(start, newline + 1)
    start = newline + 1
  }
}

const eventEnvelopeValid = (event) =>
  event !== null && typeof event === 'object'
  && typeof event.type === 'string' && event.type !== ''
  && safeNonNegativeInteger(event.seq)
  && safeNonNegativeInteger(event.time) && event.time <= 8_640_000_000_000_000
  && event.data !== null && typeof event.data === 'object'

/**
 * Decode + project one stable snapshot. Returns the validated header, the
 * PREFIX_ANCHOR (hex of the first complete record's exact bytes), the projected
 * messages ordered by authoritative seq, and aggregate stats for the allowlisted
 * request log. Every ceiling violation or committed corruption fails closed.
 */
export function decodeSnapshot(bytes, { monotonicNow = () => performance.now() } = {}) {
  const startedAtMs = monotonicNow()
  const records = iterateRecords(bytes)
  const first = records.next()
  if (first.done) throw internalError() // no complete header record → fail closed

  const header = parseHeaderRecord(first.value)
  const prefixAnchor = sha256Hex(first.value)
  const projector = createProjector()

  let expectedSeq = 0
  let expandedEventCountTotal = 0

  for (const recordBytes of records) {
    if (monotonicNow() - startedAtMs > MAX_DECODE_WALL_TIME_MS) throw resourceLimit()
    // Record-length ceiling BEFORE JSON parse (CTR-SH-011).
    if (recordBytes.length > MAX_RECORD_BYTES) throw resourceLimit()

    let parsed
    try {
      parsed = JSON.parse(recordBytes.subarray(0, -1).toString('utf8'))
    } catch {
      throw internalError() // invalid JSON on a newline-terminated line: committed corruption
    }

    // Count-before-expand: abort before the pinned decoder materializes an
    // over-ceiling expansion (CTR-SH-003 bounded decoder seam).
    const recordEventCount = expandedEventCount(parsed)
    if (expandedEventCountTotal + recordEventCount > MAX_EXPANDED_EVENT_COUNT) throw resourceLimit()

    let events
    try {
      events = decodeStorageRecord(parsed)
    } catch {
      throw internalError() // malformed storage row: committed corruption
    }

    for (const event of events) {
      if (!eventEnvelopeValid(event)) throw internalError()
      if (event.seq !== expectedSeq) throw internalError() // gap/duplicate: committed corruption
      expectedSeq += 1
      expandedEventCountTotal += 1
      projector.handleEvent(event, sha256Hex(recordBytes))
    }
  }

  const projected = projector.finalize().sort((a, b) => a.seq - b.seq)
  return {
    header,
    prefixAnchor,
    projected,
    stats: { artifactBytes: bytes.length, expandedEvents: expandedEventCountTotal },
  }
}
