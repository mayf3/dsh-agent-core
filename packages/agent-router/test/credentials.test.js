/**
 * @agent-core/agent-router — credentials.js unit tests (Process Identity
 * Integration V1): the per-agent process credential source consumed by the
 * Router spawn path.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  CREDENTIALS_STORE_ERROR, loadCredentialFor, loadCredentialsStore, normalizeCredential,
} from '../src/credentials.js'

function tempStore(document) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-credentials-'))
  const file = join(dir, 'credentials.json')
  writeFileSync(file, JSON.stringify(document))
  chmodSync(file, 0o600)
  return { dir, file }
}

test('normalizeCredential accepts complete entries and rejects broken ones', () => {
  assert.deepEqual(normalizeCredential({ clientId: 'mc_a', clientSecret: 's' }), { clientId: 'mc_a', clientSecret: 's' })
  assert.equal(normalizeCredential({ clientId: '', clientSecret: 's' }), undefined)
  assert.equal(normalizeCredential({ clientId: 'mc_a' }), undefined)
  assert.equal(normalizeCredential(null), undefined)
  assert.equal(normalizeCredential('nope'), undefined)
})

test('loadCredentialsStore reads a valid store; malformed/unreadable fail loud', () => {
  const { dir, file } = tempStore({ version: 1, credentials: { a: { clientId: 'mc_a', clientSecret: 's' } } })
  const store = loadCredentialsStore(file)
  assert.deepEqual(store.a, { clientId: 'mc_a', clientSecret: 's' })
  // missing agent -> no entry (legal; spawn proceeds credential-less)
  assert.equal(store.b, undefined)
  rmSync(dir, { recursive: true, force: true })

  assert.throws(() => loadCredentialsStore(join(dir, 'missing.json')), { code: CREDENTIALS_STORE_ERROR })
  assert.throws(() => loadCredentialsStore('relative/path.json'), { code: CREDENTIALS_STORE_ERROR })
  const bad = tempStore({ version: 1, credentials: { a: { clientId: 1, clientSecret: 's' } } })
  assert.throws(() => loadCredentialsStore(bad.file), { code: CREDENTIALS_STORE_ERROR })
  rmSync(bad.dir, { recursive: true, force: true })
  const old = tempStore({ version: 0, credentials: {} })
  assert.throws(() => loadCredentialsStore(old.file), { code: CREDENTIALS_STORE_ERROR })
  rmSync(old.dir, { recursive: true, force: true })
})

test('loadCredentialFor: no store configured -> undefined; unknown agent -> undefined', () => {
  assert.equal(loadCredentialFor(undefined, 'agt_x'), undefined)
  assert.equal(loadCredentialFor('', 'agt_x'), undefined)
  const { dir, file } = tempStore({ version: 1, credentials: { a: { clientId: 'mc_a', clientSecret: 's' } } })
  assert.equal(loadCredentialFor(file, 'agt_unknown'), undefined)
  rmSync(dir, { recursive: true, force: true })
})
