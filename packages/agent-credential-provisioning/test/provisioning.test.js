import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import * as fileSystem from 'node:fs/promises'
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rename, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  classifyVerificationResult,
  clientExternalRef,
  ensureAgentCredential,
  principalExternalRef,
} from '../src/index.js'

const AGENT_ID = 'agt_credential_foundation'
const opaque = () => randomBytes(32).toString('base64url')

async function files(t, { store, storeBytes } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'agent-credential-provisioning-'))
  const definitionFile = join(directory, 'agents.json')
  const credentialsFile = join(directory, 'credentials.json')
  await writeFile(definitionFile, `${JSON.stringify({
    version: 1,
    defaultAgentId: AGENT_ID,
    agents: [{ id: AGENT_ID, name: 'Credential Foundation', description: null }],
  })}\n`)
  if (storeBytes !== undefined) await writeFile(credentialsFile, storeBytes, { mode: 0o600 })
  else if (store !== undefined) await writeFile(credentialsFile, `${JSON.stringify(store)}\n`, { mode: 0o600 })
  t.after(async () => { await import('node:fs/promises').then(({ rm }) => rm(directory, { recursive: true, force: true })) })
  return { directory, definitionFile, credentialsFile }
}

function storeWriteCounter() {
  let count = 0
  return {
    options: { beforeRename: () => { count += 1 } },
    get count() { return count },
  }
}

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

function authCallCounts(auth) {
  return Object.fromEntries(['principal', 'client', 'claim', 'verify', 'rotate'].map((operation) => [
    operation,
    auth.state.calls.filter((call) => call.operation === operation).length,
  ]))
}

const NO_CALLS = { principal: 0, client: 0, claim: 0, verify: 0, rotate: 0 }

function fakeAuthority({ verification = { status: 200 }, clientStatus = 'active' } = {}) {
  const state = {
    calls: [],
    principal: undefined,
    client: undefined,
    secret: undefined,
    clientResponse: undefined,
    verifiedCredential: undefined,
    rotations: 0,
  }
  return {
    state,
    async beginManagementOperation() {
      state.calls.push({ operation: 'management' })
      return {
        ensurePrincipal: (body) => this.ensurePrincipal(body),
        ensureClient: (body) => this.ensureClient(body),
      }
    },
    async ensurePrincipal(body) {
      state.calls.push({ operation: 'principal', body })
      const wasMissing = state.principal === undefined
      state.principal ??= { id: 'principal-fixed', status: 'active' }
      return { ...state.principal, created: wasMissing }
    },
    async ensureClient(body) {
      state.calls.push({ operation: 'client', body })
      const wasMissing = state.client === undefined
      if (wasMissing) {
        state.secret = opaque()
        state.client = { id: 'mc_fixed', status: clientStatus }
      }
      state.clientResponse = { ...state.client, created: wasMissing, ...(wasMissing ? { client_secret: state.secret } : {}) }
      return state.clientResponse
    },
    // The claim seam exists only so tests can prove Phase A never calls it.
    async claimCredential(body) {
      state.calls.push({ operation: 'claim', body })
      throw new Error('claim is not a Phase A operation')
    },
    async verifyCredential({ credential }) {
      state.verifiedCredential = credential
      state.calls.push({ operation: 'verify', clientId: credential.clientId })
      return typeof verification === 'function' ? verification(state) : verification
    },
    async rotateClientSecret({ clientId }) {
      state.calls.push({ operation: 'rotate', clientId })
      state.rotations += 1
      state.secret = opaque()
      return { id: clientId, client_secret: state.secret }
    },
  }
}

test('state A rejects an unknown Agent before Auth or store writes (PA5: agent_not_found precedence)', async (t) => {
  const paths = await files(t)
  const auth = fakeAuthority()
  await assert.rejects(
    ensureAgentCredential({
      agentId: 'agt_unknown', agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth, prerequisites: {},
    }),
    { code: 'agent_not_found' },
  )
  assert.equal(auth.state.calls.length, 0)
  await assert.rejects(readFile(paths.credentialsFile), { code: 'ENOENT' })
})

test('PA1: absent store entry + (c)=false fails before S1/S2 and before any store write', async (t) => {
  const paths = await files(t)
  const auth = fakeAuthority()
  const writes = storeWriteCounter()
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth, prerequisites: { c: false },
      storeWriteOptions: writes.options,
    }),
    { code: 'external_prerequisite_missing', prerequisite: 'c' },
  )
  assert.deepEqual(authCallCounts(auth), NO_CALLS)
  assert.equal(writes.count, 0)
  await assert.rejects(readFile(paths.credentialsFile), { code: 'ENOENT' })
})

