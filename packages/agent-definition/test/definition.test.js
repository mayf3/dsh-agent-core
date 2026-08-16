/**
 * Unit tests for @agent-core/agent-definition (AGENT_DEFINITION_CONFIG_V1).
 *
 * Covers the frozen acceptance surface:
 *   1. list agents / get agent / name -> id / default agent / unknown
 *      rejection (the exact read semantics the old registry provided);
 *   2. stable `agt_*` ids are preserved verbatim and never change on
 *      rename (ids in config are authoritative; adoption reuses them);
 *   3. default agent preserved across adoption and migration;
 *   4. stock-adoption fixture: mint-once + reuse via adoptAgents;
 *   5. identity + display ONLY: avatar / persona / workspace / credential /
 *      runtime fields are rejected fail-loud;
 *   6. corrupt config invariants (dangling default, missing default,
 *      duplicate id, bad version, bad JSON) fail loud — never silently
 *      "fixed";
 *   7. one-time migration: old registry.json document -> new config
 *      (convertRegistryStore);
 *   8. the Cordis plugin shell (fake ctx) + absolute configFile contract.
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  AgentDefinition, AGENT_ID_PREFIX, AGENT_NOT_FOUND, CORRUPT_CONFIG, VALIDATION_ERROR, generateAgentId,
} from '../src/definition.js'
import {
  adoptAgents, convertRegistryStore, readDefinition, writeAgentDefinition,
  createAgentInConfig, updateAgentInConfig, disableAgentInConfig, setDefaultAgentInConfig,
} from '../src/config.js'
import { createDefinitionAccessHandlers } from '../src/access.js'
import { apply, DEFAULT_CONFIG_FILE } from '../src/index.js'

/** Fresh config path inside a throwaway tmp tree. */
async function tmpConfig(t, name = 'agents.json') {
  const dir = await mkdtemp(join(tmpdir(), 'agd-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return join(dir, name)
}

/** Build a definition over a config with Agent A (default) + Agent B. */
async function freshDefinition(t, { agents, defaultAgentId } = {}) {
  const configFile = await tmpConfig(t)
  const doc = {
    defaultAgentId: defaultAgentId ?? 'agt_a',
    agents: agents ?? [
      { id: 'agt_a', name: 'Agent A', description: '论文导师' },
      { id: 'agt_b', name: 'Agent B', description: null },
    ],
  }
  await writeAgentDefinition(configFile, doc)
  return new AgentDefinition({ configFile })
}

test('1. list/get/name->id/default: the read surface of the config', async (t) => {
  const def = await freshDefinition(t)

  // list, in config order.
  assert.deepEqual(def.listAgents().map((a) => a.name), ['Agent A', 'Agent B'])
  // get by id.
  assert.deepEqual(def.getAgent('agt_a'), { id: 'agt_a', name: 'Agent A', description: '论文导师', disabled: false })
  // public shape only: id/name/description/disabled — no avatar, no
  // timestamps, no paths, no persona, no credentials.
  assert.deepEqual(Object.keys(def.getAgent('agt_a')).sort(), ['description', 'disabled', 'id', 'name'])
  // name -> id (resolveAgentRef by display name, case-insensitive).
  assert.equal(def.resolveAgentRef('agent b').id, 'agt_b')
  assert.equal(def.resolveAgentRef('AGENT A').id, 'agt_a')
  // id resolution wins over a name that happens to match an id.
  assert.equal(def.resolveAgentRef('agt_a').id, 'agt_a')
  // default agent.
  assert.equal(def.getDefaultAgent().id, 'agt_a')
})

test('1. unknown agent rejection: getAgent / resolveAgentRef throw AGENT_NOT_FOUND', async (t) => {
  const def = await freshDefinition(t)
  assert.throws(() => def.getAgent('agt_does-not-exist'), (error) => error.code === AGENT_NOT_FOUND)
  assert.throws(() => def.resolveAgentRef('agt_does-not-exist'), (error) => error.code === AGENT_NOT_FOUND)
  assert.throws(() => def.resolveAgentRef('Nobody'), (error) => error.code === AGENT_NOT_FOUND)
  assert.equal(def.has('agt_a'), true)
  assert.equal(def.has('agt_does-not-exist'), false)
  assert.throws(() => def.resolveAgentRef(''), TypeError)
  assert.throws(() => def.resolveAgentRef(42), TypeError)
})

test('1. empty/missing config is a legal empty definition, not an error', async (t) => {
  const configFile = await tmpConfig(t)
  const def = new AgentDefinition({ configFile })
  assert.deepEqual(def.listAgents(), [])
  assert.equal(def.getDefaultAgent(), undefined)
  // A config with an explicit empty agent list is the same legal state.
  const emptyFile = await tmpConfig(t)
  await writeAgentDefinition(emptyFile, { defaultAgentId: null, agents: [] })
  const empty = new AgentDefinition({ configFile: emptyFile })
  assert.deepEqual(empty.listAgents(), [])
  assert.equal(empty.getDefaultAgent(), undefined)
})

test('2. stable agt_* ids: minted once, opaque, never changed by rename', async (t) => {
  const configFile = await tmpConfig(t)
  const adopted = await adoptAgents({ configFile, agents: [
    { name: '论文导师', description: '帮我改论文' },
    { name: '研发总监' },
  ] })
  assert.equal(adopted.created.length, 2)
  assert.equal(adopted.reused.length, 0)
  for (const agent of adopted.agents) {
    assert.ok(agent.id.startsWith(AGENT_ID_PREFIX), `id ${agent.id} carries the agt_ prefix`)
    assert.ok(agent.id.length > AGENT_ID_PREFIX.length)
  }
  const [a, b] = adopted.agents
  assert.notEqual(a.id, b.id)
  assert.equal(adopted.defaultAgentId, a.id, 'first adopted becomes default when the config had none')

  // "Rename": a NEW adoption of the same display names reuses the SAME ids —
  // the ids are stable even though the config could be rewritten with a
  // different display name. Rewriting the name under the SAME id is legal
  // (the id is authoritative and never changes).
  const second = await adoptAgents({ configFile, agents: [
    { name: '论文导师', description: '改名后的描述' },
  ] })
  assert.deepEqual(second.reused, [a.id])
  assert.deepEqual(second.created, [])
  assert.equal(second.agents[0].id, a.id)
  assert.equal(second.agents.length, 2, 'the config keeps every adopted agent')

  // The DEFAULT survives the second adoption untouched.
  assert.equal(second.defaultAgentId, a.id)
})

test('2. adoption re-mint is impossible: ids never collide, never reused', async (t) => {
  const configFile = await tmpConfig(t)
  const first = await adoptAgents({ configFile, agents: [{ name: 'X' }, { name: 'Y' }, { name: 'Z' }] })
  const ids = new Set(first.agents.map((a) => a.id))
  assert.equal(ids.size, 3)
  // A NEW name mints a fresh id, distinct from every existing one.
  const third = await adoptAgents({ configFile, agents: [{ name: 'W' }] })
  const all = new Set([...first.agents, ...third.agents].map((a) => a.id))
  assert.equal(all.size, 4)
  assert.equal(third.created.length, 1)
})

test('3. default agent preserved: adoption never steals the configured default', async (t) => {
  const configFile = await tmpConfig(t)
  await writeAgentDefinition(configFile, {
    defaultAgentId: 'agt_a',
    agents: [{ id: 'agt_a', name: 'A' }, { id: 'agt_b', name: 'B' }],
  })
  const adopted = await adoptAgents({ configFile, agents: [{ name: 'C' }] })
  assert.equal(adopted.defaultAgentId, 'agt_a', 'existing default preserved')
  assert.equal(new AgentDefinition({ configFile }).getDefaultAgent().id, 'agt_a')
})

test('4. stock adoption fixture: full config-level acceptance', async (t) => {
  const configFile = await tmpConfig(t)
  // The production stock-agent enters the config through adoption: ONE
  // minted opaque id, identity/display only (no chatId, no roles, no
  // credentials, no workspace path).
  const stock = await adoptAgents({ configFile, agents: [
    { name: '股票分析师', description: 'Production stock analyst agent, adopted from OpenClaw production (openclaw id: stock-agent). Identity/display only.' },
  ] })
  const agtId = stock.agents[0].id
  assert.ok(agtId.startsWith(AGENT_ID_PREFIX))
  const def = new AgentDefinition({ configFile })
  assert.equal(def.getAgent(agtId)?.name, '股票分析师')
  assert.equal(def.getDefaultAgent()?.id, agtId, 'adopted agent is the default')
  assert.equal(def.listAgents().length, 1)
  // Idempotent adoption (e.g. the acceptance runtime is KEPT) reuses the id.
  const again = await adoptAgents({ configFile, agents: [{ name: '股票分析师' }] })
  assert.deepEqual(again.reused, [agtId])
  assert.deepEqual(again.created, [])
  // The config serialization carries identity/display ONLY.
  const serialized = await readFile(configFile, 'utf8')
  for (const forbidden of ['avatar', 'workspace', 'dshHome', 'credential', 'principal', 'pid', 'session', 'createdAt', 'updatedAt', 'symlink']) {
    assert.ok(!serialized.includes(forbidden), `config must not carry ${forbidden}`)
  }
})

test('5. identity+display only: unsupported fields are rejected fail-loud', async (t) => {
  const configFile = await tmpConfig(t)
  for (const extra of ['avatar', 'persona', 'workspace', 'workspacePath', 'dshHome',
    'credential', 'principalId', 'clientId', 'grant', 'pid', 'sessionId', 'memory']) {
    await assert.rejects(
      writeAgentDefinition(configFile, { defaultAgentId: 'agt_a', agents: [{ id: 'agt_a', name: 'A', [extra]: 'x' }] }),
      (error) => error.code === VALIDATION_ERROR,
      `field ${extra} must be rejected`,
    )
  }
  // Top-level extras are rejected too (no runtime/session/process fields).
  await assert.rejects(
    writeAgentDefinition(configFile, { defaultAgentId: 'agt_a', agents: [{ id: 'agt_a', name: 'A' }], sessions: [] }),
    (error) => error.code === VALIDATION_ERROR,
  )
  // Non-string description rejected.
  await assert.rejects(
    writeAgentDefinition(configFile, { defaultAgentId: 'agt_a', agents: [{ id: 'agt_a', name: 'A', description: 42 }] }),
    (error) => error.code === VALIDATION_ERROR,
  )
})

test('5. id validation: non-empty opaque agt_* strings only', async (t) => {
  const configFile = await tmpConfig(t)
  for (const bad of ['', 'agent-a', 'agt_', 42, null, 'AGT_A', 'agt_ with spaces']) {
    await assert.rejects(
      writeAgentDefinition(configFile, { defaultAgentId: bad, agents: [{ id: bad, name: 'A' }] }),
      (error) => error.code === VALIDATION_ERROR,
      `id ${JSON.stringify(bad)} must be rejected`,
    )
  }
})

test('6. corrupt config invariants fail loud (CORRUPT_CONFIG, never silently fixed)', async (t) => {
  const configFile = await tmpConfig(t)
  const base = {
    version: 1,
    defaultAgentId: 'agt_a',
    agents: [{ id: 'agt_a', name: 'A' }, { id: 'agt_b', name: 'B' }],
  }
  const writeDoc = async (doc) => {
    await writeFile(configFile, JSON.stringify(doc))
  }
  const expectCorrupt = async (doc, label) => {
    await writeDoc(doc)
    assert.throws(() => new AgentDefinition({ configFile }), (error) => error.code === CORRUPT_CONFIG, label)
  }
  await expectCorrupt({ ...base, defaultAgentId: 'agt_deleted' }, 'dangling default pointer')
  await expectCorrupt({ ...base, defaultAgentId: null }, 'non-empty list without a default')
  await expectCorrupt({ ...base, agents: [{ id: 'agt_a', name: 'A' }, { id: 'agt_a', name: 'B' }] }, 'duplicate id')
  await expectCorrupt({ ...base, version: 99 }, 'unsupported version')
  await expectCorrupt({ ...base, agents: { agt_a: { id: 'agt_a', name: 'A' } } }, 'agents must be an array')
  await expectCorrupt({ ...base, agents: [{ id: 'agt_a', name: 'A', avatar: 'x' }] }, 'avatar field')
  await writeFile(configFile, '{ not json', 'utf8')
  assert.throws(() => new AgentDefinition({ configFile }), (error) => error.code === CORRUPT_CONFIG)
})

test('7. one-time migration: old registry.json document -> new config preserves ids + default', async (t) => {
  const oldStore = {
    version: 1,
    agents: {
      agt_90586d01a4cd47a28c0e3031542d6cd9: {
        id: 'agt_90586d01a4cd47a28c0e3031542d6cd9',
        name: 'Agent A',
        avatar: null,
        description: '论文导师',
        createdAt: '2026-08-15T03:40:15.204Z',
        updatedAt: '2026-08-15T03:40:15.204Z',
      },
      agt_282d42b764dd4d428c02f2007551ba25: {
        id: 'agt_282d42b764dd4d428c02f2007551ba25',
        name: 'Agent B',
        avatar: null,
        description: '研发总监',
        createdAt: '2026-08-15T03:40:15.209Z',
        updatedAt: '2026-08-15T03:40:15.209Z',
      },
    },
    defaultAgentId: 'agt_90586d01a4cd47a28c0e3031542d6cd9',
  }
  const converted = convertRegistryStore(oldStore)
  assert.equal(converted.version, 1)
  assert.equal(converted.defaultAgentId, 'agt_90586d01a4cd47a28c0e3031542d6cd9', 'default preserved verbatim')
  assert.deepEqual(converted.agents.map((a) => a.id), [
    'agt_90586d01a4cd47a28c0e3031542d6cd9',
    'agt_282d42b764dd4d428c02f2007551ba25',
  ], 'every stable id preserved verbatim')
  assert.equal(converted.agents[0].name, 'Agent A')
  assert.equal(converted.agents[0].description, '论文导师')
  assert.equal(converted.agents[0].disabled, false)
  assert.deepEqual(Object.keys(converted.agents[0]).sort(), ['description', 'disabled', 'id', 'name'], 'avatar + timestamps dropped')

  // Corrupt / unsupported old stores fail loud, never silently mangled.
  // (An EMPTY store `{version:1, agents:{}}` with no default is a legal
  // registry state and converts to an empty definition — covered above by
  // the round-trip test only for non-empty stores.)
  for (const bad of [
    { version: 1, agents: {}, defaultAgentId: 'agt_x' },               // dangling default
    { version: 1, agents: { agt_x: { id: 'agt_x', name: 'X' } } },     // agents but no default
    { version: 1, agents: { agt_x: { id: 'agt_other', name: 'X' } }, defaultAgentId: 'agt_x' }, // key/id mismatch
    { version: 2, agents: {}, defaultAgentId: null },
    { agents: {} },
  ]) {
    assert.throws(() => convertRegistryStore(bad), (error) => error.code === CORRUPT_CONFIG, JSON.stringify(bad))
  }
  // And the legal empty case converts to an empty definition.
  const empty = convertRegistryStore({ version: 1, agents: {} })
  assert.deepEqual(empty.agents, [])
  assert.equal(empty.defaultAgentId, null)
})

test('7. migrated config loads in the read service and round-trips', async (t) => {
  const configFile = await tmpConfig(t)
  const oldStore = {
    version: 1,
    agents: {
      agt_stable_1: { id: 'agt_stable_1', name: '知识管家', avatar: null, description: null, createdAt: 'x', updatedAt: 'x' },
    },
    defaultAgentId: 'agt_stable_1',
  }
  const converted = convertRegistryStore(oldStore)
  await writeAgentDefinition(configFile, converted)
  const def = new AgentDefinition({ configFile })
  assert.equal(def.getAgent('agt_stable_1').name, '知识管家')
  assert.equal(def.getDefaultAgent().id, 'agt_stable_1')
})

test('writeAgentDefinition is atomic: complete document, no leftover tmp', async (t) => {
  const configFile = await tmpConfig(t)
  await writeAgentDefinition(configFile, {
    defaultAgentId: 'agt_a',
    agents: [{ id: 'agt_a', name: 'A' }],
  })
  assert.ok(existsSync(configFile))
  assert.ok(!existsSync(`${configFile}.tmp`))
  const doc = JSON.parse(await readFile(configFile, 'utf8'))
  assert.equal(doc.version, 1)
  assert.equal(doc.agents.length, 1)
  // Duplicate ids in the write input are rejected before any write.
  await assert.rejects(
    writeAgentDefinition(configFile, { defaultAgentId: 'agt_a', agents: [{ id: 'agt_a', name: 'A' }, { id: 'agt_a', name: 'B' }] }),
    (error) => error.code === VALIDATION_ERROR,
  )
})

test('configFile must be an absolute path (fail-loud, no silent ~/cwd resolution)', async (t) => {
  assert.throws(() => new AgentDefinition({ configFile: 'agents.json' }), /absolute/)
  assert.throws(() => new AgentDefinition({ configFile: '~/.dsh/agents.json' }), /absolute/)
  assert.throws(() => new AgentDefinition({ configFile: '' }), /non-empty/)
  const provided = {}
  const ctx = {
    provide(name, value) { provided[name] = value },
    effect() { return () => {} },
  }
  assert.throws(() => apply(ctx, { configFile: '~/agents.json' }), /absolute/)
})

test('plugin shell: apply mounts ctx.agentDefinition over a configured file', async (t) => {
  const configFile = await tmpConfig(t)
  await writeAgentDefinition(configFile, {
    defaultAgentId: 'agt_a',
    agents: [{ id: 'agt_a', name: '论文导师', description: '帮我改论文' }],
  })
  const provided = {}
  const ctx = {
    provide(name, value) { provided[name] = value },
    effect() { return () => {} },
  }
  const service = apply(ctx, { configFile })
  assert.equal(provided.agentDefinition, service)
  assert.equal(service.pluginName, 'agent-definition')
  assert.equal(service.getAgent('agt_a').name, '论文导师')
  assert.equal(service.listAgents().length, 1)
  assert.equal(service.getDefaultAgent().id, 'agt_a')
  // The service surface is READ-ONLY: no registration/update/default-set API.
  assert.deepEqual(Object.keys(service).sort(), [
    'getAgent', 'getDefaultAgent', 'has', 'listAgents', 'pluginName', 'resolveAgentRef',
  ])
})

test('plugin shell: without config the default file is absolute under .dsh', (t) => {
  assert.ok(DEFAULT_CONFIG_FILE.startsWith('/'))
  assert.ok(DEFAULT_CONFIG_FILE.endsWith(join('.dsh', 'agents.json')))
})

test('generateAgentId: opaque agt_ prefixed, distinct, never reused', () => {
  const ids = new Set()
  for (let i = 0; i < 50; i += 1) {
    const id = generateAgentId()
    assert.ok(id.startsWith(AGENT_ID_PREFIX))
    assert.ok(id.length > AGENT_ID_PREFIX.length)
    assert.ok(!ids.has(id))
    ids.add(id)
  }
  assert.equal(ids.size, 50)
})

test('readDefinition: missing file is undefined; corrupt file fails loud', async (t) => {
  const configFile = await tmpConfig(t)
  assert.equal(readDefinition(configFile), undefined)
  await writeFile(configFile, '{ nope', 'utf8')
  assert.throws(() => readDefinition(configFile), (error) => error.code === CORRUPT_CONFIG)
})

// ── AGENT_DEFINITION_ACCESS_V1: disabled state, reload, mutation seam ───────

test('access: disabled agents are readable but never routable / never default', async (t) => {
  const configFile = await tmpConfig(t)
  await writeAgentDefinition(configFile, {
    defaultAgentId: 'agt_a',
    agents: [
      { id: 'agt_a', name: 'A' },
      { id: 'agt_b', name: 'B', disabled: true },
    ],
  })
  const def = new AgentDefinition({ configFile })
  // Readable (management surface) with the flag.
  assert.equal(def.getAgent('agt_b').disabled, true)
  assert.deepEqual(def.listAgents().map((a) => [a.id, a.disabled]), [['agt_a', false], ['agt_b', true]])
  // Not routable: resolveAgentRef rejects by id AND by name.
  assert.throws(() => def.resolveAgentRef('agt_b'), (error) => error.code === AGENT_NOT_FOUND)
  assert.throws(() => def.resolveAgentRef('B'), (error) => error.code === AGENT_NOT_FOUND)
  // Default never disabled.
  assert.equal(def.getDefaultAgent().id, 'agt_a')
  // A disabled default in the config is CORRUPT_CONFIG (fail-loud).
  await writeFile(configFile, JSON.stringify({
    version: 1, defaultAgentId: 'agt_b',
    agents: [{ id: 'agt_a', name: 'A' }, { id: 'agt_b', name: 'B', disabled: true }],
  }))
  assert.throws(() => new AgentDefinition({ configFile }), (error) => error.code === CORRUPT_CONFIG)
  // Non-boolean disabled rejected at write.
  await assert.rejects(
    writeAgentDefinition(configFile, { defaultAgentId: 'agt_a', agents: [{ id: 'agt_a', name: 'A', disabled: 'yes' }] }),
    (error) => error.code === VALIDATION_ERROR,
  )
})

test('access: reload() serves the persisted state without a restart', async (t) => {
  const configFile = await tmpConfig(t)
  await writeAgentDefinition(configFile, { defaultAgentId: 'agt_a', agents: [{ id: 'agt_a', name: 'A' }] })
  const def = new AgentDefinition({ configFile })
  assert.equal(def.listAgents().length, 1)
  // A deployment-side write lands in the same file; reload picks it up.
  await writeAgentDefinition(configFile, {
    defaultAgentId: 'agt_a',
    agents: [{ id: 'agt_a', name: 'A' }, { id: 'agt_b', name: 'B' }],
  })
  assert.equal(def.listAgents().length, 1, 'stale until reload')
  def.reload()
  assert.equal(def.listAgents().length, 2)
  assert.equal(def.getAgent('agt_b').name, 'B')
})

test('access: createAgentInConfig mints one stable id; update never changes it', async (t) => {
  const configFile = await tmpConfig(t)
  await writeAgentDefinition(configFile, { defaultAgentId: 'agt_a', agents: [{ id: 'agt_a', name: 'A' }] })
  const created = await createAgentInConfig(configFile, { name: '新成员', description: 'x' })
  assert.ok(created.id.startsWith(AGENT_ID_PREFIX))
  assert.equal(created.name, '新成员')
  assert.equal(created.disabled, false)
  const def = new AgentDefinition({ configFile })
  assert.equal(def.listAgents().length, 2)
  assert.equal(def.getDefaultAgent().id, 'agt_a', 'existing default preserved')
  // update: rename keeps the id.
  const updated = await updateAgentInConfig(configFile, created.id, { name: '新成员 v2', description: null })
  assert.equal(updated.id, created.id, 'id immutable on rename')
  assert.equal(updated.name, '新成员 v2')
  assert.equal(updated.description, null)
  const again = new AgentDefinition({ configFile })
  assert.equal(again.getAgent(created.id).name, '新成员 v2')
  // unknown id -> AGENT_NOT_FOUND.
  await assert.rejects(updateAgentInConfig(configFile, 'agt_nope', { name: 'x' }), (error) => error.code === AGENT_NOT_FOUND)
})

test('access: disableAgentInConfig + setDefaultAgentInConfig semantics', async (t) => {
  const configFile = await tmpConfig(t)
  await writeAgentDefinition(configFile, { defaultAgentId: 'agt_a', agents: [{ id: 'agt_a', name: 'A' }, { id: 'agt_b', name: 'B' }] })
  const def = new AgentDefinition({ configFile })

  // Disabling the DEFAULT is refused (no magic).
  await assert.rejects(disableAgentInConfig(configFile, 'agt_a'), (error) => error.code === VALIDATION_ERROR)
  // set_default -> B; then A can be disabled.
  const defNow = await setDefaultAgentInConfig(configFile, 'agt_b')
  assert.equal(defNow.id, 'agt_b')
  const disabled = await disableAgentInConfig(configFile, 'agt_a')
  assert.equal(disabled.disabled, true)
  assert.equal(disabled.id, 'agt_a')
  // set_default on a disabled agent refused.
  await assert.rejects(setDefaultAgentInConfig(configFile, 'agt_a'), (error) => error.code === VALIDATION_ERROR)
  def.reload()
  assert.equal(def.getDefaultAgent().id, 'agt_b')
  assert.equal(def.getAgent('agt_a').disabled, true)
  assert.throws(() => def.resolveAgentRef('agt_a'), (error) => error.code === AGENT_NOT_FOUND)
})

test('access: handlers expose the broker envelope and refresh the read model', async (t) => {
  const configFile = await tmpConfig(t)
  await writeAgentDefinition(configFile, { defaultAgentId: 'agt_a', agents: [{ id: 'agt_a', name: 'Agent A' }] })
  const definition = new AgentDefinition({ configFile })
  const handlers = createDefinitionAccessHandlers({ configFile, definition })

  // READ (no agent identity needed at this layer — the gateway guards it).
  const listed = await handlers['agent.definition.read'].list({}, { agentId: 'agt_a' })
  assert.equal(listed.ok, true)
  assert.equal(listed.result.agents.length, 1)
  const got = await handlers['agent.definition.read'].get({ agentId: 'agt_a' }, { agentId: 'agt_a' })
  assert.equal(got.ok, true)
  assert.equal(got.result.agent.id, 'agt_a')
  const missing = await handlers['agent.definition.read'].get({ agentId: 'agt_nope' }, { agentId: 'agt_a' })
  assert.equal(missing.ok, false)
  assert.equal(missing.error.code, 'agent_not_found')

  // WRITE: create -> minted; read model refreshed (same instance).
  const created = await handlers['agent.definition.write'].create({ name: 'Agent B' }, { agentId: 'agt_a' })
  assert.equal(created.ok, true)
  assert.ok(created.result.agent.id.startsWith(AGENT_ID_PREFIX))
  assert.equal(definition.listAgents().length, 2, 'read model refreshed after write')
  // update by name keeps the id; disable refuses the default; set_default works.
  const updated = await handlers['agent.definition.write'].update(
    { agentId: created.result.agent.id, name: 'Agent B v2' }, { agentId: 'agt_a' })
  assert.equal(updated.ok, true)
  assert.equal(updated.result.agent.id, created.result.agent.id)
  const badDisable = await handlers['agent.definition.write'].disable({ agentId: 'agt_a' }, { agentId: 'agt_a' })
  assert.equal(badDisable.ok, false)
  assert.equal(badDisable.error.code, 'validation_error')
  const sd = await handlers['agent.definition.write'].set_default({ agentId: created.result.agent.id }, { agentId: 'agt_a' })
  assert.equal(sd.ok, true)
  const dis = await handlers['agent.definition.write'].disable({ agentId: 'agt_a' }, { agentId: 'agt_a' })
  assert.equal(dis.ok, true)
  assert.equal(dis.result.agent.disabled, true)
  // Invalid args -> invalid_arguments envelope.
  const bad = await handlers['agent.definition.write'].create({ name: '' }, { agentId: 'agt_a' })
  assert.equal(bad.ok, false)
  assert.equal(bad.error.code, 'invalid_arguments')
})
