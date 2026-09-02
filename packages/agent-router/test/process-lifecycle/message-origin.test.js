/**
 * AGENT_CORE_AGENT_SESSION_MESSAGING_V1 — Router-side tests:
 *
 *   R4  deliver(req, { messageOrigin }) — exact-allowlist validation, frozen
 *       sidecar forwarded into the admission opts, legacy callers unchanged
 *   R4  the session/prompt payload carries messageOrigin as sibling metadata
 *   R3  the parent-RPC boundary proves the exact source turnExecutionId
 *       against the process execution map (present + unsettled), independent
 *       of activeIngressContext, and never trusts child-supplied identity
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createIngressDelivery } from '../../src/ingress-delivery.js'
import { turnExecutionMethods, TurnExecution } from '../../src/process/turn-execution.js'
import { createParentRpcHandler, BROKER_RPC_METHOD } from '../../src/parent-rpc-relay.js'

// ------------------------------------------------------ deliver (R4 sidecar)

function deliveryDeps({ routeChain }) {
  return {
    log: { log: () => {}, error: () => {} },
    feishu: undefined,
    workspaceBootstrap: { resolveWorkspace: () => '/tmp/ws-target', ensureWorkspace: async () => {} },
    store: { freshSessionFor: async () => { throw new Error('fresh not expected') } },
    reconciliationStore: { assertMintCapacity: () => {} },
    resolveAgentRef: (ref) => {
      if (ref === 'agt_unknown-target') {
        throw Object.assign(new Error('agent-definition: agent not found'), { code: 'AGENT_NOT_FOUND' })
      }
      return { id: ref }
    },
    resolveChannelConversation: async () => { throw new Error('not expected in deliver tests') },
    resolveEffectiveWorkspace: () => { throw new Error('not expected in deliver tests') },
    routeChain,
  }
}

const VALID_ORIGIN = { kind: 'inter_agent', sourceAgentId: 'agt_stock_agent', correlation: 'turn:1:a1:g1:s2' }

test('R4: deliver forwards a valid messageOrigin (frozen) into the admission opts', async () => {
  const admissions = []
  const router = createIngressDelivery(deliveryDeps({
    routeChain: { admitWithRouteChain: async (agentId, args) => { admissions.push({ agentId, args }); return { messageId: 'm1', reconciliationHandle: 'turn:ok' } } },
  }))
  const receipt = await router.deliver(
    { requestId: 'req-1', agentId: 'agt_b-target', sessionMode: 'main', message: 'hello' },
    { messageOrigin: VALID_ORIGIN },
  )
  assert.equal(receipt.accepted, true)
  assert.equal(admissions.length, 1)
  assert.equal(admissions[0].args.sessionId, 'main')
  assert.deepEqual(admissions[0].args.opts.messageOrigin, VALID_ORIGIN)
  assert.equal(Object.isFrozen(admissions[0].args.opts.messageOrigin), true, 'sidecar frozen (detached) before travel')
})

test('R4: legacy deliver callers keep zero messageOrigin in the admission opts', async () => {
  const admissions = []
  const router = createIngressDelivery(deliveryDeps({
    routeChain: { admitWithRouteChain: async (agentId, args) => { admissions.push(args); return { messageId: 'm1' } } },
  }))
  await router.deliver({ requestId: 'req-2', agentId: 'agt_b-target', sessionMode: 'main', message: 'legacy' })
  assert.equal(admissions[0].opts.messageOrigin, undefined)
  assert.deepEqual(admissions[0].opts.callerCorrelation, { requestId: 'req-2' })
})

test('R4: malformed control options and origins reject fail-loud before admission', async () => {
  const cases = [
    [{ messageOrigin: VALID_ORIGIN, extra: 1 }, 'unknown control field'],
    [{ messageOrigin: null }, 'null origin'],
    [{ messageOrigin: 'x' }, 'string origin'],
    [{ messageOrigin: { ...VALID_ORIGIN, extra: 1 } }, 'undeclared origin field'],
    [{ messageOrigin: { sourceAgentId: VALID_ORIGIN.sourceAgentId, correlation: VALID_ORIGIN.correlation } }, 'missing kind'],
    [{ messageOrigin: { ...VALID_ORIGIN, kind: 'user' } }, 'wrong kind'],
    [{ messageOrigin: { ...VALID_ORIGIN, sourceAgentId: 'forged' } }, 'bad source grammar'],
    [{ messageOrigin: { ...VALID_ORIGIN, correlation: '' } }, 'empty correlation'],
  ]
  for (const [controlOpts, label] of cases) {
    const admissions = []
    const router = createIngressDelivery(deliveryDeps({
      routeChain: { admitWithRouteChain: async (_id, args) => { admissions.push(args); return { messageId: 'm1' } } },
    }))
    await assert.rejects(
      () => router.deliver({ requestId: 'req-3', agentId: 'agt_b-target', sessionMode: 'main', message: 'x' }, controlOpts),
      TypeError,
      `${label} must reject`,
    )
    assert.equal(admissions.length, 0, `${label}: zero admissions`)
  }
})

// ------------------------------------------- session/prompt sibling (R4)

test('R4: promptWrite carries messageOrigin as session/prompt sibling metadata', async () => {
  const captured = []
  const execution = new TurnExecution({
    handle: 'turn:1:a1:g1:s3',
    sessionId: 'main',
    mode: 'deliver',
    watermarkSeq: 0,
    startMono: 0,
    deadlines: { promptReceiptTimeoutMs: 1000, turnTimeoutMs: 5000 },
    bindingContext: undefined,
  })
  execution.promptRequestId = 'req-1-1'
  const fakeSelf = {
    request: async (method, params) => {
      captured.push({ method, params })
      return { messageId: 'm9' }
    },
    store: { markPromptReceipt: () => {}, markPromptWriteAttempted: () => {} },
    replayExecutionFromWatermark: () => {},
  }
  await turnExecutionMethods.promptWrite.call(fakeSelf, execution, 'main', 'hello', { messageOrigin: VALID_ORIGIN })
  assert.equal(captured[0].method, 'session/prompt')
  assert.equal(captured[0].params.turnExecutionId, 'turn:1:a1:g1:s3')
  assert.deepEqual(captured[0].params.messageOrigin, VALID_ORIGIN)
})

test('R4: promptWrite omits messageOrigin for legacy callers', async () => {
  const captured = []
  const execution = new TurnExecution({
    handle: 'turn:1:a1:g1:s4',
    sessionId: 'main',
    mode: 'deliver',
    watermarkSeq: 0,
    startMono: 0,
    deadlines: { promptReceiptTimeoutMs: 1000, turnTimeoutMs: 5000 },
    bindingContext: undefined,
  })
  execution.promptRequestId = 'req-1-2'
  const fakeSelf = {
    request: async (method, params) => { captured.push(params); return { messageId: 'm9' } },
    store: { markPromptReceipt: () => {}, markPromptWriteAttempted: () => {} },
    replayExecutionFromWatermark: () => {},
  }
  await turnExecutionMethods.promptWrite.call(fakeSelf, execution, 'main', 'legacy', { cwd: '/tmp/x' })
  assert.equal('messageOrigin' in captured[0], false)
  assert.equal(captured[0].cwd, '/tmp/x')
})

// ------------------------------------- parent-RPC source-turn proof (R3)

function relayFixture({ executions = new Map(), activeIngressContext = undefined, processGeneration = 1 }) {
  const gatewayCalls = []
  const proc = { agentId: 'agt_a-caller', processGeneration, executions, activeIngressContext }
  const handler = createParentRpcHandler({
    agentId: 'agt_a-caller',
    log: { log: () => {}, error: () => {} },
    getProc: () => proc,
    getBrokerGateway: () => ({
      execute: async (call, ctx) => { gatewayCalls.push({ call, ctx }); return { ok: true, result: { ok: true, result: {} } } },
    }),
    switchAgent: async () => ({}),
  })
  return { handler, gatewayCalls, proc }
}

function unsettledExecution() { return { settled: false } }

test('R3: a deliver-originated source Run proves its turnExecutionId via the execution map', async () => {
  const { handler, gatewayCalls } = relayFixture({ executions: new Map([['turn:src', unsettledExecution()]]) })
  await handler(BROKER_RPC_METHOD, { capabilityId: 'agent_session_send', operation: 'send', args: {} }, { turnExecutionId: 'turn:src' })
  assert.equal(gatewayCalls[0].ctx.sourceTurnExecutionId, 'turn:src')
  assert.equal(gatewayCalls[0].ctx.ingressContext, undefined, 'deliver sources have no activeIngressContext')
})

test('R3: a settled or unknown turnExecutionId proves nothing (absent leaf)', async () => {
  const { handler, gatewayCalls } = relayFixture({
    executions: new Map([['turn:done', { settled: true }]]),
  })
  await handler(BROKER_RPC_METHOD, { capabilityId: 'x', operation: 'y', args: {} }, { turnExecutionId: 'turn:done' })
  assert.equal(gatewayCalls[0].ctx.sourceTurnExecutionId, undefined, 'settled executions prove nothing')

  await handler(BROKER_RPC_METHOD, { capabilityId: 'x', operation: 'y', args: {} }, { turnExecutionId: 'turn:forged' })
  assert.equal(gatewayCalls[1].ctx.sourceTurnExecutionId, undefined, 'executions absent from this process prove nothing')

  await handler(BROKER_RPC_METHOD, { capabilityId: 'x', operation: 'y', args: {} }, {})
  assert.equal(gatewayCalls[2].ctx.sourceTurnExecutionId, undefined, 'absent rpcMeta proves nothing')
})

test('R3: the ordinary turn-mode path keeps its trusted ingressContext binding AND the source leaf', async () => {
  const active = Object.freeze({
    callerAgentId: 'agt_a-caller',
    processGeneration: 1,
    turnExecutionId: 'turn:active',
    channelNamespace: 'feishu',
  })
  const { handler, gatewayCalls } = relayFixture({
    executions: new Map([['turn:active', unsettledExecution()]]),
    activeIngressContext: active,
  })
  await handler(BROKER_RPC_METHOD, { capabilityId: 'scheduler', operation: 'list', args: {} }, { turnExecutionId: 'turn:active' })
  assert.equal(gatewayCalls[0].ctx.ingressContext, active)
  assert.equal(gatewayCalls[0].ctx.sourceTurnExecutionId, 'turn:active')
})

test('R3: child-supplied identity fields stay ignored while the runtime proof is derived', async () => {
  const { handler, gatewayCalls } = relayFixture({ executions: new Map([['turn:real', unsettledExecution()]]) })
  await handler(BROKER_RPC_METHOD, {
    capabilityId: 'agent_session_send',
    operation: 'send',
    args: {},
    agentId: 'agt_forged-identity',
    turnExecutionId: 'turn:forged-claim',
    ingressContext: { channelNamespace: 'feishu', feishuChatId: 'stolen' },
  }, { turnExecutionId: 'turn:real' })
  assert.equal(gatewayCalls[0].ctx.agentId, 'agt_a-caller', 'identity is the actual proc agentId')
  assert.equal(gatewayCalls[0].ctx.sourceTurnExecutionId, 'turn:real', 'proof comes from the rpcMeta + execution map, not params')
  assert.equal(gatewayCalls[0].ctx.ingressContext, undefined, 'forged ingressContext is never bound')
})
