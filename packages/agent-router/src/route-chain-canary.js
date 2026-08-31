/**
 * @agent-core/agent-router/src/route-chain-canary.js — the CTR-I2-015
 * controlled one-shot canary injection seam (IMPL V2; policy Parent V2
 * POL-V2-006/CANARY contracts of Activation V2 — referenced, never
 * redefined). Extracted from route-chain.js as a same-package module behind
 * the executor's single import so the frozen route-chain file stays within
 * the CODE_STRUCTURE_GUARDRAILS_V1 500-line limit; no other consumer exists
 * and no behavior was added or changed by the split.
 *
 * Default off (no runtimeRoot => the executor never constructs a seam, zero
 * filesystem activity). The descriptor is operator-installed while the
 * target admission is quiesced; this module only READS/validates/consumes —
 * deliberately NO install/clear API exists here, so the seam can never
 * become a general fault-injection surface. Consumption is the atomic
 * descriptor rename to the exact used-marker basename: only the rename
 * winner may activate the fixture, so a crash after rename can never
 * double-consume. The fixture never reads or writes credentials and never
 * contacts the real provider network.
 *
 * Fixed fixture carriers are also defined here: quota mode returns one
 * fixed structured terminal 429 (complete POL-V2-006 proof fields) at the
 * acquire/dispatch boundary before any generation; outcome_unknown mode
 * throws the STOP carrier before provider/model acquire.
 */

import { lstat, readFile, rename } from 'node:fs/promises'
import { join } from 'node:path'

export const CANARY_DESCRIPTOR_FILENAME = 'route-chain-canary-injection.json'
export const CANARY_DESCRIPTOR_MODES = Object.freeze([
  'provider_quota_rejected_before_generation',
  'outcome_unknown',
])
/** Creation-bound ceiling: now < expiresAt <= now + 5 minutes (RFC3339 UTC). */
export const CANARY_MAX_TTL_MS = 5 * 60_000

const CANARY_NONCE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/u
const CANARY_EXPIRES_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u
const CANARY_DESCRIPTOR_KEYS = Object.freeze([
  'version', 'agentId', 'routeRef', 'mode', 'nonce', 'expiresAt', 'maxUses', 'binding',
])
const CANARY_BINDING_KEYS = Object.freeze(['channel', 'senderOpenId', 'marker'])

function canaryInvalid(detail) {
  return Object.assign(
    new Error(`route-chain canary injection descriptor invalid: ${detail}`),
    { code: 'AGENT_ROUTE_CHAIN_CANARY_DESCRIPTOR_INVALID' },
  )
}

/** Fail-loud duplicate-JSON-key scan (JSON.parse silently keeps the last
 * duplicate — same discipline as the deployment config loader). */
function assertNoDuplicateCanaryKeys(source) {
  let index = 0
  const whitespace = () => { while (/\s/u.test(source[index] ?? '')) index += 1 }
  const string = () => {
    const start = index
    index += 1
    while (index < source.length) {
      if (source[index] === '\\') index += 2
      else if (source[index] === '"') { index += 1; return }
      else index += 1
    }
    throw canaryInvalid('unterminated JSON string')
  }
  const value = () => {
    whitespace()
    if (source[index] === '{') {
      index += 1
      whitespace()
      const keys = new Set()
      if (source[index] === '}') { index += 1; return }
      for (;;) {
        whitespace()
        const start = index
        string()
        const key = JSON.parse(source.slice(start, index))
        if (keys.has(key)) throw canaryInvalid(`duplicate JSON key ${JSON.stringify(key)}`)
        keys.add(key)
        whitespace()
        index += 1
        value()
        whitespace()
        if (source[index] === '}') { index += 1; return }
        index += 1
      }
    }
    if (source[index] === '[') {
      index += 1
      whitespace()
      if (source[index] === ']') { index += 1; return }
      for (;;) {
        value()
        whitespace()
        if (source[index] === ']') { index += 1; return }
        index += 1
      }
    }
    if (source[index] === '"') { string(); return }
    while (index < source.length && !/[\s,\]}]/u.test(source[index])) index += 1
  }
  value()
}

function exactCanaryKeys(value, expected, what) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw canaryInvalid(`${what} must be an object`)
  }
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (actual.length !== wanted.length || actual.some((key, i) => key !== wanted[i])) {
    throw canaryInvalid(`${what} exact keys are {${wanted.join(',')}} (got {${actual.join(',')}})`)
  }
}

