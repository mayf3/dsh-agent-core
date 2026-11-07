// Isolated child for B2 process/HTTP fault injection; never production I/O.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ExecutionLedger } from '../../src/ledger.js'
import { createWorkflowExecutionEngine } from '../../src/engine.js'
import { TurnReconciliationStore } from '../../../agent-router/src/reconciliation/store.js'
import { intent, VISIT } from './fixture.js'

if (process.env.EKR_BLOCKED_RECOVERY_CHILD === '1') {
  const [dir, endpoint, mode] = process.argv.slice(2)
  const errors = []
  const ledger = new ExecutionLedger({ dir })
  const routerFile = join(dir, 'router-reconciliation.json')
  const router = new TurnReconciliationStore({ runtimeEpoch: `b2-child-${process.pid}`, persistenceFile: routerFile })
  const correlations = []
  let polls = 0, watcher, finishing = false
  const send = (stage, fields = {}) => new Promise((resolve, reject) => {
    process.send({ stage, ...fields }, error => error ? reject(error) : resolve())
  })

  // The real record method has returned only after append + fsync. Hold the
  // SAME OwnerLock at the exact boundary until the parent actually SIGKILLs
  // this process; throwing an exception would not model process failure.
  const faultRecord = mode === 'crash-before-wal' ? 'recoveryAuthorized'
    : mode === 'crash-after-wal' ? 'deliveryStarted' : undefined
  if (faultRecord) {
    const mutateWithRecord = ledger.mutateWithRecord.bind(ledger)
    ledger.mutateWithRecord = (nodeVisitId, callback) => mutateWithRecord(nodeVisitId, (record, getAttempt) => {
      const wrapped = { ...record, [faultRecord]: async (...args) => {
        const result = await record[faultRecord](...args)
        await send('crash-ready', { point: faultRecord, attempt: getAttempt() })
        await new Promise(() => {})
        return result
      } }
      return callback(wrapped, getAttempt)
    })
  }

  const engine = createWorkflowExecutionEngine({
    ledger,
    config: { automaticRecoveryEnabled: true, recoveryRetryDelayMs: 80,
      recoveryMaxDelayMs: 160, maxRecoveryChecksPerPoll: 25 },
    fetchDuePage: async () => { polls += 1; return { ok: true, items: [] } },
    resolvePrincipalToAgent: async principalId => {
      const response = await fetch(`${endpoint}/resolve`, { headers: { 'x-principal-id': principalId } })
      return response.ok ? response.json() : { ok: false, code: `http_${response.status}` }
    },
    readInstanceDetail: async ({ agentId, workflowInstanceId }) => {
      const response = await fetch(`${endpoint}/detail`, {
        headers: { 'x-agent-id': agentId, 'x-workflow-id': workflowInstanceId },
      })
      return response.ok ? { ok: true, body: await response.json() } : { ok: false, code: `http_${response.status}` }
    },
    deliverRun: async request => {
      const response = await fetch(`${endpoint}/deliver`, { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) })
      return response.json()
    },
    // The loopback Router persists a real receipt. This process reloads it
    // on startup; the fresh query is synchronous and non-consuming.
    resolveCallerCorrelation: query => {
      const receipt = router.resolveCallerCorrelation(query)
      correlations.push({ query, receipt })
      return receipt
    },
    getTurnReconciliation: () => ({ state: 'pending' }),
    log: { error: message => errors.push(message) },
  })

  async function finish(stage, fields = {}) {
    if (finishing) return
    finishing = true
    clearInterval(watcher)
    await engine.stop()
    const attempt = ledger.get(VISIT)
    const correlation = attempt ? router.resolveCallerCorrelation({ requestId: attempt.attemptId }) : undefined
    await send(stage, { ...fields, attempt, errors, polls, correlations, correlation,
      routerBytes: readFileSync(routerFile, 'utf8') })
    process.disconnect()
  }

  try {
    if (mode === 'seed') {
      const seeded = await ledger.beginAttemptIfAbsent(intent(), async () => ({ kind: 'resolution_blocked', code: 'http_503' }))
      if (!seeded.created) throw new Error(`seed refused: ${seeded.cause}`)
      const summary = await engine.reconcileOnce()
      await finish('seeded', { summary })
    } else {
      await ledger.snapshotFresh()
      const initial = ledger.get(VISIT)
      const go = mode === 'race-auto' || mode === 'race-manual'
        ? new Promise(resolve => process.once('message', resolve)) : undefined
      await send('ready', { attempt: initial, routerBytes: readFileSync(routerFile, 'utf8'),
        correlation: initial ? router.resolveCallerCorrelation({ requestId: initial.attemptId }) : undefined })
      if (go) await go
      if (mode === 'race-manual') {
        const result = await engine.recoverAttempt({ nodeVisitId: VISIT, authorityRef: 'B2_PROCESS_TEST_OWNER' })
        await finish('manual-complete', { result })
      } else {
        engine.start({ intervalMs: 20 })
        watcher = setInterval(() => {
          const attempt = ledger.get(VISIT)
          if (mode === 'observe') {
            if (polls >= 4) void finish('observed')
          } else if (attempt?.phase === 'run_delivered') {
            void finish('admitted')
          }
        }, 10)
      }
    }
  } catch (error) {
    clearInterval(watcher)
    await engine.stop()
    process.exitCode = 1
    await send('error', { error: String(error.stack ?? error), errors })
    process.disconnect()
  }
}
