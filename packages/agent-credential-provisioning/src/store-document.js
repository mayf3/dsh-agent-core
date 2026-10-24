/**
 * @agent-core/agent-credential-provisioning/src/store-document.js — byte-level
 * handling of the V1 credential store document: trusted-UTF-8 decode,
 * structural scanning (byte offsets, never re-serialization), in-place byte
 * splice serialization (extracted from store-writer.js under
 * CODE_STRUCTURE_GUARDRAILS_V1 §6; no behavior change).
 *
 * THE document invariant: a write touches exactly the target entry's bytes —
 * every other byte (hostile formatting included) is preserved verbatim.
 */

import { TextDecoder } from 'node:util'

import { CREDENTIALS_STORE_VERSION } from '../../broker/src/credential-store.js'

import { storeError } from './store-trust.js'

export function decodeTrustedStoreUtf8(bytes, storeFile) {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    throw storeError(`credential provisioning: credentials store contains invalid UTF-8: ${storeFile}`)
  }
}

function scanString(raw, start) {
  if (raw[start] !== '"') throw storeError('credential provisioning: internal JSON scan failed')
  let index = start + 1
  for (; index < raw.length; index += 1) {
    if (raw[index] === '\\') {
      index += 1
      if (raw[index] === 'u') index += 4
    } else if (raw[index] === '"') {
      return index + 1
    }
  }
  throw storeError('credential provisioning: internal JSON scan failed')
}

function skipWhitespace(raw, start) {
  let index = start
  while (/\s/u.test(raw[index] ?? '')) index += 1
  return index
}

function scanValue(raw, start) {
  const index = skipWhitespace(raw, start)
  if (raw[index] === '"') return scanString(raw, index)
  if (raw[index] === '{' || raw[index] === '[') {
    const close = raw[index] === '{' ? '}' : ']'
    let cursor = index + 1
    while (cursor < raw.length) {
      if (raw[cursor] === '"') cursor = scanString(raw, cursor)
      else if (raw[cursor] === '{' || raw[cursor] === '[') cursor = scanValue(raw, cursor)
      else if (raw[cursor] === close) return cursor + 1
      else cursor += 1
    }
    throw storeError('credential provisioning: internal JSON scan failed')
  }
  let cursor = index
  while (cursor < raw.length && !/[\s,}\]]/u.test(raw[cursor])) cursor += 1
  return cursor
}

export function locateCredentialsObject(raw) {
  let cursor = skipWhitespace(raw, 0)
  if (raw[cursor] !== '{') throw storeError('credential provisioning: internal JSON scan failed')
  cursor += 1
  let match
  while (true) {
    cursor = skipWhitespace(raw, cursor)
    if (raw[cursor] === '}') break
    const keyStart = cursor
    const keyEnd = scanString(raw, keyStart)
    const key = JSON.parse(raw.slice(keyStart, keyEnd))
    cursor = skipWhitespace(raw, keyEnd)
    if (raw[cursor] !== ':') throw storeError('credential provisioning: internal JSON scan failed')
    const valueStart = skipWhitespace(raw, cursor + 1)
    const valueEnd = scanValue(raw, valueStart)
    if (key === 'credentials') match = { valueStart, valueEnd }
    cursor = skipWhitespace(raw, valueEnd)
    if (raw[cursor] === ',') cursor += 1
    else if (raw[cursor] !== '}') throw storeError('credential provisioning: internal JSON scan failed')
  }
  if (match === undefined || raw[match.valueStart] !== '{' || raw[match.valueEnd - 1] !== '}') {
    throw storeError('credential provisioning: internal JSON scan failed')
  }
  return { start: match.valueStart, end: match.valueEnd }
}

/** Replace exactly one existing entry in place, preserving every other byte. */
export function serializeWithReplacedCredential(current, agentId, credential) {
  const replacement = `${JSON.stringify(agentId)}:${JSON.stringify({
    clientId: credential.clientId,
    clientSecret: credential.clientSecret,
  })}`
  const raw = current.raw
  let index = current.credentialsSpan.start + 1
  const end = current.credentialsSpan.end - 1
  while (index < end) {
    index = skipWhitespace(raw, index)
    const ch = raw[index]
    if (ch === undefined || ch === '}') break
    if (ch === ',') { index += 1; continue }
    if (ch !== '"') throw storeError('credential provisioning: internal JSON scan failed')
    const keyStart = index
    index = scanString(raw, index)
    const key = JSON.parse(raw.slice(keyStart, index))
    index = skipWhitespace(raw, index)
    if (raw[index] !== ':') throw storeError('credential provisioning: internal JSON scan failed')
    index = skipWhitespace(raw, index + 1)
    const valueStart = index
    index = scanValue(raw, index)
    if (key === agentId) {
      return raw.slice(0, keyStart) + replacement + raw.slice(index)
    }
  }
  throw storeError(`credential provisioning: target credential entry does not exist for ${agentId}`)
}

/** Add exactly one absent target entry while preserving every pre-existing byte. */
export function serializeWithAddedCredential(current, agentId, credential) {
  const entry = `${JSON.stringify(agentId)}:${JSON.stringify({
    clientId: credential.clientId,
    clientSecret: credential.clientSecret,
  })}`
  if (current.raw === undefined) {
    return `${JSON.stringify({
      version: CREDENTIALS_STORE_VERSION,
      credentials: { [agentId]: { clientId: credential.clientId, clientSecret: credential.clientSecret } },
    }, null, 2)}\n`
  }
  const { start, end } = current.credentialsSpan
  const body = current.raw.slice(start + 1, end - 1)
  const separator = body.trim() === '' ? '' : ','
  return `${current.raw.slice(0, end - 1)}${separator}${entry}${current.raw.slice(end - 1)}`
}
