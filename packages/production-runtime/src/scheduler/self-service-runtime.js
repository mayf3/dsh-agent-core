/** Mount the trusted Scheduler and self-operations LOCAL Broker providers. */

import { createSelfServiceSchedulerAccess } from '../../../scheduler/src/self-service.js'
import { createSelfOpsAccess } from '../../../scheduler/src/self-ops/index.js'
import { loadCredentialFor } from '../../../broker/src/credential-store.js'
import { requestAccessToken } from '../../../broker/src/transport.js'

export function mountSchedulerSelfServiceRuntime({ ctx, store, router, broker = {}, log }) {
  const credentialsFile = broker.credentialsFile ?? process.env.AGENT_CORE_CREDENTIALS_FILE
  const authServiceOrigin = broker.authServiceOrigin ?? process.env.BROKER_AUTH_ORIGIN
  ctx.provide('selfServiceSchedulerAccess', createSelfServiceSchedulerAccess({
    store,
    assertGrant: async (agentId, scope, resource) => {
      try {
        const credential = loadCredentialFor(credentialsFile, agentId)
        if (credential === undefined) return false
        await requestAccessToken({ credential, authServiceOrigin, resource, scope })
        return true
      } catch {
        return false
      }
    },
    onAuditFailure: ({ operation, jobId }) => {
      log.error(`[scheduler-self-service] audit append failed after committed ${operation} for job ${jobId}`)
    },
  }))

  if (typeof router?.resolveCallerCorrelation !== 'function'
    || typeof router?.reconciliationRuntimeStatus !== 'function') return
  ctx.provide('selfOpsAccess', createSelfOpsAccess({
    store,
    resolveCallerCorrelation: (coordinates) => router.resolveCallerCorrelation(coordinates),
    runtimeStatus: () => router.reconciliationRuntimeStatus(),
    onAuditFailure: ({ operationId, jobId }) => {
      log.error(`[self-ops] audit append failed after committed ${operationId} for job ${jobId}`)
    },
  }))
}
