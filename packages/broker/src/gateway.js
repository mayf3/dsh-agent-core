/**
 * @agent-core/broker/src/gateway.js — parent-side trusted broker GATEWAY
 * (trusted credential broker model).
 *
 * Lives IN-PROCESS inside the trusted Router / control-plane parent (the
 * deployment runs that parent at authsvc/uid 505; the same process also owns
 * the 505-private credential store). The child never talks to this boundary
 * directly: it only reaches it through the parent-RPC relay
 * (`agent-core/broker`), and the Router dispatches with the ACTUAL
 * proc.agentId — the caller identity is decided here from the trusted
 * process relationship, never from anything the child says.
 *
 * Per call:
 *   1. capabilityId -> manifest (http-bound only; everything else fails
 *      closed as unsupported);
 *   2. agentId -> MachineClient credential from the 505-private store
 *      (re-read per call for rotation; missing entry fails closed with
 *      credential_unavailable);
 *   3. REUSE the existing generic authorized HTTP transport
 *      (client_credentials -> token cache -> pinned downstream fetch), one
 *      transport instance per agentId so the token cache is shared per
 *      agent and never across identities;
 *   4. return the identical wire shape the local transport would have
 *      produced ({ ok, result } | { ok:false, error:{code,status?,detail?} }).
 *
 * Child-supplied identity fields (agentId / principalId / clientId / scope /
 * audience / Authorization) are NEVER read — if present they are ignored
 * (and logged) by the caller.
 */

import { createHttpTransport, createHttpHandlers, requestAccessToken } from './transport.js'
import { buildTargetMap } from './targets.js'
import { invoke, validateInvocation } from './mapping.js'
import { loadCredentialFor } from './credential-store.js'
import { validateSchedulerTrustedContext } from './scheduler-validation.js'

/**
 * Create the in-process broker gateway.
 *
 * @param {object} opts
 * @param {Array<object>} opts.manifests - capability manifests (http-bound
 *   ones are executable over the transport; `local` ones are executed
 *   in-process against `localHandlers`; anything else fails closed as
 *   unsupported).
 * @param {Array<object>} opts.targets - pinned target registry
 *   (origin + audience).
 * @param {string} opts.authServiceOrigin - token endpoint origin.
 * @param {string | undefined} opts.credentialsFile - ABSOLUTE path of the
 *   505-private credential store (AGENT_CORE_CREDENTIALS_FILE); absent =>
 *   every call fails closed.
 * @param {Record<string, Record<string, Function>>} [opts.localHandlers] -
 *   AGENT_DEFINITION_ACCESS_V1: handler maps for LOCAL (in-process)
 *   capabilities, keyed by capabilityId then operation name. Each operation
 *   is async (args, { agentId }) -> broker envelope. Injected by the
 *   control-plane composition (the `agentDefinitionAccess` service); when
 *   absent, local capabilities fail closed as unsupported.
 * @param {() => Record<string, Record<string, Function>>} [opts.localHandlerResolver] -
 *   alternative to localHandlers: resolved at EXECUTE time (when every
 *   composition row is active) — the loader applies sibling rows
 *   concurrently, so reading a sibling's service at APPLY time would race.
 *   `localHandlers` wins when both are provided.
 * @param {(msg: string) => void} [opts.log] - parent log sink.
 * @returns {{ execute(call: {capabilityId:string, operation:string,
 *   args:object}, ctx: {agentId:string}): Promise<object> }}
 */
