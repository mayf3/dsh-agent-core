/**
 * FIXED_OPERATION_V1 — the minimal vertical slice tests.
 *
 * Proves the whole chain on the pure test fixture (test.echo_summary):
 *   register -> (unknown key | version/hash drift | invalid params |
 *   missing trusted context all fail closed) -> execute -> structured
 *   receipt, with every provenance field server-derived.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  FIXED_OPERATION_CONTRACT_ID,
  FIXED_OPERATION_RECEIPT_VERSION,
  FORBIDDEN_INPUT_KEYS,
  canonicalJson,
  createFixedOperationRegistry,
  createFixedOperationInvoker,
  createFixedOperationAccess,
  inputDigestOf,
  invocationIdOf,
  operationHashOf,
} from '../src/fixed-operation/index.js'
import { fixedOperationManifest } from '../../broker/src/capabilities/fixed-operation.js'
import { validateInvocation } from '../../broker/src/mapping.js'

const WORKFLOW_INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const NODE_VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const ATTEMPT = 'wfeat-aaaaaaaaaaaaaaaaaaaaaaaa'
const AGENT = 'agt_workflow-agent'

/** The pure deterministic V1 test operation fixture. */
const ECHO_SUMMARY = {
  operationKey: 'test.echo_summary',
  version: '1',
  description: 'Deterministic fixture: echoes the input text with derived counts.',
  inputSchema: {
    type: 'object',
    required: ['text'],
    properties: {
      text: { type: 'string', maxLength: 64 },
      times: { type: 'integer' },
      tags: { type: 'array', items: { type: 'string' } },
    },
  },
  execute: async ({ input, context }) => ({
    echoed: input.text,
    length: input.text.length,
    repeated: input.times ?? 1,
    tagCount: Array.isArray(input.tags) ? input.tags.length : 0,
    seenAttempt: context.attemptId,
  }),
}

function trustedContext(overrides = {}) {
  return {
    agentId: AGENT,
    callerAgentId: AGENT,
    workflowExecutionContext: {
      kind: 'workflow_execution',
      workflowInstanceId: WORKFLOW_INSTANCE,
      nodeVisitId: NODE_VISIT,
      attemptId: ATTEMPT,
    },
    ...overrides,
  }
}

function request(overrides = {}) {
  return {
    operation_key: ECHO_SUMMARY.operationKey,
    expected_version: ECHO_SUMMARY.version,
    expected_hash: '0'.repeat(64),
    input: { text: 'hello workflow' },
    ...overrides,
  }
}

function setup({ handler = ECHO_SUMMARY.execute, clock = () => 0 } = {}) {
  const registry = createFixedOperationRegistry()
  const entry = registry.register({ ...ECHO_SUMMARY, ...(handler === undefined ? {} : { execute: handler }) })
  const invoker = createFixedOperationInvoker({ registry, clock })
  return { registry, entry, invoker, pinned: request({ expected_hash: entry.hash }) }
}

// ── success: register -> validate -> execute -> receipt ────────────────────

test('success chain: registered fixture executes once and answers a complete structured receipt', async () => {
  const { entry, invoker, pinned } = setup()
  const outcome = await invoker({ trustedContext: trustedContext(), request: pinned })
  assert.equal(outcome.ok, true)
  const receipt = outcome.receipt
  assert.equal(receipt.receiptVersion, FIXED_OPERATION_RECEIPT_VERSION)
  assert.equal(receipt.operationKey, 'test.echo_summary')
  assert.equal(receipt.version, '1')
  assert.equal(receipt.operationHash, entry.hash)
  assert.deepEqual(receipt.workflow, { workflowInstanceId: WORKFLOW_INSTANCE, nodeVisitId: NODE_VISIT, attemptId: ATTEMPT })
  assert.deepEqual(receipt.agent, { agentId: AGENT })
  assert.equal(receipt.startedAtMs, 0)
  assert.equal(receipt.finishedAtMs, 0)
  assert.equal(receipt.status, 'succeeded')
  assert.deepEqual(receipt.result, { echoed: 'hello workflow', length: 14, repeated: 1, tagCount: 0, seenAttempt: ATTEMPT })
  assert.equal(receipt.error, undefined)
  // Digests and ids are exactly the contract formulas.
  const digest = inputDigestOf({ text: 'hello workflow' })
  assert.equal(receipt.inputDigest, digest)
  assert.equal(receipt.invocationId, invocationIdOf({
    operationKey: 'test.echo_summary', version: '1', agentId: AGENT,
    workflow: receipt.workflow, inputDigest: digest,
  }))
  assert.equal(Object.isFrozen(receipt), true, 'receipt is frozen')
})

