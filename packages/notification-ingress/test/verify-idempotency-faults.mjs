import {
  AGENT_CHILD, BODY, FORUM, INGRESS_URL, RESOURCE, SCAN_SECRET, SCOPE, STORE_URL,
  WORKFLOW, artifacts, assert, basic, check, crashChild, makeEndpoint, makeRoot, mount, post,
  recorderRouter, writeAuthConfig,
} from './verify-support.mjs'
import { spawn } from 'node:child_process'
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export async function runIdempotencyFaults() {
await check('F-11 duplicate same payload -> reuse outcome, zero re-delivery (3 branches)', async () => {
  for (const [name, deliverImpl, expect] of [
    ['delivered', undefined, (r) => r.status === 200 && r.body.outcome === 'delivered' && r.body.duplicate === true],
    ['failed', async () => { throw Object.assign(new Error('nf'), { code: 'AGENT_NOT_FOUND' }) }, (r) => r.status === 404 && r.body.error?.code === 'AGENT_NOT_FOUND'],
    ['unknown', async () => { throw new Error('boom') }, (r) => r.status === 200 && r.body.outcome === 'outcome_unknown' && r.body.duplicate === true],
  ]) {
    const env = makeRoot(); writeAuthConfig(env)
    const router = recorderRouter(deliverImpl)
    const { base, ctx } = await mount(env, router, makeEndpoint())
    await post(base, { body: BODY(`f11-${name}`) })
    const replay = await post(base, { body: BODY(`f11-${name}`) })
    assert(expect(replay), `${name} replay shape: ${replay.status} ${JSON.stringify(replay.body)}`)
    assert(router.calls.length === 1, `${name}: second Router call`)
    await ctx.disposeAll()
  }
  return 'all three terminal branches reuse their durable outcome'
})

await check('F-12 duplicate different payload -> 409', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  await post(base, { body: BODY('f12') })
  const before = readFileSync(env.storeFile, 'utf8')
  const { status, body } = await post(base, { body: { ...BODY('f12'), message: 'DIFFERENT' } })
  assert(status === 409 && body.error.code === 'CONFLICT')
  assert(readFileSync(env.storeFile, 'utf8') === before)
  await ctx.disposeAll()
  return 'conflict never rewrites the record'
})

