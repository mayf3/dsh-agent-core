import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ExecutionLedger } from '../../src/ledger.js'
import { createWorkflowExecutionEngine } from '../../src/engine.js'
import { completeCurrentActivationDetail } from '../../test-support/current-activation-detail.js'

export const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
export const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'
export const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
export const OWNER = '5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66'
export const AGENT = 'agt_target-agent'
export const T0 = 1_700_000_000_000

export function intent() {
  return { dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE,
    ownerPrincipalId: OWNER, nextEligibleAt: '2026-09-09T01:00:00Z',
    createdAt: '2026-09-09T00:00:00Z', updatedAt: '2026-09-09T00:30:00Z' }
}

export function identity(attempt) {
  return { expectedAttemptId: attempt.attemptId, expectedGeneration: attempt.generation ?? 1 }
}

export function detail(version = 7) {
  return { ok: true, body: completeCurrentActivationDetail({ visibility: 'full', detail: {
    instance: { workflow_state_version: version }, current_node_visit_id: VISIT,
  } }, { workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER }) }
}

export function fixture({ age = 100, maxAttemptsPerVisit = 3 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-observation-cas-'))
  // Both attempts deliberately receive the SAME delivered.atMs. The reader's
  // wall clock makes candidates due without making timestamps an identity key.
  const writer = new ExecutionLedger({ dir, clock: () => T0, maxAttemptsPerVisit })
  const reader = new ExecutionLedger({ dir, clock: () => T0 + age, maxAttemptsPerVisit })
  return { dir, writer, reader, age, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

export async function delivered(ledger, { ownerResume = false } = {}) {
  const result = await ledger.beginAttemptIfAbsent(intent(), async (attempt, { recordDeliveryStarted }) => {
    recordDeliveryStarted()
    return { kind: 'run_delivered', agentId: AGENT, requestId: attempt.attemptId,
      sessionId: 'main', reconciliationHandle: `turn:g${attempt.generation}`,
      workflowStateVersionAtDispatch: ownerResume ? 12 : 7 }
  }, () => true, async () => ({ preDeliveryWorkflowStateVersion: ownerResume ? 12 : 7,
    ...(ownerResume ? { assistanceResume: ownerEvidence() } : {}) }), ownerResume ? async () => true : undefined)
  assert.equal(result.created, true, result.cause)
  return result.attempt
}

export async function runEnded(ledger, attempt) {
  const result = await ledger.recordReconciled({ nodeVisitId: VISIT, ...identity(attempt),
    expectedPhase: attempt.phase, verdict: 'NEEDS_REVIEW',
    judgment: 'run_ended_no_submission', reason: 'injected ended turn without submission' })
  assert.equal(result.committed, true)
  return ledger.get(VISIT)
}

export function staleInput(attempt) {
  return { nodeVisitId: VISIT, ...identity(attempt),
    expected: { state: attempt.state, phase: attempt.phase, deliveredAtMs: attempt.delivered.atMs },
    observedWorkflowStateVersion: attempt.workflowStateVersionAtDispatch }
}

export async function advance(ledger, attempt, { terminal = false, ownerResume = false } = {}) {
  if (!ownerResume) assert.equal((await ledger.recordStaleSuperseded(staleInput(attempt))).committed, true)
  const next = await delivered(ledger, { ownerResume })
  assert.equal(next.generation, (attempt.generation ?? 1) + 1)
  assert.notEqual(next.attemptId, attempt.attemptId)
  assert.equal(next.delivered.atMs, attempt.delivered.atMs)
  return terminal ? runEnded(ledger, next) : next
}

export function ownerEvidence() {
  return { dispatchIntentId: INTENT, workflowInstanceId: INSTANCE, nodeVisitId: VISIT,
    ownerPrincipalId: OWNER, activationState: 'ACTIVE', workflowStateVersion: 12,
    assistanceCaseId: '6d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77',
    requestEventSequence: 10, resolutionEventSequence: 11,
    requesterPrincipalId: OWNER, resolverPrincipalId: '7d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e88',
    ingress: 'assignee', reason: null, lastAttemptId: null }
}

export function barrier(result) {
  let entered, release
  const arrived = new Promise((resolve) => { entered = resolve })
  const held = new Promise((resolve) => { release = resolve })
  return { arrived, release, call: async () => { entered(); await held; return result } }
}

export function engine(fx, overrides = {}) {
  const calls = { delivers: [], errors: [] }
  const result = createWorkflowExecutionEngine({
    ledger: fx.reader, clock: () => T0 + fx.age,
    config: { staleNoProgressThresholdMs: 1_000, retryDelayMs: 50 },
    log: { log() {}, warn() {}, error(message) { calls.errors.push(message) } },
    fetchDuePage: async () => ({ ok: true, items: [] }),
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
    deliverRun: async (request) => {
      calls.delivers.push(request)
      return { ok: true, sessionId: 'main', reconciliationHandle: `turn:${request.requestId}` }
    },
    getTurnReconciliation: () => ({ state: 'settled' }),
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    readInstanceDetail: async () => detail(),
    ...overrides,
  })
  return { engine: result, calls }
}

export async function snapshot(ledger) {
  return { attempts: structuredClone(await ledger.snapshotFresh()), bytes: readFileSync(ledger.eventsFile, 'utf8') }
}

export async function assertUnchanged(ledger, before) {
  assert.deepEqual(await snapshot(ledger), before, 'stale submission must preserve the entire current projection and event bytes')
}

export function assertStale(result, observed, kind) {
  assert.equal(result.committed, false)
  assert.equal(result.action, 'stale_observation')
  assert.equal(result.cause, 'stale_observation')
  assert.equal(result.observation.kind, kind)
  assert.equal(result.observation.expectedAttemptId, observed.attemptId)
  assert.equal(result.observation.expectedGeneration, observed.generation ?? 1)
  assert.equal(result.attempt.generation, 2)
}

export function receipt(t, name, observed, current, result) {
  t.diagnostic(JSON.stringify({ sourceSha: process.env.EKR_TEST_SOURCE_SHA ?? 'UNKNOWN', testName: name, scenario: name,
    faultInjection: 'old observation held; legal next generation committed; old observation released',
    observed: { attemptId: observed.attemptId, generation: observed.generation, phase: observed.phase },
    current: { attemptId: current.attemptId, generation: current.generation, phase: current.phase },
    expectedResult: 'stale_observation; current projection/log unchanged; legal same-generation commit accepted where exercised',
    actualResult: result.action, rawReceipt: result, currentProjectionAndBytesUnchanged: true,
    realFilesystemLedger: true, productionWrites: 0 }))
}
