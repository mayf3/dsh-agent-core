import { lstatSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'

export const CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE = '/Users/authsvc/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json'
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

/** Persist the shared credential path in the copied per-Agent profile only. */
export function persistOpenAICodexCredentialFile(profilePatchFile, credentialFile) {
  if (!isAbsolute(credentialFile) || credentialFile !== CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE) {
    throw error('credential_path_invalid', `shared credentialFile must be exactly ${CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE}`)
  }
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
