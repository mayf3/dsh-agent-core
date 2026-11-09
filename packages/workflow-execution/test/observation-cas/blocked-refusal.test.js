import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ExecutionLedger } from '../../src/ledger.js'
import { createWorkflowExecutionEngine } from '../../src/engine.js'
import { intent, detail, VISIT, OWNER, AGENT, T0 } from './fixture.js'

const OTHER = 'ad5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77'
const RULE = 'accepted:AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1#CTR-EKRWAE-007'

function world(input = intent()) {
  const read = detail()
  read.body.detail.instance.workflow_instance_id = input.workflowInstanceId
  read.body.detail.current_node_visit_id = input.nodeVisitId
  Object.assign(read.body.detail.current_visit, {
    node_visit_id: input.nodeVisitId, workflow_instance_id: input.workflowInstanceId,
    assignee_principal_id: input.ownerPrincipalId,
  })
  return read
}

function fixture(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-refusal-responsibility-'))
  const state = { now: T0, worlds: new Map(),
    resolve: async () => ({ ok: true, agentId: AGENT }) }
  state.read = async args => structuredClone(state.worlds.get(args.workflowInstanceId))
  const calls = { reads: [], resolutions: [], deliveries: [], errors: [] }
  const clock = () => state.now
  const config = { automaticRecoveryEnabled: true, recoveryRetryDelayMs: 80,
    recoveryMaxDelayMs: 160, ...overrides }
  const ledger = new ExecutionLedger({ dir, clock })
  const makeEngine = (store = ledger) => createWorkflowExecutionEngine({
    ledger: store, clock, config,
    fetchDuePage: async () => ({ ok: true, items: [] }),
    resolvePrincipalToAgent: async principal => {
      calls.resolutions.push(principal)
      return state.resolve(principal)
    },
    readInstanceDetail: async args => { calls.reads.push(args); return state.read(args) },
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    getTurnReconciliation: () => ({ state: 'pending' }),
    deliverRun: async request => {
      calls.deliveries.push(request)
      return { ok: true, sessionId: 'main' }
    },
    log: { error: message => calls.errors.push(message) },
  })
  const engine = makeEngine()
  const bytes = () => readFileSync(ledger.eventsFile, 'utf8')
  const events = () => bytes().trim().split('\n').map(JSON.parse)
  return { dir, state, calls, clock, config, ledger, makeEngine, engine, bytes, events,
    cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

async function seed(fx, input = intent(), automatic = true) {
  const created = await fx.ledger.beginAttemptIfAbsent(input,
    async () => ({ kind: 'resolution_blocked', code: 'identity_resolution_unavailable' }))
  assert.equal(created.created, true)
  const drift = world(input)
  drift.body.detail.current_visit.assignee_principal_id = OTHER
  fx.state.worlds.set(input.workflowInstanceId, drift)
  const result = automatic ? (await fx.engine.reconcileOnce()).recoveries[0]
    : await fx.engine.recoverAttempt({ nodeVisitId: input.nodeVisitId, authorityRef: 'owner:manual-refusal-test' })
  assert.equal(result.outcome, 'RECOVERY_REFUSED')
  const attempt = structuredClone(fx.ledger.get(input.nodeVisitId))
  assert.equal(attempt.state, 'NEEDS_REVIEW')
  assert.equal(attempt.phase, 'recovery_refused')
  return attempt
}

function assertTerminalUnchanged(fx, original, before, store = fx.ledger) {
  assert.equal(fx.bytes(), before, 'terminal read-only responsibility must append no event')
  assert.deepEqual(store.get(original.nodeVisitId), original)
  assert.equal(fx.calls.deliveries.length, 0)
  assert.equal(fx.events().filter(event => event.kind === 'recovery_authorized').length, 0)
  assert.equal(fx.events().filter(event => event.kind === 'delivery_started').length, 0)
  assert.equal(fx.events().filter(event => event.kind === 'run_delivered').length, 0)
}

function assertPending(result, original, now) {
  assert.equal(result.outcome, 'REFUSAL_RESPONSIBILITY_PENDING')
  assert.equal(result.attemptId, original.attemptId)
  assert.equal(result.nodeVisitId, original.nodeVisitId)
  assert.equal(result.consumer, 'workflow_execution_due_poller')
  assert.equal(result.ruleRef, RULE)
  assert.equal(result.observation.source, 'target_agent_instance_detail')
  assert.equal(result.observation.observedAtMs, now)
  assert.ok(result.nextCheckAtMs > now)
}

test('B2 refusal persists the existing consumer obligation before terminal and reopens without terminal writes', async () => {
  const fx = fixture()
  try {
    const original = await seed(fx)
    assert.deepEqual(original.recoveryCheck.refusalSchedule, {
      firstCheckAtMs: T0 + 80, intervalMs: 160,
      consumer: 'workflow_execution_due_poller', ruleRef: RULE,
    })
    const events = fx.events()
    const scheduled = events.findIndex(event => event.kind === 'recovery_checked'
      && event.result === 'world_drift_refusal_pending')
    assert.ok(scheduled >= 0)
    assert.ok(scheduled < events.findIndex(event => event.kind === 'recovery_refused'))
    const before = fx.bytes()
    assert.deepEqual((await fx.engine.reconcileOnce()).recoveries, [])
    fx.state.now = original.recoveryCheck.refusalSchedule.firstCheckAtMs
    const reopened = new ExecutionLedger({ dir: fx.dir, clock: fx.clock })
    const engine = fx.makeEngine(reopened)
    const pass = await engine.reconcileOnce()
    assert.equal(pass.recoveries.length, 1)
    assertPending(pass.recoveries[0], original, fx.state.now)
    assert.equal(pass.recoveries[0].nextCheckAtMs, T0 + 240)
    assert.deepEqual((await engine.reconcileOnce()).recoveries, [], 'one read per persisted slot')
    assertTerminalUnchanged(fx, original, before, reopened)
    assert.deepEqual(fx.calls.errors, [])
  } finally { fx.cleanup() }
})

for (const unavailable of ['HTTP503', 'invalid resolver', 'wrong instance', 'throwing dependency']) {
  test(`B2 terminal refusal ${unavailable} retains obligation and a later slot reads again`, async () => {
    const fx = fixture()
    try {
      const original = await seed(fx)
      const before = fx.bytes()
      fx.state.now = original.recoveryCheck.refusalSchedule.firstCheckAtMs
      if (unavailable === 'invalid resolver') fx.state.resolve = async () => ({ ok: false, code: 'authority_revoked' })
      else if (unavailable === 'HTTP503') fx.state.read = async () => ({ ok: false, code: 'http_503' })
      else if (unavailable === 'throwing dependency') fx.state.read = async () => { throw new Error('injected read outage') }
      else fx.state.read = async () => {
        const read = world()
        read.body.detail.instance.workflow_instance_id = OTHER
        return read
      }
      const failed = (await fx.engine.reconcileOnce()).recoveries[0]
      assertPending(failed, original, fx.state.now)
      assert.equal(failed.observation.result, 'unavailable')
      assertTerminalUnchanged(fx, original, before)
      fx.state.resolve = async () => ({ ok: true, agentId: AGENT })
      fx.state.read = async () => world()
      fx.state.now = failed.nextCheckAtMs
      const recovered = (await fx.engine.reconcileOnce()).recoveries[0]
      assertPending(recovered, original, fx.state.now)
      assert.equal(recovered.observation.result, 'world_observed')
      assert.equal(recovered.observation.agentId, AGENT)
      assertTerminalUnchanged(fx, original, before)
      assert.deepEqual(fx.calls.errors, [])
    } finally { fx.cleanup() }
  })
}

for (const observed of ['original world restored', 'moved visit', 'terminal instance']) {
  test(`B2 terminal refusal ${observed} remains pending and recoverAttempt stays E3 no-op`, async () => {
    const fx = fixture()
    try {
      const original = await seed(fx)
      const before = fx.bytes()
      fx.state.read = async () => {
        const read = world()
        if (observed === 'moved visit') read.body.detail.current_node_visit_id = OTHER
        if (observed === 'terminal instance') read.body.detail.instance.is_terminal = true
        return read
      }
      fx.state.now = original.recoveryCheck.refusalSchedule.firstCheckAtMs
      const checked = (await fx.engine.reconcileOnce()).recoveries[0]
      assertPending(checked, original, fx.state.now)
      assert.equal(checked.observation.result, 'world_observed')
      const manual = await fx.engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: 'owner:later-decision' })
      assert.equal(manual.outcome, 'NO_OP_TERMINAL')
      assertTerminalUnchanged(fx, original, before)
      assert.equal(fx.events().filter(event => event.kind === 'recovery_refused').length, 1)
      assert.equal(original.recoveryCheck.businessOutcome, 'UNKNOWN')
    } finally { fx.cleanup() }
  })
}

