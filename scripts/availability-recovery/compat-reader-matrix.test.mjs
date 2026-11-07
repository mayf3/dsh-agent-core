/** #605: real sanitized input, always read-only; all mutable stores use copies. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { TurnReconciliationStore } from '../../packages/agent-router/src/reconciliation-store.js'
import { readDurableRecoveryStore } from '../../packages/agent-router/src/reconciliation/durable-file.js'
import { createRecoveryAdmission } from '../../packages/agent-router/src/reconciliation/admission.js'
import { createProcessRegistry } from '../../packages/agent-router/src/process-registry.js'
import { promptFenceError } from '../../packages/agent-router/src/process/state-machine.js'
import { createIngressDelivery } from '../../packages/agent-router/src/ingress-delivery.js'
import { JobStore } from '../../packages/scheduler/src/store.js'
import { assertRouterFacts } from './compat-store-facts.mjs'

const BASE = '4f7df01bcf087075c114901a96a7a54573110f61'
const source = process.env.COMPAT_STATE_INPUT
const files = [
  ['control/turn-recovery-v3.json', '1488d505a69c65c417af96be0da05fb40b52fb2adc2c1cbd3d88d4dd3e85864a'],
  ['control/turn-recovery-v3.json.abandonment-declarations.json', '139348609fb6e4936cb2339450ad47ef23869a9337f08f8a76bf1b27501839d3'],
  ['control/turn-recovery-v3.json.faults.json', '1177da0f7dbe7b722ec2dce5ae6a404d2a0460d05bb901f0493dec3f180d3486'],
  ['scheduler/jobs.json', '5fe2b0d530f271e5c9c0c0f41e62b0732c9735580d4d0ff12dabb1de26609d77'],
]
const indexes = [5124, 5125, 5127]
const agents = ['agt_needs-radar-agent', 'agt_lobster-agent', 'agt_agent-dev-engineer']
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')

function verifySource() {
  assert.ok(source, 'COMPAT_STATE_INPUT must name the Owner-designated sanitized directory')
  for (const [rel, digest] of files) assert.equal(hash(join(source, rel)), digest, rel)
}

function fixture(t) {
  verifySource()
  const shared = process.env.COMPAT_MATRIX_STATE
  const root = shared ?? mkdtempSync(join(tmpdir(), '605-real-matrix-'))
  t.after(() => {
    try {
      verifySource()
      assertRouterFacts(raw, JSON.parse(readFileSync(file, 'utf8')))
      assert.equal(hash(join(root, files[3][0])), files[3][1], 'Scheduler raw facts/fences unchanged')
    } finally { if (!shared) rmSync(root, { recursive: true, force: true }) }
  })
  for (const [rel] of files) {
    const target = join(root, rel)
    mkdirSync(dirname(target), { recursive: true })
    if (!shared || !existsSync(target)) copyFileSync(join(source, rel), target)
  }
  const file = join(root, files[0][0])
  const raw = JSON.parse(readFileSync(join(source, files[0][0]), 'utf8'))
  const targets = indexes.map((index, i) => {
    const record = raw.records[index]
    assert.equal(record.agentId, agents[i])
    return record
  })
  const open = epoch => new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: epoch })
  return { root, file, raw, targets, open }
}

function assertProtected(store, targets) {
  assert.deepEqual(store.businessAdmissionStatus(), { ready: true, reason: null })
  for (const original of targets) {
    const record = store.requireRecord(original.handle)
    for (const key of Object.keys(original)) {
      if (['state', 'queryState', 'reconciliationHandle', 'turnExecutionId', 'bytes'].includes(key)) continue
      assert.deepEqual(record[key], original[key], `preserved ${key}`)
    }
    assert.equal(record.state, 'pending')
    assert.equal(record.recoveryState, 'blocked')
    const { state, snapshot } = store.getTurnReconciliation(original.handle)
    assert.equal(state, 'recovering')
    assert.equal(snapshot.legacyFormat, 'unproven_fence_clear')
    assert.equal(snapshot.initialOutcome, 'outcome_unknown')
    assert.equal(snapshot.outcome, null)
    assert.equal(snapshot.lateOutcome, null)
    assert.equal(snapshot.terminationEvidence, null)
    assert.equal(snapshot.settlementResult, null)
    assert.equal(snapshot.exitObservedAt, null)
    assert.equal(store.admissionBlockerForAgent(original.agentId).handle, original.handle)
  }
}

function registryFor(store, count) {
  return createProcessRegistry({
    log: { log() {}, error() {} }, cfg: { agentProfile: 'matrix-test' },
    workspaceBootstrap: { ensure: async () => {}, resolveWorkspace: () => '/tmp/matrix-w', resolveDshHome: () => '/tmp/matrix-h' },
    agentDefinition: { getAgent: id => ({ id, disabled: false }) },
    deadlineConfig: { perAgent: () => ({ turnTimeoutMs: 1000, promptReceiptTimeoutMs: 1000, initializeTimeoutMs: 1000, shutdownGraceMs: 1000 }) },
    reconciliationStore: store,
    processFactory: () => { count.spawn += 1; throw new Error('must never spawn an old execution') },
    resolveProcessConfig: () => ({}), provisionHome() {}, switchAgent: async () => ({}),
    getBrokerGateway: () => undefined,
  })
}

function ingressFor(store, agentId, count) {
  return createIngressDelivery({
    log: { log() {}, error() {} }, cfg: {}, feishu: undefined,
    workspaceBootstrap: { async ensureWorkspace() {} }, store: {}, reconciliationStore: store,
    routeChain: { async runTurnWithRouteChain() { count.route += 1; return { reply: 'new request' } } },
    resolveAgentRef() { throw new Error('not used') }, resolveAgentById() { throw new Error('not used') },
    async resolveChannelConversation() {
      return { channelConversation: { id: 'feishu:matrix' }, binding: { activeAgentId: agentId, activeSessionId: 'main' } }
    },
    resolveEffectiveWorkspace: () => ({ workspaceId: null, workspacePath: '/tmp/matrix-w' }),
  })
}

test('MATRIX decode', async t => {
  const fx = fixture(t)
  const decoded = readDurableRecoveryStore(join(source, files[0][0]))
  assert.equal(decoded.records.size, 5227)
  assert.equal(decoded.issuance.size, 93)
  for (const original of fx.targets) {
    const record = decoded.records.get(original.handle)
    assert.equal(record.state, 'pending')
    assert.equal(record.fenceState, 'cleared')
    assert.equal(record.initialOutcome, 'outcome_unknown')
    assert.equal(record.terminationEvidence, null)
  }
  const schedulerFile = join(fx.root, 'scheduler/jobs.json')
  const before = hash(schedulerFile)
  const doc = await new JobStore(schedulerFile).loadDoc({ force: true })
  assert.equal(doc.version, 3)
  assert.equal(doc.jobs.length, 59)
  assert.equal(doc.occurrences.length, 5002)
  assert.equal(Object.keys(doc.fences).length, 7)
  const originalScheduler = JSON.parse(readFileSync(schedulerFile, 'utf8'))
  let unverifiable = 0
  for (const [index, record] of doc.occurrences.entries()) {
    const { historyVerification, ...facts } = record
    assert.deepEqual(facts, originalScheduler.occurrences[index], 'all original Scheduler facts preserved')
    if (historyVerification) {
      unverifiable += 1
      assert.equal(historyVerification.status, 'unverifiable')
      assert.equal(historyVerification.outcome, 'UNKNOWN')
      assert.ok(historyVerification.invalidEnumEntries.length > 0)
    }
  }
  assert.ok(unverifiable > 0, 'real non-enum history receives explicit unverifiable markers')
  assert.deepEqual(doc.fences, originalScheduler.fences)
  assert.equal(hash(schedulerFile), before)
  console.log(`decoded Router=5227/93 Scheduler=59/5002/7 unverifiableHistory=${unverifiable}; all original facts/fences and input hashes unchanged`)
})

test('MATRIX cold-start', t => {
  const fx = fixture(t)
  const store = fx.open('compat-cold')
  assertProtected(store, fx.targets)
  assertRouterFacts(fx.raw, JSON.parse(readFileSync(fx.file, 'utf8')))
  const count = { spawn: 0 }
  registryFor(store, count)
  assertProtected(store, fx.targets)
  const persisted = JSON.parse(readFileSync(fx.file, 'utf8'))
  for (const original of fx.targets) {
    const record = persisted.records.find(record => record.handle === original.handle)
    assert.deepEqual(record, original, 'registry startup preserves the full historical record')
  }
  assert.equal(count.spawn, 0)
  console.log('cold startup ready; 5227 business/evidence records and all three full protected records unchanged; epoch/capacity bookkeeping allowed; spawn=0')
})

test('MATRIX restart', t => {
  const fx = fixture(t)
  const first = fx.open('compat-first')
  registryFor(first, { spawn: 0 })
  const snapshots = fx.targets.map(original => first.getTurnReconciliation(original.handle))
  const again = fx.open('compat-restarted')
  assertProtected(again, fx.targets)
  registryFor(again, { spawn: 0 })
  assertProtected(again, fx.targets)
  for (const [index, original] of fx.targets.entries()) {
    assert.deepEqual(again.getTurnReconciliation(original.handle), snapshots[index])
  }
  console.log('restart preserves quarantine, UNKNOWN, null evidence and repeatable history')
})

test('MATRIX isolation', async t => {
  const fx = fixture(t)
  const store = fx.open('compat-isolation')
  const count = { spawn: 0, route: 0 }
  const registry = registryFor(store, count)
  const admission = createRecoveryAdmission(store, {})
  admission.assertReady()
  const blocked = []
  for (const agentId of store.issuance.keys()) {
    if (store.admissionBlockerForAgent(agentId)) blocked.push(agentId)
    else admission.assertUnfenced(agentId)
  }
  assert.deepEqual(blocked.sort(), [...agents, 'agt_stock_agent'].sort())
  admission.assertUnfenced('agt_fresh_605')
  for (const original of fx.targets) {
    assert.throws(() => admission.assertUnfenced(original.agentId), { code: 'AGENT_PROCESS_TURN_FENCED' })
    assert.equal(promptFenceError(store, original.agentId).fencedBy, original.handle)
    await assert.rejects(registry.ensureRunning(original.agentId), { code: 'AGENT_PROCESS_TURN_FENCED' })
    const result = await ingressFor(store, original.agentId, count).onIngress({
      channel: 'group', chatId: 'matrix', conversationId: 'matrix', messageId: `fresh-${original.agentId}`,
      sender: { openId: 'matrix-human' }, text: 'explicitly new request',
    })
    assert.equal(result.requestAdmission, 'not_admitted')
    assert.equal(result.fencedBy, original.handle)
    assert.equal(result.terminationEvidence, null)
  }
  assert.deepEqual(count, { spawn: 0, route: 0 })
  console.log('legacyBlocked=3 existingStockBlocked=1 otherAgentsAllowed=89 freshAllowed=true spawn=0 route=0')
})

test('MATRIX no-replay', async t => {
  const fx = fixture(t)
  const store = fx.open('compat-no-replay')
  const count = { spawn: 0 }
  const registry = registryFor(store, count)
  let correlations = 0
  for (const original of fx.targets) {
    if (original.callerCorrelation !== null) {
      correlations += 1
      assert.equal(store.resolveCallerCorrelation(original.callerCorrelation).handle, original.handle)
      assert.throws(() => store.mintTurnExecution({
        agentId: original.agentId, processGeneration: store.highestIssuedGeneration(original.agentId) + 1,
        sessionId: 'main', callerCorrelation: original.callerCorrelation,
      }), { code: 'RECONCILIATION_CORRELATION_CONFLICT' })
    }
    await assert.rejects(registry.ensureRunning(original.agentId), { code: 'AGENT_PROCESS_TURN_FENCED' })
  }
  assert.equal(correlations, 2, 'third record has no correlation; do not invent one')
  assert.equal(store.records.size, 5227)
  assert.equal(count.spawn, 0)
  assertProtected(store, fx.targets)
  console.log('old correlations=2 retained; duplicate mint=refused; third record quarantined; replay/spawn=0')
})

test('MATRIX negative-persistence', t => {
  const fx = fixture(t)
  const store = fx.open('compat-negative')
  const before = readFileSync(fx.file)
  for (const original of fx.targets) {
    const record = structuredClone(store.requireRecord(original.handle))
    assert.throws(() => store.markFenceCleared(original.handle), { code: 'RECONCILIATION_FENCE_CLEAR_UNPROVEN' })
    assert.deepEqual(store.requireRecord(original.handle), record)
    assert.deepEqual(readFileSync(fx.file), before)
  }
  assertProtected(store, fx.targets)
  console.log('all three bad-clear writes rejected; durable bytes and in-memory records unchanged')
})

test('MATRIX rollback', t => {
  const fx = fixture(t)
  const store = fx.open('compat-rollback')
  store.persistDurable() // An ordinary supported writer round-trip must preserve quarantine facts.
  const before = hash(fx.file)
  const baseDir = join(fx.root, 'base')
  mkdirSync(baseDir)
  const archive = execFileSync('git', ['archive', BASE, 'packages/agent-router/src'], { maxBuffer: 16 * 1024 * 1024 })
  execFileSync('tar', ['-x', '-C', baseDir], { input: archive })
  writeFileSync(join(baseDir, 'package.json'), '{"type":"module"}\n')
  const moduleUrl = pathToFileURL(resolve(baseDir, 'packages/agent-router/src/reconciliation-store.js')).href
  const script = `import { TurnReconciliationStore } from ${JSON.stringify(moduleUrl)};
    const store = new TurnReconciliationStore({persistenceFile: process.argv[1]});
    process.stdout.write(JSON.stringify(store.businessAdmissionStatus()));`
  const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script, fx.file], { encoding: 'utf8' }))
  assert.deepEqual(result, { ready: false, reason: 'durable_store_invalid' })
  assert.equal(hash(fx.file), before)
  assertProtected(fx.open('compat-return'), fx.targets)
  console.log('base rollback safely fails closed; availability rollback unsupported; return-to-candidate quarantine intact')
})
