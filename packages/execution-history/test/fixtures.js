/**
 * @agent-core/execution-history/test/fixtures.js — isolated temp-root fixture
 * builder (Spec §9: zero production side-effects). Shapes mirror the real
 * producers byte-for-byte at the field level (audit.js rows, ledger-events,
 * scheduler store/history, DSH session journal events).
 */

import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export const WF_ID = '11111111-1111-4111-8111-111111111111'
export const WF_ID_2 = '22222222-2222-4222-8222-222222222222'
export const VISIT_ID = '33333333-3333-4333-8333-333333333333'
export const INTENT_ID = '44444444-4444-4444-8444-444444444444'
export const PRINCIPAL_ID = '55555555-5555-4555-8555-555555555555'

/** R2 ground-truth derivation (ledger.js formula). */
export function attemptIdFor(nodeVisitId, generation = 1) {
  const base = nodeVisitId.toLowerCase()
  const material = generation === 1 ? base : `${base}#gen${generation}`
  return `wfeat-${createHash('sha256').update(material).digest('hex').slice(0, 24)}`
}

export const ATTEMPT_ID = attemptIdFor(VISIT_ID, 1)
export const MESSAGE_ID = 'om_fixture_message_0001'
export const REQUEST_ID = 'req-fixture-0001'
export const OCC_ID = 'occ:003a05ed6629f358ff53'
export const OCC_ID_2 = 'occ:003a05ed6629ffff'
export const JOB_ID = 'job_hr_daily'

const T0 = 1758100000000

