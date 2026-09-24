/**
 * SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 — acceptance tests T1/T2/T3/T5/T6/
 * T7/T8 over the isolated fixture root (zero production side-effects).
 *
 *  T1  session identity collision: bare sessionId is never a global key
 *  T2  scheduler run → SessionRef resolution (self + ledger dispositions)
 *  T3  pre-session failure → SESSION_CREATED=NO with the exact persisted
 *      reason, and NO fabricated sessionId anywhere in the result
 *  T5  workflow attempt → SessionRef → messageId pass-through honesty
 *  T6  restart/rebuild: listing and index rebuild from durable evidence
 *  T7  privacy: the listing is self-only and coordinate-only
 *  T8  no fuzzy join: removing the journal turns the join into an explicit gap
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { queryExecutionTrace, listAgentSessions } from '../src/index.js'
import { sessionDispositionOf } from '../src/correlate/scheduler-root.js'
import { sessionDispositionOf as schedulerSideDisposition } from '../../scheduler/src/self-service/projections.js'
import { loadAttemptsLedger } from '../src/loaders/attempts-ledger.js'
import { buildFixtureRoot, destroyFixtureRoot, OCC_ID, OCC_ID_2, JOB_ID, WF_ID } from './fixtures.js'

const SELF_A = { agentId: 'agt_a', audit: false }
const SELF_HR = { agentId: 'agt_hr', audit: false }
const PROJ_KEY = '--Users-fixture--'

function indexDirOf(fixture) {
  return join(fixture.paths.controlDir, 'execution-history-index')
}

// ── T1 ───────────────────────────────────────────────────────────────────────

test('T1: both agents own a session literally named main — listing is per-agent, never a bare-sessionId global key', () => {
  const fixture = buildFixtureRoot()
  try {
    const forA = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_a' })
    assert.equal(forA.ok, true)
    const idsA = forA.result.sessions.map((s) => s.sessionId)
    assert.ok(idsA.includes('main'), 'agt_a sees its own main')
    assert.equal(idsA.filter((id) => id === 'main').length, 1, 'exactly one main — the caller\'s own')
    assert.equal(forA.result.agentId, 'agt_a')

    const forHr = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(forHr.ok, true)
    const idsHr = forHr.result.sessions.map((s) => s.sessionId)
    assert.ok(idsHr.includes('main'), 'agt_hr sees its own main with the SAME bare id — collision handled by (agentId, sessionId)')
    assert.ok(idsHr.some((id) => id.startsWith('cron-run-')), 'agt_hr sees its scheduler session')

    // Cross-agent session query stays forbidden (self scope).
    return queryExecutionTrace({
      root: 'agent_session', args: { agentId: 'agt_hr', sessionId: 'main' }, viewer: SELF_A, paths: fixture.paths,
    }).then((cross) => {
      assert.equal(cross.ok, false)
      assert.equal(cross.code, 'forbidden_not_owner')
    })
  } finally { destroyFixtureRoot(fixture) }
})

// ── T2 ───────────────────────────────────────────────────────────────────────

test('T2: scheduler run resolves its SessionRef — ledger disposition + journal existence proof, and the honest gap when the journal is gone', async () => {
  const fixture = buildFixtureRoot()
  try {
    // OCC_ID: ledger says failed (no terminalEvidence → unknown disposition,
    // designated id still exposed as a coordinate) and the journal EXISTS —
    // the join reaches DERIVED_EXACT via the existence proof.
    const outcome = await queryExecutionTrace({
      root: 'scheduler_run', args: { occurrenceId: OCC_ID }, viewer: SELF_HR, paths: fixture.paths,
    })
    assert.equal(outcome.ok, true)
    const occurrence = outcome.result.timeline.find((e) => e.kind === 'occurrence')
    assert.ok(occurrence, 'ledger occurrence surfaced')
    assert.equal(occurrence.nativeRefs.sessionId, 'cron-run-occ:003a05ed6629f358ff53', 'SessionRef exposed')
    assert.equal(occurrence.data.sessionCreated, 'unknown', 'failed without terminalEvidence stays honest-unknown')
    const join = outcome.result.correlations.find((c) => c.rule === 'R5' && String(c.to.nativeRef).startsWith('agt_hr/'))
    assert.ok(join, 'session correlation present')
    assert.equal(join.strength, 'DERIVED_EXACT', 'deterministic derivation + located journal = existence proof')

    // OCC_ID_2: ledger says succeeded (created) but no journal exists — the
    // missing journal is a visible CORRELATION_GAP, never a silent success.
    const second = await queryExecutionTrace({
      root: 'scheduler_run', args: { occurrenceId: OCC_ID_2 }, viewer: SELF_HR, paths: fixture.paths,
    })
    assert.equal(second.ok, true)
    assert.ok(second.result.gaps.some((g) => g.code === 'CORRELATION_GAP' && g.stage === 'session_journal' && g.knownFacts?.occurrenceId === OCC_ID_2), 'created-without-journal is an explicit gap')
    assert.ok(!second.result.correlations.some((c) => c.rule === 'R5' && String(c.to.nativeRef).startsWith('agt_hr/')), 'no session correlation without existence proof')
  } finally { destroyFixtureRoot(fixture) }
})

// ── T3 ───────────────────────────────────────────────────────────────────────

function buildPreStartFixture() {
  const fixture = buildFixtureRoot()
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
  // History claims a run for it, with the designated session id, but NO
  // journal directory ever exists — the honest world of a pre-start rejection.
  const runsPath = join(fixture.paths.historyDir, 'runs-202609.json')
  const runs = JSON.parse(readFileSync(runsPath, 'utf8'))
  runs.records.push({
    run_id: `run:${OCC_PRE}`, occurrence_id: OCC_PRE, job_id: JOB_ID, agent_id: 'agt_hr',
    session_id: 'cron-run-occ:003a05ed6629aaaa', outcome: 'failed', status_view: 'failed',
    error_code: 'AGENT_NOT_FOUND', delivery_status: 'none',
    result: { final_status: 'FAIL', counters: {}, notes: '' },
  })
  writeFileSync(runsPath, JSON.stringify(runs, null, 2) + '\n')
  return { fixture, OCC_PRE }
}

test('T3: pre-start rejection → SESSION_CREATED=NO with the persisted reason; no fabricated sessionId, no session correlation', async () => {
  const { fixture, OCC_PRE } = buildPreStartFixture()
  try {
    const outcome = await queryExecutionTrace({
      root: 'scheduler_run', args: { occurrenceId: OCC_PRE }, viewer: SELF_HR, paths: fixture.paths,
    })
    assert.equal(outcome.ok, true)
    const r = outcome.result
    const occurrence = r.timeline.find((e) => e.kind === 'occurrence')
    assert.ok(occurrence, 'occurrence surfaced')
    assert.equal(occurrence.nativeRefs.sessionId, undefined, 'NO sessionId coordinate on a not_created occurrence (SC-1)')
    assert.equal(occurrence.data.sessionCreated, 'not_created')
    assert.equal(occurrence.data.sessionNotCreatedReason, 'pre-start-rejection', 'exact persisted reason from the frozen taxonomy')
    assert.equal(occurrence.data.nativeSessionId, null)
    assert.ok(!r.correlations.some((c) => c.rule === 'R5' && String(c.to.nativeRef).startsWith('agt_hr/')), 'no session correlation is claimed for a session that never existed')
    assert.ok(!r.timeline.some((e) => e.source === 'session_journal'), 'no session record fabricated')
    assert.ok(!r.gaps.some((g) => g.stage === 'session_journal'), 'not_created suppresses even the journal gap — there is nothing missing')
  } finally { destroyFixtureRoot(fixture) }
})

test('T3b: disposition table equivalence — scheduler projection vs execution-history core agree on the frozen mapping', () => {
  const worlds = [
    { state: 'succeeded', executionOutcome: 'succeeded', nativeSessionId: 's1' },
    { state: 'running' },
    { state: 'failed', executionOutcome: 'failed', terminalEvidence: { kind: 'turn-terminal' } },
    { state: 'failed', executionOutcome: 'failed', terminalEvidence: { kind: 'pre-start-rejection' } },
    { state: 'failed', executionOutcome: 'failed', terminalEvidence: { kind: 'late-settlement' } },
    { state: 'outcome_unknown' },
    { state: 'admitted' },
    {},
  ]
  for (const world of worlds) {
    assert.deepEqual(sessionDispositionOf(world), schedulerSideDisposition(world), `mapping drift at ${JSON.stringify(world)}`)
  }
})

// ── T5 ───────────────────────────────────────────────────────────────────────

test('T5: workflow attempt carries its SessionRef and the receipt messageId; a receipt-less row stays honestly absent', async () => {
  const fixture = buildFixtureRoot()
  try {
    const outcome = await queryExecutionTrace({
      root: 'workflow_instance', args: { workflowInstanceId: WF_ID }, viewer: SELF_A, paths: fixture.paths,
    })
    assert.equal(outcome.ok, true)
    const delivered = outcome.result.timeline.find((e) => e.source === 'attempts_ledger' && e.nativeRefs?.messageId !== undefined)
    assert.ok(delivered, 'run_delivered messageId reaches the trace (CTR-SCT-006 surface)')

    // Honesty direction: a run_delivered WITHOUT a messageId (outcome_unknown
    // shape) must expose no messageId coordinate at all.
    const altDir = join(fixture.root, 'alt-ledger')
    mkdirSync(altDir, { recursive: true })
    writeFileSync(join(altDir, 'attempts.jsonl'), JSON.stringify({
      kind: 'run_delivered', nodeVisitId: '99999999-9999-4999-8999-999999999999',
      attemptId: 'wfeat-999999999999999999999999', agentId: 'agt_a',
      requestId: 'wfeat-999999999999999999999999', sessionId: 'main',
      reconciliationHandle: 'te-x', atMs: 1,
    }) + '\n')
    const alt = loadAttemptsLedger({ workflowExecutionDir: altDir })
    const withRow = alt.records.find((r) => r.nativeRefs.reconciliationHandle === 'te-x')
    assert.ok(withRow, 'row loaded')
    assert.equal(withRow.nativeRefs.messageId, undefined, 'absent receipt → absent messageId, never fabricated')
  } finally { destroyFixtureRoot(fixture) }
})

// ── T6 ───────────────────────────────────────────────────────────────────────

test('T6: restart/rebuild — deleting the derived index changes nothing in the listing (rebuilt from durable journals)', () => {
  const fixture = buildFixtureRoot()
  try {
    const before = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(before.ok, true)
    rmSync(indexDirOf(fixture), { recursive: true, force: true })
    const after = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(after.ok, true)
    assert.deepEqual(after.result.sessions, before.result.sessions, 'index is a rebuildable view, not evidence')
  } finally { destroyFixtureRoot(fixture) }
})

// ── T7 ───────────────────────────────────────────────────────────────────────

test('T7: privacy — the listing is self-only and coordinate-only (no content fields ever)', () => {
  const fixture = buildFixtureRoot()
  try {
    const forA = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_a' })
    assert.equal(forA.ok, true)
    const serialized = JSON.stringify(forA.result)
    assert.ok(!serialized.includes('private user text'), 'no journal content leaks')
    assert.ok(!serialized.includes('HR private diary'), 'no foreign content leaks')
    assert.ok(!serialized.includes('agt_hr'), 'no foreign coordinates leak')
    for (const row of forA.result.sessions) {
      assert.ok(!('content' in row) && !('messages' in row) && !('text' in row), 'coordinate-only shape')
    }
    // Foreign caller identity is fail-closed, never an enumeration.
    const bad = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'not-an-agent' })
    assert.equal(bad.ok, false)
    assert.equal(bad.code, 'forbidden_not_owner')
  } finally { destroyFixtureRoot(fixture) }
})

// ── T8 ───────────────────────────────────────────────────────────────────────

test('T8: no fuzzy join — with the journal gone the scheduler→session join becomes an explicit gap, never a success', async () => {
  const fixture = buildFixtureRoot()
  try {
    rmSync(join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY, 'cron-run-occ~003A003a05ed6629f358ff53'), { recursive: true, force: true })
    const outcome = await queryExecutionTrace({
      root: 'scheduler_run', args: { occurrenceId: OCC_ID }, viewer: SELF_HR, paths: fixture.paths,
    })
    assert.equal(outcome.ok, true)
    const r = outcome.result
    assert.ok(!r.timeline.some((e) => e.source === 'session_journal'), 'no session record without the journal')
    assert.ok(!r.correlations.some((c) => c.rule === 'R5' && String(c.to.nativeRef).startsWith('agt_hr/')), 'no session correlation without existence proof')
    const gapEntry = r.gaps.find((g) => g.code === 'CORRELATION_GAP' && g.stage === 'session_journal')
    assert.ok(gapEntry, 'the missing journal is an explicit, honest gap')
    assert.equal(gapEntry.knownFacts.occurrenceId, OCC_ID)
  } finally { destroyFixtureRoot(fixture) }
})

test('CTR-SCT-007 blocker regression: ledger-absent AND journal-absent world still emits the honest session gap (rotated occurrence)', async () => {
  const fixture = buildFixtureRoot()
  try {
    // The job's occurrences have fully rotated out of the authority ledger
    // (store readable, job present, zero occurrences) and the cron journal
    // deleted — a JOB-LEVEL query then rides only on the history run_records.
    // The pre-repair build silently emitted ZERO session gaps here; the
    // honest-gap flush must cover the unswept world.
    const store = JSON.parse(readFileSync(fixture.paths.jobsStore, 'utf8'))
    store.occurrences = store.occurrences.filter((o) => o.jobId !== JOB_ID)
    writeFileSync(fixture.paths.jobsStore, JSON.stringify(store))
    rmSync(join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY, 'cron-run-occ~003A003a05ed6629f358ff53'), { recursive: true, force: true })
    const outcome = await queryExecutionTrace({
      root: 'scheduler_run', args: { jobId: JOB_ID }, viewer: SELF_HR, paths: fixture.paths,
    })
    assert.equal(outcome.ok, true)
    const r = outcome.result
    assert.ok(r.timeline.some((e) => e.kind === 'run_record'), 'history-only run_record surfaced in the job-level query')
    assert.ok(!r.correlations.some((c) => c.rule === 'R5' && String(c.to.nativeRef).startsWith('agt_hr/')), 'no fabricated join')
    const gapEntry = r.gaps.find((g) => g.code === 'CORRELATION_GAP' && g.stage === 'session_journal' && g.knownFacts.occurrenceId === OCC_ID)
    assert.ok(gapEntry, 'the run still answers with an explicit gap — never silence')
    assert.match(gapEntry.knownFacts.reason, /sweep bound/, 'the gap wording does not claim the journal is unreadable — only unlocated within the sweep')
  } finally { destroyFixtureRoot(fixture) }
})

// ── B1 (PR #318 review): foreign / suffix-compatible sessions never join ────

test('B1: a foreign-agent journal or a suffix-compatible unrelated session can NEVER be promoted to the exact scheduler SessionRef', async () => {
  const fixture = buildFixtureRoot()
  try {
    // Foreign agent whose sessionId merely ENDS WITH the occurrence's final
    // segment (the exact shape of the GitHub review counterexample), plus a
    // same-agent decoy with a suffix-appended id.
    mkdirSync(join(fixture.paths.homesRoot, 'agt_evil', 'sessions', '--evil--', 'unrelated-003a05ed6629f358ff53'), { recursive: true })
    writeFileSync(join(fixture.paths.homesRoot, 'agt_evil', 'sessions', '--evil--', 'unrelated-003a05ed6629f358ff53', 'session.jsonl'), [
      JSON.stringify({ type: 'session', version: 0, id: 'unrelated-003a05ed6629f358ff53', createdAt: 1, cwd: '/e' }),
    ].join('\n') + '\n')
    mkdirSync(join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY, 'cron-run-occ~003A003a05ed6629f358ff53X'), { recursive: true })
    writeFileSync(join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY, 'cron-run-occ~003A003a05ed6629f358ff53X', 'session.jsonl'), [
      JSON.stringify({ type: 'session', version: 0, id: 'cron-run-occ:003a05ed6629f358ff53X', createdAt: 1, cwd: '/w' }),
    ].join('\n') + '\n')

    const outcome = await queryExecutionTrace({
      root: 'scheduler_run', args: { occurrenceId: OCC_ID }, viewer: SELF_HR, paths: fixture.paths,
    })
    assert.equal(outcome.ok, true)
    const r = outcome.result
    assert.ok(!r.correlations.some((c) => c.rule === 'R5' && String(c.to.nativeRef).startsWith('agt_evil/')), 'foreign agent journal never joins')
    assert.ok(!r.correlations.some((c) => c.rule === 'R5' && String(c.to.nativeRef).includes('003a05ed6629f358ff53X')), 'suffix-appended same-agent decoy never joins')
    assert.ok(!r.timeline.some((e) => e.source === 'session_journal' && JSON.stringify(e.nativeRefs).includes('agt_evil')), 'foreign journal record never enters the trace')

    // The REAL canonical session still joins exactly (owner + exact decoded id).
    const canonical = r.correlations.find((c) => c.rule === 'R5' && c.to.nativeRef.startsWith('agt_hr/cron-run-occ~003A003a05ed6629f358ff53') && !c.to.nativeRef.includes('X'))
    assert.ok(canonical, 'canonical owner+identity journal still joins')
    assert.equal(canonical.strength, 'DERIVED_EXACT')
  } finally { destroyFixtureRoot(fixture) }
})

// ── B2 (PR #318 review): journals created after the index must be discovered ─

test('B2: a journal created after the index exists is discovered by the next listing (NEW_SESSION_JOURNAL_CREATED)', () => {
  const fixture = buildFixtureRoot()
  try {
    const before = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(before.ok, true)
    const beforeIds = before.result.sessions.map((s) => s.sessionId)
    assert.ok(!beforeIds.includes('fresh-after-index'), 'pre-condition: new session does not exist yet')

    // Create a NEW journal; touch NO previously listed journal.
    mkdirSync(join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY, 'fresh-after-index'), { recursive: true })
    writeFileSync(join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY, 'fresh-after-index', 'session.jsonl'), [
      JSON.stringify({ type: 'session', version: 0, id: 'fresh-after-index', createdAt: 42, cwd: '/w' }),
    ].join('\n') + '\n')

    const after = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(after.ok, true)
    assert.ok(after.result.sessions.some((s) => s.sessionId === 'fresh-after-index'), 'new journal MUST appear')
  } finally { destroyFixtureRoot(fixture) }
})

// ── C1/C2 (GitHub fresh review @ d25ae108): caller-scoped scan, no fleet index ─

test('C1/C2: the listing scans ONLY the caller subtree — it never builds or reads the fleet-wide index and never inherits its cap', () => {
  const fixture = buildFixtureRoot()
  try {
    // No index exists at all; the listing must still succeed WITHOUT creating
    // one (a caller must not be able to trigger a fleet-wide journal scan).
    const out = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(out.ok, true)
    assert.equal(out.result.sessions.length, 2, 'caller sessions enumerated completely from the caller subtree')
    assert.ok(!existsSync(join(indexDirOf(fixture), 'sessions.idx.jsonl')), 'listing must not create the fleet-wide index file')

    // Even a deliberately stale/poisoned fleet index (zero caller entries) is
    // irrelevant: the listing enumerates the caller subtree independently, so
    // no global cap can truncate the caller's own sessions.
    mkdirSync(indexDirOf(fixture), { recursive: true })
    writeFileSync(join(indexDirOf(fixture), 'sessions.idx.jsonl'), JSON.stringify({ v: 2, agentId: 'agt_other', sessionId: 'main', file: '/nonexistent', coordinates: {} }) + '\n')
    const poisoned = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(poisoned.ok, true)
    assert.equal(poisoned.result.sessions.length, 2, 'caller listing unaffected by fleet index contents/cap')
  } finally { destroyFixtureRoot(fixture) }
})

// ── C3 (GitHub fresh review @ d25ae108): rotated occurrence-scoped gap ──────

test('C3: occurrence-scoped query for a rotated occurrence still emits the session answer (honest gap, never silence)', async () => {
  const fixture = buildFixtureRoot()
  try {
    // The occurrence has rotated out of the ledger (store readable, exact
    // history run_record present) AND its journal is deleted. The query must
    // still answer with CORRELATION_GAP{session_journal} for that run.
    const store = JSON.parse(readFileSync(fixture.paths.jobsStore, 'utf8'))
    store.occurrences = store.occurrences.filter((o) => o.occurrenceId !== OCC_ID)
    writeFileSync(fixture.paths.jobsStore, JSON.stringify(store))
    rmSync(join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY, 'cron-run-occ~003A003a05ed6629f358ff53'), { recursive: true, force: true })

    const outcome = await queryExecutionTrace({
      root: 'scheduler_run', args: { occurrenceId: OCC_ID }, viewer: SELF_HR, paths: fixture.paths,
    })
    assert.equal(outcome.ok, true)
    const r = outcome.result
    assert.ok(r.timeline.some((e) => e.kind === 'run_record' && e.nativeRefs.occurrence_id === OCC_ID), 'the exact rotated run_record still surfaces')
    assert.ok(!r.correlations.some((c) => c.rule === 'R5' && String(c.to.nativeRef).startsWith('agt_hr/')), 'no join without the journal')
    const gapEntry = r.gaps.find((g) => g.code === 'CORRELATION_GAP' && g.stage === 'session_journal' && g.knownFacts.occurrenceId === OCC_ID)
    assert.ok(gapEntry, 'the session gap is emitted for the rotated occurrence — never silence')
  } finally { destroyFixtureRoot(fixture) }
})

// ── C5 (GitHub fresh review @ d25ae108): non-finite cursor timestamps ───────

test('C5: a base64url cursor decoding to a non-finite timestamp is rejected, never a repeating first page', () => {
  const fixture = buildFixtureRoot()
  try {
    // base64url('NaN:main') — syntactically valid cursor, non-finite atMs.
    const out = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr', cursor: 'TmFOOm1haW4' })
    assert.equal(out.ok, false)
    assert.equal(out.code, 'invalid_arguments')
  } finally { destroyFixtureRoot(fixture) }
})

// ── F1 (PR #318 review): authoritative pagination validation in the core ────

test('F1: listing core rejects invalid pagination (no clamping, no silent drop)', async () => {
  const fixture = buildFixtureRoot()
  try {
    const base = { homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' }
    for (const bad of [{ limit: 0 }, { limit: 201 }, { limit: 1.5 }, { limit: '10' }, { limit: null }, { cursor: 5 }, { cursor: {} }, { cursor: [] }, { cursor: '' }]) {
      const out = listAgentSessions({ ...base, ...bad })
      assert.equal(out.ok, false, `expected invalid_arguments for ${JSON.stringify(bad)}`)
      assert.equal(out.code, 'invalid_arguments')
    }
    // Valid faces unchanged: absent, explicit null cursor, and 1..200 integers.
    for (const good of [{}, { cursor: null }, { limit: 1 }, { limit: 200 }]) {
      const out = listAgentSessions({ ...base, ...good })
      assert.equal(out.ok, true, `expected ok for ${JSON.stringify(good)}`)
    }
  } finally { destroyFixtureRoot(fixture) }
})

// ── F1 (PR #318 review): trusted handler = authoritative validation boundary ─

test('F1: direct parent-RPC calls to the trusted handler fail closed on invalid pagination (never clamped or dropped)', async () => {
  const fixture = buildFixtureRoot()
  try {
    const { createExecutionHistoryRuntime } = await import('../../production-runtime/src/execution-history/runtime.js')
    const runtime = createExecutionHistoryRuntime({
      layout: {
        homesRoot: fixture.paths.homesRoot,
        controlDir: fixture.paths.controlDir,
        historyDir: fixture.paths.historyDir,
        jobsStore: fixture.paths.jobsStore,
        workflowExecutionDir: fixture.paths.workflowExecutionDir,
        evidenceLog: fixture.paths.evidenceLog,
      },
      credentialsFile: '/dev/null', authServiceOrigin: '', log: {},
    })
    const providers = new Map()
    runtime.mount({ provide: (k, v) => providers.set(k, v) })
    const list = providers.get('executionHistoryAccess').handlers.agent_session_list.list

    const invalid = [
      { limit: 0 }, { limit: 201 }, { limit: 1.5 }, { limit: '10' }, { limit: null },
      { cursor: 5 }, { cursor: {} }, { cursor: [] }, { cursor: '' },
      { unknown: 1 }, { limit: 5, other: true },
    ]
    for (const args of invalid) {
      const out = await list(args, { agentId: 'agt_hr' })
      assert.equal(out.ok, false, `expected invalid_arguments for ${JSON.stringify(args)}`)
      assert.equal(out.error?.code, 'invalid_arguments')
    }
    // Valid faces: absent, null cursor, 1..200 integers — unchanged behavior.
    for (const args of [undefined, {}, { cursor: null }, { limit: 1 }, { limit: 200 }]) {
      const out = await list(args, { agentId: 'agt_hr' })
      assert.equal(out.ok, true, `expected ok for ${JSON.stringify(args)}`)
      assert.ok(Array.isArray(out.result.sessions), 'listing executed')
    }
    // Wrong viewer identity still fails closed.
    const noIdentity = await list({}, {})
    assert.equal(noIdentity.ok, false)
    assert.equal(noIdentity.error?.code, 'forbidden_not_owner')
  } finally { destroyFixtureRoot(fixture) }
})

test('CTR-SCT-002: keyset pagination is deterministic and exhaustive', () => {
  const fixture = buildFixtureRoot()
  try {
    const first = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr', limit: 1 })
    assert.equal(first.ok, true)
    if (first.result.truncated) {
      assert.ok(typeof first.result.nextCursor === 'string' && first.result.nextCursor.length > 0)
      const second = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr', cursor: first.result.nextCursor })
      assert.equal(second.ok, true)
      const firstIds = first.result.sessions.map((s) => s.sessionId)
      const secondIds = second.result.sessions.map((s) => s.sessionId)
      for (const id of secondIds) assert.ok(!firstIds.includes(id), 'pages never overlap')
      assert.deepEqual([...firstIds, ...secondIds].sort(), ['cron-run-occ:003a05ed6629f358ff53', 'main'], 'pagination covers the whole owned set')
    }
    const badCursor = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr', cursor: '%%%not-base64url%%%' })
    assert.equal(badCursor.ok, false)
    assert.equal(badCursor.code, 'invalid_arguments')
  } finally { destroyFixtureRoot(fixture) }
})

test('CTR-SCT-002: scheduler-kind sessions carry their occurrence coordinate; origins reflect journal sidecars', () => {
  const fixture = buildFixtureRoot()
  try {
    const forHr = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(forHr.ok, true)
    const cron = forHr.result.sessions.find((s) => s.kind === 'scheduler')
    assert.ok(cron, 'cron-run session listed with kind=scheduler')
    assert.equal(cron.sessionId, 'cron-run-occ:003a05ed6629f358ff53', 'dir name decoded to the native session id (real ~003A encoding)')
    assert.equal(forHr.result.anomalies.idMismatch, 0, 'a healthy dir/header encoding pair is NEVER an anomaly (CTR-SCT-002 honesty counter)')
    assert.ok(cron.schedulerOccurrenceIds.includes(OCC_ID), 'occurrence coordinate derived from the session id')
    const main = forHr.result.sessions.find((s) => s.sessionId === 'main')
    assert.equal(main.kind, 'main')
    assert.equal(main.origins.user, true, 'user-origin presence from the journal')
  } finally { destroyFixtureRoot(fixture) }
})
