import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { chmod, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { appendPrivateJsonl, commitIncidentState, loadIncidentState, migrateLegacyIncidentStateFiles, validateIncidentState } from '../../src/watchdog/durable-state.js'
import { canonicalJSON } from '../../src/occurrence-model.js'
import { ensureProtectedDirectoryTree } from '../../src/watchdog/private-state-io.js'
import { compileIncidents } from '../../src/watchdog/incident-compiler.js'
import { bindNotificationDelivery, markNotificationDelivery, notificationKey, updateIncidentState } from '../../src/watchdog/incident-lifecycle.js'
import { providerIdempotencyKey, stableNotificationText } from '../../src/watchdog/delivery.js'

const state = (revision) => ({ version: 1, revision, incidents: {}, outbox: {} })
const sha = (value) => createHash('sha256').update(value).digest('hex')

function validIncidentState() {
  const incidents = compileIncidents([
    { class: 'ADMISSION_BLOCKED_UNKNOWN', jobId: 'job-a', occurrenceId: 'occ-a' },
  ]).incidents
  return updateIncidentState({}, incidents, { nowMs: 1 }).state
}

test('incident durability rejects invalid lifecycle, missing delivery, orphan and duplicate transition identities', () => {
  assert.throws(() => validateIncidentState({ version: 1, incidents: [], outbox: [] }), /unsupported incident state/)
  const invalidLifecycle = validIncidentState()
  Object.values(invalidLifecycle.incidents)[0].lifecycle = 'BANANA'
  assert.throws(() => commitIncidentState('/not-reached', invalidLifecycle), /incoherent incident record/)

  const missingDelivery = validIncidentState()
  const missingRecord = Object.values(missingDelivery.incidents)[0]
  const missingIntent = Object.values(missingDelivery.outbox)[0]
  delete missingRecord.alertState.delivery
  delete missingIntent.delivery
  assert.throws(() => commitIncidentState('/not-reached', missingDelivery), /incoherent incident/)

  const orphan = validIncidentState()
  orphan.outbox[Object.keys(orphan.outbox)[0]].incident.rootIdentity = 'orphan'
  assert.throws(() => commitIncidentState('/not-reached', orphan), /incoherent incident outbox/)

  const duplicate = validIncidentState()
  const [key, intent] = Object.entries(duplicate.outbox)[0]
  const second = structuredClone(intent)
  second.routeClass = `${second.routeClass}-other`
  second.incident.routeClass = second.routeClass
  second.notificationKey = notificationKey(second)
  duplicate.outbox[second.notificationKey] = second
  assert.notEqual(second.notificationKey, key)
  assert.throws(() => commitIncidentState('/not-reached', duplicate), /incoherent incident outbox/)

  const closed = updateIncidentState(validIncidentState(), [], { nowMs: 2 }).state
  assert.equal(validateIncidentState(closed), closed)
  const malformedClosure = structuredClone(closed)
  const current = Object.values(malformedClosure.outbox).find((intent) => intent.transitionRevision === 2)
  current.transitionKind = 'OPEN'
  assert.throws(() => validateIncidentState(malformedClosure), /incoherent incident outbox/)
  const missingClosure = structuredClone(closed)
  delete missingClosure.outbox[Object.entries(missingClosure.outbox).find(([, intent]) => intent.transitionRevision === 2)[0]]
  assert.throws(() => validateIncidentState(missingClosure), /lifecycle history is incomplete/)

  const future = validIncidentState()
  const [root, record] = Object.entries(future.incidents)[0]
  const futureIntent = { incident: { ...structuredClone(record), lifecycle: 'CLOSED_RECOVERED', transitionRevision: 2,
    alertState: { ...record.alertState, lifecycle: 'CLOSED_RECOVERED' } }, incidentId: record.incidentId,
    transitionRevision: 2, transitionKind: 'CLOSED_RECOVERED', routeClass: record.routeClass, producer: record.producer,
    delivery: 'PENDING', payloadRevision: 2 }
  futureIntent.notificationKey = notificationKey(futureIntent); future.outbox[futureIntent.notificationKey] = futureIntent
  assert.throws(() => validateIncidentState(future), /incoherent incident outbox/)
  assert.equal(future.incidents[root].transitionRevision, 1)

  const forgedMigration = validIncidentState()
  forgedMigration.migration = {}
  delete forgedMigration.outbox[Object.keys(forgedMigration.outbox)[0]]
  Object.values(forgedMigration.incidents)[0].alertState.delivery = 'DELIVERED'
  assert.throws(() => validateIncidentState(forgedMigration), /incoherent incident migration/)

  const shapedMigration = validIncidentState()
  shapedMigration.migration = { legacySha256: 'a'.repeat(64), evidenceSha256: 'b'.repeat(64), factsSha256: 'c'.repeat(64) }
  delete shapedMigration.outbox[Object.keys(shapedMigration.outbox)[0]]
  Object.values(shapedMigration.incidents)[0].alertState.delivery = 'DELIVERED'
  assert.throws(() => validateIncidentState(shapedMigration), /migration authority mismatch/)
})

test('incident durability binds persisted delivery to canonical routing authority', () => {
  const malicious = validIncidentState()
  const [key, intent] = Object.entries(malicious.outbox)[0]
  intent.deliveryBinding = { producer: intent.producer, route: { channel: 'feishu', to: 'daily-thought-agent-group' },
    payload: 'redirected', providerKey: 'not-derived', routeSource: 'canonicalOpsTarget', routingSha256: 'a'.repeat(64) }
  intent.deliveryBindingAt = 'not-a-time'
  assert.throws(() => validateIncidentState(malicious), /delivery binding/)

  const unbound = validIncidentState()
  const unboundKey = Object.keys(unbound.outbox)[0]
  const bound = bindNotificationDelivery(unbound, unboundKey, {
    producer: unbound.outbox[unboundKey].producer, route: { channel: 'feishu', to: 'scheduler-ops' },
    routeSource: 'canonicalOpsTarget', routingSha256: 'b'.repeat(64),
    payload: stableNotificationText(unbound.outbox[unboundKey]), providerKey: providerIdempotencyKey(unboundKey),
  }, 2)
  assert.equal(validateIncidentState(bound), bound)
  assert.throws(() => bindNotificationDelivery(unbound, unboundKey, {
    producer: unbound.outbox[unboundKey].producer, route: { channel: 'feishu', to: 'scheduler-ops' },
    routeSource: 'canonicalOpsTarget', routingSha256: 'b'.repeat(64),
    payload: stableNotificationText(unbound.outbox[unboundKey]), providerKey: providerIdempotencyKey(unboundKey),
  }, Number.MAX_SAFE_INTEGER + 1), /binding time is invalid/)
  for (const invalidAt of [-1, 0, 1.5]) {
    const invalid = structuredClone(bound); invalid.outbox[unboundKey].deliveryBindingAt = invalidAt
    assert.throws(() => validateIncidentState(invalid), /delivery binding/)
  }

  for (const delivery of ['OUTCOME_UNKNOWN', 'DELIVERED']) {
    const attemptedWithoutBinding = validIncidentState()
    const attemptedKey = Object.keys(attemptedWithoutBinding.outbox)[0]
    attemptedWithoutBinding.outbox[attemptedKey].delivery = delivery
    attemptedWithoutBinding.outbox[attemptedKey].deliveryUpdatedAt = 3
    attemptedWithoutBinding.outbox[attemptedKey].firstDeliveryAttemptAt = 2
    attemptedWithoutBinding.incidents[Object.keys(attemptedWithoutBinding.incidents)[0]].alertState.delivery = delivery
    assert.throws(() => validateIncidentState(attemptedWithoutBinding), /delivery chronology/)
  }
  assert.throws(() => markNotificationDelivery(validIncidentState(), Object.keys(validIncidentState().outbox)[0], 'OUTCOME_UNKNOWN', 2), /requires an immutable binding/)
  assert.throws(() => markNotificationDelivery(bound, unboundKey, 'OUTCOME_UNKNOWN', 1), /update time is invalid/)
  const unknown = markNotificationDelivery(bound, unboundKey, 'OUTCOME_UNKNOWN', 3)
  assert.throws(() => markNotificationDelivery(unknown, unboundKey, 'PENDING', 4), /invalid notification delivery transition/)
  assert.throws(() => markNotificationDelivery(unknown, unboundKey, 'OUTCOME_UNKNOWN', 2), /update time is invalid/)
  const regressed = structuredClone(unknown)
  regressed.outbox[unboundKey].delivery = 'PENDING'
  regressed.incidents[Object.keys(regressed.incidents)[0]].alertState.delivery = 'PENDING'
  assert.throws(() => validateIncidentState(regressed), /delivery chronology/)
})

test('delivery commit compares exact predecessor and rejects evidence-erasing regression to PENDING', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-transition-'))
  await chmod(dir, 0o700)
  const path = join(dir, 'incidents.json')
  const opened = validIncidentState()
  const key = Object.keys(opened.outbox)[0]
  let receipt = commitIncidentState(path, opened, { expectedHash: null })
  const bound = bindNotificationDelivery(opened, key, { producer: opened.outbox[key].producer,
    route: { channel: 'feishu', to: 'scheduler-ops' }, routeSource: 'canonicalOpsTarget',
    routingSha256: 'b'.repeat(64), payload: stableNotificationText(opened.outbox[key]), providerKey: providerIdempotencyKey(key) }, 2)
  receipt = commitIncidentState(path, bound, { expectedHash: receipt.hash })
  const unknown = markNotificationDelivery(bound, key, 'OUTCOME_UNKNOWN', 3)
  receipt = commitIncidentState(path, unknown, { expectedHash: receipt.hash })
  const erased = structuredClone(unknown)
  erased.outbox[key].delivery = 'PENDING'; delete erased.outbox[key].firstDeliveryAttemptAt; delete erased.outbox[key].deliveryUpdatedAt
  erased.incidents[Object.keys(erased.incidents)[0]].alertState.delivery = 'PENDING'
  assert.equal(validateIncidentState(erased), erased, 'standalone shape matches a legitimate bind-before-attempt state')
  assert.throws(() => commitIncidentState(path, erased, { expectedHash: receipt.hash }), /invalid notification delivery transition/)
})

