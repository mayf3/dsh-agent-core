import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createIngressDelivery } from '../../src/ingress-delivery.js'
import { createLateReplyDelivery } from '../../src/conversation/late-reply.js'
import { createDeliveryFailureStore } from '../../src/reconciliation/delivery-failures.js'
import { lateReplyId } from '../../src/reconciliation/late-reply-records.js'
import { replyTargetFor } from '../../../feishu-connector/src/core.js'

const HANDLE = 'turn:w3-test:a1:g1:s1'
const AGENT = 'agt_expert'
const ANSWER = '结算后的完整答案'
const flush = () => new Promise(resolve => setImmediate(resolve))
const unknownText = text => /未证实/u.test(text)
const entry = () => ({ channel: 'thread', chatId: 'oc_original',
  conversationId: 'oc_original:thread:omt_original', threadId: 'omt_original',
  rootMsgId: 'om_root', messageId: 'om_original', sender: { openId: 'ou_sender' }, text: '用户问题' })
const unknownError = fields => Object.assign(new Error('exact turn result unavailable'), {
  code: 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN', reconciliationHandle: HANDLE,
  status: 'outcome_unknown', envelope: 'outcome_unknown', ...fields,
})

function fixture(t, { source = 'caller_wait_exceeded', send, execute, mount = true } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'w3-unknown-ingress-'))
  const sends = []
  const logs = []
  const listeners = new Set()
  const consumers = []
  const log = { log: line => logs.push(line), error: line => logs.push(line) }
  const failures = createDeliveryFailureStore({ directory, log })
  let state = 'pending'
  let turns = 0
  const snapshot = { initialOutcome: 'outcome_unknown', initialSource: source,
    agentId: AGENT, sessionId: 'main', lateOutcome: null, outcomeEvidence: null }
  const store = {
    assertMintCapacity() {},
    getTurnReconciliation(handle) {
      assert.equal(handle, HANDLE)
      return { state, snapshot: structuredClone(snapshot) }
    },
    readFinalAssistantOutput(handle) {
      assert.equal(handle, HANDLE)
      return { state: 'available', text: ANSWER, truncated: false, originalBytes: Buffer.byteLength(ANSWER) }
    },
    onTurnReconciled(listener) { listeners.add(listener); return () => listeners.delete(listener) },
  }
  const routeChain = { lateReplyRecords: failures.lateReplyRecords,
    async runTurnWithRouteChain(...args) {
      turns += 1
      if (execute) return execute(...args)
      throw unknownError()
    } }
  const feishu = { replyTargetFor, async reply(...args) {
    sends.push(args)
    return send ? send(...args) : { messageId: 'om_receipt' }
  } }
  const mountDelivery = () => {
    const delivery = createIngressDelivery({ log, feishu, reconciliationStore: store,
      routeChain, store: {}, workspaceBootstrap: { async ensureWorkspace() {} },
      async resolveChannelConversation() {
        return { channelConversation: { id: 'feishu:oc_original' },
          binding: { activeAgentId: AGENT, activeSessionId: 'main' } }
      },
      resolveEffectiveWorkspace() { return { workspaceId: null, workspacePath: '/tmp/expert' } },
    })
    consumers.push(delivery)
    return delivery
  }
  const settle = () => {
    state = 'settled'
    Object.assign(snapshot, { lateOutcome: 'late_completed', outcomeEvidence: 'exact_turn_end_success' })
    for (const listener of listeners) listener({ handle: HANDLE, ...snapshot })
  }
  const mountConsumer = () => {
    const consumer = createLateReplyDelivery({ reconciliationStore: store, routeChain, feishu, log })
    consumers.push(consumer)
    return consumer
  }
  t.after(() => {
    for (const consumer of consumers) consumer.dispose()
    rmSync(directory, { recursive: true, force: true })
  })
  return { delivery: mount ? mountDelivery() : null, mountDelivery, mountConsumer, sends,
    logs, directory, snapshot, store, routeChain, feishu, settle,
    record: () => failures.get(lateReplyId(HANDLE)), turns: () => turns,
    notices: () => sends.filter(([, text]) => unknownText(text)) }
}

