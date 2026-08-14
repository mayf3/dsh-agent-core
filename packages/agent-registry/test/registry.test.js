/**
 * Unit tests for @agent-core/agent-registry.
 *
 * Covers the V1 acceptance surface:
 *   1. create Agent A / Agent B;           2. agentId uniqueness;
 *   3. survives restart (new instance over the same store file);
 *   4. list/get;                           5. update never changes agentId;
 *   6. default-agent semantics;            7. no process ownership.
 * Plus (review cleanup): updateAgent concurrency correctness, mutation
 * rollback on persist failure, fail-loud store invariants (dangling / missing
 * default = CORRUPT_STORE), absolute storeFile contract, atomic persistence,
 * validation, and the Cordis plugin shell (fake ctx). The registry has zero
 * dependency on workspace-bootstrap; no real home is touched — every test
 * store lives under os.tmpdir().
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentRegistry, AGENT_ID_PREFIX, AGENT_NOT_FOUND, VALIDATION_ERROR } from '../src/registry.js'
import { apply, DEFAULT_STORE_FILE } from '../src/index.js'

/** Fresh store path inside a throwaway tmp tree. */
async function tmpStore(t, name = 'store.json') {
  const dir = await mkdtemp(join(tmpdir(), 'agr-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return join(dir, name)
}

/** Build a registry over a fresh tmp store. */
async function freshRegistry(t) {
  return new AgentRegistry({ storeFile: await tmpStore(t) })
}

/** Read the raw store document of a registry. */
async function storeDocument(reg) {
  return JSON.parse(await readFile(reg.storeFile, 'utf8'))
}

test('1+2. register Agent A and B: both listed, ids distinct and opaque', async (t) => {
  const reg = await freshRegistry(t)
  const a = await reg.registerAgent({ name: '论文导师', avatar: 'https://cdn/x.png', description: '帮我改论文' })
  const b = await reg.registerAgent({ name: '研发总监' })

  assert.equal(a.name, '论文导师')
  assert.equal(a.avatar, 'https://cdn/x.png')
  assert.equal(a.description, '帮我改论文')
  assert.equal(b.name, '研发总监')
  assert.equal(b.avatar, null)
  assert.equal(b.description, null)
  // Ids are opaque, generated and distinct (type-prefixed per D-002).
  assert.ok(a.id.startsWith(AGENT_ID_PREFIX))
  assert.notEqual(a.id, b.id)
  const names = reg.listAgents().map((agent) => agent.name)
  assert.deepEqual(names, ['论文导师', '研发总监'])
})

test('2. agentId uniqueness: every registration draws a fresh id', async (t) => {
  const reg = await freshRegistry(t)
  const ids = new Set()
  for (let i = 0; i < 20; i += 1) {
    const agent = await reg.registerAgent({ name: `agent-${i}` })
    assert.ok(!ids.has(agent.id))
    ids.add(agent.id)
  }
  assert.equal(ids.size, 20)
  assert.equal(reg.listAgents().length, 20)
})

test('3. persistence: agents and the default survive a process restart', async (t) => {
  const storeFile = await tmpStore(t)
  const first = new AgentRegistry({ storeFile })
  const a = await first.registerAgent({ name: '知识管家' })
  const b = await first.registerAgent({ name: '生活伙伴' })
  await first.setDefaultAgent(b.id)
  await first.updateAgent(a.id, { name: '知识管家 v2' })

  // "Restart": a brand-new instance over the same file, no shared state.
  const second = new AgentRegistry({ storeFile })
  assert.deepEqual(second.listAgents().map((agent) => agent.name), ['知识管家 v2', '生活伙伴'])
  assert.equal(second.getAgent(a.id).name, '知识管家 v2')
  assert.equal(second.getDefaultAgent().id, b.id)
})

test('3. concurrent updateAgent calls never overwrite each other', async (t) => {
  const storeFile = await tmpStore(t)
  const reg = new AgentRegistry({ storeFile })
  const a = await reg.registerAgent({ name: 'A', avatar: null, description: 'd' })
  await Promise.all([
    reg.updateAgent(a.id, { name: 'A2' }),
    reg.updateAgent(a.id, { avatar: 'new.png' }),
  ])
  const got = reg.getAgent(a.id)
  assert.equal(got.name, 'A2')
  assert.equal(got.avatar, 'new.png')
  assert.equal(got.description, 'd')
  // And the merged result survives a restart.
  const again = new AgentRegistry({ storeFile })
  assert.equal(again.getAgent(a.id).name, 'A2')
  assert.equal(again.getAgent(a.id).avatar, 'new.png')
})

test('4. getAgent resolves and throws AGENT_NOT_FOUND for unknown ids', async (t) => {
  const reg = await freshRegistry(t)
  const a = await reg.registerAgent({ name: 'A' })
  const got = reg.getAgent(a.id)
  assert.deepEqual(got, a)
  // Public shape only: no internal timestamps, no path/pid/process fields.
  assert.deepEqual(Object.keys(got).sort(), ['avatar', 'description', 'id', 'name'])
  assert.throws(() => reg.getAgent('agt_does-not-exist'), (error) => error.code === AGENT_NOT_FOUND)
})

test('5. updateAgent changes name/avatar/description but never agentId', async (t) => {
  const reg = await freshRegistry(t)
  const a = await reg.registerAgent({ name: 'A', avatar: null, description: 'first' })
  const updated = await reg.updateAgent(a.id, { name: 'A2', avatar: 'https://cdn/new.png' })
  assert.equal(updated.id, a.id) // id immutable
  assert.equal(updated.name, 'A2')
  assert.equal(updated.avatar, 'https://cdn/new.png')
  assert.equal(updated.description, 'first') // untouched field keeps its value

  // Partial update: only one field.
  const partial = await reg.updateAgent(a.id, { description: null })
  assert.equal(partial.name, 'A2')
  assert.equal(partial.description, null)
  // Restart keeps the updated identity under the same id.
  const storeFile = reg.storeFile
  const again = new AgentRegistry({ storeFile })
  assert.equal(again.getAgent(a.id).name, 'A2')

  assert.throws(() => reg.updateAgent('agt_nope', { name: 'x' }), (error) => error.code === AGENT_NOT_FOUND)
})

test('6. default agent: first registered becomes default; setDefaultAgent overrides', async (t) => {
  const reg = await freshRegistry(t)
  // Empty registry: no default is a legal state, not an error.
  assert.equal(reg.getDefaultAgent(), undefined)

  const a = await reg.registerAgent({ name: 'A' })
  assert.equal(reg.getDefaultAgent().id, a.id) // first created = default
  const b = await reg.registerAgent({ name: 'B' })
  assert.equal(reg.getDefaultAgent().id, a.id) // second does not steal the default

  await reg.setDefaultAgent(b.id)
  assert.equal(reg.getDefaultAgent().id, b.id)
  // Unknown target rejected.
  assert.throws(() => reg.setDefaultAgent('agt_nope'), (error) => error.code === AGENT_NOT_FOUND)
  // Default choice is persisted.
  const again = new AgentRegistry({ storeFile: reg.storeFile })
  assert.equal(again.getDefaultAgent().id, b.id)
})

test('6. fail-loud: a dangling default pointer in the store is CORRUPT_STORE, never silently fixed', async (t) => {
  const storeFile = await tmpStore(t)
  const reg = new AgentRegistry({ storeFile })
  await reg.registerAgent({ name: 'A' })
  const document = await storeDocument(reg)
  document.defaultAgentId = 'agt_deleted'
  await rm(storeFile, { force: true })
  await writeFile(storeFile, JSON.stringify(document))
  assert.throws(() => new AgentRegistry({ storeFile }), (error) => error.code === 'CORRUPT_STORE')
})

test('6. fail-loud: a non-empty registry without a legal default is CORRUPT_STORE', async (t) => {
  const storeFile = await tmpStore(t)
  const reg = new AgentRegistry({ storeFile })
  await reg.registerAgent({ name: 'A' })
  const document = await storeDocument(reg)
  document.defaultAgentId = null
  await rm(storeFile, { force: true })
  await writeFile(storeFile, JSON.stringify(document))
  assert.throws(() => new AgentRegistry({ storeFile }), (error) => error.code === 'CORRUPT_STORE')

  // An EMPTY registry with no default field is still a legal store.
  const emptyStore = await tmpStore(t)
  await writeFile(emptyStore, JSON.stringify({ version: 1, agents: {} }))
  const empty = new AgentRegistry({ storeFile: emptyStore })
  assert.deepEqual(empty.listAgents(), [])
  assert.equal(empty.getDefaultAgent(), undefined)
})

test('7. the registry owns no process, pid, path or session state', async (t) => {
  const reg = await freshRegistry(t)
  const a = await reg.registerAgent({ name: 'A' })
  const service = {
    listAgents: reg.listAgents.bind(reg),
    getAgent: reg.getAgent.bind(reg),
    registerAgent: reg.registerAgent.bind(reg),
    updateAgent: reg.updateAgent.bind(reg),
    getDefaultAgent: reg.getDefaultAgent.bind(reg),
    setDefaultAgent: reg.setDefaultAgent.bind(reg),
  }
  // No lifecycle surface whatsoever.
  const keys = Object.keys(service).sort()
  assert.deepEqual(keys, [
    'getAgent', 'getDefaultAgent', 'listAgents', 'registerAgent', 'setDefaultAgent', 'updateAgent',
  ])
  // The persisted record carries identity only — no pid / home / workspace /
  // session references, and the registry never wrote any path for the agent.
  const stored = await storeDocument(reg)
  assert.deepEqual(Object.keys(stored.agents[a.id]).sort(), [
    'avatar', 'createdAt', 'description', 'id', 'name', 'updatedAt',
  ])
  const serialized = JSON.stringify(stored)
  for (const forbidden of ['pid', 'process', 'workspace', 'dshHome', 'session', 'home']) {
    assert.ok(!serialized.includes(forbidden), `store must not carry ${forbidden}`)
  }
})

test('4. mutation rollback: a failed persist rejects and leaves memory + store untouched', async (t) => {
  const storeFile = await tmpStore(t)
  const reg = new AgentRegistry({ storeFile })
  const a = await reg.registerAgent({ name: 'A' })
  const realPersist = reg.persist.bind(reg)
  reg.persist = async () => { throw new Error('disk full') }

  await assert.rejects(reg.registerAgent({ name: 'B' }), /disk full/)
  await assert.rejects(reg.updateAgent(a.id, { name: 'A2' }), /disk full/)

  // In-memory state is unchanged (rollback restored the snapshot).
  assert.deepEqual(reg.listAgents().map((agent) => agent.name), ['A'])
  assert.equal(reg.getAgent(a.id).name, 'A')
  assert.equal(reg.getDefaultAgent().id, a.id)
  // The on-disk store was not polluted (still the last successful write).
  const document = await storeDocument(reg)
  assert.deepEqual(Object.values(document.agents).map((record) => record.name), ['A'])
  // The registry keeps working once persistence recovers.
  reg.persist = realPersist
  const b = await reg.registerAgent({ name: 'B' })
  assert.deepEqual(reg.listAgents().map((agent) => agent.name), ['A', 'B'])
})

test('atomic persistence: the store file is a complete document, never a tmp', async (t) => {
  const storeFile = await tmpStore(t)
  const reg = new AgentRegistry({ storeFile })
  await reg.registerAgent({ name: 'A' })
  // After a mutation there is no leftover tmp file and the store parses.
  assert.ok(existsSync(storeFile))
  assert.ok(!existsSync(`${storeFile}.tmp`))
  const document = await storeDocument(reg)
  assert.equal(document.version, 1)
  assert.equal(document.agents[reg.listAgents()[0].id].name, 'A')
})

test('concurrent mutations are serialized; every change is durable', async (t) => {
  const storeFile = await tmpStore(t)
  const reg = new AgentRegistry({ storeFile })
  await Promise.all([
    reg.registerAgent({ name: 'A' }),
    reg.registerAgent({ name: 'B' }),
    reg.registerAgent({ name: 'C' }),
  ])
  const again = new AgentRegistry({ storeFile })
  assert.deepEqual(again.listAgents().map((agent) => agent.name), ['A', 'B', 'C'])
})

test('validation: bad names and bad patch types are rejected', async (t) => {
  const reg = await freshRegistry(t)
  // Input validation is synchronous fail-fast (no side effects, no write).
  for (const bad of [undefined, null, '', '   ', 42, {}]) {
    assert.throws(() => reg.registerAgent({ name: bad }), (error) => error.code === VALIDATION_ERROR)
  }
  const a = await reg.registerAgent({ name: 'A' })
  assert.throws(() => reg.updateAgent(a.id, { name: '' }), (error) => error.code === VALIDATION_ERROR)
  assert.throws(() => reg.updateAgent(a.id, { avatar: 42 }), (error) => error.code === VALIDATION_ERROR)
  assert.throws(() => reg.registerAgent({ name: 'x', avatar: { url: 'y' } }), (error) => error.code === VALIDATION_ERROR)
  // The failed updates changed nothing.
  assert.equal(reg.getAgent(a.id).name, 'A')
})

test('corrupt store fails loud instead of silently resetting', async (t) => {
  const storeFile = await tmpStore(t)
  await writeFile(storeFile, '{ not json', 'utf8')
  assert.throws(() => new AgentRegistry({ storeFile }), (error) => error.code === 'CORRUPT_STORE')
  // Unsupported version also fails loud.
  await writeFile(storeFile, JSON.stringify({ version: 99, agents: {} }), 'utf8')
  assert.throws(() => new AgentRegistry({ storeFile }), (error) => error.code === 'CORRUPT_STORE')
})

test('missing store file yields an empty, working registry', async (t) => {
  const reg = await freshRegistry(t)
  assert.deepEqual(reg.listAgents(), [])
  assert.equal(reg.getDefaultAgent(), undefined)
})

test('storeFile must be an absolute path (fail-loud, no silent `~`/cwd resolution)', async (t) => {
  assert.throws(() => new AgentRegistry({ storeFile: 'registry/agents.json' }), /absolute/)
  assert.throws(() => new AgentRegistry({ storeFile: '~/.dsh/registry/agents.json' }), /absolute/)
  assert.throws(() => new AgentRegistry({ storeFile: '' }), /non-empty/)
  const provided = {}
  const ctx = {
    provide(name, value) {
      provided[name] = value
    },
    effect() {
      return () => {}
    },
  }
  assert.throws(() => apply(ctx, { storeFile: '~/registry.json' }), /absolute/)
})

test('plugin shell: apply mounts ctx.agentRegistry over a configured store', async (t) => {
  const storeFile = await tmpStore(t)
  const provided = {}
  const ctx = {
    provide(name, value) {
      provided[name] = value
    },
    effect() {
      return () => {}
    },
  }
  const service = apply(ctx, { storeFile })
  assert.equal(provided.agentRegistry, service)
  assert.equal(service.pluginName, 'agent-registry')
  const a = await service.registerAgent({ name: '论文导师' })
  assert.equal(service.getAgent(a.id).name, '论文导师')
  assert.equal(service.listAgents().length, 1)
})

test('plugin shell: without config the default store file is absolute under .dsh/registry', (t) => {
  assert.ok(DEFAULT_STORE_FILE.startsWith('/'))
  assert.ok(DEFAULT_STORE_FILE.endsWith(join('.dsh', 'registry', 'agents.json')))
})