test('B2 stopping automatic consumption retains the durable refusal obligation for a later enabled consumer', async () => {
  const fx = fixture()
  try {
    const original = await seed(fx)
    const before = fx.bytes()
    fx.state.now = original.recoveryCheck.refusalSchedule.firstCheckAtMs
    fx.config.automaticRecoveryEnabled = false
    const readsBefore = fx.calls.reads.length
    assert.deepEqual((await fx.engine.reconcileOnce()).recoveries, [])
    assert.equal(fx.calls.reads.length, readsBefore)
    assertTerminalUnchanged(fx, original, before)
    fx.config.automaticRecoveryEnabled = true
    const reopened = new ExecutionLedger({ dir: fx.dir, clock: fx.clock })
    const checked = (await fx.makeEngine(reopened).reconcileOnce()).recoveries[0]
    assertPending(checked, original, fx.state.now)
    assertTerminalUnchanged(fx, original, before, reopened)
  } finally { fx.cleanup() }
})

test('B2 refusal bounded consumer rotates due obligations without starving the second item', async () => {
  const fx = fixture({ maxRecoveryChecksPerPoll: 1 })
  try {
    const first = await seed(fx)
    fx.state.now += 1
    const second = await seed(fx, { ...intent(), nodeVisitId: OTHER,
      workflowInstanceId: OTHER, ownerPrincipalId: OWNER })
    const before = fx.bytes()
    fx.state.now = second.recoveryCheck.refusalSchedule.firstCheckAtMs
    const one = (await fx.engine.reconcileOnce()).recoveries
    const two = (await fx.engine.reconcileOnce()).recoveries
    assert.equal(one.length, 1)
    assert.equal(two.length, 1)
    assert.deepEqual(new Set([one[0].attemptId, two[0].attemptId]), new Set([first.attemptId, second.attemptId]))
    assert.deepEqual((await fx.engine.reconcileOnce()).recoveries, [])
    assertTerminalUnchanged(fx, first, before)
    assertTerminalUnchanged(fx, second, before)
  } finally { fx.cleanup() }
})