export function buildFixtureRoot() {
  const root = join(tmpdir(), `exec-history-fixture-${process.pid}-${Math.random().toString(36).slice(2, 8)}`)
  const controlDir = join(root, 'control')
  const homesRoot = join(root, 'homes')
  const historyDir = join(root, 'scheduler', 'history')
  const workflowExecutionDir = join(root, 'workflow-execution')
  mkdirSync(controlDir, { recursive: true })
  mkdirSync(historyDir, { recursive: true })
  mkdirSync(workflowExecutionDir, { recursive: true })

  // ── ASM audit: intent + outcome (+ archive generation beyond the .1 window)
  const auditRows = [
    { kind: 'agent_session_send', phase: 'intent', sourceAgentId: 'agt_scheduler', targetAgentId: 'agt_a', requestId: REQUEST_ID, correlationHash: 'abcdef0123456789', invocationCorrelation: 'inv-1', timeoutMode: 'wait_reply', startedAtWallMs: T0, ts: T0 },
    { kind: 'agent_session_send', phase: 'outcome', sourceAgentId: 'agt_scheduler', targetAgentId: 'agt_a', requestId: REQUEST_ID, correlationHash: 'abcdef0123456789', timeoutMode: 'wait_reply', result: 'accepted', sessionId: 'main', messageId: MESSAGE_ID, reconciliationHandle: 'te-fixture-1', ts: T0 + 500 },
  ]
  writeFileSync(join(controlDir, 'agent-session-messaging-audit.jsonl'), auditRows.map((r) => JSON.stringify(r)).join('\n') + '\n')
  writeFileSync(join(controlDir, 'agent-session-messaging-audit-archive.jsonl'), JSON.stringify({ kind: 'agent_session_send', phase: 'intent', sourceAgentId: 'agt_scheduler', targetAgentId: 'agt_b', requestId: 'req-old-archived', correlationHash: 'ffff', ts: T0 - 9000 }) + '\n')
  writeFileSync(join(controlDir, 'runtime-evidence.jsonl'), [
    { kind: 'invocation', jobId: JOB_ID, occurrenceId: OCC_ID, sessionId: 'cron-run-occ:003a05ed6629f358ff53', reconciliationHandle: 'te-cron-1', summary: 'ok', ts: T0 + 900 },
    // SIBLING invocation + an uncoordinated row — §二 default-inclusion counterexamples.
    { kind: 'invocation', jobId: JOB_ID, occurrenceId: OCC_ID_2, sessionId: 'cron-run-occ:003a05ed6629ffff', reconciliationHandle: 'te-cron-2', summary: 'ok', ts: T0 + 1900 },
    { kind: 'invocation', sessionId: 'some-unrelated-session', summary: 'no coordinates', ts: T0 + 1950 },
    { kind: 'ready', pid: 1, ts: T0 - 100 },
  ].map((r) => JSON.stringify(r)).join('\n') + '\n')

  // ── Workflow attempts ledger: gen-1 planned → delivered (with messageId).
  // Row shape mirrors the real producer (ledger.js #recordForActive: every
  // row carries nodeVisitId + atMs).
  const ledgerRows = [
    { kind: 'attempt_planned', attemptId: ATTEMPT_ID, nodeVisitId: VISIT_ID, dispatchIntentId: INTENT_ID, workflowInstanceId: WF_ID, ownerPrincipalId: PRINCIPAL_ID, generation: 1, atMs: T0 + 100 },
    { kind: 'delivery_started', nodeVisitId: VISIT_ID, atMs: T0 + 110 },
    { kind: 'run_delivered', nodeVisitId: VISIT_ID, attemptId: ATTEMPT_ID, agentId: 'agt_a', requestId: ATTEMPT_ID, sessionId: 'main', messageId: 'om_wf_dispatch_1', reconciliationHandle: 'te-wf-1', atMs: T0 + 200 },
  ]
  writeFileSync(join(workflowExecutionDir, 'attempts.jsonl'), ledgerRows.map((r) => JSON.stringify(r)).join('\n') + '\n')

  // ── Scheduler store: one job (routing agt_hr) + two occurrences (occ2 is
  // a SIBLING run of the same job — the §二 mixing counterexample), plus an
  // enabled never-reserved job (the §一 job-presence counterexample).
  mkdirSync(join(root, 'scheduler'), { recursive: true })
  writeFileSync(join(root, 'scheduler', 'jobs.json'), JSON.stringify({
    version: 2,
    jobs: [
      { id: JOB_ID, name: 'HR daily', targetAgentId: 'agt_hr', enabled: true, schedule: { kind: 'cron', expr: '0 9 * * *' }, payload: {} },
      { id: 'job_never_ran', name: 'Enabled idle job', targetAgentId: 'agt_hr', enabled: true, schedule: { kind: 'cron', expr: '0 5 * * *' }, payload: {} },
    ],
    occurrences: [
      { occurrenceId: OCC_ID, jobId: JOB_ID, agentId: 'agt_hr', scheduleRevision: 1, state: 'failed', fenced: false, nativeSessionId: 'cron-run-occ:003a05ed6629f358ff53', executionOutcome: 'failed', deliveryStatus: 'none', admittedAt: T0 + 800, updatedAtMs: T0 + 990 },
      { occurrenceId: OCC_ID_2, jobId: JOB_ID, agentId: 'agt_hr', scheduleRevision: 1, state: 'succeeded', fenced: false, nativeSessionId: 'cron-run-occ:003a05ed6629ffff', executionOutcome: 'succeeded', deliveryStatus: 'none', admittedAt: T0 + 1800, updatedAtMs: T0 + 1990 },
    ],
    fences: {},
  }))

  // ── Scheduler structured history: reserved → running → terminal(failed) + monthly run record with wake_sent.
  const historyRows = [
    { ts: T0 + 800, type: 'occurrence_reserved', occurrence_id: OCC_ID, run_id: `run:${OCC_ID}`, job_id: JOB_ID, correlation_id: `schcorr:${OCC_ID}`, parent_run_id: null, origin: 'natural', admitted_at_ms: T0 + 800 },
    { ts: T0 + 850, type: 'run_state', state: 'running', occurrence_id: OCC_ID, run_id: `run:${OCC_ID}`, job_id: JOB_ID, started_at_ms: T0 + 850 },
    { ts: T0 + 980, type: 'run_terminal', outcome: 'failed', occurrence_id: OCC_ID, run_id: `run:${OCC_ID}`, job_id: JOB_ID, error_code: 'turn_failed' },
  ]
  writeFileSync(join(historyDir, 'events.jsonl'), historyRows.map((r) => JSON.stringify(r)).join('\n') + '\n')
  writeFileSync(join(historyDir, 'runs-202609.json'), JSON.stringify({
    version: 1, month: '202609', last_event_seq: 3,
    records: [{
      run_id: `run:${OCC_ID}`, occurrence_id: OCC_ID, job_id: JOB_ID, agent_id: 'agt_hr',
      session_id: 'cron-run-occ:003a05ed6629f358ff53', outcome: 'failed', status_view: 'failed',
      scheduled_at: '2026-09-17T04:42:00.000Z', started_at_ms: T0 + 850, ended_at_ms: T0 + 980,
      correlation_id: `schcorr:${OCC_ID}`, request_id: OCC_ID, delivery_status: 'none',
      result: { final_status: 'FAIL', counters: { attempts: 1 }, notes: 'turn failed', wake_sent: [{ target_agent_id: 'agt_a', workflow_instance_id: WF_ID_2, request_id: 'req-wake-1' }] },
    }, {
      // SIBLING run of the same job — must never appear in an occ1-scoped query.
      run_id: `run:${OCC_ID_2}`, occurrence_id: OCC_ID_2, job_id: JOB_ID, agent_id: 'agt_hr',
      session_id: 'cron-run-occ:003a05ed6629ffff', outcome: 'succeeded', status_view: 'succeeded',
      scheduled_at: '2026-09-18T04:42:00.000Z', started_at_ms: T0 + 1850, ended_at_ms: T0 + 1900,
      correlation_id: `schcorr:${OCC_ID_2}`, request_id: OCC_ID_2, delivery_status: 'none',
      result: { final_status: 'PASS', counters: {}, notes: '' },
    }],
  }, null, 2) + '\n')

  // ── Session journals.
  // Target main of agt_a: inter_agent spliced message + workflow tool call/result + sidecar-free second message.
  const projKey = '--Users-fixture--'
  mkdirSync(join(homesRoot, 'agt_a', 'sessions', projKey, 'main'), { recursive: true })
  const agtAEvents = [
    { type: 'session', version: 0, id: 'main', createdAt: T0 - 100, cwd: '/tmp/wf' },
    { type: 'permission/preset', seq: 1, time: new Date(T0).toISOString(), data: { preset: 'danger-full-access' } },
    { type: 'agent/inbox/spliced', seq: 2, time: new Date(T0 + 400).toISOString(), data: { messageId: MESSAGE_ID } },
    { type: 'user/message', seq: 3, time: new Date(T0 + 401).toISOString(), data: { content: 'private user text for agt_a', source: { kind: 'workflow_execution', workflowInstanceId: WF_ID, nodeVisitId: VISIT_ID, attemptId: ATTEMPT_ID }, messageId: 'om_wf_dispatch_1' } },
    { type: 'turn/start', seq: 4, time: new Date(T0 + 402).toISOString(), data: { turn: 1 } },
    { type: 'tool/call', seq: 5, time: new Date(T0 + 410).toISOString(), data: { turn: 1, callId: 'call-1', name: 'workflow_execute', arguments: JSON.stringify({ operation: 'transition', workflowInstanceId: WF_ID, transitionDefinitionId: 'trans-1', expectedWorkflowStateVersion: 1 }) } },
    { type: 'tool/result', seq: 6, time: new Date(T0 + 420).toISOString(), data: { turn: 1, message: { content: [{ type: 'tool-result', toolCallId: 'call-1', isError: false, content: JSON.stringify({ ok: true, result: { workflowInstanceId: WF_ID, workflowStateVersion: 2 } }) }] } } },
    { type: 'assistant/message', seq: 7, time: new Date(T0 + 430).toISOString(), data: { message: { content: [{ type: 'text', text: 'transition committed' }] } } },
    { type: 'turn/end', seq: 8, time: new Date(T0 + 440).toISOString(), data: { turn: 1, reason: { kind: 'completed' } } },
    { type: 'agent/inbox/spliced', seq: 9, time: new Date(T0 + 500).toISOString(), data: { messageId: MESSAGE_ID } },
    { type: 'user/message', seq: 10, time: new Date(T0 + 501).toISOString(), data: { content: 'inter_agent hello from scheduler', source: { kind: 'inter_agent', sourceAgentId: 'agt_scheduler', correlation: 'te-src-1' }, messageId: MESSAGE_ID } },
    // Real-production spliced shape: inserted[] entries carry source sidecars
    // without per-entry messageId (older seam builds).
    { type: 'agent/inbox/spliced', seq: 12, time: new Date(T0 + 700).toISOString(), data: { target: 'next-turn', inserted: [{ content: [{ type: 'text', text: 'injected dispatch note' }], source: { kind: 'inter_agent', sourceAgentId: 'agt_scheduler', correlation: 'te-src-2' } }] } },
    // Escaped-JSON tool coordinate (results/args pass through as strings in
    // real journals) — the index extractor must find these too.
    { type: 'tool/call', seq: 13, time: new Date(T0 + 710).toISOString(), data: { turn: 1, callId: 'call-2', name: 'workflow_instance_detail', arguments: '{"workflowInstanceId":"' + WF_ID_2 + '"}' } },
    // Real A2A sidecar with the production turn: correlation namespace —
    // the §三 reverse-lookup coordinate.
    { type: 'agent/inbox/spliced', seq: 14, time: new Date(T0 + 720).toISOString(), data: { target: 'next-turn', inserted: [{ content: [{ type: 'text', text: 'injected from turn namespace' }], source: { kind: 'inter_agent', sourceAgentId: 'agt_scheduler', correlation: 'turn:fixture-src-1' } }] } },
    { type: 'user/message', seq: 11, time: new Date(T0 + 600).toISOString(), data: { content: 'L'.repeat(2000), source: { kind: 'user' } } },
  ]
  writeFileSync(join(homesRoot, 'agt_a', 'sessions', projKey, 'main', 'session.jsonl'), agtAEvents.map((e) => JSON.stringify(e)).join('\n') + '\n')

  // HR cron-run session (naming-convention join target). Directory name uses
  // the REAL DSH segment encoding (encodeSegment: ':' → '~003A').
  mkdirSync(join(homesRoot, 'agt_hr', 'sessions', projKey, 'cron-run-occ~003A003a05ed6629f358ff53'), { recursive: true })
  const hrEvents = [
    { type: 'session', version: 0, id: 'cron-run-occ:003a05ed6629f358ff53', createdAt: T0 + 840, cwd: '/tmp/hr' },
    { type: 'user/message', seq: 1, time: new Date(T0 + 850).toISOString(), data: { content: 'daily HR run', source: { kind: 'user' } } },
    { type: 'turn/start', seq: 2, time: new Date(T0 + 851).toISOString(), data: { turn: 1 } },
    { type: 'turn/end', seq: 3, time: new Date(T0 + 970).toISOString(), data: { turn: 1, reason: { kind: 'failed' } } },
  ]
  writeFileSync(join(homesRoot, 'agt_hr', 'sessions', projKey, 'cron-run-occ~003A003a05ed6629f358ff53', 'session.jsonl'), hrEvents.map((e) => JSON.stringify(e)).join('\n') + '\n')

  // Foreign private session of agt_hr (redaction target).
  mkdirSync(join(homesRoot, 'agt_hr', 'sessions', projKey, 'main'), { recursive: true })
  const hrMain = [
    { type: 'session', version: 0, id: 'main', createdAt: T0, cwd: '/tmp/hr' },
    { type: 'user/message', seq: 1, time: new Date(T0 + 1).toISOString(), data: { content: 'HR private diary text', source: { kind: 'user' } } },
  ]
  writeFileSync(join(homesRoot, 'agt_hr', 'sessions', projKey, 'main', 'session.jsonl'), hrMain.map((e) => JSON.stringify(e)).join('\n') + '\n')

  // ── turn-recovery durable store (handle needle target).
  writeFileSync(join(controlDir, 'turn-recovery-v3.json'), JSON.stringify({ version: 3, records: [{ reconciliationHandle: 'te-cron-1', processGeneration: 1, sessionId: 'cron-run-occ:003a05ed6629f358ff53', startedAtMs: T0 + 850 }] }))

  return {
    root,
    paths: {
      homesRoot,
      controlDir,
      historyDir,
      jobsStore: join(root, 'scheduler', 'jobs.json'),
      workflowExecutionDir,
      evidenceLog: join(controlDir, 'runtime-evidence.jsonl'),
      turnRecoveryStore: join(controlDir, 'turn-recovery-v3.json'),
    },
    auditFile: join(controlDir, 'agent-session-messaging-audit.jsonl'),
    agtAMainFile: join(homesRoot, 'agt_a', 'sessions', projKey, 'main', 'session.jsonl'),
  }
}

