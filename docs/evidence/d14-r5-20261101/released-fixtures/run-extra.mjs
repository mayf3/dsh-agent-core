import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { join, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const root = resolve(process.argv[2])
const packageRoot = join(root, 'package')
const plugin = await import(pathToFileURL(join(packageRoot, 'lib/index.js')).href)
const requireFromCandidate = createRequire(join(packageRoot, 'package.json'))
const candidateImport = async name => import(pathToFileURL(requireFromCandidate.resolve(name)).href)
const observations = []
const check = async (name, fn) => { const detail = await fn(); observations.push({ name, result: 'PASS', detail }); console.log(`PASS ${name}`) }
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const jwt = email => `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, 'https://api.openai.com/auth': { chatgpt_account_id: 'fixture-account' }, ...(email ? { email } : {}) })).toString('base64url')}.signature`
const credential = () => ({ type: 'oauth', access: jwt(), refresh: 'fixture-old', accountId: 'fixture-account', expires: Date.now() + 3600000, idToken: 'fixture-id', email: 'fixture@example.invalid' })
const originalFetch = globalThis.fetch
const providerCalls = []
globalThis.fetch = async (input, init) => {
  const url = String(input)
  if (url.startsWith('https://auth.openai.com/')) {
    providerCalls.push({ url, grant: init?.body instanceof URLSearchParams ? init.body.get('grant_type') : undefined })
    if (url.endsWith('/deviceauth/usercode')) return Response.json({ device_auth_id: 'fixture-device', user_code: 'FIXTURE', interval: 0 })
    if (url.endsWith('/deviceauth/token')) return Response.json({ authorization_code: 'fixture-approval', code_verifier: 'fixture-verifier' })
    if (url === 'https://auth.openai.com/oauth/token') return Response.json({ access_token: jwt(), refresh_token: 'fixture-owner-new', id_token: jwt('fixture@example.invalid'), expires_in: 3600 })
    throw Error('unexpected synthetic OAuth endpoint')
  }
  if (url === plugin.OPENAI_CODEX_USAGE_URL) return Response.json({ rate_limit: { primary_window: { used_percent: 5, limit_window_seconds: 18000 } } })
  return originalFetch(input, init)
}
const listen = server => new Promise(done => server.listen(0, '127.0.0.1', () => done(`http://127.0.0.1:${server.address().port}`)))
const close = server => new Promise((done, reject) => server.close(error => error ? reject(error) : done()))
let result = 'PASS'
try {
  await check('released Web registered login/status routes run real auth/store Owner recovery', async () => {
    const webRoot = join(root, 'observations/web'); await fs.mkdir(webRoot, { mode: 0o700 })
    const store = new plugin.OpenAICodexCredentialStore(join(webRoot, 'auth.json'))
    await store.modify(plugin.OPENAI_CODEX_PROVIDER, async () => credential())
    const s = await fs.stat(store.filename)
    await fs.writeFile(store.refreshIntentFilename, JSON.stringify({ version: 1, generationId: `fs:${s.dev}:${s.ino}`, state: 'pending', startedAt: new Date().toISOString() }), { mode: 0o600 })
    const [{ Context }, { default: Loader }, { default: Include }, LlmRuntime, WebRuntime] = await Promise.all([
      candidateImport('@deepseek-ai/cordis'), candidateImport('@deepseek-ai/cordis-plugin-loader'), candidateImport('@deepseek-ai/cordis-plugin-include'), candidateImport('@deepseek-ai/dsh-llm'), candidateImport('@deepseek-ai/dsh-web'),
    ])
    const routes = new Map()
    const ctx = new Context()
    let http
    try {
      ctx.provide('webServer', { register(route) { routes.set(route.path, route); return () => routes.delete(route.path) } })
      ctx.baseUrl = pathToFileURL(webRoot).href + '/'
      await ctx.plugin(Loader); ctx.loader.builtins.include = Include
      const modules = new Map([['fixture-llm', LlmRuntime], ['fixture-web', WebRuntime], ['dsh-codex', plugin]])
      ctx.loader.internal = { version: 'v2', async import(name) { assert.ok(modules.has(name)); return modules.get(name) } }
      const configPath = join(webRoot, 'cordis.yml')
      await fs.writeFile(configPath, `- name: fixture-llm\n- name: fixture-web\n- id: llm-openai-codex\n  name: dsh-codex\n  config:\n    credentialFile: '${store.filename}'\n    models: [gpt-5.6-luna]\n`)
      await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } }); await ctx.loader.await()
      assert.ok(routes.has('/plugins/dsh-openai-codex/auth/login'), 'compiled plugin registered actual Web route')
      http = createServer((req, res) => { const route = routes.get(new URL(req.url, 'http://fixture').pathname); if (!route) { res.writeHead(404); res.end(); return }; Promise.resolve(route.handler(req, res)).catch(error => { res.writeHead(500); res.end(error.name) }) })
      const base = await listen(http)
      const invoke = async (path, method = 'GET', body) => {
        const response = await originalFetch(base + '/plugins/dsh-openai-codex/auth/' + path, { method, headers: { origin: base, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); assert.equal(response.status, 200); return response.json()
      }
      assert.equal((await invoke('status')).status, 'reauth-required')
      const challenge = await invoke('login', 'POST', { method: 'device_code' })
      assert.deepEqual([challenge.method, challenge.userCode], ['device_code', 'FIXTURE'])
      let status
      for (let i = 0; i < 60; i++) { status = await invoke('status'); if (status.status !== 'signing-in') break; await new Promise(done => setTimeout(done, 50)) }
      assert.equal(status.status, 'signed-in')
      assert.equal((await ctx.openAICodex.authStatus()).authenticated, true)
      await assert.rejects(fs.stat(store.refreshIntentFilename), { code: 'ENOENT' })
      assert.equal(providerCalls.filter(call => call.grant === 'refresh_token').length, 1)
      const before = digest(await fs.readFile(store.filename)); const callsBefore = providerCalls.length
      await invoke('login', 'POST', { method: 'device_code' })
      assert.deepEqual(await invoke('cancel', 'POST'), { ok: true })
      assert.equal(digest(await fs.readFile(store.filename)), before)
      assert.equal(providerCalls.length - callsBefore, 1, 'cancel happens before polling/exchange/refresh')
      assert.equal((await invoke('status')).status, 'signed-in')
      observations.push({ name: 'released Web cancel route preserves credential and performs zero refresh after device challenge', result: 'PASS', providerCallsAfterChallenge: 0 })
      return { routeCount: routes.size, explicitCompletingRefreshGrants: 1, frontDoor: 'compiled registerOpenAICodexAuthRoutes via actual Loader; capture-only webServer adapter, HTTP loopback requests', transport: 'synthetic provider fetch; actual auth.ts and store unmocked' }
    } finally { if (http) await close(http); await ctx.fiber.dispose() }
  })
  await check('released proxy scoped HTTP request and AbortSignal use loopback proxy', async () => {
    let proxyRequests = 0; let activeAbortRequest
    const proxy = createServer((req, res) => {
      proxyRequests++
      if (req.url.endsWith('/abort')) { activeAbortRequest?.(); return }
      res.writeHead(200, { 'content-type': 'text/plain' }); res.end('fixture-proxied')
    })
    const base = await listen(proxy)
    const transport = new plugin.OpenAICodexProxyTransport(() => ({ proxyMode: 'scoped', proxyUrl: base }))
    try {
      const response = await transport.fetch('http://codex-fixture.invalid/success')
      assert.equal(await response.text(), 'fixture-proxied')
      const abort = new AbortController()
      const seen = new Promise(done => { activeAbortRequest = done })
      const pending = transport.fetch('http://codex-fixture.invalid/abort', { signal: abort.signal })
      const rejected = assert.rejects(pending, error => error.name === 'AbortError')
      await seen; abort.abort(); await rejected
      assert.equal(proxyRequests, 2)
      return { proxyRequests, wire: 'actual shipped undici scoped HTTP proxy; loopback listener; synthetic upstream URL is not DNS-resolved' }
    } finally { await transport.dispose(); proxy.closeAllConnections(); await close(proxy) }
  })
} catch (error) {
  result = 'FAIL'; process.exitCode = 1; console.error(error)
  observations.push({ name: 'first failed extra fixture', result: 'FAIL', error: { name: error.name, message: error.message, stack: error.stack } })
} finally {
  globalThis.fetch = originalFetch
  await fs.writeFile(join(root, 'extra-result.json'), JSON.stringify({ result, observedAt: new Date().toISOString(), observations, providerCalls, limits: ['No actual installed Harness identity or current production Core compatibility', 'Web HTTP served by capture-only fixture service from actual plugin registrations', 'All provider responses synthetic; no real Owner OAuth/account', 'No production recovery admission claim'], productionAdmissionEstablished: false }, null, 2) + '\n')
}
