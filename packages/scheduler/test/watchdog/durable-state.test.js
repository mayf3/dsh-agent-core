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
import { notificationKey, updateIncidentState } from '../../src/watchdog/incident-lifecycle.js'

const state = (revision) => ({ version: 1, revision, incidents: {}, outbox: {} })
const sha = (value) => createHash('sha256').update(value).digest('hex')

function validIncidentState() {
  const incidents = compileIncidents([
    { class: 'ADMISSION_BLOCKED_UNKNOWN', jobId: 'job-a', occurrenceId: 'occ-a' },
  ]).incidents
  return updateIncidentState({}, incidents, { nowMs: 1 }).state
}

test('incident durability rejects invalid lifecycle, missing delivery, orphan and duplicate transition identities', () => {
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
  assert.throws(() => validateIncidentState(missingClosure), /lacks unique current outbox/)
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
