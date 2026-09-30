import assert from 'node:assert/strict'
import { test } from 'node:test'

import { AgentProcess } from '../../src/process.js'
import { createProcessRegistry } from '../../src/process-registry.js'
import { TurnReconciliationStore } from '../../src/reconciliation-store.js'
import { makeFakeChild } from '../helpers/fake-child.js'

/**
 * Product #389 (Epic #375 A5): candidate/private canary qualification
 * (deployment_start | restart_a | restart_b) must be isolated from ordinary
 * fleet admission — pending or failed qualification never denies unrelated
 * Agent traffic, and the private canary never admits a bypass. All
 * identities here are synthetic test identities; children are fake OS
 * boundaries; the registry, AgentProcess and the reconciliation store are
 * the real product modules.
 */

const FAST = Object.freeze({
  initializeTimeoutMs: 800, promptReceiptTimeoutMs: 300,
  turnTimeoutMs: 1500, shutdownGraceMs: 200,
})
const PHASES = Object.freeze(['deployment_start', 'restart_a', 'restart_b'])
const PROCEDURE = 'b1a1d5e148143c5ddf43fd644cb377cf7f74a4c561354b9098d80bd8c6933d44'

const adminRootContext = phase => Object.freeze({
  role: 'original_executor_admin_qualification', phase,
  consumingBinarySha256: 'a'.repeat(64), validatorSha256: 'b'.repeat(64),
  entryManifestSha256: 'c'.repeat(64), procedureSha256: PROCEDURE,
  startupNonce: 'd'.repeat(64),
})

/** Real AgentProcess over a fake child — the registry processFactory product. */
function makeAgentFx(options) {
  const child = makeFakeChild()
  const proc = new AgentProcess({ ...options, deadlines: FAST })
  // The registry owns the real spawn() call; the fake child replaces only
  // the OS process creation (attach is spawn's exact post-condition minus
  // the real child object).
  proc.spawn = () => { proc.counters.spawnAttempts += 1; return proc.attachChild(child) }
  const tick = () => new Promise(resolve => setImmediate(resolve))
  const emit = message => { child.stdout.handler(`${JSON.stringify(message)}\n`) }
  const respondTo = (method, result) => {
    const write = [...child.writes].reverse().find(candidate => candidate.method === method)
    if (write === undefined) throw new Error(`fx: no ${method} request to respond to`)
    emit({ id: write.id, result })
    return write
  }
  const completeTurn = (sessionId, messageId, replyText, { turn = 1 } = {}) => {
    emit({ method: 'session.event', params: { sessionId, event: { type: 'agent/inbox/spliced', data: { inserted: [{ id: messageId }] } } } })
    emit({ method: 'session.event', params: { sessionId, event: { type: 'turn/start', data: { turn } } } })
    emit({ method: 'session.event', params: { sessionId, event: { type: 'user/message', data: { id: messageId } } } })
    emit({ method: 'session.event', params: { sessionId, event: { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: replyText }] } } } } })
    emit({ method: 'session.event', params: { sessionId, event: { type: 'turn/end', data: { turn, reason: { kind: 'completed' } } } } })
    emit({ method: 'session.status', params: { sessionId, status: 'idle' } })
  }
  return { proc, child, tick, respondTo, completeTurn }
}

/** Real registry whose children are real AgentProcesses over fake OS children. */
function makeRegistry({ rootContext }) {
  const store = new TurnReconciliationStore()
  const agents = new Map()
  const registry = createProcessRegistry({
    log: { log() {}, error() {} },
    cfg: { agentProfile: 'production', productionRoot: '/synthetic/root' },
    workspaceBootstrap: {
      ensure: async () => {},
      resolveWorkspace: () => '/synthetic/workspace',
      resolveDshHome: () => '/synthetic/home',
    },
    agentDefinition: { getAgent: id => ({ id, disabled: false }) },
    deadlineConfig: { perAgent: () => FAST },
    reconciliationStore: store,
    processFactory: options => {
      const fx = makeAgentFx(options)
      agents.set(options.agentId, fx)
      return fx.proc
    },
    resolveProcessConfig: () => ({}),
    provisionHome() {},
    switchAgent() {},
    getBrokerGateway() {},
    fixedAdminRootContext: rootContext,
  })
  return { registry, agents, store }
}

/** Bounded deterministic wait — a spin that never converges fails, never hangs. */
async function waitFor(condition, label, { maxTicks = 500 } = {}) {
  for (let i = 0; i < maxTicks; i++) {
    if (condition()) return
    await new Promise(resolve => setImmediate(resolve))
  }
  throw new Error(`fx: condition did not converge within ${maxTicks} ticks: ${label}`)
}

/** Drive one registry admission to a READY process (responds to initialize). */
async function startViaRegistry(registry, agents, agentId, initializeResult) {
  const pending = registry.ensureRunningForRoute(agentId)
  await waitFor(() => agents.has(agentId), `${agentId} factory product`)
  const fx = agents.get(agentId)
  await fx.tick()
  fx.respondTo('initialize', { registeredProviders: [fx.proc.provider], ...initializeResult })
  const ready = await pending
  assert.equal(ready.status, 'ready')
  return { proc: ready.proc, fx }
}

/** Admit + complete one ordinary turn through the real process. */
let ordinaryTurnSeq = 0
async function completeOrdinaryTurn(fx, text) {
  const pending = fx.proc.turn('main', text)
  await fx.tick()
  const messageId = `ordinary-native-${++ordinaryTurnSeq}`
  const prompt = fx.respondTo('session/prompt', { messageId })
  fx.completeTurn(prompt.params.sessionId, messageId, 'ordinary acknowledgement')
  return pending
}

