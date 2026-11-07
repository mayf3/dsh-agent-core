import assert from 'node:assert/strict'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ExecutionLedger } from '../../../src/ledger.js'
import { createWorkflowExecutionEngine } from '../../../src/engine.js'

export const identity = key => ({
  dispatchIntentId: `${key}d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33`,
  nodeVisitId: `${key}d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11`,
  workflowInstanceId: `${key}d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55`,
  ownerPrincipalId: `${key}d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66`,
})
export const due = key => ({ ...identity(key), nextEligibleAt: '2026-09-09T01:00:00Z',
  createdAt: '2026-09-09T00:00:00Z', updatedAt: '2026-09-09T00:30:00Z' })

export function serviceState(dir) { return JSON.parse(readFileSync(join(dir, 'service.json'), 'utf8')) }
export function setServiceState(dir, state) { writeFileSync(join(dir, 'service.json'), JSON.stringify(state)) }
export function events(dir) {
  const file = join(dir, 'attempts.jsonl')
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []
}

export function evidence(key, version = 12) {
  return { ...identity(key), activationState: 'ACTIVE', workflowStateVersion: version,
    assistanceCaseId: '6d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77',
    requestEventSequence: 10, resolutionEventSequence: 11,
    requesterPrincipalId: identity(key).ownerPrincipalId,
    resolverPrincipalId: '7d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e88',
    ingress: 'assignee', reason: null, lastAttemptId: null }
}

export function makeEngine(dir, { key = '0', ledger = new ExecutionLedger({ dir }),
  pause = async () => {}, trace = () => {} } = {}) {
  const calls = { delivers: [], details: 0, evidence: 0 }
  const engine = createWorkflowExecutionEngine({ ledger,
    fetchDuePage: async ({ afterDispatchIntentId } = {}) => {
      const state = serviceState(dir)
      trace({ kind: 'due-validation', at: Date.now(), state })
      if (state[key].dueFailure === 'throw') throw new Error('fixture canonical due read unavailable')
      if (state[key].dueFailure === 'unavailable') return { ok: false, code: 'unavailable' }
      if (state[key].dueFailure === 'malformed') return { ok: true, items: [null] }
      return { ok: true, items: afterDispatchIntentId ? []
        : ['0', '1'].filter(k => state[k].active).map(k => ({ ...due(k), ...state[k].dueDrift })) }
    },
    resolvePrincipalToAgent: async () => ({ ok: true, agentId: 'agt_lock-timing' }),
    getTurnReconciliation: () => ({ state: serviceState(dir)[key].settled ? 'settled' : 'pending' }),
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    readInstanceDetail: async ({ workflowInstanceId }) => {
      calls.details += 1
      const target = ['0', '1'].find(k => identity(k).workflowInstanceId === workflowInstanceId)
      const state = serviceState(dir)[target]
      const id = identity(target)
      if (state.detailFailure === 'throw') throw new Error('fixture canonical detail read unavailable')
      const response = { ok: state.detailFailure !== 'unavailable', body: { visibility: state.visibility ?? 'full', detail: {
        instance: { workflow_instance_id: state.instanceId ?? id.workflowInstanceId, is_terminal: state.terminal ?? false,
          workflow_state_version: state.version }, current_node_visit_id: state.currentVisitId ?? id.nodeVisitId,
        current_visit: { node_visit_id: state.visitId ?? id.nodeVisitId,
          workflow_instance_id: state.visitInstanceId ?? id.workflowInstanceId,
          assignee_principal_id: state.assigneeId ?? id.ownerPrincipalId },
      } } }
      if (state.detailFailure === 'malformed') response.body.detail = null
      const startedAt = Date.now()
      trace({ kind: 'detail-start', call: calls.details, startedAt, version: state.version })
      if (calls.details === 1) await pause('pre-plan', { response })
      if (calls.details === 2) await pause('final-validation', { response })
      trace({ kind: 'detail-end', call: calls.details, startedAt, endedAt: Date.now(), version: state.version })
      return response
    },
    readOwnerAssistanceResumeEvidence: async request => {
      calls.evidence += 1
      const state = serviceState(dir)[key]
      if (state.evidenceFailure === 'throw') throw new Error('fixture Owner evidence unavailable')
      if (state.evidenceFailure === 'timeout') throw Object.assign(new Error('fixture proof timeout'), { code: 'ETIMEDOUT' })
      const response = state.evidenceFailure === 'unavailable' ? { ok: false, code: 'unavailable' }
        : state.evidenceFailure === 'restricted' ? { ok: false, code: 'forbidden' }
          : { ok: true, evidence: state.evidenceFailure === 'malformed' ? { ...evidence(key, state.version),
            resolutionEventSequence: '11' } : evidence(key, state.version) }
      const startedAt = Date.now()
      trace({ kind: 'evidence-start', request, startedAt })
      await pause('evidence', { request, response })
      trace({ kind: 'evidence-end', startedAt, endedAt: Date.now() })
      return response
    },
    deliverRun: async request => {
      calls.delivers.push(request)
      trace({ kind: 'delivery', requestId: request.requestId, at: Date.now() })
      return { ok: true, sessionId: 'main', reconciliationHandle: `turn:${request.requestId}` }
    },
    buildInstruction: input => `instruction:${input.attemptId}`,
  })
  return { ledger, engine, calls }
}

export async function setup({ ownerResume = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wec4-lock-timing-'))
  setServiceState(dir, { 0: { version: 12, active: true, settled: true },
    1: { version: 12, active: true, settled: true } })
  if (ownerResume) {
    const ledger = new ExecutionLedger({ dir })
    const first = await ledger.beginAttemptIfAbsent(due('0'), async (attempt, { recordDeliveryStarted }) => {
      recordDeliveryStarted()
      return { kind: 'run_delivered', agentId: 'agt_lock-timing', requestId: attempt.attemptId,
        sessionId: 'main', reconciliationHandle: 'turn:prior', workflowStateVersionAtDispatch: 1 }
    }, undefined, async () => ({ preDeliveryWorkflowStateVersion: 1 }))
    assert.equal(first.created, true)
    await ledger.recordReconciled({ nodeVisitId: identity('0').nodeVisitId,
      expectedAttemptId: first.attempt.attemptId, expectedGeneration: 1,
      expectedPhase: 'run_delivered', verdict: 'NEEDS_REVIEW',
      judgment: 'run_ended_no_submission', reason: 'fixture: prior settled run without submission' })
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

export function writer(dir, { name, key = '0', pause = '' }) {
  const child = fork(new URL('./writer-process.js', import.meta.url), [dir, name, key, pause],
    { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] })
  const messages = []
  const waiting = []
  let stderr = ''
  child.stderr.on('data', data => { stderr += data })
  child.on('message', message => {
    messages.push(message)
    for (const item of [...waiting]) {
      if (item.stage === message.stage) {
        waiting.splice(waiting.indexOf(item), 1)
        item.resolve(message)
      }
    }
  })
  const exited = once(child, 'exit')
  return { child, messages, exited,
    async next(stage) {
      const prior = messages.find(message => message.stage === stage)
      if (prior) return prior
      return new Promise(resolve => waiting.push({ stage, resolve }))
    },
    send(message) { child.send(message) },
    get stderr() { return stderr },
    async close() {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      await exited
    },
  }
}

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export function describe(t, label, data) { t.diagnostic(`${label}: ${JSON.stringify(data)}`) }
