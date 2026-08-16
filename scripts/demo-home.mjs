/**
 * Shared per-agent home provisioning for the DEMO / benchmark path.
 *
 * PRODUCTION_RUNTIME_V1: the implementation moved to
 * @agent-core/agent-provisioning (packages/agent-provisioning) so the
 * production Router path no longer imports a demo script. This file is now
 * a thin backwards-compatible shim for the demo/acceptance drivers
 * (process-model-demo, agent-session-v1-poc, install-demo-home, the
 * residents' verify drivers): same names, same semantics, plus the
 * historical demo default profile ('agent-core-demo') that the package
 * itself deliberately does NOT default to.
 */

import {
  AGENT_PROFILE_DEFS,
  REPO,
  cliBin,
  dshRoot,
  ensureRepoCoreBridge,
  provisionAgentHome as provisionAgentHomeImpl,
  resolveHarnessRoot,
} from '../packages/agent-provisioning/src/index.js'

export { AGENT_PROFILE_DEFS, REPO, cliBin, dshRoot, ensureRepoCoreBridge, resolveHarnessRoot }

/** Historical demo default (kept HERE, not in the production package). */
export const DEFAULT_AGENT_PROFILE = 'agent-core-demo'

/** Demo-path wrapper preserving the old default-profile signature. */
export function provisionAgentHome(home, workspace, options = {}) {
  return provisionAgentHomeImpl(home, workspace, {
    ...options,
    profile: options.profile ?? DEFAULT_AGENT_PROFILE,
  })
}
