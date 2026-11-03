import { HistoryStore } from '../../../scheduler/src/index.js'
import { createJwksTokenVerifier } from '../../../product-api/src/scheduler-auth.js'

/**
 * Wire the Scheduler history store and inbound token verifier into the shared
 * runtime context. Both services are provided before Scheduler construction;
 * product-api resolves them at request time because it mounts earlier.
 */
export async function mountSchedulerHistoryRuntime({ ctx, layout, schedulerAuth, env = process.env, log }) {
  const history = new HistoryStore({
    dir: layout.historyDir,
    log: { warn: (...args) => log.warn('[scheduler-history]', ...args) },
  })
  await history.ensureLoaded()
  ctx.provide('schedulerHistory', history)

  // AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 R8 gate seam, live WEC parity: the
  // verifier exists only when the full auth triple is configured. Partial
  // config stays unconfigured (null = the product-api gate 401s every
  // scheduler request, fail-closed) instead of throwing here at mount.
  const jwksUrl = schedulerAuth?.jwksUrl ?? env.SCHEDULER_AUTH_JWKS_URL
  const issuer = schedulerAuth?.issuer ?? env.SCHEDULER_AUTH_ISSUER
  const audience = schedulerAuth?.audience ?? env.SCHEDULER_AUTH_AUDIENCE
  ctx.provide('schedulerTokenVerifier', jwksUrl && issuer && audience
    ? createJwksTokenVerifier({
        jwksUrl,
        issuer,
        audience,
        log: { warn: (...args) => log.warn('[scheduler-auth]', ...args) },
      })
    : null)

  // GOAL-ZERO-OPS-001 / P0-B: the /workflow-execution/* routes verify tokens
  // against the WORKFLOW audience (auth_audiences.resource_service =
  // 'svc-workflow', scope workflow.execute), not the scheduler audience —
  // auth-service mints scheduler-audience tokens only with scheduler.*
  // scopes (namespace-enforced in parseV1ScopeRequest), so reusing the
  // scheduler verifier there made every kick delivery 401 permanently.
  // Same triple, workflow audience; falls back to the scheduler verifier
  // semantics when the workflow audience env is absent on older deployments.
  const workflowAudience = env.SCHEDULER_WORKFLOW_AUTH_AUDIENCE ?? 'svc-workflow'
  ctx.provide('workflowTokenVerifier', jwksUrl && issuer && workflowAudience
    ? createJwksTokenVerifier({
        jwksUrl,
        issuer,
        audience: workflowAudience,
        log: { warn: (...args) => log.warn('[workflow-auth]', ...args) },
      })
    : null)
  return history
}
