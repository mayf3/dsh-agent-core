#!/usr/bin/env node
/**
 * agent-credential-metadata-census — fleet credential metadata census
 * (AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_CAUSE_V1 STEP 7; governing spec
 * AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 Amendment 7 + census predicate
 * frozen in the Amendment 7 summary §6).
 *
 * THE accepted STEP 7 production question (Owner directive 2026-09-09, B1):
 *   Does any production MachineClient satisfy
 *     updated_at > created_at AND rotated_at IS NULL ?
 * The predicate is computed BY POSTGRESQL — JS consumes it verbatim.
 *
 * AUTHORITY SCOPE (Amendment 7, frozen): the production census is bounded,
 * read-only, and METADATA-ONLY.
 *   NO secret bytes. NO secret_hash column values. NO credential-store reads
 *   (clientSecret / scrypt pairing / fingerprints of secret material are NOT
 *   census inputs and the production path contains no code to read them).
 * A historical allowlist is ANNOTATION ONLY (WHY_THIS_ROW_EXISTS) — it can
 * never change the fleet gate outcome, because this census has no authority
 * to compare credential bytes.
 *
 * Outcomes:
 *   QUERY_EXECUTION_COMPLETE = YES|NO      (whole-query failure ⇒ NO, loud)
 *   SUSPECT_DRIFT_ROWS       = N           (rows where the PG predicate = true)
 *   FLEET_METADATA_CENSUS    = PASS                        (complete ∧ 0 hits)
 *                            | RECEIPT_RECONCILIATION_REQUIRED (hits > 0)
 *                            | INCOMPLETE                  (execution failed)
 * A predicate hit is NEVER allowlisted to PASS. Hits are reconciled against
 * the canonical rotation RECEIPT ledger using metadata fields only (client
 * identity, operation identity, rotation timestamp, receipt existence — I.3
 * accepts fingerprints as receipt metadata, and this census reads even less);
 * if authorized metadata cannot clear a hit, the census stays
 * RECEIPT_RECONCILIATION_REQUIRED — never a guessed PASS (no authority
 * expansion).
 *
 * DSN discipline: the production CLI accepts DATABASE_URL from the
 * environment ONLY — there is no --database-url flag, so a DSN can never
 * enter Node argv. The psql child receives the passwordless DSN as argv and
 * the password via the PGPASSWORD environment (DB_PASSWORD_IN_NODE_ARGV=NO,
 * DB_PASSWORD_IN_PSQL_ARGV=NO, DATABASE_URL_PRINTED=NO).
 *
 * Usage (the ONE bounded Owner native read-only gate):
 *   sudo -u authsvc /bin/bash -c '
 *     set -euo pipefail
 *     ENV_FILE=/Users/yanfenma/workspace/project/auth-service/.env
 *     test -r "$ENV_FILE"
 *     DATABASE_URL="$(grep -m1 "^DATABASE_URL=" "$ENV_FILE" | cut -d= -f2-)"
 *     test -n "$DATABASE_URL"
 *     export DATABASE_URL
 *     exec /usr/local/bin/node \
 *       /Users/yanfenma/workspace/project/dsh-agent-core/scripts/agent-credential-metadata-census.mjs \
 *       --out /tmp/cred-census.json \
 *       --psql /opt/homebrew/bin/psql
 *   '
 *   node scripts/agent-credential-metadata-census.mjs --selftest   (offline, no DB)
 */

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// ─── exported pure core (unit-tested in the provisioning package tests) ─────

/** B4: psqlRows() contract — SQL fragment; ONE optional trailing semicolon
 *  is stripped mechanically so callers cannot break the wrapper. */
export function normalizeSqlFragment(sql) {
  const trimmed = String(sql).trim()
  return trimmed.endsWith(';') ? trimmed.slice(0, -1) : trimmed
}

/** MC1: split a postgres DSN into { argvUrl, env } so the database password
 *  NEVER lands in child argv (process-list exposure). Non-URL DSNs fail
 *  closed: a keyword=value DSN could embed a password this function cannot
 *  strip from argv. */
