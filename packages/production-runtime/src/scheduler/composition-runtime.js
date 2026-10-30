import { JobStore } from '../../../scheduler/src/index.js'
import { createFeishuDeliver } from '../../../scheduler-router/src/index.js'
import { mountSchedulerHistoryRuntime } from './history-runtime.js'
import { createObservedSchedulerInvoker } from '../scheduler-invoker.js'
import { mountSchedulerAutoReconcileRuntime } from './auto-reconcile-runtime.js'
import { mountConfiguredSchedulerHealthRuntime } from './health-runtime.js'
import { wireNotificationIngressDeliveryEvidence } from '../notification-ingress-runtime.js'

/** Prepare the existing scheduler services in production composition order. */
export async function prepareSchedulerRuntime({ ctx, opts, layout, router, definition, feishu, writeEvidence, log }) {
  // ── scheduler engine over the production store (existing seams only) ─────
  const invoker = createObservedSchedulerInvoker({ router, definition, writeEvidence, runtimeGeneration: opts.runtimeGeneration ?? process.env.AGENT_CORE_DEPLOYED_SHA })

  // Admission observability remains a wrap around Router-owned delivery.
  wireNotificationIngressDeliveryEvidence(router, writeEvidence)

  const deliver = feishu !== undefined
    ? createFeishuDeliver(feishu)
    : async ({ job }) => {
        throw new Error(`production-runtime: feishu channel not configured — cannot deliver job ${job?.id ?? '?'} (set FEISHU_CREDS_PATH or create the job with --no-deliver)`)
      }

  const store = new JobStore(layout.jobsStore, { runLogPath: layout.runsLog })

  // AGENT_CORE_SCHEDULER_RUN_HISTORY_V1: structured execution history over
  // its own directory (events.jsonl + monthly projections) and its own lock.
  // It records facts at the engine's lifecycle boundaries and NEVER gates
  // admission (R-H1); jobs.json / runs.jsonl authorities are untouched.
  const history = await mountSchedulerHistoryRuntime({
    ctx,
    layout,
    schedulerAuth: opts.schedulerAuth,
    log,
  })
  const schedulerHealth = mountConfiguredSchedulerHealthRuntime({ ctx, layout, opts })

  // AGENT_DELIVERY_RESILIENCE_V1 CTR-S1/S4 (accepted @8cf2c23a): evidence-
  // gated scheduler fence auto-reconcile. DEFAULT OFF — runs only when
  // AGENT_CORE_FENCE_AUTO_RECONCILE === 'on' (explicit owner/operator
  // configuration action); settles unresolved outcome_unknown occurrences
  // through the same store mutation path as the operator CLI with a machine
  // receipt actor. The transport-watchdog / fence-janitor external stopgaps
  // retire per CTR-X1/X2 once this is enabled and production-verified.
  mountSchedulerAutoReconcileRuntime({ layout, store, log })

  return { invoker, deliver, store, history, schedulerHealth }
}
