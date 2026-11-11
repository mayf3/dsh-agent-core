import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLateReplyDelivery } from '../../src/conversation/late-reply.js'
import { createDeliveryFailureStore } from '../../src/reconciliation/delivery-failures.js'
import { lateReplyId } from '../../src/reconciliation/late-reply-records.js'
import { createIngressDelivery } from '../../src/ingress-delivery.js'
import { replyTargetFor } from '../../../feishu-connector/src/core.js'

const HANDLE = 'turn:w2-test:a1:g1:s1'
const AGENT = 'agt_expert'
const ANSWER = '完整答案，包含中文和 https://private.invalid/answer'
const flush = () => new Promise(resolve => setImmediate(resolve))
const ingress = () => ({ channel: 'thread', conversationId: 'oc_chat:thread:omt_topic',
  chatId: 'oc_chat', threadId: 'omt_topic', rootMsgId: 'om_root', messageId: 'om_original',
  sender: { openId: 'ou_sender' }, text: 'private incoming prompt' })

function fixture(t, { send, output, snapshot = {} } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'w2-late-reply-'))
  const logs = []
  const log = { log: line => logs.push(line), error: line => logs.push(line) }
  const failures = createDeliveryFailureStore({ log, directory })
  const sends = []
  const listeners = new Set()
  let state = 'pending'
  const current = { initialOutcome: 'outcome_unknown', initialSource: 'caller_wait_exceeded',
    agentId: AGENT, sessionId: 'main', lateOutcome: null, outcomeEvidence: null, ...snapshot }
  let answer = output ?? { state: 'available', text: ANSWER, truncated: false,
    originalBytes: Buffer.byteLength(ANSWER) }
  const store = {
    assertMintCapacity() {},
    getTurnReconciliation(handle) {
      assert.equal(handle, HANDLE)
      return { state, snapshot: structuredClone(current) }
    },
    readFinalAssistantOutput(handle) { assert.equal(handle, HANDLE); return structuredClone(answer) },
    onTurnReconciled(listener) { listeners.add(listener); return () => listeners.delete(listener) },
  }
  const routeChain = { lateReplyRecords: failures.lateReplyRecords,
    recordLateReplyFailure: handle => failures.failure({ source: 'caller_wait_exceeded' },
      { reconciliationHandle: handle, stage: 'late_reply_record' }) }
  const feishu = { replyTargetFor, async reply(...args) {
    sends.push(args)
    return send ? send(...args) : { messageId: 'om_late_receipt' }
  } }
  const consumers = []
  const mount = () => {
    const consumer = createLateReplyDelivery({ reconciliationStore: store, routeChain, feishu, log })
    consumers.push(consumer)
    return consumer
  }
  const consumer = mount()
  const target = consumer.capture(ingress())
  const context = { agentId: AGENT, sessionId: 'main', target }
  const watch = (entry = consumer, overrides = {}) => entry.watch({ reconciliationHandle: HANDLE },
    { ...context, ...overrides })
  const settle = (fields = {}) => {
    state = 'settled'
    Object.assign(current, { lateOutcome: 'late_completed', outcomeEvidence: 'exact_turn_end_success' }, fields)
    for (const listener of listeners) listener({ handle: HANDLE, ...current })
  }
  const id = lateReplyId(HANDLE)
  const record = () => failures.get(id)
  t.after(() => { for (const entry of consumers) entry.dispose(); rmSync(directory, { recursive: true, force: true }) })
  return { directory, log, logs, failures, sends, store, routeChain, feishu, consumer, target,
    context, watch, settle, id, record, mount, listeners, current,
    setOutput(value) { answer = value },
    serialized: () => readFileSync(join(directory, `${id}.json`), 'utf8') }
}