test('invocationId is stable for the same contract/coordinates/input and distinct otherwise', async () => {
  const { invoker, pinned } = setup()
  const first = await invoker({ trustedContext: trustedContext(), request: pinned })
  const again = await invoker({ trustedContext: trustedContext(), request: pinned })
  assert.equal(first.receipt.invocationId, again.receipt.invocationId)

  const otherInput = await invoker({ trustedContext: trustedContext(), request: { ...pinned, input: { text: 'different' } } })
  assert.notEqual(otherInput.receipt.invocationId, first.receipt.invocationId)

  const otherAttempt = await invoker({
    trustedContext: trustedContext({
      workflowExecutionContext: {
        kind: 'workflow_execution',
        workflowInstanceId: WORKFLOW_INSTANCE,
        nodeVisitId: NODE_VISIT,
        attemptId: 'wfeat-bbbbbbbbbbbbbbbbbbbbbbbb',
      },
    }),
    request: pinned,
  })
  assert.notEqual(otherAttempt.receipt.invocationId, first.receipt.invocationId)
})

test('operation hash pins the exact contract bytes (key-order independent)', () => {
  assert.equal(
    operationHashOf({ operationKey: 'op', version: '1', inputSchema: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } } } }),
    operationHashOf({ operationKey: 'op', version: '1', inputSchema: { type: 'object', properties: { b: { type: 'string' }, a: { type: 'string' } } } }),
  )
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}')
})

// ── fail closed: unknown operation / version / hash drift ──────────────────

test('unknown operation key fails closed before the handler runs', async () => {
  let executions = 0
  const { invoker, pinned } = setup({ handler: () => { executions += 1 } })
  const outcome = await invoker({ trustedContext: trustedContext(), request: { ...pinned, operation_key: 'test.never_registered' } })
  assert.deepEqual(outcome, { ok: false, error: { code: 'unknown_operation', detail: 'no registered fixed operation test.never_registered@1' } })
  assert.equal(executions, 0)
})

test('unregistered version and drifted hash each fail closed before the handler runs', async () => {
  let executions = 0
  const { invoker, pinned } = setup({ handler: () => { executions += 1 } })
  const wrongVersion = await invoker({ trustedContext: trustedContext(), request: { ...pinned, expected_version: '2' } })
  assert.equal(wrongVersion.ok, false)
  assert.equal(wrongVersion.error.code, 'unknown_operation')

  const flipped = pinned.expected_hash.startsWith('0') ? `1${pinned.expected_hash.slice(1)}` : `0${pinned.expected_hash.slice(1)}`
  const wrongHash = await invoker({ trustedContext: trustedContext(), request: { ...pinned, expected_hash: flipped } })
  assert.equal(wrongHash.ok, false)
  assert.equal(wrongHash.error.code, 'operation_hash_mismatch')
  assert.equal(executions, 0)
})

// ── fail closed: invalid parameters ────────────────────────────────────────

test('malformed request objects fail closed as invalid_arguments', async () => {
  const { invoker, pinned } = setup()
  const cases = [
    await invoker({ trustedContext: trustedContext(), request: null }),
    await invoker({ trustedContext: trustedContext(), request: { ...pinned, smuggled: true } }),
    await invoker({ trustedContext: trustedContext(), request: { ...pinned, operation_key: undefined } }),
    await invoker({ trustedContext: trustedContext(), request: { ...pinned, expected_version: undefined } }),
    await invoker({ trustedContext: trustedContext(), request: { ...pinned, expected_hash: 'deadbeef' } }),
  ]
  for (const outcome of cases) {
    assert.equal(outcome.ok, false)
    assert.equal(outcome.error.code, 'invalid_arguments')
  }
})

test('input is validated against the REGISTERED schema and fails closed as invalid_input', async () => {
  const { invoker, pinned } = setup()
  const cases = [
    { text: undefined },
    { text: 42 },
    {},
    { text: 'ok', undeclared: 'rejected' },
    { text: 'x'.repeat(65) },
    { text: 'ok', times: 1.5 },
    { text: 'ok', tags: ['a', 3] },
  ]
  for (const input of cases) {
    const outcome = await invoker({ trustedContext: trustedContext(), request: { ...pinned, input } })
    assert.equal(outcome.ok, false, `expected rejection for ${JSON.stringify(input)}`)
    assert.equal(outcome.error.code, 'invalid_input')
    assert.match(outcome.error.detail, /registered schema/)
  }
})

