/**
 * @agent-core/agent-credential-provisioning/src/rotation-seam.js — the
 * canonical operator ROTATION seam (AGENT_CORE_AGENT_CREDENTIAL_
 * PROVISIONING_V1 AMENDMENT_7, Part I.2/I.3/I.4; productized bdcred).
 *
 * THE invariant of Amendment 7: secret material of an EXISTING MachineClient
 * changes only through this receipted transaction — never via boot, spawn,
 * ensure, or a bare UPDATE (DIRECT_APP_ROLE_SECRET_UPDATE = IMPOSSIBLE once
 * external prerequisite (e) lands in the auth-service repo; until then every
 * APPLY here fails LOUD as `external_prerequisite_missing(e)` and writes a
 * refusal receipt — the fail-closed degradation is itself acceptance-tested).
 *
 * Transaction (I.3/I.4): GATE → PLAN → GENERATE → APPLY → VERIFY → RECEIPT.
 *
 *   GATE     readback fingerprint compare (store vs DB) + receipt-ledger
 *            cross-check. Runs on EVERY seam contact, before any mutation;
 *            a mismatch or an unreceipted DB generation advance refuses the
 *            seam (inherited crash-window gate).
 *   PLAN     freeze {operationId, agentId, clientId, preimage fingerprints}.
 *            The operationId is deterministic from (clientId, preimage hash
 *            fingerprint) unless supplied — replaying the same operation on
 *            the same preimage returns the SAME id (T10 idempotency key).
 *   GENERATE new secret in memory only (32B base64url; scrypt hash in the
 *            auth `secret.ts` format: `salt-hex:scrypt-hex`).
 *   APPLY    the (e) privileged channel rotates the DB row
 *            (hash + rotated_at + updated_at + audit, one transaction);
 *            then the credential store is atomically swapped (0600, staged
 *            temp + rename, preimage `.bak` backup). Store-swap failure
 *            triggers DB rollback via the same channel; if rollback also
 *            fails the receipt records SPLIT_STATE_OPEN and the caller gets
 *            a loud error — never a silent split.
 *   VERIFY   post-hash readback (store fingerprint == DB fingerprint == the
 *            new generation) + MINT_VERIFY + REAL_AUTH_CALL_VERIFY.
 *   RECEIPT  append-only JSONL. Receipts carry FINGERPRINTS and phase facts
 *            ONLY — secret bytes/hash values never enter receipts, logs,
 *            argv, env, or errors (Part H red line).
 *
 * Replay semantics (T10): a COMPLETED receipt for the supplied/derived
 * operationId short-circuits the transaction with zero mutations (the same
 * operationId on the same preimage is by construction the same rotation).
 */

