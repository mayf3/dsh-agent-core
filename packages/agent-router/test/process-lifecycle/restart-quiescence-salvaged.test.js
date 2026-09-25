/** Optional, review-bound SUT adapter for the independently salvaged r4 corpus.
 * Set HR_R4_SALVAGE_ROOT to its frozen snapshot directory. The corpus is input
 * only: its pre-implementation receipt/store spellings are mapped onto the
 * real proofFixture without changing the production verifier or source bytes.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation-store.js'
import { json, proofFixture } from '../helpers/restart-quiescence-fixture.js'

const root = process.env.HR_R4_SALVAGE_ROOT
const SNAPSHOT_SHA = '46e1dc7a6c984219a4c072a839dbace7f36238da8a6b69a1ae93de8809ab42e7'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const read = path => JSON.parse(readFileSync(path, 'utf8'))

if (!root) {
  test('r4 salvaged corpus adapter requires HR_R4_SALVAGE_ROOT', { skip: 'external immutable input not supplied' }, () => {})
} else {
  const corpus = join(root, 'corpus')
  const manifest = read(join(corpus, 'MANIFEST.json'))
  const base = read(join(corpus, manifest.baseFixtures.bundles[0]))
  const load = name => {
    const file = manifest.bundleAttacks[name].file
    const bytes = readFileSync(join(corpus, file))
    assert.equal(sha(bytes), manifest.fileSha256[file], `${name} source bytes`)
    return JSON.parse(bytes.toString('utf8'))
  }
  const seal = (fx, dir, name, section, field, mutate) => {
    const path = join(dir, name)
    const receipt = read(path)
    mutate(receipt)
    const bytes = json(receipt)
    writeFileSync(path, bytes)
    fx.bundle[section][field] = sha(bytes)
  }
  const stop = (fx, atWallMs) => {
    const method = base.controlledStop.method
    const receipt = json({ operationId: fx.bundle.recoveryCutover.operationId,
      hostId: fx.bundle.recoveryCutover.hostId, method, atWallMs })
    writeFileSync(join(fx.evidenceDir, 'controlled-stop.json'), receipt)
    fx.bundle.controlledStop = { method, receiptSha256: sha(receipt), atWallMs }
    fx.startup.recoveryPlanStopsRuntime = true
  }
  const adapt = (name, attack, fx) => {
    const b = fx.bundle
    const cut = b.recoveryCutover
    switch (name) {
      case 'subject-handle-wrong': b.subject.reconciliationHandle = attack.subject.reconciliationHandle; b.subject.turnExecutionId = attack.subject.turnExecutionId; break
      case 'subject-epoch-wrong': b.subject.runtimeEpoch = 'intermediate-epoch'; b.epochRetirement.retiredEpoch = 'intermediate-epoch'; break
      case 'subject-agent-wrong': b.subject.agentId = attack.subject.agentId; break
      case 'subject-generation-wrong': b.subject.processGeneration += attack.subject.processGeneration - base.subject.processGeneration; break
      case 'turnid-handle-mismatch': b.subject.turnExecutionId = attack.subject.turnExecutionId; break
      case 'host-mismatch': cut.hostId = attack.recoveryCutover.hostId; b.hostCensus.hostId = attack.hostCensus.hostId; break
      case 'live-epoch': b.epochRetirement.retiredEpoch = 'fresh-epoch'; break
      case 'census-nonzero': b.hostCensus.runtimeTreeProcessCount = attack.hostCensus.runtimeTreeProcessCount; break
      case 'holder-live': b.holderCheck.openHolderCount = attack.holderCheck.openHolderCount; break
      case 'census-ordering-inverted': b.hostCensus.executedAtWallMs = cut.authorizedStartupAtWallMs + 1; break
      case 'census-earlier-than-subject': cut.windowOpenedAtWallMs = 1; break
      case 'window-continuity-lost': fx.io.challengeWindow = (_fd, challenge) => ({ ...challenge, exclusiveWindowHeld: false, launchSourcesStillInhibited: true, windowClosed: false }); break
      case 'nonce-reused': cut.startupNonce = attack.recoveryCutover.startupNonce; break
      case 'launchauth-missing': cut.launchAuthorizationReceiptSha256 = attack.recoveryCutover.launchAuthorizationReceiptSha256; break
      case 'launchauth-unbound': {
        const alt = read(join(corpus, 'receipts/receipt.launch-authorization.alt.json'))
        seal(fx, fx.evidenceDir, 'launch-authorization.json', 'recoveryCutover', 'launchAuthorizationReceiptSha256', r => {
          r.archiveSha256 = alt.censusArchiveSha256
        })
        break
      }
      case 'custody-nonroot': b.custody.executedAs = attack.custody.executedAs; break
      case 'controlledstop-missing': stop(fx, cut.windowOpenedAtWallMs + 15); b.controlledStop = attack.controlledStop; break
      case 'controlledstop-spurious': stop(fx, cut.windowOpenedAtWallMs + 15); fx.startup.recoveryPlanStopsRuntime = false; break
      case 'schema-extra-field': b.subject.operatorNote = attack.subject.operatorNote; break
      case 'schema-version-wrong': b.bundleSchemaVersion = attack.bundleSchemaVersion; break
      case 'digest-tampered-outputs': b.hostCensus.outputsSha256[1] = attack.hostCensus.outputsSha256[1]; break
      case 'forward-floor-unproven': {
        const pending = read(join(corpus, 'receipts/receipt.floor-pending.json'))
        seal(fx, fx.deploymentDir, 'floor-proven.json', 'deploymentProof', 'floorProvenReceiptSha256', r => { r.status = pending.status })
        break
      }
      case 'validator-not-installed': seal(fx, fx.deploymentDir, 'validator-installed.json', 'deploymentProof', 'validatorInstalledReceiptSha256', r => { r.evidenceKind = 'not_installed' }); break
      case 'historical-floor-claim': {
        const binary = attack.deploymentProof.deployedBinarySha256
        cut.consumingBinarySha256 = binary
        b.deploymentProof.deployedBinarySha256 = binary
        fx.startup.consumingBinarySha256 = binary
        seal(fx, fx.evidenceDir, 'launch-authorization.json', 'recoveryCutover', 'launchAuthorizationReceiptSha256', r => { r.consumingBinarySha256 = binary })
        break
      }
      case 'oversized': writeFileSync(fx.bundleFile, readFileSync(join(corpus, manifest.bundleAttacks[name].file))); return
      default: throw new Error(`unmapped corpus attack ${name}`)
    }
    writeFileSync(fx.bundleFile, json(b))
  }
  const expectedReason = {
    'subject-handle-wrong': 'V8_P1_P1_P2_P3_P4_P5_P6_P7_P8_P9_P10', 'subject-epoch-wrong': 'V8_P2',
    'subject-agent-wrong': 'V8_P3', 'subject-generation-wrong': 'V8_P4',
    'turnid-handle-mismatch': 'V8_P1', 'host-mismatch': 'V9_startup_binding_mismatch',
    'live-epoch': 'V4_epoch_invalid', 'census-nonzero': 'V5_census_invalid',
    'holder-live': 'V5_census_invalid', 'census-ordering-inverted': 'V5_census_invalid',
    'census-earlier-than-subject': 'V9_subject_after_cut',
    'window-continuity-lost': 'window_challenge_mismatch', 'nonce-reused': 'V9_startup_binding_mismatch',
    'launchauth-missing': 'digest_mismatch', 'launchauth-unbound': 'V9_launch_authorization_mismatch',
    'custody-nonroot': 'V6_custody_invalid', 'controlledstop-missing': 'V7_stop_plan_mismatch',
    'controlledstop-spurious': 'V7_stop_plan_mismatch', 'schema-extra-field': 'V2_subject_shape',
    'schema-version-wrong': 'V2_bundle_version', 'digest-tampered-outputs': 'V5_output_digest_mismatch',
    'forward-floor-unproven': 'V10_deployment_prerequisite_invalid',
    'validator-not-installed': 'V10_deployment_prerequisite_invalid',
    'historical-floor-claim': 'V10_deployment_prerequisite_invalid', 'oversized': 'custody_file_invalid',
  }
  test('salvaged snapshot and declared fixture hashes are pinned', () => {
    assert.equal(sha(readFileSync(join(root, 'SALVAGE.json'))), SNAPSHOT_SHA)
    assert.equal(manifest.governingSpec.revision, 'r4')
    assert.equal(manifest.identities.targetSubject.handle, base.subject.reconciliationHandle)
    for (const name of Object.keys(expectedReason)) load(name)
  })
  for (const [name, reason] of Object.entries(expectedReason)) {
    test(`salvaged ${name}: exact rejection and zero-write`, t => {
      const attack = load(name)
      const fx = proofFixture(cleanup => t.after(cleanup))
      adapt(name, attack, fx)
      const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
      const before = readFileSync(fx.persistenceFile)
      const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir,
        deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
      assert.deepEqual(result.map(row => row.status), ['rejected'], JSON.stringify(result))
      assert.equal(result[0].reason, reason)
      assert.deepEqual(readFileSync(fx.persistenceFile), before)
      assert.equal(store.activeFenceForAgent('agt_subject').handle, fx.handle)
    })
  }
  test('salvaged two different bundles for one handle both reject at RQ-002 before settlement', t => {
    const attack = load('duplicate-for-same-handle')
    const fx = proofFixture(cleanup => t.after(cleanup))
    const second = structuredClone(fx.bundle)
    second.recoveryCutover.startupNonce = attack.recoveryCutover.startupNonce
    second.recoveryCutover.oldTreeQuiescedAtWallMs += attack.recoveryCutover.oldTreeQuiescedAtWallMs
      - base.recoveryCutover.oldTreeQuiescedAtWallMs
    writeFileSync(join(fx.evidenceDir, 'second.bundle.json'), json(second))
    const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
    const before = readFileSync(fx.persistenceFile)
    const results = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir,
      deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
    assert.deepEqual(results.map(row => row.reason), ['duplicate_subject_bundle', 'duplicate_subject_bundle'])
    assert.deepEqual(readFileSync(fx.persistenceFile), before)
    assert.equal(store.activeFenceForAgent('agt_subject').handle, fx.handle)
  })
  test('salvaged exact-single-record: non-target unchanged and settle-once', t => {
    assert.equal(manifest.scenarios['exact-single-record'].expected.outcome, 'settle')
    const fx = proofFixture(cleanup => t.after(cleanup))
    stop(fx, fx.bundle.recoveryCutover.windowOpenedAtWallMs + 15)
    writeFileSync(fx.bundleFile, json(fx.bundle))
    const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
    const other = store.mintTurnExecution({ agentId: 'agt_non_target', processGeneration: 1, sessionId: 'main' })
    const otherBefore = JSON.stringify(store.records.get(other))
    const emitted = []
    store.onTurnReconciled(event => emitted.push(event))
    const options = { evidenceDir: fx.evidenceDir, deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io }
    assert.equal(store.consumeStartupQuiescence(options)[0].status, 'settled')
    const settled = store.getTurnReconciliation(fx.handle).snapshot
    assert.equal(settled.terminationEvidence, 'restart_quiescence_proven')
    assert.equal(settled.exitObservedAt, null)
    assert.equal(settled.initialOutcome, 'outcome_unknown')
    assert.equal(JSON.stringify(store.records.get(other)), otherBefore)
    assert.equal(store.consumeStartupQuiescence(options)[0].status, 'duplicate_ignored')
    assert.equal(emitted.length, 1)
  })
}
