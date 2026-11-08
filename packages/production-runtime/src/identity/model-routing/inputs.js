import { lstatSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { invalid } from '../provider-environment.js'

export const digest = value => createHash('sha256').update(value).digest('hex')

// Copy all own JSON configuration fields, including explicit undefined/absence.
// Reject values whose identity cannot be captured rather than guessing equality.
export function immutable(value) {
  if (value === null || ['string', 'boolean', 'undefined'].includes(typeof value)) return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return Object.freeze(value.map(immutable))
  if (typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw invalid('configuration context is not comparable')
  }
  return Object.freeze(Object.fromEntries(Object.keys(value).sort().map(key => [key, immutable(value[key])])))
}

export function identity(value) {
  const encode = entry => {
    if (entry === undefined) return ['undefined']
    if (entry === null) return ['null']
    if (Array.isArray(entry)) return ['array', entry.map(encode)]
    if (typeof entry === 'object') return ['object', Object.keys(entry).sort().map(key => [key, encode(entry[key])])]
    return [typeof entry, entry]
  }
  return JSON.stringify(encode(value))
}

export function captureModelOverrideFile(file) {
  try {
    const bytes = readFileSync(file)
    return Object.freeze({ file, filePresent: true, source: bytes.toString('utf8'), sourceSha256: digest(bytes) })
  } catch (cause) {
    if (cause?.code === 'ENOENT') {
      // A dangling/unreadable entry is not a proved absence.
      try { lstatSync(file) } catch (entryError) {
        if (entryError?.code === 'ENOENT') return Object.freeze({ file, filePresent: false, source: undefined })
      }
    }
    throw invalid('cannot read routing candidate', cause)
  }
}

/** Only public artifacts are hashed. Credential paths are identities, never reads. */
function artifactInputs(options, globalRoute) {
  const paths = options.artifactContext ?? {}
  const subscription = globalRoute?.subscription ?? {}
  const values = {}
  for (const key of ['packageArtifact', 'sourceStamp']) {
    const path = paths[key] ?? subscription[key]
    if (path !== undefined) {
      try { values[key] = { path, sha256: digest(readFileSync(path)) } }
      catch (cause) { throw invalid('routing artifact unavailable', cause) }
    }
  }
  return values
}

export function captureRoutingInputs(file, registeredAgentIds, readContext) {
  const context = immutable(readContext())
  const captured = captureModelOverrideFile(file)
  const validationContext = immutable({
    ...context,
    registeredAgentIds,
    artifacts: artifactInputs(context.options ?? {}, context.globalRoute),
  })
  return Object.freeze({
    ...captured,
    context: validationContext,
    candidateId: `routing-${digest(identity({ ...captured, context: validationContext }))}`,
  })
}

/** Diagnostic projection only. Never used to construct a runtime route. */
export function targetClosure(candidate, agentId) {
  const parsed = candidate.filePresent ? JSON.parse(candidate.source) : { overrides: {}, routeCatalog: {} }
  const present = Object.hasOwn(parsed.overrides, agentId)
  const entry = present ? parsed.overrides[agentId] : undefined
  const refs = present ? [entry.model.primary, ...entry.model.fallbacks] : []
  if (refs.some(ref => !Object.hasOwn(parsed.routeCatalog, ref))) return undefined
  return identity(immutable({
    present, entry,
    descriptors: refs.map(ref => [ref, parsed.routeCatalog[ref]]),
    context: candidate.context,
  }))
}
