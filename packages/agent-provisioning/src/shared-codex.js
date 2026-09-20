import { lstatSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join } from 'node:path'

export const CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE = '/Users/yanfenma/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json'

/** Layout suffix of the canonical store under every deployment root (path-only; no fs access). */
const CANONICAL_CREDENTIAL_TAIL = join('shared-credentials', 'openai-codex', '.openai-codex-auth.json')

/**
 * Per-deployment-root canonical store resolution. ACTIVATION_V2 CTR-ACT2-002 freezes the
 * yanfenma-domain constant above; the authsvc-domain reconciliation (FLEET_SHARED_CODEX_AUTH
 * amendment A2/A4) requires the SAME layout under that domain's own deployment root —
 * one canonical per security surface, never a cross-surface reference. Pure path math.
 */
export function canonicalOpenAICodexCredentialFileFor(deploymentRoot) {
  if (typeof deploymentRoot !== 'string' || deploymentRoot === '' || !isAbsolute(deploymentRoot)) {
    throw error('credential_path_invalid', `deployment root must be an absolute path, got ${JSON.stringify(deploymentRoot)}`)
  }
  return join(deploymentRoot, CANONICAL_CREDENTIAL_TAIL)
}

/**
 * The deployment root that owns an agent home: production homes live at
 * `<deploymentRoot>/homes/<agent>`; any other (non-production / flat) layout
 * attributes the home to its immediate parent directory.
 */
export function deploymentRootOfAgentHome(agentHome) {
  const parent = dirname(agentHome)
  return basename(parent) === 'homes' ? dirname(parent) : parent
}

/**
 * Cross-surface lineage guard: a credentialFile referenced by a provisioning patch must be
 * the canonical store of the SAME deployment root that owns the home being provisioned.
 * This is the enforcement point for "one OAuth lineage per security surface" — persisting
 * the yanfenma canonical into an authsvc-owned home (or vice versa) fails loud here.
 */
export function assertSameDomainCredentialFile(agentHome, credentialFile) {
  const expected = canonicalOpenAICodexCredentialFileFor(deploymentRootOfAgentHome(agentHome))
  if (credentialFile !== expected) {
    throw error('credential_path_invalid', `cross-surface credential reference refused: ${credentialFile} is not the canonical store of the home's own deployment root (expected ${expected})`)
  }
  return credentialFile
}

/**
 * The ONE built-in default model route (DEFAULT_MODEL_ROUTING_CONFIG_V1 §2):
 * GPT Luna, reusing the canonical identifiers already frozen across the
 * subscription route family — this constant mints no new model identity.
 * Every former hardcoded 'opencode-go'/'deepseek-v4-flash' fallback composes
 * from here; OpenCode Go stays a valid explicit route, only no longer the
 * implicit default.
 */
export const CANONICAL_DEFAULT_MODEL_ROUTE = Object.freeze({
  provider: 'openai-codex',
  model: 'gpt-5.6-luna',
})

export const CANONICAL_DEFAULT_MODEL_ROUTE_ID = `${CANONICAL_DEFAULT_MODEL_ROUTE.provider}/${CANONICAL_DEFAULT_MODEL_ROUTE.model}`

const PATCH_BEGIN = '# BEGIN AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1'
const PATCH_END = '# END AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1'

function error(code, message, cause) {
  return Object.assign(new Error(`agent-provisioning: ${message}`, { cause }), { code })
}

