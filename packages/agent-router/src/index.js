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
 *
 * Module split (structure refactor, semantics unchanged): this file is the
 * apply/service composition entry. channel-conversation.js owns the pure
 * ChannelConversation identity helpers; binding-resolution.js the Binding
 * resolve/switch operations; process-registry.js the per-Agent lifecycle
 * slots (C-006..C-009 + F-1 discipline) and process factory wiring;
 * ingress-delivery.js the ingress delivery + Delivery V0 admission seam;
 * process/ + reconciliation/ own the AgentProcess client and the
 * reconciliation store.
 */

import z from '@deepseek-ai/schemastery'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { AgentProcess } from './process/index.js'
import { resolveDeadlineConfig } from './deadline-config.js'
import { TurnReconciliationStore } from './reconciliation/index.js'
import { BindingStore } from './binding-store.js'
import { createProcessRegistry } from './process-registry.js'
import { createRouteChainExecutor } from './route-chain.js'
import { createBindingResolution } from './binding-resolution.js'
import { createIngressDelivery } from './ingress-delivery.js'
import { channelConversationId } from './channel-conversation.js'
import { SWITCH_RPC_METHOD, BROKER_RPC_METHOD } from './parent-rpc-relay.js'
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

export { SWITCH_RPC_METHOD, BROKER_RPC_METHOD }
export {
  channelConversationId,
  ingressBindingNamespace,
  feishuReplyOwed,
  channelConversationIdOf,
} from './channel-conversation.js'
export {
  createRouteChainExecutor,
  canonicalRouteIdentity,
  classifyAttemptFailure,
  ROUTE_HOP_FAILURE_CLASSES,
  ROUTE_STOP_REASONS,
} from './route-chain.js'

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

  /**
   * The four-field deadline configuration (CLAUSE-PROC-DEADLINE-CONFIG),
   * resolved ONCE at this process-start configuration boundary: global
   * deployment env (with the frozen legacy DSH_AGENT_TURN_TIMEOUT /
   * DSH_AGENT_DELIVER_TIMEOUT mappings) plus the optional static per-Agent
   * override file. Running processes keep their resolved config immutable.
   */
  const deadlineConfig = resolveDeadlineConfig(process.env, { productionRoot: cfg.productionRoot })

  // F-2 (V2 §5.2: 未知 Agent 必须 fail-loud): the override file may only
  // name REGISTERED agents. This is the configuration/apply boundary where
  // the full AgentDefinition set is available — the deadline-config parser
  // stays pure (no AgentDefinition dependency); the Router owns the
  // cross-check, BEFORE any process can spawn. The error is structured and
  // carries only agent ids + the overrides file path (no secrets).
  {
    const overrideAgentIds = Object.keys(deadlineConfig.overrides ?? {})
    if (overrideAgentIds.length > 0) {
      const registeredAgentIds = new Set(agentDefinition.listAgents().map(agent => agent.id))
      const unknownAgentIds = overrideAgentIds.filter(id => !registeredAgentIds.has(id))
      if (unknownAgentIds.length > 0) {
        throw Object.assign(
          new Error(
            `agent-router: ${deadlineConfig.overridesFile} overrides unknown agent(s): ${unknownAgentIds.join(', ')} `
            + `— not registered in the Agent Definition (registered: ${[...registeredAgentIds].join(', ') || '(none)'})`,
          ),
          { code: 'AGENT_PROCESS_OVERRIDE_AGENT_UNKNOWN', overridesFile: deadlineConfig.overridesFile, unknownAgentIds },
        )
      }
    }
  }

  /**
   * The Router reconciliation store — the SINGLE query authority for late
   * turn reconciliation (C-018). One store per control-plane runtime epoch.
   */
  const reconciliationStore = new TurnReconciliationStore()

  const bindingResolution = createBindingResolution({ agentDefinition, workspaceBootstrap, store, cfg, log })
  const registry = createProcessRegistry({
    log,
    cfg,
    workspaceBootstrap,
    agentDefinition,
    deadlineConfig,
    reconciliationStore,
    processFactory,
    resolveProcessConfig,
    provisionHome,
    switchAgent: bindingResolution.switchAgent,
    getBrokerGateway: () => ctx.get('brokerGateway'),
  })
  /**
   * The unified ordered route-attempt chain executor
   * (AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2 CTR-I2-005): the ONE seam
   * behind onIngress, Delivery V0 and the scheduler invokeAgent bridge. The
   * immutable chain snapshot comes from the composition-owned
   * `resolveRouteChain(agentId)` (agent-model-overrides.json version 2;
   * absent => length-1 legacy passthrough with the router's existing default
   * route resolution — byte-equivalent behavior). `canaryRuntimeRoot` (the
   * production runtime root) instantiates the default-off CTR-I2-015
   * one-shot canary seam; absent => the seam stays disabled.
   */
  const routeChain = createRouteChainExecutor({
    log,
    ensureRunningForRoute: registry.ensureRunningForRoute,
    resolveRouteChain: typeof cfg.resolveRouteChain === 'function' ? cfg.resolveRouteChain : undefined,
    resolveTurnDeadlineMs: (agentId) => deadlineConfig.perAgent(agentId).turnTimeoutMs,
    ...(typeof cfg.canaryRuntimeRoot === 'string' && cfg.canaryRuntimeRoot !== ''
      ? { canaryRuntimeRoot: cfg.canaryRuntimeRoot }
      : {}),
  })
  const ingressDelivery = createIngressDelivery({
    log,
    feishu,
    workspaceBootstrap,
    store,
    reconciliationStore,
    routeChain,
    resolveAgentRef: bindingResolution.resolveAgentRef,
    resolveChannelConversation: bindingResolution.resolveChannelConversation,
    resolveEffectiveWorkspace: bindingResolution.resolveEffectiveWorkspace,
  })

  log.log(`binding store loaded: ${store.list().length} binding(s) from ${storeFile}`)
  log.log(`delivery v0 fresh mapping table loaded: ${store.freshSessionsSnapshot().length} mapping(s)`)

  // Bind the channel ingress (feishu-connector only forwards addressed events).
  if (feishu !== undefined) {
    feishu.setCallback(ingressDelivery.onIngress)
    log.log(`feishu channel bound; default binding -> ${bindingResolution.resolveDefaultAgent().id} + session ${cfg.defaultSessionId}`)
  } else {
    log.log('feishu channel not present; router idle (entry-agnostic domain surface ready)')
  }

  // Tear down every owned process when the router plugin stops.
  ctx.effect(() => () => registry.dispose())

  const service = {
    pluginName: name,
    /** D-002 endpoint #12: idempotent ChannelConversation resolve (async). */
    resolveChannelConversation: bindingResolution.resolveChannelConversation,
    /** THE unified switch domain operation (async, persisted). */
    switchAgent: bindingResolution.switchAgent,
    /** D-002 getBinding: current Binding or undefined. */
    getBinding: bindingResolution.getBinding,
    /**
     * (channel, externalId) -> ChannelConversation id — the single owner of
     * the id format; thin adapters (Product API surface mapping, M13) ask
     * the service instead of re-implementing the convention.
     */
    channelConversationId,
    /** Test/ops surface: current registry snapshot — the READY-only
     *  projection of the lifecycle slots (C-006). */
    registrySnapshot: () => registry.registrySnapshot(),
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
    deliver: ingressDelivery.deliver,
    /** Test/ops surface: durable Delivery V0 fresh-mapping table snapshot. */
    freshSessionsSnapshot: () => store.freshSessionsSnapshot(),
    /** Test/ops surface: in-memory Delivery V0 acceptance log. */
    deliveriesSnapshot: () => ingressDelivery.deliveriesSnapshot(),
    ensureRunning: registry.ensureRunning,
    /** Route-aware registry gate (DEC-IMPL-004) behind the chain executor —
     *  published for test/ops surface parity with ensureRunning. */
    ensureRunningForRoute: registry.ensureRunningForRoute,
    route: ingressDelivery.onIngress,
    /**
     * Unified route-attempt chain seam (CTR-IMPL-002): the published surface
     * the scheduler-router bridge (and any future sync-turn caller) uses —
     * same executor as onIngress; external bridge code never imports the
     * executor module itself.
     */
    runTurnWithRouteChain: routeChain.runTurnWithRouteChain,
    /** Test/ops surface: bounded route-chain journal ring (per-attempt
     *  evidence + turn final block; redacted structural fields only). */
    routeChainJournalSnapshot: routeChain.journalSnapshot,
    /**
     * AGENT_PROCESS_LIFECYCLE_HARDENING_V2 Scheduler termination seam
     * (§13): read-only, non-consuming queries + at-most-once reconciliation
     * notifications. NO Scheduler policy lives here — occurrence identity,
     * retry and same-job fences remain Scheduler authority.
     */
    getTurnReconciliation: (handle) => reconciliationStore.getTurnReconciliation(handle),
    readFinalAssistantOutput: (handle) => reconciliationStore.readFinalAssistantOutput(handle),
    resolveCallerCorrelation: (triple) => reconciliationStore.resolveCallerCorrelation(triple),
    onTurnReconciled: (listener) => reconciliationStore.onTurnReconciled(listener),
    turnExecutionSnapshot: (turnExecutionId) => {
      const owner = registry.findOwningProcess(turnExecutionId)
      if (owner !== null && typeof owner.turnExecutionSnapshot === 'function') {
        return owner.turnExecutionSnapshot(turnExecutionId)
      }
      return reconciliationStore.getTurnReconciliation(turnExecutionId)
    },
    /** Test/ops surface: bounded lifecycle-slot stale-callback audit. */
    staleSlotAuditsSnapshot: () => registry.staleSlotAuditsSnapshot(),
    /** Test/ops surface: one Agent's lifecycle slot view (EMPTY|STARTUP|READY|REAP). */
    lifecycleSlotSnapshot: (agentId) => registry.lifecycleSlotSnapshot(agentId),
  }

  // Publish the router as an in-process service ('agentRouter') so the Feishu
  // Connector (or any future transport / Product API) can resolve
  // ChannelConversations, switch Agents and dispatch per the D-002 contract.
  // VALUE semantics: Cordis stores the value as-is.
  ctx.provide('agentRouter', service)
  return service
}

export { agentEnv, AGENT_CHILD_TMPDIR, RECOGNIZED_PROXY_ENV_KEYS } from './process/index.js'
