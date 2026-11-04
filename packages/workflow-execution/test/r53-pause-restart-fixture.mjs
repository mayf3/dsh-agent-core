import { AdmissionPauseControl, ExecutionLedger, createWorkflowExecutionEngine } from '../src/index.js'

const [mode, dir] = process.argv.slice(2)
const INSTANCE = '33333333-3333-4333-8333-333333333333'
const VISIT = '22222222-2222-4222-8222-222222222221'
const INTENT = '11111111-1111-4111-8111-111111111111'
const OWNER = '44444444-4444-4444-8444-444444444444'
const due = [{ dispatchIntentId: INTENT, nodeVisitId: VISIT, workflowInstanceId: INSTANCE, ownerPrincipalId: OWNER, nextEligibleAt: '2026-11-04T00:00:00Z', createdAt: '2026-11-04T00:00:00Z', updatedAt: '2026-11-04T00:00:00Z' }]
const control = new AdmissionPauseControl({ file: `${dir}/admission-control.json` })
const ledger = new ExecutionLedger({ dir })
let delivered = 0
const engine = createWorkflowExecutionEngine({
  ledger, admissionControl: control,
  fetchDuePage: async () => ({ ok: true, items: due }),
  resolvePrincipalToAgent: async () => ({ ok: true, agentId: 'agt_target' }),
  deliverRun: async () => { delivered += 1; return { ok: true, sessionId: 'main', reconciliationHandle: 'turn:inflight' } },
  getTurnReconciliation: () => ({ state: mode === 'resume' ? 'settled' : 'pending' }),
  resolveCallerCorrelation: () => ({ state: 'never_existed' }),
  readInstanceDetail: async () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 2 }, current_node_visit_id: mode === 'resume' ? '22222222-2222-4222-8222-222222222222' : VISIT } } }),
})
if (mode === 'start') {
  await engine.pollOnce()
  engine.pauseAdmission('restart-test')
  process.stdout.write('READY\n')
  setInterval(() => {}, 1000)
} else if (mode === 'resume') {
  const result = await engine.pollOnce()
  process.stdout.write(`${JSON.stringify({ delivered, paused: result.paused ?? false, state: ledger.get(VISIT)?.state })}\n`)
  process.exit(0)
} else process.exit(2)
