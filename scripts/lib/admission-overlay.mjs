import { createHash } from 'node:crypto'

import { relativeImports, resolveRelative, inOverlayUniverse } from './admission-lib.mjs'

/**
 * Watchdog overlay machinery: live-integration adaptation, seed staging, and
 * the fixpoint overlay-universe narrow. Split from admission-lib.mjs (binding
 * structure gate B2) with zero semantic change — this module owns everything
 * that touches live-tree bytes; admission-lib keeps the pure census/planning
 * primitives. One-way dependency (overlay -> lib) by design.
 */

export const WATCHDOG_PINNED_LIVE_DEPENDENCIES = new Map([
  ['packages/production-runtime/src/model-overrides.js', '4df9f741e1c550d377a29a81ba08f32d8986c19384e8239570738e565858898d'],
])
export const WATCHDOG_LIVE_ADAPTER_SHA = new Map([
  ['packages/product-api/src/index.js', 'f49cbbba4e79d73c52353891cc1c8701e27b3252a6e9758982a727cddd07ca05'],
  ['packages/production-runtime/src/compose.js', '678374d753fec151614c4e1ab5cae6e340527a55a10640178b151b9074392ae7'],
  ['packages/production-runtime/src/entry.js', 'ca48020c68a5241b0748d675747d7465f02544ddf37337bb849f3648e2fc6b0a'],
  ['packages/production-runtime/src/paths.js', 'e99add385746fe81bf1e9f7c35f6a5eeadf93604cbf0d8c83a4d3e13889a5e91'],
  ['packages/production-runtime/src/scheduler/self-service-runtime.js', 'c18887e4f9630210cd7e450c96c2f13679be90fa0287380394642d3c57ce3cae'],
  ['packages/scheduler/src/index.js', '34b470c7b1f35f0f361b42848a90f330d5dd9cd6b7aa5611c91e9bedc0f336a3'],
  ['packages/scheduler/src/self-ops/index.js', '0cd886e7a7e7ee518a769fdfb3ea01dc9cf931d66bf291988e1f3eadee6d2015'],
])
export const WATCHDOG_LIVE_ADAPTER_POST_SHA = new Map([
  ['packages/product-api/src/index.js', 'a23e7b7ef3c70884050686c928bb4a4d0a576209bf9f6404dad17f1a67062bfe'],
  ['packages/production-runtime/src/compose.js', '17e4aedd43053286c4bcead61b18da4bec6bbaccda2bdd99860963a711a3c3d0'],
  ['packages/production-runtime/src/entry.js', '5c52329df4449cc1205d7dbea7555671c856b69a304d22e157b8733ec4a57070'],
  ['packages/production-runtime/src/paths.js', 'e5131350cd8d1c654e0ed5d6db5c1ee82f3d68561355807133d4e2f43768fa79'],
  ['packages/production-runtime/src/scheduler/self-service-runtime.js', 'acfde749a7c2c9201cc6270c4829c1267ce94d995b5610f39a64da64d2101df0'],
  ['packages/scheduler/src/index.js', '9ded6900d6f60b1f50c04a5327a5d1b4dd92b31ca7816f34707198a3432c705d'],
  ['packages/scheduler/src/self-ops/index.js', 'd253d34b538aae7911afe001e74240ace806bcff894c3910b34470f435494590'],
])

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
