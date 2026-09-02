import { HistoryStore } from '../../scheduler/src/index.js'
import { createJwksTokenVerifier } from '../../product-api/src/scheduler-auth.js'

/**
 * Wire the Scheduler history store and inbound token verifier into the shared
 * runtime context. Both services are provided before Scheduler construction;
 * product-api resolves them at request time because it mounts earlier.
 */
export function mountSchedulerHistoryRuntime({ ctx, layout, schedulerAuth, env = process.env, log }) {
  const history = new HistoryStore({
    dir: layout.historyDir,
    log: { warn: (...args) => log.warn('[scheduler-history]', ...args) },
  })
  history.ensureLoaded?.()
  ctx.provide('schedulerHistory', history)

  const jwksUrl = schedulerAuth?.jwksUrl ?? env.SCHEDULER_AUTH_JWKS_URL
  ctx.provide('schedulerTokenVerifier', jwksUrl
    ? createJwksTokenVerifier({
        jwksUrl,
        issuer: schedulerAuth?.issuer ?? env.SCHEDULER_AUTH_ISSUER,
        audience: schedulerAuth?.audience ?? env.SCHEDULER_AUTH_AUDIENCE,
        log: { warn: (...args) => log.warn('[scheduler-auth]', ...args) },
      })
    : null)
  return history
}
