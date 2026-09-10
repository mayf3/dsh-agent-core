#!/usr/bin/env node
// canonical-agent-onboarding.mjs — the canonical operator entrypoint for
// formal Agent onboarding (AGENT_CORE_CANONICAL_ONBOARDING_COMPLETION_V1).
//
// proposed approvalRef label (NOT an owner authorization until accepted):
//   OWNER-CANONICAL-ONBOARDING-20260909-01 — see spec §0 AUTHORITY STATUS.
// PRODUCTION_OPERATION_AUTHORIZED = NO.
//
// identity provisioning reuses the accepted ensureAgentCredential VERBATIM;
// the Life Workbench baseline converges via the existing standing
// reconciliation vehicle; no parallel onboarding, no Workbench-specific
// identity semantics, no per-Agent approval.
//
// Deployment-side operator tooling (root seam, same class as
// production-agent-provision.mjs). Secret handling (Part H):
//   - the provisioner secret and the one-time client secret only ever live in
//     process memory (file read / response body) and the 0600 trusted store;
//   - NEVER in argv/env/stdout/logs — the CLI accepts NON-SECRET operation
//     parameters only (agent id, display name, client id, file paths);
//   - there is deliberately NO database interface: no DSN ever reaches this
//     process (the secret-in-argv class of interfaces is excluded by design).
//
// Transport (spec §5, parent-authority prerequisite): the accepted library
// freezes HTTPS origins; the deployed auth-service is loopback http. This CLI
// performs NO scheme downgrade and holds NO transport adapter — until the
// parent authority resolves the provisioning transport (amendment / explicit
// prerequisite resolution), identity provisioning fails closed at the transport
// boundary (manifesting as the library's https-origin gate / transport failure):
// the honest state is AUTH_TRANSPORT_RESOLUTION_REQUIRED (spec §5).
//
// C1 gate (AMENDMENT_8 A8.2): :4001 must LISTEN on loopback ONLY. A wildcard
// (0.0.0.0/*) or external binding fails the onboarding closed until the
// auth-service deployment rebinds (production-package step, not executed by
// this CLI).
function assertLoopbackBinding() {
  const known = ['lsof', '/usr/sbin/lsof', '/usr/bin/lsof']
  let out
  let last
  for (const lsof of known) {
    try {
      out = execFileSync(lsof, ['-nP', '-iTCP:4001', '-sTCP:LISTEN'], { encoding: 'utf8', timeout: 15000 })
      last = undefined
      break
    } catch (error) {
      last = error
      if (error?.code !== 'ENOENT') break
    }
  }
  if (out === undefined) {
    die('AUTH_TRANSPORT_RESOLUTION_REQUIRED', { message: `loopback binding proof unavailable (lsof failed: ${String(last?.message ?? last).slice(0, 120)})` })
  }
  const listenLines = out.split('\n').filter((line) => /LISTEN/.test(line) && !/COMMAND/.test(line))
  if (listenLines.length === 0) {
    die('AUTH_TRANSPORT_RESOLUTION_REQUIRED', { message: 'no LISTEN socket on :4001 — auth-service unreachable' })
  }
  const wildcard = listenLines.filter((line) => /\*\.4001|\*:4001/.test(line))
  if (wildcard.length > 0) {
    die('AUTH_TRANSPORT_RESOLUTION_REQUIRED', {
      message: 'auth-service listens on a non-loopback (wildcard/external) address — AMENDMENT_8 C1 FAIL_CLOSED until the deployment rebinds 127.0.0.1',
      listeners: listenLines.map((line) => line.trim().slice(0, 80)),
    })
  }
}

// Usage:
//   sudo node scripts/canonical-agent-onboarding.mjs onboard \
//     --agent <agt_*> --name <display> [--description <d>] \
//     --provisioner-client-id <mc_*> \
//     [--authority <agents.json>] [--store <credentials.json>]
//     [--store-owner-uid <n> --store-owner-gid <n>]
//     [--provisioner-secret-file <0600 file>]
//   node scripts/canonical-agent-onboarding.mjs status --agent <agt_*> [...same faces]
//
// Exit: 0 = ONBOARDING_READY; 2 = definition/identity/transport fail-loud;
// 3 = BASELINE_ENTITLEMENTS_PENDING (identity preserved; retryable); 1 = usage.

import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

import {
  createAuthProvisioningClient,
  ensureAgentCredential,
  readCredentialStoreDocument,
} from '../packages/agent-credential-provisioning/src/index.js'
import { classifyOnboardingState, runCanonicalOnboarding } from './canonical-onboarding-lib.mjs'

// Provisioning transport (spec §5): the origin string satisfies the accepted
// library's HTTPS contract; the deployed service has no TLS face yet, so calls
// adapter and no http fallback by design. RESOLVED: parent AMENDMENT_8
// (CONTROLLED_LOOPBACK_HTTP_PROVISIONING_EXCEPTION, PR #244) accepts exactly
// this pinned loopback origin; this CLI additionally enforces the C1
// mechanical gate (loopback-only LISTEN) before any onboarding mutation.
const AUTH_ORIGIN = 'http://127.0.0.1:4001'
const PROVISIONER_SECRET_FILE = '/Users/yanfenma/.openclaw/credentials/broker-provisioning-v2-secret'
const BASELINE_EXECUTOR = '/usr/local/libexec/lw-pilot-executor'
const BASELINE_REF = 'OWNER-LIFE-WORKBENCH-BASELINE-20260908-01' // standing entitlement ref (pre-existing, not per-agent)
const DEFAULT_AUTHORITY = '/usr/local/libexec/agent-core/config/agents.json'
const DEFAULT_STORE = '/usr/local/libexec/agent-core/credential-store/agent-credentials.json'
const DEFAULT_PREIMAGE_DIR = '/Users/yanfenma/workspace/deployment-artifacts/canonical-onboarding-v1/preimages'