test('protected control tree rejects symlink and writable ancestors before any receipt write', async () => {
  const root = await mkdtemp(join(tmpdir(), 'protected-control-tree-'))
  await chmod(root, 0o700)
  const real = join(root, 'real'), link = join(root, 'link')
  await mkdir(real); await symlink(real, link)
  assert.throws(() => ensureProtectedDirectoryTree(join(link, 'control'), { boundary: root }), /unsafe protected directory tree/)
  const writable = join(root, 'writable'); await mkdir(writable); await chmod(writable, 0o777)
  assert.throws(() => ensureProtectedDirectoryTree(join(writable, 'control'), { boundary: root }), /unsafe protected directory tree/)
  await assert.rejects(readFile(join(real, 'control', 'receipt.json')), /ENOENT/)
})

test('T26 state/outbox commit is atomic and expected-hash guarded', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-state-'))
  await chmod(dir, 0o700)
  const path = join(dir, 'incidents.json')
  const first = commitIncidentState(path, state(1), { expectedHash: null })
  const loaded = loadIncidentState(path)
  assert.equal(loaded.state.revision, 1)
  assert.equal(loaded.hash, first.hash)
  assert.throws(() => commitIncidentState(path, state(2), { expectedHash: 'stale' }), /generation mismatch/)
  assert.equal(JSON.parse(await readFile(path, 'utf8')).revision, 1)
})

