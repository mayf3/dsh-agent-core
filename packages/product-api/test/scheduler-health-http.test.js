import { test } from 'node:test'
import assert from 'node:assert/strict'

import { apply as applyProductApi } from '../src/index.js'
import { createStubTokenVerifier } from '../src/scheduler-auth.js'

function context(services) {
  const disposers = []
  return {
    get: (name) => services.get(name),
    provide: () => {},
    effect: (fn) => { const dispose = fn(); if (typeof dispose === 'function') disposers.push(dispose) },
    disposeAll: async () => Promise.all(disposers.map((dispose) => dispose())),
  }
}

test('T17 HTTP integration mounts authenticated GET /scheduler/health with self/audit isolation', async (t) => {
  const health = async () => ({
    enabled: 2, healthy: 1, degraded: 0, blocked: 1, unknown: 0, complete: true, generatedAt: 1,
    jobs: [
      { jobId: 'job-a', agentId: 'agt_one', classification: 'healthy' },
      { jobId: 'job-b', agentId: 'agt_two', classification: 'blocked' },
    ],
  })
  const verifier = createStubTokenVerifier({
    self: { principalId: 'p-self', agentId: 'agt_one', scopes: new Set(['scheduler.read']) },
    audit: { principalId: 'p-audit', agentId: null, scopes: new Set(['scheduler.audit']) },
  })
  const services = new Map([
    ['agentRouter', { channelConversationId: () => 'x', getBinding: () => undefined, switchAgent: async () => ({}), route: async () => ({}) }],
    ['agentDefinition', { listAgents: () => [] }],
    ['schedulerTokenVerifier', verifier],
    ['schedulerHealth', health],
  ])
  const ctx = context(services)
  const api = applyProductApi(ctx, { port: 0 })
  t.after(() => ctx.disposeAll())
  await new Promise((resolve) => {
    const poll = () => api.address()?.port ? resolve() : setTimeout(poll, 10)
    poll()
  })
  const base = `http://127.0.0.1:${api.address().port}`
  const get = async (token) => {
    const response = await fetch(`${base}/scheduler/health`, { headers: { authorization: `Bearer ${token}` } })
    return { status: response.status, body: await response.json() }
  }
  const self = await get('self')
  assert.equal(self.status, 200)
  assert.deepEqual(self.body.jobs.map((row) => row.agentId), ['agt_one'])
  const audit = await get('audit')
  assert.equal(audit.status, 200)
  assert.equal(audit.body.jobs.length, 2)
})
