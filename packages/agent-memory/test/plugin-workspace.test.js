/**
 * V2 memory workspace resolver tests for the agent-memory PLUGIN glue
 * (AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC §5.2/§5.3/§5.4, accepted).
 *
 * MEMORY_OWNERSHIP = WORKSPACE_LOCAL is unchanged; what V2 splits is HOW a
 * call site obtains the workspace:
 *
 *   session-aware paths — tools (save/search/list/update/delete/
 *     consolidate), service save/write/search, turn/end consolidation,
 *     daily notes  -> session.header.cwd  -> <cwd>/MEMORY.md
 *
 *   session-less path — the synchronous system-prompt [memory] injection
 *     (its text provider is a no-argument sync function with NO current
 *     Session; KERNEL_CHANGE = NONE)  -> Agent.primaryWorkspace
 *     (= resolveWorkspace(agentId))  -> <primary>/MEMORY.md
 *
 * In the V2 normal path session.header.cwd == resolveWorkspace(agentId), so
 * both resolve to the same file (MEMORY_WORKSPACE_EQUALITY) — proven last.
 */

import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { apply } from '../src/index.js'
import { normalizeEntry, renderEntries } from '../src/memory.js'
import { resolveMemoryFile, resolveDailyNoteFile } from '../src/paths.js'

const NOW = '2026-08-18T10:00:00.000Z'

/** Fake cordis ctx: the surface the memory plugin consumes
 *  (on / inject / provide / get / logger). */
function fakeCtx() {
  const provided = new Map()
  const listeners = new Map()
  return {
    on(event, cb) {
      const arr = listeners.get(event) ?? []
      arr.push(cb)
      listeners.set(event, arr)
      return () => listeners.set(event, arr.filter((f) => f !== cb))
    },
    emit(event, ...args) {
      for (const cb of listeners.get(event) ?? []) cb(...args)
    },
    inject(names, cb) {
      cb(Object.fromEntries(names.map((n) => [n, provided.get(n)])))
    },
    provide(name, value) { provided.set(name, value) },
    get: (name) => provided.get(name),
  }
}

/** Mount the plugin over tmp roots; returns handles + fakes. */
async function mount(t, { agentId = 'agt_v2' } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'acm-v2-'))
  t.after(() => rm(root, { recursive: true, force: true }))

  const primaryWorkspace = join(root, agentId)
  const sessionWorkspace = join(root, 'ws-session-a')
  await mkdir(primaryWorkspace, { recursive: true })
  await mkdir(sessionWorkspace, { recursive: true })

  const promptContexts = []
  const registeredTools = []
  const ctx = fakeCtx()
  ctx.provide('systemPrompt', {
    context(def) { promptContexts.push(def); return () => {} },
  })
  ctx.provide('tools', {
    register(tool) { registeredTools.push(tool); return () => {} },
  })

  const dispose = apply(ctx, {
    agentId,
    workspaceRoot: root,
    consolidateDelayMs: 0,
    autoConsolidate: true,
    dailyNotes: true,
  })
  t.after(() => dispose())

  const session = (cwd, id = 's1', events = []) => ({ id, header: { cwd }, events })
  const tool = (name) => {
    const found = registeredTools.find((x) => x.name === name)
    assert.ok(found, `tool ${name} registered`)
    return found
  }
  const exec = (sess) => ({ agent: { session: sess } })

  return { root, primaryWorkspace, sessionWorkspace, ctx, session, tool, exec, promptContexts, service: ctx.get('agentMemory') }
}

const ENTRY = (title, content) => normalizeEntry({
  type: 'preference', title, content, importance: 5, tags: [], source: 'test',
}, NOW)

// ---------------------------------------------------------------------------
// session-aware service surface
// ---------------------------------------------------------------------------

test('service save/load/search: session.header.cwd -> <cwd>/MEMORY.md', async (t) => {
  const m = await mount(t)
  await m.service.update(ENTRY('session-fact', 'lives in the session cwd'), {
    session: m.session(m.sessionWorkspace),
  })
  assert.ok(existsSync(join(m.sessionWorkspace, 'MEMORY.md')), 'written under session.header.cwd')
  assert.ok(!existsSync(join(m.primaryWorkspace, 'MEMORY.md')), 'primary MEMORY.md untouched')

  const loaded = await m.service.load({ session: m.session(m.sessionWorkspace) })
  assert.equal(loaded.length, 1)
  assert.equal(loaded[0].title, 'session-fact')

  const hits = await m.service.search('session-fact', { session: m.session(m.sessionWorkspace) })
  assert.equal(hits.length, 1)
  // No session -> the primary fallback (empty file).
  assert.deepEqual(await m.service.load(), [])
})

