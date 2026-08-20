import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import * as fileSystem from 'node:fs/promises'
import {
  chmod, mkdir, mkdtemp, readFile, readdir, rename, stat, symlink, unlink, writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  preflightTrustedCredentialDirectory,
  readCredentialStoreDocument,
  writeCredentialForAgent,
} from '../src/store-writer.js'

const opaque = () => randomBytes(32).toString('base64url')
const ownerOptions = () => ({ ownerUid: process.getuid(), ownerGid: process.getgid() })

async function fixture(t, document) {
  const directory = await mkdtemp(join(tmpdir(), 'agent-credential-store-'))
  const file = join(directory, 'credentials.json')
  t.after(async () => { await import('node:fs/promises').then(({ rm }) => rm(directory, { recursive: true, force: true })) })
  if (document !== undefined) await writeFile(file, `${JSON.stringify(document)}\n`, { mode: 0o600 })
  return { directory, file }
}

function assertContainsExactBytes(haystack, needles) {
  for (const needle of needles) {
    assert.notEqual(haystack.indexOf(Buffer.from(needle)), -1, `missing byte-identical slice: ${needle}`)
  }
}

test('ROOT_DIRECTORY_HANDOFF: root creates, chowns, chmods, and post-stats trusted directory', async () => {
  const operations = []
  let state = 'missing'
  const expectedUid = 505
  const expectedGid = 505
  const directoryStat = () => ({
    dev: 10,
    ino: 20,
    mode: state === 'trusted' ? 0o40700 : 0o40755,
    uid: state === 'trusted' ? expectedUid : 0,
    gid: state === 'trusted' ? expectedGid : 0,
    isDirectory: () => true,
    isFile: () => false,
    isSymbolicLink: () => false,
  })
  const fileSystem = {
    async lstat(path) {
      operations.push(`lstat:${path}`)
      if (state === 'missing') throw Object.assign(new Error('missing'), { code: 'ENOENT' })
      return directoryStat()
    },
    async mkdir(path, options) {
      operations.push(`mkdir:${options.mode.toString(8)}`)
      state = 'created'
    },
    async chown(path, uid, gid) {
      operations.push(`chown:${uid}:${gid}`)
    },
    async chmod(path, mode) {
      operations.push(`chmod:${mode.toString(8)}`)
      state = 'trusted'
    },
    async open(path) {
      operations.push(`open:${path}`)
      return {
        stat: async () => directoryStat(),
        close: async () => {},
      }
    },
  }
  const result = await preflightTrustedCredentialDirectory('/trusted/credentials.json', {
    ownerUid: expectedUid,
    ownerGid: expectedGid,
    identity: { getuid: () => 0, getgid: () => 0 },
    fileSystem,
  })
  assert.deepEqual(result.owner, { uid: expectedUid, gid: expectedGid, writerUid: 0 })
  assert.deepEqual(operations, [
    'lstat:/trusted',
    'mkdir:700',
    'lstat:/trusted',
    'chown:505:505',
    'chmod:700',
    'lstat:/trusted',
    'open:/trusted',
  ])
})

test('writer creates a trusted-owner 0600 V1 store before persisting secret bytes', async (t) => {
  const targetSecret = opaque()
  const { file } = await fixture(t, undefined)
  await writeCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: targetSecret })
  const document = JSON.parse(await readFile(file, 'utf8'))
  const metadata = await stat(file)
  assert.equal(document.credentials.agt_target.clientSecret, targetSecret)
  assert.equal(metadata.mode & 0o777, 0o600)
  assert.equal(metadata.uid, process.getuid())
  assert.equal(metadata.gid, process.getgid())
})

