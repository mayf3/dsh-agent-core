/**
 * @agent-core/agent-memory — Cordis plugin: per-agent long-term memory glue.
 *
 * FILE-FIRST per-agent memory (see src/memory.js): MEMORY.md in the agent's
 * workspace is the canonical store; memory/YYYY-MM-DD.md is the episodic
 * fallback layer. This plugin is the THIN glue that connects the file store
 * to one DSH agent process:
 *
 *   1. `ctx.agentMemory` service — load(agentId) / renderForContext(agentId) /
 *      update(...) / remove(...) / search(...) / consolidate(agentId,
 *      sessionEvidence) — the Agent Core memory glue surface (also usable by
 *      a future control plane / human tooling).
 *   2. Model tools — memory_save / memory_search / memory_list /
 *      memory_update / memory_delete / memory_consolidate (adapted from
 *      @modusensus/dsh-mneme's tool set, file-backed instead of SQLite).
 *   3. Automatic injection — fresh sessions receive the curated memory via
 *      `systemPrompt.context` (re-read from disk at every assembly, so
 *      human edits are visible immediately).
 *   4. Automatic consolidation — on `turn/end` the session's new evidence is
 *      distilled by the LLM into curated entries (debounced); when the LLM
 *      path fails or yields nothing, the raw evidence still lands in the
 *      daily note (reliable fallback — nothing is lost).
 *
 * Isolation is physical: this plugin lives inside one per-agent DSH process
 * (one agent per workspace), so all file operations stay inside that agent's
 * workspace; a different agentId resolves to a different directory.
 *
 * stdout is reserved for the JSON-RPC protocol of the demo-server; all
 * diagnostics go through ctx.logger (stderr), never console.log.
 */

import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { basename } from 'node:path'
import { mkdir } from 'node:fs/promises'

import {
  agentIdFromCwd,
  resolveAgentWorkspace,
  resolveMemoryDir,
  resolveMemoryFile,
} from './paths.js'
import {
  consolidate,
  loadEntries,
  loadEntriesSync,
  readDailyNotes,
  removeEntry,
  renderContextText,
  saveWithDedupe,
  searchEntries,
  updateEntry,
  writeEntries,
} from './memory.js'

/** Stable plugin name referenced by bundle patches. */
export const name = 'agent-memory'

/** Optional services are read via ctx.get; nothing is a hard dependency. */
export const inject = []

/** Plugin config. */
export const Config = z.object({
  /** Optional agentId; defaults to the basename of the process cwd (the workspace dir name). */
  agentId: z.string(),
  /** Optional workspace-root override, passed through to workspace-bootstrap. */
  workspaceRoot: z.string(),
  /** Inject curated memory into fresh sessions (default true). */
  autoInject: z.boolean().default(true),
  /** Max entries injected per session (default 6). */
  maxInjectedEntries: z.natural().min(1).max(20).default(6),
  /** Max chars of injected memory block (default 2400). */
  maxInjectedChars: z.natural().min(200).max(20000).default(2400),
  /** Auto-consolidate session evidence at turn/end (default true). */
  autoConsolidate: z.boolean().default(true),
  /** Debounce before the consolidation LLM call (default 3000ms). */
  consolidateDelayMs: z.natural().min(0).max(60000).default(3000),
  /** Append raw evidence to the daily note on every consolidation (default true). */
  dailyNotes: z.boolean().default(true),
  /** Optional explicit LLM route for consolidation (default: session route, then agent default). */
  provider: z.string(),
  /** Optional explicit model for consolidation (default: session route, then agent default). */
  model: z.string(),
})

const TEXT_OUTPUT = (text) => [{ type: 'text', text }]

/** Wire shape of a memory entry as returned by tools. */
const MEMORY_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', required: true },
    type: { type: 'string', required: true },
    title: { type: 'string', required: true },
    content: { type: 'string', required: true },
    tags: { type: 'array', items: { type: 'string' } },
    importance: { type: 'integer', required: true },
    source: { type: 'string' },
    updatedAt: { type: 'string', required: true },
  },
}

