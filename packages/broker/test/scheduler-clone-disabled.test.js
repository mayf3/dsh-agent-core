import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { schedulerManifest } from '../src/capabilities/scheduler.js'
import { createBrokerGateway } from '../src/gateway.js'
import { assertValidManifest } from '../src/mapping.js'
import { createRelayHandlers } from '../src/relay.js'
import { validateSchedulerArguments } from '../src/scheduler-validation.js'
import { buildToolDefinition } from '../src/registry.js'

// clone_disabled broker wiring (AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V4_
// AMENDMENT1_CLONE_DISABLED, DRAFT / PENDING_ACCEPTANCE): the eighth action on
// the ONE existing scheduler capability — closed manifest schema, trusted
// Broker validation, mutation outcome state machine (readiness gate, strict
// committed shape, lost-response reconcile by the NEW logical key) — with the
// seven existing actions' schemas untouched.

const CLONE_ARGS = {
  job_id: 'job-src',
  expected_revision: { schedule_revision: 2, updated_at_ms: 77 },
  new_logical_key: 'owner:v6',
}

function relayRig() {
  const calls = []
  const requestFn = async (call) => {
    calls.push(call)
    return requestFn.next(call)
  }
  requestFn.next = () => { throw new Error('requestFn.next not programmed') }
  return { requestFn, calls }
}

function cloneCommittedResult(overrides = {}) {
  return {
    jobId: 'job-clone', name: 'hr v5', enabled: false,
    normalizedSchedule: { kind: 'every', everyMs: 1_800_000 }, timezone: null,
    nextRunAt: null, targetAgentId: 'agt_a',
    exactPersistedDeliveryDestination: null, autoRetry: false,
    deleteAfterRun: false, auditStatus: 'appended',
    ...overrides,
  }
}

test('manifest: clone_disabled is the eighth closed action; existing seven schemas untouched', () => {
  const manifest = assertValidManifest(schedulerManifest)
  assert.deepEqual(
    manifest.operations.map((operation) => operation.name),
    ['create', 'list', 'runs', 'update', 'enable', 'disable', 'remove', 'clone_disabled'],
  )
  const clone = manifest.operations.find((operation) => operation.name === 'clone_disabled')
  assert.deepEqual(Object.keys(clone.arguments.properties).sort(),
    ['expected_revision', 'job_id', 'new_logical_key', 'new_name'])
  assert.deepEqual(clone.arguments.required.sort(), ['expected_revision', 'job_id', 'new_logical_key'])
  assert.equal(clone.arguments.additionalProperties, false)
  // No definition leaves, no target_agent_id: the copy is server-side only.
  for (const forbidden of ['message', 'schedule_kind', 'every_ms', 'target_agent_id', 'destination', 'delivery_mode']) {
    assert.equal(clone.arguments.properties[forbidden], undefined, forbidden)
  }
  const rawClone = schedulerManifest.operations.find((operation) => operation.name === 'clone_disabled')
  for (const code of rawClone.errors) {
    assert.ok(schedulerManifest.errors.some((base) => base.code === code), code)
  }

  // The model-visible tool enum carries the action; per-action argument
  // schemas stay closed.
  const definition = buildToolDefinition({
    manifest: schedulerManifest,
    handlers: createRelayHandlers(schedulerManifest, async () => ({ ok: true, result: { ok: true, result: {} } })),
  }).definition
  assert.ok(definition.parameters.action.enum.includes('clone_disabled'))
})

test('trusted validation: clone requires the new logical key and the exact two-field CAS; the key is invalid elsewhere', () => {
  assert.ok(validateSchedulerArguments('clone_disabled', CLONE_ARGS).violations.length === 0,
    JSON.stringify(validateSchedulerArguments('clone_disabled', CLONE_ARGS).violations))

  const { new_logical_key: _dropped, ...withoutKey } = CLONE_ARGS
  const noKey = validateSchedulerArguments('clone_disabled', withoutKey)
  assert.ok(noKey.violations.some((violation) => violation.includes('new_logical_key')))

  const noCas = validateSchedulerArguments('clone_disabled', { job_id: 'job-src', new_logical_key: 'owner:v6' })
  assert.ok(noCas.violations.some((violation) => violation.includes('expected_revision')))

  const keyElsewhere = validateSchedulerArguments('update', { job_id: 'j', new_logical_key: 'owner:v6' })
  assert.ok(keyElsewhere.violations.length > 0)

  const keyOnCloneOk = validateSchedulerArguments('clone_disabled', CLONE_ARGS)
  assert.equal(keyOnCloneOk.args.new_logical_key, 'owner:v6')

  // Definition leaves never reach clone_disabled: the manifest property set is
  // closed, so validateInvocation (authoritative boundary) rejects them.
})

test('relay strict result: a clone commit must be the disabled committed shape — enabled results are unprovable', async () => {
  // Disabled committed shape passes through unchanged.
  const ok = relayRig()
  ok.requestFn.next = async () => ({ ok: true, result: { ok: true, result: cloneCommittedResult() } })
  const okHandlers = createRelayHandlers(schedulerManifest, ok.requestFn)
  assert.deepEqual(await okHandlers.clone_disabled('clone_disabled', CLONE_ARGS), cloneCommittedResult())

  // An enabled "clone" result fails strict validation -> reconcile path; the
  // read-back list finds an ENABLED job behind the new key -> STILL_UNKNOWN.
  const enabled = relayRig()
  enabled.requestFn.next = async (call) => {
    if (call.operation === 'clone_disabled') {
      return { ok: true, result: { ok: true, result: cloneCommittedResult({ enabled: true, nextRunAt: '2030-01-01T00:00:00.000Z' }) } }
    }
    if (call.operation === 'list') {
      return { ok: true, result: { ok: true, result: { jobs: [{ id: 'job-clone', name: 'hr v5', enabled: true, schedule: { kind: 'every', everyMs: 1_800_000 }, nextRunAtMs: 1 }] } } }
    }
    throw new Error('unexpected call')
  }
  const enabledHandlers = createRelayHandlers(schedulerManifest, enabled.requestFn)
  const answer = await enabledHandlers.clone_disabled('clone_disabled', CLONE_ARGS)
  assert.equal(answer.errorCode, 'mutation_outcome_unknown')
})

