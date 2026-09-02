/**
 * @agent-core/demo-server/src/session-seam.js — the session resolution seam.
 *
 * The per-session resolution logic behind `session/prompt`, extracted so the
 * AGENT_CORE_BINDING_WORKSPACE_V1 SESSION_WRITE_CONTRACT is unit-testable
 * without wiring process stdio:
 *
 *   R1  no persisted artifact -> create with meta:{cwd: resolvedCwd} — the
 *       ONLY creation contract; the effective workspace freezes into the
 *       session header at create time (DSH native: cwd is per-session meta,
 *       immutable afterwards).
 *   R2  artifact present -> resume it and NEVER re-pass meta:{cwd} (meta
 *       never overwrites an existing header); verify the persisted
 *       header.cwd equals the Router-resolved effective workspace.
 *   R3  persisted cwd != resolved workspace -> structured
 *       SESSION_WORKSPACE_MISMATCH rejection: the cwd stays as persisted,
 *       the message is never queued, no second session is created, no
 *       silent rebinding ever happens.
 *
 * The seam is dependency-injected: `ctx` supplies the DSH services
 * (loader / agentLoop / sessionPersistence / agents) exactly like the plugin
 * context does, and `settings` exposes the initialize-time process-level
 * values (cwd / provider / model / maxTokens) through getters so the live
 * plugin's mutable state is observed at call time. A caller that omits
 * `resolvedCwd` (e.g. scheduler-router turns) falls back to the
 * process-level initialize cwd — exactly the value such sessions were
 * created with.
 */

import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'

/** Structured rejection code (cross-workspace session mismatch, R3). */
export const SESSION_WORKSPACE_MISMATCH = 'SESSION_WORKSPACE_MISMATCH'

/**
 * Build the session seam.
 *
 * @param {object} options
 * @param {object} options.ctx - service context exposing get('loader' |
 *   'agentLoop' | 'sessionPersistence' | 'agents').
 * @param {{cwd:string, provider:string, model:string,
 *   maxTokens?:number}} options.settings - initialize-time values (getters).
 * @returns {{handles:Map, pendingCreations:Map, getOrCreateSession, prompt,
 *   assertSessionCwd}}
 */
