/**
 * AGENT_CORE_CREDENTIAL_METADATA_RESOLUTION_V1 — unit acceptance for the
 * redacted read-only resolution seam `resolveCredentialMetadata()`
 * (packages/broker/src/credential-store.js, trusted-parent boundary).
 *
 * STORE_ACCESS_COUNT instrumentation note: `mock.module` is
 * experimental-flag-gated and unavailable under the repo's plain
 * `node --test`, so STORE_ACCESS_COUNT = 0 is proven behaviorally — strictly
 * stronger than a seam-level counter: every invalid-id case runs against
 * store paths where ANY access attempt (existsSync / readFileSync) observably
 * produces a `CREDENTIALS_STORE_ERROR` (missing file / EACCES under a
 * mode-0000 directory). If any store access preceded id validation, the
 * thrown code would be CREDENTIALS_STORE_ERROR; asserting the Agent
 * Definition authority's VALIDATION_ERROR instead proves no store access
 * happened, on the real filesystem rather than through a mocked seam.
 */

import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CREDENTIALS_STORE_ERROR, resolveCredentialMetadata } from '../src/credential-store.js'
import { normalizeAgentId } from '../../agent-definition/src/definition.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const FIXTURE_DIR = mkdtempSync(join(tmpdir(), 'cmr-credential-metadata-'))
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

/** Snapshot the immutability-contract state (bytes + uid/gid/mode) of a file. */
function snapshot(file) {
  const stat = statSync(file)
  return { bytes: readFileSync(file), uid: stat.uid, gid: stat.gid, mode: stat.mode }
}

/**
 * Capture ALL observable console output around fn (stdout/stderr writes and
 * console.* — forwarded to the originals so nothing is swallowed), then
 * return { value, error, output }.
 */
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
  const forward = (channel) => (chunk, ...rest) => {
    chunks.push(String(chunk))
    return channel(chunk, ...rest)
  }
  const recordArgs = (...args) => {
    chunks.push(args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' '))
  }
  const stdoutWrite = forward(originals.out)
  const stderrWrite = forward(originals.err)
  process.stdout.write = stdoutWrite
  process.stderr.write = stderrWrite
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
  const { value, error, output } = observed(() => resolveCredentialMetadata(storeFile, AGENT_ID))
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
  const { value, error, output } = observed(() => resolveCredentialMetadata(storeFile, generatedShape))
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
  const { value, error, output } = observed(() => resolveCredentialMetadata(storeFile, AGENT_ID))
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

test('ABSENT: unconfigured store (undefined) returns exactly {entry:ABSENT}', () => {
  const { value, error, output } = observed(() => resolveCredentialMetadata(undefined, AGENT_ID))
  assert.ifError(error)
  assert.deepEqual(value, { entry: 'ABSENT' })
  assert.equal('clientId' in value, false)
  assert.equal(value.clientId, undefined)
  assertNoCanary({ value, error, output })
})

test('ABSENT: unconfigured store (empty string) returns exactly {entry:ABSENT}', () => {
  const { value, error } = observed(() => resolveCredentialMetadata('', AGENT_ID))
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
  const { value, error, output } = observed(() => resolveCredentialMetadata(storeFile, AGENT_ID))
  assert.ifError(error)
  assert.deepEqual(value, { entry: 'ABSENT' })
  assert.equal('clientId' in value, false)
  assertNoCanary({ value, error, output })
  assert.deepEqual(snapshot(storeFile), before)
})

// ---------------------------------------------------------------------------
// ACC-CMR-006 — invalid and traversal-shaped ids fail loud BEFORE store access
// ---------------------------------------------------------------------------

const INVALID_IDS = [
  undefined,
  null,
  42,
  true,
  {},
  [],
  '',
  'agent1', // no agt_ prefix
  'AGT_uppercase', // wrong prefix case
  'agt_', // empty payload
  ' agt_leading', // leading whitespace
  'agt_trailing ', // trailing whitespace
  'agt_a b', // inner whitespace
  'agt_a\tb', // tab
  'agt_a/b', // slash-bearing id
  '/etc/passwd', // bare path
  '../traversal', // traversal
  'agt_../x', // traversal behind a valid-looking prefix
  '..\\..\\windows', // backslash traversal
  'agt_a\\b', // backslash-bearing id
  'agt_a.b', // dot payload
  'agt_a\0b', // NUL byte
]

function describeInvalid(id) {
  if (typeof id === 'string') return JSON.stringify(id.length > 24 ? `${id.slice(0, 24)}…` : id)
  return `${safeStringify(id)} (${typeof id})`
}

