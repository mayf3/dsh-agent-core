/**
 * WORKFLOW_AGENT_EXECUTION_V1 — the new trusted `workflow_execution`
 * messageOrigin shape on the Router deliver seam:
 *
 *   - valid provenance is frozen and forwarded into the admission opts
 *   - the exact-id admission gate applies to it (TOCTOU wrong-target family)
 *   - malformed provenance rejects fail-loud before any admission
 *   - unknown kinds stay rejected (only inter_agent | workflow_execution)
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createIngressDelivery } from '../../src/ingress-delivery.js'

const UUID_A = '6f9619ff-8b86-d011-b42d-00c04fc964ff'
const UUID_B = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const VALID_WORKFLOW_ORIGIN = {
  kind: 'workflow_execution',
  workflowInstanceId: UUID_A,
  nodeVisitId: UUID_B,
  attemptId: `wfeat-${'a'.repeat(24)}`,
}

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
    resolveAgentById: (id) => {
      if (id === 'agt_unknown-target') {
        throw Object.assign(new Error('agent-definition: agent not found'), { code: 'AGENT_NOT_FOUND' })
      }
      return { id, disabled: false }
    },
    resolveChannelConversation: async () => { throw new Error('not expected in deliver tests') },
    resolveEffectiveWorkspace: () => { throw new Error('not expected in deliver tests') },
    routeChain,
  }
}

test('workflow_execution origin: valid provenance is frozen and forwarded into the admission opts', async () => {
  const admissions = []
  const router = createIngressDelivery(deliveryDeps({
    routeChain: { admitWithRouteChain: async (agentId, args) => { admissions.push({ agentId, args }); return { messageId: 'm1', reconciliationHandle: 'turn:ok' } } },
  }))
  const receipt = await router.deliver(
    { requestId: 'wfeat-test', agentId: 'agt_b-target', sessionMode: 'main', message: 'execute node' },
    { messageOrigin: VALID_WORKFLOW_ORIGIN },
  )
  assert.equal(receipt.accepted, true)
  assert.equal(admissions.length, 1)
  assert.deepEqual(admissions[0].args.opts.messageOrigin, VALID_WORKFLOW_ORIGIN)
  assert.equal(Object.isFrozen(admissions[0].args.opts.messageOrigin), true, 'provenance frozen (detached) before travel')
})

test('workflow_execution origin: the exact-id admission gate applies (wrong-target family)', async () => {
  const admissions = []
  const router = createIngressDelivery(deliveryDeps({
    routeChain: { admitWithRouteChain: async (_id, args) => { admissions.push(args); return { messageId: 'm1' } } },
  }))
  // Exact id that does not resolve -> AGENT_NOT_FOUND with zero_byte proof,
  // never a display-name fallback admission.
  await assert.rejects(
    () => router.deliver(
      { requestId: 'wfeat-x', agentId: 'agt_unknown-target', sessionMode: 'main', message: 'x' },
      { messageOrigin: VALID_WORKFLOW_ORIGIN },
    ),
    (error) => error.code === 'AGENT_NOT_FOUND' && error.proven === 'zero_byte',
  )
  assert.equal(admissions.length, 0)
})

test('workflow_execution origin: malformed provenance rejects fail-loud before admission', async () => {
  const cases = [
    [{ ...VALID_WORKFLOW_ORIGIN, extra: 1 }, 'undeclared origin field'],
    [{ kind: 'workflow_execution', workflowInstanceId: UUID_A, nodeVisitId: UUID_B }, 'missing attemptId'],
    [{ ...VALID_WORKFLOW_ORIGIN, workflowInstanceId: 'not-a-uuid' }, 'bad instance uuid'],
    [{ ...VALID_WORKFLOW_ORIGIN, nodeVisitId: 'not-a-uuid' }, 'bad visit uuid'],
    [{ ...VALID_WORKFLOW_ORIGIN, attemptId: 'wfeat-short' }, 'bad attempt id grammar'],
    [{ ...VALID_WORKFLOW_ORIGIN, attemptId: `WFEAT-${'A'.repeat(24)}` }, 'uppercase attempt id'],
  ]
  for (const [origin, label] of cases) {
    const admissions = []
    const router = createIngressDelivery(deliveryDeps({
      routeChain: { admitWithRouteChain: async (_id, args) => { admissions.push(args); return { messageId: 'm1' } } },
    }))
    await assert.rejects(
      () => router.deliver({ requestId: 'wfeat-y', agentId: 'agt_b-target', sessionMode: 'main', message: 'x' }, { messageOrigin: origin }),
      TypeError,
      `${label} must reject`,
    )
    assert.equal(admissions.length, 0, `${label}: zero admissions`)
  }
})

test('workflow_execution origin: unknown kinds stay rejected', async () => {
  const router = createIngressDelivery(deliveryDeps({
    routeChain: { admitWithRouteChain: async () => ({ messageId: 'm1' }) },
  }))
  await assert.rejects(
    () => router.deliver(
      { requestId: 'req-z', agentId: 'agt_b-target', sessionMode: 'main', message: 'x' },
      { messageOrigin: { kind: 'scheduler_retry', sourceAgentId: 'agt_a', correlation: 'c' } },
    ),
    /must be "inter_agent" or "workflow_execution"/,
  )
})
