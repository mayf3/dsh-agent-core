import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AgentProcess,
  agentEnv,
  classifyProviderError,
  redactSensitiveText,
} from '../src/process.js'

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
  return { proc, writes, answer }
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

test('provider/account errors are classified without secret echo and never rewrite the route', async () => {
  const { proc, writes } = fakeProcess()
  const pending = proc.request('session/prompt', { sessionId: 'main' })
  proc.onStdout(`${JSON.stringify({
    jsonrpc: '2.0',
    id: writes[0].id,
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
  const { proc, writes, answer } = fakeProcess()
  const pending = proc.turn('main', 'quota test', {}, 2000)
  await new Promise((resolve) => setTimeout(resolve, 0))
  answer(writes[0], { messageId: 'quota-message' })
  injectFailedTurn(proc, 'main', 'quota-message', { code: 'QUOTA', message: 'insufficient_quota' })
  proc.onStdout(`${JSON.stringify({ jsonrpc: '2.0', method: 'session.status', params: { sessionId: 'main', status: 'idle' } })}\n`)
  await assert.rejects(pending, (error) => {
    assert.equal(error.class, 'account_quota_exhausted')
    assert.equal(error.code, 'account_quota_exhausted')
    assert.equal(error.layer, 'provider/account')
    assert.equal(error.provider, 'openai-codex')
    assert.equal(error.model, 'gpt-5.6-luna')
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
    const { proc, writes, answer } = fakeProcess()
    const pending = proc.turn('main', expected, {}, 2000)
    await new Promise((resolve) => setTimeout(resolve, 0))
    answer(writes[0], { messageId: `message-${expected}` })
    injectFailedTurn(proc, 'main', `message-${expected}`, providerError)
    await assert.rejects(pending, (error) => error.class === expected)
  }
})

test('turn correlation ignores history, another session and another message', async () => {
  const { proc, writes, answer } = fakeProcess()
  injectFailedTurn(proc, 'main', 'owned-message', { code: 'QUOTA', message: 'historical quota' }, 1)
  const pending = proc.turn('main', 'owned', {}, 2000)
  await new Promise((resolve) => setTimeout(resolve, 0))
  answer(writes[0], { messageId: 'owned-message' })
  injectFailedTurn(proc, 'other', 'owned-message', { code: 'QUOTA', message: 'other session quota' }, 2)
  injectFailedTurn(proc, 'main', 'other-message', { code: 'QUOTA', message: 'other message quota' }, 3)
  wireEvent(proc, 'main', { type: 'agent/inbox/spliced', data: { inserted: [{ id: 'owned-message' }] } })
  wireEvent(proc, 'main', { type: 'turn/start', data: { turn: 4 } })
  wireEvent(proc, 'main', { type: 'user/message', data: { id: 'owned-message' } })
  wireEvent(proc, 'main', { type: 'assistant/message', data: { message: { id: 'answer', content: [{ type: 'text', text: 'owned answer' }] } } })
  wireEvent(proc, 'main', { type: 'turn/end', data: { turn: 4, reason: { kind: 'completed' } } })
  proc.onStdout(`${JSON.stringify({ jsonrpc: '2.0', method: 'session.status', params: { sessionId: 'main', status: 'idle' } })}\n`)
  assert.equal((await pending).reply, 'owned answer')
})

test('async and sync provider errors share full token redaction and never retain raw payloads', async () => {
  const secrets = ['access-secret', 'refresh-secret', 'header-secret', 'api-key-secret', 'nested-secret']
  const providerError = {
    code: 'AUTH_REJECTED',
    message: 'OAuth {"access_token":"access-secret","refresh_token":"refresh-secret"} Authorization: Bearer header-secret OPENAI_API_KEY=api-key-secret',
    payload: { raw: 'nested-secret' },
  }
  for (const mode of ['sync', 'async']) {
    const { proc, writes, answer } = fakeProcess()
    let pending
    if (mode === 'sync') {
      pending = proc.request('session/prompt', { sessionId: 'main' })
      proc.onStdout(`${JSON.stringify({ jsonrpc: '2.0', id: writes[0].id, error: providerError })}\n`)
    } else {
      pending = proc.turn('main', 'redact', {}, 2000)
      await new Promise((resolve) => setTimeout(resolve, 0))
      answer(writes[0], { messageId: 'redact-message' })
      injectFailedTurn(proc, 'main', 'redact-message', providerError)
    }
    await assert.rejects(pending, (error) => {
      const exposed = JSON.stringify({ message: error.message, ...error })
      for (const secret of secrets) assert.ok(!exposed.includes(secret), `${mode} leaked ${secret}`)
      assert.equal(error.class, 'provider_runtime_rejection')
      return true
    })
  }
})
