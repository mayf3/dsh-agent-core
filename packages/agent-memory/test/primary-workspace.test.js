/**
 * AGENT_PRIMARY_WORKSPACE_IMPORT_V1 (accepted @d823750) — memory seam tests
 * (task E + Spec §4/AC4).
 *
 * MEMORY_OWNERSHIP = WORKSPACE_LOCAL is unchanged. What this Spec adds is the
 * mount-time PRIMARY workspace resolution priority (§4):
 *
 *   $DSH_PRIMARY_WORKSPACE (absolute; the Router's mechanical spawn-env
 *     pass-through of resolveWorkspace(agentId) — for an imported agent this
 *     IS the imported directory)
 *     > resolveAgentWorkspace(agentId, cfg.workspaceRoot) (legacy derivation)
 *
 * Session-aware call sites keep resolving session.header.cwd (V2 §5.2,
 * untouched). In the normal path session.header.cwd == Agent.primaryWorkspace
 * == the memory primary, so both resolve to the same MEMORY.md (AC4).
 */

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { apply } from '../src/index.js'
import { resolveMemoryFile } from '../src/paths.js'

/** Fake cordis ctx: the surface the memory plugin consumes. */
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
    inject(names, cb) { cb(Object.fromEntries(names.map((n) => [n, provided.get(n)]))) },
    provide(name, value) { provided.set(name, value) },
    get: (name) => provided.get(name),
  }
}

/** A throwaway tmp root (cleaned by the test runner). */
async function mkTmp(t) {
  const root = await mkdtemp(join(tmpdir(), 'acm-priws-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

/**
 * Mount the plugin with an env snapshot (set before apply, restored after —
 * including on a throwing apply).
 */
async function mount(t, { env = {}, config = {} } = {}) {
  // Snapshot the PRE-EXISTING values (not the ones we are about to set) so
  // restore truly undoes the change.
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]))
  for (const [k, v] of Object.entries(env)) process.env[k] = v
  const restore = () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }

  const promptContexts = []
  const ctx = fakeCtx()
  ctx.provide('systemPrompt', { context(def) { promptContexts.push(def); return () => {} } })
  ctx.provide('tools', { register() { return () => {} } })

  try {
    const dispose = apply(ctx, {
      autoConsolidate: false,
      dailyNotes: false,
      ...config,
    })
    t.after(() => {
      dispose?.()
      restore()
    })
    return { ctx, promptContexts }
  } catch (error) {
    restore()
    throw error
  }
}

const AGENT_ID = 'agt_stock_agent'

test('E: $DSH_PRIMARY_WORKSPACE (imported dir) wins over the <root>/<agentId> derivation', async (t) => {
  const root = await mkTmp(t)
  const imported = join(root, 'workspace-oc_imported')
  await mkdir(imported, { recursive: true })
  const { ctx } = await mount(t, {
    env: { DSH_PRIMARY_WORKSPACE: imported, DSH_AGENT_ID: AGENT_ID },
    config: { workspaceRoot: root },
  })
  const service = ctx.get('agentMemory')
  assert.equal(service.workspace, imported, 'mount-time primary = imported directory')
  assert.equal(service.memoryFile, join(imported, 'MEMORY.md'))
  assert.notEqual(service.workspace, join(root, AGENT_ID), 'legacy derivation is short-circuited')
})

test('E: session-less system-prompt injection reads MEMORY.md under the imported dir', async (t) => {
  const root = await mkTmp(t)
  const imported = join(root, 'workspace-oc_imported')
  await mkdir(imported, { recursive: true })
  const { ctx, promptContexts } = await mount(t, {
    env: { DSH_PRIMARY_WORKSPACE: imported, DSH_AGENT_ID: AGENT_ID },
    config: { workspaceRoot: root },
  })
  const service = ctx.get('agentMemory')
  assert.equal(service.workspace, imported)

  // Session-less write (the mount-time primary path)…
  await service.update(
    { type: 'preference', title: 'coffee', content: 'drinks oat latte', importance: 4, tags: [], source: 'test' },
  )
  // …and the session-less synchronous injection reads the SAME file.
  assert.equal(promptContexts.length, 1)
  const rendered = promptContexts[0].text()
  assert.ok(rendered.includes('oat latte'), 'injection text comes from the imported MEMORY.md')
})

test('E: session-aware writes keep session.header.cwd (env priority never leaks into them)', async (t) => {
  const root = await mkTmp(t)
  const imported = join(root, 'workspace-oc_imported')
  const sessionWorkspace = join(root, 'ws-session')
  await mkdir(imported, { recursive: true })
  await mkdir(sessionWorkspace, { recursive: true })
  const { ctx } = await mount(t, {
    env: { DSH_PRIMARY_WORKSPACE: imported, DSH_AGENT_ID: AGENT_ID },
    config: { workspaceRoot: root },
  })

  const service = ctx.get('agentMemory')
  const session = { header: { cwd: sessionWorkspace }, id: 's1' }
  assert.equal(service.resolveMemoryWorkspace(session), sessionWorkspace)
  await service.update(
    { type: 'preference', title: 'session fact', content: 'written via session cwd', importance: 3, tags: [], source: 'test' },
    { session },
  )
  assert.equal(service.memoryFile, join(imported, 'MEMORY.md'))
  const sessionEntries = await service.list({ session })
  assert.equal(sessionEntries.length, 1, 'the write landed in the SESSION workspace file')
})

test('E: normal-path equality — session.header.cwd == Agent.primaryWorkspace == memory primary (AC4)', async (t) => {
  const root = await mkTmp(t)
  const imported = join(root, 'workspace-oc_imported')
  await mkdir(imported, { recursive: true })
  const { ctx } = await mount(t, {
    env: { DSH_PRIMARY_WORKSPACE: imported, DSH_AGENT_ID: AGENT_ID },
    config: { workspaceRoot: root },
  })
  const service = ctx.get('agentMemory')
  const session = { header: { cwd: imported }, id: 'main' }
  assert.equal(service.resolveMemoryWorkspace(session), imported)
  assert.equal(resolveMemoryFile(service.resolveMemoryWorkspace(session)), service.memoryFile,
    'session-aware and session-less resolve the SAME MEMORY.md')
})

test('E: env unset → the legacy <workspaceRoot>/<agentId> derivation is unchanged', async (t) => {
  const root = await mkTmp(t)
  const { ctx } = await mount(t, {
    env: { DSH_AGENT_ID: AGENT_ID },
    config: { workspaceRoot: root },
  })
  const service = ctx.get('agentMemory')
  assert.equal(service.workspace, join(root, AGENT_ID))
  assert.equal(service.memoryFile, join(root, AGENT_ID, 'MEMORY.md'))
})

test('E: a set-but-relative $DSH_PRIMARY_WORKSPACE fails loud (never a silent cwd-relative guess)', async (t) => {
  await assert.rejects(
    () => mount(t, { env: { DSH_PRIMARY_WORKSPACE: 'relative/ws', DSH_AGENT_ID: AGENT_ID } }),
    (error) => error.code === 'PRIMARY_WORKSPACE_INVALID' && /absolute/.test(error.message),
  )
})
