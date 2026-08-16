/**
 * @agent-core/agent-router/src/binding-store.js — durable Binding store.
 *
 * The Router / Control Plane is the SOLE owner of Bindings (D-002 §2.4, §3:
 * "切换只是改绑定"; the channel, the DSH agent, the Registry and the Memory
 * never write a Binding). Integration V1 kept the Binding table in memory,
 * which silently forgot every switch on restart. This store makes the Binding
 * table recoverable with the same minimal guarantees the agent-definition config uses (declarative, deployment-side; the binding store stays the only runtime-written table):
 *
 *   - one JSON document at an ABSOLUTE path (relative or `~`-prefixed values
 *     are rejected fail-loud, so a literal `~` directory can never be created
 *     by accident);
 *   - atomic writes (tmp + rename) so a crash can never leave a torn
 *     document; mutations are serialized through an internal queue;
 *   - fail-loud on a corrupt / unsupported document (never silently reset —
 *     the Binding table is control-plane state, losing it would silently
 *     re-bind every conversation to the default Agent);
 *   - a missing file is a legal empty table (fresh deployment).
 *
 * No database platform, no event sourcing: one JSON file, replaced
 * atomically. That is enough to satisfy the hard requirement "切到 Agent B →
 * Control Plane 重启 → 仍然是 Agent B".
 *
 * Document shape:
 *
 *   { "version": 1,
 *     "bindings": { "<channelConversationId>": {
 *       channelConversationId, activeAgentId, activeSessionId, updatedAt } },
 *     "lastSessions": { "<channelConversationId>": { "<agentId>": "<sessionId>" } } }
 *
 * `lastSessions` is the per-(ChannelConversation, Agent) SINGLE-SLOT bookmark
 * table (Mobile Gate 1: "surface × agent → lastActiveSession"). It is NOT a
 * session registry, NOT history, NOT a navigation stack — one remembered
 * session id per (surface, agent), written when the router leaves an agent.
 * It deliberately lives OUTSIDE the Binding rows so the Binding shape stays
 * `{ccId, activeAgentId, activeSessionId, updatedAt}` (M9: history never
 * enters the Binding). The field is optional in the document (absent = empty
 * table), so store files written by older versions keep loading and vice
 * versa — no format version bump.
 *
 * The store is a pure data module (zero Cordis / DSH imports): the router
 * plugin owns the domain rules (default agent, switch validation, session
 * selection, bookmark policy), the store only persists rows.
 */

import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute } from 'node:path'

/** Store document version; bumped only on breaking format changes. */
export const STORE_VERSION = 1

/** Error code thrown when the store file exists but violates its format. */
export const CORRUPT_STORE = 'CORRUPT_STORE'

/** Error code thrown for invalid input. */
export const VALIDATION_ERROR = 'VALIDATION_ERROR'

/**
 * One Binding row: which (Agent, Session) the ChannelConversation is
 * currently talking to. Mirrors the D-002 Binding shape (updatedAt included;
 * the store never invents or validates the agent — the router does).
 *
 * @typedef {{channelConversationId:string, activeAgentId:string,
 *            activeSessionId:string, updatedAt:string}} BindingRow
 */

/**
 * One bookmark: the last Session a ChannelConversation used with an Agent.
 * @typedef {{channelConversationId:string, agentId:string,
 *            sessionId:string, updatedAt:string}} LastSessionRow
 */

/**
 * The durable Binding table.
 *
 * Construction loads the store synchronously (fail-loud on a corrupt file),
 * so a mounted router is always ready. `set` resolves only after the change
 * is durably persisted; reads are synchronous.
 */
export class BindingStore {
  /**
   * @param {object} options
   * @param {string} options.storeFile - ABSOLUTE path of the JSON store
   *   (relative or `~`-prefixed values are rejected; no silent resolution).
   * @param {() => string} [options.now] - ISO timestamp provider (testable).
   */
  constructor({ storeFile, now = () => new Date().toISOString() }) {
    if (typeof storeFile !== 'string' || storeFile === '') {
      throw new TypeError('binding-store: storeFile must be a non-empty string')
    }
    if (!isAbsolute(storeFile)) {
      throw Object.assign(
        new TypeError(`binding-store: storeFile must be an absolute path (got ${JSON.stringify(storeFile)})`),
        { code: VALIDATION_ERROR },
      )
    }
    this.storeFile = storeFile
    this.now = now
    /** @type {Map<string, BindingRow>} */
    this.bindings = new Map()
    /** @type {Map<string, Map<string, string>>} ccId -> (agentId -> sessionId) */
    this.lastSessions = new Map()
    this.queue = Promise.resolve()
    this.load()
  }

