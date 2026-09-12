/**
 * PRODUCT_API_AUTHENTICATION_V1 — Tailnet-local Mobile history identity Child.
 *
 * Auth-only admission for the dedicated history-only Tailnet listener
 * (HISTORY_LISTENER): authenticate caller (direct socket peer → canonicalize →
 * tailscaled LocalAPI WhoIs → `Node.StableID`), validate the exact configured
 * `(tailscaleStableNodeId, surfaceId)` pair, output the trusted authContext.
 *
 * Frozen boundaries: AUTH_LAYER_READS_BINDING = NO / BINDING_READ_OWNER =
 * HISTORY_ONLY (CTR-PA-006 — this layer never reads Binding, never compares
 * path agentId, never touches Session); DENIAL = exact 403/503 bipartition
 * (CTR-PA-007, no implementation choice); config = single out-of-Git file,
 * closed schema, restart-only immutable generation (CTR-PA-005 / CTR-PA-010);
 * log allowlist only (CTR-PA-011). Tailscale identity revision pinned:
 * TAILSCALE_REVISION_OR_VERSION = 1.94.2 (2de4d317a8c2595904f1563ebd98fdcf843da275),
 * stable field `WhoIsResponse.Node.StableID` (`tailcfg.StableNodeID`), never
 * the transient `Node.ID`.
 */

import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, constants as fsConstants } from 'node:fs'
import { isIPv4 } from 'node:net'

/** Surface header (CTR-PA-003): canonical lowercase UUID v4, byte-exact. */
export const SURFACE_HEADER = 'x-agentcore-surface-id'
const SURFACE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Frozen config schema constants (CTR-PA-005). */
export const AUTH_PROFILE_NAME = 'local-tailnet-mobile-history-v1'
export const PRINCIPAL_TYPE = 'mobile_tailnet_node'

/** Frozen denial codes (CTR-PA-007). */
export const FORBIDDEN = 'PRODUCT_API_AUTH_FORBIDDEN'
export const NOT_READY = 'PRODUCT_API_AUTH_NOT_READY'

/** Platform-default tailscaled LocalAPI unix socket paths. */
const DEFAULT_TAILSCALED_SOCKETS = {
  darwin: '/var/run/tailscaled.socket',
  linux: '/var/run/tailscale/tailscaled.sock',
}

export const sha256Hex = (value) => createHash('sha256').update(value).digest('hex')

export const isCanonicalSurfaceId = (value) =>
  typeof value === 'string' && value.length === 36 && SURFACE_ID_RE.test(value)

/**
 * CTR-PA-013 peer-address canonicalization. Input is the accepted socket's
 * remote peer address (port already separate in Node). Returns
 * `{ ok: true, canonical }` or `{ ok: false, unknown: true }` — a zoned or
 * non-IP-literal address can never be a tailnet Node (unknown → 503 class).
 * IPv4-mapped IPv6 is unmapped; IPv6 output is RFC 5952 lowercase compressed;
 * comparisons and the WhoIs query use only the canonical form.
 */
export function canonicalizePeerAddress(remoteAddress) {
  if (typeof remoteAddress !== 'string' || remoteAddress === '') return { ok: false, unknown: true }
  if (remoteAddress.includes('%')) return { ok: false, unknown: true } // scope zone → not a Node address
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(remoteAddress)
  const candidate = mapped ? mapped[1] : remoteAddress
  if (isIPv4(candidate)) {
    const octets = candidate.split('.').map((o) => String(Number.parseInt(o, 10)))
    if (octets.some((o) => o === 'NaN' || Number(o) > 255)) return { ok: false, unknown: true }
    return { ok: true, canonical: octets.join('.'), ipv4: true }
  }
  const groups = parseIpv6Groups(candidate)
  if (groups === null) return { ok: false, unknown: true }
  return { ok: true, canonical: formatIpv6Canonical(groups), ipv4: false }
}

