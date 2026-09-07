/**
 * AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1 CTR-EPAR-005 — the A2A
 * message-origin admission guard: deliver() with an inter_agent messageOrigin
 * resolves the target by EXACT Agent Definition id only. The display-name
 * fallback of resolveAgentRef can never pick a different Agent whose name
 * equals a previously valid id (TOCTOU wrong-target family). Non-A2A paths
 * (channel ingress / legacy callers) keep the existing resolution unchanged.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createIngressDelivery } from '../../src/ingress-delivery.js'

const ORIGIN = { kind: 'inter_agent', sourceAgentId: 'agt_hr-agent', correlation: 'turn:1:a1:g1:s2' }

/**
 * Agent universe exercising the TOCTOU family: `agt_blog-agent` was the
 * canonical id of the Blog Agent and is referenced by an HR resolution; the
 * definition has since been reloaded so the id is GONE while a DIFFERENT
 * agent ("Guest Poster") now carries that string as its display name.
 */
const AGENTS = {
  'agt_blog-agent': undefined, // deleted
  'agt_guest-poster': { id: 'agt_guest-poster', name: 'agt_blog-agent', disabled: false },
  'agt_retired': { id: 'agt_retired', name: 'Retired', disabled: true },
  'agt_alive': { id: 'agt_alive', name: 'Alive', disabled: false },
}

function deps() {
  const admissions = []
  const resolveAgentRef = (ref) => {
    // The historical name-fallback semantics: exact enabled id first, then
    // case-insensitive display name.
    for (const record of Object.values(AGENTS)) {
      if (record && record.id === ref && !record.disabled) return { ...record }
    }
    for (const record of Object.values(AGENTS)) {
      if (record && record.name.toLowerCase() === String(ref).toLowerCase() && !record.disabled) return { ...record }
    }
    throw Object.assign(new Error(`agent-definition: agent not found: ${ref}`), { code: 'AGENT_NOT_FOUND' })
  }
  const resolveAgentById = (id) => {
    const record = AGENTS[id]
    if (!record) throw Object.assign(new Error(`agent-definition: agent not found: ${id}`), { code: 'AGENT_NOT_FOUND' })
    return { ...record }
  }
  const router = createIngressDelivery({
    log: { log: () => {}, error: () => {} },
    feishu: undefined,
    workspaceBootstrap: { resolveWorkspace: () => '/tmp/ws' },
    store: { freshSessionFor: async () => { throw new Error('fresh not expected') } },
    reconciliationStore: { assertMintCapacity: () => {} },
    resolveAgentRef,
    resolveAgentById,
    resolveChannelConversation: async () => { throw new Error('not expected') },
    resolveEffectiveWorkspace: () => { throw new Error('not expected') },
    routeChain: { admitWithRouteChain: async (agentId, args) => { admissions.push({ agentId, args }); return { messageId: 'm1', reconciliationHandle: 'turn:ok' } } },
  })
  return { router, admissions }
}

test('CTR-EPAR-005: a deleted exact id whose string matches another agent display name sends ZERO', async () => {
  const { router, admissions } = deps()
  await assert.rejects(
    router.deliver(
      { requestId: 'req-1', agentId: 'agt_blog-agent', sessionMode: 'main', message: 'task' },
      { messageOrigin: ORIGIN },
    ),
    (error) => error.code === 'AGENT_NOT_FOUND',
  )
  assert.equal(admissions.length, 0, 'no admission, no prompt byte')
})

test('CTR-EPAR-005: a disabled id is target_disabled even when its name is referenced', async () => {
  const { router, admissions } = deps()
  await assert.rejects(
    router.deliver(
      { requestId: 'req-2', agentId: 'agt_retired', sessionMode: 'main', message: 'task' },
      { messageOrigin: ORIGIN },
    ),
    (error) => error.code === 'AGENT_DISABLED' && error.proven === 'zero_byte',
  )
  assert.equal(admissions.length, 0)
})

test('CTR-EPAR-005: the exact enabled id still resolves and admits once', async () => {
  const { router, admissions } = deps()
  const receipt = await router.deliver(
    { requestId: 'req-3', agentId: 'agt_alive', sessionMode: 'main', message: 'task' },
    { messageOrigin: ORIGIN },
  )
  assert.equal(receipt.accepted, true)
  assert.equal(admissions.length, 1)
  assert.equal(admissions[0].agentId, 'agt_alive')
})

test('non-A2A paths keep the existing resolution semantics (name fallback unchanged)', async () => {
  const { router, admissions } = deps()
  // No messageOrigin (legacy caller): the display name 'agt_blog-agent'
  // (now carried by agt_guest-poster) still resolves — the guard is scoped
  // to A2A message-origin admission only (CTR-EPAR-005).
  const receipt = await router.deliver(
    { requestId: 'req-4', agentId: 'agt_blog-agent', sessionMode: 'main', message: 'legacy' },
  )
  assert.equal(receipt.accepted, true)
  assert.equal(admissions.length, 1)
  assert.equal(admissions[0].agentId, 'agt_guest-poster')
})

test('A2A same-id rename remains exact: the id always selects that id', async () => {
  AGENTS['agt_renamed'] = { id: 'agt_renamed', name: 'New Name', disabled: false }
  try {
    const { router, admissions } = deps()
    const receipt = await router.deliver(
      { requestId: 'req-5', agentId: 'agt_renamed', sessionMode: 'main', message: 'task' },
      { messageOrigin: ORIGIN },
    )
    assert.equal(receipt.accepted, true)
    assert.equal(admissions[0].agentId, 'agt_renamed', 'rename cannot reroute an exact id')
  } finally {
    delete AGENTS['agt_renamed']
  }
})