/** toApiList: strip nothing, expose the full entry. */
function toApiList(entries) {
  return entries.map((m) => ({
    id: m.id,
    type: m.type,
    title: m.title,
    content: m.content,
    tags: m.tags,
    importance: m.importance,
    source: m.source,
    updatedAt: m.updatedAt,
  }))
}

const DISTILL_PROMPT = `You are the memory distillation assistant of a long-lived agent.
From the session evidence below, extract 2-3 facts worth remembering ACROSS sessions:
user preferences, durable personal facts, project state, or key decisions.
Rules:
- Only output a JSON array, each item: {"type":"preference|project|decision|history","title":"short unique title","content":"one-sentence fact — keep dates, numbers and proper nouns EXACTLY as stated","importance":1-5}
- A preference is something the user wants done generally; a decision is a choice made; history is a one-off event worth recalling.
- Do not invent facts that are not in the evidence. Do not output anything else.`

/**
 * Mount the memory plugin.
 *
 * Arrow (not function declaration) on purpose: cordis 4 treats any apply with
 * a prototype as a class constructor (`new apply(...)`) and discards its
 * return value, so a `function apply` disposer would never run on unload.
 * An arrow has no prototype, is called normally, and its returned disposer
 * is collected and run by the fiber on unload (same pattern as dsh-mneme).
 * @param ctx - plugin context.
 * @param config - validated plugin config.
 */
