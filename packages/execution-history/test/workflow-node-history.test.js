/**
 * WORKFLOW_NODE_SESSION_HISTORY read face — focused tests for the read-only
 * workflow-node attempt-history index (node_history operation on the
 * execution-history broker family). Isolated temp-root fixtures, zero
 * production side-effects. Coverage: multi-attempt (every ledger generation),
 * multi-session (per-generation SessionRefs), missing session (no receipt ⇒
 * no SessionRef, never fabricated), stable ordering, index-only redaction
 * (no journal is opened), svc visibility gate, closed error surface, and the
 * runtime handler wiring (fail-closed validation + audit/self split).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { queryWorkflowNodeHistory } from '../src/index.js'
import { attemptIdFor } from './fixtures.js'
import { executionTraceQueryManifest, executionHistoryAuditQueryManifest } from '../../broker/src/capabilities/execution-history.js'
import { createExecutionHistoryRuntime } from '../../production-runtime/src/execution-history/runtime.js'

const WF_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WF_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const V_MULTI = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' // gen1 → stale → gen2 (multi-session)
const V_NO_SESSION = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' // delivery_failed, never delivered
const V_BLOCKED = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' // resolution_blocked, never delivered
const V_REVIEW = 'ffffffff-ffff-4fff-8fff-ffffffffffff' // reconciled NEEDS_REVIEW run_ended_no_submission
const V_OTHER_WF = 'abababab-abab-4bab-8bab-abababababab' // belongs to WF_B — scoping guard
const V_UNKNOWN = '12345678-1234-4123-8123-456789abcdef' // never in the ledger

const A1 = attemptIdFor(V_MULTI, 1)
const A2 = attemptIdFor(V_MULTI, 2)
const T = 1758100000000

const PRIVATE_MARKER = 'agt_a-private-diary-DO-NOT-LEAK-9f2c'

function writeLedger(dir, rows) {
  writeFileSync(join(dir, 'attempts.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
}

function buildFixtureRoot({ withLedger = true, withJournal = true } = {}) {
  const root = join(tmpdir(), `wf-node-history-${process.pid}-${Math.random().toString(36).slice(2, 8)}`)
  const controlDir = join(root, 'control')
  const homesRoot = join(root, 'homes')
  const historyDir = join(root, 'scheduler', 'history')
  const workflowExecutionDir = join(root, 'workflow-execution')
  mkdirSync(controlDir, { recursive: true })
  mkdirSync(historyDir, { recursive: true })
  mkdirSync(workflowExecutionDir, { recursive: true })
  if (withLedger) {
    writeLedger(workflowExecutionDir, [
      // V_MULTI gen1: planned → delivered to (agt_a, main) → stale_superseded.
      { kind: 'attempt_planned', attemptId: A1, nodeVisitId: V_MULTI, dispatchIntentId: 'i-multi-1', workflowInstanceId: WF_A, ownerPrincipalId: 'p-owner-1', generation: 1, atMs: T + 100 },
      { kind: 'delivery_started', nodeVisitId: V_MULTI, atMs: T + 110 },
      { kind: 'run_delivered', nodeVisitId: V_MULTI, attemptId: A1, agentId: 'agt_a', requestId: A1, sessionId: 'main', messageId: 'om_node_gen1', reconciliationHandle: 'te-node-gen1', atMs: T + 200 },
      { kind: 'stale_superseded', nodeVisitId: V_MULTI, observedWorkflowStateVersion: 3, atMs: T + 300 },
      // V_MULTI gen2: re-plan delivered to a DIFFERENT session (agt_b, main).
      { kind: 'attempt_planned', attemptId: A2, nodeVisitId: V_MULTI, dispatchIntentId: 'i-multi-2', workflowInstanceId: WF_A, ownerPrincipalId: 'p-owner-1', generation: 2, atMs: T + 400 },
      { kind: 'delivery_started', nodeVisitId: V_MULTI, atMs: T + 410 },
      { kind: 'run_delivered', nodeVisitId: V_MULTI, attemptId: A2, agentId: 'agt_b', requestId: A2, sessionId: 'main', messageId: 'om_node_gen2', reconciliationHandle: 'te-node-gen2', atMs: T + 500 },
      { kind: 'reconciled', nodeVisitId: V_MULTI, verdict: 'SETTLED', judgment: 'workflow_progressed', reason: 'business progressed', atMs: T + 600 },
      // V_NO_SESSION: planned → delivered-fence → delivery_failed (post-invocation).
      { kind: 'attempt_planned', attemptId: attemptIdFor(V_NO_SESSION, 1), nodeVisitId: V_NO_SESSION, dispatchIntentId: 'i-ns-1', workflowInstanceId: WF_A, ownerPrincipalId: 'p-owner-1', generation: 1, atMs: T + 700 },
      { kind: 'delivery_started', nodeVisitId: V_NO_SESSION, atMs: T + 710 },
      { kind: 'delivery_failed', nodeVisitId: V_NO_SESSION, attemptId: attemptIdFor(V_NO_SESSION, 1), reason: 'deliver_failed:transport', atMs: T + 720 },
      // V_BLOCKED: planned → resolution_blocked (never delivered).
      { kind: 'attempt_planned', attemptId: attemptIdFor(V_BLOCKED, 1), nodeVisitId: V_BLOCKED, dispatchIntentId: 'i-bl-1', workflowInstanceId: WF_A, ownerPrincipalId: 'p-owner-1', generation: 1, atMs: T + 800 },
      { kind: 'resolution_blocked', nodeVisitId: V_BLOCKED, code: 'agent_unresolved', atMs: T + 810 },
      // V_REVIEW: delivered → reconciled NEEDS_REVIEW run_ended_no_submission.
      { kind: 'attempt_planned', attemptId: attemptIdFor(V_REVIEW, 1), nodeVisitId: V_REVIEW, dispatchIntentId: 'i-rv-1', workflowInstanceId: WF_A, ownerPrincipalId: 'p-owner-1', generation: 1, atMs: T + 900 },
      { kind: 'run_delivered', nodeVisitId: V_REVIEW, attemptId: attemptIdFor(V_REVIEW, 1), agentId: 'agt_c', requestId: attemptIdFor(V_REVIEW, 1), sessionId: 'side', atMs: T + 910 },
      { kind: 'reconciled', nodeVisitId: V_REVIEW, verdict: 'NEEDS_REVIEW', judgment: 'run_ended_no_submission', reason: 'run ended without a workflow transition', atMs: T + 920 },
      // A different instance's visit — must never leak into WF_A queries.
      { kind: 'attempt_planned', attemptId: attemptIdFor(V_OTHER_WF, 1), nodeVisitId: V_OTHER_WF, dispatchIntentId: 'i-oth-1', workflowInstanceId: WF_B, ownerPrincipalId: 'p-owner-2', generation: 1, atMs: T + 950 },
    ])
  }
  if (withJournal) {
    // A real journal for (agt_a, main) with private content: the index face
    // must never open it — asserted via the private marker.
    const projKey = '--Users-fixture--'
    mkdirSync(join(homesRoot, 'agt_a', 'sessions', projKey, 'main'), { recursive: true })
    writeFileSync(join(homesRoot, 'agt_a', 'sessions', projKey, 'main', 'session.jsonl'), [
      { type: 'session', version: 0, id: 'main', createdAt: T, cwd: '/tmp/wf' },
      { type: 'user/message', seq: 1, time: new Date(T + 1).toISOString(), data: { content: PRIVATE_MARKER, source: { kind: 'workflow_execution', workflowInstanceId: WF_A, nodeVisitId: V_MULTI, attemptId: A1 }, messageId: 'om_node_gen1' } },
    ].map((e) => JSON.stringify(e)).join('\n') + '\n')
  }
  return {
    root,
    paths: {
      homesRoot,
      controlDir,
      historyDir,
      jobsStore: join(root, 'scheduler', 'jobs.json'),
      workflowExecutionDir,
      evidenceLog: join(controlDir, 'runtime-evidence.jsonl'),
    },
  }
}

function destroyFixtureRoot(fixture) {
  try { rmSync(fixture.root, { recursive: true, force: true }) } catch { /* tmp best-effort */ }
}

