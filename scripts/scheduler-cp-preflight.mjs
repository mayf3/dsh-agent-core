#!/usr/bin/env node
/**
 * scheduler-cp-preflight — READ-ONLY fresh-census checks for RUNBOOK §1
 * (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1). Never mutates anything: launchctl
 * print, file stats, one health GET.
 *
 * Modes:
 *   --check              run all checks, text report, exit 1 on any GATE fail
 *   --check --json       machine-readable report (packet evidence)
 *   --gate cli-sha:<sha> additionally enforce the post-apply CLI byte gate
 *                        (RUNBOOK §5 G3 CLI_BYTES_MATCH_EXPECTED); pre-apply
 *                        runs omit this and CLI drift is reported INFO instead
 *   --selftest           pure-parser fixtures (CI-safe)
 *
 * Findings carry severity: GATE (blocks §3), INFO (census fact),
 * EXPECTED (documented pre-apply state — e.g. canonical store DENIED for a
 * non-authsvc operator; the privileged store read is RUNBOOK §1.2's sudo path).
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const JSON_OUT = args.includes('--json')
const SELFTEST = args.includes('--selftest')
const gateArg = args.find((a) => a.startsWith('--gate'))
const GATE_CLI_SHA = gateArg !== undefined ? gateArg.split(':')[1] : undefined

const LIVE_ROOT = '/usr/local/libexec/agent-core/app'
const RUNTIME_LABEL = 'system/ai.agent-core.runtime'
const CLI_SYMLINK = '/usr/local/bin/agentcore-cron'
const CANONICAL_STORE = '/Users/authsvc/.agent-core/scheduler/jobs.json'
const HEALTH_URL = process.env.SCHEDULER_HEALTH_URL ?? 'http://127.0.0.1:8790/health'

const findings = []
const add = (id, severity, ok, detail) => findings.push({ id, severity, status: ok ? 'PASS' : severity, detail })

/** Parse the subset of `launchctl print` output this census needs. Pure. */
export function parseLaunchctlPrint(text) {
  const out = { state: undefined, program: undefined, args: [], env: {} }
  let inArgs = false
  let inEnv = false
  for (const line of text.split('\n')) {
    const state = line.match(/^\s*state = (\w+)/)
    if (state) out.state = state[1]
    const program = line.match(/^\s*program = (.+)$/)
    if (program) out.program = program[1].trim()
    if (/^\s*arguments = \{/.test(line)) { inArgs = true; inEnv = false; continue }
    if (/^\s*environment = \{/.test(line)) { inEnv = true; inArgs = false; continue }
    if (/^\s*\}/.test(line)) { inArgs = false; inEnv = false; continue }
    const argMatch = line.match(/^\s+(\/[^\s]+|-[^\s]+|[^\s]+),?$/)
    if (inArgs && argMatch) out.args.push(argMatch[1].replace(/,$/, ''))
    const envMatch = inEnv && line.match(/^\s+([A-Z_0-9]+) => (.*)$/)
    if (envMatch) out.env[envMatch[1]] = envMatch[2].trim()
  }
  return out
}

/** Parse a raw store document into census facts. Pure. Never mutates. */
export function parseStoreDoc(raw) {
  const doc = JSON.parse(raw)
  const jobs = Array.isArray(doc.jobs) ? doc.jobs : []
  return {
    version: doc.version,
    jobCount: jobs.length,
    keyedCount: jobs.filter((job) => job.logicalKey !== undefined).length,
    enabledCount: jobs.filter((job) => job.enabled === true).length,
  }
}

function sha256(file) {
  return execFileSync('shasum', ['-a', '256', file], { encoding: 'utf8' }).trim().split(/\s+/)[0]
}

function shasumSelftestAssertions() {
  // Fixture: the parsers must read the exact shapes launchd/store emit.
  const lt = parseLaunchctlPrint([
    'system/ai.agent-core.runtime = {',
    '\tstate = running',
    '\tprogram = /usr/local/libexec/agent-core/node-runtime/bin/node',
    '\targuments = {',
    '\t\t/usr/local/libexec/agent-core/node-runtime/bin/node',
    '\t\t/usr/local/libexec/agent-core/app/scripts/production-runtime.mjs',
    '\t\t--root',
    '\t\t/Users/authsvc/.agent-core',
    '\t\t--catchup',
    '\t\t0',
    '\t}',
    '\tenvironment = {',
    '\t\tAGENT_CORE_CREDENTIALS_FILE => /usr/local/libexec/agent-core/config/agent-credentials.json',
    '\t\tHOME => /Users/authsvc',
    '\t}',
    '}',
  ].join('\n'))
  const assert = (cond, label) => { if (!cond) throw new Error(`selftest failed: ${label}`) }
  assert(['running', 'active'].includes(lt.state), 'state')
  assert(lt.args.includes('--catchup') && lt.args.includes('0'), 'args')
  assert(lt.env.AGENT_CORE_CREDENTIALS_FILE !== undefined, 'env')
  const doc = parseStoreDoc('{"version":2,"jobs":[{"id":"a","logicalKey":"k","enabled":true},{"id":"b","enabled":false}]}')
  assert(doc.version === 2 && doc.jobCount === 2 && doc.keyedCount === 1 && doc.enabledCount === 1, 'store doc')
  return 2
}

if (SELFTEST) {
  const n = shasumSelftestAssertions()
  process.stdout.write(`[preflight selftest] PASS (${n} parser fixtures)\n`)
  process.exit(0)
}

// ── P1 runtime (GATE pre- and post-apply) ────────────────────────────────────
try {
  const lt = parseLaunchctlPrint(execFileSync('launchctl', ['print', RUNTIME_LABEL], { encoding: 'utf8' }))
  add('P1-runtime-state', 'GATE', ['running', 'active'].includes(lt.state), `launchd state=${lt.state} (active=running)`)
  add('P1-runtime-root', 'GATE', lt.args.includes('/Users/authsvc/.agent-core'), `--root present (${lt.args.join(' ')})`)
  add('P1-runtime-catchup-off', 'GATE', lt.args.includes('--catchup') && lt.args[lt.args.indexOf('--catchup') + 1] === '0', '--catchup 0')
  add('P1-runtime-credentials', 'GATE', lt.env.AGENT_CORE_CREDENTIALS_FILE !== undefined, 'AGENT_CORE_CREDENTIALS_FILE injected')
} catch (error) {
  add('P1-runtime', 'GATE', false, `launchctl print failed: ${String(error?.message ?? error).slice(0, 120)}`)
}

// ── P2 CLI byte identity (SB4) ───────────────────────────────────────────────
try {
  const target = readFileSync(CLI_SYMLINK, 'utf8') // symlink read
  void target
} catch { /* readFileSync on a symlink follows it; use lstat-ish approach below */ }
try {
  const resolved = execFileSync('readlink', ['-f', CLI_SYMLINK], { encoding: 'utf8' }).trim()
  const sha = sha256(resolved)
  const liveSha = existsSync(join(LIVE_ROOT, 'scripts', 'agentcore-cron.mjs'))
    ? sha256(join(LIVE_ROOT, 'scripts', 'agentcore-cron.mjs'))
    : undefined
  const matchesLive = liveSha !== undefined && sha === liveSha
  const matchesGate = GATE_CLI_SHA !== undefined && sha === GATE_CLI_SHA
  if (GATE_CLI_SHA !== undefined) {
    add('P2-cli-bytes-gate', 'GATE', matchesGate, `resolved=${resolved} sha=${sha.slice(0, 12)}… expected=${GATE_CLI_SHA.slice(0, 12)}…`)
  } else {
    add('P2-cli-bytes', 'INFO', true, `resolved=${resolved} sha=${sha.slice(0, 12)}… ${matchesLive ? '== live app bytes (SB4 pin present)' : '≠ live app bytes (SB4 DRIFT — expected pre-apply, closed by RUNBOOK §3.5)'}`)
  }
  add('P2-cli-resolvable', 'GATE', existsSync(resolved), 'symlink target exists')
} catch (error) {
  add('P2-cli', 'GATE', false, `CLI census failed: ${String(error?.message ?? error).slice(0, 120)}`)
}

// ── P3 canonical store reachability (raw read only) ─────────────────────────
try {
  const raw = readFileSync(CANONICAL_STORE, 'utf8')
  const facts = parseStoreDoc(raw)
  const locks = existsSync(`${CANONICAL_STORE}.lock`)
  add('P3-canonical-store', 'GATE', !locks, `v${facts.version} jobs=${facts.jobCount} keyed=${facts.keyedCount} enabled=${facts.enabledCount} lock=${locks ? 'PRESENT(FAIL)' : 'none'}`)
} catch (error) {
  const denied = /EACCES|permission denied/i.test(String(error?.message ?? error))
  add('P3-canonical-store', denied ? 'EXPECTED' : 'GATE', denied,
    denied ? 'DENIED for this operator — privileged raw read is RUNBOOK §1.2 (owner sudo path)' : `unreadable: ${String(error?.message ?? error).slice(0, 120)}`)
}

// ── P4 non-canonical stores (census facts; DO_NOT_WRITE) ────────────────────
for (const [id, p] of [['P4-user-store', join(homedir(), '.agent-core', 'scheduler', 'jobs.json')], ['P4-scheduler-v2-store', join(homedir(), '.agent-core-scheduler-v2', 'scheduler', 'jobs.json')]]) {
  if (!existsSync(p)) { add(id, 'INFO', true, 'absent'); continue }
  try {
    const facts = parseStoreDoc(readFileSync(p, 'utf8'))
    add(id, 'INFO', true, `jobs=${facts.jobCount} — NON-CANONICAL, DO_NOT_WRITE (S1–S7 surface table)`)
  } catch (error) {
    add(id, 'INFO', true, `present, unreadable (${String(error?.message ?? error).slice(0, 60)}) — NON-CANONICAL, DO_NOT_WRITE`)
  }
}

// ── P5 live app payload presence (post-overlay must all exist) ──────────────
for (const rel of ['packages/broker/src/capabilities/scheduler.js', 'packages/broker/src/readiness.js', 'packages/scheduler/src/watchdog.js', 'scripts/scheduler-watchdog.mjs', 'scripts/agentcore-cron.mjs']) {
  const p = join(LIVE_ROOT, rel)
  add('P5-live-app', 'INFO', existsSync(p), `${rel}${existsSync(p) ? '' : ' (absent — expected before RUNBOOK §3.3 overlay)'}`)
}

// ── P6 runtime health ────────────────────────────────────────────────────────
try {
  const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(5_000) })
  const body = await res.json().catch(() => ({}))
  add('P6-health', 'GATE', res.ok && body?.ok === true, `HTTP ${res.status} ok=${body?.ok}`)
} catch (error) {
  add('P6-health', 'GATE', false, `unreachable: ${String(error?.message ?? error).slice(0, 120)}`)
}

