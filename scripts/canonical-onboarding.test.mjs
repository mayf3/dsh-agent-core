// Offline fixture tests for the CANONICAL_ONBOARDING_COMPLETION_V1 state
// machine (scripts/canonical-onboarding-lib.mjs). No production faces: the
// ensure implementation IS the accepted library exercised against fixture
// files; auth is a fake with the deployed wire shapes; baseline is a stub.
// Zero network, zero production contact.

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { ensureAgentCredential, readCredentialStoreDocument } from '../packages/agent-credential-provisioning/src/index.js'
import { CanonicalOnboardingError, runCanonicalOnboarding } from './canonical-onboarding-lib.mjs'

const AGENT_ID = 'agt_onboarding_canary'

async function fixtureFaces(t, { authorityAgents = [], verification = { status: 200 } } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'canonical-onboarding-'))
  const authorityFile = join(directory, 'agents.json')
  const storeDir = join(directory, 'store')
  await mkdir(storeDir, { mode: 0o700 })
  const storeFile = join(storeDir, 'credentials.json')
  // Production-like authority: a pre-existing enabled base agent as default.
  const agents = [{ id: 'agt_base', name: 'Base', description: null }, ...authorityAgents]
  await writeFile(authorityFile, `${JSON.stringify({ version: 1, defaultAgentId: 'agt_base', agents })}\n`)
  const state = {
    calls: [],
    principal: undefined,
    client: undefined,
    secret: undefined,
    baselines: [],
    grantCreated: false,
    verification,
  }
  const auth = {
    async beginManagementOperation() {
      state.calls.push('management')
      return {
        ensurePrincipal: async (body) => {
          state.calls.push('principal')
          const wasMissing = state.principal === undefined
          state.principal ??= { id: 'principal-fixed', status: 'active' }
          return { ...state.principal, created: wasMissing }
        },
        ensureClient: async (body) => {
          state.calls.push('client')
          const wasMissing = state.client === undefined
          if (wasMissing) {
            state.secret = randomBytes(32).toString('base64url')
            state.client = { id: 'mc_fixed', status: 'active' }
          }
          // Deployed seam wire shape: the one-time secret rides as `secret`.
          return { ...state.client, created: wasMissing, ...(wasMissing ? { secret: state.secret } : {}) }
        },
      }
    },
    async verifyCredential({ credential }) {
      state.calls.push(`verify:${credential.clientId}`)
      return state.verification
    },
  }
  const deps = {
    ensureAgentCredential,
    readCredentialStoreDocument,
    buildAuthClient: () => auth,
    runBaseline: async () => {
      state.baselines.push(1)
      if (state.baselineBehavior === 'fail') {
        return { apply: { exitCode: 0, output: `${JSON.stringify({ agentId: AGENT_ID, outcome: 'create', provenanceMatch: true })}\n` }, verify: { exitCode: 3, output: '{"end_state_reached": false}' } }
      }
      // Fleet census reality: the target's grant is created once; every later
      // run sees an already-converged fleet (noop).
      const targetRow = state.grantCreated
        ? `${JSON.stringify({ agentId: AGENT_ID, outcome: 'noop', provenanceMatch: true })}\n`
        : `${JSON.stringify({ agentId: AGENT_ID, outcome: 'create', provenanceMatch: true })}\n`
      state.grantCreated = true
      return {
        apply: { exitCode: 0, output: targetRow },
        verify: { exitCode: 0, output: '"end_state_reached": true' },
      }
    },
  }
  const faces = {
    authorityFile,
    storeFile,
    storeWriteOwner: {}, // fixture: process-owned trusted dir (default owner)
    preimageDir: join(directory, 'preimages'),
  }
  t.after(async () => { await import('node:fs/promises').then(({ rm }) => rm(directory, { recursive: true, force: true })) })
  return { directory, authorityFile, storeFile, deps, faces, state, auth }
}

test('fresh onboarding: definition create → IDENTITY_READY → baseline create → ONBOARDING_READY', async (t) => {
  const { deps, faces, state } = await fixtureFaces(t)
  const result = await runCanonicalOnboarding(deps, {
    agentId: AGENT_ID, name: 'LW Lifecycle Canary', description: 'canary', ...faces,
  })
  assert.equal(result.finalState, 'ONBOARDING_READY')
  assert.deepEqual(result.states, ['DEFINITION_READY', 'IDENTITY_READY', 'ONBOARDING_READY'])
  assert.equal(result.definition.action, 'create')
  assert.equal(result.identity.action, 'clean_bootstrap')
  assert.equal(result.identity.principalId, 'principal-fixed')
  assert.equal(result.identity.clientId, 'mc_fixed')
  assert.deepEqual(result.baseline.createdAgents, [AGENT_ID])
  assert.equal(result.baseline.targetWasNew, true)
  // exactly one S1, one S2, one store write, one verification mint
  assert.equal(state.calls.filter((c) => c === 'principal').length, 1)
  assert.equal(state.calls.filter((c) => c === 'client').length, 1)
  const persisted = JSON.parse(await readFile(faces.storeFile, 'utf8'))
  assert.equal(persisted.credentials[AGENT_ID].clientSecret, state.secret)
  // definition landed through the accepted writer (validatable document)
  const authority = JSON.parse(await readFile(faces.authorityFile, 'utf8'))
  assert.equal(authority.agents.some((agent) => agent.id === AGENT_ID), true)
})

