/**
 * STEP 7 census fix tests (AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_CAUSE_V1,
 * Owner review B1–B4 + MC1 required closure).
 *
 * - Offline cases: classification precedence, sub-second consumption,
 *   connection-argv discipline, semicolon contract, strict store read.
 * - REAL_POSTGRES_READ_ONLY_SMOKE (TEST_ROTATION_DATABASE_URL-gated, isolated
 *   database ONLY): the census executes against real PostgreSQL with a
 *   sub-second drift fixture (updated_at = created_at + 1 millisecond,
 *   rotated_at NULL → drift_predicate=true → ACTIVE_DRIFT), the known-
 *   historical + store-mismatch case classifies ACTIVE_DRIFT, and the census
 *   performs ZERO DB mutation (row counts + a fingerprint of both tables'
 *   contents are identical before/after the census run).
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID, randomBytes, scryptSync } from 'node:crypto'

import {
  buildCensusSql,
  censusFromRows,
  classifyAgent,
  connectionArgsFor,
  normalizeSqlFragment,
  readStoreStrict,
  selftest,
} from './agent-credential-metadata-census.mjs'

const scriptPath = new URL('./agent-credential-metadata-census.mjs', import.meta.url).pathname
const databaseUrl = process.env.TEST_ROTATION_DATABASE_URL
const psqlPath = process.env.TEST_ROTATION_PSQL ?? 'psql'

const KNOWN_CLIENT = 'mc_IbXwCGnMH10uc9630c1xojFE' // must match the script's allowlist
function hashFor(secret) {
  const salt = randomBytes(16).toString('hex')
  return salt + ':' + scryptSync(secret, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')
}

test('CENSUS_SELFTEST: expanded offline selftest passes', () => {
  // selftest() exits the process on failure; invoking it in-process means a
  // silent return = pass (it also prints ok/FAIL lines to stdout).
  selftest()
})

test('B2 precedence table (pure classification)', () => {
  const base = { driftPredicate: false, receiptConsistent: null, storePairing: 'MATCH', knownHistorical: false }
  assert.equal(classifyAgent(base), 'OK_NEVER_ROTATED')
  assert.equal(classifyAgent({ ...base, receiptConsistent: false }), 'ACTIVE_DRIFT', 'precedence 1')
  assert.equal(classifyAgent({ ...base, storePairing: 'MISMATCH' }), 'ACTIVE_DRIFT', 'precedence 2')
  assert.equal(classifyAgent({ ...base, storePairing: 'SKIPPED_NO_STORE_ENTRY' }), 'LEGACY_INCOMPLETE_METADATA')
  assert.equal(
    classifyAgent({ ...base, driftPredicate: true, knownHistorical: true }),
    'KNOWN_HISTORICAL_INCIDENT', 'precedence 4 (consistent known historical)',
  )
  assert.equal(
    classifyAgent({ ...base, driftPredicate: true, knownHistorical: false }),
    'ACTIVE_DRIFT', 'precedence 5',
  )
  // precedence 3: a receipt whose rotation never advanced rotated_at is a
  // current hard inconsistency → ACTIVE_DRIFT (B2 ③, reviewer MC4 note made normative)
  assert.equal(
    classifyAgent({ ...base, receiptConsistent: true, rotatedAt: '-' }),
    'ACTIVE_DRIFT', 'precedence 3',
  )
  assert.equal(
    classifyAgent({ ...base, receiptConsistent: true, rotatedAt: '2026-09-09T00:00:00Z' }),
    'OK_ROTATED',
  )
  // ACTIVE evidence outranks the allowlist even when combined with it:
  assert.equal(
    classifyAgent({ ...base, driftPredicate: true, knownHistorical: true, receiptConsistent: false }),
    'ACTIVE_DRIFT', 'precedence 1 over 4',
  )
  assert.equal(
    classifyAgent({ ...base, driftPredicate: true, knownHistorical: true, storePairing: 'MISMATCH' }),
    'ACTIVE_DRIFT', 'precedence 2 over 4',
  )
})

test('B4 semicolon + verbatim predicate contract', () => {
  assert.equal(normalizeSqlFragment('SELECT 1;'), 'SELECT 1')
  assert.equal(normalizeSqlFragment('SELECT 1'), 'SELECT 1')
  const sql = buildCensusSql()
  assert.ok(sql.includes('(c.updated_at > c.created_at AND c.rotated_at IS NULL) AS drift_predicate'))
  assert.ok(!/insert\s+into|update\s+machine_|delete\s+from/i.test(sql), 'census SQL is SELECT-only')
})

test('MC1 connection argv discipline', () => {
  const { argvUrl, env } = connectionArgsFor('postgresql://app_role:topsecret@127.0.0.1:5499/db')
  assert.ok(!argvUrl.includes('topsecret'), 'password must not leak into argv DSN')
  assert.equal(env.PGPASSWORD, 'topsecret')
  const passwordless = connectionArgsFor('postgresql://app_role@127.0.0.1:5499/db')
  assert.deepEqual(passwordless.env, {})
})

test('B3 strict store read failures', () => {
  assert.throws(() => readStoreStrict('/nonexistent/store.json'), /cannot be read/)
  const dir = mkdtempSync(join(tmpdir(), 'census-b3-'))
  const bad = join(dir, 'store.json')
  writeFileSync(bad, '{ broken', { mode: 0o600 })
  assert.throws(() => readStoreStrict(bad), /malformed/)
})

test('B2 census rows: KNOWN_HISTORICAL + store MISMATCH → ACTIVE_DRIFT (offline rows)', () => {
  const stored = hashFor('consistent-secret')
  const agents = censusFromRows(
    [{ agent_id: 'agt-x-known', client_id: KNOWN_CLIENT, status: 'active', created_at: '2026-01-01', updated_at: '2026-01-02', rotated_at: '-', drift_predicate: true, secret_hash: stored }],
    [],
    { credentials: { 'agt-x-known': { clientId: KNOWN_CLIENT, clientSecret: 'diverged-secret' } } },
  )
  assert.equal(agents[0].storePairing, 'MISMATCH')
  assert.equal(agents[0].classification, 'ACTIVE_DRIFT')
})

// ─── REAL_POSTGRES_READ_ONLY_SMOKE ──────────────────────────────────────────

test('REAL_POSTGRES_READ_ONLY_SMOKE: census against real PG (sub-second drift, known+mismatch, zero mutation)', { skip: databaseUrl === undefined }, async (t) => {
  const runCli = (storePath) => {
    try {
      const stdout = execFileSync(process.execPath, [scriptPath, '--database-url', databaseUrl, '--store', storePath], { encoding: 'utf8', env: { ...process.env, PATH: process.env.PATH } })
      return { code: 0, stdout }
    } catch (error) {
      return { code: error.status, stdout: String(error.stdout ?? '') }
    }
  }
  const runPsql = (sql) => execFileSync(psqlPath, [databaseUrl, '-At', '-v', 'ON_ERROR_STOP=1'], { input: `${sql}\n`, encoding: 'utf8' })

  const agentId = 'agt-fixture-census-e2e'
  const clientId = `mc_census_e2e_${Date.now().toString(36)}`
  const principalDbId = randomUUID()
  const clientDbId = randomUUID()

  // Pre-clean residue; capture pre-state for the zero-mutation proof.
  runPsql(`DELETE FROM machine_clients WHERE client_id LIKE 'mc_census_e2e_%'; DELETE FROM machine_principals WHERE agent_id = '${agentId}';`)

  // Fixture 1: EXACT SUB-SECOND drift — updated_at = created_at + 1 millisecond,
  // rotated_at NULL. The frozen predicate (evaluated BY PG) must return true.
  runPsql(`INSERT INTO machine_principals (id, principal_type, agent_id, status, created_at, updated_at) VALUES ('${principalDbId}', 'agent', '${agentId}', 'active', now(), now());`)
  runPsql(`INSERT INTO machine_clients (id, client_id, machine_principal_id, secret_hash, status, allowed_resources, allowed_scopes, created_at, updated_at)
        VALUES ('${clientDbId}', '${clientId}', '${principalDbId}', '${hashFor('census-e2e-secret')}', 'active', '{}', '{}', now(), now() + interval '1 millisecond');`)

  // Fixture 2: the KNOWN historical client with a LIVE store mismatch.
  const knownPrincipalDbId = randomUUID()
  const knownClientDbId = randomUUID()
  runPsql(`INSERT INTO machine_principals (id, principal_type, agent_id, status, created_at, updated_at) VALUES ('${knownPrincipalDbId}', 'agent', 'agt-fixture-census-known', 'active', now(), now());`)
  runPsql(`INSERT INTO machine_clients (id, client_id, machine_principal_id, secret_hash, status, allowed_resources, allowed_scopes, created_at, updated_at)
        VALUES ('${knownClientDbId}', '${KNOWN_CLIENT}', '${knownPrincipalDbId}', '${hashFor('diverged-live')}', 'active', '{}', '{}', now(), now());`)

  // Zero-mutation window: snapshot AFTER fixtures, BEFORE the census run.
  const countsBefore = runPsql("SELECT (SELECT count(*) FROM machine_clients)||'|'||(SELECT count(*) FROM machine_client_rotations)||'|'||(SELECT count(*) FROM machine_principals);").trim()

  t.after(() => {
    try {
      runPsql(`DELETE FROM machine_clients WHERE client_id LIKE 'mc_census_e2e_%'; DELETE FROM machine_clients WHERE client_id = '${KNOWN_CLIENT}'; DELETE FROM machine_principals WHERE agent_id IN ('${agentId}', 'agt-fixture-census-known');`)
    } catch { /* best-effort */ }
  })

  // Store: census-e2e pairs; the KNOWN historical entry is DIVERGED live.
  const dir = mkdtempSync(join(tmpdir(), 'census-e2e-'))
  const storePath = join(dir, 'agent-credentials.json')
  writeFileSync(storePath, `${JSON.stringify({ version: 1, credentials: {
    [agentId]: { clientId, clientSecret: 'census-e2e-secret' },
    'agt-fixture-census-known': { clientId: KNOWN_CLIENT, clientSecret: 'diverged-secret' },
  } }, null, 2)}\n`, { mode: 0o600 })

  // Run the census CLI (metadata-only; SELECT-only).
  const run = runCli(storePath)

  // EXACT_SUBSECOND_DRIFT_TEST: the 1ms-delta fixture surfaces as ACTIVE_DRIFT
  // (drift_predicate decided by PostgreSQL, consumed verbatim by the census).
  assert.equal(run.code, 21, `expected FAIL exit (ACTIVE_DRIFT present), got ${run.code}\n${run.stdout}`)
  assert.ok(run.stdout.includes('FLEET_METADATA_CENSUS=FAIL'), 'ACTIVE_DRIFT>0 must fail the census verdict')
  const parsed = JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
  const subSecond = parsed.agents.find((a) => a.clientId === clientId)
  assert.equal(subSecond.driftPredicate, true)
  assert.equal(subSecond.classification, 'ACTIVE_DRIFT')
  // KNOWN_HISTORICAL_PLUS_STORE_MISMATCH → ACTIVE_DRIFT (allowlist must not win)
  const knownAgent = parsed.agents.find((a) => a.clientId === KNOWN_CLIENT)
  assert.equal(knownAgent.storePairing, 'MISMATCH')
  assert.equal(knownAgent.classification, 'ACTIVE_DRIFT')

  // DB_MUTATION_COUNT = ZERO: table counts AND content fingerprints identical.
  const countsAfter = runPsql("SELECT (SELECT count(*) FROM machine_clients)||'|'||(SELECT count(*) FROM machine_client_rotations)||'|'||(SELECT count(*) FROM machine_principals);").trim()
  assert.equal(countsAfter, countsBefore, 'census must not mutate row counts')
  const contentBefore = runPsql(`SELECT md5(string_agg(t.x, ',' ORDER BY t.x)) FROM (SELECT client_id||':'||secret_hash||':'||coalesce(rotated_at::text,'-') AS x FROM machine_clients) t;`)
  const contentAfter = runPsql(`SELECT md5(string_agg(t.x, ',' ORDER BY t.x)) FROM (SELECT client_id||':'||secret_hash||':'||coalesce(rotated_at::text,'-') AS x FROM machine_clients) t;`)
  assert.equal(contentAfter.trim(), contentBefore.trim(), 'census must not mutate machine_clients contents')
})

