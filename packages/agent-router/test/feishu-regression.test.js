/**
 * Feishu regression tests — merge audit FIX 1.
 *
 * The Gate 1 channel-ization broke the Feishu entry in two ways:
 *   1. the connector classifies ingress.channel as the MESSAGE SUBTYPE
 *      ('p2p' | 'group' | 'thread'), so a `channel === 'feishu'` reply gate
 *      never matched and NO reply was sent;
 *   2. using ingress.channel as the Binding namespace created
 *      `p2p:<id>` / `group:<id>` / `thread:<id>` rows instead of the
 *      existing `feishu:<conversationId>` namespace, orphaning every
 *      durable Feishu Binding.
 *
 * Frozen semantics (restored here): p2p/group/thread = Feishu message
 * subtype (transport detail); 'feishu' = the Binding namespace of the
 * Feishu entry; 'mobile' = the mobile Product API namespace.
 *
 * The full onIngress path is exercised with a stub feishu channel handle
 * and a STUBBED AgentProcess (spawn/ready/turn/shutdown) so no real DSH
 * child is spawned; the reply branch and the Binding keys are the code
 * under test.
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { AgentProcess } from '../src/process.js'
import { apply as applyRouter, ingressBindingNamespace, feishuReplyOwed } from '../src/index.js'

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

/** Stub feishu channel handle: captures the callback and every reply. */
function stubFeishu() {
  const replies = []
  return {
    replies,
    setCallback(fn) { this.callback = fn },
    reply(target, text) { replies.push({ target, text }) },
    replyTargetFor(ingress) {
      return { replyTo: (messageId) => ({ conversationId: ingress.conversationId, messageId }) }
    },
  }
}

/**
 * Stub AgentProcess so onIngress can run its full path (resolve -> binding
 * -> ensureRunning -> turn -> reply) without a real DSH child. The router
 * imports the same module instance, so prototype patching is visible to it.
 * Returns { count } — the number of spawn() calls (DISABLED_ENFORCEMENT
 * tests assert spawn = 0 for non-runnable agents).
 */
function stubAgentProcess() {
  const spawns = { count: 0, turns: [] }
  AgentProcess.prototype.spawn = function spawnStub() {
    spawns.count += 1
    this.pid = 4242
    this.exit = undefined
    this.exitPromise = new Promise(() => {}) // never settles; reaped silently
    return this
  }
  AgentProcess.prototype.ready = async () => 0
  AgentProcess.prototype.turn = async function turnStub(sessionId, text, opts) {
    spawns.turns.push({ agentId: this.agentId, sessionId, text, opts })
    return { reply: 'stub-reply', messageId: 'stub-msg' }
  }
  AgentProcess.prototype.shutdown = async () => ({ code: 0, signal: null })
  return spawns
}

/** Fresh definition + router over tmp stores with a stub feishu; returns
 *  handles. Agents are seeded in the config BEFORE the router mounts (with a
 *  feishu channel the router resolves the default Agent at apply time). */
async function freshFeishuRouter(t) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-feishu-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, {
    defaultAgentId: 'agt_a',
    agents: [
      { id: 'agt_a', name: 'Agent A' },
      { id: 'agt_b', name: 'Agent B' },
    ],
  })
  const definition = new AgentDefinition({ configFile })
  const agentA = definition.getAgent('agt_a')
  const agentB = definition.getAgent('agt_b')
  const feishu = stubFeishu()
  const ctx = fakeCtx(new Map([
    ['workspaceBootstrap', stubBootstrap()],
    ['feishu', feishu],
    ['agentDefinition', {
      listAgents: () => definition.listAgents(),
      getAgent: (id) => definition.getAgent(id),
      getDefaultAgent: () => definition.getDefaultAgent(),
      resolveAgentRef: (ref) => definition.resolveAgentRef(ref),
    }],
  ]))
  const router = applyRouter(ctx, {
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultSessionId: 'main',
    agentProfile: 'agent-core-demo',
  })
  return { router, definition, agentA, agentB, feishu, dir }
}

function feishuIngress(channel, conversationId, text = 'hello') {
  return {
    channel,
    chatId: conversationId,
    conversationId,
    messageId: `om_${conversationId}_1`,
    sender: { openId: 'ou_test' },
    text,
  }
}

// ------------------------------------------------------- pure mapping rule

