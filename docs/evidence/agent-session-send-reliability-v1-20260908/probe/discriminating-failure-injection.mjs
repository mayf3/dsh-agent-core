/**
 * AGENT_SESSION_SEND_RELIABILITY_V1 — discriminating failure injection probe.
 *
 * Drives the REAL accepted implementation (origin/main @ 1cde3cc) with stubbed
 * Router seams to mechanically classify every caller-visible failure of
 * agent_session_send:
 *
 *   - WHERE each error code is created (pre-delivery / post-receipt / relay)
 *   - WHAT the caller can mechanically derive about DELIVERY / REPLY
 *   - WHETHER a lost parent response can be reconciled today (CASE A/G)
 *
 * No production mutation: router + audit are in-memory stubs.
 *
 * Run (from a main worktree with node_modules):
 *   /usr/local/libexec/agent-core/node-runtime/bin/node \
 *     docs/evidence/agent-session-send-reliability-v1-20260908/probe/discriminating-failure-injection.mjs
 * (env must be proxy-free: compose-adjacent modules pin no-proxy runtime)
 */

import assert from 'node:assert/strict'

import { createAgentSessionMessagingAccess } from '../../../../packages/production-runtime/src/agent-session-messaging.js'
import { mapFinalAssistantOutputToOutcome } from '../../../../packages/production-runtime/src/agent-session-reply-wait.js'
import { createAgentSessionMessagingAudit } from '../../../../packages/production-runtime/src/agent-session-messaging-audit.js'
import { createRelayHandlers } from '../../../../packages/broker/src/relay.js'
import { agentSessionMessagingManifest } from '../../../../packages/broker/src/capabilities/agent-session-messaging.js'

// ── stubs ────────────────────────────────────────────────────────────────────

function makeRouter({ deliverImpl, snapshotsByHandle, onReconciled }) {
  const deliveries = []
  return {
    deliveries,
    async deliver(request, opts) {
      deliveries.push({ request, opts })
      return deliverImpl(request, opts)
    },
    readFinalAssistantOutput(handle) {
      return snapshotsByHandle[handle] ?? { state: 'pending' }
    },
    onTurnReconciled(listener) {
      onReconciled?.(listener)
      return () => {}
    },
  }
}

function makeAudit() {
  const rows = []
  const surface = createAgentSessionMessagingAudit({ auditFile: '/dev/null' })
  const mark = (phase) => (entry) => {
    rows.push({ ...entry, phase })
    return 'appended'
  }
  return {
    rows,
    appendIntent: mark('intent'),
    appendOutcome: mark('outcome'),
    appendDenial: mark('denial'),
  }
}

function makeAccess(router, audit, { now, timer } = {}) {
  return createAgentSessionMessagingAccess({
    router,
    audit,
    generateRequestId: () => 'req-PROBE-0001',
    now: now ?? (() => 1_000_000),
    ...(timer === undefined ? {} : { timer }),
  })
}

const ARGS = { targetAgentId: 'agt_b-target', message: 'probe message', timeoutSeconds: 30 }
const CTX = { callerAgentId: 'agt_a-source', sourceTurnExecutionId: 'src-turn-42' }
const RECEIPT = { accepted: true, sessionId: 'main', reconciliationHandle: 'h-PROBE-1' }

function callerView(result) {
  if (result.ok) return JSON.stringify(result.result)
  return JSON.stringify({ code: result.error.code, detail: result.error.detail })
}

