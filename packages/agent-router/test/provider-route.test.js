import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AgentProcess,
  agentEnv,
  classifyProviderError,
  RECOGNIZED_PROXY_ENV_KEYS,
  redactSensitiveText,
} from '../src/process.js'

const TARGET_PROVIDER_ENV = Object.freeze({
  HTTP_PROXY: 'http://target-proxy.invalid:7890',
  HTTPS_PROXY: 'http://target-proxy.invalid:7890',
  NO_PROXY: 'localhost,127.0.0.1,::1',
  NODE_USE_ENV_PROXY: '1',
})

function fakeProcess() {
  const writes = []
  const proc = new AgentProcess({
    agentId: 'agt_cto-agent',
    home: '/tmp/provider-route-home',
    workspace: '/tmp/provider-route-workspace',
    profile: 'agent-core-production',
    provider: 'openai-codex',
    model: 'gpt-5.6-luna',
    omitEnv: ['OPENAI_API_KEY'],
    log: { log() {}, error() {} },
  })
  proc.child = { stdin: { write: (line) => writes.push(JSON.parse(line)) } }
  const answer = (write, result) => proc.onStdout(`${JSON.stringify({ jsonrpc: '2.0', id: write.id, result })}\n`)
  /** Drive the lifecycle to READY over the fake child (fast deadlines). */
  const readyNow = async () => {
    const pending = proc.ready(2000)
    await new Promise((resolve) => setTimeout(resolve, 0))
    answer(writes[0], { registeredProviders: [proc.provider] })
    return pending
  }
  return { proc, writes, answer, readyNow }
}

