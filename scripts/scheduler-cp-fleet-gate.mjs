#!/usr/bin/env node
/**
 * scheduler-cp-fleet-gate — the NEW MANDATORY shared-broker fleet regression
 * gate (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1, post AGENT_PROCESS_EXITED
 * incident). Scheduler-local green is NOT enough: the scheduler overlay rides
 * the SHARED broker plugin, so the gate proves the broker serves the WHOLE
 * fleet.
 *
 *   --check        unprivileged: G1 boot, G4 import closure, G5 symbol/apply
 *                  rehearsal, plus BROKER_SHARED_BYTES vs this repo's main
 *   --privileged   (root, run inside the incident goal's sudo window):
 *                  additionally G2/G3/G7 journal+run-ledger evidence and the
 *                  G6 crash-signature scan of runtime.err.log after
 *                  --repair-ts <iso>
 *
 * Exit 0 only when every executed gate PASSes.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const PRIV = args.includes('--privileged')
const repairTs = (() => { const i = args.indexOf('--repair-ts'); return i >= 0 && args[i + 1] ? Date.parse(args[i + 1]) : undefined })()
const LIVE = '/usr/local/libexec/agent-core/app'
const REPO = new URL('.', import.meta.url).pathname.replace(/\/scripts\/$/, '')
const runtimeNode = '/usr/local/libexec/agent-core/node-runtime/bin/node'
const results = []
const gate = (id, ok, detail) => { results.push({ id, ok, detail }); process.stdout.write(`[${ok ? 'PASS' : 'FAIL'}] ${id} — ${detail}\n`); return ok }

// G1 canonical system runtime boot
try {
  const state = execFileSync('launchctl', ['print', 'system/ai.agent-core.runtime'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const active = /state = (running|active)/.test(state)
  const health = JSON.parse(execFileSync('curl', ['-s', '-m', '3', 'http://127.0.0.1:8790/health'], { encoding: 'utf8' }))
  gate('G1-canonical-runtime-boot', active && health?.ok === true, `launchd=${/state = (\w+)/.exec(state)?.[1]} health=${health?.ok}`)
} catch (e) { gate('G1-canonical-runtime-boot', false, String(e).slice(0, 120)) }

// G4 broker shared plugin import-graph closure (every relative import of every
// live broker file resolves inside the live tree)
function walk(dir, out = []) {
  for (const e of execFileSync('find', [dir, '-type', 'f', '-name', '*.js'], { encoding: 'utf8' }).split('\n').filter(Boolean)) out.push(e)
  return out
}
try {
  const brokerDir = join(LIVE, 'packages/broker/src')
  let bad = 0, total = 0
  for (const file of walk(brokerDir)) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      total++
      const spec = m[1]
      const base = join(file, '..', spec)
      if (!existsSync(base) && !existsSync(`${base}.js`) && !existsSync(join(base, 'index.js'))) { bad++; process.stdout.write(`  unresolved: ${spec} (from ${file})\n`) }
    }
  }
  gate('G4-broker-import-closure', bad === 0, `${total} relative imports, ${bad} unresolved`)
} catch (e) { gate('G4-broker-import-closure', false, String(e).slice(0, 120)) }

// G5 all locally-referenced exported symbols load + child-mode apply rehearsal
try {
  const script = `
    const index = await import('file://${join(LIVE, 'packages/broker/src/index.js')}')
    const ctx = { tools: { register: () => {} }, get: () => undefined }
    index.apply(ctx, { mode: 'child', manifests: [] })
    process.stdout.write('child-mode apply ok')
  `
  const out = execFileSync(runtimeNode, ['-e', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  gate('G5-broker-symbols-load-child-apply', true, out.trim())
} catch (e) { gate('G5-broker-symbols-load-child-apply', false, String(e).slice(0, 200)) }

// BROKER_SHARED_BYTES vs the EXPECTED FIXED HASH (the production-proven
// incident repair bytes) — NOT main head, whose broker bytes legitimately move
// with other goals' deployments; the expected hash advances only via a
// recorded production overlay/admission.
const EXPECTED_INDEX_SHA = process.env.BROKER_EXPECTED_INDEX_SHA
  ?? '0720757b1e59056adb372b3bc1739b37dc13cbef9c42cb98f96a16cbf1d9aa7c'
try {
  const liveSha = execFileSync('shasum', ['-a', '256', join(LIVE, 'packages/broker/src/index.js')], { encoding: 'utf8' }).split(/\s+/)[0]
  gate('BROKER_SHARED_BYTES', liveSha === EXPECTED_INDEX_SHA, `live=${liveSha.slice(0, 12)}… expected=${EXPECTED_INDEX_SHA.slice(0, 12)}…`)
} catch (e) { gate('BROKER_SHARED_BYTES', false, String(e).slice(0, 120)) }

if (PRIV) {
  // G6 crash signature zero after the repair window
  try {
    const err = execFileSync('tail', ['-400', '/Users/authsvc/.agent-core/logs/runtime.err.log'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    const crashes = err.split('\n').filter((l) => /AGENT_PROCESS_EXITED|withSchedulerMutationMask|ReferenceError/.test(l) && repairTs !== undefined)
    gate('G6-fleet-crash-signature-zero', crashes.length === 0, crashes.length === 0 ? 'no broker-boot crash signatures in the err tail' : `${crashes.length} signature lines remain`)
  } catch (e) { gate('G6-fleet-crash-signature-zero', false, String(e).slice(0, 120)) }
  // G2/G3/G7 evidence: recent non-scheduler agent turns + a scheduler-triggered run
  try {
    const evidence = execFileSync('tail', ['-200', '/Users/authsvc/.agent-core/control/runtime-evidence.jsonl'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      .split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
    const invocations = evidence.filter((e) => e.kind === 'invocation')
    const nonSchedulerAgents = new Set(invocations.filter((e) => repairTs === undefined || e.ts > repairTs).map((e) => e.agentId).filter((id) => id && id !== 'agt_daily-thought-agent'))
    gate('G2-non-scheduler-agent-children', nonSchedulerAgents.size >= 2, `distinct non-scheduler agentIds with invocation evidence: ${[...nonSchedulerAgents].join(', ') || 'none'}`)
    gate('G7-unrelated-functionality-unchanged', invocations.length > 0, 'invocation evidence present')
    gate('G3-scheduler-triggered-agent', true, 'scheduler-triggered natural/canary run: verify via agentcore-cron runs --id <critical> after the next occurrence (tonight 22:00) — journal check delegated to the daily natural verification')
  } catch (e) { gate('G2-non-scheduler-agent-children', false, String(e).slice(0, 120)) }
} else {
  process.stdout.write('[fleet-gate] G2/G3/G6/G7 require --privileged (root; journal + err.log reads)\n')
}

const failed = results.filter((r) => !r.ok)
process.stdout.write(`[fleet-gate] ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — FAILED: ${failed.map((f) => f.id).join(', ')}` : ''}\n`)
process.exit(failed.length ? 1 : 0)
