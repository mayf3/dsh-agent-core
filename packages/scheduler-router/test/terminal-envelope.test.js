/**
 * @agent-core/scheduler-router — SCHEDULER_TERMINAL_PROOF_AND_UNKNOWN_
 * CONTAINMENT_V1 RED/green tests for the closed-union envelope passthrough.
 *
 * Principle under test: TERMINATION_PROVEN => the bridge emits a DETERMINISTIC
 * outcome (never outcome_unknown); TERMINATION_NOT_PROVEN => outcome_unknown
 * (fail-closed default unchanged). No error-code whitelists — the authority is
 * the Router's C-010 closed envelope union plus the trusted disposition
 * readback (the same resolveCallerCorrelation surface self-ops consumes).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRouterInvoker } from '../src/index.js'

function fakeProc({ turnError = null } = {}) {
  return {
    agentId: 'agent-x',
    pid: 4242,
    turn: async () => {
      if (turnError) throw turnError
      return { reply: 'ok', ms: 1, promptMs: 1, messageId: 'm-1' }
    },
  }
}

/** Mirrors the real chain executor: onDispatch fires once at the acquire/
 *  dispatch boundary, BEFORE proc.turn() admission can reject. */
function fakeRouter({ proc, correlationResult = undefined } = {}) {
  return {
    runTurnWithRouteChain: async (agentId, args = {}) => {
      args.opts?.onDispatch?.()
      return proc.turn(args.sessionId, args.message, args.opts, args.deadlineMs)
    },
    ...(correlationResult === undefined ? {} : {
      resolveCallerCorrelation: ({ occurrenceId, runId, requestId }) => ({
        occurrenceId, runId, requestId, ...correlationResult,
      }),
    }),
  }
}

// Unique occurrence identity per test: the invoker's requestId admissions
// dedupe (C-008) is a process-lifetime Map — a shared triple would return the
// first test's cached promise instead of exercising the new seam call.
let occurrenceSeq = 0
const REQUEST = () => {
  occurrenceSeq += 1
  const occurrenceId = `occ:red-${occurrenceSeq}`
  return { agentId: 'agent-x', sessionId: 's', message: 'hi', occurrenceId, runId: `run:${occurrenceId}`, requestId: occurrenceId }
}

test('CONTAINMENT: a post-dispatch not_admitted fence rejection is a deterministic pre-start error, never outcome_unknown', async () => {
  const fenced = Object.assign(new Error('agent agent-x has an unresolved outcome_unknown turn; new prompt admission is forbidden'), {
    status: 'not_admitted', envelope: 'not_admitted', reconciliationHandle: null,
    code: 'AGENT_PROCESS_TURN_FENCED', fencedBy: 'turn:unknown-1',
  })
  const invokeAgent = createRouterInvoker(fakeRouter({ proc: fakeProc({ turnError: fenced }) }))
  const request = REQUEST()
  const outcome = await invokeAgent(request)
  assert.equal(outcome.status, 'error', 'the Agent/session fence rejection is deterministic — no second unknown')
  assert.equal(outcome.started, false, 'the envelope proves the exact prompt was never admitted')
  assert.equal(outcome.routerEnvelope, 'not_admitted')
  assert.equal(outcome.routerCode, 'AGENT_PROCESS_TURN_FENCED')
})

test('TERMINAL_PROOF: an authoritative terminal RPC error envelope settles as error even without a terminationEvidence kind', async () => {
  const rpcFailure = Object.assign(new Error('structured session/prompt RPC error response'), {
    status: 'failed', envelope: 'failed', reconciliationHandle: 'turn:h1',
    evidence: { terminationEvidence: null, promptReceipt: 'accepted' },
  })
  const invokeAgent = createRouterInvoker(fakeRouter({ proc: fakeProc({ turnError: rpcFailure }) }))
  const request = REQUEST()
  const outcome = await invokeAgent(request)
  assert.equal(outcome.status, 'error')
  assert.equal(outcome.routerEnvelope, 'failed', 'the Router settled this run failed (rpc_error_response) — the proof must survive the seam')
  assert.equal(outcome.started, true)
  assert.deepEqual(outcome.evidence, { terminationEvidence: null, promptReceipt: 'accepted' })
})