test('B2 concurrent restarted consumers only repeat safe reads and append no terminal event', async () => {
  const fx = fixture()
  try {
    const original = await seed(fx)
    const before = fx.bytes()
    fx.state.now = original.recoveryCheck.refusalSchedule.firstCheckAtMs
    const left = new ExecutionLedger({ dir: fx.dir, clock: fx.clock })
    const right = new ExecutionLedger({ dir: fx.dir, clock: fx.clock })
    const passes = await Promise.all([
      fx.makeEngine(left).reconcileOnce(), fx.makeEngine(right).reconcileOnce(),
    ])
    for (const pass of passes) assertPending(pass.recoveries[0], original, fx.state.now)
    assertTerminalUnchanged(fx, original, before, left)
    assertTerminalUnchanged(fx, original, before, right)
    assert.deepEqual(fx.calls.errors, [])
  } finally { fx.cleanup() }
})

test('B2 manual refusal without an accepted automatic schedule is not given a new terminal obligation', async () => {
  const fx = fixture()
  try {
    const original = await seed(fx, intent(), false)
    assert.equal(original.recoveryCheck, undefined)
    const before = fx.bytes()
    fx.state.now += 1_000
    assert.deepEqual((await fx.engine.reconcileOnce()).recoveries, [])
    assertTerminalUnchanged(fx, original, before)
  } finally { fx.cleanup() }
})