function fakeSvc({ visible = true } = {}) {
  return async (_agentId, req) => {
    if (!visible) return { ok: false, code: 'downstream_unavailable', detail: 'not visible' }
    if (req.path.includes('/workflow-instances/')) {
      return { ok: true, body: { visibility: 'full', detail: { workflowInstanceId: 'wf', currentStateVersion: 3, createdAt: new Date(T).toISOString() } } }
    }
    return { ok: false, code: 'downstream_unavailable' }
  }
}

const SELF = { agentId: 'agt_a', audit: false }
const AUDIT = { agentId: 'agt_a', audit: true }

test('node_history: every generation is listed, stably sorted, with the supersession chain', async () => {
  const fixture = buildFixtureRoot()
  try {
    const first = await queryWorkflowNodeHistory({
      workflowInstanceId: WF_A, nodeVisitId: V_MULTI, viewer: AUDIT, paths: fixture.paths, svcRequest: fakeSvc(),
    })
    assert.equal(first.ok, true)
    const { attempts } = first.result
    assert.equal(attempts.length, 2, 'both generations preserved (T1 invariant)')
    assert.deepEqual(attempts.map((a) => a.generation), [1, 2], 'stable (generation asc) order')
    assert.equal(attempts[0].attemptId, A1)
    assert.equal(attempts[1].attemptId, A2)
    assert.equal(attempts[0].supersededBy, A2, 'gen1 carries the persisted supersession pointer')
    assert.equal(attempts[1].supersededBy, undefined)
    assert.equal(attempts[0].execution.state, 'STALE_NO_PROGRESS')
    assert.equal(attempts[0].execution.judgment, 'stale_no_progress')
    assert.equal(attempts[1].execution.state, 'SETTLED')
    assert.equal(attempts[1].execution.judgment, 'workflow_progressed')
    // Times: started = attempt_planned, finished = terminal event, updated = last event.
    assert.equal(attempts[0].startedAtMs, T + 100)
    assert.equal(attempts[0].finishedAtMs, T + 300)
    assert.equal(attempts[0].updatedAtMs, T + 300)
    assert.equal(attempts[1].startedAtMs, T + 400)
    assert.equal(attempts[1].finishedAtMs, T + 600)
    // Delivery coordinates + receipt refs per generation.
    assert.deepEqual(attempts[0].delivery, { requestId: A1, reconciliationHandle: 'te-node-gen1', messageId: 'om_node_gen1', receiptKind: 'run_delivered', receiptAtMs: T + 200 })
    assert.equal(attempts[1].delivery.messageId, 'om_node_gen2')
    // Stable across repeated queries on the same boundary.
    const second = await queryWorkflowNodeHistory({
      workflowInstanceId: WF_A, nodeVisitId: V_MULTI, viewer: AUDIT, paths: fixture.paths, svcRequest: fakeSvc(),
    })
    assert.deepEqual(second.result.attempts, attempts, 'repeated query → identical stable order')
  } finally { destroyFixtureRoot(fixture) }
})