// ── fail closed: trusted context requirements ──────────────────────────────

test('missing or forged trusted caller fails closed', async () => {
  const { invoker, pinned } = setup()
  for (const context of [undefined, {}, { agentId: '' }, { agentId: AGENT, callerAgentId: 'agt_other' }]) {
    const outcome = await invoker({ trustedContext: context, request: pinned })
    assert.equal(outcome.ok, false)
    assert.equal(outcome.error.code, 'trusted_caller_required')
  }
})

test('missing, malformed, or forged workflow execution context fails closed', async () => {
  const { invoker, pinned } = setup()
  const forged = [
    undefined,
    null,
    'wfeat-self-reported',
    {},
    { kind: 'workflow_execution', workflowInstanceId: WORKFLOW_INSTANCE, nodeVisitId: NODE_VISIT },
    { kind: 'workflow_execution', workflowInstanceId: 'not-a-uuid', nodeVisitId: NODE_VISIT, attemptId: ATTEMPT },
    { kind: 'workflow_execution', workflowInstanceId: WORKFLOW_INSTANCE, nodeVisitId: NODE_VISIT, attemptId: 'run-123' },
    { kind: 'user', workflowInstanceId: WORKFLOW_INSTANCE, nodeVisitId: NODE_VISIT, attemptId: ATTEMPT },
    { kind: 'inter_agent', sourceAgentId: AGENT, correlation: 'x' },
  ]
  for (const workflowExecutionContext of forged) {
    const outcome = await invoker({ trustedContext: trustedContext({ workflowExecutionContext }), request: pinned })
    assert.equal(outcome.ok, false)
    assert.equal(outcome.error.code, 'trusted_workflow_context_required')
  }
})

// ── receipt provenance: coordinates are server-derived, never input ────────

test('receipt provenance: prompt cannot declare or influence execution coordinates', async () => {
  const { invoker, pinned } = setup()
  // Attempt 1: smuggle coordinates through the input — the exact-allowlist
  // schema rejects every undeclared key, coordinate keys included.
  const smuggled = await invoker({
    trustedContext: trustedContext(),
    request: { ...pinned, input: { text: 'hi', workflowInstanceId: '00000000-0000-4000-8000-000000000000' } },
  })
  assert.equal(smuggled.ok, false)
  assert.equal(smuggled.error.code, 'invalid_input')

  // Attempt 2: the request schema itself has NO coordinate field anywhere —
  // a request-level key fails closed as invalid_arguments.
  const requestLevel = await invoker({
    trustedContext: trustedContext(),
    request: { ...pinned, workflowInstanceId: WORKFLOW_INSTANCE, nodeVisitId: NODE_VISIT, attemptId: ATTEMPT },
  })
  assert.equal(requestLevel.ok, false)
  assert.equal(requestLevel.error.code, 'invalid_arguments')

  // The receipt carries exactly the TRUSTED coordinates — distinguishable
  // from anything the input could have claimed.
  const receipt = (await invoker({
    trustedContext: trustedContext(),
    request: { ...pinned, input: { text: 'claim-anything' } },
  })).receipt
  assert.deepEqual(receipt.workflow, { workflowInstanceId: WORKFLOW_INSTANCE, nodeVisitId: NODE_VISIT, attemptId: ATTEMPT })
})

test('the handler receives only validated input and the frozen server-derived context', async () => {
  let seen
  const { invoker, pinned } = setup({
    handler: async (invocation) => { seen = invocation; return { done: true } },
  })
  const outcome = await invoker({ trustedContext: trustedContext(), request: { ...pinned, input: { text: 'ctx', times: 2 } } })
  assert.equal(outcome.ok, true)
  assert.deepEqual(Object.keys(seen).sort(), ['context', 'input'])
  assert.deepEqual(seen.input, { text: 'ctx', times: 2 })
  assert.equal(Object.isFrozen(seen.input), true)
  assert.equal(seen.context.agentId, AGENT)
  assert.equal(seen.context.attemptId, ATTEMPT)
  assert.equal(seen.context.contractId, FIXED_OPERATION_CONTRACT_ID)
  assert.equal(Object.isFrozen(seen.context), true)
})

// ── execution failure is a receipt, not a crash ────────────────────────────