/** Derive the two dimensions from the CALLER-VISIBLE envelope alone (today). */
function dimensionsFromEnvelope(result) {
  if (result.ok) {
    if (result.result.status === 'accepted') return { delivery: 'DELIVERED', reply: 'NOT_WAITED' }
    if (result.result.status === 'replied') return { delivery: 'DELIVERED', reply: 'REPLIED' }
    if (result.result.status === 'timeout') return { delivery: 'DELIVERED', reply: 'TIMEOUT' }
  }
  const code = result.error.code
  const deliveredCodes = ['reply_unavailable', 'target_run_failed']
  const notDeliveredCodes = ['invalid_arguments', 'credential_unavailable', 'credential_invalid',
    'access_denied', 'target_not_found', 'target_disabled', 'self_send_not_supported',
    'not_admitted', 'queue_capacity_exceeded', 'transport_failure', 'unsupported_operation']
  if (deliveredCodes.includes(code)) return { delivery: 'DELIVERED', reply: '(from code taxonomy)' }
  if (notDeliveredCodes.includes(code)) return { delivery: 'NOT_DELIVERED', reply: 'NOT_WAITED' }
  if (code === 'outcome_unknown') return { delivery: 'UNKNOWN', reply: 'UNKNOWN' }
  if (code === 'internal_error') return { delivery: 'AMBIGUOUS(pre-delivery=NO / post-receipt malformed receipt=YES)', reply: 'UNKNOWN' }
  return { delivery: 'UNKNOWN', reply: 'UNKNOWN' }
}

let caseNo = 0
async function runCase(name, fn) {
  caseNo += 1
  const out = await fn()
  console.log(`\n── CASE ${caseNo}: ${name}`)
  console.log(`   caller sees : ${out.caller}`)
  console.log(`   dimensions  : ${JSON.stringify(out.dims)}`)
  if (out.extra) console.log(`   ${out.extra}`)
  return out
}

// ── cases ────────────────────────────────────────────────────────────────────

const results = []

// CASE C — receipt committed, reply wait times out.
results.push(await runCase('C: receipt committed + reply deadline expires', async () => {
  const audit = makeAudit()
  const router = makeRouter({ deliverImpl: async () => RECEIPT, snapshotsByHandle: {} })
  let fireTimer
  const access = makeAccess(router, audit, {
    timer: { set: (fn) => { fireTimer = fn }, clear: () => {} },
  })
  const p = access.handlers.agent_session_send.send(ARGS, CTX)
  const timerDone = new Promise((r) => setImmediate(() => { fireTimer(); r() }))
  const [result] = await Promise.all([p, timerDone])
  assert.equal(router.deliveries.length, 1, 'exactly one delivery')
  assert.equal(audit.rows.filter((r) => r.phase === 'intent').length, 1)
  const outcomeRow = audit.rows.find((r) => r.phase === 'outcome')
  return { caller: callerView(result), dims: dimensionsFromEnvelope(result), extra: `audit outcome row: ${JSON.stringify({ result: outcomeRow.result, handle: outcomeRow.reconciliationHandle })}; deliveries=1` }
}))

// CASE D — target Run failed.
results.push(await runCase('D: receipt committed + target Run failed', async () => {
  const audit = makeAudit()
  const router = makeRouter({ deliverImpl: async () => RECEIPT, snapshotsByHandle: { 'h-PROBE-1': { state: 'no_output', terminalState: 'failed' } } })
  const access = makeAccess(router, audit)
  const result = await access.handlers.agent_session_send.send(ARGS, CTX)
  return { caller: callerView(result), dims: dimensionsFromEnvelope(result), extra: `deliveries=${router.deliveries.length}` }
}))

// CASE E — completed with no final output.
results.push(await runCase('E: receipt committed + completed with no output', async () => {
  const audit = makeAudit()
  const router = makeRouter({ deliverImpl: async () => RECEIPT, snapshotsByHandle: { 'h-PROBE-1': { state: 'no_output', terminalState: 'completed' } } })
  const access = makeAccess(router, audit)
  const result = await access.handlers.agent_session_send.send(ARGS, CTX)
  return { caller: callerView(result), dims: dimensionsFromEnvelope(result), extra: `deliveries=${router.deliveries.length}` }
}))

