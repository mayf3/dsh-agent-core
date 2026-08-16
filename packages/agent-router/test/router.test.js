/**
 * Unit tests for @agent-core/agent-router — the Product Integration V1
 * domain surface: Binding persistence, Agent Definition integration, and
 * the single switchAgent domain operation.
 *
 * No real DSH processes are spawned here: the router is mounted on a fake
 * cordis ctx with a REAL AgentDefinition (over a tmp config file — the
 * declarative Agent existence authority, AGENT_DEFINITION_CONFIG_V1) and a
 * REAL BindingStore over tmp files, plus a stub workspaceBootstrap (only
 * needed by ensureRunning, which these tests never call). The acceptance
 * driver (scripts/product-integration-v1-verify.mjs) covers the
 * real-process chain.
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { apply as applyRouter, channelConversationIdOf } from '../src/index.js'

/** Fake cordis ctx: get/provide/effect only (what the router uses). */
function fakeCtx(services) {
  const provided = new Map()
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    effect: (fn) => { const dispose = fn(); return () => dispose?.() },
  }
}

/** Stub workspaceBootstrap (path mapping only; no real provisioning). */
function stubBootstrap() {
  return {
    resolveWorkspace: (agentId) => join('/tmp/ws', agentId),
    resolveDshHome: (agentId) => join('/tmp/home', agentId),
    ensure: async () => ({ workspace: '/tmp/ws', dshHome: '/tmp/home' }),
  }
}

/**
 * Seed a tmp Agent Definition config with [id, name] pairs (first entry is
 * the default) and load the read model over it.
 */
async function seedDefinition(dir, agents) {
  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, {
    defaultAgentId: agents[0]?.[0] ?? null,
    agents: agents.map(([id, name]) => ({ id, name })),
  })
  return new AgentDefinition({ configFile })
}

/** The cordis service surface of the agent-definition plugin. */
function definitionService(definition) {
  return {
    listAgents: () => definition.listAgents(),
    getAgent: (id) => definition.getAgent(id),
    getDefaultAgent: () => definition.getDefaultAgent(),
    resolveAgentRef: (ref) => definition.resolveAgentRef(ref),
  }
}

/**
 * Build a fresh definition + router over tmp stores; returns
 * {router, definition, dir}. `agents` is an array of [id, name] pairs
 * written into the Agent Definition config (identity-only fixture).
 */
async function freshRouter(t, { config = {}, agents = [] } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-router-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const definition = await seedDefinition(dir, agents)
  const ctx = fakeCtx(new Map([
    ['workspaceBootstrap', stubBootstrap()],
    ['agentDefinition', definitionService(definition)],
  ]))
  const router = applyRouter(ctx, {
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultSessionId: 'main',
    ...config,
  })
  return { router, definition, dir }
}

const CC = 'feishu:chat-main'
const CC_OTHER = 'feishu:chat-other'
// Fixed opaque ids in the config fixture (ids are authoritative in the
// declarative config; the Router never mints or rewrites them).
const A = { id: 'agt_a', name: 'Agent A' }
const B = { id: 'agt_b', name: 'Agent B' }
const AB = [[A.id, A.name], [B.id, B.name]]

test('first contact binds the conversation to the Agent Definition default', async (t) => {
  const { router } = await freshRouter(t, { agents: AB })

  const { channelConversation, binding } = await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })
  assert.equal(channelConversation.id, CC)
  assert.equal(binding.activeAgentId, A.id, 'default = the config defaultAgentId')
  assert.equal(binding.activeSessionId, 'main')
  // Idempotent: second resolve returns the same binding untouched.
  const again = await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })
  assert.equal(again.binding.activeAgentId, A.id)
})

test('switchAgent: A -> B by opaque id, persisted, returns the new Binding', async (t) => {
  const { router } = await freshRouter(t, { agents: AB })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })
  assert.equal(router.getBinding(CC).activeAgentId, A.id)

  const binding = await router.switchAgent(CC, B.id)
  assert.equal(binding.activeAgentId, B.id)
  assert.equal(binding.activeSessionId, 'main', 'no explicit session -> target main')
  assert.equal(router.getBinding(CC).activeAgentId, B.id)
})