test('T26 injected crash before rename preserves preimage bytes and leaves no accepted new state', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-crash-'))
  await chmod(dir, 0o700)
  const path = join(dir, 'incidents.json')
  commitIncidentState(path, state(1), { expectedHash: null })
  const before = await readFile(path)
  assert.throws(() => commitIncidentState(path, state(2), { expectedHash: loadIncidentState(path).hash, crashAt: 'before-rename' }), /injected crash/)
  assert.deepEqual(await readFile(path), before)
})

test('T28 unsafe mode, symlink and concurrent lock fail loud without resetting state', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-unsafe-'))
  await chmod(dir, 0o700)
  const path = join(dir, 'incidents.json')
  commitIncidentState(path, state(1), { expectedHash: null })
  await chmod(path, 0o644)
  assert.throws(() => loadIncidentState(path), /unsafe incident state file/)
  await chmod(path, 0o600)
  await writeFile(`${path}.lock`, 'busy', { mode: 0o600 })
  assert.throws(() => commitIncidentState(path, state(2), { expectedHash: loadIncidentState(path).hash }), /concurrent writer/)
})

test('T28 only a well-formed lock whose exact PID is proven dead may be reaped', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-stale-lock-'))
  await chmod(dir, 0o700)
  const path = join(dir, 'incidents.json')
  commitIncidentState(path, state(1), { expectedHash: null })
  const expectedHash = loadIncidentState(path).hash
  await writeFile(`${path}.lock`, `${JSON.stringify({ pid: 2147483647, token: 'dead-owner' })}\n`, { mode: 0o600 })
  commitIncidentState(path, state(2), { expectedHash })
  assert.equal(loadIncidentState(path).state.revision, 2)
  await writeFile(`${path}.lock`, `${JSON.stringify({ pid: 'not-a-pid', token: 'unknown-owner' })}\n`, { mode: 0o600 })
  assert.throws(() => commitIncidentState(path, state(3), { expectedHash: loadIncidentState(path).hash }), /concurrent writer/)
})

