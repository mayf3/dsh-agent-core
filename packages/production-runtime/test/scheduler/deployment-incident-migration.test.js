import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, chown, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

import { canonicalJSON } from '../../../scheduler/src/occurrence-model.js'
import { runSchedulerIncidentMigration } from '../../src/scheduler/deployment-incident-migration.js'
import { relativeImports, resolveRelative, WATCHDOG_PAYLOAD_SHA } from '../../../../scripts/lib/admission-lib.mjs'

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const repo = new URL('../../../..', import.meta.url).pathname

async function materializePinnedMigrationClosure(root) {
  const queued = ['scripts/scheduler-watchdog.mjs']
  const seen = new Set()
  const show = (path) => execFileSync('git', ['show', `${WATCHDOG_PAYLOAD_SHA}:${path}`], { cwd: repo })
  while (queued.length > 0) {
    const path = queued.shift()
    if (seen.has(path)) continue
    const bytes = show(path)
    seen.add(path)
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), bytes)
    for (const specifier of relativeImports(bytes.toString('utf8'))) {
      for (const candidate of resolveRelative(dirname(path), specifier)) {
        try { show(candidate); queued.push(candidate); break } catch { /* try the next resolution candidate */ }
      }
    }
  }
}

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

test('deployment migration uses the explicit runtime reader gid instead of the account primary gid', async (t) => {
  const runtimeReaderGid = process.getgroups().find((gid) => gid !== process.getgid())
  if (runtimeReaderGid === undefined) return t.skip('no secondary group available for runtime reader proof')
  const dir = await mkdtemp(join(tmpdir(), 'deployment-incident-reader-gid-'))
  await chmod(dir, 0o700)
  const stateDir = join(dir, 'state')
  await mkdir(stateDir, { mode: 0o700 })
  await chown(stateDir, process.getuid(), runtimeReaderGid)
  const legacyStatePath = join(dir, 'legacy.json'), legacyEvidencePath = join(dir, 'evidence.jsonl'), factsPath = join(dir, 'facts.json')
  const fact = { class: 'RUN_FAILED', jobId: 'job-a', occurrenceId: 'occ-a' }
  const fingerprint = 'RUN_FAILED|job-a|occ-a'
  const legacy = Buffer.from(`${JSON.stringify({ active: { [fingerprint]: {} } })}\n`)
  const evidence = Buffer.from(`${JSON.stringify({ fingerprint, delivery: 'DELIVERED', fact })}\n`)
  const factsBytes = Buffer.from(`${JSON.stringify([fact])}\n`)
  await writeFile(legacyStatePath, legacy, { mode: 0o600 })
  await writeFile(legacyEvidencePath, evidence, { mode: 0o600 })
  await writeFile(factsPath, factsBytes, { mode: 0o600 })
  const receipt = runSchedulerIncidentMigration({
    ctx: { runtimeNode: process.execPath, liveRoot: new URL('../../../..', import.meta.url).pathname,
      watchdogStateDir: stateDir, authsvcUid: process.getuid(), authsvcGid: process.getgid(), runtimeReaderGid },
    sources: { legacyStatePath, legacyStateSha256: sha(legacy), legacyEvidencePath, legacyEvidenceSha256: sha(evidence),
      factsPath, factsFileSha256: sha(factsBytes), factsSha256: sha(Buffer.from(canonicalJSON([fact]))) },
  })
  assert.equal(receipt.status, 'MIGRATED')
})

test('production-pinned payload executes migration with distinct source and destination groups', async (t) => {
  const runtimeReaderGid = process.getgroups().find((gid) => gid !== process.getgid())
  if (runtimeReaderGid === undefined) return t.skip('no secondary group available for runtime reader proof')
  const dir = await mkdtemp(join(tmpdir(), 'pinned-incident-reader-gid-'))
  await chmod(dir, 0o700)
  const liveRoot = join(dir, 'live'), stateDir = join(dir, 'state')
  await materializePinnedMigrationClosure(liveRoot)
  await mkdir(stateDir, { mode: 0o700 }); await chown(stateDir, process.getuid(), runtimeReaderGid)
  const legacyStatePath = join(dir, 'legacy.json'), legacyEvidencePath = join(dir, 'evidence.jsonl'), factsPath = join(dir, 'facts.json')
  const fact = { class: 'RUN_FAILED', jobId: 'job-pinned', occurrenceId: 'occ-pinned' }
  const fingerprint = 'RUN_FAILED|job-pinned|occ-pinned'
  const legacy = Buffer.from(`${JSON.stringify({ active: { [fingerprint]: {} } })}\n`)
  const evidence = Buffer.from(`${JSON.stringify({ fingerprint, delivery: 'DELIVERED', fact })}\n`)
  const factsBytes = Buffer.from(`${JSON.stringify([fact])}\n`)
  await writeFile(legacyStatePath, legacy, { mode: 0o600 })
  await writeFile(legacyEvidencePath, evidence, { mode: 0o600 })
  await writeFile(factsPath, factsBytes, { mode: 0o600 })
  const receipt = runSchedulerIncidentMigration({
    ctx: { runtimeNode: process.execPath, liveRoot, watchdogStateDir: stateDir,
      authsvcUid: process.getuid(), authsvcGid: process.getgid(), runtimeReaderGid },
    sources: { legacyStatePath, legacyStateSha256: sha(legacy), legacyEvidencePath, legacyEvidenceSha256: sha(evidence),
      factsPath, factsFileSha256: sha(factsBytes), factsSha256: sha(Buffer.from(canonicalJSON([fact]))) },
  })
  assert.equal(receipt.status, 'MIGRATED')
})
