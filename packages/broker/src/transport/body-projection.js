import { TransportBindingError } from './binding.js'

const forbiddenSegments = new Set(['__proto__', 'prototype', 'constructor'])
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

export function validateHttpBodyProjections(http, at, properties) {
  const projections = http.bodyProjections
  if (projections === undefined) return null
  if (!Array.isArray(projections) || projections.length === 0) {
    return `${at}.bodyProjections must be a non-empty array`
  }

  const sources = new Set()
  const destinations = []
  for (const [index, projection] of projections.entries()) {
    const itemAt = `${at}.bodyProjections[${index}]`
    if (!isRecord(projection)) return `${itemAt} must be an object`
    const keys = Object.keys(projection).sort()
    if (keys.join(',') !== 'destinationBodyPath,sourceArg') {
      return `${itemAt} must contain only sourceArg and destinationBodyPath`
    }
    if (typeof projection.sourceArg !== 'string' || !Object.hasOwn(properties, projection.sourceArg)) {
      return `${itemAt}.sourceArg must name a declared argument`
    }
    if (sources.has(projection.sourceArg)) return `${itemAt}.sourceArg is duplicated`
    sources.add(projection.sourceArg)
    if ((http.body || []).includes(projection.sourceArg)
      || (http.pathParams || []).includes(projection.sourceArg)
      || (http.query || []).includes(projection.sourceArg)) {
      return `${itemAt}.sourceArg must not also be directly bound`
    }
    const path = projection.destinationBodyPath
    if (!Array.isArray(path) || path.length < 2
      || path.some((segment) => typeof segment !== 'string'
        || !/^[A-Za-z][A-Za-z0-9_]*$/.test(segment)
        || forbiddenSegments.has(segment))) {
      return `${itemAt}.destinationBodyPath must be a safe path of at least two segments`
    }
    if (!(http.body || []).includes(path[0])) {
      return `${itemAt}.destinationBodyPath root must be a directly bound body argument`
    }
    const rootSchema = properties[path[0]]
    if (rootSchema?.type !== 'object') {
      return `${itemAt}.destinationBodyPath root argument must have object type`
    }
    let parentSchema = rootSchema
    for (const segment of path.slice(1, -1)) {
      const childSchema = parentSchema?.properties?.[segment]
      if (childSchema === undefined) {
        if (parentSchema?.additionalProperties === false) {
          return `${itemAt}.destinationBodyPath crosses a closed object at "${segment}"`
        }
        parentSchema = undefined
      } else if (childSchema.type !== 'object') {
        return `${itemAt}.destinationBodyPath crosses a non-object at "${segment}"`
      } else {
        parentSchema = childSchema
      }
    }
    if (destinations.some((other) => isPrefix(other, path) || isPrefix(path, other))) {
      return `${itemAt}.destinationBodyPath overlaps another projection`
    }
    destinations.push(path)
  }
  return null
}

