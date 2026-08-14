/**
 * @agent-core/agent-registry — the long-lived Agent identity registry (core).
 *
 * An Agent is a *long-lived entity* ("数字员工/人"), not a directory, a
 * process, or a session. This registry is the single answer to:
 *
 *   - Which Agents exist in the system?           -> listAgents()
 *   - Which Agent is `agentId`?                   -> getAgent(agentId)
 *   - Which Agent is the default one?             -> getDefaultAgent()
 *
 * The registry owns only identity + display data (D-002 Agent schema:
 * `id` / `name` / `avatar` / `description`). It does NOT own — and never
 * touches — the agent's workspace / DSH_HOME / process / session / memory.
 * Those resources stay owned by their dedicated components; the registry
 * merely records that the Agent *has* them (boundary documented in
 * docs/reports/agent-registry-v1.md).
 *
 * Persistence: a single JSON document at `storeFile` (default
 * `~/.dsh/registry/agents.json`, overridable). Writes are atomic
 * (write-tmp + rename) and serialized through an internal queue, so a crash
 * mid-write can never leave a torn store, and concurrent mutations cannot
 * interleave. The document survives process restarts by construction:
 *
 *   { "version": 1,
 *     "agents": { "<agentId>": { id, name, avatar, description,
 *                                 createdAt, updatedAt } },
 *     "defaultAgentId": "<agentId>" | null }
 *
 * agentId validity is REUSED from @agent-core/workspace-bootstrap
 * (`sanitizeAgentId`): generated ids are guaranteed to be valid single path
 * components so the workspace-bootstrap owner can later map them to
 * workspace / DSH_HOME segments. The registry itself never computes any
 * path — it only ever stores the id string.
 */

import { randomUUID } from 'node:crypto'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { sanitizeAgentId } from '../../workspace-bootstrap/src/paths.js'

/** Store document version; bumped only on breaking format changes. */
export const STORE_VERSION = 1

/** Error code thrown for a missing agent (mirrors D-002 `AGENT_NOT_FOUND`). */
export const AGENT_NOT_FOUND = 'AGENT_NOT_FOUND'

/** Error code thrown for invalid input (mirrors D-002 `VALIDATION_ERROR`). */
export const VALIDATION_ERROR = 'VALIDATION_ERROR'

/** Error code thrown when the store file exists but cannot be parsed. */
export const CORRUPT_STORE = 'CORRUPT_STORE'

/** Prefix of every generated opaque agentId (`agt_` + 32 hex chars). */
export const AGENT_ID_PREFIX = 'agt_'

/** Max attempts to draw a unique agentId (collisions are astronomically rare). */
const MAX_ID_ATTEMPTS = 5

/**
 * Generate an opaque, path-safe, never-reused agentId.
 * Alphabet: `agt_` + lowercase hex — a strict subset of what
 * `sanitizeAgentId` accepts, so the id is always a valid workspace path
 * component for the workspace-bootstrap owner.
 * @returns a fresh id.
 */
export function generateAgentId() {
  return AGENT_ID_PREFIX + randomUUID().replaceAll('-', '')
}

/** Validate a caller-supplied id via the workspace-bootstrap rules. */
function assertValidAgentId(agentId) {
  try {
    sanitizeAgentId(agentId)
  } catch (error) {
    throw Object.assign(new TypeError(`agent-registry: invalid agentId ${JSON.stringify(agentId)}: ${error.message}`), {
      code: VALIDATION_ERROR,
    })
  }
}

/** Public D-002 Agent shape: identity + display only (no internal timestamps). */
function publicAgent(record) {
  return {
    id: record.id,
    name: record.name,
    avatar: record.avatar,
    description: record.description,
  }
}

/** Validate registration/update input and normalize it to store fields. */
function normalizeName(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw Object.assign(new TypeError('agent-registry: name must be a non-empty string'), { code: VALIDATION_ERROR })
  }
  return name
}

function normalizeNullable(value, field) {
  if (value === undefined) return undefined // keep existing
  if (value === null || typeof value === 'string') return value
  throw Object.assign(new TypeError(`agent-registry: ${field} must be a string or null`), { code: VALIDATION_ERROR })
}