await check('F-13 restart persistence across a real SIGKILL', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  // A real child process durably records the delivered outcome, is killed
  // with SIGKILL, and the reopened authority + a fresh mount must REUSE it.
  const { NotificationIdempotencyStore, canonicalPayloadHash } = await import(STORE_URL)
  const childCode = `
    const { NotificationIdempotencyStore } = await import(process.env.NI_STORE_URL)
    const store = new NotificationIdempotencyStore({ storeFile: process.env.NI_STORE_FILE })
    await store.reserve({ callerPrincipalId: 'client-forum-abc', requestId: 'f13', payloadHash: process.env.NI_HASH })
    await store.settle({ callerPrincipalId: 'client-forum-abc', requestId: 'f13', state: 'delivered', sessionId: 'main', reason: 'router_accepted' })
    const { writeFileSync } = await import('node:fs')
    writeFileSync(process.env.NI_ROOT + '/marker-ready.json', '{}')
    setInterval(() => {}, 60000)
  `
  const child = spawn(process.execPath, ['--input-type=module', '-e', childCode], {
    env: {
      ...process.env,
      NI_STORE_URL: STORE_URL,
      NI_STORE_FILE: env.storeFile,
      NI_ROOT: env.root,
      NI_HASH: canonicalPayloadHash(BODY('f13')),
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  const readyPath = join(env.root, 'marker-ready.json')
  const deadline = Date.now() + 15000
  while (Date.now() < deadline && !existsSync(readyPath)) {
    await new Promise((resolve) => setTimeout(resolve, 15))
  }
  assert(existsSync(readyPath), 'child never delivered')
  child.kill('SIGKILL')
  await new Promise((resolveExit) => (child.exitCode !== null ? resolveExit() : child.once('exit', resolveExit)))

  const reopened = new NotificationIdempotencyStore({ storeFile: env.storeFile })
  assert(reopened.lookup(FORUM.clientId, 'f13').state === 'delivered', 'record survived the kill')
  reopened.stop()
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  const { body } = await post(base, { body: BODY('f13') })
  assert(body.duplicate === true && body.outcome === 'delivered', `got ${JSON.stringify(body)}`)
  assert(router.calls.length === 0)
  await ctx.disposeAll()
  return 'delivered record survives SIGKILL; replay reuses it'
})

await check('F-14 crash windows W1–W4 (real SIGKILL injections)', async () => {
  // W2: crash after reserve, before Router.
  {
    const env = makeRoot(); writeAuthConfig(env)
    const rig = await crashChild('w2', env, { requestId: 'w2' })
    await rig.kill()
    const { NotificationIdempotencyStore } = await import(STORE_URL)
    const reopened = new NotificationIdempotencyStore({ storeFile: env.storeFile })
    assert(reopened.lookup(FORUM.clientId, 'w2').state === 'outcome_unknown', 'boot sweep')
    reopened.stop()
    const router = recorderRouter()
    const { base, ctx } = await mount(env, router, makeEndpoint())
    const { body } = await post(base, { body: BODY('w2') })
    assert(body.outcome === 'outcome_unknown' && body.duplicate === true, 'reused unknown')
    assert(router.calls.length === 0, 'no re-delivery')
    await ctx.disposeAll()
  }
  // W3: crash during the Router call (full service, HTTP in flight).
  {
    const env = makeRoot(); writeAuthConfig(env)
    const rig = await crashChild('service-hang', env, { requestId: 'w3' })
    const { port } = rig.marker('ready')
    void fetch(`http://127.0.0.1:${port}/v1/deliver`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: basic(FORUM.clientId, FORUM.clientSecret) },
      body: JSON.stringify(BODY('w3')),
    }).catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 250))
    await rig.kill()
    const { NotificationIdempotencyStore } = await import(STORE_URL)
    const reopened = new NotificationIdempotencyStore({ storeFile: env.storeFile })
    assert(reopened.lookup(FORUM.clientId, 'w3')?.state === 'outcome_unknown')
    reopened.stop()
  }
  // W4: Router accepted, crash before the terminal write.
  {
    const env = makeRoot(); writeAuthConfig(env)
    const rig = await crashChild('w4', env, { requestId: 'w4' })
    assert(existsSync(join(env.root, 'marker-router-accepted.json')), 'router accepted marker')
    await rig.kill()
    const { NotificationIdempotencyStore } = await import(STORE_URL)
    const reopened = new NotificationIdempotencyStore({ storeFile: env.storeFile })
    assert(reopened.lookup(FORUM.clientId, 'w4').state === 'outcome_unknown', 'not delivered, not re-delivered')
    reopened.stop()
  }
  // W1: no record exists -> clean retry (proven by an empty store delivering).
  {
    const env = makeRoot(); writeAuthConfig(env)
    const router = recorderRouter()
    const { base, ctx } = await mount(env, router, makeEndpoint())
    const { body } = await post(base, { body: BODY('w1') })
    assert(body.outcome === 'delivered' && router.calls.length === 1)
    await ctx.disposeAll()
  }
  return 'W1 clean retry; W2/W3/W4 -> outcome_unknown, no auto re-delivery'
})

await check('F-15 outcome_unknown durable, no auto re-delivery', async () => {
  const env = makeRoot()
  writeAuthConfig(env, { routerDeadlineMs: 120 })
  let lateResolve
  const router = recorderRouter(() => new Promise((resolve) => { lateResolve = resolve }))
  const { base, ctx } = await mount(env, router, makeEndpoint())
  const { status, body } = await post(base, { body: BODY('f15') })
  assert(status === 200 && body.accepted === false && body.outcome === 'outcome_unknown')
  const doc = JSON.parse(readFileSync(env.storeFile, 'utf8'))
  assert(doc.records[FORUM.clientId]['f15'].state === 'outcome_unknown')
  const replay = await post(base, { body: BODY('f15') })
  assert(replay.body.duplicate === true && router.calls.length === 1)
  lateResolve?.({ accepted: true })
  await new Promise((resolve) => setTimeout(resolve, 150))
  const after = JSON.parse(readFileSync(env.storeFile, 'utf8'))
  assert(after.records[FORUM.clientId]['f15'].state === 'outcome_unknown', 'late rewrite happened')
  const evidence = readFileSync(join(env.dir, 'evidence.jsonl'), 'utf8')
  assert(evidence.includes('late_settled'), 'late settlement is evidence-only')
  await ctx.disposeAll()
  return 'deadline -> durable unknown; late settle -> evidence only'
})

