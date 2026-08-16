/**
 * @agent-core/agent-definition — deployment-side config writer helpers.
 *
 * The READ service (src/definition.js) is strictly read-only; this module
 * owns the ONLY legitimate way the config document is ever created or
 * extended — by deployment / acceptance tooling, never by the running
 * control plane:
 *
 *   - writeAgentDefinition()   — write (or replace) a validated config,
 *                                atomically (tmp + rename).
 *   - adoptAgents()            — Task 4 minimal stock-adoption equivalent:
 *                                mint ONE opaque agt_* id for each NEW agent
 *                                and persist it into the config; REUSE the
 *                                existing stable id when an agent with the
 *                                same name already exists. The default
 *                                choice is preserved unless the config had
 *                                none (first adopted becomes default).
 *   - convertRegistryStore()   — Task 6 thin one-time migration: old
 *                                `registry.json` document -> new Agent
 *                                Definition config document (ids and the
 *                                default are preserved verbatim; avatar and
 *                                internal timestamps are dropped).
 *
 * None of these helpers let adoption / workspace semantics INTO the config:
 * the document schema stays identity + display only.
 */

import { existsSync, readFileSync } from 'node:fs'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { CONFIG_VERSION, generateAgentId, normalizeDefinition, normalizeAgentEntry } from './definition.js'

/**
 * Serialize a normalized config document.
 * @param {{version:number, defaultAgentId:string|null, agents:Array}} doc
 * @returns {string} pretty JSON text.
 */
export function serializeDefinition(doc) {
  return `${JSON.stringify(doc, null, 2)}\n`
}

/**
 * Read + validate an existing config document.
 * @param {string} configFile - absolute path.
 * @returns {ReturnType<normalizeDefinition>|undefined} the document, or
 *   `undefined` when the file does not exist (empty definition state).
 */
export function readDefinition(configFile) {
  if (!existsSync(configFile)) return undefined
  let doc
  try {
    doc = JSON.parse(readFileSync(configFile, 'utf8'))
  } catch (error) {
    throw Object.assign(new Error(`agent-definition: corrupt config ${configFile}: ${error.message}`), { code: 'CORRUPT_CONFIG' })
  }
  return normalizeDefinition(doc, { source: configFile })
}

/**
 * Write a validated Agent Definition config atomically (tmp + rename, so a
 * crash can never leave a torn document). Validates the full document
 * before touching the file.
 * @param {string} configFile - absolute destination path.
 * @param {{defaultAgentId?:string|null, agents:Array<{id?:string,name:string,description?:string|null}>}} input
 *   - `agents[].id` is OPTIONAL here: entries without an id get a freshly
 *     minted opaque `agt_` id (the caller can never pick a duplicate —
 *     duplicates are rejected by validation).
 * @returns {{version:number, defaultAgentId:string|null, agents:Array<{id:string,name:string,description:string|null}>}}
 *   the normalized document that was written.
 */
export async function writeAgentDefinition(configFile, input) {
  if (typeof input !== 'object' || input === null || !Array.isArray(input.agents)) {
    throw Object.assign(new TypeError('agent-definition: writeAgentDefinition requires { agents: [...] }'), {
      code: 'VALIDATION_ERROR',
    })
  }
  // The document is frozen to version/defaultAgentId/agents — a persona,
  // workspace, credential or runtime field can never sneak in via the
  // writer either.
  const allowedKeys = new Set(['version', 'defaultAgentId', 'agents'])
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      throw Object.assign(
        new TypeError(`agent-definition: unsupported write field ${JSON.stringify(key)} (identity + display only)`),
        { code: 'VALIDATION_ERROR' },
      )
    }
  }
  const agents = []
  const seen = new Set()
  for (const entry of input.agents) {
    let record = normalizeAgentEntry(entry, 'agent')
    if (seen.has(record.id)) {
      throw Object.assign(new Error(`agent-definition: duplicate agent id ${record.id}`), { code: 'VALIDATION_ERROR' })
    }
    seen.add(record.id)
    agents.push(record)
  }
  const defaultAgentId = input.defaultAgentId ?? null
  const doc = normalizeDefinition({ version: CONFIG_VERSION, defaultAgentId, agents }, { source: configFile })
  await mkdir(dirname(configFile), { recursive: true })
  const tmp = `${configFile}.tmp`
  try {
    await writeFile(tmp, serializeDefinition(doc), { encoding: 'utf8' })
    await rename(tmp, configFile)
  } catch (error) {
    await rm(tmp, { force: true }).catch(() => {}) // best-effort cleanup
    throw error
  }
  return doc
}

