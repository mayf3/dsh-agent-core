/**
 * Startup-only per-Agent model overrides.
 *
 * The deployment owns `<productionRoot>/agent-model-overrides.json`; this
 * module only reads and validates it. V1 deliberately accepts exactly one
 * opt-in tuple and exposes a plain resolver to the composition layer. It is
 * not a dynamic model router and never watches or writes the file.
 */

import { existsSync, readFileSync } from 'node:fs'
import { isIP } from 'node:net'

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

export const PROVIDER_ENV_ALLOWLIST = Object.freeze([
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'NODE_USE_ENV_PROXY',
])

function invalid(message, cause) {
  return Object.assign(new Error(`production-runtime: invalid agent model overrides: ${message}`, { cause }), {
    code: 'AGENT_MODEL_OVERRIDE_INVALID',
  })
}

function invalidProviderEnv(key, invalidClass) {
  return invalid(`${key}: ${invalidClass}`)
}

function assertProxyUrl(key, value) {
  if (typeof value !== 'string' || value === '') throw invalidProviderEnv(key, 'invalid_non_empty_string')
  let url
  try {
    url = new URL(value)
  } catch {
    throw invalidProviderEnv(key, 'invalid_url')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw invalidProviderEnv(key, 'invalid_scheme')
  if (url.username !== '' || url.password !== '' || value.includes('@')) throw invalidProviderEnv(key, 'userinfo_forbidden')
  if (url.hostname === '') throw invalidProviderEnv(key, 'host_missing')
  if (url.pathname !== '' && url.pathname !== '/') throw invalidProviderEnv(key, 'path_forbidden')
  if (url.search !== '') throw invalidProviderEnv(key, 'query_forbidden')
  if (url.hash !== '') throw invalidProviderEnv(key, 'fragment_forbidden')
}

function validPort(port) {
  if (port === undefined) return true
  if (!/^[0-9]+$/u.test(port)) return false
  const number = Number(port)
  return Number.isInteger(number) && number >= 1 && number <= 65_535
}

function validHostname(host) {
  if (host.length === 0 || host.length > 253) return false
  return host.split('.').every((label) => (
    label.length >= 1
    && label.length <= 63
    && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/u.test(label)
  ))
}

function validNoProxyEntry(entry) {
  if (entry === '*') return true

  const bracketed = entry.match(/^\[([^\]]+)\](?::([0-9]+))?$/u)
  if (bracketed !== null) return isIP(bracketed[1]) === 6 && validPort(bracketed[2])
  if (entry.includes('[') || entry.includes(']')) return false

  // A raw IPv6 literal is valid only without a port. Brackets are mandatory
  // for the IPv6 + port form, keeping the grammar mechanically unambiguous.
  if (isIP(entry) === 6) return true

  const hostPort = entry.match(/^([^:]+)(?::([0-9]+))?$/u)
  if (hostPort === null || !validPort(hostPort[2])) return false
  const host = hostPort[1]
  if (isIP(host) === 4) return true
  // Numeric dotted input is an IPv4 candidate, never a hostname fallback.
  if (/^[0-9.]+$/u.test(host)) return false
  return validHostname(host)
}

function assertNoProxy(value) {
  if (typeof value !== 'string' || value === '') {
    throw invalidProviderEnv('NO_PROXY', 'invalid_non_empty_string')
  }
  // Shell expansion syntax is forbidden. '*' and '[' / ']' are handled only
  // by their exact grammar positions in validNoProxyEntry.
  if (/[\s\u0000-\u001f\u007f'"`$\\?{}();&|<>!~]/u.test(value)) {
    throw invalidProviderEnv('NO_PROXY', 'invalid_character')
  }
  const entries = value.split(',')
  if (entries.some((entry) => entry === '' || !validNoProxyEntry(entry))) {
    throw invalidProviderEnv('NO_PROXY', 'invalid_entry')
  }
}

function validateProviderEnv(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidProviderEnv('providerEnv', 'invalid_type')
  }
  const allowed = new Set(PROVIDER_ENV_ALLOWLIST)
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw invalidProviderEnv(key, 'unknown_key')
  }
  for (const key of PROVIDER_ENV_ALLOWLIST) {
    if (!Object.hasOwn(value, key)) throw invalidProviderEnv(key, 'missing_key')
  }
  assertProxyUrl('HTTP_PROXY', value.HTTP_PROXY)
  assertProxyUrl('HTTPS_PROXY', value.HTTPS_PROXY)
  assertNoProxy(value.NO_PROXY)
  if (value.NODE_USE_ENV_PROXY !== '1') {
    throw invalidProviderEnv('NODE_USE_ENV_PROXY', 'invalid_value')
  }
  return Object.freeze(Object.fromEntries(PROVIDER_ENV_ALLOWLIST.map((key) => [key, value[key]])))
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
      const hasProviderEnv = Object.hasOwn(route ?? {}, 'providerEnv')
      const routeKeys = ['model', 'plugin', 'pluginVersion', 'provider', ...(hasProviderEnv ? ['providerEnv'] : [])]
      if (!exactKeys(route, routeKeys)) {
        throw invalid(`override ${agentId} must contain provider, model, plugin, pluginVersion and optional providerEnv only`)
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
      const providerEnv = hasProviderEnv ? validateProviderEnv(route.providerEnv) : undefined
      mutableOverrides.set(agentId, Object.freeze({
        provider: route.provider,
        model: route.model,
        plugin: route.plugin,
        pluginVersion: route.pluginVersion,
        ...(providerEnv === undefined ? {} : { providerEnv }),
      }))
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
