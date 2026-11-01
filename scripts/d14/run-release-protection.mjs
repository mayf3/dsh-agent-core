import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

// Run only in a disposable directory with a synthetic HOME/DSH_HOME and an
// external-network guard. This verifies the released plugin, never admission.
const args = process.argv.slice(2)
const workerMode = args[0] === '--worker'
const packageRoot = resolve(workerMode ? args[1] : args[0])
const requestedOutputRoot = resolve(workerMode ? dirname(args[3]) : args[1])
await fs.mkdir(requestedOutputRoot, { recursive: true, mode: 0o700 })
const outputRoot = await fs.realpath(requestedOutputRoot)
const plugin = await import(pathToFileURL(join(packageRoot, 'lib/index.js')).href)
const requireFromCandidate = createRequire(join(packageRoot, 'package.json'))
const candidateImport = async name => import(pathToFileURL(requireFromCandidate.resolve(name)).href)
const provider = plugin.OPENAI_CODEX_PROVIDER
const credential = (expires = Date.now() + 3_600_000, generation = 'old') => ({
  type: 'oauth', access: `fixture-access-${generation}`, refresh: `fixture-refresh-${generation}`,
  accountId: 'fixture-account', expires, idToken: 'fixture-id', email: 'fixture@example.invalid',
})

if (workerMode) {
  const [,, action, filename, endpoint] = args
  const store = new plugin.OpenAICodexCredentialStore(filename)
  if (action === 'crash-post-write') {
    const { writeFileAtomic } = await candidateImport('@deepseek-ai/dsh-atomic-write')
    const info = await fs.stat(filename)
    await fs.writeFile(store.refreshIntentFilename, JSON.stringify({ version: 1, generationId: `fs:${info.dev}:${info.ino}`, state: 'pending', startedAt: new Date().toISOString() }), { mode: 0o600 })
    const handle = await fs.open(store.refreshIntentFilename, 'r')
    try { await handle.sync() } finally { await handle.close() }
    const prior = JSON.parse(await fs.readFile(filename, 'utf8'))
    await writeFileAtomic(filename, JSON.stringify({ ...prior, credential: credential(Date.now() + 3_600_000, 'new') }), { mode: 0o600, dirMode: 0o700 })
    process.exit(73)
  }
  await store.modify(provider, async current => {
    if (current?.expires > Date.now()) return undefined
    if (action === 'crash-pre') process.exit(71)
    const response = await fetch(endpoint, { method: 'POST' })
    assert.ok(response.ok)
    if (action === 'crash-post-rotation') process.exit(72)
    return credential(Date.now() + 3_600_000, 'new')
  })
  process.exit(0)
}

