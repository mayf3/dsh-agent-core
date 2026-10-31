import { loadCredentialFor } from '../../../broker/src/credential-store.js'
import { requestAccessToken } from '../../../broker/src/transport.js'

const TIMEOUT_MS = 5_000

/** Read the accepted svc-workflow owner-resume proof using a trusted caller token. */
export function createOwnerAssistanceResumeEvidenceRead({ workflowOrigin, acquireCallerToken, fetchImpl = fetch, timeoutMs = TIMEOUT_MS }) {
  if (typeof workflowOrigin !== 'string' || workflowOrigin === '') throw new TypeError('owner-assistance-resume-evidence: workflowOrigin is required')
  if (typeof acquireCallerToken !== 'function') throw new TypeError('owner-assistance-resume-evidence: acquireCallerToken is required')
  if (typeof fetchImpl !== 'function') throw new TypeError('owner-assistance-resume-evidence: fetchImpl is required')
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > TIMEOUT_MS) throw new TypeError('owner-assistance-resume-evidence: timeoutMs is invalid')
  const origin = workflowOrigin.replace(/\/+$/, '')
  return async function read({ callerAgentId, dispatchIntentId, previousAttemptId, preDeliveryWorkflowStateVersion }) {
    if (typeof callerAgentId !== 'string' || callerAgentId === ''
      || typeof dispatchIntentId !== 'string' || dispatchIntentId === ''
      || typeof previousAttemptId !== 'string' || previousAttemptId === ''
      || !Number.isInteger(preDeliveryWorkflowStateVersion) || preDeliveryWorkflowStateVersion < 1) {
      return { ok: false, code: 'invalid_arguments' }
    }
    let tokenResult
    try { tokenResult = await acquireCallerToken({ agentId: callerAgentId }) } catch { return { ok: false, code: 'token_unavailable' } }
    const token = tokenResult?.accessToken
    if (typeof token !== 'string' || token === '') return { ok: false, code: 'token_unavailable' }
    const query = new URLSearchParams({ previousAttemptId, preDeliveryWorkflowStateVersion: String(preDeliveryWorkflowStateVersion) })
    let response
    try {
      response = await fetchImpl(`${origin}/internal/v1/dispatch-intents/${encodeURIComponent(dispatchIntentId)}/owner-assistance-resume-evidence?${query}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch { return { ok: false, code: 'transport_failure' } }
    if (response.status !== 200) return { ok: false, code: `http_${response.status}` }
    let body
    try { body = await response.json() } catch { return { ok: false, code: 'malformed_response' } }
    if (body === null || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'evidence')
      || !(body.evidence === null || (body.evidence !== null && typeof body.evidence === 'object' && !Array.isArray(body.evidence)))) {
      return { ok: false, code: 'malformed_response' }
    }
    return { ok: true, evidence: body.evidence }
  }
}

export function provideOwnerAssistanceResumeEvidenceAccess({ ctx, workflowOrigin, brokerCredentialsFile, brokerAuthServiceOrigin }) {
  ctx.provide('workflowAssistanceResumeEvidenceAccess', createOwnerAssistanceResumeEvidenceRead({
    workflowOrigin,
    acquireCallerToken: async ({ agentId }) => {
      const credential = loadCredentialFor(brokerCredentialsFile, agentId)
      if (credential === undefined) throw Object.assign(new Error('no credential bound'), { code: 'credential_unavailable' })
      try {
        return await requestAccessToken({ credential, authServiceOrigin: brokerAuthServiceOrigin, resource: 'svc-workflow', scope: 'workflow.read' })
      } catch (error) {
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), { code: error?.errorCode ?? 'transport_failure' })
      }
    },
  }))
}
