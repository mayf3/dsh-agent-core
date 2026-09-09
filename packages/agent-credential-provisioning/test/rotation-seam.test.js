/**
 * AMENDMENT_7 L4 — rotation seam acceptance tests (T9/T10/T11/T12 + the
 * read-only consumption proof behind T1). Sandbox: fixture store + stub DB
 * channel + injected verify faces; NO real auth-service, NO production data.
 *
 *   T9  store-swap failure -> bounded recovery (DB rollback + preimage store
 *       restore; ROLLED_BACK receipt) — and when rollback cannot complete,
 *       SPLIT_STATE_OPEN is receipted loud; the inherited gate refuses any
 *       unreceipted generation advance on the next seam contact
 *   T10 same ROTATION_OPERATION_ID replay -> deterministic idempotent
 *       result, zero second mutation
 *   T11 p4-form proof against an ordinary business Agent -> fails BEFORE any
 *       mutation (fixture guard, I.5)
 *   T12 dedicated fixture rotation -> full chain PASS with COMPLETED receipt
 *   T1  the credential consumption path (broker gateway read) leaves the
 *       store byte-identical (boot/spawn read-only surface)
 *   red-line: secret bytes never enter receipts, errors, or argv (Part H)
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  assertFixtureRotationTarget,
  evaluateSeamGate,
  executeRotation,
  generateMachineSecret,
  hashFingerprint,
  hashMachineSecret,
  ROTATION_OUTCOMES,
  secretFingerprint,
} from '../src/rotation-seam.js'

const AGENT = 'agt_rotation-fixture-agent'
const BUSINESS_AGENT = 'agt_book-deconstructor-agent'
const CLIENT = 'mc_rotation_fixture_client'
const INITIAL_SECRET = 'initial-secret-material-0123456789abcdef'

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rotation-seam-'))
  const storeFile = join(dir, 'credentials.json')
  const receiptsFile = join(dir, 'rotation-receipts.jsonl')
  writeFileSync(storeFile, JSON.stringify({
    version: 1,
    credentials: { [AGENT]: { clientId: CLIENT, clientSecret: INITIAL_SECRET } },
  }), { mode: 0o600 })
  const db = {
    state: { clientId: CLIENT, secretHash: hashMachineSecret(INITIAL_SECRET, 'aabbccdd00112233') },
    applyCalls: 0,
    rollbackCalls: 0,
    applyFailure: undefined,
  }
  const channels = {
    readDbState: async () => ({ ...db.state }),
    applyDbRotation: async ({ clientId: c, newSecretHash }) => {
      if (db.applyFailure !== undefined) throw db.applyFailure
      db.applyCalls += 1
      db.state = { clientId: c, secretHash: newSecretHash }
    },
    rollbackDbRotation: async () => {
      db.rollbackCalls += 1
      db.state = { clientId: CLIENT, secretHash: hashMachineSecret(INITIAL_SECRET, 'aabbccdd00112233') }
    },
  }
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return { dir, storeFile, receiptsFile, db, channels }
}

function authorizedVerifyFaces() {
  return {
    mintVerify: async () => ({ ok: true, status: 200 }),
    realAuthCallVerify: async () => ({ ok: true, detail: 'pass' }),
  }
}

function ledgerLines(receiptsFile) {
  const raw = readFileSync(receiptsFile, 'utf8').trim()
  return raw === '' ? [] : raw.split('\n').map((l) => JSON.parse(l))
}

// ── T12 ───────────────────────────────────────────────────────────────────

test('T12: dedicated fixture rotation — full chain PASS, receipt COMPLETED, store swapped 0600, siblings preserved', async (t) => {
  const fx = fixture(t)
  writeFileSync(join(fx.dir, 'sibling.json'), '{}', { mode: 0o600 })

  const result = await executeRotation({
    agentId: AGENT,
    clientId: CLIENT,
    storeFile: fx.storeFile,
    receiptsFile: fx.receiptsFile,
    ...fx.channels,
    ...authorizedVerifyFaces(),
  })

  assert.equal(result.ok, true)
  assert.equal(result.replayed, false)
  assert.equal(result.outcome, ROTATION_OUTCOMES.COMPLETED)
  assert.equal(fx.db.applyCalls, 1)

  // store swapped: new secret, mode 0600, sibling preserved, preimage backup kept
  const doc = JSON.parse(readFileSync(fx.storeFile, 'utf8'))
  assert.notEqual(doc.credentials[AGENT].clientSecret, INITIAL_SECRET)
  assert.equal(statSync(fx.storeFile).mode & 0o777, 0o600)
  assert.ok(readdirSync(fx.dir).includes('sibling.json'), 'sibling entries preserved')
  const backup = readdirSync(fx.dir).find((f) => f.includes('.preimage-') && f.endsWith('.bak'))
  assert.ok(backup !== undefined, 'preimage backup artifact kept (bounded recovery)')

  // receipt: COMPLETED with preimage/postimage fingerprints and verify facts
  const receipt = ledgerLines(fx.receiptsFile).pop()
  assert.equal(receipt.outcome, ROTATION_OUTCOMES.COMPLETED)
  assert.match(receipt.preimage.dbHashFingerprint, /^hfp:[0-9a-f]{16}$/)
  assert.match(receipt.preimage.storeSecretFingerprint, /^fp:[0-9a-f]{16}$/)
  assert.match(receipt.postimage.dbHashFingerprint, /^hfp:[0-9a-f]{16}$/)
  assert.match(receipt.postimage.storeSecretFingerprint, /^fp:[0-9a-f]{16}$/)
  assert.equal(receipt.phases.readback, 'pass')
  assert.equal(receipt.phases.mintVerify, 'pass')
  assert.equal(receipt.phases.realAuthCallVerify, 'pass')
})

test('red-line: secret bytes never enter receipts, and the preimage backup stays 0600', async (t) => {
  const fx = fixture(t)
  const result = await executeRotation({
    agentId: AGENT, clientId: CLIENT, storeFile: fx.storeFile, receiptsFile: fx.receiptsFile,
    ...fx.channels, ...authorizedVerifyFaces(),
  })
  assert.equal(result.ok, true)
  const receiptRaw = readFileSync(fx.receiptsFile, 'utf8')
  const newSecret = JSON.parse(readFileSync(fx.storeFile, 'utf8')).credentials[AGENT].clientSecret
  assert.equal(receiptRaw.includes(newSecret), false, 'new secret not receipted')
  assert.equal(receiptRaw.includes(INITIAL_SECRET), false, 'preimage secret not receipted')
  const backup = readdirSync(fx.dir).find((f) => f.includes('.preimage-'))
  assert.equal(statSync(join(fx.dir, backup)).mode & 0o777, 0o600)
  // thrown envelopes never carry the secret either
  assert.equal(String(result.receipt?.reason ?? '').includes(newSecret), false)
})

// ── NOW fail-closed (the (e) boundary) ───────────────────────────────────

test('NOW fail-closed: APPLY without the (e) privileged channel refuses before ANY mutation and receipts the refusal', async (t) => {
  const fx = fixture(t)
  const before = readFileSync(fx.storeFile)
  await assert.rejects(
    () => executeRotation({
      agentId: AGENT,
      clientId: CLIENT,
      storeFile: fx.storeFile,
      receiptsFile: fx.receiptsFile,
      readDbState: fx.channels.readDbState,
      // applyDbRotation left at the DEFAULT (fail-loud (e))
    }),
    (error) => error.code === 'external_prerequisite_missing' && error.prerequisite === 'e',
  )
  assert.equal(fx.db.applyCalls, 0, 'zero DB mutation')
  assert.ok(before.equals(readFileSync(fx.storeFile)), 'zero store mutation')
  const receipt = ledgerLines(fx.receiptsFile).pop()
  assert.equal(receipt.outcome, ROTATION_OUTCOMES.REFUSED_EXTERNAL_PREREQUISITE)
})

// ── T10 ───────────────────────────────────────────────────────────────────

test('T10: same ROTATION_OPERATION_ID replay -> idempotent, zero second mutation', async (t) => {
  const fx = fixture(t)
  const operationId = 'rot-fixed-operation-id-0001'
  const first = await executeRotation({
    agentId: AGENT, clientId: CLIENT, storeFile: fx.storeFile, receiptsFile: fx.receiptsFile,
    operationId, ...fx.channels, ...authorizedVerifyFaces(),
  })
  assert.equal(first.ok, true)
  assert.equal(first.replayed, false)
  assert.equal(fx.db.applyCalls, 1)

  const second = await executeRotation({
    agentId: AGENT, clientId: CLIENT, storeFile: fx.storeFile, receiptsFile: fx.receiptsFile,
    operationId, ...fx.channels, ...authorizedVerifyFaces(),
  })
  assert.equal(second.ok, true)
  assert.equal(second.replayed, true, 'deterministic idempotent replay')
  assert.equal(second.receipt.operationId, operationId)
  assert.equal(fx.db.applyCalls, 1, 'no accidental second rotation')
  assert.equal(
    ledgerLines(fx.receiptsFile).filter((r) => r.outcome === ROTATION_OUTCOMES.COMPLETED).length,
    1,
    'exactly one COMPLETED receipt',
  )
})

// ── T9 ────────────────────────────────────────────────────────────────────

test('T9: store-swap failure -> bounded recovery rolls the DB back and receipts ROLLED_BACK', async (t) => {
  const fx = fixture(t)
  // Deterministic swap failure: the store write's beforeRename hook throws
  // AFTER the DB apply has succeeded (failure in the SWAP step, not APPLY).
  let threw
  try {
    await executeRotation({
      agentId: AGENT, clientId: CLIENT, storeFile: fx.storeFile, receiptsFile: fx.receiptsFile,
      ...fx.channels, ...authorizedVerifyFaces(),
      storeWriteOptions: {
        beforeRename: async () => {
          throw Object.assign(new Error('injected swap failure'), { code: 'CREDENTIALS_STORE_ERROR' })
        },
      },
    })
  } catch (error) { threw = error }

  assert.ok(threw !== undefined, 'the rotation fails loud when the store cannot be swapped')
  assert.equal(threw.code, 'rotation_rolled_back', `bounded recovery outcome (got ${threw.code}: ${threw.message})`)
  assert.equal(fx.db.rollbackCalls, 1, 'the DB was rolled back through the same channel')
  const outcomes = ledgerLines(fx.receiptsFile).map((r) => r.outcome)
  assert.ok(outcomes.includes(ROTATION_OUTCOMES.ROLLED_BACK), `ledger records the bounded path: ${outcomes.join(',')}`)
  // recovery completeness: DB back at the preimage generation, store bytes
  // restored — the next seam gate passes.
  assert.equal(fx.db.state.secretHash, hashMachineSecret(INITIAL_SECRET, 'aabbccdd00112233'))
  const gate = evaluateSeamGate({
    dbSecretHash: fx.db.state.secretHash,
    storeSecret: JSON.parse(readFileSync(fx.storeFile, 'utf8')).credentials[AGENT].clientSecret,
    receipts: ledgerLines(fx.receiptsFile),
  })
  assert.equal(gate.ok, true, 'no lingering split after bounded recovery')
})

test('T9b: rollback that cannot complete receipts SPLIT_STATE_OPEN loud (never silent)', async (t) => {
  const fx = fixture(t)
  let threw
  try {
    await executeRotation({
      agentId: AGENT, clientId: CLIENT, storeFile: fx.storeFile, receiptsFile: fx.receiptsFile,
      ...fx.channels,
      rollbackDbRotation: async () => { throw new Error('channel unavailable') },
      ...authorizedVerifyFaces(),
      storeWriteOptions: {
        beforeRename: async () => {
          throw Object.assign(new Error('injected swap failure'), { code: 'CREDENTIALS_STORE_ERROR' })
        },
      },
    })
  } catch (error) { threw = error }

  assert.ok(threw !== undefined, 'swap failure + rollback failure is loud')
  assert.equal(threw.code, 'split_state_open', `got ${threw.code}: ${threw.message}`)
  const split = ledgerLines(fx.receiptsFile).find((r) => r.outcome === ROTATION_OUTCOMES.SPLIT_STATE_OPEN)
  assert.ok(split !== undefined, 'SPLIT_STATE_OPEN receipted')
  assert.match(split.recovery.backupFile, /\.preimage-.*\.bak$/, 'recovery artifacts recorded in the receipt')
  // the inherited gate now refuses every further seam contact until
  // explicit reconciliation lands.
  const gate = evaluateSeamGate({
    dbSecretHash: fx.db.state.secretHash,
    storeSecret: JSON.parse(readFileSync(fx.storeFile, 'utf8')).credentials[AGENT].clientSecret,
    receipts: ledgerLines(fx.receiptsFile),
  })
  assert.equal(gate.ok, false)
  assert.equal(gate.code, 'unreconciled_rotation')
})

test('T9 inherited gate: an unreceipted DB generation advance refuses the next seam contact', async (t) => {
  const fx = fixture(t)
  // Crash-window simulation: DB advanced, store lags, no receipt exists.
  fx.db.state = { clientId: CLIENT, secretHash: hashMachineSecret('crashed-generation-secret', '1122334455667788') }
  const gate = evaluateSeamGate({
    dbSecretHash: fx.db.state.secretHash,
    storeSecret: INITIAL_SECRET,
    receipts: [],
  })
  assert.equal(gate.ok, false)
  assert.equal(gate.code, 'split_state_detected')

  let applied = 0
  await assert.rejects(
    () => executeRotation({
      agentId: AGENT, clientId: CLIENT, storeFile: fx.storeFile, receiptsFile: fx.receiptsFile,
      readDbState: fx.channels.readDbState,
      applyDbRotation: async () => { applied += 1 },
    }),
    (error) => error.code === 'split_state_detected',
  )
  assert.equal(applied, 0, 'gate refusal happens before any mutation')
  assert.ok(ledgerLines(fx.receiptsFile).some((r) => r.outcome === ROTATION_OUTCOMES.GATE_REFUSED))
})

// ── T11 ───────────────────────────────────────────────────────────────────

test('T11: p4-form proof against an ordinary business Agent fails BEFORE any mutation; fixture target passes', () => {
  assert.throws(
    () => assertFixtureRotationTarget({ agentId: BUSINESS_AGENT, fixtureAgentIds: [AGENT] }),
    (error) => error.code === 'production_proof_target_forbidden'
      && /PRODUCTION_PROOF_MAY_ROTATE_ARBITRARY_BUSINESS_AGENT = NO/.test(error.message),
  )
  assert.doesNotThrow(() => assertFixtureRotationTarget({ agentId: AGENT, fixtureAgentIds: [AGENT] }))
})

// ── T1 ────────────────────────────────────────────────────────────────────

test('T1: the credential consumption path reads the store and leaves it byte-identical', async (t) => {
  const fx = fixture(t)
  const { createBrokerGateway } = await import('../../broker/src/gateway.js')
  const manifest = (await import('../../broker/src/capabilities/workflow.js')).workflowMyTasksManifest
  const before = readFileSync(fx.storeFile)
  const statBefore = statSync(fx.storeFile)
  const gateway = createBrokerGateway({
    manifests: [manifest],
    targets: [],
    authServiceOrigin: 'http://127.0.0.1:1', // unreachable on purpose
    credentialsFile: fx.storeFile,
  })
  const result = await gateway.execute({ capabilityId: manifest.id, operation: 'list', args: { limit: 1 } }, { agentId: AGENT })
  assert.equal(result.ok, false, 'the call itself fails at the transport (unreachable origin)')
  const after = readFileSync(fx.storeFile)
  const statAfter = statSync(fx.storeFile)
  assert.ok(after.equals(before), 'store bytes unchanged by the consumption path')
  assert.equal(statAfter.mtimeMs, statBefore.mtimeMs, 'store mtime unchanged (no writes, no rewrites)')
})

// ── crypto format ─────────────────────────────────────────────────────────

test('generation helpers: auth secret.ts format round-trip', () => {
  const { secret, secretHash } = generateMachineSecret()
  assert.match(secret, /^[A-Za-z0-9_-]{43}$/)
  assert.match(secretHash, /^[0-9a-f]{32}:[0-9a-f]{128}$/)
  assert.equal(hashMachineSecret(secret, secretHash.split(':')[0]), secretHash)
})
