/**
 * @agent-core/agent-definition — the declarative Agent Definition (core).
 *
 * AGENT_DEFINITION_CONFIG_V1 (frozen authority, replaces the writable
 * agent-registry service): the Agent Definition config is THE single answer
 * to:
 *
 *   - Which Agents exist in the system?           -> listAgents()
 *   - Which Agent is `agentId`?                   -> getAgent(agentId)
 *   - Which Agent is the default one?             -> getDefaultAgent()
 *   - What Agent does a name/id reference resolve to? -> resolveAgentRef(ref)
 *
 * It is a DECLARATIVE, read-only config — a deployment artifact, not a
 * runtime service with mutation machinery. Production writers = 0: nothing
 * registers, updates or deletes Agents at runtime. Agent existence / stable
 * id / name / display / default are FROZEN in the config file; every other
 * facet stays owned elsewhere:
 *
 *   Workspace (persona / AGENTS.md / memory)  -> workspace-bootstrap
 *   Process lifecycle                          -> agent-router
 *   Native session/runtime                     -> DSH
 *   Principal / credential / grant             -> Auth
 *
 * The config carries ONLY identity + display metadata. It never carries a
 * persona, a workspace path, credentials, grants, or runtime/session/process
 * fields (enforced fail-loud on load).
 *
 * Document format (single JSON file, `configFile` — an ABSOLUTE path;
 * relative or `~`-prefixed values are rejected fail-loud):
 *
 *   {
 *     "version": 1,
 *     "defaultAgentId": "agt_xxx" | null,
 *     "agents": [
 *       { "id": "agt_xxx", "name": "论文导师", "description": "...",
 *         "disabled": false }
 *     ]
 *   }
 *
 * `disabled` (optional, default false) is the ONLY operational-state field
 * (AGENT_DEFINITION_ACCESS_V1): a disabled agent keeps its stable identity
 * and stays readable (getAgent / listAgents), but is NOT routable
 * (resolveAgentRef rejects it) and can never be the default.
 *
 * Invariants (enforced fail-loud on load — CORRUPT_CONFIG):
 *   - `defaultAgentId` must resolve to an ENABLED agent in the list;
 *   - a non-empty agent list must have a legal default;
 *   - agent ids are unique and carry the opaque `agt_` type prefix
 *     (D-002 idFormat: type-prefixed opaque string). An id NEVER changes
 *     when a display name is renamed — ids are stable by construction;
 *   - no persona / workspace / credential / runtime fields anywhere.
 *
 * Reads are synchronous and in-memory (the file is loaded once at
 * construction): the Router's message hot path never touches the config
 * file or any database.
 *
 * `avatar` was dropped: no production caller ever read it (the Product API
 * hard-codes `avatar: null` in its wire contract; the Router never reads
 * it), so keeping the field would only be dead schema.
 */

import { readFileSync, existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'

/** Config document version; bumped only on breaking format changes. */
export const CONFIG_VERSION = 1

/** Error code thrown for an unknown agent (D-002 `AGENT_NOT_FOUND`). */
export const AGENT_NOT_FOUND = 'AGENT_NOT_FOUND'

/** Error code thrown for invalid input (D-002 `VALIDATION_ERROR`). */
export const VALIDATION_ERROR = 'VALIDATION_ERROR'

/** Error code thrown when the config file exists but violates its format. */
export const CORRUPT_CONFIG = 'CORRUPT_CONFIG'

/** Prefix of every opaque agentId (`agt_` + payload). */
export const AGENT_ID_PREFIX = 'agt_'

/** Legal opaque id payload: alphanumerics, `-`, `_` (no spaces, no paths). */
const AGENT_ID_RE = /^agt_[A-Za-z0-9_-]+$/

/**
 * Generate a fresh opaque agentId: `agt_` + 32 random hex chars
 * (crypto.randomUUID payload). Used ONLY by the deployment-side adoption /
 * provisioning path that writes the config — never by the read service.
 * @returns {string} a fresh id.
 */
export function generateAgentId() {
  return AGENT_ID_PREFIX + randomUUID().replaceAll('-', '')
}

/** Validate a display name (non-empty string). */
function normalizeName(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw Object.assign(new TypeError('agent-definition: name must be a non-empty string'), { code: VALIDATION_ERROR })
  }
  return name
}

