/**
 * @agent-core/broker — V1 generic capability broker.
 *
 * Turns CAPABILITY MANIFESTS (plain data: wire id, operations, parameter/result
 * schemas, error-code table, descriptions) plus a code-side handler map into
 * model-facing DSH tools via `ctx.tools`. This generalizes the V0 calculator
 * fixture adapter: the calculator is now a manifest, and any future capability
 * (Forum / Workflow / OKR) needs only manifest data + a handler — no new
 * generic machinery. V0's accepted model-visible shape is preserved 1:1:
 *
 *   arguments: { operation: add|subtract|multiply|divide, a: number, b: number }
 *   success:   { ok: true, result: <number> }
 *   failure:   { ok: false, error: { code: invalid_arguments|unsupported_operation|divide_by_zero } }
 *   acceptance: multiply 6 × 7 -> 42
 *
 * Transport V1 (this round): manifests may declare a generic `http` binding
 * per operation (see transport.js). Operations with an `http` block are
 * executed by the generic AUTHORIZED HTTP TRANSPORT instead of a
 * process-internal handler — the same transport serves Forum / Workflow /
 * OKR / any future Broker capability, with zero per-business-system code.
 *
 * Trusted credential broker model (TRUSTED_CREDENTIAL_BROKER_INTEGRATION_V1):
 * the per-agent DSH process ('child' mode, default) registers the
 * model-facing tools but executes every HTTP capability as a RELAY over the
 * existing parent-RPC channel (agentRpc -> Router -> in-process Broker
 * gateway). The child holds NO credential and NO token; the parent
 * ('gateway' mode, control-plane composition) decides the caller from the
 * ACTUAL proc.agentId, reads the MachineClient credential from the 505-
 * private store, and runs the existing authorized HTTP transport
 * (client_credentials -> token cache -> pinned downstream).
 *
 * Identity: the transport obtains the caller credential ONLY through the
 * injected credential provider seam (credential.js / credential-store.js).
 * Model arguments never carry identity; caller self-reported
 * agentId/principalId cannot override the credential (see transport tests).
 *
 * Plugin identity: `export const name = 'broker'` is kept identical to V0 so
 * the installed profile keeps resolving the plugin; the bundle patch references
 * the package `@agent-core/broker` (unchanged in package.json). The `broker`
 * name also matches @agent-core/router's convention of a short Cordis plugin name.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'

import { registerCapabilities } from './registry.js'
import { createIdentityResolver } from './identity.js'
import { targets as defaultTargets, buildTargetMap } from './targets.js'
import { BROKER_RPC_METHOD, createRelayHandlers } from './relay.js'
import { createBrokerGateway } from './gateway.js'
import { createSelfAssertFixtureTool } from './fixtures/self-assert.js'
import { manifest as calculatorManifest, handlers as calculatorHandlers } from './calculator.manifest.js'
import { manifests as forumManifests } from './capabilities/forum.js'
import { manifests as workflowManifests } from './capabilities/workflow.js'
import { manifests as okrManifests } from './capabilities/okr.js'

/** Stable plugin name referenced by bundle patches / loaded as plugin identity. */
export const name = 'broker'

/** Core services required before the tool registry is reachable. */
export const inject = ['tools']

/**
 * Default capability manifests: the V0 calculator fixture + the first-batch
 * real business capabilities (Forum ×7, Workflow ×4, OKR ×1) — the ~95%
 * real-call surface identified by docs/investigations/broker-capability-parity.md
 * §6.4. All HTTP capabilities fail CLOSED at execution time without a
 * credential from the seam; registration itself never requires one.
 */
export const DEFAULT_MANIFESTS = [
  calculatorManifest,
  ...forumManifests,
  ...workflowManifests,
  ...okrManifests,
]

/** Default auth-service token endpoint origin (deployment-local). */
export const DEFAULT_AUTH_SERVICE_ORIGIN = 'http://127.0.0.1:4001'

/** Plugin config: manifests to register as tools + transport wiring. */
export const Config = z.object({
  /**
   * Capability manifests to register. Each maps to ONE tool.
   * Operations with an `http` block are served by the generic authorized
   * HTTP transport; the rest are served by `handlersByCapability`.
   */
  manifests: z
    .array(z.any())
    // NOTE: no .required() — schemastery's required check runs BEFORE the
    // default, so `.required().default(x)` still rejects an absent value.
    .default(DEFAULT_MANIFESTS),
  /** Target registry (origin + audience) that pins the outbound side. */
  targets: z.array(z.any()).default(defaultTargets),
  /** Auth-service token endpoint origin (client_credentials grant). */
  authServiceOrigin: z.string().default(DEFAULT_AUTH_SERVICE_ORIGIN),
  /**
   * Execution mode (trusted credential broker model):
   *
   * - 'child' (per-agent composition, DEFAULT): model-facing capability
   *   tools are registered; every HTTP capability executes as a RELAY —
   *   `agentRpc.request('agent-core/broker', { capabilityId, operation,
   *   args })`. The child holds NO credential and NO token; the env
   *   credential placeholders are never read.
   * - 'gateway' (control-plane composition): registers NO tools; provides
   *   `ctx.brokerGateway` — the trusted in-process Broker boundary that
   *   reads the 505-private credential store by ACTUAL agentId and runs the
   *   existing authorized HTTP transport (client_credentials -> token cache
   *   -> pinned downstream). Reached by the Router's parent-RPC dispatch.
   */
  mode: z.union([z.const('child'), z.const('gateway')]).default('child'),
  /**
   * Gateway mode only: ABSOLUTE path of the 505-private credential store
   * (AGENT_CORE_CREDENTIALS_FILE). Absent => every gateway call fails
   * closed with credential_unavailable.
   */
  credentialsFile: z.string(),
  /**
   * Child mode only (ACCEPTANCE FIXTURE): register the
   * broker_self_assert_test tool that relays a call while self-asserting a
   * forged identity — proving the parent ignores child-supplied identity.
   * Never enabled in product configurations.
   */
  fixtureSelfAssert: z.boolean().default(false),
})

