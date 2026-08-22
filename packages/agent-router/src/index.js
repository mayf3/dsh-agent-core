/**
 * @agent-core/agent-router — the Agent Core Router / Control Plane.
 *
 * Channel model (D-002 AGENT_SESSION_CHANNEL_MODEL_V1):
 *
 *   Feishu conversation -> ChannelConversation -> Binding -> Agent + Session
 *
 * A ChannelConversation is the channel-side identity (e.g. the Feishu
 * conversationId + channel type). A Binding ties one ChannelConversation to
 * one (Agent, Session) pair. Product Integration V1 makes the Router the
 * SOLE owner of Bindings and gives the system ONE domain operation to change
 * them:
 *
 *   switchAgent(bindingContext, targetAgentId, { targetSessionId? })
 *
 * - the Agent Definition config validates that the target Agent exists;
 * - the Router decides the target Session (explicit targetSessionId, else
 *   the per-surface bookmark — the last Session this ChannelConversation
 *   used with the target Agent — else the Agent's `main`; Mobile Gate 1
 *   M6: "访问过该 Agent → lastActiveSession，否则 main");
 * - the Router updates and durably persists the Binding;
 * - the new Binding is returned.
 *
 * Entry points are interchangeable: the Feishu connector resolves its
 * ChannelConversation and dispatches through the very same domain
 * operations, and a future Mobile/Web Product API will call the same
 * `ctx.agentRouter` service. There is exactly one Router and one set of
 * routing rules — WebSocket / Feishu are only entry protocols.
 *
 * Bindings are persisted (atomic JSON, no DB) so the Control Plane can
 * restart and the conversation is still talking to the same Agent:
 * "切到 Agent B → Control Plane 重启 → 仍然是 Agent B".
 *
 * AGENT_CORE_BINDING_WORKSPACE_V1 (accepted): a Binding row additionally
 * carries `workspace` — the stable effective workspaceId chosen by the
 * PRODUCT ENTRY (Feishu conversation policy, App switch policy) and persisted
 * mechanically by the Router. Workspace *values* are never derived here: this
 * router only executes the triple Binding{agentId, workspaceId, sessionId}.
 * null (legacy / unset) falls back to the Default Workspace Rule
 * resolveWorkspace(agentId); an explicit workspaceId resolves through
 * workspace-bootstrap (sanitize → <workspaceRoot>/<id>) and is passed
 * per-session as the DSH session cwd (SESSION_WRITE_CONTRACT R1/R2/R3; a
 * cross-workspace mismatch is a structured rejection, never a silent cwd
 * switch). No product branch (if Feishu / if App) exists in this file.
 *
 * The Agent remains the fixed owner of its DSH_HOME / process /
 * memory; the channel is only an entry point. Routing a message means: look
 * up (or auto-create) the Binding for its ChannelConversation, resolve its
 * effective workspace, find-or-start the bound Agent's DSH process (one
 * process per Agent — the workspace varies per SESSION cwd, not per process),
 * and deliver the message into the bound session.
 *
 * The DSH-side switch tool (`agent_core.switch_agent`, package
 * @agent-core/agent-switch, mounted inside each per-agent process) is a thin
 * ADAPTER: it forwards the request over the demo-server parent-RPC relay to
 * this router's `switchAgent`. It owns none of the policy (persistence,
 * agent lookup, session selection, entry branching, history).
 */

import z from '@deepseek-ai/schemastery'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { AgentProcess, agentEnv, AGENT_CHILD_TMPDIR, RECOGNIZED_PROXY_ENV_KEYS } from './process.js'
import { BindingStore } from './binding-store.js'
import { provisionAgentHome } from '../../agent-provisioning/src/index.js'

/** Stable plugin name referenced by bundle patches. */
export const name = 'agent-router'

