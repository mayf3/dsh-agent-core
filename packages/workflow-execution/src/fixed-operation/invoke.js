/**
 * @agent-core/workflow-execution/src/fixed-operation/invoke.js — the
 * FIXED_OPERATION_V1 fail-closed invocation pipeline and the structured
 * operation receipt.
 *
 * Gate order (every miss is a stable denial, ZERO handler execution):
 *   1. request shape        — exact-allowlist {operation_key, expected_version,
 *                             expected_hash, input}; anything else denied.
 *   2. registry lookup      — unknown key or unregistered version ⇒ UNKNOWN_OPERATION.
 *   3. hash pin             — expected_hash ≠ registered contract hash ⇒
 *                             OPERATION_HASH_MISMATCH (a plan pinned to one
 *                             registration never runs a drifted one).
 *   4. trusted caller       — gateway-derived identity required.
 *   5. trusted workflow ctx — runtime-bound execution coordinates required;
 *                             prompt-supplied coordinates do not exist as a
 *                             concept here (the request schema has no field
 *                             for them).
 *   6. input validation     — exact-allowlist against the registered schema.
 *   7. execute              — the registered handler runs ONCE with the
 *                             validated input and a frozen context; its
 *                             outcome (succeeded OR failed) becomes a
 *                             receipt.
 *
 * The receipt is a pure structured return value: it attests what the
 * operation DID, and it never writes workflow business truth (no ledger,
 * store, or transition access exists on this path). `invocationId` is a
 * stable deterministic digest over {contract, coordinates, caller, input}
 * — the ONLY reconcile/idempotency seam V1 commits to: a future durable
 * ledger can key dedupe/reconcile on it without changing this contract.
 */

import { canonicalJson, sha256Hex } from './registry.js'
import { trustedCallerFrom, workflowContextFrom } from './trusted-context.js'

export const FIXED_OPERATION_RECEIPT_VERSION = 1

/** Stable denial vocabulary (capability manifest declares the same table). */
export const FIXED_OPERATION_ERROR_CODES = Object.freeze({
  UNKNOWN_OPERATION: 'unknown_operation',
  OPERATION_HASH_MISMATCH: 'operation_hash_mismatch',
  TRUSTED_CALLER_REQUIRED: 'trusted_caller_required',
  TRUSTED_WORKFLOW_CONTEXT_REQUIRED: 'trusted_workflow_context_required',
  INVALID_ARGUMENTS: 'invalid_arguments',
  INVALID_INPUT: 'invalid_input',
  INTERNAL_ERROR: 'internal_error',
})

const REQUEST_KEYS = new Set(['operation_key', 'expected_version', 'expected_hash', 'input'])
const ERROR_DETAIL_CAP = 200

/** Stable digest of the exact validated input bytes. */
export function inputDigestOf(input) {
  return sha256Hex(canonicalJson(input))
}

/**
 * The stable invocation id: deterministic over contract + execution
 * coordinates + caller + input digest. Same inputs on the same attempt
 * yield the SAME id (the future idempotency key); any different attempt,
 * input, or contract yields a different one.
 */
export function invocationIdOf({ operationKey, version, agentId, workflow, inputDigest }) {
  return sha256Hex(canonicalJson({
    contractId: 'FIXED_OPERATION_INVOCATION_V1',
    operationKey,
    version,
    agentId,
    workflowInstanceId: workflow.workflowInstanceId,
    nodeVisitId: workflow.nodeVisitId,
    attemptId: workflow.attemptId,
    inputDigest,
  }))
}

/** V1 schema check (see registry.validateInputSchema vocabulary). */
export function validateInputAgainstSchema(schema, input) {
  const violations = []
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return ['input must be an object']
  }
  for (const name of schema.required) {
    if (!(name in input) || input[name] === undefined) violations.push(`missing required input property "${name}"`)
  }
  for (const [name, value] of Object.entries(input)) {
    const spec = schema.properties[name]
    if (spec === undefined) {
      violations.push(`unknown input property "${name}"`)
      continue
    }
    const label = `input.${name}`
    if (spec.type === 'array') {
      if (!Array.isArray(value)) violations.push(`${label} must be an array`)
      else {
        for (const [index, entry] of value.entries()) {
          if (!entryMatchesType(spec.items, entry)) violations.push(`${label}[${index}] must be of type ${spec.items.type}`)
        }
      }
      continue
    }
    if (!entryMatchesType(spec, value)) {
      violations.push(`${label} must be of type ${spec.type}`)
      continue
    }
    if (spec.type === 'string' && typeof spec.maxLength === 'number' && value.length > spec.maxLength) {
      violations.push(`${label} must have length <= ${spec.maxLength}`)
    }
    if (spec.enum !== undefined && !spec.enum.includes(value)) violations.push(`${label} must be one of ${JSON.stringify(spec.enum)}`)
  }
  return violations
}

function entryMatchesType(spec, value) {
  switch (spec.type) {
    case 'string': return typeof value === 'string'
    case 'boolean': return typeof value === 'boolean'
    case 'number': return typeof value === 'number' && Number.isFinite(value)
    case 'integer': return typeof value === 'number' && Number.isInteger(value)
    case 'array': return Array.isArray(value)
    default: return false
  }
}

function denial(code, detail) {
  return { ok: false, error: { code, detail } }
}

/**
 * Build the invoker over one registry. `clock` is injected (deterministic
 * tests pin it); production default is Date.now.
 */