test('prerequisite (c) token-provider failure occurs before S1/S2 and store write', async (t) => {
  const paths = await files(t)
  const auth = fakeAuthority()
  auth.beginManagementOperation = async () => {
    auth.state.calls.push({ operation: 'management' })
    throw Object.assign(new Error('not ready'), {
      code: 'EXTERNAL_PREREQUISITE_MISSING', prerequisite: 'c',
    })
  }
  const writes = storeWriteCounter()
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth, prerequisites: { c: true },
      storeWriteOptions: writes.options,
    }),
    { code: 'external_prerequisite_missing', prerequisite: 'c' },
  )
  assert.deepEqual(authCallCounts(auth), NO_CALLS)
  assert.equal(auth.state.calls.filter(({ operation }) => operation === 'management').length, 1)
  assert.equal(writes.count, 0)
  await assert.rejects(readFile(paths.credentialsFile), { code: 'ENOENT' })
})

test('PA4: malformed store fails before (c)=false or any Auth/store mutation, file byte-identical', async (t) => {
  const paths = await files(t, { storeBytes: '{ malformed-store' })
  const before = await readFile(paths.credentialsFile)
  const auth = fakeAuthority()
  const writes = storeWriteCounter()
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth, prerequisites: { c: false },
      storeWriteOptions: writes.options,
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.deepEqual(authCallCounts(auth), NO_CALLS)
  assert.equal(writes.count, 0)
  assert.deepEqual(await readFile(paths.credentialsFile), before)
})

test('PA4: malformed store fails before (c)=true or any Auth/store mutation, file byte-identical', async (t) => {
  const paths = await files(t, { storeBytes: '{ malformed-store' })
  const before = await readFile(paths.credentialsFile)
  const auth = fakeAuthority()
  const writes = storeWriteCounter()
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth, prerequisites: { c: true },
      storeWriteOptions: writes.options,
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.deepEqual(authCallCounts(auth), NO_CALLS)
  assert.equal(writes.count, 0)
  assert.deepEqual(await readFile(paths.credentialsFile), before)
})

test('INVALID_UTF8_REJECTED: invalid store bytes fail before Auth, temp creation, or writes', async (t) => {
  const invalidCases = [
    { name: 'standalone 0xff', bytes: Buffer.from([0xff]) },
    { name: 'truncated multibyte sequence', bytes: Buffer.from([0xe2, 0x82]) },
    { name: 'invalid continuation byte', bytes: Buffer.from([0xc2, 0x20]) },
    { name: 'overlong structural sequence', bytes: Buffer.from([0xf0, 0x80, 0x80, 0x80]) },
  ]
  const prefix = Buffer.from('{"version":1,"credentials":{},"invalid":"')
  const suffix = Buffer.from('"}\n')
  const replacementCharacter = Buffer.from('\ufffd')

  for (const testCase of invalidCases) {
    const original = Buffer.concat([prefix, testCase.bytes, suffix])
    const paths = await files(t, { storeBytes: original })
    const auth = fakeAuthority()
    const writes = storeWriteCounter()
    await assert.rejects(
      ensureAgentCredential({
        agentId: AGENT_ID,
        agentDefinitionFile: paths.definitionFile,
        credentialsFile: paths.credentialsFile,
        auth,
        prerequisites: { c: true },
        storeWriteOptions: writes.options,
      }),
      { code: 'CREDENTIALS_STORE_ERROR' },
      testCase.name,
    )
    assert.equal(auth.state.calls.length, 0, testCase.name)
    assert.equal(writes.count, 0, testCase.name)
    assert.equal((await readdir(paths.directory)).some((name) => name.includes('.tmp-')), false, testCase.name)
    const after = await readFile(paths.credentialsFile)
    assert.deepEqual(after, original, testCase.name)
    assert.equal(after.includes(replacementCharacter), false, testCase.name)
  }
})