export const apply = (ctx, config = {}) => {
  const cfg = Config(config)
  // agentId precedence: explicit config > $DSH_AGENT_ID (the control plane /
  // process launcher knows the id) > basename of the cwd (the standard
  // `<workspaceRoot>/<agentId>` layout, where the workspace dir is the id).
  const agentId = cfg.agentId ?? process.env.DSH_AGENT_ID ?? agentIdFromCwd(process.cwd())
  if (agentId === undefined) {
    throw new Error('agent-memory: cannot determine agentId (set config.agentId, DSH_AGENT_ID, or run with cwd inside the agent workspace)')
  }
  const workspace = resolveAgentWorkspace(agentId, cfg.workspaceRoot)
  const memoryFile = resolveMemoryFile(workspace)
  // The per-agent demo composition has no console logger; diagnostics go to
  // ctx.logger when present, otherwise to stderr (stdout is reserved for the
  // JSON-RPC protocol of the demo-server).
  const diag = (level, ...args) => {
    const line = `[agent-memory] ${args.join(' ')}`
    try { ctx.logger?.[level]?.(line) } catch { /* ignore */ }
    process.stderr.write(`${line}\n`)
  }
  const log = {
    info: (...args) => diag('info', ...args),
    warn: (...args) => diag('warn', ...args),
  }

  // Ensure the memory directory exists up front (fail fast on a bad root).
  void mkdir(resolveMemoryDir(workspace), { recursive: true })

  const state = {
    lastSeqBySession: new Map(), // sessionId -> last consolidated event seq
    timers: new Set(),           // pending debounce timers (fiber-owned)
    disposers: [],
    running: new Set(),          // in-flight consolidations
  }

  /** Read the current entries (fresh from disk — human edits always win). */
  async function load() {
    return loadEntries(memoryFile)
  }

  /** Render the injection text for this agent (fresh read). */
  async function renderForContext() {
    const entries = await load()
    return renderContextText(entries, {
      maxEntries: cfg.maxInjectedEntries,
      maxChars: cfg.maxInjectedChars,
    })
  }

  /** update(...) glue: save/merge an entry, persist atomically. */
  async function update(entry) {
    const entries = await load()
    const outcome = saveWithDedupe(entries, entry)
    await writeEntries(memoryFile, outcome.entries)
    log.info(`memory ${outcome.action}: ${outcome.entry.title}`)
    return { action: outcome.action, memory: outcome.entry }
  }

  /** remove(id) glue: delete an entry, persist atomically. */
  async function remove(id) {
    const entries = await load()
    const outcome = removeEntry(entries, id)
    if (outcome.removed) await writeEntries(memoryFile, outcome.entries)
    return outcome.removed
  }

  /** search(query) glue. */
  async function search(query) {
    return searchEntries(await load(), query)
  }

  /** list() glue. */
  async function list() {
    return load()
  }

  /** Resolve the LLM route for distillation. */
  function resolveRoute(session) {
    try {
      const header = session?.requestHeader?.()?.config
      if (header?.provider && header?.model) return { provider: header.provider, model: header.model }
    } catch { /* fall through */ }
    if (cfg.provider && cfg.model) return { provider: cfg.provider, model: cfg.model }
    try {
      const sel = ctx.get('agentDefaultModel')?.currentSelection?.()
      if (sel?.provider && sel?.model) return { provider: sel.provider, model: sel.model }
    } catch { /* fall through */ }
    return undefined
  }

  /** LLM-backed distill function fed to the pure consolidate core. */
  function makeDistill(session) {
    const route = resolveRoute(session)
    if (!route) return undefined
    return async (evidenceText) => {
      const llm = ctx.get('llm')
      if (!llm) return []
      let text = ''
      for await (const chunk of llm.stream({
        provider: route.provider,
        model: route.model,
        purpose: 'compaction',
        maxTokens: 2048,
        messages: [
          { role: 'system', content: [{ type: 'text', text: DISTILL_PROMPT }] },
          { role: 'user', content: [{ type: 'text', text: evidenceText }] },
        ],
      })) {
        if (chunk.type === 'text-delta') text += chunk.text
        if (chunk.type === 'finish' && (chunk.reason?.kind === 'error' || chunk.reason?.kind === 'aborted')) {
          throw new Error(`consolidation stream aborted: ${chunk.reason.kind}`)
        }
      }
      const start = text.indexOf('[')
      const end = text.lastIndexOf(']')
      if (start === -1 || end <= start) return []
      return JSON.parse(text.slice(start, end + 1))
    }
  }

  /**
   * consolidate(agentId, sessionEvidence) glue. `sessionEvidence` is text
   * (raw transcript of the session turn); falls back to the daily note when
   * distillation is unavailable or fails. Distilled entries are stamped with
   * consolidation provenance (unless the distill output already carries one).
   */
  async function consolidateNow(sessionEvidence, { session } = {}) {
    const provenance = session ? `consolidation:session:${session.id}` : 'consolidation'
    const result = await consolidate({
      workspace,
      memoryFile,
      evidence: sessionEvidence,
      distill: async (text) => {
        const distillFn = makeDistill(session)
        if (!distillFn) return []
        const distilled = await distillFn(text)
        // The provenance is machine-owned: always stamp where this entry came
        // from (a model-supplied "source" would be unverifiable).
        return (Array.isArray(distilled) ? distilled : []).map((item) => ({
          ...item,
          source: provenance,
        }))
      },
      dailyNotes: cfg.dailyNotes,
      logger: log,
    })
    log.info(`consolidation: ${result.saved.length} entries saved, fallback=${result.fallback}`)
    return { saved: toApiList(result.saved), fallback: result.fallback }
  }

  // ------------------------------------------------------------------ tools

  const tools = [
    defineTool({
      name: 'memory_save',
      description:
        'Persist one memory entry for future sessions (user preferences, durable personal facts, project state, decisions). ' +
        'Call this when the user states a durable preference or fact, or a project decision is made. ' +
        'Merges into an existing entry of the same type when the title matches.',
      parameters: {
        type: { type: 'string', required: true, enum: ['preference', 'project', 'decision', 'history'], description: 'preference=user preference/durable fact; project=project knowledge/state; decision=key decision; history=conversation event worth recalling' },
        title: { type: 'string', required: true, description: 'Short unique title' },
        content: { type: 'string', required: true, description: 'Memory body' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
        importance: { type: 'integer', description: '1-5; >= 3 auto-injects into future sessions' },
        source: { type: 'string', description: 'Optional provenance' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            action: { type: 'string', required: true, enum: ['created', 'merged'] },
            id: { type: 'string', required: true },
          },
        },
        render: (_args, value) => TEXT_OUTPUT(`memory ${value.action}: ${value.id}`),
      },
      async execute(args) {
        const { action, memory } = await update({
          type: args.type,
          title: args.title,
          content: args.content,
          tags: args.tags ?? [],
          importance: args.importance ?? 3,
          source: args.source ?? 'tool',
        })
        return { action, id: memory.id }
      },
    }),

    defineTool({
      name: 'memory_search',
      description:
        'Search this agent\'s cross-session long-term memory (MEMORY.md). Use when you need past context: user preferences, durable facts, project decisions. Substring-matches title/content/tags.',
      parameters: {
        query: { type: 'string', required: true, description: 'Search text; substring match over title/content/tags' },
        limit: { type: 'integer', description: 'Max results (default 10)' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            items: { type: 'array', required: true, items: MEMORY_ITEM_SCHEMA },
          },
        },
        render: (_args, value) => TEXT_OUTPUT(`Found ${value.items.length} memory entr${value.items.length === 1 ? 'y' : 'ies'}.`),
      },
      async execute(args) {
        const limit = args.limit ?? 10
        return { items: toApiList((await search(args.query)).slice(0, limit)) }
      },
    }),

    defineTool({
      name: 'memory_list',
      description: 'List this agent\'s memory entries, high-importance first, then newest.',
      parameters: {
        type: { type: 'string', enum: ['preference', 'project', 'decision', 'history'], description: 'Filter by type; omit for all' },
        limit: { type: 'integer', description: 'Max results (default 50)' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            items: { type: 'array', required: true, items: MEMORY_ITEM_SCHEMA },
            total: { type: 'integer', required: true },
          },
        },
        render: (_args, value) => TEXT_OUTPUT(`${value.items.length} memory entries (of ${value.total}).`),
      },
      async execute(args) {
        const all = await list()
        const filtered = args.type ? all.filter((m) => m.type === args.type) : all
        const sorted = [...filtered].sort((a, b) => b.importance - a.importance || (a.updatedAt < b.updatedAt ? 1 : -1))
        return { items: toApiList(sorted.slice(0, args.limit ?? 50)), total: filtered.length }
      },
    }),

    defineTool({
      name: 'memory_update',
      description: 'Modify an existing memory entry (title, content, type, tags, importance).',
      parameters: {
        id: { type: 'string', required: true, description: 'Memory id' },
        title: { type: 'string' },
        content: { type: 'string' },
        type: { type: 'string', enum: ['preference', 'project', 'decision', 'history'] },
        tags: { type: 'array', items: { type: 'string' } },
        importance: { type: 'integer', description: '1-5' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            memory: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                title: { type: 'string', required: true },
                content: { type: 'string', required: true },
              },
            },
          },
        },
        render: (_args, value) => TEXT_OUTPUT(`Updated memory ${value.memory.id}: ${value.memory.title}`),
      },
      async execute(args) {
        const entries = await load()
        const outcome = updateEntry(entries, args.id, {
          title: args.title,
          content: args.content,
          type: args.type,
          tags: args.tags,
          importance: args.importance,
        })
        if (outcome.entry === undefined) throw new Error('memory not found')
        await writeEntries(memoryFile, outcome.entries)
        return { memory: { id: outcome.entry.id, title: outcome.entry.title, content: outcome.entry.content } }
      },
    }),

    defineTool({
      name: 'memory_delete',
      description: 'Permanently delete a memory entry.',
      parameters: {
        id: { type: 'string', required: true },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: { deleted: { type: 'boolean', required: true } },
        },
        render: (_args, value) => TEXT_OUTPUT(value.deleted ? 'Memory deleted.' : 'Memory not found.'),
      },
      async execute(args) {
        const deleted = await remove(args.id)
        return { deleted }
      },
    }),

    defineTool({
      name: 'memory_consolidate',
      description:
        'Consolidate the current session\'s new evidence into long-term memory now: distill durable facts from the recent conversation into curated MEMORY.md entries (and always keep raw evidence in the daily note). Call this explicitly when the session produced facts worth keeping across sessions and you want them persisted immediately.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            saved: { type: 'integer', required: true },
            fallback: { type: 'boolean', required: true },
          },
        },
        render: (_args, value) => TEXT_OUTPUT(`Consolidated: ${value.saved} entries saved (daily-note fallback: ${value.fallback}).`),
      },
      async execute(_args, exec) {
        const session = exec?.agent?.session
        const evidence = session
          ? collectEvidence(session, { sinceSeq: state.lastSeqBySession.get(String(session.id)) ?? 0 }).text
          : ''
        const result = await consolidateNow(evidence, { session })
        return { saved: result.saved.length, fallback: result.fallback }
      },
    }),
  ]

  // ------------------------------------------------------- event wiring

  /**
   * Collect the session's NEW evidence since the last consolidation: direct
   * user messages + assistant text replies (surface text only, bounded to the
   * last 40 events). Plugin-injected context is never evidence.
   */
  function collectEvidence(session, { sinceSeq = 0 } = {}) {
    const lines = []
    let lastSeq = sinceSeq
    let count = 0
    for (const event of session.events ?? []) {
      if (typeof event?.seq !== 'number') continue
      if (event.seq <= sinceSeq) continue
      lastSeq = Math.max(lastSeq, event.seq)
      const type = event.type
      if (type === 'user/message') {
        const kind = event.data?.source?.kind
        if (kind !== undefined && kind !== 'user') continue
        const text = (event.data?.content ?? [])
          .filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')
        if (text.trim()) { lines.push(`user: ${text.trim()}`); count++ }
      } else if (type === 'assistant/message') {
        const text = (event.data?.message?.content ?? [])
          .filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')
        if (text.trim()) { lines.push(`assistant: ${text.trim()}`); count++ }
      }
      if (count >= 40) break
    }
    return { text: lines.join('\n'), lastSeq }
  }

  /** Debounced turn/end consolidation. */
  function scheduleConsolidation(session) {
    if (!cfg.autoConsolidate) return
    const sessionId = String(session.id)
    const sinceSeq = state.lastSeqBySession.get(sessionId) ?? 0
    const { text, lastSeq } = collectEvidence(session, { sinceSeq })
    // Remember the watermark even when there is nothing to do, so repeated
    // turn/end events for the same session do not re-consolidate old turns.
    state.lastSeqBySession.set(sessionId, lastSeq)
    if (!text) return
    if (state.running.has(sessionId)) return
    const timer = setTimeout(() => {
      state.timers.delete(timer)
      state.running.add(sessionId)
      consolidateNow(text, { session })
        .catch((error) => log.warn(`consolidation failed: ${String(error)}`))
        .finally(() => state.running.delete(sessionId))
    }, cfg.consolidateDelayMs)
    state.timers.add(timer)
  }

  const offEvent = ctx.on('session/event', (session, event) => {
    if (event.type !== 'turn/end') return
    scheduleConsolidation(session)
  })
  state.disposers.push(() => {
    offEvent?.()
    for (const timer of state.timers) clearTimeout(timer)
    state.timers.clear()
  })

  // ------------------------------------------------------------- services

  const service = {
    pluginName: name,
    agentId,
    workspace,
    memoryFile,
    load,
    renderForContext,
    update,
    remove,
    search,
    list,
    consolidate: consolidateNow,
    readDailyNotes: (opts) => readDailyNotes(workspace, opts),
  }

  ctx.provide('agentMemory', service)

  // Injection: fresh sessions receive the curated memory. systemPrompt.context
  // evaluates text providers SYNCHRONOUSLY, so a fresh file read happens per
  // assembly — human edits are visible on the very next turn, no restart.
  if (cfg.autoInject) {
    ctx.inject(['systemPrompt'], (promptCtx) => {
      const dispose = promptCtx.systemPrompt.context({
        name: 'memory',
        order: 90,
        text: () => {
          try {
            return renderContextText(loadEntriesSync(memoryFile), {
              maxEntries: cfg.maxInjectedEntries,
              maxChars: cfg.maxInjectedChars,
            })
          } catch (error) {
            log.warn(`injection render failed: ${String(error)}`)
            return ''
          }
        },
      })
      state.disposers.push(dispose)
    })
  }

  // Tools.
  ctx.inject(['tools'], (toolsCtx) => {
    for (const tool of tools) {
      const dispose = toolsCtx.tools.register(tool)
      state.disposers.push(dispose)
    }
  })

  log.info(`mounted for agent ${agentId} (workspace ${workspace}, memory ${memoryFile})`)

  // Arrow disposer: cordis calls it on fiber unload; clear every owned side
  // effect (timers, listeners, registrations).
  return () => {
    for (const dispose of state.disposers) {
      if (typeof dispose === 'function') dispose()
    }
    state.disposers = []
  }
}