test('node_history: multi-session history — each generation carries its own SessionRef', async () => {
  const fixture = buildFixtureRoot()
  try {
    const outcome = await queryWorkflowNodeHistory({
      workflowInstanceId: WF_A, nodeVisitId: V_MULTI, viewer: AUDIT, paths: fixture.paths, svcRequest: fakeSvc(),
    })
    assert.equal(outcome.ok, true)
    const [gen1, gen2] = outcome.result.attempts
    assert.deepEqual(gen1.sessionRef, { agentId: 'agt_a', sessionId: 'main' })
    assert.deepEqual(gen2.sessionRef, { agentId: 'agt_b', sessionId: 'main' })
    assert.notDeepEqual(gen1.sessionRef, gen2.sessionRef, 're-delivery to a different session stays distinct (CTR-SCT-001 keys)')
    assert.equal(gen1.agentId, 'agt_a')
    assert.equal(gen2.agentId, 'agt_b')
  } finally { destroyFixtureRoot(fixture) }
})

test('node_history: missing session — no receipt ⇒ no SessionRef, no fabricated coordinates', async () => {
  const fixture = buildFixtureRoot()
  try {
    const failed = await queryWorkflowNodeHistory({
      workflowInstanceId: WF_A, nodeVisitId: V_NO_SESSION, viewer: AUDIT, paths: fixture.paths, svcRequest: fakeSvc(),
    })
    assert.equal(failed.ok, true)
    const [entry] = failed.result.attempts
    assert.equal(entry.sessionRef, null)
    assert.equal(entry.agentId, undefined, 'no agentId without a run_delivered receipt')
    assert.equal(entry.delivery, null)
    assert.equal(entry.execution.state, 'OUTCOME_UNKNOWN', 'post-invocation delivery_failed is an unknown-outcome class (CTR-WEC1-002)')
    assert.equal(entry.finishedAtMs, T + 720)
    assert.ok(!JSON.stringify(failed.result).includes('sessionId":'), 'no sessionId anywhere in a never-delivered answer')

    const blocked = await queryWorkflowNodeHistory({
      workflowInstanceId: WF_A, nodeVisitId: V_BLOCKED, viewer: AUDIT, paths: fixture.paths, svcRequest: fakeSvc(),
    })
    assert.equal(blocked.ok, true)
    const [blockedEntry] = blocked.result.attempts
    assert.equal(blockedEntry.sessionRef, null)
    assert.equal(blockedEntry.execution.state, 'BLOCKED')
    assert.equal(blockedEntry.execution.phase, 'resolution_blocked')
    assert.equal(blockedEntry.execution.blockedCode, 'agent_unresolved')

    const review = await queryWorkflowNodeHistory({
      workflowInstanceId: WF_A, nodeVisitId: V_REVIEW, viewer: AUDIT, paths: fixture.paths, svcRequest: fakeSvc(),
    })
    assert.equal(review.ok, true)
    assert.equal(review.result.attempts[0].execution.state, 'RUN_ENDED_NO_TRANSITION')
    assert.deepEqual(review.result.attempts[0].sessionRef, { agentId: 'agt_c', sessionId: 'side' })
    assert.equal(review.result.attempts[0].delivery.messageId, null, 'delivered without messageId = visible receipt loss (CTR-SCT-006), never fabricated')
  } finally { destroyFixtureRoot(fixture) }
})

