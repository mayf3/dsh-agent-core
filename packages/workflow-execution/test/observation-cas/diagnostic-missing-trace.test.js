import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fixture, intent, VISIT, INSTANCE } from './fixture.js'
import { createPluginContext } from '../../../production-runtime/src/context.js'
import { mountWorkflowCapabilityRuntime } from '../../../production-runtime/src/workflow/capability-runtime.js'
import { handleWorkflowExecutionRequest } from '../../../product-api/src/workflow-execution-routes.js'

const OTHER = '99999999-8888-4777-8666-555555555555'
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')

for (const tail of ['healthy', 'invalid_json', 'missing_newline']) {
  for (const selector of ['unknown_instance', 'unknown_visit']) {
    test(`1367 mounted missing trace retains 404: ${tail}/${selector}`, async t => {
      const fx = fixture()
      try {
        await fx.writer.beginAttemptIfAbsent(intent())
        await fx.writer.recordResolutionBlocked({ nodeVisitId: VISIT, code: 'principal_missing' })
        if (tail === 'invalid_json') appendFileSync(fx.writer.eventsFile, '{"review_partial":')
        if (tail === 'missing_newline') writeFileSync(fx.writer.eventsFile, readFileSync(fx.writer.eventsFile).subarray(0, -1))
        const ctx = createPluginContext()
        const unexpected = () => { throw new Error('missing-trace diagnostic attempted external operation') }
        ctx.provide('brokerGateway', { execute: unexpected })
        ctx.provide('agentPrincipalResolutionAccess', { handlers: { agent_resolve_principal: { resolve: unexpected } } })
        const { ledger } = mountWorkflowCapabilityRuntime({ ctx,
          layout: { workflowExecutionDir: fx.dir, developmentExecutionDir: join(fx.dir, 'development') },
          router: { deliver: unexpected }, log: { log() {}, warn() {}, error() {} },
          opts: { workflowExecution: { pollerAgentId: '' } } })
        // Missing reads retain the existing read lock, but never enter mutation/repair/append.
        ledger.mutate = ledger.appendFileSync = unexpected
        const load = ledger.load.bind(ledger)
        ledger.load = options => { assert.notEqual(options?.repairTornTail, true); return load(options) }
        const params = selector === 'unknown_instance'
          ? { workflowInstanceId: OTHER }
          : { workflowInstanceId: INSTANCE, nodeVisitId: OTHER }
        const before = hash(ledger.eventsFile)
        let response
        try {
          response = await handleWorkflowExecutionRequest({
            req: { method: 'GET', headers: { authorization: 'Bearer isolated-regression-fixture' } },
            url: new URL(`http://127.0.0.1/workflow-execution/traces?${new URLSearchParams(params)}`),
            access: ctx.get('workflowExecutionAccess'),
            verifier: { verify: async () => ({ scopes: new Set(['workflow.execute']) }) },
          })
        } catch (error) {
          response = { status: error.status, body: { error: { code: error.code, message: error.message } } }
        }
        const after = hash(ledger.eventsFile)
        t.diagnostic(JSON.stringify({ tail, selector, before, after, response }))
        assert.equal(response.status, 404, 'missing instance/visit must retain existing not_found response')
        assert.equal(response.body.error.code, 'not_found')
        assert.equal(after, before, 'missing-trace diagnostic must preserve event bytes')
      } finally { fx.cleanup() }
    })
  }
}
