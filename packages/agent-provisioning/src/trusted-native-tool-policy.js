import { createHash } from 'node:crypto'

const POLICY_FIELDS = new Set(['version', 'agentId', 'mode', 'allowedCalls', 'policyDigest'])
const CALL_FIELDS = new Set(['toolName', 'argumentEquals'])
const SHA256_HEX = /^[a-f0-9]{64}$/

function invalid(message) {
  throw Object.assign(new TypeError(`trusted native tool policy: ${message}`), {
    code: 'NATIVE_TOOL_POLICY_INVALID',
  })
}

function assertWellFormedUnicode(value, label) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index)
    if (unit >= 0xD800 && unit <= 0xDBFF) {
      const next = value.charCodeAt(index + 1)
      if (!(next >= 0xDC00 && next <= 0xDFFF)) invalid(`${label} contains an unpaired surrogate`)
      index += 1
    } else if (unit >= 0xDC00 && unit <= 0xDFFF) {
      invalid(`${label} contains an unpaired surrogate`)
    }
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function canonicalJson(value, ancestors = new Set()) {
  if (value === null) return 'null'
  if (typeof value === 'string') {
    assertWellFormedUnicode(value, 'string')
    return JSON.stringify(value)
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) invalid('policy values must use finite JSON numbers')
    return JSON.stringify(value)
  }
  if (typeof value !== 'object') invalid('policy values must be JSON values')
  if (ancestors.has(value)) invalid('policy values cannot be cyclic')

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) invalid('policy arrays must use the standard array prototype')
      const keys = Reflect.ownKeys(value)
      if (keys.length !== value.length + 1 || keys.some((key) => key !== 'length' && !/^(0|[1-9]\d*)$/.test(key))) {
        invalid('policy arrays cannot have extra or sparse properties')
      }
      const items = []
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
          invalid('policy arrays must contain dense data values')
        }
        items.push(canonicalJson(descriptor.value, ancestors))
      }
      return `[${items.join(',')}]`
    }

    if (!isPlainObject(value)) invalid('policy objects must be plain JSON objects')
    const keys = Reflect.ownKeys(value)
    if (keys.some((key) => typeof key !== 'string')) invalid('policy objects cannot contain symbol keys')
    const pairs = keys.map((key) => {
      assertWellFormedUnicode(key, 'object key')
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
        invalid('policy objects must contain enumerable data properties')
      }
      return [key, descriptor.value]
    }).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    return `{${pairs.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item, ancestors)}`).join(',')}}`
  } finally {
    ancestors.delete(value)
  }
}

function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

function exactFields(value, allowed, label) {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key)) invalid(`${label} contains an unsupported field`)
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      invalid(`${label} must contain enumerable data fields`)
    }
  }
}

function selectorsOverlap(left, right) {
  if (left.toolName !== right.toolName) return false
  const leftArgs = left.argumentEquals
  const rightArgs = right.argumentEquals
  if (leftArgs === undefined || rightArgs === undefined) return true
  for (const key of Object.keys(leftArgs)) {
    if (Object.hasOwn(rightArgs, key)
        && canonicalJson(leftArgs[key]) !== canonicalJson(rightArgs[key])) return false
  }
  return true
}

function normalizeAllowedCalls(value) {
  if (!Array.isArray(value)) invalid('allowedCalls must be an array')
  canonicalJson(value)
  const calls = value.map((call) => {
    if (!isPlainObject(call)) invalid('each allowed call must be a plain object')
    exactFields(call, CALL_FIELDS, 'allowed call')
    const toolName = call.toolName
    if (typeof toolName !== 'string' || toolName.length === 0 || toolName.includes('*')) {
      invalid('toolName must be a non-empty exact name without wildcard characters')
    }
    const normalized = { toolName }
    if (Object.hasOwn(call, 'argumentEquals')) {
      const selectors = call.argumentEquals
      if (!isPlainObject(selectors) || Object.keys(selectors).length === 0) {
        invalid('argumentEquals must be a non-empty plain object')
      }
      normalized.argumentEquals = JSON.parse(canonicalJson(selectors))
    }
    return normalized
  })

  for (let left = 0; left < calls.length; left += 1) {
    for (let right = left + 1; right < calls.length; right += 1) {
      if (selectorsOverlap(calls[left], calls[right])) invalid('allowedCalls contains duplicate or overlapping selectors')
    }
  }
  return calls
}

/**
 * Resolve one trusted process-composition policy for an exact registered Agent.
 * The returned immutable object includes the digest sent in DSH initialize.
 */
export function resolveTrustedNativeToolPolicy(policy, expectedAgentId) {
  if (policy === undefined) return undefined
  if (typeof expectedAgentId !== 'string' || expectedAgentId.length === 0) invalid('expected agentId is required')
  if (!isPlainObject(policy)) invalid('policy must be a plain object')
  exactFields(policy, POLICY_FIELDS, 'policy')
  if (policy.version !== 1) invalid('version must be 1')
  if (policy.agentId !== expectedAgentId) invalid('agentId does not match the process identity')
  if (policy.mode !== 'native-allowlist') invalid('mode must be native-allowlist')
  if (!Array.isArray(policy.allowedCalls)) invalid('allowedCalls must be an array')

  const unsigned = {
    version: 1,
    agentId: expectedAgentId,
    mode: 'native-allowlist',
    allowedCalls: normalizeAllowedCalls(policy.allowedCalls),
  }
  const expectedDigest = createHash('sha256').update(canonicalJson(unsigned), 'utf8').digest('hex')
  if (policy.policyDigest !== undefined
      && (typeof policy.policyDigest !== 'string'
        || !SHA256_HEX.test(policy.policyDigest)
        || policy.policyDigest !== expectedDigest)) {
    invalid('policyDigest does not match the canonical policy')
  }
  return deepFreeze({ ...unsigned, policyDigest: expectedDigest })
}

/** Assert that initialize acknowledged the exact policy frozen on this process. */
export function assertTrustedNativeToolPolicyAck(policy, acknowledgement) {
  if (policy === undefined) return
  if (!isPlainObject(acknowledgement)) {
    throw Object.assign(new Error('native tool policy initialize acknowledgement is missing or malformed'), {
      code: 'AGENT_PROCESS_NATIVE_TOOL_POLICY_ACK_MISMATCH',
    })
  }
  const allowed = new Set(['version', 'agentId', 'policyDigest'])
  const keys = Reflect.ownKeys(acknowledgement)
  if (keys.length !== 3 || keys.some((key) => typeof key !== 'string' || !allowed.has(key))) {
    throw Object.assign(new Error('native tool policy initialize acknowledgement does not match the trusted policy'), {
      code: 'AGENT_PROCESS_NATIVE_TOOL_POLICY_ACK_MISMATCH',
    })
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(acknowledgement, key)
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw Object.assign(new Error('native tool policy initialize acknowledgement is malformed'), {
        code: 'AGENT_PROCESS_NATIVE_TOOL_POLICY_ACK_MISMATCH',
      })
    }
  }
  if (acknowledgement.version !== policy.version
      || acknowledgement.agentId !== policy.agentId
      || acknowledgement.policyDigest !== policy.policyDigest) {
    throw Object.assign(new Error('native tool policy initialize acknowledgement does not match the trusted policy'), {
      code: 'AGENT_PROCESS_NATIVE_TOOL_POLICY_ACK_MISMATCH',
    })
  }
}