/** Hard service dependencies (framework-blessed ordering): Cordis waits
 *  until workspace-bootstrap and the Agent Definition are fully active
 *  before applying the router — the loader applies sibling rows
 *  concurrently, so a plain ctx.get at apply time would race. The Feishu
 *  channel stays OPTIONAL (ctx.get; no inject). */
export const inject = ['workspaceBootstrap', 'agentDefinition']

/** Router config. */
export const Config = z.object({
  /**
   * Default Agent for a brand-new ChannelConversation on first contact,
   * used only when the Agent Definition config reports no default Agent (the config's
   * default — the config defaultAgentId — is the primary answer; this config is the
   * deployment fallback). Must be a registered Agent id (or display name).
   */
  defaultAgentId: z.string(),
  /** Default Session inside the bound Agent (V1: 'main'). */
  defaultSessionId: z.string().default('main'),
  /**
   * Per-agent process profile (the resume-aware per-agent composition).
   * REQUIRED at spawn time (no library default — the deployment owns the
   * composition choice; PRODUCTION_RUNTIME_V1 removed the historical
   * 'agent-core-demo' fallback so the production path can never silently
   * boot a demo composition). Must be a known
   * @agent-core/agent-provisioning AGENT_PROFILE_DEFS entry.
   */
  agentProfile: z.string(),
  /**
   * ABSOLUTE JSON store path for the Binding table AND the per-surface
   * bookmark table AND the Delivery V0 fresh-mapping table (default
   * `<home>/.dsh/bindings/bindings.json` where home = $DSH_HOME or the OS
   * home). Relative / `~`-prefixed values are rejected fail-loud.
   */
  bindingsStoreFile: z.string(),
  // Runtime-only option (not in the schema — Config is documentation here):
  // `processFactory(opts) => proc` — per-agent process factory (test/ops
  // seam, defaults to AgentProcess). The proc must expose `spawn()`,
  // `ready()`, `deliver()`, `shutdown()` and the `pid`/`exit`/`exitPromise`
  // fields ensureRunning relies on. Unit tests inject a fake so the
  // admission path can be driven without real DSH children.
  // `resolveProcessConfig(agentId) => {provider, model, subscription?}` is a
  // synchronous composition-owned resolver. The Router does not parse model
  // config or select routes; it mechanically hands the already-resolved
  // process values to provisioning + AgentProcess.
  // `provisionHome` is a test seam (defaults to provisionAgentHome).
})

/** Default Binding store location: control-plane state under the shared home. */
export function defaultBindingsStoreFile() {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'bindings', 'bindings.json')
}

/** The tool method name per-agent processes use over the parent-RPC relay. */
export const SWITCH_RPC_METHOD = 'agent-core/switchAgent'

/**
 * The parent-RPC method for trusted Broker capability calls (relay ->
 * gateway). The child sends ONLY { capabilityId, operation, args }; the
 * caller identity is decided by the Router from the actual proc.agentId.
 * Kept in sync with packages/broker/src/relay.js (BROKER_RPC_METHOD).
 */
export const BROKER_RPC_METHOD = 'agent-core/broker'

/**
 * The ChannelConversation id for one (channel, externalId) pair — the
 * canonical `${channel}:${externalId}` form. Used by resolveChannelConversation
 * and by thin adapters (e.g. the Product API's surface mapping, M13:
 * `surfaceId -> ChannelConversation(channel='mobile', externalId=surfaceId)`)
 * so the id format has exactly one owner.
 * @param {string} channel - opaque channel id (feishu / mobile / …).
 * @param {string} externalId - channel-native conversation key (Feishu
 *   chatId, Android surfaceId, …).
 * @returns {string} the ChannelConversation id.
 */
export function channelConversationId(channel, externalId) {
  if (typeof channel !== 'string' || channel === ''
      || typeof externalId !== 'string' || externalId === '') {
    throw new TypeError('channelConversationId: channel and externalId (non-empty strings) are required')
  }
  return `${channel}:${externalId}`
}

