import assert from 'node:assert/strict'
import { test } from 'node:test'

import { makeFx } from '../helpers/fake-child.js'
import { FIXED_ADMIN_CANARY_TEXT } from '../../../demo-server/src/fixed-admin-tool-free.js'
import { fixedAdminCanaryProjection } from '../../../production-runtime/src/native-arm64/hr-s256-r2-startup-context.mjs'

const BINDING = Object.freeze({
  role: 'fixed_admin_qualification', agentId: 'agt_efficiency-agent', phase: 'deployment_start',
  hostId: 'FF99ABD5-79A0-5EE0-9E0B-B62671271560', packageSha256: 'a'.repeat(64),
  consumingBinarySha256: 'b'.repeat(64), startupNonce: 'c'.repeat(64), processGeneration: 1,
})
const ROOT_CONTEXT = Object.freeze({
  role: 'original_executor_admin_qualification', phase: BINDING.phase,
  consumingBinarySha256: BINDING.consumingBinarySha256,
  validatorSha256: 'd'.repeat(64), entryManifestSha256: BINDING.packageSha256,
  procedureSha256: 'b1a1d5e148143c5ddf43fd644cb377cf7f74a4c561354b9098d80bd8c6933d44',
  startupNonce: BINDING.startupNonce,
})

// QE2-A03: the fake child is only an OS boundary. AgentProcess and its
// reconciliation store are the product modules under test; neither a caller
// receipt nor an invented completed event may stand in for their issuance.
test('fixed private canary requires the owned ingress and real durable terminal', async () => {
  const fx = makeFx({ agentId: 'agt_efficiency-agent', fixedAdminQualification: BINDING })
  const ready = fx.proc.ready()
  await fx.tick()
  const init = fx.respondTo('initialize', { registeredProviders: [fx.proc.provider],
    fixedAdminToolPolicy: { armed: true, startupNonce: BINDING.startupNonce } })
  assert.deepEqual(init.params.fixedAdminQualification, BINDING)
  await ready
  await assert.rejects(fx.proc.turn('main', 'caller text'),
    error => error.code === 'FIXED_ADMIN_CANARY_PRIVATE_ONLY')
  assert.equal(fx.store.records.size, 0)
  const pending = fx.proc.qualifyFixedTurn()
  await fx.tick()
  const prompt = fx.writes.find(write => write.method === 'session/prompt')
  assert.ok(prompt, 'one fixed canary must traverse AgentProcess promptWrite')
  assert.equal(prompt.params.contentBlocks.length, 1)
  assert.equal(prompt.params.contentBlocks[0].text, FIXED_ADMIN_CANARY_TEXT)
  const [record] = [...fx.store.records.values()]
  assert.ok(record, 'the real reconciliation store must mint before prompt write')
  assert.equal(record.state, 'pending')
  fx.respondTo('session/prompt', { messageId: 'native-fixed-canary-1' })
  fx.completeTurn(prompt.params.sessionId, 'native-fixed-canary-1', 'completed')
  const result = await pending
  assert.equal(result.status, 'completed')
  assert.equal(result.reconciliationHandle, record.handle)
  assert.equal(result.messageId, 'native-fixed-canary-1')
  assert.equal(fx.store.getTurnReconciliation(record.handle).state, 'settled')
  await assert.rejects(fx.proc.qualifyFixedTurn(), error => error.code === 'FIXED_ADMIN_CANARY_NO_REPLAY')
  assert.equal(fx.writes.filter(write => write.method === 'session/prompt').length, 1)
})

