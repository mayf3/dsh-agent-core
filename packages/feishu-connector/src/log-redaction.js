const REDACTED = '[REDACTED]'
const UNAVAILABLE = '[UNAVAILABLE]'
const CIRCULAR = '[CIRCULAR]'

const SENSITIVE_KEY_FAMILIES = Object.freeze([
  'secret',
  'token',
  'authorization',
  'auth',
  'bearer',
  'cookie',
  'password',
  'passwd',
  'apikey',
  'credential',
])

function normalizedKey(key) {
  return typeof key === 'string' ? key.toLowerCase().replace(/[^a-z0-9]/g, '') : ''
}

function isSensitiveKey(key) {
  const normalized = normalizedKey(key)
  return normalized !== '' && SENSITIVE_KEY_FAMILIES.some((family) => normalized.includes(family))
}

/**
 * Read data properties without invoking getters. Prototype traversal is needed
 * for Error.name, but accessor descriptors remain unavailable rather than
 * being executed. Proxy descriptor/prototype traps are contained fail-closed.
 */
function safeDataValue(value, key) {
  if ((typeof value !== 'object' || value === null) && typeof value !== 'function') return UNAVAILABLE
  let current = value
  for (let depth = 0; current !== null && depth < 8; depth += 1) {
    let descriptor
    try {
      descriptor = Object.getOwnPropertyDescriptor(current, key)
    } catch {
      return UNAVAILABLE
    }
    if (descriptor !== undefined) {
      return Object.hasOwn(descriptor, 'value') ? descriptor.value : UNAVAILABLE
    }
    try {
      current = Object.getPrototypeOf(current)
    } catch {
      return UNAVAILABLE
    }
  }
  return undefined
}

function normalizedSecrets(secrets) {
  return Array.isArray(secrets)
    ? secrets.filter((secret) => typeof secret === 'string' && secret.length > 0)
    : []
}

function redactSensitiveAssignments(input) {
  const familyPattern = SENSITIVE_KEY_FAMILIES
    .map((family) => family.split('').join('[^a-z0-9]*'))
    .join('|')
  // Once a sensitive assignment starts, fail closed through end-of-string.
  // Delimiters, newlines and trailing text cannot be trusted when quotes are malformed.
  const assignment = new RegExp(
    `((?:${familyPattern})[^:=\\r\\n]*?\\s*[:=]\\s*)[\\s\\S]*`,
    'gi',
  )
  return input.replace(assignment, `$1${REDACTED}`)
}

