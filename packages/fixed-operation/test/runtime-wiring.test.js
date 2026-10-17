import test from 'node:test'
import assert from 'node:assert/strict'

import { mountFixedOperationRuntime } from '../../production-runtime/src/fixed-operation-runtime.js'
import { FIXTURE_TRUSTED_CONTEXT } from '../src/fixtures.js'

/** A second, equally valid workflow_execution provenance for re-note tests. */
const PROVENANCE_B = Object.freeze({
  kind: 'workflow_execution',
  workflowInstanceId: 'd4e5f6a7-0000-4000-8000-000000000005',
  nodeVisitId: 'e5f6a7b8-0000-4000-8000-000000000006',
  attemptId: `wfeat-${'d'.repeat(24)}`,
})

function mount() {
  const provided = {}
  const access = mountFixedOperationRuntime({ ctx: { provide: (key, value) => { provided[key] = value } } })
  return { provided, access }
}

const trustedContext = (turnExecutionId) => ({ agentId: 'agt_a', callerAgentId: 'agt_a', turnExecutionId })

test('mount provides fixedOperationAccess with both wire handlers and a frozen registry', () => {
  const { provided, access } = mount()
  assert.equal(provided.fixedOperationAccess, access)
  assert.deepEqual(Object.keys(access.handlers.fixed_operation), ['fixture_echo', 'fixture_sum'])
  assert.equal(Object.isFrozen(access.registry), true)
  assert.equal(typeof access.noteWorkflowTurn, 'function')
  assert.equal(typeof access.resolveWorkflowProvenance, 'function')
})

test('runtime-noted turn: handler succeeds and the receipt carries the noted provenance', async () => {
  const { access } = mount()
  assert.deepEqual(access.noteWorkflowTurn({ turnExecutionId: 'turn-1', provenance: FIXTURE_TRUSTED_CONTEXT }), { ok: true })

  const hash = access.registry.get('fixture.echo').hash
  const outcome = await access.handlers.fixed_operation.fixture_echo(
    { version: '1.0.0', hash, message: 'hello' },
    trustedContext('turn-1'),
  )
  assert.equal(outcome.ok, true)
  assert.deepEqual(outcome.result, { echo: 'hello' })
  assert.deepEqual(outcome.receipt.workflow, FIXTURE_TRUSTED_CONTEXT)
})

test('gateway-shaped nested ingressContext resolves; nested/flat disagreement fails closed', async () => {
  const { access } = mount()
  access.noteWorkflowTurn({ turnExecutionId: 'turn-nested', provenance: FIXTURE_TRUSTED_CONTEXT })
  const hash = access.registry.get('fixture.echo').hash
  const args = { version: '1.0.0', hash, message: 'hi' }

  const nested = await access.handlers.fixed_operation.fixture_echo(
    args,
    { agentId: 'agt_a', ingressContext: { turnExecutionId: 'turn-nested' } },
  )
  assert.equal(nested.ok, true)

  const disagree = await access.handlers.fixed_operation.fixture_echo(
    args,
    { agentId: 'agt_a', turnExecutionId: 'turn-nested', ingressContext: { turnExecutionId: 'turn-other' } },
  )
  assert.equal(disagree.ok, false)
  assert.equal(disagree.error.code, 'missing_trusted_context')
})

test('ordinary session (un-noted turn) fails closed; args-supplied provenance is rejected, never honored', async () => {
  const { access } = mount()
  const hash = access.registry.get('fixture.echo').hash

  // Gate order: the trusted-context gate precedes argument validation, so an
  // un-noted turn reports missing_trusted_context even when smuggling
  // coordinate fields — untrusted callers learn nothing about the registry.
  const smuggleArgs = {
    version: '1.0.0', hash, message: 'hi',
    kind: 'workflow_execution',
    workflowInstanceId: FIXTURE_TRUSTED_CONTEXT.workflowInstanceId,
    nodeVisitId: FIXTURE_TRUSTED_CONTEXT.nodeVisitId,
    attemptId: FIXTURE_TRUSTED_CONTEXT.attemptId,
  }
  const ordinary = await access.handlers.fixed_operation.fixture_echo(smuggleArgs, trustedContext('turn-ordinary'))
  assert.equal(ordinary.ok, false)
  assert.equal(ordinary.error.code, 'missing_trusted_context')

  // On a NOTED (trusted) turn the same smuggled coordinates are rejected by
  // the closed argument schema — args never carry provenance.
  access.noteWorkflowTurn({ turnExecutionId: 'turn-noted', provenance: FIXTURE_TRUSTED_CONTEXT })
  const forged = await access.handlers.fixed_operation.fixture_echo(smuggleArgs, trustedContext('turn-noted'))
  assert.equal(forged.ok, false)
  assert.equal(forged.error.code, 'invalid_arguments')

  const clean = await access.handlers.fixed_operation.fixture_echo(
    { version: '1.0.0', hash, message: 'hi' },
    trustedContext('turn-noted'),
  )
  assert.equal(clean.ok, true)
  assert.deepEqual(clean.receipt.workflow, FIXTURE_TRUSTED_CONTEXT)
})

