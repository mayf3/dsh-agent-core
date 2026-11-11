import test from 'node:test'
import assert from 'node:assert/strict'
import { parseWebsiteRoute, validateBody } from '../src/website-inquiry/protocol.js'

test('exact finite public/private route and DTO rejection precedes dispatch', () => {
  assert.equal(parseWebsiteRoute('POST', '/v1/website-inquiries/resolve').operation, 'resolve')
  assert.equal(parseWebsiteRoute('POST', '/internal/v1/website-inquiries/requests/a:1/redeem').operation, 'redeem')
  for (const path of ['/v1/website-inquiries/%72esolve', '/v1/website-inquiries/resolve/', '/v1/website-inquiries/resolve?x=1']) {
    assert.throws(() => parseWebsiteRoute('POST', path), { code: 'VALIDATION_ERROR' })
  }
  assert.throws(() => parseWebsiteRoute('GET', '/internal/v1/website-inquiries/history'), { code: 'VALIDATION_ERROR' })
  assert.throws(() => parseWebsiteRoute('GET', '/v1/website-inquiries/history?limit=1&limit=2'), { code: 'VALIDATION_ERROR' })
  assert.throws(() => validateBody('resolve', { agent_id: 'agt_private' }), { code: 'VALIDATION_ERROR' })
  assert.deepEqual(validateBody('resolve', {}), {})
  assert.throws(() => validateBody('redeem', { message: 'x', context_refs: [], owner: 'fake' }), { code: 'VALIDATION_ERROR' })
})

import { strictJson, createWebsiteInquiryHandler } from '../src/website-inquiry/http.js'
import { Readable } from 'node:stream'

test('duplicate fields, invalid UTF8, and framing fail before authentication or upstream reads', async () => {
  assert.throws(() => strictJson('{"message":"one","message":"two"}'), { code: 'VALIDATION_ERROR' })
  assert.throws(() => strictJson('{"nested":{"x":1,"x":2}}'), { code: 'VALIDATION_ERROR' })
  let authCalls = 0
  const handler = createWebsiteInquiryHandler({ enabled: true, auth: { human: () => { authCalls++; throw Error() } }, service: {} })
  for (const input of [Buffer.from('{"workflow_instance_id":null,"workflow_instance_id":null}'), Buffer.from([0xff])]) {
    let status
    const req = Object.assign(Readable.from([input]), { method: 'POST', url: '/v1/website-inquiries/resolve', headers: { 'content-type': 'application/json' } })
    await handler(req, { writeHead(code) { status = code }, end() {} })
    assert.equal(status, 400)
  }
  assert.equal(authCalls, 0)
})