await fs.mkdir(outputRoot, { recursive: true, mode: 0o700 })
const observations = []
const roots = []
async function check(name, operation) {
  await operation()
  observations.push({ name, result: 'PASS' })
  console.log(`PASS ${name}`)
}
async function fixture(expired = true) {
  const root = await fs.mkdtemp(join(outputRoot, 'synthetic-'))
  await fs.chmod(root, 0o700)
  roots.push(root)
  const store = new plugin.OpenAICodexCredentialStore(join(root, 'auth.json'))
  await store.modify(provider, async () => credential(expired ? 1 : undefined))
  return { root, store }
}
async function pending(store) {
  const info = await fs.lstat(store.filename)
  await fs.writeFile(store.refreshIntentFilename, JSON.stringify({ version: 1, generationId: `fs:${info.dev}:${info.ino}`, state: 'pending', startedAt: new Date().toISOString() }), { mode: 0o600 })
}
function runWorker(action, filename, endpoint) {
  return new Promise((done, fail) => {
    const argv = [fileURLToPath(import.meta.url), '--worker', packageRoot, action, filename, ...(endpoint ? [endpoint] : [])]
    const child = spawn(process.execPath, argv, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', value => { stderr += value })
    child.once('error', fail)
    child.once('exit', code => [0, 71, 72, 73].includes(code) ? done(code) : fail(new Error(`synthetic worker exit ${code}: ${stderr}`)))
  })
}
async function server(delay = 0) {
  let calls = 0
  const instance = createServer((_req, res) => { calls++; setTimeout(() => { res.writeHead(204); res.end() }, delay) })
  await new Promise(done => instance.listen(0, '127.0.0.1', done))
  return { endpoint: `http://127.0.0.1:${instance.address().port}/refresh`, calls: () => calls, close: () => new Promise(done => instance.close(done)) }
}
const jwt = email => `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, 'https://api.openai.com/auth': { chatgpt_account_id: 'fixture-account' }, ...(email ? { email } : {}) })).toString('base64url')}.signature`
function syntheticTransport() {
  const calls = []
  const fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, grant: init?.body instanceof URLSearchParams ? init.body.get('grant_type') : undefined })
    if (url.endsWith('/deviceauth/usercode')) return Response.json({ device_auth_id: 'fixture-device', user_code: 'FIXTURE', interval: 0 })
    if (url.endsWith('/deviceauth/token')) return Response.json({ authorization_code: 'fixture-approval', code_verifier: 'fixture-verifier' })
    if (url === 'https://auth.openai.com/oauth/token') return Response.json({ access_token: jwt(), refresh_token: 'fixture-owner-new', id_token: jwt('fixture@example.invalid'), expires_in: 3600 })
    throw new Error('unexpected synthetic provider endpoint')
  }
  return { fetch, calls }
}
const interaction = () => ({ signal: new AbortController().signal, prompt: async () => 'device_code', notify: () => {} })
let outcome = 'PASS'
let failure
try {
  await check('R1 real released Loader/Config/apply/service carries explicit canonical filename', async () => {
    const { root, store } = await fixture(false)
    const [{ Context }, { default: Loader }, { default: Include }, LlmRuntime, WebRuntime] = await Promise.all([
      candidateImport('@deepseek-ai/cordis'), candidateImport('@deepseek-ai/cordis-plugin-loader'), candidateImport('@deepseek-ai/cordis-plugin-include'), candidateImport('@deepseek-ai/dsh-llm'), candidateImport('@deepseek-ai/dsh-web'),
    ])
    const ctx = new Context()
    try {
      ctx.baseUrl = pathToFileURL(root).href + '/'
      await ctx.plugin(Loader)
      ctx.loader.builtins.include = Include
      const modules = new Map([['fixture-llm', LlmRuntime], ['fixture-web', WebRuntime], ['dsh-codex', plugin]])
      ctx.loader.internal = { version: 'v2', async import(name) { assert.ok(modules.has(name)); return modules.get(name) } }
      const configPath = join(root, 'cordis.yml')
      await fs.writeFile(configPath, `- name: fixture-llm\n- name: fixture-web\n- id: llm-openai-codex\n  name: dsh-codex\n  config:\n    credentialFile: '${store.filename}'\n    models: [gpt-5.6-luna]\n`)
      await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
      await ctx.loader.await()
      assert.equal(ctx.openAICodex.credentials.filename, store.filename)
      assert.ok(!('credentialFile' in ctx.openAICodex.policy.snapshot()))
      assert.equal(ctx.llm.listProviders()[0].id, provider)
      await pending(ctx.openAICodex.credentials)
      await assert.rejects(ctx.openAICodex.authStatus(), { code: 'OPENAI_CODEX_REAUTH_REQUIRED' })
      const transport = syntheticTransport()
      ctx.openAICodex.proxy.fetch = transport.fetch
      await ctx.openAICodex.login(interaction())
      assert.equal(transport.calls.length, 4)
      assert.equal(transport.calls.filter(c => c.grant === 'refresh_token').length, 1)
      assert.equal((await ctx.openAICodex.authStatus()).authenticated, true)
      await assert.rejects(fs.stat(store.refreshIntentFilename), { code: 'ENOENT' })
      observations.push({ name: 'R3 real released Loader-created service.login Owner recovery', result: 'PASS', syntheticProviderCalls: 4, explicitLoginCompletingRefreshGrants: 1, automaticRecoveryRefreshes: 0 })
    } finally { await ctx.fiber.dispose() }
  })
  await check('R1 released store rejects relative/component symlink/hardlink/private-parent negatives', async () => {
    assert.throws(() => new plugin.OpenAICodexCredentialStore('relative.json'), /absolute/)
    for (const kind of ['component-symlink', 'hardlink', 'parent-mode']) {
      const { root, store } = await fixture(false)
      let unsafe = store
      if (kind === 'component-symlink') { await fs.symlink(root, join(root, 'alias')); unsafe = new plugin.OpenAICodexCredentialStore(join(root, 'alias/auth.json')) }
      if (kind === 'hardlink') await fs.link(store.filename, join(root, 'other.json'))
      if (kind === 'parent-mode') await fs.chmod(root, 0o755)
      let calls = 0
      await assert.rejects(unsafe.modify(provider, async () => { calls++; return credential() }))
      assert.equal(calls, 0)
    }
  })
  await check('R3 released pending same-generation fails before read/use/refresh', async () => {
    const { store } = await fixture(); await pending(store)
    let calls = 0
    const noProvider = async () => { calls++; throw Error('synthetic callback must not dispatch') }
    for (const action of [() => store.read(provider), () => store.modify(provider, noProvider), () => plugin.readOpenAICodexRateLimits(store, noProvider)]) {
      await assert.rejects(action(), error => error instanceof plugin.OpenAICodexReauthRequiredError && error.code === 'OPENAI_CODEX_REAUTH_REQUIRED' && !String(error).includes('fixture-access'))
    }
    assert.equal(calls, 0)
  })
  await check('R3 released invalid replacement preserves intent; valid replacement clears with zero dispatch', async () => {
    for (const kind of ['malformed', 'mode', 'hardlink', 'valid']) {
      const { root, store } = await fixture(); await pending(store)
      const evidence = await fs.readFile(store.refreshIntentFilename, 'utf8')
      const next = join(root, 'replacement.json')
      await fs.writeFile(next, kind === 'malformed' ? '{synthetic-malformed' : JSON.stringify({ version: 1, credential: credential() }), { mode: kind === 'mode' ? 0o644 : 0o600 })
      if (kind === 'hardlink') await fs.link(next, join(root, 'other.json'))
      await fs.rename(next, store.filename)
      if (kind === 'valid') { assert.equal((await store.read(provider)).accountId, 'fixture-account'); await assert.rejects(fs.stat(store.refreshIntentFilename), { code: 'ENOENT' }) }
      else { await assert.rejects(store.read(provider), { code: 'OPENAI_CODEX_REAUTH_REQUIRED' }); assert.equal(await fs.readFile(store.refreshIntentFilename, 'utf8'), evidence) }
    }
  })
  await check('current six synthetic credential schemas preserve identity and unrelated providers in released store', async () => {
    const oauth = { ...credential(), access: jwt() }
    const snake = { access_token: oauth.access, refresh_token: oauth.refresh, account_id: 'fixture-account', id_token: 'fixture-id' }
    const docs = [{ version: 1, credential: oauth }, { auth_mode: 'chatgpt', tokens: snake, OPENAI_API_KEY: null }, { type: 'codex', ...snake, expired: new Date(oauth.expires).toISOString(), email: oauth.email, disabled: false }, { openai: oauth, other: { retain: true } }, { 'openai-codex': oauth, other: { retain: true } }, oauth]
    for (const doc of docs) {
      const { store } = await fixture(false)
      await fs.writeFile(store.filename, JSON.stringify(doc), { mode: 0o600 })
      assert.equal((await store.read(provider)).accountId, 'fixture-account')
      await store.modify(provider, async current => ({ ...current, refresh: 'fixture-current-schema-new' }))
      const after = JSON.parse(await fs.readFile(store.filename, 'utf8'))
      assert.equal((await store.read(provider)).idToken, 'fixture-id')
      if (doc.other) assert.deepEqual(after.other, doc.other)
      if ('disabled' in doc) assert.equal(after.disabled, false)
    }
  })
  for (const count of [10, 20, 50]) await check(`R2 released store ${count} independent-process burst at most one refresh`, async () => {
    const { store } = await fixture(); const remote = await server()
    try { await Promise.all(Array.from({ length: count }, () => runWorker('refresh', store.filename, remote.endpoint))); assert.equal(remote.calls(), 1); assert.equal((await store.read(provider)).access, 'fixture-access-new') }
    finally { await remote.close() }
  })
  await check('R2 released store slow owner with 10 independent-process waiters refreshes once', async () => {
    const { store } = await fixture(); const remote = await server(2500)
    try { await Promise.all(Array.from({ length: 10 }, () => runWorker('refresh', store.filename, remote.endpoint))); assert.equal(remote.calls(), 1) }
    finally { await remote.close() }
  })
  for (const action of ['crash-pre', 'crash-post-rotation', 'crash-post-write']) await check(`R2/R3 released store ${action} crash boundary`, async () => {
    const { store } = await fixture(); const remote = await server()
    try {
      const code = await runWorker(action, store.filename, remote.endpoint)
      assert.equal(code, { 'crash-pre': 71, 'crash-post-rotation': 72, 'crash-post-write': 73 }[action])
      if (action === 'crash-post-write') { assert.equal((await store.read(provider)).access, 'fixture-access-new'); assert.equal(remote.calls(), 0) }
      else {
        await assert.rejects(store.read(provider), { code: 'OPENAI_CODEX_REAUTH_REQUIRED' })
        let retries = 0
        await assert.rejects(store.modify(provider, async () => { retries++; return credential() }), { code: 'OPENAI_CODEX_REAUTH_REQUIRED' })
        assert.equal(retries, 0); assert.equal(remote.calls(), action === 'crash-pre' ? 0 : 1)
      }
    } finally { await remote.close() }
  })
  await check('R3 actual released root loginOpenAICodex recovers malformed pending document with supplied transport', async () => {
    const { store } = await fixture(); await pending(store)
    await fs.writeFile(store.filename, '{synthetic-malformed-document', { mode: 0o600 })
    const transport = syntheticTransport()
    await plugin.loginOpenAICodex(interaction(), store, transport.fetch)
    assert.equal(transport.calls.length, 4)
    assert.equal(transport.calls.filter(c => c.grant === 'refresh_token').length, 1)
    assert.equal((await store.read(provider)).email, 'fixture@example.invalid')
    await assert.rejects(fs.stat(store.refreshIntentFilename), { code: 'ENOENT' })
  })
} catch (error) {
  outcome = 'FAIL'
  failure = { name: error.name, message: error.message, stack: error.stack }
  console.error(error)
  process.exitCode = 1
} finally {
  await Promise.all(roots.map(root => fs.rm(root, { recursive: true, force: true })))
  const digest = data => createHash('sha256').update(data).digest('hex')
  const result = { outcome, observedAt: new Date().toISOString(), packageRoot, packageJsonSha256: digest(await fs.readFile(join(packageRoot, 'package.json'))), libIndexSha256: digest(await fs.readFile(join(packageRoot, 'lib/index.js'))), observations, failure, proofScope: 'released candidate in its shipped dependency closure with synthetic data/transports only', limits: ['No real credential contents accessed', 'No production initialization/deployment/restart', 'No actual installed Harness identity or current Core admission proof', 'Web and CLI front doors remain separate source/mocked coverage', 'Post-write crash fixture synthesizes commit via candidate atomic-write dependency; source durability instrumentation is separate'] }
  await fs.writeFile(join(outputRoot, 'release-result.json'), JSON.stringify(result, null, 2) + '\n')
}
