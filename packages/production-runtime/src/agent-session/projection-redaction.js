import { redactSensitiveText } from '../../../agent-router/src/process/provider-errors.js'

const FILESYSTEM_PATH_RE = /(^|[\s"'`(=:{,])(?:~\/|\.{1,2}[\\/]|\/(?!\/)|[A-Za-z]:[\\/])[^\s"'`<>|;,)\]}]*/gmu
const ENV_ASSIGNMENT_RE = /(^|[\s"'`({,])([A-Za-z_][A-Za-z0-9_]*)=([^\s"'`),}\]]+)/gmu
const ENV_REFERENCE_RE = /\$(?:\{[A-Za-z_][A-Za-z0-9_]*\}|[A-Za-z_][A-Za-z0-9_]*)/gmu
const PATH_OR_ENV_KEY_RE = /(?:^|_)(?:cwd|pwd|path|home|root|dir|directory|file|filename|env|environment)(?:$|_)/iu

/** Content boundary: secrets, environment values, and filesystem paths never cross. */
export function redactInspectionText(value) {
  return redactSensitiveText(value)
    .replace(ENV_ASSIGNMENT_RE, (_match, prefix, key) => `${prefix}${key}=[REDACTED]`)
    .replace(ENV_REFERENCE_RE, '[REDACTED]')
    .replace(FILESYSTEM_PATH_RE, (_match, prefix) => `${prefix}[REDACTED]`)
}

export function visibleText(content) {
  if (!Array.isArray(content)) return ''
  return redactInspectionText(content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join(''))
}

export function toolResultText(content) {
  if (!Array.isArray(content)) return ''
  const out = []
  for (const block of content) {
    if (block?.type !== 'tool-result' || !Array.isArray(block.content)) continue
    for (const part of block.content) {
      if (part?.type === 'text' && typeof part.text === 'string') out.push(part.text)
    }
  }
  return redactInspectionText(out.join(''))
}

function canonicalValue(value, key = '') {
  if (PATH_OR_ENV_KEY_RE.test(key)) return '[REDACTED]'
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item))
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const childKey of Object.keys(value).sort()) out[childKey] = canonicalValue(value[childKey], childKey)
    return out
  }
  if (typeof value === 'string') return redactInspectionText(value)
  return value
}

export function canonicalArguments(value) {
  let parsed = value
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed) } catch { return null }
  }
  if (parsed === undefined) return null
  try { return redactInspectionText(JSON.stringify(canonicalValue(parsed))) } catch { return null }
}
