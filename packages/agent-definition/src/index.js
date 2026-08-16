/**
 * @agent-core/agent-definition — Cordis plugin providing the declarative
 * Agent Definition as an in-process service (`ctx.agentDefinition`).
 *
 * AGENT_DEFINITION_CONFIG_V1: Agent existence / stable id / name / display /
 * default come from a FROZEN, deployment-owned JSON config — there is no
 * writable registry service and no runtime mutation machinery. Answers:
 * which Agents exist, which Agent is `agentId`, which Agent is the default,
 * and what an id/name reference resolves to.
 *
 * The config owns identity + display ONLY (D-002 Agent schema minus the
 * unused `avatar`). The agent's persona / workspace / process / session /
 * memory / credentials are owned by their dedicated components and are NOT
 * exposed here:
 *
 *   Workspace (persona / AGENTS.md / memory)  -> workspace-bootstrap
 *   Process lifecycle                          -> agent-router
 *   Native session/runtime                     -> DSH
 *   Principal / credential / grant             -> Auth
 *
 * Zero cross-package source dependencies: `agentId` is an opaque string and
 * no path is ever derived here. The plugin config `configFile` must be an
 * ABSOLUTE path (relative or `~`-prefixed values are rejected fail-loud).
 *
 * The plugin loads the config once at construction (synchronous, in-memory
 * reads afterwards): the Router's message hot path (ensureRunning) adds no
 * config/database query.
 *
 * Creating/extending the config is deployment-side work (see
 * src/config.js: adoptAgents / writeAgentDefinition, and the one-time
 * migration script scripts/migrate-registry-to-definition.mjs) — never a
 * runtime service call.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'

import { AgentDefinition } from './definition.js'
import { createDefinitionAccessHandlers } from './access.js'

/** Stable plugin name referenced by bundle patches. */
export const name = 'agent-definition'

/** No hard service dependencies: the definition is self-contained. */
export const inject = []

/** Plugin config. */
export const Config = z.object({
  /**
   * Absolute JSON config path (default `<home>/.dsh/agents.json`). Must be
   * absolute — relative or `~`-prefixed values are rejected fail-loud.
   * The file is READ-ONLY at runtime: nothing ever writes it from the
   * control plane.
   */
  configFile: z.string(),
})

/** Default config location: a single file under the shared DSH home. */
export const DEFAULT_CONFIG_FILE = join(homedir(), '.dsh', 'agents.json')

/** Re-export the core for direct embedding / tests. */
export { AgentDefinition, generateAgentId, AGENT_ID_PREFIX } from './definition.js'

/**
 * Mount the Agent Definition: load the config and publish the
 * `ctx.agentDefinition` READ-ONLY service.
 * @param ctx - plugin context.
 * @param config - validated plugin config (`configFile`; must be absolute
 *   when provided).
 * @returns the service object (also usable without Cordis, via
 *   AgentDefinition).
 */
export function apply(ctx, config) {
  const configFile = config?.configFile ?? DEFAULT_CONFIG_FILE
  const definition = new AgentDefinition({ configFile })

  const service = {
    pluginName: name,
    /** All defined Agents, in config order. */
    listAgents: () => definition.listAgents(),
    /** Resolve one Agent by id; throws `AGENT_NOT_FOUND` when unknown. */
    getAgent: (agentId) => definition.getAgent(agentId),
    /** The default Agent, or `undefined` when the config lists none. */
    getDefaultAgent: () => definition.getDefaultAgent(),
    /** Resolve an opaque id OR a display name; throws `AGENT_NOT_FOUND`. */
    resolveAgentRef: (ref) => definition.resolveAgentRef(ref),
    /** Existence validation (boolean). */
    has: (agentId) => definition.has(agentId),
  }

  // VALUE semantics (same as workspace-bootstrap): provide the service
  // object directly so `ctx.get('agentDefinition')` returns it as-is.
  ctx.provide('agentDefinition', service)

  // AGENT_DEFINITION_ACCESS_V1: the thin mutation seam. Handler maps for the
  // generic Broker capability (agent.definition.read / agent.definition.write)
  // — consumed by the broker gateway (gateway mode) in the control plane.
  // Authorization stays in the Broker/Auth layer (credential + scope grant);
  // NOTHING here compares agent ids, names or roles.
  ctx.provide('agentDefinitionAccess', {
    handlers: createDefinitionAccessHandlers({ configFile, definition }),
  })
  return service
}