test('node_history: index-only redaction — the journal is never opened, no content surfaces', async () => {
  const fixture = buildFixtureRoot()
  try {
    const outcome = await queryWorkflowNodeHistory({
      workflowInstanceId: WF_A, nodeVisitId: V_MULTI, viewer: SELF, paths: fixture.paths, svcRequest: fakeSvc(),
    })
    assert.equal(outcome.ok, true)
    const text = JSON.stringify(outcome.result)
    assert.ok(!text.includes(PRIVATE_MARKER), 'private journal text never leaks through the index face')
    assert.ok(!text.includes('"content"'), 'no content field at all — coordinates only (§4.3)')
    assert.ok(!text.includes('session.jsonl'), 'no journal file was read into the result')
  } finally { destroyFixtureRoot(fixture) }
})

test('node_history: svc visibility gates self scope; audit proceeds on local facts with explicit gaps', async () => {
  const fixture = buildFixtureRoot()
  try {
    const selfOutcome = await queryWorkflowNodeHistory({
      workflowInstanceId: WF_A, nodeVisitId: V_MULTI, viewer: SELF, paths: fixture.paths, svcRequest: fakeSvc({ visible: false }),
    })
    assert.equal(selfOutcome.ok, false)
    assert.equal(selfOutcome.code, 'workflow_instance_not_found')

    const auditOutcome = await queryWorkflowNodeHistory({
      workflowInstanceId: WF_A, nodeVisitId: V_MULTI, viewer: AUDIT, paths: fixture.paths, svcRequest: fakeSvc({ visible: false }),
    })
    assert.equal(auditOutcome.ok, true, 'audit scope proceeds on local ledger facts')
    assert.equal(auditOutcome.result.readBoundary.svcVisibility, 'not_visible')
    assert.ok(auditOutcome.result.gaps.some((g) => g.stage === 'svc_instance_detail'))
  } finally { destroyFixtureRoot(fixture) }
})