/**
 * Capability id -> handler map for PROCESS-INTERNAL capabilities (calculator).
 * HTTP-bound capabilities get their handlers auto-generated (transport in
 * gateway mode, RELAY in child mode) — nothing business-specific lives here.
 */
const handlersByCapability = {
  'external.calculator': calculatorHandlers,
}

/**
 * Register every configured capability manifest as a model-facing tool.
 * Identity is resolved only through the internal `resolvePrincipal` interface
 * and the credential seam; model arguments are never a principal source.
 * @param {import('@deepseek-ai/cordis').Context} ctx - registrant context.
 * @param {object} [config] - resolved plugin config.
 */
export function apply(ctx, config = {}) {
  const manifests = config.manifests ?? DEFAULT_MANIFESTS
  const targets = config.targets ?? defaultTargets
  const authServiceOrigin = config.authServiceOrigin ?? DEFAULT_AUTH_SERVICE_ORIGIN
  const mode = config.mode ?? 'child'

  // Fail fast on broken wiring: every http-bound capability must reference a
  // known target (origin/audience stay pinned to trusted config).
  const targetMap = buildTargetMap(targets)
  for (const manifest of manifests) {
    for (const op of manifest && Array.isArray(manifest.operations) ? manifest.operations : []) {
      if (op && op.http && !targetMap.has(op.http.target)) {
        throw new Error(
          `broker: capability "${manifest.id}" references unknown target "${op.http.target}" ` +
            `(known: ${[...targetMap.keys()].join(', ')})`,
        )
      }
    }
  }

  // ------------------------------------------------------------- gateway
  if (mode === 'gateway') {
    const gateway = createBrokerGateway({
      manifests,
      targets,
      authServiceOrigin,
      credentialsFile: config.credentialsFile,
      log: (msg) => process.stderr.write(`${msg}\n`),
    })
    ctx.provide('brokerGateway', gateway)
    const httpCount = manifests.filter((m) =>
      Array.isArray(m?.operations) && m.operations.some((o) => o && o.http)).length
    process.stderr.write(`[broker] gateway mode: ${httpCount} http capabilities ready\n`)
    return { mode, gateway }
  }

  // --------------------------------------------------------- child relay
  // The trusted broker model: the child NEVER holds a credential and NEVER
  // runs the transport — every HTTP capability relays through the parent.
  // A missing agentRpc channel fails closed at execution time.
  const requestFn = (call) => {
    const agentRpc = ctx.get('agentRpc')
    if (agentRpc === undefined || typeof agentRpc.request !== 'function') {
      return Promise.resolve({
        ok: true,
        result: { ok: false, error: { code: 'invalid_arguments', detail: 'broker relay unavailable: no parent-RPC channel' } },
      })
    }
    return agentRpc.request(BROKER_RPC_METHOD, call)
  }

  const capabilities = manifests.map((manifest) => {
    const id = manifest && typeof manifest.id === 'string' ? manifest.id : ''
    const hasHttp = Array.isArray(manifest.operations) && manifest.operations.some((o) => o && o.http)
    // HTTP capabilities RELAY to the trusted parent; process-internal
    // capabilities (calculator) stay local — they need no credential.
    const handlers = hasHttp ? createRelayHandlers(manifest, requestFn) : handlersByCapability[id] ?? {}
    return {
      manifest,
      handlers,
      deps: {
        // Single identity source (see identity.js / TRUST-BOUNDARY Plan B).
        resolvePrincipal: createIdentityResolver(),
      },
    }
  })

  registerCapabilities(ctx, defineTool, capabilities)

  // Acceptance fixture (self-assert proof): registered only when explicitly
  // configured (BROKER_FIXTURE_SELF_ASSERT=1 in acceptance runtimes).
  if (config.fixtureSelfAssert === true) {
    const agentRpc = ctx.get('agentRpc')
    if (agentRpc === undefined || typeof agentRpc.request !== 'function') {
      throw new Error('broker: fixtureSelfAssert requires the agentRpc service')
    }
    const fixture = createSelfAssertFixtureTool((method, params) => agentRpc.request(method, params))
    ctx.tools.register(defineTool(fixture.definition))
    process.stderr.write('[broker] fixture broker_self_assert_test registered\n')
  }
}