test('T28 two processes reaping one stale lock cannot delete the replacement live lock or corrupt state', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-stale-lock-race-'))
  await chmod(dir, 0o700)
  const path = join(dir, 'incidents.json')
  commitIncidentState(path, state(1), { expectedHash: null })
  const expectedHash = loadIncidentState(path).hash
  await writeFile(`${path}.lock`, `${JSON.stringify({ pid: 2147483647, token: 'dead-owner' })}\n`, { mode: 0o600 })
  const moduleUrl = new URL('../../src/watchdog/durable-state.js', import.meta.url).href
  const child = (revision) => new Promise((resolve, reject) => {
    const program = `import { commitIncidentState } from ${JSON.stringify(moduleUrl)}; try { commitIncidentState(${JSON.stringify(path)}, ${JSON.stringify(state(revision))}, { expectedHash: ${JSON.stringify(expectedHash)} }); process.stdout.write('COMMITTED') } catch (error) { process.stdout.write('REFUSED:' + error.message) }`
    const proc = spawn(process.execPath, ['--input-type=module', '-e', program], { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''; proc.stdout.on('data', (bytes) => { output += bytes })
    proc.on('error', reject); proc.on('close', () => resolve(output))
  })
  const outcomes = await Promise.all([child(2), child(3)])
  assert.equal(outcomes.filter((value) => value === 'COMMITTED').length, 1)
  assert.match(outcomes.find((value) => value !== 'COMMITTED'), /^REFUSED:/)
  assert.ok([2, 3].includes(loadIncidentState(path).state.revision))
})

test('T27 file migration freezes all sources, retains hash-addressed backups, and reads back exact state', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-migrate-'))
  await chmod(dir, 0o700)
  const legacyPath = join(dir, 'legacy.json')
  const evidencePath = join(dir, 'evidence.jsonl')
  const incidentPath = join(dir, 'incidents.json')
  const legacyBytes = Buffer.from(`${JSON.stringify({ active: { 'ADMISSION_BLOCKED_UNKNOWN|job-a|occ-a': { firstSeenAt: 1 } } })}\n`)
  const evidenceBytes = Buffer.from(`${JSON.stringify({ fingerprint: 'ADMISSION_BLOCKED_UNKNOWN|job-a|occ-a', delivery: 'DELIVERED', fact: { class: 'ADMISSION_BLOCKED_UNKNOWN', jobId: 'job-a', occurrenceId: 'occ-a' } })}\n`)
  await writeFile(legacyPath, legacyBytes, { mode: 0o600 })
  await writeFile(evidencePath, evidenceBytes, { mode: 0o600 })
  const findings = [{ class: 'ADMISSION_BLOCKED_UNKNOWN', jobId: 'job-a', occurrenceId: 'occ-a' }]
  const result = migrateLegacyIncidentStateFiles({
    legacyStatePath: legacyPath,
    legacyEvidencePath: evidencePath,
    incidentStatePath: incidentPath,
    findings,
    expectedLegacySha256: sha(legacyBytes),
    expectedEvidenceSha256: sha(evidenceBytes),
    expectedFactsSha256: sha(Buffer.from(canonicalJSON(findings))),
    nowMs: 2,
  })
  assert.equal(Object.keys(result.state.incidents).length, 1)
  assert.equal(Object.values(result.state.incidents)[0].alertState.delivery, 'DELIVERED')
  assert.equal(loadIncidentState(incidentPath).hash, result.incidentSha256)
  assert.equal((await readFile(join(dir, 'migration-backups', `legacy-${sha(legacyBytes)}.json`))).toString(), legacyBytes.toString())
  await writeFile(join(dir, 'migration-backups', `facts-${result.factsSha256}.json`), '[]tampered', { mode: 0o600 })
  assert.throws(() => loadIncidentState(incidentPath), /migration backup generation mismatch/)
})

