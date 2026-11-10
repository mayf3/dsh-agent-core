// 结果→下一责任→原业务恢复 vertical (agent-control#1379, parent #1374).
// Harness reused from the #1382/#1383 observation-cas isolated acceptance:
// real fsynced ledger on disk, REAL cross-process restart (a fresh
// ExecutionLedger re-projecting from bytes), real engine seams. Recovery
// actions are driven by the engine's own reconcile/poll passes — never
// step-called by the test.
//
// Fault-case mapping (Owner finite directive §五):
//   case 1 (结果落盘后、下一派发前中断，重启仍继续)
//     → existing: observation-cas/planned-reconciliation.test.js B3 fault
//       injection (before_delivery/during_delivery/accepted_receipt_lost,
//       real restart, zero restart delivery) — cited, not rewritten.
//   case 2 (负责人收到消息后失败/无动作，责任不消失) → test below.
//   case 3 (修复生效后、原业务唤醒前中断，恢复且不重复效果) → test below.
//   case 4 (迟到/重复/错版本回执及目标暂停，不错误放行)
//     → existing: B3 late original receipt after terminal judgment +
//       another restart; observation-cas/stale-guards.test.js; unknown-fence-
//       no-replay; owner-assistance-resume replay refusals — cited, not
//       rewritten.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

import { wakeDomainOwnerAssistance } from '../../production-runtime/src/workflow-execution-runtime.js'
import { projectExecutionAttention } from '../src/attention.js'
import { ExecutionLedger, attemptIdFor } from '../src/ledger.js'
import { fixture, intent, identity, engine, delivered, runEnded, ownerEvidence, detail, VISIT, INSTANCE, OWNER, AGENT, T0 } from './observation-cas/fixture.js'

const CASE = '6d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77'
const POLLER = 'agt_workflow-poller'
const OWNER_AGENT = 'agt_domain-owner'

function principalAccess() {
  return { handlers: { agent_resolve_principal: { resolve: async () => ({ ok: true, result: { agentId: OWNER_AGENT } }) } } }
}

test('case 2: owner turn settled-but-failed — responsibility persists across restart, wake dedup holds, escalation records once', async () => {
  const fx = fixture()
  try {
    // ① The original run's turn ends unknown (result read back; no business outcome).
    const attempt = await delivered(fx.writer)
    const result = await fx.writer.recordReconciled({ nodeVisitId: VISIT, ...identity(attempt),
      expectedPhase: attempt.phase, verdict: 'NEEDS_REVIEW',
      judgment: 'run_outcome_unknown', reason: 'owner turn settled without resolution (injected)' })
    assert.equal(result.committed, true)
    // ② The Domain Owner wake was delivered exactly once; the owner turn then
    // settled-FAILED without resolving. The correlation is settled — the
    // transport dedup is part of the contract, never bypassed by a new key.
    const wakeDeliveries = []
    const router = {
      resolveCallerCorrelation: ({ requestId }) => wakeDeliveries.some((d) => d.requestId === requestId)
        ? { state: 'settled' } : { state: 'never_existed' },
      deliver: async (req) => { wakeDeliveries.push(req); return { sessionId: 'main' } },
    }
    const wake = { workflowInstanceId: INSTANCE, nodeVisitId: VISIT, assistanceCaseId: CASE, ownerPrincipalId: OWNER }
    const first = await wakeDomainOwnerAssistance({ router, principalAccess: principalAccess(), pollerAgentId: POLLER, ...wake })
    assert.equal(first.ok, true)
    assert.equal(wakeDeliveries.length, 1)
    // ③ REAL restart: a fresh cross-process ledger reader re-projects the SAME
    // responsibility from disk — the case cannot vanish with the process.
    fx.reader = new ExecutionLedger({ dir: fx.dir, clock: () => T0 + 500 })
    const attention = projectExecutionAttention(await fx.reader.snapshotFresh())
    assert.equal(attention.counts.OUTCOME_UNKNOWN, 1)
    const item = attention.items.find((i) => i.nodeVisitId === VISIT)
    assert.equal(item.workflowInstanceId, INSTANCE)
    assert.equal(item.agentId, AGENT)
    assert.equal(item.sessionId, 'main')
    // ④ The recurring owner wake is deduped: reused:true, zero new deliveries.
    const again = await wakeDomainOwnerAssistance({ router, principalAccess: principalAccess(), pollerAgentId: POLLER, ...wake })
    assert.equal(again.ok, true)
    assert.equal(again.reused, true)
    assert.equal(wakeDeliveries.length, 1)
    // ⑤ The legal successor after owner inaction: the ONE escalation fact is
    // durable and replay-proof, and survives another restart.
    const escalation = { nodeVisitId: VISIT, ...identity(attempt), reason: 'ATTEMPTS_EXHAUSTED', attemptCount: 3, dispatchIntentId: intent().dispatchIntentId }
    const recorded = await fx.writer.recordEscalationRequested(escalation)
    assert.equal(recorded.committed, true)
    const replayed = await fx.writer.recordEscalationRequested(escalation)
    assert.equal(replayed.committed, false)
    const afterRestart = new ExecutionLedger({ dir: fx.dir, clock: () => T0 + 600 })
    const postAttention = projectExecutionAttention(await afterRestart.snapshotFresh())
    // The escalation fact reclassifies the visit as OWNER_PENDING — the
    // attention summary that consumers (product-api /workflow-execution
    // routes → fleet dashboards → HR cycles) read after any restart.
    assert.equal(postAttention.counts.OWNER_PENDING, 1)
    const escalated = postAttention.items.find((i) => i.nodeVisitId === VISIT)
    assert.equal(escalated.executionState, 'OWNER_PENDING')
    assert.equal(escalated.escalation.reason, 'ATTEMPTS_EXHAUSTED')
    assert.equal(escalated.attemptBudgetExhausted, true)
  } finally { fx.cleanup() }
})