test('rerun is idempotent: no second Principal/Client/credential, baseline noop, ONBOARDING_READY', async (t) => {
  const { deps, faces, state } = await fixtureFaces(t)
  const input = { agentId: AGENT_ID, name: 'LW Lifecycle Canary', description: 'canary', ...faces }
  await runCanonicalOnboarding(deps, input)
  const secretBefore = JSON.parse(await readFile(faces.storeFile, 'utf8')).credentials[AGENT_ID].clientSecret
  const baselineRunsBefore = state.baselines.length

  const result = await runCanonicalOnboarding(deps, input)
  assert.equal(result.finalState, 'ONBOARDING_READY')
  assert.equal(result.definition.action, 'noop')
  assert.equal(result.identity.action, 'already_ready')
  assert.equal(result.baseline.createdAgents.length, 0)
  assert.equal(state.baselines.length, baselineRunsBefore + 1) // standing vehicle re-invoked (fleet noop)
  assert.equal(state.calls.filter((c) => c === 'principal').length, 1) // still exactly one identity
  assert.equal(state.calls.filter((c) => c === 'client').length, 1)
  const persisted = JSON.parse(await readFile(faces.storeFile, 'utf8'))
  assert.equal(persisted.credentials[AGENT_ID].clientSecret, secretBefore) // same credential generation
})

test('baseline failure fails loud as BASELINE_ENTITLEMENTS_PENDING and never revokes the identity', async (t) => {
  const { deps, faces, state } = await fixtureFaces(t)
  const input = { agentId: AGENT_ID, name: 'LW Lifecycle Canary', description: 'canary', ...faces }
  await runCanonicalOnboarding(deps, input)
  state.baselineBehavior = 'fail'
  await assert.rejects(
    runCanonicalOnboarding(deps, input),
    (error) => error instanceof CanonicalOnboardingError && error.code === 'BASELINE_ENTITLEMENTS_PENDING',
  )
  const persisted = JSON.parse(await readFile(faces.storeFile, 'utf8'))
  assert.equal(persisted.credentials[AGENT_ID].clientId, 'mc_fixed') // identity preserved, retryable
})

test('disabled definition refuses loudly (no silent re-enable)', async (t) => {
  const { deps, faces } = await fixtureFaces(t, {
    authorityAgents: [{ id: AGENT_ID, name: 'Canary', description: null, disabled: true }],
  })
  await assert.rejects(
    runCanonicalOnboarding(deps, { agentId: AGENT_ID, name: 'Canary', ...faces }),
    (error) => error instanceof CanonicalOnboardingError && error.code === 'DEFINITION_DISABLED',
  )
})

test('liveness confirm on rerun with a dead stored credential fails loud (no second identity)', async (t) => {
  const { deps, faces, state } = await fixtureFaces(t)
  const input = { agentId: AGENT_ID, name: 'LW Lifecycle Canary', description: 'canary', ...faces }
  await runCanonicalOnboarding(deps, input)
  // The credential later dies (rotation drift era); the rerun must classify
  // via the liveness mint and fail loud instead of minting a second identity.
  state.verification = { status: 401, oauthError: 'invalid_client' }
  await assert.rejects(
    runCanonicalOnboarding(deps, input),
    (error) => error instanceof CanonicalOnboardingError && error.code === 'CREDENTIAL_LIVENESS_REJECTED',
  )
  assert.equal(state.calls.filter((c) => c === 'client').length, 1) // no second client ever
})

test('explicit storeWriteOwner reaches the trusted store seam (propagation probe)', async (t) => {
  const { deps, faces } = await fixtureFaces(t)
  // A non-root writer cannot nominate a different trusted owner — this store
  // writer rejection is the PROOF the explicit value travels the accepted path
  // into trustedOwner; wiring that dropped storeWriteOwner would silently
  // succeed under the process owner instead of failing here.
  await assert.rejects(
    runCanonicalOnboarding(deps, {
      agentId: AGENT_ID, name: 'Canary', ...faces,
      storeWriteOwner: { ownerUid: 12345, ownerGid: 12345 },
    }),
    (error) => /nominate a different trusted owner/.test(error?.message ?? ''),
  )
})

test('explicit process-owned storeWriteOwner is the accepted write face', async (t) => {
  const { deps, faces } = await fixtureFaces(t)
  const result = await runCanonicalOnboarding(deps, {
    agentId: AGENT_ID, name: 'LW Lifecycle Canary', description: 'canary', ...faces,
    storeWriteOwner: { ownerUid: process.getuid(), ownerGid: process.getgid() },
  })
  assert.equal(result.finalState, 'ONBOARDING_READY')
  assert.equal(result.identity.action, 'clean_bootstrap')
})

test('production onboard call site carries the resolved storeWriteOwner (CLI wiring regression)', async () => {
  const source = await readFile(new URL('./canonical-agent-onboarding.mjs', import.meta.url), 'utf8')
  // The resolved trusted store owner must reach BOTH faces of the CLI.
  assert.match(source, /const classification = await classifyOnboardingState\(deps, \{ \.\.\.input, storeWriteOwner \}\)/)
  assert.match(source, /await runCanonicalOnboarding\(\s*deps,\s*\{ \.\.\.input, storeWriteOwner \},\s*\)/)
  // The owner-dropping bare form is the production defect class — banned.
  assert.doesNotMatch(source, /runCanonicalOnboarding\(deps, input\)/)
  assert.match(source, /const storeWriteOwner = resolveStoreOwner\(/)
})