export function destroyFixtureRoot(fixture) {
  try { rmSync(fixture.root, { recursive: true, force: true }) } catch { /* tmp best-effort */ }
}

/** Fake per-caller svc read surface (visibility + timeline + submissions). */export function fakeSvcRequest({ visible = true, assistanceOnly = false } = {}) {
  return async (_agentId, req) => {
    if (!visible) return { ok: false, code: 'downstream_unavailable', detail: 'not visible' }
    if (req.path.endsWith('/timeline')) {
      if (assistanceOnly) {
        return {
          ok: true,
          body: {
            items: [
              { eventType: 'INSTANCE_CREATED', eventSequence: 1, createdAt: new Date(T0).toISOString(), commandId: 'cmd-create-1' },
              { eventType: 'ASSISTANCE_REQUESTED', eventSequence: 2, createdAt: new Date(T0 + 100).toISOString() },
              { eventType: 'ASSISTANCE_ESCALATED_TO_HUMAN', eventSequence: 3, createdAt: new Date(T0 + 200).toISOString() },
            ],
            next_cursor: null,
          },
        }
      }
      return {
        ok: true,
        body: {
          items: [
            { eventType: 'INSTANCE_CREATED', eventSequence: 1, createdAt: new Date(T0).toISOString(), commandId: 'cmd-create-1' },
            { eventType: 'WORKFLOW_TRANSITION_COMMITTED', eventSequence: 2, createdAt: new Date(T0 + 500).toISOString(), commandId: 'cmd-trans-2' },
          ],
          next_cursor: null,
        },
      }
    }
    if (req.path.includes('/submissions')) return { ok: true, body: { items: [{ submissionId: 'sub-1' }] } }
    if (req.path.includes('/workflow-instances/')) return { ok: true, body: { visibility: 'full', detail: { workflowInstanceId: 'wf', currentStateVersion: 2, createdAt: new Date(T0).toISOString() } } }
    return { ok: false, code: 'downstream_unavailable' }
  }
}

