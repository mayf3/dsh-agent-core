/**
 * @agent-core/agent-identity-capabilities — public surface.
 *
 * ONE slice of read-only identity capability providers (first cut of
 * DSH_AGENT_CORE_MODULARITY_PHASE_A_V1). Each creator returns
 * `{ handlers }` keyed by the frozen wire capability id then operation
 * name — the exact contract the Broker gateway's injected
 * `resolveLocalHandlers` seam merges at execute time. Composition
 * (production-runtime) mounts them; this package owns the business
 * implementations and nothing else: no Cordis, no filesystem, no
 * credential storage — every trusted input arrives as an injected seam
 * (definition service, auth origin, acquireCallerToken).
 */
export {
  AGENT_PRINCIPAL_RESOLUTION_CAPABILITY_ID,
  createAgentPrincipalResolutionAccess,
  validateResolveArgs,
} from './agent-principal-resolution.js'
export {
  AGENT_PRINCIPAL_REVERSE_RESOLUTION_CAPABILITY_ID,
  createAgentPrincipalReverseResolutionAccess,
  mapAuthResponse,
  validateResolveByAgentArgs,
} from './agent-principal-reverse-resolution.js'
export {
  AGENT_DIRECTORY_CAPABILITY_ID,
  classifyDirectorySnapshot,
  createAgentDirectoryAccess,
  validateDirectoryArgs,
} from './agent-directory.js'
