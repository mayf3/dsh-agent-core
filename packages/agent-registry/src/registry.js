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
 * agentId is treated as an OPAQUE string: the registry generates it
 * (`agt_` + random payload) and never validates, parses or interprets it.
 * Path legality for an agentId is the workspace-bootstrap owner's job when
 * it receives one — the registry has ZERO source dependency on
 * workspace-bootstrap (or any other package).
 *
 * Persistence: a single JSON document at `storeFile` (an ABSOLUTE path —
 * fail-loud otherwise, so a literal `~` directory can never be created by
 * accident). Writes are atomic (write-tmp + rename) and serialized through
 * an internal queue, so a crash mid-write can never leave a torn store, and
 * concurrent mutations cannot interleave. Each mutation has minimal
 * transaction semantics: snapshot -> mutate -> persist -> success; a failed
 * persist restores the in-memory snapshot and rejects. The document
 * survives process restarts by construction:
 *
 *   { "version": 1,
 *     "agents": { "<agentId>": { id, name, avatar, description,
 *                                 createdAt, updatedAt } },
 *     "defaultAgentId": "<agentId>" | null }
 *
 * Store invariants are enforced fail-loud on load (the registry has no
 * delete API, so any violation means the store was tampered with): a
 * `defaultAgentId` that does not resolve to a registered agent, or a
 * non-empty registry without a legal default, both raise `CORRUPT_STORE`
 * instead of being silently "fixed".
 */

import { randomUUID } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute } from 'node:path'

/** Store document version; bumped only on breaking format changes. */
export const STORE_VERSION = 1

/** Error code thrown for a missing agent (mirrors D-002 `AGENT_NOT_FOUND`). */
export const AGENT_NOT_FOUND = 'AGENT_NOT_FOUND'

/** Error code thrown for invalid input (mirrors D-002 `VALIDATION_ERROR`). */
export const VALIDATION_ERROR = 'VALIDATION_ERROR'

/** Error code thrown when the store file exists but violates its format. */
export const CORRUPT_STORE = 'CORRUPT_STORE'

/** Prefix of every generated opaque agentId (`agt_` + random payload). */
export const AGENT_ID_PREFIX = 'agt_'

/** Max attempts to draw a unique agentId (collisions are astronomically rare). */
const MAX_ID_ATTEMPTS = 5

/**
 * Generate an opaque, never-reused agentId: `agt_` + 32 random hex chars
 * (crypto.randomUUID payload). The registry treats the id as opaque; the
 * workspace-bootstrap owner validates path legality itself when it receives
 * one.
 * @returns a fresh id.
 */
export function generateAgentId() {
  return AGENT_ID_PREFIX + randomUUID().replaceAll('-', '')
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
 * change is durably persisted (or reject and roll back); reads
 * (`listAgents`, `getAgent`, `getDefaultAgent`) are synchronous.
 */
export class AgentRegistry {
  /**
   * @param {object} options
   * @param {string} options.storeFile - ABSOLUTE path of the JSON store
   *   (relative or `~`-prefixed values are rejected; no silent resolution).
   * @param {() => string} [options.now] - ISO timestamp provider (testable).
   */
  constructor({ storeFile, now = () => new Date().toISOString() }) {
    if (typeof storeFile !== 'string' || storeFile === '') {
      throw new TypeError('agent-registry: storeFile must be a non-empty string')
    }
    if (!isAbsolute(storeFile)) {
      throw Object.assign(
        new TypeError(`agent-registry: storeFile must be an absolute path (got ${JSON.stringify(storeFile)})`),
        { code: VALIDATION_ERROR },
      )
    }
    this.storeFile = storeFile
    this.now = now
    /** @type {Record<string, {id:string,name:string,avatar:string|null,description:string|null,createdAt:string,updatedAt:string}>} */
    this.agents = new Map()
    this.defaultAgentId = null
    /** Serialization queue: every mutation runs after the previous one settles. */
    this.queue = Promise.resolve()
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
      // Fail-loud store invariants: the registry has no delete API, so a
      // dangling default pointer — or a non-empty registry without a legal
      // default — means the store was tampered with. Never silently "fix" it.
      const defaultId = document.defaultAgentId
      if (defaultId !== null && defaultId !== undefined && !this.agents.has(defaultId)) {
        throw Object.assign(
          new Error(`agent-registry: corrupt store ${this.storeFile}: defaultAgentId ${JSON.stringify(defaultId)} does not resolve to a registered agent`),
          { code: CORRUPT_STORE },
        )
      }
      if (this.agents.size > 0 && (defaultId === null || defaultId === undefined)) {
        throw Object.assign(
          new Error(`agent-registry: corrupt store ${this.storeFile}: ${this.agents.size} agent(s) registered but no default agent`),
          { code: CORRUPT_STORE },
        )
      }
      this.defaultAgentId = defaultId === undefined || defaultId === null ? null : defaultId
    }
  }

  /**
   * Serialize one mutation with minimal transaction semantics:
   *   snapshot -> mutate -> persist -> success
   * If the mutation body or `persist` throws, the in-memory state is
   * restored to the snapshot and the caller's promise rejects. No WAL / no
   * database: the store file is only ever replaced atomically, so a failed
   * persist cannot corrupt the on-disk document (a stray `.tmp` is
   * best-effort removed by `persist` itself).
   */
  enqueue(fn) {
    const run = this.queue.then(async () => {
      const snapshot = this.snapshot()
      try {
        const result = await fn()
        await this.persist()
        return result
      } catch (error) {
        this.restore(snapshot)
        throw error
      }
    })
    // Keep the chain alive even when a mutation rejects.
    this.queue = run.then(() => undefined, () => undefined)
    return run
  }

  /** Copy of the mutable state (records are plain JSON objects). */
  snapshot() {
    return {
      agents: new Map([...this.agents.entries()].map(([id, record]) => [id, { ...record }])),
      defaultAgentId: this.defaultAgentId,
    }
  }

  /** Restore the state to a snapshot (rollback path). */
  restore(snapshot) {
    this.agents = snapshot.agents
    this.defaultAgentId = snapshot.defaultAgentId
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
    try {
      await writeFile(tmp, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8' })
      await rename(tmp, this.storeFile)
    } catch (error) {
      await rm(tmp, { force: true }).catch(() => {}) // best-effort cleanup
      throw error
    }
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
   * docs/reports/agent-registry-v1.md §2.3). A later `setDefaultAgent`
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
   * Concurrency-correct: the merge against the CURRENT record happens
   * inside the serialized queue, so two concurrent `updateAgent` calls can
   * never overwrite each other's fields (e.g. `{name}` + `{avatar}` both
   * land).
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
    // Eagerly validate the provided fields (pure checks, fail-fast, no
    // state and no dependency on the current record).
    const wantName = patch?.name === undefined ? undefined : normalizeName(patch.name)
    const wantAvatar = normalizeNullable(patch?.avatar, 'avatar')
    const wantDescription = normalizeNullable(patch?.description, 'description')
    return this.enqueue(async () => {
      const current = this.agents.get(agentId)
      if (current === undefined) {
        throw Object.assign(new Error(`agent-registry: agent not found: ${agentId}`), { code: AGENT_NOT_FOUND })
      }
      const updated = {
        ...current,
        name: wantName ?? current.name,
        avatar: wantAvatar === undefined ? current.avatar : wantAvatar,
        description: wantDescription === undefined ? current.description : wantDescription,
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