function redactString(input, secrets) {
  if (typeof input !== 'string') return UNAVAILABLE
  let output = input

  for (const secret of secrets) {
    if (secret !== '') output = output.split(secret).join(REDACTED)
  }

  output = output.replace(/\bBearer\s+[^\s,;"']+/gi, `Bearer ${REDACTED}`)
  return redactSensitiveAssignments(output)
}

function safeUrlPath(value, secrets) {
  if (typeof value !== 'string') return undefined
  const redacted = redactString(value, secrets)
  try {
    const parsed = new URL(redacted, 'https://redaction.invalid')
    return redactString(parsed.pathname, secrets)
  } catch {
    return redactString(redacted.split(/[?#]/, 1)[0], secrets)
  }
}

function safeStringField(value, secrets, fallback) {
  return typeof value === 'string' ? redactString(value, secrets) : fallback
}

function safeError(error, secrets) {
  const config = safeDataValue(error, 'config')
  const response = safeDataValue(error, 'response')
  const request = Object.create(null)
  const method = config && typeof config === 'object' ? safeDataValue(config, 'method') : undefined
  const url = config && typeof config === 'object' ? safeDataValue(config, 'url') : undefined
  const phaseValue = safeDataValue(error, 'phase')
  const requestPhaseValue = safeDataValue(error, 'requestPhase')
  const phase = phaseValue === undefined || phaseValue === UNAVAILABLE ? requestPhaseValue : phaseValue

  if (typeof method === 'string') request.method = redactString(method, secrets).toUpperCase()
  const pathname = safeUrlPath(url, secrets)
  if (pathname) request.endpoint = pathname
  if (typeof phase === 'string') request.phase = redactString(phase, secrets)

  const directStatus = safeDataValue(error, 'status')
  const responseStatus = response && typeof response === 'object'
    ? safeDataValue(response, 'status')
    : undefined
  const status = directStatus === undefined || directStatus === UNAVAILABLE ? responseStatus : directStatus

  const result = Object.create(null)
  result.name = safeStringField(safeDataValue(error, 'name'), secrets, 'Error')
  result.message = safeStringField(safeDataValue(error, 'message'), secrets, '')

  const code = safeDataValue(error, 'code')
  if (typeof code === 'string') result.code = redactString(code, secrets)
  else if (typeof code === 'number') result.code = code

  if (typeof status === 'string') result.status = redactString(status, secrets)
  else if (typeof status === 'number') result.status = status

  if (Object.keys(request).length > 0) result.request = request
  return result
}

function isErrorLike(value) {
  try {
    if (value instanceof Error) return true
  } catch {
    return false
  }
  const name = safeDataValue(value, 'name')
  return typeof name === 'string' && normalizedKey(name) === 'axioserror'
}

function safeOwnKeys(value) {
  try {
    return Object.keys(value).slice(0, 100)
  } catch {
    return null
  }
}

function sanitize(value, secrets, seen, depth) {
  if (typeof value === 'string') return redactString(value, secrets)
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'bigint') return '[BigInt]'
  if (typeof value === 'symbol') return '[Symbol]'
  if (typeof value === 'function') return '[Function]'
  if (depth > 8) return '[MAX_DEPTH]'

  if (isErrorLike(value)) return safeError(value, secrets)
  if (seen.has(value)) return CIRCULAR
  seen.add(value)

  if (Array.isArray(value)) {
    const result = []
    const rawLength = safeDataValue(value, 'length')
    const length = typeof rawLength === 'number' && Number.isSafeInteger(rawLength)
      ? Math.min(Math.max(rawLength, 0), 100)
      : 0
    for (let index = 0; index < length; index += 1) {
      const item = safeDataValue(value, String(index))
      result.push(item === UNAVAILABLE ? UNAVAILABLE : sanitize(item, secrets, seen, depth + 1))
    }
    if (typeof rawLength === 'number' && rawLength > length) result.push(`[${rawLength - length} MORE ITEMS]`)
    return result
  }

  const keys = safeOwnKeys(value)
  if (keys === null) return UNAVAILABLE
  const result = Object.create(null)
  for (const key of keys) {
    const safeKey = redactString(key, secrets)
    if (isSensitiveKey(key)) {
      result[safeKey] = REDACTED
      continue
    }
    const item = safeDataValue(value, key)
    result[safeKey] = item === UNAVAILABLE ? UNAVAILABLE : sanitize(item, secrets, seen, depth + 1)
  }
  return result
}

export function sanitizeLogValue(value, { secrets = [] } = {}) {
  const safeSecrets = normalizedSecrets(secrets)
  try {
    return sanitize(value, safeSecrets, new WeakSet(), 0)
  } catch {
    return UNAVAILABLE
  }
}

export function safeInspect(value, options) {
  try {
    const sanitized = sanitizeLogValue(value, options)
    return typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized)
  } catch {
    return UNAVAILABLE
  }
}

export function createRedactingLogger(log, options) {
  return (level, ...args) => {
    try {
      const safeLevel = typeof level === 'string'
        ? redactString(level, normalizedSecrets(options?.secrets))
        : 'info'
      const safeArgs = args.map((arg) => safeInspect(arg, options))
      log(safeLevel, ...safeArgs)
    } catch {
      // Logging is diagnostic only and must never affect connector lifecycle.
    }
  }
}

export function sdkLoggerAdapter(log, options) {
  const safeLog = createRedactingLogger(log, options)
  const forward = (level) => (...args) => safeLog(level, '[lark-channel]', ...args)
  return {
    debug: forward('debug'),
    info: forward('info'),
    warn: forward('warn'),
    error: forward('error'),
  }
}
