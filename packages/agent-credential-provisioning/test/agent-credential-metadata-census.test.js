/**
 * STEP 7 census tests — V2 (Owner directive 2026-09-09: shrink to the ACCEPTED
 * Amendment 7 authority).
 *
 * The production census answers ONE question with PG-computed metadata:
 *   Does any production MachineClient satisfy
 *     updated_at > created_at AND rotated_at IS NULL ?
 * It reads NO secret_hash column, NO credential store, and does NO secret
 * verification. Historical allowlists are annotation only and can never pass
 * a predicate hit; hits require RECEIPT_RECONCILIATION using receipt metadata
 * only (client identity, operation identity, rotation timestamp, existence).
 *
 * Frozen tests (directive ⑨):
 *   T1 zero predicate rows            → PASS / exit 0
 *   T2 one predicate hit              → NOT PASS (exit 21 RECEIPT_RECONCILIATION_REQUIRED)
 *   T3 DB/query failure               → INCOMPLETE / exit 22
 *   T4 exact 1ms updated_at delta
 *      + rotated_at NULL              → hit
 *   T5 credential store unreadable/
 *      absent                         → production census outcome UNCHANGED
 *   T6 secret_hash SELECT absent from generated SQL (+ receipt SQL carries no
 *      fingerprint/secret columns; production path does not read the store)
 *   T7 child argv contains no DATABASE_URL/password (no --database-url flag exists)
 *   T8 psql argv contains no password
 *   T9 real PG census                 → DB_MUTATION_COUNT=ZERO
 *
 * REAL_POSTGRES_READ_ONLY_SMOKE is TEST_ROTATION_DATABASE_URL-gated (isolated
 * database ONLY; zero DB mutation, proven by row counts + content MD5).
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import {
  buildCensusSql,
  buildReceiptSql,
  censusFromRows,
  censusGate,
  connectionArgsFor,
  normalizeSqlFragment,
  selftest,
} from '../../../scripts/agent-credential-metadata-census.mjs'

const scriptPath = new URL('../../../scripts/agent-credential-metadata-census.mjs', import.meta.url).pathname
const databaseUrl = process.env.TEST_ROTATION_DATABASE_URL
const psqlPath = process.env.TEST_ROTATION_PSQL ?? 'psql'

const KNOWN_CLIENT = 'mc_IbXwCGnMH10uc9630c1xojFE' // annotation-only allowlist in the script

test('CENSUS_SELFTEST: offline selftest passes', () => {
  selftest()
})

// ─── T6 static authority assertions ─────────────────────────────────────────

test('T6 census SQL: PG predicate verbatim, ZERO secret_hash projection', () => {
  const sql = buildCensusSql()
  assert.ok(sql.includes('(c.updated_at > c.created_at AND c.rotated_at IS NULL) AS drift_predicate'))
  assert.ok(!sql.includes('secret_hash'), 'production census SQL must not read the secret_hash column')
  assert.ok(!/insert\s+into|update\s+machine_|delete\s+from/i.test(sql), 'census SQL is SELECT-only')
})

test('T6 receipt SQL: identity/operation/timestamp only — no fingerprint, no secret columns', () => {
  const sql = buildReceiptSql()
  assert.ok(sql.includes('operation_id'))
  assert.ok(sql.includes('rotated_at'))
  assert.ok(sql.includes('client_id'))
  assert.ok(!/fingerprint|secret|hash/i.test(sql), 'receipt projection is metadata-only')
})

test('T5/T6 static: production path DOES NOT READ the credential secret store', () => {
  const src = readFileSync(scriptPath, 'utf8')
  const code = src.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n')
  // Functional-usage patterns (call identifiers and flags), not bare words:
  // the script's own anti-authorization guard may MENTION banned material in
  // assembled string literals, but no code may CALL secret verification, read
  // the store, or accept a DSN/store flag.
  for (const pattern of [/\bscryptSync\s*\(/, /\bscryptVerify\b/, /\bverifyCredential\b/, /\bfingerprint\w*\s*\(/, /agent-credentials\.json/, /'--store'/, /'--database-url'/, /\bclientSecret\b/]) {
    assert.ok(!pattern.test(code), `census code must not match ${pattern}`)
  }
  // The ONLY filesystem interaction is the --out report write (writeFileSync);
  // no readFileSync of any store may exist.
  assert.ok(!code.includes('readFileSync'), 'production census must not read any file')
})

// ─── offline row/pure tests ─────────────────────────────────────────────────

test('T4 EXACT-SUBSECOND: 1ms updated_at delta + rotated_at NULL is a hit (PG decides; JS consumes)', () => {
  const base = Date.now() - 86_400_000
  const iso = (ms) => new Date(ms).toISOString()
  const agents = censusFromRows(
    [{ agent_id: 'agt-x', client_id: 'mc_t4', status: 'active', created_at: iso(base), updated_at: iso(base + 1), rotated_at: '-', drift_predicate: true }],
    [],
  )
  assert.equal(agents[0].driftPredicate, true)
  assert.equal(agents[0].classification, 'SUSPECT_DRIFT')
})

test('④ allowlist is annotation only: known historical + hit ⇒ still SUSPECT_DRIFT, gate still not PASS', () => {
  const base = new Date(Date.now() - 86_400_000).toISOString()
  const agents = censusFromRows(
    [{ agent_id: 'agt-known', client_id: KNOWN_CLIENT, status: 'active', created_at: base, updated_at: base, rotated_at: '-', drift_predicate: true }],
    [],
  )
  assert.equal(agents[0].knownHistorical, true, 'WHY_THIS_ROW_EXISTS annotation present')
  assert.equal(agents[0].classification, 'SUSPECT_DRIFT', 'annotation never reclassifies')
  assert.equal(censusGate({ suspectDriftRows: 1, queryExecutionComplete: true }).verdict, 'RECEIPT_RECONCILIATION_REQUIRED')
})

test('⑤ receipt reconciliation is metadata-only and NEVER clears a hit', () => {
  const base = new Date(Date.now() - 86_400_000).toISOString()
  const agents = censusFromRows(
    [{ agent_id: 'agt-known', client_id: KNOWN_CLIENT, status: 'active', created_at: base, updated_at: base, rotated_at: '-', drift_predicate: true }],
    [{ operation_id: 'op-seam-1', machine_client_id: randomUUID(), client_id: KNOWN_CLIENT, rotated_at: base }],
  )
  assert.deepEqual(
    agents[0].receiptReconciliation,
    { receiptPresent: true, receiptCount: 1, latestReceiptRotatedAt: base, latestReceiptOperationId: 'op-seam-1' },
  )
  assert.equal(agents[0].classification, 'SUSPECT_DRIFT', 'receipt metadata explains, never clears')
  assert.equal(censusGate({ suspectDriftRows: 1, queryExecutionComplete: true }).verdict, 'RECEIPT_RECONCILIATION_REQUIRED')
})

test('fleet gate truth table', () => {
  assert.deepEqual(censusGate({ suspectDriftRows: 0, queryExecutionComplete: true }), { verdict: 'PASS' })
  assert.deepEqual(censusGate({ suspectDriftRows: 1, queryExecutionComplete: true }), { verdict: 'RECEIPT_RECONCILIATION_REQUIRED' })
  assert.deepEqual(censusGate({ suspectDriftRows: 0, queryExecutionComplete: false }), { verdict: 'INCOMPLETE' })
  assert.deepEqual(censusGate({ suspectDriftRows: 5, queryExecutionComplete: false }), { verdict: 'INCOMPLETE' })
})

test('MC1/T8 connection argv discipline (unit)', () => {
  const { argvUrl, env } = connectionArgsFor('postgresql://app_role:topsecret@127.0.0.1:5499/db')
  assert.ok(!argvUrl.includes('topsecret'), 'password must not leak into the psql argv DSN')
  assert.equal(env.PGPASSWORD, 'topsecret')
  assert.deepEqual(connectionArgsFor('postgresql://app_role@127.0.0.1:5499/db').env, {})
  assert.throws(() => connectionArgsFor('host=localhost user=app password=x'), /URL-form DSN/, 'non-URL DSN fails closed')
})

test('B4 semicolon contract', () => {
  assert.equal(normalizeSqlFragment('SELECT 1;'), 'SELECT 1')
  assert.equal(normalizeSqlFragment('SELECT 1'), 'SELECT 1')
})

// ─── CLI tests (T7 behavioral + real-PG T1/T2/T3/T5/T9) ─────────────────────

/** Spawn the census CLI with an ENV-ONLY DSN (T7: never argv). */
function runCli({ envDatabaseUrl, storePath, psql = psqlPath, extraArgs = [] }) {
  const env = { ...process.env, PATH: process.env.PATH }
  delete env.DATABASE_URL
  if (envDatabaseUrl !== undefined) env.DATABASE_URL = envDatabaseUrl
  const argv = [scriptPath, '--psql', psql, ...(storePath ? ['--store', storePath] : []), ...extraArgs]
  try {
    const stdout = execFileSync(process.execPath, argv, { encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'] })
    return { code: 0, stdout, stderr: '' }
  } catch (error) {
    return { code: error.status, stdout: String(error.stdout ?? ''), stderr: String(error.stderr ?? '') }
  }
}

test('T7: no --database-url flag exists — a DSN in argv is ignored, env required', () => {
  const run = runCli({ envDatabaseUrl: undefined, extraArgs: ['--database-url', 'postgresql://app:pw@127.0.0.1:1/db'] })
  assert.equal(run.code, 2, 'missing env DATABASE_URL must exit 2')
  const reported = run.stdout + run.stderr
  assert.ok(reported.includes('DATABASE_URL (environment) is required'), reported)
  assert.ok(!run.stdout.includes('postgresql://'), 'the DSN value must never be echoed')
})

test('T5: a garbage/unreadable credential store path is IRRELEVANT — production census outcome unchanged', { skip: databaseUrl === undefined }, () => {
  // With the real DB, run once passing a nonsense --store flag and once without it.
  const withGarbage = runCli({ envDatabaseUrl: databaseUrl, storePath: '/nonexistent/agent-credentials.json' })
  const without = runCli({ envDatabaseUrl: databaseUrl })
  assert.equal(withGarbage.code, without.code, 'store presence/absence must not change the census')
  assert.equal(withGarbage.stdout.split('\n')[0], without.stdout.split('\n')[0], 'verdict identical')
})

test('REAL_POSTGRES_READ_ONLY_SMOKE (T1/T2/T4/T9): real PG census — hits reconcile, zero mutation', { skip: databaseUrl === undefined }, async (t) => {
  const runPsql = (sql) => execFileSync(psqlPath, [databaseUrl, '-At', '-v', 'ON_ERROR_STOP=1'], { input: `${sql}\n`, encoding: 'utf8' })

  const agentId = 'agt-fixture-census-e2e'
  const knownAgentId = 'agt-fixture-census-known'
  const principalDbId = randomUUID()
  const clientDbId = randomUUID()
  const clientId = `mc_census_e2e_${Date.now().toString(36)}`
  const knownPrincipalDbId = randomUUID()
  const knownClientDbId = randomUUID()

  runPsql(`DELETE FROM machine_clients WHERE client_id LIKE 'mc_census_e2e_%'; DELETE FROM machine_clients WHERE client_id = '${KNOWN_CLIENT}'; DELETE FROM machine_principals WHERE agent_id IN ('${agentId}', '${knownAgentId}');`)

  // T4 fixture: EXACT 1ms delta, rotated_at NULL ⇒ predicate hit decided by PG.
  runPsql(`INSERT INTO machine_principals (id, principal_type, agent_id, status, created_at, updated_at) VALUES ('${principalDbId}', 'agent', '${agentId}', 'active', now(), now());`)
  runPsql(`INSERT INTO machine_clients (id, client_id, machine_principal_id, secret_hash, status, allowed_resources, allowed_scopes, created_at, updated_at)
        VALUES ('${clientDbId}', '${clientId}', '${principalDbId}', 'stub:not-read-by-census', 'active', '{}', '{}', now(), now() + interval '1 millisecond');`)

  // Annotation fixture: the KNOWN historical client with a predicate hit and a
  // canonical receipt (metadata-only reconciliation: presence/timestamp/op id).
  runPsql(`INSERT INTO machine_principals (id, principal_type, agent_id, status, created_at, updated_at) VALUES ('${knownPrincipalDbId}', 'agent', '${knownAgentId}', 'active', now(), now());`)
  runPsql(`INSERT INTO machine_clients (id, client_id, machine_principal_id, secret_hash, status, allowed_resources, allowed_scopes, created_at, updated_at)
        VALUES ('${knownClientDbId}', '${KNOWN_CLIENT}', '${knownPrincipalDbId}', 'stub:not-read-by-census', 'active', '{}', '{}', now(), now() + interval '1 millisecond');`)
  const receiptId = randomUUID()
  runPsql(`INSERT INTO machine_client_rotations (operation_id, machine_client_id, client_id, postimage_fingerprint, rotated_at)
        VALUES ('${receiptId}', '${knownClientDbId}', '${KNOWN_CLIENT}', 'stub-fingerprint-not-read-by-census', now());`)

  t.after(() => {
    try {
      runPsql(`DELETE FROM machine_client_rotations WHERE client_id = '${KNOWN_CLIENT}'; DELETE FROM machine_clients WHERE client_id LIKE 'mc_census_e2e_%'; DELETE FROM machine_clients WHERE client_id = '${KNOWN_CLIENT}'; DELETE FROM machine_principals WHERE agent_id IN ('${agentId}', '${knownAgentId}');`)
    } catch { /* best-effort */ }
  })

  // T2: two hits ⇒ NOT PASS ⇒ RECEIPT_RECONCILIATION_REQUIRED (exit 21).
  const runHit = runCli({ envDatabaseUrl: databaseUrl })
  assert.equal(runHit.code, 21, `expected exit 21, got ${runHit.code}\n${runHit.stdout}`)
  assert.ok(runHit.stdout.includes('FLEET_METADATA_CENSUS=RECEIPT_RECONCILIATION_REQUIRED'), runHit.stdout)
  assert.ok(runHit.stdout.includes('QUERY_EXECUTION_COMPLETE=YES'))
  assert.ok(runHit.stdout.includes('SUSPECT_DRIFT_ROWS=2'))
  const parsed = JSON.parse(runHit.stdout.slice(runHit.stdout.indexOf('{')))
  const subSecond = parsed.agents.find((a) => a.clientId === clientId)
  assert.equal(subSecond.driftPredicate, true)
  assert.equal(subSecond.classification, 'SUSPECT_DRIFT')
  const knownRow = parsed.agents.find((a) => a.clientId === KNOWN_CLIENT)
  assert.equal(knownRow.knownHistorical, true, 'annotation present')
  assert.equal(knownRow.classification, 'SUSPECT_DRIFT', '④ allowlist never reclassifies')
  assert.equal(knownRow.receiptReconciliation.receiptPresent, true, '⑤ receipt metadata reconciled')
  assert.equal(knownRow.receiptReconciliation.receiptCount, 1)
  assert.ok(!runHit.stdout.includes('stub-fingerprint'), 'receipt fingerprints are not read into the census output')
  assert.ok(!runHit.stdout.includes('not-read-by-census'), 'no hash material reaches the census output')

  // Teardown of the 1ms fixture BY THE TEST (never by the census): the
  // allowlisted hit ALONE must still block PASS (directive ④).
  runPsql(`DELETE FROM machine_clients WHERE client_id = '${clientId}'; DELETE FROM machine_principals WHERE id = '${principalDbId}';`)
  const runKnownOnly = runCli({ envDatabaseUrl: databaseUrl })
  assert.equal(runKnownOnly.code, 21, '④ a single allowlisted hit still requires reconciliation')
  assert.ok(runKnownOnly.stdout.includes('SUSPECT_DRIFT_ROWS=1'))

  // T1: zero predicate rows ⇒ PASS / exit 0.
  runPsql(`DELETE FROM machine_clients WHERE client_id = '${KNOWN_CLIENT}'; DELETE FROM machine_principals WHERE id = '${knownPrincipalDbId}';`)
  const runClean = runCli({ envDatabaseUrl: databaseUrl })
  assert.equal(runClean.code, 0, `expected PASS exit 0, got ${runClean.code}\n${runClean.stdout}`)
  assert.ok(runClean.stdout.includes('FLEET_METADATA_CENSUS=PASS'))
  assert.ok(runClean.stdout.includes('SUSPECT_DRIFT_ROWS=0'))

  // T9: DB_MUTATION_COUNT = ZERO — the census (unlike the test's fixtures)
  // must leave the tables byte-identical. Bracket one full census execution.
  const countsBefore = runPsql("SELECT (SELECT count(*) FROM machine_clients)||'|'||(SELECT count(*) FROM machine_client_rotations)||'|'||(SELECT count(*) FROM machine_principals);").trim()
  const contentBefore = runPsql(`SELECT md5(string_agg(t.x, ',' ORDER BY t.x)) FROM (SELECT client_id||':'||secret_hash||':'||coalesce(rotated_at::text,'-') AS x FROM machine_clients) t;`)
  const runMutationProbe = runCli({ envDatabaseUrl: databaseUrl })
  assert.equal(runMutationProbe.code, 0)
  const countsAfter = runPsql("SELECT (SELECT count(*) FROM machine_clients)||'|'||(SELECT count(*) FROM machine_client_rotations)||'|'||(SELECT count(*) FROM machine_principals);").trim()
  assert.equal(countsAfter, countsBefore, 'census must not mutate row counts')
  const contentAfter = runPsql(`SELECT md5(string_agg(t.x, ',' ORDER BY t.x)) FROM (SELECT client_id||':'||secret_hash||':'||coalesce(rotated_at::text,'-') AS x FROM machine_clients) t;`)
  assert.equal(contentAfter.trim(), contentBefore.trim(), 'census must not mutate machine_clients contents')
})

test('T3: DB/query failure ⇒ INCOMPLETE / exit 22 (fail-loud, never "no drift")', { skip: databaseUrl === undefined }, () => {
  // A DSN whose database does not exist: psql fails under ON_ERROR_STOP.
  const bogus = databaseUrl.replace(/\/[^/?]+(\?.*)?$/, '/census_no_such_db')
  const run = runCli({ envDatabaseUrl: bogus })
  assert.equal(run.code, 22, `expected INCOMPLETE exit 22, got ${run.code}`)
  assert.ok(run.stdout.includes('FLEET_METADATA_CENSUS=INCOMPLETE'), run.stdout)
  assert.ok(run.stdout.includes('QUERY_EXECUTION_COMPLETE=NO'))
})

test('T8: psql child argv contains no password (env-only PGPASSWORD)', { skip: databaseUrl === undefined }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'census-t8-'))
  // A stub "psql" (shell script, invoked EXACTLY as the census invokes psql)
  // that records its argv and the PGPASSWORD env, then fails so the census
  // exits INCOMPLETE — the assertion is about the ARGV, not results.
  const argvDump = join(dir, 'argv.txt')
  const envDump = join(dir, 'env.txt')
  const stub = join(dir, 'psql-stub.sh')
  writeFileSync(stub, `#!/bin/bash
printf '%s\\n' "$@" > ${JSON.stringify(argvDump)}
printf '%s' "\${PGPASSWORD-}" > ${JSON.stringify(envDump)}
exit 1
`, { mode: 0o755 })
  chmodSync(stub, 0o755)
  const dsnWithPassword = 'postgresql://probe:probe-pass@127.0.0.1:1/db'
  const run = runCli({ envDatabaseUrl: dsnWithPassword, psql: stub })
  assert.equal(run.code, 22)
  const argvText = readFileSync(argvDump, 'utf8')
  assert.ok(!argvText.includes('probe-pass'), `psql argv must not contain the password: ${argvText}`)
  assert.ok(argvText.includes('/db'), 'psql argv must still receive the passwordless DSN')
  assert.equal(readFileSync(envDump, 'utf8'), 'probe-pass', 'password must travel via PGPASSWORD env only')
})