/**
 * The BINDING NAMESPACE of one ingress (merge audit FIX 1, frozen semantics):
 * the Feishu connector classifies `ingress.channel` as the MESSAGE SUBTYPE
 * ('p2p' | 'group' | 'thread') — transport detail, never a Binding
 * namespace. Every Feishu ingress binds under 'feishu'
 * (`feishu:<conversationId>` durable Bindings keep matching; nothing is
 * migrated or orphaned). Only the mobile Product API entry carries its own
 * namespace ('mobile' -> `mobile:<surfaceId>`).
 * @param {{channel?: string}} ingress
 * @returns {string} 'feishu' | 'mobile'
 */
export function ingressBindingNamespace(ingress) {
  return ingress?.channel === 'mobile' ? 'mobile' : 'feishu'
}

/**
 * Whether this ingress belongs to the Feishu entry (and therefore owes a
 * Feishu reply): exactly the Feishu binding namespace. p2p/group/thread
 * subtypes all qualify; mobile Product API ingresses never do.
 * @param {{channel?: string}} ingress
 * @returns {boolean}
 */
export function feishuReplyOwed(ingress) {
  return ingressBindingNamespace(ingress) === 'feishu'
}

/**
 * Normalize a bindingContext into a ChannelConversation id. Accepts the raw
 * ccId string or the D-002-shaped `{ channelConversationId }` object so both
 * the connector (which knows the id) and a future Product API (which may
 * carry the full object) call the same domain operation.
 * @param {string | {channelConversationId?: string}} bindingContext
 * @returns {string} the ChannelConversation id.
 */
export function channelConversationIdOf(bindingContext) {
  const ccId = typeof bindingContext === 'string'
    ? bindingContext
    : bindingContext?.channelConversationId
  if (typeof ccId !== 'string' || ccId === '') {
    throw new TypeError('bindingContext must be a ChannelConversation id string or {channelConversationId}')
  }
  return ccId
}

/**
 * Mount the router: bind the feishu ingress callback (when the channel is
 * present), own the durable Binding table and the per-agent process
 * registry, and publish the `ctx.agentRouter` domain service.
 * @param ctx - plugin context.
 * @param config - validated router config.
 */