for (const [shape, source] of [
  ['returned_envelope', 'caller_wait_exceeded'],
  ['rejected_carrier', 'caller_wait_exceeded'],
  ['code_only_child_exit', 'child_exit_without_parsed_outcome'],
]) {
  test(`W3 ${shape} notifies the original topic with all three user-facing elements`, async t => {
    const fx = fixture(t, { source, execute: async () => {
      if (shape === 'returned_envelope') return { status: 'outcome_unknown', reconciliationHandle: HANDLE }
      if (shape === 'code_only_child_exit') throw unknownError({ status: undefined, envelope: undefined })
      throw unknownError()
    } })
    const before = structuredClone(fx.snapshot)
    const result = await fx.delivery.onIngress(entry())
    assert.equal(result.reconciliationHandle, HANDLE)
    assert.equal(result.failureStage, 'execution')
    assert.equal(result.requestAdmission, 'accepted')
    assert.equal(fx.sends.length, 1)
    assert.equal(fx.notices().length, 1)
    const [target, text] = fx.sends[0]
    assert.match(text, /未证实/u)
    assert.match(text, /稍后随结算补投/u)
    assert.match(text, /请重发/u)
    assert.doesNotMatch(text, /重新执行|重跑|已完成/u)
    assert.equal(target.replyMsgId, 'om_original')
    assert.equal(target.receiveId, 'oc_original')
    assert.equal(target.threadId, 'omt_original')
    assert.equal(target.replyInThread, true)
    assert.deepEqual(fx.snapshot, before, 'visibility cannot settle or rewrite the unknown turn')
    assert.equal(fx.turns(), 1, 'notification never reruns the business turn')
  })
}

test('W3 FAILED retains the ordinary failure receipt and never emits the UNKNOWN notice', async t => {
  const error = Object.assign(new Error('proven provider failure'), { code: 'PROVIDER_FAILED', status: 'failed', envelope: 'failed' })
  const fx = fixture(t, { execute: async () => { throw error } })
  const before = structuredClone(fx.snapshot)
  const result = await fx.delivery.onIngress(entry())
  assert.equal(result.error, error)
  assert.equal(fx.sends.length, 1)
  assert.match(fx.sends[0][1], /delivery failed: proven provider failure/u)
  assert.equal(fx.notices().length, 0)
  assert.deepEqual(fx.snapshot, before)
  assert.deepEqual(readdirSync(fx.directory), [], 'failed turns cannot register a late-success consumer')
})

test('W3 a rejected new request fenced by an old UNKNOWN does not receive this notice', async t => {
  const fx = fixture(t, { execute: async () => {
    throw Object.assign(new Error('old turn still fenced'), { code: 'AGENT_PROCESS_TURN_FENCED',
      status: 'not_admitted', envelope: 'not_admitted', reconciliationHandle: HANDLE, fencedBy: HANDLE })
  } })
  const result = await fx.delivery.onIngress(entry())
  assert.equal(result.requestAdmission, 'not_admitted')
  assert.equal(fx.notices().length, 0)
  assert.deepEqual(readdirSync(fx.directory), [])
})

test('W3 an undelivered notice preserves UNKNOWN and W2 can still redeliver exact success', async t => {
  const fx = fixture(t, { send: async (_target, text) => {
    if (unknownText(text)) throw new Error('notice transport unavailable')
    return { messageId: 'om_late_receipt' }
  } })
  const before = structuredClone(fx.snapshot)
  const result = await fx.delivery.onIngress(entry())
  assert.equal(result.reconciliationHandle, HANDLE)
  assert.deepEqual(fx.snapshot, before)
  assert.equal(fx.record().disposition, 'late_reply_pending')
  fx.settle()
  await flush()
  assert.equal(fx.sends.length, 2)
  assert.equal(fx.sends[1][1], `${ANSWER}\n\n（补投）`)
  assert.equal(fx.record().disposition, 'late_reply_delivered')
  assert.equal(fx.turns(), 1)
})