test('node_history: instance scoping + unknown visit answers honestly (empty + CORRELATION_GAP)', async () => {
  const fixture = buildFixtureRoot()
  try {
    const cross = await queryWorkflowNodeHistory({
      workflowInstanceId: WF_A, nodeVisitId: V_OTHER_WF, viewer: AUDIT, paths: fixture.paths, svcRequest: fakeSvc(),
    })
    assert.equal(cross.ok, true)
    assert.equal(cross.result.attempts.length, 0, "another instance's visit never leaks")
    assert.ok(cross.result.gaps.some((g) => g.code === 'CORRELATION_GAP' && g.stage === 'dispatch_attempts'))

    const unknown = await queryWorkflowNodeHistory({
      workflowInstanceId: WF_A, nodeVisitId: V_UNKNOWN, viewer: AUDIT, paths: fixture.paths, svcRequest: fakeSvc(),
    })
    assert.equal(unknown.ok, true)
    assert.deepEqual(unknown.result.attempts, [])
    assert.ok(unknown.result.gaps.some((g) => g.code === 'CORRELATION_GAP'), 'absence is reported, never read as "did not happen" (§5)')
  } finally { destroyFixtureRoot(fixture) }
})

test('node_history: every consulted source absent → history_unavailable; arguments fail closed', async () => {
  const fixture = buildFixtureRoot({ withLedger: false })
  try {
    const outcome = await queryWorkflowNodeHistory({
      workflowInstanceId: WF_A, nodeVisitId: V_MULTI, viewer: AUDIT, paths: fixture.paths,
    })
    assert.equal(outcome.ok, false)
    assert.equal(outcome.code, 'history_unavailable')

    const badUuid = await queryWorkflowNodeHistory({
      workflowInstanceId: 'not-a-uuid', nodeVisitId: V_MULTI, viewer: AUDIT, paths: fixture.paths,
    })
    assert.equal(badUuid.ok, false)
    assert.equal(badUuid.code, 'invalid_arguments')

    const noViewer = await queryWorkflowNodeHistory({
      workflowInstanceId: WF_A, nodeVisitId: V_MULTI, viewer: { audit: true }, paths: fixture.paths,
    })
    assert.equal(noViewer.ok, false)
    assert.equal(noViewer.code, 'forbidden_not_owner')
  } finally { destroyFixtureRoot(fixture) }
})

test('broker manifests: node_history is declared on both query tools with a closed argument set', () => {
  for (const manifest of [executionTraceQueryManifest, executionHistoryAuditQueryManifest]) {
    const op = manifest.operations.find((candidate) => candidate.name === 'node_history')
    assert.ok(op, `${manifest.toolName} exposes node_history`)
    assert.deepEqual(op.arguments.required, ['workflowInstanceId', 'nodeVisitId'])
    assert.equal(op.arguments.additionalProperties, false)
    assert.deepEqual(Object.keys(op.arguments.properties), ['workflowInstanceId', 'nodeVisitId'])
    assert.ok(op.arguments.properties.workflowInstanceId, 'UUID-typed argument descriptions present')
    const declared = new Set(manifest.errors.map((e) => e.code))
    for (const code of op.errors) assert.ok(declared.has(code), `${code} is in the closed manifest error table`)
  }
  const queryOp = executionTraceQueryManifest.operations.find((candidate) => candidate.name === 'query')
  assert.ok(queryOp, 'the pre-existing query operation is unchanged')
  assert.deepEqual(queryOp.arguments.required, ['root'])
})