test('a failing handler still yields a receipt with status failed', async () => {
  const { invoker, pinned } = setup({
    handler: async () => { throw new Error('the downstream system refused: ' + 'x'.repeat(400)) },
  })
  const outcome = await invoker({ trustedContext: trustedContext(), request: pinned })
  assert.equal(outcome.ok, true)
  assert.equal(outcome.receipt.status, 'failed')
  assert.equal(outcome.receipt.result, undefined)
  assert.ok(outcome.receipt.error.message.startsWith('the downstream system refused:'))
  assert.ok(outcome.receipt.error.message.length <= 200, 'error detail is capped')
  assert.equal(outcome.receipt.workflow.attemptId, ATTEMPT)
})

// ── registry immutability ──────────────────────────────────────────────────

test('registry is immutable: duplicate registration throws, entries are frozen, no code surface exists', () => {
  const registry = createFixedOperationRegistry()
  const entry = registry.register(ECHO_SUMMARY)
  assert.throws(() => registry.register({ ...ECHO_SUMMARY, execute: async () => ({ pwned: true }) }), /already registered/)
  assert.equal(Object.isFrozen(entry), true)
  assert.equal(entry.hash, operationHashOf({ operationKey: ECHO_SUMMARY.operationKey, version: ECHO_SUMMARY.version, inputSchema: ECHO_SUMMARY.inputSchema }))
  // A NEW version of the same key is a new immutable entry (the old pin stays valid).
  registry.register({ ...ECHO_SUMMARY, version: '2', inputSchema: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, extra: { type: 'string' } } } })
  assert.equal(registry.resolve(ECHO_SUMMARY.operationKey, '1').hash, entry.hash)
  assert.deepEqual(registry.describe().map((row) => row.version), ['1', '2'])
})

test('operations can never declare execution/identity input properties', () => {
  for (const key of [...FORBIDDEN_INPUT_KEYS]) {
    const registry = createFixedOperationRegistry()
    assert.throws(
      () => registry.register({ ...ECHO_SUMMARY, inputSchema: { type: 'object', properties: { [key]: { type: 'string' } } } }),
      /forbidden/,
      `expected property "${key}" to be rejected`,
    )
  }
})

// ── capability face + wire manifest ────────────────────────────────────────

test('capability envelope: success is the receipt, denials are broker error envelopes', async () => {
  const { registry, pinned } = setup()
  const access = createFixedOperationAccess({ registry, clock: () => 0 })
  const handler = access.handlers.workflow_fixed_ops.invoke

  const success = await handler({ ...pinned }, trustedContext())
  assert.equal(success.ok, true)
  assert.equal(success.result.status, 'succeeded')

  const denial = await handler({ ...pinned, operation_key: 'test.missing' }, trustedContext())
  assert.deepEqual(denial, { ok: false, error: { code: 'unknown_operation', detail: 'no registered fixed operation test.missing@1' } })

  const noContext = await handler({ ...pinned }, { agentId: AGENT })
  assert.equal(noContext.ok, false)
  assert.equal(noContext.error.code, 'trusted_workflow_context_required')
})

test('wire manifest: exact-allowlist rejects smuggled identity/coordinate/script fields before the handler', () => {
  const base = {
    operation_key: 'test.echo_summary',
    expected_version: '1',
    expected_hash: '0'.repeat(64),
    input: { text: 'hi' },
  }
  const valid = validateInvocation(fixedOperationManifest, { operation: 'invoke', args: base })
  assert.equal(valid.ok, true)

  for (const smuggled of [
    { ...base, script_path: '/etc/passwd' },
    { ...base, shell: 'rm -rf /' },
    { ...base, workflowInstanceId: WORKFLOW_INSTANCE },
    { ...base, attemptId: ATTEMPT },
    { ...base, agentId: 'agt_other' },
  ]) {
    const rejected = validateInvocation(fixedOperationManifest, { operation: 'invoke', args: smuggled })
    assert.equal(rejected.ok, false, `expected wire rejection for ${JSON.stringify(Object.keys(smuggled))}`)
  }

  // The wire schema deliberately cannot enumerate every operation's input
  // shape, so a smuggled input KEY passes the wire and is rejected one layer
  // down by the REGISTERED schema (layered defense — covered above).
  const nestedSmuggle = validateInvocation(fixedOperationManifest, { operation: 'invoke', args: { ...base, input: { text: 'hi', scriptPath: '/x' } } })
  assert.equal(nestedSmuggle.ok, true)
})