/** Validate a description (string | null | undefined -> string | null). */
function normalizeDescription(description) {
  if (description === undefined || description === null) return description ?? null
  if (typeof description !== 'string') {
    throw Object.assign(new TypeError('agent-definition: description must be a string or null'), { code: VALIDATION_ERROR })
  }
  return description
}

/** Validate the optional `disabled` flag (boolean | undefined -> boolean). */
function normalizeDisabled(disabled) {
  if (disabled === undefined) return false
  if (typeof disabled !== 'boolean') {
    throw Object.assign(new TypeError('agent-definition: disabled must be a boolean'), { code: VALIDATION_ERROR })
  }
  return disabled
}

/** Validate an agent id: opaque `agt_`-prefixed string. */
function normalizeAgentId(id) {
  if (typeof id !== 'string' || !AGENT_ID_RE.test(id)) {
    throw Object.assign(
      new TypeError(`agent-definition: agent id must be an opaque ${AGENT_ID_PREFIX}* string (got ${JSON.stringify(id)})`),
      { code: VALIDATION_ERROR },
    )
  }
  return id
}

/**
 * Validate one raw agent entry and normalize it to the public record shape
 * ({id, name, description, disabled}). Rejects any field beyond the frozen
 * identity + display + operational-state schema (no persona / workspace /
 * credential / runtime fields).
 * @param {unknown} entry
 * @param {string} [context] - human-readable location for error messages.
 * @returns {{id:string, name:string, description:string|null, disabled:boolean}}
 */
export function normalizeAgentEntry(entry, context = 'agent') {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    throw Object.assign(new TypeError(`agent-definition: ${context} must be an object`), { code: VALIDATION_ERROR })
  }
  const allowed = new Set(['id', 'name', 'description', 'disabled'])
  for (const key of Object.keys(entry)) {
    if (!allowed.has(key)) {
      throw Object.assign(
        new TypeError(`agent-definition: ${context} carries unsupported field ${JSON.stringify(key)} (identity + display + disabled only)`),
        { code: VALIDATION_ERROR },
      )
    }
  }
  return {
    id: normalizeAgentId(entry.id),
    name: normalizeName(entry.name),
    description: normalizeDescription(entry.description),
    disabled: normalizeDisabled(entry.disabled),
  }
}

/**
 * Validate a full Agent Definition document object and normalize it.
 * Fail-loud on every invariant violation (CORRUPT_CONFIG / VALIDATION_ERROR).
 * @param {unknown} doc - parsed JSON.
 * @param {object} [opts]
 * @param {string} [opts.source] - file path used in error messages.
 * @returns {{version:number, defaultAgentId:string|null, agents:Array<{id:string,name:string,description:string|null}>}}
 */
