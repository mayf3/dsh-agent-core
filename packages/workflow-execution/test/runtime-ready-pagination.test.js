import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { mountWorkflowExecutionRuntime } from '../../production-runtime/src/workflow-execution-runtime.js'

const id = n => `11111111-2222-4333-8444-${String(n).padStart(12, '0')}`
const row = n => ({
  dispatchIntentId: id(n), nodeVisitId: id(n + 1000), workflowInstanceId: id(9999), ownerPrincipalId: id(8888),
  nextEligibleAt: '2026-10-29T00:00:00.123456Z', createdAt: '2026-10-29T00:00:00Z',
  updatedAt: '2026-10-29T00:00:00Z', readinessStatus: 'READY',
})
const pageA = Array.from({ length: 100 }, (_, i) => row(i + 1))
const pageB = Array.from({ length: 100 }, (_, i) => row(i + 101))

for (const tail of [pageA, [row(1)]]) {
  test(`mounted READY sweep rejects non-adjacent repeated ${tail.length}-row page before WEC, then starts fresh`, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'core-ready-cursor-'))
    const requests = []; let detailReads = 0; let deliveries = 0; let pageIndex = 0
    const gateway = { execute: async request => {
      if (request.capabilityId === 'workflow_dispatch_intents') {
        assert.equal(request.operation, 'list_ready', 'no raw fallback')
        requests.push(request.args)
        if (request.args.afterDispatchIntentId === undefined) pageIndex = 0
        // Bound the negative test on broken source; production has no page cap.
        if (pageIndex === 3) return { ok: false, error: { code: 'bounded_probe_stop' } }
        return { ok: true, result: { items: [pageA, pageB, tail][pageIndex++] } }
      }
      detailReads++
      return { ok: false, error: { code: 'current_visit_changed' } }
    } }
    const runtime = mountWorkflowExecutionRuntime({
      ctx: { get: name => ({ brokerGateway: gateway, agentPrincipalResolutionAccess: { handlers: {
        agent_resolve_principal: { resolve: async () => ({ ok: true, result: { agentId: 'agt_cursor' } }) },
      } } })[name] },
      layout: { workflowExecutionDir: dir }, log: { log() {}, warn() {}, error() {} },
      router: { deliver: async () => { deliveries++; return { sessionId: 'main' } }, getTurnReconciliation: () => ({ state: 'never_existed' }) },
      config: { pollerAgentId: 'agt_poller', maxAdmissionsPerPoll: 1000 },
    })
    try {
      for (let sweep = 0; sweep < 2; sweep++) {
        const result = await runtime.engine.pollOnce()
        assert.equal(result.ok, false)
        assert.equal(result.phase, 'due_feed_cursor')
        assert.equal(result.code, 'cursor_not_advancing')
        assert.equal(result.admissions.length, 200, 'offending page enters no WEC pre-plan')
        assert.equal(requests.length, (sweep + 1) * 3, 'no fourth request or arbitrary page cap')
        assert.equal(detailReads, (sweep + 1) * 200)
        assert.deepEqual(requests[sweep * 3], { limit: 100 }, 'each normal poll starts at page one')
        assert.deepEqual(requests[sweep * 3 + 1], { limit: 100,
          afterNextEligibleAt: pageA.at(-1).nextEligibleAt, afterDispatchIntentId: pageA.at(-1).dispatchIntentId })
        assert.deepEqual(requests[sweep * 3 + 2], { limit: 100,
          afterNextEligibleAt: pageB.at(-1).nextEligibleAt, afterDispatchIntentId: pageB.at(-1).dispatchIntentId })
        assert.equal(deliveries, 0)
        assert.equal(runtime.ledger.get(row(1).nodeVisitId), undefined)
      }
    } finally { await runtime.stop(); rmSync(dir, { recursive: true, force: true }) }
  })
}