test('hostile formatting preserves every unrelated entry byte while adding target', async (t) => {
  const unrelatedSlices = [
    '"agt_first" : { "clientSecret" : "esc\\u0061ped\\/slash\\nline", "clientId" : "mc_first", "z" : 1e+02 }',
    '"agt_middle"\t:\t{"zeta":"Ω","clientId":"mc_middle","clientSecret":"middle-secret"}',
    '"agt_last" : {\n      "clientId" : "mc_last",\n      "extension" : {"b":2,"a":1},\n      "clientSecret" : "last-secret"\n    }',
  ]
  const raw = Buffer.from(`{\r\n\t"credentials" : {\n    ${unrelatedSlices[0]},\n    ${unrelatedSlices[1]},\n    ${unrelatedSlices[2]}\n  },\r\n  "version" : 1\r\n}\r\n`)
  const { file } = await fixture(t, undefined)
  await writeFile(file, raw, { mode: 0o600 })
  await writeCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: opaque() })
  const after = await readFile(file)
  assertContainsExactBytes(after, unrelatedSlices)
  const parsed = JSON.parse(after.toString('utf8'))
  assert.equal(parsed.credentials.agt_target.clientId, 'mc_target')
  assert.equal(parsed.credentials.agt_first.clientSecret, 'escaped/slash\nline')
  await readCredentialStoreDocument(file)
})

test('empty and non-empty credentials objects remain valid after byte-splice insertion', async (t) => {
  for (const raw of [
    '{"version":1,"credentials":{}}\n',
    '{ "version" : 1, "credentials" : {  \n\t } }\n',
    '{"credentials":{"agt_other":{"clientId":"mc_other","clientSecret":"s"}   },"version":1}\n',
  ]) {
    const { file } = await fixture(t, undefined)
    await writeFile(file, raw, { mode: 0o600 })
    await writeCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: opaque() })
    assert.equal(JSON.parse(await readFile(file, 'utf8')).credentials.agt_target.clientId, 'mc_target')
  }
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

test('existing world-readable store is rejected before parsing or overwrite', async (t) => {
  const { file } = await fixture(t, { version: 1, credentials: {} })
  const before = await readFile(file)
  await chmod(file, 0o644)
  await assert.rejects(readCredentialStoreDocument(file), { code: 'CREDENTIALS_STORE_ERROR' })
  await assert.rejects(
    writeCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: opaque() }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.deepEqual(await readFile(file), before)
})

test('special-bit store mode is rejected instead of treated as exact 0600', async (t) => {
  const { file } = await fixture(t, { version: 1, credentials: {} })
  await chmod(file, 0o4600)
  await assert.rejects(readCredentialStoreDocument(file), { code: 'CREDENTIALS_STORE_ERROR' })
})

test('symlink existing store is rejected without following it', async (t) => {
  const { directory, file } = await fixture(t, undefined)
  const outside = join(directory, 'outside.json')
  const outsideBytes = Buffer.from('{"version":1,"credentials":{}}\n')
  await writeFile(outside, outsideBytes, { mode: 0o600 })
  await symlink(outside, file)
  await assert.rejects(readCredentialStoreDocument(file), { code: 'CREDENTIALS_STORE_ERROR' })
  await assert.rejects(
    writeCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: opaque() }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.deepEqual(await readFile(outside), outsideBytes)
})

test('non-regular existing store is rejected', async (t) => {
  const { file } = await fixture(t, undefined)
  await mkdir(file, { mode: 0o700 })
  await assert.rejects(readCredentialStoreDocument(file), { code: 'CREDENTIALS_STORE_ERROR' })
})

test('wrong, root, negative, and non-integer trusted owner inputs are rejected', async (t) => {
  const { file } = await fixture(t, { version: 1, credentials: {} })
  const uid = process.getuid()
  const gid = process.getgid()
  const invalid = [
    { ownerUid: uid + 1, ownerGid: gid },
    { ownerUid: 0, ownerGid: 0 },
    { ownerUid: -1, ownerGid: gid },
    { ownerUid: uid, ownerGid: -1 },
    { ownerUid: 1.5, ownerGid: gid },
    { ownerUid: uid, ownerGid: 'not-an-integer' },
  ]
  for (const options of invalid) {
    await assert.rejects(readCredentialStoreDocument(file, options), { code: 'CREDENTIALS_STORE_ERROR' })
  }
  await assert.doesNotReject(readCredentialStoreDocument(file, ownerOptions()))
})