export function normalizeDefinition(doc, opts = {}) {
  const source = opts?.source ?? 'config'
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    throw Object.assign(new Error(`agent-definition: corrupt config ${source}: not a JSON object`), { code: CORRUPT_CONFIG })
  }
  if (doc.version !== CONFIG_VERSION) {
    throw Object.assign(new Error(`agent-definition: unsupported config version in ${source} (got ${JSON.stringify(doc.version)})`), {
      code: CORRUPT_CONFIG,
    })
  }
  // The document is frozen to exactly version/defaultAgentId/agents — a
  // persona, workspace, credential or runtime field can never sneak in.
  const allowedKeys = new Set(['version', 'defaultAgentId', 'agents'])
  for (const key of Object.keys(doc)) {
    if (!allowedKeys.has(key)) {
      throw Object.assign(
        new Error(`agent-definition: corrupt config ${source}: unsupported top-level field ${JSON.stringify(key)} (identity + display only)`),
        { code: CORRUPT_CONFIG },
      )
    }
  }
  if (!Array.isArray(doc.agents)) {
    throw Object.assign(new Error(`agent-definition: corrupt config ${source}: agents must be an array`), { code: CORRUPT_CONFIG })
  }
  const agents = []
  const seen = new Set()
  for (let i = 0; i < doc.agents.length; i += 1) {
    let record
    try {
      record = normalizeAgentEntry(doc.agents[i], `agent at index ${i}`)
    } catch (error) {
      if (error?.code === VALIDATION_ERROR) {
        throw Object.assign(new Error(`agent-definition: corrupt config ${source}: ${error.message}`), { code: CORRUPT_CONFIG })
      }
      throw error
    }
    if (seen.has(record.id)) {
      throw Object.assign(new Error(`agent-definition: corrupt config ${source}: duplicate agent id ${record.id}`), {
        code: CORRUPT_CONFIG,
      })
    }
    seen.add(record.id)
    agents.push(record)
  }

  let defaultAgentId = doc.defaultAgentId ?? null
  if (defaultAgentId !== null && typeof defaultAgentId !== 'string') {
    throw Object.assign(new Error(`agent-definition: corrupt config ${source}: defaultAgentId must be a string or null`), {
      code: CORRUPT_CONFIG,
    })
  }
  if (defaultAgentId !== null && !seen.has(defaultAgentId)) {
    throw Object.assign(
      new Error(`agent-definition: corrupt config ${source}: defaultAgentId ${JSON.stringify(defaultAgentId)} does not resolve to a listed agent`),
      { code: CORRUPT_CONFIG },
    )
  }
  if (defaultAgentId !== null && agents.find((a) => a.id === defaultAgentId)?.disabled === true) {
    throw Object.assign(
      new Error(`agent-definition: corrupt config ${source}: defaultAgentId ${JSON.stringify(defaultAgentId)} is disabled`),
      { code: CORRUPT_CONFIG },
    )
  }
  if (agents.length > 0 && defaultAgentId === null) {
    throw Object.assign(
      new Error(`agent-definition: corrupt config ${source}: ${agents.length} agent(s) listed but no default agent`),
      { code: CORRUPT_CONFIG },
    )
  }
  return { version: CONFIG_VERSION, defaultAgentId, agents }
}

/**
 * Parse + validate the config document from its JSON text.
 * @param {string} text
 * @param {object} [opts] - {source} for error messages.
 * @returns {ReturnType<normalizeDefinition>}
 */
export function parseDefinition(text, opts = {}) {
  let doc
  try {
    doc = JSON.parse(text)
  } catch (error) {
    throw Object.assign(new Error(`agent-definition: corrupt config ${opts?.source ?? 'config'}: ${error.message}`), {
      code: CORRUPT_CONFIG,
    })
  }
  return normalizeDefinition(doc, opts)
}

/**
 * The in-process, READ-ONLY Agent Definition.
 *
 * Construction loads the config synchronously (fail-loud on a corrupt
 * file); a missing file yields an EMPTY definition (no agents, no default —
 * a legal deployment state until the config is provisioned). All reads are
 * synchronous and in-memory: there is no I/O on the routing hot path.
 */
export class AgentDefinition {
  /**
   * @param {object} options
   * @param {string} options.configFile - ABSOLUTE path of the JSON config
   *   (relative or `~`-prefixed values are rejected fail-loud).
   */
  constructor({ configFile }) {
    if (typeof configFile !== 'string' || configFile === '') {
      throw new TypeError('agent-definition: configFile must be a non-empty string')
    }
    if (!isAbsolute(configFile)) {
      throw Object.assign(
        new TypeError(`agent-definition: configFile must be an absolute path (got ${JSON.stringify(configFile)})`),
        { code: VALIDATION_ERROR },
      )
    }
    this.configFile = configFile
    /** @type {Array<{id:string,name:string,description:string|null,disabled:boolean}>} in config order. */
    this.agents = []
    /** @type {string|null} */
    this.defaultAgentId = null
    this.load()
  }

