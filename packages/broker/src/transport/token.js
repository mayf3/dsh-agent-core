/** Token endpoint path (auth-service V1 contract, evidence: auth-service/src/routes/oauth.ts). */
export const TOKEN_ENDPOINT_PATH = '/oauth/token'

/** Default per-request timeout. */
export const DEFAULT_TIMEOUT_MS = 15000


/** Stable Broker classifications for failures returned by the token endpoint. */
export const TOKEN_FAILURE_CODES = Object.freeze({
  credential: 'credential_invalid',
  authorization: 'authorization_denied',
  downstream: 'transport_failure',
})

/**
 * A redacted token-endpoint failure. Response bodies can contain sensitive
 * diagnostics and are deliberately never retained in the Error object.
 */
export class TokenEndpointError extends Error {
  constructor(message, { status, oauthError, errorCode = TOKEN_FAILURE_CODES.downstream } = {}) {
    super(message)
    this.name = 'TokenEndpointError'
    this.status = status
    this.oauthError = oauthError
    this.errorCode = errorCode
  }
}

/** Map OAuth wire errors onto the minimal stable Broker responsibility layers. */
export function classifyTokenEndpointFailure(status, oauthError) {
  if (status === 401 && oauthError === 'invalid_client') return TOKEN_FAILURE_CODES.credential
  if (status === 403 && oauthError === 'insufficient_scope') return TOKEN_FAILURE_CODES.authorization
  if (
    status === 400
    && ['invalid_scope', 'invalid_grant', 'invalid_resource'].includes(oauthError)
  ) return TOKEN_FAILURE_CODES.authorization
  return TOKEN_FAILURE_CODES.downstream
}

const KNOWN_OAUTH_ERRORS = new Set([
  'invalid_client', 'invalid_scope', 'invalid_grant', 'invalid_resource',
  'invalid_target', 'insufficient_scope', 'temporarily_unavailable',
])

/**
 * Issue ONE access token via the auth-service `client_credentials` grant —
 * the SAME primitive the HTTP transport uses, exported for thin reuse by
 * LOCAL (in-process) capabilities whose authorization is the Auth grant
 * (AGENT_DEFINITION_ACCESS_V1: agent.definition.write checks the scope
 * `agent.definition.write` here — the auth-service is the ONLY grant
 * authority; a failed/denied token request means the caller's grant does
 * not cover the requested scope and the call fails closed).
 *
 * @param {object} opts
 * @param {{clientId:string, clientSecret:string}} opts.credential - the
 *   caller's MachineClient credential (from the trusted store).
 * @param {string} opts.authServiceOrigin - token endpoint origin.
 * @param {string} opts.resource - nominal resource the token is minted for.
 * @param {string} opts.scope - space-separated scope list requested.
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{accessToken:string, expiresIn:number}>}
 * @throws {Error} when the token endpoint is unreachable, denies the
 *   request, or returns a malformed body — every failure is a DENIAL.
 */
export async function requestAccessToken({
  credential,
  authServiceOrigin,
  resource,
  scope,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  control,
}) {
  const basic = Buffer.from(`${credential.clientId}:${credential.clientSecret}`).toString('base64')
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    resource,
    scope,
  })
  let res
  try {
    const send = () => fetchImpl(`${authServiceOrigin}${TOKEN_ENDPOINT_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      ...(control ? { redirect: 'error' } : {}),
      signal: control?.signal ?? AbortSignal.timeout(timeoutMs),
    })
    res = control ? await control.wait(send) : await send()
  } catch (err) {
    if (control?.signal.aborted) control.check()
    throw new TokenEndpointError('token endpoint unreachable')
  }
  let controlledBody
  if (control) {
    const text = await control.readEntity(res)
    try { controlledBody = JSON.parse(text) }
    catch {
      if (res.ok) throw new TokenEndpointError('token endpoint returned a malformed JSON body')
      controlledBody = {}
    }
  }
  if (!res.ok) {
    let oauthError
    try {
      const body = control ? controlledBody : await res.json()
      oauthError = typeof body?.error === 'string' && KNOWN_OAUTH_ERRORS.has(body.error)
        ? body.error
        : undefined
    } catch {
      // Deliberately discard malformed/non-JSON bodies: never echo an Auth
      // response into logs or caller-visible details.
    }
    const errorCode = classifyTokenEndpointFailure(res.status, oauthError)
    throw new TokenEndpointError(
      `token endpoint rejected the request (status ${res.status}${oauthError ? `, error ${oauthError}` : ''})`,
      { status: res.status, oauthError, errorCode },
    )
  }
  let data
  try {
    data = control ? controlledBody : await res.json()
  } catch {
    throw new TokenEndpointError('token endpoint returned a malformed JSON body')
  }
  if (typeof data.access_token !== 'string' || data.access_token.length === 0) {
    throw new TokenEndpointError('token response missing access_token')
  }
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : parseInt(data.expires_in, 10) || 300
  return { accessToken: data.access_token, expiresIn }
}

