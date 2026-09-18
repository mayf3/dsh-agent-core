import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createIngressDelivery } from '../../src/ingress-delivery.js'
import { buildFeishuHandle } from '../../../feishu-connector/src/index.js'

const ingress = Object.freeze({
  channel: 'group',
  chatId: 'oc_group_1',
  conversationId: 'oc_group_1',
  messageId: 'om_source',
  sender: { openId: 'ou_sender' },
  text: 'one harmless prompt',
})

const RECOVERY_KEYS = [
  'attemptedActions', 'failureStage', 'fencedBy', 'missingEvidence',
  'nextSafeAction', 'partialDelivery', 'processGeneration', 'reconciliationHandle',
  'replyDelivery', 'requestAdmission', 'terminationEvidence',
].sort()

function harness({ turn, reply }) {
  const replies = []
  let executions = 0
  const routeChain = {
    async runTurnWithRouteChain(...args) {
      executions += 1
      return turn(...args)
    },
    noteCanaryExternalDelivery() {},
  }
  const feishu = {
    replyTargetFor(event) {
      return {
        replyTo(messageId) {
          return { kind: 'reply', chatId: event.chatId, messageId }
        },
      }
    },
    async reply(...args) {
      replies.push(args)
      return reply(...args, replies.length)
    },
  }
  const delivery = createIngressDelivery({
    log: { log() {}, error() {} },
    feishu,
    workspaceBootstrap: { async ensureWorkspace() {} },
    store: {},
    reconciliationStore: { assertMintCapacity() {} },
    routeChain,
    resolveAgentRef() { throw new Error('not used') },
    resolveAgentById() { throw new Error('not used') },
    async resolveChannelConversation() {
      return {
        channelConversation: { id: 'feishu:oc_group_1' },
        binding: { activeAgentId: 'agt_expert', activeSessionId: 'main' },
      }
    },
    resolveEffectiveWorkspace() {
      return { workspaceId: null, workspacePath: '/tmp/agt-expert' }
    },
  })
  return {
    delivery,
    replies,
    executions: () => executions,
  }
}

test('V3 outer ingress sends one image answer as text and projects connector timeout without re-execution', async () => {
  const answer = 'result ![model](https://example.com/model.png)'
  const sends = []
  const channel = {
    on() {},
    getBotIdentity() { return { openId: 'ou_bot' } },
    async send(to, input, opts) {
      sends.push({ to, input, opts })
      if (sends.length === 1) {
        throw Object.assign(new Error('request timeout'), { code: 'send_timeout' })
      }
      return { messageId: 'om_failure_receipt' }
    },
  }
  const feishu = buildFeishuHandle({
    channel,
    cfg: {
      onEvent: null,
      ingressGate: null,
      onStatus: null,
      autoMentionTriggerSender: true,
      processingReactionEnabled: false,
      replyRenderMode: 'markdown',
    },
    log: () => {},
    connect: async () => {},
  })
  let executions = 0
  const delivery = createIngressDelivery({
    log: { log() {}, error() {} },
    feishu,
    workspaceBootstrap: { async ensureWorkspace() {} },
    store: {},
    reconciliationStore: { assertMintCapacity() {} },
    routeChain: {
      async runTurnWithRouteChain() {
        executions += 1
        return { reply: answer, pid: 19, status: 'completed' }
      },
      noteCanaryExternalDelivery() {},
    },
    resolveAgentRef() { throw new Error('not used') },
    resolveAgentById() { throw new Error('not used') },
    async resolveChannelConversation() {
      return {
        channelConversation: { id: 'feishu:oc_group_1' },
        binding: { activeAgentId: 'agt_expert', activeSessionId: 'main' },
      }
    },
    resolveEffectiveWorkspace() {
      return { workspaceId: null, workspacePath: '/tmp/agt-expert' }
    },
  })

  const result = await delivery.onIngress(ingress)

  assert.equal(executions, 1)
  assert.deepEqual(Object.keys(result).sort(), RECOVERY_KEYS)
  assert.equal(result.failureStage, 'reply_delivery')
  assert.equal(result.replyDelivery, 'unknown')
  assert.equal(JSON.stringify(result).includes(answer), false)
  assert.equal(JSON.stringify(result).includes('request timeout'), false)
  assert.deepEqual(sends[0].input, { text: answer })
  assert.deepEqual(sends[0].opts.mentions, [{ openId: 'ou_sender' }])
  assert.equal(sends.length, 2, 'one answer attempt plus one diagnostic receipt')
  assert.ok(!sends[1].input.text.includes(answer))
  assert.match(sends[1].input.text, /可能已送达/)
})