  /** Load the store from disk (synchronous, at construction). */
  load() {
    if (!existsSync(this.storeFile)) return
    let document
    try {
      document = JSON.parse(readFileSync(this.storeFile, 'utf8'))
    } catch (error) {
      throw Object.assign(
        new Error(`binding-store: corrupt store file ${this.storeFile}: ${error.message}`),
        { code: CORRUPT_STORE },
      )
    }
    if (document?.version !== STORE_VERSION || typeof document.bindings !== 'object' || document.bindings === null) {
      throw Object.assign(new Error(`binding-store: unsupported store format in ${this.storeFile}`), {
        code: CORRUPT_STORE,
      })
    }
    for (const [key, row] of Object.entries(document.bindings)) {
      // Rebuild from the row itself; the map key is derived, never trusted.
      if (typeof row?.channelConversationId !== 'string'
          || typeof row.activeAgentId !== 'string'
          || typeof row.activeSessionId !== 'string') {
        throw Object.assign(new Error(`binding-store: corrupt binding row at key ${JSON.stringify(key)}`), {
          code: CORRUPT_STORE,
        })
      }
      this.bindings.set(row.channelConversationId, {
        channelConversationId: row.channelConversationId,
        activeAgentId: row.activeAgentId,
        activeSessionId: row.activeSessionId,
        updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : this.now(),
      })
    }
    // Optional bookmark table (absent in older documents = empty).
    if (document.lastSessions !== undefined) {
      if (typeof document.lastSessions !== 'object' || document.lastSessions === null) {
        throw Object.assign(new Error(`binding-store: corrupt lastSessions table in ${this.storeFile}`), {
          code: CORRUPT_STORE,
        })
      }
      for (const [ccId, perAgent] of Object.entries(document.lastSessions)) {
        if (typeof perAgent !== 'object' || perAgent === null) {
          throw Object.assign(new Error(`binding-store: corrupt lastSessions row at key ${JSON.stringify(ccId)}`), {
            code: CORRUPT_STORE,
          })
        }
        const bookmarks = new Map()
        for (const [agentId, sessionId] of Object.entries(perAgent)) {
          if (typeof sessionId !== 'string' || sessionId === '') {
            throw Object.assign(new Error(`binding-store: corrupt lastSessions entry ${JSON.stringify(ccId)}/${JSON.stringify(agentId)}`), {
              code: CORRUPT_STORE,
            })
          }
          bookmarks.set(agentId, sessionId)
        }
        this.lastSessions.set(ccId, bookmarks)
      }
    }
  }

  /**
   * Serialize one mutation with minimal transaction semantics (FIX 3, same
   * pattern the agent-definition writer uses): snapshot -> mutate -> persist -> success; a
   * failed persist restores the in-memory snapshot and rejects, so RAM can
   * never diverge from disk ("RAM = new Binding, disk = old Binding, caller
   * = failure" is impossible). The store file is only ever replaced
   * atomically, so a failed persist cannot corrupt the on-disk document.
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
    this.queue = run.then(() => undefined, () => undefined)
    return run
  }

  /** Copy of the mutable state (rows are plain JSON objects). */
  snapshot() {
    return {
      bindings: new Map([...this.bindings.entries()].map(([id, row]) => [id, { ...row }])),
      lastSessions: new Map([...this.lastSessions.entries()].map(([ccId, perAgent]) => [ccId, new Map(perAgent)])),
    }
  }

  /** Restore the state to a snapshot (rollback path). */
  restore(snapshot) {
    this.bindings = snapshot.bindings
    this.lastSessions = snapshot.lastSessions
  }

