import { completeFailure, exactKeys, validCompleteResult } from './complete-contract.js'

/** No retry or read-back: a lost read answer is one bounded failure. */
export async function relayCompleteBody(manifest, request, operation, args) {
  let error = { code: 'transport_failure' }
  try {
    const envelope = await request({ capabilityId: manifest.id, operation, args })
    const parent = exactKeys(envelope, ['ok', 'result']) && envelope.ok === true ? envelope.result : undefined
    if (exactKeys(parent, ['ok', 'result']) && parent.ok === true) {
      if (validCompleteResult(parent.result, args)) return parent.result
      error = { code: 'current_task_body_protocol_error' }
    }
    if (parent?.ok === false) error = parent.error
  } catch { /* Transport details, args and paths never cross this boundary. */ }
  const failure = completeFailure(error, manifest).error
  return { errorCode: failure.code, detail: failure.detail,
    ...(failure.status === undefined ? {} : { status: failure.status }),
    ...(failure.requestId === undefined ? {} : { requestId: failure.requestId }) }
}
