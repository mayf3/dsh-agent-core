import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { adaptLiveComposeForWatchdog, narrowOverlayUniverse, WATCHDOG_DELETE_PATHS, WATCHDOG_OVERLAY_PATHS, WATCHDOG_PAYLOAD_SHA } from '../../../../scripts/lib/admission-lib.mjs'

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const LIVE_COMPOSE_FIXTURE = `import { createRouterInvoker, createFeishuDeliver } from '../../scheduler-router/src/index.js'
import { createAgentSessionRuntime } from './agent-session/runtime.js'
// agent-model-overrides.json version 2
const defaultRoute = {
  provider: process.env.DSH_AGENT_PROVIDER ?? 'opencode-go',
}
  const rawInvoker = createRouterInvoker(router, { definition })
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
  const store = new JobStore(layout.jobsStore, { runLogPath: layout.runsLog })
  mountSchedulerSelfServiceRuntime({ ctx, store, router, broker: opts.broker, log })
  return {
    scheduler,
    writeEvidence,
    /** Start the resident scheduler loop (mtime tick + startup catch-up). */
    start: () => scheduler.start({ autoStart: true, catchup }),
  }
`

test('reviewed production path authority is exactly 21 writes plus one retired watchdog delete', () => {
  assert.equal(WATCHDOG_OVERLAY_PATHS.size, 21)
  assert.deepEqual([...WATCHDOG_DELETE_PATHS], ['packages/scheduler/src/watchdog.js'])
  assert.equal([...WATCHDOG_DELETE_PATHS].some((path) => WATCHDOG_OVERLAY_PATHS.has(path)), false)
})

test('reviewed payload contains bounded failed-cutover extension and the dependency-isolated migration entrypoint', () => {
  const show = (path) => execFileSync('git', ['show', `${WATCHDOG_PAYLOAD_SHA}:${path}`], { cwd: repo, encoding: 'utf8' })
  const durableState = show('packages/scheduler/src/watchdog/durable-state.js')
  assert.match(durableState, /MIGRATION_EXTENDED/)
  assert.match(durableState, /drops committed fact identity/)
  assert.match(durableState, /facts: structuredClone\(after\.facts\)/)
  assert.match(durableState, /symptoms: structuredClone\(after\.symptoms\)/)
  assert.match(show('packages/scheduler/src/watchdog/incident-compiler.js'), /canonicalIncidentFactSet/)
  assert.match(show('scripts/scheduler-watchdog.mjs'), /import\('\.\.\/packages\/scheduler\/src\/watchdog\/durable-state\.js'\)/)
})

test('overlay closure pins only an exact reviewed live dependency and updates the rest', () => {
  const target = new Map([
    ['packages/production-runtime/src/compose.js', [
      "import { health } from './scheduler/health-runtime.js'",
      "import { loader } from './model-overrides.js'",
      '',
    ].join('\n')],
    ['packages/production-runtime/src/scheduler/health-runtime.js', 'export const health = "target"\n'],
    ['packages/production-runtime/src/model-overrides.js', 'export const loader = "v2-compatible"\n'],
  ])
  const live = new Map([
    ['packages/production-runtime/src/compose.js', 'old compose\n'],
    ['packages/production-runtime/src/scheduler/health-runtime.js', 'old health\n'],
    ['packages/production-runtime/src/model-overrides.js', 'export const loader = "production-v2"\n'],
  ])

  const modelPath = 'packages/production-runtime/src/model-overrides.js'
  const result = narrowOverlayUniverse({
    seedPaths: ['packages/production-runtime/src/compose.js'],
    readTarget: (path) => {
      if (!target.has(path)) throw new Error(`missing target ${path}`)
      return target.get(path)
    },
    liveHas: (path) => live.has(path),
    liveShaOf: (path) => live.has(path) ? sha256(live.get(path)) : undefined,
    preserveLiveShaByPath: new Map([[modelPath, sha256(live.get(modelPath))]]),
    allowedOverlayPaths: new Set([
      'packages/production-runtime/src/compose.js',
      'packages/production-runtime/src/scheduler/health-runtime.js',
    ]),
  })

  assert.equal(result.refuse, undefined)
  assert.deepEqual([...result.overlay.keys()].sort(), [
    'packages/production-runtime/src/compose.js',
    'packages/production-runtime/src/scheduler/health-runtime.js',
  ])
})

test('production compose adds only watchdog wiring to the exact live Session Trace face', () => {
  const adapted = adaptLiveComposeForWatchdog(LIVE_COMPOSE_FIXTURE)

  assert.match(adapted, /mountConfiguredSchedulerHealthRuntime/)
  assert.match(adapted, /assertSchedulerStartupReady/)
  assert.match(adapted, /createObservedSchedulerInvoker/)
  assert.match(adapted, /createAgentSessionRuntime/)
  assert.match(adapted, /agent-model-overrides\.json version 2/)
  assert.match(adapted, /provider: process\.env\.DSH_AGENT_PROVIDER \?\? 'opencode-go'/)
  assert.doesNotMatch(adapted, /canonicalDefaultGlobalRoute|CANONICAL_DEFAULT_MODEL_ROUTE|mountWorkflowExecutionRuntime/)
})

test('overlay refuses when the separately governed live dependency drifts from its reviewed pin', () => {
  const composePath = 'packages/production-runtime/src/compose.js'
  const modelPath = 'packages/production-runtime/src/model-overrides.js'
  const target = new Map([
    [composePath, "import { loader } from './model-overrides.js'\n"],
    [modelPath, 'export const loader = "v3"\n'],
  ])
  const live = new Map([[modelPath, 'export const loader = "unexpected"\n']])

  const result = narrowOverlayUniverse({
    seedPaths: [composePath],
    readTarget: (path) => target.get(path),
    liveHas: (path) => live.has(path),
    liveShaOf: (path) => live.has(path) ? sha256(live.get(path)) : undefined,
    preserveLiveShaByPath: new Map([[modelPath, sha256('export const loader = "reviewed-v2"\n')]]),
    allowedOverlayPaths: new Set([composePath]),
  })

  assert.equal(result.refuse, `pinned live dependency drift: ${modelPath}`)
})

test('overlay preserves existing dependencies outside the reviewed watchdog path manifest', () => {
  const composePath = 'packages/production-runtime/src/compose.js'
  const unrelatedPath = 'packages/workflow-runtime/src/index.js'
  const target = new Map([
    [composePath, "import { health } from './scheduler/health-runtime.js'\nimport { unrelated } from '../../workflow-runtime/src/index.js'\n"],
    ['packages/production-runtime/src/scheduler/health-runtime.js', 'export const health = true\n'],
    [unrelatedPath, 'export const unrelated = true\n'],
  ])
  const live = new Map([[unrelatedPath, 'export const unrelated = false\n']])
  const result = narrowOverlayUniverse({
    seedPaths: [composePath],
    readTarget: (path) => {
      if (!target.has(path)) throw new Error(`missing target ${path}`)
      return target.get(path)
    },
    liveHas: (path) => live.has(path),
    liveShaOf: (path) => live.has(path) ? sha256(live.get(path)) : undefined,
    allowedOverlayPaths: new Set([composePath, 'packages/production-runtime/src/scheduler/health-runtime.js']),
  })
  assert.equal(result.refuse, undefined)
  assert.deepEqual([...result.overlay.keys()].sort(), [
    composePath,
    'packages/production-runtime/src/scheduler/health-runtime.js',
  ])
})