/**
 * The in-process agent registry.
 *
 * Construction loads the store synchronously (fail-loud on a corrupt file),
 * so a mounted service is always ready. Mutations (`registerAgent`,
 * `updateAgent`, `setDefaultAgent`) are async and resolve only after the
 * change is durably persisted; reads (`listAgents`, `getAgent`,
 * `getDefaultAgent`) are synchronous.
 */
export class AgentRegistry {
  /**
   * @param {object} options
   * @param {string} options.storeFile - absolute path of the JSON store.
   * @param {() => string} [options.now] - ISO timestamp provider (testable).
   */
  constructor({ storeFile, now = () => new Date().toISOString() }) {
    if (typeof storeFile !== 'string' || storeFile === '') {
      throw new TypeError('agent-registry: storeFile must be a non-empty string')
    }
    this.storeFile = storeFile
    this.now = now
    /** @type {Record<string, {id:string,name:string,avatar:string|null,description:string|null,createdAt:string,updatedAt:string}>} */
    this.agents = new Map()
    this.defaultAgentId = null
    /** Serialization queue: every mutation runs after the previous one settles. */
    this.queue = Promise.resolve()
    this.loaded = false
    this.load()
  }

  /** Load the store from disk (synchronous, at construction). */
  load() {
    if (existsSync(this.storeFile)) {
      let document
      try {
        document = JSON.parse(readFileSync(this.storeFile, 'utf8'))
      } catch (error) {
        throw Object.assign(new Error(`agent-registry: corrupt store file ${this.storeFile}: ${error.message}`), {
          code: CORRUPT_STORE,
        })
      }
      if (document?.version !== STORE_VERSION || typeof document.agents !== 'object' || document.agents === null) {
        throw Object.assign(new Error(`agent-registry: unsupported store format in ${this.storeFile}`), {
          code: CORRUPT_STORE,
        })
      }
      for (const [key, record] of Object.entries(document.agents)) {
        // Rebuild from the record itself; the map key is derived, never
        // trusted as the identity.
        if (typeof record?.id !== 'string' || typeof record.name !== 'string') {
          throw Object.assign(new Error(`agent-registry: corrupt agent record at key ${JSON.stringify(key)}`), {
            code: CORRUPT_STORE,
          })
        }
        this.agents.set(record.id, {
          id: record.id,
          name: record.name,
          avatar: record.avatar ?? null,
          description: record.description ?? null,
          createdAt: typeof record.createdAt === 'string' ? record.createdAt : this.now(),
          updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : record.createdAt ?? this.now(),
        })
      }
      // Defensive: a dangling default pointer is cleared, never kept.
      this.defaultAgentId = this.agents.has(document.defaultAgentId) ? document.defaultAgentId : null
    }
    this.loaded = true
  }

  /** Serialize one mutation; `fn` mutates in-memory state, then persists. */
  enqueue(fn) {
    const run = this.queue.then(async () => {
      const result = await fn()
      await this.persist()
      return result
    })
    // Keep the chain alive even when a mutation rejects.
    this.queue = run.then(() => undefined, () => undefined)
    return run
  }

