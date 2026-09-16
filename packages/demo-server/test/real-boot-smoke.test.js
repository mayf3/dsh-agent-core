/**
 * Assembly-level boot regression for AGENT_CORE_BINDING_WORKSPACE_V1_REAL_BOOT_FIX.
 *
 * The seam unit tests (session-seam.test.js) call createSessionSeam with the
 * correct single-object shape, so they never exercised the REAL demo-server
 * plugin assembly — and the 3795555 implementation wired the call site as
 * createSessionSeam(ctx, settings), which crashes the Cordis profile boot
 * with `cannot get property "ctx" without inject` (the destructure reads
 * `.ctx` off the plugin proxy). This test reproduces the real boot path the
 * Router uses (ensureRunning -> provisionAgentHome -> spawn the dsh CLI with
 * the agent-core-production profile) and proves:
 *
 *   1. the plugin tree LOADS (child does not crash at boot),
 *   2. the demo-server reaches initialize-ready and answers the JSON-RPC
 *      initialize handshake the Router's ready() waits on.
 *
 * It intentionally uses NO fakes: the same provisioning module, the same CLI
 * binary and the same production profile the Router spawns. No model turn is
 * required (initialize is a local handshake; only session/prompt would need
 * a model).
 *
 * Skipped (not failed) when the deepseek-harness CLI checkout is not
 * resolvable on this machine.
 */

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { cliBin, provisionAgentHome } from '../../agent-provisioning/src/index.js'

const PROFILE = 'agent-core-production'

/** Resolve the dsh CLI (throws when the harness checkout is missing). */
function resolveCli() {
  try {
    return cliBin()
  } catch {
    return null
  }
}

/** Wait until a predicate over accumulated lines holds (or timeout). */
function waitFor(collect, predicate, timeoutMs, what) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    const poll = () => {
      try {
        const hit = predicate(collect())
        if (hit !== undefined && hit !== false) return resolve(hit)
      } catch (error) {
        return reject(error)
      }
      if (Date.now() > deadline) return reject(new Error(`timed out waiting for ${what}`))
      setTimeout(poll, 100)
    }
    poll()
  })
}

test('agent-core-production profile real boot: plugin loads + initialize handshake', { timeout: 180_000 }, async (t) => {
  const cli = resolveCli()
  if (cli === null) {
    t.skip('deepseek-harness CLI not resolvable (DSH_HARNESS_ROOT/checkout missing) — real boot smoke not run')
    return
  }

  // Same assembly the Router performs pre-spawn: provision the agent home
  // (profile copies + farm links into THIS repo) then spawn the dsh CLI.
  const root = mkdtempSync(join(tmpdir(), 'ac-real-boot-smoke-'))
  const home = join(root, 'home')
  const workspace = join(root, 'workspace')
  await provisionAgentHome(home, workspace, { profile: PROFILE })

  const child = spawn(process.execPath, [cli, '--profile', PROFILE], {
    cwd: workspace,
    env: {
      ...process.env,
      DSH_HOME: home,
      DSH_TELEMETRY_DISABLED: '1',
      DSH_PERMISSION_MODE: 'danger-full-access',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  t.after(() => {
    child.kill('SIGKILL')
    rmSync(root, { recursive: true, force: true })
  })

  let stderr = ''
  let stdout = ''
  child.stderr.setEncoding('utf8')
  child.stdout.setEncoding('utf8')
  child.stderr.on('data', (chunk) => { stderr += chunk })
  child.stdout.on('data', (chunk) => { stdout += chunk })

  // 1) Plugin tree loads: the demo-server prints its ready line AFTER the
  //    whole Cordis profile boot (including createSessionSeam) succeeded.
  await waitFor(
    () => stderr,
    (lines) => lines.includes('[demo-server] ready pid='),
    90_000,
    'demo-server ready marker (plugin tree load)',
  )

  // The child must still be alive at that point (boot crash killed it before).
  assert.equal(child.exitCode, null, `child died during boot:\n${stderr.slice(-2000)}`)

  // 2) The initialize handshake the Router's ready() polls for.
  const initializeId = 1
  child.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id: initializeId,
    method: 'initialize',
    params: { cwd: workspace, provider: 'opencode-go', model: 'deepseek-v4-flash', maxTokens: 8192 },
  })}\n`)

  const response = await waitFor(
    () => stdout,
    (lines) => {
      for (const line of lines.split('\n')) {
        const trimmed = line.trim()
        if (trimmed === '') continue
        let message
        try { message = JSON.parse(trimmed) } catch { continue }
        if (message?.jsonrpc === '2.0' && message?.id === initializeId) return message
      }
      return undefined
    },
    30_000,
    'initialize JSON-RPC response',
  )

  assert.equal(response.error, undefined, `initialize returned an error: ${JSON.stringify(response.error)}`)
  assert.equal(response.result?.serverInfo?.name, 'deepseek-harness-sdk-runtime')
  assert.equal(child.exitCode, null, 'child exited after initialize handshake')

  // Clean shutdown through the protocol (proves the server loop is live).
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'shutdown', params: {} })}\n`)
  await new Promise((resolve) => {
    const done = () => resolve()
    child.once('exit', done)
    setTimeout(() => { child.removeListener('exit', done); resolve() }, 5_000)
  })
})

