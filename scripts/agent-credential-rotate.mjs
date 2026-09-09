#!/usr/bin/env node
/**
 * agent-credential-rotate — the canonical operator ROTATION seam CLI
 * (AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 AMENDMENT_7, Part I.3/I.4;
 * the productized bdcred transaction).
 *
 * Subcommands:
 *   plan     GATE + freeze the rotation PLAN (preimage fingerprints +
 *            deterministic operation id); zero mutation, zero secret output.
 *   rotate   the full GATE → PLAN → GENERATE → APPLY → VERIFY → RECEIPT
 *            transaction. Without external prerequisite (e) (the auth-service
 *            privileged rotation channel), APPLY refuses LOUD before any
 *            mutation (`external_prerequisite_missing(e)`, refusal receipted,
 *            exit 20) — the fail-closed NOW behavior. With (e) wired (see
 *            packages/agent-credential-provisioning/src/rotation-seam.js),
 *            the same command executes the receipted rotation.
 *   gate     run the readback split-state gate only.
 *   receipts print the receipt ledger (fingerprints only — never secrets).
 *   selftest offline stub checks; MUST pass before handover.
 *
 * Secret-handling red line (Part H): secret bytes never appear in argv, env,
 * stdout/stderr, logs, or receipts. The tool prints fingerprints and ids
 * only. Note: unlike the standalone metadata census (which never touches the
 * hash column), the seam's GATE reads the DB secret_hash VALUE — it is the
 * mechanical single-generation proof input (scrypt linkage) and stays within
 * the receipted operator seam.
 */

import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'

import { createPsqlPrivilegedChannel } from '../packages/agent-credential-provisioning/src/privileged-channel-psql.js'
import {
  assertFixtureRotationTarget,
  evaluateSeamGate,
  executeRotation,
  generateMachineSecret,
  hashFingerprint,
  hashMachineSecret,
  RotationReceiptLedger,
  secretFingerprint,
} from '../packages/agent-credential-provisioning/src/rotation-seam.js'

const args = process.argv.slice(2)
const command = args[0]
const val = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}
const has = (name) => args.includes(name)

function die(message, code = 20) {
  process.stderr.write(`ABORT: ${message}\n`)
  process.exit(code)
}

function storeFromArgs() {
  const store = val('--store')
  if (store !== undefined) return resolve(store)
  const env = process.env.AGENT_CORE_CREDENTIALS_FILE
  if (typeof env === 'string' && env !== '') return resolve(env)
  return join(homedir(), '.agent-core', 'credentials.json')
}

function requireAgentId() {
  const agentId = val('--agent')
  if (typeof agentId !== 'string' || agentId === '') die('--agent <agt_*> is required')
  return agentId
}

async function readDbStateViaPsql({ dbUrl, clientId }) {
  // The seam's READ face: one row, values stay channel-owned where possible.
  // The hash column value is required for the scrypt single-generation gate.
  // The client id travels as a psql variable (:'client_id') fed via STDIN —
  // psql does NOT interpolate variables in -c strings, and $1 parameters do
  // not exist in simple queries (both verified against psql 16); stdin
  // interpolation safely quotes the literal (injection-safe).
  const { execFile } = await import('node:child_process')
  const sql = "SELECT client_id, secret_hash FROM machine_clients WHERE client_id = :'client_id';"
  const stdout = await new Promise((resolvePromise, rejectPromise) => {
    const child = execFile('psql', [dbUrl, '-At', '-F', '|', '-v', `client_id=${clientId}`], (error, stdout, stderr) => {
      if (error !== null) {
        rejectPromise(Object.assign(new Error(`psql read failed: ${String(stderr).slice(0, 160)}`), { code: 'db_read_failed' }))
        return
      }
      resolvePromise(stdout)
    })
    child.stdin.write(`${sql}\n`)
    child.stdin.end()
  })
  const line = stdout.trim().split('\n').find((l) => l !== '')
  if (line === undefined) {
    throw Object.assign(new Error('rotation-seam: target client not found in DB'), { code: 'target_not_resolved' })
  }
  const [resolvedClientId, secretHash] = line.split('|')
  return { clientId: resolvedClientId, secretHash }
}