test('switchAgent accepts the display name (Router owns agent lookup policy)', async (t) => {
  const { router } = await freshRouter(t, { agents: AB })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })

  const binding = await router.switchAgent(CC, 'Agent B')
  assert.equal(binding.activeAgentId, B.id)
})

test('switchAgent rejects an unknown Agent and leaves the Binding untouched', async (t) => {
  const { router } = await freshRouter(t, { agents: [[A.id, A.name]] })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })

  await assert.rejects(() => router.switchAgent(CC, 'agt_does-not-exist'), (error) => error.code === 'AGENT_NOT_FOUND')
  await assert.rejects(() => router.switchAgent(CC, 'Nobody'), (error) => error.code === 'AGENT_NOT_FOUND')
  assert.equal(router.getBinding(CC).activeAgentId, A.id, 'failed switch must not mutate the binding')
})

test('switchAgent honors an explicit targetSessionId (V1: else main)', async (t) => {
  const { router } = await freshRouter(t, { agents: AB })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })

  const binding = await router.switchAgent({ channelConversationId: CC }, B.id, { targetSessionId: 'normal-1' })
  assert.equal(binding.activeSessionId, 'normal-1')
})

test('switchAgent creates the Binding when the conversation has none yet', async (t) => {
  const { router } = await freshRouter(t, { agents: AB })
  assert.equal(router.getBinding(CC), undefined)

  const binding = await router.switchAgent(CC, B.id)
  assert.equal(binding.activeAgentId, B.id)
  assert.notEqual(binding.activeAgentId, A.id)
})

test('switching one conversation leaves other Bindings untouched', async (t) => {
  const { router } = await freshRouter(t, { agents: AB })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-other' })

  await router.switchAgent(CC, B.id)
  assert.equal(router.getBinding(CC).activeAgentId, B.id)
  assert.equal(router.getBinding(CC_OTHER).activeAgentId, A.id, 'other binding unchanged by switch')
})

test('restart: a fresh router over the same stores restores the switched Binding', async (t) => {
  const { router, dir } = await freshRouter(t, { agents: AB })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-other' })
  await router.switchAgent(CC, B.id)

  // Control-plane restart: fresh definition + fresh router over the SAME files.
  const definition2 = new AgentDefinition({ configFile: join(dir, 'agents.json') })
  const ctx2 = fakeCtx(new Map([
    ['workspaceBootstrap', stubBootstrap()],
    ['agentDefinition', definitionService(definition2)],
  ]))
  const router2 = applyRouter(ctx2, { bindingsStoreFile: join(dir, 'bindings.json'), defaultSessionId: 'main' })
  assert.equal(router2.getBinding(CC).activeAgentId, B.id, 'still Agent B after restart')
  assert.equal(router2.getBinding(CC_OTHER).activeAgentId, A.id, 'other binding also restored')
  // And the definition still resolves both agents (stable ids preserved).
  assert.equal(definition2.listAgents().length, 2)
  assert.equal(definition2.getAgent(A.id).name, 'Agent A')
})

test('channelConversationIdOf accepts string and {channelConversationId}', () => {
  assert.equal(channelConversationIdOf('feishu:x'), 'feishu:x')
  assert.equal(channelConversationIdOf({ channelConversationId: 'feishu:x' }), 'feishu:x')
  assert.throws(() => channelConversationIdOf({}), TypeError)
  assert.throws(() => channelConversationIdOf(''), TypeError)
})

test('channelConversationId is the single-owner id format (surface mapping)', async (t) => {
  const { router } = await freshRouter(t, { agents: [[A.id, A.name]] })
  assert.equal(router.channelConversationId('mobile', 'surface-1'), 'mobile:surface-1')
  // The service surface exposes the same format resolveChannelConversation uses.
  const { channelConversation } = await router.resolveChannelConversation({ channel: 'mobile', externalId: 'surface-1' })
  assert.equal(channelConversation.id, router.channelConversationId('mobile', 'surface-1'))
})

