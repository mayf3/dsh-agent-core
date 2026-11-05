import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ExecutionLedger, attemptIdFor, STALE_NO_PROGRESS_JUDGMENT } from '../../src/ledger.js'
import { judgeStaleFromDetail, judgeDispatchVersionFromDetail } from '../../src/judgment.js'
import { createWorkflowExecutionEngine, DEFAULT_STALE_NO_PROGRESS_THRESHOLD_MS } from '../../src/engine.js'
import { completeCurrentActivationDetail } from '../../test-support/current-activation-detail.js'
import { expectedIdentity } from '../../test-support/observation-identity.js'

const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const VISIT_NEXT = 'ad5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77'
const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const OWNER = '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66'
const AGENT = 'agt_target-agent'
const T0 = 1_700_000_000_000

function fullDetail({ version, visit, isTerminal = false, visibility = 'full' } = {}) {
  if (visibility !== 'full') return { visibility, detail: { instance: {} } }
  return completeCurrentActivationDetail({ visibility: 'full', detail: {
    instance: { workflow_state_version: version, is_terminal: isTerminal },
    current_node_visit_id: visit,
  } }, { workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
}

test('ledger CAS — recordStaleSuperseded refuses a changed attempt (double-settle loser)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-stale-cas-'))
  try {
    let now = T0
    const ledger = new ExecutionLedger({ dir, clock: () => now })
    await ledger.beginAttemptIfAbsent({ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER })
    now += 1
    await ledger.recordDeliveryStarted({ nodeVisitId: VISIT })
    now += 2
    await ledger.recordRunDelivered({ nodeVisitId: VISIT, agentId: AGENT, requestId: attemptIdFor(VISIT), sessionId: 'main', workflowStateVersionAtDispatch: 7 })
    const attempt = ledger.get(VISIT)
    const lost = await ledger.recordStaleSuperseded({
      ...expectedIdentity(attempt), nodeVisitId: VISIT,
      expected: { state: attempt.state, phase: attempt.phase, deliveredAtMs: attempt.delivered.atMs + 999 },
      observedWorkflowStateVersion: 7,
    })
    assert.equal(lost.committed, false)
    assert.equal(lost.cause, 'attempt_changed')
    const won = await ledger.recordStaleSuperseded({
      ...expectedIdentity(attempt), nodeVisitId: VISIT,
      expected: { state: attempt.state, phase: attempt.phase, deliveredAtMs: attempt.delivered.atMs },
      observedWorkflowStateVersion: 7,
    })
    assert.equal(won.committed, true)
    assert.equal(won.attempt.judgment, STALE_NO_PROGRESS_JUDGMENT)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('judgment table — judgeStaleFromDetail / judgeDispatchVersionFromDetail', () => {
  assert.deepEqual(judgeDispatchVersionFromDetail({ body: fullDetail({ version: 7 }) }), { ok: true, version: 7 })
  assert.equal(judgeDispatchVersionFromDetail({ body: { visibility: 'historical_participant', detail: {} } }).ok, false)

  const stale = (body, baseline = 7) => judgeStaleFromDetail({ body, nodeVisitId: VISIT, workflowStateVersionAtDispatch: baseline })
  assert.equal(stale(fullDetail({ version: 7, visit: VISIT })).kind, 'stale_confirmed')
  assert.equal(stale(fullDetail({ version: 8, visit: VISIT })).kind, 'recheck_required', 'assistance/wake bumps retain recheck responsibility')
  assert.equal(stale(fullDetail({ version: 8, visit: VISIT_NEXT })).kind, 'progressed', 'RETURN/move defeats staleness')
  assert.equal(stale(fullDetail({ version: 7, visit: VISIT, isTerminal: true })).kind, 'progressed', 'terminal defeats staleness')
  assert.equal(stale({ visibility: 'historical_participant', detail: {} }).kind, 'progressed', 'visibility invariant = business moved on')
  assert.equal(stale({ ok: false }).kind, 'unavailable')
  assert.equal(judgeStaleFromDetail({ body: fullDetail({ version: 7, visit: VISIT }), nodeVisitId: VISIT, workflowStateVersionAtDispatch: undefined }).kind,
    'unavailable', 'no baseline ⇒ unavailable ⇒ never stale')
})

test('config — threshold validation and default', () => {
  assert.equal(DEFAULT_STALE_NO_PROGRESS_THRESHOLD_MS, 3_600_000)
  const dir = mkdtempSync(join(tmpdir(), 'wfe-stale-cfg-'))
  try {
    const base = {
      ledger: new ExecutionLedger({ dir }),
      log: {},
      fetchDuePage: async () => ({ ok: true, items: [] }),
      resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
      deliverRun: async () => ({ ok: true, sessionId: 'main' }),
      getTurnReconciliation: () => ({ state: 'never_existed' }),
      readInstanceDetail: async () => ({ ok: true, body: fullDetail({ version: 7 }) }),
    }
    assert.throws(() => createWorkflowExecutionEngine({ ...base, config: { staleNoProgressThresholdMs: 0 } }), /positive integer/)
    assert.throws(() => createWorkflowExecutionEngine({ ...base, config: { staleNoProgressThresholdMs: 1.5 } }), /positive integer/)
    assert.throws(() => createWorkflowExecutionEngine({ ...base, config: { staleNoProgressThresholdMs: '1h' } }), /positive integer/)
    const engine = createWorkflowExecutionEngine({ ...base, config: { staleNoProgressThresholdMs: 60_000 } })
    assert.equal(typeof engine.reconcileOnce, 'function')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
