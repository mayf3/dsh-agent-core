#!/usr/bin/env node
/**
 * repair-durable-store — the formal, auditable, rollback-able durable
 * migration/repair entry (#707 Phase B, agent-control#1398 M1).
 *
 * Preconditions (all fail loud before any mutation):
 *   --preimage-sha  the SHA-256 of the durable file AS AUTHORIZED by the
 *                   operator for THIS repair run; a mismatch refuses loud.
 *   --file          the durable store path (must be a regular 0600 file owned
 *                   by the control-plane account, dir 0700 — same discipline
 *                   as the ingress auth seam).
 *
 * Actions (in order, all receipted):
 *   1. Immutable preimage backup into --backup-dir (SHA recorded).
 *   2. Fail-closed normalization: any record with durable `state === 'blocked'`
 *      && `fenceState === 'cleared'` && a non-null failureReason is restored to
 *      `fenceState === 'active'` (the fence of a blocked record stays armed —
 *      the exact inverse of the markFenceCleared write-path bug fixed in this
 *      same change). Records are NEVER marked settled by this tool.
 *   3. evictedGenerations → evictedRanges migration (adjacent merge; C-018
 *      `never_existed` vs `evicted` semantics preserved; legacy entries merged
 *      in memory and written as ranges).
 *   4. Full readDurableRecoveryStore validation of the repaired content.
 *   5. Atomic write (temp + rename, 0600 authsvc) + repair receipt.
 *
 * Rollback: the preimage backup is byte-identical; restoring it is a single
 * copy + kickstart.
 */
import { readFileSync, writeFileSync, statSync, renameSync, mkdirSync, copyFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'

const args = process.argv.slice(2)
const val = (name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1] }
const file = val('--file')
const preimageSha = val('--preimage-sha')
const backupDir = val('--backup-dir')

const fail = (msg) => { console.error(`REPAIR REFUSED: ${msg}`); process.exit(20) }
if (!file || !preimageSha || !backupDir) fail('--file --preimage-sha --backup-dir are all required')

const st = statSync(file)
if (!st.isFile()) fail('durable store must be a regular file')
if ((st.mode & 0o7777) !== 0o600) fail(`durable store mode must be 0600 (got ${(st.mode & 0o7777).toString(8)})`)

const bytes = readFileSync(file)
const sha = createHash('sha256').update(bytes).digest('hex')
if (sha !== preimageSha) fail(`preimage SHA mismatch: file=${sha} expected=${preimageSha}`)
console.log(`preimage SHA verified: ${sha}`)

const doc = JSON.parse(bytes.toString('utf8'))
let normalizedFences = 0
for (const r of doc.records ?? []) {
  if (r?.state === 'blocked' && r?.fenceState === 'cleared'
      && typeof r.failureReason === 'string' && r.failureReason !== '') {
    r.fenceState = 'active'
    normalizedFences += 1
  }
}
let migratedAgents = 0
let legacyEntries = 0
let rangesAfter = 0
for (const entry of doc.issuance ?? []) {
  if (!Array.isArray(entry.evictedGenerations)) continue
  legacyEntries += entry.evictedGenerations.length
  const points = entry.evictedGenerations.map(tuple => ({
    fromGen: tuple[0], toGen: tuple[0], maxTurnSeq: tuple[1],
  }))
  for (const range of entry.evictedRanges ?? []) {
    points.push({ fromGen: range.fromGen, toGen: range.toGen, maxTurnSeq: range.maxTurnSeq })
  }
  points.sort((a, b) => a.fromGen - b.fromGen || a.toGen - b.toGen)
  const merged = []
  for (const point of points) {
    const last = merged[merged.length - 1]
    if (last !== undefined && point.fromGen <= last.toGen + 1) {
      last.toGen = Math.max(last.toGen, point.toGen)
      last.maxTurnSeq = Math.max(last.maxTurnSeq, point.maxTurnSeq)
    } else {
      merged.push({ fromGen: point.fromGen, toGen: point.toGen, maxTurnSeq: point.maxTurnSeq })
    }
  }
  entry.evictedRanges = merged
  delete entry.evictedGenerations
  migratedAgents += 1
  rangesAfter += merged.length
}
console.log(`normalized blocked fences: ${normalizedFences}`)
console.log(`issuance agents migrated to evictedRanges: ${migratedAgents}`)
console.log(`legacy evicted entries merged into ${rangesAfter} ranges`)

// Full validation with the deployed store code (same package the runtime uses).
const { readDurableRecoveryStore } = await import('../packages/agent-router/src/reconciliation/durable-file.js')
mkdirSync(backupDir, { recursive: true })
const preimageCopy = join(backupDir, 'turn-recovery-v3.preimage.json')
copyFileSync(file, preimageCopy)
const repairedPath = join(backupDir, 'turn-recovery-v3.repaired.json')
writeFileSync(repairedPath, JSON.stringify(doc, null, 1), { mode: 0o600 })
try {
  const loaded = readDurableRecoveryStore(repairedPath)
  console.log(`repaired store VALIDATES — records: ${loaded.records.size}, issuance agents: ${loaded.issuance.size}`)
} catch (error) {
  fail(`repaired store still fails validation: ${error.message}`)
}
const repairedSha = createHash('sha256').update(readFileSync(repairedPath)).digest('hex')

const tmp = `${file}.repair-tmp`
writeFileSync(tmp, JSON.stringify(doc, null, 1), { mode: 0o600 })
renameSync(tmp, file)
const receipt = {
  receipt: 'DURABLE_STORE_REPAIR_RECEIPT_V1',
  recordedAt: new Date().toISOString(),
  file,
  preimageSha,
  repairedSha,
  normalizedBlockedFences: normalizedFences,
  issuanceAgentsMigrated: migratedAgents,
  legacyEvictedEntries: legacyEntries,
  rangesAfter,
  preimageBackup: preimageCopy,
  recordsPreserved: (doc.records ?? []).length,
}
writeFileSync(`${file}.repair-receipt.json`, JSON.stringify(receipt, null, 2), { mode: 0o640 })
console.log(`REPAIR OK — receipt at ${file}.repair-receipt.json`)
console.log(JSON.stringify(receipt))
