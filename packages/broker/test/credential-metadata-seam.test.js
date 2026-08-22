/**
 * AGENT_CORE_CREDENTIAL_METADATA_RESOLUTION_V1 — exported-seam oracles:
 * the production surface is EXACTLY `resolveCredentialMetadata(agentId)`.
 *
 * Blocker-1 revision evidence:
 *   EXPORTED_SIGNATURE               = resolveCredentialMetadata(agentId)
 *   CALLER_SUPPLIED_STORE_PATH       = NO   (no store-path parameter exists;
 *                                            extra arguments are ignored)
 *   TRUSTED_CONFIGURATION_STORE_PATH = YES  (AGENT_CORE_CREDENTIALS_FILE of
 *                                            the trusted parent process)
 *
 * Also carries ACC-CMR-006 (invalid / traversal-shaped ids fail loud BEFORE
 * any store access). STORE_ACCESS_COUNT = 0 is proven behaviorally: store
 * paths are placed where ANY access attempt (existsSync / readFileSync)
 * observably produces a CREDENTIALS_STORE_ERROR (missing file / EACCES under
 * a mode-0000 directory), so asserting the Agent Definition authority's
 * VALIDATION_ERROR proves no store access could have happened first.
 */

import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CREDENTIALS_STORE_ERROR, resolveCredentialMetadata } from '../src/credential-store.js'
import { normalizeAgentId } from '../../agent-definition/src/definition.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const FIXTURE_DIR = mkdtempSync(join(tmpdir(), 'cmr-seam-'))
after(() => rmSync(FIXTURE_DIR, { recursive: true, force: true }))

const AGENT_ID = 'agt_cmrinventory01'
const OTHER_AGENT_ID = 'agt_cmrotheragent02'
const CLIENT_ID = 'cmr-client-id-0417'
const CLIENT_ID_B = 'cmr-client-id-b-0921'

let fixtureCounter = 0

function writeStore(doc) {
  const file = join(FIXTURE_DIR, `store-${String(fixtureCounter++).padStart(3, '0')}.json`)
  writeFileSync(file, JSON.stringify(doc), { mode: 0o600 })
  return file
}

function validDoc(agentId = AGENT_ID, clientId = CLIENT_ID, secret = 'fixture-secret') {
  return { version: 1, credentials: { [agentId]: { clientId, clientSecret: secret } } }
}

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

// ---------------------------------------------------------------------------
// EXPORTED_SIGNATURE — executable oracles
// ---------------------------------------------------------------------------

test('EXPORTED_SIGNATURE: exported function declares exactly one parameter (agentId)', () => {
  assert.equal(resolveCredentialMetadata.length, 1)
  const source = resolveCredentialMetadata.toString()
  assert.match(
    source,
    /^function resolveCredentialMetadata\(\s*[A-Za-z_$][A-Za-z0-9_$]*\s*\)\s*\{/,
    'exported seam must declare exactly one identifier parameter',
  )
})

test('EXPORTED_SIGNATURE: the only store-path input on the exported seam is the trusted env authority', () => {
  const source = resolveCredentialMetadata.toString()
  assert.ok(source.includes('AGENT_CORE_CREDENTIALS_FILE'), 'must read AGENT_CORE_CREDENTIALS_FILE')
  assert.ok(!/\bstoreFile\b/.test(source), 'exported wrapper must not declare a storeFile parameter')
})

test('CALLER_SUPPLIED_STORE_PATH = NO: a second argument cannot inject or redirect the store', () => {
  const storeA = writeStore(validDoc()) // contains AGENT_ID -> CLIENT_ID
  const storeB = writeStore(validDoc(OTHER_AGENT_ID, CLIENT_ID_B)) // no AGENT_ID entry
  const arbitrary = join(FIXTURE_DIR, 'caller-supplied-should-be-ignored.json')

  // 1) Unconfigured environment: a 2-arg call cannot make the seam read a file.
  const unconfigured = withEnv(undefined, () => resolveCredentialMetadata(AGENT_ID, arbitrary))
  assert.deepEqual(unconfigured, { entry: 'ABSENT' })

  // 2) Configured to A: a 2-arg call pointing at B cannot redirect resolution.
  const viaA = withEnv(storeA, () => resolveCredentialMetadata(AGENT_ID, storeB))
  assert.deepEqual(viaA, { entry: 'PRESENT', clientId: CLIENT_ID })

  // 3) Configured to B: a 2-arg call pointing at A cannot conjure presence.
  const viaB = withEnv(storeB, () => resolveCredentialMetadata(AGENT_ID, storeA))
  assert.deepEqual(viaB, { entry: 'ABSENT' })

  // 4) Property injection is equally inert.
  resolveCredentialMetadata.storeFile = storeA
  const viaProperty = withEnv(undefined, () => resolveCredentialMetadata(AGENT_ID))
  assert.deepEqual(viaProperty, { entry: 'ABSENT' })
  delete resolveCredentialMetadata.storeFile
})

test('TRUSTED_CONFIGURATION_STORE_PATH = YES: results follow the configuration authority', () => {
  const storeA = writeStore(validDoc(AGENT_ID, CLIENT_ID))
  const storeB = writeStore(validDoc(AGENT_ID, CLIENT_ID_B))

  assert.deepEqual(withEnv(storeA, () => resolveCredentialMetadata(AGENT_ID)), { entry: 'PRESENT', clientId: CLIENT_ID })
  // Configuration change is picked up on the very next call (re-read, no cache).
  assert.deepEqual(withEnv(storeB, () => resolveCredentialMetadata(AGENT_ID)), { entry: 'PRESENT', clientId: CLIENT_ID_B })
  assert.deepEqual(withEnv(undefined, () => resolveCredentialMetadata(AGENT_ID)), { entry: 'ABSENT' })
})

test('structural: the metadata seam core never calls loadCredentialFor()', () => {
  const source = readFileSync(join(REPO, 'packages', 'broker', 'src', 'credential-store.js'), 'utf8')
  const coreStart = source.indexOf('function resolveCredentialMetadataWith')
  assert.ok(coreStart >= 0)
  // Judge CODE, not documentation text: strip comments before scanning for
  // call sites.
  const coreCode = source
    .slice(coreStart)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '')
  assert.ok(!coreCode.includes('loadCredentialFor('), 'inventory path must not call loadCredentialFor()')
  assert.ok(coreCode.includes('loadCredentialsStore('), 'full V1 document validation must be reused')
  // The internal core is NOT exported (no production surface may accept a
  // caller-supplied store path).
  assert.ok(!/^export function resolveCredentialMetadataWith/m.test(source))
})

