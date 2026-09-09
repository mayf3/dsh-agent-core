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
 * STEP 7 fix (Owner review B1–B4 + MC1):
 *   B1  The drift predicate is computed BY POSTGRESQL as an authoritative
 *       boolean — `(c.updated_at > c.created_at AND c.rotated_at IS NULL) AS
 *       drift_predicate` — and JS only consumes it. No millisecond tolerance,
 *       no JS timestamp re-derivation (PG microsecond precision is preserved;
 *       a sub-second drift is detected).
 *   B2  Classification precedence: ACTIVE evidence (receipt mismatch, store
 *       mismatch) always outranks the historical allowlist. The allowlist can
 *       only classify a KNOWN client whose CURRENT state is fully consistent
 *       (a repaired historical anomaly) — never over live inconsistency.
 *   B3  Whole-store read/parse failure ⇒ CENSUS_INCOMPLETE, non-zero exit —
 *       never a silent "no drift". (An individual agent missing a store entry
 *       stays SKIPPED_NO_STORE_ENTRY / LEGACY_INCOMPLETE_METADATA.)
 *   B4  psqlRows() takes a SQL fragment whose ONE optional trailing semicolon
 *       is stripped mechanically; a real-PostgreSQL read-only smoke lives in
 *       scripts/agent-credential-metadata-census.test.mjs
 *       (TEST_ROTATION_DATABASE_URL-gated, zero DB mutation).
 *   MC1 The database password never enters psql argv: the DSN is parsed and
 *       credentials travel via the PGPASSWORD environment of the child, while
 *       -d receives the passwordless DSN. Selftest asserts the discipline.
 *
 * Usage (the ONE bounded Owner native read-only gate):
 *   sudo -u authsvc node scripts/agent-credential-metadata-census.mjs \
 *     --database-url "$DATABASE_URL" \
 *     --store /usr/local/libexec/agent-core/config/agent-credentials.json \
 *     [--out /tmp/census.json]
 *   node scripts/agent-credential-metadata-census.mjs --selftest   (offline, no DB)
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash, scryptSync, timingSafeEqual } from 'node:crypto'
import { fileURLToPath } from 'node:url'

// ─── exported pure core (unit-tested in .test.mjs) ─────────────────────────

/** B4: psqlRows() contract — SQL fragment; ONE optional trailing semicolon
 *  is stripped mechanically so callers cannot break the wrapper. */
export function normalizeSqlFragment(sql) {
  const trimmed = String(sql).trim()
  return trimmed.endsWith(';') ? trimmed.slice(0, -1) : trimmed
}

/** MC1: split a postgres DSN into { argvUrl, env } so the database password
 *  NEVER lands in child argv (process-list exposure). Selftest asserts it. */
export function connectionArgsFor(databaseUrl) {
  let url
  try {
    url = new URL(databaseUrl)
  } catch {
    // Fail closed: a non-URL DSN (e.g. keyword=value form) could embed a
    // password that this function cannot strip from argv.
    throw new Error('census: DATABASE_URL must be a URL-form DSN (postgres://user:pass@host/db) so the password can be kept out of psql argv')
  }
  const password = url.password ? decodeURIComponent(url.password) : ''
  if (password === '') return { argvUrl: databaseUrl, env: {}, passwordInArgv: false }
  const clean = new URL(databaseUrl)
  clean.password = ''
  clean.username = decodeURIComponent(url.username || '')
  return {
    argvUrl: clean.toString(),
    env: { PGPASSWORD: password },
    passwordInArgv: false,
  }
}

/** B2: frozen classification precedence. ACTIVE evidence first; the historical
 *  allowlist can only explain a currently-consistent, known, repaired anomaly. */
export function classifyAgent({ driftPredicate, receiptConsistent, rotatedAt, storePairing, knownHistorical }) {
  if (receiptConsistent === false) return 'ACTIVE_DRIFT'                    // precedence 1
  if (storePairing === 'MISMATCH') return 'ACTIVE_DRIFT'                    // precedence 2
  if (receiptConsistent === true && rotatedAt === '-') return 'ACTIVE_DRIFT' // precedence 3: receipt exists but rotated_at never advanced = current hard inconsistency
  if (driftPredicate === true) {
    return knownHistorical ? 'KNOWN_HISTORICAL_INCIDENT' : 'ACTIVE_DRIFT'   // precedence 4/5
  }
  if (storePairing === 'SKIPPED_NO_STORE_ENTRY') return 'LEGACY_INCOMPLETE_METADATA' // 6 (incomplete)
  if (receiptConsistent === true) return 'OK_ROTATED'
  return 'OK_NEVER_ROTATED'
}

