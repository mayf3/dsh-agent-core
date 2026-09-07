#!/usr/bin/env node
/**
 * OPENCLAW_SCHEDULER_CALLER_MIGRATION_V1 — verification driver.
 *
 * Proves, with fixtures / safe test targets, that the three ACTIVE OpenClaw
 * cron callers have been migrated to Agent Core Scheduler:
 *
 *   - forum-scheduler.sh           (~/.openclaw/cron/scripts/forum-scheduler.sh)
 *   - unified-dispatcher.py        (~/.openclaw/groups/.../cron-domain-scheduler/scripts/)
 *   - check-dispatch-health.py     (same dir)
 *
 * Gates:
 *   FORUM_STOCK_MEMBERSHIP            — real scan-scope membership of stock-agent
 *   WORKFLOW_DISPATCH_WRITES_AGENTCORE
 *   WORKFLOW_NO_LONGER_WRITES_OPENCLAW
 *   FORUM_SCHEDULER_WRITES_AGENTCORE
 *   FORUM_NO_LONGER_WRITES_OPENCLAW
 *   EXISTING_OPENCLAW_JOBS_UNCHANGED
 *
 * Safety: every cron write goes to a throwaway AGENTCORE_SCHEDULER_STORE under
 * a temp sandbox; `openclaw` on PATH is replaced by a recording stub that fails
 * loudly, so any residual OpenClaw call is both detected and harmless; the live
 * ~/.openclaw/cron/jobs.json is only ever READ (md5 + stock-agent inventory).
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const HOME = process.env.HOME
const LIVE_JOBS = join(HOME, '.openclaw', 'cron', 'jobs.json')
const FORUM_SH = join(HOME, '.openclaw', 'cron', 'scripts', 'forum-scheduler.sh')
const DSCRIPTS = join(HOME, '.openclaw', 'groups',
  'workspace-oc_648db8f3df0ef0249b761ebb0b7a56ab', 'skills', 'cron-domain-scheduler', 'scripts')
const UNIFIED = join(DSCRIPTS, 'unified-dispatcher.py')
const HEALTH = join(DSCRIPTS, 'check-dispatch-health.py')
const DOMAINS_YAML = join(HOME, '.openclaw', 'groups',
  'workspace-oc_ddee1a74b160d0fd81d0bacb5dad7fd4', 'candidate-skills', 'skills',
  'cron-domain-scheduler', 'references', 'domains.yaml')
const OPENCLAW_CFG = join(HOME, '.openclaw', 'openclaw.json')

const sandbox = mkdtempSync(join(tmpdir(), 'scm-v1-'))
const fakeBin = join(sandbox, 'bin')
const openclawLog = join(sandbox, 'openclaw-calls.log')
mkdirSync(fakeBin)

const results = {}
const failures = []

function gate(name, ok, detail) {
  results[name] = ok ? 'PASS' : 'FAIL'
  if (!ok) failures.push(`${name}: ${detail}`)
  console.log(`${ok ? '✅' : '❌'} ${name} = ${ok ? 'PASS' : 'FAIL'}${detail ? `  (${detail})` : ''}`)
}

// ── tools ──────────────────────────────────────────────────────────────────
const md5 = (p) => execFileSync('md5', ['-q', p], { encoding: 'utf8' }).trim()

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts })
  return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '' }
}

function runPython(code, env) {
  return run('python3', ['-'], { input: code, env })
}

function baseEnv(extra = {}) {
  return {
    ...process.env,
    PATH: `${fakeBin}:${process.env.PATH}`,
    OPENCLAW_STUB_LOG: openclawLog,
    ...extra,
  }
}

// ── fixtures ───────────────────────────────────────────────────────────────
// 1. openclaw recording stub: any residual call is recorded + fails loudly.
writeFileSync(openclawLog, '')
writeFileSync(join(fakeBin, 'openclaw'), `#!/usr/bin/env bash
echo "OPENCLAW_CALLED: $*" >> "\${OPENCLAW_STUB_LOG:?}"
echo "openclaw is stubbed out during scheduler-caller-migration verification (exit 127)" >&2
exit 127
`)
execFileSync('chmod', ['+x', join(fakeBin, 'openclaw')])

// 2. fake forum-access.mjs: deterministic unread counts (read-only query seam).
const forumAccessStub = join(sandbox, 'forum-access.mjs')
writeFileSync(forumAccessStub, `#!/usr/bin/env node
// fixture: my-notifications --limit 1 -> always 2 unread
console.log(JSON.stringify({ total: 2, items: [] }))
`)
execFileSync('chmod', ['+x', [forumAccessStub]])

// 3. fixture cron stores.
const wfStore = join(sandbox, 'workflow-jobs.json')
const forumStore = join(sandbox, 'forum-jobs.json')
const forumState = join(sandbox, 'forum-state.json')

// ── baseline: live OpenClaw jobs.json must not change ─────────────────────
const liveMd5Before = md5(LIVE_JOBS)
function stockInventory() {
  const py = `
import json
from pathlib import Path
data = json.loads(Path(${JSON.stringify(LIVE_JOBS)}).read_text())
jobs = data if isinstance(data, list) else data.get('jobs', [])
out = []
for j in jobs:
    if j.get('agentId') == 'stock-agent':
        out.append((j.get('id'), j.get('enabled')))
print(json.dumps(sorted(out)))
`
  return JSON.parse(execFileSync('python3', ['-'], { input: py, encoding: 'utf8' }))
}
const stockBefore = stockInventory()
console.log(`\n[sandbox] ${sandbox}`)
console.log(`[baseline] live jobs.json md5=${liveMd5Before} stock-agent jobs=${stockBefore.length} (${stockBefore.filter(([, e]) => e).length} enabled)`)

// ── GATE: FORUM_STOCK_MEMBERSHIP (real scan scope, read-only) ──────────────
{
  const py = `
import json, sys, yaml
domains_path, cfg_path = sys.argv[1], sys.argv[2]
declared = set()
with open(domains_path) as f:
    doc = yaml.safe_load(f)
for dom in (doc or {}).get('domains', []) or []:
    for a in dom.get('agents', []) or []:
        cd = a.get('credential_delivery') or {}
        if cd.get('forum') == 'broker':
            declared.add(a.get('agent_id'))
clients = set()
with open(cfg_path) as f:
    cfg = json.load(f)
plugin = None
pl = cfg.get('plugins') or {}
if isinstance(pl, dict):
    cand = []
    if isinstance(pl.get('entries'), dict):
        cand.append(pl['entries'].get('openclaw-auth-broker'))
    cand.append(pl.get('openclaw-auth-broker'))
    for p in cand:
        if isinstance(p, dict):
            if isinstance(p.get('config'), dict):
                p = p['config']
            if isinstance(p.get('agentClients'), dict):
                plugin = p
                break
clients = set((plugin or {}).get('agentClients') or {})
scope = sorted(declared & clients)
print(f"SCOPE={len(scope)}")
print(f"STOCK_IN_SCOPE={'stock-agent' in scope}")
print(f"STOCK_DECLARED={'stock-agent' in declared}")
`
  const r = run('python3', ['-', DOMAINS_YAML, OPENCLAW_CFG], { input: py, env: baseEnv() })
  const scopeLine = r.out.split('\n').find((l) => l.startsWith('SCOPE=')) || ''
  const stockLine = r.out.split('\n').find((l) => l.startsWith('STOCK_IN_SCOPE=')) || ''
  const declaredLine = r.out.split('\n').find((l) => l.startsWith('STOCK_DECLARED=')) || ''
  const inScope = stockLine.includes('True')
  const declared = declaredLine.includes('True')
  gate('FORUM_STOCK_MEMBERSHIP', !inScope, `scope=${scopeLine.split('=')[1] ?? '?'} agents; stock-agent declared=${declared} -> membership=${inScope ? 'YES' : 'NO'}`)
}

// ── WORKFLOW battery ───────────────────────────────────────────────────────
console.log('\n── WORKFLOW battery ──')
{
  const env = baseEnv({ AGENTCORE_SCHEDULER_STORE: wfStore })
  const py = `
import importlib.util, json, os, sys
spec = importlib.util.spec_from_file_location('unified_dispatcher', ${JSON.stringify(UNIFIED)})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

# 1) real dispatch path: trigger_agent_immediate (the path main() uses)
ok1, msg1 = mod.trigger_agent_immediate('migration-fixture-agent-01')
print(f'TRIGGER1_OK={ok1} MSG1={msg1}')

# 2) legacy alias path: trigger_agent
ok2, msg2 = mod.trigger_agent('migration-fixture-agent-02')
print(f'TRIGGER2_OK={ok2} MSG2={msg2}')

# 3) dedup reads the AGENTCORE store (30-min window) -> must skip
ok3, msg3 = mod.trigger_agent_immediate('migration-fixture-agent-01')
print(f'TRIGGER3_OK={ok3} MSG3={msg3}')

# 4) store content
jobs = mod.get_cron_jobs()
print(f'STORE_JOBS={len(jobs)}')
for j in sorted(jobs, key=lambda x: x.get('name', '')):
    print(f'JOB name={j.get("name")} agent={j.get("agentId")} kind={(j.get("schedule") or {}).get("kind")} dar={j.get("deleteAfterRun")} enabled={j.get("enabled")}')
`
  const r = runPython(py, env)
  console.log(r.out.trim())
  if (r.code !== 0) gate('WORKFLOW_DISPATCH_WRITES_AGENTCORE', false, `python harness rc=${r.code} ${r.err.slice(0, 300)}`)

  const jobsLine = r.out.split('\n').find((l) => l.startsWith('STORE_JOBS='))
  const t1 = r.out.split('\n').find((l) => l.startsWith('TRIGGER1_OK='))
  const t2 = r.out.split('\n').find((l) => l.startsWith('TRIGGER2_OK='))
  const t3 = r.out.split('\n').find((l) => l.startsWith('TRIGGER3_OK='))
  const jobs = r.out.split('\n').filter((l) => l.startsWith('JOB '))
  const storeCount = jobsLine ? Number(jobsLine.split('=')[1]) : -1
  const dispatchJobs = jobs.filter((l) => l.includes('workflow-dispatch') && /kind=at\b/.test(l) && /dar=True\b/.test(l) && /enabled=True\b/.test(l))
  const dedupSkipped = t3 ? (t3.includes('recently dispatched') || t3.includes('already running')) : false
  gate('WORKFLOW_DISPATCH_WRITES_AGENTCORE',
    t1?.includes('OK=True') && t2?.includes('OK=True') && storeCount >= 2 && dispatchJobs.length >= 2,
    `trigger_agent_immediate=${t1 ?? '?'}; trigger_agent=${t2 ?? '?'}; store jobs=${storeCount}; dispatch jobs in agentcore store=${dispatchJobs.length}; dedup(2nd call)=${t3 ?? '?'}`)

  // check-dispatch-health.py: trigger path + --fix cleanup path
  const healthPy = `
import importlib.util, json
spec = importlib.util.spec_from_file_location('check_dispatch_health', ${JSON.stringify(HEALTH)})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
ok, detail = mod.trigger_agent('migration-fixture-agent-03')
print(f'HEALTH_TRIGGER_OK={ok} DETAIL={detail}')
jobs = mod.get_cron_jobs()
print(f'HEALTH_STORE_JOBS={len(jobs)}')
`
  const hr = runPython(healthPy, env)
  console.log(hr.out.trim())
  const ht = hr.out.split('\n').find((l) => l.startsWith('HEALTH_TRIGGER_OK='))
  const hs = hr.out.split('\n').find((l) => l.startsWith('HEALTH_STORE_JOBS='))
  gate('WORKFLOW_DISPATCH_WRITES_AGENTCORE', results['WORKFLOW_DISPATCH_WRITES_AGENTCORE'] === 'PASS' && ht?.includes('OK=True') && Number(hs?.split('=')[1] ?? 0) >= 3,
    `+ check-dispatch-health.trigger_agent=${ht ?? '?'}; store jobs=${hs ?? '?'}`)

  // --fix dead-job cleanup: seed one disabled + one enabled dispatch job
  const seedStore = join(sandbox, 'health-seed-jobs.json')
  const envH = baseEnv({ AGENTCORE_SCHEDULER_STORE: seedStore })
  run('agentcore-cron', ['add', '--agent', 'fixture-a', '--name', 'workflow-dispatch-dead-1', '--at', '15m', '--message', 'x', '--no-deliver'], { env: envH })
  const deadId = JSON.parse(run('agentcore-cron', ['list', '--json'], { env: envH }).out).jobs[0].id
  run('agentcore-cron', ['disable', deadId], { env: envH })
  run('agentcore-cron', ['add', '--agent', 'fixture-b', '--name', 'workflow-dispatch-alive-1', '--at', '30m', '--message', 'x', '--no-deliver'], { env: envH })
  const cfg = join(sandbox, 'health-config.yaml')
  writeFileSync(cfg, 'domains: []\nowner_agent_ids: []\n')
  const fixR = run('python3', [HEALTH, '--fix', '--config', cfg], { env: envH })
  console.log(`[health --fix] rc=${fixR.code} ${fixR.out.trim().split('\n').slice(-4).join(' | ')}`)
  const after = JSON.parse(run('agentcore-cron', ['list', '--json'], { env: envH }).out).jobs
  const deadGone = !after.some((j) => j.id === deadId)
  const aliveKept = after.some((j) => j.name === 'workflow-dispatch-alive-1' && j.enabled)
  gate('WORKFLOW_DISPATCH_WRITES_AGENTCORE', results['WORKFLOW_DISPATCH_WRITES_AGENTCORE'] === 'PASS' && fixR.code === 0 && deadGone && aliveKept,
    `+ health --fix cleanup: dead=${deadGone ? 'removed' : 'STILL PRESENT'}, alive=${aliveKept ? 'kept' : 'LOST'}`)

  // real end-to-end smoke: main() against live svc-workflow, writes to fixture store only
  const smokeR = run('python3', [UNIFIED, '--json'], { env })
  const smokeOk = smokeR.code === 0
  console.log(`[unified-dispatcher main() smoke] rc=${smokeR.code} ${smokeR.out.trim().split('\n').slice(-2).join(' | ')}`)
  gate('WORKFLOW_DISPATCH_WRITES_AGENTCORE', results['WORKFLOW_DISPATCH_WRITES_AGENTCORE'] === 'PASS' && smokeOk,
    `+ main() real run rc=${smokeR.code} (writes confined to fixture store)`)

  const calls = readFileSync(openclawLog, 'utf8').trim()
  gate('WORKFLOW_NO_LONGER_WRITES_OPENCLAW', calls === '',
    calls ? `openclaw was invoked: ${calls}` : 'zero openclaw invocations during the whole workflow battery')
}

// ── FORUM battery ──────────────────────────────────────────────────────────
console.log('\n── FORUM battery ──')
{
  // seed one disabled forum-notification job (cleanup must remove it via agentcore-cron rm)
  const envF = baseEnv({ AGENTCORE_SCHEDULER_STORE: forumStore })
  run('agentcore-cron', ['add', '--agent', 'fixture-forum-a', '--name', '论坛通知触发 - fixture-forum-a', '--at', '15m', '--message', 'x', '--no-deliver'], { env: envF })
  const seedDead = JSON.parse(run('agentcore-cron', ['list', '--json'], { env: envF }).out).jobs[0].id
  run('agentcore-cron', ['disable', seedDead], { env: envF })

  const env = baseEnv({
    AGENTCORE_SCHEDULER_STORE: forumStore,
    AGENTCORE_CRON: '/usr/local/bin/agentcore-cron',
    FORUM_ACCESS: forumAccessStub,
    FORUM_SCHEDULER_STATE_FILE: forumState,
  })
  const r = run('bash', [FORUM_SH], { env })
  const out = r.out
  console.log(out.split('\n').filter((l) => /\[CLEANUP\]|\[TRIGGERED\]|\[SETUP\]|Summary|\[ERROR\]|\[SCAN-ERR\]/.test(l)).slice(0, 40).join('\n'))
  console.log(`[forum run] rc=${r.code} stderr_tail=${r.err.trim().split('\n').slice(-3).join(' | ')}`)

  const jobs = JSON.parse(run('agentcore-cron', ['list', '--json'], { env: envF }).out).jobs
  const forumJobs = jobs.filter((j) => j.name.startsWith('论坛通知触发'))
  const seededGone = !jobs.some((j) => j.id === seedDead)
  const hasTriggered = forumJobs.some((j) => j.enabled)
  const stateHasPending = (() => {
    try { return Object.keys(JSON.parse(readFileSync(forumState, 'utf8'))).length > 0 } catch { return false }
  })()
  gate('FORUM_SCHEDULER_WRITES_AGENTCORE',
    r.code === 0 && hasTriggered && seededGone,
    `rc=${r.code}; agentcore forum jobs=${forumJobs.length} (enabled=${forumJobs.filter((j) => j.enabled).length}); seeded dead job ${seededGone ? 'removed' : 'STILL PRESENT'}; state pending=${stateHasPending}`)

  const calls = readFileSync(openclawLog, 'utf8').trim()
  gate('FORUM_NO_LONGER_WRITES_OPENCLAW', calls === '',
    calls ? `openclaw was invoked: ${calls}` : 'zero openclaw invocations during the whole forum battery')
}

// ── EXISTING_OPENCLAW_JOBS_UNCHANGED ───────────────────────────────────────
console.log('\n── OpenClaw store integrity ──')
{
  const liveMd5After = md5(LIVE_JOBS)
  const stockAfter = stockInventory()
  const sameMd5 = liveMd5Before === liveMd5After
  const sameStock = JSON.stringify(stockBefore) === JSON.stringify(stockAfter)
  const calls = readFileSync(openclawLog, 'utf8').trim()
  gate('EXISTING_OPENCLAW_JOBS_UNCHANGED',
    sameMd5 && sameStock && calls === '',
    `md5 ${sameMd5 ? 'unchanged' : `CHANGED ${liveMd5Before} -> ${liveMd5After}`}; stock-agent inventory ${sameStock ? 'unchanged' : 'CHANGED'}; openclaw invocations=${calls ? calls : 0}`)
}

// ── static regression: no executable `openclaw cron` refs in the 3 scripts ──
{
  const scan = (file, patterns, ignoreComment = false) => {
    const lines = readFileSync(file, 'utf8').split('\n')
    return lines
      .map((l, i) => ({ n: i + 1, line: l }))
      .filter(({ line }) => {
        if (ignoreComment && /^\s*#/.test(line)) return false
        return patterns.some((p) => p.test(line))
      })
  }
  const cronPattern = [/openclaw cron (add|list|runs|rm|enable|disable)/]
  const argvPattern = [/'openclaw', 'cron'/]
  const bashResidual = scan(FORUM_SH, cronPattern, true)
  const pyResidual = [...scan(UNIFIED, argvPattern), ...scan(HEALTH, argvPattern)]
  // the ONLY permitted residual: read-only config.get RPC fallback in unified-dispatcher.py
  const configGet = scan(UNIFIED, [/'openclaw', 'gateway', 'call', 'config\.get'/])
  const other = [...bashResidual, ...pyResidual]
  gate('STOCK_CUTOVER_CRON_WRITERS', other.length === 0,
    other.length ? `residual openclaw cron refs: ${other.map((h) => `${h.n}:${h.line.trim()}`).join('; ')}` : `all 3 callers clean; only read-only config.get fallback remains (${configGet.length} ref)`)
  console.log(`[static] executable openclaw cron refs: ${other.length} | config.get fallback (read-only, documented): ${configGet.length}`)
}

console.log('\n──────────────────────────────────────────────')
console.log('RESULT SUMMARY')
for (const [k, v] of Object.entries(results)) console.log(`${k} = ${v}`)
console.log(`\nsandbox (evidence): ${sandbox}`)
if (failures.length) {
  console.error('\nFAILURES:')
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('\nALL GATES PASS')
