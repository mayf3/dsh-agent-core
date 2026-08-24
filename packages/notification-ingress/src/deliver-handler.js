import { parseBasicCredential, redactForLog } from './auth.js'
import { PROVEN_NO_ADMISSION_CODES, canonicalPayloadHash } from './idempotency.js'
import {
  duplicateResponse, errorBody, unknownResponse, validateDeliverBody,
} from './wire-response.js'

/**
 * Build the frozen authenticate → authorize → validate → reserve → Router →
 * settle pipeline. The returned handler produces an HTTP response descriptor.
 */
export function createDeliverHandler({ store, verifier, loadAuth, router, deliverReady }) {
  /** @type {Map<string, {payloadHash:string, promise:Promise<{status:number,body:object}>}>} */
  const inflight = new Map()

  function attemptRouterDelivery(payload, deadlineMs, onLate) {
    return new Promise((resolveAttempt) => {
      let settled = false
      const finish = (descriptor) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolveAttempt(descriptor)
      }
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        resolveAttempt({ kind: 'deadline' })
      }, deadlineMs)
      if (typeof timer.unref === 'function') timer.unref()
      Promise.resolve(router.deliver({ ...payload })).then(
        (result) => {
          if (!settled) finish({ kind: 'resolved', result })
          else onLate({ kind: 'resolved', result })
        },
        (error) => {
          if (!settled) finish({ kind: 'rejected', error })
          else onLate({ kind: 'rejected', error })
        },
      )
    })
  }

  async function runAttempt(callerPrincipalId, payload, deadlineMs) {
    const requestId = payload.requestId
    const lateSettled = (descriptor) => {
      store.recordLateSettled({
        callerPrincipalId,
        requestId,
        settled: descriptor.kind,
        detail: descriptor.kind === 'rejected'
          ? redactForLog(descriptor.error?.message ?? String(descriptor.error))
          : 'resolved after deadline',
      }).catch(() => { /* evidence must never break the answered outcome */ })
    }
    const descriptor = await attemptRouterDelivery(payload, deadlineMs, lateSettled)
    if (descriptor.kind === 'resolved') {
      const result = descriptor.result ?? {}
      const { record } = await store.settle({
        callerPrincipalId,
        requestId,
        state: 'delivered',
        sessionId: typeof result.sessionId === 'string' ? result.sessionId : undefined,
        reason: 'router_accepted',
      })
      return {
        status: 200,
        body: {
          accepted: result.accepted ?? true,
          sessionId: record.sessionId,
          outcome: 'delivered',
          ...(result.status === undefined ? {} : { status: result.status }),
          ...(result.reconciliationHandle === undefined ? {} : { reconciliationHandle: result.reconciliationHandle }),
          ...(result.evidence === undefined ? {} : { evidence: result.evidence }),
        },
      }
    }
    if (descriptor.kind === 'rejected') {
      const error = descriptor.error
      if (error?.code !== undefined && PROVEN_NO_ADMISSION_CODES.includes(error.code)) {
        const httpStatus = error.code === 'AGENT_NOT_FOUND' ? 404 : 400
        await store.settle({
          callerPrincipalId,
          requestId,
          state: 'failed_no_admission',
          failure: { code: error.code, httpStatus },
          reason: `proven_${error.code}`,
        })
        return {
          status: httpStatus,
          body: errorBody(error.code, redactForLog(error.message ?? String(error))),
        }
      }
    }
    const carrier = descriptor.kind === 'rejected' ? descriptor.error : undefined
    const deadlineCarrier = descriptor.kind === 'deadline' ? { source: 'router_deadline' } : undefined
    const unknownDetail = deadlineCarrier ?? {
      source: carrier?.status === 'outcome_unknown' ? 'outcome_unknown_carrier' : (carrier?.code ?? 'router_error'),
    }
    await store.settle({
      callerPrincipalId,
      requestId,
      state: 'outcome_unknown',
      outcomeUnknown: {
        ...(carrier?.reconciliationHandle === undefined ? {} : { reconciliationHandle: carrier.reconciliationHandle }),
        ...(carrier?.deadlineAtWallMs === undefined ? {} : { deadlineAtWallMs: carrier.deadlineAtWallMs }),
        ...unknownDetail,
      },
      reason: unknownDetail.source,
    })
    return unknownResponse(carrier, false)
  }

  return async function handleDeliver(authorizationHeader, body) {
    const auth = loadAuth()
    if (!auth.ok) {
      store.appendEvidence({ kind: 'auth_reject', code: 'AUTH_NOT_CONFIGURED' })
      return { status: 503, body: errorBody('AUTH_NOT_CONFIGURED', `notification ingress auth is not configured (${auth.reason})`) }
    }
    const credential = parseBasicCredential(authorizationHeader)
    if (credential === null) {
      store.appendEvidence({ kind: 'auth_reject', code: 'INVALID_CREDENTIAL' })
      return { status: 401, body: errorBody('INVALID_CREDENTIAL', 'missing or malformed Basic credential') }
    }
    const verification = await verifier.verify(credential, auth.config)
    if (!verification.ok) {
      store.appendEvidence({
        kind: 'auth_reject',
        code: verification.code,
        ...(verification.callerPrincipalId === undefined ? {} : { clientId: verification.callerPrincipalId }),
      })
      if (verification.status === 403) {
        return { status: 403, body: errorBody('CALLER_NOT_ALLOWED', 'verified caller is not on the notification ingress allowlist') }
      }
      if (verification.status === 401) {
        return { status: 401, body: errorBody('INVALID_CREDENTIAL', 'credential is invalid, revoked, or not valid for this surface') }
      }
      return { status: 503, body: errorBody('AUTH_INCONCLUSIVE', 'auth-service verification was inconclusive; retry later') }
    }
    const { callerPrincipalId, callerName } = verification
    store.appendEvidence({ kind: 'auth_ok', clientId: callerPrincipalId, callerName })

    const payload = validateDeliverBody(body)
    if (!deliverReady) {
      return {
        status: 503,
        body: errorBody('SERVICE_UNAVAILABLE', 'agentRouter.deliver is not available; the ingress cannot dispatch'),
      }
    }

    const payloadHash = canonicalPayloadHash(payload)
    const key = `${callerPrincipalId}\u0000${payload.requestId}`
    const pending = inflight.get(key)
    if (pending !== undefined && pending.payloadHash === payloadHash) return pending.promise

    const reservation = await store.reserve({ callerPrincipalId, requestId: payload.requestId, payloadHash })
    if (reservation.outcome === 'conflict') {
      return {
        status: 409,
        body: errorBody('CONFLICT', 'this (caller, requestId) is already recorded with a different payload'),
      }
    }
    if (reservation.outcome === 'terminal') return duplicateResponse(reservation.record)
    if (reservation.outcome === 'reserved') {
      const late = inflight.get(key)
      if (late !== undefined && late.payloadHash === payloadHash) return late.promise
      await store.settleUnresolvedReserved({ callerPrincipalId, requestId: payload.requestId })
      return unknownResponse(undefined, false)
    }

    const attempt = runAttempt(callerPrincipalId, payload, auth.config.routerDeadlineMs)
    inflight.set(key, { payloadHash, promise: attempt })
    try {
      return await attempt
    } finally {
      inflight.delete(key)
    }
  }
}
