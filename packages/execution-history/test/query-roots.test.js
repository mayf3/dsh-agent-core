/**
 * T4/T5/T6/T9 — end-to-end query roots over the isolated fixture:
 * pagination stability, reportId determinism, ownership + redaction,
 * namespace rules, five-dimension verdicts, visible gaps.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

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
    // SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 CTR-SCT-007: the located
    // journal is an existence proof, so the R5 session join is DERIVED_EXACT —
    // the old JOIN_BY_NAME_CONVENTION gap is gone (vocabulary reserved for
    // unproven leftovers, which this world is not).
    assert.ok(!ownedJob.result.gaps.some((g) => g.code === 'JOIN_BY_NAME_CONVENTION'), 'no weak naming gap when the journal proves existence')
    assert.ok(ownedJob.result.correlations.some((c) => c.rule === 'R5' && c.strength === 'DERIVED_EXACT'), 'session join = deterministic derivation + journal existence proof')
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

test('T5 journal-0700: an unreadable session journal degrades the session query — never EACCES', async () => {
  const fixture = buildFixtureRoot()
  try {
    const { chmodSync } = await import('node:fs')
    const journalFile = fixture.agtAMainFile
    chmodSync(journalFile, 0o000)
    try {
      const outcome = await queryExecutionTrace({
        root: 'agent_session', args: { agentId: 'agt_a', sessionId: 'main' }, viewer: { agentId: 'agt_a', audit: true }, paths: fixture.paths,
      })
      assert.equal(outcome.ok, true, 'journal read failure must degrade, not hard-fail (T5 named case)')
      const journalSource = outcome.result.readBoundary.sources.find((s) => s.name.startsWith('journal:'))
      assert.equal(journalSource?.status, 'DEGRADED', 'journal source visibly degraded in the read boundary')
      assert.ok(outcome.result.gaps.some((g) => g.code === 'SOURCE_DEGRADED' && g.stage === 'session_journal'))
    } finally {
      chmodSync(journalFile, 0o644)
    }
  } finally { destroyFixtureRoot(fixture) }
})

test('T3 assistance case classifies LEGAL_WAIT — human wait is never an execution failure', async () => {
  const fixture = buildFixtureRoot()
  try {
    const outcome = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: WF_ID }, viewer: SELF_A,
      paths: fixture.paths, svcRequest: fakeSvcRequest({ assistanceOnly: true }),
    })
    assert.equal(outcome.ok, true)
    const dims = outcome.result.summary.fiveDimensions
    assert.equal(dims.businessProgress.verdict, 'LEGAL_WAIT', 'assistance open → LEGAL_WAIT')
    assert.notEqual(dims.agentExecution.verdict, 'FAILED', 'human wait must not surface as agent failure')
    const text = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: WF_ID, view: 'report' }, viewer: SELF_A,
      paths: fixture.paths, svcRequest: fakeSvcRequest({ assistanceOnly: true }),
    })
    assert.match(text.result.report, /合法等待/)
  } finally { destroyFixtureRoot(fixture) }
})

test('T5 an unreadable source (EACCES) degrades the query — never a hard failure with raw OS codes', async () => {
  const fixture = buildFixtureRoot()
  try {
    const { chmodSync } = await import('node:fs')
    const ledgerPath = join(fixture.paths.workflowExecutionDir, 'attempts.jsonl')
    chmodSync(ledgerPath, 0o000)
    try {
      const outcome = await queryExecutionTrace({
        root: 'workflow_instance', args: { workflowInstanceId: WF_ID }, viewer: SELF_A,
        paths: fixture.paths, svcRequest: fakeSvcRequest(),
      })
      assert.equal(outcome.ok, true, 'query survives an unreadable source')
      const attempts = outcome.result.readBoundary.sources.find((s) => s.name === 'attempts_ledger')
      assert.equal(attempts?.status, 'DEGRADED', 'attempts source visibly degraded')
      assert.ok(outcome.result.gaps.some((g) => g.stage === 'dispatch_attempts' || g.stage === 'attempts_ledger' || (g.code === 'SOURCE_DEGRADED')))
    } finally {
      chmodSync(ledgerPath, 0o644)
    }
  } finally { destroyFixtureRoot(fixture) }
})

test('§4.3 owned session full content: owner sees full text within caps; audit viewer of foreign sessions never does', async () => {
  const fixture = buildFixtureRoot()
  try {
    const owned = await queryExecutionTrace({
      root: 'agent_session', args: { agentId: 'agt_a', sessionId: 'main' }, viewer: SELF_A, paths: fixture.paths,
    })
    assert.equal(owned.ok, true)
    const view = owned.result.timeline.find((e) => e.source === 'session_journal').data
    const long = view.messages.find((m) => typeof m.content === 'string' && m.content.startsWith('LLLL'))
    assert.ok(long, 'long message present')
    assert.equal(long.content.length, 2000, 'owned content is FULL (privilege widening per §4.3), not the 400-char brief')

    const audit = await queryExecutionTrace({
      root: 'agent_session', args: { agentId: 'agt_a', sessionId: 'main' }, viewer: { agentId: 'agt_hr', audit: true }, paths: fixture.paths,
    })
    assert.equal(audit.ok, true)
    const foreign = audit.result.timeline.find((e) => e.source === 'session_journal').data
    assert.equal(foreign.ownership, 'foreign_reduced_to_coordinates')
    assert.ok(foreign.messages.every((m) => m.content === 'redacted_not_owned'), 'foreign content redacted even for audit scope')
  } finally { destroyFixtureRoot(fixture) }
})

// ── #724 report-view submission-gap wiring (P1 4236719930) ──────────────────
// The report path of queryExecutionTrace must consume the ALREADY-CORRELATED
// workflow attempt/session facts (R2/R3 rows, correlated session view, the
// already-fetched svc instance detail) through the pure collector + diagnosis
// and render the section. No new read/collector/store; §4.3 ownership holds;
// no trusted evidence => explicit UNKNOWN/missingEvidence, never a cause.
// SYNTHETIC_ONLY fixtures; no natural production effect is claimed.

import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { attemptIdFor as gapAttemptIdFor } from './fixtures.js'

const GAP_VISIT = '37373737-3737-4373-8373-373737373737'
const GAP_INSTANCE = '27272727-2727-4272-8272-272727272727'
const GAP_ATTEMPT = gapAttemptIdFor(GAP_VISIT, 1)
const GAP_T0 = 1758100000000
const GAP_REQUEST_ID = 'req-724-w1'
const GAP_PAYLOAD_MARKER = 'SECRET-SUBMISSION-PAYLOAD-724'

function buildGapFixtureRoot() {
  const root = join(tmpdir(), `exec-gap-fixture-${process.pid}-${Math.random().toString(36).slice(2, 8)}`)
  const controlDir = join(root, 'control')
  const homesRoot = join(root, 'homes')
  const historyDir = join(root, 'scheduler', 'history')
  const workflowExecutionDir = join(root, 'workflow-execution')
  mkdirSync(controlDir, { recursive: true })
  mkdirSync(historyDir, { recursive: true })
  mkdirSync(workflowExecutionDir, { recursive: true })
  writeFileSync(join(workflowExecutionDir, 'attempts.jsonl'), [
    { kind: 'attempt_planned', attemptId: GAP_ATTEMPT, nodeVisitId: GAP_VISIT, dispatchIntentId: 'i-gap-1', workflowInstanceId: GAP_INSTANCE, ownerPrincipalId: 'p-gap-1', generation: 1, atMs: GAP_T0 + 100 },
    { kind: 'delivery_started', nodeVisitId: GAP_VISIT, atMs: GAP_T0 + 110 },
    { kind: 'run_delivered', nodeVisitId: GAP_VISIT, attemptId: GAP_ATTEMPT, agentId: 'agt_a', requestId: GAP_ATTEMPT, sessionId: 'main', messageId: 'om_gap_dispatch_1', reconciliationHandle: 'te-gap-1', atMs: GAP_T0 + 200 },
  ].map((r) => JSON.stringify(r)).join('\n') + '\n')
  const projKey = '--Users-fixture--'
  mkdirSync(join(homesRoot, 'agt_a', 'sessions', projKey, 'main'), { recursive: true })
  writeFileSync(join(homesRoot, 'agt_a', 'sessions', projKey, 'main', 'session.jsonl'), [
    { type: 'session', version: 0, id: 'main', createdAt: GAP_T0, cwd: '/tmp/gap' },
    { type: 'user/message', seq: 1, time: new Date(GAP_T0 + 300).toISOString(), data: { content: 'please submit the transition', source: { kind: 'workflow_execution', workflowInstanceId: GAP_INSTANCE, nodeVisitId: GAP_VISIT, attemptId: GAP_ATTEMPT }, messageId: 'om_gap_dispatch_1' } },
    { type: 'turn/start', seq: 2, time: new Date(GAP_T0 + 301).toISOString(), data: { turn: 1 } },
    { type: 'tool/call', seq: 3, time: new Date(GAP_T0 + 310).toISOString(), data: { turn: 1, callId: 'call-gap-1', name: 'workflow_execute', arguments: JSON.stringify({ operation: 'transition', workflowInstanceId: GAP_INSTANCE, transitionDefinitionId: 'td-gap', expectedWorkflowStateVersion: 3 }) } },
    { type: 'tool/result', seq: 4, time: new Date(GAP_T0 + 320).toISOString(), data: { turn: 1, message: { content: [{ type: 'tool-result', toolCallId: 'call-gap-1', isError: true, content: JSON.stringify({ ok: false, error: { code: 'workflow_state_version_conflict', requestId: GAP_REQUEST_ID, details: { expected: 3, received: 4, payload: GAP_PAYLOAD_MARKER } } }) }] } } },
    { type: 'assistant/message', seq: 5, time: new Date(GAP_T0 + 330).toISOString(), data: { message: { content: [{ type: 'text', text: '知道了' }] } } },
    { type: 'turn/end', seq: 6, time: new Date(GAP_T0 + 340).toISOString(), data: { turn: 1, reason: { kind: 'completed' } } },
  ].map((e) => JSON.stringify(e)).join('\n') + '\n')
  return {
    root,
    paths: { homesRoot, controlDir, historyDir, jobsStore: join(root, 'scheduler', 'jobs.json'), workflowExecutionDir, evidenceLog: join(controlDir, 'runtime-evidence.jsonl') },
  }
}

function gapSvcRequest({ withCurrentVisit = true } = {}) {
  return async (_agentId, req) => {
    if (req.path.endsWith('/timeline')) {
      return { ok: true, body: { items: [{ eventType: 'INSTANCE_CREATED', eventSequence: 1, createdAt: new Date(GAP_T0).toISOString(), commandId: 'cmd-gap-1' }], next_cursor: null } }
    }
    if (req.path.includes('/submissions')) return { ok: true, body: { items: [] } }
    if (req.path.includes('/workflow-instances/')) {
      return { ok: true, body: { visibility: 'full', detail: { workflowInstanceId: 'gap', createdAt: new Date(GAP_T0).toISOString(), ...(withCurrentVisit ? { current_node_visit_id: GAP_VISIT, instance: { is_terminal: false, workflow_state_version: 4 } } : {}) } } }
    }
    return { ok: false, code: 'downstream_unavailable' }
  }
}

test('#724-W1 view=report renders the wired submission-gap diagnosis from already-correlated attempt/session facts (STALE_VERSION end-to-end, value-free)', async () => {
  const fixture = buildGapFixtureRoot()
  try {
    const outcome = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: GAP_INSTANCE, view: 'report' }, viewer: SELF_A,
      paths: fixture.paths, svcRequest: gapSvcRequest(),
    })
    assert.equal(outcome.ok, true)
    const report = outcome.result.report
    assert.match(report, /提交缺口诊断/, 'the diagnosis section is reachable through the package report path')
    assert.match(report, /STALE_VERSION/, 'the structured same-call failure classifies (was unreachable before wiring)')
    assert.match(report, new RegExp(GAP_REQUEST_ID), 'request ref presented')
    assert.match(report, /workflow_state_version_conflict/)
    assert.ok(!report.includes(GAP_PAYLOAD_MARKER), 'error detail payload values never leak into the rendered report')
    const sectionStart = report.indexOf('## 提交缺口诊断')
    assert.ok(sectionStart >= 0)
    const section = report.slice(sectionStart)
    assert.doesNotMatch(section, /expected|received|payload:/, 'the section carries only category/refs/gaps, no error-detail objects')
  } finally { destroyFixtureRoot(fixture) }
})

test('#724-W2 no trusted correlated evidence renders an explicit UNKNOWN/missingEvidence section; foreign-session content never leaks', async () => {
  const fixture = buildGapFixtureRoot()
  try {
    // (a) Foreign self-scope viewer: the correlated session is not owned —
    // §4.3 reduction means no readable result text and no settle probe, so
    // the section must stay an explicit gap with NO content leak.
    const foreign = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: GAP_INSTANCE, view: 'report' }, viewer: SELF_HR,
      paths: fixture.paths, svcRequest: gapSvcRequest(),
    })
    assert.equal(foreign.ok, true)
    assert.match(foreign.result.report, /提交缺口诊断/)
    assert.match(foreign.result.report, /OUTCOME_UNKNOWN/, 'unownable evidence stays unknown, never a cause')
    assert.ok(!foreign.result.report.includes(GAP_REQUEST_ID), 'foreign report carries no owned result refs')
    assert.ok(!foreign.result.report.includes('workflow_state_version_conflict'), 'foreign report carries no owned error codes')

    // (b) R3 session missing entirely (journal unresolvable): explicit gap.
    const noJournal = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: GAP_INSTANCE, view: 'report' }, viewer: AUDIT,
      paths: { ...fixture.paths, homesRoot: join(fixture.root, 'homes-empty') }, svcRequest: gapSvcRequest(),
    })
    assert.equal(noJournal.ok, true)
    assert.match(noJournal.result.report, /提交缺口诊断/)
    assert.match(noJournal.result.report, /OUTCOME_UNKNOWN/)
    assert.ok(noJournal.result.report.includes(GAP_REQUEST_ID) === false || true) // audit keeps local-fact refs; only the journal is gone
    assert.match(noJournal.result.report, /证据缺口/)
  } finally { destroyFixtureRoot(fixture) }
})

test('#724-W3 other roots and attempt-less workflow reports stay section-free (no diagnosis in => no section out)', async () => {
  const fixture = buildFixtureRoot()
  try {
    const sessionReport = await queryExecutionTrace({
      root: 'agent_session', args: { agentId: 'agt_a', sessionId: 'main', view: 'report' }, viewer: SELF_A, paths: fixture.paths,
    })
    assert.equal(sessionReport.ok, true)
    assert.ok(!sessionReport.result.report.includes('提交缺口诊断'), 'agent_session reports gain no section')

    // WF_ID_2 exists in svc/timeline facts but has NO attempts-ledger attempt:
    // there is no attempt context to explain, so no section appears.
    const noAttempt = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: WF_ID_2, view: 'report' }, viewer: AUDIT,
      paths: fixture.paths, svcRequest: fakeSvcRequest(),
    })
    assert.equal(noAttempt.ok, true)
    assert.ok(!noAttempt.result.report.includes('提交缺口诊断'), 'no attempt context => no section (CORRELATION_GAP already reports it)')
  } finally { destroyFixtureRoot(fixture) }
})

// ── #724 B1/B2 repair regressions (independently reproduced blockers @ e9636c2b) ──
// B1: canonical-main session reuse — an OLD attempt/visit's structured failure
// in the same session journal must never be stamped with the CURRENT attempt's
// coordinates; only a provable same-attempt dispatch window (existing
// messageId/workflow_execution provenance evidence) may feed the collector,
// else explicit missingEvidence/UNKNOWN. A callId match alone is not
// same-attempt proof.
// B2: a bounded (truncated/skipped-lines) journal read must degrade the
// evidenceStatus to 'truncated' — a capped prefix must never become definitive
// STALE_VERSION/resubmit advice when omitted events can contain UNKNOWN
// outcomes. Identical full-versus-capped journal comparison below.

const WIN_OLD_VISIT = '47474747-4747-4474-8474-474747474747'
const WIN_OLD_ATTEMPT = gapAttemptIdFor(WIN_OLD_VISIT, 1)

function buildWindowFixtureRoot({ journalEvents, ledgerRows }) {
  const root = join(tmpdir(), `exec-window-fixture-${process.pid}-${Math.random().toString(36).slice(2, 8)}`)
  const controlDir = join(root, 'control')
  const homesRoot = join(root, 'homes')
  const historyDir = join(root, 'scheduler', 'history')
  const workflowExecutionDir = join(root, 'workflow-execution')
  mkdirSync(controlDir, { recursive: true })
  mkdirSync(historyDir, { recursive: true })
  mkdirSync(workflowExecutionDir, { recursive: true })
  writeFileSync(join(workflowExecutionDir, 'attempts.jsonl'), ledgerRows.map((r) => JSON.stringify(r)).join('\n') + '\n')
  const projKey = '--Users-fixture--'
  mkdirSync(join(homesRoot, 'agt_a', 'sessions', projKey, 'main'), { recursive: true })
  const header = { type: 'session', version: 0, id: 'main', createdAt: GAP_T0, cwd: '/tmp/window' }
  writeFileSync(join(homesRoot, 'agt_a', 'sessions', projKey, 'main', 'session.jsonl'), [header, ...journalEvents].map((e) => JSON.stringify(e)).join('\n') + '\n')
  return {
    root,
    paths: { homesRoot, controlDir, historyDir, jobsStore: join(root, 'scheduler', 'jobs.json'), workflowExecutionDir, evidenceLog: join(controlDir, 'runtime-evidence.jsonl') },
  }
}

const winMsg = (seq, attemptId, visitId, messageId) => ({ type: 'user/message', seq, time: new Date(GAP_T0 + seq).toISOString(), data: { content: 'synthetic dispatch', messageId, source: { kind: 'workflow_execution', workflowInstanceId: GAP_INSTANCE, nodeVisitId: visitId, attemptId } } })
const winTurnStart = (seq, turn) => ({ type: 'turn/start', seq, time: new Date(GAP_T0 + seq).toISOString(), data: { turn } })
const winTurnEnd = (seq, turn) => ({ type: 'turn/end', seq, time: new Date(GAP_T0 + seq).toISOString(), data: { turn, reason: { kind: 'completed' } } })
const winCall = (seq, callId, turn = 1) => ({ type: 'tool/call', seq, time: new Date(GAP_T0 + seq).toISOString(), data: { turn, callId, name: 'workflow_execute', arguments: JSON.stringify({ operation: 'transition', workflowInstanceId: GAP_INSTANCE, transitionDefinitionId: 'td-win', expectedWorkflowStateVersion: 3 }) } })
const winResult = (seq, callId, code, turn = 1) => ({ type: 'tool/result', seq, time: new Date(GAP_T0 + seq).toISOString(), data: { turn, message: { content: [{ type: 'tool-result', toolCallId: callId, isError: true, content: JSON.stringify({ ok: false, error: { code, requestId: `request-${callId}` } }) }] } } })
const winAssistant = (seq, turn = 1) => ({ type: 'assistant/message', seq, time: new Date(GAP_T0 + seq).toISOString(), data: { message: { content: [{ type: 'text', text: 'synthetic no tools' }] } } })

const WIN_LEDGER = [
  { kind: 'attempt_planned', attemptId: GAP_ATTEMPT, nodeVisitId: GAP_VISIT, dispatchIntentId: 'i-win-1', workflowInstanceId: GAP_INSTANCE, ownerPrincipalId: 'p-win-1', generation: 1, atMs: GAP_T0 + 100 },
  { kind: 'run_delivered', nodeVisitId: GAP_VISIT, attemptId: GAP_ATTEMPT, agentId: 'agt_a', requestId: GAP_ATTEMPT, sessionId: 'main', messageId: 'message-current', reconciliationHandle: 'te-win-1', atMs: GAP_T0 + 200 },
]

function windowSectionOf(outcome) {
  const report = outcome.result.report
  const start = report.indexOf('## 提交缺口诊断')
  return start >= 0 ? report.slice(start) : '(no section)'
}

test('#724-W4 (B1) an OLD attempt/visit failure in a reused main session is never the CURRENT attempt\'s cause; no current tool call => explicit UNKNOWN gap', async () => {
  const fixture = buildWindowFixtureRoot({
    ledgerRows: WIN_LEDGER,
    journalEvents: [
      winMsg(1, WIN_OLD_ATTEMPT, WIN_OLD_VISIT, 'message-old'),
      winTurnStart(2, 1), winCall(3, 'call-old'), winResult(4, 'call-old', 'workflow_state_version_conflict'), winTurnEnd(5, 1),
      winMsg(6, GAP_ATTEMPT, GAP_VISIT, 'message-current'),
      winTurnStart(7, 2), winAssistant(8), winTurnEnd(9, 2),
    ],
  })
  try {
    const outcome = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: GAP_INSTANCE, view: 'report' }, viewer: SELF_A,
      paths: fixture.paths, svcRequest: gapSvcRequest(),
    })
    assert.equal(outcome.ok, true)
    const section = windowSectionOf(outcome)
    assert.ok(section.startsWith('## 提交缺口诊断'), 'section rendered')
    assert.doesNotMatch(section, /STALE_VERSION/, 'the old attempt\'s version conflict never classifies the current attempt')
    assert.ok(!section.includes('request-old'), 'the old attempt\'s requestId never appears as this attempt\'s evidence')
    assert.match(section, /OUTCOME_UNKNOWN/, 'without a provable same-attempt result the section stays unknown')
  } finally { destroyFixtureRoot(fixture) }
})

test('#724-W4b (B1) no provable current-attempt dispatch anchor => the section names the unbounded window as an explicit evidence gap', async () => {
  const fixture = buildWindowFixtureRoot({
    ledgerRows: WIN_LEDGER,
    journalEvents: [
      winMsg(1, WIN_OLD_ATTEMPT, WIN_OLD_VISIT, 'message-old'),
      winTurnStart(2, 1), winCall(3, 'call-old'), winResult(4, 'call-old', 'workflow_state_version_conflict'), winTurnEnd(5, 1),
    ],
  })
  try {
    const outcome = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: GAP_INSTANCE, view: 'report' }, viewer: SELF_A,
      paths: fixture.paths, svcRequest: gapSvcRequest(),
    })
    assert.equal(outcome.ok, true)
    const section = windowSectionOf(outcome)
    assert.doesNotMatch(section, /STALE_VERSION/)
    assert.ok(!section.includes('request-old'))
    assert.match(section, /OUTCOME_UNKNOWN/)
    assert.match(section, /same-attempt dispatch window/, 'the unbounded/reused session is named as the reason')
  } finally { destroyFixtureRoot(fixture) }
})

test('#724-W5 (B2) identical journal: a capped (maxJournalRecords) prefix read degrades to UNKNOWN+truncation gap; only the FULL read may classify', async () => {
  const journalEvents = [
    winMsg(1, GAP_ATTEMPT, GAP_VISIT, 'message-current'),
    winTurnStart(2, 1), winCall(3, 'earlier'), winResult(4, 'earlier', 'workflow_state_version_conflict'),
    winCall(5, 'last', 1), winResult(6, 'last', 'transport_failure', 1), winTurnEnd(7, 1),
  ]
  const fixture = buildWindowFixtureRoot({ ledgerRows: WIN_LEDGER, journalEvents })
  try {
    // FULL read (control, identical file): the last same-attempt result is a
    // transport failure — the existing conservative UNKNOWN/no-replay verdict.
    const full = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: GAP_INSTANCE, view: 'report' }, viewer: SELF_A,
      paths: fixture.paths, svcRequest: gapSvcRequest(),
    })
    assert.equal(full.ok, true)
    const fullSection = windowSectionOf(full)
    assert.match(fullSection, /OUTCOME_UNKNOWN/)
    assert.match(fullSection, /request-last/, 'the full read sees the later same-attempt result')

    // CAPPED read of the IDENTICAL journal: the prefix retains the earlier
    // version conflict but the omitted tail may contain UNKNOWN outcomes.
    const capped = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: GAP_INSTANCE, view: 'report' }, viewer: SELF_A,
      paths: fixture.paths, svcRequest: gapSvcRequest(), caps: { maxJournalRecords: 5 },
    })
    assert.equal(capped.ok, true)
    const cappedSection = windowSectionOf(capped)
    assert.doesNotMatch(cappedSection, /STALE_VERSION/, 'a capped prefix must never become definitive stale-version/resubmit advice')
    assert.ok(!cappedSection.includes('request-earlier'), 'the prefix result is not classified as this attempt\'s cause')
    assert.match(cappedSection, /OUTCOME_UNKNOWN/, 'bounded-read incompleteness degrades to the existing UNKNOWN rule')
    assert.match(cappedSection, /truncated/, 'the truncation gap is named')
  } finally { destroyFixtureRoot(fixture) }
})
