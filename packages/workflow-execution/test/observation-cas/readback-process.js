// Isolated service process used by readback-restart.test.js. No production I/O.
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { ExecutionLedger } from '../../src/ledger.js'
import { createWorkflowExecutionEngine } from '../../src/engine.js'
import { intent, VISIT, AGENT } from './fixture.js'

if (process.env.EKR_READBACK_CHILD === '1') {
  const [dir, endpoint, mode] = process.argv.slice(2)
  const ledger = new ExecutionLedger({ dir })
  const errors = []
  const engine = createWorkflowExecutionEngine({
    ledger, config: { readbackRetryDelayMs: 120, readbackMaxDelayMs: 480 },
    fetchDuePage: async () => ({ ok: true, items: [intent()] }),
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: AGENT }),
    deliverRun: async request => {
      appendFileSync(join(dir, 'deliveries.jsonl'), `${JSON.stringify(request)}\n`)
      return { ok: true, sessionId: 'main', reconciliationHandle: 'turn:isolated' }
    },
    // Deterministic Router seam, deliberately independent of Workflow facts.
    getTurnReconciliation: () => ({ state: 'settled' }),
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    readInstanceDetail: async ({ agentId, workflowInstanceId }) => {
      const response = await fetch(endpoint, { headers: { 'x-agent-id': agentId, 'x-workflow-id': workflowInstanceId } })
      return response.ok ? { ok: true, body: await response.json() } : { ok: false, code: `http_${response.status}` }
    },
    log: { error: message => errors.push(message) },
  })
  try {
    if (mode === 'seed') {
      const admission = await engine.admitDueIntent(intent())
      await engine.reconcileOnce()
      await engine.stop()
      process.send({ stage: 'seeded', admission, attempt: ledger.get(VISIT), errors }, () => process.disconnect())
    } else {
      engine.start({ intervalMs: 20 })
      let observed = false
      const watcher = setInterval(async () => {
        const attempt = ledger.get(VISIT)
        if (!observed && attempt?.readback?.observationBaseline) {
          observed = true
          process.send({ stage: 'observed', attempt })
        }
        if (attempt?.readback?.status === 'closed') {
          clearInterval(watcher)
          await engine.stop()
          process.send({ stage: 'closed', attempt, errors }, () => process.disconnect())
        }
      }, 10)
    }
  } catch (error) {
    await engine.stop()
    process.exitCode = 1
    process.send({ stage: 'error', error: String(error.stack) }, () => process.disconnect())
  }
}
