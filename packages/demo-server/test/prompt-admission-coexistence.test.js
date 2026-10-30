/** Actual stdio dispatch, reservation provider and durable custody; synthetic Agent/model. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { readConversationSource } from '../../agent-router/src/conversation/source.js'
import { readCustodyProjection } from '../src/website-custody.js'

const website = { namespace: 'website-human-inquiry-v1', human_principal_id: 'human',
  communication_scope_id: 'website-scope', request_id: 'website-rid', payload_digest: 'a'.repeat(64),
  site_owner_binding_version: 'v1' }
const goalSource = { kind: 'goal', goalId: 'native-goal', revision: 1, round: 1 }

async function boot(t) {
  const home = mkdtempSync(join(tmpdir(), 'prompt-coexist-'))
  const sourceDirectory = join(home, 'conversation-source')
  const program = `
    import { apply } from ${JSON.stringify(new URL('../src/index.js', import.meta.url).href)};
    const emit = (method, params) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\\n');
    const services = { agentLoop: {}, loader: { await: async () => {} },
      goalRoundDriver: { protocolVersion: 1, enqueueMode: 'external' },
      sessionPersistence: { list: async () => [], flush: async () => {} } };
    let prepared = false;
    services.agents = { create: async ({ sessionId, meta }) => {
      emit('fixture/session-created', { sessionId });
      const agent = { session: { id: sessionId, header: { id: sessionId, cwd: meta.cwd, createdAt: 123 }, seq: 0 },
        followup(message) {
          emit('fixture/followup', message);
          if (message.source.kind === 'goal') {
            void services.agentRpc.request('fixture/native-proof', { messageId: message.id });
          }
          if (!prepared && message.content[0]?.text === 'prepare native reservation') {
            prepared = true;
            const nativeMessage = { id: 'original-native-goal-message', source: ${JSON.stringify(goalSource)},
              content: [{ type: 'text', text: 'exact native goal continuation' }] };
            void services.goalRoundEnqueue.enqueue({ agent, message: nativeMessage,
              signal: new AbortController().signal, commit() {
                agent.followup(nativeMessage);
                return { kind: 'enqueued', messageId: nativeMessage.id };
              } }).then(result => emit('fixture/native-result', result));
          }
        } };
      return { agent, dispose: async () => {} };
    } };
    const ctx = { get: key => services[key], provide: (key, value) => { services[key] = value },
      on: () => () => {}, root: { fiber: { dispose: async () => {} } } };
    apply(ctx, { nativeGoalContinuation: true });
  `
  const child = spawn(process.execPath, ['--input-type=module', '-e', program], {
    env: { PATH: process.env.PATH, DSH_HOME: home, DSH_AGENT_ID: 'agt_coexist',
      DSH_CONVERSATION_SOURCE_DIR: sourceDirectory }, stdio: ['pipe', 'pipe', 'pipe'],
  })
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await once(child, 'exit')
    }
    rmSync(home, { recursive: true, force: true })
  })
  const messages = []
  let buffer = '', errors = '', sequence = 0
  const send = (method, params) => {
    const id = ++sequence
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    return id
  }
  child.stdout.on('data', chunk => {
    buffer += chunk
    let end
    while ((end = buffer.indexOf('\n')) >= 0) {
      const message = JSON.parse(buffer.slice(0, end))
      buffer = buffer.slice(end + 1)
      messages.push(message)
      if (message.method === 'rpc.request' && message.params.method === 'fixture/native-proof') {
        send('rpc.response', { requestId: message.params.requestId, ok: true, result: {} })
      }
    }
  })
  child.stderr.on('data', chunk => { errors += chunk })
  const wait = async predicate => {
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
      const found = messages.find(predicate)
      if (found) return found
      assert.equal(child.exitCode, null, errors)
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    assert.fail(`wire observation timed out: ${errors}`)
  }
  const response = id => wait(message => message.id === id)
  const id = send('initialize', { cwd: home, nativeGoalContinuation: { version: 1 } })
  assert.equal((await response(id)).error, undefined)
  return { home, sourceDirectory, messages, send, wait, response,
    prompt: params => send('session/prompt', { sessionId: 'main', cwd: home,
      contentBlocks: [{ type: 'text', text: 'ordinary question' }], ...params }) }
}

async function pendingGoal(f) {
  const id = f.prompt({ contentBlocks: [{ type: 'text', text: 'prepare native reservation' }] })
  assert.equal((await f.response(id)).error, undefined)
  const request = await f.wait(message => message.method === 'rpc.request'
    && message.params.method === 'agent-core/nativeGoalContinuation')
  return { request, params: { nativeGoalContinuation: request.params.params,
    contentBlocks: request.params.params.contentBlocks, turnExecutionId: 'native-parent-handle' } }
}

const goalMessages = f => f.messages.filter(message => message.method === 'fixture/followup'
  && message.params.source.kind === 'goal')
const custodyFiles = home => {
  try { return readdirSync(join(home, 'website-inquiry-custody')) } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

test('native reservation remains reachable and commits its original goal message exactly once', async t => {
  const f = await boot(t)
  const native = await pendingGoal(f)
  for (let count = 0; count < 2; count++) {
    const response = await f.response(f.prompt(native.params))
    assert.deepEqual(response.result, { messageId: 'original-native-goal-message' })
  }
  assert.equal(goalMessages(f).length, 1)
  assert.deepEqual(goalMessages(f)[0].params.source, goalSource)
  assert.deepEqual(goalMessages(f)[0].params.content, [{ type: 'text', text: 'exact native goal continuation' }])
  const proof = await f.wait(message => message.method === 'rpc.request' && message.params.method === 'fixture/native-proof')
  assert.equal(proof.params.turnExecutionId, 'native-parent-handle')
  f.send('rpc.response', { requestId: native.request.params.requestId, ok: true,
    result: { kind: 'enqueued', messageId: 'original-native-goal-message', reconciliationHandle: 'native-parent-handle' } })
  assert.equal((await f.wait(message => message.method === 'fixture/native-result')).params.kind, 'enqueued')
})

test('website and MCP user prompts each retain their own custody with native admission enabled', async t => {
  const f = await boot(t)
  const id = f.prompt({ websiteAdmission: website })
  const gate = await f.wait(message => message.id === id || (message.method === 'rpc.request'
    && message.params.method === 'agent-core/websiteInquiryMap'))
  assert.equal(gate.method, 'rpc.request', 'website mapping must finish before prompt acceptance')
  assert.equal(f.messages.filter(message => message.method === 'fixture/followup').length, 0)
  const custody = readCustodyProjection(f.home, website)
  assert.equal(custody.userMessageId, gate.params.params.messageId)
  f.send('rpc.response', { requestId: gate.params.requestId, ok: true, result: { mapped: true } })
  const admitted = await f.response(id)
  assert.equal(admitted.result.messageId, custody.userMessageId)
  assert.deepEqual(f.messages.find(message => message.method === 'fixture/followup').params.source, { kind: 'user' })

  const mcp = await f.response(f.prompt({ conversationSource: { requestId: 'mcp-independent-rid' } }))
  assert.equal(mcp.error, undefined)
  const retained = readConversationSource({ directory: f.sourceDirectory, agentId: 'agt_coexist', requestId: 'mcp-independent-rid' })
  assert.equal(retained.message_id, mcp.result.messageId)
  assert.equal(mcp.result.sourceRetentionVersion, 1)
  assert.equal(custodyFiles(f.home).length, 1)
  const delivered = f.messages.filter(message => message.method === 'fixture/followup')
  assert.equal(delivered.length, 2)
  assert.deepEqual(delivered[1].params.source, { kind: 'user' })
})

for (const [label, carriers] of [
  ['website', { websiteAdmission: website }],
  ['MCP', { conversationSource: { requestId: 'mcp-mixed-rid' } }],
  ['website and MCP', { websiteAdmission: website, conversationSource: { requestId: 'mcp-mixed-rid' } }],
]) test(`valid native reservation mixed with ${label} is rejected before commit or custody`, async t => {
  const f = await boot(t)
  const native = await pendingGoal(f)
  const rejected = await f.response(f.prompt({ ...native.params, ...carriers }))
  assert.ok(rejected.error, 'a valid reservation must not bypass product-surface custody')
  assert.equal(goalMessages(f).length, 0)
  assert.equal(custodyFiles(f.home).length, 0)
  assert.equal(readConversationSource({ directory: f.sourceDirectory, agentId: 'agt_coexist', requestId: 'mcp-mixed-rid' }).state, 'not_found')
  assert.equal(f.messages.filter(message => message.method === 'fixture/followup').length, 1)
  const later = await f.response(f.prompt(native.params))
  assert.deepEqual(later.result, { messageId: 'original-native-goal-message' })
  assert.equal(goalMessages(f).length, 1, 'rejected mixture must leave the valid reservation uncommitted')
})

test('ordinary website plus MCP carriers stay rejected before session creation or custody', async t => {
  const f = await boot(t)
  const response = await f.response(f.prompt({ websiteAdmission: website,
    conversationSource: { requestId: 'ordinary-mixed-rid' } }))
  assert.ok(response.error)
  assert.equal(f.messages.filter(message => message.method === 'fixture/session-created').length, 0)
  assert.equal(f.messages.filter(message => message.method === 'fixture/followup').length, 0)
  assert.equal(custodyFiles(f.home).length, 0)
  assert.equal(readConversationSource({ directory: f.sourceDirectory, agentId: 'agt_coexist', requestId: 'ordinary-mixed-rid' }).state, 'not_found')
})