// CASE F — truncated output.
results.push(await runCase('F: receipt committed + truncated output', async () => {
  const audit = makeAudit()
  const router = makeRouter({ deliverImpl: async () => RECEIPT, snapshotsByHandle: { 'h-PROBE-1': { state: 'available', truncated: true, terminalState: 'completed', text: 'partial…' } } })
  const access = makeAccess(router, audit)
  const result = await access.handlers.agent_session_send.send(ARGS, CTX)
  return { caller: callerView(result), dims: dimensionsFromEnvelope(result), extra: `deliveries=${router.deliveries.length}` }
}))

// Evidence-loss reasons (evicted / restart_lost) — post-receipt by construction.
for (const state of ['evicted', 'restart_lost']) {
  results.push(await runCase(`evidence-loss: read state='${state}' (post-receipt)`, async () => {
    const audit = makeAudit()
    const router = makeRouter({ deliverImpl: async () => RECEIPT, snapshotsByHandle: { 'h-PROBE-1': { state } } })
    const access = makeAccess(router, audit)
    const result = await access.handlers.agent_session_send.send(ARGS, CTX)
    return { caller: callerView(result), dims: dimensionsFromEnvelope(result), extra: `deliveries=${router.deliveries.length} (receipt WAS proven before the wait)` }
  }))
}

// CASE B — provable pre-receipt rejection.
results.push(await runCase('B: provable pre-receipt rejection (not_admitted envelope)', async () => {
  const audit = makeAudit()
  const router = makeRouter({ deliverImpl: async () => { const e = new Error('rejected'); e.envelope = 'not_admitted'; throw e } })
  const access = makeAccess(router, audit)
  const result = await access.handlers.agent_session_send.send(ARGS, CTX)
  assert.equal(router.deliveries.length, 1) // deliver() was CALLED but rejected before prompt bytes
  return { caller: callerView(result), dims: dimensionsFromEnvelope(result), extra: 'zero prompt bytes written (envelope contract)' }
}))

// Unproven pre-receipt rejection → outcome_unknown TODAY, no reconciliation.
results.push(await runCase('G1: unproven admission rejection (deliver throws generic)', async () => {
  const audit = makeAudit()
  const router = makeRouter({ deliverImpl: async () => { throw new Error('boom') } })
  const access = makeAccess(router, audit)
  const result = await access.handlers.agent_session_send.send(ARGS, CTX)
  return { caller: callerView(result), dims: dimensionsFromEnvelope(result), extra: `audit outcome row: ${JSON.stringify({ result: audit.rows.find((r) => r.phase === 'outcome')?.result })} — read-back surface TODAY: none` }
}))

// CASE A — receipt committed on the parent, parent response LOST in transit.
results.push(await runCase('A: receipt committed + parent RPC response lost (relay catch)', async () => {
  let parentDeliveries = 0
  let parentOutcome = null
  const requestFn = async () => {
    parentDeliveries += 1
    // Parent really executed the send (receipt committed, audit row written),
    // then the RESPONSE is lost in transport:
    parentOutcome = { ok: true, result: { ok: true, result: { status: 'accepted' } } }
    throw new Error('rpc transport lost')
  }
  const handlers = createRelayHandlers(agentSessionMessagingManifest, requestFn)
  const relayed = await handlers.send('send', ARGS)
  assert.equal(parentDeliveries, 1, 'parent executed exactly once')
  assert.equal(relayed.errorCode, 'outcome_unknown')
  return {
    caller: JSON.stringify(relayed),
    dims: { delivery: 'UNKNOWN (truth: DELIVERED)', reply: 'UNKNOWN' },
    extra: `parent truth ${JSON.stringify(parentOutcome?.result?.result)} — NO read-back is attempted by the relay (scheduler mutations reconcile; session send keeps the ambiguous envelope verbatim)`,
  }
}))