test('unsafe existing-store metadata and symlinks fail before management authorization or Auth POST', async (t) => {
  const worldReadable = await files(t, { store: { version: 1, credentials: {} } })
  const worldBefore = await readFile(worldReadable.credentialsFile)
  await chmod(worldReadable.credentialsFile, 0o644)
  const worldAuth = fakeAuthority()
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID,
      agentDefinitionFile: worldReadable.definitionFile,
      credentialsFile: worldReadable.credentialsFile,
      auth: worldAuth,
      prerequisites: { c: true },
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.equal(worldAuth.state.calls.length, 0)
  assert.deepEqual(await readFile(worldReadable.credentialsFile), worldBefore)

  const linked = await files(t)
  const outside = join(linked.directory, 'outside-store.json')
  const outsideBytes = Buffer.from('{"version":1,"credentials":{}}\n')
  await writeFile(outside, outsideBytes, { mode: 0o600 })
  await symlink(outside, linked.credentialsFile)
  const linkedAuth = fakeAuthority()
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID,
      agentDefinitionFile: linked.definitionFile,
      credentialsFile: linked.credentialsFile,
      auth: linkedAuth,
      prerequisites: { c: true },
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.equal(linkedAuth.state.calls.length, 0)
  assert.deepEqual(await readFile(outside), outsideBytes)
})

test('PA4: an unrelated malformed store entry fails full-document validation before Auth', async (t) => {
  const paths = await files(t, { store: {
    version: 1,
    credentials: { agt_unrelated: { clientId: 'mc_unrelated' } },
  } })
  const before = await readFile(paths.credentialsFile)
  const auth = fakeAuthority()
  const writes = storeWriteCounter()
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth, prerequisites: { c: true },
      storeWriteOptions: writes.options,
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.deepEqual(authCallCounts(auth), NO_CALLS)
  assert.equal(writes.count, 0)
  assert.deepEqual(await readFile(paths.credentialsFile), before)
})

test('PA4: an unknown store version fails full-document validation before Auth', async (t) => {
  const paths = await files(t, { store: { version: 2, credentials: {} } })
  const before = await readFile(paths.credentialsFile)
  const auth = fakeAuthority()
  const writes = storeWriteCounter()
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth, prerequisites: { c: true },
      storeWriteOptions: writes.options,
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.deepEqual(authCallCounts(auth), NO_CALLS)
  assert.equal(writes.count, 0)
  assert.deepEqual(await readFile(paths.credentialsFile), before)
})

test('PA5: agent_not_found still wins over a malformed store and (c)=false', async (t) => {
  const paths = await files(t, { storeBytes: '{ malformed-store' })
  const before = await readFile(paths.credentialsFile)
  const auth = fakeAuthority()
  const writes = storeWriteCounter()
  await assert.rejects(
    ensureAgentCredential({
      agentId: 'agt_unknown', agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth, prerequisites: { c: false },
      storeWriteOptions: writes.options,
    }),
    { code: 'agent_not_found' },
  )
  assert.deepEqual(authCallCounts(auth), NO_CALLS)
  assert.equal(writes.count, 0)
  assert.deepEqual(await readFile(paths.credentialsFile), before)
})

test('PA2: absent store entry + (c)=true runs exactly S1, S2, one store write, and one verification mint', async (t) => {
  const paths = await files(t)
  const auth = fakeAuthority()
  const writes = storeWriteCounter()
  const result = await ensureAgentCredential({
    agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
    credentialsFile: paths.credentialsFile, auth, prerequisites: { c: true },
    storeWriteOptions: writes.options,
  })
  assert.equal(result.outcome, 'provisioned')
  assert.equal(result.clientId, 'mc_fixed')
  assert.deepEqual(authCallCounts(auth), { principal: 1, client: 1, claim: 0, verify: 1, rotate: 0 })
  assert.equal(writes.count, 1)

  // Deterministic external refs (C.4): stable, namespace-separated, no owner.
  const principalCall = auth.state.calls.find(({ operation }) => operation === 'principal')
  const clientCall = auth.state.calls.find(({ operation }) => operation === 'client')
  assert.deepEqual(principalCall.body, {
    external_ref: principalExternalRef(AGENT_ID),
    principal_type: 'agent',
    agent_id: AGENT_ID,
    display_name: 'Credential Foundation',
  })
  assert.equal(Object.hasOwn(principalCall.body, 'owner_user_id'), false)
  assert.deepEqual(clientCall.body, {
    external_ref: clientExternalRef(AGENT_ID),
    principal_id: 'principal-fixed',
  })

  const persisted = JSON.parse(await readFile(paths.credentialsFile, 'utf8'))
  assert.equal(persisted.version, 1)
  assert.equal(persisted.credentials[AGENT_ID].clientId, 'mc_fixed')
  assert.equal(persisted.credentials[AGENT_ID].clientSecret, auth.state.secret)
  assert.notStrictEqual(auth.state.verifiedCredential, auth.state.clientResponse)
  assert.deepEqual(auth.state.verifiedCredential, persisted.credentials[AGENT_ID])
})