test('W2 exact late success replies once to the original topic with the marker and a durable claim', async t => {
  let fx
  fx = fixture(t, { send: async target => {
    assert.equal(fx.record().disposition, 'late_reply_attempted', 'claim reaches disk before external IO')
    assert.deepEqual(target, fx.target)
    return { messageId: 'om_sent' }
  } })
  fx.watch()
  fx.settle()
  const settled = JSON.stringify(fx.current)
  await flush()
  assert.equal(fx.sends.length, 1)
  assert.equal(fx.sends[0][1], `${ANSWER}\n\n（补投）`)
  assert.equal(fx.sends[0][0].replyMsgId, 'om_original')
  assert.equal(fx.sends[0][0].replyInThread, true)
  assert.equal(fx.sends[0][0].threadId, 'omt_topic')
  assert.deepEqual(fx.sends[0][2], { ux: { rendering: 'markdown', autoMentionTriggerSender: true } })
  assert.equal(fx.record().disposition, 'late_reply_delivered')
  assert.deepEqual(fx.record().receipt, { messageId: 'om_sent' })
  assert.equal(fx.serialized().includes(ANSWER), false, 'durable disposition stores no answer body')
  assert.equal(fx.serialized().includes('private incoming prompt'), false)
  assert.equal(statSync(join(fx.directory, `${fx.id}.json`)).mode & 0o777, 0o600)
  assert.equal(JSON.stringify(fx.current), settled, 'delivery does not rewrite reconciliation')
  assert.equal(fx.failures.snapshot().counts.caller_bound_exceeded, 0)
})

test('W2 unavailable destination is queryable and increments structured CTR-R5 exactly once', async t => {
  const fx = fixture(t)
  fx.watch(fx.consumer, { target: null })
  fx.settle()
  await flush()
  assert.equal(fx.sends.length, 0)
  assert.equal(fx.record().disposition, 'late_reply_dead_letter')
  assert.equal(fx.record().reason, 'destination_unavailable')
  assert.equal(fx.record().reconciliationHandle, HANDLE)
  assert.equal(fx.failures.snapshot().counts.caller_bound_exceeded, 1)
  assert.equal(fx.failures.snapshot().recent[0].deadLetterId, fx.id)
  assert.equal(fx.failures.snapshot().recent[0].stage, 'late_reply')
  assert.ok(fx.logs.some(line => line.startsWith('delivery-failure ')))
  fx.watch()
  fx.settle()
  await flush()
  assert.equal(fx.failures.snapshot().counts.caller_bound_exceeded, 1)
})

for (const fields of [
  { lateOutcome: 'late_failed', outcomeEvidence: 'exact_turn_end_failure' },
  { lateOutcome: 'terminated_without_outcome', outcomeEvidence: null },
  { lateOutcome: 'late_completed', outcomeEvidence: null },
  { lateOutcome: 'late_completed', outcomeEvidence: 'exact_terminal_then_idle' },
]) {
  test(`W2 does not deliver non-exact success: ${fields.lateOutcome}/${fields.outcomeEvidence}`, async t => {
    const fx = fixture(t)
    fx.watch()
    fx.settle(fields)
    const before = JSON.stringify(fx.current)
    await flush()
    assert.equal(fx.sends.length, 0)
    assert.equal(fx.record().disposition, 'late_reply_not_eligible')
    assert.equal(fx.failures.snapshot().counts.caller_bound_exceeded, 0)
    assert.equal(JSON.stringify(fx.current), before)
  })
}

test('W2 pending UNKNOWN remains pending with no reply or failure inference', async t => {
  const fx = fixture(t)
  const before = JSON.stringify(fx.current)
  fx.watch()
  await flush()
  assert.equal(fx.record().disposition, 'late_reply_pending')
  assert.equal(fx.sends.length, 0)
  assert.equal(fx.failures.snapshot().counts.caller_bound_exceeded, 0)
  assert.equal(JSON.stringify(fx.current), before)
})

test('W2 ignores hard-deadline and wrong-owner handles', async t => {
  const fx = fixture(t, { snapshot: { initialSource: 'turn_deadline_exceeded' } })
  fx.watch()
  fx.settle()
  await flush()
  assert.equal(fx.sends.length, 0)
  assert.deepEqual(readdirSync(fx.directory), [])
  fx.current.initialSource = 'caller_wait_exceeded'
  fx.watch(fx.consumer, { agentId: 'agt_foreign' })
  fx.watch(fx.consumer, { sessionId: 'other-session' })
  await flush()
  assert.deepEqual(readdirSync(fx.directory), [])
})

test('W2 readback closes settlement-before-timeout-registration race', async t => {
  const fx = fixture(t)
  fx.settle()
  fx.watch()
  await flush()
  assert.equal(fx.sends.length, 1)
  assert.equal(fx.record().disposition, 'late_reply_delivered')
})

