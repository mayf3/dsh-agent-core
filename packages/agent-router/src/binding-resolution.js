/**
 * @agent-core/agent-router/src/binding-resolution.js — Binding resolution
 * and the unified switch domain operation of the Router channel model
 * (D-002 + AGENT_CORE_BINDING_WORKSPACE_V1, extracted from src/index.js in
 * the PR #42 structure refactor — no semantic change).
 *
 *   Feishu conversation -> ChannelConversation -> Binding -> Agent + Session
 *
 * A Binding ties one ChannelConversation to one (Agent, Session) pair plus a
 * workspace triple. `workspace` is the stable effective workspaceId chosen
 * by the PRODUCT ENTRY and persisted mechanically here; null falls back to
 * the Default Workspace Rule resolveWorkspace(agentId). Workspace VALUES are
 * never derived in this module — only validated and persisted.
 */

import { channelConversationId, channelConversationIdOf } from './channel-conversation.js'

/**
 * Create the binding-resolution surface bound to one router mount.
 * @param {object} deps
 * @param {object} deps.agentDefinition - Agent Definition service (the single
 *   authority for which Agents exist).
 * @param {object} deps.workspaceBootstrap - workspace-bootstrap service
 *   (validateWorkspaceId / resolveWorkspacePath / resolveWorkspace).
 * @param {object} deps.store - BindingStore (durable Binding + bookmark +
 *   fresh-mapping tables).
 * @param {object} deps.cfg - validated router config (defaultAgentId,
 *   defaultSessionId).
 * @param {object} deps.log - structured logger.
 */
