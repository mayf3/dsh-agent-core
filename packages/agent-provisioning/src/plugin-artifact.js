import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, renameSync, rmSync, writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, isAbsolute } from 'node:path'
import { CHATGPT_SUBSCRIPTION_V1, GPT6_LUNA_ROUTE_V1 } from './shared-codex.js'
import { verifyDeploymentArtifactBinding } from './deployment-artifact.js'

export const INSTALLED_ARTIFACT_STAMP = '.agent-core-artifact-identity.json'

export function installedPluginVersion(packageFile) {
  if (!existsSync(packageFile)) return undefined
  try { return JSON.parse(readFileSync(packageFile, 'utf8')).version } catch { return null }
}

function exactObject(actual, expected) {
  return actual !== null && typeof actual === 'object'
    && Object.keys(actual).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, value]) => actual[key] === value)
}

export function entries(root, relative = '') {
  const result = []
  for (const name of readdirSync(join(root, relative)).sort()) {
    if (name === INSTALLED_ARTIFACT_STAMP) continue
    const child = join(relative, name)
    const stat = lstatSync(join(root, child))
    if (stat.isDirectory()) result.push(...entries(root, child))
    else if (stat.isSymbolicLink()) result.push([child, 'link', readlinkSync(join(root, child))])
    else if (stat.isFile()) result.push([child, 'file', createHash('sha256').update(readFileSync(join(root, child))).digest('hex')])
    else result.push([child, 'unsupported', null])
  }
  return result
}