  /** Atomic persist: write tmp, then rename over the store file. */
  async persist() {
    const document = {
      version: STORE_VERSION,
      bindings: Object.fromEntries([...this.bindings.entries()].map(([id, row]) => [id, { ...row }])),
    }
    if (this.lastSessions.size > 0) {
      document.lastSessions = Object.fromEntries(
        [...this.lastSessions.entries()].map(([ccId, perAgent]) => [ccId, Object.fromEntries(perAgent)]),
      )
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
   * Read one Binding by ChannelConversation id.
   * @param {string} channelConversationId
   * @returns {BindingRow | undefined}
   */
  get(channelConversationId) {
    return this.bindings.get(channelConversationId)
  }

  /**
   * Every Binding row, in insertion order (insertion is deterministic:
   * a Map preserves key order, so `list()` order is stable across
   * load-from-disk as long as the document key order is stable — which
   * JSON.parse preserves).
   * @returns {BindingRow[]}
   */
  list() {
    return [...this.bindings.values()].map((row) => ({ ...row }))
  }

  /**
   * Upsert one Binding row and persist it (resolves only after the write
   * lands on disk).
   * @param {BindingRow} row - the full row to store.
   * @returns {Promise<BindingRow>} the stored row.
   */
  set(row) {
    if (typeof row?.channelConversationId !== 'string' || row.channelConversationId === ''
        || typeof row.activeAgentId !== 'string' || row.activeAgentId === ''
        || typeof row.activeSessionId !== 'string' || row.activeSessionId === '') {
      throw Object.assign(new TypeError('binding-store: channelConversationId/activeAgentId/activeSessionId are required'), {
        code: VALIDATION_ERROR,
      })
    }
    return this.enqueue(async () => {
      const stored = {
        channelConversationId: row.channelConversationId,
        activeAgentId: row.activeAgentId,
        activeSessionId: row.activeSessionId,
        updatedAt: row.updatedAt ?? this.now(),
      }
      this.bindings.set(stored.channelConversationId, stored)
      return { ...stored }
    })
  }

  /**
   * Read one bookmark: the last Session this ChannelConversation used with
   * `agentId`, or undefined when never visited (Mobile Gate 1 rule:
   * `bookmark(surface, agent) ?? main`).
   * @param {string} channelConversationId
   * @param {string} agentId
   * @returns {string | undefined}
   */
  getLastSession(channelConversationId, agentId) {
    return this.lastSessions.get(channelConversationId)?.get(agentId)
  }

  /**
   * Write one single-slot bookmark and persist it. Replaces any previous
   * value for the same (ccId, agentId) — a bookmark is ONE remembered
   * session, never a stack (M9).
   * @param {string} channelConversationId
   * @param {string} agentId
   * @param {string} sessionId
   * @returns {Promise<{channelConversationId:string, agentId:string,
   *   sessionId:string, updatedAt:string}>} the stored bookmark.
   */
  setLastSession(channelConversationId, agentId, sessionId) {
    if (typeof channelConversationId !== 'string' || channelConversationId === ''
        || typeof agentId !== 'string' || agentId === ''
        || typeof sessionId !== 'string' || sessionId === '') {
      throw Object.assign(new TypeError('binding-store: channelConversationId/agentId/sessionId are required'), {
        code: VALIDATION_ERROR,
      })
    }
    return this.enqueue(async () => {
      let perAgent = this.lastSessions.get(channelConversationId)
      if (perAgent === undefined) {
        perAgent = new Map()
        this.lastSessions.set(channelConversationId, perAgent)
      }
      perAgent.set(agentId, sessionId)
      return {
        channelConversationId,
        agentId,
        sessionId,
        updatedAt: this.now(),
      }
    })
  }

  /**
   * Every bookmark row (test/evidence surface). Flattened, insertion order.
   * @returns {LastSessionRow[]}
   */
  lastSessionsSnapshot() {
    const rows = []
    for (const [ccId, perAgent] of this.lastSessions.entries()) {
      for (const [agentId, sessionId] of perAgent.entries()) {
        rows.push({ channelConversationId: ccId, agentId, sessionId })
      }
    }
    return rows
  }
}
