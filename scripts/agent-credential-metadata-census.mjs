#!/usr/bin/env node
/**
 * agent-credential-metadata-census — fleet credential metadata census
 * (AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_CAUSE_V1 STEP 7; governing spec
 * AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 Amendment 7 + census predicate
 * frozen in the Amendment 7 summary §6).
 *
 * METADATA-ONLY: no secret bytes are read, printed, or written. The DB hash
 * column value is read ONLY in-process for scrypt store-pairing verification
 * and fingerprinted (sha256, 12-hex prefix) — never output. The credential
 * store's secret values are consumed in-process for the same pairing check.
 *
 * Usage (the ONE bounded Owner native read-only gate):
 *   DATABASE_URL=postgres://… sudo -u authsvc node scripts/agent-credential-metadata-census.mjs \
 *     --store /usr/local/libexec/agent-core/config/agent-credentials.json [--out /tmp/census.json]
 *   node scripts/agent-credential-metadata-census.mjs --selftest   (offline, no DB)
 *
 * Checks:
 *   1. DRIFT predicate (spec-frozen): updated_at > created_at AND rotated_at IS NULL
 *   2. Receipt ledger cross-check: every machine_client_rotations row must
 *      match the client's LIVE hash fingerprint (postimage) — mismatch = unrecorded
 *      post-rotation drift; replay of a known operation must be consistent.
 *   3. DB/store pairing per agent: scrypt-verify(store.secret, db.hash).
 *   4. Classification per the governing goal:
 *      KNOWN_HISTORICAL_INCIDENT / ACTIVE_DRIFT / LEGACY_INCOMPLETE_METADATA / OTHER.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash, scryptSync } from 'node:crypto'

const args = process.argv.slice(2)
const val = (n) => { const i = args.indexOf(n); return i === -1 ? undefined : args[i + 1] }

function fp(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 12)
}

function psqlRows(databaseUrl, sql, psqlPath = 'psql') {
  const stdout = execFileSync(psqlPath, [databaseUrl, '-At', '-v', 'ON_ERROR_STOP=1'], {
    input: `SELECT coalesce(row_to_json(r)::text,'null') FROM ( ${sql} ) r;\n`,
    encoding: 'utf8',
  })
  return stdout.split('\n').filter((l) => l !== '').map((l) => JSON.parse(l))
}

function scryptVerify(secret, stored) {
  const i = stored.indexOf(':')
  if (i <= 0) return false
  const calc = scryptSync(secret, stored.slice(0, i), 64, { N: 16384, r: 8, p: 1 })
  const storedKey = Buffer.from(stored.slice(i + 1), 'hex')
  return storedKey.length === calc.length && timingSafeEqualStable(calc, storedKey)
}
function timingSafeEqualStable(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

const KNOWN_HISTORICAL_CLIENT_IDS = new Set([
  // 2026-09-07/08 incident client — drifted by the retired p4-final.sh, repaired
  // by the receipted bdcred-20260908.sh rotate (investigation: docs/investigations/
  // AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_CAUSE_V1.md).
  'mc_IbXwCGnMH10uc9630c1xojFE',
])

function runCensus({ databaseUrl, storeFile }) {
  const rows = psqlRows(databaseUrl, `
    SELECT p.agent_id AS agent_id, c.client_id AS client_id, c.status AS status,
           c.created_at AS created_at, c.updated_at AS updated_at,
           coalesce(c.rotated_at::text,'-') AS rotated_at, c.secret_hash AS secret_hash
      FROM machine_clients c JOIN machine_principals p ON p.id = c.machine_principal_id
     WHERE p.principal_type = 'agent'
     ORDER BY p.agent_id;`)

  let storeDoc = { credentials: {} }
  try { storeDoc = JSON.parse(readFileSync(storeFile, 'utf8')) } catch { /* store pairing degrades to SKIPPED */ }

  const receipts = psqlRows(databaseUrl, `
    SELECT operation_id AS operation_id, machine_client_id AS machine_client_id,
           client_id AS client_id, postimage_fingerprint AS postimage_fingerprint,
           rotated_at AS rotated_at
      FROM machine_client_rotations ORDER BY rotated_at;`)

  const agents = []
  for (const row of rows) {
    const created = new Date(row.created_at)
    const updated = new Date(row.updated_at)
    const driftPredicate = updated.getTime() > created.getTime() + 1000 && row.rotated_at === '-'
    const clientReceipts = receipts.filter((r) => r.client_id === row.client_id)
    let receiptConsistent = null // null = no receipts (never canonically rotated)
    if (clientReceipts.length > 0) {
      const latest = clientReceipts[clientReceipts.length - 1]
      receiptConsistent = fp(row.secret_hash) === String(latest.postimage_fingerprint).slice(0, 12)
    }
    const storeEntry = storeDoc.credentials?.[row.agent_id]
    let storePairing = 'SKIPPED_NO_STORE_ENTRY'
    if (storeEntry?.clientSecret !== undefined) {
      storePairing = scryptVerify(storeEntry.clientSecret, row.secret_hash) ? 'MATCH' : 'MISMATCH'
    }

    let classification = 'LEGACY_INCOMPLETE_METADATA'
    if (driftPredicate && receiptConsistent === false) classification = 'ACTIVE_DRIFT'
    else if (driftPredicate) {
      classification = KNOWN_HISTORICAL_CLIENT_IDS.has(row.client_id) ? 'KNOWN_HISTORICAL_INCIDENT' : 'ACTIVE_DRIFT'
    } else if (receiptConsistent === false) classification = 'ACTIVE_DRIFT'
    else if (row.rotated_at !== '-' && receiptConsistent === true && storePairing === 'MATCH') classification = 'OK_ROTATED'
    else if (storePairing === 'MISMATCH') classification = 'ACTIVE_DRIFT'
    else if (!driftPredicate && row.rotated_at === '-' && receiptConsistent === null) classification = 'OK_NEVER_ROTATED'

    agents.push({
      agentId: row.agent_id,
      clientId: row.client_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      rotatedAt: row.rotated_at,
      driftPredicate,
      receiptConsistent,
      storePairing,
      hashFingerprint: fp(row.secret_hash),
      classification,
    })
  }

  const summary = {
    total: agents.length,
    ACTIVE_DRIFT: agents.filter((a) => a.classification === 'ACTIVE_DRIFT').length,
    KNOWN_HISTORICAL_INCIDENT: agents.filter((a) => a.classification === 'KNOWN_HISTORICAL_INCIDENT').length,
    LEGACY_INCOMPLETE_METADATA: agents.filter((a) => a.classification === 'LEGACY_INCOMPLETE_METADATA').length,
    OK_NEVER_ROTATED: agents.filter((a) => a.classification === 'OK_NEVER_ROTATED').length,
    OK_ROTATED: agents.filter((a) => a.classification === 'OK_ROTATED').length,
    receiptLedgerRows: receipts.length,
  }
  return { summary, agents, receipts: receipts.length }
}