test('failed-cutover replay preserves committed incidents and imports only newly proven legacy roots', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-migrate-extension-'))
  await chmod(dir, 0o700)
  const legacyPath = join(dir, 'legacy.json')
  const evidencePath = join(dir, 'evidence.jsonl')
  const incidentPath = join(dir, 'incidents.json')
  const factA = { class: 'RUN_FAILED', jobId: 'job-a', occurrenceId: 'occ-a' }
  const factB = { class: 'RUN_FAILED', jobId: 'job-b', occurrenceId: 'occ-b' }
  const fingerprintA = 'RUN_FAILED|job-a|occ-a'
  const fingerprintB = 'RUN_FAILED|job-b|occ-b'
  const firstLegacy = Buffer.from(`${JSON.stringify({ active: { [fingerprintA]: { firstSeenAt: 1 } } })}\n`)
  const firstEvidence = Buffer.from(`${JSON.stringify({ fingerprint: fingerprintA, delivery: 'DELIVERED', fact: factA })}\n`)
  await writeFile(legacyPath, firstLegacy, { mode: 0o600 })
  await writeFile(evidencePath, firstEvidence, { mode: 0o600 })
  const first = migrateLegacyIncidentStateFiles({
    legacyStatePath: legacyPath, legacyEvidencePath: evidencePath, incidentStatePath: incidentPath,
    findings: [factA], expectedLegacySha256: sha(firstLegacy), expectedEvidenceSha256: sha(firstEvidence),
    expectedFactsSha256: sha(Buffer.from(canonicalJSON([factA]))), nowMs: 2,
  })
  const [rootA] = Object.keys(first.state.incidents)
  const committedA = structuredClone(first.state.incidents[rootA])

  const secondLegacy = Buffer.from(`${JSON.stringify({
    active: { [fingerprintB]: { firstSeenAt: 3 } },
    acknowledged: { [fingerprintA]: { acknowledgedAt: 3 } },
  })}\n`)
  const secondEvidence = Buffer.from([
    JSON.stringify({ fingerprint: fingerprintA, delivery: 'DELIVERED', fact: factA }),
    JSON.stringify({ fingerprint: fingerprintB, delivery: 'DELIVERED', fact: factB }),
    '',
  ].join('\n'))
  await writeFile(legacyPath, secondLegacy, { mode: 0o600 })
  await writeFile(evidencePath, secondEvidence, { mode: 0o600 })
  const extended = migrateLegacyIncidentStateFiles({
    legacyStatePath: legacyPath, legacyEvidencePath: evidencePath, incidentStatePath: incidentPath,
    findings: [factA, factB], expectedLegacySha256: sha(secondLegacy), expectedEvidenceSha256: sha(secondEvidence),
    expectedFactsSha256: sha(Buffer.from(canonicalJSON([factA, factB]))), nowMs: 4,
  })

  assert.equal(extended.status, 'MIGRATION_EXTENDED')
  assert.equal(Object.keys(extended.state.incidents).length, 2)
  assert.deepEqual(extended.state.incidents[rootA], committedA)
  assert.equal(Object.keys(extended.state.outbox).length, 0)
  assert.deepEqual(extended.state.migration, {
    legacySha256: sha(secondLegacy), evidenceSha256: sha(secondEvidence),
    factsSha256: sha(Buffer.from(canonicalJSON([factA, factB]))),
  })
  assert.equal(loadIncidentState(incidentPath).hash, extended.incidentSha256)
})

test('failed-cutover replay refuses a generation that drops a committed root', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-migrate-drop-'))
  await chmod(dir, 0o700)
  const legacyPath = join(dir, 'legacy.json')
  const evidencePath = join(dir, 'evidence.jsonl')
  const incidentPath = join(dir, 'incidents.json')
  const fact = { class: 'RUN_FAILED', jobId: 'job-a', occurrenceId: 'occ-a' }
  const fingerprint = 'RUN_FAILED|job-a|occ-a'
  const firstLegacy = Buffer.from(`${JSON.stringify({ active: { [fingerprint]: {} } })}\n`)
  const firstEvidence = Buffer.from(`${JSON.stringify({ fingerprint, delivery: 'DELIVERED', fact })}\n`)
  await writeFile(legacyPath, firstLegacy, { mode: 0o600 })
  await writeFile(evidencePath, firstEvidence, { mode: 0o600 })
  migrateLegacyIncidentStateFiles({
    legacyStatePath: legacyPath, legacyEvidencePath: evidencePath, incidentStatePath: incidentPath,
    findings: [fact], expectedLegacySha256: sha(firstLegacy), expectedEvidenceSha256: sha(firstEvidence),
    expectedFactsSha256: sha(Buffer.from(canonicalJSON([fact]))), nowMs: 2,
  })

  const emptyLegacy = Buffer.from(`${JSON.stringify({ active: {} })}\n`)
  const emptyEvidence = Buffer.alloc(0)
  await writeFile(legacyPath, emptyLegacy, { mode: 0o600 })
  await writeFile(evidencePath, emptyEvidence, { mode: 0o600 })
  assert.throws(() => migrateLegacyIncidentStateFiles({
    legacyStatePath: legacyPath, legacyEvidencePath: evidencePath, incidentStatePath: incidentPath,
    findings: [], expectedLegacySha256: sha(emptyLegacy), expectedEvidenceSha256: sha(emptyEvidence),
    expectedFactsSha256: sha(Buffer.from(canonicalJSON([]))), nowMs: 3,
  }), /drops committed root/)
})

