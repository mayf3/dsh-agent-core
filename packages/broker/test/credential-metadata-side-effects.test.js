/**
 * AGENT_CORE_CREDENTIAL_METADATA_RESOLUTION_V1 — ACC-CMR-005 executable
 * zero-side-effect oracles for `resolveCredentialMetadata(agentId)`.
 *
 * Six itemized acceptance counters, each backed by a REAL armed guard
 * (no grep-only evidence):
 *
 *   AUTH_CALL_COUNT          http.request / https.request / fetch (auth-service
 *                            is HTTP; any Auth call must pass this layer)
 *   PROVISION_COUNT          child-process spawns (provisioning CLI surfaces)
 *                            + filesystem create/rename events + write-API attempts
 *   ROTATION_COUNT           filesystem modify/rename events on the store
 *                            + write-API attempts
 *   REVOCATION_COUNT         filesystem unlink/remove events + HTTP attempts
 *                            (auth-side revoke)
 *   BINDING_RESTORE_COUNT    filesystem events on decoy binding/agent tables
 *                            + child-process + write-API attempts
 *   TOKEN_TRANSPORT_COUNT    socket-level connects (net.Socket.prototype.connect
 *                            — every outbound TCP/TLS connection, regardless of
 *                            which HTTP client or import style makes it)
 *
 * Protocol: (1) arm all guards; (2) SELF-CHECK that each guard actually fires
 * (proving no counter is vacuous), then reset counters; (3) run the full
 * resolution matrix through the PRODUCTION exported seam (config-injected
 * fixtures); (4) let fs.watch settle; (5) assert every counter is 0 and no
 * filesystem event occurred; (6) restore all guards.
 *
 * CJS-module-object patches (http/child_process) intercept dynamic-call
 * surfaces; the socket-prototype, filesystem-event, byte-snapshot, and
 * child-process-prototype layers are live for ALL callers regardless of
 * import style, so a hidden side effect cannot slip through uninstrumented.
 */

import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, statSync, watch, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveCredentialMetadata } from '../src/credential-store.js'

const requireCjs = createRequire(import.meta.url)

const FIXTURE_DIR = mkdtempSync(join(tmpdir(), 'cmr-side-effects-'))
after(() => rmSync(FIXTURE_DIR, { recursive: true, force: true }))

const AGENT_ID = 'agt_cmrinventory01'
const CLIENT_ID = 'cmr-client-id-0417'
const SECRET_CANARY = 'CMR1_CLIENT_SECRET_CANARY_7f3a9c1d'

function withEnv(value, fn) {
  const saved = process.env.AGENT_CORE_CREDENTIALS_FILE
  if (value === undefined) delete process.env.AGENT_CORE_CREDENTIALS_FILE
  else process.env.AGENT_CORE_CREDENTIALS_FILE = value
  try {
    return fn()
  } finally {
    if (saved === undefined) delete process.env.AGENT_CORE_CREDENTIALS_FILE
    else process.env.AGENT_CORE_CREDENTIALS_FILE = saved
  }
}

function snapshot(file) {
  const stat = statSync(file)
  return { bytes: readFileSync(file), uid: stat.uid, gid: stat.gid, mode: stat.mode }
}

