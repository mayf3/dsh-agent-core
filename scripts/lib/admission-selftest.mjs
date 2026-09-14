import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { createJobOp } from '../../packages/scheduler/src/control.js'
import { JobStore } from '../../packages/scheduler/src/store.js'

export async function runAdmissionSelftest({ ctx, main, git, sha256, repoRoot }) {
  const fx = realpathSync(mkdtempSync(join(tmpdir(), 'sched-cp-admission-')))
  const store = new JobStore(join(fx, 'jobs.json'), { runLogPath: join(fx, 'runs.jsonl') })
  const daily = await createJobOp(store, { name: '每日摘要检查', agentId: 'agt_daily-thought-agent', schedule: { kind: 'cron', expr: '0 22 * * *', tz: 'Asia/Shanghai' }, payload: { kind: 'agentTurn', message: 'seed' }, delivery: { mode: 'announce', channel: 'feishu', to: 'chat:oc_fixture' } })
  await createJobOp(store, { name: '每日随想总结-DeepSeek（滚动7日补偿）', agentId: 'agt_daily-thought-agent', schedule: { kind: 'cron', expr: '0 22 * * *', tz: 'Asia/Shanghai' }, payload: { kind: 'agentTurn', message: 'seed' }, delivery: { mode: 'none' } })
  const hr = await createJobOp(store, { name: 'HR auto dispatch', agentId: 'agt_hr-agent', schedule: { kind: 'every', everyMs: 3_600_000 }, payload: { kind: 'agentTurn', message: 'seed' }, delivery: { mode: 'none' } })
  await store.mutateDoc((doc) => {
    const hrTarget = doc.jobs.find((job) => job.id === hr.id)
    hrTarget.id = 'b115cb96-fixture'; hrTarget.state = {}
    doc.jobs.find((job) => job.id === daily.id).id = 'fa13b0ea-fixture'
  })
  await createJobOp(store, { name: 'decoy daily', agentId: 'agt_daily-thought-agent', schedule: { kind: 'cron', expr: '30 5 * * *', tz: 'UTC' }, payload: { kind: 'agentTurn', message: 'decoy' }, delivery: { mode: 'none' } })
  const liveRoot = join(fx, 'live-root')
  const retiredWatchdog = ['packages/scheduler/src', 'watchdog.js'].join('/')
  for (const path of ['packages/broker/src/gateway.js', 'packages/scheduler/src/control.js', retiredWatchdog, 'scripts/agentcore-cron.mjs', 'packages/agent-definition/src/definition.js', 'packages/agent-definition/src/index.js']) {
    mkdirSync(dirname(join(liveRoot, path)), { recursive: true }); writeFileSync(join(liveRoot, path), '// OLD live bytes\n')
  }
  writeFileSync(join(liveRoot, 'packages/live-only-legacy.js'), '// live-only\n')
  const cronerTarget = join(liveRoot, 'packages/scheduler/node_modules/croner')
  mkdirSync(dirname(cronerTarget), { recursive: true })
  execFileSync('cp', ['-R', join(repoRoot, 'node_modules/croner'), cronerTarget])
  const shim = join(fx, 'launchctl-shim.mjs')
  writeFileSync(shim, `import { appendFileSync } from 'node:fs'\nconst [op,...rest]=process.argv.slice(2)\nappendFileSync(process.env.SHIM_LOG,op+' '+rest.join(' ')+'\\n')\nif(op==='kickstart')process.stdout.write('{"ok":true}')\n`)
  mkdirSync(join(fx, 'LaunchDaemons'), { recursive: true })
  writeFileSync(join(fx, 'LaunchDaemons', 'ai.agent-core.runtime.plist'), '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>HOME</key><string>/Users/authsvc</string></dict></plist>\n')
  const binDir = join(fx, 'bin'); mkdirSync(binDir, { recursive: true })
  writeFileSync(join(binDir, 'agentcore-cron'), '// OLD sealed bytes\n')
  execFileSync('ln', ['-s', join(binDir, 'agentcore-cron'), join(binDir, 'agentcore-cron-link')])
  Object.assign(ctx, {
    liveRoot, storePath: join(fx, 'jobs.json'), artifacts: fx, artifactsDir: fx,
    controlUid: process.getuid(), controlGid: process.getgid(), controlBoundary: fx,
    launchdDir: join(fx, 'LaunchDaemons'), watchdogStateDir: join(fx, 'watchdog-state'),
    evidenceFile: join(fx, 'evidence', 'reconciliation-evidence.jsonl'), runtimeNode: process.execPath,
    desiredPath: join(fx, 'desired-state.json'), binSymlink: join(binDir, 'agentcore-cron-link'),
    launchctlShim: (op, rest) => execFileSync(process.execPath, [shim, op, rest], { env: { ...process.env, SHIM_LOG: join(fx, 'launchctl-calls.log') } }),
    chown: () => {},
    asAuthsvc: () => JSON.stringify({ jobs: JSON.parse(readFileSync(join(fx, 'jobs.json'), 'utf8')).jobs.map((job) => ({ id: job.id })) }),
    routingManifest: join(fx, 'config', 'scheduler-routing.json'), routingTargetBoundary: '/',
    authsvcUid: process.getuid(), authsvcGid: process.getgid(),
    routingCandidateUid: process.getuid(), routingCandidateGid: process.getgid(),
  })
  const loadedServices = new Set(['system/ai.agent-core.scheduler-watchdog-w1', 'system/ai.agent-core.scheduler-watchdog-w2', 'system/ai.agent-core.runtime'])
  ctx.kickstart = (label) => ctx.launchctlShim('kickstart', label)
  ctx.bootout = (label) => { ctx.launchctlShim('bootout', label); loadedServices.delete(label) }
  ctx.isLoaded = (label) => loadedServices.has(label)
  ctx.bootstrap = (plist, label) => { ctx.launchctlShim('bootstrap', plist); loadedServices.add(label) }
  mkdirSync(join(fx, 'config'), { recursive: true })
  writeFileSync(join(fx, 'config', 'agent-credentials.json'), '{}\n')
  writeFileSync(ctx.routingManifest, `${JSON.stringify({ version: 1, canonicalOpsTarget: { channel: 'feishu', to: 'fixture-ops' }, ownerTargets: {}, jobFailureTargets: {} })}\n`, { mode: 0o640 })
  const routingCandidate = join(fx, 'routing-candidate.json')
  const routingBytes = Buffer.from(`${JSON.stringify({ version: 1, canonicalOpsTarget: { channel: 'feishu', to: 'fixture-ops-v1' }, ownerTargets: {}, jobFailureTargets: {} })}\n`)
  writeFileSync(routingCandidate, routingBytes, { mode: 0o600 })
  Object.assign(ctx, { routingCandidate, routingCandidateSha256: sha256(routingBytes), credentialsProviderPath: join(fx, 'config', 'agent-credentials.json') })
  const legacyStateBytes = Buffer.from('{"active":{},"acknowledged":{},"retired":{}}\n')
  const evidenceBytes = Buffer.alloc(0); const factsBytes = Buffer.from('[]\n')
  const legacyStatePath = join(fx, 'legacy-alert-state.json'), legacyEvidencePath = join(fx, 'legacy-delivery-evidence.jsonl'), factsPath = join(fx, 'migration-facts.json')
  writeFileSync(legacyStatePath, legacyStateBytes, { mode: 0o600 }); writeFileSync(legacyEvidencePath, evidenceBytes, { mode: 0o600 }); writeFileSync(factsPath, factsBytes, { mode: 0o600 })
  ctx.migrationSources = { legacyStatePath, legacyStateSha256: sha256(legacyStateBytes), legacyEvidencePath, legacyEvidenceSha256: sha256(evidenceBytes), factsPath, factsFileSha256: sha256(factsBytes), factsSha256: sha256(Buffer.from('[]')) }
  ctx.gitShow = (commit, path) => git(['show', `${commit}:${path}`], { encoding: 'utf8' })
  ctx.gitHash = (commit, path) => git(['rev-parse', `${commit}:${path}`], { encoding: 'utf8' }).trim()
  await main()
  const ok = (condition, label) => { if (!condition) throw new Error(`selftest FAIL: ${label}`) }
  const desired = JSON.parse(readFileSync(join(fx, 'desired-state.json'), 'utf8'))
  ok(desired.jobs.length === 2 && desired.jobs.every((job) => job.expectedEnabled === true), 'desired criticals')
  ok(JSON.parse(readFileSync(join(fx, 'jobs.json'), 'utf8')).jobs.filter((job) => job.logicalKey !== undefined).length === 2, 'two jobs keyed')
  const calls = readFileSync(join(fx, 'launchctl-calls.log'), 'utf8')
  ok(calls.includes('bootout system/ai.agent-core.runtime') && calls.split('bootstrap').length - 1 === 3, 'runtime and watchdog launchd calls')
  const callLines = calls.trim().split('\n')
  ok(callLines[0] === 'bootout system/ai.agent-core.scheduler-watchdog-w1'
    && callLines[1] === 'bootout system/ai.agent-core.scheduler-watchdog-w2', 'watchdogs quiesced before all mutable phases')
  const deploymentReceipt = JSON.parse(readFileSync(join(fx, 'deployment-phase-receipt.json'), 'utf8'))
  const phaseKeys = Object.keys(deploymentReceipt.phases)
  ok(deploymentReceipt.acceptanceStatus === 'PENDING_CANONICAL_HEALTH_AND_CANARY', 'deployment receipt cannot claim production acceptance')
  ok(phaseKeys.indexOf('watchdog-quiesce') < phaseKeys.indexOf('overlay')
    && phaseKeys.indexOf('watchdog-quiesce') < phaseKeys.indexOf('routing')
    && phaseKeys.indexOf('watchdog-quiesce') < phaseKeys.indexOf('incident-migration'), 'quiesce receipt precedes overlay, routing, and migration')
  ok(readFileSync(join(fx, 'LaunchDaemons', 'ai.agent-core.runtime.plist'), 'utf8').includes('AGENTCORE_EXPECTED_STORE'), 'runtime env')
  ok(existsSync(join(fx, 'watchdog-state', 'incidents.json')) && JSON.parse(readFileSync(join(fx, 'incident-migration-receipt.json'), 'utf8')).status === 'MIGRATED', 'incident migration')
  ok(existsSync(join(fx, 'watchdog-state', 'scheduler-watchdog-evidence.jsonl')), 'watchdog evidence')
  ok((statSync(join(fx, 'evidence')).mode & 0o002) === 0, 'evidence dir private')
  ok(existsSync(join(liveRoot, 'packages/live-only-legacy.js')) && !existsSync(join(liveRoot, retiredWatchdog)), 'overlay deletion scope')
  ok(readFileSync(join(binDir, 'agentcore-cron-link'), 'utf8').length > 1000, 'operator candidate')
  const overlayReceipt = readFileSync(join(fx, 'overlay-manifest.json'), 'utf8')
  const operatorPredecessor = JSON.parse(readFileSync(join(fx, 'operator-cutover-receipt.json'), 'utf8')).previousSha256
  await main()
  ok(readFileSync(join(fx, 'overlay-manifest.json'), 'utf8') === overlayReceipt, 'overlay rerun retains predecessor manifest')
  ok(JSON.parse(readFileSync(join(fx, 'operator-cutover-receipt.json'), 'utf8')).previousSha256 === operatorPredecessor, 'operator rerun retains predecessor')
  ok(JSON.parse(readFileSync(join(fx, 'incident-migration-receipt.json'), 'utf8')).status === 'ALREADY_MIGRATED', 'migration rerun converges')
  process.stdout.write(`[admission selftest] PASS (fixture ${fx})\n`)
}