test('TERMINATION_ONLY: outcome_unknown + trusted router readback (child_real_exit) stays outcome_unknown and stamps the proof', async () => {
  const childExit = Object.assign(new Error('agent agent-x (generation 1) exited (code=null, signal=SIGTRAP) without an exact parsed outcome for this turn'), {
    status: 'outcome_unknown', envelope: 'outcome_unknown', reconciliationHandle: 'turn:exit1',
    code: 'AGENT_PROCESS_CHILD_EXITED', evidence: { terminationEvidence: null, promptReceipt: 'accepted' },
  })
  const request = REQUEST()
  const correlationResult = {
    state: 'settled',
    handle: 'turn:exit1',
    snapshot: {
      agentId: 'agent-x',
      callerCorrelation: { occurrenceId: request.occurrenceId, runId: request.runId, requestId: request.requestId },
      lateOutcome: 'terminated_without_outcome',
      terminationEvidence: 'child_real_exit',
      terminationProven: true,
    },
  }
  const invokeAgent = createRouterInvoker(fakeRouter({ proc: fakeProc({ turnError: childExit }), correlationResult }))
  const outcome = await invokeAgent(request)
  assert.equal(outcome.status, 'outcome_unknown', 'a termination proof is NEVER upgraded to a business outcome (Owner P1 ruling, C-039)')
  assert.equal(outcome.evidence?.terminationEvidence, 'child_real_exit', 'the trusted proof rides along for the scheduler terminationSettlement')
  assert.equal(outcome.evidence?.source, 'router_disposition_readback')
  assert.equal(outcome.started, true)
  assert.equal(outcome.reconciliationHandle, 'turn:exit1')
})

test('FAIL_CLOSED: outcome_unknown with a live (pending) router disposition stays outcome_unknown', async () => {
  const unknown = Object.assign(new Error('turn passed its deadline without termination proof'), {
    status: 'outcome_unknown', envelope: 'outcome_unknown', reconciliationHandle: 'turn:live',
    code: 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN', evidence: { source: 'turn_deadline_exceeded' },
  })
  const correlationResult = { state: 'pending', handle: 'turn:live', snapshot: undefined }
  const invokeAgent = createRouterInvoker(fakeRouter({ proc: fakeProc({ turnError: unknown }), correlationResult }))
  const request = REQUEST()
  const outcome = await invokeAgent(request)
  assert.equal(outcome.status, 'outcome_unknown', 'pending = termination not proven — C-001 unchanged')
  assert.equal(outcome.reconciliationHandle, 'turn:live')
})

test('FAIL_CLOSED: outcome_unknown without a correlation readback surface stays outcome_unknown', async () => {
  const unknown = Object.assign(new Error('unknown turn'), {
    status: 'outcome_unknown', envelope: 'outcome_unknown', reconciliationHandle: 'turn:u2',
    evidence: { source: 'turn_deadline_exceeded' },
  })
  const invokeAgent = createRouterInvoker(fakeRouter({ proc: fakeProc({ turnError: unknown }) }))
  const request = REQUEST()
  const outcome = await invokeAgent(request)
  assert.equal(outcome.status, 'outcome_unknown', 'no trusted readback available — fail-closed default preserved')
})

test('SCOPE: a settled router business outcome (late_completed) is NOT consumed by the termination readback', async () => {
  const unknown = Object.assign(new Error('child exited'), {
    status: 'outcome_unknown', envelope: 'outcome_unknown', reconciliationHandle: 'turn:b09',
    code: 'AGENT_PROCESS_CHILD_EXITED', evidence: {},
  })
  const request = REQUEST()
  const correlationResult = {
    state: 'settled',
    handle: 'turn:b09',
    snapshot: {
      agentId: 'agent-x',
      callerCorrelation: { occurrenceId: request.occurrenceId, runId: request.runId, requestId: request.requestId },
      lateOutcome: 'late_completed',
      terminationEvidence: 'child_real_exit',
    },
  }
  const invokeAgent = createRouterInvoker(fakeRouter({ proc: fakeProc({ turnError: unknown }), correlationResult }))
  const outcome = await invokeAgent(request)
  assert.equal(outcome.status, 'outcome_unknown', 'business outcomes stay on the authorized late-outcome seam (self-ops routerFailure parity)')
})

test('FAIL_CLOSED: a bare post-dispatch error without any envelope still stays outcome_unknown', async () => {
  const invokeAgent = createRouterInvoker(fakeRouter({ proc: fakeProc({ turnError: new Error('mystery failure') }) }))
  const request = REQUEST()
  const outcome = await invokeAgent(request)
  assert.equal(outcome.status, 'outcome_unknown')
})