test('runtime wiring: node_history handler is mounted for both scopes, validates fail-closed, and gates self scope', async () => {
  const fixture = buildFixtureRoot()
  try {
    let provided
    const runtime = createExecutionHistoryRuntime({
      layout: fixture.paths,
      credentialsFile: join(fixture.root, 'no-such-credentials.json'),
      authServiceOrigin: 'http://127.0.0.1:1',
      log: { error: () => {} },
    })
    runtime.mount({ provide: (name, value) => { provided = value } })
    const handlers = provided.handlers
    const selfHandler = handlers.execution_trace_query.node_history
    const auditHandler = handlers.execution_history_audit_query.node_history
    assert.ok(typeof selfHandler === 'function' && typeof auditHandler === 'function', 'node_history wired on both capability ids')

    const bad = await selfHandler({ workflowInstanceId: 'nope' }, { agentId: 'agt_a' })
    assert.equal(bad.ok, false)
    assert.equal(bad.error.code, 'invalid_arguments', 'fail-closed validation (direct parent-RPC discipline)')

    const extra = await selfHandler({ workflowInstanceId: WF_A, nodeVisitId: V_MULTI, cursor: 'x' }, { agentId: 'agt_a' })
    assert.equal(extra.ok, false)
    assert.equal(extra.error.code, 'invalid_arguments', 'unknown keys are refused, never dropped')

    // No credential is bound → svc read degrades → self scope answers 404
    // (visibility cannot be proven), audit proceeds on local ledger facts.
    const selfOutcome = await selfHandler({ workflowInstanceId: WF_A, nodeVisitId: V_MULTI }, { agentId: 'agt_a' })
    assert.equal(selfOutcome.ok, false)
    assert.equal(selfOutcome.error.code, 'workflow_instance_not_found')

    const auditOutcome = await auditHandler({ workflowInstanceId: WF_A, nodeVisitId: V_MULTI }, { agentId: 'agt_a' })
    assert.equal(auditOutcome.ok, true)
    assert.equal(auditOutcome.result.attempts.length, 2)
    assert.deepEqual(auditOutcome.result.attempts.map((a) => a.generation), [1, 2])
  } finally { destroyFixtureRoot(fixture) }
})

// ── #724 report-side submission-gap presentation ────────────────────────────
// SYNTHETIC_ONLY: no readable natural execution history existed at execution
// time. Only a TRULY same-attempt correlated structured tool result may feed
// the diagnosis; sibling-attempt, uncorrelated, and non-JSON evidence stays an
// explicit gap. The renderer is value-free by construction (the diagnosis
// contract carries only categories, field paths, error codes, request refs).

import * as reportNs from '../src/report.js'
import * as judgmentMod from '../../workflow-execution/src/judgment.js'

const GAP_ATTEMPT_ID = `wfeat-${'7'.repeat(24)}`
const GAP_ATTEMPT = { attemptId: GAP_ATTEMPT_ID, nodeVisitId: V_MULTI, workflowInstanceId: WF_A, phase: 'run_delivered' }

function gapSessionView({ resultText, instanceId = WF_A, seq = 2, isError = true } = {}) {
  return {
    toolCalls: [
      { seq: 1, name: 'workflow_execute', coordinates: { tool: 'workflow_execute', workflowInstanceId: instanceId, transitionDefinitionId: 'td-1', expectedWorkflowStateVersion: 3 } },
      { seq, kind: 'result', isError, coordinates: { workflowInstanceId: instanceId }, resultText },
    ],
  }
}

test('#724-R1 a truly same-attempt correlated structured result feeds the diagnosis (STALE_VERSION end-to-end)', () => {
  assert.equal(typeof reportNs.collectSubmissionGapEvidence, 'function', 'collectSubmissionGapEvidence missing (#724)')
  const view = gapSessionView({ resultText: JSON.stringify({ ok: false, error: { code: 'workflow_state_version_conflict', requestId: 'req-r1' } }) })
  const ev = reportNs.collectSubmissionGapEvidence({ attempt: GAP_ATTEMPT, sessionView: view, correlationRefs: [GAP_ATTEMPT_ID] })
  assert.equal(ev.ok, true)
  assert.equal(ev.input.evidenceStatus, 'readable')
  assert.equal(ev.input.lastToolResult.error.code, 'workflow_state_version_conflict')
  assert.ok(typeof reportNs.renderSubmissionGapDiagnosis === 'function', 'renderSubmissionGapDiagnosis missing (#724)')
  const d = judgmentMod.diagnoseSubmissionGap?.({ ...{ attempt: GAP_ATTEMPT }, ...ev.input, evidenceStatus: ev.input.evidenceStatus, settle: { kind: 'still_current', reason: 'node_visit_still_current' } })
    ?? (assert.fail('diagnoseSubmissionGap missing (#724)'), null)
  assert.equal(d.category, 'STALE_VERSION')
  const text = reportNs.renderSubmissionGapDiagnosis(d)
  assert.match(text, /STALE_VERSION/)
  assert.match(text, /req-r1/)
})

