/**
 * @agent-core/agent-router/src/deadline-config.js — the four-field deadline
 * configuration model of AGENT_PROCESS_LIFECYCLE_HARDENING_V2
 * (CLAUSE-PROC-DEADLINE-CONFIG, C-001 deadline sources).
 *
 * Four INDEPENDENT fields with different lifecycle starts and failure
 * meanings — they must never collapse into one generic `timeoutMs`:
 *
 *   initializeTimeoutMs     SPAWNING->INITIALIZING .. READY        (default 90000)
 *   promptReceiptTimeoutMs  watermark established  .. exact receipt (default 30000)
 *   turnTimeoutMs           watermark established  .. terminal +   (default 300000)
 *                           termination evidence
 *   shutdownGraceMs         ->DRAINING for graceful .. voluntary exit (default 30000)
 *
 * Precedence (static ownership — never per-message, never overridden by
 * Feishu/Binding/Session/Scheduler):
 *
 *   per-Agent static override (agent-process-overrides.json)
 *   > global deployment env value
 *   > code default
 *
 * Legacy env compatibility (frozen by V2 §5.2 — no fifth timeout field):
 *
 *   DSH_AGENT_TURN_TIMEOUT_MS absent + DSH_AGENT_TURN_TIMEOUT present
 *     -> turnTimeoutMs = DSH_AGENT_TURN_TIMEOUT
 *   DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS absent + DSH_AGENT_DELIVER_TIMEOUT present
 *     -> promptReceiptTimeoutMs = DSH_AGENT_DELIVER_TIMEOUT
 *
 * Production today runs DSH_AGENT_TURN_TIMEOUT=900000; that mitigation keeps
 * working through exactly this mapping.
 *
 * The per-Agent override carrier is `<productionRoot>/agent-process-overrides.json`
 * read ONLY at the process-start configuration boundary (resolveDeadlineConfig
 * call time): no file-watch, no per-turn reload, resolved config immutable per
 * running process. It is independent of agents.json (AgentDefinition stays
 * identity/display-only) and of the model override file.
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** The four fields, in canonical order. */
export const DEADLINE_FIELDS = Object.freeze([
  'initializeTimeoutMs',
  'promptReceiptTimeoutMs',
  'turnTimeoutMs',
  'shutdownGraceMs',
])

export const DEADLINE_DEFAULTS = Object.freeze({
  initializeTimeoutMs: 90000,
  promptReceiptTimeoutMs: 30000,
  turnTimeoutMs: 300000,
  shutdownGraceMs: 30000,
})

/** Global deployment env names (V2 §5.2). */
export const DEADLINE_ENV_NAMES = Object.freeze({
  initializeTimeoutMs: 'DSH_AGENT_INITIALIZE_TIMEOUT_MS',
  promptReceiptTimeoutMs: 'DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS',
  turnTimeoutMs: 'DSH_AGENT_TURN_TIMEOUT_MS',
  shutdownGraceMs: 'DSH_AGENT_SHUTDOWN_GRACE_MS',
})

/** Legacy env names, mapped ONLY into the four-field resolved config. */
export const DEADLINE_LEGACY_ENV_NAMES = Object.freeze({
  turnTimeoutMs: 'DSH_AGENT_TURN_TIMEOUT',
  promptReceiptTimeoutMs: 'DSH_AGENT_DELIVER_TIMEOUT',
})

/** Override file name under the production root. */
export const AGENT_PROCESS_OVERRIDES_FILENAME = 'agent-process-overrides.json'

/**
 * The production root hosting the optional per-Agent override file. Mirrors
 * production-runtime's layout precedence (PRODUCTION_RUNTIME_ROOT env, then
 * the shared ~/.agent-core default) without importing that package
 * (production-runtime depends on agent-router, not the other way around).
 * An explicit router config value wins when provided by the composition.
 */
export function resolveProductionRoot(explicit) {
  if (typeof explicit === 'string' && explicit !== '') return explicit
  if (typeof process.env.PRODUCTION_RUNTIME_ROOT === 'string' && process.env.PRODUCTION_RUNTIME_ROOT !== '') {
    return process.env.PRODUCTION_RUNTIME_ROOT
  }
  return join(homedir(), '.agent-core')
}

/**
 * Minimal duplicate-key detector: track opened string literals and, whenever
 * one is immediately followed (after whitespace) by ':', it is an object key;
 * reject repeats within the same object nesting level. (JSON.parse silently
 * keeps the last duplicate — the spec requires 重复 key fail-loud.)
 */
function rejectDuplicateKeys(text, source) {
  let index = 0
  const objectScopes = [] // array of Sets of keys seen per open object
  let pendingKey = null
  while (index < text.length) {
    const char = text[index]
    if (char === '"') {
      let end = index + 1
      while (end < text.length) {
        if (text[end] === '\\') end += 2
        else if (text[end] === '"') break
        else end += 1
      }
      if (end >= text.length) throw new Error(`${source}: unterminated string`)
      pendingKey = text.slice(index + 1, end)
      index = end + 1
      continue
    }
    if (char === '{') {
      objectScopes.push(new Set())
      pendingKey = null
    } else if (char === '}') {
      objectScopes.pop()
      pendingKey = null
    } else if (char === '[' || char === ']' || char === ',') {
      pendingKey = null
    } else if (char === ':') {
      if (pendingKey !== null && objectScopes.length > 0) {
        const scope = objectScopes[objectScopes.length - 1]
        if (scope.has(pendingKey)) {
          throw new Error(`${source}: duplicate key ${JSON.stringify(pendingKey)} in agent-process-overrides object`)
        }
        scope.add(pendingKey)
      }
      pendingKey = null
    } else if (!/\s/.test(char)) {
      // part of a non-string token (number/bool/null) — keys only come from strings
    }
    index += 1
  }
}

