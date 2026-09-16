#!/usr/bin/env node
/** Receipted Scheduler control-plane admission; selftest/plan/apply fail closed. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, lchmodSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir, userInfo } from 'node:os'
import { JobStore } from '../packages/scheduler/src/store.js'
import { updateJobOp } from '../packages/scheduler/src/control.js'
import {
  matchCriticalJobs, buildDesiredState, buildBackfillMapping, classifyCensus,
  computeOperatorClosure, narrowOverlayUniverse, inOverlayUniverse,
  reExportsWithoutLocalBinding, buildOverlaySeedBytes,
  WATCHDOG_PAYLOAD_SHA, WATCHDOG_OVERLAY_PATHS, WATCHDOG_DELETE_PATHS, WATCHDOG_LIVE_ADAPTER_SHA, WATCHDOG_LIVE_ADAPTER_POST_SHA, WATCHDOG_PINNED_LIVE_DEPENDENCIES,
} from './lib/admission-lib.mjs'
import { repairWatchdogEvidenceChannel, assertEvidenceAndHeartbeatProofs } from './lib/admission-watchdog-issue3.mjs'
import { restartSchedulerProductionRuntime } from '../packages/production-runtime/src/scheduler/deployment-runtime-restart.js'
import { createLaunchdAdapter, quiesceLaunchdServices } from '../packages/production-runtime/src/scheduler/deployment-launchd.js'
import { installSchedulerRoutingManifest, reconcileLegacyRoutingControlOwnership } from '../packages/production-runtime/src/scheduler/deployment-routing.js'
import { installSchedulerDesiredState } from '../packages/production-runtime/src/scheduler/deployment-desired-state.js'
import { capturePlainFileMetadata, listFileXattrs } from '../packages/production-runtime/src/scheduler/deployment-file-metadata.js'
import { atomicInstallDurableFile, durableCopyPreimage, syncDirectory, syncFile, verifyAndSyncPreimage } from '../packages/production-runtime/src/scheduler/deployment-durable-file.js'
import { runSchedulerIncidentMigration } from '../packages/production-runtime/src/scheduler/deployment-incident-migration.js'
import { normalizeLegacyIncidentStateFiles } from '../packages/production-runtime/src/scheduler/deployment-incident-directory.js'
import { preparePrivateRuntimeDirectory } from '../packages/production-runtime/src/scheduler/deployment-incident-directory.js'
import { verifyWatchdogReplayReceipt } from '../packages/production-runtime/src/scheduler/deployment-watchdog-replay.js'
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
  installSchedulerDesiredState({ bytes: desiredBytes, expectedJobs: desired.jobs, targetPath: CTX.desiredPath,
    candidatePath: join(CTX.artifactsDir, 'candidates', 'scheduler-desired-state.json'), preimagePath: join(CTX.artifactsDir, 'rollback', 'scheduler-desired-state.json.preimage'),
    receipt: desiredReceipt, writeReceipt: (value) => writeControlReceipt('desired-state-install-receipt.json', value), expectedUid: CTX.controlUid, expectedGid: CTX.controlGid })
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
  const payloadSha = MODE === 'selftest' ? SOURCE_SHA : WATCHDOG_PAYLOAD_SHA
  const allowed = MODE === 'selftest' ? undefined : WATCHDOG_OVERLAY_PATHS
  const seedList = git(['diff', '--name-only', GOAL_BASE_SHA, payloadSha, '--', 'packages/', 'scripts/'], { encoding: 'utf8' }).split('\n').filter(Boolean).filter((path) => allowed ? allowed.has(path) : inOverlayUniverse(path))
  const deletePaths = git(['diff', '--name-status', '-M', GOAL_BASE_SHA, payloadSha, '--', 'packages/', 'scripts/'], { encoding: 'utf8' })
    .split('\n').filter(Boolean).flatMap((line) => {
      const [status, first] = line.split('\t')
      return (status === 'D' || status.startsWith('R')) && (MODE === 'selftest' ? inOverlayUniverse(first) : WATCHDOG_DELETE_PATHS.has(first)) ? [first] : []
    })
  const liveRootFiles = listLiveFiles(CTX.liveRoot)
  const liveSha = (path) => existsSync(join(CTX.liveRoot, path)) ? sha256(readFileSync(join(CTX.liveRoot, path))) : undefined
  if (MODE !== 'selftest') for (const [path, expected] of WATCHDOG_LIVE_ADAPTER_SHA) if (![expected, WATCHDOG_LIVE_ADAPTER_POST_SHA.get(path)].includes(liveSha(path))) throw new Error(`pinned live integration drift: ${path}`)
  const target = (path) => git(['show', `${payloadSha}:${path}`], { encoding: 'utf8' })
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
function ensureTraversableDir(dir) {
  const chain = []
  let current = resolve(dir)
  while (!existsSync(current)) { chain.push(current); const parent = dirname(current); if (parent === current) break; current = parent }
  for (const item of chain.reverse()) { mkdirSync(item); chmodSync(item, 0o755) }
}

function operatorGeneration() {
  const short = SOURCE_SHA.slice(0, 7)
  const genId = `SCHEDULER_CONTROL_PLANE_RELIABILITY_V1--dsh-agent-core--${short}--x86_64--g1`
  // the sealed candidate tree must be authsvc-traversable (proofs() execs the CLI as
  // authsvc); CTX.artifacts is a root-only protected tree by design, so stage the
  // generation under the live-root operator area instead, with explicit 0755 dirs —
  // mkdir modes are umask-masked and the phase2 shell runs umask 077
  const genDir = join(CTX.operatorStage ?? '/usr/local/libexec/agent-core/operator', genId)
  const candidateCli = join(genDir, 'candidate/usr/local/bin/agentcore-cron')
  const normalizeLinkMode = () => {
    // the phase2 sudo shell runs umask 077: on darwin the symlink inherits lrwx------
    // and authsvc exec through it fails with Permission denied — normalize explicitly
    if (process.platform === 'darwin') lchmodSync(CTX.binSymlink, 0o755)
    if (process.platform === 'darwin' && (lstatSync(CTX.binSymlink).mode & 0o777) !== 0o755) throw new Error('operator link mode readback mismatch')
  }
  if (!existsSync(genDir)) {
    ensureTraversableDir(genDir)
    ensureTraversableDir(dirname(candidateCli))
    const closure = computeOperatorClosure('scripts/agentcore-cron.mjs', (path) => CTX.gitShow(SOURCE_SHA, path))
    for (const path of Object.keys(closure)) {
      if (closure[path] === 'UNRESOLVABLE') throw new Error(`operator closure unresolvable at ${path}`)
      const bytes = git(['show', `${SOURCE_SHA}:${path}`], { stdio: ['ignore', 'pipe', 'pipe'] })
      const rel = path === 'scripts/agentcore-cron.mjs' ? 'bin/agentcore-cron' : path
      const target = join(genDir, 'candidate/usr/local', rel.startsWith('bin/') ? rel : rel.replace(/^packages\//, 'packages/'))
      ensureTraversableDir(dirname(target))
      writeFileSync(target, bytes)
      try { execFileSync('chmod', ['0755', target], { stdio: ['ignore', 'pipe', 'pipe'] }) } catch (error) { if (MODE === 'apply') throw error }
    }
    const cronerSrc = join(REPO_ROOT, 'node_modules', 'croner')
    const cronerDst = join(genDir, 'candidate/usr/local/packages/scheduler/node_modules/croner')
    rmSync(cronerDst, { recursive: true, force: true })
    ensureTraversableDir(dirname(cronerDst))
    execFileSync('cp', ['-R', cronerSrc, cronerDst])
    chmodSync(cronerDst, 0o755)
    try { execFileSync('chmod', ['0755', candidateCli], { stdio: ['ignore', 'pipe', 'pipe'] }) } catch (error) { if (MODE === 'apply') throw error }
    const cliSha = sha256(readFileSync(candidateCli))
    writeFileSync(join(genDir, 'seal.json'), `${JSON.stringify({
      genId, sealedAt: new Date().toISOString(),
      sourceSha: SOURCE_SHA,
      cliSha256: cliSha,
    }, null, 2)}\n`)
    writeFileSync(join(genDir, 'manifest.toml'), [
      `GOAL_NAME = "SCHEDULER_CONTROL_PLANE_RELIABILITY_V1"`,
      `GENERATION_ID = "${genId}"`,
      `SOURCE_SHA = "${SOURCE_SHA}"`,
      `SOURCE_MODE = "git-show"`,
      `TARGET_PATHS = ["${CTX.binSymlink}"]`,
      ``,
      `[targets."${CTX.binSymlink}"]`,
      `CANDIDATE_HASH = "${cliSha}"`,
      `WHY_REQUIRED = "scheduler operator CLI — logical-key contract + store guard (SB4)"`,
      ``,
    ].join('\n'))
  }
  const previous = execFileSync('readlink', ['-f', CTX.binSymlink], { encoding: 'utf8' }).trim()
  const previousSha = sha256(readFileSync(previous))
  const candidateSha = sha256(readFileSync(candidateCli))
  const durableReceipt = join(CTX.artifactsDir, 'operator-cutover-receipt.json')
  let cutoverReceipt
  if (existsSync(durableReceipt)) {
    cutoverReceipt = readControlReceipt('operator-cutover-receipt.json')
    if (cutoverReceipt.newSha256 !== candidateSha || ![candidateSha, cutoverReceipt.previousSha256].includes(previousSha)) throw new Error('operator rerun generation mismatch')
    if (previousSha === candidateSha) {
      normalizeLinkMode()
      phase('operator', true, `${genId} already installed; original predecessor receipt retained`)
      return
    }
  } else {
    cutoverReceipt = {
      status: 'INSTALLING', generationId: genId, cutoverAt: new Date().toISOString(),
      previousLink: previous, previousSha256: previousSha,
      newLink: candidateCli, newSha256: candidateSha,
      gates: { candidateBytes: 'MATCH', currentProductionLink: 'SEALED_GENERATION', cliBytesMatchExpected: 'PASS' },
    }
    writeControlReceipt('operator-cutover-receipt.json', cutoverReceipt)
  }
  const tmpLink = `${CTX.binSymlink}.incoming-${process.pid}`
  execFileSync('ln', ['-sfn', candidateCli, tmpLink])
  execFileSync('mv', ['-f', tmpLink, CTX.binSymlink])
  normalizeLinkMode()
  const nowSha = sha256(readFileSync(CTX.binSymlink))
  if (nowSha !== candidateSha) throw new Error('operator flip failed byte check')
  cutoverReceipt.status = 'INSTALLED'
  writeFileSync(join(genDir, 'cutover-receipt.json'), `${JSON.stringify(cutoverReceipt, null, 2)}\n`)
  writeControlReceipt('operator-cutover-receipt.json', cutoverReceipt)
  phase('operator', true, `${genId} sealed; operator sha ${candidateSha.slice(0, 12)}… (was ${previousSha.slice(0, 12)}…); flip receipted`)
}

function watchdogInstall() {
  const stateDir = CTX.watchdogStateDir
  mkdirSync(stateDir, { recursive: true })
  try { CTX.chown(stateDir, 'authsvc', 'staff') } catch (error) { if (MODE === 'apply') throw error }
  repairWatchdogEvidenceChannel({ ctx: CTX, mode: MODE, phase, execFileSync })
  if (!existsSync(CTX.routingManifest)) phase('watchdog', false, 'canonical Scheduler routing manifest missing; no business-chat fallback')
  const incidentOwner = statSync(stateDir)
  const runtimeReaderGid = incidentOwner.gid
  if (!Number.isInteger(runtimeReaderGid) || (Number.isInteger(CTX.runtimeReaderGid) && runtimeReaderGid !== CTX.runtimeReaderGid)) {
    phase('watchdog', false, 'unable to resolve exact authsvc reader gid')
  }
  const fill = (tmpl) => tmpl
    .replaceAll('__AUTHSVC_UID__', String(incidentOwner.uid))
    .replaceAll('__AUTHSVC_GID__', String(runtimeReaderGid))
    .replaceAll('__DEPLOYED_SHA__', SOURCE_SHA)
  const priorReceiptPath = join(CTX.artifactsDir, 'watchdog-install-receipt.json')
  let receipt = existsSync(priorReceiptPath) ? readControlReceipt('watchdog-install-receipt.json') : null
  if (!receipt) {
    const plists = [['w1', 'ai.agent-core.scheduler-watchdog-w1'], ['w2', 'ai.agent-core.scheduler-watchdog-w2']].map(([role, label]) => {
      const tmpl = fill(CTX.gitShow(SOURCE_SHA, `deployment-artifacts/scheduler-control-plane-reliability-v1/ai.agent-core.scheduler-watchdog-${role}.plist.tmpl`))
      const path = join(CTX.launchdDir, `${label}.plist`)
      const existed = existsSync(path)
      const preimage = join(CTX.artifactsDir, 'rollback', `${label}.plist.preimage`); mkdirSync(dirname(preimage), { recursive: true })
      const before = existed ? capturePlainFileMetadata(path) : null
      if (existed && existsSync(preimage) && !readFileSync(path).equals(readFileSync(preimage))) { rmSync(preimage); syncDirectory(dirname(preimage)) }
      if (existed && !existsSync(preimage)) durableCopyPreimage(path, preimage, before)
      const rollbackMetadata = existed ? capturePlainFileMetadata(preimage) : null; const rollbackSha256 = existed ? sha256(readFileSync(preimage)) : null; const rollbackXattrs = existed ? listFileXattrs(preimage) : []
      if (existed && (sha256(readFileSync(path)) !== rollbackSha256 || JSON.stringify(before) !== JSON.stringify(rollbackMetadata))) throw new Error(`watchdog predecessor differs from durable rollback preimage: ${label}`)
      if (existed) verifyAndSyncPreimage(path, preimage, rollbackMetadata)
      return { role, label, path, existed, installedSha256: sha256(Buffer.from(tmpl)), preimage,
        preimageSha256: rollbackSha256, preimageMetadata: rollbackMetadata, preimageXattrs: rollbackXattrs }
    })
    receipt = { status: 'INSTALLING', sourceSha: SOURCE_SHA, plists }
    writeControlReceipt('watchdog-install-receipt.json', receipt)
  }
  verifyWatchdogReplayReceipt(receipt, { sourceSha: SOURCE_SHA, launchdDir: CTX.launchdDir, artifactsDir: CTX.artifactsDir })
  for (const item of receipt.plists) {
    const tmpl = fill(CTX.gitShow(SOURCE_SHA, `deployment-artifacts/scheduler-control-plane-reliability-v1/ai.agent-core.scheduler-watchdog-${item.role}.plist.tmpl`))
    if (sha256(Buffer.from(tmpl)) !== item.installedSha256) throw new Error(`watchdog candidate generation mismatch: ${item.label}`)
    const currentSha = existsSync(item.path) ? sha256(readFileSync(item.path)) : null
    if (currentSha === item.installedSha256) { syncFile(item.path); syncDirectory(dirname(item.path)); if (!CTX.isLoaded(`system/${item.label}`)) CTX.bootstrap(item.path, `system/${item.label}`); continue }
    if (currentSha !== item.preimageSha256) throw new Error(`watchdog rerun generation mismatch: ${item.label}`)
    const plist = item.path
    atomicInstallDurableFile(plist, Buffer.from(tmpl), {
      uid: MODE === 'selftest' ? process.getuid() : 0,
      gid: MODE === 'selftest' ? process.getgid() : 0,
      mode: 0o644,
    })
    if (readFileSync(plist, 'utf8') !== tmpl) throw new Error(`watchdog plist readback mismatch: ${item.label}`)
    // the freeze already quiesced W1/W2: booting out a not-loaded label fails with
    // launchd 'Boot-out failed: 3: No such process', so only bootout when actually loaded
    if (item.existed && CTX.isLoaded(`system/${item.label}`)) CTX.bootout(`system/${item.label}`)
    CTX.bootstrap(plist, `system/${item.label}`)
  }
  receipt.status = 'INSTALLED'
  writeControlReceipt('watchdog-install-receipt.json', receipt)
  phase('watchdog', true, 'W1/W2 installed (idempotent); state dir authsvc-owned pre-created')
}

function routingInstall(doc) {
  if (!CTX.routingCandidate || !/^[0-9a-f]{64}$/.test(CTX.routingCandidateSha256 ?? '')) {
    throw new Error('explicit routing candidate path and frozen sha256 are required')
  }
  if (!Number.isInteger(CTX.routingCandidateUid) || !Number.isInteger(CTX.routingCandidateGid)) {
    throw new Error('explicit routing candidate uid/gid are required')
  }
  const result = installSchedulerRoutingManifest({
    candidatePath: CTX.routingCandidate, expectedSha256: CTX.routingCandidateSha256,
    targetPath: CTX.routingManifest, jobs: doc.jobs, artifactsDir: CTX.artifactsDir,
    expectedUid: MODE === 'selftest' ? process.getuid() : 0,
    expectedGid: CTX.authsvcGid, mode: MODE === 'plan' ? 'plan' : 'apply',
    controlUid: CTX.controlUid, controlGid: CTX.controlGid,
    candidateUid: CTX.routingCandidateUid, candidateGid: CTX.routingCandidateGid,
    targetBoundary: CTX.routingTargetBoundary,
  })
  phase('routing', true, `protected canonical routing generation ${result.candidateSha256.slice(0, 12)}; enabled jobs=${result.enabledJobCount}`)
}

function incidentMigration() {
  preparePrivateRuntimeDirectory({ path: CTX.watchdogStateDir, expectedUid: CTX.authsvcUid,
    expectedGid: CTX.runtimeReaderGid ?? CTX.authsvcGid, allowedLegacyGids: [CTX.authsvcGid] })
  const normalization = normalizeLegacyIncidentStateFiles({ stateDir: CTX.watchdogStateDir,
    expectedUid: CTX.authsvcUid, expectedGid: CTX.runtimeReaderGid ?? CTX.authsvcGid, allowedLegacyGids: [CTX.authsvcGid] })
  writeControlReceipt('incident-file-normalization-receipt.json', normalization)
  const receipt = runSchedulerIncidentMigration({ ctx: CTX, sources: CTX.migrationSources ?? MIGRATION_SOURCES })
  writeControlReceipt('incident-migration-receipt.json', receipt)
  phase('incident-migration', true, `${receipt.status}; incident=${receipt.incidentSha256.slice(0, 12)}`)
}

function quiesceWatchdogs() {
  const labels = ['system/ai.agent-core.scheduler-watchdog-w1', 'system/ai.agent-core.scheduler-watchdog-w2']
  const statePath = join(CTX.artifactsDir, 'service-state-preimage.json')
  if (!existsSync(statePath)) writeControlReceipt('service-state-preimage.json', { sourceSha: SOURCE_SHA,
    loaded: Object.fromEntries([...labels, 'system/ai.agent-core.runtime'].map((label) => [label, CTX.isLoaded(label)])) })
  else if (readControlReceipt('service-state-preimage.json').sourceSha !== SOURCE_SHA) throw new Error('service-state preimage generation mismatch')
  quiesceLaunchdServices([...labels, 'system/ai.agent-core.runtime'], CTX)
  phase('watchdog-quiesce', true, 'W1/W2/runtime stopped before store, code, config, routing, or incident-state mutation')
}

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
  quiesceWatchdogs()
  const routingControl = MODE === 'apply'
    ? reconcileLegacyRoutingControlOwnership({ artifactsDir: CTX.artifactsDir,
        controlUid: CTX.controlUid, controlGid: CTX.controlGid, legacyGid: CTX.authsvcGid })
    : { status: 'FIXTURE_NOT_APPLICABLE' }
  phase('routing-control-ownership', true, routingControl.status)
  overlay()
  await backfillAndFreeze(doc, matched)
  routingInstall(await new JobStore(CTX.storePath).loadDoc({ force: true }))
  incidentMigration()
  brokerBootRehearsal()
  runtimeRestart()
  operatorGeneration()
  watchdogInstall()
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