test('structural: the seam is referenced nowhere else (CHILD/MODEL_TOOL/RPC exposure = 0)', () => {
  const references = []
  const allowed = new Set([
    join(REPO, 'packages', 'broker', 'src', 'credential-store.js'),
    join(REPO, 'packages', 'broker', 'test', 'credential-metadata.test.js'),
    join(REPO, 'packages', 'broker', 'test', 'credential-metadata-seam.test.js'),
    join(REPO, 'packages', 'broker', 'test', 'credential-metadata-side-effects.test.js'),
  ])
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (/\.(js|mjs|ts)$/.test(entry.name) && !allowed.has(path)) {
        if (readFileSync(path, 'utf8').includes('resolveCredentialMetadata')) references.push(path)
      }
    }
  }
  walk(join(REPO, 'packages'))
  assert.deepEqual(references.sort(), [])

  // The broker package's public export map exposes no credential surface.
  const pkg = JSON.parse(readFileSync(join(REPO, 'packages', 'broker', 'package.json'), 'utf8'))
  for (const key of Object.keys(pkg.exports ?? {})) {
    assert.ok(!/credential-store|resolveCredentialMetadata/.test(key), `unexpected public export: ${key}`)
  }
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
  return `${String(id)} (${typeof id})`
}

for (const invalidId of INVALID_IDS) {
  test(`invalid id ${describeInvalid(invalidId)}: fails loud pre-store (blocked dir)`, () => {
    const blockedDir = join(FIXTURE_DIR, `blocked-${fixtureCounter++}`)
    mkdirSync(blockedDir, { mode: 0o700 })
    const storeFile = join(blockedDir, 'store.json')
    writeFileSync(storeFile, JSON.stringify(validDoc()), { mode: 0o600 })
    const bytesBefore = readFileSync(storeFile)
    chmodSync(blockedDir, 0o000)
    try {
      // The configured store path CANNOT be accessed (parent dir mode 0000):
      // a store-first implementation would throw CREDENTIALS_STORE_ERROR
      // (EACCES -> "not found"). The seam must throw the authority's
      // VALIDATION_ERROR instead => STORE_ACCESS_COUNT = 0.
      withEnv(storeFile, () =>
        assert.throws(() => resolveCredentialMetadata(invalidId), (error) => {
          assert.equal(error.code, 'VALIDATION_ERROR')
          assert.notEqual(error.code, CREDENTIALS_STORE_ERROR)
          return true
        }),
      )
    } finally {
      chmodSync(blockedDir, 0o700)
    }
    assert.deepEqual(readFileSync(storeFile), bytesBefore)
    rmSync(blockedDir, { recursive: true, force: true })
  })

  test(`invalid id ${describeInvalid(invalidId)}: fails loud pre-store (missing configured store)`, () => {
    const missing = join(FIXTURE_DIR, `missing-${fixtureCounter++}.json`)
    withEnv(missing, () =>
      assert.throws(() => resolveCredentialMetadata(invalidId), (error) => {
        assert.equal(error.code, 'VALIDATION_ERROR')
        assert.notEqual(error.code, CREDENTIALS_STORE_ERROR)
        return true
      }),
    )
  })
}

test('invalid ids fail loud even with NO store configured (id validation is unconditional)', () => {
  for (const invalidId of ['', 'not-agt', '../x', 7, null]) {
    withEnv(undefined, () =>
      assert.throws(() => resolveCredentialMetadata(invalidId), (error) => {
        assert.equal(error.code, 'VALIDATION_ERROR')
        return true
      }),
    )
  }
})

test('the seam inherits the Agent Definition validator verbatim (same grammar, same error family)', () => {
  for (const id of ['agt_ok', AGENT_ID, 'agt_0f1e23a4b5c6d7e8f9a0b1c2d3e4f5a6']) {
    assert.equal(normalizeAgentId(id), id)
  }
  for (const id of ['agt_a/b', 'agt_a\\b', 'agt_..', 'nope', '', undefined]) {
    assert.throws(() => normalizeAgentId(id), { code: 'VALIDATION_ERROR' })
    withEnv(undefined, () =>
      assert.throws(() => resolveCredentialMetadata(id), { code: 'VALIDATION_ERROR' }),
    )
  }
})
