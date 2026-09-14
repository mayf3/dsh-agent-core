#!/usr/bin/env node
/**
 * scheduler-cp-rollback — RUNBOOK §4 preimage restore (root, one sudo).
 * Order: capture failure evidence FIRST -> restore plist preimage -> restore
 * overlay preimage (25 updated files) -> flip operator back to the previous
 * sealed generation -> kickstart -> health wait -> verdict. Watchdogs stay
 * installed (they are the alerting surface, not part of the failure).
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, rmSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

const A = '/Users/yanfenma/workspace/artifacts/production-candidates/SCHEDULER_CONTROL_PLANE_RELIABILITY_V1-admission'
const LIVE = '/usr/local/libexec/agent-core/app'
const say = (m) => process.stdout.write(`[rollback] ${m}\n`)
const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'], ...opts })
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
function restoreFile(preimage, target, expectedCurrentSha) {
  if (!existsSync(target) || sha256(target) !== expectedCurrentSha) throw new Error(`rollback generation mismatch: ${target}`)
  const current = statSync(target)
  const tmp = `${target}.rollback-${process.pid}`
  writeFileSync(tmp, readFileSync(preimage), { mode: 0o600, flag: 'wx' })
  run('chown', [`${current.uid}:${current.gid}`, tmp]); run('chmod', [(current.mode & 0o7777).toString(8), tmp])
  renameSync(tmp, target)
}

// 0. evidence capture (read-only) — the boot failure's own words
try {
  const err = run('tail', ['-80', '/Users/authsvc/.agent-core/logs/runtime.err.log'], { encoding: 'utf8' })
  writeFileSync(join(A, 'boot-failure-runtime-err.tail'), err)
  say(`failure evidence captured (${err.split('\n').length} lines) -> boot-failure-runtime-err.tail`)
} catch (e) { say(`evidence capture failed (continuing): ${String(e).slice(0, 120)}`) }

// 1. plist preimage restore
const plistPre = join(A, 'rollback', 'ai.agent-core.runtime.plist.preimage')
if (existsSync(plistPre)) {
  const runtimePlist = '/Library/LaunchDaemons/ai.agent-core.runtime.plist'
  const deployedSha = JSON.parse(readFileSync(join(A, 'terminal-receipt.json'), 'utf8')).sourceSha
  if (!readFileSync(runtimePlist, 'utf8').includes(`<key>AGENT_CORE_DEPLOYED_SHA</key><string>${deployedSha}</string>`)) throw new Error('runtime plist generation advanced; refusing stale rollback')
  run('launchctl', ['bootout', 'system/ai.agent-core.runtime'])
  restoreFile(plistPre, runtimePlist, sha256(runtimePlist))
  run('launchctl', ['bootstrap', 'system', runtimePlist])
  say('plist preimage restored')
} else say('WARN: plist preimage missing — plist NOT restored')

// 1b. watchdog plist and protected routing preimages.
const watchdogReceipt = JSON.parse(readFileSync(join(A, 'watchdog-install-receipt.json'), 'utf8'))
for (const item of watchdogReceipt.plists) {
  if (!existsSync(item.path) || sha256(item.path) !== item.installedSha256) throw new Error(`watchdog plist generation advanced: ${item.label}`)
  run('launchctl', ['bootout', `system/${item.label}`])
  if (item.existed) {
    restoreFile(item.preimage, item.path, item.installedSha256)
    run('launchctl', ['bootstrap', 'system', item.path])
  }
  else rmSync(item.path)
}
const routingReceipt = JSON.parse(readFileSync(join(A, 'rollback', 'routing-install-receipt.json'), 'utf8'))
const routingTarget = '/usr/local/libexec/agent-core/config/scheduler-routing.json'
if (!existsSync(routingTarget) || sha256(routingTarget) !== routingReceipt.candidateSha256) throw new Error('routing generation advanced; refusing stale rollback')
if (routingReceipt.preimageSha256 === null) rmSync(routingTarget)
else restoreFile(join(A, 'rollback', 'scheduler-routing.json.preimage'), routingTarget, routingReceipt.candidateSha256)
say('watchdog plists and routing generation restored')

// 2. remove deployed additions, then restore every updated/deleted preimage.
const overlayManifest = join(A, 'overlay-manifest.json')
if (existsSync(overlayManifest)) {
  const manifest = JSON.parse(readFileSync(overlayManifest, 'utf8'))
  for (const entry of manifest.entries ?? []) {
    const path = join(LIVE, entry.path)
    if ((entry.kind === 'delete' && existsSync(path)) || (entry.kind !== 'delete' && (!existsSync(path) || sha256(path) !== entry.sha))) {
      throw new Error(`overlay generation advanced: ${entry.path}`)
    }
  }
  for (const entry of manifest.entries ?? []) if (entry.kind === 'add') rmSync(join(LIVE, entry.path), { force: true })
  say('overlay additions removed from exact manifest')
}
const tar = join(A, 'rollback', 'overlay-preimage.tar.gz')
if (existsSync(tar)) {
  run('tar', ['-xzf', tar, '-C', LIVE])
  if (existsSync(overlayManifest)) for (const entry of JSON.parse(readFileSync(overlayManifest, 'utf8')).entries ?? []) {
    if (entry.preimageSha && sha256(join(LIVE, entry.path)) !== entry.preimageSha) throw new Error(`overlay preimage readback mismatch: ${entry.path}`)
  }
  say(`overlay preimage restored from ${tar}`)
} else say('WARN: overlay preimage missing — app tree NOT restored')

// 3. operator flip back to the previous sealed generation
const receipt = JSON.parse(readFileSync(join(A, 'operator-cutover-receipt.json'), 'utf8'))
if (sha256('/usr/local/bin/agentcore-cron') !== receipt.newSha256) throw new Error('operator generation advanced; refusing stale rollback')
const tmp = '/usr/local/bin/agentcore-cron.incoming-rollback'
execFileSync('ln', ['-sfn', receipt.previousLink, tmp])
execFileSync('mv', ['-f', tmp, '/usr/local/bin/agentcore-cron'])
say(`operator flipped back -> ${receipt.previousLink} (sha ${receipt.previousSha256.slice(0, 12)}…)`)

// 4. restart + health
let healthy = false
for (let i = 0; i < 30; i++) {
  try {
    const res = JSON.parse(run('curl', ['-s', '-m', '3', 'http://127.0.0.1:8790/health'], { encoding: 'utf8' }))
    if (res?.ok === true) { healthy = true; break }
  } catch { /* retry */ }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000)
}
say(`health=${healthy ? 'ok — SERVICE RESTORED' : 'STILL DOWN — escalate: check runtime.err.log'}`)
process.exit(healthy ? 0 : 1)