async function cmdRotate() {
  const agentId = requireAgentId()
  const storeFile = storeFromArgs()
  const receiptsFile = val('--receipts') ?? `${storeFile}.rotation-receipts.jsonl`
  const clientId = val('--client-id')
  const dbUrl = val('--db-url')
  const operationId = val('--operation-id')
  const authServiceOrigin = val('--auth-origin')
  if (clientId === undefined) die('--client-id <mc_*> is required (exact target — no name resolution)')
  if (dbUrl === undefined) die('--db-url <postgres://...> is required for the seam read face')

  const mintToken = authServiceOrigin === undefined
    ? undefined
    : async ({ clientId: c, clientSecret }) => {
        // Part H red line: the credential NEVER leaves this process — the
        // Authorization header is constructed in memory and handed to the
        // in-process fetch (Node >= 18 global; undici ignores proxy env by
        // default, preserving the verified bdcred --noproxy semantics).
        const body = 'grant_type=client_credentials&resource=svc-workflow&scope=workflow.read'
        const auth = Buffer.from(`${c}:${clientSecret}`).toString('base64')
        try {
          const response = await fetch(`${authServiceOrigin}/oauth/token`, {
            method: 'POST',
            headers: {
              authorization: `Basic ${auth}`,
              'content-type': 'application/x-www-form-urlencoded',
            },
            body,
            signal: AbortSignal.timeout(8_000),
          })
          const parsed = await response.json().catch(() => ({}))
          return {
            ok: response.status === 200,
            status: response.status,
            token: typeof parsed.access_token === 'string' ? parsed.access_token : undefined,
          }
        } catch {
          return { ok: false, status: 'transport_unreachable' }
        }
      }
  const mintVerify = mintToken === undefined
    ? undefined
    : async ({ clientId: c, clientSecret }) => {
        const mint = await mintToken({ clientId: c, clientSecret })
        return { ok: mint.ok, status: mint.status }
      }
  const realAuthCallVerify = val('--real-call-url') === undefined || mintToken === undefined
    ? undefined
    : async ({ clientId: c, clientSecret }) => {
        // REAL_AUTH_CALL_VERIFY: a real business-surface call carrying the
        // freshly minted token — an endpoint that answers 2xx only for an
        // authenticated+authorized caller (fail-closed otherwise).
        const mint = await mintToken({ clientId: c, clientSecret })
        if (!mint.ok || typeof mint.token !== 'string') return { ok: false, detail: `mint ${mint.status}` }
        try {
          const response = await fetch(val('--real-call-url'), {
            headers: { authorization: `Bearer ${mint.token}`, accept: 'application/json' },
            signal: AbortSignal.timeout(8_000),
          })
          return { ok: response.status >= 200 && response.status < 300, detail: `status ${response.status}` }
        } catch (error) {
          return { ok: false, detail: String(error?.message ?? error).slice(0, 120) }
        }
      }

  // Production (e) privileged channel (auth-service Amendment A §11 seam):
  // wired automatically when a database URL is present; without the applied
  // seam migration the channel errors and the transaction aborts with zero
  // mutation (fail-closed).
  const channel = createPsqlPrivilegedChannel({ databaseUrl: dbUrl })

  try {
    const result = await executeRotation({
      agentId,
      clientId,
      storeFile,
      receiptsFile,
      operationId,
      readDbState: () => channel.readDbState({ clientId }),
      applyDbRotation: channel.applyDbRotation,
      rollbackDbRotation: channel.rollbackDbRotation,
      ...(mintVerify === undefined ? {} : { mintVerify }),
      ...(realAuthCallVerify === undefined ? {} : { realAuthCallVerify }),
      log: { log: (m) => process.stdout.write(`${m}\n`) },
    })
    process.stdout.write(`ROTATION_${result.outcome} operation=${result.receipt.operationId} agent=${agentId} receipt=${receiptsFile}\n`)
    if (result.replayed === true) process.stdout.write('idempotent replay: zero mutation performed\n')
  } catch (error) {
    process.stderr.write(`${error.code ?? 'rotation_failed'}: ${error.message}\n`)
    if (error.receipt?.operationId !== undefined) {
      process.stderr.write(`receipt: ${error.receipt.operationId} outcome=${error.receipt.outcome} (${receiptsFile})\n`)
    }
    process.exit(error.code === 'external_prerequisite_missing' ? 20 : 21)
  }
}

async function cmdGate() {
  const agentId = requireAgentId()
  const storeFile = storeFromArgs()
  const clientId = val('--client-id')
  const dbUrl = val('--db-url')
  if (clientId === undefined) die('--client-id <mc_*> is required')
  if (dbUrl === undefined) die('--db-url <postgres://...> is required')
  const db = await readDbStateViaPsql({ dbUrl, clientId })
  const { readCredentialStoreDocument } = await import('../packages/agent-credential-provisioning/src/store-writer.js')
  const doc = await readCredentialStoreDocument(storeFile)
  const storeSecret = doc.credentials?.[agentId]?.clientSecret
  const ledger = new RotationReceiptLedger(val('--receipts') ?? `${storeFile}.rotation-receipts.jsonl`)
  const gate = evaluateSeamGate({ dbSecretHash: db.secretHash, storeSecret, receipts: ledger.list() })
  process.stdout.write(`GATE_${gate.ok ? 'PASS' : `REFUSED_${gate.code}`}\n`)
  if (!gate.ok) process.exit(21)
}