/** B3: strict store read — whole-file failures must be loud. Throws
 *  { code: 'STORE_FILE_READ_FAILURE' | 'STORE_FILE_PARSE_FAILURE' }. */
export function readStoreStrict(storeFile) {
  let raw
  try {
    raw = readFileSync(storeFile, 'utf8')
  } catch (error) {
    throw Object.assign(new Error(`census: credential store cannot be read: ${error.message}`), {
      code: 'STORE_FILE_READ_FAILURE',
    })
  }
  try {
    const doc = JSON.parse(raw)
    if (doc === null || typeof doc !== 'object' || typeof doc.credentials !== 'object' || doc.credentials === null) {
      throw new Error('store JSON lacks a credentials object')
    }
    return doc
  } catch (error) {
    throw Object.assign(new Error(`census: credential store is malformed: ${error.message}`), {
      code: 'STORE_FILE_PARSE_FAILURE',
    })
  }
}

/** The census query — B1: drift_predicate is authoritative FROM POSTGRESQL
 *  (verbatim frozen predicate; no JS-side drift derivation exists). */
export function buildCensusSql() {
  return normalizeSqlFragment(`
    SELECT p.agent_id AS agent_id, c.client_id AS client_id, c.status AS status,
           c.created_at AS created_at, c.updated_at AS updated_at,
           coalesce(c.rotated_at::text,'-') AS rotated_at,
           (c.updated_at > c.created_at AND c.rotated_at IS NULL) AS drift_predicate,
           c.secret_hash AS secret_hash
      FROM machine_clients c JOIN machine_principals p ON p.id = c.machine_principal_id
     WHERE p.principal_type = 'agent'
     ORDER BY p.agent_id`)
}

const KNOWN_HISTORICAL_CLIENT_IDS = new Set([
  // 2026-09-07/08 incident client — drifted by the retired p4-final.sh, repaired
  // by the receipted bdcred-20260908.sh rotate (investigation: docs/investigations/
  // AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_CAUSE_V1.md). Per B2 this allowlist can
  // only classify a KNOWN client whose CURRENT state is fully consistent.
  'mc_IbXwCGnMH10uc9630c1xojFE',
])

/** Pure census over already-fetched rows (unit-testable offline). */
export function censusFromRows(agentRows, receiptRows, storeDoc) {
  const agents = []
  for (const row of agentRows) {
    const clientReceipts = receiptRows.filter((r) => r.client_id === row.client_id)
    let receiptConsistent = null // null = never canonically rotated
    if (clientReceipts.length > 0) {
      const latest = clientReceipts[clientReceipts.length - 1]
      receiptConsistent = fp(row.secret_hash) === String(latest.postimage_fingerprint).slice(0, 12)
    }
    const storeEntry = storeDoc.credentials?.[row.agent_id]
    let storePairing = 'SKIPPED_NO_STORE_ENTRY'
    if (storeEntry?.clientSecret !== undefined) {
      storePairing = scryptVerify(storeEntry.clientSecret, row.secret_hash) ? 'MATCH' : 'MISMATCH'
    }
    const classification = classifyAgent({
      driftPredicate: row.drift_predicate === true,
      receiptConsistent,
      rotatedAt: row.rotated_at,
      storePairing,
      knownHistorical: KNOWN_HISTORICAL_CLIENT_IDS.has(row.client_id),
    })
    agents.push({
      agentId: row.agent_id,
      clientId: row.client_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      rotatedAt: row.rotated_at,
      driftPredicate: row.drift_predicate === true,
      receiptConsistent,
      storePairing,
      hashFingerprint: fp(row.secret_hash),
      classification,
    })
  }
  return agents
}

const fp = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 12)

function scryptVerify(secret, stored) {
  const i = stored.indexOf(':')
  if (i <= 0) return false
  const calc = scryptSync(secret, stored.slice(0, i), 64, { N: 16384, r: 8, p: 1 })
  const storedKey = Buffer.from(stored.slice(i + 1), 'hex')
  return storedKey.length === calc.length && timingSafeEqual(calc, storedKey)
}

