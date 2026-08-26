/** Wire parsing and frozen HTTP response envelopes for Notification Ingress V1. */

export const SESSION_MODES = Object.freeze(['main', 'fresh'])
const BODY_LIMIT_BYTES = 1_000_000

export function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

export function errorBody(code, message) {
  return { error: { code, message } }
}

export function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > BODY_LIMIT_BYTES) {
        rejectBody(Object.assign(new Error('request body too large'), { code: 'VALIDATION_ERROR' }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.trim() === '') { resolveBody({}); return }
      try {
        resolveBody(JSON.parse(text))
      } catch {
        rejectBody(Object.assign(new Error('body must be JSON'), { code: 'VALIDATION_ERROR' }))
      }
    })
    req.on('error', rejectBody)
  })
}

function requireString(body, field) {
  const value = body?.[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw Object.assign(new TypeError(`notification-ingress: ${field} must be a non-empty string`), { code: 'VALIDATION_ERROR' })
  }
  return value
}

/** Read only the four frozen deliver fields; unknown fields remain ignored. */
export function validateDeliverBody(body) {
  const payload = {
    requestId: requireString(body, 'requestId'),
    agentId: requireString(body, 'agentId'),
    sessionMode: requireString(body, 'sessionMode'),
    message: requireString(body, 'message'),
  }
  if (!SESSION_MODES.includes(payload.sessionMode)) {
    throw Object.assign(new TypeError(`notification-ingress: sessionMode must be one of ${SESSION_MODES.join(' | ')}`), { code: 'VALIDATION_ERROR' })
  }
  return payload
}

/** HTTP 200 outcome_unknown response; reconciliation handle is preserved. */
export function unknownResponse(carrier, duplicate) {
  return {
    status: 200,
    body: {
      accepted: false,
      outcome: 'outcome_unknown',
      ...(duplicate ? { duplicate: true } : {}),
      ...(carrier?.reconciliationHandle === undefined ? {} : { reconciliationHandle: carrier.reconciliationHandle }),
      ...(carrier?.deadlineAtWallMs === undefined ? {} : { deadlineAtWallMs: carrier.deadlineAtWallMs }),
      ...(carrier?.evidence === undefined ? {} : { evidence: carrier.evidence }),
    },
  }
}

/** Reuse a durable terminal outcome without calling Router again. */
export function duplicateResponse(record) {
  if (record.state === 'delivered') {
    return {
      status: 200,
      body: { accepted: true, sessionId: record.sessionId, outcome: 'delivered', duplicate: true },
    }
  }
  if (record.state === 'failed_no_admission') {
    return {
      status: record.failure.httpStatus,
      body: errorBody(record.failure.code, 'delivery failed before admission (recorded outcome)'),
    }
  }
  return {
    status: 200,
    body: {
      accepted: false,
      outcome: 'outcome_unknown',
      duplicate: true,
      ...(record.outcomeUnknown?.reconciliationHandle === undefined ? {} : { reconciliationHandle: record.outcomeUnknown.reconciliationHandle }),
    },
  }
}