  /** Load the config from disk (synchronous, at construction). */
  load() {
    if (existsSync(this.configFile)) {
      const document = parseDefinition(readFileSync(this.configFile, 'utf8'), { source: this.configFile })
      this.agents = document.agents.map((record) => ({ ...record }))
      this.defaultAgentId = document.defaultAgentId
    }
  }

  /**
   * Reload the config from disk. The ONLY legitimate trigger is the
   * deployment-side mutation seam (agentDefinitionAccess) right after it
   * persists a change: the control plane then serves the new state without
   * a restart. Fail-loud on a corrupt file (never silently stale).
   */
  reload() {
    this.agents = []
    this.defaultAgentId = null
    this.load()
  }

  /**
   * List every defined Agent, in config order. Disabled agents ARE listed
   * (their identity remains visible to management surfaces) with
   * `disabled: true`.
   * @returns {Array<{id:string,name:string,description:string|null,disabled:boolean}>}
   */
  listAgents() {
    return this.agents.map((record) => ({ ...record }))
  }

  /**
   * Resolve one Agent by id. Disabled agents resolve (their identity record
   * stays readable — e.g. for management operations); only ROUTING rejects
   * them via `resolveAgentRef`.
   * @param {string} agentId - the agent's opaque id.
   * @returns {{id:string,name:string,description:string|null,disabled:boolean}} the Agent record.
   * @throws {Error} code `AGENT_NOT_FOUND` when the id is unknown.
   */
  getAgent(agentId) {
    const record = this.agents.find((agent) => agent.id === agentId)
    if (record === undefined) {
      throw Object.assign(new Error(`agent-definition: agent not found: ${agentId}`), { code: AGENT_NOT_FOUND })
    }
    return { ...record }
  }

  /**
   * Existence validation (no throw, no allocation beyond the boolean).
   * @param {string} agentId
   * @returns {boolean}
   */
  has(agentId) {
    return this.agents.some((agent) => agent.id === agentId)
  }

  /**
   * The default Agent — the one new channel conversations bind to on first
   * contact (D-002: resolveChannelConversation initial Binding). The config
   * is the ONLY authority for the default; nothing mutates it at runtime.
   * Never returns a disabled agent (the config invariant forbids a disabled
   * default).
   * @returns {{id:string,name:string,description:string|null,disabled:boolean}|undefined}
   *   the default Agent, or `undefined` when the config lists no Agent (a
   *   legal state, not an error).
   */
  getDefaultAgent() {
    if (this.defaultAgentId === null) return undefined
    const record = this.agents.find((agent) => agent.id === this.defaultAgentId)
    return record === undefined ? undefined : { ...record }
  }

  /**
   * Resolve an Agent reference (opaque id first, then case-insensitive
   * display name) to the Agent record. The config is the single authority
   * for both lookups; anything else — including a DISABLED agent — raises
   * `AGENT_NOT_FOUND` (disabled agents are not routable).
   * @param {string} ref - agentId or display name.
   * @returns {{id:string,name:string,description:string|null,disabled:boolean}} the resolved Agent.
   * @throws {Error} code `AGENT_NOT_FOUND` when the reference matches nothing
   *   or resolves to a disabled agent.
   */
  resolveAgentRef(ref) {
    if (typeof ref !== 'string' || ref.trim() === '') {
      throw new TypeError('agent-definition: ref must be a non-empty string')
    }
    const exact = this.agents.find((agent) => agent.id === ref)
    if (exact !== undefined && !exact.disabled) return { ...exact }
    const wanted = ref.trim().toLowerCase()
    const byName = this.agents.find((agent) => agent.name.toLowerCase() === wanted)
    if (byName === undefined || byName.disabled) {
      throw Object.assign(new Error(`agent-definition: agent not found: ${ref}`), { code: AGENT_NOT_FOUND })
    }
    return { ...byName }
  }
}
