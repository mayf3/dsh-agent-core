// D14 accepted facts are a trust anchor, never an independently selected pin.
// Reading a reviewed receipt verifies its binding, not its empirical truth or
// permission to publish/activate. Release review remains a controlled boundary.
import { lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { releasedPayloadDigest, payloadDigest } from './fleet-generation-payload.js'

export const D14_FLEET_GENERATION = Object.freeze({
  generationId: 'gen-032-20261031-123906', plugin: 'dsh-codex', pluginVersion: '0.3.2',
  sourceRepository: 'mayf3/dsh-codex', sourceRef: 'refs/heads/main',
  sourceCommit: '7cfa139e111956a7193622afc734126b52d7bf07', sourceTree: '5f144d38a10eb40ce5cf33c597a72a81bd21e537',
  artifactSha256: '8755ae67673ddc08ba7511a8b11582151763972cb5c00e733f4e94f87717daf2',
  packageJsonSha256: 'f9a6ea3e647901ea1f6b218bc27aa2e3cd9ff9a9579b9036489a12354363f5bc',
  dependencyTreeDigest: '119f74e67b61a1ecace6219ebcf7f2df8874ce71d27cc2170d8e91667d1990b0', dependencyFileCount: 14224,
  dependencyArchiveSha256: 'c994dff1b4ec771cb955ccb109a1100a9be4c71835308eac9c5b70d25c2e1abc',
  frozenLockSha256: '6dd2d6f923b3ceb2714223c62f7c76ebf50861c4ad06dfeb5d616090db5034b6',
  protectionSpecSha256: '26e9d3c645f24eec02d6035f744a5083a2cdb94f2a1db1f917d7b5796afe1df5',
})
const AUTHORITY = Object.freeze({ repository: 'mayf3/dsh-agent-core',
  mergeCommit: '26178b4f459cdc2737724f6614b5e2bc9bdc77b0', acceptedHead: '1f528c6189822b6b66b78ac06639c05553498acd' })
const PROOFS = ['R1', 'R2', 'R3', 'currentDocument', 'pendingIntent', 'ownerRecovery', 'harnessClosure', 'coreWiring']
const fail = reason => { throw Object.assign(new Error(`fleet generation: ${reason}`), { code: 'FLEET_GENERATION_INVALID' }) }
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`, 'u').test(value)
const nonempty = value => typeof value === 'string' && value.trim().length > 0
const identity = stat => `${stat.dev}:${stat.ino}:${stat.mtimeMs}:${stat.ctimeMs}`

// Same controlled filesystem domain as the existing deployment-artifact seam.
// The platform's root-owned sticky /tmp and root-owned alias links are allowed;
// a mutable group/world-writable ancestor or a different owner is not.
function custody(path, ownerUid, file = false, seen = new Set()) {
  if (!isAbsolute(path) || resolve(path) !== path) fail('normalized absolute path required')
  if (seen.has(path)) return lstatSync(path)
  seen.add(path)
  const stat = lstatSync(path)
  if (![0, ownerUid].includes(stat.uid)) fail('foreign filesystem custody')
  if (file) {
    if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o022)) fail('unprotected or nonregular evidence/artifact file')
  } else if (stat.isSymbolicLink()) {
    if (stat.uid !== 0) fail('redirectable control path')
    custody(resolve(dirname(path), readlinkSync(path)), ownerUid, false, seen)
  } else if (!stat.isDirectory() || ((stat.mode & 0o022) && !(stat.uid === 0 && (stat.mode & 0o1000)))) {
    fail('unprotected control directory')
  }
  if (path !== dirname(path)) custody(dirname(path), ownerUid, false, seen)
  return stat
}

function protectedJson(path, ownerUid) {
  const before = custody(path, ownerUid, true)
  const bytes = readFileSync(path)
  const after = lstatSync(path)
  if (identity(before) !== identity(after)) fail('evidence changed during read')
  return { value: JSON.parse(bytes), sha256: digest(bytes), identity: identity(after) }
}

function checkDescriptor(descriptor) {
  if (descriptor?.schemaVersion !== 1) fail('descriptor schema is missing or unsupported')
  for (const [key, value] of Object.entries(D14_FLEET_GENERATION)) {
    if (descriptor[key] !== value) fail(`unaccepted descriptor ${key}`)
  }
  if (!same(descriptor.authority, AUTHORITY)) fail('accepted authority coordinates differ')
  const harness = descriptor.harness
  if (!nonempty(harness?.version) || /UNKNOWN|REQUIRED|PENDING/u.test(harness.version)
      || !hex(harness.commit, 40) || !hex(harness.closureSha256, 64)
      || !hex(descriptor.coreSourceCommit, 40)) fail('actual Harness/Core closure coordinates required')
}

function reviewedEvidence(control, descriptor, descriptorSha256, ownerUid) {
  const recordPath = join(control, 'accepted-releases', `${descriptor.generationId}.json`)
  const record = protectedJson(recordPath, ownerUid)
  const receipt = record.value
  if (receipt.schemaVersion !== 1 || receipt.generationId !== descriptor.generationId
      || receipt.descriptorSha256 !== descriptorSha256 || receipt.sourceCommit !== descriptor.sourceCommit
      || receipt.artifactSha256 !== descriptor.artifactSha256 || receipt.coreSourceCommit !== descriptor.coreSourceCommit
      || !same(receipt.harness, descriptor.harness) || receipt.result !== 'PASS'
      || !nonempty(receipt.environment) || !nonempty(receipt.authorId)
      || !nonempty(receipt.reviewer?.id) || receipt.reviewer.id === receipt.authorId
      || receipt.reviewer.independent !== true || !Number.isFinite(Date.parse(receipt.reviewedAt))) {
    fail('reviewed release evidence does not bind the exact descriptor and candidate')
  }
  for (const category of PROOFS) {
    const proof = receipt.proofs?.[category]
    if (proof?.result !== 'PASS' || !hex(proof.sha256, 64)
        || typeof proof.log !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(proof.log)) fail(`missing reviewed ${category} proof`)
    const logPath = join(control, 'accepted-releases', descriptor.generationId, proof.log)
    const before = custody(logPath, ownerUid, true)
    if (digest(readFileSync(logPath)) !== proof.sha256 || identity(before) !== identity(lstatSync(logPath))) {
      fail(`reviewed ${category} log changed`)
    }
  }
  return { path: recordPath, sha256: record.sha256, environment: receipt.environment }
}

function selector(control, ownerUid) {
  custody(control, ownerUid)
  const path = join(control, 'current')
  const stat = lstatSync(path)
  if (!stat.isSymbolicLink() || ![0, ownerUid].includes(stat.uid)) fail('fleet current selector required')
  const target = realpathSync(path)
  const expected = join(realpathSync(control), D14_FLEET_GENERATION.generationId, 'node_modules')
  if (target !== expected) fail('current selects an unaccepted generation')
  return { target, identity: identity(stat), link: readlinkSync(path) }
}

/** Undefined means no fleet control directory exists, never an incomplete fleet. */
export function readFleetGeneration(deploymentRoot) {
  try {
    if (!isAbsolute(deploymentRoot ?? '') || resolve(deploymentRoot) !== deploymentRoot) fail('absolute deployment root required')
    const ownerUid = lstatSync(deploymentRoot).uid
    const control = join(deploymentRoot, 'control', 'codex-plugin-runtime')
    try { lstatSync(control) } catch (error) {
      if (error.code === 'ENOENT') return undefined
      throw error
    }
    const selected = selector(control, ownerUid)
    const generationRoot = dirname(selected.target)
    const pluginRoot = join(selected.target, 'dsh-codex')
    const descriptorPath = join(generationRoot, 'descriptor.json')
    const descriptorFile = protectedJson(descriptorPath, ownerUid)
    const descriptor = descriptorFile.value
    checkDescriptor(descriptor)
    const evidence = reviewedEvidence(control, descriptor, descriptorFile.sha256, ownerUid)
    const packageArtifact = join(generationRoot, 'release.tgz')
    const dependencyArtifact = join(generationRoot, 'codex-deps-scopes.tgz')
    custody(packageArtifact, ownerUid, true)
    custody(dependencyArtifact, ownerUid, true)
    if (digest(readFileSync(packageArtifact)) !== descriptor.artifactSha256
        || digest(readFileSync(dependencyArtifact)) !== descriptor.dependencyArchiveSha256) fail('accepted archive digest mismatch')
    custody(pluginRoot, ownerUid)
    const payload = payloadDigest(pluginRoot, ownerUid)
    if (payload.digest !== releasedPayloadDigest(packageArtifact) || payload.dependencyDigest !== descriptor.dependencyTreeDigest
        || payload.dependencyFileCount !== descriptor.dependencyFileCount) fail('loaded payload or dependency closure differs from released artifact')
    if (digest(readFileSync(join(pluginRoot, 'package.json'))) !== descriptor.packageJsonSha256) fail('package identity mismatch')
    const inputs = JSON.parse(readFileSync(join(pluginRoot, 'build-provenance', 'build-inputs.json')))
    const closure = JSON.parse(readFileSync(join(pluginRoot, 'build-provenance', 'runtime-closure-manifest.json')))
    if (inputs.plugin?.sourceCommit !== descriptor.sourceCommit || inputs.plugin?.sourceTree !== descriptor.sourceTree
        || inputs.inputHashes?.['pnpm-lock.yaml'] !== descriptor.frozenLockSha256
        || closure.treeDigest !== descriptor.dependencyTreeDigest || closure.fileCount !== descriptor.dependencyFileCount) fail('embedded provenance mismatch')
    if (!same(selected, selector(control, ownerUid))
        || digest(readFileSync(descriptorPath)) !== descriptorFile.sha256
        || digest(readFileSync(evidence.path)) !== evidence.sha256) fail('generation changed during resolution')
    return Object.freeze({ deploymentRoot, generationRoot, pluginRoot, packageArtifact, dependencyArtifact,
      generationId: descriptor.generationId, plugin: descriptor.plugin, pluginVersion: descriptor.pluginVersion,
      sourceCommit: descriptor.sourceCommit, artifactSha256: descriptor.artifactSha256,
      dshVersion: descriptor.harness.version, dshCommit: descriptor.harness.commit,
      harnessClosureSha256: descriptor.harness.closureSha256, coreSourceCommit: descriptor.coreSourceCommit,
      dependencyTreeDigest: descriptor.dependencyTreeDigest, descriptorSha256: descriptorFile.sha256,
      descriptorPath, descriptorIdentity: descriptorFile.identity, selectorIdentity: selected.identity,
      reviewReceiptSha256: evidence.sha256, evidenceEnvironment: evidence.environment })
  } catch (error) {
    if (error?.code === 'FLEET_GENERATION_INVALID') throw error
    fail('generation, protected evidence or released payload unavailable')
  }
}

/** Reusable after JSON serialization, including a child startup import hook. */
export function verifyFleetGeneration(snapshot, { home, harnessIdentity } = {}) {
  try {
    if (!snapshot || typeof snapshot !== 'object') fail('frozen generation snapshot required')
    const current = readFleetGeneration(snapshot.deploymentRoot)
    if (!current || !same(current, snapshot)) fail('frozen generation changed; new admission required')
    if (home !== undefined && realpathSync(join(home, 'profiles', 'node_modules', current.plugin)) !== current.pluginRoot) fail('home resolves another generation')
    if (harnessIdentity !== undefined && (harnessIdentity.version !== current.dshVersion || harnessIdentity.commit !== current.dshCommit)) fail('actual Harness differs from reviewed generation')
    // Read selectors again after home/Harness validation, before the consumer
    // retains the immutable import path. No write or repair is performed here.
    const control = join(snapshot.deploymentRoot, 'control', 'codex-plugin-runtime')
    if (selector(control, lstatSync(snapshot.deploymentRoot).uid).identity !== snapshot.selectorIdentity) fail('current changed at admission boundary')
    return current
  } catch (error) {
    if (error?.code === 'FLEET_GENERATION_INVALID') throw error
    fail('dispatch generation, home or Harness unavailable')
  }
}

export const verifyFleetGenerationDispatch = verifyFleetGeneration
