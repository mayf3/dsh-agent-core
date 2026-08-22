/**
 * @agent-core/broker/src/credential-store.js — 505-private credential store
 * reader (trusted credential broker model).
 *
 * The trusted Broker / credential boundary (in-process inside the Router
 * parent, which the deployment runs at authsvc/uid 505) reads each Agent's
 * EXISTING MachineClient credential from THIS store. NO new auth system, NO
 * credential->principal mapping table: auth-service stays the single
 * authority that binds a client credential to the Agent's principal
 * (JWT sub / agent_id / grants).
 *
 * File shape (JSON, ABSOLUTE path via the AGENT_CORE_CREDENTIALS_FILE env of
 * the control-plane process; deployment-owned, 0600, 505-private):
 *
 *   { "version": 1,
 *     "credentials": { "<agentId>": { "clientId": "...", "clientSecret": "..." } } }
 *
 * Guarantees:
 *   - read ONLY by the trusted parent (broker gateway), never by an Agent
 *     process: the value is never injected into a child environment, never
 *     forwarded over the parent-RPC wire, never returned to the model;
 *   - an Agent without an entry fails CLOSED (credential_unavailable) on
 *     every HTTP capability;
 *   - a configured-but-unreadable or malformed store fails LOUD — a broken
 *     credential source must never silently degrade to unauthenticated;
 *   - the file is re-read on EVERY call, so rotation is picked up without
 *     restart (no stale in-memory cache).
 */

import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'

import { normalizeAgentId } from '../../agent-definition/src/definition.js'

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
 * rotated credential is seen by the next execution.
 * @param {string} storeFile - ABSOLUTE path of the JSON store.
 * @returns {Record<string, {clientId:string, clientSecret:string}>}
 */
export function loadCredentialsStore(storeFile) {
  if (typeof storeFile !== 'string' || storeFile === '') {
    throw Object.assign(new TypeError('broker: credentials store file must be a non-empty string'), {
      code: CREDENTIALS_STORE_ERROR,
    })
  }
  if (!isAbsolute(storeFile)) {
    throw Object.assign(
      new TypeError(`broker: credentials store must be an absolute path (got ${JSON.stringify(storeFile)})`),
      { code: CREDENTIALS_STORE_ERROR },
    )
  }
  if (!existsSync(storeFile)) {
    throw Object.assign(new Error(`broker: credentials store not found: ${storeFile}`), {
      code: CREDENTIALS_STORE_ERROR,
    })
  }
  let document
  try {
    document = JSON.parse(readFileSync(storeFile, 'utf8'))
  } catch (error) {
    throw Object.assign(new Error(`broker: corrupt credentials store ${storeFile}: ${error.message}`), {
      code: CREDENTIALS_STORE_ERROR,
    })
  }
  if (document?.version !== CREDENTIALS_STORE_VERSION || typeof document.credentials !== 'object' || document.credentials === null) {
    throw Object.assign(new Error(`broker: unsupported credentials store format in ${storeFile}`), {
      code: CREDENTIALS_STORE_ERROR,
    })
  }
  const out = {}
  for (const [agentId, entry] of Object.entries(document.credentials)) {
    const credential = normalizeCredential(entry)
    if (credential === undefined) {
      throw Object.assign(new Error(`broker: corrupt credential entry for agent ${JSON.stringify(agentId)} in ${storeFile}`), {
        code: CREDENTIALS_STORE_ERROR,
      })
    }
    out[agentId] = credential
  }
  return out
}

/**
 * Resolve the credential for ONE agent from the store. Returns undefined
 * when no store is configured or the agent has no entry (the gateway fails
 * closed with credential_unavailable). Throws CREDENTIALS_STORE_ERROR when a
 * configured store is unreadable / malformed — never silently execute
 * unauthenticated on a broken source.
 * @param {string | undefined} storeFile - AGENT_CORE_CREDENTIALS_FILE value.
 * @param {string} agentId - the calling agent's registry id (ACTUAL, decided
 *   by the parent from the proc relationship).
 * @returns {{clientId:string, clientSecret:string} | undefined}
 */
export function loadCredentialFor(storeFile, agentId) {
  if (storeFile === undefined || storeFile === '') return undefined
  const store = loadCredentialsStore(storeFile)
  return store[agentId]
}

/**
 * Resolve REDACTED credential METADATA for ONE agent id — the fleet-inventory
 * seam (AGENT_CORE_CREDENTIAL_METADATA_RESOLUTION_V1). Answers only whether
 * the canonical trusted store has an entry for the EXACT agent id and, when
 * present, that entry's non-secret clientId. This is the ONLY sanctioned way
 * for trusted inventory to ask presence: it must NOT call loadCredentialFor()
 * and receive clientSecret merely to discard it.
 *
 * Trusted-parent ONLY — the same authsvc/uid505 credential boundary as
 * loadCredentialFor: never reachable by a child Agent, model tool, child
 * RPC, or UI; the store path is trusted parent configuration
 * (AGENT_CORE_CREDENTIALS_FILE), never a caller-supplied request field.
 *
 * Semantics:
 *   - the agent id is validated FIRST by the Agent Definition authority's
 *     own validator (single id-grammar authority; no local fallback): every
 *     invalid, empty, or path/traversal-shaped id fails LOUD before ANY
 *     store path operation or read (STORE_ACCESS_COUNT = 0);
 *   - an unconfigured store or an absent exact key -> { entry: 'ABSENT' }
 *     (clientId omitted, never null/empty);
 *   - a valid entry -> { entry: 'PRESENT', clientId } — a freshly built
 *     closed object: the secret-bearing normalized entry never leaves this
 *     boundary, and no other key can appear in the result;
 *   - a configured store that is missing, unreadable, malformed,
 *     unsupported-version, or carries any malformed entry throws the stable
 *     CREDENTIALS_STORE_ERROR family — broken trusted state never
 *     masquerades as ABSENT;
 *   - strictly read-only: no write, chmod, chown, rename, or repair; emits
 *     no log, metric, report, stdout, or stderr of its own.
 *
 * PRESENCE is local-store metadata only: it says nothing about Auth client
 * existence/validity, principal binding, grants, or token mintability.
 * @param {string | undefined} storeFile - AGENT_CORE_CREDENTIALS_FILE value
 *   (trusted parent configuration).
 * @param {string} agentId - the exact Agent Definition id being inventoried.
 * @returns {{entry:'PRESENT', clientId:string} | {entry:'ABSENT'}}
 */
export function resolveCredentialMetadata(storeFile, agentId) {
  normalizeAgentId(agentId)
  if (storeFile === undefined || storeFile === '') return { entry: 'ABSENT' }
  const credential = loadCredentialsStore(storeFile)[agentId]
  if (credential === undefined) return { entry: 'ABSENT' }
  return { entry: 'PRESENT', clientId: credential.clientId }
}