test('DEFAULT_MODEL_ROUTING_CONFIG_V1: no-params initialize resolves the canonical Luna default; explicit params still win', { timeout: 180_000 }, async (t) => {
  const cli = resolveCli()
  if (cli === null) {
    t.skip('deepseek-harness CLI not resolvable (DSH_HARNESS_ROOT/checkout missing) — real boot smoke not run')
    return
  }

  const root = mkdtempSync(join(tmpdir(), 'ac-real-boot-smoke-default-'))
  const home = join(root, 'home')
  const workspace = join(root, 'workspace')
  await provisionAgentHome(home, workspace, { profile: PROFILE })

  const previousProvider = process.env.DSH_AGENT_PROVIDER
  const previousModel = process.env.DSH_AGENT_MODEL
  delete process.env.DSH_AGENT_PROVIDER
  delete process.env.DSH_AGENT_MODEL
  t.after(() => {
    if (previousProvider === undefined) delete process.env.DSH_AGENT_PROVIDER
    else process.env.DSH_AGENT_PROVIDER = previousProvider
    if (previousModel === undefined) delete process.env.DSH_AGENT_MODEL
    else process.env.DSH_AGENT_MODEL = previousModel
  })

  const child = spawn(process.execPath, [cli, '--profile', PROFILE], {
    cwd: workspace,
    env: {
      ...process.env,
      DSH_HOME: home,
      DSH_TELEMETRY_DISABLED: '1',
      DSH_PERMISSION_MODE: 'danger-full-access',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  t.after(() => {
    child.kill('SIGKILL')
    rmSync(root, { recursive: true, force: true })
  })

  let stderr = ''
  let stdout = ''
  child.stderr.setEncoding('utf8')
  child.stdout.setEncoding('utf8')
  child.stderr.on('data', (chunk) => { stderr += chunk })
  child.stdout.on('data', (chunk) => { stdout += chunk })

  await waitFor(
    () => stderr,
    (lines) => lines.includes('[demo-server] ready pid='),
    90_000,
    'demo-server ready marker (plugin tree load)',
  )
  assert.equal(child.exitCode, null, `child died during boot:\n${stderr.slice(-2000)}`)

  // No provider/model anywhere: the plugin answers with the canonical
  // built-in default route (openai-codex/gpt-5.6-luna).
  child.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { cwd: workspace, maxTokens: 8192 },
  })}\n`)
  const defaultResponse = await waitFor(
    () => stdout,
    (lines) => {
      for (const line of lines.split('\n')) {
        const trimmed = line.trim()
        if (trimmed === '') continue
        let message
        try { message = JSON.parse(trimmed) } catch { continue }
        if (message?.jsonrpc === '2.0' && message?.id === 1) return message
      }
      return undefined
    },
    30_000,
    'default-route initialize JSON-RPC response',
  )
  assert.equal(defaultResponse.error, undefined, `initialize returned an error: ${JSON.stringify(defaultResponse.error)}`)
  assert.deepEqual(
    { provider: defaultResponse.result?.route?.provider, model: defaultResponse.result?.route?.model },
    { provider: 'openai-codex', model: 'gpt-5.6-luna' },
  )

  // The request override layer is untouched: explicit params replace the
  // effective route on the same live server.
  child.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'initialize',
    params: { cwd: workspace, provider: 'opencode-go', model: 'deepseek-v4-flash', maxTokens: 8192 },
  })}\n`)
  const explicitResponse = await waitFor(
    () => stdout,
    (lines) => {
      for (const line of lines.split('\n')) {
        const trimmed = line.trim()
        if (trimmed === '') continue
        let message
        try { message = JSON.parse(trimmed) } catch { continue }
        if (message?.jsonrpc === '2.0' && message?.id === 2) return message
      }
      return undefined
    },
    30_000,
    'explicit-route initialize JSON-RPC response',
  )
  assert.equal(explicitResponse.error, undefined, `initialize returned an error: ${JSON.stringify(explicitResponse.error)}`)
  assert.deepEqual(
    { provider: explicitResponse.result?.route?.provider, model: explicitResponse.result?.route?.model },
    { provider: 'opencode-go', model: 'deepseek-v4-flash' },
  )

  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'shutdown', params: {} })}\n`)
  await new Promise((resolve) => {
    const done = () => resolve()
    child.once('exit', done)
    setTimeout(() => { child.removeListener('exit', done); resolve() }, 5_000)
  })
})
