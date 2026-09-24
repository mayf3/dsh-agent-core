/**
 * @agent-core/agent-identity-capabilities/src/agent-directory.js — the
 * `agentDirectoryAccess` LOCAL capability provider for agent_directory
 * (AGENT_CORE_AGENT_DIRECTORY_TOOL_V1).
 *
 * Trusted seam: this handler runs IN-PROCESS in the control-plane broker
 * gateway. The model-visible surface is EXACTLY the two read-only
 * operations of the manifest (resolve/list); everything else is derived by
 * the trusted runtime:
 *
 *   data source   = the Agent Definition service (ctx.agentDefinition), the
 *                   SINGLE canonical source of Agent existence/identity/
 *                   enabled truth — this provider holds no state, cache or
 *                   mapping of its own
 *   snapshot      = ONE synchronous `listAgents()` read per call; the
 *                   classification never awaits, so a call cannot observe a
 *                   half-updated config
 *   caller        = the gateway-frozen ACTUAL caller (context.callerAgentId);
 *                   irrelevant to the result — visibility is the accepted
 *                   agent.definition.read baseline for every credentialed
 *                   agent, and tool arguments can never expand it
 *   validation    = THIS handler is the authority (the gateway performs no
 *                   argument-schema re-validation for local non-scheduler
 *                   capabilities): resolve requires exactly { query } with a
 *                   non-blank string; list requires exactly {} — anything
 *                   else is `invalid_arguments`, never a discovery status
 *
 * Classification (CTR-ADT-001/003): exact `agt_*` id byte-equality first
 * (raw bytes, no trim — a padded id is not_found even when the unpadded id
 * exists), then exact display-name equality after trim + lowercase fold.
 * An id match on a DISABLED agent resolves `enabled:false` and NEVER falls
 * through to the name path (deliberate divergence from `resolveAgentRef`,
 * whose id precedence holds only for enabled ids); two or more name
 * candidates yield `ambiguous` with the full candidate set in config
 * order; the tool never silently selects.
 *
 * Closed behavior: read-only (no config write, no session/wake/send/
 * scheduler effect, no credential or principal data in the result); no
 * cache, no retry.
 */

/**
 * Wire capability id (also the provider handlers key — the exact id the
 * broker manifest `agent.directory` is registered under, frozen by
 * AGENT_CORE_AGENT_DIRECTORY_TOOL_V1 CTR-ADT-001). Declared here because the
 * provider OWNS its handlers key; the broker-side manifest test pins the
 * same literal so the two can never drift apart silently.
 */
export const AGENT_DIRECTORY_CAPABILITY_ID = 'agent.directory'

/** Project one internal record ({id,name,description,disabled}) to the
 *  canonical directory entry shape ({agentId,name,description,enabled}). */
function toDirectoryEntry(record) {
  return {
    agentId: record.id,
    name: record.name,
    description: record.description ?? null,
    enabled: record.disabled !== true,
  }
}

/**
 * Classify one exact reference against one Agent Definition snapshot.
 * Pure — exported for the semantic matrix tests (ACC-ADT-002 T1–T12).
 * @param {Array<{id:string,name:string,description:string|null,disabled:boolean}>} agents
 * @param {string} query - validated non-blank reference.
 * @returns {{status:'resolved',agent:{agentId,name,description,enabled}}
 *           |{status:'ambiguous',query:string,candidates:Array<{agentId,name,enabled}>}
 *           |{status:'not_found',query:string}}
 */
export function classifyDirectorySnapshot(agents, query) {
  const exact = agents.find((agent) => agent.id === query)
  if (exact !== undefined) {
    return { status: 'resolved', agent: toDirectoryEntry(exact) }
  }
  const wanted = query.trim().toLowerCase()
  const candidates = agents.filter((agent) => agent.name.trim().toLowerCase() === wanted)
  if (candidates.length === 1) {
    return { status: 'resolved', agent: toDirectoryEntry(candidates[0]) }
  }
  if (candidates.length > 1) {
    return {
      status: 'ambiguous',
      query,
      candidates: candidates.map((agent) => ({
        agentId: agent.id,
        name: agent.name,
        enabled: agent.disabled !== true,
      })),
    }
  }
  return { status: 'not_found', query }
}

/**
 * Authoritative first-action validation. The handler accepts EXACTLY the
 * declared arguments: resolve -> { query: <non-blank string> }; list -> {}.
 * @returns {{ok:true} | {ok:false, detail:string}}
 */
export function validateDirectoryArgs(input, operation) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, detail: `arguments must be an object (${operation === 'resolve' ? 'exactly { query }' : 'empty'})` }
  }
  const keys = Object.keys(input)
  if (operation === 'resolve') {
    if (keys.length !== 1 || keys[0] !== 'query') {
      return { ok: false, detail: 'unknown properties: resolve accepts exactly { query }' }
    }
    if (typeof input.query !== 'string' || input.query.trim() === '') {
      return { ok: false, detail: 'query must be a non-blank string' }
    }
    return { ok: true }
  }
  if (keys.length !== 0) {
    return { ok: false, detail: 'unknown properties: list accepts no arguments' }
  }
  return { ok: true }
}

/**
 * Create the provider.
 * @param {object} deps
 * @param {{ listAgents: () => Array<{id:string,name:string,description:string|null,disabled:boolean}> }} deps.definition -
 *   the Agent Definition read service (the single canonical snapshot source).
 * @returns {{ handlers: { [AGENT_DIRECTORY_CAPABILITY_ID]: { resolve: Function, list: Function } } }}
 */
export function createAgentDirectoryAccess({ definition }) {
  if (definition === undefined || typeof definition.listAgents !== 'function') {
    throw new TypeError('agent-directory: definition with listAgents is required')
  }

  /** resolve { query } -> resolved | ambiguous | not_found (never a guess). */
  async function resolve(args) {
    const validation = validateDirectoryArgs(args, 'resolve')
    if (!validation.ok) {
      return { ok: false, error: { code: 'invalid_arguments', detail: validation.detail } }
    }
    // ONE coherent snapshot per call: read once, classify synchronously.
    const agents = definition.listAgents()
    return { ok: true, result: classifyDirectorySnapshot(agents, args.query) }
  }

  /** list {} -> { agents: [{agentId,name,description,enabled}] } (config order). */
  async function list(args) {
    const validation = validateDirectoryArgs(args, 'list')
    if (!validation.ok) {
      return { ok: false, error: { code: 'invalid_arguments', detail: validation.detail } }
    }
    const agents = definition.listAgents()
    return { ok: true, result: { agents: agents.map(toDirectoryEntry) } }
  }

  // Provider shape: handlers keyed by CAPABILITY ID then operation name —
  // the exact contract the broker execute-time resolver closure merges.
  return { handlers: { [AGENT_DIRECTORY_CAPABILITY_ID]: { resolve, list } } }
}
