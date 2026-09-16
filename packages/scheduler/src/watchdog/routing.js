export const ROUTE_CLASSES = Object.freeze({
  BUSINESS_OUTPUT: 'BUSINESS_OUTPUT',
  JOB_FAILURE: 'JOB_FAILURE',
  SCHEDULER_CONTROL_PLANE_INCIDENT: 'SCHEDULER_CONTROL_PLANE_INCIDENT',
})

const TOP_LEVEL_FIELDS = new Set(['version', 'canonicalOpsTarget', 'ownerTargets', 'jobFailureTargets'])

function validateTarget(value, label, { optional = false } = {}) {
  if (optional && value === null) return null
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`)
  const fields = Object.keys(value)
  if (fields.some((field) => !['channel', 'to'].includes(field))) throw new TypeError(`${label} has unknown field`)
  if (value.channel !== 'feishu') throw new TypeError(`${label}.channel is unsupported`)
  if (typeof value.to !== 'string' || value.to.trim() === '') throw new TypeError(`${label}.to must be non-empty`)
  return { channel: 'feishu', to: value.to }
}

function validateTargetMap(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`)
  const result = {}
  const normalized = new Set()
  for (const [key, target] of Object.entries(value)) {
    if (typeof key !== 'string' || key.trim() === '') throw new TypeError(`${label} key must be non-empty`)
    const normalizedKey = key.trim()
    if (normalized.has(normalizedKey)) throw new TypeError(`${label} has duplicate normalized key`)
    normalized.add(normalizedKey)
    result[key] = validateTarget(target, `${label}.${key}`)
  }
  return result
}

export function validateRoutingManifest(raw, { allowMissingCanonical = false } = {}) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('routing manifest must be an object')
  for (const field of Object.keys(raw)) if (!TOP_LEVEL_FIELDS.has(field)) throw new TypeError(`routing manifest has unknown field: ${field}`)
  for (const field of TOP_LEVEL_FIELDS) if (!Object.hasOwn(raw, field)) throw new TypeError(`routing manifest requires ${field}`)
  if (raw.version !== 1) throw new TypeError('routing manifest version must be 1')
  return {
    version: 1,
    canonicalOpsTarget: validateTarget(raw.canonicalOpsTarget, 'canonicalOpsTarget', { optional: allowMissingCanonical }),
    ownerTargets: validateTargetMap(raw.ownerTargets, 'ownerTargets'),
    jobFailureTargets: validateTargetMap(raw.jobFailureTargets, 'jobFailureTargets'),
  }
}

function businessTarget(job) {
  const delivery = job?.delivery
  if (delivery?.mode === 'none') return null
  if (delivery?.channel === 'feishu' && typeof delivery.to === 'string' && delivery.to.trim()) {
    return { channel: 'feishu', to: delivery.to }
  }
  return null
}

export function resolveNotificationRoute({ routeClass, job, manifest: rawManifest }) {
  let manifest
  try {
    manifest = validateRoutingManifest(rawManifest, { allowMissingCanonical: true })
  } catch (error) {
    return { route: null, configDegraded: true, localOpsSinkRequired: true, delivery: 'FAILED', reason: error.message }
  }
  if (routeClass === ROUTE_CLASSES.BUSINESS_OUTPUT) {
    const route = businessTarget(job)
    return route
      ? { route, routeSource: 'job.delivery', alertTargetMissing: false }
      : { route: null, configDegraded: true, localOpsSinkRequired: true, delivery: 'FAILED', reason: 'business delivery target missing' }
  }
  if (routeClass === ROUTE_CLASSES.JOB_FAILURE) {
    const explicit = manifest.jobFailureTargets[job?.logicalKey]
    if (explicit) return { route: explicit, routeSource: 'jobFailureTargets', alertTargetMissing: false }
    const owner = manifest.ownerTargets[job?.agentId]
    if (owner) return { route: owner, routeSource: 'ownerTargets', alertTargetMissing: false }
    if (manifest.canonicalOpsTarget) return { route: manifest.canonicalOpsTarget, routeSource: 'canonicalOpsTarget', alertTargetMissing: true }
    return { route: null, alertTargetMissing: true, configDegraded: true, localOpsSinkRequired: true, delivery: 'FAILED' }
  }
  if (routeClass === ROUTE_CLASSES.SCHEDULER_CONTROL_PLANE_INCIDENT) {
    return manifest.canonicalOpsTarget
      ? { route: manifest.canonicalOpsTarget, routeSource: 'canonicalOpsTarget', alertTargetMissing: false }
      : { route: null, configDegraded: true, localOpsSinkRequired: true, delivery: 'FAILED' }
  }
  throw new TypeError(`unknown route class: ${routeClass}`)
}