export function createBrokerGateway({
  manifests,
  targets,
  authServiceOrigin,
  credentialsFile,
  localHandlers,
  localHandlerResolver,
  log = () => {},
}) {
  const targetMap = buildTargetMap(targets)
  const byCapability = new Map()
  for (const manifest of manifests) {
    const hasHttp = Array.isArray(manifest.operations) && manifest.operations.some((o) => o && o.http)
    const isLocal = manifest?.local !== undefined
    if (hasHttp || isLocal) byCapability.set(manifest.id, manifest)
  }

  /**
   * The local handler map for one call. `localHandlers` (static injection)
   * wins; otherwise the resolver is consulted at EXECUTE time — by then the
   * whole composition is active, so sibling services are available without
   * racing the loader.
   */
  function handlersForCall() {
    if (localHandlers !== undefined) return localHandlers
    if (localHandlerResolver !== undefined) {
      const resolved = localHandlerResolver()
      return resolved ?? {}
    }
    return {}
  }

  function localHandlerFor(handlers, manifest, operation) {
    return handlers[manifest.id]?.[operation]
  }

  const schedulerContextFields = [
    'callerAgentId', 'processGeneration', 'turnExecutionId',
    'channelNamespace', 'channelConversationId', 'feishuChatId',
    'feishuConversationId', 'feishuMessageId',
  ]

  /** Flatten only Router-owned, allowlisted active-ingress leaves. */
  function schedulerTrustedContext(context, agentId) {
    const ingress = context?.ingressContext
    const violations = []
    if (ingress !== undefined && (ingress === null || typeof ingress !== 'object' || Array.isArray(ingress))) {
      violations.push('trusted ingressContext must be an object')
    }
    const usableIngress = ingress && typeof ingress === 'object' && !Array.isArray(ingress) ? ingress : {}
    const flattened = { agentId }
    for (const field of schedulerContextFields) {
      const nested = usableIngress[field]
      const legacyFlat = context?.[field]
      if (nested !== undefined && legacyFlat !== undefined && !Object.is(nested, legacyFlat)) {
        violations.push(`trusted context ${field} conflicts with ingressContext`)
      }
      flattened[field] = nested !== undefined ? nested : legacyFlat
    }
    return { context: Object.freeze(flattened), violations }
  }

  /** One transport per agentId: shared token cache per identity, never
   *  across identities. The credential provider re-reads the store on every
   *  getCredential() so rotation is picked up without restart. */
  const transports = new Map()

  function transportFor(agentId) {
    let transport = transports.get(agentId)
    if (transport === undefined) {
      const credentialProvider = {
        getCredential: async () => loadCredentialFor(credentialsFile, agentId),
      }
      transport = createHttpTransport({ credentialProvider, targets, authServiceOrigin })
      transports.set(agentId, transport)
    }
    return transport
  }

  /**
   * Execute one capability call AS the actual agentId (decided by the
   * Router from the spawning relationship — never from the call payload).
   *
   * Every path requires the caller's MachineClient credential from the
   * trusted store (fail-closed identity proof). LOCAL capabilities may
   * additionally require an Auth grant: when the manifest declares
   * requiredScopes, a token for those scopes is requested from the
   * auth-service (the ONLY grant authority) — a denied request fails the
   * call closed with `access_denied` BEFORE any handler runs.
   *
   * @param {{capabilityId:string, operation:string, args:object}} call
   * @param {{agentId:string}} ctx - the ACTUAL agent of the calling child.
   * @returns {Promise<{ok:boolean, result?:unknown,
   *   error?:{code:string, status?:number, detail?:string}}>}
   */
  async function execute(call, context = {}) {
    const agentId = context?.agentId
    const manifest = byCapability.get(call?.capabilityId)
    if (manifest === undefined) {
      return { ok: false, error: { code: 'unsupported_operation', detail: `capability not served by the gateway: ${call?.capabilityId}` } }
    }
    const isLocal = manifest.local !== undefined
    const operation = call?.operation
    const localHandlersNow = handlersForCall()
    const localHandler = isLocal ? localHandlerFor(localHandlersNow, manifest, operation) : undefined
    if (isLocal && (typeof operation !== 'string' || localHandler === undefined)) {
      return { ok: false, error: { code: 'unsupported_operation', detail: `operation not served by the gateway: ${manifest.id}.${operation}` } }
    }
    if (!Array.isArray(manifest.operations)) {
      return { ok: false, error: { code: 'unsupported_operation', detail: `capability has no operations: ${manifest.id}` } }
    }
    if (!isLocal && !manifest.operations.some((o) => o && o.http)) {
      return { ok: false, error: { code: 'unsupported_operation', detail: `capability not served by the gateway: ${manifest.id}` } }
    }

    let trustedContext = Object.freeze({ ...context, agentId, callerAgentId: agentId })
    let localArgs = call?.args ?? {}
    if (manifest.id === 'scheduler') {
      // This is the authoritative boundary: a child can bypass its own tool
      // mapper and call parent RPC directly, so repeat exact validation here
      // before credential, grant, handler, or store access.
      const validated = validateInvocation(manifest, { operation, args: localArgs })
      if (!validated.ok) return validated

      // Router calls the gateway as { agentId, ingressContext }. Flatten only
      // the active, allowlisted ingress leaves; never forward the nested bag or
      // derive identity from model/business args. Legacy flat trusted callers
      // remain supported, but a nested/flat disagreement fails closed.
      const flattened = schedulerTrustedContext(context, agentId)
      if (flattened.violations.length > 0) {
        return { ok: false, error: { code: 'invalid_arguments', detail: flattened.violations.join('; ') } }
      }
      trustedContext = flattened.context
      const contextViolations = validateSchedulerTrustedContext(trustedContext, validated.args)
      if (contextViolations.length > 0) {
        return { ok: false, error: { code: 'invalid_arguments', detail: contextViolations.join('; ') } }
      }
      localArgs = validated.args
    }

    let credential
    try {
      credential = loadCredentialFor(credentialsFile, agentId)
    } catch (error) {
      // A broken credential store must never crash the parent RPC; fail the
      // call closed with the store error detail (never the secret).
      log(`[broker-gateway] credential store error for agent ${agentId}: ${error?.message ?? error}`)
      return { ok: false, error: { code: 'credential_unavailable', detail: error?.message ?? 'credential store error' } }
    }
    if (credential === undefined) {
      log(`[broker-gateway] agent ${agentId}: no credential bound (fails closed)`)
      return { ok: false, error: { code: 'credential_unavailable', detail: `no MachineClient credential bound to agent ${agentId}` } }
    }

    // ── LOCAL (in-process) capability: optional Auth-grant check, then the
    //    injected handler. No HTTP downstream exists. ─────────────────────
    if (isLocal) {
      const requiredScopes = Array.isArray(manifest.requiredScopes) ? manifest.requiredScopes : []
      if (requiredScopes.length > 0) {
        // The Auth grant check: obtain a token for the required scopes. The
        // auth-service decides per credential; any failure is a DENIAL.
        const resource = manifest.local?.resource
        if (typeof resource !== 'string' || resource === '') {
          return { ok: false, error: { code: 'access_denied', detail: `local capability ${manifest.id} declares requiredScopes without a local resource` } }
        }
        try {
          await requestAccessToken({
            credential,
            authServiceOrigin,
            resource,
            scope: requiredScopes.join(' '),
          })
        } catch (error) {
          log(`[broker-gateway] agent ${agentId}: ${manifest.id} grant denied: ${error?.message ?? error}`)
          return {
            ok: false,
            error: {
              code: error?.errorCode === 'credential_invalid' ? 'credential_invalid'
                : error?.errorCode === 'transport_failure' ? 'transport_failure'
                  : 'access_denied',
              detail: `grant for ${requiredScopes.join(' ')} not available to this agent`,
            },
          }
        }
      }
      try {
        // Forward the Parent-owned invocation context, not anything from args.
        // `agentId`/`callerAgentId` are overwritten from the actual gateway
        // caller relationship and the snapshot is immutable for the handler.
        return await localHandler(localArgs, trustedContext)
      } catch (error) {
        log(`[broker-gateway] local capability ${manifest.id}.${operation} failed: ${error?.message ?? error}`)
        return { ok: false, error: { code: 'internal_error', detail: error?.message ?? 'local capability failure' } }
      }
    }

    // ── HTTP-bound capability: the existing generic authorized transport. ─
    const transport = transportFor(agentId)
    const handlers = createHttpHandlers(manifest, transport)
    return invoke(manifest, handlers, { operation, args: call?.args ?? {} }, {
      // The parent decides the caller; the local identity stub is unused by
      // the HTTP pipeline (identity travels in the credential, not here).
      resolvePrincipal: () => undefined,
    })
  }

  return { execute }
}