test('W2 duplicate notification, registration and restart never repeat a delivered answer', async t => {
  const fx = fixture(t)
  fx.watch()
  fx.watch()
  fx.settle()
  fx.settle()
  fx.watch()
  await flush()
  fx.consumer.dispose()
  const restarted = fx.mount()
  fx.watch(restarted)
  fx.settle()
  await flush()
  assert.equal(fx.sends.length, 1)
  assert.equal(fx.record().disposition, 'late_reply_delivered')
})

for (const [output, reason] of [
  [{ state: 'no_output' }, 'output_no_output'],
  [{ state: 'available', text: '', originalBytes: 0, truncated: false }, 'output_empty'],
  [{ state: 'available', text: '尾部片段', originalBytes: 2000000, truncated: true }, 'output_truncated'],
]) {
  test(`W2 ${reason} is retained and counted without sending a partial answer`, async t => {
    const fx = fixture(t, { output })
    fx.watch()
    fx.settle()
    await flush()
    assert.equal(fx.sends.length, 0)
    assert.equal(fx.record().reason, reason)
    assert.equal(fx.record().disposition, 'late_reply_dead_letter')
    assert.equal(fx.failures.snapshot().counts.caller_bound_exceeded, 1)
    assert.equal(Object.hasOwn(fx.record().output, 'text'), false)
  })
}

for (const code of ['target_revoked', 'send_timeout']) {
  test(`W2 ${code} produces one dead letter and no automatic reply retry`, async t => {
    const fx = fixture(t, { send: async () => { throw Object.assign(new Error('injected'), { code }) } })
    fx.watch()
    fx.settle()
    await flush()
    fx.watch()
    fx.settle()
    await flush()
    assert.equal(fx.sends.length, 1)
    assert.equal(fx.record().disposition, 'late_reply_dead_letter')
    assert.equal(fx.record().reason, 'reply_delivery_failed_or_unknown')
    assert.equal(fx.failures.snapshot().counts.caller_bound_exceeded, 1)
    assert.equal(fx.serialized().includes(ANSWER), false)
  })
}

test('W2 restart with a consumed send claim records uncertain delivery and never sends again', async t => {
  const fx = fixture(t)
  fx.watch()
  assert.equal(fx.failures.lateReplyRecords.claim(fx.id), true)
  fx.consumer.dispose()
  fx.settle()
  const restarted = fx.mount()
  fx.watch(restarted)
  await flush()
  assert.equal(fx.sends.length, 0)
  assert.equal(fx.record().reason, 'delivery_outcome_unknown_after_restart')
  assert.equal(fx.failures.snapshot().counts.caller_bound_exceeded, 1)
})

test('W2 restart pending registration handles missing RAM body through the original handle', async t => {
  const fx = fixture(t)
  fx.watch()
  fx.consumer.dispose()
  fx.settle()
  fx.setOutput({ state: 'no_output', terminalState: 'late_completed' })
  fx.mount()
  await flush()
  assert.equal(fx.sends.length, 0)
  assert.equal(fx.record().reason, 'output_no_output')
  assert.equal(fx.record().target.replyMsgId, 'om_original')
  assert.equal(fx.failures.snapshot().counts.caller_bound_exceeded, 1)
})

test('W2 valid pending recovery survives an unrelated damaged CTR-R3 dead letter', async t => {
  const fx = fixture(t)
  fx.watch()
  fx.consumer.dispose()
  fx.settle()
  const damagedId = '00000000-0000-0000-0000-000000000000'
  const damagedPath = join(fx.directory, `${damagedId}.json`)
  writeFileSync(damagedPath, '{', { mode: 0o600 })
  fx.mount()
  await flush()
  assert.equal(fx.sends.length, 1, 'unrelated damaged record cannot suppress a valid pending reply')
  assert.equal(fx.record().disposition, 'late_reply_delivered')
  assert.equal(readFileSync(damagedPath, 'utf8'), '{', 'recovery preserves the damaged artifact')
  assert.ok(fx.failures.snapshot().recent.some(row => row.deadLetterId === damagedId),
    'the isolated record failure carries its exact durable id in CTR-R5')
  assert.ok(fx.logs.some(line => line.includes(damagedId)), 'damage remains visible in structured logs')
})

