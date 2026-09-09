// canonical-onboarding-lib.mjs — CANONICAL_ONBOARDING_COMPLETION_V1 state
// machine (dependency-injected; the operator CLI wires the production faces).
//
// proposed approvalRef label (NOT an owner authorization until accepted):
//   OWNER-CANONICAL-ONBOARDING-20260909-01 — see spec §0 AUTHORITY STATUS
// Authorizing directive: owner CONTINUE_SAME_GOAL ruling (2026-09-09) —
// IDENTITY_LIFECYCLE_OWNER = mayf3/dsh-agent-core; identity provisioning MUST
// reuse the accepted ensureAgentCredential verbatim (no parallel onboarding);
// agent.definition.write is definition mutation, NOT onboarding completion;
// Life Workbench belongs only to the final baseline-entitlement layer, delivered
// by the existing standing reconciliation vehicle.
//
// Target chain (observable, retryable states — no cross-system transaction):
//   definition committed → ensureAgentCredential → IDENTITY_READY (mint PASS)
//   → standing baseline reconciliation → entitlements converged → ONBOARDING_READY
// Failure semantics: a baseline failure NEVER revokes the created canonical
// identity; it fails loud and stays retryable (BASELINE_ENTITLEMENTS_PENDING).
// Idempotent rerun: no second Principal/Client/credential/Grant is ever created
// (the accepted library's Phase A fail-loud is preserved verbatim; this lib only
// classifies `existing_credential_resolution_required` into a liveness confirm).

import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { readDefinition, writeAgentDefinition } from '../packages/agent-definition/src/config.js'
import {
  classifyVerificationResult,
  ensureAgentCredential,
  readCredentialStoreDocument,
} from '../packages/agent-credential-provisioning/src/index.js'

export class CanonicalOnboardingError extends Error {
  constructor(code, message, fields = {}) {
    super(message)
    this.name = 'CanonicalOnboardingError'
    this.code = code
    Object.assign(this, fields)
  }
}

function fail(code, message, fields = {}) {
  throw new CanonicalOnboardingError(code, message, fields)
}

function classifyStoreEntry(storeDocument, agentId) {
  const entry = storeDocument.credentials[agentId]
  if (entry === undefined) return 'absent'
  return entry
}

// ── STEP 1: definition (accepted writer only; preimage backed up) ───────────

async function ensureDefinition(_deps, { agentId, name, description, authorityFile, preimageDir }) {
  const doc = readDefinition(authorityFile)
  if (doc === undefined) fail('AUTHORITY_MISSING', `agent definition config unreadable: ${authorityFile}`)
  const existing = doc.agents.find((agent) => agent.id === agentId)
  if (existing !== undefined && existing.disabled) {
    fail('DEFINITION_DISABLED', `${agentId} exists and is disabled — refusing (no silent re-enable)`, { agentId })
  }
  if (existing !== undefined) {
    return { state: 'DEFINITION_READY', action: 'noop', nameMatches: existing.name === name }
  }
  if (typeof name !== 'string' || name.trim() === '') fail('BAD_NAME', 'name is required to create a definition')
  if (preimageDir !== undefined && preimageDir !== null) {
    mkdirSync(preimageDir, { recursive: true })
    copyFileSync(authorityFile, join(preimageDir, `agents-${agentId}.preimage`))
  }
  const entry = description == null ? { id: agentId, name } : { id: agentId, name, description }
  const agents = [...doc.agents, entry]
  // accepted adoption semantics: an existing default is preserved; the first
  // registered agent becomes default only when the config had none.
  const next = { ...doc, defaultAgentId: doc.defaultAgentId ?? agents[0]?.id ?? null, agents }
  await writeAgentDefinition(authorityFile, next)
  return { state: 'DEFINITION_READY', action: 'create', nameMatches: true }
}

// ── STEP 2: identity (the accepted implementation, verbatim) ────────────────

async function ensureIdentity(deps, { agentId, authorityFile, storeFile, storeWriteOwner }) {
  try {
    const result = await deps.ensureAgentCredential({
      agentId,
      agentDefinitionFile: authorityFile,
      credentialsFile: storeFile,
      auth: deps.buildAuthClient(),
      prerequisites: { c: true, d: true },
      storeWriteOptions: storeWriteOwner,
      // A fresh canonical client holds no business grant yet; the deployed v1
      // law answers with 400 invalid_scope AFTER secret validation — the
      // accepted D.5 proof of credential validity. Workbench-neutral audience.
      verification: { mode: 'v1', resource: 'svc-forum', scope: 'forum.read', validDeployedAudience: true },
    })
    return { state: 'IDENTITY_READY', action: 'clean_bootstrap', principalId: result.principalId, clientId: result.clientId }
  } catch (error) {
    if (error?.code !== 'existing_credential_resolution_required') throw error
  }
  // Rerun (store entry present): the library's Phase A fail-loud stands; this
  // is a LIVENESS confirm, not reconciliation — never a second identity.
  const store = await deps.readCredentialStoreDocument(storeFile, storeWriteOwner)
  const stored = classifyStoreEntry(store, agentId)
  if (stored === 'absent') fail('IDENTITY_STATE_LOST', 'store entry vanished between classification and ensure', { agentId })
  const verification = await deps.buildAuthClient().verifyCredential({
    credential: { clientId: stored.clientId, clientSecret: stored.clientSecret },
    resource: 'svc-forum',
    scope: 'forum.read',
  })
  const classification = classifyVerificationResult(verification, {
    mode: 'v1',
    validDeployedAudience: true,
    prerequisiteDReady: true,
  })
  if (classification.kind === 'credential_valid') {
    return { state: 'IDENTITY_READY', action: 'already_ready', clientId: stored.clientId }
  }
  if (classification.kind === 'credential_invalid') {
    fail('CREDENTIAL_INVALID', 'stored credential failed liveness mint (401) — recovery is the canonical rotation seam, not a second identity', { agentId, clientId: stored.clientId })
  }
  fail('CREDENTIAL_LIVENESS_INCONCLUSIVE', 'stored credential liveness mint inconclusive', { agentId, classification })
}

