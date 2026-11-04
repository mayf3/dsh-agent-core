import { TurnReconciliationStore } from '../src/reconciliation/store.js'

const [mode, file] = process.argv.slice(2)
const store = new TurnReconciliationStore({ persistenceFile: file })
if (mode === 'inject') {
  store.upsertRecoveryFault('agt_fixture:23', {
    agentId: 'agt_fixture', generation: 23, firstSeenAt: '2026-11-04T00:00:00.000Z',
    attempts: 2, nextActionAt: '2026-11-04T00:05:00.000Z', status: 'OPEN',
  })
  process.stdout.write('READY\n')
  setInterval(() => {}, 1000)
} else if (mode === 'read') {
  process.stdout.write(`${JSON.stringify(store.recoveryFaultSnapshot())}\n`)
  process.exit(0)
} else {
  process.exit(2)
}