test('V3 admission failure returns the closed diagnostic without raw error content', async () => {
  const error = Object.assign(new Error('SECRET_ADMISSION_SENTINEL'), {
    code: 'AGENT_PROCESS_TURN_FENCED',
    status: 'not_admitted',
    envelope: 'not_admitted',
    fencedBy: 'turn:agt_expert:main:a1:g1:s1',
  })
  const fx = harness({
    turn: async () => { throw error },
    reply: async () => ({ messageId: 'om_receipt' }),
  })

  const result = await fx.delivery.onIngress(ingress)

  assert.deepEqual(Object.keys(result).sort(), RECOVERY_KEYS)
  assert.equal(result.failureStage, 'admission')
  assert.equal(result.fencedBy, 'turn:agt_expert:main:a1:g1:s1')
  assert.equal(JSON.stringify(result).includes('SECRET_ADMISSION_SENTINEL'), false)
  assert.equal(fx.executions(), 1)
  assert.equal(fx.replies.length, 1, 'only the existing failure receipt is attempted')
})

test('V3 execution failure is distinct from reply delivery without raw error content', async () => {
  const error = Object.assign(new Error('SECRET_EXECUTION_SENTINEL'), { code: 'provider_failure' })
  const fx = harness({
    turn: async () => { throw error },
    reply: async () => ({ messageId: 'om_receipt' }),
  })

  const result = await fx.delivery.onIngress(ingress)

  assert.deepEqual(Object.keys(result).sort(), RECOVERY_KEYS)
  assert.equal(result.failureStage, 'execution')
  assert.equal(JSON.stringify(result).includes('SECRET_EXECUTION_SENTINEL'), false)
  assert.equal(fx.executions(), 1)
  assert.equal(fx.replies.length, 1)
})

for (const failureClass of [
  'spawn_failed_without_child',
  'initialize_provider_unavailable',
  'session_create_resume_rejection',
  'turnqueue_not_admitted',
]) {
  test(`V3 route-chain ${failureClass} failure stays in the admission variant`, async () => {
    const error = Object.assign(new Error(`route stopped at ${failureClass}`), {
      routeChain: {
        routeChainId: 'fallback-v1',
        totalRouteAttempts: 1,
        finalOutcome: failureClass,
        failureClass,
      },
    })
    const fx = harness({
      turn: async () => { throw error },
      reply: async () => ({ messageId: 'om_receipt' }),
    })

    const result = await fx.delivery.onIngress(ingress)

    assert.equal(result.failureStage, 'admission')
    assert.deepEqual(Object.keys(result).sort(), RECOVERY_KEYS)
  })
}

test('V3 envelope-only not_admitted failure stays in the admission variant', async () => {
  const error = Object.assign(new Error('queue rejected the turn'), { envelope: 'not_admitted' })
  const fx = harness({
    turn: async () => { throw error },
    reply: async () => ({ messageId: 'om_receipt' }),
  })

  const result = await fx.delivery.onIngress(ingress)

  assert.equal(result.failureStage, 'admission')
  assert.deepEqual(Object.keys(result).sort(), RECOVERY_KEYS)
})

test('V3 route-chain deadline before admission stays in the admission variant', async () => {
  const error = Object.assign(new Error('route chain deadline exhausted before admission'), {
    code: 'AGENT_ROUTE_CHAIN_DEADLINE_EXCEEDED',
    envelope: 'chain_deadline_exceeded',
  })
  const fx = harness({
    turn: async () => { throw error },
    reply: async () => ({ messageId: 'om_receipt' }),
  })

  const result = await fx.delivery.onIngress(ingress)

  assert.equal(result.failureStage, 'admission')
  assert.deepEqual(Object.keys(result).sort(), RECOVERY_KEYS)
})

