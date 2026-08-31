import {
  chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, normalize } from 'node:path'
import { randomUUID } from 'node:crypto'
import { selectAuthoritativeCodexGeneration } from './compose.js'
import { CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE } from './model-overrides.js'

const PIN = Object.freeze({
  version: '0.2.3',
  sourceCommit: '75d98d5b10bb926d53108e49019668c1bde2a9eb',
  artifactSha256: '2d29f95f14ff918f90b90134353c842052e9cd2aff9cb9d1866d854fff2c50b0',
})
const CANARIES = Object.freeze(['CEO', 'HR', 'Podcast', 'Shopping'])
const SHARED_CONFIG_PATH = '/Users/authsvc/.agent-core/agent-model-overrides.json'
const FENCE_PATH = '/Users/authsvc/.agent-core/control/shared-codex-migration-fence.json'

function migrationError(code, message) { return Object.assign(new Error(`shared-codex-migration: ${message}`), { code }) }
function exactObject(actual, expected) {
  return actual !== null && typeof actual === 'object'
    && Object.keys(actual).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, value]) => actual[key] === value)
}
function rooted(root, productionPath) {
  if (!isAbsolute(root) || !isAbsolute(productionPath)) throw migrationError('SHARED_CODEX_PATH_INVALID', 'all roots and production paths must be absolute')
  return root === '/' ? normalize(productionPath) : join(root, productionPath.slice(1))
}
function atomicJson(file, value, mode = 0o600) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const temp = `${file}.tmp-${process.pid}-${randomUUID()}`
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode })
  chmodSync(temp, mode); renameSync(temp, file)
}
function runCommand(command, name, env) {
  if (!Array.isArray(command) || command.length === 0 || command.some((part) => typeof part !== 'string' || part === '')) {
    throw migrationError('SHARED_CODEX_BINDING_INVALID', `${name} must be a non-empty argv array`)
  }
  const result = spawnSync(command[0], command.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } })
  if (result.status !== 0) throw migrationError('SHARED_CODEX_BINDING_FAILED', `${name} failed with status ${result.status}`)
}
function validateConfig(config, { allowProduction = false } = {}) {
  if (!config || typeof config !== 'object' || !isAbsolute(config.root ?? '')) throw migrationError('SHARED_CODEX_CONFIG_INVALID', 'absolute root is required')
  if (config.root === '/' && !allowProduction) throw migrationError('SHARED_CODEX_PRODUCTION_NOT_AUTHORIZED', 'production root requires explicit activation authorization')
  if (config.canonicalCredentialPath !== CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE) throw migrationError('SHARED_CODEX_PATH_INVALID', 'canonical credential path is not the accepted path')
  if (config.sharedConfigPath !== SHARED_CONFIG_PATH) throw migrationError('SHARED_CODEX_PATH_INVALID', 'fleet config path is not the production model-overrides authority')
  if (!exactObject(config.artifact, PIN)) throw migrationError('SHARED_CODEX_ARTIFACT_MISMATCH', 'artifact pin differs from accepted identity')
  for (const name of [
    'quiesceLunaDispatch', 'quiesceRefreshWriters', 'ownerReauthCanonical', 'grantControlPlaneAcl',
    'probeUid502Read', 'probeUid502AtomicReplace', 'probeAuthsvcControlPlane', 'probeThirdUidDenied',
    'installPinnedArtifact', 'controlledRestart', 'verifyFleetHealth', 'rollbackRuntime',
    'verifyZeroPerHomeRuntimeOpens',
  ]) if (!Array.isArray(config.commands?.[name])) throw migrationError('SHARED_CODEX_BINDING_INVALID', `missing production binding ${name}`)
  for (const canary of CANARIES) if (!Array.isArray(config.commands?.canaries?.[canary])) throw migrationError('SHARED_CODEX_BINDING_INVALID', `missing canary binding ${canary}`)
}
function validateCanonical(file) {
  if (!existsSync(file) || !statSync(file).isFile()) throw migrationError('SHARED_CODEX_CREDENTIAL_MISSING', 'canonical Owner credential was not established directly')
  chmodSync(file, 0o600)
  if ((statSync(file).mode & 0o077) !== 0) throw migrationError('SHARED_CODEX_PERMISSION_INVALID', 'canonical sensitive file must have group/world bits zero')
}

function switchFleetConfig(file) {
  const current = JSON.parse(readFileSync(file, 'utf8'))
  if (current?.version !== 3 || current.routeCatalog === null || typeof current.routeCatalog !== 'object') {
    throw migrationError('SHARED_CODEX_CONFIG_INVALID', 'fleet model overrides must already be schema v3')
  }
  let changed = 0
  const routeCatalog = Object.fromEntries(Object.entries(current.routeCatalog).map(([name, route]) => {
    if (route?.provider !== 'openai-codex') return [name, route]
    changed += 1
    return [name, { ...route, credentialFile: CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE }]
  }))
  if (changed === 0) throw migrationError('SHARED_CODEX_CONFIG_INVALID', 'fleet config contains no OpenAI Codex route')
  atomicJson(file, { ...current, routeCatalog }, 0o644)
}
function fleetConfigUsesCanonical(file) {
  const config = JSON.parse(readFileSync(file, 'utf8'))
  const codexRoutes = Object.values(config?.routeCatalog ?? {}).filter((route) => route?.provider === 'openai-codex')
  return codexRoutes.length > 0 && codexRoutes.every((route) => route.credentialFile === CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)
}