await check('F-16 store corruption -> mount fail-loud', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  writeFileSync(env.storeFile, '{corrupt')
  const { apply } = await import(INGRESS_URL)
  let threw = false
  try {
    apply({ get: () => recorderRouter(), provide() {}, effect() {} }, {
      port: 0, authConfigFile: env.authConfigFile, storeFile: env.storeFile, fetchImpl: makeEndpoint().fetchImpl,
    })
  } catch (error) {
    threw = error.code === 'IDEMPOTENCY_STORE_CORRUPT'
  }
  assert(threw, 'mount must throw CORRUPT_STORE')
  return 'corrupt authority never serves'
})

await check('F-17 credential rotation -> key continuity', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const endpoint = makeEndpoint()
  const { base, ctx } = await mount(env, router, endpoint)
  await post(base, { body: BODY('f17') })
  endpoint.setRespond(({ clientId, clientSecret }) => (clientId === FORUM.clientId && clientSecret === 'rotated-secret'
    ? { ok: true, status: 200, json: async () => ({ access_token: 'tok2' }) }
    : { ok: false, status: 401, json: async () => ({ error: 'invalid_client' }) }))
  const replay = await post(base, { authorization: basic(FORUM.clientId, 'rotated-secret'), body: BODY('f17') })
  assert(replay.body.duplicate === true && router.calls.length === 1)
  await ctx.disposeAll()
  return 'same clientId -> same idempotency key across rotation'
})

await check('F-18 revoke keeps existing records valid', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const endpoint = makeEndpoint()
  const { base, ctx } = await mount(env, recorderRouter(), endpoint)
  await post(base, { body: BODY('f18') })
  endpoint.setRespond(() => ({ ok: false, status: 401, json: async () => ({ error: 'invalid_client' }) }))
  const rejected = await post(base, { body: BODY('f18-other') })
  assert(rejected.status === 401)
  const doc = JSON.parse(readFileSync(env.storeFile, 'utf8'))
  assert(doc.records[FORUM.clientId]['f18'].state === 'delivered', 'old record intact')
  await ctx.disposeAll()
  return 'revocation blocks new calls, preserves durable outcomes'
})

await check('F-19 no secret in log/response/store/evidence', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const endpoint = makeEndpoint()
  const { base, ctx } = await mount(env, recorderRouter(), endpoint)
  await post(base, { authorization: basic('client-driver-scan', 'wrong'), body: BODY('f19') })
  await post(base, { authorization: basic('client-driver-scan', SCAN_SECRET), body: BODY('f19') })
  const base64Secret = Buffer.from(SCAN_SECRET).toString('base64')
  for (const file of [env.storeFile, join(env.dir, 'evidence.jsonl')]) {
    if (!existsSync(file)) continue
    const text = readFileSync(file, 'utf8')
    assert(!text.includes(SCAN_SECRET) && !text.includes(base64Secret), `${file} leaks`)
  }
  for (const text of artifacts) {
    assert(!text.includes(SCAN_SECRET) && !text.includes(base64Secret), 'response leaks')
  }
  await ctx.disposeAll()
  return 'distinctive secret absent from every sink'
})

await check('F-20 Router receives only authenticated admitted deliveries', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  await post(base, { authorization: null, body: BODY('f20') })            // anonymous
  await post(base, { authorization: basic(AGENT_CHILD.clientId, AGENT_CHILD.clientSecret), body: BODY('f20') }) // 403
  const ok = await post(base, { body: BODY('f20') })                      // admitted
  await post(base, { body: BODY('f20') })                                 // duplicate
  assert(ok.status === 200)
  assert(router.calls.length === 1, `router saw ${router.calls.length} calls`)
  await ctx.disposeAll()
  return 'every Router call = verified caller + reserved key'
})

