#!/usr/bin/env node
/**
 * scheduler-cp-rollback — RUNBOOK §4 preimage restore (root, one sudo).
 * Order: capture failure evidence FIRST -> restore plist preimage -> restore
 * overlay preimage (25 updated files) -> flip operator back to the previous
 * sealed generation -> kickstart -> health wait -> verdict. Watchdogs stay
 * installed (they are the alerting surface, not part of the failure).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const A = '/Users/yanfenma/workspace/artifacts/production-candidates/SCHEDULER_CONTROL_PLANE_RELIABILITY_V1-admission'
const LIVE = '/usr/local/libexec/agent-core/app'
const say = (m) => process.stdout.write(`[rollback] ${m}\n`)
const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'], ...opts })

// 0. evidence capture (read-only) — the boot failure's own words
try {
  const err = run('tail', ['-80', '/Users/authsvc/.agent-core/logs/runtime.err.log'], { encoding: 'utf8' })
  writeFileSync(join(A, 'boot-failure-runtime-err.tail'), err)
  say(`failure evidence captured (${err.split('\n').length} lines) -> boot-failure-runtime-err.tail`)
} catch (e) { say(`evidence capture failed (continuing): ${String(e).slice(0, 120)}`) }

// 1. plist preimage restore
const plistPre = join(A, 'rollback', 'ai.agent-core.runtime.plist.preimage')
if (existsSync(plistPre)) {
  copyFileSync(plistPre, '/Library/LaunchDaemons/ai.agent-core.runtime.plist')
  say('plist preimage restored')
} else say('WARN: plist preimage missing — plist NOT restored')

// 2. overlay preimage restore (the 25 updated files' old bytes)
const tar = join(A, 'rollback', 'overlay-preimage.tar.gz')
if (existsSync(tar)) {
  run('tar', ['-xzf', tar, '-C', LIVE])
  say(`overlay preimage restored from ${tar}`)
} else say('WARN: overlay preimage missing — app tree NOT restored')

// 3. operator flip back to the previous sealed generation
const receipt = JSON.parse(readFileSync('/Users/yanfenma/workspace/artifacts/production-candidates/SCHEDULER_CONTROL_PLANE_RELIABILITY_V1--dsh-agent-core--db93649--x86_64--g1/cutover-receipt.json', 'utf8'))
const tmp = '/usr/local/bin/agentcore-cron.incoming-rollback'
execFileSync('ln', ['-sfn', receipt.previousLink, tmp])
execFileSync('mv', ['-f', tmp, '/usr/local/bin/agentcore-cron'])
say(`operator flipped back -> ${receipt.previousLink} (sha ${receipt.previousSha256.slice(0, 12)}…)`)

// 4. restart + health
run('launchctl', ['kickstart', '-k', 'system/ai.agent-core.runtime'])
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
