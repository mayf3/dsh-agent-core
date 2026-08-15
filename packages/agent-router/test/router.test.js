/**
 * Unit tests for @agent-core/agent-router — the Product Integration V1
 * domain surface: Binding persistence, Registry integration, and the single
 * switchAgent domain operation.
 *
 * No real DSH processes are spawned here: the router is mounted on a fake
 * cordis ctx with a REAL AgentRegistry and REAL BindingStore over tmp files,
 * and a stub workspaceBootstrap (only needed by ensureRunning, which these
 * tests never call). The acceptance driver (scripts/
 * product-integration-v1-verify.mjs) covers the real-process chain.
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentRegistry } from '../../agent-registry/src/registry.js'
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

/** Build a fresh registry + router over tmp stores; returns {router, registry}. */
async function freshRouter(t, { config = {} } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-router-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const registry = new AgentRegistry({ storeFile: join(dir, 'registry.json') })
  const ctx = fakeCtx(new Map([
    ['workspaceBootstrap', stubBootstrap()],
    ['agentRegistry', { // the cordis service surface of the registry plugin
      listAgents: () => registry.listAgents(),
      getAgent: (id) => registry.getAgent(id),
      getDefaultAgent: () => registry.getDefaultAgent(),
      registerAgent: (input) => registry.registerAgent(input),
      updateAgent: (agentId, patch) => registry.updateAgent(agentId, patch),
      setDefaultAgent: (agentId) => registry.setDefaultAgent(agentId),
    }],
  ]))
  const router = applyRouter(ctx, {
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultSessionId: 'main',
    ...config,
  })
  return { router, registry, dir }
}

const CC = 'feishu:chat-main'
const CC_OTHER = 'feishu:chat-other'

test('first contact binds the conversation to the Registry default Agent', async (t) => {
  const { router, registry } = await freshRouter(t)
  const a = await registry.registerAgent({ name: 'Agent A' })
  await registry.registerAgent({ name: 'Agent B' })

  const { channelConversation, binding } = await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })
  assert.equal(channelConversation.id, CC)
  assert.equal(binding.activeAgentId, a.id, 'default = first registered Agent')
  assert.equal(binding.activeSessionId, 'main')
  // Idempotent: second resolve returns the same binding untouched.
  const again = await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })
  assert.equal(again.binding.activeAgentId, a.id)
})

test('switchAgent: A -> B by opaque id, persisted, returns the new Binding', async (t) => {
  const { router, registry } = await freshRouter(t)
  const a = await registry.registerAgent({ name: 'Agent A' })
  const b = await registry.registerAgent({ name: 'Agent B' })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })
  assert.equal(router.getBinding(CC).activeAgentId, a.id)

  const binding = await router.switchAgent(CC, b.id)
  assert.equal(binding.activeAgentId, b.id)
  assert.equal(binding.activeSessionId, 'main', 'no explicit session -> target main')
  assert.equal(router.getBinding(CC).activeAgentId, b.id)
})

test('switchAgent accepts the display name (Router owns agent lookup policy)', async (t) => {
  const { router, registry } = await freshRouter(t)
  await registry.registerAgent({ name: 'Agent A' })
  const b = await registry.registerAgent({ name: 'Agent B' })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })

  const binding = await router.switchAgent(CC, 'Agent B')
  assert.equal(binding.activeAgentId, b.id)
})

test('switchAgent rejects an unknown Agent and leaves the Binding untouched', async (t) => {
  const { router, registry } = await freshRouter(t)
  const a = await registry.registerAgent({ name: 'Agent A' })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })

  await assert.rejects(() => router.switchAgent(CC, 'agt_does-not-exist'), (error) => error.code === 'AGENT_NOT_FOUND')
  await assert.rejects(() => router.switchAgent(CC, 'Nobody'), (error) => error.code === 'AGENT_NOT_FOUND')
  assert.equal(router.getBinding(CC).activeAgentId, a.id, 'failed switch must not mutate the binding')
})

test('switchAgent honors an explicit targetSessionId (V1: else main)', async (t) => {
  const { router, registry } = await freshRouter(t)
  await registry.registerAgent({ name: 'Agent A' })
  const b = await registry.registerAgent({ name: 'Agent B' })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })

  const binding = await router.switchAgent({ channelConversationId: CC }, b.id, { targetSessionId: 'normal-1' })
  assert.equal(binding.activeSessionId, 'normal-1')
})

test('switchAgent creates the Binding when the conversation has none yet', async (t) => {
  const { router, registry } = await freshRouter(t)
  const a = await registry.registerAgent({ name: 'Agent A' })
  const b = await registry.registerAgent({ name: 'Agent B' })
  assert.equal(router.getBinding(CC), undefined)

  const binding = await router.switchAgent(CC, b.id)
  assert.equal(binding.activeAgentId, b.id)
  assert.notEqual(binding.activeAgentId, a.id)
})

test('switching one conversation leaves other Bindings untouched', async (t) => {
  const { router, registry } = await freshRouter(t)
  const a = await registry.registerAgent({ name: 'Agent A' })
  const b = await registry.registerAgent({ name: 'Agent B' })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-other' })

  await router.switchAgent(CC, b.id)
  assert.equal(router.getBinding(CC).activeAgentId, b.id)
  assert.equal(router.getBinding(CC_OTHER).activeAgentId, a.id, 'other binding unchanged by switch')
})

test('restart: a fresh router over the same stores restores the switched Binding', async (t) => {
  const { router, registry, dir } = await freshRouter(t)
  const a = await registry.registerAgent({ name: 'Agent A' })
  const b = await registry.registerAgent({ name: 'Agent B' })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-main' })
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'chat-other' })
  await router.switchAgent(CC, b.id)

  // Control-plane restart: fresh registry + fresh router over the SAME files.
  const registry2 = new AgentRegistry({ storeFile: join(dir, 'registry.json') })
  const ctx2 = fakeCtx(new Map([
    ['workspaceBootstrap', stubBootstrap()],
    ['agentRegistry', {
      listAgents: () => registry2.listAgents(),
      getAgent: (id) => registry2.getAgent(id),
      getDefaultAgent: () => registry2.getDefaultAgent(),
    }],
  ]))
  const router2 = applyRouter(ctx2, { bindingsStoreFile: join(dir, 'bindings.json'), defaultSessionId: 'main' })
  assert.equal(router2.getBinding(CC).activeAgentId, b.id, 'still Agent B after restart')
  assert.equal(router2.getBinding(CC_OTHER).activeAgentId, a.id, 'other binding also restored')
  // And the registry still resolves both agents.
  assert.equal(registry2.listAgents().length, 2)
})

test('channelConversationIdOf accepts string and {channelConversationId}', () => {
  assert.equal(channelConversationIdOf('feishu:x'), 'feishu:x')
  assert.equal(channelConversationIdOf({ channelConversationId: 'feishu:x' }), 'feishu:x')
  assert.throws(() => channelConversationIdOf({}), TypeError)
  assert.throws(() => channelConversationIdOf(''), TypeError)
})

test('getBinding returns undefined for an unknown conversation', async (t) => {
  const { router } = await freshRouter(t)
  assert.equal(router.getBinding('feishu:never'), undefined)
})