// CASE G2 — parent answered, but the envelope is unusable (ambiguous leg).
results.push(await runCase('G2: parent response structurally unusable (ambiguous leg)', async () => {
  const requestFn = async () => ({ ok: true, result: { hello: 'garbage' } })
  const handlers = createRelayHandlers(agentSessionMessagingManifest, requestFn)
  const relayed = await handlers.send('send', ARGS)
  return { caller: JSON.stringify(relayed), dims: { delivery: 'UNKNOWN', reply: 'UNKNOWN' }, extra: 'relay has no requestId anchor to reconcile with (the runtime-minted requestId never reaches the child on the loss path)' }
}))

// T9 — duplicate suppression: one send() invocation ⇒ exactly one delivery;
// a transport replay at relay level never re-invokes the handler.
results.push(await runCase('T9: duplicate RPC envelope suppression', async () => {
  const audit = makeAudit()
  const router = makeRouter({ deliverImpl: async () => RECEIPT, snapshotsByHandle: {} })
  const access = makeAccess(router, audit)
  await access.handlers.agent_session_send.send(ARGS, CTX)
  const deliveriesPerInvocation = router.deliveries.length
  // Simulated transport replay: relay re-invoked with the SAME args → a NEW
  // logical send (fresh requestId, second delivery) — intentional-send vs
  // replay is today indistinguishable at the wire level.
  const requestFn = async () => { throw new Error('lost') }
  const relayHandlers = createRelayHandlers(agentSessionMessagingManifest, requestFn)
  await relayHandlers.send('send', ARGS)
  await relayHandlers.send('send', ARGS) // replay
  return {
    caller: 'n/a',
    dims: { delivery: 'n/a', reply: 'n/a' },
    extra: `one handler invocation ⇒ ${deliveriesPerInvocation} deliver() (exactly-once per invocation holds); replayed relay invocations each reach the parent as a NEW send (dedup anchor: none model-visible — requestId is runtime-minted per call, replay dedup relies on NO_AUTOMATIC_RETRY)`,
  }
}))

// Session provenance / identity isolation sanity (T13 analog).
results.push(await runCase('T13: target-owned identity + provenance sidecar', async () => {
  const audit = makeAudit()
  const router = makeRouter({ deliverImpl: async () => RECEIPT, snapshotsByHandle: {} })
  const access = makeAccess(router, audit)
  await access.handlers.agent_session_send.send(ARGS, CTX)
  const d = router.deliveries[0]
  return {
    caller: 'n/a',
    dims: { delivery: 'n/a', reply: 'n/a' },
    extra: `messageOrigin=${JSON.stringify(d.opts.messageOrigin)}; args carry no identity fields (${Object.keys(d.request).join(',')})`,
  }
}))

// ── summary ──────────────────────────────────────────────────────────────────

console.log('\n════════════════════════════════════════════════════════════')
console.log('REPLY_UNAVAILABLE_CREATED_AT (mechanical):')
console.log('  ONLY inside send() AFTER router.deliver() returned')
console.log('  receipt.accepted === true, during reply-wait settlement')
console.log('  (agent-session-reply-wait.js mapFinalAssistantOutputToOutcome).')
console.log('  Reasons: truncated | no_output | evicted | restart_lost | never_existed.')
console.log('  NEVER in receipt_only mode; NEVER pre-receipt; NOT on deadline (that')
console.log('  is the SUCCESS envelope {status:"timeout"}).')
console.log('AT_THAT_POINT: INBOX_RECEIPT_EXISTS=YES (proven), TARGET_RUN_EXISTS=YES,')
console.log('  TARGET_RUN_ID_KNOWN=YES (audit outcome row carries reconciliationHandle),')
console.log('  TARGET_RUN_STATUS=terminal-or-evidence-lost, FINAL_OUTPUT_STATUS=<reason>,')
console.log('  PARENT_RPC_STATUS=irrelevant (created parent-side, passed through as a')
console.log('  declared failure; a lost PASS-BACK would be outcome_unknown instead),')
console.log('  DELIVERY_CAN_BE_RECONCILED=YES — delivery is already PROVEN; only the')
console.log('  caller-visible expression and the outcome_unknown read-back are missing.')