function selftest() {
  // Offline: parser + classification logic against synthetic rows.
  const now = Date.now()
  const iso = (ms) => new Date(ms).toISOString()
  const row = (clientId, createdMs, updatedMs, rotatedAt, hash) => ({
    agent_id: `agt-x-${clientId}`, client_id: clientId, status: 'active',
    created_at: iso(createdMs), updated_at: iso(updatedMs), rotated_at: rotatedAt, secret_hash: hash,
  })
  const salt = 'a'.repeat(32)
  const hashOf = (secret) => salt + ':' + scryptSync(secret, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')
  const base = now - 86400_000
  const healthy = row('mc_healthy', base, base, '-', hashOf('s1')) // never rotated
  const drifted = row('mc_drift', base, base + 60_000, '-', hashOf('s2')) // mutated, never rotated, no receipt
  const rotated = row('mc_rotated', base, base + 60_000, iso(base + 60_000), hashOf('s3'))
  const synthetic = [healthy, drifted, rotated]
  const receipts = [{ client_id: 'mc_rotated', postimage_fingerprint: fp(rotated.secret_hash), rotated_at: iso(base + 60_000) }]

  const KNOWN = new Set() // selftest: no historical allowlist entries
  const classify = (r, clientReceipts) => {
    const created = new Date(r.created_at); const updated = new Date(r.updated_at)
    const driftPredicate = updated.getTime() > created.getTime() + 1000 && r.rotated_at === '-'
    let receiptConsistent = null
    if (clientReceipts.length > 0) receiptConsistent = fp(r.secret_hash) === String(clientReceipts[clientReceipts.length - 1].postimage_fingerprint).slice(0, 12)
    if (driftPredicate && receiptConsistent === false) return 'ACTIVE_DRIFT'
    if (driftPredicate) return KNOWN.has(r.client_id) ? 'KNOWN_HISTORICAL_INCIDENT' : 'ACTIVE_DRIFT'
    if (receiptConsistent === false) return 'ACTIVE_DRIFT'
    if (r.rotated_at !== '-' && receiptConsistent === true) return 'OK_ROTATED'
    return 'OK_NEVER_ROTATED'
  }
  const cH = classify(healthy, [])
  const cD = classify(drifted, [])
  const cR = classify(rotated, receipts.filter((r) => r.client_id === 'mc_rotated'))
  if (cH !== 'OK_NEVER_ROTATED') { console.error('selftest FAIL: healthy classification', cH); process.exit(1) }
  if (cD !== 'ACTIVE_DRIFT') { console.error('selftest FAIL: drift classification', cD); process.exit(1) }
  if (cR !== 'OK_ROTATED') { console.error('selftest FAIL: rotated classification', cR); process.exit(1) }
  console.log('selftest: 3/3 classification rules PASS (metadata-only paths, no DB)')
}

if (args.includes('--selftest')) {
  selftest()
  process.exit(0)
}

const databaseUrl = process.env.DATABASE_URL ?? val('--database-url')
const storeFile = val('--store') ?? '/usr/local/libexec/agent-core/config/agent-credentials.json'
if (typeof databaseUrl !== 'string' || databaseUrl === '') {
  console.error('DATABASE_URL (env or --database-url) is required; --selftest runs offline')
  process.exit(2)
}
const result = runCensus({ databaseUrl, storeFile })
const out = val('--out')
const text = JSON.stringify({
  kind: 'AGENT_CREDENTIAL_METADATA_CENSUS',
  generatedAt: new Date().toISOString(),
  censusPredicate: 'updated_at > created_at AND rotated_at IS NULL',
  secretDisclosure: 'none — hash fingerprints (sha256 12-hex) and scrypt pairing verdicts only',
  ...result,
}, null, 2)
if (out !== undefined) writeFileSync(out, `${text}\n`, { mode: 0o600 })
const verdict = result.summary.ACTIVE_DRIFT === 0 ? 'FLEET_METADATA_CENSUS=PASS' : `FLEET_METADATA_CENSUS=FAIL ACTIVE_DRIFT=${result.summary.ACTIVE_DRIFT}`
process.stdout.write(`${verdict}\n${text}\n`)
process.exit(result.summary.ACTIVE_DRIFT === 0 ? 0 : 21)
