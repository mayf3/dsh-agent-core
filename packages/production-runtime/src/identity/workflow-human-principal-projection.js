/**
 * Trusted LOCAL handler for AGENT_CORE_WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_V0.
 * One exact Principal is preflighted, conditionally provisioned once, and
 * freshly read back. Credentials, caller identity, URLs, source, enabled, and
 * idempotency are runtime-owned and never enter through model arguments.
 */

import { randomUUID } from 'node:crypto'

import {
  TARGET_HUMAN_PRINCIPAL_ID,
  WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID,
} from '../../../broker/src/capabilities/workflow-human-principal-projection.js'

const REQUEST_TIMEOUT_MS = 5000
const ADMIN_PATH = '/internal/v1/admin/principals'
const EXPECTED_KEYS = ['principalId', 'principalType', 'status']
const FIXED_BODY = Object.freeze({
  principalId: TARGET_HUMAN_PRINCIPAL_ID,
  principalType: 'human',
  enabled: true,
  source: 'auth-service',
})

function deny(code, detail) {
  return { ok: false, error: { code, detail } }
}

/** Authoritative exact-input validation; this is the handler's first action. */
export function validateProjectionArgs(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, detail: 'arguments must be an object with exactly principalId, principalType, status' }
  }
  const keys = Object.keys(input).sort()
  if (keys.length !== EXPECTED_KEYS.length || !EXPECTED_KEYS.every((key, index) => key === keys[index])) {
    return { ok: false, detail: 'arguments must contain exactly principalId, principalType, status' }
  }
  if (input.principalId !== TARGET_HUMAN_PRINCIPAL_ID
    || input.principalType !== 'HUMAN'
    || input.status !== 'active') {
    return { ok: false, detail: 'arguments do not match the frozen Human projection target' }
  }
  return { ok: true }
}

function serviceCode(body) {
  return typeof body?.error?.code === 'string' ? body.error.code : undefined
}

function mapServiceFailure(response) {
  const code = serviceCode(response.body)
  if (response.status === 401) return { code: 'credential_invalid', detail: 'svc-workflow rejected the access token' }
  if (response.status === 403) {
    if (code === 'provisioning_not_allowed' || code === 'provisioning_bootstrap_target_mismatch') {
      return { code: 'provisioning_not_allowed', detail: 'svc-workflow rejected the provisioning actor' }
    }
    if (code === 'provisioning_actor_not_provisioned') {
      return { code, detail: 'the provisioning actor is not provisioned' }
    }
    return { code: 'access_denied', detail: 'svc-workflow denied workflow.admin provisioning access' }
  }
  const preserved = new Set([
    'principal_not_found',
    'principal_type_conflict',
    'principal_type_invalid',
    'invalid_input',
    'invalid_idempotency_key',
    'idempotency_conflict',
    'command_still_processing',
    'internal_consistency_error',
    'service_unavailable',
  ])
  if (preserved.has(code)) return { code, detail: `svc-workflow returned ${code}` }
  if (response.status >= 500) return { code: 'service_unavailable', detail: 'svc-workflow is unavailable' }
  return { code: 'malformed_response', detail: 'svc-workflow returned an undeclared response' }
}

async function fetchJson(fetchImpl, url, init, timeoutMs) {
  let response
  try {
    response = await fetchImpl(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) })
  } catch {
    return { kind: 'transport_failure' }
  }
  if (!Number.isInteger(response?.status)) return { kind: 'malformed_response' }
  let body
  try {
    body = await response.json()
  } catch {
    return { kind: 'response', status: response.status, malformedBody: true }
  }
  return { kind: 'response', status: response.status, body }
}

function exactProjection(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return undefined
  const keys = Object.keys(body).sort()
  if (keys.length !== 3 || !['enabled', 'principalId', 'principalType'].every((key, index) => key === keys[index])) {
    return undefined
  }
  if (body.principalId !== TARGET_HUMAN_PRINCIPAL_ID || typeof body.principalType !== 'string' || typeof body.enabled !== 'boolean') {
    return undefined
  }
  return { principalType: body.principalType, enabled: body.enabled }
}