export function createBindingResolution({ agentDefinition, workspaceBootstrap, store, cfg, log }) {
  /**
   * Resolve an Agent reference to a defined Agent id — the Agent Definition
   * config is the single authority for "which Agents exist". Accepts the
   * opaque agentId (machine clients) or the display name (natural-language
   * surfaces like the DSH switch tool); anything else raises
   * `AGENT_NOT_FOUND` from the definition service.
   * @param {string} ref - agentId or display name.
   * @returns {{id:string, name:string}} the resolved Agent.
   */
  function resolveAgentRef(ref) {
    if (typeof ref !== 'string' || ref.trim() === '') {
      throw new TypeError('agent-router: targetAgentId must be a non-empty string')
    }
    return agentDefinition.resolveAgentRef(ref)
  }

  /**
   * The default Agent for first-contact bindings: the Agent Definition
   * config's default wins; the deployment config is the fallback and is
   * itself definition-validated.
   */
  function resolveDefaultAgent() {
    const configuredDefault = agentDefinition.getDefaultAgent()
    if (configuredDefault !== undefined) return configuredDefault
    if (cfg.defaultAgentId !== undefined && cfg.defaultAgentId !== '') {
      return resolveAgentRef(cfg.defaultAgentId)
    }
    throw new Error('agent-router: no default Agent (define an Agent in the Agent Definition config or set defaultAgentId)')
  }

  /**
   * Normalize an incoming Binding workspace value (from a product entry or
   * switchAgent opts) into the persisted form: a VALIDATED stable
   * workspaceId string, or null (= Default Workspace Rule). `undefined` means
   * "not provided" and is normalized by the CALLER (switchAgent preserves the
   * current value; first contact stores null). Structured rejection on any
   * invalid id — never truncated, never reshaped.
   * @param {string|null} workspace
   * @returns {string|null} the validated workspaceId (or null).
   */
  function bindingWorkspaceOf(workspace) {
    if (workspace === null || workspace === undefined) return null
    if (typeof workspace !== 'string') {
      throw Object.assign(new TypeError('agent-router: workspace must be a workspaceId string or null'), {
        code: 'WORKSPACE_ID_INVALID',
      })
    }
    return workspaceBootstrap.validateWorkspaceId(workspace)
  }

  /**
   * AGENT_CORE_BINDING_WORKSPACE_V1 Default Workspace Rule + §WorkspaceResolution:
   * resolve one Binding's effective workspace path — mechanical, no product
   * branches. `binding.workspace != null` -> resolveWorkspacePath(workspaceId)
   * (sanitize -> <workspaceRoot>/<id>); null -> the Agent default
   * resolveWorkspace(agentId). Only the PATH is derived here; which id a
   * binding holds was decided by the product entry.
   * @param {{activeAgentId:string, workspace?:string|null}} binding
   * @returns {{workspaceId:string|null, workspacePath:string}}
   */
  function resolveEffectiveWorkspace(binding) {
    if (binding.workspace !== null && binding.workspace !== undefined) {
      return {
        workspaceId: binding.workspace,
        workspacePath: workspaceBootstrap.resolveWorkspacePath(binding.workspace),
      }
    }
    return {
      workspaceId: null,
      workspacePath: workspaceBootstrap.resolveWorkspace(binding.activeAgentId),
    }
  }

  /**
   * Persist one binding row (creation or switch). `workspace` is the stable
   * effective workspaceId or null (Default Workspace Rule) — always
   * normalized here so a row can never enter the store half-specified.
   * @returns {Promise<object>} the stored row.
   */
  async function persistBinding({ channelConversationId, activeAgentId, activeSessionId, workspace = null }) {
    const row = {
      channelConversationId,
      activeAgentId,
      activeSessionId,
      workspace,
      updatedAt: new Date().toISOString(),
    }
    await store.set(row)
    return row
  }

  /**
   * D-002 contract endpoint #12 (in-process equivalent):
   * `PUT /v1/channel-conversations/resolve` semantics. Idempotent:
   * (channel, externalId) is the ChannelConversation identity. First contact
   * creates the ChannelConversation together with the initial Binding to the
   * default Agent + default Session (persisted); later contacts return the
   * existing ChannelConversation + Binding untouched.
   *
   * AGENT_CORE_BINDING_WORKSPACE_V1: `req.workspace` and `req.sessionId` are
   * the PRODUCT ENTRY's already-decided initial binding triple values (e.g.
   * the Feishu connector's conversation→workspace + conversation-scoped
   * main-session policy — group A binds session main-A in workspace
   * feishu-oc_A, so two groups of the same Agent never collapse onto one
   * native session across two workspaces). The Router only VALIDATES and
   * persists them mechanically — it never derives either value. Either
   * omitted => null workspace (Default Workspace Rule) and the deployment
   * default session (backward compatible, AC8). An existing Binding is
   * returned untouched (stability); the values are read only at first
   * contact.
   *
   * @param {object} req - { channel, externalId, workspace?, sessionId? }.
   * @returns {Promise<{channelConversation: {id, channel, externalId},
   *                     binding: {activeAgentId, activeSessionId,
   *                               workspace}}>}
   */
  async function resolveChannelConversation(req) {
    const channel = req?.channel
    const externalId = req?.externalId
    if (typeof channel !== 'string' || channel === '' || typeof externalId !== 'string' || externalId === '') {
      throw new TypeError('resolveChannelConversation: channel and externalId (non-empty strings) are required')
    }
    if (req?.sessionId !== undefined && (typeof req.sessionId !== 'string' || req.sessionId === '')) {
      throw new TypeError('resolveChannelConversation: sessionId must be a non-empty string')
    }
    const ccId = channelConversationId(channel, externalId)
    let binding = store.get(ccId)
    if (binding === undefined) {
      const agent = resolveDefaultAgent()
      const workspace = bindingWorkspaceOf(req?.workspace)
      binding = await persistBinding({
        channelConversationId: ccId,
        activeAgentId: agent.id,
        activeSessionId: req?.sessionId ?? cfg.defaultSessionId,
        workspace,
      })
      log.log(`binding created: channelConversation ${ccId.slice(0, 24)}... -> agent ${binding.activeAgentId} + session ${binding.activeSessionId} + workspace ${binding.workspace ?? '(agent default)'}`)
    }
    return {
      channelConversation: { id: ccId, channel, externalId },
      binding: {
        activeAgentId: binding.activeAgentId,
        activeSessionId: binding.activeSessionId,
        workspace: binding.workspace,
      },
    }
  }

  /**
   * THE unified Router domain operation — the single way to change which
   * Agent a conversation is talking to. Both entry points end up here:
   *
   *   Mobile UI manual tap -> Router.switchAgent
   *   DSH tool: switch_agent (via parent-RPC relay) -> Router.switchAgent
   *
   * Policy owned by the Router only: agent existence (Agent Definition), session
   * selection (explicit targetSessionId, else the per-surface bookmark — the
   * last Session this ChannelConversation used with the target Agent —
   * else the target Agent's `main`), Binding update + durable persistence.
   * The caller never touches the store, never resolves agents, never picks
   * sessions.
   *
   * Bookmark rule (Mobile Gate 1, M6): LEAVING records the current Session
   * as the single-slot bookmark for (surface, leaving agent); ENTERING
   * resumes `bookmark(surface, target) ?? main`. Bookmarks live in the
   * Binding store OUTSIDE the Binding rows (M9) and are persisted with it.
   *
   * @param {string | {channelConversationId?: string}} bindingContext - the
   *   ChannelConversation whose Binding changes.
   * @param {string} targetAgentId - a registered Agent's opaque id OR its
   *   display name (resolved through the Agent Definition by the Router).
   * @param {object} [opts]
   * @param {string} [opts.targetSessionId] - explicit target Session;
   *   omitted => bookmark(surface, target) ?? the Agent's `main` session.
   * @param {string|null} [opts.workspace] - AGENT_CORE_BINDING_WORKSPACE_V1:
   *   the target triple's workspaceId. A string is validated as a safe
   *   workspaceId (invalid => WORKSPACE_ID_INVALID structured reject, the
   *   Binding untouched). Omitted => the current Binding's workspace is
   *   PRESERVED (a Feishu group keeps its conversation workspace across
   *   in-group agent switches); `null` => explicit reset to the Default
   *   Workspace Rule (target Agent default). Workspace VALUES are decided by
   *   the product entry — this operation only validates and persists.
   * @returns {Promise<{channelConversationId:string, activeAgentId:string,
   *   activeSessionId:string, workspace:string|null,
   *   updatedAt:string}>} the new Binding.
   */
  async function switchAgent(bindingContext, targetAgentId, opts = {}) {
    const ccId = channelConversationIdOf(bindingContext)
    // 1. The Agent Definition config validates the target Agent exists.
    const agent = resolveAgentRef(targetAgentId)
    // 2. Router decides the target Session. A bare self-switch is a no-op
    //    (tapping the current Agent in the switcher must not move the
    //    conversation) — but an explicit targetSessionId or workspace makes
    //    it a real Binding update (a workspace change selects a different
    //    effective workspace for the same Agent).
    const current = store.get(ccId)
    if (current !== undefined && current.activeAgentId === agent.id
        && opts?.targetSessionId === undefined && opts?.workspace === undefined) {
      log.log(`switch: ${ccId.slice(0, 24)}... -> agent ${agent.id} (already bound; no-op)`)
      return { ...current }
    }
    if (opts?.targetSessionId !== undefined && (typeof opts.targetSessionId !== 'string' || opts.targetSessionId === '')) {
      throw new TypeError('agent-router: targetSessionId must be a non-empty string')
    }
    // 2b. Target triple's workspace: validate BEFORE any state changes so a
    //     rejected switch can never leave a half-written Binding (D-004
    //     atomicity preserved). undefined = preserve the current value.
    const workspace = opts?.workspace !== undefined
      ? bindingWorkspaceOf(opts.workspace)
      : (current?.workspace ?? null)
    // 3. LEAVING: remember the current Session for the agent we are leaving
    //    (single-slot bookmark, outside the Binding row).
    if (current !== undefined && current.activeAgentId !== agent.id) {
      await store.setLastSession(ccId, current.activeAgentId, current.activeSessionId)
      log.log(`bookmark: ${ccId.slice(0, 24)}... x ${current.activeAgentId} -> session ${current.activeSessionId}`)
    }
    // 4. ENTERING: explicit targetSessionId > (same-Agent switch: keep the
    //    current session — only the workspace moves, so a workspace change on
    //    a frozen session surfaces the R3 mismatch instead of silently
    //    hopping sessions) > bookmark(surface, target) > the deployment
    //    default (`main`).
    const targetSessionId = opts?.targetSessionId
      ?? (current !== undefined && current.activeAgentId === agent.id
        ? current.activeSessionId
        : (store.getLastSession(ccId, agent.id) ?? cfg.defaultSessionId))
    // 5. Update the current Binding (create it when the conversation has no
    //    Binding yet — switching is also a legal first contact).
    const binding = await persistBinding({
      channelConversationId: ccId,
      activeAgentId: agent.id,
      activeSessionId: targetSessionId,
      workspace,
    })
    log.log(`switch: ${ccId.slice(0, 24)}... -> agent ${binding.activeAgentId} + session ${binding.activeSessionId} + workspace ${binding.workspace ?? '(agent default)'}`)
    // 6. Return the new Binding.
    return binding
  }

  /**
   * D-002 `getBinding`: the current Binding of a ChannelConversation, or
   * `undefined` when none exists yet (the D-002 404 BINDING_NOT_FOUND
   * equivalent — callers decide whether to switch or resolve first).
   */
  function getBinding(bindingContext) {
    const row = store.get(channelConversationIdOf(bindingContext))
    return row === undefined ? undefined : { ...row }
  }

  return {
    resolveAgentRef,
    resolveDefaultAgent,
    bindingWorkspaceOf,
    resolveEffectiveWorkspace,
    persistBinding,
    resolveChannelConversation,
    switchAgent,
    getBinding,
  }
}