/** Parse textual IPv6 into exactly 8 numeric groups, or null. */
function parseIpv6Groups(text) {
  const parts = text.split('::')
  if (parts.length > 2) return null
  const head = parts[0] === '' ? [] : parts[0].split(':')
  const tail = parts.length === 2 ? (parts[1] === '' ? [] : parts[1].split(':')) : []
  if (parts.length === 1 && head.length !== 8) return null
  if (head.some((g) => g.includes(':')) || tail.some((g) => g.includes(':'))) return null
  const gap = 8 - head.length - tail.length
  if (gap < (parts.length === 2 ? 1 : 0)) return null
  const groups = []
  for (const group of [...head, ...new Array(Math.max(gap, 0)).fill('0'), ...tail]) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null
    groups.push(Number.parseInt(group, 16))
  }
  return groups
}

/** RFC 5952: lowercase, leading zeros stripped, longest zero-run compressed. */
function formatIpv6Canonical(groups) {
  let bestStart = -1
  let bestLength = 0
  let currentStart = -1
  let currentLength = 0
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === 0) {
      if (currentStart === -1) currentStart = i
      currentLength += 1
      if (currentLength > bestLength) {
        bestStart = currentStart
        bestLength = currentLength
      }
    } else {
      currentStart = -1
      currentLength = 0
    }
  }
  const pieces = groups.map((g) => g.toString(16))
  if (bestLength >= 2) {
    const head = pieces.slice(0, bestStart).join(':')
    const tail = pieces.slice(bestStart + bestLength).join(':')
    return `${head}::${tail}`
  }
  return pieces.join(':')
}

/**
 * Load + validate the auth config ONCE (restart-only immutable generation,
 * CTR-PA-005). Every validation failure is PROFILE_NOT_READY (fail loud, no
 * silent degradation): missing file, permission wider than 0600, symlink,
 * non-regular file, foreign owner, bad JSON, unknown fields, duplicate pair,
 * empty allowlist, wrong version/profile, missing/empty generation.
 */
export function loadAuthConfigProfile(filePath) {
  const notReady = { ready: false }
  if (typeof filePath !== 'string' || filePath === '') return notReady
  let stats
  try {
    stats = lstatSync(filePath)
  } catch {
    return notReady
  }
  if ((stats.mode & fsConstants.S_IFMT) !== fsConstants.S_IFREG) return notReady // symlink/device/dir
  if ((stats.mode & 0o777) & ~0o600) return notReady // wider than 0600
  if (typeof process.getuid === 'function' && stats.uid !== process.getuid()) return notReady
  let parsed
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return notReady
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return notReady
  const allowedKeys = ['version', 'generation', 'profile', 'allowedCallers']
  if (Object.keys(parsed).some((key) => !allowedKeys.includes(key))) return notReady
  if (parsed.version !== 1) return notReady
  if (typeof parsed.generation !== 'string' || parsed.generation === '') return notReady
  if (parsed.profile !== AUTH_PROFILE_NAME) return notReady
  if (!Array.isArray(parsed.allowedCallers) || parsed.allowedCallers.length === 0) return notReady
  const pairs = new Map()
  for (const entry of parsed.allowedCallers) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return notReady
    if (Object.keys(entry).some((key) => key !== 'tailscaleStableNodeId' && key !== 'surfaceId')) return notReady
    const { tailscaleStableNodeId, surfaceId } = entry
    if (typeof tailscaleStableNodeId !== 'string' || tailscaleStableNodeId === '') return notReady
    if (!isCanonicalSurfaceId(surfaceId)) return notReady
    const key = `${tailscaleStableNodeId}\u0000${surfaceId}`
    if (pairs.has(key)) return notReady // duplicate pair
    pairs.set(key, true)
  }
  return {
    ready: true,
    pairs,
    generationDigest: sha256Hex(parsed.generation),
  }
}

/**
 * Extract the single surface header value (CTR-PA-003): exactly one field
 * line, no array (duplicate field line), canonical form byte-exact — no
 * trim/fold/case normalization exists on this path. Any violation is a 403.
 */
export function verifiedSurfaceId(headers) {
  const value = headers?.[SURFACE_HEADER]
  if (typeof value !== 'string' || !isCanonicalSurfaceId(value)) return null
  return value
}

/**
 * WhoIs the canonical peer IP through the tailscaled LocalAPI
 * (GET /localapi/v0/whois?addr=<canonical ip>) and extract the single stable
 * node identity `WhoIsResponse.Node.StableID`. Every transport failure,
 * timeout, HTTP error, malformed shape, missing Node or missing/empty StableID
 * is `{ ok: false }` (unknown → NOT_READY class) — never a known Node.
 */
