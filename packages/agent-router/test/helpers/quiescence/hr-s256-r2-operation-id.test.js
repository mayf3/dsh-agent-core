import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { TurnReconciliationStore } from '../../../src/reconciliation-store.js'
import { json, proofFixture } from '../restart-quiescence-fixture.js'

const FIXED_OPERATION_ID = 'hr-s256-trusted-quiescence-cut-20260925-v1'
const sha = raw => createHash('sha256').update(raw).digest('hex')

function seal(path, value) {
  const bytes = json(value)
  writeFileSync(path, bytes)
  return sha(bytes)
}

function operationId(fx, id) {
  const cut = fx.bundle.recoveryCutover
  cut.operationId = id
  fx.bundle.hostCensus.operationId = id
  fx.bundle.holderCheck.operationId = id
  for (const [name, digestField] of [
    ['exclusive-window.json', 'exclusiveWindowReceiptSha256'],
    ['launch-sources-inhibited.json', 'launchSourcesInhibitedReceiptSha256'],
    ['old-tree-quiesced.json', 'oldTreeQuiescedReceiptSha256'],
  ]) {
    const path = join(fx.evidenceDir, name)
    const receipt = JSON.parse(readFileSync(path, 'utf8'))
    receipt.operationId = id
    cut[digestField] = seal(path, receipt)
  }
  const archivePath = join(fx.evidenceDir, 'census-archive.json')
  const archive = JSON.parse(readFileSync(archivePath, 'utf8'))
  archive.operationId = id
  const archiveSha256 = seal(archivePath, archive)
  const authPath = join(fx.evidenceDir, 'launch-authorization.json')
  const auth = JSON.parse(readFileSync(authPath, 'utf8'))
  auth.operationId = id
  auth.archiveSha256 = archiveSha256
  auth.holderCheck = fx.bundle.holderCheck
  cut.launchAuthorizationReceiptSha256 = seal(authPath, auth)
  writeFileSync(fx.bundleFile, json(fx.bundle))
}

test('fixed R2 operation ID alone cannot replace the registered fixed journal', (t) => {
  const fx = proofFixture(cleanup => t.after(cleanup))
  operationId(fx, FIXED_OPERATION_ID)
  const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
  const before = readFileSync(fx.persistenceFile)
  const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir,
    deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
  assert.deepEqual(result.map(row => row.status), ['rejected'], JSON.stringify(result))
  assert.deepEqual(readFileSync(fx.persistenceFile), before)
})

test('other unapproved non-op ID rejects with durable zero-write', (t) => {
  const fx = proofFixture(cleanup => t.after(cleanup))
  operationId(fx, 'hr-other-operation')
  const store = new TurnReconciliationStore({ persistenceFile: fx.persistenceFile, runtimeEpoch: 'fresh-epoch' })
  const before = readFileSync(fx.persistenceFile)
  const result = store.consumeStartupQuiescence({ evidenceDir: fx.evidenceDir,
    deploymentDir: fx.deploymentDir, startup: fx.startup, io: fx.io })
  assert.equal(result[0].status, 'rejected')
  assert.equal(result[0].reason, 'V2_identity_invalid')
  assert.deepEqual(readFileSync(fx.persistenceFile), before)
})
