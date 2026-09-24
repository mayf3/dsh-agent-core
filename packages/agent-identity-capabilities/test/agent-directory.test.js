/**
 * AGENT_CORE_AGENT_DIRECTORY_TOOL_V1 — trusted-provider semantic matrix
 * (ACC-ADT-002, T1–T12) over a REAL AgentDefinition config, plus the
 * zero-side-effect proof (ACC-ADT-004): every call is read-only and the
 * config file bytes are identical before/after the whole matrix.
 *
 * Fixture (config order matters — candidates and list follow it):
 *   agt_alpha       name 'Alpha Agent'
 *   agt_beta        name 'Beta Ops'
 *   agt_zombie      name 'Zombie Co'      disabled  (existence truth only)
 *   agt_imposter    name 'agt_zombie'     enabled   (name == another's id)
 *   agt_nametrap    name 'agt_alpha'      enabled   (name == another's id)
 *   agt_shapehold   name 'agt_freename'   enabled   (agt_-shaped name matching NO id)
 *   agt_dup1        name 'Dup Name'       enabled
 *   agt_dup2        name 'Dup Name'       disabled
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { classifyDirectorySnapshot, createAgentDirectoryAccess, validateDirectoryArgs } from '../src/agent-directory.js'

const CONFIG = {
  version: 1,
  defaultAgentId: 'agt_alpha',
  agents: [
    { id: 'agt_alpha', name: 'Alpha Agent' },
    { id: 'agt_beta', name: 'Beta Ops' },
    { id: 'agt_zombie', name: 'Zombie Co', disabled: true },
    { id: 'agt_imposter', name: 'agt_zombie' },
    { id: 'agt_nametrap', name: 'agt_alpha' },
    { id: 'agt_shapehold', name: 'agt_freename' },
    { id: 'agt_dup1', name: 'Dup Name' },
    { id: 'agt_dup2', name: 'Dup Name', disabled: true },
  ],
}

function makeAccess(t) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-dir-matrix-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const configFile = join(dir, 'agents.json')
  writeFileSync(configFile, `${JSON.stringify(CONFIG, null, 2)}\n`)
  const before = readFileSync(configFile, 'utf8')
  const access = createAgentDirectoryAccess({ definition: new AgentDefinition({ configFile }) })
  return { configFile, before, handlers: access.handlers['agent.directory'] }
}

async function resolveEnvelope(handlers, query) {
  return handlers.resolve({ query })
}

test('T1 exact enabled id → resolved enabled:true', async (t) => {
  const { handlers } = makeAccess(t)
  const envelope = await resolveEnvelope(handlers, 'agt_beta')
  assert.deepEqual(envelope, {
    ok: true,
    result: { status: 'resolved', agent: { agentId: 'agt_beta', name: 'Beta Ops', description: null, enabled: true } },
  })
})

test('T2 exact disabled id → resolved enabled:false; when the id is ALSO another agent name, the id match wins', async (t) => {
  const { handlers } = makeAccess(t)
  const plain = await resolveEnvelope(handlers, 'agt_zombie')
  assert.deepEqual(plain, {
    ok: true,
    result: { status: 'resolved', agent: { agentId: 'agt_zombie', name: 'Zombie Co', description: null, enabled: false } },
  })
  // agt_imposter's DISPLAY NAME is exactly 'agt_zombie'; the id match wins,
  // the imposter is never selected, and the result never falls through.
  assert.equal(plain.result.agent.agentId, 'agt_zombie')
})

test('T3 exact name case-insensitive → resolved', async (t) => {
  const { handlers } = makeAccess(t)
  for (const query of ['Beta Ops', 'beta ops', 'BETA OPS']) {
    const envelope = await resolveEnvelope(handlers, query)
    assert.equal(envelope.result.status, 'resolved', query)
    assert.equal(envelope.result.agent.agentId, 'agt_beta')
  }
})

test('T4 padded name → name path folds trim → resolved', async (t) => {
  const { handlers } = makeAccess(t)
  const envelope = await resolveEnvelope(handlers, '  Beta Ops  ')
  assert.equal(envelope.result.status, 'resolved')
  assert.equal(envelope.result.agent.agentId, 'agt_beta')
})

test('T5 duplicate names → ambiguous with the FULL candidate set in config order (never a pick)', async (t) => {
  const { handlers } = makeAccess(t)
  const envelope = await resolveEnvelope(handlers, 'dup name')
  assert.deepEqual(envelope, {
    ok: true,
    result: {
      status: 'ambiguous',
      query: 'dup name',
      candidates: [
        { agentId: 'agt_dup1', name: 'Dup Name', enabled: true },
        { agentId: 'agt_dup2', name: 'Dup Name', enabled: false },
      ],
    },
  })
})

test('T6 unknown plain name → not_found (explicit, never a guess)', async (t) => {
  const { handlers } = makeAccess(t)
  const envelope = await resolveEnvelope(handlers, 'Nonexistent Butler')
  assert.deepEqual(envelope, { ok: true, result: { status: 'not_found', query: 'Nonexistent Butler' } })
})

test('T7 agt_-shaped string matching NO id but matching a name → resolved by name', async (t) => {
  const { handlers } = makeAccess(t)
  // 'agt_freename' is NOT any agent's id in this fixture — it exists only as
  // agt_shapehold's DISPLAY NAME, so this query can only resolve via the
  // name path (the semantic T7 exists to prove).
  const envelope = await resolveEnvelope(handlers, 'agt_freename')
  assert.deepEqual(envelope, {
    ok: true,
    result: { status: 'resolved', agent: { agentId: 'agt_shapehold', name: 'agt_freename', description: null, enabled: true } },
  })
})

test('T8 whitespace-only / malformed query → invalid_arguments envelope, never a status', async (t) => {
  const { handlers } = makeAccess(t)
  for (const args of [{ query: '   ' }, { query: '' }, {}, { query: 7 }, { query: 'x', extra: true }, null, 'str']) {
    const envelope = await handlers.resolve(args)
    assert.deepEqual([envelope.ok, envelope.error?.code], [false, 'invalid_arguments'], JSON.stringify(args))
  }
  // list is strict too.
  const listEnvelope = await handlers.list({ junk: 1 })
  assert.deepEqual([listEnvelope.ok, listEnvelope.error?.code], [false, 'invalid_arguments'])
})

test('T9 one agent id equal to ANOTHER agent display name → resolved by id', async (t) => {
  const { handlers } = makeAccess(t)
  const envelope = await resolveEnvelope(handlers, 'agt_alpha')
  assert.deepEqual(envelope, {
    ok: true,
    result: { status: 'resolved', agent: { agentId: 'agt_alpha', name: 'Alpha Agent', description: null, enabled: true } },
  })
})

test('T10 padded exact id → not_found (id path is raw byte equality)', async (t) => {
  const { handlers } = makeAccess(t)
  const envelope = await resolveEnvelope(handlers, ' agt_beta ')
  assert.deepEqual(envelope, { ok: true, result: { status: 'not_found', query: ' agt_beta ' } })
})

test('T11 unknown agt_-shaped string → not_found', async (t) => {
  const { handlers } = makeAccess(t)
  const envelope = await resolveEnvelope(handlers, 'agt_totally_unknown')
  assert.deepEqual(envelope, { ok: true, result: { status: 'not_found', query: 'agt_totally_unknown' } })
})

test('T12 list: config order, disabled agents present, exact directory shape', async (t) => {
  const { handlers } = makeAccess(t)
  const envelope = await handlers.list({})
  assert.equal(envelope.ok, true)
  assert.deepEqual(envelope.result.agents, [
    { agentId: 'agt_alpha', name: 'Alpha Agent', description: null, enabled: true },
    { agentId: 'agt_beta', name: 'Beta Ops', description: null, enabled: true },
    { agentId: 'agt_zombie', name: 'Zombie Co', description: null, enabled: false },
    { agentId: 'agt_imposter', name: 'agt_zombie', description: null, enabled: true },
    { agentId: 'agt_nametrap', name: 'agt_alpha', description: null, enabled: true },
    { agentId: 'agt_shapehold', name: 'agt_freename', description: null, enabled: true },
    { agentId: 'agt_dup1', name: 'Dup Name', description: null, enabled: true },
    { agentId: 'agt_dup2', name: 'Dup Name', description: null, enabled: false },
  ])
})

test('ACC-ADT-004: the whole matrix is read-only — config bytes identical before/after', async (t) => {
  const { configFile, before, handlers } = makeAccess(t)
  for (const query of ['agt_beta', 'agt_zombie', 'BETA OPS', 'dup name', 'Nonexistent', ' agt_beta ', '   ']) {
    await resolveEnvelope(handlers, query)
  }
  await handlers.list({})
  assert.equal(readFileSync(configFile, 'utf8'), before, 'zero writes anywhere')
})

test('classifier: the pure function agrees with the handler envelopes (snapshot discipline)', async () => {
  const agents = CONFIG.agents.map((a) => ({ description: null, ...a }))
  assert.equal(classifyDirectorySnapshot(agents, 'agt_beta').status, 'resolved')
  assert.equal(classifyDirectorySnapshot(agents, 'dup name').status, 'ambiguous')
  assert.equal(classifyDirectorySnapshot(agents, 'nope').status, 'not_found')
  // Exactly ONE listAgents read per call is structural: instrument the seam
  // and prove a single resolve touches it exactly once.
  let reads = 0
  const counting = { listAgents: () => { reads += 1; return agents.map((a) => ({ ...a })) } }
  const access = createAgentDirectoryAccess({ definition: counting })
  const envelope = await access.handlers['agent.directory'].resolve({ query: 'agt_beta' })
  assert.equal(envelope.ok, true)
  assert.equal(reads, 1, 'one synchronous snapshot read per call')
})

test('validateDirectoryArgs: authority-level rejections are exact', () => {
  assert.deepEqual(validateDirectoryArgs({ query: 'x' }, 'resolve'), { ok: true })
  assert.equal(validateDirectoryArgs({ query: '   ' }, 'resolve').ok, false)
  assert.equal(validateDirectoryArgs({ query: 1 }, 'resolve').ok, false)
  assert.equal(validateDirectoryArgs({ query: 'x', y: 1 }, 'resolve').ok, false)
  assert.equal(validateDirectoryArgs({}, 'resolve').ok, false)
  assert.deepEqual(validateDirectoryArgs({}, 'list'), { ok: true })
  assert.equal(validateDirectoryArgs({ query: 'x' }, 'list').ok, false)
  assert.equal(validateDirectoryArgs(null, 'resolve').ok, false)
  assert.equal(validateDirectoryArgs('x', 'list').ok, false)
})
