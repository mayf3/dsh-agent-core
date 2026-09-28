import { createHash } from 'node:crypto'

/**
 * FIXED_OPERATION_V1 canonicalization. Mirrors
 * packages/scheduler/src/occurrence-model.js canonicalJSON: recursively
 * key-sorted, no whitespace, undefined omitted. Every digest and invocation
 * id in this package is taken over this canonical form, so equal inputs
 * always mint equal ids regardless of key insertion order.
 */
export function canonicalJSON(value) {
  if (value === undefined) return ''
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** `sha256:<64hex>` over canonicalJSON(value) — the digest style of
 * computePayloadHash / definitionDigest in scheduler. */
export function canonicalDigest(value) {
  return `sha256:${sha256Hex(canonicalJSON(value))}`
}
