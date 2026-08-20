import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { AgentProcess } from '../../agent-router/src/process.js'
import { apply as applyRouter } from '../../agent-router/src/index.js'
import { createBridgeHandler } from '../src/bridge.js'
import { p2pTextEvent } from '../fixtures/fixtures.js'
import { dispatchEnvelope, realSdkChannel, TEST_BOT_IDENTITY } from './real-sdk-harness.js'

function waitFor(predicate, label, timeoutMs = 3000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (predicate()) return resolve()
      if (Date.now() - started >= timeoutMs) return reject(new Error(`timed out waiting for ${label}`))
      setTimeout(poll, 10)
    }
    poll()
  })
}

function cloneWithMessageId(messageId) {
  const envelope = structuredClone(p2pTextEvent)
  envelope.header.event_id = `evt_${messageId}`
  envelope.event.message.message_id = messageId
  return envelope
}

function emit(proc, message) {
  proc.onStdout(`${JSON.stringify(message)}\n`)
}

function completeTurn(proc, prompt, { reply, providerError }) {
  emit(proc, { jsonrpc: '2.0', id: prompt.id, result: { messageId: `receipt-${prompt.id}` } })
  const sessionId = prompt.params.sessionId
  const messageId = `receipt-${prompt.id}`
  const events = [
    { type: 'agent/inbox/spliced', data: { inserted: [{ id: messageId }] } },
    { type: 'turn/start', data: { turn: prompt.id } },
    { type: 'user/message', data: { id: messageId } },
    ...(providerError === undefined
      ? [{ type: 'assistant/message', data: { message: { id: `answer-${prompt.id}`, content: [{ type: 'text', text: reply }] } } }]
      : []),
    { type: 'turn/end', data: { turn: prompt.id, reason: providerError === undefined ? { kind: 'completed' } : { kind: 'error', error: providerError } } },
  ]
  for (const event of events) emit(proc, { jsonrpc: '2.0', method: 'session.event', params: { sessionId, event } })
  emit(proc, { jsonrpc: '2.0', method: 'session.status', params: { sessionId, status: 'idle' } })
}

test('AC-CURRENT-MAIN-FULL-TURN-PROMISE: real AgentProcess + Router stay inside the reviewed SDK lease on success and terminal error', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'lark-current-main-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const writes = []
  let proc
  const errorReplyGate = {}
  errorReplyGate.promise = new Promise((resolve) => { errorReplyGate.resolve = resolve })
  const replies = []
  let routerCallback

  const feishu = {
    setCallback(fn) { routerCallback = fn },
    replyTargetFor() { return { replyTo: () => ({ kind: 'reply' }) } },
    async reply(_target, text) {
      replies.push(text)
      if (String(text).startsWith('[agent-core] delivery failed:')) await errorReplyGate.promise
      return { messageId: `reply-${replies.length}` }
    },
  }
  const workspaceBootstrap = {
    async ensure() {},
    async ensureWorkspace() {},
    resolveWorkspace: () => dir,
    resolveWorkspacePath: () => dir,
    resolveDshHome: () => dir,
    validateWorkspaceId: (value) => value,
  }
  const definition = {
    getAgent: (id) => {
      if (id !== 'agt_test') throw Object.assign(new Error('not found'), { code: 'AGENT_NOT_FOUND' })
      return { id, name: 'Test Agent' }
    },
    getDefaultAgent: () => ({ id: 'agt_test', name: 'Test Agent' }),
    listAgents: () => [{ id: 'agt_test', name: 'Test Agent' }],
    resolveAgentRef: () => ({ id: 'agt_test', name: 'Test Agent' }),
  }
  const services = new Map([
    ['workspaceBootstrap', workspaceBootstrap],
    ['agentDefinition', definition],
    ['feishu', feishu],
  ])
  const ctx = {
    get: (name) => services.get(name),
    provide: (name, value) => services.set(name, value),
    effect: (fn) => { const dispose = fn(); return () => dispose?.() },
  }
  const router = applyRouter(ctx, {
    bindingsStoreFile: join(dir, 'bindings.json'),
    defaultAgentId: 'agt_test',
    defaultSessionId: 'main',
    agentProfile: 'agent-core-production',
    provisionHome: () => {},
    processFactory: (options) => {
      proc = new AgentProcess(options)
      proc.child = { stdin: { write: (line) => writes.push(JSON.parse(line)) } }
      proc.spawn = function spawnOffline() {
        this.pid = 4242
        this.exitPromise = new Promise(() => {})
        return this
      }
      proc.ready = async () => 0
      return proc
    },
  })
  assert.equal(routerCallback, router.route, 'Router installed its current onIngress seam')

  const bridge = createBridgeHandler({
    resolveBotIdentity: () => TEST_BOT_IDENTITY,
    config: { ingressGate: async () => ({ allowed: true }), onEvent: routerCallback },
  })
  const observedErrors = []
  const channel = realSdkChannel({
    safety: { processingLock: { ttlMs: 40, renewIntervalMs: 10 } },
    onMessage: bridge,
    onError: (error) => { observedErrors.push(error) },
  })
  t.after(() => channel.safety.dispose())

  const success = cloneWithMessageId('om_current_success')
  await dispatchEnvelope(channel, success)
  await waitFor(() => writes.filter((write) => write.method === 'session/prompt').length === 1, 'success prompt')
  await new Promise((resolve) => setTimeout(resolve, 90))
  await dispatchEnvelope(channel, success)
  assert.equal(writes.filter((write) => write.method === 'session/prompt').length, 1, 'success duplicate blocked beyond TTL')
  completeTurn(proc, writes.find((write) => write.method === 'session/prompt'), { reply: 'same-turn answer' })
  await waitFor(() => replies.includes('same-turn answer'), 'final success reply')
  assert.equal(observedErrors.length, 0)

  const failed = cloneWithMessageId('om_current_error')
  await dispatchEnvelope(channel, failed)
  await waitFor(() => writes.filter((write) => write.method === 'session/prompt').length === 2, 'error prompt')
  const errorPrompt = writes.filter((write) => write.method === 'session/prompt')[1]
  completeTurn(proc, errorPrompt, { providerError: { code: 'UNAVAILABLE', message: 'provider unavailable' } })
  await waitFor(() => replies.some((text) => String(text).startsWith('[agent-core] delivery failed:')), 'terminal failure reply handling')
  await new Promise((resolve) => setTimeout(resolve, 90))
  await dispatchEnvelope(channel, failed)
  assert.equal(writes.filter((write) => write.method === 'session/prompt').length, 2, 'error duplicate blocked while final failure reply is pending')
  assert.equal(observedErrors.length, 0, 'public error waits for Router final error handling')

  errorReplyGate.resolve()
  await waitFor(() => observedErrors.length === 1, 'public SDK error')
  assert.match(observedErrors[0].message, /provider unavailable/)
})