test('failed-cutover replay monotonically enriches a committed root without changing lifecycle or alert state', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-migrate-member-'))
  await chmod(dir, 0o700)
  const legacyPath = join(dir, 'legacy.json')
  const evidencePath = join(dir, 'evidence.jsonl')
  const incidentPath = join(dir, 'incidents.json')
  const blocked = { class: 'ADMISSION_BLOCKED_UNKNOWN', jobId: 'job-a', occurrenceId: 'occ-a' }
  const missed = { class: 'EXPECTED_RUN_MISSED', jobId: 'job-a', occurrenceId: 'occ-a', derivedUnderAdmissionBlock: true }
  const blockedFingerprint = 'ADMISSION_BLOCKED_UNKNOWN|job-a|occ-a'
  const missedFingerprint = 'EXPECTED_RUN_MISSED|job-a|occ-a'
  const firstLegacy = Buffer.from(`${JSON.stringify({ active: { [blockedFingerprint]: {} } })}\n`)
  const firstEvidence = Buffer.from(`${JSON.stringify({ fingerprint: blockedFingerprint, delivery: 'DELIVERED', fact: blocked })}\n`)
  await writeFile(legacyPath, firstLegacy, { mode: 0o600 })
  await writeFile(evidencePath, firstEvidence, { mode: 0o600 })
  migrateLegacyIncidentStateFiles({
    legacyStatePath: legacyPath, legacyEvidencePath: evidencePath, incidentStatePath: incidentPath,
    findings: [blocked], expectedLegacySha256: sha(firstLegacy), expectedEvidenceSha256: sha(firstEvidence),
    expectedFactsSha256: sha(Buffer.from(canonicalJSON([blocked]))), nowMs: 2,
  })

  const secondLegacy = Buffer.from(`${JSON.stringify({ active: { [blockedFingerprint]: {}, [missedFingerprint]: {} } })}\n`)
  const secondEvidence = Buffer.from([
    JSON.stringify({ fingerprint: blockedFingerprint, delivery: 'DELIVERED', fact: blocked }),
    JSON.stringify({ fingerprint: missedFingerprint, delivery: 'DELIVERED', fact: missed }),
    '',
  ].join('\n'))
  await writeFile(legacyPath, secondLegacy, { mode: 0o600 })
  await writeFile(evidencePath, secondEvidence, { mode: 0o600 })
  const before = loadIncidentState(incidentPath).state
  const [root] = Object.keys(before.incidents)
  const extended = migrateLegacyIncidentStateFiles({
    legacyStatePath: legacyPath, legacyEvidencePath: evidencePath, incidentStatePath: incidentPath,
    findings: [blocked, missed], expectedLegacySha256: sha(secondLegacy), expectedEvidenceSha256: sha(secondEvidence),
    expectedFactsSha256: sha(Buffer.from(canonicalJSON([blocked, missed]))), nowMs: 3,
  })
  assert.equal(extended.status, 'MIGRATION_EXTENDED')
  assert.deepEqual(extended.state.incidents[root].facts, [blocked, missed])
  assert.deepEqual(extended.state.incidents[root].symptoms, ['ADMISSION_BLOCKED_UNKNOWN', 'EXPECTED_RUN_MISSED'])
  const { facts: beforeFacts, symptoms: beforeSymptoms, ...beforeAuthority } = before.incidents[root]
  const { facts: afterFacts, symptoms: afterSymptoms, ...afterAuthority } = extended.state.incidents[root]
  assert.deepEqual(afterAuthority, beforeAuthority)
  assert.ok(afterFacts.length > beforeFacts.length)
  assert.ok(afterSymptoms.length > beforeSymptoms.length)
})