async function cmdReceipts() {
  const storeFile = storeFromArgs()
  const receiptsFile = val('--receipts') ?? `${storeFile}.rotation-receipts.jsonl`
  const ledger = new RotationReceiptLedger(receiptsFile)
  for (const receipt of ledger.list()) {
    process.stdout.write(`${receipt.recordedAt} ${receipt.operationId} ${receipt.outcome} agent=${receipt.agentId ?? '-'} client=${receipt.clientId ?? '-'}\n`)
  }
}

function cmdSelftest() {
  const checks = []
  const check = (name, fn) => checks.push([name, fn])

  // 1. crypto format round-trip (auth secret.ts exact algorithm)
  check('scrypt format round-trip', () => {
    const { secret, secretHash } = generateMachineSecret()
    assertMatch(secret, /^[A-Za-z0-9_-]{43}$/)
    assertMatch(secretHash, /^[0-9a-f]{32}:[0-9a-f]{128}$/)
    if (hashMachineSecret(secret, secretHash.split(':')[0]) !== secretHash) throw new Error('round-trip mismatch')
  })

  // 2. gate classification table
  check('gate classifications', () => {
    const { secret, secretHash } = generateMachineSecret()
    const ok = evaluateSeamGate({ dbSecretHash: secretHash, storeSecret: secret, receipts: [] })
    if (ok.ok !== true) throw new Error('matched generation must pass')
    const split = evaluateSeamGate({ dbSecretHash: secretHash, storeSecret: 'other-secret', receipts: [] })
    if (split.ok !== false || split.code !== 'split_state_detected') throw new Error('mismatch must split-refuse')
    const missing = evaluateSeamGate({ dbSecretHash: '', storeSecret: secret, receipts: [] })
    if (missing.code !== 'split_state_detected') throw new Error('missing material must split-refuse')
  })

  // 3. receipt red-line: a receipt carrying a secret field refuses to append
  check('receipt red-line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rot-selftest-'))
    try {
      const ledger = new RotationReceiptLedger(join(dir, 'r.jsonl'))
      ledger.append({ kind: 'rotation', operationId: 'rot-x', outcome: 'COMPLETED' })
      let threw = false
      try {
        ledger.append({ kind: 'rotation', operationId: 'rot-y', clientSecret: 'leak' })
      } catch { threw = true }
      if (!threw) throw new Error('secret-bearing receipt must refuse to append')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  // 4. T11 guard: an arbitrary business Agent is refused pre-mutation
  check('T11 fixture guard', () => {
    let threw = false
    try {
      assertFixtureRotationTarget({ agentId: 'agt_any-business-agent', fixtureAgentIds: ['agt_fixture-only'] })
    } catch (error) {
      if (error.code === 'production_proof_target_forbidden') threw = true
    }
    if (!threw) throw new Error('business-Agent proof rotation must be refused')
    assertFixtureRotationTarget({ agentId: 'agt_fixture-only', fixtureAgentIds: ['agt_fixture-only'] })
  })

  // 5. hash fingerprint shape (what receipts carry)
  check('fingerprint shapes', () => {
    assertMatch(hashFingerprint('salt:hash'), /^hfp:[0-9a-f]{16}$/)
    const { secret } = generateMachineSecret()
    assertMatch(secretFingerprint(secret), /^fp:[0-9a-f]{16}$/)
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
  process.exit(failed === 0 ? 0 : 1)
}

function assertMatch(value, re) {
  if (typeof value !== 'string' || !re.test(value)) throw new Error(`format mismatch: ${JSON.stringify(value).slice(0, 60)}`)
}

switch (command) {
  case 'rotate': await cmdRotate(); break
  case 'gate': await cmdGate(); break
  case 'receipts': await cmdReceipts(); break
  case 'selftest': cmdSelftest(); break
  default:
    process.stdout.write(`usage: agent-credential-rotate.mjs <rotate|gate|receipts|selftest> [--agent <agt_*>] [--client-id <mc_*>] [--store <path>] [--receipts <path>] [--db-url <url>] [--auth-origin <url>] [--real-call-url <url>] [--operation-id <id>]\n`)
    process.exit(command === undefined ? 0 : 2)
}