await check('F-21 auth-service inconclusive -> 503', async () => {
  for (const reply of [
    { ok: false, status: 500, json: async () => ({}) },
    { ok: false, status: 400, json: async () => ({ error: 'temporarily_unavailable' }) },
  ]) {
    const env = makeRoot(); writeAuthConfig(env)
    const endpoint = makeEndpoint()
    endpoint.setRespond(() => reply)
    const { base, ctx } = await mount(env, recorderRouter(), endpoint)
    const { status, body } = await post(base, { body: BODY('f21') })
    assert(status === 503 && body.error.code === 'AUTH_INCONCLUSIVE', `got ${status}`)
    await ctx.disposeAll()
  }
  return 'inconclusive is never 401 and never admitted'
})

await check('F-22 retention sweeps terminal records', async () => {
  const { NotificationIdempotencyStore } = await import(STORE_URL)
  const env = makeRoot()
  let clock = 1_700_000_000_000
  const store = new NotificationIdempotencyStore({
    storeFile: env.storeFile, now: () => new Date(clock).toISOString(), clockMs: () => clock,
    retentionMs: 1000, maxRecords: 100000,
  })
  await store.reserve({ callerPrincipalId: 'c', requestId: 'old', payloadHash: 'h' })
  await store.settle({ callerPrincipalId: 'c', requestId: 'old', state: 'delivered', sessionId: 's', reason: 'r' })
  store.stop()
  clock += 10_000
  const sweeper = new NotificationIdempotencyStore({
    storeFile: env.storeFile, now: () => new Date(clock).toISOString(), clockMs: () => clock, retentionMs: 1000,
  })
  assert(sweeper.lookup('c', 'old') === undefined, 'over-age terminal pruned')
  assert(sweeper.evidenceLines().some((e) => e.kind === 'sweep_pruned'))
  sweeper.stop()
  return 'over-age terminal evicted with sweep_pruned evidence'
})

await check('F-23 concurrent single-flight -> one Router call', async () => {
  const env = makeRoot(); writeAuthConfig(env)
  let release
  const gate = new Promise((resolveGate) => { release = resolveGate })
  const router = recorderRouter(async () => {
    await gate
    return { accepted: true, sessionId: 'main' }
  })
  const { base, ctx } = await mount(env, router, makeEndpoint())
  const attempts = [...Array(6)].map(() => post(base, { body: BODY('f23') }))
  await new Promise((resolve) => setTimeout(resolve, 100))
  release()
  const replies = await Promise.all(attempts)
  assert(router.calls.length === 1, `${router.calls.length} Router calls`)
  assert(replies.every((r) => r.body.outcome === 'delivered'))
  await ctx.disposeAll()
  return 'one Router call, all joiners share the outcome'
})

await check('F-24 pre-admission classification (PROVEN set only)', async () => {
  for (const [code, expectStatus, expectState] of [
    ['VALIDATION_ERROR', 400, 'failed_no_admission'],
    ['AGENT_NOT_FOUND', 404, 'failed_no_admission'],
    ['RECONCILIATION_CAPACITY_EXCEEDED', 200, 'outcome_unknown'],
  ]) {
    const env = makeRoot(); writeAuthConfig(env)
    const router = recorderRouter(async () => {
      throw Object.assign(new Error(code), { code })
    })
    const { base, ctx } = await mount(env, router, makeEndpoint())
    const { status } = await post(base, { body: BODY(`f24-${code}`) })
    assert(status === expectStatus, `${code} -> ${status}`)
    const doc = JSON.parse(readFileSync(env.storeFile, 'utf8'))
    assert(doc.records[FORUM.clientId][`f24-${code}`].state === expectState, `${code} state`)
    await ctx.disposeAll()
  }
  return 'PROVEN = {VALIDATION_ERROR, AGENT_NOT_FOUND} only'
})

await check('F-25 missing auth config -> per-call 503', async () => {
  const env = makeRoot() // NO auth config written
  const router = recorderRouter()
  const { base, ctx } = await mount(env, router, makeEndpoint())
  for (const authorization of [null, basic(FORUM.clientId, FORUM.clientSecret)]) {
    const { status, body } = await post(base, { authorization, body: BODY('f25') })
    assert(status === 503 && body.error.code === 'AUTH_NOT_CONFIGURED', `got ${status}`)
  }
  assert(!existsSync(env.storeFile) || Object.keys(JSON.parse(readFileSync(env.storeFile, 'utf8')).records).length === 0)
  assert(router.calls.length === 0)
  await ctx.disposeAll()
  return 'unconfigured fails CLOSED on every call — never anonymous'
})
}