import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import {
  appendFileSync, closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync,
  openSync, readFileSync, renameSync, statSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

import { readCredentialStoreDocument, replaceCredentialForAgent, withCredentialStoreLock } from './store-writer.js'

export const ROTATION_OUTCOMES = Object.freeze({
  COMPLETED: 'COMPLETED',
  REFUSED_EXTERNAL_PREREQUISITE: 'REFUSED_EXTERNAL_PREREQUISITE',
  ROLLED_BACK: 'ROLLED_BACK',
  SPLIT_STATE_OPEN: 'SPLIT_STATE_OPEN',
  GATE_REFUSED: 'GATE_REFUSED',
  VERIFY_INCOMPLETE: 'VERIFY_INCOMPLETE',
})

// ── fingerprints (the only thing that ever leaves this module about a
//    secret: one-way, truncated) ──────────────────────────────────────────

export function secretFingerprint(secretString) {
  if (typeof secretString !== 'string' || secretString === '') {
    throw new TypeError('rotation-seam: secretFingerprint requires a non-empty string')
  }
  return `fp:${createHash('sha256').update(secretString, 'utf8').digest('hex').slice(0, 16)}`
}

export function hashFingerprint(secretHashColumnValue) {
  if (typeof secretHashColumnValue !== 'string' || secretHashColumnValue === '') {
    throw new TypeError('rotation-seam: hashFingerprint requires a non-empty string')
  }
  return `hfp:${createHash('sha256').update(secretHashColumnValue, 'utf8').digest('hex').slice(0, 16)}`
}

// ── secret generation (auth-service `secret.ts` exact algorithm — the
//    productized bdcred crypto, unchanged) ────────────────────────────────

export function generateMachineSecret() {
  const secret = randomBytes(32).toString('base64url')
  const salt = randomBytes(16).toString('hex')
  const secretHash = hashMachineSecret(secret, salt)
  return { secret, secretHash }
}

export function hashMachineSecret(secret, saltHex = randomBytes(16).toString('hex')) {
  const hash = scryptSync(secret, saltHex, 64, { N: 16384, r: 8, p: 1 }).toString('hex')
  return `${saltHex}:${hash}`
}

// ── receipt ledger (append-only JSONL, fingerprints only) ────────────────

export class RotationReceiptLedger {
  constructor(filePath, { now = () => new Date().toISOString() } = {}) {
    if (typeof filePath !== 'string' || filePath === '') throw new TypeError('rotation-seam: receipts file path is required')
    this.filePath = filePath
    this.now = now
  }

  append(receipt) {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const record = JSON.stringify({ ...receipt, recordedAt: this.now() })
    if (record.includes('"secret"') || /"clientSecret"/.test(record)) {
      throw new TypeError('rotation-seam: receipt red-line — secret fields are never receipted')
    }
    appendFileSync(this.filePath, `${record}\n`)
    const fd = openSync(this.filePath, 'r+')
    try { fsyncSync(fd) } finally { closeSync(fd) }
    return JSON.parse(record)
  }

  list() {
    if (!existsSync(this.filePath)) return []
    const out = []
    for (const line of readFileSync(this.filePath, 'utf8').split('\n')) {
      if (line === '') continue
      try { out.push(JSON.parse(line)) } catch { /* torn tail: skip */ }
    }
    return out
  }

  latestByOperation(operationId) {
    const matches = this.list().filter((r) => r.operationId === operationId)
    return matches.length === 0 ? undefined : matches[matches.length - 1]
  }
}

// ── GATE (I.4: every seam contact, before any mutation) ──────────────────

/**
 * @param {object} input
 * @param {string} input.dbSecretHash - the DB secret_hash column value
 *   (channel-owned read face; `salt:scrypt` format).
 * @param {string} input.storeSecret - the store's clientSecret value.
 * @param {object[]} input.receipts - receipt ledger entries.
 * @returns {{ok:true} | {ok:false, code:string, detail:string}}
 *
 * The single-generation proof is MECHANICAL: the DB hash embeds its own salt,
 * so deriving scrypt(storeSecret, salt) and comparing (constant-time) proves
 * the store secret IS the DB hash's preimage. A mismatch is a split state or
 * an out-of-seam write — refused loud, unless the ledger records a rotation
 * whose VERIFY/SPLIT outcome demands exactly this reconciliation.
 */
export function evaluateSeamGate({ dbSecretHash, storeSecret, receipts }) {
  if (typeof dbSecretHash !== 'string' || dbSecretHash === ''
    || typeof storeSecret !== 'string' || storeSecret === '') {
    return { ok: false, code: 'split_state_detected', detail: 'gate: missing DB or store generation material — cannot prove a single generation' }
  }
  const [salt, key] = dbSecretHash.split(':')
  let linkageOk = false
  if (salt !== undefined && key !== undefined) {
    try {
      const expected = scryptSync(storeSecret, salt, 64, { N: 16384, r: 8, p: 1 })
      const actual = Buffer.from(key, 'hex')
      linkageOk = expected.length === actual.length && timingSafeEqual(expected, actual)
    } catch { linkageOk = false }
  }
  if (!linkageOk) {
    const pending = (receipts ?? []).find((r) =>
      r.outcome === ROTATION_OUTCOMES.VERIFY_INCOMPLETE || r.outcome === ROTATION_OUTCOMES.SPLIT_STATE_OPEN)
    if (pending === undefined) {
      return {
        ok: false,
        code: 'split_state_detected',
        detail: 'gate: the store secret does not hash to the DB secret_hash under its own salt — split state or out-of-seam write',
      }
    }
    return {
      ok: false,
      code: 'unreconciled_rotation',
      detail: `gate: operation ${pending.operationId} ended ${pending.outcome} — explicit reconciliation required before this seam mutates`,
    }
  }
  return { ok: true }
}

// ── PLAN ─────────────────────────────────────────────────────────────────

export function planRotation({ agentId, clientId, dbHashFingerprint, storeSecretFingerprint, operationId }) {
  for (const [name, value] of Object.entries({ agentId, clientId, dbHashFingerprint, storeSecretFingerprint })) {
    if (typeof value !== 'string' || value === '') throw new TypeError(`rotation-seam: plan ${name} is required`)
  }
  const id = operationId ?? `rot-${createHash('sha256').update(`${clientId}\u0000${dbHashFingerprint}`).digest('hex').slice(0, 24)}`
  return Object.freeze({
    operationId: id,
    agentId,
    clientId,
    phase: 'PLAN',
    preimage: Object.freeze({
      dbHashFingerprint,
      storeSecretFingerprint,
    }),
  })
}

// ── the transaction ──────────────────────────────────────────────────────

/**
 * Execute one canonical rotation.
 *
 * @param {object} input
 * @param {string} input.agentId - exact agt_* id (store key).
 * @param {string} input.clientId - exact MachineClient id (DB target).
 * @param {string} input.storeFile - absolute credential store path (0600 dir).
 * @param {string} input.receiptsFile - receipt ledger path.
 * @param {() => Promise<{clientId:string, secretHash:string}>} input.readDbState
 *   - I.2 seam READ side (values stay channel-owned; the caller fingerprints
 *     via hashFingerprint). Sandboxes inject fakes; production needs the (e)
 *     channel's read face.
 * @param {({clientId, newSecretHash, operationId}) => Promise<void>} [input.applyDbRotation]
 *   - THE privileged (e) channel. Default: fail-loud
 *     `external_prerequisite_missing(e)` — the fail-closed NOW behavior.
 * @param {({clientId, preimageSecret, operationId}) => Promise<void>} [input.rollbackDbRotation]
 *   - Rollback face of the same channel: receives the PREIMAGE SECRET (from
 *     the store backup) and must re-hash + fingerprint-verify against the
 *     PLAN preimage DB-side before rolling back. Default: fail-loud like apply.
 * @param {({clientId, clientSecret}) => Promise<{ok:boolean, status?:number}>} [input.mintVerify]
 *   - MINT_VERIFY: a real /oauth/token mint with the NEW secret.
 * @param {() => Promise<{ok:boolean, detail?:string}>} [input.realAuthCallVerify]
 *   - REAL_AUTH_CALL_VERIFY: a real business-surface call. Absent ⇒ the
 *     transaction completes as VERIFY_INCOMPLETE (fail-closed, never a
 *     silent pass).
 * @param {string} [input.operationId] - explicit id (replay); else derived.
 */
export async function executeRotation({
  agentId,
  clientId,
  storeFile,
  receiptsFile,
  readDbState,
  applyDbRotation = defaultPrivilegedChannel('e', 'apply'),
  rollbackDbRotation = defaultPrivilegedChannel('e', 'rollback'),
  mintVerify = defaultPrivilegedChannel('c', 'mintVerify'),
  realAuthCallVerify = undefined,
  operationId = undefined,
  storeWriteOptions = {},
  now = () => new Date().toISOString(),
  log = {},
}) {
  for (const [name, value] of Object.entries({ agentId, clientId, storeFile, receiptsFile, readDbState })) {
    if (name === 'readDbState' ? typeof value !== 'function' : typeof value !== 'string' || value === '') {
      throw new TypeError(`rotation-seam: executeRotation ${name} is required`)
    }
  }
  const ledger = new RotationReceiptLedger(receiptsFile, { now })

  // ── GATE: readback compare + receipt cross-check (before ANY mutation) ──
  const db = await readDbState()
  if (db?.clientId !== clientId) {
    const receipt = ledger.append({
      kind: 'rotation', operationId: operationId ?? 'unassigned', agentId, clientId,
      outcome: ROTATION_OUTCOMES.GATE_REFUSED, reason: 'target_not_resolved',
      detail: `DB client for agent resolves to ${db?.clientId ?? 'null'}`, atMs: Date.now(),
    })
    const error = new Error(`rotation-seam: gate refused — target_not_resolved (${receipt.operationId})`)
    error.code = 'target_not_resolved'
    error.receipt = receipt
    throw error
  }
  const storeDoc = await readCredentialStoreDocument(storeFile)
  const storeEntry = storeDoc.credentials?.[agentId]
  const dbHashFingerprint = hashFingerprint(db.secretHash)
  const storeSecret = storeEntry?.clientSecret
  const storeSecretFingerprint = secretFingerprint(storeSecret ?? '')
  const gate = evaluateSeamGate({
    dbSecretHash: db.secretHash,
    storeSecret,
    receipts: ledger.list(),
  })
  if (!gate.ok) {
    const receipt = ledger.append({
      kind: 'rotation', operationId: operationId ?? 'unassigned', agentId, clientId,
      outcome: ROTATION_OUTCOMES.GATE_REFUSED, reason: gate.code,
      preimage: { dbHashFingerprint, storeSecretFingerprint },
      atMs: Date.now(),
    })
    const error = new Error(`rotation-seam: gate refused — ${gate.code}: ${gate.detail} (${receipt.operationId})`)
    error.code = gate.code
    error.receipt = receipt
    throw error
  }

  // ── PLAN (+ T10 replay short-circuit) ──────────────────────────────────
  const plan = planRotation({ agentId, clientId, dbHashFingerprint, storeSecretFingerprint, operationId })
  const existing = ledger.latestByOperation(plan.operationId)
  if (existing?.outcome === ROTATION_OUTCOMES.COMPLETED) {
    log.log?.(`rotation-seam: operation ${plan.operationId} already COMPLETED — idempotent replay, zero mutations`)
    return { ok: true, replayed: true, outcome: ROTATION_OUTCOMES.COMPLETED, receipt: existing, plan }
  }
  if (existing !== undefined && [ROTATION_OUTCOMES.SPLIT_STATE_OPEN, ROTATION_OUTCOMES.ROLLED_BACK, ROTATION_OUTCOMES.VERIFY_INCOMPLETE].includes(existing.outcome)) {
    const error = new Error(`rotation-seam: operation ${plan.operationId} previously ended ${existing.outcome} — explicit reconciliation required before replay`)
    error.code = 'rotation_needs_reconciliation'
    throw error
  }

  // ── GENERATE (memory only) ─────────────────────────────────────────────
  const { secret: newSecret, secretHash: newSecretHash } = generateMachineSecret()
  const newDbFingerprint = hashFingerprint(newSecretHash)
  const newStoreFingerprint = secretFingerprint(newSecret)

  // ── APPLY: DB rotation through the (e) channel ─────────────────────────
  try {
    await applyDbRotation({ clientId, newSecretHash, operationId: plan.operationId })
  } catch (error) {
    const isPrerequisite = error?.code === 'external_prerequisite_missing'
    const receipt = ledger.append({
      kind: 'rotation', ...plan,
      outcome: ROTATION_OUTCOMES.REFUSED_EXTERNAL_PREREQUISITE,
      reason: error?.code ?? 'apply_channel_failure',
      atMs: Date.now(),
    })
    if (isPrerequisite) {
      const refused = new Error(`rotation-seam: APPLY refused — external_prerequisite_missing(e): no privileged rotation channel is configured; zero mutation performed (${receipt.operationId})`)
      refused.code = 'external_prerequisite_missing'
      refused.prerequisite = 'e'
      refused.receipt = receipt
      refused.receiptsFile = receiptsFile
      throw refused
    }
    throw error
  }

  // ── APPLY: store swap (preimage backup → atomic 0600 write) ────────────
  // Backup and replacement share ONE lock hold; the bounded-recovery restore
  // re-acquires the same lock so it can never race a concurrent seam holder.
  const backupFile = `${storeFile}.preimage-${plan.operationId}.bak`
  try {
    await withCredentialStoreLock(storeFile, storeWriteOptions, async (lock) => {
      copyFileSync(storeFile, backupFile)
      try { statSync(backupFile) } catch (error) { throw new Error(`rotation-seam: preimage backup missing after copy: ${error.message}`) }
      await replaceCredentialForAgent(storeFile, agentId, { clientId, clientSecret: newSecret }, { lock, ...storeWriteOptions })
    })
  } catch (swapError) {
    // Bounded recovery: restore the preimage store bytes; roll the DB back
    // through the same privileged channel; receipt records the path taken.
    let dbRolledBack = false
    let rollbackError
    let preimageSecret
    try {
      preimageSecret = preimageSecretFromStoreBackup(backupFile, agentId)
    } catch (error) { rollbackError = error }
    if (rollbackError === undefined) {
      try {
        await rollbackDbRotation({ clientId, preimageSecret, operationId: plan.operationId })
        dbRolledBack = true
      } catch (error) { rollbackError = error }
    }
    if (rollbackError === undefined) {
      try {
        await withCredentialStoreLock(storeFile, storeWriteOptions, () => {
          renameSync(backupFile, storeFile) // atomic restore of the preimage store
        })
      } catch (restoreError) {
        rollbackError = restoreError
      }
    }
    if (dbRolledBack) {
      const receipt = ledger.append({
        kind: 'rotation', ...plan,
        outcome: ROTATION_OUTCOMES.ROLLED_BACK,
        reason: `store swap failed: ${String(swapError?.message ?? swapError).slice(0, 160)}`,
        atMs: Date.now(),
      })
      const rolledBack = new Error(`rotation-seam: store swap failed — DB rolled back, preimage store restored; bounded recovery complete (${receipt.operationId})`)
      rolledBack.code = 'rotation_rolled_back'
      rolledBack.receipt = receipt
      throw rolledBack
    }
    const receipt = ledger.append({
      kind: 'rotation', ...plan,
      outcome: ROTATION_OUTCOMES.SPLIT_STATE_OPEN,
      reason: `store swap failed AND rollback incomplete — recovery available: preimage backup ${backupFile}; ${String(rollbackError?.message ?? rollbackError).slice(0, 160)}`,
      recovery: { backupFile, available: existsSync(backupFile) },
      atMs: Date.now(),
    })
    const split = new Error(`rotation-seam: SPLIT_STATE_OPEN — DB carries the new generation while the store could not be swapped; recovery artifacts recorded (${receipt.operationId})`)
    split.code = 'split_state_open'
    split.receipt = receipt
    throw split
  }

  // ── VERIFY: readback + MINT + REAL CALL ────────────────────────────────
  const reread = await readCredentialStoreDocument(storeFile)
  const readbackOk = reread.credentials?.[agentId]?.clientId === clientId
    && secretFingerprint(reread.credentials[agentId].clientSecret) === newStoreFingerprint
  const dbAfter = await readDbState()
  const dbReadbackOk = hashFingerprint(dbAfter.secretHash) === newDbFingerprint
  let mintOk = false
  let mintDetail = 'not_run'
  try {
    const mint = await mintVerify({ clientId, clientSecret: newSecret })
    mintOk = mint?.ok === true
    mintDetail = mint?.ok ? 'pass' : `status ${mint?.status ?? 'unknown'}`
  } catch (error) { mintDetail = String(error?.message ?? error).slice(0, 120) }
  let callOk = false
  let callDetail = 'not_configured'
  if (typeof realAuthCallVerify === 'function') {
    try {
      const call = await realAuthCallVerify({ clientId, clientSecret: newSecret })
      callOk = call?.ok === true
      callDetail = call?.ok ? 'pass' : String(call?.detail ?? 'failed').slice(0, 120)
    } catch (error) { callDetail = String(error?.message ?? error).slice(0, 120) }
  }

  const verifyComplete = readbackOk && dbReadbackOk && mintOk && callOk
  if (!verifyComplete) {
    const receipt = ledger.append({
      kind: 'rotation', ...plan,
      postimage: { dbHashFingerprint: newDbFingerprint, storeSecretFingerprint: newStoreFingerprint },
      outcome: ROTATION_OUTCOMES.VERIFY_INCOMPLETE,
      reason: `readbackOk=${readbackOk} dbReadbackOk=${dbReadbackOk} mint=${mintDetail} realCall=${callDetail}`,
      atMs: Date.now(),
    })
    const incomplete = new Error(`rotation-seam: VERIFY_INCOMPLETE — rotation applied but verification failed; receipt ${receipt.operationId} (reconciliation required)`)
    incomplete.code = 'verify_incomplete'
    incomplete.receipt = receipt
    throw incomplete
  }

  // ── RECEIPT ────────────────────────────────────────────────────────────
  const receipt = ledger.append({
    kind: 'rotation', ...plan,
    postimage: { dbHashFingerprint: newDbFingerprint, storeSecretFingerprint: newStoreFingerprint },
    phases: {
      apply: 'db+store',
      storeBackup: backupFile,
      readback: 'pass',
      mintVerify: mintDetail,
      realAuthCallVerify: callDetail,
    },
    outcome: ROTATION_OUTCOMES.COMPLETED,
    atMs: Date.now(),
  })
  log.log?.(`rotation-seam: rotation ${plan.operationId} COMPLETED for ${agentId} (${clientId})`)
  return { ok: true, replayed: false, outcome: ROTATION_OUTCOMES.COMPLETED, receipt, plan }
}

function defaultPrivilegedChannel(prerequisite, face) {
  return async () => {
    throw Object.assign(
      new Error(`rotation-seam: ${face} requires external prerequisite (${prerequisite}) — the privileged rotation channel is not configured in this deployment`),
      { code: 'external_prerequisite_missing', prerequisite },
    )
  }
}

function preimageSecretFromStoreBackup(backupFile, agentId) {
  // The preimage store backup holds the OLD secret value; the DB preimage
  // hash cannot be recomputed from it (one-way), so rollback hands the
  // channel the preimage SECRET and the channel re-hashes + fingerprint-
  // verifies against the PLAN preimage DB-side before rolling back.
  const doc = JSON.parse(readFileSync(backupFile, 'utf8'))
  const entry = doc.credentials?.[agentId]
  if (entry?.clientSecret === undefined) {
    throw new Error('rotation-seam: preimage backup lacks the agent entry')
  }
  return entry.clientSecret
}

/**
 * T11 guard (I.5): destructive proof rotations may target ONLY declared
 * fixture principals. Pure and synchronous so it fails BEFORE any mutation.
 */
export function assertFixtureRotationTarget({ agentId, fixtureAgentIds }) {
  if (typeof agentId !== 'string' || agentId === '') {
    throw new TypeError('rotation-seam: agentId is required')
  }
  if (!Array.isArray(fixtureAgentIds) || !fixtureAgentIds.includes(agentId)) {
    throw Object.assign(
      new Error(`rotation-seam: PRODUCTION_PROOF_MAY_ROTATE_ARBITRARY_BUSINESS_AGENT = NO — ${agentId} is not a declared fixture principal; destructive proof rotation refused before any mutation`),
      { code: 'production_proof_target_forbidden' },
    )
  }
}

/** Random operation id for callers that mint their own ( otherwise derived). */
export function mintOperationId() {
  return `rot-${randomUUID().replaceAll('-', '').slice(0, 24)}`
}
