import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadIncidentState, migrateLegacyIncidentStateFiles } from '../../src/watchdog/durable-state.js'
import { canonicalJSON } from '../../src/occurrence-model.js'

// Failed-cutover migration-extension cases, split from durable-state.test.js
// (binding structure gate B4). Coverage and semantics are unchanged — these
// are the SAME tests, moved so each file stays under the 500-line ceiling.

const sha = (value) => createHash('sha256').update(value).digest('hex')

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

test('failed-cutover replay carries forward a committed root absent from a later snapshot', async () => {
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
  const first = migrateLegacyIncidentStateFiles({
    legacyStatePath: legacyPath, legacyEvidencePath: evidencePath, incidentStatePath: incidentPath,
    findings: [fact], expectedLegacySha256: sha(firstLegacy), expectedEvidenceSha256: sha(firstEvidence),
    expectedFactsSha256: sha(Buffer.from(canonicalJSON([fact]))), nowMs: 2,
  })

  const emptyLegacy = Buffer.from(`${JSON.stringify({ active: {} })}\n`)
  const emptyEvidence = Buffer.alloc(0)
  await writeFile(legacyPath, emptyLegacy, { mode: 0o600 })
  await writeFile(evidencePath, emptyEvidence, { mode: 0o600 })
  const extended = migrateLegacyIncidentStateFiles({
    legacyStatePath: legacyPath, legacyEvidencePath: evidencePath, incidentStatePath: incidentPath,
    findings: [], expectedLegacySha256: sha(emptyLegacy), expectedEvidenceSha256: sha(emptyEvidence),
    expectedFactsSha256: sha(Buffer.from(canonicalJSON([]))), nowMs: 3,
  })
  assert.equal(extended.status, 'MIGRATION_EXTENDED')
  assert.deepEqual(extended.state.incidents, first.state.incidents)
  assert.deepEqual(extended.state.outbox, first.state.outbox)
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

test('failed-cutover replay replaces volatile detail for one stable fingerprint without growing state', async () => {
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
  assert.deepEqual(facts, [afterFact])
  assert.deepEqual(extendedAuthority, authority)
  assert.deepEqual(symptoms, beforeSymptoms)
})

test('failed-cutover replay stays bounded across repeated volatile generations', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-migrate-bounded-'))
  await chmod(dir, 0o700)
  const legacyPath = join(dir, 'legacy.json')
  const evidencePath = join(dir, 'evidence.jsonl')
  const incidentPath = join(dir, 'incidents.json')
  const fingerprint = 'EXPECTED_RUN_MISSED|job-a|occ-a'
  const legacy = Buffer.from(`${JSON.stringify({ active: { [fingerprint]: {} } })}\n`)
  await writeFile(legacyPath, legacy, { mode: 0o600 })
  let result
  for (let generation = 1; generation <= 12; generation += 1) {
    const fact = { class: 'EXPECTED_RUN_MISSED', jobId: 'job-a', occurrenceId: 'occ-a', overdueMs: generation }
    const evidence = Buffer.from(`${JSON.stringify({ fingerprint, delivery: 'DELIVERED', fact })}\n`)
    await writeFile(evidencePath, evidence, { mode: 0o600 })
    result = migrateLegacyIncidentStateFiles({
      legacyStatePath: legacyPath, legacyEvidencePath: evidencePath, incidentStatePath: incidentPath,
      findings: [fact], expectedLegacySha256: sha(legacy), expectedEvidenceSha256: sha(evidence),
      expectedFactsSha256: sha(Buffer.from(canonicalJSON([fact]))), nowMs: generation,
    })
  }
  const [record] = Object.values(result.state.incidents)
  assert.equal(record.facts.length, 1)
  assert.equal(record.facts[0].overdueMs, 12)
  assert.equal(Object.keys(result.state.outbox).length, 0)
})