export function validateHttpReadProjection(http, at, properties) {
  const read = http.readProjection
  if (read === undefined) return null
  if (http.method === 'GET') return `${at}.readProjection is only valid on a non-GET operation`
  if (!isRecord(read)) return `${at}.readProjection must be an object`
  if (Object.keys(read).sort().join(',') !== 'argumentBindings,bodyProjections,capabilityId,collisionBodyPath,operation,responseChecks') {
    return `${at}.readProjection must contain only capabilityId, operation, argumentBindings, responseChecks, bodyProjections, and collisionBodyPath`
  }
  if (typeof read.capabilityId !== 'string' || !/^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)*$/.test(read.capabilityId)) {
    return `${at}.readProjection.capabilityId must be a registered capability id`
  }
  if (typeof read.operation !== 'string' || !/^[a-z][a-zA-Z0-9_]*$/.test(read.operation)) {
    return `${at}.readProjection.operation must be a registered operation name`
  }
  if (!Array.isArray(read.argumentBindings) || read.argumentBindings.length === 0) {
    return `${at}.readProjection.argumentBindings must be a non-empty array`
  }
  const targetArgs = new Set()
  for (const [index, binding] of read.argumentBindings.entries()) {
    const itemAt = `${at}.readProjection.argumentBindings[${index}]`
    if (!isRecord(binding) || Object.keys(binding).sort().join(',') !== 'sourceArg,targetArg') {
      return `${itemAt} must contain only sourceArg and targetArg`
    }
    if (typeof binding.sourceArg !== 'string' || !Object.hasOwn(properties, binding.sourceArg)) {
      return `${itemAt}.sourceArg must name a declared argument`
    }
    if (typeof binding.targetArg !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(binding.targetArg)
      || forbiddenSegments.has(binding.targetArg) || targetArgs.has(binding.targetArg)) {
      return `${itemAt}.targetArg must be a unique safe argument name`
    }
    targetArgs.add(binding.targetArg)
  }
  if (!Array.isArray(read.responseChecks) || read.responseChecks.length === 0) {
    return `${at}.readProjection.responseChecks must be a non-empty array`
  }
  for (const [index, check] of read.responseChecks.entries()) {
    const itemAt = `${at}.readProjection.responseChecks[${index}]`
    if (!isRecord(check)) return `${itemAt} must be an object`
    const keys = Object.keys(check).sort().join(',')
    if (!['equals,errorCode,responsePath', 'equalsArg,errorCode,responsePath',
      'equalsResponsePath,errorCode,responsePath'].includes(keys)) {
      return `${itemAt} must declare one literal, argument, or response-path equality check and an errorCode`
    }
    if (!validResponsePath(check.responsePath)) return `${itemAt}.responsePath must be a safe non-empty path`
    if (check.equalsArg !== undefined
      && (typeof check.equalsArg !== 'string' || !Object.hasOwn(properties, check.equalsArg))) {
      return `${itemAt}.equalsArg must name a declared argument`
    }
    if (check.equalsResponsePath !== undefined && !validResponsePath(check.equalsResponsePath)) {
      return `${itemAt}.equalsResponsePath must be a safe non-empty response path`
    }
    if (Object.hasOwn(check, 'equals') && !['string', 'number', 'boolean'].includes(typeof check.equals)) {
      return `${itemAt}.equals must be a string, number, or boolean literal`
    }
    if (typeof check.errorCode !== 'string' || !/^[a-z][a-zA-Z0-9_]*$/.test(check.errorCode)) {
      return `${itemAt}.errorCode must be a lowercase error identifier`
    }
  }
  if (!Array.isArray(read.bodyProjections) || read.bodyProjections.length === 0) {
    return `${at}.readProjection.bodyProjections must be a non-empty array`
  }
  if (!validBodyPath(read.collisionBodyPath) || !Object.hasOwn(properties, read.collisionBodyPath[0])
    || !(http.body || []).includes(read.collisionBodyPath[0]) || properties[read.collisionBodyPath[0]]?.type !== 'object') {
    return `${at}.readProjection.collisionBodyPath must be a safe path rooted in a directly bound object body argument`
  }
  const collisionPathError = validateBodyPathParents(read.collisionBodyPath, properties)
  if (collisionPathError) return `${at}.readProjection.collisionBodyPath ${collisionPathError}`
  const destinations = (http.bodyProjections || []).map((projection) => projection.destinationBodyPath)
  const responseSources = new Set()
  for (const [index, projection] of read.bodyProjections.entries()) {
    const itemAt = `${at}.readProjection.bodyProjections[${index}]`
    if (!isRecord(projection) || Object.keys(projection).sort().join(',') !== 'destinationBodyPath,responsePath,valueType') {
      return `${itemAt} must contain only responsePath, destinationBodyPath, and valueType`
    }
    if (!validResponsePath(projection.responsePath)) return `${itemAt}.responsePath must be a safe non-empty path`
    if (responseSources.has(projection.responsePath.join('.'))) return `${itemAt}.responsePath is duplicated`
    responseSources.add(projection.responsePath.join('.'))
    const path = projection.destinationBodyPath
    if (!validBodyPath(path)) return `${itemAt}.destinationBodyPath must be a safe path of at least two segments`
    if (!isPrefix(read.collisionBodyPath, path)) return `${itemAt}.destinationBodyPath must be under collisionBodyPath`
    if (!Object.hasOwn(properties, path[0]) || !(http.body || []).includes(path[0])) {
      return `${itemAt}.destinationBodyPath root must be a directly bound body argument`
    }
    if (properties[path[0]]?.type !== 'object') return `${itemAt}.destinationBodyPath root argument must have object type`
    const destinationPathError = validateBodyPathParents(path, properties)
    if (destinationPathError) return `${itemAt}.destinationBodyPath ${destinationPathError}`
    if (destinations.some((other) => isPrefix(other, path) || isPrefix(path, other))) {
      return `${itemAt}.destinationBodyPath overlaps another projection`
    }
    if (projection.valueType !== 'string') return `${itemAt}.valueType must be string`
    destinations.push(path)
  }
  return null
}