export function createWhoIsResolver({
  socketPath,
  timeoutMs = 1500,
  transport,
} = {}) {
  const resolvedSocketPath = socketPath
    ?? DEFAULT_TAILSCALED_SOCKETS[process.platform]
    ?? DEFAULT_TAILSCALED_SOCKETS.linux

  async function resolveStableNodeId(canonicalIp) {
    const body = await transport({
      socketPath: resolvedSocketPath,
      path: `/localapi/v0/whois?addr=${encodeURIComponent(canonicalIp)}`,
      timeoutMs,
    })
    if (body === null) return { ok: false }
    let parsed
    try {
      parsed = JSON.parse(body)
    } catch {
      return { ok: false }
    }
    const node = parsed?.Node
    const stableId = node?.StableID
    if (node === null || typeof node !== 'object' || typeof stableId !== 'string' || stableId === '') {
      return { ok: false }
    }
    return { ok: true, stableNodeId: stableId }
  }

  return resolveStableNodeId
}

/** Default WhoIs HTTP-over-unix-socket transport (node:http, bounded). */
export function createNodeHttpWhoIsTransport() {
  // Late-bound to keep this module importable from pure unit tests.
  return async function transport({ socketPath, path, timeoutMs }) {
    const { default: http } = await import('node:http')
    return await new Promise((resolveRequest) => {
      let settled = false
      const finish = (value) => {
        if (!settled) {
          settled = true
          resolveRequest(value)
        }
      }
      const request = http.request({ socketPath, path, method: 'GET' }, (response) => {
        const chunks = []
        let size = 0
        response.on('data', (chunk) => {
          size += chunk.length
          if (size <= 1_000_000) chunks.push(chunk)
        })
        response.on('end', () => {
          if (response.statusCode !== 200) return finish(null)
          finish(Buffer.concat(chunks).toString('utf8'))
        })
        response.on('error', () => finish(null))
      })
      request.setTimeout(timeoutMs, () => {
        request.destroy()
        finish(null)
      })
      request.on('error', () => finish(null))
      request.end()
    })
  }
}

/**
 * CTR-PA-006 admission, in the frozen order. `profile` is the loaded config
 * generation; `routeClass` non-null marks a request matching the history route
 * class (selector-agnostic). Output is exactly allow / forbidden / not_ready —
 * the auth layer produces no other status on profile-matched requests, and on
 * denial it never reads Session, spawns an Agent, calls a model or mutates
 * Binding (CTR-PA-007 zero-side-effect invariants).
 */
export async function admitHistoryRequest({ routeClass, socket, headers, profile, resolveStableNodeId }) {
  // Step 1 — route class: on the HISTORY_LISTENER every request is admitted
  // into this profile; anything not matching the history class is 403 with no
  // further admission work (no unauthenticated behavior surface exists here).
  if (routeClass === null) return { decision: 'forbidden' }

  // Profile not ready (config absent/invalid/disabled fail-closed) → NOT_READY
  // for every class-matched request (CTR-PA-005 / CTR-PA-007).
  if (!profile.ready) return { decision: 'not_ready' }

  // Steps 2–5 — direct socket peer → canonicalize → WhoIs → StableID.
  const peer = canonicalizePeerAddress(socket?.remoteAddress)
  if (!peer.ok) return { decision: 'not_ready' }
  const whois = await resolveStableNodeId(peer.canonical)
  if (!whois.ok) return { decision: 'not_ready' }
  const { stableNodeId } = whois

  // Step 6 — surface header exact canonical encoding.
  const surfaceId = verifiedSurfaceId(headers)
  if (surfaceId === null) return { decision: 'forbidden' }

  // Step 7 — exact `(StableID, surfaceId)` pair; the transient Node.ID never
  // participates, and neither field alone authorizes (CTR-PA-004).
  if (!profile.pairs.has(`${stableNodeId}\u0000${surfaceId}`)) return { decision: 'forbidden' }

  // Step 8 — trusted authContext (CTR-PA-003): no StableID, no Node.ID, no
  // Binding data, no agentId authorization result, no Session data.
  return {
    decision: 'allow',
    authContext: {
      principalType: PRINCIPAL_TYPE,
      surfaceId,
      authProfile: AUTH_PROFILE_NAME,
      configGeneration: profile.generationDigest,
    },
  }
}
