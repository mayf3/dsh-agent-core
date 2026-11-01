import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createTerminalAttemptOperations } from '../src/terminal-attempt-operations.js'

const NODE_VISIT = 'visit-1'

test('terminal attempt at cap escalates once and remains NEEDS_REVIEW for Owner resume', async () => {
  const staleWrites = []
  const escalations = []
  const operations = createTerminalAttemptOperations({
    ledger: {
      maxAttemptsPerVisit: 1,
      recordStaleSuperseded: async (input) => {
        staleWrites.push(input)
        return { committed: true }
      },
    },
    escalateAttemptLimit: async (input) => escalations.push(input),
  })
  const attempt = { nodeVisitId: NODE_VISIT, generation: 1, state: 'NEEDS_REVIEW', phase: 'reconciled', delivered: { atMs: 10 } }
  const staleReentry = []

  await operations.reconcileTerminalCandidate(attempt, { kind: 'stale_confirmed' }, staleReentry)

  assert.deepEqual(staleWrites, [])
  assert.deepEqual(staleReentry, [])
  assert.deepEqual(escalations, [{ attempt, reason: 'ATTEMPTS_EXHAUSTED' }])
})

test('under-cap stale terminal candidate settles; non-confirmed candidates do not mutate', async () => {
  const staleWrites = []
  const escalations = []
  const operations = createTerminalAttemptOperations({
    ledger: {
      maxAttemptsPerVisit: 3,
      recordStaleSuperseded: async (input) => {
        staleWrites.push(input)
        return { committed: true }
      },
    },
    escalateAttemptLimit: async (input) => escalations.push(input),
  })
  const attempt = {
    nodeVisitId: NODE_VISIT, generation: 2, state: 'NEEDS_REVIEW', phase: 'reconciled',
    delivered: { atMs: 10 }, workflowStateVersionAtDispatch: 7,
  }
  const staleReentry = []

  await operations.reconcileTerminalCandidate(attempt, { kind: 'unavailable' }, staleReentry)
  assert.deepEqual(staleWrites, [])
  assert.deepEqual(staleReentry, [])

  await operations.reconcileTerminalCandidate(attempt, { kind: 'stale_confirmed' }, staleReentry)
  assert.deepEqual(staleWrites, [{
    nodeVisitId: NODE_VISIT,
    expected: { state: 'NEEDS_REVIEW', phase: 'reconciled', deliveredAtMs: 10 },
    observedWorkflowStateVersion: 7,
  }])
  assert.deepEqual(staleReentry, [NODE_VISIT])
  assert.deepEqual(escalations, [])
})

test('existing escalation fact prevents another attempt-cap request', async () => {
  const escalations = []
  const operations = createTerminalAttemptOperations({
    ledger: { maxAttemptsPerVisit: 1 },
    escalateAttemptLimit: async (input) => escalations.push(input),
  })
  const attempt = { nodeVisitId: NODE_VISIT, generation: 1, escalation: { reason: 'ATTEMPTS_EXHAUSTED' } }

  await operations.reconcileTerminalCandidate(attempt, { kind: 'stale_confirmed' }, [])

  assert.deepEqual(escalations, [])
})
