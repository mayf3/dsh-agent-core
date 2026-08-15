/**
 * @agent-core/broker — Credential / identity seam (V1, P1).
 *
 * The ONE place the generic HTTP transport obtains a caller credential from.
 * The transport (see transport.js) treats the result of `getCredential()` as
 * the only identity source for a request: it exchanges it at the token
 * endpoint and forwards the resulting Bearer token. The transport NEVER reads
 * identity from model input (no agentId / sessionKey / principalId argument is
 * ever consulted — see the "caller self-reported identity cannot override the
 * credential" tests).
 *
 * -- This round (minimal, replaceable) --
 * The provider is deliberately thin:
 *   1. an `injected` credential (tests / local dev / future control-plane
 *      injection), else
 *   2. an env-var placeholder (dev only: AGENT_CORE_BROKER_CLIENT_ID /
 *      AGENT_CORE_BROKER_CLIENT_SECRET), else
 *   3. `undefined` — the transport then fails CLOSED with
 *      `credential_unavailable` (never a scope-less or anonymous request).
 * There is no credential provisioning, no rotation, no per-agent registry.
 *
 * -- Final form (NOT this round; Process Identity Integration) --
 * Per docs/investigations/identity-auth.md §7 (Plan B): the control plane
 * (Router) spawns one DSH process per Agent and injects that Agent's process
 * credential at spawn time; this provider (or an equivalent implementation of
 * the same `{ getCredential(): Promise<Credential | undefined> }` contract) is
 * then replaced by the real per-process credential reader (e.g. DSH
 * `ctx.credentials.resolve` or an injected per-process credential file). The
 * broker package does NOT implement spawn / provisioning / binding.
 */

import { env } from 'node:process'

/** Env vars used by the DEV-ONLY placeholder source. */
export const CREDENTIAL_CLIENT_ID_ENV = 'AGENT_CORE_BROKER_CLIENT_ID'
export const CREDENTIAL_CLIENT_SECRET_ENV = 'AGENT_CORE_BROKER_CLIENT_SECRET'

/**
 * A caller credential: an OAuth2 client the broker uses to obtain an access
 * token for a target audience via the auth-service client_credentials grant.
 * @typedef {{ clientId: string, clientSecret: string }} Credential
 */

/**
 * Normalize a candidate credential; returns undefined when malformed/incomplete
 * so the transport always fails closed instead of using a broken credential.
 * @param {unknown} value
 * @returns {Credential | undefined}
 */
export function normalizeCredential(value) {
  if (value === null || typeof value !== 'object') return undefined
  const clientId = value.clientId
  const clientSecret = value.clientSecret
  if (typeof clientId !== 'string' || clientId.length === 0) return undefined
  if (typeof clientSecret !== 'string' || clientSecret.length === 0) return undefined
  return { clientId, clientSecret }
}

/**
 * Create the credential provider seam.
 *
 * @param {object} [opts]
 * @param {Credential} [opts.injected] - credential injected at construction
 *   (tests; future per-process injection point).
 * @param {Record<string,string|undefined>} [opts.source] - env-like map for the
 *   dev placeholder; defaults to node `process.env`.
 * @returns {{ getCredential: () => Promise<Credential | undefined> }}
 */
export function createCredentialProvider(opts = {}) {
  const source = opts.source || env
  return {
    /**
     * Resolve the caller credential. Async so the final Process Identity
     * integration can read a file / resolve a DSH credential ref without
     * changing the transport contract.
     * @returns {Promise<Credential | undefined>}
     */
    async getCredential() {
      const injected = normalizeCredential(opts.injected)
      if (injected !== undefined) return injected
      const clientId = source[CREDENTIAL_CLIENT_ID_ENV]
      const clientSecret = source[CREDENTIAL_CLIENT_SECRET_ENV]
      if (typeof clientId === 'string' && clientId.length > 0 && typeof clientSecret === 'string' && clientSecret.length > 0) {
        return { clientId, clientSecret }
      }
      return undefined
    },
  }
}
