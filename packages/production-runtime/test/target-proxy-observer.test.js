import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { provisionAgentHome } from '../../agent-provisioning/src/index.js'
import { RECOGNIZED_PROXY_ENV_KEYS } from '../../agent-router/src/process.js'
import { CHATGPT_SUBSCRIPTION_V1 } from '../src/model-overrides.js'

const DSH_CODEX_PACKAGE_SHA256 = CHATGPT_SUBSCRIPTION_V1.artifactSha256

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function observeConnect({ script, authority, extraEnv = {} }) {
  const observed = []
  const proxy = createServer()
  proxy.on('connect', (request, socket) => {
    observed.push({ method: request.method, url: request.url })
    socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n')
  })
  proxy.listen(0, '127.0.0.1')
  await once(proxy, 'listening')
  const address = proxy.address()
  assert.notEqual(address, null)
  assert.equal(typeof address, 'object')
  const proxyUrl = `http://127.0.0.1:${address.port}`

  const env = { ...process.env }
  for (const key of RECOGNIZED_PROXY_ENV_KEYS) delete env[key]
  Object.assign(env, {
    HTTP_PROXY: proxyUrl,
    HTTPS_PROXY: proxyUrl,
    NO_PROXY: 'localhost,127.0.0.1,::1',
    NODE_USE_ENV_PROXY: '1',
  }, extraEnv)

  const child = spawn(process.execPath, ['--input-type=module', '--eval', script], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += String(chunk) })
  child.stderr.on('data', (chunk) => { stderr += String(chunk) })
  const timer = setTimeout(() => child.kill('SIGKILL'), 10_000)
  const [code, signal] = await once(child, 'exit')
  clearTimeout(timer)
  proxy.close()
  await once(proxy, 'close')
  assert.equal(signal, null, stderr)
  assert.equal(code, 0, stderr)
  assert.ok(
    observed.some((request) => request.method === 'CONNECT' && request.url === authority),
    `expected CONNECT ${authority}; observed ${observed.map((request) => `${request.method} ${request.url}`).join(', ')}`,
  )
  return { observed, stdout }
}

test('HTTP fetch proxy observer captures its own CONNECT evidence', async () => {
  await observeConnect({
    authority: 'http-fetch-observer.invalid:443',
    script: `
      await fetch('https://http-fetch-observer.invalid/model-http').catch(() => undefined)
    `,
  })
})

test('WebSocket proxy observer captures WebSocket CONNECT independently of SSE fallback', async () => {
  await observeConnect({
    authority: 'websocket-observer.invalid:443',
    script: `
      await new Promise((resolve) => {
        const socket = new WebSocket('wss://websocket-observer.invalid/model-ws')
        socket.addEventListener('error', resolve, { once: true })
        setTimeout(resolve, 5000)
      })
    `,
  })
})

test('real dsh-codex usage service has separate proxy CONNECT evidence', { timeout: 60_000 }, async (t) => {
  const artifact = process.env.DSH_CODEX_PACKAGE_TARBALL
  const sourceStamp = process.env.DSH_CODEX_SOURCE_STAMP
  if (artifact === undefined || artifact === '' || sourceStamp === undefined || sourceStamp === '') {
    t.skip('DSH_CODEX_PACKAGE_TARBALL and DSH_CODEX_SOURCE_STAMP are required for deterministic real-package acceptance')
    return
  }
  assert.equal(isAbsolute(artifact), true, 'DSH_CODEX_PACKAGE_TARBALL must be absolute')
  assert.equal(existsSync(artifact), true, `local package artifact missing: ${artifact}`)
  assert.equal(sha256(readFileSync(artifact)), DSH_CODEX_PACKAGE_SHA256)

  const root = mkdtempSync(join(tmpdir(), 'dsh-codex-auxiliary-proxy-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const dshHome = join(root, 'dsh-home')
  const operatorHome = join(root, 'operator-home')
  const settingsSource = join(operatorHome, '.dsh', 'settings.yaml')
  mkdirSync(join(operatorHome, '.dsh'), { recursive: true, mode: 0o700 })
  writeFileSync(settingsSource, 'llm-pi-ai:\n  providers: {}\n', 'utf8')

  const envBefore = {
    HOME: process.env.HOME,
    DSH_SETTINGS_SOURCE: process.env.DSH_SETTINGS_SOURCE,
  }
  process.env.HOME = operatorHome
  process.env.DSH_SETTINGS_SOURCE = settingsSource
  try {
    provisionAgentHome(dshHome, join(root, 'workspace'), {
      profile: 'agent-core-production',
      subscription: { ...CHATGPT_SUBSCRIPTION_V1, packageArtifact: artifact, sourceStamp },
      harnessIdentity: {
        version: CHATGPT_SUBSCRIPTION_V1.dshVersion,
        commit: CHATGPT_SUBSCRIPTION_V1.dshCommit,
      },
      credentialBoundary() {},
    })
  } finally {
    for (const [name, value] of Object.entries(envBefore)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }

  const installedPackage = join(dshHome, 'profiles', 'node_modules', 'dsh-codex', 'package.json')
  const installed = JSON.parse(readFileSync(installedPackage, 'utf8'))
  assert.equal(installed.name, 'dsh-codex')
  assert.equal(installed.version, CHATGPT_SUBSCRIPTION_V1.pluginVersion)

  const fixtureCredential = {
    version: 1,
    credential: {
      type: 'oauth',
      access: 'fixture-access-token-not-real',
      refresh: 'fixture-refresh-token-not-real',
      expires: Date.now() + 86_400_000,
      accountId: 'fixture-account-not-real',
    },
  }
  const fixtureCredentialFile = join(realpathSync(root), 'canonical', '.openai-codex-auth.json')
  mkdirSync(join(realpathSync(root), 'canonical'), { recursive: true, mode: 0o700 })
  writeFileSync(
    fixtureCredentialFile,
    `${JSON.stringify(fixtureCredential)}\n`,
    { mode: 0o600 },
  )

  const pluginEntry = pathToFileURL(join(dshHome, 'profiles', 'node_modules', 'dsh-codex', 'lib', 'index.js')).href
  const { stdout } = await observeConnect({
    authority: 'chatgpt.com:443',
    extraEnv: { DSH_HOME: dshHome },
    script: `
      const { OpenAICodexService } = await import(${JSON.stringify(pluginEntry)})
      const service = new OpenAICodexService({
        credentialFile: ${JSON.stringify(fixtureCredentialFile)},
        modifyReadImage: true,
        shareImagegenWithOtherModels: true,
        useWebSocketContextReuse: false,
        useNativeCompaction: false,
      })
      process.stdout.write('REAL_DSH_CODEX_USAGE_SERVICE_INVOKED\\n')
      await service.usage().catch(() => undefined)
    `,
  })
  assert.match(stdout, /REAL_DSH_CODEX_USAGE_SERVICE_INVOKED/u)
})
