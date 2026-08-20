/**
 * @agent-core/production-runtime/src/compose.js — the Production Runtime
 * composition (PRODUCTION_RUNTIME_V1, Task 2).
 *
 * ONE function that mounts the EXISTING Agent Core components in the
 * bundle-integration row order over ONE production persistent layout
 * (src/paths.js) and starts the Scheduler engine. It is WIRING/LIFECYCLE
 * ONLY — zero domain logic, zero copies of component behavior, zero new
 * authorities:
 *
 *   workspace-bootstrap   (per-agent workspace / DSH_HOME mapping + ensure)
 *   agent-definition      (Agent existence authority — config LOADED, never written)
 *   feishu-connector      (channel; mounted ONLY with real credentials)
 *   agent-router          (process lifecycle + Binding + deliver admission)
 *   broker                (gateway mode — the Trusted CP seam; credentials
 *                          file optional, calls fail closed without one)
 *   product-api           (thin mobile surface over the Router)
 *   notification-ingress  (thin POST /v1/deliver over agentRouter.deliver)
 *   scheduler             (JobStore on the production store + engine loop)
 *     └─ scheduler-router seams (createRouterInvoker / createFeishuDeliver —
 *        the existing bridge, never re-implemented here)
 *
 * Not introduced (frozen): no Workflow / Forum / OKR / Team / Mailbox
 * semantics, no second registry, no second scheduler, no second auth. When
 * the Feishu channel is unconfigured, jobs asking for delivery fail loud
 * ("not-delivered") instead of faking a send.
 *
 * Trusted CP seam (Task 6): the child-identity spawn env
 * (DSH_AGENT_CHILD_UID / DSH_AGENT_CHILD_GID / DSH_AGENT_SPAWN_HELPER) and
 * the gateway credential env (AGENT_CORE_CREDENTIALS_FILE /
 * BROKER_AUTH_ORIGIN) pass straight through process.env into the Router /
 * Broker — TRUSTED_CP_AGENT_DEFINITION_COMPAT_V1 only needs to set env in
 * the supervision unit; no runtime code change. 505/502 hardening itself is
 * NOT re-implemented here.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { apply as applyBootstrap } from '../../workspace-bootstrap/src/index.js'
import { apply as applyDefinition } from '../../agent-definition/src/index.js'
import { apply as applyFeishu } from '../../feishu-connector/src/index.js'
import { apply as applyRouter, RECOGNIZED_PROXY_ENV_KEYS } from '../../agent-router/src/index.js'
import { apply as applyBroker } from '../../broker/src/index.js'
import { apply as applyProductApi } from '../../product-api/src/index.js'
import { apply as applyNotificationIngress } from '../../notification-ingress/src/index.js'
import { Scheduler, JobStore } from '../../scheduler/src/index.js'
import { createRouterInvoker, createFeishuDeliver } from '../../scheduler-router/src/index.js'
import { resolveHarnessRoot } from '../../agent-provisioning/src/index.js'
import { createPluginContext } from './context.js'
import { resolveProductionLayout } from './paths.js'
import { CHATGPT_SUBSCRIPTION_V1, loadAgentModelOverrides } from './model-overrides.js'
import { wireV2IngressGate, V2_INGRESS_MODE } from './v2-ingress-gate.js'

/** The per-agent profile the Production Runtime spawns (profile-production/). */
export const PRODUCTION_AGENT_PROFILE = 'agent-core-production'
export const TARGET_PROXY_NODE_VERSION = 'v25.6.1'

function invalidProxyRuntime(key, invalidClass) {
  return Object.assign(
    new Error(`production-runtime: invalid agent model overrides: ${key}: ${invalidClass}`),
    { code: 'AGENT_MODEL_OVERRIDE_INVALID' },
  )
}

export function assertTargetProxyRuntime({ env = process.env, version = process.version } = {}) {
  for (const key of RECOGNIZED_PROXY_ENV_KEYS) {
    if (Object.hasOwn(env, key)) throw invalidProxyRuntime(key, 'runtime_proxy_env_present')
  }
  if (version !== TARGET_PROXY_NODE_VERSION) {
    throw invalidProxyRuntime('NODE_RUNTIME_VERSION', 'runtime_version_mismatch')
  }
}

