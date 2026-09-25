import assert from 'node:assert/strict'
import { closeSync, mkdtempSync, openSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { TurnReconciliationStore } from '../../packages/agent-router/src/reconciliation-store.js'
import { projectSubject, HANDLE } from './project-subject.mjs'

test('fixed s256 projection validates durable authority and emits no private payload', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'hr-r2-projection-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, 'turn-recovery-v3.json')
  const old = new TurnReconciliationStore({ persistenceFile: file,
    runtimeEpoch: '961534a5-8c94-487d-8e55-d324a54e821a' })
  old.mintTurnExecution({ agentId: 'agt_dummy', processGeneration: 1, sessionId: 'main' })
  let handle
  for (let i = 0; i < 256; i++) {
    handle = old.mintTurnExecution({ agentId: 'agt_hr-agent', processGeneration: 1, sessionId: 'main' })
  }
  assert.equal(handle, HANDLE)
  old.markAdmitted(handle, { eventWatermarkSeq: 0, promptRequestId: 'private-prompt',
    deadlineAtWallMs: Date.now() + 1000 })
  old.markPromptWriteAttempted(handle)
  const blocked = new TurnReconciliationStore({ persistenceFile: file, runtimeEpoch: 'new-epoch' })
  assert.equal(blocked.records.get(HANDLE).failureReason, 'runtime_restart_ownership_unavailable')
  const fd = openSync(file, 'r')
  t.after(() => closeSync(fd))
  const projection = projectSubject(`/dev/fd/${fd}`)
  assert.equal(projection.reconciliationHandle, HANDLE)
  assert.match(projection.subjectPreimageSha256, /^[a-f0-9]{64}$/)
  assert.equal(JSON.stringify(projection).includes('private-prompt'), false)
  assert.throws(() => projectSubject(file), /FIXED_STORE_FD_REQUIRED/)
  writeFileSync(file, '{}\n')
  assert.throws(() => projectSubject(`/dev/fd/${fd}`))
})