test('noteWorkflowTurn rejects malformed provenance and malformed turn ids without poisoning the table', async () => {
  const { access } = mount()
  const hash = access.registry.get('fixture.echo').hash

  for (const [turnExecutionId, provenance] of [
    ['', FIXTURE_TRUSTED_CONTEXT],
    [undefined, FIXTURE_TRUSTED_CONTEXT],
    ['turn-x', undefined],
    ['turn-x', null],
    ['turn-x', { kind: 'inter_agent', sourceAgentId: 'agt_x', correlation: 'c' }],
    ['turn-x', { kind: 'workflow_execution', workflowInstanceId: 'nope', nodeVisitId: FIXTURE_TRUSTED_CONTEXT.nodeVisitId, attemptId: FIXTURE_TRUSTED_CONTEXT.attemptId }],
  ]) {
    const result = access.noteWorkflowTurn({ turnExecutionId, provenance })
    assert.equal(result.ok, false, `note(${JSON.stringify(turnExecutionId)}, ${JSON.stringify(provenance)}) must fail`)
    assert.ok(result.code === 'invalid_turn' || result.code === 'missing_trusted_context')
  }

  // The table is untouched: a turn that was never validly noted denies.
  const outcome = await access.handlers.fixed_operation.fixture_echo(
    { version: '1.0.0', hash, message: 'hi' },
    trustedContext('turn-x'),
  )
  assert.equal(outcome.ok, false)
  assert.equal(outcome.error.code, 'missing_trusted_context')
})

test('re-noting a turn replaces its provenance; the receipt reflects the latest entry', async () => {
  const { access } = mount()
  access.noteWorkflowTurn({ turnExecutionId: 'turn-2', provenance: FIXTURE_TRUSTED_CONTEXT })
  access.noteWorkflowTurn({ turnExecutionId: 'turn-2', provenance: PROVENANCE_B })

  const outcome = await access.handlers.fixed_operation.fixture_echo(
    { version: '1.0.0', hash: access.registry.get('fixture.echo').hash, message: 'hi' },
    trustedContext('turn-2'),
  )
  assert.equal(outcome.ok, true)
  assert.deepEqual(outcome.receipt.workflow, PROVENANCE_B)
})

test('note table is bounded: the oldest turn is evicted FIFO and its calls then fail closed', async () => {
  const { access } = mount()
  const hash = access.registry.get('fixture.sum').hash
  const args = { version: '1.0.0', hash, a: 1, b: 2 }

  const TOTAL = 257
  for (let i = 0; i < TOTAL; i++) {
    const note = access.noteWorkflowTurn({ turnExecutionId: `turn-${i}`, provenance: FIXTURE_TRUSTED_CONTEXT })
    assert.deepEqual(note, { ok: true })
  }

  const evicted = await access.handlers.fixed_operation.fixture_sum(args, trustedContext('turn-0'))
  assert.equal(evicted.ok, false)
  assert.equal(evicted.error.code, 'missing_trusted_context')

  const newest = await access.handlers.fixed_operation.fixture_sum(args, trustedContext(`turn-${TOTAL - 1}`))
  assert.equal(newest.ok, true)
  assert.deepEqual(newest.result, { sum: 3 })
})

test('mount fails loud without a ctx with provide()', () => {
  assert.throws(() => mountFixedOperationRuntime({}), TypeError)
})