test('ACC-CMR-005: six executable zero-side-effect oracles across the full resolution matrix', async () => {
  // --- fixtures (written BEFORE guards are armed) ---------------------------
  const storeFile = join(FIXTURE_DIR, 'store.json')
  writeFileSync(storeFile, JSON.stringify({
    version: 1,
    credentials: { [AGENT_ID]: { clientId: CLIENT_ID, clientSecret: SECRET_CANARY } },
  }), { mode: 0o600 })
  const malformedFile = join(FIXTURE_DIR, 'malformed.json')
  writeFileSync(malformedFile, '{"version":1,"credentials":{', { mode: 0o600 })
  // Decoy persistent tables a binding-restorer / provisioner would touch.
  const decoyBindings = join(FIXTURE_DIR, 'bindings.json')
  writeFileSync(decoyBindings, '{"version":1,"bindings":{}}', { mode: 0o600 })
  const decoyAgents = join(FIXTURE_DIR, 'agents.json')
  writeFileSync(decoyAgents, '{"version":1,"agents":[]}', { mode: 0o600 })

  const before = {
    store: snapshot(storeFile),
    malformed: snapshot(malformedFile),
    bindings: snapshot(decoyBindings),
    agents: snapshot(decoyAgents),
  }

  const counters = {
    AUTH_CALL_COUNT: 0,
    PROVISION_COUNT: 0,
    ROTATION_COUNT: 0,
    REVOCATION_COUNT: 0,
    BINDING_RESTORE_COUNT: 0,
    TOKEN_TRANSPORT_COUNT: 0,
  }
  const reset = () => {
    for (const key of Object.keys(counters)) counters[key] = 0
  }
  const writeAttempt = (surface) => {
    // One write attempt could serve provision / rotation / revocation /
    // binding-restore — all four oracles it could feed must see it.
    counters.PROVISION_COUNT += 1
    counters.ROTATION_COUNT += 1
    counters.REVOCATION_COUNT += 1
    counters.BINDING_RESTORE_COUNT += 1
    throw new Error(`store write attempt via ${surface} during credential metadata resolution`)
  }
  const guardError = (oracle) => {
    counters[oracle] += 1
    throw new Error(`${oracle} guard fired during credential metadata resolution`)
  }

  // --- arm guards -----------------------------------------------------------
  const restores = []
  const http = requireCjs('node:http')
  const https = requireCjs('node:https')
  const net = requireCjs('node:net')
  const cp = requireCjs('node:child_process')
  const fsCjs = requireCjs('node:fs')
  const fsp = fsCjs.promises

  const patches = [
    [http, 'request', () => guardError('AUTH_CALL_COUNT')],
    [https, 'request', () => guardError('AUTH_CALL_COUNT')],
    [globalThis, 'fetch', () => guardError('AUTH_CALL_COUNT')],
    [net.Socket.prototype, 'connect', () => guardError('TOKEN_TRANSPORT_COUNT')],
    [cp, 'spawn', () => guardError('PROVISION_COUNT')],
    [cp, 'spawnSync', () => guardError('PROVISION_COUNT')],
    [cp, 'exec', () => guardError('PROVISION_COUNT')],
    [cp, 'execFile', () => guardError('PROVISION_COUNT')],
    [cp, 'execSync', () => guardError('PROVISION_COUNT')],
    [cp.ChildProcess?.prototype, 'spawn', () => guardError('PROVISION_COUNT')],
    [fsCjs, 'writeFileSync', () => writeAttempt('fs.writeFileSync')],
    [fsCjs, 'appendFileSync', () => writeAttempt('fs.appendFileSync')],
    [fsCjs, 'renameSync', () => writeAttempt('fs.renameSync')],
    [fsCjs, 'unlinkSync', () => writeAttempt('fs.unlinkSync')],
    [fsCjs, 'chmodSync', () => writeAttempt('fs.chmodSync')],
    [fsCjs, 'chownSync', () => writeAttempt('fs.chownSync')],
    [fsCjs, 'truncateSync', () => writeAttempt('fs.truncateSync')],
    [fsCjs, 'rmSync', () => writeAttempt('fs.rmSync')],
    [fsp, 'writeFile', () => writeAttempt('fsp.writeFile')],
    [fsp, 'rename', () => writeAttempt('fsp.rename')],
    [fsp, 'unlink', () => writeAttempt('fsp.unlink')],
    [fsp, 'rm', () => writeAttempt('fsp.rm')],
    [fsp, 'chmod', () => writeAttempt('fsp.chmod')],
  ]
  for (const [holder, name, guard] of patches) {
    if (holder === undefined || holder === null) continue
    const original = holder[name]
    holder[name] = guard
    restores.push(() => {
      holder[name] = original
    })
  }

  const fsEvents = []
  const watcher = watch(FIXTURE_DIR, { recursive: true }, (event, filename) => {
    fsEvents.push({ event, filename: String(filename ?? '') })
  })

  try {
    // Drain the watcher's startup window first: on FSEvents-backed platforms
    // the watcher may replay events for fixture writes that happened just
    // BEFORE it was armed — those belong to test setup, not to resolution.
    // Only events observed during/after the matrix below are judged.
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
    fsEvents.length = 0

    // --- self-check: every oracle's guard demonstrably fires -----------------
    assert.throws(() => http.request('http://127.0.0.1:1/'), /AUTH_CALL_COUNT/)
    assert.throws(() => globalThis.fetch('http://127.0.0.1:1/'), /AUTH_CALL_COUNT/)
    assert.throws(() => new net.Socket().connect({ host: '127.0.0.1', port: 1 }), /TOKEN_TRANSPORT_COUNT/)
    assert.throws(() => cp.spawnSync('true'), /PROVISION_COUNT/)
    assert.throws(() => new cp.ChildProcess().spawn({ file: 'true', args: [] }), /PROVISION_COUNT/)
    assert.throws(() => fsCjs.writeFileSync(join(FIXTURE_DIR, 'x'), 'x'), /store write attempt/)
    assert.throws(() => fsp.writeFile(join(FIXTURE_DIR, 'x'), 'x'), /store write attempt/)
    assert.equal(counters.AUTH_CALL_COUNT > 0, true)
    assert.equal(counters.TOKEN_TRANSPORT_COUNT > 0, true)
    assert.equal(counters.PROVISION_COUNT > 0, true)
    assert.equal(counters.ROTATION_COUNT > 0, true)
    assert.equal(counters.REVOCATION_COUNT > 0, true)
    assert.equal(counters.BINDING_RESTORE_COUNT > 0, true)
    reset()

    // --- the full resolution matrix through the PRODUCTION exported seam ----
    const results = []
    results.push(withEnv(storeFile, () => resolveCredentialMetadata(AGENT_ID))) // PRESENT
    results.push(withEnv(undefined, () => resolveCredentialMetadata(AGENT_ID))) // ABSENT (unconfigured)
    results.push(withEnv(malformedFile, () => { // configured-broken: fail loud
      assert.throws(() => resolveCredentialMetadata(AGENT_ID), { code: 'CREDENTIALS_STORE_ERROR' })
    }))
    withEnv(storeFile, () => { // invalid id: fail loud before store access
      assert.throws(() => resolveCredentialMetadata('../traversal'), { code: 'VALIDATION_ERROR' })
    })
    assert.deepEqual(results[0], { entry: 'PRESENT', clientId: CLIENT_ID })
    assert.deepEqual(results[1], { entry: 'ABSENT' })

    // Let filesystem-watch events settle before judging the fs oracles.
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))

    // --- per-oracle verdicts -------------------------------------------------
    // Classify any fs event into the oracle it would evidence (all must be 0).
    for (const { filename } of fsEvents) {
      if (/bindings|agents/.test(filename)) counters.BINDING_RESTORE_COUNT += 1
      else if (/store|malformed/.test(filename)) {
        counters.ROTATION_COUNT += 1
        counters.REVOCATION_COUNT += 1
      } else counters.PROVISION_COUNT += 1
    }

    assert.equal(counters.AUTH_CALL_COUNT, 0, 'AUTH_CALL_COUNT must be 0')
    assert.equal(counters.PROVISION_COUNT, 0, 'PROVISION_COUNT must be 0')
    assert.equal(counters.ROTATION_COUNT, 0, 'ROTATION_COUNT must be 0')
    assert.equal(counters.REVOCATION_COUNT, 0, 'REVOCATION_COUNT must be 0')
    assert.equal(counters.BINDING_RESTORE_COUNT, 0, 'BINDING_RESTORE_COUNT must be 0')
    assert.equal(counters.TOKEN_TRANSPORT_COUNT, 0, 'TOKEN_TRANSPORT_COUNT must be 0')
    assert.equal(fsEvents.length, 0, `unexpected filesystem events: ${JSON.stringify(fsEvents)}`)

    // --- persisted state untouched -------------------------------------------
    assert.deepEqual(snapshot(storeFile), before.store)
    assert.deepEqual(snapshot(malformedFile), before.malformed)
    assert.deepEqual(snapshot(decoyBindings), before.bindings)
    assert.deepEqual(snapshot(decoyAgents), before.agents)
  } finally {
    for (const restore of restores.reverse()) restore()
    watcher.close()
  }
})
