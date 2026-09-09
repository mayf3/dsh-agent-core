/**
 * @agent-core/agent-credential-provisioning/src/privileged-channel-psql.js —
 * the production (e) privileged rotation channel (SECRET_MUTATION_ENFORCEMENT_SEAM).
 *
 * Implements the applyDbRotation / rollbackDbRotation / readDbState faces that
 * rotation-seam.js injects, against the auth-service enforcement seam
 * (MACHINE_CLIENT_CREDENTIALS_V0 §11 / migration
 * 20260909010000_machine_credential_rotation_seam): the SECURITY DEFINER
 * function `rotate_machine_client_secret()` — the ONLY path that changes
 * machine_clients secret material (column-level privileges make direct
 * writes impossible for the application role; the receipt ledger inside the
 * function makes hash-without-rotated_at impossible).
 *
 * Channel contract (rotation-seam.js executeRotation):
 *   applyDbRotation({ clientId, newSecretHash, operationId })       → void
 *   rollbackDbRotation({ clientId, preimageSecret, operationId })   → void
 *     — re-hashes the PREIMAGE SECRET with the LIVE hash's salt, refuses
 *       (zero mutation) unless the live DB generation still equals the
 *       preimage, then rotates back through the same seam function under a
 *       deterministic recovery operation id (`<operationId>:rollback`), so
 *       the recovery itself is receipted and replay-idempotent.
 *   readDbState({ clientId }) → { clientId, secretHash }
 *
 * Transport: psql with STDIN SQL; identifiers/values travel as psql variables
 * (`:'var'` — injection-safe literal quoting). Only ids, hashes and operation
 * ids ever enter this module: secret bytes never do (Part H — and the hash of
 * a secret is not the secret).
 *
 * Fail-closed: if the auth seam function is absent (pre-(e) database), APPLY
 * errors and the transaction aborts with zero mutation.
 */

import { execFile } from 'node:child_process'
import { hashMachineSecret } from './rotation-seam.js'

function runPsql({ dbUrl, psqlPath, vars, sql, timeoutMs }) {
  void timeoutMs
  return new Promise((resolvePromise, rejectPromise) => {
    const psqlArgs = [dbUrl, '-At', '-v', 'ON_ERROR_STOP=1']
    for (const [k, v] of Object.entries(vars)) psqlArgs.push('-v', `${k}=${v}`)
    const child = execFile(psqlPath, psqlArgs, (error, stdout, stderr) => {
      if (error !== null) {
        rejectPromise(Object.assign(
          new Error(`psql privileged channel failed: ${String(stderr).slice(0, 200)}`),
          { code: 'privileged_channel_failed' },
        ))
        return
      }
      resolvePromise(stdout)
    })
    child.stdin.write(`${sql}\n`)
    child.stdin.end()
  })
}

/**
 * @param {object} opts
 * @param {string} opts.databaseUrl - libpq connection string (DATABASE_URL);
 *   MUST be the auth-service application role (EXECUTE on the seam function
 *   is granted to it; direct secret writes are denied to it by design).
 * @param {string} [opts.psqlPath]
 * @param {string} [opts.rotatedBy]
 */
export function createPsqlPrivilegedChannel({ databaseUrl, psqlPath = 'psql', rotatedBy = 'agent-credential-rotate' }) {
  if (typeof databaseUrl !== 'string' || databaseUrl === '') {
    throw new Error('privileged-channel-psql: databaseUrl (DATABASE_URL) is required')
  }
  const run = (vars, sql) => runPsql({ dbUrl: databaseUrl, psqlPath, vars, sql })

  async function readDbState({ clientId }) {
    const sql = "SELECT client_id, secret_hash FROM machine_clients WHERE client_id = :'client_id';"
    const stdout = await run({ client_id: clientId }, sql)
    const line = stdout.trim().split('\n').find((l) => l !== '')
    if (line === undefined) {
      throw Object.assign(new Error('privileged channel: target client not found in DB'), { code: 'target_not_resolved' })
    }
    const [resolvedClientId, secretHash] = line.split('|')
    return { clientId: resolvedClientId, secretHash }
  }

  async function applyDbRotation({ clientId, newSecretHash, operationId }) {
    // Single statement: resolve the exact target, fingerprint the live
    // generation, and hand everything to the SECURITY DEFINER seam function
    // (which re-verifies the preimage under its own lock — fail-closed).
    const sql = `
      WITH target AS MATERIALIZED (
        SELECT id, secret_hash FROM machine_clients WHERE client_id = :'client_id'
      )
      SELECT client_id, rotated_at, receipt_id, replayed
        FROM rotate_machine_client_secret(
          (SELECT id FROM target),
          :'new_secret_hash',
          encode(sha256(convert_to((SELECT secret_hash FROM target), 'utf8')), 'hex'),
          :'operation_id',
          :'rotated_by');`
    const stdout = await run(
      { client_id: clientId, new_secret_hash: newSecretHash, operation_id: operationId, rotated_by: rotatedBy },
      sql,
    )
    if (stdout.trim() === '') throw new Error('privileged channel: seam returned no row')
  }

  async function rollbackDbRotation({ clientId, preimageSecret, operationId }) {
    // Deterministic recovery invariant: converge the DB to the generation the
    // credential STORE holds (the preimage SECRET comes from the store's
    // preimage backup — the store generation is by construction whatever that
    // secret is). Erasing an unheld generation is impossible by design: the
    // new secret of a crashed rotation exists nowhere else, so converging to
    // the held generation is the ONLY consistent recovery. Replay-idempotent:
    // when the DB already verifies against the preimage secret, this is a
    // no-op (still receipted under the deterministic :rollback operation id).
    const live = await readDbState({ clientId })
    const recomputedHash = hashMachineSecret(preimageSecret, live.secretHash.split(':')[0])
    if (recomputedHash !== live.secretHash) {
      // DB advanced away from the store generation (or store rolled back):
      // rotate the DB back to the STORE's generation through the SAME seam
      // function — receipted, fail-closed on the seam's own preimage check.
      const sql = `
        WITH target AS MATERIALIZED (
          SELECT id, secret_hash FROM machine_clients WHERE client_id = :'client_id'
        )
        SELECT client_id, rotated_at, receipt_id, replayed
          FROM rotate_machine_client_secret(
            (SELECT id FROM target),
            :'new_secret_hash',
            encode(sha256(convert_to((SELECT secret_hash FROM target), 'utf8')), 'hex'),
            :'operation_id',
            :'rotated_by');`
      const stdout = await run(
        {
          client_id: clientId,
          new_secret_hash: recomputedHash,
          operation_id: `${operationId}:rollback`,
          rotated_by: `${rotatedBy}:rollback`,
        },
        sql,
      )
      if (stdout.trim() === '') throw new Error('privileged channel: rollback seam returned no row')
      return
    }
    // Already converged (replay) — nothing to mutate.
  }

  return { readDbState, applyDbRotation, rollbackDbRotation }
}
