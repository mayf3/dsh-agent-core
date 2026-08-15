/**
 * @agent-core/agent-router/src/binding-store.js — durable Binding store.
 *
 * The Router / Control Plane is the SOLE owner of Bindings (D-002 §2.4, §3:
 * "切换只是改绑定"; the channel, the DSH agent, the Registry and the Memory
 * never write a Binding). Integration V1 kept the Binding table in memory,
 * which silently forgot every switch on restart. This store makes the Binding
 * table recoverable with the same minimal guarantees the agent-registry uses:
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
 *       channelConversationId, activeAgentId, activeSessionId, updatedAt } } }
 *
 * The store is a pure data module (zero Cordis / DSH imports): the router
 * plugin owns the domain rules (default agent, switch validation, session
 * selection), the store only persists rows.
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
  }

  /** Serialize one mutation: mutate in memory, then persist atomically. */
  enqueue(fn) {
    const run = this.queue.then(async () => {
      const result = await fn()
      await this.persist()
      return result
    })
    this.queue = run.then(() => undefined, () => undefined)
    return run
  }

  /** Atomic persist: write tmp, then rename over the store file. */
  async persist() {
    const document = {
      version: STORE_VERSION,
      bindings: Object.fromEntries([...this.bindings.entries()].map(([id, row]) => [id, { ...row }])),
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
}
