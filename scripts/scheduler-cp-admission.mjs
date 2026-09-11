#!/usr/bin/env node
/**
 * scheduler-cp-admission — the CONSOLIDATED production admission runner
 * (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1, RUNBOOK §3 as one bounded gate).
 *
 * One Owner sudo grant executes every accepted reliability mechanism in
 * RUNBOOK order, each phase idempotent and receipted:
 *
 *   census    privileged raw read of the canonical store (message bodies
 *             never leave the host; census dump strips payload.message)
 *   criticals match the two directive-named critical jobs (exact predicates —
 *             abort unless exactly one match each)
 *   backfill  logicalKey assignment via updateJobOp (audited, revision-
 *             invariant asserted) — reuses the shipped backfill logic inline
 *   desired   freeze desired-state AS FOUND for the two criticals
 *   overlay   source overlay to the live app tree: EVERY differing/absent
 *             file under packages/ + scripts/ staged from SOURCE_SHA via
 *             git-show (worktree state irrelevant), preimage tar first,
 *             atomic temp+rename per file, uid/gid/mode preserved,
 *             deletions never planned
 *   runtime   plist env additions (AGENTCORE_EXPECTED_STORE,
 *             SCHEDULER_RECONCILIATION_EVIDENCE_FILE) + ONE kickstart -k +
 *             health wait
 *   operator  build a NEW sealed operator generation from SOURCE_SHA (full
 *             ESM closure, seal.json/manifest/receipts mirroring the
 *             stage-isolation format) + atomic symlink flip + sandboxed
 *             functional smoke
 *   watchdog  pre-create shared state dir AS authsvc, install W1/W2 plists
 *             (system domain), verify heartbeats
 *   proofs    G-gate receipts: CLI guard negative, canonical read-back via
 *             authsvc identity, readiness negative via unbound runtime, then
 *             the terminal receipt JSON
 *
 * Modes:
 *   --selftest   FULL flow against synthetic fixtures (fake live root, stub
 *                store, launchctl shim) — NO sudo, NO production contact.
 *                Must pass before the tool is handed to the Owner.
 *   --plan       read-only: census+match+overlay plan printed, zero writes
 *                (privileged store read still needs the sudo context)
 *   --apply      the real gate. Refuses to run unless euid == 0.
 *
 * Rollback: every phase writes preimages under <artifacts>/rollback/ and the
 * RUNBOOK §4 table maps each to its reversal.
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, statSync, readdirSync, accessSync, constants,
} from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { homedir, userInfo } from 'node:os'
import { JobStore } from '../packages/scheduler/src/store.js'
import { updateJobOp } from '../packages/scheduler/src/control.js'
import {
  matchCriticalJobs, buildDesiredState, buildBackfillMapping, classifyCensus,
  computeOperatorClosure, narrowOverlayUniverse, inOverlayUniverse,
  reExportsWithoutLocalBinding,
} from './lib/admission-lib.mjs'
import { repairWatchdogEvidenceChannel, assertEvidenceAndHeartbeatProofs } from './lib/admission-watchdog-issue3.mjs'

const args = process.argv.slice(2)
const has = (name) => args.includes(name)
const val = (name) => {
  const idx = args.indexOf(name)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : undefined
}
const MODE = has('--selftest') ? 'selftest' : has('--plan') ? 'plan' : has('--apply') ? 'apply' : undefined
const SOURCE_SHA = val('--source-sha') ?? 'db93649'
if (MODE === undefined || !/^[0-9a-f]{7,40}$/.test(SOURCE_SHA)) {
  process.stderr.write('usage: scheduler-cp-admission --selftest | --plan | --apply [--source-sha <sha>]\n')
  process.exit(2)
}

// ── context resolution (real vs fixture) ─────────────────────────────────────
const REPO = (() => {
  const here = dirname(new URL(import.meta.url).pathname)
  return relative('', here) === here ? here : here // absolute by construction
})()
const REPO_ROOT = join(dirname(new URL(import.meta.url).pathname), '..')
// root runs git against a yanfenma-owned repo -> dubious-ownership refusal;
// every git call goes through this wrapper with the repo explicitly trusted.
const git = (argv, opts = {}) => execFileSync('git', ['-c', `safe.directory=${REPO_ROOT}`, '-C', REPO_ROOT, ...argv], { maxBuffer: 32 * 1024 * 1024, ...opts })

const CTX = MODE === 'selftest'
  ? {
      liveRoot: '', storePath: '', artifacts: '', binSymlink: '', launchctl: '', ownerChat: '', launchdDir: '',
      gitShow: (sha, path) => git(['show', `${sha}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
      gitHash: (sha, path) => git(['rev-parse', `${sha}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
      kickstart: (label) => CTX.launchctlShim('kickstart', label),
      bootstrap: (plist, label) => CTX.launchctlShim('bootstrap', `${plist} ${label}`),
      chown: () => true, // fixture dirs already owned by the runner
      asAuthsvc: (cmd, argv) => execFileSync(cmd, argv, { encoding: 'utf8', env: { ...process.env, HOME: '/Users/authsvc', AGENTCORE_EXPECTED_STORE: '/Users/authsvc/.agent-core/scheduler/jobs.json' }, stdio: ['ignore', 'pipe', 'pipe'] }),
    }
  : {
      liveRoot: '/usr/local/libexec/agent-core/app',
      storePath: '/Users/authsvc/.agent-core/scheduler/jobs.json',
      artifacts: '/Users/yanfenma/workspace/artifacts/production-candidates',
      artifactsDir: '/Users/yanfenma/workspace/artifacts/production-candidates/SCHEDULER_CONTROL_PLANE_RELIABILITY_V1-admission',
      desiredPath: '/usr/local/libexec/agent-core/config/scheduler-desired-state.json',
      launchdDir: '/Library/LaunchDaemons',
      runtimeNode: '/usr/local/libexec/agent-core/node-runtime/bin/node',
      watchdogStateDir: '/Users/authsvc/.agent-core/control/scheduler-watchdog',
      evidenceFile: '/usr/local/var/scheduler-watchdog/reconciliation-evidence.jsonl',
      binSymlink: '/usr/local/bin/agentcore-cron',
      launchctl: 'launchctl',
      ownerChat: process.env.SCHEDULER_WATCHDOG_ALERT_TO ?? '',
      gitShow: (sha, path) => git(['show', `${sha}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
      gitHash: (sha, path) => git(['rev-parse', `${sha}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
      kickstart: (label) => execFileSync('launchctl', ['kickstart', '-k', label], { stdio: ['ignore', 'pipe', 'pipe'] }),
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
function phase(name, ok, detail) {
  receipts.phases[name] = { ok, detail }
  process.stdout.write(`[${ok === false ? 'FAIL' : 'ok'}] ${name} — ${detail}\n`)
  if (ok === false) throw new Error(`phase ${name} failed: ${detail}`)
}
const stripMessages = (jobs) => (jobs ?? []).map(({ payload, ...rest }) => ({ ...rest, payload: payload ? { ...payload, message: '<stripped>' } : payload }))

// ── census + criticals ───────────────────────────────────────────────────────
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

// ── backfill + desired-state ─────────────────────────────────────────────────
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
  // root-run safety: _writeAtomic renames a root-created tmp over the store —
  // restore the authsvc ownership or the engine can never write again.
  if (mapping.length > 0 && userInfo().uid === 0) {
    CTX.chown(CTX.storePath, 'authsvc', 'staff')
  }
  phase('backfill', true, `${mapping.length} critical(s) keyed (idempotent); store ownership restored`)
  const desired = buildDesiredState(matched)
  mkdirSync(dirname(CTX.desiredPath), { recursive: true })
  writeFileSync(CTX.desiredPath, `${JSON.stringify(desired, null, 2)}\n`)
  phase('desired-state', true, `${desired.jobs.length} critical(s) frozen at ${CTX.desiredPath}`)
  return { desired, alertTo: (() => {
    const daily = matched.daily.jobs[0]
    const to = daily?.delivery?.to
    return typeof to === 'string' && to.startsWith('chat:') ? to.slice(5) : CTX.ownerChat
  })() }
}

// ── source overlay ───────────────────────────────────────────────────────────
function listLiveFiles(root, prefix = '') {
  const out = new Set()
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) for (const nested of listLiveFiles(root, rel)) out.add(nested)
    else out.add(rel)
  }
  return out
}
function overlay() {
  const seedList = execFileSync('git', ['-C', REPO_ROOT, 'ls-tree', '-r', '--name-only', SOURCE_SHA, 'packages/broker/', 'packages/scheduler/'], { encoding: 'utf8' }).split('\n').filter(Boolean).filter((path) => inOverlayUniverse(path))
  const liveRootFiles = listLiveFiles(CTX.liveRoot)
  const liveSha = (path) => {
    const p = join(CTX.liveRoot, path)
    return existsSync(p) ? sha256(readFileSync(p)) : undefined
  }
  const narrowed = narrowOverlayUniverse({
    seedPaths: seedList,
    readTarget: (path) => execFileSync('git', ['-C', REPO_ROOT, 'show', `${SOURCE_SHA}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 }),
    liveHas: (path) => liveRootFiles.has(path),
    liveShaOf: liveSha,
  })
  if (narrowed.refuse) phase('overlay', false, `NARROW CLOSURE REFUSED: ${narrowed.refuse} — NO MUTATION (widen CONSCIOUSLY with the model-overrides lesson in mind)`)
  const plan = { update: [], add: [] }
  for (const [path, bytes] of [...narrowed.overlay.entries()]) {
    const sha = sha256(bytes)
    if (!liveRootFiles.has(path)) plan.add.push({ path, sha })
    else if (liveSha(path) !== sha) plan.update.push({ path, sha })
  }
  const all = [...plan.update.map((entry) => ({ ...entry, kind: 'update' })), ...plan.add.map((entry) => ({ ...entry, kind: 'add' }))]
  if (MODE === 'plan') {
    process.stdout.write(`[overlay plan] update=${plan.update.length} add=${plan.add.length}\n${all.map((e) => `  ${e.kind} ${e.path}`).join('\n')}\n`)
    phase('overlay', true, `planned update=${plan.update.length} add=${plan.add.length} (plan mode)`)
    return
  }
  const preimage = join(CTX.artifactsDir, 'rollback', 'overlay-preimage.tar.gz')
  mkdirSync(dirname(preimage), { recursive: true })
  const changedExisting = all.filter((e) => e.kind === 'update').map((e) => e.path)
  if (changedExisting.length > 0) {
    execFileSync('tar', ['-czf', preimage, '-C', CTX.liveRoot, ...changedExisting])
  }
  for (const entry of all) {
    const bytes = Buffer.from(narrowed.overlay.get(entry.path), 'utf8')
    const target = join(CTX.liveRoot, entry.path)
    if (sha256(bytes) !== entry.sha) throw new Error(`staged bytes != plan sha for ${entry.path}`)
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
  phase('overlay', true, `NARROW closure: ${all.length} files (update=${plan.update.length} add=${plan.add.length}); preimage=${changedExisting.length} files -> ${preimage}; production-runtime/** untouched`)
}

// ── broker boot rehearsal (2026-09-09 fleet-killer gate) ────────────────────
/**
 * Child-mode apply() rehearsal on the JUST-STAGED bytes, against the LIVE app
 * tree (whose node_modules resolves @deepseek-ai/*), BEFORE any kickstart:
 * module load + apply(stub ctx, {mode:'child'}) — exactly the path whose
 * ReferenceError killed every agent child while the parent stayed healthy.
 */
