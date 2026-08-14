/**
 * @agent-core/agent-registry — Cordis plugin providing the long-lived Agent
 * identity registry as an in-process service (`ctx.agentRegistry`).
 *
 * Answers: which Agents exist, which Agent is `agentId`, which Agent is the
 * default. Owns identity + display data only (D-002 Agent schema); the
 * agent's workspace / DSH_HOME / process / session / memory are owned by
 * their dedicated components and are NOT exposed here (see
 * docs/reports/agent-registry-v1.md for the boundary).
 *
 * Zero cross-package source dependencies: the registry treats `agentId` as
 * an opaque string and never validates or computes paths — path legality is
 * the workspace-bootstrap owner's job when it receives an id. The plugin
 * config `storeFile` must be an ABSOLUTE path (no `~` expansion anywhere:
 * a relative or `~`-prefixed value is rejected fail-loud at construction,
 * so a literal `~` directory can never be created by accident).
 *
 * The plugin does not seed anything on its own: it mounts the registry over
 * a JSON store (default `<home>/.dsh/registry/agents.json`) and publishes
 * the service value so any sibling — typically the Router / Control Plane —
 * can list agents, resolve ids and read the default Agent. Persistence is
 * atomic, transactional and survives restarts.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'

import { AgentRegistry } from './registry.js'

/** Stable plugin name referenced by bundle patches. */
export const name = 'agent-registry'

/** No hard service dependencies: the registry is self-contained. */
export const inject = []

/** Plugin config. */
export const Config = z.object({
  /**
   * Absolute JSON store path (default `<home>/.dsh/registry/agents.json`).
   * Must be absolute — relative or `~`-prefixed values are rejected
   * fail-loud. Writes are atomic + transactional, so the file is always
   * either absent or a complete document.
   */
  storeFile: z.string(),
})

/** Default store location: control-plane state under the shared DSH home. */
export const DEFAULT_STORE_FILE = join(homedir(), '.dsh', 'registry', 'agents.json')

/** Re-export the core for direct embedding / tests. */
export { AgentRegistry } from './registry.js'

/**
 * Mount the registry: create the in-process registry over the configured
 * store and publish the `ctx.agentRegistry` service.
 * @param ctx - plugin context.
 * @param config - validated plugin config (`storeFile` optional; must be
 *   absolute when provided).
 * @returns the service object (also usable without Cordis, via AgentRegistry).
 */
export function apply(ctx, config) {
  const storeFile = config?.storeFile ?? DEFAULT_STORE_FILE
  const registry = new AgentRegistry({ storeFile })

  const service = {
    pluginName: name,
    /** All registered Agents, in registration order. */
    listAgents: () => registry.listAgents(),
    /** Resolve one Agent by id; throws `AGENT_NOT_FOUND` when unknown. */
    getAgent: (agentId) => registry.getAgent(agentId),
    /** Register a new Agent (id generated); the first becomes the default. */
    registerAgent: (input) => registry.registerAgent(input),
    /** Update display fields; `agentId` never changes. */
    updateAgent: (agentId, patch) => registry.updateAgent(agentId, patch),
    /** The default Agent, or `undefined` when none is registered yet. */
    getDefaultAgent: () => registry.getDefaultAgent(),
    /** Explicitly set (and persist) which Agent is the default. */
    setDefaultAgent: (agentId) => registry.setDefaultAgent(agentId),
  }

  // VALUE semantics (same as workspace-bootstrap): provide the service
  // object directly so `ctx.get('agentRegistry')` returns it as-is.
  ctx.provide('agentRegistry', service)
  return service
}
