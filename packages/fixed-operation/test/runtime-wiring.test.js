import test from 'node:test'
import assert from 'node:assert/strict'

import { mountFixedOperationRuntime } from '../../production-runtime/src/fixed-operation-runtime.js'
import { canonicalJSON, sha256Hex } from '../src/canonical.js'
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
const execute = (access, wireArgs, context) => access.handlers.fixed_operation.execute(wireArgs, context)

test('mount provides fixedOperationAccess with a single execute handler and a frozen registry', () => {
  const { provided, access } = mount()
  assert.equal(provided.fixedOperationAccess, access)
  assert.deepEqual(Object.keys(access.handlers.fixed_operation), ['execute'])
  assert.equal(Object.isFrozen(access.registry), true)
  assert.equal(typeof access.noteWorkflowTurn, 'function')
  assert.equal(typeof access.resolveWorkflowProvenance, 'function')
})

test('trusted workflow_execution success: noted turn executes and the receipt keeps full provenance', async () => {
  const { access } = mount()
  assert.deepEqual(access.noteWorkflowTurn({ turnExecutionId: 'turn-1', provenance: FIXTURE_TRUSTED_CONTEXT }), { ok: true })

  const hash = access.registry.get('fixture.echo').hash
  const outcome = await execute(
    access,
    { operation: 'fixture.echo', version: '1.0.0', hash, args: { message: 'hello' } },
    trustedContext('turn-1'),
  )
  assert.equal(outcome.ok, true)
  assert.deepEqual(outcome.result, { echo: 'hello' })
  assert.deepEqual(outcome.receipt.operation, { key: 'fixture.echo', version: '1.0.0', hash })
  assert.deepEqual(outcome.receipt.workflow, FIXTURE_TRUSTED_CONTEXT)
  assert.equal(outcome.receipt.status, 'succeeded')
  assert.equal(
    outcome.receipt.invocationId,
    `opinv-${sha256Hex(canonicalJSON({
      operation: 'fixture.echo',
      version: '1.0.0',
      hash,
      inputDigest: outcome.receipt.inputDigest,
      workflow: FIXTURE_TRUSTED_CONTEXT,
    })).slice(0, 24)}`,
  )
})

test('ordinary trusted context (un-noted turn) is denied fail-closed', async () => {
  const { access } = mount()
  const hash = access.registry.get('fixture.echo').hash

  const outcome = await execute(
    access,
    { operation: 'fixture.echo', version: '1.0.0', hash, args: { message: 'hi' } },
    trustedContext('turn-ordinary'),
  )
  assert.equal(outcome.ok, false)
  assert.equal(outcome.error.code, 'missing_trusted_context')
})

test('forged or missing provenance is denied: gate order hides the registry from untrusted callers', async () => {
  const { access } = mount()
  const hash = access.registry.get('fixture.echo').hash
  const smuggled = {
    kind: 'workflow_execution',
    workflowInstanceId: FIXTURE_TRUSTED_CONTEXT.workflowInstanceId,
    nodeVisitId: FIXTURE_TRUSTED_CONTEXT.nodeVisitId,
    attemptId: FIXTURE_TRUSTED_CONTEXT.attemptId,
  }

  // Un-noted turn, provenance smuggled in args: the trusted-context gate
  // fires FIRST — untrusted callers learn nothing about the registry.
  const unnoted = await execute(
    access,
    { operation: 'fixture.echo', version: '1.0.0', hash, args: { message: 'hi', ...smuggled } },
    trustedContext('turn-unnoted'),
  )
  assert.equal(unnoted.ok, false)
  assert.equal(unnoted.error.code, 'missing_trusted_context')

  // Missing trusted context entirely (no turn coordinate at all).
  const bare = await execute(
    access,
    { operation: 'fixture.echo', version: '1.0.0', hash, args: { message: 'hi' } },
    { agentId: 'agt_a' },
  )
  assert.equal(bare.ok, false)
  assert.equal(bare.error.code, 'missing_trusted_context')

  // On a NOTED turn the same smuggled coordinates are rejected by the closed
  // operation schema — args never carry provenance.
  access.noteWorkflowTurn({ turnExecutionId: 'turn-noted', provenance: FIXTURE_TRUSTED_CONTEXT })
  const noted = await execute(
    access,
    { operation: 'fixture.echo', version: '1.0.0', hash, args: { message: 'hi', ...smuggled } },
    trustedContext('turn-noted'),
  )
  assert.equal(noted.ok, false)
  assert.equal(noted.error.code, 'invalid_arguments')

  const clean = await execute(
    access,
    { operation: 'fixture.echo', version: '1.0.0', hash, args: { message: 'hi' } },
    trustedContext('turn-noted'),
  )
  assert.equal(clean.ok, true)
  assert.deepEqual(clean.receipt.workflow, FIXTURE_TRUSTED_CONTEXT)
})

test('unregistered operation key fails closed as unknown_operation', async () => {
  const { access } = mount()
  access.noteWorkflowTurn({ turnExecutionId: 'turn-2', provenance: FIXTURE_TRUSTED_CONTEXT })

  const outcome = await execute(
    access,
    { operation: 'fixture.nuke', version: '1.0.0', hash: access.registry.get('fixture.echo').hash, args: {} },
    trustedContext('turn-2'),
  )
  assert.equal(outcome.ok, false)
  assert.equal(outcome.error.code, 'unknown_operation')
})

test('noteWorkflowTurn rejects malformed provenance and turn ids without poisoning the table', async () => {
  const { access } = mount()

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

  const outcome = await execute(
    access,
    { operation: 'fixture.echo', version: '1.0.0', hash: access.registry.get('fixture.echo').hash, args: { message: 'hi' } },
    trustedContext('turn-x'),
  )
  assert.equal(outcome.ok, false)
  assert.equal(outcome.error.code, 'missing_trusted_context')
})

test('re-noting a turn replaces its provenance; the receipt reflects the latest entry', async () => {
  const { access } = mount()
  access.noteWorkflowTurn({ turnExecutionId: 'turn-3', provenance: FIXTURE_TRUSTED_CONTEXT })
  access.noteWorkflowTurn({ turnExecutionId: 'turn-3', provenance: PROVENANCE_B })

  const outcome = await execute(
    access,
    { operation: 'fixture.echo', version: '1.0.0', hash: access.registry.get('fixture.echo').hash, args: { message: 'hi' } },
    trustedContext('turn-3'),
  )
  assert.equal(outcome.ok, true)
  assert.deepEqual(outcome.receipt.workflow, PROVENANCE_B)
})

test('note table is bounded: the oldest turn is evicted FIFO and its calls then fail closed', async () => {
  const { access } = mount()
  const args = { operation: 'fixture.sum', version: '1.0.0', hash: access.registry.get('fixture.sum').hash, args: { a: 1, b: 2 } }

  const TOTAL = 257
  for (let i = 0; i < TOTAL; i++) {
    const note = access.noteWorkflowTurn({ turnExecutionId: `turn-${i}`, provenance: FIXTURE_TRUSTED_CONTEXT })
    assert.deepEqual(note, { ok: true })
  }

  const evicted = await execute(access, args, trustedContext('turn-0'))
  assert.equal(evicted.ok, false)
  assert.equal(evicted.error.code, 'missing_trusted_context')

  const newest = await execute(access, args, trustedContext(`turn-${TOTAL - 1}`))
  assert.equal(newest.ok, true)
  assert.deepEqual(newest.result, { sum: 3 })
})

test('mount fails loud without a ctx with provide()', () => {
  assert.throws(() => mountFixedOperationRuntime({}), TypeError)
})