/**
 * Compose the Production Runtime.
 *
 * @param {object} options
 * @param {object} [options.layout] - resolved layout (src/paths.js); defaults
 *   to resolveProductionLayout() with no argument ($PRODUCTION_RUNTIME_ROOT
 *   then ~/.agent-core).
 * @param {string} [options.agentProfile] - per-agent DSH profile (default
 *   'agent-core-production'; must be a known AGENT_PROFILE_DEFS entry).
 * @param {number} [options.tickMs] - scheduler tick (default 500).
 * @param {number} [options.concurrency] - scheduler concurrency (default 2).
 * @param {boolean} [options.catchup] - startup catch-up (default true).
 * @param {string} [options.feishuCredsPath] - Feishu credentials JSON; unset
 *   or missing file => the channel is NOT mounted (honest offline, no fake
 *   sends) and job delivery fails loud.
 * @param {{enabled?:boolean, host?:string, port?:number}} [options.productApi]
 *   - product-api mount (default enabled, 127.0.0.1:8787).
 * @param {{enabled?:boolean, host?:string, port?:number}} [options.notificationIngress]
 *   - notification-ingress mount (default enabled, 127.0.0.1:8790).
 * @param {{credentialsFile?:string, authServiceOrigin?:string}} [options.broker]
 *   - broker gateway config (gateway mode is ALWAYS mounted — the Trusted CP
 *   seam; a missing credentials file fails closed per call, never at boot).
 * @param {Function} [options.processFactory] - per-agent process factory
 *   (test seam, forwarded to the Router; defaults to the real AgentProcess).
 * @param {Function} [options.provisionHome] - test seam for Router-owned home
 *   provisioning; production always uses provisionAgentHome.
 * @param {{provider:string,model:string}} [options.globalRoute] - test seam;
 *   production defaults to the existing DSH_AGENT_PROVIDER/MODEL route.
 * @param {object} [options.log] - logger (default stderr lines).
 * @returns {Promise<object>} the runtime handle: `{ ctx, layout, definition,
 *   router, feishu, broker, productApi, notificationIngress, store,
 *   scheduler, start(), stop() }`.
 */