export function connectionArgsFor(databaseUrl) {
  let url
  try {
    url = new URL(databaseUrl)
  } catch {
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

/** The census query — the predicate is authoritative FROM POSTGRESQL, and the
 *  projection is METADATA-ONLY: no secret_hash column, no secret material. */
export function buildCensusSql() {
  return normalizeSqlFragment(`
    SELECT p.agent_id AS agent_id, c.client_id AS client_id, c.status AS status,
           c.created_at AS created_at, c.updated_at AS updated_at,
           coalesce(c.rotated_at::text,'-') AS rotated_at,
           (c.updated_at > c.created_at AND c.rotated_at IS NULL) AS drift_predicate
      FROM machine_clients c JOIN machine_principals p ON p.id = c.machine_principal_id
     WHERE p.principal_type = 'agent'
     ORDER BY p.agent_id`)
}

/** Receipt-ledger reconciliation query — METADATA ONLY per I.3/I.4: client
 *  identity, operation identity, rotation timestamp. No fingerprints, no
 *  secret material (I.3 accepts fingerprints as receipt metadata; this census
 *  reads even less). */
export function buildReceiptSql() {
  return normalizeSqlFragment(`
    SELECT operation_id AS operation_id, machine_client_id AS machine_client_id,
           client_id AS client_id, rotated_at AS rotated_at
      FROM machine_client_rotations ORDER BY rotated_at`)
}

/** Historical-incident annotation set (WHY_THIS_ROW_EXISTS only — the 09-07/08
 *  incident client, root-caused and repaired outside this census; see
 *  docs/investigations/AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_CAUSE_V1.md).
 *  ANNOTATION ONLY: it can never change the fleet gate outcome (directive ④),
 *  because proving CURRENT credential bytes consistent is outside this
 *  census's authority. */
const KNOWN_HISTORICAL_CLIENT_IDS = new Set([
  'mc_IbXwCGnMH10uc9630c1xojFE',
])

/** Pure census over already-fetched rows (unit-testable offline).
 *  Per hit row, reconciliation metadata from the receipt ledger is attached:
 *  receipt existence/count, latest rotation timestamp, latest operation id.
 *  A receipt NEVER clears a hit — it only explains it. */
export function censusFromRows(agentRows, receiptRows) {
  const receiptsByClient = new Map()
  for (const r of receiptRows) {
    const list = receiptsByClient.get(r.client_id) ?? []
    list.push(r)
    receiptsByClient.set(r.client_id, list)
  }
  const agents = agentRows.map((row) => {
    const hit = row.drift_predicate === true
    const entry = {
      agentId: row.agent_id,
      clientId: row.client_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      rotatedAt: row.rotated_at,
      driftPredicate: hit,
      classification: hit ? 'SUSPECT_DRIFT' : 'OK_METADATA',
    }
    if (hit) {
      const known = KNOWN_HISTORICAL_CLIENT_IDS.has(row.client_id)
      const receipts = receiptsByClient.get(row.client_id) ?? []
      const latest = receipts[receipts.length - 1]
      // WHY_THIS_ROW_EXISTS metadata only — never a gate input.
      entry.knownHistorical = known
      entry.receiptReconciliation = {
        receiptPresent: receipts.length > 0,
        receiptCount: receipts.length,
        latestReceiptRotatedAt: latest?.rotated_at ?? null,
        latestReceiptOperationId: latest?.operation_id ?? null,
      }
    }
    return entry
  })
  return agents
}

/** Fleet gate (directive ③④): PASS iff query execution complete AND zero
 *  predicate hits. Hits ⇒ RECEIPT_RECONCILIATION_REQUIRED (the allowlist and
 *  receipt metadata annotate, never clear). Execution failure ⇒ INCOMPLETE. */
export function censusGate({ suspectDriftRows, queryExecutionComplete }) {
  if (queryExecutionComplete !== true) return { verdict: 'INCOMPLETE' }
  if (suspectDriftRows > 0) return { verdict: 'RECEIPT_RECONCILIATION_REQUIRED' }
  return { verdict: 'PASS' }
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

function runCensus({ databaseUrl, psqlPath }) {
  const connection = connectionArgsFor(databaseUrl)
  const agentRows = psqlRows(connection, buildCensusSql(), psqlPath)
  const receiptRows = psqlRows(connection, buildReceiptSql(), psqlPath)
  const agents = censusFromRows(agentRows, receiptRows)
  const suspectDriftRows = agents.filter((a) => a.classification === 'SUSPECT_DRIFT').length
  const summary = {
    total: agents.length,
    SUSPECT_DRIFT_ROWS: suspectDriftRows,
    // Reads that throw never reach here — they exit INCOMPLETE below.
    QUERY_EXECUTION_COMPLETE: true,
    receiptLedgerRows: receiptRows.length,
  }
  return { summary, agents }
}

// ─── selftest (offline, no DB, no credentials anywhere) ─────────────────────

export function selftest() {
  const checks = []
  const check = (name, fn) => checks.push([name, fn])
  const iso = (ms) => new Date(ms).toISOString()
  const base = Date.now() - 86_400_000
  const mkRow = (clientId, created, updated, rotatedAt, driftPredicate) => ({
    agent_id: `agt-x-${clientId}`, client_id: clientId, status: 'active',
    created_at: iso(created), updated_at: iso(updated), rotated_at: rotatedAt,
    drift_predicate: driftPredicate,
  })
  const known = 'mc_IbXwCGnMH10uc9630c1xojFE'

  check('T4 EXACT-SUBSECOND: drift_predicate=true (1ms delta, PG-decided) is a hit', () => {
    const agents = censusFromRows([mkRow('mc_ss', base, base + 1, '-', true)], [])
    if (new Date(agents[0].updatedAt) - new Date(agents[0].createdAt) !== 1) throw new Error('fixture must be sub-second')
    if (agents[0].classification !== 'SUSPECT_DRIFT') throw new Error(agents[0].classification)
  })
  check('T6 census SQL: frozen predicate verbatim; secret projection absent', () => {
    const sql = buildCensusSql()
    if (!sql.includes('(c.updated_at > c.created_at AND c.rotated_at IS NULL) AS drift_predicate')) {
      throw new Error('authoritative PG predicate missing')
    }
    const bannedProjection = new RegExp(['secret' + '_hash', 'client' + 'secret', 'scrypt'].join('|'), 'i')
    if (bannedProjection.test(sql)) throw new Error('secret material projection in census SQL')
    if (!/1000|tolerance/i.test(sql) === false) throw new Error('JS-side drift derivation detected')
  })
  check('receipt SQL is metadata-only (no fingerprint, no secret columns)', () => {
    const sql = buildReceiptSql()
    if (!sql.includes('operation_id') || !sql.includes('rotated_at')) throw new Error('receipt identity/timestamp missing')
    if (/fingerprint|secret/i.test(sql)) throw new Error('over-authority receipt projection')
  })
  check('④ predicate hit + historical allowlist annotation NEVER passes the gate', () => {
    const agents = censusFromRows([mkRow(known, base, base + 60_000, '-', true)], [])
    if (agents[0].knownHistorical !== true) throw new Error('annotation missing')
    if (agents[0].classification !== 'SUSPECT_DRIFT') throw new Error(agents[0].classification)
    if (censusGate({ suspectDriftRows: 1, queryExecutionComplete: true }).verdict !== 'RECEIPT_RECONCILIATION_REQUIRED') {
      throw new Error('allowlist changed the gate outcome')
    }
  })
  check('⑤ reconciliation metadata: receipt presence explains, never clears', () => {
    const agents = censusFromRows(
      [mkRow(known, base, base + 60_000, '-', true)],
      [{ operation_id: 'op-1', machine_client_id: 'uuid-1', client_id: known, rotated_at: iso(base + 30_000) }],
    )
    const r = agents[0].receiptReconciliation
    if (!r.receiptPresent || r.receiptCount !== 1 || r.latestReceiptOperationId !== 'op-1') throw new Error(JSON.stringify(r))
    if (agents[0].classification !== 'SUSPECT_DRIFT') throw new Error('a receipt cleared a metadata hit — authority violation')
    if (censusGate({ suspectDriftRows: 1, queryExecutionComplete: true }).verdict !== 'RECEIPT_RECONCILIATION_REQUIRED') throw new Error('gate cleared by receipt')
  })
  check('fleet gate truth table (PASS iff complete AND zero hits)', () => {
    const g = (hits, complete) => censusGate({ suspectDriftRows: hits, queryExecutionComplete: complete })
    if (g(0, true).verdict !== 'PASS') throw new Error('clean census must PASS')
    if (g(1, true).verdict !== 'RECEIPT_RECONCILIATION_REQUIRED') throw new Error('hit must require reconciliation')
    if (g(0, false).verdict !== 'INCOMPLETE') throw new Error('failed execution must be INCOMPLETE')
    if (g(3, false).verdict !== 'INCOMPLETE') throw new Error('failed execution is INCOMPLETE regardless of hits')
  })
  check('argv discipline: password → PGPASSWORD env, argv DSN passwordless', () => {
    const dsn = 'postgresql://app_role:s3cret-pass@127.0.0.1:5499/agentcred_test'
    const { argvUrl, env, passwordInArgv } = connectionArgsFor(dsn)
    if (passwordInArgv !== false) throw new Error('discipline flag')
    if (argvUrl.includes('s3cret-pass')) throw new Error('password leaked into argv DSN')
    if (env.PGPASSWORD !== 's3cret-pass') throw new Error('password must travel via PGPASSWORD env')
    if (!argvUrl.includes('app_role@127.0.0.1:5499/agentcred_test')) throw new Error('DSN lost host/db')
  })
  check('semicolon contract', () => {
    if (normalizeSqlFragment('SELECT 1;') !== 'SELECT 1') throw new Error('trailing ; not stripped')
    if (normalizeSqlFragment('SELECT 1') !== 'SELECT 1') throw new Error('bare fragment altered')
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
    return realpathSync(nodeUrl.fileURLToPath(import.meta.url)) === realpathSync(invoked)
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

  // P3/⑥: DATABASE_URL from the ENVIRONMENT ONLY — no --database-url flag
  // exists, so a DSN can never enter Node argv.
  const databaseUrl = process.env.DATABASE_URL
  if (typeof databaseUrl !== 'string' || databaseUrl === '') {
    console.error('DATABASE_URL (environment) is required; --selftest runs offline')
    process.exit(2)
  }

  let result
  try {
    result = runCensus({ databaseUrl, psqlPath: val('--psql') ?? 'psql' })
  } catch (error) {
    process.stdout.write(`FLEET_METADATA_CENSUS=INCOMPLETE (${error?.code ?? 'CENSUS_FAILED'}: ${error.message})\n`)
    process.stdout.write('QUERY_EXECUTION_COMPLETE=NO\n')
    process.exit(22)
  }

  const gate = censusGate({
    suspectDriftRows: result.summary.SUSPECT_DRIFT_ROWS,
    queryExecutionComplete: result.summary.QUERY_EXECUTION_COMPLETE,
  })
  const text = JSON.stringify({
    kind: 'AGENT_CREDENTIAL_METADATA_CENSUS',
    generatedAt: new Date().toISOString(),
    censusPredicate: 'updated_at > created_at AND rotated_at IS NULL (evaluated by PostgreSQL)',
    secretDisclosure: 'none — the census reads no secret/hash columns and no credential store; receipt metadata only',
    ...result,
  }, null, 2)
  const out = val('--out')
  if (out !== undefined) writeFileSync(out, `${text}\n`, { mode: 0o600 })
  const verdict = gate.verdict === 'PASS'
    ? 'FLEET_METADATA_CENSUS=PASS'
    : gate.verdict === 'RECEIPT_RECONCILIATION_REQUIRED'
      ? `FLEET_METADATA_CENSUS=RECEIPT_RECONCILIATION_REQUIRED SUSPECT_DRIFT_ROWS=${result.summary.SUSPECT_DRIFT_ROWS}`
      : 'FLEET_METADATA_CENSUS=INCOMPLETE'
  process.stdout.write(`${verdict}\nQUERY_EXECUTION_COMPLETE=${result.summary.QUERY_EXECUTION_COMPLETE ? 'YES' : 'NO'}\nSUSPECT_DRIFT_ROWS=${result.summary.SUSPECT_DRIFT_ROWS}\n${text}\n`)
  process.exit(gate.verdict === 'PASS' ? 0 : gate.verdict === 'RECEIPT_RECONCILIATION_REQUIRED' ? 21 : 22)
}

// lazy builtins for the selftest body
import nodeFs from 'node:fs'
import nodePath from 'node:path'
import nodeUrl from 'node:url'