/**
 * Task 4 — minimal stock-adoption equivalent mechanism.
 *
 * For each requested {name, description}:
 *   - NEW agent  -> mint ONE opaque `agt_` id and persist it into the config;
 *   - EXISTING   -> reuse the already-stable id (match by display name).
 *
 * The config's existing defaultAgentId is PRESERVED; when the config had no
 * default, the first adopted agent becomes the default (the historic
 * "first registered becomes default" semantics, expressed declaratively).
 *
 * Adoption / workspace semantics (symlinks, DSH_HOME mapping, workspace
 * seeding) never enter the config — they stay in the workspace/deployment
 * layer, exactly as before.
 *
 * @param {object} opts
 * @param {string} opts.configFile - absolute config path (created when absent).
 * @param {Array<{name:string, description?:string|null}>} opts.agents - the
 *   agents to adopt.
 * @returns {Promise<{agents:Array<{id:string,name:string,description:string|null}>,
 *   defaultAgentId:string|null,
 *   created:Array<string>, reused:Array<string>}>} the full resulting agent
 *   list (config order) plus the ids minted vs reused.
 */
export async function adoptAgents({ configFile, agents }) {
  if (typeof configFile !== 'string' || configFile === '' || !Array.isArray(agents)) {
    throw Object.assign(new TypeError('agent-definition: adoptAgents requires { configFile, agents: [...] }'), {
      code: 'VALIDATION_ERROR',
    })
  }
  const existing = readDefinition(configFile)
  const current = existing === undefined ? [] : existing.agents.map((record) => ({ ...record }))
  const defaultAgentId = existing?.defaultAgentId ?? null
  const created = []
  const reused = []
  const byName = new Map(current.map((record) => [record.name.toLowerCase(), record]))
  const next = [...current]
  const seen = new Set(current.map((record) => record.id))

  for (const wanted of agents) {
    const name = typeof wanted?.name === 'string' ? wanted.name : ''
    if (name.trim() === '') {
      throw Object.assign(new TypeError('agent-definition: adoption requires a non-empty name'), { code: 'VALIDATION_ERROR' })
    }
    const existingByName = byName.get(name.toLowerCase())
    if (existingByName !== undefined) {
      reused.push(existingByName.id)
      continue // reuse the stable id; display fields of the config win
    }
    let id = generateAgentId()
    while (seen.has(id)) id = generateAgentId() // astronomically rare
    seen.add(id)
    const record = {
      id,
      name: wanted.name,
      description: wanted.description === undefined || wanted.description === null ? null : String(wanted.description),
    }
    next.push(record)
    byName.set(name.toLowerCase(), record)
    created.push(id)
  }

  // Preserve the existing default; a config with no default yet takes the
  // first agent in the resulting list (historic first-registered semantics).
  const doc = normalizeDefinition(
    { version: CONFIG_VERSION, defaultAgentId: defaultAgentId ?? next[0]?.id ?? null, agents: next },
    { source: configFile },
  )
  await writeAgentDefinition(configFile, doc)
  return { agents: doc.agents, defaultAgentId: doc.defaultAgentId, created, reused }
}

