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

import { createHttpTransport, createHttpHandlers } from './transport.js'
import { buildTargetMap } from './targets.js'
import { invoke } from './mapping.js'
import { loadCredentialFor } from './credential-store.js'

/**
 * Create the in-process broker gateway.
 *
 * @param {object} opts
 * @param {Array<object>} opts.manifests - capability manifests (http-bound
 *   ones are executable; others fail closed as unsupported).
 * @param {Array<object>} opts.targets - pinned target registry
 *   (origin + audience).
 * @param {string} opts.authServiceOrigin - token endpoint origin.
 * @param {string | undefined} opts.credentialsFile - ABSOLUTE path of the
 *   505-private credential store (AGENT_CORE_CREDENTIALS_FILE); absent =>
 *   every call fails closed.
 * @param {(msg: string) => void} [opts.log] - parent log sink.
 * @returns {{ execute(call: {capabilityId:string, operation:string,
 *   args:object}, ctx: {agentId:string}): Promise<object> }}
 */
export function createBrokerGateway({
  manifests,
  targets,
  authServiceOrigin,
  credentialsFile,
  log = () => {},
}) {
  const targetMap = buildTargetMap(targets)
  const byCapability = new Map()
  for (const manifest of manifests) {
    const hasHttp = Array.isArray(manifest.operations) && manifest.operations.some((o) => o && o.http)
    if (hasHttp) byCapability.set(manifest.id, manifest)
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
   * @param {{capabilityId:string, operation:string, args:object}} call
   * @param {{agentId:string}} ctx - the ACTUAL agent of the calling child.
   * @returns {Promise<{ok:boolean, result?:unknown,
   *   error?:{code:string, status?:number, detail?:string}}>}
   */
  async function execute(call, { agentId }) {
    const manifest = byCapability.get(call?.capabilityId)
    if (manifest === undefined) {
      return { ok: false, error: { code: 'unsupported_operation', detail: `capability not served by the gateway: ${call?.capabilityId}` } }
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
    const transport = transportFor(agentId)
    const handlers = createHttpHandlers(manifest, transport)
    return invoke(manifest, handlers, { operation: call?.operation, args: call?.args ?? {} }, {
      // The parent decides the caller; the local identity stub is unused by
      // the HTTP pipeline (identity travels in the credential, not here).
      resolvePrincipal: () => undefined,
    })
  }

  return { execute }
}
