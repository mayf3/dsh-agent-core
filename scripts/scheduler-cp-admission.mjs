#!/usr/bin/env node
/** Receipted Scheduler control-plane admission; selftest/plan/apply fail closed. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, chownSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir, userInfo } from 'node:os'
import { JobStore } from '../packages/scheduler/src/store.js'
import { updateJobOp } from '../packages/scheduler/src/control.js'
import {
  matchCriticalJobs, buildDesiredState, buildBackfillMapping, classifyCensus,
  reExportsWithoutLocalBinding,
  WATCHDOG_PAYLOAD_SNAPSHOT, WATCHDOG_OVERLAY_PATHS, WATCHDOG_DELETE_PATHS,
} from './lib/admission-lib.mjs'
import {
  buildOverlaySeedBytes, narrowOverlayUniverse,
  WATCHDOG_LIVE_ADAPTER_POST_SHA, WATCHDOG_LIVE_ADAPTER_SHA, WATCHDOG_PINNED_LIVE_DEPENDENCIES,
} from './lib/admission-overlay.mjs'
import { createDeploymentPhases } from './lib/admission-deploy-phases.mjs'
import { assertEvidenceAndHeartbeatProofs } from './lib/admission-watchdog-issue3.mjs'
import { restartSchedulerProductionRuntime } from '../packages/production-runtime/src/scheduler/deployment-runtime-restart.js'
import { createLaunchdAdapter } from '../packages/production-runtime/src/scheduler/deployment-launchd.js'
import { reconcileLegacyRoutingControlOwnership } from '../packages/production-runtime/src/scheduler/deployment-routing.js'
import { installSchedulerDesiredState } from '../packages/production-runtime/src/scheduler/deployment-desired-state.js'
import { atomicReplacePrivateFile, ensureProtectedDirectoryTree, readPrivateFile } from '../packages/scheduler/src/watchdog/private-state-io.js'
const args = process.argv.slice(2)
const has = (name) => args.includes(name)
const val = (name) => {
  const idx = args.indexOf(name)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : undefined
}
const MODE = has('--selftest') ? 'selftest' : has('--plan') ? 'plan' : has('--apply') ? 'apply' : undefined
const SOURCE_SHA = val('--source-sha')
const ROUTING_SOURCE = val('--routing-manifest-source')
const ROUTING_SHA256 = val('--routing-manifest-sha256')
const ROUTING_CANDIDATE_UID = Number(val('--routing-candidate-uid'))
const ROUTING_CANDIDATE_GID = Number(val('--routing-candidate-gid'))
const MIGRATION_SOURCES = {
  legacyStatePath: val('--legacy-alert-state'), legacyStateSha256: val('--legacy-alert-sha256'),
  legacyEvidencePath: val('--legacy-delivery-evidence'), legacyEvidenceSha256: val('--legacy-evidence-sha256'),
  factsPath: val('--migration-facts'), factsFileSha256: val('--migration-facts-file-sha256'),
  factsSha256: val('--migration-facts-sha256'),
}
const GOAL_BASE_SHA = '68008e83142bdb637c4fa61c2a65db73c64b2eb1'
if (MODE === undefined || !/^[0-9a-f]{40}$/.test(SOURCE_SHA ?? '')) {
  process.stderr.write('usage: scheduler-cp-admission --selftest|--plan|--apply --source-sha <sha> --routing-manifest-source <path> --routing-manifest-sha256 <sha256> plus frozen migration source paths/hashes\n')
  process.exit(2)
}
const REPO = dirname(new URL(import.meta.url).pathname)
const REPO_ROOT = join(dirname(new URL(import.meta.url).pathname), '..')
const git = (argv, opts = {}) => execFileSync('git', ['-c', `safe.directory=${REPO_ROOT}`, '-C', REPO_ROOT, ...argv], { maxBuffer: 32 * 1024 * 1024, ...opts })
const CTX = MODE === 'selftest'
  ? {
      liveRoot: '', storePath: '', artifacts: '', binSymlink: '', launchctl: '', routingManifest: '', launchdDir: '',
      gitShow: (sha, path) => git(['show', `${sha}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
      gitHash: (sha, path) => git(['rev-parse', `${sha}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
      kickstart: (label) => CTX.launchctlShim('kickstart', label),
      bootout: (label) => CTX.launchctlShim('bootout', label),
      bootstrap: (plist, label) => CTX.launchctlShim('bootstrap', `${plist} ${label}`),
      chown: () => true, // fixture dirs already owned by the runner
      asAuthsvc: (cmd, argv) => execFileSync(cmd, argv, { encoding: 'utf8', env: { ...process.env, HOME: '/Users/authsvc', AGENTCORE_EXPECTED_STORE: '/Users/authsvc/.agent-core/scheduler/jobs.json' }, stdio: ['ignore', 'pipe', 'pipe'] }),
    }
  : {
      liveRoot: '/usr/local/libexec/agent-core/app',
      storePath: '/Users/authsvc/.agent-core/scheduler/jobs.json',
      artifacts: '/var/db/agent-core/deployments/SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1/generations',
      artifactsDir: '/var/db/agent-core/deployments/SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1',
      controlBoundary: '/var/db',
      controlUid: 0, controlGid: 0,
      desiredPath: '/usr/local/libexec/agent-core/config/scheduler-desired-state.json',
      launchdDir: '/Library/LaunchDaemons',
      runtimeNode: '/usr/local/libexec/agent-core/node-runtime/bin/node',
      watchdogStateDir: '/Users/authsvc/.agent-core/control/scheduler-watchdog',
      evidenceFile: '/usr/local/var/scheduler-watchdog/reconciliation-evidence.jsonl',
      binSymlink: '/usr/local/bin/agentcore-cron',
      launchctl: 'launchctl',
      routingManifest: '/usr/local/libexec/agent-core/config/scheduler-routing.json',
      routingTargetBoundary: '/',
      routingCandidate: ROUTING_SOURCE,
      routingCandidateSha256: ROUTING_SHA256,
      routingCandidateUid: ROUTING_CANDIDATE_UID,
      routingCandidateGid: ROUTING_CANDIDATE_GID,
      authsvcUid: Number(execFileSync('id', ['-u', 'authsvc'], { encoding: 'utf8' }).trim()),
      authsvcGid: Number(execFileSync('id', ['-g', 'authsvc'], { encoding: 'utf8' }).trim()),
      runtimeReaderGid: Number(execFileSync('/usr/bin/dscl', ['.', '-read', '/Groups/staff', 'PrimaryGroupID'], { encoding: 'utf8' }).match(/PrimaryGroupID:\s*(\d+)/)?.[1]),
      gitShow: (sha, path) => git(['show', `${sha}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
      gitHash: (sha, path) => git(['rev-parse', `${sha}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
      kickstart: (label) => execFileSync('launchctl', ['kickstart', '-k', label], { stdio: ['ignore', 'pipe', 'pipe'] }),
      ...createLaunchdAdapter(),
      bootstrap: (plist, label) => execFileSync('launchctl', ['bootstrap', 'system', plist], { stdio: ['ignore', 'pipe', 'pipe'] }),
      chown: (path, uid, gid) => execFileSync('chown', [`${uid}:${gid}`, path]),
      // env -i strips PATH and the CLI shebang is '#!/usr/bin/env node' —
      // pass the pinned runtime's bin dir explicitly so node resolves.
      asAuthsvc: (cmd, argv) => execFileSync('sudo', ['-u', 'authsvc', 'env', '-i',
        'HOME=/Users/authsvc',
        'PATH=/usr/local/libexec/agent-core/node-runtime/bin:/usr/local/bin:/usr/bin:/bin',
        'AGENTCORE_EXPECTED_STORE=/Users/authsvc/.agent-core/scheduler/jobs.json',
        cmd, ...argv], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
    }
const receipts = { mode: MODE, sourceSha: SOURCE_SHA, phases: {}, startedAt: new Date().toISOString() }
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const controlOwnership = () => ({ expectedUid: CTX.controlUid, expectedGid: CTX.controlGid })
function writeControlReceipt(name, value) {
  ensureProtectedDirectoryTree(CTX.artifactsDir, { ...controlOwnership(), boundary: CTX.controlBoundary })
  atomicReplacePrivateFile(join(CTX.artifactsDir, name), Buffer.from(`${JSON.stringify(value, null, 2)}\n`), controlOwnership())
}
function readControlReceipt(name) {
  ensureProtectedDirectoryTree(CTX.artifactsDir, { ...controlOwnership(), boundary: CTX.controlBoundary })
  return JSON.parse(readPrivateFile(join(CTX.artifactsDir, name), controlOwnership()).bytes.toString('utf8'))
}
function phase(name, ok, detail) {
  receipts.phases[name] = { ok, detail }
  if (MODE !== 'plan' && CTX.artifactsDir) {
    writeControlReceipt('phase-progress-receipt.json', { ...receipts, updatedAt: new Date().toISOString() })
  }
  process.stdout.write(`[${ok === false ? 'FAIL' : 'ok'}] ${name} — ${detail}\n`)
  if (ok === false) throw new Error(`phase ${name} failed: ${detail}`)
}
const stripMessages = (jobs) => (jobs ?? []).map(({ payload, ...rest }) => ({ ...rest, payload: payload ? { ...payload, message: '<stripped>' } : payload }))
function readCensus() {
  const raw = readFileSync(CTX.storePath, 'utf8')
  const doc = JSON.parse(raw)
  return doc
}
function criticalsOrAbort(doc) {
  const matched = matchCriticalJobs(doc.jobs)
  for (const [name, m] of Object.entries(matched)) {
    if (m.match !== 'unique') {
      phase('criticals', false, `${name} match=${m.match} (jobs=${m.jobs.length}) — NO MUTATION`)
    }
  }
  phase('criticals', true, `daily=${matched.daily.jobs[0]?.id} hr=${matched.hr.jobs[0]?.id}`)
  return matched
}
async function backfillAndFreeze(doc, matched) {
  const store = new JobStore(CTX.storePath, { runLogPath: join(dirname(CTX.storePath), 'runs.jsonl') })
  const mapping = buildBackfillMapping(matched)
  for (const entry of mapping) {
    const job = doc.jobs.find((candidate) => candidate.id === entry.jobId)
    if (job?.logicalKey === entry.logicalKey) continue
    const before = job.scheduleRevision
    const updated = await updateJobOp(store, entry.jobId, { logicalKey: entry.logicalKey })
    if (updated.scheduleRevision !== before) throw new Error(`backfill bumped scheduleRevision on ${entry.jobId}`)
    await store.appendRunEvent({ ts: Date.now(), action: 'logical_key_backfill', jobId: entry.jobId, logicalKey: entry.logicalKey })
  }
  if (mapping.length > 0 && userInfo().uid === 0) {
    CTX.chown(CTX.storePath, 'authsvc', 'staff')
  }
  phase('backfill', true, `${mapping.length} critical(s) keyed (idempotent); store ownership restored`)
  const desired = buildDesiredState(matched)
  const desiredReceipt = existsSync(join(CTX.artifactsDir, 'desired-state-install-receipt.json')) ? readControlReceipt('desired-state-install-receipt.json') : null
  const desiredBytes = Buffer.from(`${JSON.stringify(desired, null, 2)}\n`)
  ensureProtectedDirectoryTree(join(CTX.artifactsDir, 'candidates'), { ...controlOwnership(), boundary: CTX.controlBoundary })
  ensureProtectedDirectoryTree(join(CTX.artifactsDir, 'rollback'), { ...controlOwnership(), boundary: CTX.controlBoundary })
  // the W1 watchdog (authsvc) reads the desired-state file with a raw read; a control
  // gid of 0 makes it EACCES for authsvc — align the group with the routing manifest's
  // root:authsvc posture (bytes/mode untouched; apply-root one-time group normalization)
  if (MODE === 'apply' && existsSync(CTX.desiredPath)) {
    const dsStat = lstatSync(CTX.desiredPath)
    if (dsStat.uid === 0 && dsStat.gid !== CTX.authsvcGid && (dsStat.mode & 0o777) === 0o640) chownSync(CTX.desiredPath, 0, CTX.authsvcGid)
  }
  installSchedulerDesiredState({ bytes: desiredBytes, expectedJobs: desired.jobs, targetPath: CTX.desiredPath,
    candidatePath: join(CTX.artifactsDir, 'candidates', 'scheduler-desired-state.json'), preimagePath: join(CTX.artifactsDir, 'rollback', 'scheduler-desired-state.json.preimage'),
    receipt: desiredReceipt, writeReceipt: (value) => writeControlReceipt('desired-state-install-receipt.json', value), expectedUid: CTX.controlUid, expectedGid: CTX.authsvcGid, controlUid: CTX.controlUid, controlGid: CTX.controlGid })
  phase('desired-state', true, `${desired.jobs.length} critical(s) frozen at ${CTX.desiredPath}`)
  return { desired }
}
function listLiveFiles(root, prefix = '') {
  const out = new Set()
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) for (const nested of listLiveFiles(root, rel)) out.add(nested)
    else out.add(rel)
  }
  return out
}
function overlay(validateOnly = false) {
  // B1: reviewed payload bytes resolve from the SOURCE_SHA tree, frozen to the
  // WATCHDOG_PAYLOAD_SNAPSHOT digests — deep-history commit pins are unreachable
  // in shallow fresh main-only clones (`bad object` before deploy). For the
  // (single) path whose SOURCE_SHA bytes intentionally differ from the frozen
  // payload (compose.js evolved on the agent-directory lane), the reviewed
  // bytes are embedded in the snapshot itself. Drift fails closed; snapshot
  // regeneration is a reviewed step.
  const target = (path) => {
    const reviewed = WATCHDOG_PAYLOAD_SNAPSHOT.paths[path]
    const embedded = WATCHDOG_PAYLOAD_SNAPSHOT.embedded?.[path]
    let bytes
    if (embedded !== undefined) bytes = Buffer.from(embedded, 'base64').toString('utf8')
    else bytes = git(['show', `${SOURCE_SHA}:${path}`], { encoding: 'utf8' })
    if (reviewed !== undefined && sha256(bytes) !== reviewed) throw new Error(`payload snapshot drift at ${path}: SOURCE_SHA bytes differ from the reviewed payload — regenerate watchdog-payload-snapshot.mjs through review`)
    return bytes
  }
  const seedList = Object.keys(WATCHDOG_PAYLOAD_SNAPSHOT.paths)
  const deletePaths = [...WATCHDOG_DELETE_PATHS]
  const allowed = MODE === 'selftest' ? undefined : WATCHDOG_OVERLAY_PATHS
  const liveRootFiles = listLiveFiles(CTX.liveRoot)
  const liveSha = (path) => existsSync(join(CTX.liveRoot, path)) ? sha256(readFileSync(join(CTX.liveRoot, path))) : undefined
  if (MODE !== 'selftest') for (const [path, expected] of WATCHDOG_LIVE_ADAPTER_SHA) if (![expected, WATCHDOG_LIVE_ADAPTER_POST_SHA.get(path)].includes(liveSha(path))) throw new Error(`pinned live integration drift: ${path}`)
  const seedBytes = MODE === 'selftest' ? new Map(seedList.map((path) => [path, target(path)])) : buildOverlaySeedBytes(seedList, target, (path) => readFileSync(join(CTX.liveRoot, path), 'utf8'))
  const narrowed = narrowOverlayUniverse({
    seedPaths: seedList,
    readTarget: (path) => seedBytes.get(path) ?? target(path),
    liveHas: (path) => liveRootFiles.has(path),
    liveShaOf: liveSha,
    preserveLiveShaByPath: MODE === 'selftest' ? new Map() : WATCHDOG_PINNED_LIVE_DEPENDENCIES,
    allowedOverlayPaths: allowed,
  })
  if (narrowed.refuse) throw new Error(`NARROW CLOSURE REFUSED: ${narrowed.refuse}`)
  if (validateOnly) return
  const plan = { update: [], add: [] }
  for (const [path, bytes] of [...narrowed.overlay.entries()]) {
    const sha = sha256(bytes)
    if (!liveRootFiles.has(path)) plan.add.push({ path, sha })
    else if (liveSha(path) !== sha) plan.update.push({ path, sha })
  }
  let writes = [...plan.update.map((entry) => ({ ...entry, kind: 'update', preimageSha: liveSha(entry.path) })), ...plan.add.map((entry) => ({ ...entry, kind: 'add' }))]
  let deletes = deletePaths.filter((path) => liveRootFiles.has(path)).map((path) => ({ path, kind: 'delete', preimageSha: liveSha(path) }))
  let all = [...writes, ...deletes]
  if (MODE === 'plan') {
    process.stdout.write(`[overlay plan] update=${plan.update.length} add=${plan.add.length}\n${all.map((e) => `  ${e.kind} ${e.path}`).join('\n')}\n`)
    phase('overlay', true, `planned update=${plan.update.length} add=${plan.add.length} (plan mode)`)
    return
  }
  const preimage = join(CTX.artifactsDir, 'rollback', 'overlay-preimage.tar.gz')
  const manifestPath = join(CTX.artifactsDir, 'overlay-manifest.json')
  mkdirSync(dirname(preimage), { recursive: true, mode: 0o700 })
  chmodSync(dirname(preimage), 0o700)
  if (existsSync(manifestPath)) {
    const prior = readControlReceipt('overlay-manifest.json')
    if (prior.base !== GOAL_BASE_SHA || prior.source !== SOURCE_SHA || !Array.isArray(prior.entries)) throw new Error('overlay rerun generation mismatch')
    all = prior.entries; writes = all.filter((entry) => entry.kind !== 'delete'); deletes = all.filter((entry) => entry.kind === 'delete')
    for (const entry of all) {
      const current = liveSha(entry.path)
      const allowed = entry.kind === 'add' ? [undefined, entry.sha] : entry.kind === 'update' ? [entry.preimageSha, entry.sha] : [entry.preimageSha, undefined]
      const plannedBytes = seedBytes.get(entry.path) ?? (entry.kind === 'delete' ? undefined : target(entry.path))
      if (!allowed.includes(current) || (entry.kind !== 'delete' && sha256(plannedBytes) !== entry.sha)) throw new Error(`overlay rerun generation mismatch: ${entry.path}`)
    }
    const installed = all.every((entry) => entry.kind === 'delete' ? liveSha(entry.path) === undefined : liveSha(entry.path) === entry.sha)
    if (installed) { phase('overlay', true, `EXACT GOAL closure already installed; predecessor manifest retained`); return }
  } else {
    const changed = all.filter((entry) => entry.kind !== 'add').map((entry) => entry.path)
    if (changed.length > 0) execFileSync('tar', ['-czf', preimage, '-C', CTX.liveRoot, ...changed])
    writeControlReceipt('overlay-manifest.json', { base: GOAL_BASE_SHA, source: SOURCE_SHA, entries: all })
  }
  for (const entry of writes) {
    const bytes = Buffer.from(narrowed.overlay.get(entry.path) ?? seedBytes.get(entry.path) ?? target(entry.path), 'utf8')
    const target = join(CTX.liveRoot, entry.path)
    if (sha256(bytes) !== entry.sha) throw new Error(`staged bytes != plan sha for ${entry.path}`)
    if (liveSha(entry.path) === entry.sha) continue
    mkdirSync(dirname(target), { recursive: true })
    const st = existsSync(target) ? statSync(target) : undefined
    const tmp = `${target}.incoming-${process.pid}`
    writeFileSync(tmp, bytes)
    try {
      execFileSync('chown', [st ? `${st.uid}:${st.gid}` : '505:601', tmp], { stdio: ['ignore', 'pipe', 'pipe'] })
      execFileSync('chmod', [st ? `${(st.mode & 0o7777).toString(8).padStart(4, '0')}` : '0644', tmp], { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      if (MODE === 'apply') throw error // unprivileged runs degrade: fixture dirs are runner-owned
    }
    execFileSync('mv', [tmp, target])
  }
  for (const entry of deletes) if (existsSync(join(CTX.liveRoot, entry.path))) rmSync(join(CTX.liveRoot, entry.path))
  phase('overlay', true, `EXACT GOAL closure: ${all.length} files (update=${all.filter((entry) => entry.kind === 'update').length} add=${all.filter((entry) => entry.kind === 'add').length}); base=${GOAL_BASE_SHA.slice(0, 12)}`)
}
function brokerBootRehearsal() {
  const staged = readFileSync(join(CTX.liveRoot, 'packages/broker/src/index.js'), 'utf8')
  if (MODE === 'selftest') {
    const missing = reExportsWithoutLocalBinding(staged)
    phase('broker-rehearsal', missing.length === 0, missing.length === 0
      ? 'staged broker index: all re-exported symbols locally bound (parse-audit shim)'
      : `WOULD REFUSE BOOT: ${JSON.stringify(missing)}`)
    return
  }
  const indexUrl = `file://${join(CTX.liveRoot, 'packages/broker/src/index.js')}`
  const script = `
    const index = await import(${JSON.stringify(indexUrl)})
    const registered = []
    const ctx = { tools: { register: () => registered.push(1) }, get: () => undefined }
    index.apply(ctx, { mode: 'child', manifests: [] })
    process.stdout.write('child-mode apply ok (staged bytes)')
  `
  const out = execFileSync(CTX.runtimeNode, ['-e', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  phase('broker-rehearsal', true, out.trim())
}

function runtimeRestart() {
  const receiptPath = join(CTX.artifactsDir, 'runtime-install-receipt.json'); const runtimeCtx = { ...CTX, runtimePriorReceipt: existsSync(receiptPath) ? readControlReceipt('runtime-install-receipt.json') : null,
    runtimeReceipt: (receipt) => writeControlReceipt('runtime-install-receipt.json', receipt) }
  return restartSchedulerProductionRuntime({ ctx: runtimeCtx, phase, sourceSha: SOURCE_SHA })
}
// B3: deployment phases (operator generation, watchdog install, routing,
// incident migration, quiesce) live in admission-deploy-phases.mjs — identical
// bodies, closed over this orchestrator's context; main() still owns the
// phase ORDER and every fail-closed/rollback semantic.
const phases = createDeploymentPhases({
  CTX, MODE, SOURCE_SHA, MIGRATION_SOURCES, phase, writeControlReceipt, readControlReceipt, sha256, git, repoRoot: REPO_ROOT,
})
const { operatorGeneration, watchdogInstall, routingInstall, incidentMigration, quiesceWatchdogs } = phases

function gate(name, ok, detail) { receipts.gates = receipts.gates ?? {}; receipts.gates[name] = { ok, detail }; process.stdout.write(`[${ok ? 'PASS' : 'FAIL'}] ${name} — ${detail}\n`); if (!ok) throw new Error(`gate ${name} failed`) } // shared by proofs() and the Issue 3 proof module
async function proofs() {
  const sandbox = '/var/empty'
  let guardRefused = false
  try {
    execFileSync(CTX.binSymlink, ['add', '--agent', 'x', '--name', 'guard-negative', '--logical-key', 'guard:neg', '--every-ms', '60000', '--message', 'x', '--no-deliver'], {
      env: { ...process.env, HOME: sandbox, AGENTCORE_EXPECTED_STORE: '/Users/authsvc/.agent-core/scheduler/jobs.json' },
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch { guardRefused = true }
  gate('CLI_STORE_GUARD_NEGATIVE', guardRefused, 'non-canonical default resolution refused, nothing created')
  const listing = CTX.asAuthsvc('/usr/local/bin/agentcore-cron', ['list', '--json'])
  const jobs = JSON.parse(listing).jobs
  gate('CANONICAL_READ_BACK', Array.isArray(jobs), `canonical store visible through authsvc identity: ${jobs.length} job(s)`)
  gate('CREDENTIAL_PROVIDER', existsSync(CTX.credentialsProviderPath ?? '/usr/local/libexec/agent-core/config/agent-credentials.json'), 'credential provider file present (existence only)')
  const smoke = execFileSync(CTX.binSymlink, ['list', '--json', '--store', join(dirname(CTX.storePath), 'operator-smoke.json')], {
    env: { ...process.env, HOME: '/var/empty' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  })
  gate('OPERATOR_FUNCTIONAL_SMOKE', JSON.parse(smoke).jobs !== undefined, 'flipped operator answers list --json (sandbox HOME)')
  await assertEvidenceAndHeartbeatProofs({ ctx: CTX, mode: MODE, gate, execFileSync, kickstart: (label) => CTX.kickstart(label) })
}

async function main() {
  if (MODE === 'apply' && userInfo().uid !== 0) {
    process.stderr.write('[admission] --apply requires root (run under the single Owner sudo gate)\n')
    process.exit(2)
  }
  if (MODE !== 'plan') overlay(true)
  if (MODE !== 'plan') ensureProtectedDirectoryTree(CTX.artifactsDir, { ...controlOwnership(), boundary: CTX.controlBoundary })
  const doc = readCensus()
  const matched = criticalsOrAbort(doc)
  if (MODE === 'plan') {
    process.stdout.write(`${JSON.stringify({ matched: { daily: matched.daily.match, hr: matched.hr.match }, classification: classifyCensus(doc.jobs, matched) }, null, 2)}\n`)
    overlay() // plan mode prints only
    routingInstall(doc)
    return
  }
  phases.quiesceWatchdogs()
  const routingControl = MODE === 'apply'
    ? reconcileLegacyRoutingControlOwnership({ artifactsDir: CTX.artifactsDir,
        controlUid: CTX.controlUid, controlGid: CTX.controlGid, legacyGid: CTX.authsvcGid })
    : { status: 'FIXTURE_NOT_APPLICABLE' }
  phase('routing-control-ownership', true, routingControl.status)
  overlay()
  await backfillAndFreeze(doc, matched)
  phases.routingInstall(await new JobStore(CTX.storePath).loadDoc({ force: true }))
  phases.incidentMigration()
  brokerBootRehearsal()
  runtimeRestart()
  phases.operatorGeneration()
  phases.watchdogInstall()
  await proofs()
  writeControlReceipt('deployment-phase-receipt.json', { ...receipts, finishedAt: new Date().toISOString(),
    acceptanceStatus: 'PENDING_CANONICAL_HEALTH_AND_CANARY', productionAccepted: false, currentSixAuthorized: false })
  process.stdout.write(`[admission] DEPLOYMENT-ONLY RECEIPT written; canonical census/canary acceptance remains pending\n`)
}

if (MODE === 'selftest') {
  const { runAdmissionSelftest } = await import('./lib/admission-selftest.mjs')
  await runAdmissionSelftest({ ctx: CTX, main, git, sha256, repoRoot: REPO_ROOT })
  process.exit(0)
}

await main()