function argValue(args, flag) {
  const i = args.indexOf(flag)
  return i === -1 ? undefined : args[i + 1]
}

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

function die(code, payload) {
  emit({ ok: false, fail_code: code, ...payload })
  process.exit(code === 'BASELINE_ENTITLEMENTS_PENDING' ? 3 : 2)
}

function buildProductionAuthClient({ provisionerClientId, provisionerSecretFile }) {
  if (provisionerClientId === undefined) {
    die('PROVISIONER_CLIENT_REQUIRED', {
      message: 'pass --provisioner-client-id <mc_*> (a NON-secret id; no database interface exists in this CLI by design)',
    })
  }
  const secret = readFileSync(provisionerSecretFile, 'utf8').trim()
  let cachedToken
  return createAuthProvisioningClient({
    authServiceOrigin: AUTH_ORIGIN, // https contract face; fail-closed until transport resolution (spec §5)
    getManagementAccessToken: async () => {
      if (cachedToken !== undefined) return cachedToken
      const basic = Buffer.from(`${provisionerClientId}:${secret}`).toString('base64')
      const response = await fetch(`${AUTH_ORIGIN}/oauth/token`, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ grant_type: 'client_credentials', resource: 'svc-auth', scope: 'auth.identity.provision' }).toString(),
        signal: AbortSignal.timeout(15000),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || typeof body?.access_token !== 'string' || body.access_token === '') {
        const error = new Error(`svc-auth management mint rejected with HTTP ${response.status}`)
        error.code = 'EXTERNAL_PREREQUISITE_MISSING'
        throw error
      }
      cachedToken = body.access_token
      return cachedToken
    },
  })
}

function runBaseline() {
  const run = (args) => {
    try {
      return { exitCode: 0, output: execFileSync(BASELINE_EXECUTOR, args, { encoding: 'utf8', timeout: 120000 }) }
    } catch (error) {
      if (typeof error?.status === 'number') return { exitCode: error.status, output: String(error.stdout ?? '') }
      throw error
    }
  }
  const apply = run(['apply-baseline-grants', BASELINE_REF])
  if (apply.exitCode !== 0) {
    return { apply, verify: { exitCode: apply.exitCode, output: '' } }
  }
  const verify = run(['verify-baseline-grants', BASELINE_REF])
  return { apply, verify }
}

function resolveStoreOwner(storeFile, uidFlag, gidFlag) {
  if ((uidFlag === undefined) !== (gidFlag === undefined)) {
    die('BAD_STORE_OWNER', { message: '--store-owner-uid and --store-owner-gid must be supplied together' })
  }
  if (uidFlag !== undefined) return { ownerUid: Number(uidFlag), ownerGid: Number(gidFlag) }
  // Default: the live store's own trusted owner (post-migration: authsvc).
  try {
    const stat = statSync(storeFile)
    return { ownerUid: stat.uid, ownerGid: stat.gid }
  } catch { /* fall through to the zone directory */ }
  try {
    const stat = statSync(storeFile.replace(/[/][^/]+$/, ''))
    return { ownerUid: stat.uid, ownerGid: stat.gid }
  } catch {
    die('STORE_OWNER_UNRESOLVED', { message: 'store owner could not be derived; pass --store-owner-uid/--store-owner-gid' })
  }
}

async function main() {
  const args = process.argv.slice(2)
  const mode = args[0]
  if (mode !== 'onboard' && mode !== 'status') {
    process.stderr.write('usage: canonical-agent-onboarding.mjs <onboard|status> --agent <agt_*> --provisioner-client-id <mc_*> [faces]\n')
    process.exit(1)
  }
  const agentId = argValue(args, '--agent')
  if (agentId === undefined || !/^agt_[A-Za-z0-9_-]+$/.test(agentId)) {
    die('BAD_AGENT_ID', { message: 'agent id must match ^agt_[A-Za-z0-9_-]+$' })
  }
  const input = {
    agentId,
    name: argValue(args, '--name'),
    description: argValue(args, '--description'),
    authorityFile: argValue(args, '--authority') ?? DEFAULT_AUTHORITY,
    storeFile: argValue(args, '--store') ?? DEFAULT_STORE,
    preimageDir: argValue(args, '--preimage-dir') ?? DEFAULT_PREIMAGE_DIR,
  }
  const storeWriteOwner = resolveStoreOwner(input.storeFile, argValue(args, '--store-owner-uid'), argValue(args, '--store-owner-gid'))
  const deps = {
    ensureAgentCredential,
    readCredentialStoreDocument,
    buildAuthClient: () => buildProductionAuthClient({
      provisionerClientId: argValue(args, '--provisioner-client-id'),
      provisionerSecretFile: argValue(args, '--provisioner-secret-file') ?? PROVISIONER_SECRET_FILE,
    }),
    runBaseline,
  }

  if (mode === 'status') {
    const classification = await classifyOnboardingState(deps, { ...input, storeWriteOwner })
    emit({ ok: true, mode, ...classification })
    return
  }

  assertLoopbackBinding()
  try {
    const result = await runCanonicalOnboarding(deps, input)
    emit({ ok: true, mode, proposed_approval_ref_label: 'OWNER-CANONICAL-ONBOARDING-20260909-01', production_operation_authorized: false, ...result })
    process.exit(0)
  } catch (error) {
    const code = error?.code ?? 'ONBOARDING_FAILED'
    die(code, {
      message: error?.message ?? String(error),
      agentId,
      identity_preserved: code === 'BASELINE_ENTITLEMENTS_PENDING',
      fields: { ...(error ?? {}) },
    })
  }
}

await main()
