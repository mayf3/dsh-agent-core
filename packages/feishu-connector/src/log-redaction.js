const REDACTED = '[REDACTED]'
const UNAVAILABLE = '[UNAVAILABLE]'
const CIRCULAR = '[CIRCULAR]'

const SENSITIVE_KEYS = new Set([
  'appsecret',
  'clientsecret',
  'secret',
  'authorization',
  'bearer',
  'tenantaccesstoken',
  'accesstoken',
  'refreshtoken',
  'cookie',
  'setcookie',
  'password',
  'apikey',
  'token',
])

function normalizedKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isSensitiveKey(key) {
  return SENSITIVE_KEYS.has(normalizedKey(key))
}

function safeGet(value, key) {
  try {
    return value?.[key]
  } catch {
    return UNAVAILABLE
  }
}

function redactString(input, secrets) {
  let output = String(input)

  for (const secret of secrets) {
    if (secret !== '') output = output.split(secret).join(REDACTED)
  }

  output = output.replace(/\bBearer\s+[^\s,;"']+/gi, `Bearer ${REDACTED}`)
  output = output.replace(
    /(["']?(?:app[_-]?secret|client[_-]?secret|secret|authorization|tenant[_-]?access[_-]?token|access[_-]?token|refresh[_-]?token|cookie|set[_-]?cookie|password|api[_-]?key|token)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^&\s,;}]+)/gi,
    `$1${REDACTED}`,
  )
  return output
}

function safeUrlPath(value, secrets) {
  if (typeof value !== 'string') return undefined
  const redacted = redactString(value, secrets)
  try {
    const parsed = new URL(redacted, 'https://redaction.invalid')
    return parsed.pathname
  } catch {
    return redacted.split(/[?#]/, 1)[0]
  }
}

function safeError(error, secrets) {
  const config = safeGet(error, 'config')
  const response = safeGet(error, 'response')
  const request = {}
  const method = config && typeof config === 'object' ? safeGet(config, 'method') : undefined
  const url = config && typeof config === 'object' ? safeGet(config, 'url') : undefined
  const phase = safeGet(error, 'phase') ?? safeGet(error, 'requestPhase')

  if (typeof method === 'string') request.method = redactString(method.toUpperCase(), secrets)
  const pathname = safeUrlPath(url, secrets)
  if (pathname) request.endpoint = pathname
  if (typeof phase === 'string') request.phase = redactString(phase, secrets)

  const status = safeGet(error, 'status') ?? (
    response && typeof response === 'object' ? safeGet(response, 'status') : undefined
  )
  const result = {
    name: redactString(safeGet(error, 'name') ?? 'Error', secrets),
    message: redactString(safeGet(error, 'message') ?? '', secrets),
  }
  const code = safeGet(error, 'code')
  if (typeof code === 'string' || typeof code === 'number') result.code = redactString(code, secrets)
  if (typeof status === 'string' || typeof status === 'number') result.status = status
  if (Object.keys(request).length > 0) result.request = request
  return result
}

function sanitize(value, secrets, seen, depth) {
  if (typeof value === 'string') return redactString(value, secrets)
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'bigint') return String(value)
  if (typeof value === 'symbol') return String(value)
  if (typeof value === 'function') return `[Function${value.name ? ` ${value.name}` : ''}]`
  if (depth > 8) return '[MAX_DEPTH]'

  if (value instanceof Error || normalizedKey(safeGet(value, 'name')) === 'axioserror') {
    return safeError(value, secrets)
  }
  if (seen.has(value)) return CIRCULAR
  seen.add(value)

  if (Array.isArray(value)) {
    const result = []
    const length = Math.min(value.length, 100)
    for (let index = 0; index < length; index += 1) {
      try {
        result.push(sanitize(value[index], secrets, seen, depth + 1))
      } catch {
        result.push(UNAVAILABLE)
      }
    }
    if (value.length > length) result.push(`[${value.length - length} MORE ITEMS]`)
    return result
  }

  let keys
  try {
    keys = Object.keys(value).slice(0, 100)
  } catch {
    return UNAVAILABLE
  }
  const result = {}
  for (const key of keys) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED
      continue
    }
    const item = safeGet(value, key)
    result[key] = item === UNAVAILABLE ? UNAVAILABLE : sanitize(item, secrets, seen, depth + 1)
  }
  return result
}

export function sanitizeLogValue(value, { secrets = [] } = {}) {
  const normalizedSecrets = secrets
    .filter((secret) => typeof secret === 'string' && secret.length > 0)
    .map(String)
  try {
    return sanitize(value, normalizedSecrets, new WeakSet(), 0)
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
      log(level, ...args.map((arg) => safeInspect(arg, options)))
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