test('service remove: session-aware', async (t) => {
  const m = await mount(t)
  const { memory: saved } = await m.service.update(ENTRY('gone-soon', 'x'), {
    session: m.session(m.sessionWorkspace),
  })
  assert.equal(await m.service.remove(saved.id, { session: m.session(m.sessionWorkspace) }), true)
  assert.deepEqual(await m.service.load({ session: m.session(m.sessionWorkspace) }), [])
})

// ---------------------------------------------------------------------------
// session-aware TOOLS
// ---------------------------------------------------------------------------

test('memory_save tool: exec.agent.session.header.cwd -> <cwd>/MEMORY.md', async (t) => {
  const m = await mount(t)
  const result = await m.tool('memory_save').execute(
    { type: 'preference', title: 'tool-fact', content: 'written via the tool', importance: 5 },
    m.exec(m.session(m.sessionWorkspace)),
  )
  assert.equal(result.action, 'created')
  const raw = await readFile(join(m.sessionWorkspace, 'MEMORY.md'), 'utf8')
  assert.match(raw, /written via the tool/)
  assert.ok(!existsSync(join(m.primaryWorkspace, 'MEMORY.md')))
})

test('memory_search / memory_list tools resolve the session cwd', async (t) => {
  const m = await mount(t)
  await m.service.update(ENTRY('needle', 'find me'), { session: m.session(m.sessionWorkspace) })
  const found = await m.tool('memory_search').execute(
    { query: 'needle' },
    m.exec(m.session(m.sessionWorkspace)),
  )
  assert.equal(found.items.length, 1)
  assert.equal(found.items[0].title, 'needle')
  const listed = await m.tool('memory_list').execute({}, m.exec(m.session(m.sessionWorkspace)))
  assert.equal(listed.total, 1)
  // Without a session the tools see the primary (empty) file — no leakage.
  const listedPrimary = await m.tool('memory_list').execute({}, m.exec(undefined))
  assert.equal(listedPrimary.total, 0)
})

test('memory_update / memory_delete tools resolve the session cwd', async (t) => {
  const m = await mount(t)
  const { memory: saved } = await m.service.update(ENTRY('mutable', 'v1'), {
    session: m.session(m.sessionWorkspace),
  })
  const updated = await m.tool('memory_update').execute(
    { id: saved.id, title: 'mutable', content: 'v2', type: 'preference' },
    m.exec(m.session(m.sessionWorkspace)),
  )
  assert.equal(updated.memory.id, saved.id)
  assert.equal((await m.service.load({ session: m.session(m.sessionWorkspace) }))[0].content, 'v2')

  const del = await m.tool('memory_delete').execute({ id: saved.id }, m.exec(m.session(m.sessionWorkspace)))
  assert.equal(del.deleted, true)
  assert.deepEqual(await m.service.load({ session: m.session(m.sessionWorkspace) }), [])
})

// ---------------------------------------------------------------------------
// turn/end consolidation — session-aware
// ---------------------------------------------------------------------------

test('turn/end consolidation lands in the triggering session cwd (daily-note fallback)', async (t) => {
  const m = await mount(t)
  const sess = {
    id: 's-consol',
    header: { cwd: m.sessionWorkspace },
    events: [
      { seq: 1, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'remember the codeword BETA' }] } },
      { seq: 2, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'noted' }] } } },
    ],
  }
  m.ctx.emit('session/event', sess, { type: 'turn/end' })
  // consolidateDelayMs = 0; let the debounced consolidation settle.
  await new Promise((r) => setTimeout(r, 25))

  const note = resolveDailyNoteFile(m.sessionWorkspace)
  assert.ok(existsSync(note), 'raw evidence in <session cwd>/memory/YYYY-MM-DD.md')
  const text = await readFile(note, 'utf8')
  assert.match(text, /codeword BETA/)
  // The primary workspace got nothing from this session's consolidation.
  assert.ok(!existsSync(resolveDailyNoteFile(m.primaryWorkspace)), 'primary daily note untouched')
})