test('persisted reread object is the verification mint source', async (t) => {
  const paths = await files(t)
  const auth = fakeAuthority()
  const result = await ensureAgentCredential({
    agentId: AGENT_ID,
    agentDefinitionFile: paths.definitionFile,
    credentialsFile: paths.credentialsFile,
    auth,
    prerequisites: { c: true },
    storeWriteOptions: {
      afterRename: async (...args) => {
        assert.equal(args.length, 0)
        const persisted = JSON.parse(await readFile(paths.credentialsFile, 'utf8'))
        persisted.credentials[AGENT_ID].persistedSourceMarker = 'trusted-store-reread'
        await writeFile(paths.credentialsFile, `${JSON.stringify(persisted)}\n`, { mode: 0o600 })
      },
    },
  })
  assert.equal(result.outcome, 'provisioned')
  assert.deepEqual(auth.state.verifiedCredential, {
    clientId: 'mc_fixed',
    clientSecret: auth.state.secret,
    persistedSourceMarker: 'trusted-store-reread',
  })
  assert.equal(Object.hasOwn(auth.state.clientResponse, 'persistedSourceMarker'), false)
})

test('real inode replacement with changed clientId or secret blocks verification mint', async (t) => {
  const cases = [
    {
      name: 'different clientId replacement',
      replacement: () => ({ clientId: 'mc_replacement', clientSecret: opaque() }),
    },
    {
      name: 'same clientId different secret replacement',
      replacement: () => ({ clientId: 'mc_fixed', clientSecret: opaque() }),
    },
  ]
  for (const [index, testCase] of cases.entries()) {
    const paths = await files(t)
    const auth = fakeAuthority()
    const writes = storeWriteCounter()
    let replacementBytes
    let replacementIdentity
    let rejectedError
    await assert.rejects(
      ensureAgentCredential({
        agentId: AGENT_ID,
        agentDefinitionFile: paths.definitionFile,
        credentialsFile: paths.credentialsFile,
        auth,
        prerequisites: { c: true },
        storeWriteOptions: {
          ...writes.options,
          afterRename: async (...args) => {
            assert.equal(args.length, 0)
            const originalIdentity = await lstat(paths.credentialsFile)
            const replacement = testCase.replacement()
            replacementBytes = Buffer.from(`${JSON.stringify({
              version: 1,
              credentials: { [AGENT_ID]: replacement },
            })}\n`)
            const replacementFile = join(paths.directory, `replacement-${index}.json`)
            await writeFile(replacementFile, replacementBytes, { mode: 0o600 })
            const tempIdentity = await lstat(replacementFile)
            assert.equal(tempIdentity.mode & 0o7777, 0o600)
            assert.equal(tempIdentity.uid, process.getuid())
            assert.equal(tempIdentity.gid, process.getgid())
            await rename(replacementFile, paths.credentialsFile)
            replacementIdentity = await lstat(paths.credentialsFile)
            assert.notEqual(replacementIdentity.ino, originalIdentity.ino)
            assert.equal(replacementIdentity.dev, tempIdentity.dev)
            assert.equal(replacementIdentity.ino, tempIdentity.ino)
          },
        },
      }),
      (error) => {
        rejectedError = error
        return error.code === 'CREDENTIALS_STORE_ERROR'
          && error.reason === 'post_write_consistency_mismatch'
      },
      testCase.name,
    )
    assert.deepEqual(authCallCounts(auth), {
      principal: 1, client: 1, claim: 0, verify: 0, rotate: 0,
    }, testCase.name)
    assert.equal(auth.state.verifiedCredential, undefined, testCase.name)
    assert.equal(writes.count, 1, testCase.name)
    assert.deepEqual(await readFile(paths.credentialsFile), replacementBytes, testCase.name)
    const finalIdentity = await lstat(paths.credentialsFile)
    assert.equal(finalIdentity.dev, replacementIdentity.dev, testCase.name)
    assert.equal(finalIdentity.ino, replacementIdentity.ino, testCase.name)
    assert.equal(replacementBytes.includes(Buffer.from(auth.state.secret)), false, testCase.name)
    const safeError = JSON.stringify({
      code: rejectedError.code,
      reason: rejectedError.reason,
      message: rejectedError.message,
    })
    assert.equal(safeError.includes(auth.state.secret), false, testCase.name)
  }
})

