/** #1257: an exact-handle, source-immutable adapter over deployed C019 recovery. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { assertAbsent, digest, privateFile, refuse, writeNewDurable } from './operator-files.js'
import { authorizeCandidate, DURABLE_IDLE_PROOFS, restoreAuthorizedFences } from './operator-authorization.js'

const SHA = /^[a-f0-9]{64}$/u

async function deployedAuthority(loader, expectedSha256) {
  if (!SHA.test(expectedSha256 ?? '') || digest(privateFile(loader).bytes) !== expectedSha256) {
    refuse('LOADER_MISMATCH')
  }
  const module = await import(pathToFileURL(loader).href)
  const store = await import(pathToFileURL(join(dirname(loader), 'store.js')).href)
  if (typeof module.readDurableRecoveryStore !== 'function'
      || typeof module.serializeDurableRecoveryStore !== 'function'
      || typeof store.TurnReconciliationStore !== 'function') refuse('LOADER_UNSUPPORTED')
  return { ...module, Store: store.TurnReconciliationStore }
}

function decode(authority, file, document) {
  try {
    const decoded = authority.readDurableRecoveryStore(file)
    if (decoded === null) refuse('STORE_INVALID')
    // No persistence path: constructor cannot restore or rewrite source.
    const store = new authority.Store({ runtimeEpoch: document.runtimeEpoch })
    for (const key of ['runtimeEpochs', 'records', 'issuance', 'correlationIndex', 'discriminatorSeq']) {
      store[key] = decoded[key]
    }
    store.recountCapacity()
    return store
  } catch { refuse('STORE_INVALID') }
}

function resumeOne(store, auth) {
  const record = store.records.get(auth.handle)
  if (!record || ['runtimeEpoch', 'agentId', 'processGeneration'].some(key => record[key] !== auth[key])) {
    refuse('AUTHORIZATION_MISMATCH')
  }
  if (record.initialOutcome !== 'outcome_unknown') refuse('NOT_OUTCOME_UNKNOWN')
  const durableIdleProof = DURABLE_IDLE_PROOFS.includes(auth.evidence)
  if (record.state !== 'settled') {
    if (durableIdleProof) {
      if (record.terminationEvidence !== auth.evidence || record.exitObservedAt !== null
          || auth.exitObservedAt !== null) refuse('DURABLE_PROOF_REQUIRED')
    } else if (auth.evidence !== 'child_real_exit' || record.exitObservedAt === null
        || record.exitObservedAt !== auth.exitObservedAt
        || (record.terminationEvidence !== null && record.terminationEvidence !== 'child_real_exit')) {
      refuse('DURABLE_PROOF_REQUIRED')
    }
    // Offline recovery cannot recreate the old parser's evidence precedence.
    if (record.outcomeEvidence !== null || record.outcome !== null || record.lateOutcome !== null) {
      refuse('OUTCOME_PRECEDENCE_REQUIRES_RUNTIME')
    }
  } else if (auth.evidence !== 'durable_settlement_cleanup'
      || record.terminationEvidence === null || record.exitObservedAt !== auth.exitObservedAt) {
    refuse('DURABLE_PROOF_REQUIRED')
  }
  const cleanupProven = record.attemptedActions.some(row => row.action === 'registry_cleanup' && row.result === 'succeeded')
  if (record.reapClaim !== null && !cleanupProven) refuse('REGISTRY_CLEANUP_UNPROVEN')
  if (record.state !== 'settled' && durableIdleProof) {
    // C019 resumes existing durable proof; authorization never creates evidence.
    store.settleLate(record.handle, { lateOutcome: 'terminated_without_outcome', terminationEvidence: auth.evidence })
  }
  const allRecords = store.records
  const allCorrelations = store.correlationIndex
  try {
    store.records = new Map([[record.handle, record]])
    store.correlationIndex = new Map([...allCorrelations].filter(([, handle]) => handle === record.handle))
    store.restoreCrashInterruptedRecords()
  } finally {
    store.records = allRecords
    store.correlationIndex = allCorrelations
  }
  return store.records.get(auth.handle)
}

export async function reconcileCandidate({ sourceFile, loader, loaderSha256, authorization, output, batch = false }) {
  sourceFile = resolve(sourceFile); loader = resolve(loader); output = resolve(output)
  assertAbsent(output); assertAbsent(`${output}.receipt.json`)
  const source = privateFile(sourceFile, 'STORE_UNAVAILABLE')
  const authority = await deployedAuthority(loader, loaderSha256)
  let document
  try { document = JSON.parse(source.bytes) } catch { refuse('STORE_INVALID') }
  // Validate pinned snapshot bytes rather than reopening a changing source.
  const temporary = mkdtempSync(join(tmpdir(), 'turn-recovery-validate-'))
  try {
    const input = join(temporary, 'input.json')
    const { auth, targets, authorizationSha256 } = authorizeCandidate(authorization, source, loaderSha256, batch)
    const originals = structuredClone(document)
    const repairs = batch ? restoreAuthorizedFences(document, targets) : []
    writeFileSync(input, JSON.stringify(document), { mode: 0o600 })
    const store = decode(authority, input, document)
    const settlements = []
    for (const target of targets) {
      const original = originals.records.find(row => row.handle === target.handle)
      const selected = resumeOne(store, target)
      const encoded = authority.serializeDurableRecoveryStore(store).records.find(row => row.handle === target.handle)
      // Already-settled values and retained answer digests are immutable.
      const replacement = original.queryState === 'settled' && original.fenceState === 'cleared'
        ? original : { ...encoded, finalAssistantOutputEvidence: original.finalAssistantOutputEvidence }
      document.records = document.records.map(row => row.handle === target.handle ? replacement : row)
      settlements.push({ handle: target.handle, settlementResult: selected.settlementResult,
        terminationEvidence: selected.terminationEvidence, exitObservedAt: selected.exitObservedAt,
        fenceState: selected.fenceState })
    }
    const bytes = Buffer.from(`${JSON.stringify(document)}\n`)
    const candidate = join(temporary, 'candidate.json')
    writeFileSync(candidate, bytes, { mode: 0o600 })
    decode(authority, candidate, document)
    if (digest(privateFile(sourceFile).bytes) !== auth.sourceSha256) refuse('PREIMAGE_MISMATCH')
    if (digest(privateFile(loader).bytes) !== loaderSha256) refuse('LOADER_MISMATCH')
    const receipt = { version: 1, disposition: 'validated_candidate_only', sourceModified: false,
      operationId: auth.operationId, ownerUid: auth.ownerUid, handle: auth.handle,
      sourceSha256: auth.sourceSha256, candidateSha256: digest(bytes), loaderSha256, authorizationSha256,
      ...(batch ? { repairs, settlements } : settlements[0]), createdAtWallMs: Date.now() }
    // Exclusive creation prevents replacing any source, existing output or symlink.
    writeNewDurable(output, bytes)
    try { writeNewDurable(`${output}.receipt.json`, `${JSON.stringify(receipt)}\n`) }
    catch { refuse('CANDIDATE_RECEIPT_INCOMPLETE') }
    return receipt
  } finally { rmSync(temporary, { recursive: true, force: true }) }
}

export async function validateRecoveryFile({ sourceFile, loader, loaderSha256 }) {
  const source = privateFile(resolve(sourceFile), 'STORE_UNAVAILABLE')
  const authority = await deployedAuthority(resolve(loader), loaderSha256)
  const temporary = mkdtempSync(join(tmpdir(), 'turn-recovery-validate-'))
  try {
    const file = join(temporary, 'input.json')
    writeFileSync(file, source.bytes, { mode: 0o600 })
    let document
    try { document = JSON.parse(source.bytes) } catch { refuse('STORE_INVALID') }
    const store = decode(authority, file, document)
    return { valid: true, records: store.records.size, sourceSha256: digest(source.bytes), loaderSha256, sourceModified: false }
  } finally { rmSync(temporary, { recursive: true, force: true }) }
}
