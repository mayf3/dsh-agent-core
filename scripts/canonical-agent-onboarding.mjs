#!/usr/bin/env node
// canonical-agent-onboarding.mjs — the canonical operator entrypoint for
// formal Agent onboarding (AGENT_CORE_CANONICAL_ONBOARDING_COMPLETION_V1).
//
// approvalRef: OWNER-CANONICAL-ONBOARDING-20260909-01
// Authorizing directive: owner CONTINUE_SAME_GOAL ruling (2026-09-09) —
// identity provisioning reuses the accepted ensureAgentCredential VERBATIM;
// the Life Workbench baseline converges via the existing standing
// reconciliation vehicle; no parallel onboarding, no Workbench-specific
// identity semantics, no per-Agent approval.
//
// Deployment-side operator tooling (root seam, same class as
// production-agent-provision.mjs). Secrets (Part H): the provisioner secret
// and the one-time client secret only ever live in process memory and the
// 0600 trusted store — never argv/env/stdout/logs.
//
// Usage:
//   sudo node scripts/canonical-agent-onboarding.mjs onboard \
//     --agent <agt_*> --name <display> [--description <d>] \
//     [--authority <agents.json>] [--store <credentials.json>]
//     [--store-owner-uid <n> --store-owner-gid <n>]
//     [--provisioner-client-id <mc_*> | --auth-db-url <libpq>]
//     [--provisioner-secret-file <0600 file>] [--provisioner-principal <uuid>]
//   node scripts/canonical-agent-onboarding.mjs status --agent <agt_*> [...same faces]
//
// Exit: 0 = ONBOARDING_READY; 2 = definition/identity fail-loud; 3 =
// BASELINE_ENTITLEMENTS_PENDING (identity preserved; retryable); 1 = usage.

import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

import {
  createAuthProvisioningClient,
  readCredentialStoreDocument,
} from '../packages/agent-credential-provisioning/src/index.js'
import { classifyOnboardingState, runCanonicalOnboarding } from './canonical-onboarding-lib.mjs'

// Production faces (deployment-pinned; mirror the runtime/executor bindings).
const AUTH_HTTPS_ORIGIN = 'https://127.0.0.1:4001' // contract face (library freezes https origins)
const AUTH_LOOPBACK_ORIGIN = 'http://127.0.0.1:4001' // deployed transport (loopback, same as BROKER_AUTH_ORIGIN)
const PROVISIONER_SECRET_FILE = '/Users/yanfenma/.openclaw/credentials/broker-provisioning-v2-secret'
const PROVISIONER_PRINCIPAL_ID = '857b20c3-8d84-497d-950a-7b185a116687'
const PROVISIONER_CLIENT_PREFIX = 'mc_prov_'
const BASELINE_EXECUTOR = '/usr/local/libexec/lw-pilot-executor'
const BASELINE_REF = 'OWNER-LIFE-WORKBENCH-BASELINE-20260908-01' // standing entitlement ref (not per-agent)
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

// Loopback transport adapter: the accepted client freezes https origins; the
// deployed auth-service is loopback http (same trust domain as the broker
// transport). Only the scheme is rewritten; host/port are pinned constants.
function loopbackFetch(url, options) {
  const target = String(url)
  return fetch(target.startsWith(AUTH_HTTPS_ORIGIN) ? AUTH_LOOPBACK_ORIGIN + target.slice(AUTH_HTTPS_ORIGIN.length) : target, options)
}

function resolveProvisionerClientId({ provisionerClientId, authDbUrl }) {
  if (provisionerClientId !== undefined) {
    if (!provisionerClientId.startsWith(PROVISIONER_CLIENT_PREFIX)) {
      die('BAD_PROVISIONER_CLIENT', { message: `provisioner client id must start with ${PROVISIONER_CLIENT_PREFIX}` })
    }
    return provisionerClientId
  }
  if (authDbUrl === undefined) {
    die('PROVISIONER_CLIENT_UNRESOLVED', { message: 'pass --provisioner-client-id or --auth-db-url for mechanical resolution' })
  }
  // Ids only (Part H): the SQL travels via STDIN, the principal id as a psql
  // variable; the secret never enters this channel. Candidate psql paths cover
  // sudo's secure PATH (brew installs live outside it).
  const sql = "SELECT client_id FROM machine_clients WHERE machine_principal_id = :'principal' AND client_id LIKE 'mc_prov_%' AND status = 'active' AND revoked_at IS NULL;"
  const psqlCandidates = ['psql', '/usr/local/bin/psql', '/opt/homebrew/bin/psql', '/usr/local/opt/postgresql@16/bin/psql', '/opt/homebrew/opt/postgresql@16/bin/psql']
  let stdout
  let lastError
  for (const psql of psqlCandidates) {
    try {
      stdout = execFileSync(psql, [authDbUrl, '-At', '-v', 'ON_ERROR_STOP=1', `-v`, `principal=${PROVISIONER_PRINCIPAL_ID}`], {
        input: sql,
        encoding: 'utf8',
        timeout: 15000,
      })
      break
    } catch (error) {
      lastError = error
      if (error?.code !== 'ENOENT') break // psql found but failed: do not retry other paths
    }
  }
  if (stdout === undefined) {
    die('PROVISIONER_RESOLUTION_FAILED', { message: `psql resolution failed: ${String(lastError?.message ?? lastError).slice(0, 200)}` })
  }
  const ids = stdout.split('\n').map((line) => line.trim()).filter((line) => line.startsWith(PROVISIONER_CLIENT_PREFIX))
  if (ids.length !== 1) {
    die('PROVISIONER_CLIENT_NOT_RESOLVED', { message: `expected exactly one active ${PROVISIONER_CLIENT_PREFIX}* client on the provisioner principal, found ${ids.length}` })
  }
  return ids[0]
}

function buildProductionAuthClient({ provisionerClientId, authDbUrl, provisionerSecretFile }) {
  const clientId = resolveProvisionerClientId({ provisionerClientId, authDbUrl })
  const secret = readFileSync(provisionerSecretFile, 'utf8').trim()
  let cachedToken
  return createAuthProvisioningClient({
    authServiceOrigin: AUTH_HTTPS_ORIGIN,
    fetchImpl: loopbackFetch,
    getManagementAccessToken: async () => {
      if (cachedToken !== undefined) return cachedToken
      const basic = Buffer.from(`${clientId}:${secret}`).toString('base64')
      const response = await loopbackFetch(`${AUTH_LOOPBACK_ORIGIN}/oauth/token`, {
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
  for (const path of [storeFile, `${storeFile}.tmp-probe`]) {
    try {
      const stat = statSync(path)
      return { ownerUid: stat.uid, ownerGid: stat.gid }
    } catch { /* try next */ }
  }
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
    process.stderr.write('usage: canonical-agent-onboarding.mjs <onboard|status> --agent <agt_*> [faces]\n')
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
      authDbUrl: argValue(args, '--auth-db-url'),
      provisionerSecretFile: argValue(args, '--provisioner-secret-file') ?? PROVISIONER_SECRET_FILE,
    }),
    runBaseline,
  }

  if (mode === 'status') {
    const classification = await classifyOnboardingState(deps, { ...input, storeWriteOwner })
    emit({ ok: true, mode, ...classification })
    return
  }

  try {
    const result = await runCanonicalOnboarding(deps, input)
    emit({ ok: true, mode, approval_ref: 'OWNER-CANONICAL-ONBOARDING-20260909-01', ...result })
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