test('FEISHU_MAPPING: p2p/group/thread/(none) -> feishu namespace; mobile -> mobile', () => {
  assert.equal(ingressBindingNamespace({ channel: 'p2p' }), 'feishu')
  assert.equal(ingressBindingNamespace({ channel: 'group' }), 'feishu')
  assert.equal(ingressBindingNamespace({ channel: 'thread' }), 'feishu')
  assert.equal(ingressBindingNamespace({}), 'feishu') // legacy callers
  assert.equal(ingressBindingNamespace({ channel: 'mobile' }), 'mobile')
})

test('FEISHU_REPLY_OWED: every Feishu subtype owes a reply; mobile never does', () => {
  assert.equal(feishuReplyOwed({ channel: 'p2p' }), true)
  assert.equal(feishuReplyOwed({ channel: 'group' }), true)
  assert.equal(feishuReplyOwed({ channel: 'thread' }), true)
  assert.equal(feishuReplyOwed({}), true)
  assert.equal(feishuReplyOwed({ channel: 'mobile' }), false)
})

// ------------------------------------------------------------- full path

test('TRUSTED_INGRESS: exact Feishu chat/conversation/message fields reach the routed turn without parsing', async (t) => {
  const spawns = stubAgentProcess()
  const { router } = await freshFeishuRouter(t)
  const input = {
    channel: 'thread',
    chatId: 'oc_exact_chat',
    conversationId: 'oc_thread_conv:topic_exact',
    messageId: 'om_exact_message',
    sender: { openId: 'ou_test' },
    // The text embeds a decoy self-reported open id: feishuSenderOpenId in
    // the trusted context must come from the authenticated ingress sender
    // metadata, never from anything the prompt itself reports.
    text: 'thread turn mentions ou_decoy_id',
  }

  const result = await router.route(input)
  assert.equal(result.error, undefined)
  assert.equal(spawns.turns.length, 1)
  const trusted = spawns.turns[0].opts.ingressContext
  assert.deepEqual(trusted, {
    channelNamespace: 'feishu',
    channelConversationId: 'feishu:oc_thread_conv:topic_exact',
    feishuChatId: 'oc_exact_chat',
    feishuConversationId: 'oc_thread_conv:topic_exact',
    feishuMessageId: 'om_exact_message',
    feishuSenderOpenId: 'ou_test',
  })
  assert.equal(Object.isFrozen(trusted), true)
  assert.notEqual(trusted.feishuChatId, trusted.feishuConversationId,
    'thread conversation identity must never be parsed or reused as chatId')
})

test('FEISHU_P2P_REPLY: p2p ingress replies to Feishu and binds under feishu:<conversationId>', async (t) => {
  stubAgentProcess()
  const { router, agentA: a, feishu } = await freshFeishuRouter(t)

  const result = await router.route(feishuIngress('p2p', 'oc_p2p_1'))
  assert.equal(result.error, undefined)
  assert.equal(result.reply, 'stub-reply')
  assert.equal(feishu.replies.length, 1, 'Feishu reply MUST be sent for p2p')
  assert.equal(feishu.replies[0].text, 'stub-reply')
  assert.equal(feishu.replies[0].target.messageId, 'om_oc_p2p_1_1')
  // Binding namespace: feishu:<conversationId>, never p2p:<id>.
  const binding = router.getBinding('feishu:oc_p2p_1')
  assert.equal(binding?.activeAgentId, a.id)
  assert.equal(router.getBinding('p2p:oc_p2p_1'), undefined, 'no p2p: namespace row')
})

test('FEISHU_GROUP_REPLY: group ingress replies to Feishu and binds under feishu:<conversationId>', async (t) => {
  stubAgentProcess()
  const { router, agentA: a, feishu } = await freshFeishuRouter(t)

  const result = await router.route(feishuIngress('group', 'oc_group_1'))
  assert.equal(result.error, undefined)
  assert.equal(feishu.replies.length, 1, 'Feishu reply MUST be sent for group')
  assert.equal(feishu.replies[0].target.messageId, 'om_oc_group_1_1')
  assert.equal(router.getBinding('feishu:oc_group_1')?.activeAgentId, a.id)
  assert.equal(router.getBinding('group:oc_group_1'), undefined, 'no group: namespace row')
})