export function createSessionSeam({ ctx, settings }) {
  const handles = new Map() // sessionId -> AgentHandle
  const pendingCreations = new Map() // sessionId -> Promise<AgentHandle>

  /**
   * R2/R3 check: a persisted/live session's frozen header.cwd must equal the
   * resolved effective workspace, else the turn is structurally rejected —
   * the cwd is never silently switched and the session is left untouched.
   */
  function assertSessionCwd(sessionId, handle, effectiveCwd) {
    const persistedCwd = handle?.agent?.session?.header?.cwd
    if (persistedCwd !== effectiveCwd) {
      throw Object.assign(
        new Error(
          `demo-server: session ${sessionId} workspace mismatch `
          + `(persisted cwd=${persistedCwd ?? '(none)'}, resolved workspace=${effectiveCwd}); `
          + `cwd is immutable — select or create a compatible session instead`,
        ),
        { code: SESSION_WORKSPACE_MISMATCH },
      )
    }
  }

  /**
   * Resume an existing persisted session, or create a fresh one, enforcing
   * the SESSION_WRITE_CONTRACT (R1/R2/R3 above).
   * @param {string} sessionId
   * @param {string|undefined} resolvedCwd - the Router-resolved effective
   *   workspace path for THIS session.
   */
  async function getOrCreateSession(sessionId, resolvedCwd) {
    const effectiveCwd = resolvedCwd ?? settings.cwd
    const existing = handles.get(sessionId)
    if (existing !== undefined) {
      // Hot path: the live handle already froze this session's cwd at
      // creation/resume — a different resolved workspace is an R3 mismatch.
      assertSessionCwd(sessionId, existing, effectiveCwd)
      return existing
    }
    const inFlight = pendingCreations.get(sessionId)
    if (inFlight !== undefined) {
      const handle = await inFlight
      assertSessionCwd(sessionId, handle, effectiveCwd)
      return handle
    }
    const creation = (async () => {
      await ctx.get('loader')?.await()
      // The include settles when every entry reached a terminal state, but a
      // service injected late (settings document publish, sibling rows) can
      // still be absent at settle time. Poll for the services this session
      // needs before touching the agent factory.
      const deadline = Date.now() + 30000
      while (ctx.get('agentLoop') === undefined || ctx.get('sessionPersistence') === undefined) {
        if (Date.now() > deadline) {
          throw new Error(
            `demo-server: agent factory or persistence never became available `
            + `(agentLoop=${ctx.get('agentLoop') !== undefined}, `
            + `sessionPersistence=${ctx.get('sessionPersistence') !== undefined})`,
          )
        }
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      const agents = ctx.get('agents')
      const persistence = ctx.get('sessionPersistence')
      if (agents === undefined || persistence === undefined) {
        throw new Error('demo-server: agents/persistence unavailable at prompt time')
      }
      const id = SessionId(sessionId)
      const agentOptions = {
        provider: settings.provider,
        model: settings.model,
        ...settings.maxTokens === undefined ? {} : { maxTokens: settings.maxTokens },
      }
      let resumed = false
      let eventCount = 0
      let handle
      const headers = await persistence.list()
      const header = headers.find(item => item.id === id)
      if (header !== undefined) {
        // R2: resume restores the PERSISTED header (meta:{cwd} is never
        // passed on resume — DSH has no runtime cwd mutation semantics).
        handle = await agents.resume({ resumeSessionId: id, agentOptions })
        resumed = true
        eventCount = handle.agent.session.seq
        // The resumed handle's header is the authority; compare it with the
        // Router-resolved effective workspace BEFORE any message is queued.
        // On mismatch the loaded handle is discarded (best effort) — the
        // persisted session itself stays untouched, cwd still as persisted.
        try {
          assertSessionCwd(sessionId, handle, effectiveCwd)
        } catch (error) {
          await handle.dispose?.().catch?.(() => {})
          throw error
        }
      }
      if (!resumed) {
        // R1: the only creation contract — the effective workspace freezes
        // into the new session's header at create time.
        handle = await agents.create({ sessionId: id, meta: { cwd: effectiveCwd }, agentOptions })
      }
      handles.set(sessionId, handle)
      process.stderr.write(
        `[demo-server] session ${sessionId} ${resumed ? 'resumed' : 'created'} (${eventCount} events) cwd=${effectiveCwd}\n`,
      )
      return handle
    })()
    pendingCreations.set(sessionId, creation)
    void creation.then(
      () => { pendingCreations.delete(sessionId) },
      () => { pendingCreations.delete(sessionId) },
    )
    return creation
  }

  /**
   * AGENT_CORE_AGENT_SESSION_MESSAGING_V1 R4 — exact-allowlist validation of
   * the optional trusted inter-agent source sidecar carried as session/prompt
   * sibling metadata. Absent sidecar keeps the historical `source:
   * {kind:'user'}`; a malformed sidecar is a trusted-protocol violation and
   * rejects the prompt before any message is created.
   */
  function validateMessageOrigin(messageOrigin) {
    if (messageOrigin === undefined) return { kind: 'user' }
    if (messageOrigin === null || typeof messageOrigin !== 'object' || Array.isArray(messageOrigin)) {
      throw new TypeError('demo-server: messageOrigin must be an object when present')
    }
    const keys = Object.keys(messageOrigin)
    if (keys.length !== 3
      || !keys.includes('kind') || !keys.includes('sourceAgentId') || !keys.includes('correlation')) {
      throw new TypeError('demo-server: messageOrigin must be exactly { kind, sourceAgentId, correlation }')
    }
    if (messageOrigin.kind !== 'inter_agent') {
      throw new TypeError('demo-server: messageOrigin.kind must be "inter_agent"')
    }
    if (typeof messageOrigin.sourceAgentId !== 'string' || !/^agt_[a-z0-9-]+$/.test(messageOrigin.sourceAgentId)) {
      throw new TypeError('demo-server: messageOrigin.sourceAgentId must be an exact agt_* id')
    }
    if (typeof messageOrigin.correlation !== 'string' || messageOrigin.correlation === '') {
      throw new TypeError('demo-server: messageOrigin.correlation must be a non-empty opaque string')
    }
    return { kind: messageOrigin.kind, sourceAgentId: messageOrigin.sourceAgentId, correlation: messageOrigin.correlation }
  }

  /** Queue one user prompt on a session, creating or resuming it first. */
  async function prompt(sessionId, contentBlocks, resolvedCwd, messageOrigin = undefined) {
    const handle = await getOrCreateSession(sessionId, resolvedCwd)
    const source = validateMessageOrigin(messageOrigin)
    const message = createUserMessage({ content: contentBlocks, source })
    handle.agent.followup(message)
    return { messageId: message.id }
  }

  return { handles, pendingCreations, getOrCreateSession, prompt, assertSessionCwd, validateMessageOrigin }
}
