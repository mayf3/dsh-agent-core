/**
 * @agent-core/broker/src/readiness.js — scheduler mutation capability
 * readiness (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 §5.3).
 *
 * Pure, dependency-free seam shared by the child registration path and the
 * tests: when a runtime has no credential provider configured, the scheduler
 * mutation operations are withheld from the model-facing tool BEFORE
 * registration (fail-before-tool-exposure); read operations stay visible
 * (operation-level mask granularity). The parent gateway stays the LIVE
 * authority and re-checks readiness per call — a mutation that slips past
 * this static mask is answered with capability_unavailable before any
 * scheduler validation, grant, handler, or store access.
 */

import { SCHEDULER_MUTATIONS } from './relay.js'

/**
 * Withhold scheduler mutation operations from the registered capability set
 * when `credentialProviderConfigured` is false. Other capabilities pass
 * through untouched.
 */
export function withSchedulerMutationMask(capabilities, { credentialProviderConfigured, log = () => {} }) {
  if (credentialProviderConfigured) return capabilities
  return capabilities.map((capability) => {
    if (capability.manifest?.id !== 'scheduler') return capability
    const masked = {
      ...capability.manifest,
      operations: capability.manifest.operations.filter((op) => !SCHEDULER_MUTATIONS.has(op.name)),
    }
    log('[broker] scheduler mutation operations withheld: no credential provider configured in this runtime (fail-before-exposure)')
    return { ...capability, manifest: masked }
  })
}