function psqlRows(connection, sqlFragment, psqlPath) {
  const { argvUrl, env } = connection
  const sql = `SELECT coalesce(row_to_json(r)::text,'null') FROM ( ${sqlFragment} ) r;`
  const childEnv = { ...process.env, ...env }
  const stdout = execFileSync(psqlPath, [argvUrl, '-At', '-v', 'ON_ERROR_STOP=1'], {
    input: `${sql}\n`,
    encoding: 'utf8',
    env: childEnv,
  })
  return stdout.split('\n').filter((l) => l !== '').map((l) => JSON.parse(l))
}

function runCensus({ databaseUrl, storeFile, psqlPath }) {
  const connection = connectionArgsFor(databaseUrl)
  const storeDoc = readStoreStrict(storeFile)
  const agentRows = psqlRows(connection, buildCensusSql(), psqlPath)
  const receiptRows = psqlRows(connection, normalizeSqlFragment(`
    SELECT operation_id AS operation_id, machine_client_id AS machine_client_id,
           client_id AS client_id, postimage_fingerprint AS postimage_fingerprint,
           rotated_at AS rotated_at
      FROM machine_client_rotations ORDER BY rotated_at`), psqlPath)
  const agents = censusFromRows(agentRows, receiptRows, storeDoc)
  const summary = {
    total: agents.length,
    ACTIVE_DRIFT: agents.filter((a) => a.classification === 'ACTIVE_DRIFT').length,
    KNOWN_HISTORICAL_INCIDENT: agents.filter((a) => a.classification === 'KNOWN_HISTORICAL_INCIDENT').length,
    LEGACY_INCOMPLETE_METADATA: agents.filter((a) => a.classification === 'LEGACY_INCOMPLETE_METADATA').length,
    OK_NEVER_ROTATED: agents.filter((a) => a.classification === 'OK_NEVER_ROTATED').length,
    OK_ROTATED: agents.filter((a) => a.classification === 'OK_ROTATED').length,
    receiptLedgerRows: receiptRows.length,
    censusExecutionComplete: true,
  }
  return { summary, agents }
}

// ─── selftest (offline, no DB) ──────────────────────────────────────────────

