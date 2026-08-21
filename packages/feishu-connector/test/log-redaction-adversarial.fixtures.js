export const TEST_CREDENTIAL = 'fixture-only-credential-literal-7b31f4'
export const SECONDARY_VALUE = 'fixture-only-secondary-sensitive-value-52ac'

export function makeCredentialStatusError() {
  const error = new Error(`request failed ${TEST_CREDENTIAL}`)
  error.name = 'AxiosError'
  error.code = `E_${TEST_CREDENTIAL}`
  error.status = `status-${TEST_CREDENTIAL}`
  error.phase = `phase-${TEST_CREDENTIAL}`
  error.config = {
    method: `post-${TEST_CREDENTIAL}`,
    url: `https://open.feishu.cn/open-apis/auth/v3/token?private_token=${TEST_CREDENTIAL}`,
    headers: { Authorization: `Bearer ${TEST_CREDENTIAL}` },
    data: `{"app_secret":"${TEST_CREDENTIAL}"}`,
  }
  return error
}

export function tokenVariantFixture() {
  return {
    private_token: SECONDARY_VALUE,
    'refresh-token': SECONDARY_VALUE,
    accessToken: SECONDARY_VALUE,
    tenant_access_token: SECONDARY_VALUE,
    authorization_header: SECONDARY_VALUE,
    api_key: SECONDARY_VALUE,
    'api$key': SECONDARY_VALUE,
    'pass/word': SECONDARY_VALUE,
    clientSecret: SECONDARY_VALUE,
    nested: {
      oauthToken: SECONDARY_VALUE,
      'session token': SECONDARY_VALUE,
      credential_token: SECONDARY_VALUE,
      passwd_value: SECONDARY_VALUE,
    },
  }
}

export function hostileHooksFixture(calls) {
  const value = {
    ordinary: 'safe',
    private_token: SECONDARY_VALUE,
  }
  Object.defineProperty(value, 'throwingGetter', {
    enumerable: true,
    get() {
      calls.getter += 1
      throw new Error(TEST_CREDENTIAL)
    },
  })
  Object.defineProperty(value, 'toJSON', {
    enumerable: true,
    value() {
      calls.toJSON += 1
      return { secret: TEST_CREDENTIAL }
    },
  })
  Object.defineProperty(value, Symbol.toPrimitive, {
    value() {
      calls.toPrimitive += 1
      return TEST_CREDENTIAL
    },
  })
  Object.defineProperty(value, 'toString', {
    enumerable: true,
    value() {
      calls.toString += 1
      return TEST_CREDENTIAL
    },
  })
  return value
}

export function standaloneResultFixture(calls) {
  return {
    ok: true,
    messageId: 'om_fixture',
    private_token: SECONDARY_VALUE,
    status: TEST_CREDENTIAL,
    toJSON() {
      calls.toJSON += 1
      return { app_secret: TEST_CREDENTIAL }
    },
  }
}