/** Prove installed payload bytes are exactly the payload in the frozen npm artifact. */
export function installedArtifactMatches(installedRoot, packageArtifact, identity, { dependencyArtifact } = {}) {
  if (!existsSync(installedRoot)) return false
  if (packageArtifact === undefined) {
    try {
      return exactObject(JSON.parse(readFileSync(join(installedRoot, INSTALLED_ARTIFACT_STAMP), 'utf8')), identity)
    } catch {
      return false
    }
  }
  const scratch = mkdtempSync(join(tmpdir(), 'agent-core-plugin-artifact-'))
  try {
    const unpack = spawnSync('/usr/bin/tar', ['-xzf', packageArtifact, '-C', scratch], { encoding: 'utf8' })
    if (unpack.status !== 0 || !existsSync(join(scratch, 'package'))) return false
    if (dependencyArtifact !== undefined) {
      mkdirSync(join(scratch, 'package/node_modules'), { recursive: true })
      const deps = spawnSync('/usr/bin/tar', ['-xzf', dependencyArtifact, '-C', join(scratch, 'package/node_modules')], { encoding: 'utf8' })
      if (deps.status !== 0) return false
    }
    return JSON.stringify(entries(installedRoot)) === JSON.stringify(entries(join(scratch, 'package')))
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

export function stampInstalledArtifact(installedRoot, identity) {
  const target = join(installedRoot, INSTALLED_ARTIFACT_STAMP)
  const temp = `${target}.tmp-${process.pid}`
  writeFileSync(temp, `${JSON.stringify(identity)}\n`, { mode: 0o444 })
  renameSync(temp, target)
}

function provisioningError(code, message, cause) {
  return Object.assign(new Error(`agent-provisioning: ${message}`, { cause }), { code })
}

// The existing provisioning preconditions, reusable without installing or copying.
export function verifyPluginInputs(requirement, options, readHarnessIdentity) {
  const { plugin, version, sourceCommit, artifactSha256, dshVersion, dshCommit } = requirement ?? {}
  for (const [field, value] of Object.entries({ plugin, version, sourceCommit, artifactSha256, dshVersion, dshCommit })) {
    if (typeof value !== 'string' || value === '') {
      throw provisioningError('plugin_provisioning_invalid', `${field} must be a non-empty exact value`)
    }
  }
  if (/^[~^*]|[xX]$|\s\|\||\s-\s/u.test(version)) {
    throw provisioningError('plugin_version_mismatch', `plugin version must be exact (got ${version})`)
  }
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) {
    throw provisioningError('plugin_source_mismatch', `plugin sourceCommit must be 40-character lowercase hex`)
  }
  if (!/^[0-9a-f]{64}$/u.test(artifactSha256)) {
    throw provisioningError('plugin_artifact_mismatch', `plugin artifactSha256 must be 64-character lowercase hex`)
  }

  if (requirement.artifactBinding) {
    const pin = CHATGPT_SUBSCRIPTION_V1
    if (plugin !== pin.plugin || version !== pin.pluginVersion || sourceCommit !== pin.sourceCommit) {
      throw provisioningError('plugin_artifact_mismatch', 'deployment binding requires the exact legacy Codex tuple')
    }
    verifyDeploymentArtifactBinding(requirement.artifactBinding, options.deploymentRoot, options, sourceCommit)
    if (requirement.artifactBinding.artifactSha256 !== artifactSha256 || options.artifactIdentity !== undefined) throw provisioningError('plugin_artifact_mismatch', 'deployment binding differs from provisioning requirement')
  }
  const injectedArtifactIdentity = options.artifactIdentity
  if (injectedArtifactIdentity === undefined) {
    const packageArtifact = options.packageArtifact
    const sourceStamp = options.sourceStamp
    if (!isAbsolute(packageArtifact ?? '') || !existsSync(packageArtifact)) {
      throw provisioningError('plugin_artifact_mismatch', `exact local package artifact is required for modified ${plugin}@${version}`)
    }
    if (!isAbsolute(sourceStamp ?? '') || !existsSync(sourceStamp)) {
      throw provisioningError('plugin_source_mismatch', `exact absolute source stamp is required for modified ${plugin}@${version}`)
    }
    const actualDigest = createHash('sha256').update(readFileSync(packageArtifact)).digest('hex')
    if (actualDigest !== artifactSha256) {
      throw provisioningError('plugin_artifact_mismatch', `artifact digest does not match the accepted ${plugin}@${version} candidate`)
    }
    let stamp
    try {
      stamp = JSON.parse(readFileSync(sourceStamp, 'utf8'))
    } catch (cause) {
      throw provisioningError('plugin_source_mismatch', `cannot read exact source stamp for ${plugin}@${version}`, cause)
    }
    const expectedStamp = requirement.artifactBinding
      ? { version: 2, deploymentRoot: options.deploymentRoot, sourceCommit, artifactSha256 }
      : { version: 1, sourceCommit, artifactSha256 }
    if (!exactObject(stamp, expectedStamp)) {
      throw provisioningError('plugin_source_mismatch', `source stamp does not match the accepted ${plugin}@${version} candidate`)
    }
  } else if (!exactObject(injectedArtifactIdentity, { version: 1, sourceCommit, artifactSha256 })) {
    throw provisioningError('plugin_source_mismatch', `injected artifact identity does not match the accepted ${plugin}@${version} candidate`)
  }

  const identity = options.harnessIdentity ?? readHarnessIdentity(options.harnessRoot)
  if (identity.version !== dshVersion) {
    throw provisioningError('dsh_version_mismatch', `expected DSH ${dshVersion}, resolved ${identity.version ?? '(missing)'}`)
  }
  if (identity.commit !== dshCommit) {
    throw provisioningError('dsh_commit_mismatch', `expected DSH commit ${dshCommit}, resolved ${identity.commit ?? '(missing)'}`)
  }

}

export function resolvePluginPeerLinks(packageJson, profilesRoot, harnessRoot, { plugin, version, dshVersion }) {
  const links = []
  const peerNames = Object.keys(packageJson.peerDependencies ?? {})
  for (const peer of peerNames) {
    const peerDestination = join(profilesRoot, 'node_modules', ...peer.split('/'))
    if (peer === '@earendil-works/pi-ai' && existsSync(join(peerDestination, 'package.json'))) {
      continue
    }
    const candidates = [
      join(harnessRoot, 'node_modules', '.pnpm', 'node_modules', ...peer.split('/')),
      join(harnessRoot, 'apps', 'cli', 'node_modules', ...peer.split('/')),
    ]
    const source = candidates.find((candidate) => existsSync(candidate))
    if (source === undefined) {
      throw provisioningError('plugin_missing', `cannot close peer ${peer} for ${plugin}@${version} from pinned DSH ${harnessRoot}`)
    }
    links.push({ source, destination: peerDestination })
  }
  if (plugin === GPT6_LUNA_ROUTE_V1.plugin && version === GPT6_LUNA_ROUTE_V1.pluginVersion) {
    // DEC-G6R-003: a semver range or an unverified later pi-ai build is not
    // equivalent evidence — the exact 0.87.1 artifact (version + frozen
    // openai-codex catalog bytes) is required before the GPT-6 tuple can
    // serve. Fail loud, never clamp or downgrade.
    const piAiDestination = join(profilesRoot, 'node_modules', '@earendil-works', 'pi-ai')
    const piAiRoot = links.find(link => link.destination === piAiDestination)?.source ?? piAiDestination
    const piAiPackageFile = join(piAiRoot, 'package.json')
    let piAiResolved
    try { piAiResolved = JSON.parse(readFileSync(piAiPackageFile, 'utf8')).version } catch { piAiResolved = undefined }
    if (piAiResolved !== GPT6_LUNA_ROUTE_V1.piAiVersion) {
      throw provisioningError('pi_ai_identity_mismatch', `the ${plugin}@${version} tuple requires @earendil-works/pi-ai ${GPT6_LUNA_ROUTE_V1.piAiVersion} in ${join(profilesRoot, 'node_modules')}, resolved ${piAiResolved ?? '(missing)'}`)
    }
    const piAiCatalogFile = join(piAiRoot, 'dist', 'providers', 'data', 'openai-codex.json')
    let piAiCatalogDigest = ''
    try { piAiCatalogDigest = createHash('sha256').update(readFileSync(piAiCatalogFile)).digest('hex') } catch { piAiCatalogDigest = '(unreadable)' }
    if (piAiCatalogDigest !== GPT6_LUNA_ROUTE_V1.piAiOpenaiCodexCatalogSha256) {
      throw provisioningError('pi_ai_identity_mismatch', `@earendil-works/pi-ai openai-codex catalog digest ${piAiCatalogDigest} does not match the frozen ${GPT6_LUNA_ROUTE_V1.piAiVersion} artifact identity`)
    }
  }

  return links
}

// Normal provisioning installs the one accepted packageArtifact. G2's scopes
// overlay must leave that complete artifact unchanged, or A4 is not ready.
export function inspectArtifactComposition(packageArtifact, dependencyArtifact) {
  const scratch = mkdtempSync(join(tmpdir(), 'agent-core-artifact-composition-'))
  try {
    const unpack = spawnSync('/usr/bin/tar', ['-xzf', packageArtifact, '-C', scratch], { encoding: 'utf8' })
    const root = join(scratch, 'package')
    if (unpack.status !== 0 || !existsSync(root)) throw Error('artifact unpack failed')
    const before = JSON.stringify(entries(root))
    mkdirSync(join(root, 'node_modules'), { recursive: true })
    const deps = spawnSync('/usr/bin/tar', ['-xzf', dependencyArtifact, '-C', join(root, 'node_modules')], { encoding: 'utf8' })
    if (deps.status !== 0 || JSON.stringify(entries(root)) !== before) throw Error('normal provisioning artifact differs from G2 dependency closure')
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  } finally { rmSync(scratch, { recursive: true, force: true }) }
}
