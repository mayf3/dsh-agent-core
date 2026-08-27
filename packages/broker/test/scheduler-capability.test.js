import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { manifest as calculatorManifest, handlers as calculatorHandlers } from '../src/calculator.manifest.js'
import { schedulerManifest, schedulerManifests } from '../src/capabilities/scheduler.js'
import { createBrokerGateway } from '../src/gateway.js'
import { assertValidManifest } from '../src/mapping.js'
import { createRelayHandlers } from '../src/relay.js'
import { buildToolDefinition } from '../src/registry.js'

const ACTIONS = ['create', 'list', 'runs', 'update', 'enable', 'disable', 'remove']
const LEGACY_TOOL_NAMES = ACTIONS.map((action) => `scheduler_${action}`)

const trustedContext = (overrides = {}) => ({
  agentId: 'agt_a',
  callerAgentId: 'agt_a',
  processGeneration: 7,
  turnExecutionId: 'turn-11',
  channelNamespace: 'feishu',
  channelConversationId: 'feishu:thread:topic-9',
  feishuChatId: 'oc_exact_chat',
  feishuConversationId: 'oc_exact_chat:topic-9',
  feishuMessageId: 'om_message',
  ...overrides,
})

const routerGatewayContext = (ingressOverrides = {}, rootOverrides = {}) => {
  const { agentId, ...ingressContext } = trustedContext(ingressOverrides)
  return { agentId, ingressContext, ...rootOverrides }
}

const validCalls = {
  create: { action: 'create', name: 'daily', schedule_kind: 'every', every_ms: 60_000, message: 'work' },
  list: { action: 'list' },
  runs: { action: 'runs', job_id: 'job-1', limit: 5 },
  update: { action: 'update', job_id: 'job-1', message: 'new work' },
  enable: { action: 'enable', job_id: 'job-1' },
  disable: { action: 'disable', job_id: 'job-1' },
  remove: { action: 'remove', job_id: 'job-1' },
}

function schedulerDefinition(requestFn = async (call) => ({ ok: true, result: { ok: true, result: call } })) {
  return buildToolDefinition({
    manifest: schedulerManifest,
    handlers: createRelayHandlers(schedulerManifest, requestFn),
  }).definition
}

test('one model-visible scheduler manifest declares action and exactly seven actions', () => {
  assert.equal(schedulerManifests.length, 1)
  const manifest = assertValidManifest(schedulerManifests[0])
  assert.equal(manifest.id, 'scheduler')
  assert.equal(manifest.toolName, 'scheduler')
  assert.equal(manifest.selector, 'action')
  assert.deepEqual(manifest.operations.map((operation) => operation.name), ACTIONS)
  assert.equal(manifest.local.resource, 'scheduler')
  assert.equal(manifest.requiredScopes.length, 0)
  assert.equal(manifest.operations.every((operation) => operation.http === undefined), true)

  const names = schedulerManifests.map((candidate) => candidate.toolName)
  assert.deepEqual(names, ['scheduler'])
  for (const legacy of LEGACY_TOOL_NAMES) assert.equal(names.includes(legacy), false)
})

test('selector compatibility: scheduler exposes action; existing manifests retain operation', () => {
  const scheduler = schedulerDefinition()
  assert.deepEqual(scheduler.parameters.action.enum, ACTIONS)
  assert.equal(scheduler.parameters.action.required, true)
  assert.equal(scheduler.parameters.operation, undefined)
  assert.equal(scheduler.parameters.destination.additionalProperties, false)
  assert.equal(scheduler.parameters.destination.required, undefined)
  assert.equal(scheduler.parameters.destination.properties.channel.required, true)
  assert.equal(scheduler.parameters.destination.properties.to.required, true)
  // Bounds are authoritative Broker validation, not unsupported defineTool DSL keys.
  assert.equal(scheduler.parameters.limit.minimum, undefined)
  assert.equal(scheduler.parameters.limit.maximum, undefined)
  assert.equal(scheduler.parameters.name.minLength, undefined)

  const calculator = buildToolDefinition({ manifest: calculatorManifest, handlers: calculatorHandlers }).definition
  assert.deepEqual(calculator.parameters.operation.enum, ['add', 'subtract', 'multiply', 'divide'])
  assert.equal(calculator.parameters.operation.required, true)
  assert.equal(calculator.parameters.action, undefined)
  assert.equal(assertValidManifest(calculatorManifest).selector, 'operation')
})