/**
 * Task 6 — thin ONE-TIME migration: old writable registry store document
 * (`registry.json`) -> Agent Definition config document. Pure conversion;
 * the CLI wrapper (scripts/migrate-registry-to-definition.mjs) does the I/O.
 *
 *   { version: 1, agents: { "<agt_id>": {id,name,avatar,description,
 *       createdAt,updatedAt} }, defaultAgentId }
 *     ->
 *   { version: 1, defaultAgentId, agents: [{ id, name, description }] }
 *
 * Every existing stable agt_* id and the default choice are preserved
 * VERBATIM; `avatar` (never read by any production caller) and internal
 * timestamps are dropped. There is no migration service, reconcile loop,
 * database or provisioning platform — just this pure function + a thin
 * CLI, used once at cutover.
 *
 * @param {unknown} store - parsed old registry.json document.
 * @returns {{version:number, defaultAgentId:string|null, agents:Array<{id:string,name:string,description:string|null}>}}
 * @throws {Error} code `CORRUPT_CONFIG` when the old document is not a legal
 *   registry store (never silently drops or mangles an agent).
 */
export function convertRegistryStore(store) {
  const source = 'registry store'
  if (typeof store !== 'object' || store === null || Array.isArray(store)) {
    throw Object.assign(new Error(`agent-definition: corrupt ${source}: not a JSON object`), { code: 'CORRUPT_CONFIG' })
  }
  if (store.version !== 1 || typeof store.agents !== 'object' || store.agents === null || Array.isArray(store.agents)) {
    throw Object.assign(new Error(`agent-definition: unsupported ${source} format (expected version 1 with an agents map)`), {
      code: 'CORRUPT_CONFIG',
    })
  }
  const agents = []
  const seen = new Set()
  for (const [key, record] of Object.entries(store.agents)) {
    if (typeof record?.id !== 'string' || typeof record.name !== 'string' || record.id !== key) {
      throw Object.assign(new Error(`agent-definition: corrupt ${source}: bad agent record at key ${JSON.stringify(key)}`), {
        code: 'CORRUPT_CONFIG',
      })
    }
    if (seen.has(record.id)) {
      throw Object.assign(new Error(`agent-definition: corrupt ${source}: duplicate agent id ${record.id}`), { code: 'CORRUPT_CONFIG' })
    }
    seen.add(record.id)
    agents.push({
      id: record.id,
      name: record.name,
      description: record.description === undefined || record.description === null ? null : String(record.description),
    })
  }
  return normalizeDefinition({ version: CONFIG_VERSION, defaultAgentId: store.defaultAgentId ?? null, agents }, { source })
}

// ── AGENT_DEFINITION_ACCESS_V1: the thin deployment-side mutation seam ─────
// Each op is a read-modify-write of the SAME config document the control
// plane reads (single authority): load -> validate -> mutate -> validate ->
// atomic write. The id of an existing agent NEVER changes. These helpers are
// the only mutation path besides writeAgentDefinition/adoptAgents; nothing
// else ever writes the config at runtime.

/**
 * Create ONE new agent in the config: mint a fresh opaque `agt_` id and
 * append the record. The default is preserved (a config with no default yet
 * takes the new agent). Renaming later never changes the minted id.
 * @param {string} configFile
 * @param {{name:string, description?:string|null}} input
 * @returns {Promise<{id:string,name:string,description:string|null,disabled:boolean}>} the new agent.
 */
export async function createAgentInConfig(configFile, input) {
  const doc = readDefinition(configFile) ?? { version: CONFIG_VERSION, defaultAgentId: null, agents: [] }
  const record = normalizeAgentEntry({ ...input, id: generateAgentId() }, 'new agent')
  if (doc.agents.some((a) => a.id === record.id)) {
    // Astronomically rare; retry once with a fresh id.
    return createAgentInConfig(configFile, input)
  }
  const agents = [...doc.agents.map((a) => ({ ...a })), record]
  const next = normalizeDefinition(
    { version: CONFIG_VERSION, defaultAgentId: doc.defaultAgentId ?? agents[0]?.id ?? null, agents },
    { source: configFile },
  )
  await writeAgentDefinition(configFile, next)
  return { ...record }
}

/**
 * Update display fields of an existing agent. `id` is IMMUTABLE: this op
 * never changes it, and `disabled` is NOT touchable through update (use
 * disableAgentInConfig). Fields left undefined keep their value; pass null
 * to clear `description`.
 * @param {string} configFile
 * @param {string} agentId
 * @param {{name?:string, description?:string|null}} patch
 * @returns {Promise<{id:string,name:string,description:string|null,disabled:boolean}>} the updated agent.
 */
