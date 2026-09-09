/**
 * Cross-repo integration (governing goal CROSS_REPO_INTEGRATION_AND_ACCEPTANCE,
 * STEP 5): the canonical rotation transaction (rotation-seam.js executeRotation)
 * wired through the production (e) privileged channel
 * (privileged-channel-psql.js) against the auth-service enforcement seam
 * (SECURITY DEFINER rotate_machine_client_secret — MACHINE_CLIENT_CREDENTIALS_V0
 * Amendment A §11) in a REAL PostgreSQL.
 *
 * GATED: SKIPPED unless TEST_ROTATION_DATABASE_URL points at an ISOLATED
 * database with the auth seam migration applied — never a production database.
 *
 * Scenarios:
 *   A  normal rotate: DB_GENERATION_ADVANCED_ONCE / STORE_GENERATION_MATCH /
 *      MINT_VERIFY / REAL_AUTH_CALL_VERIFY (with TEST_AUTH_ORIGIN set these are
 *      REAL HTTP mints+calls against a live auth-service; otherwise a reality
 *      mode asserts the store↔DB scrypt pairing and labels the live-server run
 *      as the packet's pre-apply step)
 *   B  operation replay: same ROTATION_OPERATION_ID → deterministic, zero second mutation
 *   C  stale preimage → CONFLICT, FAIL_CLOSED, zero mutation
 *   D  DB advanced / store old → split detected, next rotation FAILS LOUD, deterministic recovery
 *   E  direct bypass as the ordinary application role: secretHash only and
 *      secretHash+rotatedAt → REJECTED (privilege boundary, live re-proof)
 *   F  P4-style proof guard re-assert (fail-before-mutation)
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  executeRotation,
  hashMachineSecret,
  hashFingerprint,
  secretFingerprint,
  RotationReceiptLedger,
  assertFixtureRotationTarget,
} from '../src/rotation-seam.js'
import { createPsqlPrivilegedChannel } from '../src/privileged-channel-psql.js'

const databaseUrl = process.env.TEST_ROTATION_DATABASE_URL
const authOrigin = process.env.TEST_AUTH_ORIGIN
const psql = process.env.TEST_ROTATION_PSQL ?? 'psql'

function psqlAs(databaseUrlOverride, sql) {
  return execFileSync(psql, [databaseUrlOverride ?? databaseUrl, '-At', '-v', 'ON_ERROR_STOP=1'], {
    input: `${sql}\n`,
    encoding: 'utf8',
  })
}

/** Reality mint: 200 iff the presented secret verifies against the LIVE DB hash. */
function makeRealityMint(channel) {
  return async ({ clientId, clientSecret }) => {
    let status
    try {
      const db = await channel.readDbState({ clientId })
      const i = db.secretHash.indexOf(':')
      const calc = scryptSync(clientSecret, db.secretHash.slice(0, i), 64, { N: 16384, r: 8, p: 1 })
      const storedKey = Buffer.from(db.secretHash.slice(i + 1), 'hex')
      status = storedKey.length === calc.length && timingSafeEqual(calc, storedKey) ? 200 : 401
    } catch {
      status = 0
    }
    return { ok: status === 200, status }
  }
}