test('memory_consolidate tool (explicit) resolves the session cwd', async (t) => {
  const m = await mount(t)
  const sess = m.session(m.sessionWorkspace, 's-explicit', [
    { seq: 1, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'explicit consolidation evidence' }] } },
  ])
  const result = await m.tool('memory_consolidate').execute({}, m.exec(sess))
  assert.equal(result.saved, 0, 'no LLM in tests -> fallback (raw evidence only)')
  assert.equal(result.fallback, true)
  assert.ok(existsSync(resolveDailyNoteFile(m.sessionWorkspace)))
  assert.ok(!existsSync(resolveDailyNoteFile(m.primaryWorkspace)))
})

// ---------------------------------------------------------------------------
// daily notes — session-aware
// ---------------------------------------------------------------------------

test('readDailyNotes: session cwd when a session is given, primary otherwise', async (t) => {
  const m = await mount(t)
  const today = new Date()
  const noteSession = resolveDailyNoteFile(m.sessionWorkspace, today)
  const notePrimary = resolveDailyNoteFile(m.primaryWorkspace, today)
  await mkdir(join(m.sessionWorkspace, 'memory'), { recursive: true })
  await mkdir(join(m.primaryWorkspace, 'memory'), { recursive: true })
  const { writeFile } = await import('node:fs/promises')
  await writeFile(noteSession, 'session note\n', 'utf8')
  await writeFile(notePrimary, 'primary note\n', 'utf8')

  const fromSession = await m.service.readDailyNotes({ session: m.session(m.sessionWorkspace), now: today })
  assert.equal(fromSession.at(-1).text, 'session note\n')
  const fromPrimary = await m.service.readDailyNotes({ now: today })
  assert.equal(fromPrimary.at(-1).text, 'primary note\n')
})

// ---------------------------------------------------------------------------
// §5.4 — the session-less system-prompt injection stays on the PRIMARY workspace
// ---------------------------------------------------------------------------

test('system-prompt [memory] injection reads Agent.primaryWorkspace/MEMORY.md (never a session cwd)', async (t) => {
  const m = await mount(t)
  assert.equal(m.promptContexts.length, 1, 'one systemPrompt context registered')
  const memoryContext = m.promptContexts.find((c) => c.name === 'memory')

  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(m.primaryWorkspace, 'MEMORY.md'), renderEntries([ENTRY('primary fact', 'from the primary workspace')]), 'utf8')
  await writeFile(join(m.sessionWorkspace, 'MEMORY.md'), renderEntries([ENTRY('session only fact', 'must NOT appear in injection')]), 'utf8')

  const text = memoryContext.text()
  assert.match(text, /from the primary workspace/)
  assert.doesNotMatch(text, /must NOT appear in injection/, 'the session cwd file never feeds the injection')
})

test('injection re-reads from disk per assembly (fresh primary edits visible)', async (t) => {
  const m = await mount(t)
  const memoryContext = m.promptContexts.find((c) => c.name === 'memory')
  assert.equal(memoryContext.text(), '', 'lazy: nothing yet')
  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(m.primaryWorkspace, 'MEMORY.md'), renderEntries([ENTRY('late fact', 'written after mount')]), 'utf8')
  assert.match(memoryContext.text(), /written after mount/)
})

// ---------------------------------------------------------------------------
// MEMORY_WORKSPACE_EQUALITY — V2 normal path: session.header.cwd == primary
// ---------------------------------------------------------------------------

test('MEMORY_WORKSPACE_EQUALITY: session cwd == resolveWorkspace(agentId) -> tool write and injection share ONE MEMORY.md', async (t) => {
  const m = await mount(t)
  // The V2 normal path guarantees this equality at the Router seam; mirror it.
  const v2Session = m.session(m.primaryWorkspace, 'main')
  assert.equal(m.service.resolveMemoryWorkspace(v2Session), m.primaryWorkspace)
  assert.equal(m.service.resolveMemoryWorkspace(undefined), m.primaryWorkspace, 'session-less fallback is the SAME primary workspace')

  await m.tool('memory_save').execute(
    { type: 'preference', title: 'equality fact', content: 'one workspace, one memory', importance: 5 },
    m.exec(v2Session),
  )
  assert.equal(resolveMemoryFile(m.service.resolveMemoryWorkspace(v2Session)), m.service.memoryFile,
    'MEMORY_TOOL_WORKSPACE == MEMORY_INJECTION_WORKSPACE (same absolute MEMORY.md path)')
  const memoryContext = m.promptContexts.find((c) => c.name === 'memory')
  assert.match(memoryContext.text(), /one workspace, one memory/, 'the tool write is immediately visible to the injection')
})
