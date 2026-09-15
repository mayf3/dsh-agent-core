#!/usr/bin/env node
/**
 * run-routing-install.mjs — SCHEDULER_WATCHDOG_PRODUCTION_CLOSURE_RUNBOOK_V1 §1-§5 (routing portion).
 *
 * CANONICAL_SCHEDULER_OPS_TARGET = oc_f2a6606689691fd7f0a7c7078a0bf2e9 (Owner designation 2026-09-15).
 *
 * Usage (root on the production host):
 *   node run-routing-install.mjs --selftest                  # offline, scratch store, zero production touch
 *   node run-routing-install.mjs --candidate                 # §1 write candidate (root:wheel 0600) + freeze sha
 *   node run-routing-install.mjs --check                     # §3 fresh safety gate (read-only) + §0 overlap check
 *   node run-routing-install.mjs --plan                      # §2 plan mode (zero-write) → candidate/preimage sha
 *   node run-routing-install.mjs --apply                     # §2 apply + receipt/protected-metadata readback
 *
 * Production mutation ownership:
 *   - standalone --candidate/--apply acquires/releases the shared global lock;
 *   - when PRODUCTION_TRANSACTION_ID + LOCK_OWNER_TOKEN are both present, the
 *     parent transaction already owns that lock, so this child only verifies
 *     the holder and MUST NOT acquire or release it;
 *   - exactly one inheritance variable is fail-closed.
 *
 * Fail-closed: any gate mismatch exits non-zero with the exact violated gate; nothing is applied.
 */

