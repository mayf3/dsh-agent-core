import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, lchmodSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { computeOperatorClosure } from './admission-lib.mjs'
import { repairWatchdogEvidenceChannel } from './admission-watchdog-issue3.mjs'
import { installSchedulerRoutingManifest } from '../../packages/production-runtime/src/scheduler/deployment-routing.js'
import { capturePlainFileMetadata, listFileXattrs } from '../../packages/production-runtime/src/scheduler/deployment-file-metadata.js'
import { atomicInstallDurableFile, durableCopyPreimage, syncDirectory, syncFile, verifyAndSyncPreimage } from '../../packages/production-runtime/src/scheduler/deployment-durable-file.js'
import { runSchedulerIncidentMigration } from '../../packages/production-runtime/src/scheduler/deployment-incident-migration.js'
import { normalizeLegacyIncidentStateFiles, preparePrivateRuntimeDirectory } from '../../packages/production-runtime/src/scheduler/deployment-incident-directory.js'
import { verifyWatchdogReplayReceipt } from '../../packages/production-runtime/src/scheduler/deployment-watchdog-replay.js'
import { quiesceLaunchdServices } from '../../packages/production-runtime/src/scheduler/deployment-launchd.js'

/**
 * Deployment phases split from scripts/scheduler-cp-admission.mjs (binding
 * structure gate B3) with zero semantic change: same bodies, same ordering
 * contract (the orchestrator's main() still sequences them), same fail-closed
 * behavior. Everything is a closure over the injected orchestrator context —
 * `deps` carries exactly the module-level state the phases used to close over.
 *
 * deps: { CTX, MODE, SOURCE_SHA, MIGRATION_SOURCES, phase, writeControlReceipt,
 *         readControlReceipt, sha256, git, execFileSync? (defaults to node's) }
 */
export function createDeploymentPhases(deps) {
  const {
    CTX, MODE, SOURCE_SHA, MIGRATION_SOURCES, phase, writeControlReceipt, readControlReceipt, sha256, git,
  } = deps

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
      const cronerSrc = join(deps.repoRoot, 'node_modules', 'croner')
      const cronerDst = join(genDir, 'candidate/usr/local/packages/scheduler/node_modules/croner')
      rmSync(cronerDst, { recursive: true, force: true })
      ensureTraversableDir(dirname(cronerDst))
      execFileSync('cp', ['-R', cronerSrc, cronerDst])
      // cp -R masks copied modes with the shell umask (077 → dirs 0700 / files 0600),
      // which would break authsvc module loading — normalize the whole subtree
      chmodSync(cronerDst, 0o755)
      const chmodCronerTree = (dir) => {
        for (const entry of readdirSync(dir)) {
          const child = join(dir, entry)
          if (lstatSync(child).isDirectory()) { chmodSync(child, 0o755); chmodCronerTree(child) } else chmodSync(child, 0o644)
        }
      }
      chmodCronerTree(cronerDst)
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
    // the link may dangle: a prior failed apply's target lives inside a control dir that
    // the phase2 wrapper archives away before the next attempt. darwin readlink -f prints
    // the stored target but exits 1 on dangling links, so use bare readlink (exit 0,
    // prints the raw stored target) and keep the raw path as forensic evidence.
    let previous = ''
    let previousSha = null
    try {
      previous = execFileSync('readlink', [CTX.binSymlink], { encoding: 'utf8' }).trim()
      if (previous !== '' && !previous.startsWith('/')) previous = join(dirname(CTX.binSymlink), previous)
      if (previous !== '' && existsSync(previous)) previousSha = sha256(readFileSync(previous))
      else previousSha = null
    } catch { previous = ''; previousSha = null }
    const candidateSha = sha256(readFileSync(candidateCli))
    const durableReceipt = join(CTX.artifactsDir, 'operator-cutover-receipt.json')
    let cutoverReceipt
    if (existsSync(durableReceipt) && previousSha !== null) {
      cutoverReceipt = readControlReceipt('operator-cutover-receipt.json')
      if (cutoverReceipt.newSha256 !== candidateSha || ![candidateSha, cutoverReceipt.previousSha256].includes(previousSha)) throw new Error('operator rerun generation mismatch')
      if (previousSha === candidateSha && previous === candidateCli) {
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
    phase('operator', true, `${genId} sealed; operator sha ${candidateSha.slice(0, 12)}… (was ${previousSha === null ? 'none' : previousSha.slice(0, 12)}…); flip receipted`)
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
      .replaceAll('__ROUTING_READER_GID__', String(CTX.authsvcGid))
      .replaceAll('__INCIDENT_OWNER_GID__', String(runtimeReaderGid))
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

  return { ensureTraversableDir, operatorGeneration, watchdogInstall, routingInstall, incidentMigration, quiesceWatchdogs }
}
