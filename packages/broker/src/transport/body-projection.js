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

export function applyHttpBodyProjections(http, args, body) {
  let projected = body
  for (const { sourceArg, destinationBodyPath } of http.bodyProjections || []) {
    if (!Object.hasOwn(args, sourceArg) || args[sourceArg] === undefined) continue
    projected = insertCopy(projected, destinationBodyPath, args[sourceArg])
  }
  return projected
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
