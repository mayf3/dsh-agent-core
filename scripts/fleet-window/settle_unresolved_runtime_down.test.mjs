import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { TurnReconciliationStore } from '../../packages/agent-router/src/reconciliation/store.js'
import { readDurableRecoveryStore, writeDurableRecoveryStore } from '../../packages/agent-router/src/reconciliation/durable-file.js'
import { settleRuntimeDown } from './settle_unresolved_runtime_down.mjs'
import { precheckZeroInflight } from './precheck_zero_inflight.mjs'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const isolationRoot = '/usr/local/v5-boot-isolation/settle-test'
const uid = process.getuid()
const readPs = () => `${process.pid} ${uid} node fixture-test\n`
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const readJson = file => JSON.parse(readFileSync(file, 'utf8'))
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value)}\n`, { mode: 0o600 })

function snapshot(file) {
  const bytes = readFileSync(file)
  const stat = lstatSync(file, { bigint: true })
  return { bytes: bytes.toString('utf8'), sha256: sha256(bytes),
    metadata: Object.fromEntries(['ino', 'dev', 'size', 'mtimeNs', 'ctimeNs', 'mode', 'uid', 'gid']
      .map(key => [key, String(stat[key])])) }
}

function makeFixture(runDir, name, kinds = []) {
  const directory = join(runDir, name)
  mkdirSync(directory, { mode: 0o700 })
  const store = new TurnReconciliationStore({ runtimeEpoch: `fixture-${name}` })
  const handles = {}
  for (const [index, kind] of kinds.entries()) {
    const handle = store.mintTurnExecution({ agentId: `agt_fixture_${index}`, processGeneration: index + 1,
      sessionId: `fixture-session-${index}`, callerCorrelation: {
        occurrenceId: `occ-${name}-${index}`, runId: `run-${name}-${index}`, requestId: `req-${name}-${index}` } })
    handles[kind] = handle
    if (kind !== 'reserved' && kind !== 'settled') {
      store.markOutcomeUnknown(handle, { source: 'timeout', deadlineAtWallMs: Date.now() })
    }
    if (kind === 'trusted' || kind === 'bare' || kind === 'old-epoch') {
      if (kind === 'bare') store.requireRecord(handle).terminationEvidence = 'child_real_exit'
      else store.markExitObserved(handle)
    }
    if (kind === 'blocked') store.markRecoveryBlocked(handle, ['live_generation_ownership'], 'fixture_lost')
    if (kind === 'settled' || kind === 'trusted') store.updateFinalOutput(handle, { text: 'historical partial answer' })
    if (kind === 'settled') store.settleDirect(handle, { outcome: 'completed',
      outcomeEvidence: 'exact_turn_end_success', terminationEvidence: 'child_real_exit' })
  }
  const storeFile = join(directory, 'turn-recovery-v3.json')
  const jobsStore = join(directory, 'jobs.json')
  writeDurableRecoveryStore(storeFile, store)
  writeJson(jobsStore, { version: 3, jobs: [], occurrences: [], fences: {} })
  return { directory, storeFile, jobsStore, handles }
}

function writeStageProof(fixture, { ageMs = 0, wrongEpoch = false } = {}) {
  const document = readJson(fixture.storeFile)
  const at = new Date(Date.now() - ageMs).toISOString()
  writeJson(join(fixture.directory, 'old-exit.json'), { at,
    supervisor: { rc: 113, output: 'Could not find service "ai.agent-core.runtime" in domain for system' },
    oldProcesses: [{ pid: 2147483000 }], remaining: [] })
  writeJson(join(fixture.directory, 'post-bootout-census.json'), { at, readOnly: true,
    storeHashes: [{ sha256: snapshot(fixture.storeFile).sha256 }],
    census: { epoch: wrongEpoch ? 'wrong-epoch' : document.runtimeEpoch } })
}

const settle = (fixture, options = {}) => settleRuntimeDown({ sourceRoot, storeFile: fixture.storeFile,
  stage05ReceiptDir: fixture.directory, readPs, ...options })

async function expectZeroWrite(fixture, invoke, expectedCode = 5) {
  const before = snapshot(fixture.storeFile)
  const result = await invoke()
  assert.equal(result.exitCode, expectedCode)
  assert.equal(result.report.writes, 0)
  assert.deepEqual(snapshot(fixture.storeFile), before)
  return { ...result, beforeSha256: before.sha256, afterSha256: snapshot(fixture.storeFile).sha256,
    metadataUnchanged: true }
}

test('isolated settlement and read-only zero-inflight fixtures, stop on first assertion failure', async () => {
  mkdirSync(isolationRoot, { recursive: true, mode: 0o700 })
  const runDir = mkdtempSync(join(isolationRoot, 'run-'))
  const observations = []
  console.log(`FIXTURE_RUN_DIR=${runDir}`)
  const scenario = async (name, action) => {
    try {
      const evidence = await action()
      observations.push({ scenario: name, status: 'PASS', ...evidence })
      console.log(JSON.stringify(observations.at(-1)))
    } catch (error) {
      observations.push({ scenario: name, status: 'FAIL', error: error.message })
      throw error
    }
  }
  try {
    await scenario('unknown + trusted exact termination -> terminated_without_outcome', async () => {
      const fixture = makeFixture(runDir, 'trusted', ['trusted'])
      writeStageProof(fixture)
      const before = readJson(fixture.storeFile)
      const beforeSha256 = snapshot(fixture.storeFile).sha256
      writeJson(join(fixture.directory, 'before.json'), before)
      const result = await settle(fixture)
      assert.equal(result.exitCode, 0)
      assert.equal(result.report.writes, 1)
      assert.equal(result.report.settled, 1)
      const after = readJson(fixture.storeFile)
      const row = after.records[0]
      assert.equal(row.initialOutcome, 'outcome_unknown')
      assert.equal(row.outcome, null)
      assert.equal(row.lateOutcome, 'terminated_without_outcome')
      assert.equal(row.terminationEvidence, 'child_real_exit')
      assert.deepEqual(row.finalAssistantOutputEvidence, before.records[0].finalAssistantOutputEvidence)
      assert.equal(result.report.businessOutcome, 'UNKNOWN')
      writeJson(join(fixture.directory, 'after.json'), after)
      writeStageProof(fixture)
      const repeat = await expectZeroWrite(fixture, () => settle(fixture), 0)
      return { ...result, repeat, beforeSha256, afterSha256: snapshot(fixture.storeFile).sha256 }
    })

    await scenario('non-unknown -> unchanged bytes and metadata', async () => {
      const fixture = makeFixture(runDir, 'non-unknown', ['reserved'])
      writeStageProof(fixture)
      return expectZeroWrite(fixture, () => settle(fixture))
    })

    await scenario('unknown without exact termination -> zero writes UNKNOWN', async () => {
      const fixture = makeFixture(runDir, 'no-evidence', ['unknown'])
      writeStageProof(fixture)
      const result = await expectZeroWrite(fixture, () => settle(fixture))
      assert.equal(result.report.unproven, 1)
      assert.equal(readJson(fixture.storeFile).records[0].initialOutcome, 'outcome_unknown')
      return result
    })

    await scenario('mixed store preserves untouched rows, answer digests and identity history', async () => {
      const fixture = makeFixture(runDir, 'mixed', ['trusted', 'reserved', 'unknown', 'settled'])
      writeStageProof(fixture)
      const before = readJson(fixture.storeFile)
      writeJson(join(fixture.directory, 'before.json'), before)
      const result = await settle(fixture)
      assert.equal(result.exitCode, 5)
      assert.equal(result.report.writes, 1)
      assert.equal(result.report.settled, 1)
      assert.equal(result.report.remaining, 2)
      const after = readJson(fixture.storeFile)
      assert.deepEqual(after.records.slice(1), before.records.slice(1))
      for (const key of ['runtimeEpoch', 'runtimeEpochs', 'discriminatorSeq', 'correlationIndex']) {
        assert.deepEqual(after[key], before[key])
      }
      const expectedIssuance = structuredClone(before.issuance)
      expectedIssuance[0].generations[0][1].unresolvedCount = 0
      assert.deepEqual(after.issuance, expectedIssuance)
      assert.equal(after.records[0].initialOutcome, 'outcome_unknown')
      assert.equal(after.records[0].outcome, null)
      assert.deepEqual(after.records[0].finalAssistantOutputEvidence, before.records[0].finalAssistantOutputEvidence)
      assert.equal(readDurableRecoveryStore(fixture.storeFile).records.size, 4)
      writeJson(join(fixture.directory, 'after.json'), after)
      return { ...result, untouchedRows: 3, historyAndDigestsPreserved: true }
    })

    for (const variant of ['worker-alive', 'stale-proof', 'wrong-epoch', 'bare-child-label', 'old-record-epoch']) {
      await scenario(`untrusted evidence: ${variant} -> zero writes`, async () => {
        const fixture = makeFixture(runDir, variant, [variant === 'bare-child-label' ? 'bare' : 'trusted'])
        if (variant === 'old-record-epoch') {
          const document = readJson(fixture.storeFile)
          document.runtimeEpoch = 'fixture-current-epoch'
          document.runtimeEpochs.push(document.runtimeEpoch)
          writeJson(fixture.storeFile, document)
        }
        writeStageProof(fixture, { ageMs: variant === 'stale-proof' ? 600_000 : 0,
          wrongEpoch: variant === 'wrong-epoch' })
        return expectZeroWrite(fixture, () => settle(fixture, variant === 'worker-alive'
          ? { readPs: () => `${readPs()}2147482999 ${uid} /usr/local/libexec/agent-core/harness/bin/dsh-agent\n` } : {}))
      })
    }

    await scenario('settlement CLI missing stage_05 proof -> rc5 and zero writes', async () => {
      const fixture = makeFixture(runDir, 'settle-cli-no-proof', ['trusted'])
      return expectZeroWrite(fixture, async () => {
        const child = spawnSync(process.execPath, [join(sourceRoot, 'scripts/fleet-window/settle_unresolved_runtime_down.mjs'),
          '--source-root', sourceRoot, '--store', fixture.storeFile,
          '--stage-05-receipt-dir', fixture.directory], { encoding: 'utf8', timeout: 10_000 })
        assert.equal(child.error, undefined)
        return { exitCode: child.status, report: JSON.parse(child.stdout) }
      })
    })

    for (const variant of ['empty', 'inflightTurns', 'unresolvedLostTurns', 'inflightOccurrences', 'missing', 'schema']) {
      await scenario(`read-only precheck function and CLI: ${variant}`, async () => {
        const kinds = variant === 'inflightTurns' ? ['reserved'] : variant === 'unresolvedLostTurns' ? ['blocked'] : []
        const fixture = makeFixture(runDir, `precheck-${variant}`, kinds)
        if (variant === 'inflightOccurrences') writeJson(fixture.jobsStore, { version: 3, jobs: [], fences: {},
          occurrences: [{ occurrenceId: 'occ-fixture', jobId: 'job-fixture', runId: 'run-fixture', state: 'running' }] })
        if (variant === 'schema') writeJson(fixture.jobsStore, { version: 3, jobs: [] })
        const paths = [fixture.storeFile, fixture.jobsStore]
        const before = paths.map(snapshot)
        const turnRecoveryStore = variant === 'missing' ? join(fixture.directory, 'missing.json') : fixture.storeFile
        const result = await precheckZeroInflight({ sourceRoot, turnRecoveryStore, jobsStore: fixture.jobsStore })
        const expectedCode = variant === 'empty' ? 0 : 1
        assert.equal(result.exitCode, expectedCode)
        if (variant === 'missing' || variant === 'schema') {
          assert.equal(result.report.status, 'UNKNOWN')
          for (const key of ['inflightTurns', 'unresolvedLostTurns', 'inflightOccurrences']) assert.equal(result.report[key], null)
        } else {
          for (const key of ['inflightTurns', 'unresolvedLostTurns', 'inflightOccurrences']) {
            assert.equal(result.report[key].length, key === variant ? 1 : 0)
          }
        }
        const child = spawnSync(process.execPath, [join(sourceRoot, 'scripts/fleet-window/precheck_zero_inflight.mjs'),
          '--source-root', sourceRoot, '--turn-recovery-store', turnRecoveryStore,
          '--jobs-store', fixture.jobsStore], { encoding: 'utf8', timeout: 10_000 })
        assert.equal(child.error, undefined)
        assert.equal(child.status, expectedCode)
        assert.deepEqual(JSON.parse(child.stdout), result.report)
        assert.deepEqual(paths.map(snapshot), before)
        return { ...result, cliExitCode: child.status, readOnlyBytesAndMetadata: true,
          storeSha256: before.map(row => row.sha256) }
      })
    }
  } finally {
    writeJson(join(runDir, 'actual-report.json'), { runDir, sourceRoot, observations,
      passed: observations.filter(row => row.status === 'PASS').length,
      failed: observations.filter(row => row.status === 'FAIL').length,
      productionStoreAccess: 'NONE', businessOutcome: 'UNKNOWN' })
  }
})