async function readProjection({ fetchImpl, workflowOrigin, token, timeoutMs }) {
  const response = await fetchJson(
    fetchImpl,
    `${workflowOrigin}${ADMIN_PATH}/${encodeURIComponent(TARGET_HUMAN_PRINCIPAL_ID)}`,
    { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    timeoutMs,
  )
  if (response.kind !== 'response') return { kind: 'unavailable' }
  if (response.status === 200) {
    if (response.malformedBody) return { kind: 'malformed' }
    const projection = exactProjection(response.body)
    if (projection === undefined) return { kind: 'malformed' }
    if (projection.principalType !== 'human') return { kind: 'conflict' }
    return projection.enabled ? { kind: 'ready' } : { kind: 'disabled' }
  }
  if (response.status === 404 && serviceCode(response.body) === 'principal_not_found') return { kind: 'absent' }
  return { kind: 'error', ...mapServiceFailure(response) }
}

function ready(outcome) {
  return {
    ok: true,
    result: {
      outcome,
      workflowPrincipalProjection: 'READY',
      principalId: TARGET_HUMAN_PRINCIPAL_ID,
      principalType: 'HUMAN',
      status: 'active',
    },
  }
}

/**
 * Create the exact projection LOCAL provider.
 * @param {object} deps
 * @param {string} deps.workflowOrigin fixed svc-workflow origin
 * @param {({agentId:string}) => Promise<{accessToken:string}>} deps.acquireCallerToken
 * @param {typeof fetch} [deps.fetchImpl]
 * @param {number} [deps.timeoutMs]
 * @param {() => string} [deps.createIdempotencyKey]
 */
export function createWorkflowHumanPrincipalProjectionAccess({
  workflowOrigin,
  acquireCallerToken,
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
  createIdempotencyKey = randomUUID,
}) {
  if (workflowOrigin !== undefined && (typeof workflowOrigin !== 'string' || workflowOrigin === '')) {
    throw new TypeError('workflow-human-principal-projection: workflowOrigin must be a non-empty string when provided')
  }
  if (typeof acquireCallerToken !== 'function') {
    throw new TypeError('workflow-human-principal-projection: acquireCallerToken seam is required')
  }
  if (typeof fetchImpl !== 'function' || typeof createIdempotencyKey !== 'function') {
    throw new TypeError('workflow-human-principal-projection: fetch/idempotency seams are required')
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > REQUEST_TIMEOUT_MS) {
    throw new TypeError(`workflow-human-principal-projection: timeoutMs must be 1..${REQUEST_TIMEOUT_MS}`)
  }
  const origin = typeof workflowOrigin === 'string' ? workflowOrigin.replace(/\/+$/, '') : undefined

  async function provision(rawArgs, context) {
    const checked = validateProjectionArgs(rawArgs)
    if (!checked.ok) return deny('invalid_arguments', checked.detail)
    if (origin === undefined || origin === '') return deny('transport_failure', 'the fixed svc-workflow origin is not configured')

    const callerAgentId = context?.callerAgentId
    if (typeof callerAgentId !== 'string' || callerAgentId === '') {
      return deny('internal_error', 'trusted caller identity missing from the gateway context')
    }
    let tokenResult
    try {
      tokenResult = await acquireCallerToken({ agentId: callerAgentId })
    } catch (error) {
      const code = ['credential_unavailable', 'credential_invalid', 'access_denied', 'transport_failure'].includes(error?.code)
        ? error.code
        : 'transport_failure'
      return deny(code, 'trusted workflow.admin token acquisition failed')
    }
    const token = tokenResult?.accessToken
    if (typeof token !== 'string' || token === '') return deny('transport_failure', 'trusted token seam returned no access token')

    const preflight = await readProjection({ fetchImpl, workflowOrigin: origin, token, timeoutMs })
    if (preflight.kind === 'ready') return ready('existing')
    if (preflight.kind === 'conflict') return deny('principal_type_conflict', 'the exact UUID already belongs to a non-Human Principal')
    if (preflight.kind === 'malformed') return deny('malformed_response', 'the preflight readback is malformed')
    if (preflight.kind === 'unavailable') return deny('service_unavailable', 'the preflight readback is unavailable')
    if (preflight.kind === 'error') return deny(preflight.code, preflight.detail)

    let idempotencyKey
    try {
      idempotencyKey = createIdempotencyKey()
    } catch {
      return deny('internal_error', 'trusted idempotency-key generation failed')
    }
    if (typeof idempotencyKey !== 'string' || idempotencyKey === '' || idempotencyKey.length > 128 || /[\x00-\x1f\x7f]/.test(idempotencyKey)) {
      return deny('internal_error', 'trusted idempotency-key generation failed validation')
    }

    const post = await fetchJson(fetchImpl, `${origin}${ADMIN_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(FIXED_BODY),
    }, timeoutMs)

    // Mandatory exactly-one fresh readback after every POST outcome.
    const readback = await readProjection({ fetchImpl, workflowOrigin: origin, token, timeoutMs })
    if (readback.kind === 'ready') return ready('provisioned')
    if (readback.kind === 'conflict') return deny('principal_type_conflict', 'post-write readback found a non-Human Principal')
    if (readback.kind === 'unavailable') {
      return deny('projection_outcome_unknown', 'the POST outcome cannot be reconciled because fresh readback is unavailable')
    }
    if (readback.kind === 'error') {
      return deny('projection_outcome_unknown', 'the POST outcome cannot be reconciled because fresh readback was denied or failed')
    }
    if (readback.kind === 'malformed') return deny('readback_mismatch', 'post-write readback is malformed')

    if (post.kind !== 'response' || post.malformedBody) {
      return deny('projection_outcome_unknown', 'the POST outcome is unknown and readback does not prove READY')
    }
    if (post.status >= 200 && post.status < 300) {
      return deny('readback_mismatch', `post-write readback is ${readback.kind}, not the exact active Human projection`)
    }
    const mapped = mapServiceFailure(post)
    return deny(mapped.code, mapped.detail)
  }

  return {
    handlers: {
      [WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID]: { provision },
    },
  }
}