export function apply(ctx, config) {
  const cfg = { ...Config, ...(config ?? {}) }
  const log = {
    log: (...args) => process.stderr.write(`[router] ${args.join(' ')}\n`),
    error: (...args) => process.stderr.write(`[router] ERROR ${args.join(' ')}\n`),
  }

  const workspaceBootstrap = ctx.get('workspaceBootstrap')
  const agentDefinition = ctx.get('agentDefinition')
  const feishu = ctx.get('feishu')
  if (workspaceBootstrap === undefined) {
    throw new Error('agent-router: workspaceBootstrap service not available')
  }
  if (agentDefinition === undefined) {
    throw new Error('agent-router: agentDefinition service not available (mount @agent-core/agent-definition)')
  }

  const storeFile = cfg.bindingsStoreFile ?? defaultBindingsStoreFile()
  const store = new BindingStore({ storeFile })
  /** Per-agent process factory: default AgentProcess, injectable in tests. */
  const processFactory = typeof cfg.processFactory === 'function' ? cfg.processFactory : (opts) => new AgentProcess(opts)
  const resolveProcessConfig = typeof cfg.resolveProcessConfig === 'function'
    ? cfg.resolveProcessConfig
    : () => ({})
  const provisionHome = typeof cfg.provisionHome === 'function' ? cfg.provisionHome : provisionAgentHome

  /** agentId -> AgentProcess registry (one live owner per agent). */
  const registry = new Map()

  /** Delivery V0 acceptance log (evidence surface; in-memory only). */
  const deliveries = []

  log.log(`binding store loaded: ${store.list().length} binding(s) from ${storeFile}`)
  log.log(`delivery v0 fresh mapping table loaded: ${store.freshSessionsSnapshot().length} mapping(s)`)

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
   * selection (explicit targetSessionId, else the per-surface bookmark —
   * the last Session this ChannelConversation used with the target Agent —
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

  /**
   * DISABLED_ENFORCEMENT (merge review FIX 1): the Agent Definition config
   * is the ONLY authority for which agents may RUN. Unknown or disabled
   * agents get a structured rejection at the LIFECYCLE ENTRY — NEVER
   * spawned, not even when an existing Binding still points at them.
   * Existing bindings are left untouched (the Binding table keeps the
   * history); this only prevents the disabled agent from being (re)started.
   * The read is a synchronous in-memory lookup (the definition is loaded
   * once at construction) — no config/database I/O on the message hot path.
   * @param {string} agentId
   * @throws {Error} code `AGENT_NOT_FOUND` (unknown) or `AGENT_DISABLED`.
   */
  function assertRunnable(agentId) {
    const defined = agentDefinition.getAgent(agentId) // throws AGENT_NOT_FOUND when unknown
    if (defined.disabled === true) {
      throw Object.assign(new Error(`agent-router: agent ${agentId} is disabled (not runnable)`), { code: 'AGENT_DISABLED' })
    }
  }

  /** Find-or-start the agent's DSH process; never returns a dead one. */
  async function ensureRunning(agentId) {
    // Unified runnability enforcement FIRST: unknown / disabled -> structured
    // rejection -> NEVER spawn. Do NOT insert an await before the spawn
    // section (see the audit-round-3 double-spawn invariant below).
    assertRunnable(agentId)
    // INVARIANT (audit round 3): the FINAL check -> spawn -> registry.set
    // section below is ENTIRELY synchronous (the first await after it is
    // proc.ready()); JS single-threading therefore guarantees two concurrent
    // ensureRunning calls can never both pass that final registry check — no
    // double spawn (empirically verified: 30 concurrent calls -> 1 pid). The
    // workspace seed runs BEFORE the section (an await is allowed there); the
    // re-check right after it restores the invariant, so a concurrent spawn
    // that won the race while we were seeding is reused instead of doubled.
    const existing = registry.get(agentId)
    if (existing !== undefined && existing.exit === undefined) {
      log.log(`reuse process for ${agentId} (pid ${existing.pid})`)
      return existing
    }
    if (existing !== undefined) {
      registry.delete(agentId)
      log.log(`process for ${agentId} exited (${existing.exit?.code ?? 'signal'}); will respawn`)
    }
    // AGENT_WORKSPACE_PERSONA_PROVISIONING_AUDIT_V1 (SMALL_GAP) FIX: seed the
    // per-agent workspace (AGENTS.md + roots) on first start so the spawned
    // DSH process finds its own instruction surface before agent-instructions
    // renders its first baseline. Idempotent (never overwrites existing
    // files), safe on respawn and on control-plane restart. MUST NOT sit
    // between the final check and registry.set — that would break the
    // double-spawn invariant above.
    await workspaceBootstrap.ensure(agentId)
    const raced = registry.get(agentId)
    if (raced !== undefined && raced.exit === undefined) {
      log.log(`reuse process for ${agentId} after seed (pid ${raced.pid})`)
      return raced
    }
    // workspace-bootstrap is the single owner of the agentId -> workspace /
    // DSH_HOME mapping (D-002 boundary). The router only decides WHEN to
    // start the agent, not where its home lives — so it calls the service
    // without any root override.
    const workspace = workspaceBootstrap.resolveWorkspace(agentId)
    const home = workspaceBootstrap.resolveDshHome(agentId)
    const processConfig = resolveProcessConfig(agentId) ?? {}
    // Provision the agent home (settings/credentials/profile/plugin farm) and
    // the workspace directory — idempotent. The provisioning is driven by
    // cfg.agentProfile: whatever profile this router spawns must be fully
    // installed HERE, so a fresh Agent works without any external
    // pre-provisioning (FIX 1).
    provisionHome(home, workspace, {
      profile: cfg.agentProfile,
      ...(processConfig.subscription === undefined ? {} : { subscription: processConfig.subscription }),
    })
    const proc = processFactory({
      agentId,
      home,
      workspace,
      profile: cfg.agentProfile,
      provider: processConfig.provider,
      model: processConfig.model,
      providerEnv: processConfig.providerEnv,
      omitEnv: processConfig.omitEnv,
      log,
      // The per-agent process must know its own identity: the memory plugin
      // and the switch tool resolve agentId from $DSH_AGENT_ID when set.
      // DSH_PRIMARY_WORKSPACE (AGENT_PRIMARY_WORKSPACE_IMPORT_V1 §4) is the
      // SAME mechanical pass-through: the control plane's already-resolved
      // primary workspace (resolveWorkspace output above — the single path
      // authority). The Router only hands the value to the child process's
      // session-less memory resolution; it never re-derives the path and
      // never branches on it.
      env: { DSH_AGENT_ID: agentId, DSH_PRIMARY_WORKSPACE: workspace },
    })
    // DSH tool relay: a per-agent process asks the Control Plane to run a
    // Router domain operation (switch) or a trusted Broker capability call
    // (broker). The tool itself owns no policy — it forwards the request;
    // every decision happens here in the Router.
    proc.onRpcRequest = async (method, params) => {
      if (method === BROKER_RPC_METHOD) {
        // TRUSTED CREDENTIAL BROKER: the caller identity is THIS proc's
        // actual agentId (the trusted spawning relationship) — never
        // anything the child says. Forged self-reported fields are ignored.
        const selfReported = ['agentId', 'principalId', 'clientId', 'scope', 'audience', 'authorization']
          .filter((field) => params?.[field] !== undefined)
        if (selfReported.length > 0) {
          log.log(`[broker] agent ${agentId}: IGNORING child-supplied identity fields: ${selfReported.join(', ')}`)
        }
        const gateway = ctx.get('brokerGateway')
        if (gateway === undefined || typeof gateway.execute !== 'function') {
          return {
            ok: true,
            result: { ok: false, error: { code: 'invalid_arguments', detail: 'broker gateway unavailable in the control plane' } },
          }
        }
        log.log(`[broker] execute as agent ${agentId} (capability ${params?.capabilityId})`)
        // Transport envelope {ok:true, result:<invoke shape>}: the child's
        // relay unwraps it; failures stay STRUCTURED (the parent-RPC failure
        // channel only carries a message string, so the business envelope is
        // always delivered inside the success envelope).
        return {
          ok: true,
          result: await gateway.execute(
            { capabilityId: params?.capabilityId, operation: params?.operation, args: params?.args },
            { agentId }, // ACTUAL identity — decided here, never from params
          ),
        }
      }
      if (method !== SWITCH_RPC_METHOD) {
        throw new Error(`agent-router: unknown parent-RPC method ${method}`)
      }
      if (proc.activeBindingContext === undefined) {
        throw new Error('agent-router: no active binding context for this process (switch tool called outside a routed turn)')
      }
      return switchAgent(proc.activeBindingContext, params?.targetAgentId, {
        targetSessionId: params?.targetSessionId,
        workspace: params?.workspace,
      })
    }
    proc.spawn()
    registry.set(agentId, proc)
    // Reap on exit; the next message re-spawns and resumes.
    void proc.exitPromise.then(() => {
      if (registry.get(agentId) === proc) registry.delete(agentId)
    })
    await proc.ready()
    return proc
  }

  /**
   * Deliver one ingress message through the channel model:
   *   ChannelConversation -> Binding -> Agent + Session -> reply.
   * The Feishu Connector stays stateless: it only forwards the ingress; the
   * router resolves the binding and dispatches (D-002: the connector does not
   * persist Agent / Session state). Any future entry (Mobile/Web Product
   * Gateway) delivers through this same path.
   *
   * FROZEN NAMESPACE SEMANTICS (merge audit FIX 1): the Feishu connector
   * classifies ingress.channel as the MESSAGE SUBTYPE ('p2p' | 'group' |
   * 'thread') — transport detail, never a Binding namespace. The Binding
   * namespace for every Feishu ingress is 'feishu' (`feishu:<conversationId>`
   * durable Bindings keep matching; nothing is migrated or orphaned), and
   * only the mobile Product API entry uses its own namespace ('mobile',
   * `mobile:<surfaceId>`). Reply is owed exactly for the Feishu entry.
   * @param {object} ingress - { channel?, chatId, conversationId, sender,
   *   text }; channel absent => Feishu entry (legacy callers).
   * @returns {Promise<{reply:string, agentId:string, sessionId:string,
   *   pid?:number} | {error: Error}>} the delivery result.
   */
  async function onIngress(ingress) {
    const namespace = ingressBindingNamespace(ingress)
    const evSummary = `channel=${ingress.channel ?? '(none)'} chat=${ingress.chatId} sender=${ingress.sender?.openId?.slice(0, 6)} text="${(ingress.text ?? '').slice(0, 60)}"`
    const { channelConversation, binding } = await resolveChannelConversation({
      channel: namespace,
      externalId: ingress.conversationId,
      // The product entry's already-decided initial binding triple values
      // (opaque data here — the Router never derives workspace or session
      // values from channel identities).
      workspace: ingress.workspace,
      sessionId: ingress.session,
    })
    log.log(`channelConversation ${channelConversation.id.slice(0, 24)}... -> binding -> agent ${binding.activeAgentId} + session ${binding.activeSessionId} (${evSummary})`)
    const isFeishuEntry = feishuReplyOwed(ingress)
    try {
      // AGENT_CORE_BINDING_WORKSPACE_V1: resolve the Binding's effective
      // workspace and hand it to the turn as the SESSION cwd (R1 create /
      // R2 resume-compare / R3 mismatch reject — all enforced in the
      // demo-server session seam). A valid-but-missing workspace directory is
      // the normal bootstrap path (idempotent ensure, never a rejection).
      const { workspaceId, workspacePath } = resolveEffectiveWorkspace(binding)
      if (workspaceId !== null) {
        await workspaceBootstrap.ensureWorkspace(workspaceId)
      }
      const proc = await ensureRunning(binding.activeAgentId)
      const { reply } = await proc.turn(binding.activeSessionId, ingress.text ?? '', {
        // The turn belongs to this ChannelConversation: the DSH switch tool
        // inside the agent switches exactly this Binding.
        bindingContext: channelConversation.id,
        // The session's effective workspace cwd (per-session, NOT the
        // process-level cwd — one Agent stays one process across workspaces).
        cwd: workspacePath,
      })
      log.log(`agent ${binding.activeAgentId} (pid ${proc.pid}) replied: ${(reply ?? '').slice(0, 80)}`)
      // Feishu reply is the FEISHU entry's transport half; non-feishu
      // surfaces (mobile Product API) return the reply to their own caller.
      if (feishu !== undefined && isFeishuEntry) {
        // Reply to the originating message (in-thread automatically when the
        // ingress was a topic thread).
        await feishu.reply(feishu.replyTargetFor(ingress).replyTo(ingress.messageId), reply)
        log.log(`reply sent back to ${ingress.conversationId.slice(0, 12)}...`)
      }
      return { reply, agentId: binding.activeAgentId, sessionId: binding.activeSessionId, pid: proc.pid }
    } catch (error) {
      log.error(`delivery to ${binding.activeAgentId} failed: ${error?.message ?? error}`)
      if (feishu !== undefined && isFeishuEntry) {
        try {
          await feishu.reply(feishu.replyTargetFor(ingress).replyTo(ingress.messageId), `[agent-core] delivery failed: ${error.message ?? error}`)
        } catch { /* best effort */ }
      }
      return { error }
    }
  }

  /**
   * AGENT ROUTER DELIVERY V0 — the frozen admission interface:
   *
   *   deliver({ requestId, agentId, sessionMode: 'main'|'fresh', message })
   *     -> { accepted: true, sessionId }
   *
   * `accepted: true` means ONLY "the message entered the correct DSH
   * Session's inbox" — it NEVER waits for the agent turn / model round to
   * finish (the turn continues asynchronously). The admission seam is:
   *
   *   ensureRunning(agentId)           find-or-start the agent's DSH process
   *   -> session resolution            'main' fixed; fresh mapped by requestId
   *   -> proc.deliver(sessionId, text) session/prompt receipt = inbox accept
   *   -> { accepted, sessionId }       return immediately
   *
   * Session selection is the ROUTER's policy and takes NO caller input:
   *
   * - `main`: sessionId is ALWAYS the fixed `main` (exists -> the per-agent
   *   demo-server resumes the persisted session; absent -> creates). This is
   *   the only Session V0 allows to continue across jobs.
   * - `fresh`: the FIRST delivery of a requestId mints a brand-new native
   *   session id (`fresh-<sha256(agentId\0requestId)>`); every retry of the
   *   SAME requestId returns the SAME mapping (durably persisted, survives
   *   control-plane restarts); a DIFFERENT requestId mints a DIFFERENT
   *   session. The caller never addresses a session — the frozen interface
   *   has no sessionId field, and a stray one is rejected fail-loud, so no
   *   caller can specify or resume an arbitrary historical non-main session.
   *
   * The Router does NOT understand Workflow / Forum / Team / Mailbox /
   * notification retry queues / scheduler coupling: this is a pure
   * (agentId, session) admission entry.
   *
   * @param {object} req - { requestId, agentId, sessionMode, message }.
   * @returns {Promise<{accepted:true, sessionId:string}>}
   */
  async function deliver(req) {
    const requestId = req?.requestId
    const sessionMode = req?.sessionMode
    const message = req?.message
    if (typeof requestId !== 'string' || requestId === '') {
      throw new TypeError('agent-router: deliver requestId must be a non-empty string')
    }
    if (sessionMode !== 'main' && sessionMode !== 'fresh') {
      throw new TypeError(`agent-router: deliver sessionMode must be 'main' or 'fresh' (got ${JSON.stringify(sessionMode)})`)
    }
    if (typeof message !== 'string') {
      throw new TypeError('agent-router: deliver message must be a string')
    }
    if (req?.sessionId !== undefined) {
      // DELIVERY V0 boundary: the frozen interface has no sessionId. Reject
      // fail-loud (the same policy product-api applies to switchAgent) so no
      // caller can name or resume an arbitrary historical non-main session.
      throw new TypeError('agent-router: deliver has no sessionId field — the Router owns session selection (main | fresh-by-requestId)')
    }
    const agentRef = req?.agentId
    if (typeof agentRef !== 'string' || agentRef.trim() === '') {
      throw new TypeError('agent-router: deliver agentId must be a non-empty string')
    }
    const agent = resolveAgentRef(agentRef)
    // Session resolution: 'main' is the fixed V0 cross-job session; 'fresh'
    // maps (agentId, requestId) -> a minted native session id, durably. The
    // mint runs INSIDE the store's mutation queue (read-or-mint is atomic:
    // two concurrent first deliveries of the same requestId converge on one
    // session; the collision loop only guards the astronomically unlikely
    // hash clash between two different requestIds).
    const sessionId = sessionMode === 'main'
      ? 'main'
      : (await store.freshSessionFor(agent.id, requestId, (used) => {
          const digest = createHash('sha256').update(`${agent.id}\u0000${requestId}`).digest('hex')
          const base = `fresh-${digest.slice(0, 32)}`
          let id = base
          let n = 0
          while (used.has(id)) id = `${base}-${++n}`
          return id
        })).sessionId
    const started = Date.now()
    const proc = await ensureRunning(agent.id)
    // AGENT_CORE_BINDING_WORKSPACE_V1: Delivery V0 has no ChannelConversation
    // and therefore no Binding — the Default Workspace Rule applies
    // mechanically (agent default workspace), passed as the per-session cwd
    // exactly like the turn path (R1/R2/R3 enforced in the demo-server seam).
    const workspacePath = workspaceBootstrap.resolveWorkspace(agent.id)
    const receipt = await proc.deliver(sessionId, message, { cwd: workspacePath })
    deliveries.push({
      requestId,
      agentId: agent.id,
      sessionMode,
      sessionId,
      messageId: receipt.messageId,
      acceptedAt: new Date().toISOString(),
      ms: Date.now() - started,
    })
    log.log(`deliver accepted: agent ${agent.id} session ${sessionId} requestId ${requestId.slice(0, 24)}... (${receipt.messageId}) in ${Date.now() - started}ms`)
    return { accepted: true, sessionId }
  }

  // Bind the channel ingress (feishu-connector only forwards addressed events).
  if (feishu !== undefined) {
    feishu.setCallback(onIngress)
    log.log(`feishu channel bound; default binding -> ${resolveDefaultAgent().id} + session ${cfg.defaultSessionId}`)
  } else {
    log.log('feishu channel not present; router idle (entry-agnostic domain surface ready)')
  }

  // Tear down every owned process when the router plugin stops.
  ctx.effect(() => () => {
    for (const proc of registry.values()) {
      void proc.shutdown()
    }
    registry.clear()
  })

  const service = {
    pluginName: name,
    /** D-002 endpoint #12: idempotent ChannelConversation resolve (async). */
    resolveChannelConversation,
    /** THE unified switch domain operation (async, persisted). */
    switchAgent,
    /** D-002 getBinding: current Binding or undefined. */
    getBinding,
    /**
     * (channel, externalId) -> ChannelConversation id — the single owner of
     * the id format; thin adapters (Product API surface mapping, M13) ask
     * the service instead of re-implementing the convention.
     */
    channelConversationId,
    /** Test/ops surface: current registry snapshot. */
    registrySnapshot: () => [...registry.entries()].map(([agentId, proc]) => ({
      agentId,
      pid: proc.pid,
      alive: proc.exit === undefined,
      home: proc.home,
      workspace: proc.workspace,
      profile: proc.profile,
      sessions: proc.creations.map(c => ({ ...c })),
    })),
    /** Test/ops surface: durable Binding table snapshot. */
    bindingsSnapshot: () => store.list(),
    /** Test/ops surface: durable bookmark table snapshot (per-surface
     *  lastActiveSession; NOT history — single slot per (surface, agent)). */
    lastSessionsSnapshot: () => store.lastSessionsSnapshot(),
    /**
     * Agent Router Delivery V0: accept one message into the correct DSH
     * Session's inbox and return immediately — `accepted: true` never waits
     * for the model turn (see deliver's doc for the full contract).
     */
    deliver,
    /** Test/ops surface: durable Delivery V0 fresh-mapping table snapshot. */
    freshSessionsSnapshot: () => store.freshSessionsSnapshot(),
    /** Test/ops surface: in-memory Delivery V0 acceptance log. */
    deliveriesSnapshot: () => deliveries.map(d => ({ ...d })),
    ensureRunning,
    route: onIngress,
  }

  // Publish the router as an in-process service ('agentRouter') so the Feishu
  // Connector (or any future transport / Product API) can resolve
  // ChannelConversations, switch Agents and dispatch per the D-002 contract.
  // VALUE semantics: Cordis stores the value as-is.
  ctx.provide('agentRouter', service)
  return service
}

export { agentEnv, AGENT_CHILD_TMPDIR, RECOGNIZED_PROXY_ENV_KEYS }