test('FEISHU_EXISTING_BINDING_KEY_PRESERVED: pre-existing feishu:<id> binding is HIT, not orphaned', async (t) => {
  stubAgentProcess()
  const { router, agentA: a, agentB: b, feishu } = await freshFeishuRouter(t)

  // A durable pre-Gate-1 binding exists: feishu:oc_existing -> B/main.
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'oc_existing' })
  await router.switchAgent('feishu:oc_existing', b.id)

  // A p2p message in that same conversation arrives (the old hot-patch
  // created a NEW p2p: row and replied there — the regression).
  const result = await router.route(feishuIngress('p2p', 'oc_existing'))
  assert.equal(result.error, undefined)
  assert.equal(result.reply, 'stub-reply')
  // The pre-existing durable binding was hit and is unchanged.
  assert.equal(router.getBinding('feishu:oc_existing')?.activeAgentId, b.id,
    'existing feishu:<id> binding must be preserved and hit')
  assert.equal(router.getBinding('p2p:oc_existing'), undefined,
    'no orphaned p2p: row may be created')
  // Reply went to the Feishu conversation that actually matched.
  assert.equal(feishu.replies.length, 1)
  assert.equal(feishu.replies[0].target.conversationId, 'oc_existing')
})

test('MOBILE_BINDING_NAMESPACE_UNCHANGED: mobile ingress -> mobile:<surfaceId>, no Feishu reply', async (t) => {
  stubAgentProcess()
  const { router, agentA: a, feishu } = await freshFeishuRouter(t)

  const result = await router.route({ channel: 'mobile', chatId: 'surf-7', conversationId: 'surf-7', sender: { openId: 'mobile:surf-7' }, text: 'hi' })
  assert.equal(result.error, undefined)
  assert.equal(result.reply, 'stub-reply')
  assert.equal(router.getBinding('mobile:surf-7')?.activeAgentId, a.id)
  assert.equal(router.getBinding('feishu:surf-7'), undefined, 'mobile must not leak into feishu namespace')
  assert.equal(feishu.replies.length, 0, 'mobile ingresses never reply via Feishu')
})

test('DISABLED_ENFORCEMENT: an existing binding to a disabled Agent rejects the ingress and NEVER spawns', async (t) => {
  stubAgentProcess()
  const { router, definition, agentA: a, agentB: b, feishu, dir } = await freshFeishuRouter(t)
  // A durable binding to B exists (B was enabled when the binding was made).
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'oc_b' })
  await router.switchAgent('feishu:oc_b', b.id)
  assert.equal(router.getBinding('feishu:oc_b')?.activeAgentId, b.id)

  // Deployment disables B in the SAME config file (the mutation seam's
  // write); the read model is reloaded. The stable id is unchanged.
  await writeAgentDefinition(join(dir, 'agents.json'), {
    defaultAgentId: 'agt_a',
    agents: [
      { id: 'agt_a', name: 'Agent A' },
      { id: 'agt_b', name: 'Agent B', disabled: true },
    ],
  })
  definition.reload()
  assert.equal(definition.getAgent(b.id).disabled, true)
  assert.equal(definition.getAgent(b.id).id, b.id, 'rename/disable never changes the stable id')

  // A message into B's conversation: binding HIT (history preserved), but
  // the lifecycle entry rejects — structured AGENT_DISABLED, spawn = 0.
  const spawns = stubAgentProcess()
  const result = await router.route(feishuIngress('p2p', 'oc_b'))
  assert.equal(result.error?.code, 'AGENT_DISABLED', `structured rejection (got ${result.error?.message ?? result.error})`)
  assert.equal(spawns.count, 0, 'ensureRunning must never spawn a disabled agent')
  assert.equal(feishu.replies.length, 1, 'Feishu got the delivery-failure reply')
  assert.match(feishu.replies[0].text, /disabled/)
  // The binding is NOT cleaned up — it keeps the historical relationship.
  assert.equal(router.getBinding('feishu:oc_b')?.activeAgentId, b.id, 'existing binding preserved (history)')
})

test('DISABLED_ENFORCEMENT: an unknown agent behind an existing binding also never spawns', async (t) => {
  stubAgentProcess()
  const { router, definition, agentB: b, feishu, dir } = await freshFeishuRouter(t)
  await router.resolveChannelConversation({ channel: 'feishu', externalId: 'oc_ghost' })
  await router.switchAgent('feishu:oc_ghost', b.id)
  // Deployment REMOVES B from the config entirely.
  await writeAgentDefinition(join(dir, 'agents.json'), {
    defaultAgentId: 'agt_a',
    agents: [{ id: 'agt_a', name: 'Agent A' }],
  })
  definition.reload()
  const spawns = stubAgentProcess()
  const result = await router.route(feishuIngress('p2p', 'oc_ghost'))
  assert.equal(result.error?.code, 'AGENT_NOT_FOUND', `unknown agent rejected (got ${result.error?.message ?? result.error})`)
  assert.equal(spawns.count, 0, 'ensureRunning must never spawn an unknown agent')
  assert.equal(router.getBinding('feishu:oc_ghost')?.activeAgentId, b.id, 'binding preserved')
})
