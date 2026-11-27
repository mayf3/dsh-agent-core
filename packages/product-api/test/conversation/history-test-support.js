import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createConversationService } from '../../src/conversation/service.js'

export const agent = 'agt_pilot'
export const credential = 'Basic ' + Buffer.from('pilot-client:fixture-secret').toString('base64')
const config = ops => ({ enabled: true, authServiceOrigin: 'https://auth.example', retentionMs: 3600000,
  maxRecords: 100, clients: [{ clientId: 'pilot-client', subject_id: 'dot-subject', communication_scope_id: 'pilot-scope',
    principal_id: 'product-principal', operations: ops, targets: [{ agent_id: agent,
      principal_id: 'agent-principal', domain_id: 'pilot-domain', binding_id: 'mcp:pilot', routing_version: '1' }] }] })

export async function fixture(t, ops = ['resolve', 'send', 'result', 'history', 'events'], retentionMs = 3600000) {
  const dir = mkdtempSync(join(tmpdir(), 'native-history-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const storeFile = join(dir, 'requests.json')
  const calls = [], sources = new Map()
  let clock = 100000, callback
  const counters = { monitor: 0, execute: 0, business: 0 }
  const router = {
    getBinding: () => ({ activeAgentId: agent, activeSessionId: 'main', workspace: null }),
    sendProductSurface: async ({ requestId, message }) => { calls.push({ requestId, message });
      return { accepted: true, sessionId: 'main', messageId: 'user-' + calls.length,
        sessionGeneration: 'trajectory:fixture', reconciliationHandle: 'turn-' + calls.length } },
    readConversationSource: ({ requestId }) => { sources.reads = (sources.reads ?? 0) + 1; return sources.get(requestId) ?? { state: 'pending' } },
    onTurnReconciled: fn => { callback = fn; return () => {} },
  }
  for (const [name, counter] of Object.entries({ monitor: 'monitor', execute: 'execute', startProcess: 'execute',
    route: 'execute', switchAgent: 'business', updateWorkflow: 'business' })) {
    router[name] = () => { counters[counter]++; throw new Error('forbidden read effect: ' + name) }
  }
  const cfg = config(ops)
  cfg.retentionMs = retentionMs
  const make = () => createConversationService({ router, definition: { getAgent: id => ({ id, disabled: false }) },
    storeFile, now: () => clock, configProvider: () => cfg, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'fixture-ignored', token_type: 'Bearer', expires_in: 60 }) }) })
  let service = make()
  t.after(() => service.close())
  return { dir, storeFile, calls, sources, make, router, counters, advance: ms => { clock += ms }, emit: () => callback?.({}), get service() { return service }, reset: () => { service.close(); service = make() }, cfg }
}

export async function resolvedSend(t, fx, requestId, message) {
  const targetHandle = (await fx.service.invoke('resolve', { target: { agent_id: agent } }, credential)).body.target_handle
  const response = await fx.service.invoke('send', { request_id: requestId, target_handle: targetHandle, message }, credential)
  assert.equal(response.status, 202)
  return { body: response.body, nativeId: fx.calls.at(-1).requestId }
}
