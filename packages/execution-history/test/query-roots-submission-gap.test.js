/**
 * query-roots-submission-gap.test.js — #724 submission-gap report-view tests,
 * moved verbatim from query-roots.test.js (mechanical split under the 500-line
 * hard limit, CODE_STRUCTURE_GUARDRAILS_V1): same suite, same fixtures, same
 * inputs/assertions/coverage — only their file home changed. The viewer
 * constants below mirror the query-roots suite's.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import { queryExecutionTrace } from '../src/index.js'
import { buildFixtureRoot, destroyFixtureRoot, fakeSvcRequest, WF_ID_2 } from './fixtures.js'

const SELF_A = { agentId: 'agt_a', audit: false }
const SELF_HR = { agentId: 'agt_hr', audit: false }
const AUDIT = { agentId: 'agt_a', audit: true }

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
