/**
 * Deterministic composite public message identity (CTR-SH-012).
 *
 * Public ID = `msg_sh1_` + base64url-no-pad(SHA-256(MSH1 || u32be(7) ||
 * seven length-prefixed UTF-8 elements)), exactly 51 ASCII chars:
 *
 *   ["MOBILE_SESSION_HISTORY_V1", agentId, "main",
 *    currentMainGenerationDigest, role, rawDshMessageId, messageRecordDigest]
 *
 * Generation digest = SHA-256 over the same tuple codec with two elements:
 * [HEADER_SUBSET_CANONICAL, PREFIX_ANCHOR]; PREFIX_ANCHOR = SHA-256 hex of the
 * first complete record's exact bytes; HEADER_SUBSET_CANONICAL = canonical
 * JSON (sorted keys, no whitespace) of {version, id, createdAt, delegationDepth}.
 * `messageRecordDigest` = SHA-256 hex of the message's raw record bytes
 * (newline-terminated), binding every public ID to the record's content.
 */

import { createHash } from 'node:crypto'
import {
  CODEC_TAG,
  LOGICAL_MAIN,
  PUBLIC_MESSAGE_ID_LENGTH,
  PUBLIC_MESSAGE_ID_PREFIX,
  SPEC_TUPLE_CONST,
} from './constants.js'

export const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex')

const sha256B64url = (bytes) => createHash('sha256').update(bytes).digest('base64url')

/** Canonical JSON form: recursively sorted object keys, no whitespace. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * The frozen tuple wire codec: CODEC_TAG (4 ASCII bytes) || u32be element
 * count ||, per element, u32be byte length + UTF-8 bytes (no terminator, no
 * padding, no escaping; empty element = length 0).
 */
export function lengthPrefixedTuple(elements) {
  const head = Buffer.alloc(8)
  head.write(CODEC_TAG, 0, 'ascii')
  head.writeUInt32BE(elements.length, 4)
  const parts = [head]
  for (const element of elements) {
    const bytes = Buffer.from(String(element), 'utf8')
    const len = Buffer.alloc(4)
    len.writeUInt32BE(bytes.length, 0)
    parts.push(len, bytes)
  }
  return Buffer.concat(parts)
}

/** HEADER_SUBSET canonical string for a validated session header. */
export const headerSubsetCanonical = (header) =>
  canonicalJson({
    version: header.version,
    id: header.id,
    createdAt: header.createdAt,
    delegationDepth: header.delegationDepth,
  })

/** currentMainGenerationDigest (CTR-SH-012 generation component), hex lowercase. */
export const currentMainGenerationDigest = (header, prefixAnchorHex) =>
  sha256Hex(lengthPrefixedTuple([headerSubsetCanonical(header), prefixAnchorHex]))

/** Deterministic composite public message ID for one projected message. */
export const publicMessageId = ({ agentId, generationDigest, role, rawId, recordDigest }) =>
  PUBLIC_MESSAGE_ID_PREFIX +
  sha256B64url(
    lengthPrefixedTuple([SPEC_TUPLE_CONST, agentId, LOGICAL_MAIN, generationDigest, role, rawId, recordDigest]),
  )

/**
 * Structural cursor validation (CTR-SH-002 / CTR-SH-006): exact prefix, exact
 * 51-char length, base64url alphabet, canonical round-trip. Returns true only
 * for a well-formed public ID; everything else is a malformed cursor.
 */
export function isWellFormedPublicMessageId(id) {
  if (typeof id !== 'string' || !id.startsWith(PUBLIC_MESSAGE_ID_PREFIX)) return false
  if (id.length !== PUBLIC_MESSAGE_ID_LENGTH) return false
  const encoded = id.slice(PUBLIC_MESSAGE_ID_PREFIX.length)
  if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) return false
  const digest = Buffer.from(encoded, 'base64url')
  return digest.length === 32 && digest.toString('base64url') === encoded
}