// ── P7 watchdog install state (INFO pre-install, GATE-less) ─────────────────
for (const label of ['system/ai.agent-core.scheduler-watchdog-w1', 'system/ai.agent-core.scheduler-watchdog-w2']) {
  try {
    const text = execFileSync('launchctl', ['print', label], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    add('P7-watchdog', 'INFO', /state = running/.test(text), `${label.split('/').pop()} installed (${/state = (\w+)/.exec(text)?.[1] ?? '?'})`)
  } catch {
    add('P7-watchdog', 'INFO', true, `${label.split('/').pop()} not installed (expected before RUNBOOK §3.7)`)
  }
}

const gateFails = findings.filter((f) => f.severity === 'GATE' && f.status !== 'PASS')
if (JSON_OUT) {
  process.stdout.write(`${JSON.stringify({ gateMode: GATE_CLI_SHA !== undefined, ok: gateFails.length === 0, findings }, null, 2)}\n`)
} else {
  for (const f of findings) {
    process.stdout.write(`[${f.severity.padEnd(8)}] ${f.status.padEnd(4)} ${f.id} — ${f.detail}\n`)
  }
  process.stdout.write(`[preflight] ${gateFails.length === 0 ? 'ALL GATES PASS' : `GATE FAILURES: ${gateFails.length}`}\n`)
}
process.exit(gateFails.length === 0 ? 0 : 1)
