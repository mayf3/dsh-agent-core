import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { chmod, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  readCredentialStoreDocument,
  removeCredentialForAgent,
  writeCredentialForAgent,
} from '../src/store-writer.js'

const opaque = () => randomBytes(32).toString('base64url')

async function fixture(t, document) {
  const directory = await mkdtemp(join(tmpdir(), 'agent-credential-store-'))
  const file = join(directory, 'credentials.json')
  t.after(async () => { await import('node:fs/promises').then(({ rm }) => rm(directory, { recursive: true, force: true })) })
  if (document !== undefined) await writeFile(file, `${JSON.stringify(document)}\n`, { mode: 0o600 })
  return { directory, file }
}

test('writer creates a 0600 V1 store and preserves unrelated entries verbatim', async (t) => {
  const otherSecret = opaque()
  const targetSecret = opaque()
  const { file } = await fixture(t, {
    version: 1,
    credentials: {
      agt_other: { clientId: 'mc_other', clientSecret: otherSecret, retained: 'opaque-extension' },
      agt_target: { clientId: 'mc_old', clientSecret: opaque() },
    },
  })

  await writeCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: targetSecret })
  const document = JSON.parse(await readFile(file, 'utf8'))
  assert.deepEqual(document.credentials.agt_other, {
    clientId: 'mc_other', clientSecret: otherSecret, retained: 'opaque-extension',
  })
  assert.equal(document.credentials.agt_target.clientId, 'mc_target')
  assert.equal(document.credentials.agt_target.clientSecret.length, targetSecret.length)
  assert.equal((await stat(file)).mode & 0o777, 0o600)
})

test('malformed, unknown-version, and bad-entry stores are never overwritten', async (t) => {
  const cases = [
    '{broken',
    JSON.stringify({ version: 2, credentials: {} }),
    JSON.stringify({ version: 1, credentials: { agt_bad: { clientId: 'mc_bad' } } }),
  ]
  for (const original of cases) {
    const { file } = await fixture(t, undefined)
    await writeFile(file, original, { mode: 0o600 })
    await assert.rejects(
      writeCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: opaque() }),
      { code: 'CREDENTIALS_STORE_ERROR' },
    )
    assert.equal(await readFile(file, 'utf8'), original)
  }
})

test('interruption before atomic rename leaves the original intact', async (t) => {
  const originalSecret = opaque()
  const { file } = await fixture(t, {
    version: 1,
    credentials: { agt_target: { clientId: 'mc_original', clientSecret: originalSecret } },
  })
  const original = await readFile(file, 'utf8')
  await assert.rejects(
    writeCredentialForAgent(file, 'agt_target', { clientId: 'mc_new', clientSecret: opaque() }, {
      beforeRename: async () => { throw new Error('simulated interruption') },
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.equal(await readFile(file, 'utf8'), original)
})

test('private lock serializes concurrent target-only updates', async (t) => {
  const { file } = await fixture(t, undefined)
  const entries = Array.from({ length: 12 }, (_, index) => ({
    agentId: `agt_${index}`,
    credential: { clientId: `mc_${index}`, clientSecret: opaque() },
  }))
  await Promise.all(entries.map(({ agentId, credential }) => writeCredentialForAgent(file, agentId, credential)))
  const document = await readCredentialStoreDocument(file)
  assert.equal(Object.keys(document.credentials).length, entries.length)
  for (const { agentId, credential } of entries) {
    assert.equal(document.credentials[agentId].clientId, credential.clientId)
  }
})

test('removal mutates only the target and remains fail-closed', async (t) => {
  const { file } = await fixture(t, {
    version: 1,
    credentials: {
      agt_remove: { clientId: 'mc_remove', clientSecret: opaque() },
      agt_keep: { clientId: 'mc_keep', clientSecret: opaque() },
    },
  })
  await removeCredentialForAgent(file, 'agt_remove')
  const document = await readCredentialStoreDocument(file)
  assert.equal(document.credentials.agt_remove, undefined)
  assert.equal(document.credentials.agt_keep.clientId, 'mc_keep')
})

test('writer refuses a group/world-accessible credential directory', async (t) => {
  const { directory, file } = await fixture(t, undefined)
  await chmod(directory, 0o755)
  await assert.rejects(
    writeCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: opaque() }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
})
