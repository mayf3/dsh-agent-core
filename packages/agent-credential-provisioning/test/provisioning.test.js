import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
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
    rotations: 0,
  }
  return {
    state,
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
      return { ...state.client, created: wasMissing, ...(wasMissing ? { client_secret: state.secret } : {}) }
    },
    // The claim seam exists only so tests can prove Phase A never calls it.
    async claimCredential(body) {
      state.calls.push({ operation: 'claim', body })
      throw new Error('claim is not a Phase A operation')
    },
    async verifyCredential({ credential }) {
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
  assert.deepEqual(auth.state.calls[0].body, {
    external_ref: principalExternalRef(AGENT_ID),
    principal_type: 'agent',
    agent_id: AGENT_ID,
    display_name: 'Credential Foundation',
  })
  assert.equal(Object.hasOwn(auth.state.calls[0].body, 'owner_user_id'), false)
  assert.deepEqual(auth.state.calls[1].body, {
    external_ref: clientExternalRef(AGENT_ID),
    principal_id: 'principal-fixed',
  })

  const persisted = JSON.parse(await readFile(paths.credentialsFile, 'utf8'))
  assert.equal(persisted.version, 1)
  assert.equal(persisted.credentials[AGENT_ID].clientId, 'mc_fixed')
  assert.equal(persisted.credentials[AGENT_ID].clientSecret, auth.state.secret)
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
