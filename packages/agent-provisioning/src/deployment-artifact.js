// A domain binding carried by the existing deployment-owned source stamp.
// This is artifact input validation, not acceptance or production authorization.
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, readlinkSync, readSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, resolve } from 'node:path'
import { CHATGPT_SUBSCRIPTION_V1 } from './shared-codex.js'

const fail = reason => { throw Object.assign(new Error(`deployment artifact: ${reason}`), { code: 'DEPLOYMENT_ARTIFACT_INVALID' }) }
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const exact = (x, keys) => x && typeof x === 'object' && !Array.isArray(x)
  && Object.keys(x).sort().join(',') === [...keys].sort().join(',')
const absolute = value => typeof value === 'string' && isAbsolute(value) && resolve(value) === value
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function fileMetadata(path, ownerUid) {
  if (!absolute(path)) fail('absolute normalized artifact paths required')
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || ![0, ownerUid].includes(stat.uid) || (stat.mode & 0o022)) fail('artifact file custody')
  const physical = realpathSync(path)
  // Validate lexical links as well as their targets: a safe final realpath
  // cannot hide a redirectable input prefix. Root-owned /var and /tmp work.
  const seen = new Set()
  function custody(path) {
    if (seen.has(path)) return
    seen.add(path)
    const s = lstatSync(path)
    if (![0, ownerUid].includes(s.uid)) fail('artifact ancestor custody')
    if (s.isSymbolicLink()) {
      const target = readlinkSync(path)
      if (target.split('/').includes('..')) fail('artifact ancestor parent traversal')
      custody(resolve(dirname(path), target))
    }
    else if (!s.isDirectory() || ((s.mode & 0o022) && !(s.uid === 0 && (s.mode & 0o1000)))) fail('artifact ancestor custody')
    if (path !== dirname(path)) custody(dirname(path))
  }
  custody(dirname(path))
  custody(dirname(physical))
  return { physical, uid: stat.uid, gid: stat.gid, mode: stat.mode & 0o7777 }
}

function file(path, ownerUid) {
  return { ...fileMetadata(path, ownerUid), sha256: digest(readFileSync(path)) }
}

export function readDeploymentArtifactBinding(deploymentRoot, paths, expectedSourceCommit) {
  try {
    if (paths.sourceStamp === undefined) return undefined
    const raw = readFileSync(paths.sourceStamp, 'utf8'), stamp = JSON.parse(raw)
    if (stamp?.version === 1) return undefined // The existing exact v1 check remains in normal provisioning.
    if (!exact(stamp, ['version', 'deploymentRoot', 'sourceCommit', 'artifactSha256']) || stamp.version !== 2) fail('source stamp shape/version')
    if (!absolute(deploymentRoot) || !absolute(stamp.deploymentRoot) || deploymentRoot !== stamp.deploymentRoot) fail('source stamp belongs to another deployment root')
    if (stamp.sourceCommit !== expectedSourceCommit || !/^[a-f0-9]{40}$/.test(stamp.sourceCommit) || !/^[a-f0-9]{64}$/.test(stamp.artifactSha256)) fail('source pin/digest mismatch')
    const ownerUid = lstatSync(deploymentRoot).uid
    const stampFile = file(paths.sourceStamp, ownerUid), artifactFile = file(paths.packageArtifact, ownerUid)
    if (stampFile.sha256 !== digest(raw) || artifactFile.sha256 !== stamp.artifactSha256) fail('archive/stamp digest mismatch')
    return Object.freeze({ ...stamp, packageArtifact: paths.packageArtifact, sourceStamp: paths.sourceStamp,
      stampFile: Object.freeze(stampFile), artifactFile: Object.freeze(artifactFile) })
  } catch (error) {
    if (error?.code === 'DEPLOYMENT_ARTIFACT_INVALID') throw error
    fail('source stamp or artifact unavailable')
  }
}