for (const invalidId of INVALID_IDS) {
  test(`invalid id ${describeInvalid(invalidId)}: fails loud pre-store (any access on a blocked dir would yield a store error)`, () => {
    const blockedDir = join(FIXTURE_DIR, `blocked-${fixtureCounter++}`)
    mkdirSync(blockedDir, { mode: 0o700 })
    const storeFile = join(blockedDir, 'store.json')
    writeFileSync(storeFile, JSON.stringify(validDoc()), { mode: 0o600 })
    const bytesBefore = readFileSync(storeFile)
    chmodSync(blockedDir, 0o000)
    try {
      // The store path CANNOT be accessed (parent dir mode 0000): a
      // store-first implementation would throw CREDENTIALS_STORE_ERROR
      // (EACCES -> "not found"). The seam must throw the authority's
      // VALIDATION_ERROR instead => STORE_ACCESS_COUNT = 0.
      assert.throws(() => resolveCredentialMetadata(storeFile, invalidId), (error) => {
        assert.equal(error.code, 'VALIDATION_ERROR')
        assert.notEqual(error.code, CREDENTIALS_STORE_ERROR)
        return true
      })
    } finally {
      chmodSync(blockedDir, 0o700)
    }
    assert.deepEqual(readFileSync(storeFile), bytesBefore)
    rmSync(blockedDir, { recursive: true, force: true })
  })

  test(`invalid id ${describeInvalid(invalidId)}: fails loud pre-store (missing configured store)`, () => {
    const missing = join(FIXTURE_DIR, `missing-${fixtureCounter++}.json`)
    assert.throws(() => resolveCredentialMetadata(missing, invalidId), (error) => {
      assert.equal(error.code, 'VALIDATION_ERROR')
      assert.notEqual(error.code, CREDENTIALS_STORE_ERROR)
      return true
    })
  })
}

test('invalid ids fail loud even with NO store configured (id validation is unconditional)', () => {
  for (const invalidId of ['', 'not-agt', '../x', 7, null]) {
    assert.throws(() => resolveCredentialMetadata(undefined, invalidId), (error) => {
      assert.equal(error.code, 'VALIDATION_ERROR')
      return true
    })
  }
})

test('the seam inherits the Agent Definition validator verbatim (same grammar, same error family)', () => {
  for (const id of ['agt_ok', AGENT_ID, 'agt_0f1e23a4b5c6d7e8f9a0b1c2d3e4f5a6']) {
    assert.equal(normalizeAgentId(id), id)
  }
  for (const id of ['agt_a/b', 'agt_a\\b', 'agt_..', 'nope', '', undefined]) {
    assert.throws(() => normalizeAgentId(id), { code: 'VALIDATION_ERROR' })
    assert.throws(() => resolveCredentialMetadata(undefined, id), { code: 'VALIDATION_ERROR' })
  }
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
  const { value, error, output } = observed(() => resolveCredentialMetadata(storeFile, AGENT_ID))
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
  const { value, error, output } = observed(() => resolveCredentialMetadata(storeFile, AGENT_ID))
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
  const { value, error, output } = observed(() => resolveCredentialMetadata(storeFile, AGENT_ID))
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
    const { value, error, output } = observed(() => resolveCredentialMetadata(storeFile, AGENT_ID))
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
  assert.throws(() => resolveCredentialMetadata(dir, AGENT_ID), (error) => {
    assert.equal(error.code, CREDENTIALS_STORE_ERROR)
    return true
  })
})

test('missing configured store file: CREDENTIALS_STORE_ERROR, never ABSENT', () => {
  const missing = join(FIXTURE_DIR, `not-there-${fixtureCounter++}.json`)
  assert.throws(() => resolveCredentialMetadata(missing, AGENT_ID), (error) => {
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

  const before = { present: snapshot(presentFile), absent: snapshot(absentFile), malformed: snapshot(malformedFile), version: snapshot(versionFile) }

  observed(() => resolveCredentialMetadata(presentFile, AGENT_ID))
  assert.deepEqual(snapshot(presentFile), before.present)
  observed(() => resolveCredentialMetadata(absentFile, AGENT_ID))
  assert.deepEqual(snapshot(absentFile), before.absent)
  assert.throws(() => resolveCredentialMetadata(malformedFile, AGENT_ID))
  assert.deepEqual(snapshot(malformedFile), before.malformed)
  assert.throws(() => resolveCredentialMetadata(versionFile, AGENT_ID))
  assert.deepEqual(snapshot(versionFile), before.version)
  // uid/gid/mode equality is asserted inside every deepEqual(snapshot) above.
})

// ---------------------------------------------------------------------------
// ACC-CMR-001 / ACC-CMR-005 (structural) — the inventory path never calls
// loadCredentialFor(); the seam is wired to NO caller (no tool / RPC /
// router / child registration — caller adoption is a separate reviewed change)
// ---------------------------------------------------------------------------

test('structural: the metadata seam reuses the document loader, never loadCredentialFor()', () => {
  const source = readFileSync(join(REPO, 'packages', 'broker', 'src', 'credential-store.js'), 'utf8')
  const seamStart = source.indexOf('export function resolveCredentialMetadata')
  assert.ok(seamStart >= 0)
  const seamBody = source.slice(seamStart)
  assert.ok(!seamBody.includes('loadCredentialFor('), 'inventory path must not call loadCredentialFor()')
  assert.ok(seamBody.includes('loadCredentialsStore('), 'full V1 document validation must be reused')
})

test('structural: the seam is referenced nowhere else (no exposure wiring)', () => {
  const references = []
  const seamFile = join(REPO, 'packages', 'broker', 'src', 'credential-store.js')
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (/\.(js|mjs|ts)$/.test(entry.name) && path !== seamFile) {
        if (readFileSync(path, 'utf8').includes('resolveCredentialMetadata')) references.push(path)
      }
    }
  }
  walk(join(REPO, 'packages'))
  const expected = [join(REPO, 'packages', 'broker', 'test', 'credential-metadata.test.js')]
  assert.deepEqual(references.sort(), expected.sort())
})
