import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { test } from 'node:test'

import { RECOGNIZED_PROXY_ENV_KEYS } from '../../agent-router/src/process.js'

async function observeConnect({ script, authority }) {
  const observed = []
  const proxy = createServer()
  proxy.on('connect', (request, socket) => {
    observed.push(request.url)
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
  })

  const child = spawn(process.execPath, ['--input-type=module', '--eval', script], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += String(chunk) })
  const timer = setTimeout(() => child.kill('SIGKILL'), 10_000)
  const [code, signal] = await once(child, 'exit')
  clearTimeout(timer)
  proxy.close()
  await once(proxy, 'close')
  assert.equal(signal, null, stderr)
  assert.equal(code, 0, stderr)
  assert.ok(observed.includes(authority), `expected CONNECT ${authority}; observed ${observed.join(', ')}`)
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

test('dsh-codex usage auxiliary fetch has separate proxy CONNECT evidence', async () => {
  // dsh-codex@0.2.3's usage path is a bare global fetch. Exercise that exact
  // auxiliary endpoint shape in its own child/observer so neither the model
  // fetch nor WebSocket evidence can satisfy this assertion accidentally.
  await observeConnect({
    authority: 'chatgpt.com:443',
    script: `
      await fetch('https://chatgpt.com/backend-api/wham/usage').catch(() => undefined)
    `,
  })
})
