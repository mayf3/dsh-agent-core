/**
 * @agent-core/broker/src/relay.js — child-side broker RELAY (trusted
 * credential broker model).
 *
 * The per-agent DSH process holds NO credential and NO token. Every HTTP
 * capability tool registered in the child is executed as a RELAY:
 *
 *   model -> broker tool { operation, args } -> agentRpc.request(
 *     'agent-core/broker', { capabilityId, operation, args }) -> parent
 *
 * The parent (trusted Router / Broker boundary, authsvc/505) resolves the
 * caller from the ACTUAL spawning relationship (proc.agentId), reads the
 * MachineClient credential from the 505-private store, runs the existing
 * client_credentials -> JWT -> downstream pipeline, and returns the SAME
 * wire shape the local transport would have produced — so the model-visible
 * result is byte-identical to direct execution (ok/result or
 * ok:false/error{code,status,detail}).
 *
 * Envelope chain (two layers, both unwrapped here):
 *
 *   agentRpc.request -> { ok: true, result: <invoke shape> }   (transport)
 *   invoke shape     -> { ok: true, result } | { ok: false, error }  (business)
 *
 * The parent-RPC failure channel only carries a message string, so the
 * Router ALWAYS answers broker calls inside the success envelope and the
 * business envelope is delivered intact. A REJECTED transport (e.g. the
 * channel dying mid-call) is caught and fails closed with a descriptive
 * detail.
 *
 * The relay NEVER reads identity from the model or the args, NEVER attaches
 * an Authorization header, and NEVER sees a secret/token: the request body
 * is exactly { capabilityId, operation, args }.
 */

/**
 * The parent-RPC method the router dispatches to the trusted broker gateway.
 * Kept in sync with packages/agent-router/src/index.js (BROKER_RPC_METHOD).
 */
export const BROKER_RPC_METHOD = 'agent-core/broker'

const SCHEDULER_MUTATIONS = new Set(['create', 'update', 'enable', 'disable', 'remove'])

/**
 * Build per-operation relay handlers for one HTTP capability manifest.
 *
 * Each handler forwards the call to the parent and UNWRAPS the parent's wire
 * shape back into the local `invoke` conventions:
 *
 *   parent { ok: true, result }   -> return result
 *   parent { ok: false, error }   -> return { errorCode, status, detail }
 *
 * so the child-side `invoke` (mapping.js) re-produces the identical final
 * envelope. A missing relay (no agentRpc service) fails closed with a
 * descriptive detail; the code is resolved through the manifest's declared
 * error table (fails closed to invalid_arguments otherwise).
 *
 * @param {object} manifest - validated capability manifest.
 * @param {(call: {capabilityId:string, operation:string, args:object}) =>
 *   Promise<{ok:boolean, result?:unknown, error?:{code:string, status?:number,
 *   detail?:string}}>} requestFn - the parent-RPC relay function.
 * @returns {Record<string, Function>} operationName -> handler.
 */
export function createRelayHandlers(manifest, requestFn) {
  const handlers = {}
  // LOCAL (in-process) capabilities relay exactly like HTTP-bound ones: the
  // parent's gateway executes them and answers in the same envelope shape,
  // so the child-side wire result is identical either way.
  const isLocalManifest = manifest?.local !== undefined
  for (const op of manifest.operations) {
    if (!op.http && !isLocalManifest) continue
    handlers[op.name] = async (_operation, args) => {
      let envelope
      try {
        // Transport envelope from the parent RPC: { ok: true, result: <invoke> }.
        envelope = await requestFn({
          capabilityId: manifest.id,
          operation: op.name,
          args,
        })
      } catch (err) {
        const uncertainMutation = manifest.id === 'scheduler' && SCHEDULER_MUTATIONS.has(op.name)
        return {
          errorCode: uncertainMutation ? 'mutation_outcome_unknown' : 'invalid_arguments',
          detail: uncertainMutation
            ? 'scheduler mutation response was lost; inspect current state before any manual retry'
            : `broker relay failed: ${err instanceof Error ? err.message : String(err)}`,
        }
      }
      const parent = envelope && envelope.ok === true ? envelope.result : undefined
      if (parent && parent.ok === true) {
        // Unwrap: child-side invoke re-wraps as { ok: true, result }.
        return parent.result
      }
      const error = (parent && parent.error) || { code: 'invalid_arguments', detail: 'broker relay returned no result' }
      return {
        errorCode: typeof error.code === 'string' ? error.code : 'invalid_arguments',
        ...(typeof error.status === 'number' ? { status: error.status } : {}),
        ...(typeof error.detail === 'string' ? { detail: error.detail } : {}),
        // Downstream x-request-id travels the relay unchanged (null/absent
        // when the parent had none — never fabricated here either).
        ...(typeof error.requestId === 'string' && error.requestId.length > 0 ? { requestId: error.requestId } : {}),
      }
    }
  }
  return handlers
}