test('resolved provider/model are immutable initialize inputs for the process that owns create and resume', async () => {
  const { proc, writes, answer } = fakeProcess()
  const previousProvider = process.env.DSH_AGENT_PROVIDER
  const previousModel = process.env.DSH_AGENT_MODEL
  process.env.DSH_AGENT_PROVIDER = 'oc-go'
  process.env.DSH_AGENT_MODEL = 'deepseek-v4-flash'
  try {
    const ready = proc.ready()
    assert.equal(writes[0].method, 'initialize')
    assert.equal(writes[0].params.provider, 'openai-codex')
    assert.equal(writes[0].params.model, 'gpt-5.6-luna')
    answer(writes[0], {})
    await ready

    const create = proc.deliver('fresh-session', 'create', {}, 1000)
    answer(writes[1], { messageId: 'create-id' })
    await create
    wireEvent(proc, 'fresh-session', { type: 'turn/start', data: { turn: 1 } })
    wireEvent(proc, 'fresh-session', { type: 'user/message', data: { id: 'create-id' } })
    wireEvent(proc, 'fresh-session', { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
    proc.onStdout(`${JSON.stringify({ method: 'session.status', params: { sessionId: 'fresh-session', status: 'idle' } })}\n`)
    await new Promise(resolve => setImmediate(resolve))
    const resume = proc.deliver('main', 'resume', {}, 1000)
    answer(writes[2], { messageId: 'resume-id' })
    await resume
    assert.deepEqual(writes.slice(1).map((write) => write.params.sessionId), ['fresh-session', 'main'])
    assert.equal(proc.provider, 'openai-codex')
    assert.equal(proc.model, 'gpt-5.6-luna')
  } finally {
    if (previousProvider === undefined) delete process.env.DSH_AGENT_PROVIDER
    else process.env.DSH_AGENT_PROVIDER = previousProvider
    if (previousModel === undefined) delete process.env.DSH_AGENT_MODEL
    else process.env.DSH_AGENT_MODEL = previousModel
  }
})

test('target process environment explicitly omits OPENAI_API_KEY', () => {
  const previous = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'sk-secret-value-should-never-reach-child'
  try {
    const env = agentEnv('/tmp/no-real-home', {}, ['OPENAI_API_KEY'])
    assert.equal(env.OPENAI_API_KEY, undefined)
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous
  }
})

test('every child strips all proxy variants; only target providerEnv is injected exactly', () => {
  const before = Object.fromEntries(RECOGNIZED_PROXY_ENV_KEYS.map((key) => [key, process.env[key]]))
  try {
    for (const key of RECOGNIZED_PROXY_ENV_KEYS) process.env[key] = `inherited-${key}`
    const target = agentEnv(
      '/tmp/no-real-home',
      { http_proxy: 'lowercase-precedence-bypass', no_proxy: '*' },
      [],
      TARGET_PROVIDER_ENV,
    )
    for (const key of RECOGNIZED_PROXY_ENV_KEYS) {
      if (Object.hasOwn(TARGET_PROVIDER_ENV, key)) assert.equal(target[key], TARGET_PROVIDER_ENV[key], key)
      else assert.equal(target[key], undefined, key)
    }
    assert.deepEqual(
      Object.fromEntries(Object.keys(TARGET_PROVIDER_ENV).map((key) => [key, target[key]])),
      TARGET_PROVIDER_ENV,
    )

    const nonTarget = agentEnv(
      '/tmp/no-real-home',
      { HTTPS_PROXY: 'extra-bypass', no_proxy: 'localhost' },
    )
    for (const key of RECOGNIZED_PROXY_ENV_KEYS) assert.equal(nonTarget[key], undefined, key)
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('providerEnv is immutable per AgentProcess lifetime', () => {
  const source = { ...TARGET_PROVIDER_ENV }
  const proc = new AgentProcess({
    agentId: 'agt_cto-agent',
    home: '/tmp/provider-route-home',
    workspace: '/tmp/provider-route-workspace',
    profile: 'agent-core-production',
    providerEnv: source,
  })
  source.HTTP_PROXY = 'http://mutated.invalid'
  assert.deepEqual(proc.providerEnv, TARGET_PROVIDER_ENV)
  assert.equal(Object.isFrozen(proc.providerEnv), true)
})

test('provider/account errors are classified without secret echo and never rewrite the route', async () => {
  const { proc, writes, readyNow } = fakeProcess()
  await readyNow()
  const pending = proc.turn('main', 'provider-error', {})
  await new Promise(resolve => setImmediate(resolve))
  proc.onStdout(`${JSON.stringify({
    jsonrpc: '2.0',
    id: writes[1].id,
    error: {
      code: 'provider_error',
      message: 'insufficient_quota access_token=secret-token-value',
    },
  })}\n`)
  await assert.rejects(
    () => pending,
    (error) => {
      assert.equal(error.code, 'account_quota_exhausted')
      assert.equal(error.provider, 'openai-codex')
      assert.equal(error.model, 'gpt-5.6-luna')
      assert.ok(!error.message.includes('secret-token-value'))
      return true
    },
  )
  assert.equal(proc.provider, 'openai-codex', 'failure does not silently fall back')
  assert.equal(proc.model, 'gpt-5.6-luna')
})

test('failure taxonomy and redaction cover frozen provider-side classes', () => {
  assert.equal(classifyProviderError({ code: 'invalid_grant', message: 'oauth revoked' }), 'oauth_expired_or_revoked')
  assert.equal(classifyProviderError({ code: 'provider_unavailable', message: 'service unavailable' }), 'provider_unavailable')
  assert.equal(classifyProviderError({ code: 'model_not_found', message: 'unknown model' }), 'model_unavailable')
  assert.equal(classifyProviderError({ code: 'credential_missing', message: 'auth file not found' }), 'credential_missing')
  const secret = 'sk-1234567890abcdef'
  assert.ok(!redactSensitiveText(`Bearer abc.def ${secret} refresh_token=refresh-secret`).includes(secret))
  assert.ok(!redactSensitiveText('Bearer abc.def').includes('abc.def'))
  assert.ok(!redactSensitiveText('refresh_token=refresh-secret').includes('refresh-secret'))
})

function wireEvent(proc, sessionId, event) {
  proc.onStdout(`${JSON.stringify({ jsonrpc: '2.0', method: 'session.event', params: { sessionId, event } })}\n`)
}

function injectFailedTurn(proc, sessionId, messageId, providerError, turn = 1) {
  wireEvent(proc, sessionId, { type: 'agent/inbox/spliced', data: { inserted: [{ id: messageId }] } })
  wireEvent(proc, sessionId, { type: 'turn/start', data: { turn } })
  wireEvent(proc, sessionId, { type: 'user/message', data: { id: messageId } })
  wireEvent(proc, sessionId, { type: 'turn/end', data: { turn, reason: { kind: 'error', error: providerError } } })
}

test('real turn/end quota error rejects the turn with provider/account attribution and no empty success', async () => {
  const { proc, writes, answer, readyNow } = fakeProcess()
  await readyNow()
  const pending = proc.turn('main', 'quota test', {}, 2000)
  await new Promise((resolve) => setTimeout(resolve, 0))
  answer(writes[1], { messageId: 'quota-message' })
  injectFailedTurn(proc, 'main', 'quota-message', { code: 'QUOTA', message: 'insufficient_quota' })
  proc.onStdout(`${JSON.stringify({ jsonrpc: '2.0', method: 'session.status', params: { sessionId: 'main', status: 'idle' } })}\n`)
  await assert.rejects(pending, (error) => {
    assert.equal(error.class, 'account_quota_exhausted')
    assert.equal(error.code, 'account_quota_exhausted')
    assert.equal(error.layer, 'provider/account')
    assert.equal(error.provider, 'openai-codex')
    assert.equal(error.model, 'gpt-5.6-luna')
    assert.equal(error.status, 'failed')
    assert.equal(typeof error.reconciliationHandle, 'string')
    return true
  })
  assert.equal(proc.provider, 'openai-codex')
  assert.equal(proc.model, 'gpt-5.6-luna')
})

test('all frozen runtime classes traverse the real session.event turn/end shape', async () => {
  const cases = [
    [{ code: 'invalid_grant', message: 'oauth token revoked' }, 'oauth_expired_or_revoked'],
    [{ code: 'UNAVAILABLE', message: 'provider unavailable' }, 'provider_unavailable'],
    [{ code: 'QUOTA', message: 'insufficient_quota' }, 'account_quota_exhausted'],
    [{ code: 'MODEL_NOT_FOUND', message: 'unknown model' }, 'model_unavailable'],
    [{ code: 'AUTH_REJECTED', message: 'credential rejected by provider' }, 'provider_runtime_rejection'],
  ]
  for (const [providerError, expected] of cases) {
    const { proc, writes, answer, readyNow } = fakeProcess()
    await readyNow()
    const pending = proc.turn('main', expected, {}, 2000)
    await new Promise((resolve) => setTimeout(resolve, 0))
    answer(writes[1], { messageId: `message-${expected}` })
    injectFailedTurn(proc, 'main', `message-${expected}`, providerError)
    // V2 C-015: `failed` requires exact_terminal_then_idle — the idle
    // status completes the termination evidence.
    proc.onStdout(`${JSON.stringify({ jsonrpc: '2.0', method: 'session.status', params: { sessionId: 'main', status: 'idle' } })}\n`)
    await assert.rejects(pending, (error) => error.class === expected)
  }
})

test('turn correlation ignores history, another session and another message', async () => {
  const { proc, writes, answer, readyNow } = fakeProcess()
  await readyNow()
  injectFailedTurn(proc, 'main', 'owned-message', { code: 'QUOTA', message: 'historical quota' }, 1)
  const pending = proc.turn('main', 'owned', {}, 2000)
  await new Promise((resolve) => setTimeout(resolve, 0))
  answer(writes[1], { messageId: 'owned-message' })
  injectFailedTurn(proc, 'other', 'owned-message', { code: 'QUOTA', message: 'other session quota' }, 2)
  injectFailedTurn(proc, 'main', 'other-message', { code: 'QUOTA', message: 'other message quota' }, 3)
  wireEvent(proc, 'main', { type: 'agent/inbox/spliced', data: { inserted: [{ id: 'owned-message' }] } })
  wireEvent(proc, 'main', { type: 'turn/start', data: { turn: 4 } })
  wireEvent(proc, 'main', { type: 'user/message', data: { id: 'owned-message' } })
  wireEvent(proc, 'main', { type: 'assistant/message', data: { message: { id: 'answer', content: [{ type: 'text', text: 'owned answer' }] } } })
  wireEvent(proc, 'main', { type: 'turn/end', data: { turn: 4, reason: { kind: 'completed' } } })
  proc.onStdout(`${JSON.stringify({ jsonrpc: '2.0', method: 'session.status', params: { sessionId: 'main', status: 'idle' } })}\n`)
  const envelope = await pending
  assert.equal(envelope.reply, 'owned answer')
  assert.equal(envelope.status, 'completed')
  assert.equal(typeof envelope.reconciliationHandle, 'string')
})

test('async and sync provider errors share full token redaction and never retain raw payloads', async () => {
  const secrets = ['access-secret', 'refresh-secret', 'header-secret', 'api-key-secret', 'nested-secret']
  const providerError = {
    code: 'AUTH_REJECTED',
    message: 'OAuth {"access_token":"access-secret","refresh_token":"refresh-secret"} Authorization: Bearer header-secret OPENAI_API_KEY=api-key-secret',
    payload: { raw: 'nested-secret' },
  }
  for (const mode of ['sync', 'async']) {
    const { proc, writes, answer, readyNow } = fakeProcess()
    await readyNow()
    let pending
    if (mode === 'sync') {
      pending = proc.turn('main', 'redact-sync', {}, 2000)
      await new Promise((resolve) => setTimeout(resolve, 0))
      proc.onStdout(`${JSON.stringify({ jsonrpc: '2.0', id: writes[1].id, error: providerError })}\n`)
    } else {
      pending = proc.turn('main', 'redact', {}, 2000)
      await new Promise((resolve) => setTimeout(resolve, 0))
      answer(writes[1], { messageId: 'redact-message' })
      injectFailedTurn(proc, 'main', 'redact-message', providerError)
      proc.onStdout(`${JSON.stringify({ jsonrpc: '2.0', method: 'session.status', params: { sessionId: 'main', status: 'idle' } })}\n`)
    }
    await assert.rejects(pending, (error) => {
      const exposed = JSON.stringify({ message: error.message, ...error })
      for (const secret of secrets) assert.ok(!exposed.includes(secret), `${mode} leaked ${secret}`)
      assert.equal(error.class, 'provider_runtime_rejection')
      return true
    })
  }
})
