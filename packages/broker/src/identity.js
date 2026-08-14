/**
 * @agent-core/broker — Principal / identity interface (V1).
 *
 * Internal interface by which a broker adapter may learn *whose* request it is
 * handling. This is the SINGLE identity-acquisition point in the broker: a
 * capability handler that needs a principal must receive it here, and can only
 * receive it here. The adapter NEVER reads identity from model input (tool
 * parameters / prompt / header). The tool schema carries no principal field
 * (see registry.js), and the mapping layer does not forward one (see mapping.js).
 *
 * -- Placeholder (CURRENT, this round) --
 * `resolvePrincipal` reads a fixed principal string from process environment
 * (or falls back to an injected constant). It is a deliberate stub so the
 * identity seam is exercised and tested end-to-end without any real security
 * transport.
 *
 * -- Final form (NOT this round) --
 * Per TRUST-BOUNDARY-REPORT.md, Option B: each Agent runs in its own DSH
 * process, and the control plane (Router) injects a per-process credential at
 * spawn time. `resolvePrincipal` then binds that process credential to a
 * principal (credential -> agentId binding owned by the Broker side). The
 * final injector is responsible for real credential handling — NOT implemented
 * here. This round implements neither `spawn` nor credential-file I/O.
 */

import { env } from 'node:process'

/** Environment variable currently used by the placeholder resolver. */
export const PRINCIPAL_ENV = 'AGENT_CORE_PRINCIPAL'

/**
 * Create the internal `resolvePrincipal(ctx)` interface backed by a source.
 *
 * @param {object} [opts]
 * @param {Record<string,string|undefined>} [opts.source] - env-like map; defaults to node `process.env`.
 * @param {string} [opts.injected] - fixed value used when the source has none.
 * @returns {(ctx: unknown) => string | undefined} resolvePrincipal(ctx).
 */
export function createIdentityResolver(opts = {}) {
  const source = opts.source || env
  const injected = opts.injected
  return function resolvePrincipal(/* ctx */) {
    // Placeholder only: the final form injects a per-process credential and
    // binds it to a principal (Plan B). Model input is never consulted here.
    const value = source[PRINCIPAL_ENV]
    return value === undefined || value === '' ? injected : value
  }
}