// ── STEP 3: mandatory baseline entitlements (standing vehicle) ──────────────

async function reconcileBaseline(deps, { agentId }) {
  const outcome = await deps.runBaseline()
  // outcome: { apply: { exitCode, output }, verify: { exitCode, output } }
  if (outcome.verify.exitCode !== 0 || !outcome.verify.output.includes('"end_state_reached": true')) {
    fail('BASELINE_ENTITLEMENTS_PENDING', 'baseline reconciliation did not reach end state — identity is preserved, rerun the onboarding entrypoint', {
      agentId,
      verifyExitCode: outcome.verify.exitCode,
    })
  }
  const createdAgents = [...outcome.apply.output.matchAll(/\{"agentId":"([^"]+)","outcome":"create"/g)].map((m) => m[1])
  const noopCount = (outcome.apply.output.match(/"outcome":"noop"/g) ?? []).length
  return {
    state: 'ONBOARDING_READY',
    createdAgents,
    noopCount,
    containsTarget: createdAgents.includes(agentId),
    targetWasNew: createdAgents.includes(agentId),
  }
}

/**
 * @param {object} deps injected production faces
 *   - ensureAgentCredential: the ACCEPTED implementation (verbatim)
 *   - readCredentialStoreDocument: accepted store reader
 *   - buildAuthClient(): accepted createAuthProvisioningClient(...) with
 *       loopback transport adapter and (c) management-token provider
 *   - runBaseline(): the standing privileged reconciliation invocation
 * @param {object} input { agentId, name, description, authorityFile, storeFile, storeWriteOwner, preimageDir }
 */
export async function runCanonicalOnboarding(deps, input) {
  const { agentId } = input
  const trace = { agentId, states: [] }

  // Classification BEFORE any write (D.7.1 invariant: reads and full
  // validation precede every mutation).
  const definition = await ensureDefinition(deps, input)
  trace.states.push(definition.state)
  trace.definition = definition

  const identity = await ensureIdentity(deps, input)
  trace.states.push(identity.state)
  trace.identity = identity

  // Everything thrown inside the baseline phase maps to
  // BASELINE_ENTITLEMENTS_PENDING: the canonical identity stays exactly as it
  // was created (never revoked), the run fails loud and is retryable.
  let baseline
  try {
    baseline = await reconcileBaseline(deps, { agentId })
  } catch (error) {
    fail('BASELINE_ENTITLEMENTS_PENDING', `baseline reconciliation failed: ${error?.message ?? String(error)}`, {
      agentId,
      cause: error?.code ?? 'baseline_runner_error',
    })
  }
  trace.states.push(baseline.state)
  trace.baseline = { createdAgents: baseline.createdAgents, noopCount: baseline.noopCount, targetWasNew: baseline.targetWasNew }

  trace.finalState = 'ONBOARDING_READY'
  return trace
}

/** Read-only onboarding-state classification (no mutation, no Auth calls). */
export async function classifyOnboardingState(deps, { agentId, authorityFile, storeFile, storeWriteOwner }) {
  const doc = readDefinition(authorityFile)
  const inAuthority = doc !== undefined && doc.agents.some((agent) => agent.id === agentId)
  const disabled = inAuthority ? doc.agents.find((agent) => agent.id === agentId).disabled === true : null
  let storeEntry = 'unreadable'
  if (inAuthority && !disabled) {
    const store = await deps.readCredentialStoreDocument(storeFile, storeWriteOwner)
    storeEntry = classifyStoreEntry(store, agentId) === 'absent' ? 'absent' : 'present'
  }
  const state = !inAuthority ? 'NOT_IN_AUTHORITY'
    : disabled ? 'DEFINITION_DISABLED'
    : storeEntry === 'absent' ? 'IDENTITY_PENDING'
    : 'IDENTITY_READY_OR_LATER'
  return { agentId, inAuthority, disabled, storeEntry, state }
}
