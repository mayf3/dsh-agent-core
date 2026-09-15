import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chmod, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { canonicalJSON } from '../../../scheduler/src/occurrence-model.js'
import { runSchedulerIncidentMigration } from '../../src/scheduler/deployment-incident-migration.js'

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')

test('deployment accepts a safe failed-cutover migration extension receipt', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'deployment-incident-extension-'))
  await chmod(dir, 0o700)
  const legacyStatePath = join(dir, 'legacy.json')
  const legacyEvidencePath = join(dir, 'evidence.jsonl')
  const factsPath = join(dir, 'facts.json')
  const factA = { class: 'RUN_FAILED', jobId: 'job-a', occurrenceId: 'occ-a' }
  const factB = { class: 'RUN_FAILED', jobId: 'job-b', occurrenceId: 'occ-b' }
  const fingerprintA = 'RUN_FAILED|job-a|occ-a'
  const fingerprintB = 'RUN_FAILED|job-b|occ-b'
  const ctx = {
    runtimeNode: process.execPath,
    liveRoot: new URL('../../../..', import.meta.url).pathname,
    watchdogStateDir: dir,
    authsvcUid: process.getuid(),
    authsvcGid: process.getgid(),
  }
  const writeGeneration = async (facts) => {
    const fingerprints = facts.length === 1 ? [fingerprintA] : [fingerprintA, fingerprintB]
    const legacy = Buffer.from(`${JSON.stringify({ active: Object.fromEntries(fingerprints.map((value) => [value, {}])) })}\n`)
    const evidence = Buffer.from(`${facts.map((fact, index) => JSON.stringify({ fingerprint: fingerprints[index], delivery: 'DELIVERED', fact })).join('\n')}\n`)
    const factsBytes = Buffer.from(`${JSON.stringify(facts)}\n`)
    await writeFile(legacyStatePath, legacy, { mode: 0o600 })
    await writeFile(legacyEvidencePath, evidence, { mode: 0o600 })
    await writeFile(factsPath, factsBytes, { mode: 0o600 })
    return {
      legacyStatePath, legacyStateSha256: sha(legacy),
      legacyEvidencePath, legacyEvidenceSha256: sha(evidence),
      factsPath, factsFileSha256: sha(factsBytes),
      factsSha256: sha(Buffer.from(canonicalJSON(facts))),
    }
  }

  assert.equal(runSchedulerIncidentMigration({ ctx, sources: await writeGeneration([factA]) }).status, 'MIGRATED')
  assert.equal(runSchedulerIncidentMigration({ ctx, sources: await writeGeneration([factA, factB]) }).status, 'MIGRATION_EXTENDED')
})
