/**
 * Startup-only per-Agent model overrides.
 *
 * The deployment owns `<productionRoot>/agent-model-overrides.json`; this
 * module only reads and validates it. V1 deliberately accepts exactly one
 * opt-in tuple and exposes a plain resolver to the composition layer. It is
 * not a dynamic model router and never watches or writes the file.
 */

import { existsSync, readFileSync } from 'node:fs'

export const CHATGPT_SUBSCRIPTION_V1 = Object.freeze({
  targetAgentId: 'agt_cto-agent',
  provider: 'openai-codex',
  model: 'gpt-5.6-luna',
  plugin: 'dsh-codex',
  pluginVersion: '0.2.3',
  dshVersion: '0.1.0-rc.5',
  dshCommit: 'a12bb03c6861969985f066bfbf0cb7e5dd5ac567',
  credentialFile: '.openai-codex-auth.json',
})

function invalid(message, cause) {
  return Object.assign(new Error(`production-runtime: invalid agent model overrides: ${message}`, { cause }), {
    code: 'AGENT_MODEL_OVERRIDE_INVALID',
  })
}

/**
 * JSON.parse silently keeps the final value for duplicate object keys. The
 * deployment contract is fail-loud instead, so scan the already-valid JSON
 * grammar and reject a repeated key in any object before using the value.
 */
function assertNoDuplicateJsonKeys(source) {
  let index = 0
  const whitespace = () => {
    while (/\s/u.test(source[index] ?? '')) index += 1
  }
  const string = () => {
    const start = index
    index += 1
    while (index < source.length) {
      if (source[index] === '\\') {
        index += 2
      } else if (source[index] === '"') {
        index += 1
        return JSON.parse(source.slice(start, index))
      } else {
        index += 1
      }
    }
    throw invalid('unterminated JSON string')
  }
  const value = () => {
    whitespace()
    if (source[index] === '{') {
      index += 1
      whitespace()
      const keys = new Set()
      if (source[index] === '}') { index += 1; return }
      for (;;) {
        whitespace()
        const key = string()
        if (keys.has(key)) throw invalid(`duplicate JSON key ${JSON.stringify(key)}`)
        keys.add(key)
        whitespace()
        index += 1 // ':' (JSON.parse already established valid syntax)
        value()
        whitespace()
        if (source[index] === '}') { index += 1; return }
        index += 1 // ','
      }
    }
    if (source[index] === '[') {
      index += 1
      whitespace()
      if (source[index] === ']') { index += 1; return }
      for (;;) {
        value()
        whitespace()
        if (source[index] === ']') { index += 1; return }
        index += 1 // ','
      }
    }
    if (source[index] === '"') {
      string()
      return
    }
    while (index < source.length && !/[\s,\]}]/u.test(source[index])) index += 1
  }
  value()
}

function exactKeys(value, expected) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

/**
 * Load the frozen V1 schema. Missing file is the rollback/legacy state.
 * @param {string} file
 * @param {Iterable<string>} registeredAgentIds
 * @returns {{filePresent:boolean, overrides:Readonly<Record<string,object>>, resolve:(agentId:string, globalRoute:object)=>object}}
 */
export function loadAgentModelOverrides(file, registeredAgentIds) {
  const filePresent = existsSync(file)
  const mutableOverrides = new Map()
  if (filePresent) {
    let source
    let parsed
    try {
      source = readFileSync(file, 'utf8')
      parsed = JSON.parse(source)
      assertNoDuplicateJsonKeys(source)
    } catch (cause) {
      if (cause?.code === 'AGENT_MODEL_OVERRIDE_INVALID') throw cause
      throw invalid(`cannot parse ${file}`, cause)
    }
    if (!exactKeys(parsed, ['overrides', 'version']) || parsed.version !== 1
        || parsed.overrides === null || typeof parsed.overrides !== 'object'
        || Array.isArray(parsed.overrides)) {
      throw invalid(`${file} must be {"version":1,"overrides":{...}}`)
    }
    const entries = Object.entries(parsed.overrides)
    if (entries.length > 1) throw invalid('V1 allows at most one override')
    const registered = new Set(registeredAgentIds)
    for (const [agentId, route] of entries) {
      if (!registered.has(agentId)) throw invalid(`unregistered agentId ${JSON.stringify(agentId)}`)
      if (agentId !== CHATGPT_SUBSCRIPTION_V1.targetAgentId) {
        throw invalid(`V1 only allows agentId ${CHATGPT_SUBSCRIPTION_V1.targetAgentId}`)
      }
      if (!exactKeys(route, ['model', 'plugin', 'pluginVersion', 'provider'])) {
        throw invalid(`override ${agentId} must contain provider, model, plugin, pluginVersion only`)
      }
      for (const field of ['provider', 'model', 'plugin', 'pluginVersion']) {
        if (typeof route[field] !== 'string' || route[field] === '') {
          throw invalid(`override ${agentId}.${field} must be a non-empty string`)
        }
      }
      for (const field of ['provider', 'model', 'plugin', 'pluginVersion']) {
        if (route[field] !== CHATGPT_SUBSCRIPTION_V1[field]) {
          throw invalid(`override ${agentId}.${field} must equal ${JSON.stringify(CHATGPT_SUBSCRIPTION_V1[field])}`)
        }
      }
      mutableOverrides.set(agentId, Object.freeze({ ...route }))
    }
  }
  const overrides = Object.freeze(Object.fromEntries(mutableOverrides))

  return Object.freeze({
    filePresent,
    overrides,
    resolve(agentId, globalRoute) {
      const override = overrides[agentId]
      return override === undefined
        ? Object.freeze({ provider: globalRoute.provider, model: globalRoute.model })
        : Object.freeze({ ...override })
    },
  })
}