test('failed-cutover replay retains prior fact detail when the same fingerprint gains fresh detail', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-migrate-detail-'))
  await chmod(dir, 0o700)
  const legacyPath = join(dir, 'legacy.json')
  const evidencePath = join(dir, 'evidence.jsonl')
  const incidentPath = join(dir, 'incidents.json')
  const fingerprint = 'RUN_FAILED|job-a|occ-a'
  const beforeFact = { class: 'RUN_FAILED', jobId: 'job-a', occurrenceId: 'occ-a', detail: 'before' }
  const afterFact = { class: 'RUN_FAILED', jobId: 'job-a', occurrenceId: 'occ-a', detail: 'after' }
  const legacy = Buffer.from(`${JSON.stringify({ active: { [fingerprint]: {} } })}\n`)
  const beforeEvidence = Buffer.from(`${JSON.stringify({ fingerprint, delivery: 'DELIVERED', fact: beforeFact })}\n`)
  await writeFile(legacyPath, legacy, { mode: 0o600 })
  await writeFile(evidencePath, beforeEvidence, { mode: 0o600 })
  const first = migrateLegacyIncidentStateFiles({
    legacyStatePath: legacyPath, legacyEvidencePath: evidencePath, incidentStatePath: incidentPath,
    findings: [beforeFact], expectedLegacySha256: sha(legacy), expectedEvidenceSha256: sha(beforeEvidence),
    expectedFactsSha256: sha(Buffer.from(canonicalJSON([beforeFact]))), nowMs: 2,
  })
  const [root] = Object.keys(first.state.incidents)
  const { facts: ignoredFacts, symptoms: beforeSymptoms, ...authority } = first.state.incidents[root]

  const afterEvidence = Buffer.from(`${JSON.stringify({ fingerprint, delivery: 'DELIVERED', fact: afterFact })}\n`)
  await writeFile(evidencePath, afterEvidence, { mode: 0o600 })
  const extended = migrateLegacyIncidentStateFiles({
    legacyStatePath: legacyPath, legacyEvidencePath: evidencePath, incidentStatePath: incidentPath,
    findings: [afterFact], expectedLegacySha256: sha(legacy), expectedEvidenceSha256: sha(afterEvidence),
    expectedFactsSha256: sha(Buffer.from(canonicalJSON([afterFact]))), nowMs: 3,
  })
  const { facts, symptoms, ...extendedAuthority } = extended.state.incidents[root]
  assert.equal(extended.status, 'MIGRATION_EXTENDED')
  assert.deepEqual(facts, [beforeFact, afterFact])
  assert.deepEqual(extendedAuthority, authority)
  assert.deepEqual(symptoms, beforeSymptoms)
})

test('T27 source drift aborts before incident-state commit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-migrate-drift-'))
  await chmod(dir, 0o700)
  const legacyPath = join(dir, 'legacy.json')
  const evidencePath = join(dir, 'evidence.jsonl')
  const incidentPath = join(dir, 'incidents.json')
  const legacyBytes = Buffer.from(`${JSON.stringify({ active: { 'RUN_FAILED|job-a|occ-a': {} } })}\n`)
  const evidenceBytes = Buffer.from(`${JSON.stringify({ fingerprint: 'RUN_FAILED|job-a|occ-a', delivery: 'DELIVERED', fact: { class: 'RUN_FAILED', jobId: 'job-a', occurrenceId: 'occ-a' } })}\n`)
  await writeFile(legacyPath, legacyBytes, { mode: 0o600 })
  await writeFile(evidencePath, evidenceBytes, { mode: 0o600 })
  const findings = [{ class: 'RUN_FAILED', jobId: 'job-a', occurrenceId: 'occ-a' }]
  assert.throws(() => migrateLegacyIncidentStateFiles({
    legacyStatePath: legacyPath, legacyEvidencePath: evidencePath, incidentStatePath: incidentPath, findings,
    expectedLegacySha256: sha(legacyBytes), expectedEvidenceSha256: sha(evidenceBytes),
    expectedFactsSha256: sha(Buffer.from(canonicalJSON(findings))),
    beforeCommit: () => writeFileSync(evidencePath, 'changed\n', { mode: 0o600 }),
  }), /source generation drifted/)
  assert.equal(loadIncidentState(incidentPath).hash, null)
})

test('T27 migration derives delivery only from frozen evidence and rejects contradictions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-migrate-conflict-'))
  await chmod(dir, 0o700)
  const legacyPath = join(dir, 'legacy.json')
  const evidencePath = join(dir, 'evidence.jsonl')
  const incidentPath = join(dir, 'incidents.json')
  const fingerprint = 'RUN_FAILED|job-a|occ-a'
  const fact = { class: 'RUN_FAILED', jobId: 'job-a', occurrenceId: 'occ-a' }
  const legacyBytes = Buffer.from(`${JSON.stringify({ active: { [fingerprint]: {} } })}\n`)
  const evidenceBytes = Buffer.from(`${JSON.stringify({ fingerprint, delivery: 'DELIVERED', fact })}\n${JSON.stringify({ fingerprint, delivery: 'FAILED', fact })}\n`)
  await writeFile(legacyPath, legacyBytes, { mode: 0o600 })
  await writeFile(evidencePath, evidenceBytes, { mode: 0o600 })
  assert.throws(() => migrateLegacyIncidentStateFiles({
    legacyStatePath: legacyPath, legacyEvidencePath: evidencePath, incidentStatePath: incidentPath,
    findings: [fact], expectedLegacySha256: sha(legacyBytes), expectedEvidenceSha256: sha(evidenceBytes),
    expectedFactsSha256: sha(Buffer.from(canonicalJSON([fact]))),
    deliveredFingerprints: new Set([fingerprint]),
  }), /duplicate or conflicting migration evidence/)
  assert.equal(loadIncidentState(incidentPath).hash, null)
})

