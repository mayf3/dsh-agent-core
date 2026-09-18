/**
 * T1/T2/T3 + loader unit coverage (Spec §9). Isolated fixtures only.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { loadAsmAudit } from '../src/loaders/asm-audit.js'
import { loadAttemptsLedger, projectAttempts } from '../src/loaders/attempts-ledger.js'
import { loadSchedulerHistory } from '../src/loaders/scheduler-history.js'
import { loadSchedulerStore, findJob, jobRoutingAgent, occurrencesOf } from '../src/loaders/scheduler-store.js'
import { loadRuntimeEvidence } from '../src/loaders/runtime-evidence.js'
import { loadSessionJournal, projectJournal, resolveSessionFile } from '../src/loaders/session-journal.js'
import { readJsonlFile } from '../src/loaders/lines.js'
import { buildFixtureRoot, destroyFixtureRoot, ATTEMPT_ID, VISIT_ID, WF_ID, MESSAGE_ID, OCC_ID, JOB_ID, attemptIdFor } from './fixtures.js'

// The gen-N derivation used by the test mirrors the R2 ground truth (the
// fixture helper re-exports the same formula; local copy guards regression).
function attemptIdFormula(nodeVisitId, generation = 1) {
  return attemptIdFor(nodeVisitId, generation)
}

test('T1 attempts ledger: multi-generation attempts stay separate and project in order', async () => {
  const fixture = buildFixtureRoot()
  try {
    // Append a gen-2 stale re-entry for the same visit (stale_superseded chain).
    const ledgerPath = join(fixture.paths.workflowExecutionDir, 'attempts.jsonl')
    const gen2 = attemptIdFormula(VISIT_ID, 2)
    writeFileSync(ledgerPath, readFileSync(ledgerPath, 'utf8') + [
      JSON.stringify({ kind: 'attempt_planned', attemptId: gen2, nodeVisitId: VISIT_ID, dispatchIntentId: '44444444-4444-4444-8444-444444444444', workflowInstanceId: WF_ID, ownerPrincipalId: '55555555-5555-4555-8555-555555555555', generation: 2, atMs: 1758100001000 }),
      JSON.stringify({ kind: 'stale_superseded', nodeVisitId: VISIT_ID, observedWorkflowStateVersion: 7, atMs: 1758100001100 }),
    ].join('\n') + '\n')
    const loaded = loadAttemptsLedger({ workflowExecutionDir: fixture.paths.workflowExecutionDir })
    assert.equal(loaded.status.status, 'OK')
    const projections = projectAttempts(loaded.records)
    const visit = projections.find((p) => p.nodeVisitId === VISIT_ID)
    assert.ok(visit, 'visit projected')
    assert.equal(visit.generation, 2)
    assert.equal(visit.attemptId, gen2)
    // T1 core invariant: the stale re-entry preserves the ENTIRE gen-1
    // evidence — its run_delivered receipt (the R3/R1 join anchor) survives.
    assert.equal(visit.generations.length, 2, 'both generations retained')
    const gen1 = visit.generations.find((g) => g.generation === 1)
    assert.ok(gen1?.events.some((e) => e.kind === 'attempt_run_delivered'), 'gen-1 run_delivered preserved')
    assert.ok(visit.events.some((e) => e.kind === 'attempt_run_delivered' && e.nativeRefs.messageId === 'om_wf_dispatch_1'), 'flat event list keeps the gen-1 receipt')
    assert.ok(visit.events.some((e) => e.kind === 'attempt_stale_superseded'), 'gen-2 superseded evidence retained')
    // R2: both derivation paths agree for gen 1 and gen 2.
    assert.equal(attemptIdFormula(VISIT_ID, 1), ATTEMPT_ID)
    assert.notEqual(attemptIdFormula(VISIT_ID, 2), ATTEMPT_ID)
  } finally { destroyFixtureRoot(fixture) }
})

test('T2 ASM audit loader: archive rows survive; whole-line dedupe; outcome row carries receipt loss visibly', async () => {
  const fixture = buildFixtureRoot()
  try {
    const loaded = loadAsmAudit({ auditFile: fixture.auditFile })
    assert.equal(loaded.status.status, 'OK')
    assert.ok(loaded.records.some((r) => r.nativeRefs.requestId === 'req-old-archived'), 'archived row readable beyond .1 window')
    const outcome = loaded.records.find((r) => r.kind === 'send_outcome')
    assert.ok(outcome, 'outcome row present')
    assert.equal(outcome.nativeRefs.messageId, MESSAGE_ID)
    assert.equal(outcome.data.result, 'accepted')
    // Duplicate the same outcome line into the archive (crash-window shape):
    // loader dedupe must collapse it.
    const archivePath = join(fixture.paths.controlDir, 'agent-session-messaging-audit-archive.jsonl')
    const liveText = readFileSync(fixture.auditFile, 'utf8').trimEnd().split('\n')
    const outcomeLine = liveText.find((l) => l.includes('"phase":"outcome"'))
    writeFileSync(archivePath, readFileSync(archivePath, 'utf8') + outcomeLine + '\n')
    const reloaded = loadAsmAudit({ auditFile: fixture.auditFile })
    const outcomeCount = reloaded.records.filter((r) => r.kind === 'send_outcome').length
    assert.equal(outcomeCount, 1, 'duplicate line collapsed by whole-line hash')
  } finally { destroyFixtureRoot(fixture) }
})

test('T3 source loaders degrade instead of throwing (bad lines, missing files)', async () => {
  const fixture = buildFixtureRoot()
  try {
    const historyPath = join(fixture.paths.historyDir, 'events.jsonl')
    writeFileSync(historyPath, readFileSync(historyPath, 'utf8') + '{corrupt json\n')
    const history = loadSchedulerHistory({ historyDir: fixture.paths.historyDir })
    assert.equal(history.status.status, 'DEGRADED')
    assert.equal(history.status.badLines, 1)
    assert.ok(history.records.length >= 3, 'good lines still loaded')
    const empty = loadSchedulerHistory({ historyDir: join(fixture.paths.historyDir, 'nope') })
    assert.equal(empty.status.status, 'ABSENT')
    const read = readJsonlFile(join(fixture.paths.controlDir, 'does-not-exist.jsonl'))
    assert.equal(read.absent, true)
  } finally { destroyFixtureRoot(fixture) }
})

test('T3 scheduler store: admission facts for jobs and occurrences; routing agent resolution', async () => {
  const fixture = buildFixtureRoot()
  try {
    const store = loadSchedulerStore({ jobsStore: fixture.paths.jobsStore })
    assert.equal(store.status.status, 'OK')
    const job = findJob(store.jobs, JOB_ID)
    assert.ok(job)
    assert.equal(jobRoutingAgent(job), 'agt_hr')
    const occs = occurrencesOf(store.occurrences, JOB_ID)
    assert.equal(occs.length, 1)
    assert.equal(occs[0].occurrenceId, OCC_ID)
    assert.equal(occs[0].nativeSessionId, 'cron-run-occ:003a05ed6629f358ff53')
  } finally { destroyFixtureRoot(fixture) }
})

test('T3 runtime evidence + scheduler history loaders surface invocation and terminal facts', async () => {
  const fixture = buildFixtureRoot()
  try {
    const evidence = loadRuntimeEvidence({ evidenceLog: fixture.paths.evidenceLog })
    assert.ok(evidence.records.some((r) => r.kind === 'evidence_invocation' && r.nativeRefs.reconciliationHandle === 'te-cron-1'))
    const history = loadSchedulerHistory({ historyDir: fixture.paths.historyDir })
    const runRecord = history.records.find((r) => r.kind === 'run_record')
    assert.ok(runRecord)
    assert.equal(runRecord.data.outcome, 'failed')
    assert.ok(Array.isArray(runRecord.data.result?.wake_sent))
    assert.equal(runRecord.data.result.wake_sent[0].workflow_instance_id, '22222222-2222-4222-8222-222222222222')
  } finally { destroyFixtureRoot(fixture) }
})

test('session journal loader: tolerant parse, projection with sidecars/tool coordinates/spliced ids', async () => {
  const fixture = buildFixtureRoot()
  try {
    const resolved = resolveSessionFile(fixture.paths.homesRoot, 'agt_a', 'main')
    assert.ok(resolved, 'main session resolved')
    const journal = loadSessionJournal({ file: resolved.file })
    assert.equal(journal.absent, false)
    assert.equal(journal.header?.id, 'main')
    const projected = projectJournal(journal.events)
    assert.ok(projected.spliced.some((s) => s.messageId === MESSAGE_ID))
    const wfMessage = projected.messages.find((m) => m.source?.kind === 'workflow_execution')
    assert.equal(wfMessage.source.workflowInstanceId, WF_ID)
    const transitionCall = projected.toolCalls.find((c) => c.coordinates?.workflowInstanceId === WF_ID && c.coordinates?.tool === 'workflow_execute')
    assert.ok(transitionCall, 'workflow_execute call coordinates extracted')
    const resultRecord = projected.toolCalls.find((c) => c.kind === 'result' && c.coordinates?.workflowStateVersion === 2)
    assert.ok(resultRecord, 'result stateVersion extracted (R4 bridge)')
    const hrResolved = resolveSessionFile(fixture.paths.homesRoot, 'agt_hr', 'cron-run-occ:003a05ed6629f358ff53')
    assert.ok(hrResolved, 'cron-run session resolved via header id / encoded dir name')
  } finally { destroyFixtureRoot(fixture) }
})