test('wrong trusted directory owner fails before prerequisite (c) and Auth', async (t) => {
  const paths = await files(t)
  const auth = fakeAuthority()
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID,
      agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile,
      auth,
      prerequisites: { c: false },
      storeWriteOptions: {
        ownerUid: process.getuid() + 1,
        ownerGid: process.getgid(),
        identity: { getuid: () => 0, getgid: () => 0 },
      },
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.deepEqual(authCallCounts(auth), NO_CALLS)
  assert.equal(auth.state.calls.length, 0)
})

test('same-metadata parent swap before lock acceptance causes zero Auth calls', async (t) => {
  const paths = await files(t)
  const movedDirectory = `${paths.directory}-moved-before-lock`
  t.after(async () => { await fileSystem.rm(movedDirectory, { recursive: true, force: true }) })
  const auth = fakeAuthority()
  let swapped = false
  const raceFileSystem = {
    ...fileSystem,
    async open(path, flags, mode) {
      if (!swapped && path.endsWith('.lock') && (flags & constants.O_CREAT) !== 0) {
        await rename(paths.directory, movedDirectory)
        await mkdir(paths.directory, { mode: 0o700 })
        swapped = true
      }
      return fileSystem.open(path, flags, mode)
    },
  }
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID,
      agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile,
      auth,
      prerequisites: { c: true },
      storeWriteOptions: { fileSystem: raceFileSystem },
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.equal(swapped, true)
  assert.equal(auth.state.calls.length, 0)
})

test('special-bit directory mode is rejected before Auth', async (t) => {
  const paths = await files(t)
  await chmod(paths.directory, 0o1700)
  const auth = fakeAuthority()
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID,
      agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile,
      auth,
      prerequisites: { c: true },
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.equal(auth.state.calls.length, 0)
})

test('directory symlink metadata failure occurs before Auth', async (t) => {
  const paths = await files(t)
  const directoryLink = `${paths.directory}-link`
  await symlink(paths.directory, directoryLink)
  t.after(async () => { await import('node:fs/promises').then(({ rm }) => rm(directoryLink, { force: true })) })
  const auth = fakeAuthority()
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID,
      agentDefinitionFile: paths.definitionFile,
      credentialsFile: join(directoryLink, 'credentials.json'),
      auth,
      prerequisites: { c: true },
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  assert.equal(auth.state.calls.length, 0)
})

test('external refs are deterministic, stable, and namespace-separated', () => {
  const principal = principalExternalRef(AGENT_ID)
  const client = clientExternalRef(AGENT_ID)
  assert.equal(principal, `agentcore:v1:principal:${AGENT_ID}`)
  assert.equal(client, `agentcore:v1:client:${AGENT_ID}`)
  assert.notEqual(principal, client)
  for (let index = 0; index < 3; index += 1) {
    assert.equal(principalExternalRef(AGENT_ID), principal)
    assert.equal(clientExternalRef(AGENT_ID), client)
  }
})

test('PA3: existing store entry fails loud with zero Auth, claim, rotation, and store writes', async (t) => {
  const paths = await files(t, { store: {
    version: 1, credentials: { [AGENT_ID]: { clientId: 'mc_stored', clientSecret: opaque() } },
  } })
  const before = await readFile(paths.credentialsFile, 'utf8')
  const auth = fakeAuthority()
  const writes = storeWriteCounter()
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth,
      prerequisites: { c: true, b: true, d: true },
      storeWriteOptions: writes.options,
    }),
    (error) => error.code === 'existing_credential_resolution_required'
      && error.reason === 'store_entry_present'
      && error.clientId === 'mc_stored',
  )
  assert.deepEqual(authCallCounts(auth), NO_CALLS)
  assert.equal(writes.count, 0)
  assert.equal(await readFile(paths.credentialsFile, 'utf8'), before)
})