test('V3 pre-generation provider quota remains an execution failure', async () => {
  const error = Object.assign(new Error('provider rejected the accepted request before generation'), {
    routeChain: {
      routeChainId: 'fallback-v1',
      totalRouteAttempts: 1,
      finalOutcome: 'provider_quota_rejected_before_generation',
      failureClass: 'provider_quota_rejected_before_generation',
    },
  })
  const fx = harness({
    turn: async () => { throw error },
    reply: async () => ({ messageId: 'om_receipt' }),
  })

  const result = await fx.delivery.onIngress(ingress)

  assert.equal(result.failureStage, 'execution')
  assert.deepEqual(Object.keys(result).sort(), RECOVERY_KEYS)
})

const deliveryCases = [
  ['unknown', 'unknown', '可能已送达'],
  ['send_timeout', 'unknown', '可能已送达'],
  ['unclassified_transport', 'unknown', '可能已送达'],
  ['permission_denied', 'failed', '回复投递失败'],
  ['format_error', 'failed', '回复投递失败'],
  ['target_revoked', 'failed', '回复投递失败'],
  ['rate_limited', 'failed', '回复投递失败'],
]

for (const [code, expectedDelivery, receiptNeedle] of deliveryCases) {
  test(`V3 completed execution plus ${code} becomes a ${expectedDelivery} reply-delivery result`, async () => {
    const answer = 'generated answer with private URL https://private.invalid/secret'
    const deliveryError = Object.assign(new Error(`terminal ${code}`), { code })
    const turnResult = {
      reply: answer,
      pid: 4242,
      status: 'completed',
      reconciliationHandle: 'turn:agt_expert:main:a1:g1:s1',
      evidence: { turnEnd: true },
    }
    const fx = harness({
      turn: async () => turnResult,
      reply: async (_target, _text, _opts, callNumber) => {
        if (callNumber === 1) throw deliveryError
        return { messageId: 'om_failure_receipt' }
      },
    })

    const result = await fx.delivery.onIngress(ingress)

    assert.deepEqual(Object.keys(result).sort(), RECOVERY_KEYS)
    assert.equal(result.failureStage, 'reply_delivery')
    assert.equal(result.replyDelivery, expectedDelivery)
    assert.equal(result.partialDelivery, 'possible')
    assert.equal(result.requestAdmission, 'accepted')
    assert.equal(result.reconciliationHandle, turnResult.reconciliationHandle)
    assert.equal(JSON.stringify(result).includes(answer), false)
    assert.equal(JSON.stringify(result).includes(`terminal ${code}`), false)
    assert.equal(fx.executions(), 1)
    assert.equal(fx.replies.length, 2, 'one original-answer attempt plus one diagnostic receipt')
    assert.equal(fx.replies[0][1], answer)
    assert.match(fx.replies[1][1], new RegExp(receiptNeedle))
    assert.ok(!fx.replies[1][1].includes(answer), 'diagnostic receipt never repeats the answer')
    assert.equal(fx.replies[1].length, 2, 'diagnostic receipt stays plain text without UX opts')
  })
}

test('V3 failure-receipt failure does not change the closed recovery projection', async () => {
  const deliveryError = Object.assign(new Error('ambiguous answer send'), { code: 'send_timeout' })
  const receiptError = new Error('receipt also failed')
  const fx = harness({
    turn: async () => ({ reply: 'answer', pid: 7, status: 'completed' }),
    reply: async (_target, _text, _opts, callNumber) => {
      if (callNumber === 1) throw deliveryError
      throw receiptError
    },
  })

  const result = await fx.delivery.onIngress(ingress)

  assert.deepEqual(Object.keys(result).sort(), RECOVERY_KEYS)
  assert.equal(result.replyDelivery, 'unknown')
  assert.equal(JSON.stringify(result).includes('answer'), false)
  assert.equal(JSON.stringify(result).includes('ambiguous answer send'), false)
  assert.equal(JSON.stringify(result).includes('receipt also failed'), false)
  assert.equal(fx.executions(), 1)
  assert.equal(fx.replies.length, 2)
})
