/**
 * WORKFLOW_NODE_SESSION_HISTORY_V1 — root=workflow_node_visit focused tests:
 * given (workflowInstanceId, nodeVisitId) the read face returns the NodeVisit
 * HISTORICAL attempts (every ledger generation) as a stable coordinate-only
 * index. Coverage: multi-attempt/multi-generation, multi-session (pair
 * semantics per CTR-SCT-001), missing session (honest absence), stable
 * ordering (incl. colliding ledger timestamps), redaction (no journal
 * content in any face, audit ≡ self), svc visibility gate, closed error
 * table and the manifest shape.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { queryExecutionTrace } from '../src/index.js'
import { manifests } from '../../broker/src/capabilities/execution-history.js'
import { WF_ID, VISIT_ID_MG, MG_PRIVATE_TEXT, attemptIdFor, buildMultiGenerationVisitFixtureRoot, buildEqualTimestampsFixtureRoot, destroyFixtureRoot, fakeSvcRequest } from './fixtures.js'

const SELF_A = { agentId: 'agt_a', audit: false }
const AUDIT = { agentId: 'agt_audit', audit: true }

const T_MULTI = 1759000000000

test('multi-attempt: every ledger generation is returned, generation-ascending, with engine state', async () => {
  const fixture = buildMultiGenerationVisitFixtureRoot()
  try {
    const outcome = await queryExecutionTrace({
      root: 'workflow_node_visit',
      args: { workflowInstanceId: WF_ID, nodeVisitId: VISIT_ID_MG },
      viewer: AUDIT,
      paths: fixture.paths,
      svcRequest: fakeSvcRequest(),
    })
    assert.equal(outcome.ok, true, JSON.stringify(outcome))
    const attempts = outcome.result.attempts
    assert.equal(attempts.length, 3)
    assert.deepEqual(attempts.map((a) => a.generation), [1, 2, 3])
    assert.deepEqual(attempts.map((a) => a.attemptId), [fixture.attemptIds[1], fixture.attemptIds[2], fixture.attemptIds[3]])
    // Frozen engine state mapping, per generation (not just the current one).
    assert.deepEqual(attempts.map((a) => a.executionState), ['STALE_NO_PROGRESS', 'OUTCOME_UNKNOWN', 'RUNNING'])
    assert.deepEqual(attempts.map((a) => a.state), ['SETTLED', 'NEEDS_REVIEW', 'ACTIVE'])
    assert.equal(attempts[0].judgment, 'stale_no_progress')
    assert.equal(attempts[0].terminal, true)
    assert.equal(attempts[1].terminal, true)
    assert.equal(attempts[2].terminal, false)
    assert.equal(attempts[1].reason, 'settle_check_unavailable:receipt-lost')
    // Timeline carries one stable row per attempt + the svc visibility fact.
    const timelineKinds = outcome.result.timeline.map((t) => t.kind)
    assert.equal(timelineKinds.filter((k) => k === 'attempt_index_entry').length, 3)
  } finally { destroyFixtureRoot(fixture) }
})

test('sessionRef: persisted (agentId, sessionId) pairs only — pair semantics across agents, honest absence when no run_delivered', async () => {
  const fixture = buildMultiGenerationVisitFixtureRoot()
  try {
    const outcome = await queryExecutionTrace({
      root: 'workflow_node_visit',
      args: { workflowInstanceId: WF_ID, nodeVisitId: VISIT_ID_MG },
      viewer: AUDIT,
      paths: fixture.paths,
      svcRequest: fakeSvcRequest(),
    })
    assert.equal(outcome.ok, true, JSON.stringify(outcome))
    const attempts = outcome.result.attempts
    // gen1: exact persisted pair.
    assert.deepEqual(attempts[0].sessionRef, { agentId: 'agt_a', sessionId: 'main' })
    assert.equal(attempts[0].agentId, 'agt_a')
    assert.equal(attempts[0].journalReachable, true)
    // gen2: never delivered → NO sessionRef/agentId keys at all (never derived).
    assert.equal(attempts[1].sessionRef, undefined)
    assert.equal(attempts[1].agentId, undefined)
    assert.equal(attempts[1].messageId, undefined)
    // gen3: same 'main' session NAME on a DIFFERENT agent = a different
    // SessionRef (CTR-SCT-001: the pair is the key, never the bare id).
    assert.deepEqual(attempts[2].sessionRef, { agentId: 'agt_b', sessionId: 'main' })
    // gen3's coordinate is persisted but its journal is not locatable within
    // this query's reach — flagged + gapped, never claimed non-existent.
    assert.equal(attempts[2].journalReachable, false)
    assert.ok(outcome.result.gaps.some((g) => g.stage === 'session_journal' && g.code === 'CORRELATION_GAP' && g.reason.includes('agt_b/main')))
    // R3 correlations exist for exactly the delivered generations.
    const r3 = outcome.result.correlations.filter((c) => c.rule === 'R3')
    assert.equal(r3.length, 2)
    assert.ok(r3.some((c) => c.to.nativeRef === 'agt_a/main'))
    assert.ok(r3.some((c) => c.to.nativeRef === 'agt_b/main'))
  } finally { destroyFixtureRoot(fixture) }
})

test('message/receipt coordinates: each present only when the ledger persisted it', async () => {
  const fixture = buildMultiGenerationVisitFixtureRoot()
  try {
    const outcome = await queryExecutionTrace({
      root: 'workflow_node_visit',
      args: { workflowInstanceId: WF_ID, nodeVisitId: VISIT_ID_MG },
      viewer: AUDIT,
      paths: fixture.paths,
      svcRequest: fakeSvcRequest(),
    })
    assert.equal(outcome.ok, true, JSON.stringify(outcome))
    const attempts = outcome.result.attempts
    assert.deepEqual(
      { requestId: attempts[0].requestId, messageId: attempts[0].messageId, reconciliationHandle: attempts[0].reconciliationHandle },
      { requestId: 'req-mg-1', messageId: 'om_mg_1', reconciliationHandle: 'te-mg-1' },
    )
    assert.deepEqual(
      { requestId: attempts[2].requestId, messageId: attempts[2].messageId, reconciliationHandle: attempts[2].reconciliationHandle },
      { requestId: 'req-mg-3', messageId: undefined, reconciliationHandle: undefined },
    )
  } finally { destroyFixtureRoot(fixture) }
})

test('timestamps: startedAt from the planned row, finishedAt only when terminal', async () => {
  const fixture = buildMultiGenerationVisitFixtureRoot()
  try {
    const outcome = await queryExecutionTrace({
      root: 'workflow_node_visit',
      args: { workflowInstanceId: WF_ID, nodeVisitId: VISIT_ID_MG },
      viewer: AUDIT,
      paths: fixture.paths,
      svcRequest: fakeSvcRequest(),
    })
    assert.equal(outcome.ok, true, JSON.stringify(outcome))
    const attempts = outcome.result.attempts
    assert.equal(attempts[0].startedAtMs, T_MULTI + 1000)
    assert.equal(attempts[0].updatedAtMs, T_MULTI + 1200)
    assert.equal(attempts[0].finishedAtMs, T_MULTI + 1200)
    assert.equal(attempts[1].startedAtMs, T_MULTI + 2000)
    assert.equal(attempts[1].finishedAtMs, T_MULTI + 2100)
    assert.equal(attempts[2].startedAtMs, T_MULTI + 3000)
    assert.equal(attempts[2].updatedAtMs, T_MULTI + 3100)
    assert.equal(attempts[2].finishedAtMs, undefined)
  } finally { destroyFixtureRoot(fixture) }
})

test('stable ordering: colliding ledger timestamps still yield generation-ascending attempts and timeline', async () => {
  const fixture = buildEqualTimestampsFixtureRoot()
  try {
    const outcome = await queryExecutionTrace({
      root: 'workflow_node_visit',
      args: { workflowInstanceId: WF_ID, nodeVisitId: fixture.visit },
      viewer: AUDIT,
      paths: fixture.paths,
      svcRequest: fakeSvcRequest(),
    })
    assert.equal(outcome.ok, true, JSON.stringify(outcome))
    assert.deepEqual(outcome.result.attempts.map((a) => a.generation), [1, 2])
    assert.deepEqual(outcome.result.attempts.map((a) => a.attemptId), [fixture.attemptIds[1], fixture.attemptIds[2]])
    const indexRows = outcome.result.timeline.filter((t) => t.kind === 'attempt_index_entry')
    assert.deepEqual(indexRows.map((t) => t.nativeRefs.attemptId), [fixture.attemptIds[1], fixture.attemptIds[2]])
  } finally { destroyFixtureRoot(fixture) }
})

test('redaction: no journal content in any face; audit and self see the identical attempts index', async () => {
  const fixture = buildMultiGenerationVisitFixtureRoot()
  try {
    const auditOutcome = await queryExecutionTrace({
      root: 'workflow_node_visit',
      args: { workflowInstanceId: WF_ID, nodeVisitId: VISIT_ID_MG },
      viewer: AUDIT,
      paths: fixture.paths,
      svcRequest: fakeSvcRequest(),
    })
    const selfOutcome = await queryExecutionTrace({
      root: 'workflow_node_visit',
      args: { workflowInstanceId: WF_ID, nodeVisitId: VISIT_ID_MG },
      viewer: SELF_A,
      paths: fixture.paths,
      svcRequest: fakeSvcRequest(),
    })
    assert.equal(auditOutcome.ok, true)
    assert.equal(selfOutcome.ok, true)
    const dump = JSON.stringify(auditOutcome.result)
    assert.ok(!dump.includes('MG PRIVATE'), 'journal content leaked into the index')
    assert.ok(!dump.includes('diary'), 'journal content leaked into the index')
    assert.ok(!dump.includes('"content"'), 'message content field leaked into the index')
    // Coordinates are present; content never. SessionRef survives redaction.
    assert.ok(dump.includes('agt_a/main') || dump.includes('"agt_a"'))
    assert.deepEqual(selfOutcome.result.attempts, auditOutcome.result.attempts)
    // Report view (human rendering) is content-free too.
    const reportOutcome = await queryExecutionTrace({
      root: 'workflow_node_visit',
      args: { workflowInstanceId: WF_ID, nodeVisitId: VISIT_ID_MG, view: 'report' },
      viewer: SELF_A,
      paths: fixture.paths,
      svcRequest: fakeSvcRequest(),
    })
    assert.equal(reportOutcome.ok, true)
    assert.ok(!reportOutcome.result.report.includes('MG PRIVATE'))
  } finally { destroyFixtureRoot(fixture) }
})

test('closed errors: unknown visit / invisible instance / invalid arguments / absent ledger', async () => {
  const fixture = buildMultiGenerationVisitFixtureRoot()
  try {
    // Unknown (valid-UUID) visit under a visible instance → dedicated 404 code.
    const unknownVisit = await queryExecutionTrace({
      root: 'workflow_node_visit',
      args: { workflowInstanceId: WF_ID, nodeVisitId: '99999999-9999-4999-8999-999999999999' },
      viewer: AUDIT,
      paths: fixture.paths,
      svcRequest: fakeSvcRequest(),
    })
    assert.equal(unknownVisit.ok, false)
    assert.equal(unknownVisit.code, 'workflow_node_visit_not_found')

    // Self scope + instance invisible to the caller → same 404 (svc gate,
    // existence never leaked). Audit scope still reads the local ledger.
    const invisibleSelf = await queryExecutionTrace({
      root: 'workflow_node_visit',
      args: { workflowInstanceId: WF_ID, nodeVisitId: VISIT_ID_MG },
      viewer: SELF_A,
      paths: fixture.paths,
      svcRequest: fakeSvcRequest({ visible: false }),
    })
    assert.equal(invisibleSelf.ok, false)
    assert.equal(invisibleSelf.code, 'workflow_node_visit_not_found')
    const invisibleAudit = await queryExecutionTrace({
      root: 'workflow_node_visit',
      args: { workflowInstanceId: WF_ID, nodeVisitId: VISIT_ID_MG },
      viewer: AUDIT,
      paths: fixture.paths,
      svcRequest: fakeSvcRequest({ visible: false }),
    })
    assert.equal(invisibleAudit.ok, true)
    assert.equal(invisibleAudit.result.attempts.length, 3)

    // Argument validation: non-UUID nodeVisitId / missing workflowInstanceId.
    const badVisit = await queryExecutionTrace({
      root: 'workflow_node_visit',
      args: { workflowInstanceId: WF_ID, nodeVisitId: 'not-a-uuid' },
      viewer: AUDIT, paths: fixture.paths, svcRequest: fakeSvcRequest(),
    })
    assert.equal(badVisit.ok, false)
    assert.equal(badVisit.code, 'invalid_arguments')
    const missingInstance = await queryExecutionTrace({
      root: 'workflow_node_visit',
      args: { nodeVisitId: VISIT_ID_MG },
      viewer: AUDIT, paths: fixture.paths, svcRequest: fakeSvcRequest(),
    })
    assert.equal(missingInstance.ok, false)
    assert.equal(missingInstance.code, 'invalid_arguments')

    // Absent ledger: the honest answer is history_unavailable — never a
    // claim that the visit does not exist.
    const noLedgerFixture = buildNoLedgerFixture()
    try {
      const absent = await queryExecutionTrace({
        root: 'workflow_node_visit',
        args: { workflowInstanceId: WF_ID, nodeVisitId: VISIT_ID_MG },
        viewer: AUDIT,
        paths: noLedgerFixture.paths,
        svcRequest: fakeSvcRequest(),
      })
      assert.equal(absent.ok, false)
      assert.equal(absent.code, 'history_unavailable')
    } finally { destroyFixtureRoot(noLedgerFixture) }
  } finally { destroyFixtureRoot(fixture) }
})

function buildNoLedgerFixture() {
  const fixture = buildMultiGenerationVisitFixtureRoot()
  rmSync(join(fixture.paths.workflowExecutionDir, 'attempts.jsonl'), { force: true })
  return fixture
}

test('business truth stays out of scope: no agent self-report and no fabricated svc facts enter the index', async () => {
  const fixture = buildMultiGenerationVisitFixtureRoot()
  try {
    const outcome = await queryExecutionTrace({
      root: 'workflow_node_visit',
      args: { workflowInstanceId: WF_ID, nodeVisitId: VISIT_ID_MG },
      viewer: AUDIT,
      paths: fixture.paths,
      svcRequest: fakeSvcRequest(),
    })
    assert.equal(outcome.ok, true)
    const dump = JSON.stringify(outcome.result.attempts)
    // The svc fixture's transition command fact (cmd-trans-2) is business
    // truth from the timeline — it must not leak into the attempts index.
    assert.ok(!dump.includes('cmd-trans-2'))
    // businessProgress verdict stays UNKNOWN with the explicit out-of-scope gap.
    assert.equal(outcome.result.summary.fiveDimensions.businessProgress.verdict, 'UNKNOWN')
    assert.ok(outcome.result.gaps.some((g) => g.stage === 'svc_timeline' && g.code === 'SOURCE_ABSENT'))
  } finally { destroyFixtureRoot(fixture) }
})

test('manifest: the new root, its argument and its error code are declared on both query tools', () => {
  for (const manifest of manifests.filter((m) => m.id === 'execution_trace_query' || m.id === 'execution_history_audit_query')) {
    const operation = manifest.operations[0]
    assert.equal(manifest.selector, 'operation')
    const { root, workflowInstanceId, nodeVisitId } = operation.arguments.properties
    assert.ok(root.enum.includes('workflow_node_visit'), `${manifest.id}: root enum misses workflow_node_visit`)
    assert.equal(operation.arguments.additionalProperties, false)
    assert.ok(nodeVisitId, `${manifest.id}: nodeVisitId argument not declared`)
    assert.ok(workflowInstanceId.description.includes('workflow_node_visit'))
    assert.ok(manifest.errors.some((e) => e.code === 'workflow_node_visit_not_found'), `${manifest.id}: error code not declared`)
  }
})
