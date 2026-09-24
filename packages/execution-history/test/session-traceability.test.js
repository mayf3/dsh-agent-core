/**
 * SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 — scheduler / workflow / send
 * matrix acceptance tests over the isolated fixture root (zero production
 * side-effects).
 *
 *  T2   scheduler run → SessionRef resolution (ledger dispositions)
 *  T3   pre-session failure → SESSION_CREATED=NO with the exact persisted
 *       reason, and NO fabricated sessionId anywhere in the result
 *  T5   workflow attempt → SessionRef → messageId pass-through honesty
 *  T8   no fuzzy join: removing the journal turns the join into an explicit gap
 *  B1   foreign / suffix-compatible sessions never join (PR #318 review)
 *  C3   rotated occurrence-scoped gap (PR #318 review @ d25ae108)
 *  D1/D2 native ids + unbounded job-level coverage (PR #318 review @ 70bc04d0)
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { queryExecutionTrace } from '../src/index.js'
import { sessionDispositionOf } from '../src/correlate/scheduler-root.js'
import { sessionDispositionOf as schedulerSideDisposition } from '../../scheduler/src/self-service/projections.js'
import { loadAttemptsLedger } from '../src/loaders/attempts-ledger.js'
import { buildFixtureRoot, destroyFixtureRoot, OCC_ID, OCC_ID_2, JOB_ID, WF_ID } from './fixtures.js'

const SELF_A = { agentId: 'agt_a', audit: false }
const SELF_HR = { agentId: 'agt_hr', audit: false }
const PROJ_KEY = '--Users-fixture--'

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
    const hrJoin = outcome.result.correlations.find((c) => c.rule === 'R5' && String(c.to.nativeRef).startsWith('agt_hr/'))
    assert.ok(hrJoin, 'session correlation present')
    assert.equal(hrJoin.strength, 'DERIVED_EXACT', 'deterministic derivation + located journal = existence proof')

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
    // D1: the join exposes the NATIVE session id (colon form), never the encoding.
    const canonical = r.correlations.find((c) => c.rule === 'R5' && c.to.nativeRef === 'agt_hr/cron-run-occ:003a05ed6629f358ff53')
    assert.ok(canonical, 'canonical owner+identity journal still joins')
    assert.equal(canonical.strength, 'DERIVED_EXACT')
  } finally { destroyFixtureRoot(fixture) }
})

// ── G1 (security review @ acceptance head): late pre-start discriminator in history ─

test('G1: a late pre-start rejection persists its discriminator in history — ledger-rotated world answers not_created, never unknown-with-session', async () => {
  const fixture = buildFixtureRoot()
  try {
    // The timed-out occurrence settled late with a deterministic not-started
    // proof: the ledger row carries pre-start-rejection AND the durable
    // late_settlement history event carries the same classification (S1/G1).
    const store = JSON.parse(readFileSync(fixture.paths.jobsStore, 'utf8'))
    store.occurrences = store.occurrences.filter((o) => o.occurrenceId !== OCC_ID)
    store.occurrences.push({
      occurrenceId: OCC_ID, jobId: JOB_ID, agentId: 'agt_hr', scheduleRevision: 1,
      state: 'failed', executionOutcome: 'failed', deliveryStatus: 'none',
      nativeSessionId: 'cron-run-occ:003a05ed6629f358ff53',
      terminalEvidence: { kind: 'pre-start-rejection', code: 'AGENT_NOT_FOUND' },
      admittedAt: 1758100000000 + 5000, updatedAtMs: 1758100000000 + 5100,
    })
    writeFileSync(fixture.paths.jobsStore, JSON.stringify(store))
    const eventsPath = join(fixture.paths.historyDir, 'events.jsonl')
    writeFileSync(eventsPath, readFileSync(eventsPath, 'utf8') + JSON.stringify({
      ts: 1758100000000 + 5200, type: 'late_settlement', resolved_to: 'failed', basis: 'trusted-late-evidence',
      note: 'invoker late proven terminal failure after timeout: not_admitted',
      terminal_evidence: { kind: 'pre-start-rejection', detailRef: 'not_admitted' },
      occurrence_id: OCC_ID, run_id: `run:${OCC_ID}`, job_id: JOB_ID, ended_at_ms: 1758100000000 + 5200,
    }) + '\n')
    rmSync(join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY, 'cron-run-occ~003A003a05ed6629f358ff53'), { recursive: true, force: true })

    const outcome = await queryExecutionTrace({
      root: 'scheduler_run', args: { occurrenceId: OCC_ID }, viewer: SELF_HR, paths: fixture.paths,
    })
    assert.equal(outcome.ok, true)
    const occurrence = outcome.result.timeline.find((e) => e.kind === 'occurrence')
    assert.ok(occurrence, 'ledger occurrence surfaced')
    assert.equal(occurrence.data.sessionCreated, 'not_created', 'ledger discriminator answered')
    assert.equal(occurrence.nativeRefs.sessionId, undefined, 'no sessionId for the never-created session')
  } finally { destroyFixtureRoot(fixture) }
})

test('G1b: ledger-rotated late pre-start rejection answers not_created from HISTORY alone (no ledger row)', async () => {
  const fixture = buildFixtureRoot()
  try {
    // Full rotation: no ledger occurrence, no journal — but the durable
    // late_settlement event carries the discriminator.
    const store = JSON.parse(readFileSync(fixture.paths.jobsStore, 'utf8'))
    store.occurrences = store.occurrences.filter((o) => o.jobId !== JOB_ID)
    writeFileSync(fixture.paths.jobsStore, JSON.stringify(store))
    const eventsPath = join(fixture.paths.historyDir, 'events.jsonl')
    writeFileSync(eventsPath, readFileSync(eventsPath, 'utf8') + JSON.stringify({
      ts: 1758100000000 + 6200, type: 'late_settlement', resolved_to: 'failed', basis: 'trusted-late-evidence',
      note: 'invoker late proven terminal failure after timeout: not_admitted',
      terminal_evidence: { kind: 'pre-start-rejection', detailRef: 'AGENT_NOT_FOUND' },
      occurrence_id: OCC_ID, run_id: `run:${OCC_ID}`, job_id: JOB_ID, ended_at_ms: 1758100000000 + 6200,
    }) + '\n')
    rmSync(join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY, 'cron-run-occ~003A003a05ed6629f358ff53'), { recursive: true, force: true })

    const outcome = await queryExecutionTrace({
      root: 'scheduler_run', args: { occurrenceId: OCC_ID }, viewer: SELF_HR, paths: fixture.paths,
    })
    assert.equal(outcome.ok, true)
    const occurrence = outcome.result.timeline.find((e) => e.kind === 'occurrence')
    assert.ok(!occurrence, 'no ledger row — the history answer must still gate the session id')
    assert.ok(!outcome.result.correlations.some((c) => c.rule === 'R5' && String(c.to.nativeRef).startsWith('agt_hr/')), 'no session join for the never-created session')
    assert.ok(!outcome.result.timeline.some((e) => e.source === 'session_journal'), 'no session fabricated from the rotated world')
    assert.ok(!outcome.result.gaps.some((g) => g.stage === 'session_journal'), 'not_created suppresses even the journal gap — there is nothing missing')
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

// ── D1/D2 (GitHub fresh review @ 70bc04d0) ───────────────────────────────────

test('T8-A: deleting the invocation evidence NEVER demotes the exact join — journal identity is the proof (invocation rows are auxiliary)', async () => {
  const fixture = buildFixtureRoot()
  try {
    // Authoritative owner/occurrence coordinates and the canonical scheduler
    // session journal still exist; ONLY the auxiliary invocation evidence is
    // deleted. The join must remain DERIVED_EXACT — auxiliary evidence can
    // neither create nor downgrade it (T8 frozen semantics).
    writeFileSync(join(fixture.paths.controlDir, 'runtime-evidence.jsonl'), [
      { kind: 'ready', pid: 1, ts: 1 },
    ].map((r) => JSON.stringify(r)).join('\n') + '\n')

    const outcome = await queryExecutionTrace({
      root: 'scheduler_run', args: { occurrenceId: OCC_ID }, viewer: SELF_HR, paths: fixture.paths,
    })
    assert.equal(outcome.ok, true)
    const faJoin = outcome.result.correlations.find((c) => c.rule === 'R5' && String(c.to.nativeRef).startsWith('agt_hr/'))
    assert.ok(faJoin, 'the join is still reported')
    assert.equal(faJoin.strength, 'DERIVED_EXACT', 'canonical identity + owner + journal existence = exact, unconditionally')
    assert.equal(faJoin.from.source, 'scheduler_store')
  } finally { destroyFixtureRoot(fixture) }
})

test('D1: exact scheduler joins expose the NATIVE session id (decoded), never the directory encoding', async () => {
  const fixture = buildFixtureRoot()
  try {
    const outcome = await queryExecutionTrace({
      root: 'scheduler_run', args: { occurrenceId: OCC_ID }, viewer: SELF_HR, paths: fixture.paths,
    })
    assert.equal(outcome.ok, true)
    const join = outcome.result.correlations.find((c) => c.rule === 'R5' && String(c.to.nativeRef).startsWith('agt_hr/'))
    assert.ok(join, 'session join present')
    assert.equal(join.to.nativeRef, 'agt_hr/cron-run-occ:003a05ed6629f358ff53', 'native SessionRef (colon form), not the ~003A directory encoding')
    assert.ok(join.evidenceRefs.includes('cron-run-occ:003a05ed6629f358ff53'), 'evidence refs carry the native id too')
  } finally { destroyFixtureRoot(fixture) }
})

test('D2: job-level queries give a session answer to EVERY job run record — runs beyond the ledger slice are never stranded', async () => {
  const fixture = buildFixtureRoot()
  try {
    // A run whose occurrence was rotated out of the ledger (history only,
    // no journal) while the ledger retains other occurrences for the same job.
    const store = JSON.parse(readFileSync(fixture.paths.jobsStore, 'utf8'))
    const rotated = { occurrenceId: 'occ:003a05ed6629bbbb', jobId: JOB_ID, agentId: 'agt_hr', scheduleRevision: 1, state: 'succeeded', executionOutcome: 'succeeded', deliveryStatus: 'none', nativeSessionId: 'cron-run-occ:003a05ed6629bbbb', admittedAt: 5, updatedAtMs: 6 }
    store.occurrences.push(rotated)
    writeFileSync(fixture.paths.jobsStore, JSON.stringify(store))
    const runsPath = join(fixture.paths.historyDir, 'runs-202609.json')
    const runs = JSON.parse(readFileSync(runsPath, 'utf8'))
    runs.records.push({
      run_id: 'run:occ:003a05ed6629cccc', occurrence_id: 'occ:003a05ed6629cccc', job_id: JOB_ID, agent_id: 'agt_hr',
      session_id: 'cron-run-occ:003a05ed6629cccc', outcome: 'succeeded', status_view: 'succeeded',
      delivery_status: 'none', result: { final_status: 'PASS', counters: {}, notes: '' },
    })
    writeFileSync(runsPath, JSON.stringify(runs, null, 2) + '\n')

    const outcome = await queryExecutionTrace({
      root: 'scheduler_run', args: { jobId: JOB_ID }, viewer: SELF_HR, paths: fixture.paths,
    })
    assert.equal(outcome.ok, true)
    const r = outcome.result
    assert.ok(r.timeline.some((e) => e.kind === 'run_record' && e.nativeRefs.occurrence_id === 'occ:003a05ed6629cccc'), 'the ledger-absent run_record is NOT stranded outside the job-level projection')
    const gapEntry = r.gaps.find((g) => g.code === 'CORRELATION_GAP' && g.stage === 'session_journal' && g.knownFacts.occurrenceId === 'occ:003a05ed6629cccc')
    assert.ok(gapEntry, 'the stranded run still owes (and gets) its honest session answer')
  } finally { destroyFixtureRoot(fixture) }
})
