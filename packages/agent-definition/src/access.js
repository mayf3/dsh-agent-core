/**
 * @agent-core/agent-definition — AGENT_DEFINITION_ACCESS_V1 access layer.
 *
 * The thin mutation seam that lets authorized AGENTS (through the generic
 * Broker capability relay) read and — when their Auth grant covers it —
 * modify the Agent Definition config. It is NOT a registry service: it is
 * a small set of handlers over the SAME config document the read service
 * serves, executed inside the trusted control plane.
 *
 * Authorization is NOT decided here and NOT hardcoded anywhere:
 *   - READ (agent.definition.read: list/get) is open to every credentialed
 *     agent — the broker gateway requires a bound MachineClient credential
 *     (the trusted identity proof) but NO scope;
 *   - WRITE (agent.definition.write: create/update/disable/set_default)
 *     requires an Auth grant: the broker gateway obtains a token for the
 *     scope `agent.definition.write` from the auth-service (the grant
 *     authority). No agent id, name or role is ever compared — the auth-
 *     service decides, per credential, whether the scope is granted.
 *
 * Every handler returns the generic Broker envelope
 * ({ ok: true, result } | { ok: false, error: { code, detail } }) and
 * reloads the in-process read model after a successful write, so the
 * control plane serves the new state without a restart.
 */

import {
  createAgentInConfig, updateAgentInConfig, disableAgentInConfig, setDefaultAgentInConfig,
} from './config.js'

/** Broker error codes the write capability declares. */
export const ACCESS_ERROR_CODES = {
  INVALID_ARGUMENTS: 'invalid_arguments',
  AGENT_NOT_FOUND: 'agent_not_found',
  VALIDATION_ERROR: 'validation_error',
}

function err(code, detail) {
  return { ok: false, error: { code, detail } }
}

function validateString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw Object.assign(new TypeError(`agent-definition: ${field} must be a non-empty string`), { code: ACCESS_ERROR_CODES.INVALID_ARGUMENTS })
  }
  return value
}

/**
 * Build the access handlers for one control-plane instance.
 *
 * @param {object} opts
 * @param {string} opts.configFile - absolute path of the Agent Definition
 *   config this seam mutates (the SAME file the read service serves).
 * @param {{ reload: () => void }} opts.definition - the in-process read
 *   model (AgentDefinition); reloaded after every successful write.
 * @returns {{
 *   'agent.definition.read': Record<string, Function>,
 *   'agent.definition.write': Record<string, Function>,
 * }}
 *   handler maps keyed by capability id; each operation is
 *   async (args, { agentId }) -> broker envelope.
 */
export function createDefinitionAccessHandlers({ configFile, definition }) {
  const refresh = () => definition.reload()

  /** READ — open to every credentialed agent (no scope). */
  const read = {
    /** list -> { agents: [{id,name,description,disabled}] } (config order). */
    async list(args) {
      return { ok: true, result: { agents: definition.listAgents() } }
    },
    /** get -> { agent } | agent_not_found. */
    async get(args) {
      const agentId = validateString(args?.agentId, 'agentId')
      try {
        return { ok: true, result: { agent: definition.getAgent(agentId) } }
      } catch (error) {
        if (error?.code === 'AGENT_NOT_FOUND') return err(ACCESS_ERROR_CODES.AGENT_NOT_FOUND, error.message)
        throw error
      }
    },
  }

  /** WRITE — allowed only when the broker gateway obtained the scope grant. */
  const write = {
    /** create {name, description?} -> mint one stable agt_* id, persist. */
    async create(args) {
      try {
        const name = validateString(args?.name, 'name')
        const agent = await createAgentInConfig(configFile, { name, description: args?.description ?? null })
        refresh()
        return { ok: true, result: { agent } }
      } catch (error) {
        if (error?.code === ACCESS_ERROR_CODES.INVALID_ARGUMENTS) return err(ACCESS_ERROR_CODES.INVALID_ARGUMENTS, error.message)
        if (error?.code === 'VALIDATION_ERROR') return err(ACCESS_ERROR_CODES.VALIDATION_ERROR, error.message)
        throw error
      }
    },
    /** update {agentId, name?, description?} -> display fields only; id immutable. */
    async update(args) {
      try {
        const agentId = validateString(args?.agentId, 'agentId')
        const agent = await updateAgentInConfig(configFile, agentId, {
          name: args?.name,
          description: args?.description === undefined ? undefined : args.description,
        })
        refresh()
        return { ok: true, result: { agent } }
      } catch (error) {
        if (error?.code === 'AGENT_NOT_FOUND') return err(ACCESS_ERROR_CODES.AGENT_NOT_FOUND, error.message)
        if (error?.code === ACCESS_ERROR_CODES.INVALID_ARGUMENTS) return err(ACCESS_ERROR_CODES.INVALID_ARGUMENTS, error.message)
        if (error?.code === 'VALIDATION_ERROR') return err(ACCESS_ERROR_CODES.VALIDATION_ERROR, error.message)
        throw error
      }
    },
    /** disable {agentId} -> not routable anymore; default agent is refused. */
    async disable(args) {
      try {
        const agentId = validateString(args?.agentId, 'agentId')
        const agent = await disableAgentInConfig(configFile, agentId)
        refresh()
        return { ok: true, result: { agent } }
      } catch (error) {
        if (error?.code === 'AGENT_NOT_FOUND') return err(ACCESS_ERROR_CODES.AGENT_NOT_FOUND, error.message)
        if (error?.code === ACCESS_ERROR_CODES.INVALID_ARGUMENTS) return err(ACCESS_ERROR_CODES.INVALID_ARGUMENTS, error.message)
        if (error?.code === 'VALIDATION_ERROR') return err(ACCESS_ERROR_CODES.VALIDATION_ERROR, error.message)
        throw error
      }
    },
    /** set_default {agentId} -> persisted default choice (must be enabled). */
    async set_default(args) {
      try {
        const agentId = validateString(args?.agentId, 'agentId')
        const agent = await setDefaultAgentInConfig(configFile, agentId)
        refresh()
        return { ok: true, result: { agent, defaultAgentId: agentId } }
      } catch (error) {
        if (error?.code === 'AGENT_NOT_FOUND') return err(ACCESS_ERROR_CODES.AGENT_NOT_FOUND, error.message)
        if (error?.code === ACCESS_ERROR_CODES.INVALID_ARGUMENTS) return err(ACCESS_ERROR_CODES.INVALID_ARGUMENTS, error.message)
        if (error?.code === 'VALIDATION_ERROR') return err(ACCESS_ERROR_CODES.VALIDATION_ERROR, error.message)
        throw error
      }
    },
  }

  return {
    'agent.definition.read': read,
    'agent.definition.write': write,
  }
}