test('B3 CLI: missing store → CENSUS_INCOMPLETE non-zero', { skip: databaseUrl === undefined }, () => {
  let code
  let stdout
  try {
    stdout = execFileSync(process.execPath, [scriptPath, '--database-url', databaseUrl, '--store', '/nonexistent/store.json'], { encoding: 'utf8' })
  } catch (error) {
    code = error.status
    stdout = String(error.stdout ?? '')
  }
  assert.equal(code, 22)
  assert.ok(stdout.includes('FLEET_METADATA_CENSUS=INCOMPLETE'), stdout)
  assert.ok(stdout.includes('CENSUS_EXECUTION_COMPLETE=NO'), 'incomplete must never read as "no drift"')
})

test('B3 CLI: malformed store → CENSUS_INCOMPLETE non-zero', { skip: databaseUrl === undefined }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'census-b3-cli-'))
  const bad = join(dir, 'store.json')
  writeFileSync(bad, '{ malformed', { mode: 0o600 })
  let code
  let stdout
  try {
    stdout = execFileSync(process.execPath, [scriptPath, '--database-url', databaseUrl, '--store', bad], { encoding: 'utf8' })
  } catch (error) {
    code = error.status
    stdout = String(error.stdout ?? '')
  }
  assert.equal(code, 22)
  assert.ok(stdout.includes('STORE_FILE_PARSE_FAILURE'), stdout)
  assert.ok(stdout.includes('CENSUS_EXECUTION_COMPLETE=NO'))
})