export function createFixedOperationInvoker({ registry, clock = () => Date.now() }) {
  if (typeof registry?.resolve !== 'function') throw new TypeError('fixed-operation: registry is required')
  if (typeof clock !== 'function') throw new TypeError('fixed-operation: clock must be a function')

  /**
   * Invoke one registered fixed operation.
   * @param {object} input.trustedContext - the gateway-forwarded trusted
   *   context ({agentId, callerAgentId, workflowExecutionContext}).
   * @param {object} input.request - the model-filled request (select +
   *   parameters ONLY; coordinates/identity have no fields here).
   * @returns {Promise<{ok:true, receipt:object}|{ok:false, error:{code, detail}}>}
   */
  return async function invokeFixedOperation({ trustedContext, request }) {
    if (request === null || typeof request !== 'object' || Array.isArray(request)) {
      return denial(FIXED_OPERATION_ERROR_CODES.INVALID_ARGUMENTS, 'fixed operation request must be an object')
    }
    const unknownKeys = Object.keys(request).filter((key) => !REQUEST_KEYS.has(key))
    if (unknownKeys.length > 0) {
      return denial(FIXED_OPERATION_ERROR_CODES.INVALID_ARGUMENTS, `unknown request properties: ${unknownKeys.sort().join(', ')}`)
    }
    const { operation_key: operationKey, expected_version: expectedVersion, expected_hash: expectedHash, input } = request
    if (typeof operationKey !== 'string' || operationKey === '') {
      return denial(FIXED_OPERATION_ERROR_CODES.INVALID_ARGUMENTS, 'operation_key is required')
    }
    if (typeof expectedVersion !== 'string' || expectedVersion === '') {
      return denial(FIXED_OPERATION_ERROR_CODES.INVALID_ARGUMENTS, 'expected_version is required (fixed operations are invoked at a pinned version)')
    }
    if (typeof expectedHash !== 'string' || !/^[0-9a-f]{64}$/.test(expectedHash)) {
      return denial(FIXED_OPERATION_ERROR_CODES.INVALID_ARGUMENTS, 'expected_hash is required (64-hex operation contract hash)')
    }

    // 2. Registry lookup — unknown key OR unregistered version.
    const entry = registry.resolve(operationKey, expectedVersion)
    if (entry === undefined) {
      return denial(FIXED_OPERATION_ERROR_CODES.UNKNOWN_OPERATION, `no registered fixed operation ${operationKey}@${expectedVersion}`)
    }
    // 3. Hash pin — the caller's pinned contract must be exactly the
    // registered one.
    if (entry.hash !== expectedHash) {
      return denial(FIXED_OPERATION_ERROR_CODES.OPERATION_HASH_MISMATCH, `operation ${operationKey}@${entry.version} contract hash mismatch: pinned ${expectedHash.slice(0, 12)}… != registered ${entry.hash.slice(0, 12)}…`)
    }
    // 4/5. Trusted caller + runtime-bound workflow execution coordinates.
    const agentId = trustedCallerFrom(trustedContext)
    if (agentId === undefined) {
      return denial(FIXED_OPERATION_ERROR_CODES.TRUSTED_CALLER_REQUIRED, 'fixed operations require the gateway-derived trusted caller context')
    }
    const workflow = workflowContextFrom(trustedContext?.workflowExecutionContext)
    if (workflow === undefined) {
      return denial(FIXED_OPERATION_ERROR_CODES.TRUSTED_WORKFLOW_CONTEXT_REQUIRED, 'fixed operations require the runtime-bound workflow_execution context (workflowInstanceId/nodeVisitId/attemptId); prompt-supplied coordinates are not accepted')
    }
    // 6. Input validation against the REGISTERED schema.
    const violations = validateInputAgainstSchema(entry.inputSchema, input === undefined ? {} : input)
    if (violations.length > 0) {
      return denial(FIXED_OPERATION_ERROR_CODES.INVALID_INPUT, `input rejected by the registered schema: ${violations.slice(0, 8).join('; ')}`)
    }

    // 7. Execute once. The handler sees ONLY the validated input and a
    // frozen server-derived context — never the raw request, never any
    // identity-bearing field it could echo into a decision.
    const validatedInput = Object.freeze({ ...(input ?? {}) })
    const inputDigest = inputDigestOf(validatedInput)
    const startedAtMs = clock()
    let result
    let failure
    try {
      result = await entry.execute({
        input: validatedInput,
        context: Object.freeze({
          contractId: entry.contractId,
          operationKey: entry.operationKey,
          version: entry.version,
          agentId,
          ...workflow,
        }),
      })
    } catch (error) {
      failure = String(error?.message ?? error).slice(0, ERROR_DETAIL_CAP)
    }
    const finishedAtMs = clock()
    const receipt = Object.freeze({
      receiptVersion: FIXED_OPERATION_RECEIPT_VERSION,
      operationKey: entry.operationKey,
      version: entry.version,
      operationHash: entry.hash,
      invocationId: invocationIdOf({ operationKey: entry.operationKey, version: entry.version, agentId, workflow, inputDigest }),
      inputDigest,
      workflow: Object.freeze({ ...workflow }),
      agent: Object.freeze({ agentId }),
      startedAtMs,
      finishedAtMs,
      status: failure === undefined ? 'succeeded' : 'failed',
      ...(failure === undefined ? { result } : { error: { message: failure } }),
    })
    return { ok: true, receipt }
  }
}