// ── WORKFLOW_NODE_SESSION_HISTORY_V1 fixtures ────────────────────────────────

export const VISIT_ID_MG = '66666666-6666-4666-8666-666666666666'
export const MG_PRIVATE_TEXT = 'MG PRIVATE agt_a diary text — must never surface in any index'

const MG_T0 = 1759000000000

/**
 * One NodeVisit with THREE ledger generations under WF_ID (isolated root; the
 * default fixture above stays byte-identical):
 *   gen1  planned → delivery_started → run_delivered(agt_a/main, requestId +
 *         messageId + reconciliationHandle) → stale_superseded  ⇒ SETTLED,
 *         session reachable.
 *   gen2  planned → delivery_started → delivery_failed(post-invocation)
 *         ⇒ NEEDS_REVIEW, NO persisted session coordinate (receipt lost —
 *         the honest missing-session case).
 *   gen3  planned → delivery_started → run_delivered(agt_b/main, requestId
 *         only — messageId/reconciliationHandle absent) ⇒ RUNNING; agt_b has
 *         no homes subtree ⇒ journalReachable=false (bounded reachability).
 */
export function buildMultiGenerationVisitFixtureRoot() {
  const root = join(tmpdir(), `exec-history-mg-fixture-${process.pid}-${Math.random().toString(36).slice(2, 8)}`)
  const controlDir = join(root, 'control')
  const homesRoot = join(root, 'homes')
  const workflowExecutionDir = join(root, 'workflow-execution')
  mkdirSync(controlDir, { recursive: true })
  mkdirSync(workflowExecutionDir, { recursive: true })

  const attempt1 = attemptIdFor(VISIT_ID_MG, 1)
  const attempt2 = attemptIdFor(VISIT_ID_MG, 2)
  const attempt3 = attemptIdFor(VISIT_ID_MG, 3)
  const planned = (generation, attemptId, atMs) => JSON.stringify({ kind: 'attempt_planned', attemptId, nodeVisitId: VISIT_ID_MG, dispatchIntentId: INTENT_ID, workflowInstanceId: WF_ID, ownerPrincipalId: PRINCIPAL_ID, generation, atMs })
  const ledgerRows = [
    // gen1 — delivered + superseded.
    planned(1, attempt1, MG_T0 + 1000),
    JSON.stringify({ kind: 'delivery_started', nodeVisitId: VISIT_ID_MG, atMs: MG_T0 + 1010 }),
    JSON.stringify({ kind: 'run_delivered', nodeVisitId: VISIT_ID_MG, attemptId: attempt1, agentId: 'agt_a', requestId: 'req-mg-1', sessionId: 'main', messageId: 'om_mg_1', reconciliationHandle: 'te-mg-1', atMs: MG_T0 + 1100 }),
    JSON.stringify({ kind: 'stale_superseded', nodeVisitId: VISIT_ID_MG, observedWorkflowStateVersion: 1, atMs: MG_T0 + 1200 }),
    // gen2 — fenced then post-invocation delivery failure: terminal
    // NEEDS_REVIEW with no run_delivered row ever written (no session
    // coordinate exists — must be surfaced as absent, never derived).
    planned(2, attempt2, MG_T0 + 2000),
    JSON.stringify({ kind: 'delivery_started', nodeVisitId: VISIT_ID_MG, atMs: MG_T0 + 2010 }),
    JSON.stringify({ kind: 'delivery_failed', nodeVisitId: VISIT_ID_MG, attemptId: attempt2, reason: 'settle_check_unavailable:receipt-lost', atMs: MG_T0 + 2100 }),
    // gen3 — delivered to a DIFFERENT agent (pair semantics: same 'main'
    // session name, different agentId ⇒ different SessionRef), receipt
    // coordinates absent (requestId only).
    planned(3, attempt3, MG_T0 + 3000),
    JSON.stringify({ kind: 'delivery_started', nodeVisitId: VISIT_ID_MG, atMs: MG_T0 + 3010 }),
    JSON.stringify({ kind: 'run_delivered', nodeVisitId: VISIT_ID_MG, attemptId: attempt3, agentId: 'agt_b', requestId: 'req-mg-3', sessionId: 'main', atMs: MG_T0 + 3100 }),
  ]
  writeFileSync(join(workflowExecutionDir, 'attempts.jsonl'), ledgerRows.join('\n') + '\n')

  // agt_a/main journal exists (gen1's sessionRef is stat/header-reachable)
  // and carries private text that must NEVER appear in any output face.
  // agt_b deliberately has NO homes subtree.
  const projKey = '--Users-fixture--'
  mkdirSync(join(homesRoot, 'agt_a', 'sessions', projKey, 'main'), { recursive: true })
  const agtAEvents = [
    { type: 'session', version: 0, id: 'main', createdAt: MG_T0, cwd: '/tmp/mg' },
    { type: 'user/message', seq: 1, time: new Date(MG_T0 + 1).toISOString(), data: { content: MG_PRIVATE_TEXT, source: { kind: 'workflow_execution', workflowInstanceId: WF_ID, nodeVisitId: VISIT_ID_MG, attemptId: attempt1 } } },
  ]
  writeFileSync(join(homesRoot, 'agt_a', 'sessions', projKey, 'main', 'session.jsonl'), agtAEvents.map((e) => JSON.stringify(e)).join('\n') + '\n')

  return {
    root,
    paths: {
      homesRoot,
      controlDir,
      historyDir: join(root, 'scheduler', 'history'),
      jobsStore: join(root, 'scheduler', 'jobs.json'),
      workflowExecutionDir,
      evidenceLog: join(controlDir, 'runtime-evidence.jsonl'),
    },
    attemptIds: { 1: attempt1, 2: attempt2, 3: attempt3 },
  }
}

