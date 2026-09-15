import { createHash } from 'node:crypto'

export const WATCHDOG_PAYLOAD_SHA = 'b9686f958b5bf4ed30d5e882498d0142df72661e'
export const WATCHDOG_OVERLAY_PATHS = new Set([
  'packages/product-api/src/index.js',
  'packages/product-api/src/scheduler-health-routes.js',
  'packages/production-runtime/src/compose.js',
  'packages/production-runtime/src/entry.js',
  'packages/production-runtime/src/paths.js',
  'packages/production-runtime/src/scheduler-invoker.js',
  'packages/production-runtime/src/scheduler/deployment-canary-control.js',
  'packages/production-runtime/src/scheduler/health-runtime.js',
  'packages/production-runtime/src/scheduler/self-service-runtime.js',
  'packages/scheduler/src/index.js',
  'packages/scheduler/src/self-ops/index.js',
  'packages/scheduler/src/watchdog/delivery.js',
  'packages/scheduler/src/watchdog/durable-state.js',
  'packages/scheduler/src/watchdog/health.js',
  'packages/scheduler/src/watchdog/incident-compiler.js',
  'packages/scheduler/src/watchdog/incident-lifecycle.js',
  'packages/scheduler/src/watchdog/index.js',
  'packages/scheduler/src/watchdog/private-state-io.js',
  'packages/scheduler/src/watchdog/reconciliation.js',
  'packages/scheduler/src/watchdog/routing.js',
  'scripts/scheduler-watchdog.mjs',
])
export const WATCHDOG_LIVE_ADAPTER_SHA = new Map([
  ['packages/product-api/src/index.js', 'f49cbbba4e79d73c52353891cc1c8701e27b3252a6e9758982a727cddd07ca05'],
  ['packages/production-runtime/src/compose.js', 'e1cbcc41f04e9abc40b17956a124e3fd6295d25d4613d5294260b38d8bb343df'],
  ['packages/production-runtime/src/entry.js', 'ca48020c68a5241b0748d675747d7465f02544ddf37337bb849f3648e2fc6b0a'],
  ['packages/production-runtime/src/paths.js', 'e99add385746fe81bf1e9f7c35f6a5eeadf93604cbf0d8c83a4d3e13889a5e91'],
  ['packages/production-runtime/src/scheduler/self-service-runtime.js', 'c18887e4f9630210cd7e450c96c2f13679be90fa0287380394642d3c57ce3cae'],
  ['packages/scheduler/src/index.js', '34b470c7b1f35f0f361b42848a90f330d5dd9cd6b7aa5611c91e9bedc0f336a3'],
  ['packages/scheduler/src/self-ops/index.js', '0cd886e7a7e7ee518a769fdfb3ea01dc9cf931d66bf291988e1f3eadee6d2015'],
])
export const WATCHDOG_LIVE_ADAPTER_POST_SHA = new Map([
  ['packages/product-api/src/index.js', 'a23e7b7ef3c70884050686c928bb4a4d0a576209bf9f6404dad17f1a67062bfe'],
  ['packages/production-runtime/src/compose.js', '697c7fda901b7fbefc08f5b66e0af94425bc957f349263c5f33531b46575e614'],
  ['packages/production-runtime/src/entry.js', '5c52329df4449cc1205d7dbea7555671c856b69a304d22e157b8733ec4a57070'],
  ['packages/production-runtime/src/paths.js', 'e5131350cd8d1c654e0ed5d6db5c1ee82f3d68561355807133d4e2f43768fa79'],
  ['packages/production-runtime/src/scheduler/self-service-runtime.js', 'acfde749a7c2c9201cc6270c4829c1267ce94d995b5610f39a64da64d2101df0'],
  ['packages/scheduler/src/index.js', '9ded6900d6f60b1f50c04a5327a5d1b4dd92b31ca7816f34707198a3432c705d'],
  ['packages/scheduler/src/self-ops/index.js', 'd253d34b538aae7911afe001e74240ace806bcff894c3910b34470f435494590'],
])

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
  const candidates = /\.(?:[cm]?js|json)$/.test(joined)
    ? [joined]
    : [joined, `${joined}.js`, joinPath(joined, 'index.js')]
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
 * (RUNBOOK §3.2 + Owner directive). AMENDMENT (post-census, evidence-based):
 * the live store holds TWO enabled agt_daily-thought-agent cron jobs at
 * 0 22 * * * Asia/Shanghai (fa13b0ea '每日摘要检查-滚动7天 raw/distilled 补生成'
 * and 579c54a4 '每日随想总结-DeepSeek'), so the attribute predicate is
 * ambiguous by reality. Both criticals are therefore anchored on the FROZEN
 * recovery-ledger identities (exact id prefixes — the admission guard's
 * FAILED_NO_MUTATION on ambiguity is what surfaced this):
 *   daily-summary : id startsWith 'fa13b0ea' (DAILY_RAW_DISTILLED_SUMMARY_
 *                   RECOVERY_V1 terminal receipt job; rev1, raw/distilled semantics)
 *   hr-dispatch   : id startsWith 'b115cb96' (WORKFLOW_GLOBAL_READ_RECOVERY
 *                   Lane-A restore receipt; SEM/PAYLOAD digest frozen)
 * Returns { daily, hr } each = {match:'unique'|'none'|'ambiguous', jobs:[…]}.
 */