test('relay reconcile on lost clone response: disabled target visible -> APPLIED; absent -> NOT_APPLIED (retry-safe by the SAME new key)', async (t) => {
  // Lost transport, target committed and disabled -> synthetic committed result.
  const applied = relayRig()
  applied.requestFn.next = async (call) => {
    if (call.operation === 'clone_disabled') throw new Error('transport lost')
    if (call.operation === 'list') {
      return { ok: true, result: { ok: true, result: { jobs: [{ id: 'job-clone', name: 'hr v5', enabled: false, logicalKey: 'owner:v6', schedule: { kind: 'every', everyMs: 1_800_000, anchorMs: 1 } }] } } }
    }
    throw new Error('unexpected call')
  }
  const appliedHandlers = createRelayHandlers(schedulerManifest, applied.requestFn)
  const appliedAnswer = await appliedHandlers.clone_disabled('clone_disabled', CLONE_ARGS)
  assert.equal(appliedAnswer.jobId, 'job-clone')
  assert.equal(appliedAnswer.enabled, false)
  assert.equal(appliedAnswer.nextRunAt, null)
  assert.equal(appliedAnswer.auditStatus, 'reconciled')
  assert.deepEqual(applied.calls[1].args, { logical_key: 'owner:v6' }, 'read-back runs under the NEW logical key')

  // Lost transport, nothing committed -> NOT_APPLIED, retry with the SAME key is safe.
  const notApplied = relayRig()
  notApplied.requestFn.next = async (call) => {
    if (call.operation === 'clone_disabled') throw new Error('transport lost')
    if (call.operation === 'list') return { ok: true, result: { ok: true, result: { jobs: [] } } }
    throw new Error('unexpected call')
  }
  const notAppliedHandlers = createRelayHandlers(schedulerManifest, notApplied.requestFn)
  const notAppliedAnswer = await notAppliedHandlers.clone_disabled('clone_disabled', CLONE_ARGS)
  assert.equal(notAppliedAnswer.errorCode, 'mutation_not_applied')
})

test('gateway: readiness gate and availability discovery cover clone_disabled; uncaught handler faults classify as outcome unknown', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'scheduler-clone-gw-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const credentialsFile = join(dir, 'agent-credentials.json')
  await writeFile(credentialsFile, JSON.stringify({ version: 1, credentials: { agt_a: { clientId: 'c', clientSecret: 's' } } }, null, 2))

  let handlerCalls = 0
  const gateway = createBrokerGateway({
    manifests: [schedulerManifest],
    localHandlerResolver: () => ({
      scheduler: new Proxy({}, { get: () => async () => { handlerCalls += 1; return { ok: true, result: cloneCommittedResult() } } }),
    }),
    targets: [],
    authServiceOrigin: 'http://127.0.0.1:1',
    credentialsFile,
  })
  const trustedContext = { agentId: 'agt_a', callerAgentId: 'agt_a', processGeneration: 7, turnExecutionId: 'turn:agt_a:7:1' }
  const answer = await gateway.execute({ capabilityId: 'scheduler', operation: 'clone_disabled', args: CLONE_ARGS }, trustedContext)
  assert.equal(answer.ok, true, JSON.stringify(answer.error ?? {}))
  assert.equal(answer.result.enabled, false)
  assert.equal(handlerCalls, 1)

  const availability = await gateway.execute({ capabilityId: 'broker', operation: 'availability' }, { agentId: 'agt_a' })
  assert.equal(availability.result.capabilities.scheduler.operations.clone_disabled, true)

  // Unready caller (no credential entry): the gate fires before the handler.
  const unready = await gateway.execute(
    { capabilityId: 'scheduler', operation: 'clone_disabled', args: CLONE_ARGS },
    { agentId: 'agt_nobody', callerAgentId: 'agt_nobody', processGeneration: 7, turnExecutionId: 'turn:7:1' },
  )
  assert.equal(unready.ok, false)
  assert.equal(unready.error.code, 'capability_unavailable')
  assert.equal(handlerCalls, 1)

  // Uncaught handler fault on a mutation -> mutation_outcome_unknown (never a
  // fabricated success), matching the five existing mutations.
  const failing = createBrokerGateway({
    manifests: [schedulerManifest],
    localHandlerResolver: () => ({
      scheduler: new Proxy({}, { get: () => async () => { throw new Error('handler exploded') } }),
    }),
    targets: [],
    authServiceOrigin: 'http://127.0.0.1:1',
    credentialsFile,
  })
  const unknown = await failing.execute({ capabilityId: 'scheduler', operation: 'clone_disabled', args: CLONE_ARGS }, trustedContext)
  assert.equal(unknown.ok, false)
  assert.equal(unknown.error.code, 'mutation_outcome_unknown')
})