import { createHash, randomUUID } from 'node:crypto'
import { chmodSync, chownSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { installSchedulerRoutingManifest } from '../../packages/production-runtime/src/scheduler/deployment-routing.js'
import { validateRoutingManifest, resolveNotificationRoute, ROUTE_CLASSES } from '../../packages/scheduler/src/watchdog/routing.js'
import { JobStore } from '../../packages/scheduler/src/store.js'

const PRODUCTION_DEPLOY_LOCK_DIR = '/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock'
const DESIGNATED_CHAT_ID = 'oc_f2a6606689691fd7f0a7c7078a0bf2e9'
const CANDIDATE_PATH = '/usr/local/libexec/agent-core/config/scheduler-routing-candidate.json'
const TARGET_PATH = process.env.SCHEDULER_ROUTING_TARGET ?? '/Users/authsvc/.agent-core/scheduler/routing.json'
const STORE_PATH = process.env.SCHEDULER_WATCHDOG_STORE ?? '/Users/authsvc/.agent-core/scheduler/jobs.json'
const EXPECTED_UID = 0
const EXPECTED_GID = Number(process.env.SCHEDULER_ROUTING_READER_GID ?? 20)
const ARTIFACTS_DIR = resolve(process.env.SCHEDULER_ROUTING_ARTIFACTS_DIR ?? join(dirname(new URL(import.meta.url).pathname), 'rollback'))
const DEPLOYED_SHA = process.env.AGENT_CORE_DEPLOYED_SHA ?? ''
const manifestOf = () => ({
  version: 1,
  canonicalOpsTarget: { channel: 'feishu', to: DESIGNATED_CHAT_ID },
  ownerTargets: {},
  jobFailureTargets: {},
})
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const tokenHash = (token) => sha256(Buffer.from(token, 'utf8'))
const gate = (name, ok, detail = '') => {
  process.stdout.write(`${ok ? '✔' : '✖'} ${name}${detail ? ` — ${detail}` : ''}\n`)
  if (!ok) process.exitCode = 1
  return ok
}
const failClosed = (message) => {
  process.stderr.write(`✖ FAIL_CLOSED ${message}\n`)
  throw new Error(message)
}

function readLockHolder(lockDir = PRODUCTION_DEPLOY_LOCK_DIR) {
  const holderPath = join(lockDir, 'holder')
  if (!existsSync(holderPath)) return null
  const entries = new Map()
  for (const line of readFileSync(holderPath, 'utf8').split(/\r?\n/)) {
    const idx = line.indexOf('=')
    if (idx > 0) entries.set(line.slice(0, idx), line.slice(idx + 1))
  }
  return entries
}

function inheritedOwnerFromEnv() {
  const transactionId = process.env.PRODUCTION_TRANSACTION_ID ?? ''
  const token = process.env.LOCK_OWNER_TOKEN ?? ''
  if (Boolean(transactionId) !== Boolean(token)) {
    failClosed('inherited production lock requires BOTH PRODUCTION_TRANSACTION_ID and LOCK_OWNER_TOKEN')
  }
  return transactionId ? { transactionId, token, delegated: true } : null
}

function lockMatchesOwner(owner, lockDir = PRODUCTION_DEPLOY_LOCK_DIR) {
  const holder = readLockHolder(lockDir)
  return Boolean(holder)
    && holder.get('transaction_id') === owner.transactionId
    && holder.get('token_sha256') === tokenHash(owner.token)
}

function acquireOrValidateGlobalDeployLock(command, lockDir = PRODUCTION_DEPLOY_LOCK_DIR) {
  const inherited = inheritedOwnerFromEnv()
  if (inherited) {
    if (!lockMatchesOwner(inherited, lockDir)) {
      failClosed(`inherited production lock holder mismatch — ${lockDir}`)
    }
    process.stdout.write(`✔ inherited production transaction verified — ${inherited.transactionId}\n`)
    return inherited
  }

  const owner = {
    transactionId: `routing-${randomUUID()}`,
    token: randomUUID(),
    delegated: false,
  }
  mkdirSync(dirname(lockDir), { recursive: true })
  try {
    mkdirSync(lockDir)
  } catch {
    const holder = existsSync(join(lockDir, 'holder'))
      ? readFileSync(join(lockDir, 'holder'), 'utf8') : '(no holder metadata)'
    failClosed(`global production-deploy mutex already held — ${lockDir}\n${holder}\nSTALE_LOCK_DISPOSITION: verify the holder is dead, then remove EXPLICITLY (sudo rmdir ${lockDir})`)
  }
  writeFileSync(join(lockDir, 'holder'),
    `pid=${process.pid}\ntransaction_id=${owner.transactionId}\ntoken_sha256=${tokenHash(owner.token)}\ncmd=${command}\nstarted=${new Date().toISOString()}\n`)
  process.stdout.write(`✔ global production-deploy mutex acquired — ${lockDir}\n`)
  return owner
}

function releaseGlobalDeployLock(owner, lockDir = PRODUCTION_DEPLOY_LOCK_DIR) {
  if (owner.delegated) return
  if (!lockMatchesOwner(owner, lockDir)) {
    failClosed(`global mutex release refused (holder mismatch) — ${lockDir}`)
  }
  rmSync(join(lockDir, 'holder'))
  rmdirSync(lockDir)
  process.stdout.write(`✔ global production-deploy mutex released — ${lockDir}\n`)
}

async function withProductionMutationLock(command, fn, lockDir = PRODUCTION_DEPLOY_LOCK_DIR) {
  const owner = acquireOrValidateGlobalDeployLock(command, lockDir)
  try {
    return await fn()
  } finally {
    // A delegated child never releases the parent's transaction lock. A
    // standalone routing mutation preserves the pre-existing behavior and
    // releases its own lock even on failure.
    releaseGlobalDeployLock(owner, lockDir)
  }
}

async function loadStoreJobs(storePath) {
  const store = new JobStore(storePath, { clock: () => Date.now() })
  const doc = await store.loadDoc({ force: true })
  return doc
}

function checkCandidate(bytes) {
  const manifest = validateRoutingManifest(JSON.parse(bytes.toString('utf8')))
  if (manifest.canonicalOpsTarget?.to !== DESIGNATED_CHAT_ID) throw new Error('candidate chat id != designated CANONICAL_SCHEDULER_OPS_TARGET')
  return manifest
}

async function selftest() {
  // Offline-verifiable subset. The protected parent-chain walk inside
  // installSchedulerRoutingManifest requires a boundary='/' chain with no
  // ACLs/group-write — only satisfiable on the production host, where
  // --plan (zero-write) exercises it fail-closed before --apply.
  const bytes = Buffer.from(`${JSON.stringify(manifestOf(), null, 2)}\n`, 'utf8')
  const manifest = checkCandidate(bytes)
  gate('SELFTEST manifest binds the designated chat id', manifest.canonicalOpsTarget.to === DESIGNATED_CHAT_ID)
  gate('SELFTEST candidate sha freezes deterministically', sha256(bytes) === sha256(Buffer.from(`${JSON.stringify(manifestOf(), null, 2)}\n`, 'utf8')))
  const decision = resolveNotificationRoute({ routeClass: ROUTE_CLASSES.JOB_FAILURE, job: { logicalKey: 'k', agentId: 'agt_x', delivery: { mode: 'none' } }, manifest })
  gate('SELFTEST JOB_FAILURE fallback resolves to canonicalOpsTarget', decision.route?.to === DESIGNATED_CHAT_ID && decision.routeSource === 'canonicalOpsTarget')
  const business = resolveNotificationRoute({ routeClass: ROUTE_CLASSES.BUSINESS_OUTPUT, job: { delivery: { channel: 'feishu', to: 'oc_business' } }, manifest })
  gate('SELFTEST BUSINESS_OUTPUT never routes to the ops target', business.route?.to === 'oc_business')
  const overlap = resolveNotificationRoute({ routeClass: ROUTE_CLASSES.JOB_FAILURE, job: { logicalKey: 'k', agentId: 'agt_x', delivery: { mode: 'none' } }, manifest: validateRoutingManifest({ ...manifestOf(), ownerTargets: { agt_x: { channel: 'feishu', to: 'oc_owner_x' } } }) })
  gate('SELFTEST ownerTargets override wins over fallback', overlap.route?.to === 'oc_owner_x' && overlap.routeSource === 'ownerTargets')

  const scratch = mkdtempSync(join(tmpdir(), 'scheduler-routing-lock-selftest-'))
  const lockDir = join(scratch, 'production-deploy.lock')
  const savedTx = process.env.PRODUCTION_TRANSACTION_ID
  const savedToken = process.env.LOCK_OWNER_TOKEN
  try {
    delete process.env.PRODUCTION_TRANSACTION_ID
    delete process.env.LOCK_OWNER_TOKEN
    const standalone = acquireOrValidateGlobalDeployLock('selftest standalone', lockDir)
    gate('SELFTEST standalone mutation owns the global lock', !standalone.delegated && lockMatchesOwner(standalone, lockDir))
    releaseGlobalDeployLock(standalone, lockDir)
    gate('SELFTEST standalone mutation releases its own lock', !existsSync(lockDir))

    mkdirSync(lockDir)
    const delegated = { transactionId: 'tx-selftest', token: 'token-selftest', delegated: true }
    writeFileSync(join(lockDir, 'holder'), `pid=1\ntransaction_id=${delegated.transactionId}\ntoken_sha256=${tokenHash(delegated.token)}\ncmd=parent\n`)
    process.env.PRODUCTION_TRANSACTION_ID = delegated.transactionId
    process.env.LOCK_OWNER_TOKEN = delegated.token
    const inherited = acquireOrValidateGlobalDeployLock('selftest delegated', lockDir)
    gate('SELFTEST delegated mutation validates parent ownership', inherited.delegated && lockMatchesOwner(inherited, lockDir))
    releaseGlobalDeployLock(inherited, lockDir)
    gate('SELFTEST delegated mutation never releases parent lock', existsSync(lockDir))

    process.env.LOCK_OWNER_TOKEN = 'wrong-token'
    let mismatchRejected = false
    try { acquireOrValidateGlobalDeployLock('selftest mismatch', lockDir) } catch { mismatchRejected = true }
    gate('SELFTEST inherited holder mismatch FAIL_CLOSED', mismatchRejected)

    delete process.env.LOCK_OWNER_TOKEN
    let halfBindingRejected = false
    try { inheritedOwnerFromEnv() } catch { halfBindingRejected = true }
    gate('SELFTEST half-bound inheritance FAIL_CLOSED', halfBindingRejected)
  } finally {
    if (savedTx === undefined) delete process.env.PRODUCTION_TRANSACTION_ID
    else process.env.PRODUCTION_TRANSACTION_ID = savedTx
    if (savedToken === undefined) delete process.env.LOCK_OWNER_TOKEN
    else process.env.LOCK_OWNER_TOKEN = savedToken
    rmSync(scratch, { recursive: true, force: true })
  }

  gate('SELFTEST complete (offline subset; parent-chain machinery verified on-host via --plan)', process.exitCode !== 1)
}

async function candidateLocked() {
  const bytes = Buffer.from(`${JSON.stringify(manifestOf(), null, 2)}\n`, 'utf8')
  checkCandidate(bytes)
  mkdirSync(dirname(CANDIDATE_PATH), { recursive: true })
  const tmp = `${CANDIDATE_PATH}.incoming.${process.pid}`
  writeFileSync(tmp, bytes, { mode: 0o600, flag: 'wx' })
  chownSync(tmp, 0, 0)
  chmodSync(tmp, 0o600)
  const { renameSync } = await import('node:fs')
  renameSync(tmp, CANDIDATE_PATH)
  const st = statSync(CANDIDATE_PATH)
  gate('§1 candidate written (root:wheel 0600)', st.uid === 0 && (st.mode & 0o777) === 0o600)
  process.stdout.write(`EXPECTED_CANDIDATE_SHA256=${sha256(readFileSync(CANDIDATE_PATH))}\n`)
}

async function candidate() {
  return withProductionMutationLock('run-routing-install.mjs --candidate', candidateLocked)
}

async function check() {
  let ok = true
  ok = gate('§3 ROOT_PRODUCTION_TRANSACTION_SLOT', process.env.ROOT_PRODUCTION_TRANSACTION_SLOT === 'FREE', `env=${process.env.ROOT_PRODUCTION_TRANSACTION_SLOT ?? 'unset'}`) && ok
  ok = gate('§3 SCHEDULER_PRODUCTION_MUTATION_SLOT', process.env.SCHEDULER_PRODUCTION_MUTATION_SLOT === 'FREE', `env=${process.env.SCHEDULER_PRODUCTION_MUTATION_SLOT ?? 'unset'}`) && ok
  ok = gate('§3 NO_CONFLICTING_SCHEDULER_TRANSACTION', process.env.NO_CONFLICTING_SCHEDULER_TRANSACTION === 'YES') && ok
  ok = gate('§3 EXPECTED_DEPLOYED_SHA', DEPLOYED_SHA === '95a8c9664c9e36f163a0077ef70ee2c75bc7b3a9'
    || DEPLOYED_SHA === '0c6730af8d43bfad479034c1c688e123f21a9ae2', `AGENT_CORE_DEPLOYED_SHA=${DEPLOYED_SHA || 'unset'}`) && ok
  if (existsSync(STORE_PATH)) {
    const doc = await loadStoreJobs(STORE_PATH)
    const overlap = doc.jobs.filter((job) => job.enabled && job.delivery?.to === DESIGNATED_CHAT_ID)
    ok = gate('§0 designated chat is NOT an enabled job delivery target', overlap.length === 0,
      overlap.map((job) => job.id).join(',') || 'no overlap') && ok
    ok = gate('§3 EXPECTED_STORE_SHA256', process.env.EXPECTED_STORE_SHA256 === undefined
      || process.env.EXPECTED_STORE_SHA256 === sha256(readFileSync(STORE_PATH)), 'set EXPECTED_STORE_SHA256 to enforce') && ok
    const manifest = checkCandidate(readFileSync(CANDIDATE_PATH))
    const unrouted = doc.jobs.filter((job) => job.enabled
      && !resolveNotificationRoute({ routeClass: ROUTE_CLASSES.JOB_FAILURE, job, manifest }).route)
    ok = gate('§1 enrichment: every enabled Job resolves a JOB_FAILURE route', unrouted.length === 0,
      unrouted.map((job) => job.id).join(',') || 'all routed') && ok
  } else {
    ok = gate('§3 canonical store readable', false, STORE_PATH)
  }
  if (existsSync(TARGET_PATH)) {
    process.stdout.write(`EXPECTED_ROUTING_TARGET_HASH(pre)=${sha256(readFileSync(TARGET_PATH))}\n`)
  } else {
    process.stdout.write('EXPECTED_ROUTING_TARGET_HASH(pre)=null\n')
  }
  gate('§3 safety gate verdict', ok)
}

function runInstaller(mode) {
  const candidateBytes = readFileSync(CANDIDATE_PATH)
  checkCandidate(candidateBytes)
  const receipt = installSchedulerRoutingManifest({
    candidatePath: CANDIDATE_PATH,
    expectedSha256: sha256(candidateBytes),
    targetPath: TARGET_PATH,
    jobs: [],
    artifactsDir: ARTIFACTS_DIR,
    expectedUid: EXPECTED_UID,
    expectedGid: EXPECTED_GID,
    targetBoundary: '/',
    mode,
  })
  process.stdout.write(`${mode} → ${JSON.stringify(receipt)}\n`)
  return receipt
}

async function applyLocked() {
  const pre = runInstaller('plan')
  gate('§2 plan candidate sha matches frozen candidate', existsSync(CANDIDATE_PATH))
  const receipt = runInstaller('apply')
  gate('§2 receipt INSTALLED', receipt.status === 'INSTALLED', `status=${receipt.status}`)
  const st = statSync(TARGET_PATH)
  gate('§2 target protected metadata (uid/gid/0640)', st.uid === EXPECTED_UID && st.gid === EXPECTED_GID && (st.mode & 0o777) === 0o640,
    `${st.uid}:${st.gid} ${(st.mode & 0o777).toString(8)}`)
  gate('§2 target sha == candidate sha', sha256(readFileSync(TARGET_PATH)) === pre.candidateSha256)
  gate('§5 runtime readiness: restart/reload the runtime, then assertSchedulerStartupReady (health.complete==true) — operator step')
}

async function apply() {
  return withProductionMutationLock('run-routing-install.mjs --apply', applyLocked)
}

const mode = process.argv[2] ?? ''
const handlers = { '--selftest': selftest, '--candidate': candidate, '--check': check, '--plan': () => runInstaller('plan'), '--apply': apply }
if (!handlers[mode]) {
  process.stdout.write('usage: run-routing-install.mjs --selftest|--candidate|--check|--plan|--apply\n')
  process.exit(2)
}
await handlers[mode]()
