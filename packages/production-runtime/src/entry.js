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
 *       [--website-inquiry-enabled true|false] [--website-inquiry-config <private file>]
 *
 * Env (all optional; see compose.js for the full list):
 *   PRODUCTION_RUNTIME_ROOT   persistent root (default ~/.agent-core)
 *   FEISHU_CREDS_PATH         feishu credentials (channel OFF without it)
 *   FEISHU_REQUIRE_MENTION_IN_GROUP    'true'|'false' only (default true);
 *   FEISHU_AUTO_MENTION_TRIGGER_SENDER 'true'|'false' only (default true);
 *   FEISHU_PROCESSING_REACTION_ENABLED 'true'|'false' only (unset/empty =
 *                             false, the connector default)
 *   FEISHU_REPLY_RENDER_MODE   'markdown'|'card' only (unset/empty =
 *                             markdown, the byte-identical default)
 *                             (audit Product #442: these four configure ONLY
 *                             the optional Feishu adapter — with the channel
 *                             CONFIGURED an invalid value fails startup loud
 *                             (fail closed); with the channel OFF an invalid
 *                             value is warned and does not block the base
 *                             startup path)
 *   DSH_AGENT_PROVIDER / DSH_AGENT_MODEL   model route for spawned agents
 *   AGENT_CORE_CREDENTIALS_FILE / BROKER_AUTH_ORIGIN   Trusted CP seam
 *
 * Evidence: one JSON line per lifecycle/admission event appended to
 * <root>/control/runtime-evidence.jsonl.
 */

import { assertProductionArchitecture } from './native-arm64/admission.js'
import { resolveProductionLayout } from './paths.js'
import { composeProductionRuntime } from './compose.js'
import { websiteInquiryStartupConfig } from './agent-session/website-inquiry/startup-config.js'
import { createLaunchdAdapter } from './scheduler/deployment-launchd.js'
import { isAbsolute } from 'node:path'

function argValue(args, name, fallback) {
  const idx = args.indexOf(name)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}

function readSelfStopProof(processLike, readProcessInstance) {
  try {
    const { pid, uid, gid, started, program } = readProcessInstance(processLike.pid) ?? {}
    const selfUid = processLike.geteuid?.() ?? processLike.getuid?.()
    const selfGid = processLike.getegid?.() ?? processLike.getgid?.()
    if (!Number.isSafeInteger(pid) || pid < 1 || pid !== processLike.pid
        || !Number.isSafeInteger(uid) || uid < 0 || uid !== selfUid
        || !Number.isSafeInteger(gid) || gid < 0 || gid !== selfGid
        || typeof started !== 'string' || !Number.isFinite(Date.parse(started))
        || typeof program !== 'string' || !isAbsolute(program)) throw new Error('invalid native self identity')
    return { version: 1, instance: { pid, uid, gid, started, program } }
  } catch {
    throw Object.assign(new Error('runtime readiness requires exact native self identity for shutdown proof'), {
      code: 'RUNTIME_STOP_PROOF_UNAVAILABLE',
    })
  }
}

/**
 * Run the Production Runtime resident until SIGTERM/SIGINT.
 * @param {string[]} [argv] - CLI args (default process.argv.slice(2)).
 * @param {object} [processLike] - process stand-in (tests); default process.
 * @param {object} [dependencies] - external composition seam for isolated entry tests.
 */
import { applyShutdownResult } from './shutdown-result.js'

export async function runProductionRuntime(argv = process.argv.slice(2), processLike = process, {
  compose = composeProductionRuntime, readProcessInstance = createLaunchdAdapter().readProcessInstance,
} = {}) {
  const nativeIdentity = assertProductionArchitecture({ required: argv.includes('--native-arm64') })
  const stopProof = readSelfStopProof(processLike, readProcessInstance)
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

  const websiteInquiry = websiteInquiryStartupConfig(argv)
  const runtime = await compose({ layout, tickMs, concurrency, catchup, log, schedulerReadinessRequired: true, websiteInquiry })
  await runtime.start()

  // Keep the event loop alive (the scheduler timer is unref'd by design).
  const keepalive = setInterval(() => { /* process must stay online */ }, 60_000)

  let stopping = false
  const shutdown = async (signal) => {
    if (stopping) return
    stopping = true
    log.log(`${signal} received — graceful stop`)
    clearInterval(keepalive)
    let stopError
    try {
      await runtime.stop(signal)
    } catch (error) {
      stopError = error
      log.error(`stop failed: ${error?.message ?? error}`)
    }
    // T67 r2: the result surface is TRUTHFUL — a failed stop is recorded as
    // stop_failed with a non-zero exit, never as 'stopped cleanly'/exit 0
    // (pre-r2 the catch above swallowed the failure and the result triple
    // claimed a clean stop unconditionally).
    applyShutdownResult({ writeEvidence: runtime.writeEvidence, log, processLike, signal, stopError })
  }
  processLike.on('SIGTERM', () => void shutdown('SIGTERM'))
  processLike.on('SIGINT', () => void shutdown('SIGINT'))

  runtime.writeEvidence({
    kind: 'ready',
    ...(nativeIdentity ? { nativeRuntime: nativeIdentity } : {}),
    pid: processLike.pid,
    stopProof,
    root: layout.root,
    tickMs,
    defaultAgentId: runtime.definition.getDefaultAgent()?.id,
    agentProfile: runtime.agentProfile,
  })
  log.log(`production runtime ready (pid ${processLike.pid}); scheduler loop online; ingress http://127.0.0.1:${runtime.notificationIngress.address().port}/health`)

  return runtime
}