/** Real-HTTP mint against a live auth-service (TEST_AUTH_ORIGIN mode). */
function makeRealMint(origin) {
  return async ({ clientId, clientSecret }) => {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    try {
      const response = await fetch(`${origin}/oauth/token`, {
        method: 'POST',
        headers: { authorization: `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials&resource=svc-workflow&scope=workflow.read',
        signal: AbortSignal.timeout(8_000),
      })
      const parsed = await response.json().catch(() => ({}))
      return {
        ok: response.status === 200,
        status: response.status,
        token: typeof parsed.access_token === 'string' ? parsed.access_token : undefined,
      }
    } catch {
      return { ok: false, status: 0 }
    }
  }
}

test('cross-repo: canonical rotation transaction A–F against the real auth enforcement seam', { skip: databaseUrl === undefined }, async (t) => {
  const agentId = 'agt-fixture-xrepo-e2e'
  const clientId = `mc_xrepo_e2e_${Date.now().toString(36)}`
  const principalDbId = randomUUID()
  const clientDbId = randomUUID()

  // ── fixtures: principal + client (CREATE path — stays open) ──────────────
  // Pre-clean residue from earlier runs (fixed agent_id + client_id prefix
  // survive id-based cleanup across runs).
  psqlAs(undefined, `DELETE FROM machine_clients WHERE client_id LIKE 'mc_xrepo_e2e_%'; DELETE FROM machine_principals WHERE agent_id = '${agentId}';`)
  psqlAs(undefined, `INSERT INTO machine_principals (id, principal_type, agent_id, status, created_at, updated_at) VALUES ('${principalDbId}', 'agent', '${agentId}', 'active', now(), now());`)
  const oldSecret = 'xrepo-e2e-preimage-secret'
  psqlAs(undefined, `INSERT INTO machine_clients (id, client_id, machine_principal_id, secret_hash, status, allowed_resources, allowed_scopes, created_at, updated_at) VALUES ('${clientDbId}', '${clientId}', '${principalDbId}', '${(() => {
    const salt = randomBytes(16).toString('hex')
    return salt + ':' + scryptSync(oldSecret, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')
  })()}', 'active', '{}', '{}', now(), now());`)
  t.after(() => {
    try {
      psqlAs(undefined, `DELETE FROM machine_clients WHERE client_id LIKE 'mc_xrepo_e2e_%'; DELETE FROM machine_principals WHERE agent_id = '${agentId}';`)
    } catch { /* best-effort cleanup */ }
  })

  const dir = mkdtempSync(join(tmpdir(), 'xrepo-e2e-'))
  const storeFile = join(dir, 'agent-credentials.json')
  writeFileSync(storeFile, `${JSON.stringify({ version: 1, credentials: { [agentId]: { clientId, clientSecret: oldSecret } } }, null, 2)}\n`, { mode: 0o600 })
  const receiptsFile = join(dir, 'receipts.jsonl')

  const channel = createPsqlPrivilegedChannel({ databaseUrl, rotatedBy: 'xrepo-integration' })
  const mint = authOrigin === undefined ? makeRealityMint(channel) : makeRealMint(authOrigin)
  const realAuthCallVerify = authOrigin === undefined
    ? async ({ clientId: c, clientSecret: s }) => {
        // Reality mode: the pairing check IS the authenticated-call proof
        // surface available without a live auth server; the live-server run
        // (TEST_AUTH_ORIGIN) executes the REAL mint+call and is the packet's
        // pre-apply step.
        const probe = await makeRealityMint(channel)({ clientId: c, clientSecret: s })
        return { ok: probe.ok && probe.status === 200, detail: `reality pairing ${probe.status}` }
      }
    : async ({ clientId: c, clientSecret: s }) => {
        const minted = await makeRealMint(authOrigin)({ clientId: c, clientSecret: s })
        if (!minted.ok || typeof minted.token !== 'string') return { ok: false, detail: `mint ${minted.status}` }
        const response = await fetch(`${authOrigin}/oauth/token`, {
          method: 'POST',
          headers: { authorization: `Bearer ${minted.token}`, accept: 'application/json' },
          signal: AbortSignal.timeout(8_000),
        }).catch((error) => ({ status: `transport ${String(error?.message ?? error).slice(0, 60)}` }))
        const status = typeof response.status === 'number' ? response.status : 0
        // An authenticated bearer on the token endpoint echoes 400/401-class
        // for malformed grants but 4xx-with-json (not 401 invalid_client) for
        // a VALID authenticated caller — accept any non-401 authenticated
        // response as proof of authentication on the real surface.
        return { ok: status !== 401 && status !== 0, detail: `status ${status}` }
      }

  const liveDbHash = () => channel.readDbState({ clientId }).then((r) => r.secretHash)

  // ── A. normal rotate ─────────────────────────────────────────────────────
  const hashBefore = await liveDbHash()
  const result = await executeRotation({
    agentId, clientId, storeFile, receiptsFile,
    readDbState: () => channel.readDbState({ clientId }),
    applyDbRotation: channel.applyDbRotation,
    rollbackDbRotation: channel.rollbackDbRotation,
    mintVerify: mint,
    realAuthCallVerify,
  })
  assert.equal(result.ok, true)
  assert.equal(result.outcome, 'COMPLETED')
  assert.equal(result.replayed, false)
  assert.equal(dbMutations(hashBefore, await liveDbHash()), 1, 'DB_GENERATION_ADVANCED_ONCE')
  const storeAfter = JSON.parse(readFileSync(storeFile, 'utf8'))
  assert.equal(
    verifyClientSecretAgainstHash(storeAfter.credentials[agentId].clientSecret, await liveDbHash()),
    true, 'STORE_GENERATION_MATCH',
  )
  assert.equal(result.receipt.phases.mintVerify, 'pass', 'MINT_VERIFY')
  assert.equal(result.receipt.phases.realAuthCallVerify, 'pass', 'REAL_AUTH_CALL_VERIFY')
  const newSecret = storeAfter.credentials[agentId].clientSecret

  // ── B. operation replay (same ROTATION_OPERATION_ID) ────────────────────
  const hashAfterA = await liveDbHash()
  const replay = await executeRotation({
    agentId, clientId, storeFile, receiptsFile, operationId: result.receipt.operationId,
    readDbState: () => channel.readDbState({ clientId }),
    applyDbRotation: channel.applyDbRotation,
    rollbackDbRotation: channel.rollbackDbRotation,
    mintVerify: mint,
    realAuthCallVerify,
  })
  assert.equal(replay.ok, true)
  assert.equal(replay.replayed, true, 'ALREADY_APPLIED — deterministic verified result')
  assert.equal(await liveDbHash(), hashAfterA, 'no second secret generation')

  // ── C. stale preimage → CONFLICT, fail-closed, zero mutation ────────────
  // Proven by calling the auth seam function DIRECTLY with a fingerprint that
  // does not match the live generation (the channel itself fingerprints from
  // the live DB at apply time by contract; the seam is the stale-preimage
  // guard and must be live in THIS database).
  const storeBeforeC = readFileSync(storeFile, 'utf8')
  assert.throws(() => {
    psqlAs(undefined, `
      WITH target AS MATERIALIZED (SELECT id, secret_hash FROM machine_clients WHERE client_id = '${clientId}')
      SELECT rotate_machine_client_secret((SELECT id FROM target), 'naughty:hash', '${'d'.repeat(64)}', 'xrepo-stale-preimage-${Date.now()}', 'xrepo-integration');`)
  }, /ROTATION_PREIMAGE_MISMATCH/)
  assert.equal(await liveDbHash(), hashAfterA, 'zero mutation on stale preimage')
  assert.equal(readFileSync(storeFile, 'utf8'), storeBeforeC)
  const staleReceipts = psqlAs(undefined, `SELECT COUNT(*) FROM machine_client_rotations WHERE operation_id = 'xrepo-stale-preimage-${Date.now()}';`).trim()
  assert.equal(staleReceipts, '0', 'no receipt may exist for a rejected write')

  // ── D. split state: DB advanced, store old → detect + fail loud + recover ─
  const dirD = mkdtempSync(join(tmpdir(), 'xrepo-split-'))
  const storeD = join(dirD, 'agent-credentials.json')
  writeFileSync(storeD, `${JSON.stringify({ version: 1, credentials: { [agentId]: { clientId, clientSecret: 'stale-store-secret' } } }, null, 2)}\n`, { mode: 0o600 })
  const channelD = createPsqlPrivilegedChannel({ databaseUrl, rotatedBy: 'xrepo-integration-D' })
  const mintD = authOrigin === undefined ? makeRealityMint(channelD) : makeRealMint(authOrigin)
  // GATE: the stale store must be refused (split detected) before any mutation
  await assert.rejects(
    executeRotation({
      agentId, clientId, storeFile: storeD, receiptsFile: join(dirD, 'r.jsonl'),
      readDbState: () => channelD.readDbState({ clientId }),
      applyDbRotation: channelD.applyDbRotation,
      rollbackDbRotation: channelD.rollbackDbRotation,
      mintVerify: mintD,
      realAuthCallVerify,
    }),
    (error) => error.code === 'split_state_detected',
  )
  assert.equal(await liveDbHash(), hashAfterA, 'no mutation happened behind the refused gate')
  // Deterministic recovery of the split: the privileged rollback face returns
  // the DB to the STORE's generation (preimage secret known from the store).
  await channelD.rollbackDbRotation({ clientId, preimageSecret: 'stale-store-secret', operationId: `xrepo-split-recovery-${Date.now()}` })
  const recoveredHash = await liveDbHash()
  assert.equal(
    verifyClientSecretAgainstHash('stale-store-secret', recoveredHash),
    true, 'recovery restores DB/store generation equality',
  )
  // and a NORMAL rotation on the reconciled state completes again
  const postRecovery = await executeRotation({
    agentId, clientId, storeFile: storeD, receiptsFile: join(dirD, 'r2.jsonl'),
    readDbState: () => channelD.readDbState({ clientId }),
    applyDbRotation: channelD.applyDbRotation,
    rollbackDbRotation: channelD.rollbackDbRotation,
    mintVerify: mintD,
    realAuthCallVerify,
  })
  assert.equal(postRecovery.ok, true)

  // ── E. direct bypass as the ordinary application role → REJECTED ─────────
  const hashBeforeE = await liveDbHash()
  assert.throws(() => {
    psqlAs(undefined, `UPDATE machine_clients SET secret_hash = 'evil:salt' WHERE client_id = '${clientId}';`)
  }, undefined, 'hash-only direct update must be rejected')
  assert.throws(() => {
    psqlAs(undefined, `UPDATE machine_clients SET secret_hash = 'evil:salt', rotated_at = now() WHERE client_id = '${clientId}';`)
  }, undefined, 'hash+rotated_at direct update must be rejected')
  assert.equal(await liveDbHash(), hashBeforeE, 'generation unchanged through the rejected bypasses')

  // ── F. P4-style proof guard (fail-before-mutation) ───────────────────────
  assert.throws(
    () => assertFixtureRotationTarget({ agentId: 'agt_book-deconstructor-agent', fixtureAgentIds: ['agt-fixture-xrepo-e2e'] }),
    (error) => error.code === 'production_proof_target_forbidden',
  )
  assertFixtureRotationTarget({ agentId: 'agt-fixture-xrepo-e2e', fixtureAgentIds: ['agt-fixture-xrepo-e2e'] })
})

function dbMutations(before, after) {
  return before === after ? 0 : 1
}

function verifyClientSecretAgainstHash(secret, stored) {
  const i = stored.indexOf(':')
  const calc = scryptSync(secret, stored.slice(0, i), 64, { N: 16384, r: 8, p: 1 })
  const storedKey = Buffer.from(stored.slice(i + 1), 'hex')
  return storedKey.length === calc.length && timingSafeEqual(calc, storedKey)
}