test('interruption before atomic rename leaves the original intact', async (t) => {
  const { file } = await fixture(t, {
    version: 1,
    credentials: { agt_other: { clientId: 'mc_original', clientSecret: opaque() } },
  })
  const original = await readFile(file)
  await assert.rejects(
    writeCredentialForAgent(file, 'agt_target', { clientId: 'mc_new', clientSecret: opaque() }, {
      beforeRename: async () => { throw new Error('simulated interruption') },
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.deepEqual(await readFile(file), original)
})

test('TOCTOU symlink replacement before rename is rejected', async (t) => {
  const { directory, file } = await fixture(t, {
    version: 1,
    credentials: { agt_other: { clientId: 'mc_original', clientSecret: opaque() } },
  })
  const outside = join(directory, 'outside.json')
  const outsideBytes = Buffer.from('{"sentinel":"unchanged"}\n')
  await writeFile(outside, outsideBytes, { mode: 0o600 })
  await assert.rejects(
    writeCredentialForAgent(file, 'agt_target', { clientId: 'mc_new', clientSecret: opaque() }, {
      beforeRename: async () => {
        await unlink(file)
        await symlink(outside, file)
      },
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.deepEqual(await readFile(outside), outsideBytes)
})

test('caller-forged lock context cannot bypass serialization', async (t) => {
  const { directory, file } = await fixture(t, undefined)
  await assert.rejects(
    writeCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: opaque() }, {
      lock: {
        storeFile: file,
        owner: { uid: process.getuid(), gid: process.getgid() },
        directoryIdentity: { dev: 0, ino: 0 },
      },
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.deepEqual(await import('node:fs/promises').then(({ readdir }) => readdir(directory)), [])
})

test('parent swap before temp open writes zero secret bytes and preserves replacement sentinels', async (t) => {
  const { directory, file } = await fixture(t, undefined)
  const movedDirectory = `${directory}-moved-before-temp`
  t.after(async () => { await fileSystem.rm(movedDirectory, { recursive: true, force: true }) })
  const replacementStoreSentinel = '{"replacement":"store"}\n'
  const replacementLockSentinel = 'replacement lock\n'
  let swapped = false
  const raceFileSystem = {
    ...fileSystem,
    async open(path, flags, mode) {
      if (!swapped && path.includes('.tmp-') && (flags & constants.O_WRONLY) !== 0) {
        await rename(directory, movedDirectory)
        await mkdir(directory, { mode: 0o700 })
        await writeFile(file, replacementStoreSentinel, { mode: 0o600 })
        await writeFile(`${file}.lock`, replacementLockSentinel, { mode: 0o600 })
        swapped = true
      }
      return fileSystem.open(path, flags, mode)
    },
  }
  const secret = opaque()
  await assert.rejects(
    writeCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: secret }, {
      fileSystem: raceFileSystem,
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.equal(swapped, true)
  assert.equal(await readFile(file, 'utf8'), replacementStoreSentinel)
  assert.equal(await readFile(`${file}.lock`, 'utf8'), replacementLockSentinel)
  const replacementTemp = (await readdir(directory)).find((name) => name.includes('.tmp-'))
  assert.ok(replacementTemp)
  const tempBytes = await readFile(join(directory, replacementTemp))
  assert.equal(tempBytes.length, 0)
  assert.equal(tempBytes.includes(Buffer.from(secret)), false)
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

test('writer refuses a group/world-accessible credential directory', async (t) => {
  const { directory, file } = await fixture(t, undefined)
  await chmod(directory, 0o755)
  await assert.rejects(
    writeCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: opaque() }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
})