test('bookmark: leaving records lastSession; entering restores it (explicit > bookmark > main)', async (t) => {
  const { router } = await freshRouter(t, { agents: AB })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' }) // A/main

  // A -> B (bookmark (CC, A) = main); B -> A/work (bookmark (CC, B) = main).
  await router.switchAgent(CC, B.id)
  await router.switchAgent(CC, A.id, { targetSessionId: 'work' })
  assert.equal(router.getBinding(CC).activeSessionId, 'work')

  // A/work -> B (bookmark (CC, A) = work); B -> A must RESTORE work, not main.
  await router.switchAgent(CC, B.id)
  assert.equal(router.getBinding(CC).activeAgentId, B.id)
  const restored = await router.switchAgent(CC, A.id)
  assert.equal(restored.activeAgentId, A.id)
  assert.equal(restored.activeSessionId, 'work', 'bookmark(surface, A) = work must win over main')

  // The bookmark table is exactly the single-slot bookmarks written on leave.
  const bookmarks = router.lastSessionsSnapshot()
  const ccA = bookmarks.find(r => r.channelConversationId === CC && r.agentId === A.id)
  const ccB = bookmarks.find(r => r.channelConversationId === CC && r.agentId === B.id)
  assert.equal(ccA?.sessionId, 'work')
  assert.equal(ccB?.sessionId, 'main')
  assert.equal(bookmarks.length, 2, 'one slot per (surface, agent) — no history')
})

test('bookmark: a surface that never visited an Agent falls back to main', async (t) => {
  const { router } = await freshRouter(t, { agents: [...AB, ['agt_c', 'Agent C']] })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })

  await router.switchAgent(CC, 'agt_c')
  const binding = await router.switchAgent(CC, A.id)
  assert.equal(binding.activeAgentId, A.id)
  assert.equal(binding.activeSessionId, 'main', 'no bookmark for A on this surface -> main')
})

test('bookmark: self-switch without explicit session is a no-op', async (t) => {
  const { router } = await freshRouter(t, { agents: AB })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })
  await router.switchAgent(CC, A.id, { targetSessionId: 'work' })

  const before = router.getBinding(CC)
  const binding = await router.switchAgent(CC, A.id)
  assert.equal(binding.activeSessionId, 'work', 'tapping the current agent must not move sessions')
  assert.equal(binding.updatedAt, before.updatedAt, 'no-op must not rewrite the binding')
})

test('bookmark: per-surface isolation and restart persistence', async (t) => {
  const { router, dir } = await freshRouter(t, { agents: AB })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })
  await router.resolveChannelConversation({ channel: 'mobile', externalId: 'surface-1' })

  // Surface-1: A -> B -> A/work; chat-main untouched (still A/main).
  await router.switchAgent('mobile:surface-1', B.id)
  await router.switchAgent('mobile:surface-1', A.id, { targetSessionId: 'work' })
  assert.equal(router.getBinding('mobile:surface-1').activeSessionId, 'work')
  assert.equal(router.getBinding(CC).activeAgentId, A.id, 'mobile switch must not touch feishu binding')
  assert.equal(router.getBinding(CC).activeSessionId, 'main')

  // Control-plane restart over the SAME store: binding AND bookmark survive.
  const definition2 = new AgentDefinition({ configFile: join(dir, 'agents.json') })
  const ctx2 = fakeCtx(new Map([
    ['workspaceBootstrap', stubBootstrap()],
    ['agentDefinition', definitionService(definition2)],
  ]))
  const router2 = applyRouter(ctx2, { bindingsStoreFile: join(dir, 'bindings.json'), defaultSessionId: 'main' })
  assert.equal(router2.getBinding('mobile:surface-1').activeSessionId, 'work', 'binding restored after restart')
  const restored = await router2.switchAgent('mobile:surface-1', B.id)
  assert.equal(restored.activeAgentId, B.id)
  const again = await router2.switchAgent('mobile:surface-1', A.id)
  assert.equal(again.activeSessionId, 'work', 'bookmark restored after restart: (surface, A) = work')
})

test('getBinding returns undefined for an unknown conversation', async (t) => {
  const { router } = await freshRouter(t)
  assert.equal(router.getBinding('feishu:never'), undefined)
})