/** Concrete filesystem/process migration path; there are no operation callbacks. */
export function executeFleetSharedCodexMigration(config, options = {}) {
  validateConfig(config, options)
  const canonical = rooted(config.root, config.canonicalCredentialPath)
  const sharedConfig = rooted(config.root, config.sharedConfigPath)
  const provenance = rooted(config.root, config.provenancePath)
  const receipt = rooted(config.root, config.artifactReceiptPath)
  const fence = rooted(config.root, FENCE_PATH)
  const env = Object.freeze({
    AGENT_CORE_MIGRATION_ROOT: config.root, AGENT_CORE_CANONICAL_CREDENTIAL: canonical,
    AGENT_CORE_SHARED_CONFIG: sharedConfig, AGENT_CORE_ARTIFACT_RECEIPT: receipt,
  })
  runCommand(config.commands.quiesceLunaDispatch, 'quiesce Luna dispatch', env)
  runCommand(config.commands.quiesceRefreshWriters, 'quiesce refresh writers', env)
  atomicJson(fence, { version: 1, lunaDispatchQuiesced: true, refreshWritersQuiesced: true }, 0o600)
  const inventory = JSON.parse(readFileSync(provenance, 'utf8'))
  const selection = selectAuthoritativeCodexGeneration({ ...inventory, lunaDispatchQuiesced: true, refreshWritersQuiesced: true })
  mkdirSync(dirname(canonical), { recursive: true, mode: 0o700 }); chmodSync(dirname(canonical), 0o700)
  runCommand(config.commands.grantControlPlaneAcl, 'grant Model A control-plane ACL', env)
  let canonicalReauthCount = 0
  if (selection.legacyCredentialReuseAllowed) {
    const source = rooted(config.root, selection.authoritativeStore)
    const temp = `${canonical}.tmp-${process.pid}`
    copyFileSync(source, temp); chmodSync(temp, 0o600); renameSync(temp, canonical)
  } else {
    canonicalReauthCount = 1
    runCommand(config.commands.ownerReauthCanonical, 'canonical Owner reauth', env)
  }
  validateCanonical(canonical)
  runCommand(config.commands.probeUid502Read, 'uid502 read gate', env)
  runCommand(config.commands.probeUid502AtomicReplace, 'uid502 atomic replace gate', env)
  runCommand(config.commands.probeAuthsvcControlPlane, 'authsvc control-plane gate', env)
  runCommand(config.commands.probeThirdUidDenied, 'third uid denied gate', env)
  switchFleetConfig(sharedConfig)
  runCommand(config.commands.verifyZeroPerHomeRuntimeOpens, 'verify zero per-home OAuth runtime opens', env)
  runCommand(config.commands.installPinnedArtifact, 'install exact pinned dsh-codex artifact', env)
  const installed = JSON.parse(readFileSync(receipt, 'utf8'))
  if (!exactObject(installed, { ...PIN, sourceStamp: config.sourceStamp })) throw migrationError('SHARED_CODEX_ARTIFACT_MISMATCH', 'post-install artifact receipt is not exact')
  runCommand(config.commands.controlledRestart, 'controlled restart', env)
  for (const canary of CANARIES) runCommand(config.commands.canaries[canary], `${canary} canary`, env)
  runCommand(config.commands.verifyFleetHealth, 'fleet verification', env)
  return Object.freeze({ selection, canonicalReauthCount, canaries: CANARIES, canonicalCredential: canonical })
}

/** Roll back runtime only; canonical rotating credentials and shared path are never rolled back. */
export function executeFleetSharedCodexRollback(config, options = {}) {
  validateConfig(config, options)
  const canonical = rooted(config.root, config.canonicalCredentialPath)
  const sharedConfig = rooted(config.root, config.sharedConfigPath)
  const fence = rooted(config.root, FENCE_PATH)
  const env = {
    AGENT_CORE_MIGRATION_ROOT: config.root, AGENT_CORE_CANONICAL_CREDENTIAL: canonical, AGENT_CORE_SHARED_CONFIG: sharedConfig,
  }
  runCommand(config.commands.quiesceLunaDispatch, 'rollback quiesce Luna dispatch', env)
  runCommand(config.commands.quiesceRefreshWriters, 'rollback quiesce refresh writers', env)
  atomicJson(fence, { version: 1, lunaDispatchQuiesced: true, refreshWritersQuiesced: true, rollback: true }, 0o600)
  validateCanonical(canonical)
  if (existsSync(`${canonical}.refresh-intent.json`)) throw migrationError('SHARED_CODEX_REAUTH_REQUIRED', 'ambiguous canonical refresh generation blocks rollback')
  if (!fleetConfigUsesCanonical(sharedConfig)) throw migrationError('SHARED_CODEX_ROLLBACK_FORBIDDEN', 'rollback cannot restore a legacy credential source')
  runCommand(config.commands.rollbackRuntime, 'runtime rollback retaining canonical credentials', env)
  if (!fleetConfigUsesCanonical(sharedConfig)) throw migrationError('SHARED_CODEX_ROLLBACK_FORBIDDEN', 'rollback attempted to restore legacy rotating credentials')
  return Object.freeze({ canonicalCredentialRetained: true, legacyCredentialRollback: false })
}

export const FLEET_SHARED_CODEX_ARTIFACT_PIN = PIN