test('T30 local ops sink is private, no-follow, locked, and append durable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'local-ops-sink-'))
  await chmod(dir, 0o700)
  const path = join(dir, 'local-ops.jsonl')
  appendPrivateJsonl(path, { incident: 'a' })
  appendPrivateJsonl(path, { incident: 'b' })
  assert.deepEqual((await readFile(path, 'utf8')).trim().split('\n').map(JSON.parse), [{ incident: 'a' }, { incident: 'b' }])
  await chmod(path, 0o644)
  assert.throws(() => appendPrivateJsonl(path, { incident: 'c' }), /unsafe incident state file/)
  await chmod(path, 0o600)
  await writeFile(`${path}.lock`, 'owned-by-peer', { mode: 0o600 })
  assert.throws(() => appendPrivateJsonl(path, { incident: 'c' }), /concurrent writer/)
  assert.equal(await readFile(`${path}.lock`, 'utf8'), 'owned-by-peer')
})

test('T27 formal migration entrypoint consumes only frozen protected source files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-migrate-cli-'))
  await chmod(dir, 0o700)
  const legacyPath = join(dir, 'legacy.json')
  const evidencePath = join(dir, 'evidence.jsonl')
  const factsPath = join(dir, 'facts.json')
  const incidentPath = join(dir, 'incidents.json')
  const fact = { class: 'RUN_FAILED', jobId: 'job-a', occurrenceId: 'occ-a' }
  const fingerprint = 'RUN_FAILED|job-a|occ-a'
  const legacyBytes = Buffer.from(`${JSON.stringify({ active: { [fingerprint]: { firstSeenAt: 1 } } })}\n`)
  const evidenceBytes = Buffer.from(`${JSON.stringify({ fingerprint, delivery: 'DELIVERED', fact })}\n`)
  const factsBytes = Buffer.from(`${JSON.stringify([fact])}\n`)
  await writeFile(legacyPath, legacyBytes, { mode: 0o600 })
  await writeFile(evidencePath, evidenceBytes, { mode: 0o600 })
  await writeFile(factsPath, factsBytes, { mode: 0o600 })
  const script = new URL('../../../../scripts/scheduler-watchdog.mjs', import.meta.url)
  const output = execFileSync(process.execPath, [script.pathname, '--migrate-incident-state'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      SCHEDULER_INCIDENT_STATE: incidentPath,
      SCHEDULER_MIGRATION_FACTS_FILE: factsPath,
      SCHEDULER_MIGRATION_FACTS_FILE_SHA256: sha(factsBytes),
      SCHEDULER_MIGRATION_FACTS_SHA256: sha(Buffer.from(canonicalJSON([fact]))),
      SCHEDULER_LEGACY_ALERT_STATE: legacyPath,
      SCHEDULER_LEGACY_ALERT_STATE_SHA256: sha(legacyBytes),
      SCHEDULER_LEGACY_DELIVERY_EVIDENCE: evidencePath,
      SCHEDULER_LEGACY_DELIVERY_EVIDENCE_SHA256: sha(evidenceBytes),
      SCHEDULER_INCIDENT_OWNER_UID: String(process.getuid()),
      SCHEDULER_INCIDENT_OWNER_GID: String(process.getgid()),
    },
  })
  assert.equal(JSON.parse(output).status, 'MIGRATED')
  const replay = execFileSync(process.execPath, [script.pathname, '--migrate-incident-state'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      SCHEDULER_INCIDENT_STATE: incidentPath,
      SCHEDULER_MIGRATION_FACTS_FILE: factsPath,
      SCHEDULER_MIGRATION_FACTS_FILE_SHA256: sha(factsBytes),
      SCHEDULER_MIGRATION_FACTS_SHA256: sha(Buffer.from(canonicalJSON([fact]))),
      SCHEDULER_LEGACY_ALERT_STATE: legacyPath,
      SCHEDULER_LEGACY_ALERT_STATE_SHA256: sha(legacyBytes),
      SCHEDULER_LEGACY_DELIVERY_EVIDENCE: evidencePath,
      SCHEDULER_LEGACY_DELIVERY_EVIDENCE_SHA256: sha(evidenceBytes),
      SCHEDULER_INCIDENT_OWNER_UID: String(process.getuid()),
      SCHEDULER_INCIDENT_OWNER_GID: String(process.getgid()),
    },
  })
  assert.equal(JSON.parse(replay).status, 'ALREADY_MIGRATED')
  assert.equal(Object.keys(loadIncidentState(incidentPath).state.incidents).length, 1)
})
