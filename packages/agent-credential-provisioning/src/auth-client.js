const DEFAULT_TIMEOUT_MS = 15000
const KNOWN_OAUTH_ERRORS = new Set([
  'invalid_client', 'invalid_scope', 'invalid_grant', 'invalid_resource',
  'invalid_target', 'temporarily_unavailable',
])

function safeError(code, message, fields = {}) {
  return Object.assign(new Error(message), { code, ...fields })
}

function normalizeOrigin(authServiceOrigin) {
  let url
  try {
    url = new URL(authServiceOrigin)
  } catch {
    throw safeError('AUTH_CONFIGURATION_ERROR', 'credential provisioning: authServiceOrigin must be a valid HTTPS origin')
  }
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
    throw safeError('AUTH_CONFIGURATION_ERROR', 'credential provisioning: authServiceOrigin must be an HTTPS origin')
  }
  return url.origin
}

async function parseJsonResponse(response, operation) {
  try {
    return await response.json()
  } catch {
    throw safeError('AUTH_MALFORMED_RESPONSE', `credential provisioning: ${operation} returned malformed JSON`, {
      status: response.status,
    })
  }
}

function validBearerToken(value) {
  return typeof value === 'string' && value.length > 0 && !/[\s\u0000-\u001f\u007f]/u.test(value)
}

/** Auth S1/S2 client. Bootstrap authorization is supplied only through memory. */
export function createAuthProvisioningClient({
  authServiceOrigin,
  getManagementAccessToken,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const origin = normalizeOrigin(authServiceOrigin)
  if (typeof getManagementAccessToken !== 'function') {
    throw safeError('AUTH_CONFIGURATION_ERROR', 'credential provisioning: getManagementAccessToken is required')
  }

  async function postManagement(accessToken, path, body, operation) {
    let response
    try {
      response = await fetchImpl(`${origin}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      throw safeError('AUTH_TRANSPORT_FAILURE', `credential provisioning: ${operation} transport failure`)
    }
    if (!response.ok) {
      // Never echo an Auth response body: it may contain sensitive material.
      throw safeError('AUTH_REQUEST_REJECTED', `credential provisioning: ${operation} rejected with HTTP ${response.status}`, {
        status: response.status,
      })
    }
    return parseJsonResponse(response, operation)
  }

  return {
    /**
     * Acquire prerequisite-(c) authorization exactly once for one provisioning
     * operation. The token stays closure-private and is reused by S1 and S2.
     */
    async beginManagementOperation() {
      let accessToken
      try {
        accessToken = await getManagementAccessToken()
      } catch {
        throw safeError('EXTERNAL_PREREQUISITE_MISSING', 'external_prerequisite_missing(c)', { prerequisite: 'c' })
      }
      if (!validBearerToken(accessToken)) {
        throw safeError('EXTERNAL_PREREQUISITE_MISSING', 'external_prerequisite_missing(c)', { prerequisite: 'c' })
      }
      return Object.freeze({
        ensurePrincipal: (body) => postManagement(accessToken, '/api/v1/principals', body, 'principal ensure'),
        ensureClient: (body) => postManagement(accessToken, '/api/v1/clients', body, 'client ensure'),
      })
    },

    async verifyCredential({ credential, resource, scope }) {
      const basic = Buffer.from(`${credential.clientId}:${credential.clientSecret}`).toString('base64')
      let response
      try {
        response = await fetchImpl(`${origin}/oauth/token`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: new URLSearchParams({ grant_type: 'client_credentials', resource, scope }).toString(),
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch {
        throw safeError('AUTH_TRANSPORT_FAILURE', 'credential provisioning: verification mint transport failure')
      }
      const body = await parseJsonResponse(response, 'verification mint')
      if (response.ok) {
        if (typeof body?.access_token !== 'string' || body.access_token === '') {
          throw safeError('AUTH_MALFORMED_RESPONSE', 'credential provisioning: verification mint response has no token')
        }
        return { status: response.status, oauthError: undefined }
      }
      return {
        status: response.status,
        oauthError: typeof body?.error === 'string' && KNOWN_OAUTH_ERRORS.has(body.error)
          ? body.error
          : undefined,
      }
    },
  }
}