test('W3 notice is followed by W2 once, without another UNKNOWN notice or business turn', async t => {
  const fx = fixture(t)
  await fx.delivery.onIngress(entry())
  fx.settle()
  await flush()
  fx.settle()
  await flush()
  assert.equal(fx.sends.length, 2)
  assert.equal(fx.notices().length, 1)
  assert.equal(fx.sends[1][1], `${ANSWER}\n\n（补投）`)
  assert.equal(fx.sends[1][0].replyMsgId, fx.sends[0][0].replyMsgId)
  assert.equal(fx.record().disposition, 'late_reply_delivered')
  assert.equal(fx.turns(), 1)
})

test('W3 settlement before the caller catch suppresses a stale UNKNOWN notice while W2 sends', async t => {
  let finishSend
  const fx = fixture(t, { send: (_target, text) => {
    assert.match(text, /（补投）/u)
    return new Promise(resolve => { finishSend = resolve })
  } })
  fx.settle()
  const before = structuredClone(fx.snapshot)
  const result = await fx.delivery.onIngress(entry())
  assert.equal(result.reconciliationHandle, HANDLE)
  assert.equal(fx.sends.length, 1)
  assert.equal(fx.notices().length, 0)
  assert.equal(fx.record().disposition, 'late_reply_attempted')
  assert.deepEqual(fx.snapshot, before)
  finishSend({ messageId: 'om_late_receipt' })
  await flush()
  fx.settle()
  await flush()
  assert.equal(fx.record().disposition, 'late_reply_delivered')
  assert.equal(fx.sends.length, 1)
  assert.equal(fx.turns(), 1)
})

test('W3 an already-delivered W2 answer suppresses a delayed UNKNOWN failure receipt', async t => {
  const fx = fixture(t, { mount: false })
  const consumer = fx.mountConsumer()
  fx.settle()
  consumer.watch(unknownError(), { agentId: AGENT, sessionId: 'main', target: consumer.capture(entry()) })
  await flush()
  assert.equal(fx.record().disposition, 'late_reply_delivered')
  consumer.dispose()
  const delivery = fx.mountDelivery()
  await delivery.onIngress(entry())
  assert.equal(fx.sends.length, 1)
  assert.equal(fx.notices().length, 0)
  assert.match(fx.sends[0][1], /（补投）/u)
  assert.equal(fx.turns(), 1)
})

test('W3 uses the captured original topic even if ingress data changes while awaiting the turn', async t => {
  const ingress = entry()
  const fx = fixture(t, { source: 'child_exit_without_parsed_outcome', execute: async () => {
    ingress.chatId = 'oc_changed'
    ingress.messageId = 'om_changed'
    ingress.threadId = 'omt_changed'
    ingress.sender.openId = 'ou_changed'
    throw unknownError()
  } })
  await fx.delivery.onIngress(ingress)
  assert.equal(fx.notices().length, 1)
  assert.equal(fx.sends[0][0].receiveId, 'oc_original')
  assert.equal(fx.sends[0][0].replyMsgId, 'om_original')
  assert.equal(fx.sends[0][0].threadId, 'omt_original')
  assert.equal(fx.sends[0][0].triggerSenderOpenId, 'ou_sender')
})

test('W3 non-Feishu ingress keeps the structured UNKNOWN result without a Feishu send', async t => {
  const fx = fixture(t)
  const ingress = { ...entry(), channel: 'mobile' }
  const before = structuredClone(fx.snapshot)
  const result = await fx.delivery.onIngress(ingress)
  assert.equal(result.reconciliationHandle, HANDLE)
  assert.equal(result.requestAdmission, 'accepted')
  fx.settle()
  await flush()
  assert.equal(fx.sends.length, 0)
  assert.equal(fx.turns(), 1)
  assert.equal(before.initialOutcome, fx.snapshot.initialOutcome)
  assert.deepEqual(readdirSync(fx.directory), [])
})