export function matchCriticalJobs(jobs) {
  const list = Array.isArray(jobs) ? jobs : []
  const daily = list.filter((job) => typeof job.id === 'string' && job.id.startsWith('fa13b0ea'))
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

/**
 * 2026-09-09 fleet-boot regression audit: `export { X } from 'm'` does NOT
 * bind X locally — if the module body also CALLS X, that call is a
 * ReferenceError at runtime (killed every agent child in child mode while the
 * parent gateway branch stayed healthy). Returns re-exported names lacking a
 * local import/declaration. Pure.
 */
export function reExportsWithoutLocalBinding(source) {
  const missing = []
  const reExport = /export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g
  let m
  while ((m = reExport.exec(source)) !== null) {
    const names = m[1].split(',').map((part) => part.trim().split(/\s+as\s+/).pop()).filter(Boolean)
    for (const name of names) {
      const localImport = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]${m[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(source)
      const localDecl = new RegExp(`\\b(?:function|const|let|var|class)\\s+${name}\\b`).test(source)
      if (!localImport && !localDecl) missing.push({ name, from: m[2] })
    }
  }
  return missing
}

/** Exact reviewed production closure universe. Seeds remain the goal diff;
 * relative imports may cross package boundaries so a reviewed runtime is never
 * paired with stale dependency bytes. Tests/docs stay excluded. */
export function inOverlayUniverse(repoPath) {
  if (SCRIPT_ALLOWLIST.has(repoPath)) return true
  // This acceptance fixture is a static import of the production broker index
  // and is registered only behind explicit config; its bytes remain required
  // for module-load closure even though other fixture trees stay excluded.
  if (repoPath === 'packages/broker/src/fixtures/self-assert.js') return true
  if (!repoPath.startsWith('packages/')) return false
  if (repoPath.includes('/test/') || repoPath.endsWith('.test.js')) return false
  if (repoPath.includes('/fixtures/')) return false
  if (repoPath.endsWith('.md')) return false
  return true
}

function replaceExactlyOnce(source, before, after, label) {
  const first = source.indexOf(before)
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) throw new Error(`${label} drift`)
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`
}

/** Add only accepted Watchdog wiring to the exact live Session Trace production face. */
export function adaptLiveComposeForWatchdog(live) {
  let result = replaceExactlyOnce(live,
    "import { createRouterInvoker, createFeishuDeliver } from '../../scheduler-router/src/index.js'\n",
    "import { createFeishuDeliver } from '../../scheduler-router/src/index.js'\nimport { createObservedSchedulerInvoker } from './scheduler-invoker.js'\nimport { assertSchedulerStartupReady, mountConfiguredSchedulerHealthRuntime } from './scheduler/health-runtime.js'\n",
    'live compose scheduler imports')
  result = replaceExactlyOnce(result,
    `  const rawInvoker = createRouterInvoker(router, { definition })
  // Thin observability (evidence surface, not a framework): one line per
  // invocation with the router process state — same pattern the resident used.
  const invoker = async (request) => {
    const started = Date.now()
    const outcome = await rawInvoker(request)
    const proc = router.registrySnapshot().find((p) => p.agentId === request.agentId)
    writeEvidence({
      kind: 'invocation',
      pid: process.pid,
      agentId: request.agentId,
      sessionId: request.sessionId,
      status: outcome.status,
      summary: outcome.status === 'ok' ? (outcome.summary ?? null) : null,
      error: outcome.status === 'ok' ? null : (outcome.error ?? null),
      reconciliationHandle: outcome.reconciliationHandle ?? null,
      deadlineAtWallMs: outcome.deadlineAtWallMs ?? null,
      evidence: outcome.evidence ?? null,
      durationMs: Date.now() - started,
      routerProcessPid: proc?.pid ?? null,
      routerProcessAlive: proc?.alive ?? null,
    })
    return outcome
  }
  // Preserve Scheduler V2's synchronous runnable-Agent admission gate through
  // the observability wrapper; no job/store/deploy behavior is changed here.
  invoker.assertRunnable = rawInvoker.assertRunnable
`,
    `  const invoker = createObservedSchedulerInvoker({
    router,
    definition,
    writeEvidence,
    runtimeGeneration: opts.runtimeGeneration ?? process.env.AGENT_CORE_DEPLOYED_SHA,
  })
`,
    'live compose invoker block')
  result = replaceExactlyOnce(result,
    '  const store = new JobStore(layout.jobsStore, { runLogPath: layout.runsLog })\n',
    '  const store = new JobStore(layout.jobsStore, { runLogPath: layout.runsLog })\n  const schedulerHealth = mountConfiguredSchedulerHealthRuntime({ ctx, layout, opts })\n',
    'live compose store mount')
  result = replaceExactlyOnce(result,
    '  mountSchedulerSelfServiceRuntime({ ctx, store, router, broker: opts.broker, log })\n',
    '  mountSchedulerSelfServiceRuntime({ ctx, store, router, broker: opts.broker, log, healthProvider: () => schedulerHealth.read() })\n',
    'live compose self-service mount')
  result = replaceExactlyOnce(result,
    '    scheduler,\n    writeEvidence,\n    /** Start the resident scheduler loop (mtime tick + startup catch-up). */\n    start: () => scheduler.start({ autoStart: true, catchup }),\n',
    `    scheduler,
    schedulerHealth,
    writeEvidence,
    /** Start only after the canonical Watchdog health authority is readable. */
    start: async () => {
      if (opts.schedulerReadinessRequired === true) assertSchedulerStartupReady(await schedulerHealth.read())
      await scheduler.start({ autoStart: true, catchup })
    },
`,
    'live compose return/start block')
  return result
}

/** Apply the accepted Watchdog hunks to exact pinned live integration files. */
export function adaptLiveIntegrationForWatchdog(path, live) {
  if (path === 'packages/production-runtime/src/compose.js') return adaptLiveComposeForWatchdog(live)
  if (path === 'packages/product-api/src/index.js') {
    let result = replaceExactlyOnce(live,
      "import z from '@deepseek-ai/schemastery'\n",
      "import z from '@deepseek-ai/schemastery'\nimport { handleSchedulerHealthRequest } from './scheduler-health-routes.js'\n",
      'live product API health import')
    result = replaceExactlyOnce(result,
      "      if (['GET', 'POST'].includes(req.method ?? '')) {\n",
      `      if (url.pathname === '/scheduler/health') {
        try {
          const { status, body } = await handleSchedulerHealthRequest({
            req,
            url,
            health: ctx.get('schedulerHealth') ?? null,
            verifier: ctx.get('schedulerTokenVerifier') ?? null,
          })
          json(res, status, body)
        } catch (error) {
          json(res, error?.status ?? 500, errorBody(error?.code ?? 'internal', error?.message ?? 'internal error'))
        }
        return
      }
      if (['GET', 'POST'].includes(req.method ?? '')) {
`,
      'live product API health route')
    return result
  }
  if (path === 'packages/production-runtime/src/entry.js') {
    return replaceExactlyOnce(live,
      '  const runtime = await composeProductionRuntime({ layout, tickMs, concurrency, catchup, log })\n',
      '  const runtime = await composeProductionRuntime({ layout, tickMs, concurrency, catchup, log, schedulerReadinessRequired: true })\n',
      'live entry readiness')
  }
  if (path === 'packages/production-runtime/src/paths.js') {
    return replaceExactlyOnce(live,
      "    runsLog: join(root, 'scheduler', 'runs.jsonl'),\n",
      "    runsLog: join(root, 'scheduler', 'runs.jsonl'),\n    schedulerRoutingManifest: resolve(process.env.SCHEDULER_ROUTING_MANIFEST ?? join(root, 'scheduler', 'routing.json')),\n    schedulerIncidentState: join(root, 'control', 'scheduler-watchdog', 'incidents.json'),\n    schedulerLocalOpsSink: join(root, 'control', 'scheduler-watchdog', 'local-ops.jsonl'),\n",
      'live production paths')
  }
  if (path === 'packages/production-runtime/src/scheduler/self-service-runtime.js') {
    let result = replaceExactlyOnce(live,
      'export function mountSchedulerSelfServiceRuntime({ ctx, store, router, broker = {}, log }) {',
      'export function mountSchedulerSelfServiceRuntime({ ctx, store, router, broker = {}, log, healthProvider }) {',
      'live self-service health parameter')
    result = replaceExactlyOnce(result,
      '    runtimeStatus: () => router.reconciliationRuntimeStatus(),\n',
      '    runtimeStatus: () => router.reconciliationRuntimeStatus(),\n    healthProvider,\n',
      'live self-service health provider')
    return result
  }
  if (path === 'packages/scheduler/src/index.js') {
    return replaceExactlyOnce(live,
      "} from './history.js'\n",
      `} from './history.js'
export * from './watchdog/incident-compiler.js'
export * from './watchdog/incident-lifecycle.js'
export * from './watchdog/routing.js'
export * from './watchdog/reconciliation.js'
export * from './watchdog/health.js'
export * from './watchdog/durable-state.js'
export * from './watchdog/delivery.js'
`,
      'live scheduler watchdog exports')
  }
  if (path === 'packages/scheduler/src/self-ops/index.js') {
    let result = replaceExactlyOnce(live,
      "import { deriveJobStateSummary } from '../eligibility.js'\n",
      "import { deriveJobStateSummary } from '../eligibility.js'\nimport { classifyReconciliationEvidence } from '../watchdog/reconciliation.js'\nimport { filterHealthForPrincipal } from '../watchdog/health.js'\n",
      'live self-ops watchdog imports')
    result = replaceExactlyOnce(result,
      '  onAuditFailure = () => {},\n}) {',
      '  onAuditFailure = () => {},\n  healthProvider,\n}) {',
      'live self-ops health parameter')
    result = replaceExactlyOnce(result,
      `      }), record, callerAgentId)
      rows.push({
`,
      `      }), record, callerAgentId)
      const epoch = requestIdFor(record)
      const identity = { jobId: record.jobId, occurrenceId: record.occurrenceId, runId: record.runId, epoch }
      const reconciliationObservedAt = clock()
      const exact = (value) => ({ trusted: true, fresh: true, source: 'router-current-readback', ...identity, observedAt: reconciliationObservedAt, ...value })
      const evidence = classified.disposition === 'late_completed' ? { identity, businessOutcome: exact({ status: 'succeeded' }) }
        : classified.disposition === 'late_failed' ? { identity, businessOutcome: exact({ status: 'failed' }) }
          : classified.disposition === 'terminated_without_outcome' ? { identity, termination: exact({ terminated: true }) }
            : classified.disposition === 'pending' ? { identity, live: exact({ live: true }) }
              : { identity }
      const reconciliation = classifyReconciliationEvidence(evidence, { nowMs: reconciliationObservedAt })
      rows.push({
`,
      'live self-ops reconciliation classification')
    result = replaceExactlyOnce(result,
      `        blockerCode: classified.disposition === 'terminated_without_outcome'
          ? 'safe_reconcile_available'
          : classified.disposition,
`,
      `        blockerCode: classified.disposition === 'terminated_without_outcome'
          ? 'safe_reconcile_available'
          : classified.disposition,
        reconciliationState: reconciliation.classification ?? 'TERMINATION_ONLY_SETTLEMENT_AVAILABLE',
        reconciliationObservedAt: evidence.businessOutcome?.observedAt ?? evidence.termination?.observedAt ?? evidence.live?.observedAt ?? null,
`,
      'live self-ops reconciliation output')
    result = replaceExactlyOnce(result,
      '    const runtime = runtimeStatus()\n    return {\n',
      "    const runtime = runtimeStatus()\n    const canonicalHealth = typeof healthProvider === 'function'\n      ? filterHealthForPrincipal(await healthProvider(), { agentId: callerAgentId, scopes: new Set(['scheduler.read']) })\n      : undefined\n    return {\n",
      'live self-ops canonical health')
    result = replaceExactlyOnce(result,
      '        truncated: rows.length > 20,\n      },\n',
      '        truncated: rows.length > 20,\n      },\n      ...(canonicalHealth ? { health: canonicalHealth } : {}),\n',
      'live self-ops health output')
    return result
  }
  return null
}

export function buildOverlaySeedBytes(seedPaths, readTarget, readLive) {
  return new Map(seedPaths.map((path) => {
    const target = readTarget(path)
    const live = WATCHDOG_LIVE_ADAPTER_SHA.has(path) ? readLive(path) : null
    const adapted = live === null ? null : sha256Bytes(live) === WATCHDOG_LIVE_ADAPTER_POST_SHA.get(path) ? live : adaptLiveIntegrationForWatchdog(path, live)
    return [path, adapted ?? target]
  }))
}

/**
 * Fixpoint narrow overlay: seed = exact goal files; grow through relative
 * imports whose target bytes differ from live. A separately governed live
 * dependency may be retained only by an exact reviewed SHA pin; pin drift
 * refuses the overlay. Universe-external imports are tolerated when live
 * serves them; unresolvable everywhere -> {refuse}. Pure.
 */
export function narrowOverlayUniverse({ seedPaths, readTarget, liveHas, liveShaOf, preserveLiveShaByPath = new Map(), allowedOverlayPaths }) {
  const overlay = new Map()
  const queue = [...seedPaths]
  while (queue.length > 0) {
    const path = queue.shift()
    if (overlay.has(path)) continue
    let bytes
    try { bytes = readTarget(path) } catch { return { refuse: `target missing: ${path}` } }
    overlay.set(path, bytes)
    const dir = path.split('/').slice(0, -1).join('/')
    for (const spec of relativeImports(String(bytes))) {
      if (!spec.startsWith('.')) continue
      let resolved = null
      let dependencyBytes
      for (const candidate of resolveRelative(dir, spec)) {
        try { dependencyBytes = readTarget(candidate); resolved = candidate; break } catch { /* next shape */ }
      }
      if (resolved === null) {
        if (liveHas(resolveRelative(dir, spec)[0])) continue
        return { refuse: `import '${spec}' of ${path} resolves nowhere in target or live` }
      }
      if (!inOverlayUniverse(resolved)) {
        if (liveHas(resolved)) continue
        return { refuse: `import '${spec}' of ${path} reaches excluded tree ${resolved} AND live does not serve it` }
      }
      const pinnedLiveSha = preserveLiveShaByPath.get(resolved)
      if (pinnedLiveSha !== undefined) {
        if (liveShaOf(resolved) !== pinnedLiveSha) return { refuse: `pinned live dependency drift: ${resolved}` }
        continue
      }
      if (allowedOverlayPaths instanceof Set && !allowedOverlayPaths.has(resolved)) {
        if (!liveHas(resolved)) return { refuse: `unreviewed dependency missing from live: ${resolved}` }
        continue
      }
      if (liveShaOf(resolved) !== sha256Bytes(dependencyBytes)) queue.push(resolved)
    }
  }
  return { overlay }
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}