export async function composeProductionRuntime(options = {}) {
  // AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1: the runtime itself
  // must remain proxy-free and the proven Node env-proxy behavior is pinned
  // exactly. This gate runs before composition mutates env or mounts anything.
  assertTargetProxyRuntime()
  const opts = options ?? {}
  const log = opts.log ?? {
    log: (...a) => process.stdout.write(`[production-runtime] ${a.join(' ')}\n`),
    warn: (...a) => process.stdout.write(`[production-runtime] WARN ${a.join(' ')}\n`),
    error: (...a) => process.stderr.write(`[production-runtime] ERROR ${a.join(' ')}\n`),
  }

  // Every mount below uses the SAME resolved persistent layout.
  const layout = opts.layout ?? resolveProductionLayout()
  const agentProfile = opts.agentProfile ?? PRODUCTION_AGENT_PROFILE
  const tickMs = opts.tickMs ?? 500
  const concurrency = opts.concurrency ?? 2
  const catchup = opts.catchup ?? true

  // The spawned per-agent DSH children resolve the harness through the env
  // the Router's AgentProcess inherits (agentEnv spreads process.env).
  process.env.DSH_HARNESS_ROOT = process.env.DSH_HARNESS_ROOT ?? resolveHarnessRoot()
  // The per-agent production profile reads this for the memory workspace
  // root (profile-production/cordis.patch.yml); the agent's memory files
  // live beside its workspace under the production root.
  process.env.DSH_MEMORY_WORKSPACE_ROOT = process.env.DSH_MEMORY_WORKSPACE_ROOT ?? layout.workspacesRoot

  const writeEvidence = (entry) => {
    try {
      mkdirSync(layout.controlDir, { recursive: true })
      appendFileSync(layout.evidenceLog, `${JSON.stringify({ ...entry, ts: Date.now() })}\n`)
    } catch (error) {
      log.error(`evidence write failed: ${error?.message ?? error}`)
    }
  }

  const ctx = createPluginContext()

  // ── row order: bundle-integration composition ────────────────────────────
  // AGENT_PRIMARY_WORKSPACE_IMPORT_V1 §4: optional deployment-authored import
  // map <productionRoot>/primary-workspaces.json (agentId → absolute existing
  // directory). Absent file = no imports = behavior identical to today. The
  // runtime only READS and hands the record to workspace-bootstrap (the
  // single path authority, which fail-loud validates every entry at mount —
  // no second validator, and this file is never written here).
  const primaryWorkspacesPath = join(layout.root, 'primary-workspaces.json')
  let primaryWorkspaces = {}
  if (existsSync(primaryWorkspacesPath)) {
    let parsed
    try {
      parsed = JSON.parse(readFileSync(primaryWorkspacesPath, 'utf8'))
    } catch (cause) {
      throw Object.assign(
        new Error(`production-runtime: cannot parse ${primaryWorkspacesPath} (${cause instanceof Error ? cause.message : String(cause)})`),
        { code: 'PRIMARY_WORKSPACE_INVALID' },
      )
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw Object.assign(
        new Error(`production-runtime: ${primaryWorkspacesPath} must be a JSON object mapping agentId → absolute directory`),
        { code: 'PRIMARY_WORKSPACE_INVALID' },
      )
    }
    primaryWorkspaces = parsed
  }

  applyBootstrap(ctx, { workspaceRoot: layout.workspacesRoot, agentsHome: layout.homesRoot, primaryWorkspaces })
  const importedAgents = Object.keys(primaryWorkspaces)
  if (importedAgents.length > 0) {
    log.log(`primary workspace imports loaded from ${primaryWorkspacesPath}: ${importedAgents.map((id) => `${id} -> ${primaryWorkspaces[id]}`).join(', ')}`)
  }

  if (!existsSync(layout.agentsConfig)) {
    throw Object.assign(new Error(`production-runtime: agent definition config missing: ${layout.agentsConfig} (provision the runtime first — the runtime never writes it)`), { code: 'CONFIG_MISSING' })
  }
  const definition = applyDefinition(ctx, { configFile: layout.agentsConfig })
  const defaultAgent = definition.getDefaultAgent()
  if (defaultAgent === undefined) {
    throw Object.assign(new Error(`production-runtime: agent definition ${layout.agentsConfig} has no default agent (nothing to route to)`), { code: 'CONFIG_INVALID' })
  }
  log.log(`agent definition loaded: ${definition.listAgents().length} agent(s), default=${defaultAgent.id} (${defaultAgent.name})`)

  // Accepted AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1: deployment-owned
  // static config. The production composition validates it against the
  // already-loaded Agent Definition. It then reloads at each NEW per-Agent
  // process boundary so target-only rollback needs neither a runtime restart
  // nor a file watcher. The Router receives only a synchronous resolved
  // process config and never reads the file or learns provider/model rules.
  const globalRoute = Object.freeze(opts.globalRoute ?? {
    provider: process.env.DSH_AGENT_PROVIDER ?? 'opencode-go',
    model: process.env.DSH_AGENT_MODEL ?? 'deepseek-v4-flash',
  })
  const modelOverridesFile = layout.agentModelOverrides ?? join(layout.root, 'agent-model-overrides.json')
  const registeredAgentIds = Object.freeze(definition.listAgents().map((agent) => agent.id))
  const initialModelOverrides = loadAgentModelOverrides(modelOverridesFile, registeredAgentIds)
  const resolveProcessConfig = (agentId) => {
    // Router calls this only after it has established that no live process
    // can be reused and immediately before provisioning/spawn. Reloading here
    // is process-start configuration, never per-turn dynamic routing.
    const modelOverrides = loadAgentModelOverrides(modelOverridesFile, registeredAgentIds)
    const route = modelOverrides.resolve(agentId, globalRoute)
    const override = modelOverrides.overrides[agentId]
    return Object.freeze({
      provider: route.provider,
      model: route.model,
      ...(override === undefined ? {} : {
        omitEnv: Object.freeze(['OPENAI_API_KEY']),
        ...(override.providerEnv === undefined ? {} : { providerEnv: override.providerEnv }),
        subscription: Object.freeze({
          plugin: override.plugin,
          pluginVersion: override.pluginVersion,
          dshVersion: CHATGPT_SUBSCRIPTION_V1.dshVersion,
          dshCommit: CHATGPT_SUBSCRIPTION_V1.dshCommit,
          credentialFile: CHATGPT_SUBSCRIPTION_V1.credentialFile,
          ...(process.env.DSH_CODEX_PACKAGE_TARBALL === undefined ? {} : {
            packageArtifact: process.env.DSH_CODEX_PACKAGE_TARBALL,
          }),
        }),
      }),
    })
  }
  if (Object.keys(initialModelOverrides.overrides).length > 0) {
    const target = CHATGPT_SUBSCRIPTION_V1.targetAgentId
    const route = initialModelOverrides.resolve(target, globalRoute)
    log.log(`agent model override loaded for ${target}: provider=${route.provider} model=${route.model}`)
  }

  // Feishu channel: mounted ONLY with real credentials. Absent => honest
  // offline (no fake recording seam in production); delivery-requesting
  // jobs fail loud as not-delivered.
  let feishu = undefined
  const feishuCredsPath = opts.feishuCredsPath ?? process.env.FEISHU_CREDS_PATH
  if (typeof feishuCredsPath === 'string' && feishuCredsPath !== '' && existsSync(feishuCredsPath)) {
    feishu = applyFeishu(ctx, { enabled: true, credentialsPath: feishuCredsPath })
    log.log(`feishu connector mounted with live credentials (${feishuCredsPath})`)
  } else {
    log.warn(`feishu credentials not configured (FEISHU_CREDS_PATH=${feishuCredsPath ?? '(unset)'}); channel OFF — delivery-requesting jobs will be marked not-delivered`)
  }

  const router = applyRouter(ctx, {
    bindingsStoreFile: layout.bindingsStore,
    defaultAgentId: defaultAgent.id,
    defaultSessionId: 'main',
    agentProfile,
    ...(opts.processFactory === undefined ? {} : { processFactory: opts.processFactory }),
    ...(opts.provisionHome === undefined ? {} : { provisionHome: opts.provisionHome }),
    resolveProcessConfig,
  })

  // V2 PREBOUND_ONLY Feishu ingress gate (AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC
  // §4.5/§5.5): composition-layer product wiring over the Router's GENERIC
  // read APIs only (getBinding + channelConversationId — zero Router change,
  // zero Feishu special-case in the Router). Unknown/unbound conversations
  // fail closed BEFORE the Router's first-contact path (no default Binding);
  // non-primary Binding.workspace compatibility rows stay on disk but are
  // blocked from the V2 normal path.
  const wired = feishu !== undefined
    ? wireV2IngressGate(feishu, router, ctx.get('workspaceBootstrap'), log)
    : false
  if (feishu !== undefined) {
    if (!wired) throw new Error('production-runtime: feishu connector handle does not expose setIngressGate (V2 ingress gate cannot be wired — fail loud, never run un-gated)')
    log.log(`feishu ingress gate wired (${V2_INGRESS_MODE}: pre-bound primary-workspace conversations only)`)
  }

  // Trusted CP seam: gateway mode always mounted; the credential store path
  // and auth origin arrive via env from the supervision unit. Without a
  // credentials file every capability call fails closed
  // (credential_unavailable) — the gateway never fakes authorization.
  const broker = applyBroker(ctx, {
    mode: 'gateway',
    credentialsFile: opts.broker?.credentialsFile ?? process.env.AGENT_CORE_CREDENTIALS_FILE,
    authServiceOrigin: opts.broker?.authServiceOrigin ?? process.env.BROKER_AUTH_ORIGIN,
  })

  const productApiCfg = opts.productApi ?? {}
  const productApi = applyProductApi(ctx, {
    enabled: productApiCfg.enabled ?? process.env.PRODUCT_API_ENABLED !== '0',
    host: productApiCfg.host ?? process.env.PRODUCT_API_HOST ?? '127.0.0.1',
    port: productApiCfg.port ?? Number.parseInt(process.env.PRODUCT_API_PORT ?? '8787', 10),
  })

  const ingressCfg = opts.notificationIngress ?? {}
  const notificationIngress = applyNotificationIngress(ctx, {
    enabled: ingressCfg.enabled ?? process.env.NOTIFICATION_INGRESS_ENABLED !== '0',
    host: ingressCfg.host ?? process.env.NOTIFICATION_INGRESS_HOST ?? '127.0.0.1',
    port: ingressCfg.port ?? Number.parseInt(process.env.NOTIFICATION_INGRESS_PORT ?? '8790', 10),
  })

  // ── scheduler engine over the production store (existing seams only) ─────
  const rawInvoker = createRouterInvoker(router, { definition })
  // Thin observability (evidence surface, not a framework): one line per
  // invocation with the router process state — same pattern the resident used.
  const invoker = async (request) => {
    const started = Date.now()
    const outcome = await rawInvoker(request)
    const proc = router.registrySnapshot().find((p) => p.agentId === request.agentId)
    writeEvidence({
      kind: 'invocation',
      pid: process.pid,
      agentId: request.agentId,
      sessionId: request.sessionId,
      status: outcome.status,
      summary: outcome.status === 'ok' ? (outcome.summary ?? null) : null,
      error: outcome.status === 'error' ? (outcome.error ?? null) : null,
      durationMs: Date.now() - started,
      routerProcessPid: proc?.pid ?? null,
      routerProcessAlive: proc?.alive ?? null,
    })
    return outcome
  }

  // Observability for the Delivery V0 admission seam: one evidence line per
  // accepted deliver (wrap, never re-implement — the Router still owns it).
  const deliverRouterOwned = router.deliver
  router.deliver = async (req) => {
    const result = await deliverRouterOwned.call(router, req)
    const proc = router.registrySnapshot().find((p) => p.agentId === req?.agentId)
    writeEvidence({
      kind: 'deliver',
      pid: process.pid,
      requestId: req?.requestId,
      agentId: req?.agentId,
      sessionMode: req?.sessionMode,
      sessionId: result?.sessionId,
      routerProcessPid: proc?.pid ?? null,
      routerProcessAlive: proc?.alive ?? null,
    })
    return result
  }

  const deliver = feishu !== undefined
    ? createFeishuDeliver(feishu)
    : async ({ job }) => {
        throw new Error(`production-runtime: feishu channel not configured — cannot deliver job ${job?.id ?? '?'} (set FEISHU_CREDS_PATH or create the job with --no-deliver)`)
      }

  const store = new JobStore(layout.jobsStore, { runLogPath: layout.runsLog })
  const scheduler = new Scheduler({
    store,
    invoker,
    deliver,
    tickMs,
    concurrency,
    log: {
      info: (...a) => log.log(...a),
      warn: (...a) => log.warn(...a),
      error: (...a) => log.error(...a),
    },
  })

  writeEvidence({
    kind: 'composed',
    pid: process.pid,
    root: layout.root,
    agentProfile,
    tickMs,
    concurrency,
    defaultAgentId: defaultAgent.id,
    feishu: feishu !== undefined,
  })

  return {
    ctx,
    layout,
    agentProfile,
    globalRoute,
    definition,
    router,
    feishu,
    broker,
    productApi,
    notificationIngress,
    store,
    scheduler,
    writeEvidence,
    /** Start the resident scheduler loop (mtime tick + startup catch-up). */
    start: () => scheduler.start({ autoStart: true, catchup }),
    /** Graceful stop: engine first, then every plugin disposer (the Router's
     *  disposer shuts down all owned agent processes). */
    stop: async () => {
      await scheduler.stop()
      await ctx.disposeAll()
    },
  }
}