test('PA3 ordering: entry classification precedes the (c) gate — (c)=false does not change the result', async (t) => {
  const paths = await files(t, { store: {
    version: 1, credentials: { [AGENT_ID]: { clientId: 'mc_stored', clientSecret: opaque() } },
  } })
  const auth = fakeAuthority()
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth, prerequisites: { c: false },
    }),
    { code: 'existing_credential_resolution_required' },
  )
  assert.deepEqual(authCallCounts(auth), NO_CALLS)
})

test('repeated clean bootstrap: the second request sees the store entry, calls no Auth, creates no duplicate identity', async (t) => {
  const paths = await files(t)
  const auth = fakeAuthority()
  const first = await ensureAgentCredential({
    agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
    credentialsFile: paths.credentialsFile, auth, prerequisites: { c: true },
  })
  assert.equal(first.outcome, 'provisioned')
  const firstBytes = await readFile(paths.credentialsFile, 'utf8')
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth, prerequisites: { c: true },
    }),
    { code: 'existing_credential_resolution_required', reason: 'store_entry_present' },
  )
  assert.deepEqual(authCallCounts(auth), { principal: 1, client: 1, claim: 0, verify: 1, rotate: 0 })
  assert.equal(await readFile(paths.credentialsFile, 'utf8'), firstBytes)
  assert.equal(auth.state.rotations, 0)
})

test('three concurrent same-Agent ensures create one identity and at most one secret write', async (t) => {
  const unrelatedSlice = '"agt_unrelated" : { "clientSecret" : "esc\\u0061ped\\/value", "clientId" : "mc_unrelated" }'
  const paths = await files(t, {
    storeBytes: `{\n  "credentials" : { ${unrelatedSlice} },\n  "version" : 1\n}\n`,
  })
  const auth = fakeAuthority()
  const s1Entered = deferred()
  const releaseS1 = deferred()
  const s2Entered = deferred()
  const releaseS2 = deferred()
  const writeEntered = deferred()
  const releaseWrite = deferred()
  const originalPrincipal = auth.ensurePrincipal.bind(auth)
  const originalClient = auth.ensureClient.bind(auth)
  auth.ensurePrincipal = async (body) => {
    s1Entered.resolve()
    await releaseS1.promise
    return originalPrincipal(body)
  }
  auth.ensureClient = async (body) => {
    s2Entered.resolve()
    await releaseS2.promise
    return originalClient(body)
  }
  const input = {
    agentId: AGENT_ID,
    agentDefinitionFile: paths.definitionFile,
    credentialsFile: paths.credentialsFile,
    auth,
    prerequisites: { c: true },
    storeWriteOptions: {
      beforeRename: async () => {
        writeEntered.resolve()
        await releaseWrite.promise
      },
    },
  }

  const attempts = [
    ensureAgentCredential(input),
    ensureAgentCredential(input),
    ensureAgentCredential(input),
  ]
  await s1Entered.promise
  releaseS1.resolve()
  await s2Entered.promise
  releaseS2.resolve()
  await writeEntered.promise
  // Every call has started while the target entry is still absent; queued
  // callers cannot enter S1/S2 until the first atomic commit completes.
  assert.equal((await readFile(paths.credentialsFile, 'utf8')).includes(`"${AGENT_ID}"`), false)
  releaseWrite.resolve()

  const settled = await Promise.allSettled(attempts)
  assert.equal(settled.filter(({ status }) => status === 'fulfilled').length, 1)
  const rejected = settled.filter(({ status }) => status === 'rejected')
  assert.equal(rejected.length, 2)
  assert.ok(rejected.every(({ reason }) => reason.code === 'existing_credential_resolution_required'
    && reason.reason === 'store_entry_present'))
  assert.deepEqual(authCallCounts(auth), { principal: 1, client: 1, claim: 0, verify: 1, rotate: 0 })
  assert.equal(auth.state.calls.filter(({ operation }) => operation === 'management').length, 1)
  assert.equal(auth.state.principal.id, 'principal-fixed')
  assert.equal(auth.state.client.id, 'mc_fixed')
  assert.equal(auth.state.rotations, 0)
  const finalBytes = await readFile(paths.credentialsFile)
  assert.notEqual(finalBytes.indexOf(Buffer.from(unrelatedSlice)), -1)
  const finalStore = JSON.parse(finalBytes.toString('utf8'))
  assert.equal(Object.keys(finalStore.credentials).filter((id) => id === AGENT_ID).length, 1)
  assert.equal(finalStore.credentials[AGENT_ID].clientId, 'mc_fixed')
})