test('private root challenge observes an actually minted and settled fixed canary', async () => {
  const fx = makeFx({ agentId: 'agt_efficiency-agent', fixedAdminQualification: BINDING })
  const ready = fx.proc.ready()
  await fx.tick()
  fx.respondTo('initialize', { registeredProviders: [fx.proc.provider],
    fixedAdminToolPolicy: { armed: true, startupNonce: BINDING.startupNonce } })
  await ready
  const query = { context: ROOT_CONTEXT, challenge: 'e'.repeat(32),
    deadlineMonotonicNs: String(process.hrtime.bigint() + 5_000_000_000n) }
  const service = { reconciliationRuntimeStatus: () => ({
    generationId: fx.store.occupancy().runtimeEpoch, health: 'healthy', businessAdmission: 'open',
  }) }
  const pending = fixedAdminCanaryProjection(query, service, ROOT_CONTEXT, fx.store, async () => fx.proc)
  await fx.tick()
  const prompt = fx.writes.find(write => write.method === 'session/prompt')
  assert.ok(prompt)
  const [record] = [...fx.store.records.values()]
  assert.equal(record.state, 'pending')
  fx.respondTo('session/prompt', { messageId: 'native-fixed-canary-readback' })
  fx.completeTurn(prompt.params.sessionId, 'native-fixed-canary-readback', 'completed')
  const frame = await pending
  assert.equal(frame.handle, record.handle)
  assert.equal(frame.processGeneration, fx.proc.processGeneration)
  assert.equal(frame.runtimeGeneration, fx.store.occupancy().runtimeEpoch)
  assert.equal(fx.store.getTurnReconciliation(record.handle).state, 'settled')
  assert.equal(fx.writes.filter(write => write.method === 'session/prompt').length, 1)
})

test('missing child tool enforcement receipt fails before any canary prompt or durable mint', async () => {
  const fx = makeFx({ agentId: 'agt_efficiency-agent', fixedAdminQualification: BINDING })
  const ready = fx.proc.ready()
  await fx.tick()
  fx.respondTo('initialize', { registeredProviders: [fx.proc.provider] })
  await assert.rejects(ready, error => error.code === 'FIXED_ADMIN_CANARY_CHILD_UNVERIFIED')
  assert.equal(fx.store.records.size, 0)
  assert.equal(fx.writes.filter(write => write.method === 'session/prompt').length, 0)
})

test('blocked durable store refuses fixed canary before native prompt write', async () => {
  const fx = makeFx({ agentId: 'agt_efficiency-agent', fixedAdminQualification: BINDING })
  const ready = fx.proc.ready()
  await fx.tick()
  fx.respondTo('initialize', { registeredProviders: [fx.proc.provider],
    fixedAdminToolPolicy: { armed: true, startupNonce: BINDING.startupNonce } })
  await ready
  fx.store.startupBlockedReason = 'durable_store_invalid'
  await assert.rejects(fx.proc.qualifyFixedTurn(), error => error.status === 'not_admitted')
  assert.equal(fx.store.records.size, 0)
  assert.equal(fx.writes.filter(write => write.method === 'session/prompt').length, 0)
})

test('an attempted child tool call invalidates an otherwise completed native canary', async () => {
  const fx = makeFx({ agentId: 'agt_efficiency-agent', fixedAdminQualification: BINDING })
  const ready = fx.proc.ready()
  await fx.tick()
  fx.respondTo('initialize', { registeredProviders: [fx.proc.provider],
    fixedAdminToolPolicy: { armed: true, startupNonce: BINDING.startupNonce } })
  await ready
  const pending = fx.proc.qualifyFixedTurn()
  await fx.tick()
  const prompt = fx.writes.find(write => write.method === 'session/prompt')
  fx.respondTo('session/prompt', { messageId: 'native-fixed-canary-effect' })
  fx.emitEvent(prompt.params.sessionId, { type: 'tool/call', data: { name: 'broker' } })
  fx.completeTurn(prompt.params.sessionId, 'native-fixed-canary-effect', 'completed')
  await assert.rejects(pending, error => error.code === 'FIXED_ADMIN_CANARY_EFFECT_ATTEMPTED')
  assert.equal(fx.proc.fixedAdminEffectAttempted, true)
  assert.equal(fx.writes.filter(write => write.method === 'session/prompt').length, 1)
})
