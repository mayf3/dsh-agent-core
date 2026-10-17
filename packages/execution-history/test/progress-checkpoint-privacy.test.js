import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadAttemptsLedger } from '../src/loaders/attempts-ledger.js'

const INSTANCE = '11111111-1111-4111-8111-111111111111'
const VISIT = '22222222-2222-4222-8222-222222222222'
const ATTEMPT = 'wfeat-aaaaaaaaaaaaaaaaaaaaaaaa'
const MARKER = 'PRIVATE_PROGRESS_TEXT_MUST_NOT_LEAK'

test('execution-history redacts progress checkpoint body but keeps trusted coordinates', () => {
  const root = mkdtempSync(join(tmpdir(), 'progress-history-redaction-'))
  try {
    mkdirSync(root, { recursive: true })
    const rows = [
      {
        kind: 'attempt_planned',
        attemptId: ATTEMPT,
        nodeVisitId: VISIT,
        dispatchIntentId: '33333333-3333-4333-8333-333333333333',
        workflowInstanceId: INSTANCE,
        ownerPrincipalId: '44444444-4444-4444-8444-444444444444',
        atMs: 1,
      },
      {
        kind: 'run_delivered',
        attemptId: ATTEMPT,
        nodeVisitId: VISIT,
        workflowInstanceId: INSTANCE,
        agentId: 'agt_progress',
        requestId: 'req-1',
        sessionId: 'main',
        atMs: 2,
      },
      {
        kind: 'progress_checkpoint',
        attemptId: ATTEMPT,
        nodeVisitId: VISIT,
        workflowInstanceId: INSTANCE,
        reporterAgentId: 'agt_progress',
        sessionId: 'main',
        turnExecutionId: 'turn-1',
        checkpoint: {
          accomplished: [MARKER],
          current: ['secret current text'],
          next: ['secret next text'],
          blocker: 'secret blocker text',
          artifacts: ['private:artifact'],
        },
        atMs: 3,
      },
    ]
    writeFileSync(join(root, 'attempts.jsonl'), rows.map((row) => JSON.stringify(row)).join('\n') + '\n')

    const loaded = loadAttemptsLedger({ workflowExecutionDir: root })
    assert.equal(loaded.status.status, 'OK')
    const progress = loaded.records.find((record) => record.kind === 'attempt_progress_checkpoint')
    assert.ok(progress)
    assert.equal(progress.data.checkpoint, undefined)
    assert.equal(progress.data.checkpointPresent, true)
    assert.equal(progress.nativeRefs.reporterAgentId, 'agt_progress')
    assert.equal(progress.nativeRefs.sessionId, 'main')
    assert.equal(progress.nativeRefs.turnExecutionId, 'turn-1')

    const serialized = JSON.stringify(loaded)
    assert.equal(serialized.includes(MARKER), false)
    assert.equal(serialized.includes('secret blocker text'), false)
    assert.equal(serialized.includes('private:artifact'), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