/**
 * Read and validate the optional per-Agent override file. Absent file = no
 * overrides (not an error). Present but malformed / unknown field / unknown
 * agent entry / non-positive value = fail-loud (throws).
 * @returns {{overrides: Record<string, Partial<Deadlines>>}}
 */
export function loadAgentProcessOverrides(filePath) {
  if (typeof filePath !== 'string' || filePath === '') {
    return { overrides: Object.freeze({}) }
  }
  if (!existsSync(filePath)) return { overrides: Object.freeze({}) }
  let text
  try {
    text = readFileSync(filePath, 'utf8')
  } catch (cause) {
    throw new Error(`agent-router: cannot read deadline override file ${filePath}: ${cause?.message ?? cause}`)
  }
  rejectDuplicateKeys(text, filePath)
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    throw new Error(`agent-router: invalid JSON in ${filePath}: ${cause?.message ?? cause}`)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`agent-router: ${filePath} must be a JSON object`)
  }
  if (parsed.version !== 1) {
    throw new Error(`agent-router: ${filePath} has unsupported version ${JSON.stringify(parsed.version)} (expected 1)`)
  }
  const overridesRaw = parsed.overrides
  if (overridesRaw === undefined) {
    throw new Error(`agent-router: ${filePath} is missing the "overrides" object`)
  }
  if (overridesRaw === null || typeof overridesRaw !== 'object' || Array.isArray(overridesRaw)) {
    throw new Error(`agent-router: ${filePath} "overrides" must be an object keyed by agentId`)
  }
  const overrides = {}
  for (const [agentId, entry] of Object.entries(overridesRaw)) {
    if (typeof agentId !== 'string' || agentId === '') {
      throw new Error(`agent-router: ${filePath} override keys must be non-empty agentId strings`)
    }
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`agent-router: ${filePath} override for ${agentId} must be an object`)
    }
    for (const field of Object.keys(entry)) {
      if (!DEADLINE_FIELDS.includes(field)) {
        throw new Error(`agent-router: ${filePath} override for ${agentId} has unknown field ${JSON.stringify(field)} (allowed: ${DEADLINE_FIELDS.join(', ')})`)
      }
    }
    for (const field of DEADLINE_FIELDS) {
      if (entry[field] !== undefined) {
        assertPositiveSafeInteger(field, entry[field], `per-Agent override ${agentId} in ${filePath}`)
      }
    }
    overrides[agentId] = { ...entry }
  }
  return { overrides: Object.freeze(overrides) }
}

/** Parse a positive safe integer env value; `undefined` when absent/blank. */
function parsePositiveInt(name, raw) {
  if (raw === undefined || raw === '') return undefined
  const value = Number.parseInt(raw, 10)
  if (!Number.isSafeInteger(value) || value <= 0 || String(value) !== String(raw).trim()) {
    throw new Error(`agent-router: ${name} must be a positive safe integer (got ${JSON.stringify(raw)})`)
  }
  return value
}

function assertPositiveSafeInteger(field, value, provenance) {
  if (!Number.isSafeInteger(value) || typeof value !== 'number' || value <= 0) {
    throw new Error(`agent-router: deadline ${field} from ${provenance} must be a positive safe integer (got ${JSON.stringify(value)})`)
  }
}

/**
 * Resolve the four-field deadline configuration.
 *
 * @param {object} [env] environment to read (default process.env)
 * @param {object} [opts]
 * @param {string} [opts.productionRoot] explicit production root (router
 *   config); PRODUCTION_RUNTIME_ROOT env; ~/.agent-core default.
 * @param {string} [opts.overridesFile] explicit override file path (tests /
 *   ops seam) — wins over <productionRoot>/agent-process-overrides.json.
 * @returns {{ deadlines: Readonly<Record<string,number>>, perAgent: (agentId:string)=>Readonly<Record<string,number>>, overridesFile: string }}
 */
export function resolveDeadlineConfig(env = process.env, opts = {}) {
  const productionRoot = resolveProductionRoot(opts.productionRoot)
  const overridesFile = opts.overridesFile ?? env.DSH_AGENT_PROCESS_OVERRIDES_FILE ?? join(productionRoot, AGENT_PROCESS_OVERRIDES_FILENAME)
  const { overrides } = opts.overrides === undefined
    ? loadAgentProcessOverrides(overridesFile)
    : { overrides: opts.overrides }

  const resolved = {}
  for (const field of DEADLINE_FIELDS) {
    const globalName = DEADLINE_ENV_NAMES[field]
    const legacyName = DEADLINE_LEGACY_ENV_NAMES[field]
    const globalValue = parsePositiveInt(globalName, env[globalName])
    const legacyValue = legacyName === undefined ? undefined : parsePositiveInt(legacyName, env[legacyName])
    const value = globalValue ?? legacyValue ?? DEADLINE_DEFAULTS[field]
    assertPositiveSafeInteger(field, value, `${globalName}${globalValue === undefined && legacyValue !== undefined ? ` (legacy ${legacyName})` : ''} default chain`)
    resolved[field] = value
  }

  const globalDeadlines = Object.freeze({ ...resolved })

  /** Per-Agent static override > global > default — resolved once per spawn. */
  const perAgent = (agentId) => {
    const entry = overrides[agentId]
    if (entry === undefined) return globalDeadlines
    const merged = { ...resolved }
    for (const field of DEADLINE_FIELDS) {
      if (entry[field] === undefined) continue
      assertPositiveSafeInteger(field, entry[field], `per-Agent override ${agentId}`)
      merged[field] = entry[field]
    }
    return Object.freeze(merged)
  }

  return {
    deadlines: globalDeadlines,
    perAgent,
    overridesFile,
    overrides,
  }
}
