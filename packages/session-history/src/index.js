/**
 * @agent-core/session-history — the minimal read-only backend history owner
 * (MOBILE_SESSION_HISTORY_V1, PREFLIGHT ownership ruling §3.1).
 *
 * Sole owner of raw DSH Session record reading and the allowlisted projection;
 * Product API is a thin adapter that only calls `listMessages({ authContext,
 * agentId, limit, before })` (the session selector is frozen to logical
 * `main` — never a caller parameter). Cold read only: no ensureRunning, no
 * spawn, no model call, no Session write, no second history store, no
 * logical→native mapping. The one Binding snapshot per request is taken here
 * (History is the only Binding reader, CTR-PA-006); the trusted authContext
 * arrives from the sibling auth Child and is consumed, never re-verified.
 */

import { resolveCanonicalTarget, readStableArtifact } from './locator.js'
import { decodeSnapshot } from './snapshot.js'
import { currentMainGenerationDigest, isWellFormedPublicMessageId, publicMessageId } from './ids.js'
import {
  agentNotFound,
  cursorStale,
  HistoryError,
  internalError,
  resourceLimit,
  sessionNotFound,
  validationError,
} from './errors.js'
import {
  LOGICAL_MAIN,
  MAX_CURSOR_BYTES,
  MAX_RESPONSE_MESSAGE_COUNT,
  MAX_TOTAL_PROJECTED_TEXT_BYTES_PER_RESPONSE,
} from './constants.js'

export { HistoryError }

const DEFAULT_LIMIT = 50
const MIN_LIMIT = 1
const MAX_LIMIT = 200

/**
 * Create the read-only history service.
 *
 * @param {object} deps
 * @param {object} deps.router - the Agent Router service (READ seams only:
 *   `channelConversationId` + `getBinding`; never ensureRunning or any mutation).
 * @param {object} deps.definition - the Agent Definition service (`getAgent`).
 * @param {(agentId: string) => string} deps.resolveAgentWorkspace - the
 *   workspace-bootstrap workspace resolution (the session `cwd` identity).
 * @param {(agentId: string) => string} deps.resolveAgentHome - the
 *   workspace-bootstrap DSH-home resolution.
 * @param {string} [deps.channel='mobile'] - the Product Surface channel tag.
 * @param {(canonicalHome: string) => string} [deps.sessionRootFor] - the
 *   configured Session root within the canonical Agent Home (default
 *   `<home>/sessions`, matching the production profile's
 *   `session-persistence-jsonl.root = dshHomePath('sessions')`).
 */
