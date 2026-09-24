/**
 * @agent-core/production-runtime/src/broker-composition.js — the gateway
 * broker mount (DSH_AGENT_CORE_MODULARITY_PHASE_A_V1): composition owns the
 * LOCAL capability provider enumeration; the broker stays generic and
 * learns no business service names. The resolver is consultED at EXECUTE
 * time (sibling composition rows load concurrently; reading them here at
 * APPLY time would race), so the returned map is rebuilt per call.
 */

import { apply as applyBroker } from '../../broker/src/index.js'

/**
 * Mount the trusted gateway broker and inject every composition-provided
 * LOCAL provider through the broker's generic `resolveLocalHandlers` seam.
 *
 * @param {object} deps
 * @param {object} deps.ctx - cordis context (provider services are read at
 *   execute time through ctx.get).
 * @param {string} deps.credentialsFile - 505-private credential store path.
 * @param {string} deps.authServiceOrigin - auth-service token endpoint.
 * @param {({capabilityId:string, operation:string, agentId:string, code:string}) => void} [deps.auditDenial]
 *   optional L0 denial evidence hook (agent-session messaging R12).
 * @returns {object} the broker plugin apply() result ({ mode, gateway }).
 */
export function mountBrokerGateway({ ctx, credentialsFile, authServiceOrigin, auditDenial }) {
  return applyBroker(ctx, {
    mode: 'gateway',
    credentialsFile,
    authServiceOrigin,
    ...(auditDenial === undefined ? {} : { auditDenial }),
    resolveLocalHandlers: () => ({
      ...(ctx.get('agentDefinitionAccess')?.handlers ?? {}),
      ...(ctx.get('selfServiceSchedulerAccess')?.handlers ?? {}),
      ...(ctx.get('selfOpsAccess')?.handlers ?? {}),
      ...(ctx.get('agentSessionMessagingAccess')?.handlers ?? {}),
      ...(ctx.get('agentPrincipalResolutionAccess')?.handlers ?? {}),
      ...(ctx.get('agentPrincipalReverseResolutionAccess')?.handlers ?? {}),
      ...(ctx.get('agentDirectoryAccess')?.handlers ?? {}),
      ...(ctx.get('workflowHumanPrincipalProjectionAccess')?.handlers ?? {}),
      ...(ctx.get('executionHistoryAccess')?.handlers ?? {}),
      // DEVELOPMENT_EXECUTION_SURFACE_V1: the shared local coding-executor
      // capability (system-owned state; backend-abstracted). Composition-
      // owned enumeration per Phase A — resolved at EXECUTE time like every
      // other LOCAL provider here.
      ...(ctx.get('developmentExecutionAccess')?.handlers ?? {}),
    }),
  })
}