export function validateHttpReadProjectionSource(http, properties, manifests) {
  const read = http.readProjection
  if (!read) return null
  const sourceManifest = manifests.get(read.capabilityId)
  const source = sourceManifest?.operations?.find((candidate) => candidate.name === read.operation)
  if (!source || source.http?.method !== 'GET' || source.http.readProjection) {
    return `read projection source ${read.capabilityId}.${read.operation} must be a registered non-nested HTTP GET operation`
  }
  const sourceProperties = source.arguments?.properties || {}
  const boundTargets = new Set()
  for (const binding of read.argumentBindings) {
    if (!Object.hasOwn(sourceProperties, binding.targetArg)) {
      return `read projection target argument ${binding.targetArg} is undeclared by ${read.capabilityId}.${read.operation}`
    }
    if (properties[binding.sourceArg]?.type !== sourceProperties[binding.targetArg]?.type) {
      return `read projection argument types do not match for ${binding.sourceArg} -> ${binding.targetArg}`
    }
    boundTargets.add(binding.targetArg)
  }
  for (const targetArg of [...(source.arguments?.required || []), ...(source.http.pathParams || [])]) {
    if (!boundTargets.has(targetArg)) return `read projection does not bind required source argument ${targetArg}`
  }
  return null
}

export function applyHttpBodyProjections(http, args, body) {
  let projected = body
  for (const { sourceArg, destinationBodyPath } of http.bodyProjections || []) {
    if (!Object.hasOwn(args, sourceArg) || args[sourceArg] === undefined) continue
    projected = insertCopy(projected, destinationBodyPath, args[sourceArg])
  }
  return projected
}

export function assertHttpReadProjectionTargetsAbsent(http, body) {
  if (http.readProjection) assertTargetAbsent(body, http.readProjection.collisionBodyPath)
}

export function applyHttpReadBodyProjections(readProjection, response, body) {
  let projected = body
  for (const { responsePath, destinationBodyPath, valueType } of readProjection.bodyProjections) {
    const value = readPath(response, responsePath)
    if (valueType === 'string' && typeof value !== 'string') {
      throw new TransportBindingError(`read projection source must be a string at "${responsePath.join('.')}"`)
    }
    projected = insertCopy(projected, destinationBodyPath, value)
  }
  return projected
}

export function evaluateHttpReadResponseChecks(readProjection, args, response) {
  for (const check of readProjection.responseChecks) {
    const expected = Object.hasOwn(check, 'equalsArg') ? args[check.equalsArg]
      : Object.hasOwn(check, 'equalsResponsePath') ? readPath(response, check.equalsResponsePath)
        : check.equals
    const actual = readPath(response, check.responsePath)
    if (actual === undefined || !Object.is(actual, expected)) {
      return check.errorCode
    }
  }
  return null
}

function assertTargetAbsent(body, path) {
  let parent = body
  for (const segment of path.slice(0, -1)) {
    if (!isRecord(parent) || !Object.hasOwn(parent, segment)) return
    parent = parent[segment]
    if (!isRecord(parent)) throw new TransportBindingError(`body projection container is not an object at "${segment}"`)
  }
  if (isRecord(parent) && Object.hasOwn(parent, path.at(-1))) {
    throw new TransportBindingError(`body projection target already exists at "${path.at(-1)}"`)
  }
}

function readPath(value, path) {
  let current = value
  for (const segment of path) {
    if (!isRecord(current) || !Object.hasOwn(current, segment)) return undefined
    current = current[segment]
  }
  return current
}

function validResponsePath(path) {
  return Array.isArray(path) && path.length > 0 && path.every((segment) =>
    typeof segment === 'string' && /^[A-Za-z][A-Za-z0-9_]*$/.test(segment) && !forbiddenSegments.has(segment))
}

function validBodyPath(path) {
  return Array.isArray(path) && path.length >= 2 && path.every((segment) =>
    typeof segment === 'string' && /^[A-Za-z][A-Za-z0-9_]*$/.test(segment) && !forbiddenSegments.has(segment))
}

function validateBodyPathParents(path, properties) {
  let parent = properties[path[0]]
  for (const [index, segment] of path.slice(1).entries()) {
    const child = parent?.properties?.[segment]
    if (child === undefined) {
      if (parent?.additionalProperties === false) return `crosses a closed object at "${segment}"`
      parent = undefined
    } else {
      if (index < path.length - 2 && child.type !== 'object') return `crosses a non-object at "${segment}"`
      parent = child
    }
  }
  return null
}

function insertCopy(container, path, value) {
  const [segment, ...rest] = path
  if (!isRecord(container)) throw new TransportBindingError('body projection parent is not an object')
  if (rest.length === 0 && Object.hasOwn(container, segment)) {
    throw new TransportBindingError(`body projection target already exists at "${segment}"`)
  }
  const copy = { ...container }
  if (rest.length === 0) copy[segment] = value
  else {
    const child = Object.hasOwn(container, segment) ? container[segment] : {}
    if (!isRecord(child)) {
      throw new TransportBindingError(`body projection container is not an object at "${segment}"`)
    }
    copy[segment] = insertCopy(child, rest, value)
  }
  return copy
}

function isPrefix(left, right) {
  return left.length <= right.length && left.every((segment, index) => segment === right[index])
}