export function selftest() {
  const checks = []
  const check = (name, fn) => checks.push([name, fn])
  const iso = (ms) => new Date(ms).toISOString()
  const base = Date.now() - 86_400_000
  const mkRow = (clientId, created, updated, rotatedAt, driftPredicate, secretHash) => ({
    agent_id: `agt-x-${clientId}`, client_id: clientId, status: 'active',
    created_at: iso(created), updated_at: iso(updated), rotated_at: rotatedAt,
    drift_predicate: driftPredicate, secret_hash: secretHash ?? `${'a'.repeat(32)}:${'b'.repeat(128)}`,
  })
  const known = KNOWN_HISTORICAL_CLIENT_IDS.values().next().value
  const consistentStored = hashForSelftest('consistent-secret')

  // 1. B1 consumption + B2: healthy never-rotated WITH a pairing store entry
  check('B1/B2 healthy never-rotated → OK_NEVER_ROTATED', () => {
    const row = mkRow('mc_h', base, base, '-', false, consistentStored)
    const agents = censusFromRows([row], [], { credentials: { 'agt-x-mc_h': { clientId: 'mc_h', clientSecret: 'consistent-secret' } } })
    if (agents[0].storePairing !== 'MATCH') throw new Error(agents[0].storePairing)
    if (agents[0].classification !== 'OK_NEVER_ROTATED') throw new Error(agents[0].classification)
  })
  // 2. B1 EXACT-SUBSECOND: a PG-decided drift_predicate=true with a 1ms delta
  //    is consumed verbatim — the 1s-tolerance bug class cannot return.
  check('B1 EXACT-SUBSECOND: drift_predicate=true (1ms delta) → ACTIVE_DRIFT', () => {
    const row = mkRow('mc_ss', base, base + 1, '-', true) // 1ms delta, decided by PG
    if (new Date(row.updated_at) - new Date(row.created_at) !== 1) throw new Error('fixture must be sub-second')
    const agents = censusFromRows([row], [], { credentials: {} })
    if (agents[0].classification !== 'ACTIVE_DRIFT') throw new Error(agents[0].classification)
  })
  // 3. B2 precedence 1: receipt mismatch outranks everything → ACTIVE_DRIFT
  check('B2 receipt mismatch → ACTIVE_DRIFT', () => {
    const agents = censusFromRows(
      [mkRow('mc_r', base, base + 60_000, iso(base + 60_000), false)],
      [{ client_id: 'mc_r', postimage_fingerprint: 'deadbeefdead' }],
      { credentials: { 'agt-x-mc_r': { clientId: 'mc_r', clientSecret: 's' } } },
    )
    if (agents[0].classification !== 'ACTIVE_DRIFT') throw new Error(agents[0].classification)
  })
  // 4. B2 precedence 2 > 4: KNOWN historical client + live store MISMATCH → ACTIVE_DRIFT
  check('B2 KNOWN_HISTORICAL + store MISMATCH → ACTIVE_DRIFT', () => {
    const agents = censusFromRows(
      [mkRow(known, base, base + 60_000, '-', true)],
      [],
      { credentials: { [`agt-x-${known}`]: { clientId: known, clientSecret: 'diverged' } } },
    )
    if (agents[0].storePairing !== 'MISMATCH') throw new Error('fixture must pair-mismatch')
    if (agents[0].classification !== 'ACTIVE_DRIFT') throw new Error(agents[0].classification)
  })
  // 5. B2 precedence 4: KNOWN historical, currently consistent → KNOWN_HISTORICAL_INCIDENT
  check('B2 KNOWN_HISTORICAL + consistent → KNOWN_HISTORICAL_INCIDENT', () => {
    const consistentSecret = 'consistent-secret'
    const agents = censusFromRows(
      [mkRow(known, base, base + 60_000, '-', true, consistentStored)],
      [],
      { credentials: { [`agt-x-${known}`]: { clientId: known, clientSecret: consistentSecret } } },
    )
    if (agents[0].storePairing !== 'MATCH') throw new Error('fixture must pair-match')
    if (agents[0].hashFingerprint !== fp(consistentStored)) throw new Error('fixture hash mismatch')
    if (agents[0].classification !== 'KNOWN_HISTORICAL_INCIDENT') throw new Error(agents[0].classification)
  })
  // 6. B2 precedence 5: unknown client + drift → ACTIVE_DRIFT
  check('B2 unknown + drift → ACTIVE_DRIFT', () => {
    const agents = censusFromRows([mkRow('mc_u', base, base + 60_000, '-', true)], [], { credentials: {} })
    if (agents[0].classification !== 'ACTIVE_DRIFT') throw new Error(agents[0].classification)
  })
  // 7. B3: whole-store READ failure throws STORE_FILE_READ_FAILURE
  check('B3 store READ failure is loud', () => {
    let threw
    try {
      readStoreStrict('/nonexistent/agent-credentials.json')
    } catch (error) { threw = error }
    if (threw?.code !== 'STORE_FILE_READ_FAILURE') throw new Error(`expected READ failure, got ${threw?.code}`)
  })
  // 8. B3: malformed store throws STORE_FILE_PARSE_FAILURE
  check('B3 store PARSE failure is loud', () => {
    const { mkdtempSync, writeFileSync: wfs } = nodeFs
    const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'census-st-'))
    const bad = nodePath.join(dir, 'store.json')
    wfs(bad, '{ "version": 1, BROKEN', { mode: 0o600 })
    let threw
    try {
      readStoreStrict(bad)
    } catch (error) { threw = error }
    if (threw?.code !== 'STORE_FILE_PARSE_FAILURE') throw new Error(`expected PARSE failure, got ${threw?.code}`)
  })
  // 9. MC1: password never lands in psql argv
  check('MC1 argv discipline: password → PGPASSWORD env, argv DSN passwordless', () => {
    const dsn = 'postgresql://app_role:s3cret-pass@127.0.0.1:5499/agentcred_test'
    const { argvUrl, env, passwordInArgv } = connectionArgsFor(dsn)
    if (passwordInArgv !== false) throw new Error('discipline flag')
    if (argvUrl.includes('s3cret-pass')) throw new Error('password leaked into argv DSN')
    if (env.PGPASSWORD !== 's3cret-pass') throw new Error('password must travel via PGPASSWORD env')
    if (!argvUrl.includes('app_role@127.0.0.1:5499/agentcred_test')) throw new Error('DSN lost host/db')
  })
  // 10. B4: trailing semicolon contract
  check('B4 semicolon contract', () => {
    if (normalizeSqlFragment('SELECT 1;') !== 'SELECT 1') throw new Error('trailing ; not stripped')
    if (normalizeSqlFragment('SELECT 1') !== 'SELECT 1') throw new Error('bare fragment altered')
    if (normalizeSqlFragment('SELECT 1;;;') !== 'SELECT 1;;') throw new Error('must strip exactly ONE trailing semicolon')
  })
  // 11. B1: census SQL carries the spec predicate verbatim, pushed down to PG
  check('B1 census SQL carries the frozen predicate verbatim', () => {
    const sql = buildCensusSql()
    if (!sql.includes('(c.updated_at > c.created_at AND c.rotated_at IS NULL) AS drift_predicate')) {
      throw new Error('authoritative PG predicate missing')
    }
    if (/1000|tolerance/i.test(sql)) throw new Error('JS-side drift derivation detected')
  })

  let failed = 0
  for (const [name, fn] of checks) {
    try {
      fn()
      process.stdout.write(`ok   ${name}\n`)
    } catch (error) {
      failed += 1
      process.stdout.write(`FAIL ${name}: ${error.message}\n`)
    }
  }
  process.stdout.write(`selftest: ${checks.length - failed}/${checks.length} passed\n`)
  return failed === 0
}