export async function updateAgentInConfig(configFile, agentId, patch) {
  const doc = readDefinition(configFile)
  if (doc === undefined) {
    throw Object.assign(new Error(`agent-definition: agent not found: ${agentId}`), { code: 'AGENT_NOT_FOUND' })
  }
  const index = doc.agents.findIndex((a) => a.id === agentId)
  if (index === -1) {
    throw Object.assign(new Error(`agent-definition: agent not found: ${agentId}`), { code: 'AGENT_NOT_FOUND' })
  }
  const current = doc.agents[index]
  const wantName = patch?.name === undefined ? undefined : patch.name
  const wantDescription = patch?.description === undefined ? undefined : patch.description
  const updated = normalizeAgentEntry({
    id: current.id,
    name: wantName ?? current.name,
    description: wantDescription,
    disabled: current.disabled,
  }, `agent ${agentId}`)
  const agents = doc.agents.map((a, i) => (i === index ? updated : { ...a }))
  const next = normalizeDefinition({ version: CONFIG_VERSION, defaultAgentId: doc.defaultAgentId, agents }, { source: configFile })
  await writeAgentDefinition(configFile, next)
  return { ...updated }
}

/**
 * Disable an existing agent. A disabled agent keeps its stable identity
 * (getAgent/listAgents still show it) but is no longer routable and can
 * never be the default. Disabling the CURRENT default is rejected
 * (VALIDATION_ERROR) — the caller must set_default first; no magic.
 * @param {string} configFile
 * @param {string} agentId
 * @returns {Promise<{id:string,name:string,description:string|null,disabled:boolean}>} the disabled agent.
 */
export async function disableAgentInConfig(configFile, agentId) {
  const doc = readDefinition(configFile)
  if (doc === undefined) {
    throw Object.assign(new Error(`agent-definition: agent not found: ${agentId}`), { code: 'AGENT_NOT_FOUND' })
  }
  const index = doc.agents.findIndex((a) => a.id === agentId)
  if (index === -1) {
    throw Object.assign(new Error(`agent-definition: agent not found: ${agentId}`), { code: 'AGENT_NOT_FOUND' })
  }
  if (doc.defaultAgentId === agentId) {
    throw Object.assign(
      new Error(`agent-definition: cannot disable the default agent ${agentId} (set_default first)`),
      { code: 'VALIDATION_ERROR' },
    )
  }
  const agents = doc.agents.map((a, i) => (i === index ? { ...a, disabled: true } : { ...a }))
  const next = normalizeDefinition({ version: CONFIG_VERSION, defaultAgentId: doc.defaultAgentId, agents }, { source: configFile })
  await writeAgentDefinition(configFile, next)
  return { ...agents[index] }
}

/**
 * Set which agent is the default. The target must exist and be enabled
 * (the config invariant forbids a disabled default). The choice is
 * persisted; the read service picks it up on reload.
 * @param {string} configFile
 * @param {string} agentId
 * @returns {Promise<{id:string,name:string,description:string|null,disabled:boolean}>} the new default agent.
 */
export async function setDefaultAgentInConfig(configFile, agentId) {
  const doc = readDefinition(configFile)
  if (doc === undefined) {
    throw Object.assign(new Error(`agent-definition: agent not found: ${agentId}`), { code: 'AGENT_NOT_FOUND' })
  }
  const target = doc.agents.find((a) => a.id === agentId)
  if (target === undefined) {
    throw Object.assign(new Error(`agent-definition: agent not found: ${agentId}`), { code: 'AGENT_NOT_FOUND' })
  }
  if (target.disabled) {
    throw Object.assign(new Error(`agent-definition: cannot set a disabled agent ${agentId} as default`), { code: 'VALIDATION_ERROR' })
  }
  const next = normalizeDefinition(
    { version: CONFIG_VERSION, defaultAgentId: agentId, agents: doc.agents.map((a) => ({ ...a })) },
    { source: configFile },
  )
  await writeAgentDefinition(configFile, next)
  return { ...target }
}