/** Validate the shared canonical OAuth store without reading credential contents. */
export function assertOAuthCredentialBoundary(_home, credentialFile, options = {}) {
  const expected = options.expectedCredentialFile ?? CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE
  if (!isAbsolute(credentialFile) || credentialFile !== expected) {
    throw error('credential_path_invalid', `shared credentialFile must be exactly ${expected}`)
  }
  const components = credentialFile.split('/').filter(Boolean)
  let componentPath = '/'
  for (const component of components) {
    componentPath = join(componentPath, component)
    try {
      if (lstatSync(componentPath).isSymbolicLink()) {
        throw error('credential_permission_invalid', `credential path component must not be a symlink: ${componentPath}`)
      }
    } catch (cause) {
      if (cause?.code === 'ENOENT') break
      throw cause
    }
  }
  let info
  try {
    info = lstatSync(credentialFile)
  } catch (cause) {
    if (cause?.code === 'ENOENT') throw error('credential_missing', `credential_missing: ${credentialFile}`)
    throw error('credential_missing', `credential_missing: cannot stat ${credentialFile}`, cause)
  }
  if (!info.isFile() || info.nlink !== 1) {
    throw error('credential_permission_invalid', `credential store must be a regular file with link count 1: ${credentialFile}`)
  }
  if ((info.mode & 0o777) !== 0o600) {
    throw error('credential_permission_invalid', `credential store permissions must be 0600: ${credentialFile}`)
  }
  const directory = dirname(credentialFile)
  const directoryInfo = lstatSync(directory)
  if (!directoryInfo.isDirectory() || (directoryInfo.mode & 0o777) !== 0o700) {
    throw error('credential_permission_invalid', `canonical credential directory permissions must be 0700: ${directory}`)
  }
  return credentialFile
}

/**
 * Persist the shared credential path in the copied per-Agent profile only.
 *
 * `credentialFile` must be a canonical-shaped store `<deploymentRoot>/shared-credentials/
 * openai-codex/.openai-codex-auth.json` — a per-agent relative path (the duplicated-store
 * drift shape) or any arbitrary file is refused. When `options.deploymentRoot` is given
 * (the production seam: the runtime's `--root`), the reference must be THAT deployment's
 * canonical store, so a foreign surface's lineage can never be persisted. When
 * `options.agentHome` is given, the same-domain guard applies against the home's own
 * deployment root.
 */
export function persistOpenAICodexCredentialFile(profilePatchFile, credentialFile, options = {}) {
  if (!isAbsolute(credentialFile)) {
    throw error('credential_path_invalid', 'shared credentialFile must be an absolute canonical path')
  }
  const structuralRoot = dirname(dirname(dirname(credentialFile)))
  if (credentialFile !== canonicalOpenAICodexCredentialFileFor(structuralRoot)) {
    throw error('credential_path_invalid', `shared credentialFile must be <deploymentRoot>/shared-credentials/openai-codex/.openai-codex-auth.json, got ${credentialFile}`)
  }
  if (options.deploymentRoot !== undefined && credentialFile !== canonicalOpenAICodexCredentialFileFor(options.deploymentRoot)) {
    throw error('credential_path_invalid', `cross-surface credential reference refused: ${credentialFile} is not this deployment's canonical store (${canonicalOpenAICodexCredentialFileFor(options.deploymentRoot)})`)
  }
  if (options.agentHome !== undefined) assertSameDomainCredentialFile(options.agentHome, credentialFile)
  const current = readFileSync(profilePatchFile, 'utf8')
  const pattern = new RegExp(`\\n?${PATCH_BEGIN}[\\s\\S]*?${PATCH_END}\\n?`, 'gu')
  const block = [
    PATCH_BEGIN, '- id: llm-openai-codex', '  config:',
    `    credentialFile: ${JSON.stringify(credentialFile)}`, PATCH_END, '',
  ].join('\n')
  const next = `${current.replace(pattern, '\n').trimEnd()}\n\n${block}`
  const temp = `${profilePatchFile}.tmp-${process.pid}`
  writeFileSync(temp, next, { mode: 0o644 })
  renameSync(temp, profilePatchFile)
  const persisted = readFileSync(profilePatchFile, 'utf8')
  if (persisted.split(PATCH_BEGIN).length !== 2 || !persisted.includes(`credentialFile: ${JSON.stringify(credentialFile)}`)) {
    throw error('credential_path_invalid', `failed to persist shared credentialFile in ${profilePatchFile}`)
  }
}