test('all seven valid actions relay locally and action is removed from business args', async () => {
  const calls = []
  const definition = schedulerDefinition(async (call) => {
    calls.push(call)
    return { ok: true, result: { ok: true, result: { selected: call.operation } } }
  })

  for (const action of ACTIONS) {
    const out = await definition.execute(validCalls[action])
    assert.deepEqual(out, { ok: true, result: { selected: action } })
  }
  assert.deepEqual(calls.map((call) => call.operation), ACTIONS)
  assert.equal(calls.every((call) => call.capabilityId === 'scheduler'), true)
  assert.equal(calls.every((call) => !Object.hasOwn(call.args, 'action')), true)
  assert.deepEqual(calls[0].args, { name: 'daily', schedule_kind: 'every', every_ms: 60_000, message: 'work' })
})

test('closed action validation rejects unknown, cross-action, nested, and identity fields before relay', async () => {
  let relayCalls = 0
  const definition = schedulerDefinition(async () => {
    relayCalls += 1
    return { ok: true, result: { ok: true, result: {} } }
  })
  const invalid = [
    { action: 'list', surprise: true },
    { action: 'list', job_id: 'cross-action' },
    { ...validCalls.create, destination: { channel: 'feishu', to: 'chat:x', extra: 'nested' }, delivery_mode: 'announce' },
    { ...validCalls.create, callerAgentId: 'agt_forged' },
    { ...validCalls.create, caller_agent_id: 'agt_forged' },
    { ...validCalls.create, agentId: 'agt_forged' },
    { ...validCalls.create, agent_id: 'agt_forged' },
    { ...validCalls.create, channel: 'feishu' },
    { ...validCalls.create, to: 'chat:forged' },
    { ...validCalls.create, chatId: 'oc_forged' },
    { ...validCalls.create, session: 'main' },
    { ...validCalls.create, operation: 'create' },
    { ...validCalls.create, reconcile: true },
  ]
  for (const args of invalid) {
    const out = await definition.execute(args)
    assert.equal(out.ok, false, JSON.stringify(args))
    assert.equal(out.error.code, 'invalid_arguments', JSON.stringify(args))
  }
  const unknownAction = await definition.execute({ action: 'reconcile' })
  assert.deepEqual(unknownAction, { ok: false, error: { code: 'unsupported_operation' } })
  assert.equal(relayCalls, 0)
})

test('exact schedule, delivery, update, bounds, and non-empty conditionals fail before relay', async () => {
  let relayCalls = 0
  const definition = schedulerDefinition(async () => {
    relayCalls += 1
    return { ok: true, result: { ok: true, result: {} } }
  })
  const invalid = [
    { action: 'create', name: 'x', schedule_kind: 'cron', cron_expr: '* * * * * *', timezone: 'UTC', message: 'm' },
    { action: 'create', name: 'x', schedule_kind: 'cron', cron_expr: '* * * * *', message: 'm' },
    { action: 'create', name: 'x', schedule_kind: 'at', at: '1h', timezone: 'UTC', message: 'm' },
    { action: 'create', name: 'x', schedule_kind: 'every', every_ms: 0, message: 'm' },
    { action: 'create', name: ' ', schedule_kind: 'every', every_ms: 1, message: 'm' },
    { action: 'create', name: 'x', schedule_kind: 'every', every_ms: 1, message: 'm', delivery_mode: 'announce' },
    { action: 'create', name: 'x', schedule_kind: 'every', every_ms: 1, message: 'm', delivery_mode: 'announce', delivery_target: 'current_conversation', destination: { channel: 'x', to: 'y' } },
    { action: 'create', name: 'x', schedule_kind: 'every', every_ms: 1, message: 'm', delivery_mode: 'none', best_effort: true },
    { action: 'update', job_id: 'job-1' },
    { action: 'update', job_id: 'job-1', cron_expr: '* * * * *' },
    { action: 'update', job_id: 'job-1', delivery_target: 'current_conversation' },
    { action: 'runs', limit: 101 },
  ]
  for (const args of invalid) {
    const out = await definition.execute(args)
    assert.equal(out.ok, false, JSON.stringify(args))
    assert.equal(out.error.code, 'invalid_arguments', JSON.stringify(args))
  }
  assert.equal(relayCalls, 0)
})

