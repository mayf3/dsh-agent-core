/** Per-agent memory plugin: trusted session cwd for tools, primary for sync injection. */

import z from '@deepseek-ai/schemastery'
import { memoryTools, toApiList } from './tools.js'
import { basename, isAbsolute, resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { realpathSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { inspectMemory, resolveMemoryBinding } from './inspect.js'
import { createHistorySearch } from './history.js'

import {
  agentIdFromCwd,
  resolveAgentWorkspace,
  resolveMemoryDir,
  resolveMemoryFile,
} from './paths.js'
import {
  consolidate,
  loadEntries,
  loadEntriesTailSync,
  readDailyNotes,
  removeEntry,
  renderContextText,
  saveWithDedupe,
  searchEntries,
  updateEntry,
  writeEntries,
} from './memory.js'

export const name = 'agent-memory'

export const inject = []

export const Config = z.object({
    agentId: z.string(),
    workspaceRoot: z.string(),
    autoInject: z.boolean().default(true),
    maxInjectedEntries: z.natural().min(1).max(20).default(6),
    maxInjectedChars: z.natural().min(200).max(20000).default(2400),
    autoConsolidate: z.boolean().default(true),
    consolidateDelayMs: z.natural().min(0).max(60000).default(3000),
    dailyNotes: z.boolean().default(true),
    provider: z.string(),
    model: z.string(),
})

const DISTILL_PROMPT = `You are the memory distillation assistant of a long-lived agent.
From the session evidence below, extract 2-3 facts worth remembering ACROSS sessions:
user preferences, durable personal facts, project state, or key decisions.
Rules:
- Only output a JSON array, each item: {"type":"preference|project|decision|history","title":"short unique title","content":"one-sentence fact","importance":1-5}
- A durable personal fact (birthday, contact details, favorite things, codewords, ...) or a general preference MUST be type=preference; a project fact is project; a choice made is decision.
- type=history is ONLY for one-off events NOT needed in future sessions.
- Copy dates, numbers and proper nouns EXACTLY as stated in the evidence; never invent, alter or guess values.
- Do not invent facts that are not in the evidence. Do not output anything else.`

export const apply = (ctx, config = {}) => {
  const cfg = Config(config)
  // agentId precedence: explicit config > $DSH_AGENT_ID (the control plane /
  // process launcher knows the id) > basename of the cwd (the standard
  // `<workspaceRoot>/<agentId>` layout, where the workspace dir is the id).
  const agentId = cfg.agentId ?? process.env.DSH_AGENT_ID ?? agentIdFromCwd(process.cwd())
  if (agentId === undefined) {
    throw new Error('agent-memory: cannot determine agentId (set config.agentId, DSH_AGENT_ID, or run with cwd inside the agent workspace)')
  }
  let workspace
  // Agent.primaryWorkspace (mount-time). AGENT_PRIMARY_WORKSPACE_IMPORT_V1
  // §4: the primary workspace resolves with the EXISTING spawn env channel —
  // $DSH_PRIMARY_WORKSPACE (the control plane's final resolveWorkspace(agentId)
  // output, passed mechanically by the Router; for an imported agent this IS
  // the imported directory) takes precedence over the legacy
  // <workspaceRoot>/<agentId> derivation (resolveAgentWorkspace). The
  // cwd-basename agentId fallback keeps its old semantics but is naturally
  // short-circuited in production (DSH_AGENT_ID + DSH_PRIMARY_WORKSPACE are
  // always set). Session-aware writes still resolve session.header.cwd (V2
  // §5.2 unchanged): in the normal path both equal Agent.primaryWorkspace.
  const primaryEnv = process.env.DSH_PRIMARY_WORKSPACE
  if (typeof primaryEnv === 'string' && primaryEnv.trim() !== '') {
    if (!isAbsolute(primaryEnv)) {
      throw Object.assign(
        new Error(`agent-memory: $DSH_PRIMARY_WORKSPACE must be absolute (got ${JSON.stringify(primaryEnv)})`),
        { code: 'PRIMARY_WORKSPACE_INVALID' },
      )
    }
    workspace = resolve(primaryEnv)
  } else {
    workspace = resolveAgentWorkspace(agentId, cfg.workspaceRoot)
  }
  const memoryFile = resolveMemoryFile(workspace)

    function resolveMemoryWorkspace(session) {
    const cwd = session?.header?.cwd
    if (typeof cwd === 'string' && cwd.trim() !== '') return cwd
    return workspace
  }

    function memoryFileFor(session) {
    return resolveMemoryFile(resolveMemoryWorkspace(session))
  }

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

    async function load(opts = {}) {
    return loadEntries(memoryFileFor(opts.session))
  }

    async function renderForContext() {
    const entries = await load()
    return renderContextText(entries, {
      maxEntries: cfg.maxInjectedEntries,
      maxChars: cfg.maxInjectedChars,
    })
  }

    async function update(entry, opts = {}) {
    const file = memoryFileFor(opts.session)
    const entries = await loadEntries(file)
    const outcome = saveWithDedupe(entries, entry)
    await writeEntries(file, outcome.entries)
    log.info(`memory ${outcome.action}: ${outcome.entry.title}`)
    return { action: outcome.action, memory: outcome.entry }
  }

    async function remove(id, opts = {}) {
    const file = memoryFileFor(opts.session)
    const entries = await loadEntries(file)
    const outcome = removeEntry(entries, id)
    if (outcome.removed) await writeEntries(file, outcome.entries)
    return outcome.removed
  }

    async function search(query, opts = {}) {
    return searchEntries(await loadEntries(memoryFileFor(opts.session)), query)
  }

    async function list(opts = {}) {
    return loadEntries(memoryFileFor(opts.session))
  }

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

    async function consolidateNow(sessionEvidence, { session } = {}) {
    const provenance = session ? `consolidation:session:${session.id}` : 'consolidation'
    const ws = resolveMemoryWorkspace(session)
    const result = await consolidate({
      workspace: ws,
      memoryFile: resolveMemoryFile(ws),
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

  // Read-only services resolve from trusted process/session context only.
  let lastAssembly = null
  let lastQueryCoverage = null
  const digest = value => createHash('sha256').update(value).digest('hex')
  function assemblyWorkspaceKey() {
    const path = realpathSync(workspace)
    const info = statSync(path)
    return `v1:${digest(JSON.stringify({agentId,workspace:{path,dev:String(info.dev),ino:String(info.ino)}}))}`
  }
  async function inspect(opts = {}) {
    const binding = await resolveMemoryBinding({agentId,primaryWorkspace:workspace,session:opts.session})
    return inspectMemory({binding,detail:opts.detail ?? 'summary',observedRuntime:{
      injection:{configured:cfg.autoInject,maxEntries:cfg.maxInjectedEntries,maxChars:cfg.maxInjectedChars,lastObservedAssembly:lastAssembly},
      history:{lastQueryCoverage:lastQueryCoverage?.workspaceKey === binding.workspaceKey ? lastQueryCoverage.coverage : null},
    }})
  }
  async function historySearch(args, opts = {}) {
    const binding = await resolveMemoryBinding({agentId,primaryWorkspace:workspace,session:opts.session})
    return createHistorySearch({binding,onCoverage:coverage=>{lastQueryCoverage={workspaceKey:binding.workspaceKey,coverage}}})(args)
  }

  // ------------------------------------------------------------------ tools

  const tools = memoryTools({inspect, historySearch, update, search, list, remove, memoryFileFor, consolidateNow, collectEvidence, state})

  // ------------------------------------------------------- event wiring

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

    function scheduleConsolidation(session) {
    if (!cfg.autoConsolidate) return
    const sessionId = String(session.id)
    const sinceSeq = state.lastSeqBySession.get(sessionId) ?? 0
    const { text, lastSeq } = collectEvidence(session, { sinceSeq })
    if (!text) {
      // Nothing new: advance the watermark so repeated turn/end events for
      // the same session do not re-consolidate old turns.
      state.lastSeqBySession.set(sessionId, lastSeq)
      return
    }
    if (state.running.has(sessionId)) {
      // A consolidation is in flight for this session: keep the OLD
      // watermark so the next turn/end re-collects this evidence (nothing is
      // skipped, no silent evidence loss).
      return
    }
    state.lastSeqBySession.set(sessionId, lastSeq)
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
        resolveMemoryWorkspace,
    load,
    renderForContext,
    update,
    remove,
    search,
    list,
    consolidate: consolidateNow,
    inspect,
    historySearch,
        readDailyNotes: (opts = {}) => readDailyNotes(resolveMemoryWorkspace(opts.session), opts),
  }

  ctx.provide('agentMemory', service)

  // Injection: fresh sessions receive the curated memory. systemPrompt.context
  // evaluates text providers SYNCHRONOUSLY, so a fresh file read happens per
  // assembly — human edits are visible on the very next turn, no restart.
  // V2 (spec §5.2/§5.4): this is the SESSION-LESS call site — the text
  // provider is a synchronous no-argument function assembled at agent scope
  // with no current Session, so it MUST resolve Agent.primaryWorkspace
  // (= resolveWorkspace(agentId), the process-level memoryFile captured above)
  // and never a session cwd. In the V2 normal path session.header.cwd ==
  // primary, so both paths read the same MEMORY.md.
  if (cfg.autoInject) {
    ctx.inject(['systemPrompt'], (promptCtx) => {
      const dispose = promptCtx.systemPrompt.context({
        name: 'memory',
        order: 90,
        text: () => {
          let workspaceKey = null
          let coreSha256 = null
          let selectedIds = []
          try {
            workspaceKey = assemblyWorkspaceKey()
            let entries
            let missing = false
            try {
              entries = loadEntriesTailSync(memoryFile,{onSnapshot:snapshot=>{coreSha256=snapshot.sha256}})
            } catch (error) {
              if (error?.code !== 'ENOENT') throw error
              entries=[];missing=true
            }
            const text = renderContextText(entries, {
              maxEntries: cfg.maxInjectedEntries,
              maxChars: cfg.maxInjectedChars,
              onSelection:ids=>{selectedIds=ids},
            })
            lastAssembly={workspaceKey,coreSha256,selectedIdsDigest:digest(JSON.stringify(selectedIds)),selectedCount:selectedIds.length,charCount:text.length,result:text ? 'INJECTED' : 'EMPTY',reason:missing ? 'MISSING' : null,time:new Date().toISOString()}
            return text
          } catch (error) {
            lastAssembly={workspaceKey,coreSha256,selectedIdsDigest:digest('[]'),selectedCount:0,charCount:0,result:'REFUSED',reason:error?.code === 'MEMORY_GUARD_LIMIT' ? 'GUARD_LIMIT' : 'READ_REFUSED',time:new Date().toISOString()}
            log.warn('injection render failed: READ_REFUSED')
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
