/**
 * @agent-core/production-runtime/src/entry.js — the Production Runtime
 * resident entry (PRODUCTION_RUNTIME_V1, Task 4/5 entry half).
 *
 * One process, one job: keep the composed Agent Core online. The Scheduler
 * engine consumes jobs written by EXTERNAL callers (`agentcore-cron add` /
 * any JobStore.mutate writer on the production store) and executes them
 * through the existing chain; the Notification Ingress accepts HTTP
 * deliveries; the Product API serves the mobile surface. Crash recovery is
 * the supervision unit's job (launchd KeepAlive — see
 * scripts/production-runtime-launchd.mjs); THIS process only handles
 * graceful SIGTERM/SIGINT and leaves persistent state intact for the next
 * boot (startup catch-up replays at-jobs that came due while down).
 *
 * Usage (via scripts/production-runtime.mjs):
 *   node scripts/production-runtime.mjs [--root <dir>] [--tick-ms N]
 *       [--concurrency N] [--catchup 0|1]
 *
 * Env (all optional; see compose.js for the full list):
 *   PRODUCTION_RUNTIME_ROOT   persistent root (default ~/.agent-core)
 *   FEISHU_CREDS_PATH         feishu credentials (channel OFF without it)
 *   FEISHU_REQUIRE_MENTION_IN_GROUP    'true'|'false' only (default true);
 *                             invalid values fail startup loud
 *   FEISHU_AUTO_MENTION_TRIGGER_SENDER 'true'|'false' only (default true);
 *                             invalid values fail startup loud
 *   FEISHU_PROCESSING_REACTION_ENABLED 'true'|'false' only (unset/empty =
 *                             false, the connector default); any other value
 *                             fails startup loud
 *                             (FEISHU_PROCESSING_REACTION_INVALID)
 *   DSH_AGENT_PROVIDER / DSH_AGENT_MODEL   model route for spawned agents
 *   AGENT_CORE_CREDENTIALS_FILE / BROKER_AUTH_ORIGIN   Trusted CP seam
 *
 * Evidence: one JSON line per lifecycle/admission event appended to
 * <root>/control/runtime-evidence.jsonl.
 */

import { resolveProductionLayout } from './paths.js'
import { composeProductionRuntime } from './compose.js'

function argValue(args, name, fallback) {
  const idx = args.indexOf(name)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}

/**
 * Run the Production Runtime resident until SIGTERM/SIGINT.
 * @param {string[]} [argv] - CLI args (default process.argv.slice(2)).
 * @param {object} [processLike] - process stand-in (tests); default process.
 */
export async function runProductionRuntime(argv = process.argv.slice(2), processLike = process) {
  const root = argValue(argv, '--root', undefined)
  const layout = resolveProductionLayout(root)
  const tickMs = Number(argValue(argv, '--tick-ms', '500'))
  const concurrency = Number(argValue(argv, '--concurrency', '2'))
  const catchup = argValue(argv, '--catchup', '1') !== '0'

  const log = {
    log: (...a) => processLike.stdout.write(`[production-runtime] ${a.join(' ')}\n`),
    warn: (...a) => processLike.stdout.write(`[production-runtime] WARN ${a.join(' ')}\n`),
    error: (...a) => processLike.stderr.write(`[production-runtime] ERROR ${a.join(' ')}\n`),
  }

  log.log(`root=${layout.root} tickMs=${tickMs} concurrency=${concurrency} catchup=${catchup}`)

  const runtime = await composeProductionRuntime({ layout, tickMs, concurrency, catchup, log })
  await runtime.start()
  runtime.writeEvidence({
    kind: 'ready',
    pid: processLike.pid,
    root: layout.root,
    tickMs,
    defaultAgentId: runtime.definition.getDefaultAgent()?.id,
    agentProfile: runtime.agentProfile,
  })
  log.log(`production runtime ready (pid ${processLike.pid}); scheduler loop online; ingress http://127.0.0.1:${runtime.notificationIngress.address().port}/health`)

  // Keep the event loop alive (the scheduler timer is unref'd by design).
  const keepalive = setInterval(() => { /* process must stay online */ }, 60_000)

  let stopping = false
  const shutdown = async (signal) => {
    if (stopping) return
    stopping = true
    log.log(`${signal} received — graceful stop`)
    clearInterval(keepalive)
    try {
      await runtime.stop()
    } catch (error) {
      log.error(`stop failed: ${error?.message ?? error}`)
    }
    runtime.writeEvidence({ kind: 'stopped', pid: processLike.pid, signal })
    log.log('stopped cleanly')
    processLike.exit(0)
  }
  processLike.on('SIGTERM', () => void shutdown('SIGTERM'))
  processLike.on('SIGINT', () => void shutdown('SIGINT'))

  return runtime
}
