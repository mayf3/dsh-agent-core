import { test } from 'node:test'
import assert from 'node:assert/strict'

import { handleSchedulerHealthRequest } from '../src/scheduler-health-routes.js'

const fullHealth = {
  enabled: 2, healthy: 1, degraded: 0, blocked: 1, unknown: 0, complete: true,
  generatedAt: 1,
  jobs: [
    { jobId: 'a', agentId: 'agt_a', classification: 'healthy' },
    { jobId: 'b', agentId: 'agt_b', classification: 'blocked' },
  ],
}

function req(token, method = 'GET') {
  return { method, headers: token ? { authorization: `Bearer ${token}` } : {} }
}

test('T17 health auth runs before provider and scheduler.read receives only self rows', async () => {
  const order = []
  const verifier = { verify: async () => { order.push('auth'); return { agentId: 'agt_a', scopes: new Set(['scheduler.read']) } } }
  const health = async () => { order.push('health'); return fullHealth }
  const result = await handleSchedulerHealthRequest({ req: req('token'), url: new URL('http://x/scheduler/health'), health, verifier })
  assert.deepEqual(order, ['auth', 'health'])
  assert.equal(result.status, 200)
  assert.equal(result.body.jobs.length, 1)
  assert.equal(result.body.jobs[0].agentId, 'agt_a')
})

test('T17 scheduler.audit receives the complete fleet census', async () => {
  const verifier = { verify: async () => ({ agentId: null, scopes: new Set(['scheduler.audit']) }) }
  const result = await handleSchedulerHealthRequest({ req: req('token'), url: new URL('http://x/scheduler/health'), health: async () => fullHealth, verifier })
  assert.equal(result.body.jobs.length, 2)
  assert.equal(result.body.complete, true)
})

test('T17 unauthenticated/bad-scope requests never touch health provider', async () => {
  let calls = 0
  const health = async () => { calls += 1; return fullHealth }
  await assert.rejects(() => handleSchedulerHealthRequest({ req: req(), url: new URL('http://x/scheduler/health'), health, verifier: null }), (error) => error.status === 401)
  await assert.rejects(() => handleSchedulerHealthRequest({ req: req('x'), url: new URL('http://x/scheduler/health'), health, verifier: { verify: async () => ({ agentId: 'agt_a', scopes: new Set() }) } }), (error) => error.status === 403)
  assert.equal(calls, 0)
})

test('T17/T33 health route is GET-only and fails loud when provider is absent', async () => {
  const verifier = { verify: async () => ({ agentId: null, scopes: new Set(['scheduler.audit']) }) }
  await assert.rejects(() => handleSchedulerHealthRequest({ req: req('x', 'POST'), url: new URL('http://x/scheduler/health'), health: async () => fullHealth, verifier }), (error) => error.status === 405)
  await assert.rejects(() => handleSchedulerHealthRequest({ req: req('x'), url: new URL('http://x/scheduler/health'), health: null, verifier }), (error) => error.status === 500)
})