test('W2 captures original reply target before caller-owned ingress can change', async t => {
  const fx = fixture(t)
  const original = ingress()
  const target = fx.consumer.capture(original)
  original.chatId = 'oc_elsewhere'
  original.messageId = 'om_elsewhere'
  original.threadId = 'omt_elsewhere'
  original.sender.openId = 'ou_elsewhere'
  fx.watch(fx.consumer, { target })
  fx.settle()
  await flush()
  assert.equal(fx.sends[0][0].chatId, 'oc_chat')
  assert.equal(fx.sends[0][0].replyMsgId, 'om_original')
  assert.equal(fx.sends[0][0].threadId, 'omt_topic')
  assert.equal(fx.sends[0][0].triggerSenderOpenId, 'ou_sender')
})

test('W2 ingress timeout is followed by a marked late reply without a second turn', async t => {
  const fx = fixture(t)
  fx.consumer.dispose()
  let turns = 0
  fx.routeChain.runTurnWithRouteChain = async () => {
    turns += 1
    return { status: 'outcome_unknown', reconciliationHandle: HANDLE }
  }
  const delivery = createIngressDelivery({ log: fx.log, feishu: fx.feishu,
    reconciliationStore: fx.store, routeChain: fx.routeChain, store: {},
    workspaceBootstrap: { async ensureWorkspace() {} },
    async resolveChannelConversation() { return { channelConversation: { id: 'feishu:oc_chat' },
      binding: { activeAgentId: AGENT, activeSessionId: 'main' } } },
    resolveEffectiveWorkspace() { return { workspaceId: null, workspacePath: '/tmp/expert' } },
  })
  t.after(() => delivery.dispose())
  const result = await delivery.onIngress(ingress())
  assert.equal(result.reconciliationHandle, HANDLE)
  assert.equal(fx.sends.length, 1, 'existing timeout receipt')
  fx.settle()
  await flush()
  assert.equal(turns, 1)
  assert.equal(fx.sends.length, 2)
  assert.match(fx.sends[1][1], /（补投）/u)
  assert.equal(fx.sends[1][0].replyMsgId, 'om_original')
  assert.equal(fx.record().disposition, 'late_reply_delivered')
})

for (const rejectedAt of ['route_chain', 'admission_precheck']) {
  test(`W2 ${rejectedAt} fence rejection never binds the new ingress to an old turn`, async t => {
    const fx = fixture(t)
    fx.consumer.dispose()
    let turns = 0
    fx.routeChain.runTurnWithRouteChain = async () => {
      turns += 1
      throw Object.assign(new Error('older unknown turn still fenced'), {
        code: 'AGENT_PROCESS_TURN_FENCED', status: 'not_admitted',
        fencedBy: HANDLE, reconciliationHandle: HANDLE,
      })
    }
    if (rejectedAt === 'admission_precheck') fx.store.activeFenceForAgent = () => ({ handle: HANDLE })
    const delivery = createIngressDelivery({ log: fx.log, feishu: fx.feishu,
      reconciliationStore: fx.store, routeChain: fx.routeChain, store: {},
      workspaceBootstrap: { async ensureWorkspace() {} },
      async resolveChannelConversation() { return { channelConversation: { id: 'feishu:oc_chat' },
        binding: { activeAgentId: AGENT, activeSessionId: 'main' } } },
      resolveEffectiveWorkspace() { return { workspaceId: null, workspacePath: '/tmp/expert' } },
    })
    t.after(() => delivery.dispose())
    const result = await delivery.onIngress(ingress())
    assert.equal(result.failureStage, 'admission')
    assert.equal(result.requestAdmission, 'not_admitted')
    assert.equal(result.fencedBy, HANDLE)
    assert.equal(fx.sends.length, 1, 'only the normal admission failure receipt')
    fx.settle()
    await flush()
    assert.equal(turns, rejectedAt === 'route_chain' ? 1 : 0)
    assert.equal(fx.sends.length, 1, 'old successful settlement cannot reply to the rejected ingress')
    assert.deepEqual(readdirSync(fx.directory), [], 'no late delivery registration for an unadmitted request')
    assert.equal(fx.failures.snapshot().counts.caller_bound_exceeded, 0)
  })
}