export function createSessionHistoryService({
  router,
  definition,
  channel = 'mobile',
  resolveAgentWorkspace,
  resolveAgentHome,
  sessionRootFor,
}) {
  if (router === undefined || definition === undefined) {
    throw new TypeError('session-history: router and definition services are required')
  }
  if (typeof resolveAgentWorkspace !== 'function' || typeof resolveAgentHome !== 'function') {
    throw new TypeError('session-history: resolveAgentWorkspace and resolveAgentHome injectors are required')
  }

  const ccIdFor = (surfaceId) => router.channelConversationId(channel, surfaceId)

  /** CTR-SH-001: exactly ONE authoritative Binding snapshot per request. */
  const readBindingOnce = (surfaceId) => router.getBinding(ccIdFor(surfaceId))

  function validateLimit(rawLimit) {
    if (rawLimit === undefined || rawLimit === null) return DEFAULT_LIMIT
    if (!Number.isInteger(rawLimit) || rawLimit < MIN_LIMIT || rawLimit > MAX_LIMIT) {
      throw validationError()
    }
    return rawLimit
  }

  function validateBefore(rawBefore) {
    if (rawBefore === undefined || rawBefore === null) return null
    if (typeof rawBefore !== 'string' || rawBefore === '') throw validationError()
    if (Buffer.byteLength(rawBefore, 'utf8') > MAX_CURSOR_BYTES) throw validationError()
    // Structural malformation (prefix/encoding/length) is a 400; well-formed
    // but absent from the current main trajectory is a 409 (CTR-SH-006).
    if (!isWellFormedPublicMessageId(rawBefore)) throw validationError()
    return rawBefore
  }

  const requireTrustedAuthContext = (authContext) => {
    if (authContext === null || typeof authContext !== 'object'
      || authContext.principalType !== 'mobile_tailnet_node'
      || typeof authContext.surfaceId !== 'string' || authContext.surfaceId === '') {
      throw internalError()
    }
    return authContext
  }

  /**
   * Read one page of the authenticated surface's current Binding Agent's
   * canonical `main` history. Frozen response shape:
   * `{ messages: [{ id, agentId, sessionId, role, content, createdAt }], hasMore }`.
   */
  async function listMessages({ authContext, agentId, limit: rawLimit, before: rawBefore } = {}) {
    const limit = validateLimit(rawLimit)
    const before = validateBefore(rawBefore)
    if (typeof agentId !== 'string' || agentId === '') throw validationError()
    requireTrustedAuthContext(authContext)

    // Ownership chain (CTR-SH-001): Binding snapshot → path agentId match →
    // Agent Definition → canonical main artifact. Absent Binding and
    // mismatched agent fail SESSION_NOT_FOUND without any artifact lookup.
    let binding
    try {
      binding = readBindingOnce(authContext.surfaceId)
    } catch {
      throw internalError()
    }
    if (binding === undefined || binding === null) throw sessionNotFound()
    // D-008 §18 accepted field name `activeAgent`; the Router Binding store
    // carries the same value under `activeAgentId`.
    if (agentId !== binding.activeAgentId) throw sessionNotFound()

    let agent
    try {
      agent = definition.getAgent(agentId)
    } catch (error) {
      // The Agent Definition service throws code AGENT_NOT_FOUND for unknown ids.
      if (error?.code === 'AGENT_NOT_FOUND') throw agentNotFound()
      throw internalError()
    }
    if (agent === undefined || agent === null) throw agentNotFound()

    const workspaceDir = resolveAgentWorkspace(agentId)
    const agentHome = resolveAgentHome(agentId)
    const { sessionRoot, artifactPath } = resolveCanonicalTarget({ agentHome, workspaceDir, sessionRootFor })
    const bytes = readStableArtifact(artifactPath, sessionRoot)
    const { header, prefixAnchor, projected, stats } = decodeSnapshot(bytes)

    // Deterministic public identities for this (header, first-record, content)
    // snapshot; an intra-snapshot collision is fail-closed INTERNAL_ERROR.
    const generationDigest = currentMainGenerationDigest(header, prefixAnchor)
    const ids = new Set()
    for (const message of projected) {
      message.id = publicMessageId({ agentId, generationDigest, role: message.role, rawId: message.rawId, recordDigest: message.recordDigest })
      if (ids.has(message.id)) throw internalError()
      ids.add(message.id)
    }

    // Exclusive-cursor pagination over the projected sequence (CTR-SH-006).
    let pool = projected
    if (before !== null) {
      const index = projected.findIndex((message) => message.id === before)
      if (index === -1) throw cursorStale()
      pool = projected.slice(0, index)
    }
    const page = pool.length > limit ? pool.slice(pool.length - limit) : pool
    const hasMore = pool.length > page.length

    if (page.length > MAX_RESPONSE_MESSAGE_COUNT) throw resourceLimit()
    let totalTextBytes = 0
    for (const message of page) {
      totalTextBytes += Buffer.byteLength(message.text, 'utf8')
      if (totalTextBytes > MAX_TOTAL_PROJECTED_TEXT_BYTES_PER_RESPONSE) throw resourceLimit()
    }

    return {
      messages: page.map((message) => ({
        id: message.id,
        agentId,
        sessionId: LOGICAL_MAIN,
        role: message.role,
        content: message.text,
        createdAt: new Date(message.time).toISOString(),
      })),
      hasMore,
      stats: {
        artifactBytes: stats.artifactBytes,
        projectedCount: projected.length,
        pageCount: page.length,
        expandedEvents: stats.expandedEvents,
      },
    }
  }

  return { listMessages }
}
