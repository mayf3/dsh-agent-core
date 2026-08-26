import {
  AGENT_CHILD, BODY, FORUM, RESOURCE, SCAN_SECRET, SCOPE, WORKFLOW, artifacts,
  assert, basic, check, crashChild, makeEndpoint, makeRoot, mount, post,
  recorderRouter, writeAuthConfig,
} from './verify-support.mjs'
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

export async function runAuthFaults() {
await check('F-01 anonymous reject -> 401, no state', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const endpoint = makeEndpoint()
  const { base, ctx } = await mount(env, router, endpoint)
  const { status, body } = await post(base, { authorization: null, body: BODY('f01') })
  assert(status === 401 && body.error.code === 'INVALID_CREDENTIAL', `got ${status}`)
  assert(router.calls.length === 0)
  if (existsSync(env.storeFile)) {
    const doc = JSON.parse(readFileSync(env.storeFile, 'utf8'))
    assert(Object.keys(doc.records).length === 0, 'state written')
  }
  await ctx.disposeAll()
  return '401 / 0 router calls / empty store'
})

await check('F-02 malformed credential -> 401', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const { base, ctx } = await mount(env, recorderRouter(), makeEndpoint())
  for (const authorization of ['Bearer x', 'Basic', 'Basic ###', 'Basic ' + Buffer.from([0xff, 0xfe]).toString('base64')]) {
    const { status } = await post(base, { authorization, body: BODY('f02') })
    assert(status === 401, `${authorization} -> ${status}`)
  }
  await ctx.disposeAll()
  return 'all malformed forms rejected'
})

await check('F-03 revoked credential -> 401, durable untouched', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const endpoint = makeEndpoint()
  const { base, ctx } = await mount(env, router, endpoint)
  await post(base, { body: BODY('f03-live') })
  const before = readFileSync(env.storeFile, 'utf8')
  endpoint.setRespond(() => ({ ok: false, status: 401, json: async () => ({ error: 'invalid_client' }) }))
  const { status } = await post(base, { body: BODY('f03-dead') })
  assert(status === 401)
  assert(readFileSync(env.storeFile, 'utf8') === before, 'store mutated')
  await ctx.disposeAll()
  return 'revocation never touches durable outcomes'
})

await check('F-04 wrong audience -> 401 (invalid_target / invalid_resource)', async () => {
  for (const oauthError of ['invalid_target', 'invalid_resource']) {
    const env = makeRoot(); writeAuthConfig(env)
    const endpoint = makeEndpoint()
    endpoint.setRespond(() => ({ ok: false, status: 400, json: async () => ({ error: oauthError }) }))
    const { base, ctx } = await mount(env, recorderRouter(), endpoint)
    const { status } = await post(base, { body: BODY('f04') })
    assert(status === 401, `${oauthError} -> ${status}`)
    await ctx.disposeAll()
  }
  return 'wrong-audience credentials are invalid FOR THIS SURFACE'
})

await check('F-05 authenticated non-allowlisted caller -> 403', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  const { status, body } = await post(base, { authorization: basic(AGENT_CHILD.clientId, AGENT_CHILD.clientSecret), body: BODY('f05') })
  assert(status === 403 && body.error.code === 'CALLER_NOT_ALLOWED', `got ${status}`)
  assert(router.calls.length === 0)
  await ctx.disposeAll()
  return 'per-agent client rejected by the allowlist'
})

await check('F-06 svc-forum success -> 200 delivered', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const endpoint = makeEndpoint()
  const { base, ctx } = await mount(env, router, endpoint)
  const { status, body } = await post(base, { body: BODY('f06') })
  assert(status === 200 && body.accepted === true && body.outcome === 'delivered')
  assert(endpoint.requests[0].form.resource === RESOURCE && endpoint.requests[0].form.scope === SCOPE)
  await ctx.disposeAll()
  return 'exact frozen resource/scope on the mint'
})

await check('F-07 svc-workflow success -> 200 delivered', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  const { status, body } = await post(base, { authorization: basic(WORKFLOW.clientId, WORKFLOW.clientSecret), body: BODY('f07') })
  assert(status === 200 && body.outcome === 'delivered')
  await ctx.disposeAll()
  return 'distinct workflow credential works'
})

await check('F-08 distinct credentials; duplicate clientId config invalid', async () => {
  const env = makeRoot()
  writeAuthConfig(env, { allowlist: { 'svc-forum': 'client-same', 'svc-workflow': 'client-same' } })
  const { base, ctx } = await mount(env, recorderRouter(), makeEndpoint())
  const { status, body } = await post(base, { body: BODY('f08') })
  assert(status === 503 && body.error.code === 'AUTH_NOT_CONFIGURED', `got ${status}`)
  await ctx.disposeAll()
  return 'duplicate clientId = illegal config'
})

await check('F-09 body caller spoof ignored', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  const { status } = await post(base, { body: { ...BODY('f09'), callerId: 'svc-workflow', service: 'svc-workflow' } })
  assert(status === 200)
  const doc = JSON.parse(readFileSync(env.storeFile, 'utf8'))
  assert(doc.records[FORUM.clientId] && !doc.records[WORKFLOW.clientId], 'record keyed by VERIFIED clientId')
  await ctx.disposeAll()
  return 'identity = verified clientId only'
})

await check('F-10 Agent child direct call rejected', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  const anon = await post(base, { authorization: null, body: BODY('f10') })
  const agent = await post(base, { authorization: basic(AGENT_CHILD.clientId, AGENT_CHILD.clientSecret), body: BODY('f10') })
  assert(anon.status === 401 && agent.status === 403)
  assert(router.calls.length === 0)
  await ctx.disposeAll()
  return '401 anonymous / 403 per-agent client'
})
}
