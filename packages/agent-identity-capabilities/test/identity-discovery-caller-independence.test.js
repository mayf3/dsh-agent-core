/**
 * agent-control#801 — generic basic-identity discovery caller-independence
 * regression (TEST-ONLY; pins behavior already accepted by
 * AGENT_CORE_AGENT_PRINCIPAL_REVERSE_RESOLUTION_V1 and
 * AGENT_CORE_AGENT_DIRECTORY_TOOL_V1 — adds no surface, scope or authority).
 *
 * Property pinned: basic identity discovery is NOT preconditioned on any
 * same-domain/membership relation. The provider surfaces receive the
 * gateway-frozen ACTUAL caller and NOTHING else caller-derived — there is no
 * domain, membership, role or ownership predicate anywhere in the identity
 * read path — so two synthetic callers from disjoint fixture "domains" get
 * byte-identical minimal public projections, and each call's token is
 * acquired for the CALLER's own identity (the target agentId argument never
 * selects credentials). Membership/execution authority stays outside these
 * results: success envelopes carry only the accepted public identity fields.
 *
 * Synthetic fixtures only; the fixture "domains" are naming devices — the
 * production Principal UUID constants are FORBIDDEN (ACC-APR-003:
 * TARGET_UUID_PRESEEDED = NO).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createAgentPrincipalReverseResolutionAccess,
  AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID,
} from '../src/agent-principal-reverse-resolution.js'
import { createAgentDirectoryAccess, AGENT_DIRECTORY_CAPABILITY_ID } from '../src/agent-directory.js'

const TARGET_ID = 'agt_domain-x-butler'
const TARGET_PRINCIPAL = '123e4567-e89b-42d3-a456-426614174000'
const CALLER_DOMAIN_X = 'agt_domain-x-guest'
const CALLER_DOMAIN_Y = 'agt_domain-y-teacher'

/** Four synthetic records across two fixture "domains" (registry is flat). */
function definition() {
  return {
    getAgent: (id) => {
      if (id !== TARGET_ID) {
        throw Object.assign(new Error('agent-definition: agent not found'), { code: 'AGENT_NOT_FOUND' })
      }
      return { id, name: 'Butler', description: null, disabled: false }
    },
    listAgents: () => [
      { id: TARGET_ID, name: 'Butler', description: null, disabled: false },
      { id: 'agt_domain-x-printer', name: 'Printer', description: null, disabled: true },
      { id: 'agt_domain-y-teacher', name: 'Shared Expert', description: null, disabled: false },
      { id: 'agt_domain-x-guest', name: 'Shared Expert', description: null, disabled: false },
    ],
  }
}

function makeReverseProvider({ status = 200, body } = {}) {
  const tokenCalls = []
  const fetchCalls = []
  const fetchImpl = async (url, init) => {
    fetchCalls.push({ url, authorization: init?.headers?.Authorization })
    return { status, json: async () => body }
  }
  const provider = createAgentPrincipalReverseResolutionAccess({
    definition: definition(),
    authServiceOrigin: 'https://auth.example.test',
    acquireCallerToken: async ({ agentId }) => {
      tokenCalls.push(agentId)
      return { accessToken: `token-for-${agentId}` }
    },
    fetchImpl,
  })
  return { provider, tokenCalls, fetchCalls }
}

function reverseResolve(provider, callerAgentId) {
  return provider.handlers[AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID]
    .resolve({ agentId: TARGET_ID }, { callerAgentId })
}

test('reverse: two disjoint-domain callers get the byte-identical minimal projection', async () => {
  const { provider, tokenCalls } = makeReverseProvider({
    body: { principalId: TARGET_PRINCIPAL, agentId: TARGET_ID, principalStatus: 'active' },
  })
  const fromX = await reverseResolve(provider, CALLER_DOMAIN_X)
  const fromY = await reverseResolve(provider, CALLER_DOMAIN_Y)
  const expected = { ok: true, result: { agentId: TARGET_ID, principalId: TARGET_PRINCIPAL } }
  assert.deepEqual(fromX, expected)
  assert.deepEqual(fromY, expected)
  // Each token was acquired for the ACTUAL caller, never the target, and
  // never appears in any result (trusted parent transport only).
  assert.deepEqual(tokenCalls, [CALLER_DOMAIN_X, CALLER_DOMAIN_Y])
  assert.ok(!JSON.stringify([fromX, fromY]).includes('token-for-'))
})

test('reverse: unbound target (auth 404 AGENT_NOT_FOUND) is the same closed outcome for both callers', async () => {
  const { provider } = makeReverseProvider({ status: 404, body: { error: 'AGENT_NOT_FOUND' } })
  const fromX = await reverseResolve(provider, CALLER_DOMAIN_X)
  const fromY = await reverseResolve(provider, CALLER_DOMAIN_Y)
  const expected = { ok: false, error: { code: 'agent_not_found', detail: 'no Principal exists for the exact agentId' } }
  assert.deepEqual(fromX, expected)
  assert.deepEqual(fromY, expected)
})

test('directory: the result is independent of the caller context entirely', async () => {
  const { handlers } = createAgentDirectoryAccess({ definition: definition() })
  const resolve = handlers[AGENT_DIRECTORY_CAPABILITY_ID].resolve
  const fromX = await resolve({ query: TARGET_ID }, { callerAgentId: CALLER_DOMAIN_X })
  const fromY = await resolve({ query: TARGET_ID }, { callerAgentId: CALLER_DOMAIN_Y })
  const anonymous = await resolve({ query: TARGET_ID }, undefined)
  const expected = {
    ok: true,
    result: { status: 'resolved', agent: { agentId: TARGET_ID, name: 'Butler', description: null, enabled: true } },
  }
  assert.deepEqual(fromX, expected)
  assert.deepEqual(fromY, expected)
  assert.deepEqual(anonymous, expected)
})

test('directory: list exposes exactly the four public identity fields — never principal/credential data', async () => {
  const { handlers } = createAgentDirectoryAccess({ definition: definition() })
  const listing = await handlers[AGENT_DIRECTORY_CAPABILITY_ID].list({}, { callerAgentId: CALLER_DOMAIN_Y })
  assert.equal(listing.ok, true)
  for (const entry of listing.result.agents) {
    assert.deepEqual(Object.keys(entry), ['agentId', 'name', 'description', 'enabled'])
  }
  assert.ok(!JSON.stringify(listing).includes('principal'), 'no principal-shaped field is exposed')
  // Ambiguity is explicit with the full candidate set, identical for both callers.
  const ambiguous = await handlers[AGENT_DIRECTORY_CAPABILITY_ID].resolve(
    { query: 'Shared Expert' },
    { callerAgentId: CALLER_DOMAIN_X },
  )
  assert.equal(ambiguous.result.status, 'ambiguous')
  assert.deepEqual(ambiguous.result.candidates.map((c) => c.agentId), [
    'agt_domain-y-teacher',
    'agt_domain-x-guest',
  ])
  // Disabled existence truth resolves enabled:false (identity ≠ deliverability).
  const disabled = await handlers[AGENT_DIRECTORY_CAPABILITY_ID].resolve(
    { query: 'agt_domain-x-printer' },
    { callerAgentId: CALLER_DOMAIN_Y },
  )
  assert.deepEqual(disabled.result.agent, {
    agentId: 'agt_domain-x-printer',
    name: 'Printer',
    description: null,
    enabled: false,
  })
})