async function gatewayRig(t, handlers) {
  const dir = await mkdtemp(join(tmpdir(), 'scheduler-broker-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const credentialsFile = join(dir, 'credentials.json')
  await writeFile(credentialsFile, JSON.stringify({
    version: 1,
    credentials: { agt_a: { clientId: 'client-a', clientSecret: 'secret-a' } },
  }))
  return createBrokerGateway({
    manifests: schedulerManifests,
    targets: [],
    authServiceOrigin: 'http://127.0.0.1:1',
    credentialsFile,
    localHandlers: handlers,
  })
}

test('gateway repeats authoritative validation before credential or local handler access', async () => {
  let handlerCalls = 0
  const gateway = createBrokerGateway({
    manifests: schedulerManifests,
    targets: [],
    authServiceOrigin: 'http://127.0.0.1:1',
    credentialsFile: '/definitely/not/read',
    localHandlers: { scheduler: { list: async () => { handlerCalls += 1 } } },
  })
  const out = await gateway.execute(
    { capabilityId: 'scheduler', operation: 'list', args: { callerAgentId: 'forged' } },
    trustedContext(),
  )
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'invalid_arguments')
  assert.equal(handlerCalls, 0)
})

test('gateway maps unified actions and flattens Router ingress context for local handlers', async (t) => {
  const seen = []
  const gateway = await gatewayRig(t, {
    scheduler: {
      create: async (args, context) => {
        seen.push({ args, context, frozen: Object.isFrozen(context) })
        return { ok: true, result: { jobId: 'job-1', deliveryTarget: args.delivery_target, chatId: context.feishuChatId } }
      },
    },
  })
  const out = await gateway.execute({
    capabilityId: 'scheduler',
    operation: 'create',
    args: {
      name: ' room reminder ', schedule_kind: 'every', every_ms: 60_000, message: ' ping ',
      delivery_mode: 'announce', delivery_target: 'current_conversation',
    },
  }, routerGatewayContext())

  assert.equal(out.ok, true)
  assert.deepEqual(out.result, { jobId: 'job-1', deliveryTarget: 'current_conversation', chatId: 'oc_exact_chat' })
  assert.deepEqual(seen[0].args, {
    name: 'room reminder', schedule_kind: 'every', every_ms: 60_000, message: 'ping',
    delivery_mode: 'announce', delivery_target: 'current_conversation',
  })
  assert.equal(seen[0].frozen, true)
  assert.deepEqual(seen[0].context, trustedContext())
  assert.equal(Object.hasOwn(seen[0].context, 'ingressContext'), false)
  assert.equal(Object.hasOwn(seen[0].args, 'callerAgentId'), false)
})

test('gateway rejects missing/mismatched trusted identity and turn context before handlers', async (t) => {
  let handlerCalls = 0
  const gateway = await gatewayRig(t, {
    scheduler: { list: async () => { handlerCalls += 1; return { ok: true, result: {} } } },
  })
  const contexts = [
    { agentId: 'agt_a' },
    trustedContext({ callerAgentId: 'agt_other' }),
    trustedContext({ processGeneration: '7' }),
    trustedContext({ turnExecutionId: '' }),
    routerGatewayContext({ callerAgentId: 'agt_other' }),
    routerGatewayContext({}, { callerAgentId: 'agt_other' }),
    { agentId: 'agt_a', ingressContext: 'forged-flat-string' },
  ]
  for (const context of contexts) {
    const out = await gateway.execute({ capabilityId: 'scheduler', operation: 'list', args: {} }, context)
    assert.equal(out.ok, false)
    assert.equal(out.error.code, 'invalid_arguments')
  }
  assert.equal(handlerCalls, 0)
})
