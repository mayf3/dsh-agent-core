// Child-process seam for process-race.test.js. It loads the real on-disk ledger,
// reads an attempt, waits for the parent to advance it, then submits that read.
import { ExecutionLedger } from '../../src/ledger.js'
import { identity, VISIT, T0 } from './fixture.js'

if (process.env.EKR_P0A_OBSERVER_CHILD === '1') {
 const ledger = new ExecutionLedger({ dir: process.argv[2], clock: () => T0 + 100 })
 try {
  const [attempt] = await ledger.listActiveFresh()
  process.send({ stage: 'observed', attempt })
  await new Promise((resolve) => process.once('message', resolve))
  const result = await ledger.recordReconciled({ nodeVisitId: VISIT, ...identity(attempt),
    expectedPhase: attempt.phase, verdict: 'SETTLED', judgment: 'business_commitment_observed',
    reason: 'old child-process probe returned after new generation' })
  process.send({ stage: 'submitted', result }, () => process.disconnect())
 } catch (error) {
  process.send({ stage: 'error', error: String(error?.stack ?? error) }, () => {
    process.exitCode = 1
    process.disconnect()
  })
 }
}
