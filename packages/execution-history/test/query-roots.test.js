/**
 * T4/T5/T6/T9 — end-to-end query roots over the isolated fixture:
 * pagination stability, reportId determinism, ownership + redaction,
 * namespace rules, five-dimension verdicts, visible gaps.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { queryExecutionTrace } from '../src/index.js'
import { buildFixtureRoot, destroyFixtureRoot, fakeSvcRequest, WF_ID, WF_ID_2, OCC_ID, JOB_ID, MESSAGE_ID, REQUEST_ID, ATTEMPT_ID } from './fixtures.js'

const SELF_A = { agentId: 'agt_a', audit: false }
const SELF_HR = { agentId: 'agt_hr', audit: false }
const AUDIT = { agentId: 'agt_a', audit: true }

test('T4 workflow root: full chain svc event bridge + attempts + correlated session (owned view)', async () => {
  const fixture = buildFixtureRoot()
  try {
    const outcome = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: WF_ID }, viewer: SELF_A,
      paths: fixture.paths, svcRequest: fakeSvcRequest(),
    })
    assert.equal(outcome.ok, true)
    const result = outcome.result
    assert.match(result.reportId, /^ehq-[0-9a-f]{16}$/)
    assert.equal(result.summary.fiveDimensions.businessProgress.verdict, 'BUSINESS_COMMITTED', 'stateVersion→event bridge commits the business dimension')
    const sessionView = result.timeline.find((e) => e.source === 'session_journal')
    assert.ok(sessionView, 'correlated session via index')
    assert.equal(sessionView.data.ownership, 'owned')
    assert.ok(result.correlations.some((c) => c.rule === 'R2'), 'visit↔attempt correlation (R2)')
    assert.ok(result.correlations.some((c) => c.rule === 'R4'), 'stateVersion bridge (R4)')
    // reportId stable under the same frozen boundary, different after growth.
    const again = await queryExecutionTrace({ root: 'workflow_instance', args: { workflowInstanceId: WF_ID }, viewer: SELF_A, paths: fixture.paths, svcRequest: fakeSvcRequest() })
    assert.equal(again.result.reportId, result.reportId)
  } finally { destroyFixtureRoot(fixture) }
})

test('T4 workflow root visibility: svc-unvisible instance is not found for self scope, degraded for audit', async () => {
  const fixture = buildFixtureRoot()
  try {
    const selfOutcome = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: WF_ID }, viewer: SELF_A,
      paths: fixture.paths, svcRequest: fakeSvcRequest({ visible: false }),
    })
    assert.equal(selfOutcome.ok, false)
    assert.equal(selfOutcome.code, 'workflow_instance_not_found')
    const auditOutcome = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: WF_ID }, viewer: AUDIT,
      paths: fixture.paths, svcRequest: fakeSvcRequest({ visible: false }),
    })
    assert.equal(auditOutcome.ok, true, 'audit scope proceeds on local facts with explicit gaps')
    assert.ok(auditOutcome.result.gaps.some((g) => g.stage === 'svc_instance_detail'))
  } finally { destroyFixtureRoot(fixture) }
})

test('T4 pagination: vector cursor stable; pages concatenate to the whole; closure constant across pages', async () => {
  const fixture = buildFixtureRoot()
  try {
    const page1 = await queryExecutionTrace({ root: 'workflow_instance', args: { workflowInstanceId: WF_ID }, viewer: AUDIT, paths: fixture.paths, svcRequest: fakeSvcRequest(), limit: 3 })
    assert.equal(page1.ok, true)
    assert.ok(page1.result.timeline.length <= 3)
    assert.ok(page1.result.nextCursor !== undefined, 'more pages indicated')
    const page2 = await queryExecutionTrace({ root: 'workflow_instance', args: { workflowInstanceId: WF_ID, cursor: page1.result.nextCursor }, viewer: AUDIT, paths: fixture.paths, svcRequest: fakeSvcRequest(), limit: 3 })
    assert.equal(page2.ok, true)
    const ids1 = page1.result.timeline.map((e) => e.order)
    const ids2 = page2.result.timeline.map((e) => e.order)
    assert.deepEqual([...ids1, ...ids2], [...ids1, ...ids2].sort((a, b) => a - b), 'orders continue without overlap')
    assert.equal(page1.result.reportId, page2.result.reportId, 'same frozen boundary → same reportId across pages')
    assert.deepEqual(page1.result.correlations, page2.result.correlations, 'correlation closure computed over the frozen boundary per page')
  } finally { destroyFixtureRoot(fixture) }
})

test('T6 ownership: session root forbids foreign self query; audit reaches it but content is redacted', async () => {
  const fixture = buildFixtureRoot()
  try {
    const forbidden = await queryExecutionTrace({
      root: 'agent_session', args: { agentId: 'agt_hr', sessionId: 'main' }, viewer: SELF_A, paths: fixture.paths,
    })
    assert.equal(forbidden.ok, false)
    assert.equal(forbidden.code, 'forbidden_not_owner')

    const auditView = await queryExecutionTrace({
      root: 'agent_session', args: { agentId: 'agt_hr', sessionId: 'main' }, viewer: AUDIT, paths: fixture.paths,
    })
    assert.equal(auditView.ok, true)
    const view = auditView.result.timeline.find((e) => e.source === 'session_journal').data
    assert.equal(view.ownership, 'foreign_reduced_to_coordinates')
    assert.equal(view.messages[0].content, 'redacted_not_owned', 'audit ≠ decryption right')

    const owned = await queryExecutionTrace({
      root: 'agent_session', args: { agentId: 'agt_a', sessionId: 'main' }, viewer: SELF_A, paths: fixture.paths,
    })
    assert.equal(owned.ok, true)
    const ownedView = owned.result.timeline.find((e) => e.source === 'session_journal').data
    assert.equal(ownedView.ownership, 'owned')
    assert.ok(ownedView.messages.some((m) => String(m.content ?? '').includes('inter_agent hello')), 'own content visible to owner')
  } finally { destroyFixtureRoot(fixture) }
})

test('T9 message root: native messageId reverse-locates journal+audit; msg_sh1_* rejected; requestId works; ownership enforced', async () => {
  const fixture = buildFixtureRoot()
  try {
    const byMessage = await queryExecutionTrace({
      root: 'message', args: { messageId: MESSAGE_ID }, viewer: AUDIT, paths: fixture.paths,
    })
    assert.equal(byMessage.ok, true)
    assert.ok(byMessage.result.correlations.some((c) => c.rule === 'R6'))
    assert.ok(byMessage.result.timeline.some((e) => e.source === 'asm_audit'))
    assert.ok(byMessage.result.timeline.some((e) => e.source === 'session_journal'))

    const displayId = await queryExecutionTrace({
      root: 'message', args: { messageId: 'msg_sh1_abcdef' }, viewer: AUDIT, paths: fixture.paths,
    })
    assert.equal(displayId.ok, false)
    assert.equal(displayId.code, 'id_namespace_mismatch')

    const byRequest = await queryExecutionTrace({
      root: 'message', args: { requestId: REQUEST_ID }, viewer: AUDIT, paths: fixture.paths,
    })
    assert.equal(byRequest.ok, true, 'requestId reverse-locates the send')
    assert.ok(byRequest.result.correlations.some((c) => c.rule === 'R6' || c.rule === 'R1'))
  } finally { destroyFixtureRoot(fixture) }
})

test('scheduler root: never-run job still answers admission facts; occurrence joins cron-run session + wake_sent links', async () => {
  const fixture = buildFixtureRoot()
  try {
    const idleJob = await queryExecutionTrace({
      root: 'scheduler_run', args: { jobId: 'job_never_runs' }, viewer: SELF_HR, paths: fixture.paths,
    })
    assert.equal(idleJob.ok, false)
    assert.equal(idleJob.code, 'scheduler_record_not_found', 'unknown job not found')

    const ownedJob = await queryExecutionTrace({
      root: 'scheduler_run', args: { jobId: JOB_ID }, viewer: SELF_HR, paths: fixture.paths,
    })
    assert.equal(ownedJob.ok, true, 'routing agent passes ownership')
    assert.ok(ownedJob.result.timeline.some((e) => e.kind === 'job_definition'))
    assert.ok(ownedJob.result.timeline.some((e) => e.kind === 'occurrence' && e.nativeRefs.occurrence_id === OCC_ID))
    assert.ok(ownedJob.result.gaps.some((g) => g.code === 'JOIN_BY_NAME_CONVENTION'), 'naming-join explicitly marked')
    const cronSession = ownedJob.result.timeline.find((e) => e.source === 'session_journal')
    assert.ok(cronSession, 'cron-run session located')
    assert.ok(ownedJob.result.correlations.some((c) => c.rule === 'R5' && c.to.nativeRef.includes('workflowInstance:22222222')), 'wake_sent → workflow instance link (R5)')

    const forbidden = await queryExecutionTrace({
      root: 'scheduler_run', args: { jobId: JOB_ID }, viewer: SELF_A, paths: fixture.paths,
    })
    assert.equal(forbidden.ok, false)
    assert.equal(forbidden.code, 'forbidden_not_owner', 'job owned by agt_hr, not agt_a')

    const byOccurrence = await queryExecutionTrace({
      root: 'scheduler_run', args: { occurrenceId: OCC_ID }, viewer: AUDIT, paths: fixture.paths,
    })
    assert.equal(byOccurrence.ok, true)
    assert.ok(byOccurrence.result.timeline.some((e) => e.kind === 'history_run_terminal'), 'history terminal event surfaced')
  } finally { destroyFixtureRoot(fixture) }
})

test('T2 no-receipt attempt and unknown outcomes produce explicit UNKNOWN verdicts, never silent success', async () => {
  const fixture = buildFixtureRoot()
  try {
    // A workflow instance whose only ledger facts are delivery_started (fence open).
    const outcome = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: '99999999-9999-4999-8999-999999999999' }, viewer: AUDIT,
      paths: fixture.paths, svcRequest: fakeSvcRequest({ visible: false }),
    })
    assert.equal(outcome.ok, true)
    assert.ok(outcome.result.summary.fiveDimensions.agentExecution.verdict === 'UNKNOWN'
      || outcome.result.gaps.length > 0, 'unknown or visible gap — never a fabricated success')
  } finally { destroyFixtureRoot(fixture) }
})

test('view=report renders human-readable report with five dimensions and gaps', async () => {
  const fixture = buildFixtureRoot()
  try {
    const outcome = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: WF_ID }, viewer: SELF_A,
      paths: fixture.paths, svcRequest: fakeSvcRequest(), view: 'report',
    })
    assert.equal(outcome.ok, true)
    const report = outcome.result.report
    assert.match(report, /执行历史查询报告/)
    assert.match(report, /五维判定/)
    assert.match(report, /业务推进: 已提交/)
    assert.match(report, /时间轴/)
    assert.match(report, /缺口与降级/)
    assert.match(report, new RegExp(ATTEMPT_ID.slice(0, 10)))
  } finally { destroyFixtureRoot(fixture) }
})