for (const phase of PHASES) {
  test(`pending ${phase} qualification leaves ordinary agent admission and turns open`, async () => {
    const { registry, agents, store } = makeRegistry({ rootContext: adminRootContext(phase) })
    // Qualification is PENDING: the root has issued no query; no canary child exists.
    assert.equal(registry.lifecycleSlotSnapshot('agt_efficiency-agent').state, 'EMPTY')
    assert.equal([...store.records.values()].length, 0)

    const { proc, fx } = await startViaRegistry(registry, agents, 'agt_other-agent')
    assert.equal(proc.agentId, 'agt_other-agent')
    const result = await completeOrdinaryTurn(fx, `ordinary turn during pending ${phase} qualification`)
    assert.equal(result.status, 'completed')
    const [record] = [...store.records.values()]
    assert.equal(record.agentId, 'agt_other-agent')
    assert.equal(store.getTurnReconciliation(record.handle).state, 'settled')
  })
}

test('a completed restart_a canary does not close ordinary admission afterwards', async () => {
  const { registry, agents, store } = makeRegistry({ rootContext: adminRootContext('restart_a') })
  const canaryPending = registry.ensureFixedAdminProcess()
  await waitFor(() => agents.has('agt_efficiency-agent'), 'canary factory product')
  const canary = agents.get('agt_efficiency-agent')
  await canary.tick()
  canary.respondTo('initialize', { registeredProviders: [canary.proc.provider],
    fixedAdminToolPolicy: { armed: true, startupNonce: adminRootContext('restart_a').startupNonce } })
  const canaryProc = await canaryPending
  assert.equal(canaryProc.fixedAdminQualification.phase, 'restart_a')

  const qualification = canaryProc.qualifyFixedTurn()
  await canary.tick()
  const prompt = canary.respondTo('session/prompt', { messageId: 'canary-restart-a-1' })
  canary.completeTurn(prompt.params.sessionId, 'canary-restart-a-1', 'Fixed qualification acknowledged.')
  const qualificationResult = await qualification
  assert.equal(qualificationResult.status, 'completed')

  // Ordinary fleet traffic AFTER the canary settled (record fenced armed).
  const { proc, fx } = await startViaRegistry(registry, agents, 'agt_other-agent')
  const result = await completeOrdinaryTurn(fx, 'ordinary turn after canary completion')
  assert.equal(result.status, 'completed')
  const records = [...store.records.values()]
  assert.equal(records.length, 2)
  assert.ok(records.some(record => record.agentId === 'agt_efficiency-agent'
    && store.getTurnReconciliation(record.handle).state === 'settled'))
  assert.ok(records.some(record => record.agentId === 'agt_other-agent'
    && store.getTurnReconciliation(record.handle).state === 'settled'))
})

test('a failed canary qualification (unverified child) leaves ordinary admission open and fail-closed', async () => {
  const { registry, agents, store } = makeRegistry({ rootContext: adminRootContext('restart_b') })
  // The canary child never proves the armed tool policy: qualification FAILS.
  const canaryPending = registry.ensureFixedAdminProcess()
  await waitFor(() => agents.has('agt_efficiency-agent'), 'canary factory product (failing)')
  const canary = agents.get('agt_efficiency-agent')
  await canary.tick()
  canary.respondTo('initialize', { registeredProviders: [canary.proc.provider] })
  await assert.rejects(canaryPending, error => error.code === 'FIXED_ADMIN_CANARY_CHILD_UNVERIFIED')
  assert.equal([...store.records.values()].length, 0)

  // Ordinary unrelated traffic stays admitted after the qualification failure.
  const { proc, fx } = await startViaRegistry(registry, agents, 'agt_other-agent')
  const result = await completeOrdinaryTurn(fx, 'ordinary turn after failed canary qualification')
  assert.equal(result.status, 'completed')

  // …and the failed qualification can never be retried around its contract.
  await assert.rejects(registry.ensureFixedAdminProcess(),
    error => error.code === 'FIXED_ADMIN_CANARY_NO_REPLAY')
  assert.equal([...store.records.values()].filter(record => record.agentId === 'agt_efficiency-agent').length, 0)
})

test('ordinary route/direct callers can never reach the private canary agent, and other agents stay unaffected', async () => {
  const { registry, agents } = makeRegistry({ rootContext: adminRootContext('deployment_start') })
  await assert.rejects(registry.ensureRunningForRoute('agt_efficiency-agent'),
    error => error.code === 'FIXED_ADMIN_CANARY_PRIVATE_ONLY')
  await assert.rejects(registry.ensureRunning('agt_efficiency-agent'),
    error => error.code === 'FIXED_ADMIN_CANARY_PRIVATE_ONLY')
  assert.equal(agents.has('agt_efficiency-agent'), false)

  // The rejections above are scoped: an unrelated agent still starts.
  const { proc, fx } = await startViaRegistry(registry, agents, 'agt_other-agent')
  assert.equal(registry.lifecycleSlotSnapshot('agt_other-agent').state, 'READY')
  const result = await completeOrdinaryTurn(fx, 'ordinary turn after canary reservation rejections')
  assert.equal(result.status, 'completed')
  assert.equal(proc.agentId, 'agt_other-agent')
})

test('negative control: the durable-store admission floor still blocks ordinary traffic globally', async () => {
  const { registry, agents, store } = makeRegistry({ rootContext: adminRootContext('restart_a') })
  store.startupBlockedReason = 'durable_store_invalid'
  await assert.rejects(registry.ensureRunningForRoute('agt_other-agent'),
    error => error.code === 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED')
  assert.equal(agents.has('agt_other-agent'), false)
})