export function validateIncidentDeliveryBindings(state, { manifest, jobs = [], routingSha256, nowMs }) {
  if (!/^[0-9a-f]{64}$/.test(routingSha256 ?? '')) throw new TypeError('incident binding routing generation is unavailable')
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new TypeError('incident binding observation time is unavailable')
  const normalizedManifest = validateRoutingManifest(manifest)
  for (const intent of Object.values(state?.outbox ?? {})) {
    const binding = intent.deliveryBinding
    const times = [intent.deliveryBindingAt, intent.firstDeliveryAttemptAt, intent.deliveryUpdatedAt].filter((value) => value !== undefined)
    if (times.some((value) => !Number.isSafeInteger(value) || value > nowMs)) throw new TypeError(`incident delivery binding time is invalid: ${intent.notificationKey}`)
    if (!binding) continue
    const job = jobs.find((candidate) => candidate.id === intent.incident?.jobId)
    const decision = resolveNotificationRoute({ routeClass: intent.routeClass, job, manifest: normalizedManifest })
    if (!decision.route || JSON.stringify(binding.route) !== JSON.stringify(decision.route)
      || binding.routeSource !== decision.routeSource || binding.routingSha256 !== routingSha256) {
      throw new TypeError(`incident delivery binding routing authority mismatch: ${intent.notificationKey}`)
    }
  }
  return true
}

export function validateProtectedPathMetadata({ file, parents = [], expectedUid, allowedGids = [], maxMode }) {
  const fileUnsafe = file?.type !== 'file' || file.symlink === true || file.uid !== expectedUid
    || !allowedGids.includes(file.gid) || !Number.isInteger(file.mode) || (file.mode & ~maxMode) !== 0
    || file.extendedAcl === true || file.extendedAttributes === true
  const parentUnsafe = parents.some((parent) => parent?.type !== 'directory' || parent.symlink === true
    || !Number.isInteger(parent.mode) || (parent.mode & 0o022) !== 0 || parent.extendedAcl === true || parent.extendedAttributes === true)
  if (fileUnsafe || parentUnsafe) throw new TypeError('unsafe protected path metadata')
  return true
}

function hasExtendedAcl(path) {
  if (process.platform !== 'darwin') return false
  try {
    const line = execFileSync('/bin/ls', ['-lde', path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n')[0] ?? ''
    return /^\S+\+/.test(line)
  } catch {
    throw new TypeError('protected path ACL inspection failed')
  }
}

function hasExtendedAttributes(path) {
  if (process.platform !== 'darwin') return false
  try { return execFileSync('/usr/bin/xattr', [path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').filter(Boolean).some((name) => !['com.apple.provenance', 'com.apple.rootless'].includes(name)) }
  catch { throw new TypeError('protected path xattr inspection failed') }
}

function metadata(path, expectedType) {
  const stat = lstatSync(path)
  return {
    type: stat.isFile() ? 'file' : stat.isDirectory() ? 'directory' : 'other',
    symlink: stat.isSymbolicLink(),
    uid: stat.uid,
    gid: stat.gid,
    mode: stat.mode & 0o777,
    extendedAcl: hasExtendedAcl(path),
    extendedAttributes: hasExtendedAttributes(path),
    expectedType,
    dev: stat.dev,
    ino: stat.ino,
  }
}

function parentPaths(path, boundary) {
  const stop = resolve(boundary ?? '/')
  const result = []
  let current = dirname(path)
  while (true) {
    result.push(current)
    if (current === stop) return result
    const next = dirname(current)
    if (next === current || !current.startsWith(`${stop}/`)) throw new TypeError('protected path is outside parent boundary')
    current = next
  }
}

export function readProtectedRoutingManifest(path, {
  expectedUid = 0,
  allowedGids = typeof process.getgroups === 'function' ? [...new Set([process.getgid?.(), ...process.getgroups()].filter(Number.isInteger))] : [],
  maxMode = 0o640,
  parentBoundary = '/',
} = {}) {
  if (!isAbsolute(path) || resolve(path) !== path) throw new TypeError('routing manifest path must be canonical and absolute')
  const before = metadata(path, 'file')
  const parents = parentPaths(path, parentBoundary).map((parent) => metadata(parent, 'directory'))
  validateProtectedPathMetadata({ file: before, parents, expectedUid, allowedGids, maxMode })
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  let bytes
  try {
    const after = fstatSync(fd)
    if (!after.isFile() || after.dev !== before.dev || after.ino !== before.ino) throw new TypeError('unsafe protected path identity')
    bytes = readFileSync(fd)
  } finally {
    closeSync(fd)
  }
  let manifest
  try { manifest = validateRoutingManifest(JSON.parse(bytes.toString('utf8'))) } catch (error) {
    throw Object.assign(new TypeError(`invalid routing manifest: ${error?.message ?? error}`), { cause: error })
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  return { manifest, readback: routeReadback({ path, sha256, valid: true, manifest }) }
}

export function routeReadback({ path, sha256, valid, manifest }) {
  return {
    path, sha256, valid, version: manifest?.version ?? null,
    canonicalOpsConfigured: manifest?.canonicalOpsTarget != null,
    ownerTargetCount: Object.keys(manifest?.ownerTargets ?? {}).length,
    jobFailureTargetCount: Object.keys(manifest?.jobFailureTargets ?? {}).length,
  }
}
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
