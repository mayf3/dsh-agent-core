/**
 * Production-only Notification Ingress composition wiring.
 *
 * This module owns only the runtime projection around the already-authoritative
 * notification-ingress plugin: path/config resolution, fail-closed mount
 * options, and admission evidence around the Router's unchanged deliver seam.
 */

import { apply as applyNotificationIngress } from '../../notification-ingress/src/index.js'

/** Mount Notification Ingress with config/path authority unchanged. */
export function mountNotificationIngressRuntime({ ctx, config, layout, env = process.env }) {
  const ingressCfg = config ?? {}

  // C-BND-003 (NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1): hand the
  // ingress ONLY its auth-config path + store/evidence layout paths. No
  // credential material flows through production composition.
  return applyNotificationIngress(ctx, {
    enabled: ingressCfg.enabled ?? env.NOTIFICATION_INGRESS_ENABLED !== '0',
    host: ingressCfg.host ?? env.NOTIFICATION_INGRESS_HOST ?? '127.0.0.1',
    port: ingressCfg.port ?? Number.parseInt(env.NOTIFICATION_INGRESS_PORT ?? '8790', 10),
    authConfigFile: ingressCfg.authConfigFile
      ?? env.NOTIFICATION_INGRESS_AUTH_CONFIG
      ?? layout.notificationAuthConfig,
    storeFile: ingressCfg.storeFile ?? layout.notificationIdempotencyStore,
    evidenceFile: ingressCfg.evidenceFile ?? layout.notificationEvidence,
    // Test seam only (stub token endpoint); production never sets it.
    ...(ingressCfg.fetchImpl === undefined ? {} : { fetchImpl: ingressCfg.fetchImpl }),
  })
}

/** Preserve Production Runtime evidence around Router-owned delivery. */
export function wireNotificationIngressDeliveryEvidence(router, writeEvidence) {
  const deliverRouterOwned = router.deliver
  router.deliver = async (req) => {
    try {
      const result = await deliverRouterOwned.call(router, req)
      const proc = router.registrySnapshot().find((p) => p.agentId === req?.agentId)
      writeEvidence({
        kind: 'deliver',
        pid: process.pid,
        requestId: req?.requestId,
        agentId: req?.agentId,
        sessionMode: req?.sessionMode,
        sessionId: result?.sessionId,
        status: result?.status ?? null,
        reconciliationHandle: result?.reconciliationHandle ?? null,
        evidence: result?.evidence ?? null,
        routerProcessPid: proc?.pid ?? null,
        routerProcessAlive: proc?.alive ?? null,
      })
      return result
    } catch (error) {
      writeEvidence({
        kind: 'deliver',
        pid: process.pid,
        requestId: req?.requestId,
        agentId: req?.agentId,
        sessionMode: req?.sessionMode,
        status: error?.status ?? 'error',
        reconciliationHandle: error?.reconciliationHandle ?? null,
        deadlineAtWallMs: error?.deadlineAtWallMs ?? null,
        evidence: error?.evidence ?? null,
        error: error?.message ?? String(error),
      })
      throw error
    }
  }
}