  /** Atomic persist: write tmp, then rename over the store file. */
  async persist() {
    const document = {
      version: STORE_VERSION,
      agents: Object.fromEntries([...this.agents.entries()].map(([id, record]) => [id, { ...record }])),
      defaultAgentId: this.defaultAgentId,
    }
    await mkdir(dirname(this.storeFile), { recursive: true })
    const tmp = `${this.storeFile}.tmp`
    await writeFile(tmp, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8' })
    await rename(tmp, this.storeFile)
  }

  /**
   * List every registered Agent, in registration order.
   * @returns {Array<{id:string,name:string,avatar:string|null,description:string|null}>}
   */
  listAgents() {
    return [...this.agents.values()].map(publicAgent)
  }

  /**
   * Resolve one Agent by id.
   * @param {string} agentId - the agent's opaque id.
   * @returns the public Agent record.
   * @throws {Error} code `AGENT_NOT_FOUND` when the id is unknown.
   */
  getAgent(agentId) {
    const record = this.agents.get(agentId)
    if (record === undefined) {
      throw Object.assign(new Error(`agent-registry: agent not found: ${agentId}`), { code: AGENT_NOT_FOUND })
    }
    return publicAgent(record)
  }

  /**
   * Register a new Agent. The registry generates the opaque id; the caller
   * can never pick one, so id uniqueness is guaranteed by construction and
   * `agentId` never collides or gets reused.
   *
   * The FIRST registered Agent automatically becomes the default
   * (D-002 open question 4 — resolved as "first created"; see
   * docs/reports/agent-registry-v1.md §3.3). A later `setDefaultAgent`
   * overrides this.
   *
   * @param {{name:string, avatar?:string|null, description?:string|null}} input
   * @returns the public Agent record (id generated).
   */
  registerAgent(input) {
    const name = normalizeName(input?.name)
    const avatar = normalizeNullable(input?.avatar, 'avatar') ?? null
    const description = normalizeNullable(input?.description, 'description') ?? null
    return this.enqueue(async () => {
      let id
      for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
        id = generateAgentId()
        if (!this.agents.has(id)) break
        id = undefined
      }
      if (id === undefined) throw new Error('agent-registry: could not draw a unique agentId')
      assertValidAgentId(id)
      const now = this.now()
      const record = { id, name, avatar, description, createdAt: now, updatedAt: now }
      this.agents.set(id, record)
      // First registered Agent becomes the default (only if none is set).
      if (this.defaultAgentId === null) this.defaultAgentId = id
      return publicAgent(record)
    })
  }

  /**
   * Update display fields of an existing Agent. `agentId` is immutable:
   * this method never changes it. Fields left `undefined` keep their value;
   * pass `null` to clear `avatar` / `description`.
   *
   * @param {string} agentId - the agent's opaque id.
   * @param {{name?:string, avatar?:string|null, description?:string|null}} patch
   * @returns the updated public Agent record.
   * @throws {Error} code `AGENT_NOT_FOUND` when the id is unknown.
   */
  updateAgent(agentId, patch) {
    if (!this.agents.has(agentId)) {
      throw Object.assign(new Error(`agent-registry: agent not found: ${agentId}`), { code: AGENT_NOT_FOUND })
    }
    const record = this.agents.get(agentId)
    const name = patch?.name === undefined ? record.name : normalizeName(patch.name)
    const avatar = normalizeNullable(patch?.avatar, 'avatar')
    const description = normalizeNullable(patch?.description, 'description')
    return this.enqueue(async () => {
      const current = this.agents.get(agentId)
      if (current === undefined) {
        throw Object.assign(new Error(`agent-registry: agent not found: ${agentId}`), { code: AGENT_NOT_FOUND })
      }
      const updated = {
        ...current,
        name,
        avatar: avatar === undefined ? current.avatar : avatar,
        description: description === undefined ? current.description : description,
        updatedAt: this.now(),
      }
      this.agents.set(agentId, updated)
      return publicAgent(updated)
    })
  }

  /**
   * The default Agent — the one new channel conversations bind to on first
   * contact (D-002: resolveChannelConversation initial Binding).
   * @returns the public Agent record, or `undefined` when no Agent is
   *   registered yet (a legal state, not an error).
   */
  getDefaultAgent() {
    if (this.defaultAgentId === null) return undefined
    const record = this.agents.get(this.defaultAgentId)
    return record === undefined ? undefined : publicAgent(record)
  }

  /**
   * Explicitly set which Agent is the default. Persisted, so the choice
   * survives restarts. This is the only way to change the default without
   * touching configuration or code (the first registered Agent is default
   * otherwise — see {@link AgentRegistry#registerAgent}).
   *
   * @param {string} agentId - the agent's opaque id.
   * @returns the public Agent record now default.
   * @throws {Error} code `AGENT_NOT_FOUND` when the id is unknown.
   */
  setDefaultAgent(agentId) {
    if (!this.agents.has(agentId)) {
      throw Object.assign(new Error(`agent-registry: agent not found: ${agentId}`), { code: AGENT_NOT_FOUND })
    }
    return this.enqueue(async () => {
      if (!this.agents.has(agentId)) {
        throw Object.assign(new Error(`agent-registry: agent not found: ${agentId}`), { code: AGENT_NOT_FOUND })
      }
      this.defaultAgentId = agentId
      return publicAgent(this.agents.get(agentId))
    })
  }
}
