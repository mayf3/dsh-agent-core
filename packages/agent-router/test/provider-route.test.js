import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AgentProcess,
  agentEnv,
  classifyProviderFailure,
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
  assert.equal(classifyProviderFailure('invalid_grant', 'oauth revoked'), 'oauth_expired_or_revoked')
  assert.equal(classifyProviderFailure('provider_unavailable', 'service unavailable'), 'provider_unavailable')
  assert.equal(classifyProviderFailure('model_not_found', 'unknown model'), 'model_unavailable')
  assert.equal(classifyProviderFailure('credential_missing', 'auth file not found'), 'credential_missing')
  const secret = 'sk-1234567890abcdef'
  assert.ok(!redactSensitiveText(`Bearer abc.def ${secret} refresh_token=refresh-secret`).includes(secret))
  assert.ok(!redactSensitiveText('Bearer abc.def').includes('abc.def'))
  assert.ok(!redactSensitiveText('refresh_token=refresh-secret').includes('refresh-secret'))
})