// ─── CLI (guarded so the module stays unit-testable) ────────────────────────

function invokedAsMain() {
  if (process.argv[1] === undefined) return false
  try {
    const { realpathSync } = nodeFs
    const invoked = process.argv[1].startsWith('/') ? process.argv[1] : nodePath.resolve(process.cwd(), process.argv[1])
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(invoked)
  } catch {
    return false
  }
}

if (invokedAsMain()) {
  const args = process.argv.slice(2)
  const val = (n) => { const i = args.indexOf(n); return i === -1 ? undefined : args[i + 1] }

  if (args.includes('--selftest')) {
    process.exit(selftest() ? 0 : 1)
  }

  const databaseUrl = process.env.DATABASE_URL ?? val('--database-url')
  const storeFile = val('--store') ?? '/usr/local/libexec/agent-core/config/agent-credentials.json'
  if (typeof databaseUrl !== 'string' || databaseUrl === '') {
    console.error('DATABASE_URL (env or --database-url) is required; --selftest runs offline')
    process.exit(2)
  }

  let result
  try {
    result = runCensus({ databaseUrl, storeFile, psqlPath: val('--psql') ?? 'psql' })
  } catch (error) {
    // B3 + census-completeness: whole-store failures are CENSUS_INCOMPLETE —
    // never interpretable as "no drift".
    const code = error?.code ?? 'CENSUS_FAILED'
    process.stdout.write(`FLEET_METADATA_CENSUS=INCOMPLETE (${code}: ${error.message})\n`)
    process.stdout.write('CENSUS_EXECUTION_COMPLETE=NO\n')
    process.exit(22)
  }

  const text = JSON.stringify({
    kind: 'AGENT_CREDENTIAL_METADATA_CENSUS',
    generatedAt: new Date().toISOString(),
    censusPredicate: 'updated_at > created_at AND rotated_at IS NULL (evaluated by PostgreSQL)',
    secretDisclosure: 'none — hash fingerprints (sha256 12-hex) and scrypt pairing verdicts only',
    ...result,
  }, null, 2)
  const out = val('--out')
  if (out !== undefined) writeFileSync(out, `${text}\n`, { mode: 0o600 })
  const verdict = result.summary.ACTIVE_DRIFT === 0 ? 'FLEET_METADATA_CENSUS=PASS' : `FLEET_METADATA_CENSUS=FAIL ACTIVE_DRIFT=${result.summary.ACTIVE_DRIFT}`
  process.stdout.write(`${verdict}\nCENSUS_EXECUTION_COMPLETE=YES\n${text}\n`)
  process.exit(result.summary.ACTIVE_DRIFT === 0 ? 0 : 21)
}

function hashForSelftest(secret) {
  const salt = 'c'.repeat(32)
  return salt + ':' + scryptSync(secret, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')
}

// lazy builtins for the selftest body
import nodeOs from 'node:os'
import nodeFs from 'node:fs'
import nodePath from 'node:path'
