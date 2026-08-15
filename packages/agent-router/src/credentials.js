/**
 * @agent-core/agent-router/src/credentials.js — per-agent process credential
 * source (Process Identity Integration V1).
 *
 * The trusted runtime config that maps one Agent (by its registry agentId)
 * to its EXISTING MachineClient credential `{ clientId, clientSecret }` —
 * the same credentials the deployment already uses (auth-service MachineClient
 * -> client_credentials -> JWT; see docs/TRUST-BOUNDARY-REPORT.md and the
 * deployment's broker config). NO new auth system, NO credential->principal
 * mapping table: auth-service stays the single authority that binds a client
 * credential to the Agent's principal (JWT sub / agent_id / grants).
 *
 * The Router's spawn path (process.js) reads this file and injects each
 * Agent's OWN credential into its OWN process environment, consumed by the
 * Broker credential seam inside that process (packages/broker/src/credential.js,
 * env placeholders AGENT_CORE_BROKER_CLIENT_ID / AGENT_CORE_BROKER_CLIENT_SECRET).
 *
 * File shape (JSON, ABSOLUTE path via the AGENT_CORE_CREDENTIALS_FILE env of
 * the control-plane process; deployment-owned, 0600):
 *
 *   { "version": 1,
 *     "credentials": { "<agentId>": { "clientId": "...", "clientSecret": "..." } } }
 *
 * Guarantees:
 *   - the file is read ONLY by the Router spawn path, never by an Agent
 *     process (the env var is not forwarded into the child);
 *   - values flow ONLY into the Agent's own process env at spawn — never
 *     into model context / workspace / logs;
 *   - an Agent without an entry spawns WITHOUT any credential; the Broker
 *     then fails CLOSED (credential_unavailable) on every HTTP capability;
 *   - a configured-but-unreadable or malformed file fails LOUD at spawn — a
 *     broken credential source must never silently spawn an unauthenticated
 *     process;
 *   - the file is re-read on every spawn, so credential rotation is picked
 *     up by the next process start (no stale in-memory cache).
 *
 * Known boundary (documented in TRUST-BOUNDARY-REPORT.md §6): per-agent
 * processes share one OS user this round, so the file's 0600 mode does not
 * stop same-user code from reading it; per-agent OS user isolation is a
 * later gate and is NOT part of this round.
 */

import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'

/** Store document version; bumped only on breaking format changes. */
export const CREDENTIALS_STORE_VERSION = 1

/** Error code for a configured-but-unreadable / malformed credential store. */
export const CREDENTIALS_STORE_ERROR = 'CREDENTIALS_STORE_ERROR'

/** Normalize one credential entry; undefined when malformed/incomplete. */
export function normalizeCredential(value) {
  if (value === null || typeof value !== 'object') return undefined
  const clientId = value.clientId
  const clientSecret = value.clientSecret
  if (typeof clientId !== 'string' || clientId === '') return undefined
  if (typeof clientSecret !== 'string' || clientSecret === '') return undefined
  return { clientId, clientSecret }
}

/**
 * Load the whole credential store (fail-loud). Re-read on every call so a
 * rotated credential is seen by the next spawn.
 * @param {string} storeFile - ABSOLUTE path of the JSON store.
 * @returns {Record<string, {clientId:string, clientSecret:string}>}
 */
export function loadCredentialsStore(storeFile) {
  if (typeof storeFile !== 'string' || storeFile === '') {
    throw Object.assign(new TypeError('agent-router: credentials store file must be a non-empty string'), {
      code: CREDENTIALS_STORE_ERROR,
    })
  }
  if (!isAbsolute(storeFile)) {
    throw Object.assign(
      new TypeError(`agent-router: credentials store must be an absolute path (got ${JSON.stringify(storeFile)})`),
      { code: CREDENTIALS_STORE_ERROR },
    )
  }
  if (!existsSync(storeFile)) {
    throw Object.assign(new Error(`agent-router: credentials store not found: ${storeFile}`), {
      code: CREDENTIALS_STORE_ERROR,
    })
  }
  let document
  try {
    document = JSON.parse(readFileSync(storeFile, 'utf8'))
  } catch (error) {
    throw Object.assign(new Error(`agent-router: corrupt credentials store ${storeFile}: ${error.message}`), {
      code: CREDENTIALS_STORE_ERROR,
    })
  }
  if (document?.version !== CREDENTIALS_STORE_VERSION || typeof document.credentials !== 'object' || document.credentials === null) {
    throw Object.assign(new Error(`agent-router: unsupported credentials store format in ${storeFile}`), {
      code: CREDENTIALS_STORE_ERROR,
    })
  }
  const out = {}
  for (const [agentId, entry] of Object.entries(document.credentials)) {
    const credential = normalizeCredential(entry)
    if (credential === undefined) {
      throw Object.assign(new Error(`agent-router: corrupt credential entry for agent ${JSON.stringify(agentId)} in ${storeFile}`), {
        code: CREDENTIALS_STORE_ERROR,
      })
    }
    out[agentId] = credential
  }
  return out
}

/**
 * Resolve the credential for ONE agent from the store. Returns undefined
 * when no store is configured or the agent has no entry (spawn proceeds
 * credential-less; the broker fails closed). Throws CREDENTIALS_STORE_ERROR
 * when a configured store is unreadable / malformed — never silently spawn
 * unauthenticated on a broken source.
 * @param {string | undefined} storeFile - AGENT_CORE_CREDENTIALS_FILE value.
 * @param {string} agentId - the spawned agent's registry id.
 * @returns {{clientId:string, clientSecret:string} | undefined}
 */
export function loadCredentialFor(storeFile, agentId) {
  if (storeFile === undefined || storeFile === '') return undefined
  const store = loadCredentialsStore(storeFile)
  return store[agentId]
}
