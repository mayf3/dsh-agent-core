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

async function files(t, { store } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'agent-credential-provisioning-'))
  const definitionFile = join(directory, 'agents.json')
  const credentialsFile = join(directory, 'credentials.json')
  await writeFile(definitionFile, `${JSON.stringify({
    version: 1,
    defaultAgentId: AGENT_ID,
    agents: [{ id: AGENT_ID, name: 'Credential Foundation', description: null }],
  })}\n`)
  if (store !== undefined) await writeFile(credentialsFile, `${JSON.stringify(store)}\n`, { mode: 0o600 })
  t.after(async () => { await import('node:fs/promises').then(({ rm }) => rm(directory, { recursive: true, force: true })) })
  return { directory, definitionFile, credentialsFile }
}

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

test('state A rejects an unknown Agent before Auth or store writes', async (t) => {
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

test('prerequisite (c) fails before S1/S2 and before any store write', async (t) => {
  const paths = await files(t)
  const auth = fakeAuthority()
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth, prerequisites: { c: false },
    }),
    { code: 'external_prerequisite_missing', prerequisite: 'c' },
  )
  assert.equal(auth.state.calls.length, 0)
  await assert.rejects(readFile(paths.credentialsFile), { code: 'ENOENT' })
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

test('three repeated ensures reuse one principal/client and do not rewrite the store', async (t) => {
  const paths = await files(t)
  const auth = fakeAuthority({ verification: { status: 400, oauthError: 'invalid_scope' } })
  const first = await ensureAgentCredential({
    agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
    credentialsFile: paths.credentialsFile, auth, prerequisites: { c: true },
  })
  const firstBytes = await readFile(paths.credentialsFile, 'utf8')
  const second = await ensureAgentCredential({
    agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
    credentialsFile: paths.credentialsFile, auth, prerequisites: { c: true },
  })
  const third = await ensureAgentCredential({
    agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
    credentialsFile: paths.credentialsFile, auth, prerequisites: { c: true },
  })
  assert.equal(first.outcome, 'provisioned')
  assert.equal(second.outcome, 'noop')
  assert.equal(third.outcome, 'noop')
  assert.equal(await readFile(paths.credentialsFile, 'utf8'), firstBytes)
  assert.equal(auth.state.rotations, 0)
  assert.deepEqual(auth.state.calls[0].body, {
    external_ref: principalExternalRef(AGENT_ID),
    principal_type: 'agent',
    agent_id: AGENT_ID,
    display_name: 'Credential Foundation',
  })
  assert.equal(Object.hasOwn(auth.state.calls[0].body, 'owner_user_id'), false)
  assert.equal(new Set(auth.state.calls.filter((call) => call.operation === 'principal').map(() => 'principal-fixed')).size, 1)
  assert.equal(new Set(auth.state.calls.filter((call) => call.operation === 'client').map(() => 'mc_fixed')).size, 1)
})

test('state E missing-store recovery fails loud without (b)', async (t) => {
  const paths = await files(t)
  const auth = fakeAuthority()
  auth.state.principal = { id: 'principal-fixed', status: 'active' }
  auth.state.client = { id: 'mc_fixed', status: 'active' }
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth, prerequisites: { c: true, b: false },
    }),
    { code: 'external_prerequisite_missing', prerequisite: 'b' },
  )
  assert.equal(auth.state.rotations, 0)
  await assert.rejects(readFile(paths.credentialsFile), { code: 'ENOENT' })
})

test('state E recovery, once (b) is supplied, rotates only the same client', async (t) => {
  const paths = await files(t)
  const auth = fakeAuthority()
  auth.state.principal = { id: 'principal-fixed', status: 'active' }
  auth.state.client = { id: 'mc_fixed', status: 'active' }
  const result = await ensureAgentCredential({
    agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
    credentialsFile: paths.credentialsFile, auth,
    prerequisites: { c: true, b: true, d: true },
  })
  assert.equal(result.outcome, 'rotated_same_client')
  assert.equal(result.clientId, 'mc_fixed')
  assert.equal(auth.state.rotations, 1)
  assert.equal(auth.state.calls.filter((call) => call.operation === 'client').length, 1)
})

test('v1 ownerless 401 is prerequisite (d) evidence and never rotates', async (t) => {
  const secret = opaque()
  const paths = await files(t, { store: {
    version: 1, credentials: { [AGENT_ID]: { clientId: 'mc_fixed', clientSecret: secret } },
  } })
  const auth = fakeAuthority({ verification: { status: 401, oauthError: 'invalid_client' } })
  auth.state.principal = { id: 'principal-fixed', status: 'active' }
  auth.state.client = { id: 'mc_fixed', status: 'active' }
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
  assert.equal(auth.state.rotations, 0)
})

test('state G rotates the same client only after (d) and (b) are established', async (t) => {
  const paths = await files(t, { store: {
    version: 1, credentials: { [AGENT_ID]: { clientId: 'mc_fixed', clientSecret: opaque() } },
  } })
  const auth = fakeAuthority({
    verification: (state) => state.rotations === 0
      ? { status: 401, oauthError: 'invalid_client' }
      : { status: 200 },
  })
  auth.state.principal = { id: 'principal-fixed', status: 'active' }
  auth.state.client = { id: 'mc_fixed', status: 'active' }
  const result = await ensureAgentCredential({
    agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
    credentialsFile: paths.credentialsFile, auth,
    prerequisites: { c: true, b: true, d: true },
  })
  assert.equal(result.outcome, 'rotated_same_client')
  assert.equal(result.clientId, 'mc_fixed')
  assert.equal(auth.state.rotations, 1)
})

test('temporarily_unavailable is inconclusive: no rotation and no no-op', async (t) => {
  const paths = await files(t, { store: {
    version: 1, credentials: { [AGENT_ID]: { clientId: 'mc_fixed', clientSecret: opaque() } },
  } })
  const before = await readFile(paths.credentialsFile, 'utf8')
  const auth = fakeAuthority({ verification: { status: 503, oauthError: 'temporarily_unavailable' } })
  auth.state.principal = { id: 'principal-fixed', status: 'active' }
  auth.state.client = { id: 'mc_fixed', status: 'active' }
  await assert.rejects(
    ensureAgentCredential({
      agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
      credentialsFile: paths.credentialsFile, auth,
      prerequisites: { c: true, b: true, d: true },
    }),
    { code: 'credential_verification_inconclusive' },
  )
  assert.equal(auth.state.rotations, 0)
  assert.equal(await readFile(paths.credentialsFile, 'utf8'), before)
})

test('split-brain mismatch and revoked client fail loud without parallel repair', async (t) => {
  for (const scenario of ['mismatch', 'revoked']) {
    const paths = await files(t, { store: {
      version: 1, credentials: { [AGENT_ID]: { clientId: 'mc_stored', clientSecret: opaque() } },
    } })
    const auth = fakeAuthority({ clientStatus: scenario === 'revoked' ? 'revoked' : 'active' })
    auth.state.principal = { id: 'principal-fixed', status: 'active' }
    auth.state.client = { id: scenario === 'mismatch' ? 'mc_auth' : 'mc_stored', status: scenario === 'revoked' ? 'revoked' : 'active' }
    await assert.rejects(
      ensureAgentCredential({
        agentId: AGENT_ID, agentDefinitionFile: paths.definitionFile,
        credentialsFile: paths.credentialsFile, auth, prerequisites: { c: true, b: true },
      }),
      { code: 'auth_client_missing_or_revoked' },
    )
    assert.equal(auth.state.rotations, 0)
  }
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