export function verifyDeploymentArtifactBinding(binding, deploymentRoot, paths, expectedSourceCommit) {
  if (!binding || binding.deploymentRoot !== deploymentRoot || binding.packageArtifact !== paths.packageArtifact || binding.sourceStamp !== paths.sourceStamp) fail('frozen binding domain/path mismatch')
  const current = readDeploymentArtifactBinding(deploymentRoot, paths, expectedSourceCommit)
  if (!equal(current, binding)) fail('frozen artifact identity changed; restart required')
  return binding
}

// The path source ships in the same app closure as this resolver. Both normal
// compose and the compatibility proof use this default; no proof-only input.
const pathSource = fileURLToPath(new URL('./deployment-artifact-paths.json', import.meta.url))
const statIdentity = s => [s.dev, s.ino, s.uid, s.gid, s.mode, s.nlink, s.size, s.mtimeMs, s.ctimeMs].join(':')
function readPathSource(deploymentRoot) {
  try {
    let before
    try { before = lstatSync(pathSource) } catch (error) { if (error.code === 'ENOENT') return undefined; throw error }
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > 16384) fail('path source custody/size')
    const metadata = fileMetadata(pathSource, lstatSync(deploymentRoot).uid)
    const fd = openSync(pathSource, constants.O_RDONLY | constants.O_NOFOLLOW)
    let raw
    try {
      if (statIdentity(fstatSync(fd)) !== statIdentity(before)) fail('path source changed')
      const buffer = Buffer.alloc(before.size + 1)
      let used = 0, n
      while (used < buffer.length && (n = readSync(fd, buffer, used, buffer.length - used, used)) !== 0) used += n
      raw = buffer.subarray(0, used)
      if (used !== before.size || statIdentity(fstatSync(fd)) !== statIdentity(before)
        || statIdentity(lstatSync(pathSource)) !== statIdentity(before)) fail('path source changed')
    } finally { closeSync(fd) }
    const value = JSON.parse(raw)
    if (!exact(value, ['version', 'deploymentRoot', 'packageArtifact', 'sourceStamp']) || value.version !== 1
      || !absolute(deploymentRoot) || value.deploymentRoot !== deploymentRoot
      || !absolute(value.packageArtifact) || !absolute(value.sourceStamp)) fail('path source shape/domain')
    return { paths: { packageArtifact: value.packageArtifact, sourceStamp: value.sourceStamp },
      pathBinding: Object.freeze({ path: pathSource, ...metadata, sha256: digest(raw) }) }
  } catch (error) {
    if (error?.code === 'DEPLOYMENT_ARTIFACT_INVALID') throw error
    fail('path source unavailable')
  }
}
export function createModelArtifactContext(deploymentRoot, paths) {
  let pathBinding
  if (paths === undefined) {
    paths = { packageArtifact: process.env.DSH_CODEX_PACKAGE_TARBALL, sourceStamp: process.env.DSH_CODEX_SOURCE_STAMP }
    if (!Object.hasOwn(process.env, 'DSH_CODEX_PACKAGE_TARBALL') && !Object.hasOwn(process.env, 'DSH_CODEX_SOURCE_STAMP')) {
      const source = readPathSource(deploymentRoot)
      if (source) { paths = source.paths; pathBinding = source.pathBinding }
    }
  }
  const binding = readDeploymentArtifactBinding(deploymentRoot, paths, CHATGPT_SUBSCRIPTION_V1.sourceCommit)
  if (pathBinding && !binding) fail('default path source requires v2 stamp')
  return Object.freeze({ deploymentRoot, ...paths, ...(pathBinding ? { pathBinding } : {}), binding })
}
export function verifyModelArtifactContext(options) {
  const context = options.artifactContext
  if (context && context.deploymentRoot !== options.deploymentRoot) fail('context belongs to another deployment root')
  if (context?.pathBinding) {
    const current = readPathSource(options.deploymentRoot)
    if (!current || !equal(current.pathBinding, context.pathBinding) || !equal(current.paths, { packageArtifact: context.packageArtifact, sourceStamp: context.sourceStamp })) fail('frozen path source changed; restart required')
  }
  if (context?.binding) verifyDeploymentArtifactBinding(context.binding, options.deploymentRoot, context, CHATGPT_SUBSCRIPTION_V1.sourceCommit)
  return context
}