/**
 * Same-shape root for ORDER stability: two generations whose ledger atMs all
 * collide on one millisecond — merge order must still come out
 * generation-ascending (dedupeKey generation padding tiebreak).
 */
export function buildEqualTimestampsFixtureRoot() {
  const root = join(tmpdir(), `exec-history-eq-fixture-${process.pid}-${Math.random().toString(36).slice(2, 8)}`)
  const workflowExecutionDir = join(root, 'workflow-execution')
  const homesRoot = join(root, 'homes')
  const controlDir = join(root, 'control')
  mkdirSync(workflowExecutionDir, { recursive: true })
  mkdirSync(controlDir, { recursive: true })
  const visit = '77777777-7777-4777-8777-777777777777'
  const a1 = attemptIdFor(visit, 1)
  const a2 = attemptIdFor(visit, 2)
  const ledgerRows = [
    JSON.stringify({ kind: 'attempt_planned', attemptId: a1, nodeVisitId: visit, dispatchIntentId: INTENT_ID, workflowInstanceId: WF_ID, ownerPrincipalId: PRINCIPAL_ID, generation: 1, atMs: MG_T0 }),
    JSON.stringify({ kind: 'delivery_started', nodeVisitId: visit, atMs: MG_T0 }),
    JSON.stringify({ kind: 'run_delivered', nodeVisitId: visit, attemptId: a1, agentId: 'agt_x', requestId: 'req-eq-1', sessionId: 'main', atMs: MG_T0 }),
    JSON.stringify({ kind: 'attempt_planned', attemptId: a2, nodeVisitId: visit, dispatchIntentId: INTENT_ID, workflowInstanceId: WF_ID, ownerPrincipalId: PRINCIPAL_ID, generation: 2, atMs: MG_T0 }),
    JSON.stringify({ kind: 'delivery_started', nodeVisitId: visit, atMs: MG_T0 }),
  ]
  writeFileSync(join(workflowExecutionDir, 'attempts.jsonl'), ledgerRows.join('\n') + '\n')
  return {
    root,
    visit,
    attemptIds: { 1: a1, 2: a2 },
    paths: {
      homesRoot,
      controlDir,
      historyDir: join(root, 'scheduler', 'history'),
      jobsStore: join(root, 'scheduler', 'jobs.json'),
      workflowExecutionDir,
      evidenceLog: join(controlDir, 'runtime-evidence.jsonl'),
    },
  }
}