function brokerBootRehearsal() {
  const staged = readFileSync(join(CTX.liveRoot, 'packages/broker/src/index.js'), 'utf8')
  if (MODE === 'selftest') {
    // Fixture mode lacks @deepseek-ai/* modules: degrade to the parse audit
    // that still catches the fleet-killer class (re-export-without-binding
    // called by apply). The real mode executes child-mode apply on the live
    // tree, where the module graph fully resolves.
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

// ── plist env + one kickstart ────────────────────────────────────────────────
function runtimeRestart(alertTo) {
  const plistPath = join(CTX.launchdDir, 'ai.agent-core.runtime.plist')
  const preimage = join(CTX.artifactsDir, 'rollback', 'ai.agent-core.runtime.plist.preimage')
  mkdirSync(dirname(preimage), { recursive: true })
  if (!existsSync(preimage)) execFileSync('cp', [plistPath, preimage])
  let plist = readFileSync(plistPath, 'utf8')
  const envAdds = {
    AGENTCORE_EXPECTED_STORE: '/Users/authsvc/.agent-core/scheduler/jobs.json',
    SCHEDULER_RECONCILIATION_EVIDENCE_FILE: '/usr/local/var/scheduler-watchdog/reconciliation-evidence.jsonl',
  }
  let dirty = false
  for (const [key, v] of Object.entries(envAdds)) {
    if (!plist.includes(`<key>${key}</key>`)) {
      plist = plist.replace('<key>HOME</key>', `<key>${key}</key><string>${v}</string>\n\t\t<key>HOME</key>`)
      dirty = true
    }
  }
  if (dirty) {
    const tmp = `${plistPath}.incoming`
    writeFileSync(tmp, plist)
    execFileSync('mv', [tmp, plistPath])
  }
  CTX.kickstart('system/ai.agent-core.runtime')
  // health wait
  const deadline = Date.now() + 60_000
  let healthy = false
  while (Date.now() < deadline) {
    try {
      const res = JSON.parse(execFileSync('curl', ['-s', '-m', '3', 'http://127.0.0.1:8790/health'], { encoding: 'utf8' }))
      if (res?.ok === true) { healthy = true; break }
    } catch { /* retry */ }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000)
  }
  if (!healthy) {
    // HEALTH-TIMEOUT IS A FAILURE (2026-09-09 lesson: recording ok and
    // continuing let the engine crash-loop invisibly through later phases).
    phase('runtime', false, 'health TIMEOUT after kickstart — RUN ROLLBACK NOW: sudo node scripts/scheduler-cp-rollback.mjs (preimages are in place)')
  }
  phase('runtime', true, `plist env ${dirty ? 'patched' : 'already present'}; kickstart; health=ok${alertTo && !CTX.ownerChat ? `; alertTo derived from critical daily job (${alertTo})` : ''}`)
  return { healthy }
}

// ── sealed operator generation ───────────────────────────────────────────────
function operatorGeneration() {
  const short = SOURCE_SHA.slice(0, 7)
  const genId = `SCHEDULER_CONTROL_PLANE_RELIABILITY_V1--dsh-agent-core--${short}--x86_64--g1`
  const genDir = join(CTX.artifacts, genId)
  const candidateCli = join(genDir, 'candidate/usr/local/bin/agentcore-cron')
  if (!existsSync(genDir)) {
    mkdirSync(dirname(candidateCli), { recursive: true })
    const closure = computeOperatorClosure('scripts/agentcore-cron.mjs', (path) => CTX.gitShow(SOURCE_SHA, path))
    for (const path of Object.keys(closure)) {
      if (closure[path] === 'UNRESOLVABLE') throw new Error(`operator closure unresolvable at ${path}`)
      const bytes = git(['show', `${SOURCE_SHA}:${path}`], { stdio: ['ignore', 'pipe', 'pipe'] })
      // the seed lands under its OPERATOR name (bin/agentcore-cron, no .mjs)
      const rel = path === 'scripts/agentcore-cron.mjs' ? 'bin/agentcore-cron' : path
      const target = join(genDir, 'candidate/usr/local', rel.startsWith('bin/') ? rel : rel.replace(/^packages\//, 'packages/'))
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, bytes)
      try { execFileSync('chmod', ['0755', target], { stdio: ['ignore', 'pipe', 'pipe'] }) } catch (error) { if (MODE === 'apply') throw error }
    }
    // vendor the scheduler package's production deps (croner) INSIDE the
    // closure package dir — bare imports resolve from the candidate's own
    // node_modules walk-up, exactly like the previous generation
    // (DEPENDENCY_CLOSURE / attempt-1 lesson: missing croner resolution).
    const cronerSrc = join(REPO_ROOT, 'node_modules', 'croner')
    const cronerDst = join(genDir, 'candidate/usr/local/packages/scheduler/node_modules/croner')
    rmSync(cronerDst, { recursive: true, force: true })
    mkdirSync(dirname(cronerDst), { recursive: true })
    execFileSync('cp', ['-R', cronerSrc, cronerDst]) // dst absent -> clean dir copy (BSD cp '.' idiom is unreliable)
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
  // atomic flip with preimage proof
  const previous = execFileSync('readlink', ['-f', CTX.binSymlink], { encoding: 'utf8' }).trim()
  const previousSha = sha256(readFileSync(previous))
  const candidateSha = sha256(readFileSync(candidateCli))
  const tmpLink = `${CTX.binSymlink}.incoming-${process.pid}`
  execFileSync('ln', ['-sfn', candidateCli, tmpLink])
  execFileSync('mv', ['-f', tmpLink, CTX.binSymlink])
  const nowSha = sha256(readFileSync(CTX.binSymlink))
  if (nowSha !== candidateSha) throw new Error('operator flip failed byte check')
  writeFileSync(join(genDir, 'cutover-receipt.json'), `${JSON.stringify({
    generationId: genId, cutoverAt: new Date().toISOString(),
    previousLink: previous, previousSha256: previousSha,
    newLink: candidateCli, newSha256: candidateSha,
    gates: { candidateBytes: 'MATCH', currentProductionLink: 'SEALED_GENERATION', cliBytesMatchExpected: 'PASS' },
  }, null, 2)}\n`)
  phase('operator', true, `${genId} sealed; operator sha ${candidateSha.slice(0, 12)}… (was ${previousSha.slice(0, 12)}…); flip receipted`)
}

// ── watchdog install ─────────────────────────────────────────────────────────
function watchdogInstall(alertTo) {
  const stateDir = CTX.watchdogStateDir
  mkdirSync(stateDir, { recursive: true })
  try { CTX.chown(stateDir, 'authsvc', 'staff') } catch (error) { if (MODE === 'apply') throw error }
  // Issue 3 provisioning closure (RUNBOOK §7-authorized): see lib module.
  repairWatchdogEvidenceChannel({ ctx: CTX, mode: MODE, phase, execFileSync })
  const tmplDir = join(REPO_ROOT, 'deployment-artifacts', 'scheduler-control-plane-reliability-v1')
  const fill = (tmpl) => tmpl
    .replace('__OWNER_CHAT_ID__', alertTo || CTX.ownerChat)
  for (const [role, label] of [['w1', 'ai.agent-core.scheduler-watchdog-w1'], ['w2', 'ai.agent-core.scheduler-watchdog-w2']]) {
    const tmpl = fill(readFileSync(join(tmplDir, `ai.agent-core.scheduler-watchdog-${role}.plist.tmpl`), 'utf8'))
    const plist = join(CTX.launchdDir, `${label}.plist`)
    if (!existsSync(plist)) {
      const tmp = `${plist}.incoming`
      writeFileSync(tmp, tmpl)
      execFileSync('mv', [tmp, plist])
      try { execFileSync('chown', ['root:wheel', plist], { stdio: ['ignore', 'pipe', 'pipe'] }) } catch (error) { if (MODE === 'apply') throw error }
      CTX.bootstrap(plist, `system/${label}`)
    }
  }
  phase('watchdog', true, 'W1/W2 installed (idempotent); state dir authsvc-owned pre-created')
}

// ── proofs ───────────────────────────────────────────────────────────────────
function gate(name, ok, detail) { receipts.gates = receipts.gates ?? {}; receipts.gates[name] = { ok, detail }; process.stdout.write(`[${ok ? 'PASS' : 'FAIL'}] ${name} — ${detail}\n`); if (!ok) throw new Error(`gate ${name} failed`) } // shared by proofs() and the Issue 3 proof module
async function proofs() {
  // CLI guard negative (as root, sandbox HOME): must refuse, create nothing
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
  // fixture mode resolves the existence-only check against the fixture copy:
  // the production path sits under the authsvc 0700 credential-store, which an
  // unprivileged --selftest must never need to traverse.
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
  const doc = readCensus()
  const matched = criticalsOrAbort(doc)
  if (MODE === 'plan') {
    process.stdout.write(`${JSON.stringify({ matched: { daily: matched.daily.match, hr: matched.hr.match }, classification: classifyCensus(doc.jobs, matched) }, null, 2)}\n`)
    overlay() // plan mode prints only
    return
  }
  const { alertTo } = await backfillAndFreeze(doc, matched)
  overlay()
  brokerBootRehearsal()
  runtimeRestart(alertTo)
  operatorGeneration()
  watchdogInstall(alertTo)
  await proofs()
  writeFileSync(join(CTX.artifactsDir, 'terminal-receipt.json'), `${JSON.stringify({ ...receipts, finishedAt: new Date().toISOString() }, null, 2)}\n`)
  process.stdout.write(`[admission] TERMINAL RECEIPT written: ${join(CTX.artifactsDir, 'terminal-receipt.json')}\n`)
}

// selftest fixture wiring
if (MODE === 'selftest') {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const fx = mkdtempSync(join(tmpdir(), 'sched-cp-admission-'))
  const store = new JobStore(join(fx, 'jobs.json'), { runLogPath: join(fx, 'runs.jsonl') })
  const { createJobOp } = await import('../packages/scheduler/src/control.js')
  const daily = await createJobOp(store, { name: '每日摘要检查', agentId: 'agt_daily-thought-agent', schedule: { kind: 'cron', expr: '0 22 * * *', tz: 'Asia/Shanghai' }, payload: { kind: 'agentTurn', message: 'seed' }, delivery: { mode: 'announce', channel: 'feishu', to: 'chat:oc_fixture' } })
  // replicate the REAL ambiguity the guard caught: a second enabled job of the
  // same agent with the SAME cron/tz — the frozen-identity predicate must
  // still match exactly one.
  await createJobOp(store, { name: '每日随想总结-DeepSeek（滚动7日补偿）', agentId: 'agt_daily-thought-agent', schedule: { kind: 'cron', expr: '0 22 * * *', tz: 'Asia/Shanghai' }, payload: { kind: 'agentTurn', message: 'seed' }, delivery: { mode: 'none' } })
  const hr = await createJobOp(store, { name: 'HR auto dispatch', agentId: 'agt_hr-agent', schedule: { kind: 'every', everyMs: 3_600_000 }, payload: { kind: 'agentTurn', message: 'seed' }, delivery: { mode: 'none' } })
  // hr gets the frozen id prefix via direct doc patch (fixture-only)
  await store.mutateDoc((d) => {
    const hrTarget = d.jobs.find((j) => j.id === hr.id)
    hrTarget.id = 'b115cb96-fixture'
    hrTarget.state = {}
    d.jobs.find((j) => j.id === daily.id).id = 'fa13b0ea-fixture'
  })
  await createJobOp(store, { name: 'decoy daily', agentId: 'agt_daily-thought-agent', schedule: { kind: 'cron', expr: '30 5 * * *', tz: 'UTC' }, payload: { kind: 'agentTurn', message: 'decoy' }, delivery: { mode: 'none' } })
  // fake live root with OLD bytes for two targets + a live-only file
  const liveRoot = join(fx, 'live-root')
  for (const p of ['packages/broker/src/gateway.js', 'packages/scheduler/src/control.js', 'scripts/agentcore-cron.mjs', 'packages/agent-definition/src/definition.js', 'packages/agent-definition/src/index.js']) {
    mkdirSync(dirname(join(liveRoot, p)), { recursive: true })
    writeFileSync(join(liveRoot, p), `// OLD live bytes\n`)
  }
  writeFileSync(join(liveRoot, 'packages/live-only-legacy.js'), '// live-only\n')
  // shim launchctl
  const shim = join(fx, 'launchctl-shim.mjs')
  writeFileSync(shim, `import { writeFileSync, appendFileSync } from 'node:fs'\nconst log = process.env.SHIM_LOG\nconst [op, ...rest] = process.argv.slice(2)\nappendFileSync(log, op + ' ' + rest.join(' ') + '\\n')\nif (op === 'kickstart') { process.stdout.write(JSON.stringify({ok:true})) }\n`)
  mkdirSync(join(fx, 'LaunchDaemons'), { recursive: true })
  writeFileSync(join(fx, 'LaunchDaemons', 'ai.agent-core.runtime.plist'), '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>HOME</key><string>/Users/authsvc</string></dict></plist>\n')
  const binDir = join(fx, 'bin')
  mkdirSync(binDir, { recursive: true })
  writeFileSync(join(binDir, 'agentcore-cron'), '// OLD sealed bytes\n')
  execFileSync('ln', ['-s', join(binDir, 'agentcore-cron'), join(binDir, 'agentcore-cron-link')])
  Object.assign(CTX, {
    liveRoot, storePath: join(fx, 'jobs.json'),
    artifacts: fx, artifactsDir: fx, launchdDir: join(fx, 'LaunchDaemons'), watchdogStateDir: join(fx, 'watchdog-state'), evidenceFile: join(fx, 'evidence', 'reconciliation-evidence.jsonl'),
    runtimeNode: process.execPath,
    desiredPath: join(fx, 'desired-state.json'),
    binSymlink: join(binDir, 'agentcore-cron-link'),
    launchctlShim: (op, rest) => execFileSync(process.execPath, [shim, op, rest], { env: { ...process.env, SHIM_LOG: join(fx, 'launchctl-calls.log') } }),
    chown: () => {},
    asAuthsvc: () => JSON.stringify({ jobs: JSON.parse(readFileSync(join(fx, 'jobs.json'), 'utf8')).jobs.map((j) => ({ id: j.id })) }),
    ownerChat: '',
  })
  CTX.kickstart = (label) => CTX.launchctlShim('kickstart', label)
  CTX.bootstrap = (plist, label) => CTX.launchctlShim('bootstrap', plist)
  // fixture credential provider for the existence-only CREDENTIAL_PROVIDER gate
  mkdirSync(join(fx, 'config'), { recursive: true })
  writeFileSync(join(fx, 'config', 'agent-credentials.json'), '{}\n')
  CTX.credentialsProviderPath = join(fx, 'config', 'agent-credentials.json')
  const REPO_ROOT2 = REPO_ROOT
  CTX.gitShow = (sha, path) => git(['show', `${sha}:${path}`], { encoding: 'utf8' })
  CTX.gitHash = (sha, path) => git(['rev-parse', `${sha}:${path}`], { encoding: 'utf8' }).trim()
  await main()
  // selftest assertions
  const ok = (cond, label) => { if (!cond) { process.stderr.write(`[selftest FAIL] ${label}\n`); process.exit(1) } }
  const desired = JSON.parse(readFileSync(join(fx, 'desired-state.json'), 'utf8'))
  ok(desired.jobs.length === 2, 'desired-state has both criticals')
  ok(desired.jobs.every((job) => job.expectedEnabled === true), 'criticals enabled')
  const doc2 = JSON.parse(readFileSync(join(fx, 'jobs.json'), 'utf8'))
  ok(doc2.jobs.filter((j) => j.logicalKey !== undefined).length === 2, 'two jobs keyed')
  ok(existsSync(join(fx, 'bin')), 'operator flip fixture present')
  const calls = readFileSync(join(fx, 'launchctl-calls.log'), 'utf8')
  ok(calls.includes('kickstart'), 'kickstart called via shim')
  ok(calls.split('bootstrap').length - 1 === 2, 'two watchdog plists bootstrapped')
  const runtimePlist = readFileSync(join(fx, 'LaunchDaemons', 'ai.agent-core.runtime.plist'), 'utf8')
  ok(runtimePlist.includes('AGENTCORE_EXPECTED_STORE') && runtimePlist.includes('SCHEDULER_RECONCILIATION_EVIDENCE_FILE'), 'runtime plist env additions landed')
  ok(existsSync(join(fx, 'LaunchDaemons', 'ai.agent-core.scheduler-watchdog-w1.plist')), 'W1 plist written')
  ok(existsSync(join(fx, 'watchdog-state')), 'shared watchdog state dir created (fixture)')
  ok(existsSync(join(fx, 'watchdog-state', 'scheduler-watchdog-evidence.jsonl')), 'W1 evidence log pre-created in shared state dir')
  ok((statSync(join(fx, 'evidence')).mode & 0o002) === 0, 'reconciliation evidence dir NOT world-writable (0777 placeholder retired)')
  ok(!existsSync(join(liveRoot, 'packages/live-only-legacy.js')) === false, 'live-only file preserved (no deletions)')
  const newCli = readFileSync(join(binDir, 'agentcore-cron-link'), 'utf8')
  ok(newCli.includes('logical') || newCli.length > 1000, 'operator link now serves candidate bytes')
  process.stdout.write(`[admission selftest] PASS (fixture ${fx})\n`)
  process.exit(0)
}

await main()