test('#724-R2 sibling-instance results and uncorrelated views never become this attempt\'s cause', () => {
  assert.equal(typeof reportNs.collectSubmissionGapEvidence, 'function', 'collectSubmissionGapEvidence missing (#724)')
  const sibling = reportNs.collectSubmissionGapEvidence({
    attempt: GAP_ATTEMPT,
    sessionView: gapSessionView({ instanceId: WF_B, resultText: JSON.stringify({ ok: false, error: { code: 'submission_validation_failed' } }) }),
    correlationRefs: [GAP_ATTEMPT_ID],
  })
  assert.equal(sibling.ok, false)
  assert.ok(sibling.missingEvidence.length > 0)
  const uncorrelated = reportNs.collectSubmissionGapEvidence({
    attempt: GAP_ATTEMPT,
    sessionView: gapSessionView({ resultText: JSON.stringify({ ok: false, error: { code: 'submission_validation_failed' } }) }),
    correlationRefs: [`wfeat-${'8'.repeat(24)}`],
  })
  assert.equal(uncorrelated.ok, false)
  assert.ok(uncorrelated.missingEvidence.some((m) => /not correlated/i.test(m)), 'missing R3-style correlation is named')
})

test('#724-R3 non-JSON / coordinate-less tool results degrade to unreadable evidence gaps, never to a cause', () => {
  assert.equal(typeof reportNs.collectSubmissionGapEvidence, 'function', 'collectSubmissionGapEvidence missing (#724)')
  const nonJson = reportNs.collectSubmissionGapEvidence({ attempt: GAP_ATTEMPT, sessionView: gapSessionView({ resultText: '模型说完成了' }), correlationRefs: [GAP_ATTEMPT_ID] })
  assert.equal(nonJson.ok, true)
  assert.equal(nonJson.input.evidenceStatus, 'unreadable')
  const d = judgmentMod.diagnoseSubmissionGap?.({ attempt: GAP_ATTEMPT, settle: { kind: 'still_current', reason: 'node_visit_still_current' }, lastToolResult: nonJson.input.lastToolResult, evidenceStatus: nonJson.input.evidenceStatus })
    ?? (assert.fail('diagnoseSubmissionGap missing (#724)'), null)
  assert.equal(d.category, 'OUTCOME_UNKNOWN')
  const noCoords = reportNs.collectSubmissionGapEvidence({
    attempt: GAP_ATTEMPT,
    sessionView: { toolCalls: [{ seq: 2, kind: 'result', isError: true, resultText: JSON.stringify({ ok: false, error: { code: 'transport_failure' } }) }] },
    correlationRefs: [GAP_ATTEMPT_ID],
  })
  assert.equal(noCoords.ok, false, 'a result without workflow coordinates cannot be tied to the attempt')
  assert.ok(noCoords.missingEvidence.length > 0)
})

test('#724-R4 renderer: no diagnosis => no section; output is deterministic and value-free', () => {
  assert.equal(typeof reportNs.renderSubmissionGapDiagnosis, 'function', 'renderSubmissionGapDiagnosis missing (#724)')
  assert.equal(reportNs.renderSubmissionGapDiagnosis(null), null)
  assert.equal(reportNs.renderSubmissionGapDiagnosis(undefined), null)
  const marker = 'SECRET-PAYLOAD-VALUE-MARKER-724'
  const d = judgmentMod.diagnoseSubmissionGap?.({
    attempt: GAP_ATTEMPT,
    settle: { kind: 'still_current', reason: 'node_visit_still_current' },
    lastToolResult: { attemptId: GAP_ATTEMPT_ID, nodeVisitId: V_MULTI, workflowInstanceId: WF_A, ok: false, error: { code: 'submission_validation_failed', fieldPaths: ['submissionPayload.amount'], requestId: 'req-r4', details: { received: marker } } },
    evidenceStatus: 'readable',
  }) ?? (assert.fail('diagnoseSubmissionGap missing (#724)'), null)
  const text1 = reportNs.renderSubmissionGapDiagnosis(d)
  const text2 = reportNs.renderSubmissionGapDiagnosis(d)
  assert.equal(text1, text2, 'deterministic rendering')
  assert.ok(!text1.includes(marker), 'payload values never reach the report')
  assert.match(text1, /submission_validation_failed/)
  assert.match(text1, /submissionPayload\.amount/, 'field PATHS are presentable')
})
