/**
 * Owner counterexample regressions (2026-09-19 review of f0c05ce):
 *   一  facts must not be promoted into states they don't prove
 *       (send_intent ≠ ACCEPTED; job-enabled ≠ ADMITTED; intent state must
 *       not mask later failure/unknown);
 *   二  an occurrence-scoped query never mixes sibling runs/invocations;
 *   三  retention-loss and correlation-source over-claims
 *       (loss needs structural proof; sidecar provenance names the session
 *       record as its source; parent-turn correlation ≠ the send call).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { classifySendOutcome, classifyAttempt } from '../src/rules.js'
import { queryExecutionTrace } from '../src/index.js'
import { buildFixtureRoot, destroyFixtureRoot, fakeSvcRequest, OCC_ID, OCC_ID_2, JOB_ID } from './fixtures.js'

const AUDIT = { agentId: 'agt_hr', audit: true }

// ── 一 facts → states ────────────────────────────────────────────────────────

test('一-1 send_intent alone never mints ACCEPTED; the proven receipt does; timeout stays unknown', () => {
  const row = (over) => ({ source: 'asm_audit', kind: `send_${over.phase}`, nativeRefs: { requestId: 'r1' }, data: over })
  const intent = classifySendOutcome(row({ phase: 'intent', result: undefined }))
  assert.equal(intent.verdict, 'UNKNOWN', 'intent ≠ accepted')
  assert.match(intent.note ?? '', /intent ≠ accepted/)
  const accepted = classifySendOutcome(row({ phase: 'outcome', result: 'accepted' }))
  assert.equal(accepted.verdict, 'ACCEPTED', 'a proven inbox receipt is the ACCEPTED fact')
  const timeout = classifySendOutcome(row({ phase: 'outcome', result: 'timeout' }))
  assert.equal(timeout.verdict, 'OUTCOME_UNKNOWN', 'timeout ≠ not received — outcome unknown')
})

test('一-2 an enabled job that never ran yields NO admission verdict from its existence', async () => {
  const fixture = buildFixtureRoot()
  try {
    const outcome = await queryExecutionTrace({
      root: 'scheduler_run', args: { jobId: 'job_never_ran' }, viewer: AUDIT, paths: fixture.paths,
    })
    assert.equal(outcome.ok, true)
    const dims = outcome.result.summary.fiveDimensions
    assert.notEqual(dims.schedulingAdmission.verdict, 'ADMITTED', 'job presence ≠ a run was admitted')
    assert.ok(outcome.result.timeline.some((e) => e.kind === 'job_definition'), 'the job fact stays on the timeline')
  } finally { destroyFixtureRoot(fixture) }
})

test('一-3 gen-1 delivered receipt and gen-2 supersession are BOTH visible — no masking', async () => {
  const proj = {
    nodeVisitId: 'v', attemptId: 'wfeat-x', workflowInstanceId: 'wf', events: [
      { kind: 'attempt_run_delivered', nativeRefs: { messageId: 'om_1' }, data: { messageId: 'om_1' } },
      { kind: 'attempt_stale_superseded', data: { observedWorkflowStateVersion: 7 } },
    ],
  }
  const verdicts = classifyAttempt(proj).map((o) => o.verdict)
  assert.ok(verdicts.includes('ACCEPTED'), 'receipt stands')
  assert.ok(verdicts.includes('LEGAL_SKIP'), 'supersession stands beside it')
})

// ── 二 occurrence scoping ────────────────────────────────────────────────────

test('二-1 an occurrence-scoped query never mixes sibling runs when the authority ledger is unreadable', async () => {
  const fixture = buildFixtureRoot()
  try {
    // Authority ledger outside the readable boundary — exactly the offline/
    // permission-failure world. The gap must widen, not the result set.
    const paths = { ...fixture.paths, jobsStore: join(fixture.paths.jobsStore, '..', 'jobs-absent.json') }
    const outcome = await queryExecutionTrace({
      root: 'scheduler_run', args: { occurrenceId: OCC_ID }, viewer: AUDIT, paths,
    })
    assert.equal(outcome.ok, true)
    const r = outcome.result
    assert.ok(r.gaps.some((g) => g.code === 'SOURCE_ABSENT' && g.stage === 'scheduler_store'), 'the missing authority stays a visible gap')
    assert.ok(!r.timeline.some((e) => JSON.stringify(e.nativeRefs).includes(OCC_ID_2)), 'sibling occurrence records excluded')
    assert.ok(!r.timeline.some((e) => e.kind === 'run_record' && e.nativeRefs.occurrence_id !== undefined && e.nativeRefs.occurrence_id !== OCC_ID), 'no other run records')
    // Invocations: only the exact-coordinate match; never the sibling, never
    // the coordinate-less row.
    const invocationRefs = r.timeline.filter((e) => e.kind === 'evidence_invocation').map((e) => e.nativeRefs.occurrenceId ?? e.data?.occurrenceId)
    assert.deepEqual(invocationRefs, [OCC_ID])
    // CTR-SCT-007: the join is DERIVED_EXACT only because the journal itself
    // was located (existence proof); the ledger-absent world keeps the FROM
    // side honest — the query coordinate, not an observed store row.
    // (Locate the SESSION join specifically: the run_record's wake_sent links
    // are also rule R5 but carry no session strength.)
    const r5Join = r.correlations.find((c) => c.rule === 'R5' && String(c.to?.nativeRef).startsWith('agt_hr/'))
    assert.equal(r5Join?.strength, 'DERIVED_EXACT')
    assert.equal(r5Join?.from?.source, 'query_coordinate')
  } finally { destroyFixtureRoot(fixture) }
})

test('二-2 with the ledger readable, an occurrence-scoped query stays scoped', async () => {
  const fixture = buildFixtureRoot()
  try {
    const outcome = await queryExecutionTrace({
      root: 'scheduler_run', args: { occurrenceId: OCC_ID }, viewer: AUDIT, paths: fixture.paths,
    })
    assert.equal(outcome.ok, true)
    assert.ok(!outcome.result.timeline.some((e) => JSON.stringify(e.nativeRefs).includes(OCC_ID_2)), 'sibling excluded even when readable')
    assert.ok(outcome.result.timeline.some((e) => e.kind === 'occurrence' && e.nativeRefs.occurrence_id === OCC_ID))
  } finally { destroyFixtureRoot(fixture) }
})

// ── 三 retention-loss / correlation-source honesty ──────────────────────────

function auditWorld({ withLive = true, withDot1 = false, withArchive = false }) {
  const controlDir = join(tmpdir(), `ehq-asm-world-${process.pid}-${Math.random().toString(36).slice(2, 6)}`)
  mkdirSync(controlDir, { recursive: true })
  const base = join(controlDir, 'agent-session-messaging-audit.jsonl')
  if (withLive) writeFileSync(base, `${JSON.stringify({ kind: 'agent_session_send', phase: 'intent', sourceAgentId: 'agt_x', requestId: 'r-live', ts: 1 })}\n`)
  if (withDot1) writeFileSync(`${base}.1`, `${JSON.stringify({ kind: 'agent_session_send', phase: 'intent', sourceAgentId: 'agt_x', requestId: 'r-old', ts: 0 })}\n`)
  if (withArchive) writeFileSync(join(controlDir, 'agent-session-messaging-audit-archive.jsonl'), `${JSON.stringify({ kind: 'agent_session_send', phase: 'intent', sourceAgentId: 'agt_x', requestId: 'r-archived', ts: 0 })}\n`)
  return controlDir
}

async function messageProbe(controlDir) {
  const fixture = buildFixtureRoot()
  try {
    const paths = { ...fixture.paths, controlDir, turnRecoveryStore: join(controlDir, 'turn-recovery-absent.json') }
    const outcome = await queryExecutionTrace({
      root: 'message', args: { reconciliationHandle: 'turn:fixture-src-1' }, viewer: AUDIT, paths,
    })
    assert.equal(outcome.ok, true)
    return outcome.result
  } finally { destroyFixtureRoot(fixture) }
}

test('三-1 sidecar-only world: the correlation source is the session record, no synthesized ASM row, caller gap open, NO loss claim from a mere missing archive', async () => {
  // Fully-absent audit world (empty control dir): the authority is stated
  // ABSENT — which is neither "didn't happen" nor "proven lost".
  const emptyControl = join(tmpdir(), `ehq-asm-empty-${process.pid}-${Math.random().toString(36).slice(2, 6)}`)
  mkdirSync(emptyControl, { recursive: true })
  const result = await messageProbe(emptyControl)
  const sidecarJoin = result.correlations.find((c) => c.rule === 'R1')
  assert.ok(sidecarJoin, 'sidecar correlation found')
  assert.equal(sidecarJoin.strength, 'SIDECAR_PROVENANCE_ONLY')
  assert.equal(sidecarJoin.from.source, 'session_journal', 'the evidence source is the session record itself')
  assert.ok(result.gaps.some((g) => g.code === 'CORRELATION_GAP' && g.stage === 'caller_send_invocation'), 'precise caller invocation stays an open gap')
  assert.ok(!result.gaps.some((g) => g.code === 'RETENTION_LOSS_PRE_V1'), 'an unreadable/absent archive is NOT proof of loss')
  assert.ok(result.gaps.some((g) => g.code === 'SOURCE_ABSENT' && g.stage === 'asm_audit'), 'the absent authority is stated as absent')

  // Live-only world (source readable, no rotation ever): a plain miss is a
  // correlation gap — no loss claim, no absence claim.
  const liveOnly = await messageProbe(auditWorld({ withLive: true }))
  assert.ok(!liveOnly.gaps.some((g) => g.code === 'RETENTION_LOSS_PRE_V1'))
  assert.ok(liveOnly.gaps.some((g) => g.code === 'CORRELATION_GAP' && g.stage === 'asm_audit'))
})

test('三-2 loss is claimed only when structurally provable: rotations visible + no archive', async () => {
  const result = await messageProbe(auditWorld({ withLive: true, withDot1: true }))
  assert.ok(result.gaps.some((g) => g.code === 'RETENTION_LOSS_PRE_V1'), 'rotations visible without an archive = structurally proven loss of older generations')
  const withArchive = await messageProbe(auditWorld({ withLive: true, withDot1: true, withArchive: true }))
  assert.ok(!withArchive.gaps.some((g) => g.code === 'RETENTION_LOSS_PRE_V1'), 'with an archive, a plain miss is a correlation gap, not a loss claim')
  assert.ok(withArchive.gaps.some((g) => g.code === 'CORRELATION_GAP' && g.stage === 'asm_audit'))
})

// ── T3c (fresh exact-head review): not_created never joins a planted journal ─

test('T3c: a not_created occurrence NEVER joins a canonical journal planted on disk — no SessionRef, no R5', async () => {
  const fixture = buildFixtureRoot()
  try {
    const OCC_PRE = 'occ:003a05ed6629aaaa'
    const store = JSON.parse(readFileSync(fixture.paths.jobsStore, 'utf8'))
    store.occurrences.push({
      occurrenceId: OCC_PRE, jobId: JOB_ID, agentId: 'agt_hr', scheduleRevision: 1,
      state: 'failed', executionOutcome: 'failed', deliveryStatus: 'none',
      nativeSessionId: 'cron-run-occ:003a05ed6629aaaa',
      terminalEvidence: { kind: 'pre-start-rejection', code: 'AGENT_NOT_FOUND' },
      admittedAt: 1758100000000 + 3000, updatedAtMs: 1758100000000 + 3100,
    })
    writeFileSync(fixture.paths.jobsStore, JSON.stringify(store))
    const runsPath = join(fixture.paths.historyDir, 'runs-202609.json')
    const runs = JSON.parse(readFileSync(runsPath, 'utf8'))
    runs.records.push({
      run_id: `run:${OCC_PRE}`, occurrence_id: OCC_PRE, job_id: JOB_ID, agent_id: 'agt_hr',
      session_id: 'cron-run-occ:003a05ed6629aaaa', outcome: 'failed', status_view: 'failed',
      error_code: 'AGENT_NOT_FOUND', delivery_status: 'none',
      result: { final_status: 'FAIL', counters: {}, notes: '' },
    })
    writeFileSync(runsPath, JSON.stringify(runs, null, 2) + '\n')
    // Adversarial world: a canonical cron-run journal for the rejected
    // occurrence PHYSICALLY EXISTS in the owner's tree (pre-created / foreign
    // artifact). The ledger's not-created proof must win: no journal search,
    // no session record, no R5 — the trace never contradicts its own
    // authoritative disposition (CTR-SCT-003/007).
    const hrSessions = join(fixture.paths.homesRoot, 'agt_hr', 'sessions')
    const plantedDir = join(hrSessions, readdirSync(hrSessions)[0], 'cron-run-occ~003A003a05ed6629aaaa')
    mkdirSync(plantedDir, { recursive: true })
    writeFileSync(join(plantedDir, 'session.jsonl'), [
      JSON.stringify({ type: 'session', version: 0, id: 'cron-run-occ:003a05ed6629aaaa', createdAt: 1758100000500, cwd: '/tmp/hr' }),
      JSON.stringify({ type: 'user/message', seq: 1, time: new Date(1758100000510).toISOString(), data: { content: 'planted artifact', source: { kind: 'user' } } }),
    ].join('\n') + '\n')
    const outcome = await queryExecutionTrace({
      root: 'scheduler_run', args: { occurrenceId: OCC_PRE }, viewer: { agentId: 'agt_hr', audit: false }, paths: fixture.paths,
    })
    assert.equal(outcome.ok, true)
    const r = outcome.result
    assert.ok(!r.timeline.some((e) => e.source === 'session_journal'), 'the planted journal never becomes a session record')
    assert.ok(!r.correlations.some((c) => c.rule === 'R5' && String(c.to.nativeRef).startsWith('agt_hr/')), 'no R5 correlation for a not_created occurrence')
    const occurrence = r.timeline.find((e) => e.kind === 'occurrence')
    assert.ok(occurrence, 'occurrence surfaced')
    assert.equal(occurrence.data.sessionCreated, 'not_created', 'the ledger disposition stands')
    assert.ok(!r.gaps.some((g) => g.stage === 'session_journal'), 'not_created suppresses the journal gap — nothing is missing')
  } finally { destroyFixtureRoot(fixture) }
})
