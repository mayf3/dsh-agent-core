/**
 * AGENT_CORE_CREDENTIAL_METADATA_RESOLUTION_V1 — core unit acceptance for
 * the redacted read-only resolution seam `resolveCredentialMetadata(agentId)`
 * (packages/broker/src/credential-store.js, trusted-parent boundary):
 * ACC-CMR-001 PRESENT, ACC-CMR-002 ABSENT, ACC-CMR-003 fail-loud store
 * errors + canary non-disclosure, ACC-CMR-004 store immutability.
 *
 * The exported seam takes ONLY agentId; the store path comes exclusively
 * from the trusted-parent configuration authority
 * (process.env.AGENT_CORE_CREDENTIALS_FILE). Tests inject fixtures through
 * THAT authority only (test-only construction; no seam parameter exists).
 *
 * "Store access counter" note: STORE_ACCESS_COUNT = 0 is proven behaviorally
 * (see credential-metadata-seam.test.js): store paths are placed where ANY
 * access attempt observably produces a CREDENTIALS_STORE_ERROR, so asserting
 * the authority's VALIDATION_ERROR proves no access happened first.
 */

import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CREDENTIALS_STORE_ERROR, resolveCredentialMetadata } from '../src/credential-store.js'

const FIXTURE_DIR = mkdtempSync(join(tmpdir(), 'cmr-core-'))
after(() => rmSync(FIXTURE_DIR, { recursive: true, force: true }))

/** Unique canaries embedded in store fixtures; must never surface anywhere. */
const SECRET_CANARY = 'CMR1_CLIENT_SECRET_CANARY_7f3a9c1d'
const TOKEN_CANARY = 'CMR1_TOKEN_CANARY_2b8e4106'
const PASSWORD_CANARY = 'CMR1_PASSWORD_CANARY_5d1f07aa'
const CANARIES = [SECRET_CANARY, TOKEN_CANARY, PASSWORD_CANARY]

const AGENT_ID = 'agt_cmrinventory01'
const OTHER_AGENT_ID = 'agt_cmrotheragent02'
const CLIENT_ID = 'cmr-client-id-0417'

let fixtureCounter = 0

/** Write one fixture store document (0600, like the deployment store). */
function writeStore(doc) {
  const file = join(FIXTURE_DIR, `store-${String(fixtureCounter++).padStart(3, '0')}.json`)
  writeFileSync(file, JSON.stringify(doc), { mode: 0o600 })
  return file
}

function validDoc() {
  return {
    version: 1,
    credentials: { [AGENT_ID]: { clientId: CLIENT_ID, clientSecret: SECRET_CANARY } },
  }
}

/**
 * Test-only construction: run the PRODUCTION exported seam with the trusted
 * configuration authority (AGENT_CORE_CREDENTIALS_FILE) pointing at the
 * fixture path for the duration of one call, restoring the prior process
 * environment afterwards.
 */
function resolveViaConfig(storeFile, agentId) {
  const saved = process.env.AGENT_CORE_CREDENTIALS_FILE
  if (storeFile === undefined) delete process.env.AGENT_CORE_CREDENTIALS_FILE
  else process.env.AGENT_CORE_CREDENTIALS_FILE = storeFile
  try {
    return resolveCredentialMetadata(agentId)
  } finally {
    if (saved === undefined) delete process.env.AGENT_CORE_CREDENTIALS_FILE
    else process.env.AGENT_CORE_CREDENTIALS_FILE = saved
  }
}

/** Snapshot the immutability-contract state (bytes + uid/gid/mode) of a file. */
function snapshot(file) {
  const stat = statSync(file)
  return { bytes: readFileSync(file), uid: stat.uid, gid: stat.gid, mode: stat.mode }
}

/** Capture ALL observable console output around fn (forwarded, not swallowed). */
function observed(fn) {
  const chunks = []
  const originals = {
    out: process.stdout.write.bind(process.stdout),
    err: process.stderr.write.bind(process.stderr),
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  }
  const recordArgs = (...args) => {
    chunks.push(args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' '))
  }
  process.stdout.write = (chunk, ...rest) => {
    chunks.push(String(chunk))
    return originals.out(chunk, ...rest)
  }
  process.stderr.write = (chunk, ...rest) => {
    chunks.push(String(chunk))
    return originals.err(chunk, ...rest)
  }
  console.log = console.info = console.warn = console.error = console.debug = recordArgs
  try {
    const value = fn()
    return { value, error: undefined, output: release(chunks, originals) }
  } catch (error) {
    return { value: undefined, error, output: release(chunks, originals) }
  }
}

function release(chunks, originals) {
  process.stdout.write = originals.out
  process.stderr.write = originals.err
  console.log = originals.log
  console.info = originals.info
  console.warn = originals.warn
  console.error = originals.error
  console.debug = originals.debug
  return chunks.join('')
}