/**
 * Exact-schema validation, all fail-loud (operator-owned closed input;
 * nothing silently skipped or overwritten). Expiry is NOT a schema violation
 * — an expired descriptor is a zero-effect ordinary turn per CTR-I2-015;
 * only the <=5-minute creation ceiling is structural.
 */
function parseCanaryDescriptor(source, { nowMs }) {
  let parsed
  try {
    parsed = JSON.parse(source)
  } catch (cause) {
    throw canaryInvalid(`cannot parse (${cause?.message ?? cause})`)
  }
  assertNoDuplicateCanaryKeys(source)
  exactCanaryKeys(parsed, CANARY_DESCRIPTOR_KEYS, 'descriptor')
  if (parsed.version !== 1) throw canaryInvalid(`version must be 1 (got ${JSON.stringify(parsed.version)})`)
  for (const field of ['agentId', 'routeRef', 'mode', 'nonce', 'expiresAt']) {
    if (typeof parsed[field] !== 'string' || parsed[field] === '') {
      throw canaryInvalid(`${field} must be a non-empty string`)
    }
  }
  if (!CANARY_DESCRIPTOR_MODES.includes(parsed.mode)) {
    throw canaryInvalid(`mode must be one of {${CANARY_DESCRIPTOR_MODES.join(',')}} (got ${JSON.stringify(parsed.mode)})`)
  }
  if (!CANARY_NONCE_PATTERN.test(parsed.nonce)) {
    throw canaryInvalid(`nonce must match ^[A-Za-z0-9_-]{16,64}$ (got ${JSON.stringify(parsed.nonce.slice(0, 16))}…)`)
  }
  if (parsed.maxUses !== 1) throw canaryInvalid(`maxUses must be exactly 1 (got ${JSON.stringify(parsed.maxUses)})`)
  if (!CANARY_EXPIRES_AT_PATTERN.test(parsed.expiresAt)) {
    throw canaryInvalid(`expiresAt must be canonical RFC3339 UTC YYYY-MM-DDTHH:mm:ssZ (got ${JSON.stringify(parsed.expiresAt)})`)
  }
  const expiresAtMs = Date.parse(parsed.expiresAt)
  if (Number.isNaN(expiresAtMs)) throw canaryInvalid(`expiresAt is not a valid date (${JSON.stringify(parsed.expiresAt)})`)
  if (expiresAtMs > nowMs + CANARY_MAX_TTL_MS) {
    throw canaryInvalid(`expiresAt exceeds the ${CANARY_MAX_TTL_MS / 1000}s creation ceiling (${parsed.expiresAt})`)
  }
  exactCanaryKeys(parsed.binding, CANARY_BINDING_KEYS, 'binding')
  if (parsed.binding.channel !== 'feishu') {
    throw canaryInvalid(`binding.channel must be "feishu" (got ${JSON.stringify(parsed.binding.channel)})`)
  }
  const { senderOpenId, marker } = parsed.binding
  if (typeof senderOpenId !== 'string' || senderOpenId === '' || senderOpenId.length > 256) {
    throw canaryInvalid('binding.senderOpenId must be a non-empty string of at most 256 chars')
  }
  const markerBytes = typeof marker === 'string' ? Buffer.byteLength(marker, 'utf8') : -1
  if (markerBytes < 1 || markerBytes > 128) {
    throw canaryInvalid('binding.marker must be non-empty UTF-8 of at most 128 bytes')
  }
  return Object.freeze({
    version: 1,
    agentId: parsed.agentId,
    routeRef: parsed.routeRef,
    mode: parsed.mode,
    nonce: parsed.nonce,
    expiresAt: parsed.expiresAt,
    expiresAtMs,
    maxUses: 1,
    binding: Object.freeze({ channel: 'feishu', senderOpenId, marker }),
  })
}

/** CTR-I2-015 fixture carriers — fixed structured responses fabricated at
 * the exact lifecycle boundary; closed structural proof fields only (no
 * network call, no credential access, no provider body). */
