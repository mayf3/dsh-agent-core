import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { TurnReconciliationStore } from '../../../packages/agent-router/src/reconciliation/store.js'
import { writeDurableRecoveryStore } from '../../../packages/agent-router/src/reconciliation/durable-file.js'
import { verifyCandidateState, verifyRollbackCompatibility } from './candidate-state.mjs'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const oldScheduler = 'a39c7cc18e1487b0e0d358db4ddc1f1acbb1f294'
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value)}\n`, { mode: 0o600 })

function fixture(name) {
  const directory = mkdtempSync(`/usr/local/v5-boot-isolation/anarrowed-${name}-`)
  const turnRecoveryStore = join(directory, 'turn-recovery-v3.json')
  const jobsStore = join(directory, 'jobs.json')
  const store = new TurnReconciliationStore({ runtimeEpoch: 'old-fixture-epoch' })
  const handle = store.mintTurnExecution({ agentId: 'agt_fixture_fenced', processGeneration: 1,
    sessionId: 'fixture-session', callerCorrelation: {
      occurrenceId: 'occ-fixture', runId: 'run-fixture', requestId: 'request-fixture' } })
  store.markOutcomeUnknown(handle, { source: 'timeout', deadlineAtWallMs: Date.now() })
  store.markRecoveryBlocked(handle, ['live_generation_ownership'], 'fixture_old_epoch')
  writeDurableRecoveryStore(turnRecoveryStore, store)
  writeJson(jobsStore, { version: 3, jobs: [], occurrences: [], fences: {} })
  return { directory, turnRecoveryStore, jobsStore, handle,
    before: [hash(turnRecoveryStore), hash(jobsStore)] }
}

function assertPreserved(subject) {
  assert.deepEqual([hash(subject.turnRecoveryStore), hash(subject.jobsStore)], subject.before)
}

test('candidate loading, startup failure and real Scheduler v2 rollback schema boundary', async () => {
  const positive = fixture('candidate-load')
  const loaded = await verifyCandidateState({ candidateRoot: '/private/tmp/fleet-v5-prep/scratch',
    turnRecoveryStore: positive.turnRecoveryStore, jobsStore: positive.jobsStore,
    receiptDir: join(positive.directory, 'candidate-receipts') })
  assert.equal(loaded.exitCode, 0, JSON.stringify(loaded.report))
  for (const check of ['sourceUnchanged', 'candidateUnchanged', 'originalUnknownPreserved',
    'affectedBlocked', 'unrelatedAllowed', 'globalStoreReady', 'noReplay', 'noOverwrite',
    'fullRuntimeReady', 'cleanShutdown']) assert.equal(loaded.report.checks[check], true, check)
  assertPreserved(positive)

  const broken = fixture('startup-failure')
  const failed = await verifyCandidateState({ candidateRoot: join(broken.directory, 'missing-candidate'),
    turnRecoveryStore: broken.turnRecoveryStore, jobsStore: broken.jobsStore,
    receiptDir: join(broken.directory, 'failed-receipts') })
  assert.equal(failed.exitCode, 5)
  assertPreserved(broken)

  const rollback = fixture('v2-rollback')
  const oldRoot = join(rollback.directory, 'old-candidate')
  mkdirSync(join(oldRoot, 'node-runtime/bin'), { recursive: true, mode: 0o700 })
  symlinkSync('/private/tmp/fleet-v5-prep/scratch/node-runtime/bin/node', join(oldRoot, 'node-runtime/bin/node'))
  mkdirSync(join(oldRoot, 'packages/agent-router'), { recursive: true, mode: 0o700 })
  cpSync(join(sourceRoot, 'packages/agent-router/src'), join(oldRoot, 'packages/agent-router/src'), { recursive: true })
  const scheduler = join(oldRoot, 'packages/scheduler/src')
  mkdirSync(scheduler, { recursive: true, mode: 0o700 })
  writeJson(join(oldRoot, 'package.json'), { type: 'module' })
  const oldModuleHashes = {}
  for (const name of ['store.js', 'occurrence-model.js', 'store-migration.js']) {
    const relative = `packages/scheduler/src/${name}`
    const bytes = execFileSync('/usr/bin/git', ['-C', sourceRoot, 'show', `${oldScheduler}:${relative}`])
    writeFileSync(join(scheduler, name), bytes, { mode: 0o600 })
    oldModuleHashes[relative] = hash(join(scheduler, name))
  }
  writeJson(join(rollback.directory, 'stale-business-snapshot.json'), { version: 2, jobs: [], occurrences: [], fences: {} })
  const incompatible = await verifyRollbackCompatibility({ candidateRoot: oldRoot,
    turnRecoveryStore: rollback.turnRecoveryStore, jobsStore: rollback.jobsStore,
    receiptDir: join(rollback.directory, 'rollback-receipts') })
  assert.equal(incompatible.exitCode, 5)
  assert.match(readFileSync(join(rollback.directory, 'rollback-receipts/child.stderr.private.log'), 'utf8'),
    /unsupported store version 3/)
  assertPreserved(rollback)
  console.log(JSON.stringify({ scenario: 'candidate-and-rollback-boundaries', status: 'PASS',
    positive: loaded.report, startupFailure: failed.report, incompatible: incompatible.report,
    oldScheduler, oldModuleHashes, currentBusinessPreserved: true, productionExecution: 'NONE' }))
})
