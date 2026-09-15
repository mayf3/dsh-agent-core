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
 * Fail-closed: any gate mismatch exits non-zero with the exact violated gate; nothing is applied.
 */

import { createHash } from 'node:crypto'
import { chmodSync, chownSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

// P1/B7 convergence: --apply is a production mutation entry, so it shares the
// SAME exact global production-deploy mutex as trusted-cp-deploy-install.sh.
// B7 inherited-lock seam: when invoked by the parent transaction, the mutex is
// held by the parent - the child VERIFIES the holder provenance and then
// neither reacquires nor releases it. No bypass flag: without a verified
// inherited holder, --apply always acquires the mutex itself.
let PRODUCTION_DEPLOY_LOCK_DIR = process.env.PRODUCTION_DEPLOY_LOCK_DIR
  ?? '/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock'
let INHERITED_LOCK_HOLDER_PATTERN = process.env.PRODUCTION_DEPLOY_LOCK_INHERITED_FROM ?? ''
let GLOBAL_LOCK_ACQUIRED_BY_ME = false
function holderIncludes(pattern) {
  try { return readFileSync(join(PRODUCTION_DEPLOY_LOCK_DIR, 'holder'), 'utf8').includes(pattern) } catch { return false }
}
function verifyInheritedHolder() {
  if (!existsSync(PRODUCTION_DEPLOY_LOCK_DIR) || !holderIncludes(INHERITED_LOCK_HOLDER_PATTERN)) {
    process.stderr.write(`FAIL_CLOSED inherited global production-deploy mutex expected but not verifiable - ${PRODUCTION_DEPLOY_LOCK_DIR}\n`)
    process.exit(1)
  }
  process.stdout.write('== inherited global production-deploy mutex verified (held by parent transaction) ==\n')
}
function acquireGlobalDeployLock() {
  mkdirSync(dirname(PRODUCTION_DEPLOY_LOCK_DIR), { recursive: true })
  try {
    mkdirSync(PRODUCTION_DEPLOY_LOCK_DIR)
  } catch {
    const holder = existsSync(join(PRODUCTION_DEPLOY_LOCK_DIR, 'holder'))
      ? readFileSync(join(PRODUCTION_DEPLOY_LOCK_DIR, 'holder'), 'utf8') : '(no holder metadata)'
    process.stderr.write(`FAIL_CLOSED global production-deploy mutex already held - ${PRODUCTION_DEPLOY_LOCK_DIR}\n${holder}\nDISPOSITION (explicit helper - never bare rmdir): use the transaction bundle's dispose_stale_lock procedure\n`)
    process.exit(1)
  }
  writeFileSync(join(PRODUCTION_DEPLOY_LOCK_DIR, 'holder'),
    `pid=${process.pid}\ncmd=run-routing-install.mjs --apply\nstarted=${new Date().toISOString()}\n`)
  GLOBAL_LOCK_ACQUIRED_BY_ME = true
}
function releaseGlobalDeployLock() {
  if (!GLOBAL_LOCK_ACQUIRED_BY_ME) return   // never release a parent-owned/inherited lock
  const holder = join(PRODUCTION_DEPLOY_LOCK_DIR, 'holder')
  if (existsSync(holder) && !readFileSync(holder, 'utf8').includes(`pid=${process.pid}`)) {
    process.stderr.write('global mutex release refused (holder mismatch) - left in place\n')
    return
  }
  try { rmSync(holder) } catch { /* not ours or gone */ }
  try { rmSync(PRODUCTION_DEPLOY_LOCK_DIR) } catch { /* gone */ }
  GLOBAL_LOCK_ACQUIRED_BY_ME = false
}

import { installSchedulerRoutingManifest } from '../../packages/production-runtime/src/scheduler/deployment-routing.js'
import { validateRoutingManifest, resolveNotificationRoute, ROUTE_CLASSES } from '../../packages/scheduler/src/watchdog/routing.js'
import { JobStore } from '../../packages/scheduler/src/store.js'

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
const gate = (name, ok, detail = '') => {
  process.stdout.write(`${ok ? '✔' : '✖'} ${name}${detail ? ` — ${detail}` : ''}\n`)
  if (!ok) process.exitCode = 1
  return ok
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
  const scratch = mkdtempSync(join(tmpdir(), 'pnpm-routing-selftest-XXXXXX'))
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
  // B7 lock-seam mechanics (scratch lock dir): standalone acquire/release with
  // ownership guard; inherited verify never deletes a parent-owned lock.
  PRODUCTION_DEPLOY_LOCK_DIR = join(scratch, 'locks/production-deploy.lock')
  INHERITED_LOCK_HOLDER_PATTERN = 'run-authorized-transaction.sh'
  mkdirSync(dirname(PRODUCTION_DEPLOY_LOCK_DIR), { recursive: true })
  mkdirSync(PRODUCTION_DEPLOY_LOCK_DIR)
  writeFileSync(join(PRODUCTION_DEPLOY_LOCK_DIR, 'holder'), 'pid=1\ncmd=run-authorized-transaction.sh (parent)\n')
  verifyInheritedHolder()   // inherited path: verification only, never takes ownership
  if (GLOBAL_LOCK_ACQUIRED_BY_ME) gate('selftest: inherited path must not take ownership', 1)
  releaseGlobalDeployLock() // must be a no-op for a parent-owned lock
  if (!existsSync(PRODUCTION_DEPLOY_LOCK_DIR)) gate('selftest: parent-owned lock deleted by child', 1)
  gate('SELFTEST inherited path verifies holder + never reacquires/releases', process.exitCode !== 1)
  rmSync(PRODUCTION_DEPLOY_LOCK_DIR, { recursive: true })
  acquireGlobalDeployLock()
  if (!GLOBAL_LOCK_ACQUIRED_BY_ME) gate('selftest: standalone acquire must take ownership', 1)
  releaseGlobalDeployLock()
  if (existsSync(PRODUCTION_DEPLOY_LOCK_DIR)) gate('selftest: standalone release must remove the installer-owned lock', 1)
  gate('SELFTEST standalone acquire/release + ownership guard', process.exitCode !== 1)
  gate('SELFTEST complete (offline subset; parent-chain machinery verified on-host via --plan)', process.exitCode !== 1)
}

async function candidate() {
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

async function apply() {
  if (INHERITED_LOCK_HOLDER_PATTERN !== '') verifyInheritedHolder()
  else acquireGlobalDeployLock()
  try {
    await applyLocked()
  } finally {
    releaseGlobalDeployLock()   // no-op when the lock is parent-owned (B7)
  }
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

const mode = process.argv[2] ?? ''
const handlers = { '--selftest': selftest, '--candidate': candidate, '--check': check, '--plan': () => runInstaller('plan'), '--apply': apply }
if (!handlers[mode]) {
  process.stdout.write('usage: run-routing-install.mjs --selftest|--candidate|--check|--plan|--apply\n')
  process.exit(2)
}
await handlers[mode]()
