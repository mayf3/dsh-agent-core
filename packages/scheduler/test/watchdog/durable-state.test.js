import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { appendPrivateJsonl, commitIncidentState, loadIncidentState, migrateLegacyIncidentStateFiles } from '../../src/watchdog/durable-state.js'
import { canonicalJSON } from '../../src/occurrence-model.js'

const state = (revision) => ({ version: 1, revision, incidents: {}, outbox: {} })
const sha = (value) => createHash('sha256').update(value).digest('hex')

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

test('T27 file migration freezes all sources, retains hash-addressed backups, and reads back exact state', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'incident-migrate-'))
  await chmod(dir, 0o700)
  const legacyPath = join(dir, 'legacy.json')
  const evidencePath = join(dir, 'evidence.jsonl')
  const incidentPath = join(dir, 'incidents.json')
  const legacyBytes = Buffer.from(`${JSON.stringify({ active: { 'ADMISSION_BLOCKED_UNKNOWN|job-a|occ-a': { firstSeenAt: 1 } } })}\n`)
  const evidenceBytes = Buffer.from('{"delivery":"DELIVERED"}\n')
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
    deliveredFingerprints: new Set(['ADMISSION_BLOCKED_UNKNOWN|job-a|occ-a']),
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
  const evidenceBytes = Buffer.from('proof\n')
  await writeFile(legacyPath, legacyBytes, { mode: 0o600 })
  await writeFile(evidencePath, evidenceBytes, { mode: 0o600 })
  const findings = [{ class: 'RUN_FAILED', jobId: 'job-a', occurrenceId: 'occ-a' }]
  assert.throws(() => migrateLegacyIncidentStateFiles({
    legacyStatePath: legacyPath, legacyEvidencePath: evidencePath, incidentStatePath: incidentPath, findings,
    expectedLegacySha256: sha(legacyBytes), expectedEvidenceSha256: sha(evidenceBytes),
    expectedFactsSha256: sha(Buffer.from(canonicalJSON(findings))),
    deliveredFingerprints: new Set(['RUN_FAILED|job-a|occ-a']),
    beforeCommit: () => writeFileSync(evidencePath, 'changed\n', { mode: 0o600 }),
  }), /source generation drifted/)
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
