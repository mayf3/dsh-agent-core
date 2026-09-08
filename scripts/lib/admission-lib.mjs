/**
 * scheduler-cp-admission helper library — PURE functions only
 * (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 production admission, RUNBOOK §3).
 *
 * Everything here is deterministic and unit-testable against fixtures: no fs,
 * no processes, no clocks beyond injected arguments. The orchestrator
 * (scripts/scheduler-cp-admission.mjs) owns git-show staging, files, launchd,
 * receipts, and the sudo/root context.
 */

/** Walk one ESM module's static relative imports (export * / from / dynamic import()). Pure. */
export function relativeImports(source) {
  const imports = []
  const re = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](\.[^'"]+)['"]/g
  let m
  while ((m = re.exec(source)) !== null) imports.push(m[1])
  return imports
}

/** Resolve a relative import against a repo-relative dir to a repo path with .js candidates. Pure. */
export function resolveRelative(fromDir, spec) {
  const joined = normalize(joinPath(fromDir, spec))
  const candidates = [joined, `${joined}.js`, joinPath(joined, 'index.js')]
  return candidates
}

function joinPath(a, b) {
  const stack = a.split('/')
  for (const part of b.split('/')) {
    if (part === '.' || part === '') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return stack.join('/')
}

function normalize(p) { return p.replace(/\/\//g, '/') }

/**
 * Compute the CLI dependency closure for the sealed operator generation:
 * seed = scripts/agentcore-cron.mjs; walk relative imports; every resolved
 * repo file enters `usr/local/…` at the same repo-relative path. Returns
 * { repoPath -> purpose } sorted. `readSource(repoPath)` must return the file
 * bytes (the orchestrator injects git-show so the worktree state is
 * irrelevant by construction).
 */
export function computeOperatorClosure(seed, readSource) {
  const closure = new Map([[seed, 'seed']])
  const queue = [seed]
  while (queue.length > 0) {
    const current = queue.shift()
    const dir = current.split('/').slice(0, -1).join('/')
    let source
    try {
      source = readSource(current)
    } catch {
      closure.set(current, 'UNRESOLVABLE')
      continue
    }
    for (const spec of relativeImports(source)) {
      if (spec.startsWith('.')) {
        for (const candidate of resolveRelative(dir, spec)) {
          if (closure.has(candidate)) continue
          let found = false
          try { readSource(candidate); found = true } catch { found = false }
          if (found) {
            closure.set(candidate, 'closure')
            queue.push(candidate)
            break
          }
        }
      }
      // bare specifiers (node:*, croner) resolve from the runner's own
      // node_modules — outside the sealed candidate, matching the previous
      // generation's DEPENDENCY_CLOSURE behavior.
    }
  }
  return Object.fromEntries([...closure.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

/**
 * Match the two directive-named critical jobs in a canonical census
 * (RUNBOOK §3.2 + Owner directive). Exact predicates — never name guessing:
 *   daily-summary : agentId=agt_daily-thought-agent AND enabled AND
 *                   schedule.kind=cron AND schedule.expr='0 22 * * *' AND tz Asia/Shanghai
 *   hr-dispatch   : job id starts with 'b115cb96' (frozen from the recovery
 *                   ledger SEM/PAYLOAD-digest enable receipt)
 * Returns { daily, hr } each = {match:'unique'|'none'|'ambiguous', jobs:[…]}.
 */
export function matchCriticalJobs(jobs) {
  const list = Array.isArray(jobs) ? jobs : []
  const daily = list.filter((job) =>
    job.agentId === 'agt_daily-thought-agent'
    && job.enabled === true
    && job.schedule?.kind === 'cron'
    && job.schedule?.expr === '0 22 * * *'
    && (job.schedule?.tz ?? '') === 'Asia/Shanghai')
  const hr = list.filter((job) => typeof job.id === 'string' && job.id.startsWith('b115cb96'))
  const wrap = (matches) => ({ match: matches.length === 1 ? 'unique' : matches.length === 0 ? 'none' : 'ambiguous', jobs: matches })
  return { daily: wrap(daily), hr: wrap(hr) }
}

/**
 * Freeze desired-state (as-found baseline) for the matched criticals +
 * propose their logicalKeys. Pure. Message bodies NEVER enter the output.
 */
export function buildDesiredState(matched, { nowMs = Date.now() } = {}) {
  const jobs = []
  if (matched.daily.match === 'unique') {
    const job = matched.daily.jobs[0]
    jobs.push({
      logicalKey: 'agt_daily-thought-agent:daily-raw-distilled-summary-check',
      expectedEnabled: true,
      expectedSchedule: { kind: 'cron', expr: job.schedule.expr, tz: job.schedule.tz },
      expectedAgentId: job.agentId,
      runPolicy: { graceMinutes: 30, maxConsecutiveFailures: 2 },
    })
  }
  if (matched.hr.match === 'unique') {
    const job = matched.hr.jobs[0]
    jobs.push({
      logicalKey: 'agt_hr-agent:hr-workflow-auto-dispatch',
      expectedEnabled: true,
      expectedSchedule: job.schedule.kind === 'cron'
        ? { kind: 'cron', expr: job.schedule.expr, tz: job.schedule.tz ?? 'Asia/Shanghai' }
        : job.schedule.kind === 'at'
          ? { kind: 'at', at: job.schedule.at }
          : { kind: 'every', everyMs: job.schedule.everyMs },
      expectedAgentId: job.agentId,
      runPolicy: { graceMinutes: 30, maxConsecutiveFailures: 2 },
    })
  }
  return { version: 1, jobs, _frozenAt: new Date(nowMs).toISOString() }
}

/** Backfill mapping for the matched criticals (jobId -> logicalKey). Pure. */
export function buildBackfillMapping(matched) {
  const mapping = []
  if (matched.daily.match === 'unique') mapping.push({ jobId: matched.daily.jobs[0].id, logicalKey: 'agt_daily-thought-agent:daily-raw-distilled-summary-check' })
  if (matched.hr.match === 'unique') mapping.push({ jobId: matched.hr.jobs[0].id, logicalKey: 'agt_hr-agent:hr-workflow-auto-dispatch' })
  return mapping
}

/**
 * Census classification (evidence-based, per Owner directive): classify jobs
 * NOT by name alone — by the decision table over {criticalMatch, enabled,
 * agentId, deleteAfterRun, lastStatus}. CRITICAL_PRODUCTION only for the
 * directive-named matches. UNKNOWN stays OUT of the critical inventory.
 */
export function classifyCensus(jobs, matched) {
  const criticalIds = new Set([
    ...(matched.daily.match === 'unique' ? [matched.daily.jobs[0].id] : []),
    ...(matched.hr.match === 'unique' ? [matched.hr.jobs[0].id] : []),
  ])
  return (Array.isArray(jobs) ? jobs : []).map((job) => {
    let classification
    if (criticalIds.has(job.id)) classification = 'CRITICAL_PRODUCTION'
    else if (job.enabled === false) classification = /canary|test|tmp|scratch/i.test(job.name ?? '') ? 'TEST/CANARY' : 'DISABLED_INTENTIONAL'
    else if (job.agentId === 'agt_daily-thought-agent' || job.agentId === 'agt_hr-agent') classification = 'NORMAL_PRODUCTION'
    else if (job.deleteAfterRun === true) classification = job.state?.lastRunAtMs !== undefined ? 'LEGACY' : 'TEST/CANARY'
    else classification = 'UNKNOWN'
    return { jobId: job.id, logicalKey: job.logicalKey ?? null, agentId: job.agentId, enabled: job.enabled === true, schedule: job.schedule?.kind, classification }
  })
}

/**
 * Overlay plan: given `liveFiles` (Set of repo-relative paths present in the
 * live app tree, restricted to the deployment scope) and `targetFiles` (same
 * universe at SOURCE_SHA with their sha256), plus a `shaOfLive(path)`
 * accessor, produce the minimal consistent overlay: every target file that is
 * absent from live or byte-differs. Deletions are NEVER planned. Pure.
 */
export function planOverlay(targetFiles, liveFiles, shaOfLive) {
  const plan = { update: [], add: [] }
  const entries = targetFiles instanceof Map ? [...targetFiles.entries()] : Object.entries(targetFiles)
  for (const [path, sha] of entries) {
    if (!liveFiles.has(path)) plan.add.push({ path, sha })
    else if (shaOfLive(path) !== sha) plan.update.push({ path, sha })
  }
  return plan
}

/** The scripts/ allowlist: production-entry scripts only — never the ~100 repo
 *  verify/acceptance drivers. Pure. */
export const SCRIPT_ALLOWLIST = new Set([
  'scripts/agentcore-cron.mjs',
  'scripts/scheduler-watchdog.mjs',
  'scripts/production-runtime.mjs',
  'scripts/agent-core-resident.mjs',
  'scripts/openclaw-job-import.mjs',
])

/** Sanity gate on the overlay scope: packages/** production payload only
 *  (NO test trees, NO markdown docs) + allowlisted production scripts. Pure. */
export function inDeploymentScope(repoPath) {
  if (SCRIPT_ALLOWLIST.has(repoPath)) return true
  if (!repoPath.startsWith('packages/')) return false
  if (repoPath.includes('/test/') || repoPath.endsWith('.test.js') || repoPath.includes('/fixtures/')) return false
  if (repoPath.endsWith('.md')) return false
  return true
}
