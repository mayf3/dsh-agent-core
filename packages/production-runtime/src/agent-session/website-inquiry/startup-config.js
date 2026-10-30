import { lstatSync, openSync, fstatSync, readSync, closeSync, constants } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { strictJson } from '../../../../product-api/src/website-inquiry/http.js'
import { fail, uuidValid } from '../../../../product-api/src/website-inquiry/protocol.js'

const fields = ['schema_version', 'enabled', 'storeFile', 'cursorKeyFile', 'jwksUrl', 'registry']
const registryFields = ['binding_id', 'version', 'enabled', 'site_project_id', 'site_owner_id', 'issuer', 'auth_subject',
  'human_principal_id', 'communication_scope_id', 'pilot_surface', 'allowed_operations', 'transport_client_id',
  'transport_principal_id', 'exact_web_origin']
const operations = ['bound_resolve', 'preauthorize', 'own_read', 'own_events']
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value)
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const absolute = value => typeof value === 'string' && isAbsolute(value) && resolve(value) === value
const unavailable = () => fail('NOT_PROVISIONED')

/** Only explicit original-entry arguments select this operator-owned source.
 * OFF ignores even malformed config-path arguments and performs no file IO.
 */
export function websiteInquiryStartupConfig(argv) {
  const flags = argv.filter(value => value === '--website-inquiry-enabled')
  if (flags.length === 0) return undefined
  const enabled = argv[argv.indexOf('--website-inquiry-enabled') + 1]
  if (flags.length === 1 && enabled === 'false') return undefined
  const paths = argv.filter(value => value === '--website-inquiry-config')
  const configFile = argv[argv.indexOf('--website-inquiry-config') + 1]
  return { enabled: true, configFile: flags.length === 1 && enabled === 'true' && paths.length === 1 && absolute(configFile) ? configFile : null }
}
function privateDirectory(path) {
  const stat = lstatSync(path)
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o777) !== 0o700) unavailable()
}
function privateFile(stat, maximum) {
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o777) !== 0o600
    || stat.nlink !== 1 || stat.size > maximum) unavailable()
}
function readPrivate(path, maximum) {
  if (!absolute(path)) unavailable()
  privateDirectory(dirname(path))
  privateFile(lstatSync(path), maximum)
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const before = fstatSync(fd)
    privateFile(before, maximum)
    const bytes = Buffer.alloc(maximum + 1)
    let length = 0, n
    do { n = readSync(fd, bytes, length, bytes.length - length, null); length += n } while (n > 0 && length < bytes.length)
    const after = fstatSync(fd)
    if (length > maximum || before.size !== after.size || before.mtimeMs !== after.mtimeMs || after.size !== length) unavailable()
    return bytes.subarray(0, length)
  } finally { closeSync(fd) }
}
function validateRegistry(entries) {
  if (!Array.isArray(entries) || entries.length !== 1) unavailable()
  const entry = entries[0]
  if (!exact(entry, registryFields) || typeof entry.enabled !== 'boolean'
    || registryFields.filter(key => !['enabled', 'pilot_surface', 'allowed_operations'].includes(key)).some(key => !text(entry[key]))
    || entry.issuer !== 'auth-service' || !uuidValid(entry.auth_subject) || entry.auth_subject !== entry.human_principal_id
    || !uuidValid(entry.transport_principal_id)) unavailable()
  const pilot = entry.pilot_surface
  if (!exact(pilot, ['channel', 'external_id', 'expected_agent_id']) || Object.values(pilot).some(value => !text(value))
    || ['mobile', 'feishu'].includes(pilot.channel) || !/^agt_[A-Za-z0-9_-]+$/.test(pilot.expected_agent_id)) unavailable()
  if (!Array.isArray(entry.allowed_operations) || entry.allowed_operations.some(op => !operations.includes(op))
    || new Set(entry.allowed_operations).size !== entry.allowed_operations.length) unavailable()
  const origin = new URL(entry.exact_web_origin)
  if (origin.protocol !== 'https:' || origin.origin !== entry.exact_web_origin || origin.username || origin.password) unavailable()
}
function readConfig(configFile) {
  const bytes = readPrivate(configFile, 65536)
  const value = strictJson(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  if (!exact(value, fields) || value.schema_version !== 1 || value.enabled !== true) unavailable()
  for (const path of [value.storeFile, value.cursorKeyFile]) {
    if (!absolute(path) || dirname(path) !== dirname(configFile) || path === configFile) unavailable()
  }
  if (value.storeFile === value.cursorKeyFile) unavailable()
  const jwks = new URL(value.jwksUrl)
  if (jwks.protocol !== 'https:' || jwks.username || jwks.password || jwks.search || jwks.hash
    || jwks.pathname !== '/.well-known/jwks.json' || jwks.href !== value.jwksUrl) unavailable()
  validateRegistry(value.registry)
  return value
}

/** Read-only startup loading. Failure disables only the website handler.
 * Pin storage, key bytes and JWKS while re-reading current registry on every
 * access; drift rejects instead of moving old RID/result identities.
 */
export function loadWebsiteInquiryConfig(configFile) {
  try {
    const initial = readConfig(configFile)
    const cursorKey = readPrivate(initial.cursorKeyFile, 32)
    if (cursorKey.length !== 32) unavailable()
    try { privateFile(lstatSync(initial.storeFile), Number.MAX_SAFE_INTEGER) } catch (error) { if (error.code !== 'ENOENT') throw error }
    return { enabled: true, storeFile: initial.storeFile, cursorKey, jwksUrl: initial.jwksUrl, registry: initial.registry,
      registryProvider() {
        try {
          const current = readConfig(configFile)
          if (current.storeFile !== initial.storeFile || current.cursorKeyFile !== initial.cursorKeyFile || current.jwksUrl !== initial.jwksUrl
            || !readPrivate(current.cursorKeyFile, 32).equals(cursorKey)) unavailable()
          return current.registry
        } catch { unavailable() }
      } }
  } catch { return null }
}