test('blocked Phase B path: Auth client already exists without a store entry — fail loud, no rotation, no second client, no write', async (t) => {
  const paths = await files(t)
  const auth = fakeAuthority()
  auth.state.principal = { id: 'principal-fixed', status: 'active' }
  auth.state.client = { id: 'mc_fixed', status: 'active' }
  const writes = storeWriteCounter()
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth,
      prerequisites: { c: true, b: true, d: true },
      storeWriteOptions: writes.options,
    }),
    (error) => error.code === 'existing_credential_resolution_required'
      && error.reason === 'auth_client_present_without_store_entry'
      && error.clientId === 'mc_fixed',
  )
  assert.deepEqual(authCallCounts(auth), { principal: 1, client: 1, claim: 0, verify: 0, rotate: 0 })
  assert.equal(auth.state.rotations, 0)
  assert.equal(writes.count, 0)
  await assert.rejects(readFile(paths.credentialsFile), { code: 'ENOENT' })
})

test('ownerless-v1 401 on the fresh mint is prerequisite (d) evidence and never rotates or deletes the new identity', async (t) => {
  const paths = await files(t)
  const auth = fakeAuthority({ verification: { status: 401, oauthError: 'invalid_client' } })
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth,
      prerequisites: { c: true, b: true, d: false },
    }),
    (error) => error.code === 'external_prerequisite_missing'
      && error.prerequisite === 'd'
      && error.profile401DoesNotTriggerRotation === true,
  )
  assert.deepEqual(authCallCounts(auth), { principal: 1, client: 1, claim: 0, verify: 1, rotate: 0 })
  assert.equal(auth.state.rotations, 0)
  // The freshly created identity is kept (no deletion, no second client).
  const persisted = JSON.parse(await readFile(paths.credentialsFile, 'utf8'))
  assert.equal(persisted.credentials[AGENT_ID].clientId, 'mc_fixed')
})

test('temporarily_unavailable mint is inconclusive: no rotation, store keeps the new credential', async (t) => {
  const paths = await files(t)
  const auth = fakeAuthority({ verification: { status: 503, oauthError: 'temporarily_unavailable' } })
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth, prerequisites: { c: true, b: true },
    }),
    { code: 'credential_verification_inconclusive' },
  )
  assert.equal(auth.state.rotations, 0)
  const persisted = JSON.parse(await readFile(paths.credentialsFile, 'utf8'))
  assert.equal(persisted.credentials[AGENT_ID].clientId, 'mc_fixed')
})

test('verification classification covers current v1 and compatibility modes', () => {
  assert.deepEqual(classifyVerificationResult({ status: 200 }), { kind: 'credential_valid', authorization: 'granted' })
  assert.deepEqual(classifyVerificationResult({ status: 400, oauthError: 'invalid_scope' }), { kind: 'credential_valid', authorization: 'denied' })
  assert.equal(classifyVerificationResult({ status: 400, oauthError: 'invalid_target' }).kind, 'configuration_drift')
  assert.equal(classifyVerificationResult({ status: 503, oauthError: 'temporarily_unavailable' }).kind, 'inconclusive')
  assert.deepEqual(classifyVerificationResult(
    { status: 401, oauthError: 'invalid_client' },
    { mode: 'v1', prerequisiteDReady: false },
  ), { kind: 'external_prerequisite', prerequisite: 'd', rotationAllowed: false })
  assert.equal(classifyVerificationResult({ status: 500 }).kind, 'inconclusive')
  assert.equal(classifyVerificationResult({ status: 400, oauthError: undefined }).kind, 'inconclusive')
  assert.equal(classifyVerificationResult(
    { status: 400, oauthError: 'invalid_grant' }, { mode: 'v0' },
  ).kind, 'credential_valid')
})

test('raw secret is absent from argv/env/output/errors/workspace and child inputs', async (t) => {
  const paths = await files(t)
  const auth = fakeAuthority()
  const result = await ensureAgentCredential({
    agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
    credentialsFile: paths.credentialsFile, auth, prerequisites: { c: true },
  })
  const rawSecret = auth.state.secret
  const observable = JSON.stringify({
    argv: process.argv,
    env: process.env,
    result,
    calls: auth.state.calls,
    definition: await readFile(paths.definitionFile, 'utf8'),
  })
  assert.equal(observable.includes(rawSecret), false)
  assert.equal(auth.state.calls.some((call) => call.operation === 'child'), false)
})
