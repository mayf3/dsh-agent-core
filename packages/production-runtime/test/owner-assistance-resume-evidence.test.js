import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createOwnerAssistanceResumeEvidenceRead } from '../src/workflow/owner-assistance-resume-evidence.js'

const input = {
  callerAgentId: 'agt_scheduler',
  dispatchIntentId: '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33',
  previousAttemptId: 'wfeat-0123456789abcdef01234567',
  preDeliveryWorkflowStateVersion: 7,
}

test('direct evidence GET uses fixed route, exact query, and trusted workflow.read bearer token', async () => {
  let request
  const read = createOwnerAssistanceResumeEvidenceRead({
    workflowOrigin: 'https://svc-workflow.example/',
    acquireCallerToken: async ({ agentId }) => {
      assert.equal(agentId, input.callerAgentId)
      return { accessToken: 'trusted-token' }
    },
    fetchImpl: async (url, options) => {
      request = { url, options }
      return { status: 200, json: async () => ({ evidence: null }) }
    },
  })
  assert.deepEqual(await read(input), { ok: true, evidence: null })
  assert.equal(request.url, 'https://svc-workflow.example/internal/v1/dispatch-intents/2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33/owner-assistance-resume-evidence?previousAttemptId=wfeat-0123456789abcdef01234567&preDeliveryWorkflowStateVersion=7')
  assert.equal(request.options.method, 'GET')
  assert.equal(request.options.headers.authorization, 'Bearer trusted-token')
  assert.equal(request.options.redirect, 'error')
})

test('transport, token, non-200, and malformed envelope fail closed', async (t) => {
  const cases = [
    ['token unavailable', { acquireCallerToken: async () => { throw new Error('hidden') } }, 'token_unavailable'],
    ['transport failure', { fetchImpl: async () => { throw new Error('hidden') } }, 'transport_failure'],
    ['service failure', { fetchImpl: async () => ({ status: 403 }) }, 'http_403'],
    ['extra response field', { fetchImpl: async () => ({ status: 200, json: async () => ({ evidence: null, extra: true }) }) }, 'malformed_response'],
  ]
  for (const [name, overrides, code] of cases) {
    await t.test(name, async () => {
      const read = createOwnerAssistanceResumeEvidenceRead({
        workflowOrigin: 'https://svc-workflow.example',
        acquireCallerToken: async () => ({ accessToken: 'trusted-token' }),
        fetchImpl: async () => ({ status: 200, json: async () => ({ evidence: null }) }),
        ...overrides,
      })
      assert.deepEqual(await read(input), { ok: false, code })
    })
  }
})
