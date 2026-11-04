import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AdmissionPauseControl, ExecutionLedger, createWorkflowExecutionEngine } from '../src/index.js'

const intent = n => ({
  dispatchIntentId: `11111111-1111-4111-8111-11111111111${n}`,
  nodeVisitId: `22222222-2222-4222-8222-22222222222${n}`,
  workflowInstanceId: '33333333-3333-4333-8333-333333333333',
  ownerPrincipalId: '44444444-4444-4444-8444-444444444444',
  nextEligibleAt: '2026-11-04T00:00:00Z', createdAt: '2026-11-04T00:00:00Z', updatedAt: '2026-11-04T00:00:00Z',
})

test('supported admission pause persists, drains in-flight delivery, and resumes admission', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'admission-pause-')); t.after(() => rmSync(dir, { recursive: true }))
  const controlFile = join(dir, 'admission-control.json')
  const control = new AdmissionPauseControl({ file: controlFile, now: () => 10 })
  const ledger = new ExecutionLedger({ dir })
  let due = [intent(1)]; let releaseDelivery
  let delivered = 0
  const engine = createWorkflowExecutionEngine({
    ledger, admissionControl: control,
    fetchDuePage: async () => ({ ok: true, items: due }),
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: 'agt_target' }),
    deliverRun: async request => { delivered += 1; if (delivered === 1) await new Promise(resolve => { releaseDelivery = resolve }); return { ok: true, sessionId: 'main', reconciliationHandle: `turn:${delivered}` } },
    getTurnReconciliation: () => ({ state: 'pending' }), resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    readInstanceDetail: async () => ({ ok: true, body: { visibility: 'full', detail: { instance: { workflow_state_version: 1 }, current_node_visit_id: intent(1).nodeVisitId } } }),
  })
  const inFlight = engine.pollOnce()
  while (typeof releaseDelivery !== 'function') await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(engine.pauseAdmission('itops-window'), { paused: true, reason: 'itops-window', updatedAtMs: 10 })
  assert.equal(new AdmissionPauseControl({ file: controlFile }).isPaused(), true)
  releaseDelivery()
  await inFlight
  due = [intent(2)]
  const pausedPass = await engine.pollOnce()
  assert.equal(pausedPass.paused, true); assert.equal(delivered, 1)
  // The in-flight poll has completed (bounded drain point); pause itself never stops the engine.
  assert.deepEqual(engine.resumeAdmission(), { paused: false, reason: null, updatedAtMs: 10 })
  const resumed = await engine.pollOnce()
  assert.equal(resumed.ok, true); assert.equal(delivered, 2)
})