test('case 3: planned owner-resume survives a real cross-process restart, continues exactly once, never duplicates effects', async () => {
  const fx = fixture()
  try {
    // ① The owner legally resolved the assistance case (evidence carries the
    // exact resolution events and the new baseline version 12).
    const predecessor = await delivered(fx.writer)
    await runEnded(fx.writer, predecessor)
    // ② 修复生效后、原业务唤醒前中断：the planned gen-2 owner-resume attempt is
    // durably persisted; delivery has NOT started.
    const planned = await fx.writer.beginAttemptIfAbsent(intent(), undefined, undefined,
      async () => ({ preDeliveryWorkflowStateVersion: 12, assistanceResume: ownerEvidence() }),
      async () => true)
    assert.equal(planned.created, true)
    assert.equal(planned.attempt.attemptId, attemptIdFor(VISIT, 2))
    const walAtInterrupt = readFileSync(fx.writer.eventsFile, 'utf8')
    const walLines = walAtInterrupt.trim().split('\n').map((line) => JSON.parse(line))
    const lastPlannedIdx = walLines.map((l) => l.kind).lastIndexOf('attempt_planned')
    assert.equal(walLines[lastPlannedIdx].generation, 2)
    assert.equal(walLines[lastPlannedIdx].retryReason, 'owner_assistance_resolved')
    assert.equal(walLines.slice(lastPlannedIdx + 1).some((l) => l.kind === 'delivery_started'), false)
    // ③ REAL restart: fresh ledger + fresh engine, nothing cached. The due
    // feed still reports the visit READY (svc truth), so the engine's own
    // reconcile pass — not the test — drives the continuation.
    fx.reader = new ExecutionLedger({ dir: fx.dir, clock: () => T0 + 500 })
    const restarted = engine(fx, {
      fetchDuePage: async () => ({ ok: true, items: [intent()] }),
      readInstanceDetail: async () => detail(12),
    })
    await restarted.engine.reconcileOnce()
    assert.equal(restarted.calls.delivers.length, 1)
    assert.equal(restarted.calls.delivers[0].requestId, planned.attempt.attemptId)
    const resumed = fx.reader.get(VISIT)
    assert.equal(resumed.retryReason, 'owner_assistance_resolved')
    assert.equal(resumed.workflowStateVersionAtDispatch, 12)
    // ④ 不重复效果：further reconcile passes never re-deliver the same visit.
    await restarted.engine.reconcileOnce()
    await restarted.engine.reconcileOnce()
    assert.equal(restarted.calls.delivers.length, 1)
    // ⑤ The consumed case cannot mint another resume generation: the same
    // (nodeVisit, case) admission is idempotent — created:false, no new attempt.
    const replay = await fx.reader.beginAttemptIfAbsent(intent(), undefined, undefined,
      async () => ({ preDeliveryWorkflowStateVersion: 12, assistanceResume: ownerEvidence() }),
      async () => true)
    assert.equal(replay.created, false)
    assert.equal(fx.reader.get(VISIT).attemptId, planned.attempt.attemptId)
  } finally { fx.cleanup() }
})