export function canaryQuotaFixtureError(descriptor) {
  return Object.assign(
    new Error(`controlled canary fixture (nonce ${descriptor.nonce}): terminal provider quota rejection (429) before generation`),
    {
      code: 'account_quota_exhausted',
      httpStatus: 429,
      envelope: 'failed',
      status: 'failed',
      canaryFixture: Object.freeze({ nonce: descriptor.nonce, mode: descriptor.mode }),
      canaryNonce: descriptor.nonce,
      evidence: Object.freeze({
        promptReceipt: 'accepted',
        httpStatus: 429,
        terminationProven: true,
        outputTokens: 0,
        partialOutput: false,
        assistantContent: false,
        toolCall: false,
        toolStarted: false,
        externalSideEffect: false,
        outcomeUnknown: false,
        transportTimeout: false,
      }),
    },
  )
}

export function canaryOutcomeUnknownFixtureError(descriptor) {
  return Object.assign(
    new Error(`controlled canary fixture (nonce ${descriptor.nonce}): outcome unknown before provider/model acquire`),
    {
      code: 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN',
      envelope: 'outcome_unknown',
      status: 'outcome_unknown',
      source: 'canary_fixture_outcome_unknown',
      canaryFixture: Object.freeze({ nonce: descriptor.nonce, mode: descriptor.mode }),
      canaryNonce: descriptor.nonce,
      evidence: Object.freeze({ outcomeUnknown: true }),
    },
  )
}

/** Per-mount seam: the atomic rename is the ONLY mutating primitive. */
export function createCanarySeam({ runtimeRoot, log }) {
  const descriptorPath = join(runtimeRoot, CANARY_DESCRIPTOR_FILENAME)
  const usedMarkerPath = (nonce) => join(runtimeRoot, `route-chain-canary-injection.used.${nonce}`)

  /**
   * Read + validate + (on exact binding match, still unexpired) consume the
   * descriptor for one logical-turn entry — BEFORE any process acquire.
   * Absent = ordinary fast path; binding mismatch / expiry = descriptor
   * untouched (zero effect); malformed / drift / collision = fail-loud.
   */
  async function bind({ agentId, primaryRouteRef, channel, senderOpenId, message }) {
    let stats
    try {
      stats = await lstat(descriptorPath)
    } catch (cause) {
      if (cause?.code === 'ENOENT') return { status: 'absent' }
      throw canaryInvalid(`cannot lstat descriptor (${cause?.code ?? cause?.message ?? cause})`)
    }
    if (!stats.isFile()) throw canaryInvalid('descriptor must be a regular file')
    if ((stats.mode & 0o777) !== 0o600) {
      throw canaryInvalid(`descriptor mode must be 0600 (got 0${(stats.mode & 0o777).toString(8)})`)
    }
    if (stats.uid !== process.geteuid?.()) {
      throw canaryInvalid('descriptor owner must be the runtime owner (uid mismatch)')
    }
    const nowMs = Date.now()
    const descriptor = parseCanaryDescriptor(await readFile(descriptorPath, 'utf8'), { nowMs })
    // Exact binding: target agent + primary route + feishu channel +
    // AUTHENTICATED sender id (never prompt self-report) + the WHOLE prompt
    // equal to the marker; expired-but-valid = zero-effect ordinary turn.
    if (descriptor.agentId !== agentId
        || descriptor.routeRef !== primaryRouteRef
        || descriptor.binding.channel !== channel
        || descriptor.binding.senderOpenId !== senderOpenId
        || descriptor.binding.marker !== message
        || descriptor.expiresAtMs <= Date.now()) {
      return { status: 'mismatch', descriptor }
    }
    // Exactly-once via atomic rename: pre-check refuses nonce-collision
    // overwrite; rename ENOENT = the one-shot race was lost, no injection.
    const usedPath = usedMarkerPath(descriptor.nonce)
    let usedExists = false
    try {
      await lstat(usedPath)
      usedExists = true
    } catch (cause) {
      if (cause?.code !== 'ENOENT') {
        throw canaryInvalid(`cannot lstat used marker (${cause?.code ?? cause?.message ?? cause})`)
      }
    }
    if (usedExists) throw canaryInvalid(`nonce collision: used marker already exists for nonce ${descriptor.nonce}`)
    try {
      await rename(descriptorPath, usedPath)
    } catch (cause) {
      if (cause?.code === 'ENOENT') return { status: 'lost-race' }
      throw canaryInvalid(`cannot atomically consume descriptor (${cause?.code ?? cause?.message ?? cause})`)
    }
    log.log(`route-chain canary injection consumed (nonce ${descriptor.nonce}, mode ${descriptor.mode})`)
    return { status: 'injected', descriptor }
  }

  return { bind, descriptorPath, usedMarkerPath }
}