function safeStringify(value) {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

/** Assert no canary appears in any caller-visible surface of one observed run. */
function assertNoCanary({ value, error, output }) {
  const surfaces = [output]
  if (value !== undefined) surfaces.push(safeStringify(value))
  if (error !== undefined) {
    surfaces.push(String(error?.message ?? error))
    surfaces.push(String(error?.stack ?? ''))
  }
  for (const surface of surfaces) {
    for (const canary of CANARIES) {
      assert.ok(!surface.includes(canary), `canary leaked into an observable surface: ${canary}`)
    }
  }
}

// ---------------------------------------------------------------------------
// ACC-CMR-001 — PRESENT returns only clientId
// ---------------------------------------------------------------------------

test('PRESENT: closed result {entry, clientId} from a valid entry, canary excluded', () => {
  const storeFile = writeStore(validDoc())
  const before = snapshot(storeFile)
  const { value, error, output } = observed(() => resolveViaConfig(storeFile, AGENT_ID))
  assert.ifError(error)
  assert.deepEqual(value, { entry: 'PRESENT', clientId: CLIENT_ID })
  assert.deepEqual(Object.keys(value).sort(), ['clientId', 'entry'])
  assertNoCanary({ value, error, output })
  assert.deepEqual(snapshot(storeFile), before)
})

test('PRESENT: canonical generated id shape (agt_ + 32 hex) resolves', () => {
  const generatedShape = 'agt_0f1e23a4b5c6d7e8f9a0b1c2d3e4f5a6'
  const storeFile = writeStore({
    version: 1,
    credentials: { [generatedShape]: { clientId: CLIENT_ID, clientSecret: SECRET_CANARY } },
  })
  const before = snapshot(storeFile)
  const { value, error, output } = observed(() => resolveViaConfig(storeFile, generatedShape))
  assert.ifError(error)
  assert.deepEqual(value, { entry: 'PRESENT', clientId: CLIENT_ID })
  assertNoCanary({ value, error, output })
  assert.deepEqual(snapshot(storeFile), before)
})

test('PRESENT: extra canary-bearing fields on a store entry never surface (closed projection)', () => {
  const storeFile = writeStore({
    version: 1,
    credentials: {
      [AGENT_ID]: {
        clientId: CLIENT_ID,
        clientSecret: SECRET_CANARY,
        token: TOKEN_CANARY,
        password: PASSWORD_CANARY,
      },
    },
  })
  const before = snapshot(storeFile)
  const { value, error, output } = observed(() => resolveViaConfig(storeFile, AGENT_ID))
  assert.ifError(error)
  // Existing V1 entry semantics accept the entry; the projection returns
  // ONLY the non-secret clientId — none of the canary values.
  assert.deepEqual(value, { entry: 'PRESENT', clientId: CLIENT_ID })
  assertNoCanary({ value, error, output })
  assert.deepEqual(snapshot(storeFile), before)
})

// ---------------------------------------------------------------------------
// ACC-CMR-002 — ABSENT is explicit (unconfigured store AND absent exact key)
// ---------------------------------------------------------------------------

test('ABSENT: unconfigured store (env unset) returns exactly {entry:ABSENT}', () => {
  const { value, error, output } = observed(() => resolveViaConfig(undefined, AGENT_ID))
  assert.ifError(error)
  assert.deepEqual(value, { entry: 'ABSENT' })
  assert.equal('clientId' in value, false)
  assert.equal(value.clientId, undefined)
  assertNoCanary({ value, error, output })
})

test('ABSENT: unconfigured store (empty string config) returns exactly {entry:ABSENT}', () => {
  const { value, error } = observed(() => resolveViaConfig('', AGENT_ID))
  assert.ifError(error)
  assert.deepEqual(value, { entry: 'ABSENT' })
  assert.equal('clientId' in value, false)
})

test('ABSENT: valid configured store without the exact key returns exactly {entry:ABSENT}', () => {
  const storeFile = writeStore({
    version: 1,
    credentials: { [OTHER_AGENT_ID]: { clientId: 'other-client', clientSecret: SECRET_CANARY } },
  })
  const before = snapshot(storeFile)
  const { value, error, output } = observed(() => resolveViaConfig(storeFile, AGENT_ID))
  assert.ifError(error)
  assert.deepEqual(value, { entry: 'ABSENT' })
  assert.equal('clientId' in value, false)
  assertNoCanary({ value, error, output })
  assert.deepEqual(snapshot(storeFile), before)
})

// ---------------------------------------------------------------------------
// ACC-CMR-003 — configured-but-broken store fails loud, never ABSENT, no canary
// ---------------------------------------------------------------------------

test('malformed JSON store: CREDENTIALS_STORE_ERROR, canary-free, store unchanged', () => {
  const storeFile = join(FIXTURE_DIR, `malformed-${fixtureCounter++}.json`)
  writeFileSync(
    storeFile,
    `{"version":1,"credentials":{"${AGENT_ID}":{"clientId":"${CLIENT_ID}","clientSecret":"${SECRET_CANARY}"`,
    { mode: 0o600 },
  )
  const before = snapshot(storeFile)
  const { value, error, output } = observed(() => resolveViaConfig(storeFile, AGENT_ID))
  assert.ok(error instanceof Error)
  assert.equal(error.code, CREDENTIALS_STORE_ERROR)
  assert.equal(value, undefined)
  assertNoCanary({ value, error, output })
  assert.deepEqual(snapshot(storeFile), before)
})

test('unsupported store version: CREDENTIALS_STORE_ERROR, never ABSENT', () => {
  const storeFile = writeStore({
    version: 99,
    credentials: { [AGENT_ID]: { clientId: CLIENT_ID, clientSecret: SECRET_CANARY } },
  })
  const before = snapshot(storeFile)
  const { value, error, output } = observed(() => resolveViaConfig(storeFile, AGENT_ID))
  assert.ok(error instanceof Error)
  assert.equal(error.code, CREDENTIALS_STORE_ERROR)
  assert.equal(value, undefined)
  assertNoCanary({ value, error, output })
  assert.deepEqual(snapshot(storeFile), before)
})

test('malformed entry (missing clientSecret / missing clientId): CREDENTIALS_STORE_ERROR, canary-free', () => {
  const storeFile = writeStore({
    version: 1,
    credentials: {
      [AGENT_ID]: { clientId: CLIENT_ID },
      [OTHER_AGENT_ID]: { clientSecret: SECRET_CANARY },
    },
  })
  const before = snapshot(storeFile)
  const { value, error, output } = observed(() => resolveViaConfig(storeFile, AGENT_ID))
  assert.ok(error instanceof Error)
  assert.equal(error.code, CREDENTIALS_STORE_ERROR)
  assert.equal(value, undefined)
  assertNoCanary({ value, error, output })
  assert.deepEqual(snapshot(storeFile), before)
})

test('permission failure (mode 0000 store): CREDENTIALS_STORE_ERROR, not ABSENT, mode not repaired', () => {
  const storeFile = writeStore(validDoc())
  const bytesBefore = readFileSync(storeFile)
  chmodSync(storeFile, 0o000)
  try {
    const statDuring = statSync(storeFile)
    const { value, error, output } = observed(() => resolveViaConfig(storeFile, AGENT_ID))
    assert.ok(error instanceof Error)
    assert.equal(error.code, CREDENTIALS_STORE_ERROR)
    assert.equal(value, undefined)
    assertNoCanary({ value, error, output })
    // The seam must not chmod/chown/repair what it found.
    const statAfter = statSync(storeFile)
    assert.equal(statAfter.mode, statDuring.mode)
    assert.equal(statAfter.uid, statDuring.uid)
    assert.equal(statAfter.gid, statDuring.gid)
  } finally {
    chmodSync(storeFile, 0o600)
  }
  assert.deepEqual(readFileSync(storeFile), bytesBefore)
})

test('store path is a directory: CREDENTIALS_STORE_ERROR (read-failure family)', () => {
  const dir = join(FIXTURE_DIR, `asdir-${fixtureCounter++}`)
  mkdirSync(dir)
  assert.throws(() => resolveViaConfig(dir, AGENT_ID), (error) => {
    assert.equal(error.code, CREDENTIALS_STORE_ERROR)
    return true
  })
})

test('missing configured store file: CREDENTIALS_STORE_ERROR, never ABSENT', () => {
  const missing = join(FIXTURE_DIR, `not-there-${fixtureCounter++}.json`)
  assert.throws(() => resolveViaConfig(missing, AGENT_ID), (error) => {
    assert.equal(error.code, CREDENTIALS_STORE_ERROR)
    return true
  })
})

test('relative path in trusted configuration fails loud (absolute-path rule)', () => {
  assert.throws(() => resolveViaConfig('relative/store.json', AGENT_ID), (error) => {
    assert.equal(error.code, CREDENTIALS_STORE_ERROR)
    return true
  })
})

// ---------------------------------------------------------------------------
// ACC-CMR-004 — store bytes / uid / gid / mode immutable across every path
// ---------------------------------------------------------------------------

test('immutability matrix: PRESENT, ABSENT, and failure paths leave fixtures byte-identical', () => {
  const presentFile = writeStore(validDoc())
  const absentFile = writeStore({ version: 1, credentials: {} })
  const malformedFile = writeStore({ version: 1, credentials: { [AGENT_ID]: { clientId: '' } } })
  const versionFile = writeStore({ version: 2, credentials: { [AGENT_ID]: { clientId: CLIENT_ID, clientSecret: SECRET_CANARY } } })

  const before = {
    present: snapshot(presentFile),
    absent: snapshot(absentFile),
    malformed: snapshot(malformedFile),
    version: snapshot(versionFile),
  }

  observed(() => resolveViaConfig(presentFile, AGENT_ID))
  assert.deepEqual(snapshot(presentFile), before.present)
  observed(() => resolveViaConfig(absentFile, AGENT_ID))
  assert.deepEqual(snapshot(absentFile), before.absent)
  assert.throws(() => resolveViaConfig(malformedFile, AGENT_ID))
  assert.deepEqual(snapshot(malformedFile), before.malformed)
  assert.throws(() => resolveViaConfig(versionFile, AGENT_ID))
  assert.deepEqual(snapshot(versionFile), before.version)
  // uid/gid/mode equality is asserted inside every deepEqual(snapshot) above.
})
