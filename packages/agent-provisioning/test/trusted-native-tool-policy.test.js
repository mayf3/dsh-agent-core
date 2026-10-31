import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertTrustedNativeToolPolicyAck,
  resolveTrustedNativeToolPolicy,
} from '../src/trusted-native-tool-policy.js'

const POLICY = {
  version: 1,
  agentId: 'agt_example',
  mode: 'native-allowlist',
  allowedCalls: [
    { toolName: 'read' },
    { toolName: 'workflow', argumentEquals: { operation: 'read' } },
  ],
}

test('trusted native policy digest uses RFC 8785 canonical member ordering', () => {
  const resolved = resolveTrustedNativeToolPolicy(POLICY, 'agt_example')

  assert.equal(resolved.policyDigest, 'da4994d586240e94a0c0306e46ef0ee617ae88a0ebfee93d5784fbd9b9bb527d')
  assert.deepEqual(resolved, {
    ...POLICY,
    policyDigest: 'da4994d586240e94a0c0306e46ef0ee617ae88a0ebfee93d5784fbd9b9bb527d',
  })
})

test('absent trusted policy stays absent for legacy startup', () => {
  assert.equal(resolveTrustedNativeToolPolicy(undefined, 'agt_example'), undefined)
  assert.throws(() => resolveTrustedNativeToolPolicy(null, 'agt_example'), /plain object/)
})

test('resolved policy is copied and frozen for one exact agent identity', () => {
  const source = structuredClone(POLICY)
  const resolved = resolveTrustedNativeToolPolicy(source, 'agt_example')

  source.allowedCalls[1].argumentEquals.operation = 'write'
  assert.equal(resolved.allowedCalls[1].argumentEquals.operation, 'read')
  assert.ok(Object.isFrozen(resolved))
  assert.ok(Object.isFrozen(resolved.allowedCalls))
  assert.ok(Object.isFrozen(resolved.allowedCalls[1].argumentEquals))
  assert.throws(() => resolveTrustedNativeToolPolicy(POLICY, 'agt_other'), /agentId/)
})

test('trusted native policy rejects unsupported and malformed policy values', () => {
  const invalid = [
    { ...POLICY, version: 2 },
    { ...POLICY, mode: 'all-tools' },
    { ...POLICY, unexpected: true },
    { ...POLICY, allowedCalls: [{ toolName: '*' }] },
    { ...POLICY, allowedCalls: [{ toolName: 'workflow', argumentEquals: {} }] },
    { ...POLICY, allowedCalls: [{ toolName: 'workflow', argumentEquals: { operation: undefined } }] },
    { ...POLICY, policyDigest: '0'.repeat(64) },
  ]

  for (const policy of invalid) {
    assert.throws(() => resolveTrustedNativeToolPolicy(policy, 'agt_example'))
  }
})

test('trusted native policy rejects duplicate and overlapping selectors', () => {
  const overlapping = [
    { toolName: 'workflow', argumentEquals: { operation: 'read' } },
    { toolName: 'workflow', argumentEquals: { source: 'task' } },
  ]

  assert.throws(() => resolveTrustedNativeToolPolicy({ ...POLICY, allowedCalls: overlapping }, 'agt_example'), /overlap/)
  assert.throws(() => resolveTrustedNativeToolPolicy({ ...POLICY, allowedCalls: [
    { toolName: 'read' }, { toolName: 'read' },
  ] }, 'agt_example'), /overlap/)
})

test('initialize acknowledgement must exactly match the frozen policy identity and digest', () => {
  const policy = resolveTrustedNativeToolPolicy(POLICY, 'agt_example')
  const acknowledgement = {
    version: 1,
    agentId: 'agt_example',
    policyDigest: policy.policyDigest,
  }

  assert.equal(assertTrustedNativeToolPolicyAck(policy, acknowledgement), undefined)
  assert.throws(() => assertTrustedNativeToolPolicyAck(policy, undefined), { code: 'AGENT_PROCESS_NATIVE_TOOL_POLICY_ACK_MISMATCH' })
  assert.throws(() => assertTrustedNativeToolPolicyAck(policy, { ...acknowledgement, agentId: 'agt_other' }), { code: 'AGENT_PROCESS_NATIVE_TOOL_POLICY_ACK_MISMATCH' })
  assert.throws(() => assertTrustedNativeToolPolicyAck(policy, { ...acknowledgement, policyDigest: '0'.repeat(64) }), { code: 'AGENT_PROCESS_NATIVE_TOOL_POLICY_ACK_MISMATCH' })
  assert.throws(() => assertTrustedNativeToolPolicyAck(policy, { ...acknowledgement, extra: true }), { code: 'AGENT_PROCESS_NATIVE_TOOL_POLICY_ACK_MISMATCH' })
  assert.equal(assertTrustedNativeToolPolicyAck(undefined, undefined), undefined)
})
