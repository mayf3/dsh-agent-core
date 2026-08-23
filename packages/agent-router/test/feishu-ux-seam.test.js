/**
 * AGENT_CORE_LARK_UX_PHASE1_V2 Router UX intent seam tests (CTR-ROUTER-INTENT
 * 001/002/003, D-U1 approved minimal seam).
 *
 * The ONLY Router product-code change authorized by the spec is the Agent
 * successful-reply call in src/ingress-delivery.js adding
 * `{ ux: { rendering: 'markdown', autoMentionTriggerSender: true } }`:
 *
 *   - ROUTER_SUCCESS_CALL_CHANGE = EXACTLY_ONE (the success call carries the
 *     UX intent delta);
 *   - ROUTER_FAILURE_CALL_CHANGE = NONE (the deterministic failure receipt
 *     call passes exactly two arguments, byte-preserved);
 *   - ROUTER_IDENTITY_VALUE = NONE (the ux object carries intent flags ONLY —
 *     no openId, no sender name, no mention entries, no protocol objects);
 *   - ROUTER_AUTHORITY_CHANGE = NONE (routing/binding/switch paths untouched
 *     — asserted structurally here; the byte-level "other files zero diff"
 *     proof is the PR diff itself).
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentDefinition } from '../../agent-definition/src/definition.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { apply as applyRouter } from '../src/index.js'

function fakeCtx(services) {
  const provided = new Map()
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    effect: (fn) => { const dispose = fn(); return () => dispose?.() },
  }
}

function stubBootstrap() {
  return {
    resolveWorkspace: (agentId) => join('/tmp/ws', agentId),
    resolveDshHome: (agentId) => join('/tmp/home', agentId),
    ensure: async () => ({ workspace: '/tmp/ws', dshHome: '/tmp/home' }),
  }
}

/** Stub feishu capturing EVERY reply invocation's full argument list. */
function stubFeishu() {
  const replies = []
  return {
    replies,
    setCallback(fn) { this.callback = fn },
    reply(...args) { replies.push(args) },
    replyTargetFor(ingress) {
      return {
        replyTo: (messageId) => ({ kind: 'reply', channel: ingress.channel, chatId: ingress.chatId, messageId }),
      }
    },
  }
}

async function freshRouter(t, feishu, { failTurn = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'acr-ux-seam-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const configFile = join(dir, 'agents.json')
  await writeAgentDefinition(configFile, {
    defaultAgentId: 'agt_a',
    agents: [{ id: 'agt_a', name: 'Agent A' }],
  })
  const definition = new AgentDefinition({ configFile })
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
  return applyRouter(ctx, {
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultSessionId: 'main',
    agentProfile: 'agent-core-demo',
    provisionHome: () => {},
    processFactory: () => ({
      spawn() { this.pid = 4242; this.exit = undefined; this.exitPromise = new Promise(() => {}); return this },
      async ready() { return 0 },
      async turn() { if (failTurn) throw new Error('turn exploded'); return { reply: 'stub-reply', messageId: 'stub-msg' } },
      async shutdown() {},
      pid: 4242,
      exit: undefined,
      exitPromise: new Promise(() => {}),
      creations: [],
    }),
  })
}

const UX_INTENT = Object.freeze({ rendering: 'markdown', autoMentionTriggerSender: true })

test('UX-SEAM-1: the success call passes EXACTLY the approved UX intent — and nothing else', async (t) => {
  const feishu = stubFeishu()
  const router = await freshRouter(t, feishu)
  const result = await router.route({
    channel: 'group', chatId: 'oc_g1', conversationId: 'oc_g1',
    messageId: 'om_1', sender: { openId: 'ou_human_sender', name: '任何人' }, text: 'hi',
  })
  assert.equal(result.error, undefined)
  assert.equal(feishu.replies.length, 1)
  const [target, text, opts] = feishu.replies[0]
  assert.equal(target.kind, 'reply')
  assert.equal(text, 'stub-reply')
  assert.deepEqual(opts, { ux: UX_INTENT }, 'success call: exactly the D-U1 approved intent object')
})

test('UX-SEAM-2: the success ux object carries NO identity values of any kind', async (t) => {
  const feishu = stubFeishu()
  const router = await freshRouter(t, feishu)
  await router.route({
    channel: 'thread', chatId: 'oc_g1', conversationId: 'oc_g1:topic:omt_1', threadId: 'omt_1',
    messageId: 'om_2', sender: { openId: 'ou_human_sender', name: '任何人' }, text: 'hi',
  })
  const opts = feishu.replies[0][2]
  const serialized = JSON.stringify(opts)
  for (const forbidden of ['ou_human_sender', '任何人', 'openId', 'name', 'mention', 'receiveId', 'replyTo', 'chat_id']) {
    assert.ok(!serialized.includes(forbidden), `ux intent must not carry identity/protocol values: found ${forbidden}`)
  }
  assert.deepEqual(Object.keys(opts), ['ux'])
  assert.deepEqual(Object.keys(opts.ux).sort(), ['autoMentionTriggerSender', 'rendering'])
})

test('UX-SEAM-3: the deterministic FAILURE receipt call is byte-preserved — two arguments, no UX opts', async (t) => {
  const feishu = stubFeishu()
  const router = await freshRouter(t, feishu, { failTurn: true })
  const result = await router.route({
    channel: 'p2p', chatId: 'oc_p1', conversationId: 'oc_p1',
    messageId: 'om_3', sender: { openId: 'ou_x' }, text: 'hi',
  })
  assert.ok(result.error, 'the turn was stubbed to fail so the failure receipt path runs')
  assert.equal(feishu.replies.length, 1)
  const [target, text] = feishu.replies[0]
  assert.equal(feishu.replies[0].length, 2, 'failure receipt passes exactly (target, text) — no third argument')
  assert.match(text, /^\[agent-core\] delivery failed: /)
  assert.equal(target.kind, 'reply')
})

test('UX-SEAM-4: Router source delta is confined to the single success call site', async () => {
  const { execFileSync } = await import('node:child_process')
  // git diff vs base main confined to authorized surfaces
  const sourcePath = 'packages/agent-router/src/ingress-delivery.js'
  const diff = execFileSync('git', ['diff', 'origin/main', '--', sourcePath], {
    cwd: new URL('../../..', import.meta.url).pathname,
    encoding: 'utf8',
  }).toString()
  const removed = diff.split('\n').filter((line) => line.startsWith('-') && !line.startsWith('---'))
  assert.deepEqual(removed, [
    '-        await feishu.reply(feishu.replyTargetFor(ingress).replyTo(ingress.messageId), reply)',
  ], 'the ONLY removed line in Router product code is the old success call')
  const added = diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++'))
  assert.deepEqual(added, [
    "+        await feishu.reply(feishu.replyTargetFor(ingress).replyTo(ingress.messageId), reply, { ux: { rendering: 'markdown', autoMentionTriggerSender: true } })",
  ], 'the ONLY added line in Router product code is the approved UX intent call')
  const otherRouterFiles = execFileSync('git', ['diff', '--name-only', 'origin/main', '--', 'packages/agent-router/src/'], {
    cwd: new URL('../../..', import.meta.url).pathname,
    encoding: 'utf8',
  }).toString().trim()
  assert.equal(otherRouterFiles, sourcePath, 'no other Router source file changes')
})
