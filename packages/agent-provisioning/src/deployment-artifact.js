// A domain binding carried by the existing deployment-owned source stamp.
// This is artifact input validation, not acceptance or production authorization.
import { lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, resolve } from 'node:path'
import { CHATGPT_SUBSCRIPTION_V1 } from './shared-codex.js'

const fail = reason => { throw Object.assign(new Error(`deployment artifact: ${reason}`), { code: 'DEPLOYMENT_ARTIFACT_INVALID' }) }
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const exact = (x, keys) => x && typeof x === 'object' && !Array.isArray(x)
  && Object.keys(x).sort().join(',') === [...keys].sort().join(',')
const absolute = value => typeof value === 'string' && isAbsolute(value) && resolve(value) === value
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function file(path, ownerUid) {
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
  return { physical, uid: stat.uid, gid: stat.gid, mode: stat.mode & 0o7777, sha256: digest(readFileSync(path)) }
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

export function createModelArtifactContext(deploymentRoot, paths = { packageArtifact: process.env.DSH_CODEX_PACKAGE_TARBALL, sourceStamp: process.env.DSH_CODEX_SOURCE_STAMP }) {
  return Object.freeze({ deploymentRoot, ...paths, binding: readDeploymentArtifactBinding(deploymentRoot, paths, CHATGPT_SUBSCRIPTION_V1.sourceCommit) })
}
export function verifyModelArtifactContext(options) {
  const context = options.artifactContext
  if (context && context.deploymentRoot !== options.deploymentRoot) fail('context belongs to another deployment root')
  if (context?.binding) verifyDeploymentArtifactBinding(context.binding, options.deploymentRoot, context, CHATGPT_SUBSCRIPTION_V1.sourceCommit)
  return context
}
