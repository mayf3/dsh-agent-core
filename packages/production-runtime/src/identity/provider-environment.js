// Pure provider environment grammar shared by route loading and identity.
import { isIP } from 'node:net'

export const PROVIDER_ENV_ALLOWLIST = Object.freeze([
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'NODE_USE_ENV_PROXY',
])

export function invalid(message, cause) {
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

export function validateProviderEnv(value) {
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
