import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const serverPath = fileURLToPath(new URL('../src/index.js', import.meta.url))

function digest(policy) {
  const canonical = (value) => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
    if (value !== null && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    }
    return JSON.stringify(value)
  }
  return createHash('sha256').update(canonical(policy)).digest('hex')
}

function nativePolicy() {
  const unsigned = {
    version: 1,
    agentId: 'agt_example',
    mode: 'native-allowlist',
    allowedCalls: [{ toolName: 'read' }],
  }
  return { ...unsigned, policyDigest: digest(unsigned) }
}

function startServer({ tools = true, badAck = false } = {}) {
  const moduleUrl = new URL(`file://${serverPath}`).href
  const bootstrap = `
    import { apply } from ${JSON.stringify(moduleUrl)};
    const services = new Map([
      ['llm', { listProviders: () => [] }],
      ...(process.env.TEST_TOOLS === 'false' ? [] : [['tools', {
        configureTrustedNativeToolPolicy: (value) => {
          if (process.env.TEST_BAD_ACK === 'true') return { version: 1, agentId: 'wrong', policyDigest: value.policyDigest };
          return { version: value.version, agentId: value.agentId, policyDigest: value.policyDigest };
        },
      }]]),
    ]);
    const ctx = { get: (name) => services.get(name), on: () => () => {}, provide() {} };
    apply(ctx);
  `
  const child = spawn(process.execPath, ['--input-type=module', '-e', bootstrap], {
    env: { ...process.env, TEST_TOOLS: String(tools), TEST_BAD_ACK: String(badAck) },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let buffer = ''
  const pending = new Map()
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    buffer += chunk
    let newline
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline)
      buffer = buffer.slice(newline + 1)
      if (!line.trim()) continue
      const message = JSON.parse(line)
      if (message.id !== undefined) {
        const resolve = pending.get(message.id)
        pending.delete(message.id)
        resolve?.(message)
      }
    }
  })
  let nextId = 1
  return {
    child,
    request(method, params = {}) {
      const id = nextId++
      const response = new Promise((resolve) => pending.set(id, resolve))
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
      return response
    },
    async close() {
      child.stdin.end()
      if (child.exitCode === null) await once(child, 'exit')
    },
  }
}

test('demo-server initialize acknowledges trusted policy, fails closed, and preserves legacy behavior', async () => {
  const policy = nativePolicy()
  const server = startServer()
  try {
    const response = await server.request('initialize', { nativeToolPolicy: policy })
    assert.deepEqual(response.result.nativeToolPolicy, {
      version: 1,
      agentId: policy.agentId,
      policyDigest: policy.policyDigest,
    })
    const removal = await server.request('initialize', {})
    assert.match(removal.error.message, /nativeToolPolicy cannot change/)
  } finally {
    await server.close()
  }

  const noTools = startServer({ tools: false })
  try {
    const response = await noTools.request('initialize', { nativeToolPolicy: policy })
    assert.match(response.error.message, /requires the DSH ToolRuntime service/)
  } finally {
    await noTools.close()
  }

  const badAck = startServer({ badAck: true })
  try {
    const response = await badAck.request('initialize', { nativeToolPolicy: policy })
    assert.match(response.error.message, /mismatched nativeToolPolicy acknowledgement/)
  } finally {
    await badAck.close()
  }

  const legacy = startServer()
  try {
    const first = await legacy.request('initialize', {})
    assert.equal(Object.hasOwn(first.result, 'nativeToolPolicy'), false)
    const addition = await legacy.request('initialize', { nativeToolPolicy: policy })
    assert.match(addition.error.message, /nativeToolPolicy cannot change/)
  } finally {
    await legacy.close()
  }
})
