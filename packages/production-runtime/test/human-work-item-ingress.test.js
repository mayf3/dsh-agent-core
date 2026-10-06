/**
 * G5 Human Work Item Feishu action ingress — RED-first seam tests
 * (Product #478, NON-PRODUCTION lane, ACCEPTANCE_MODE = TEST_IDENTITY).
 *
 * The seam under test is the composition-level handler in
 * production-runtime/src/human-work-item-ingress.js. It sits AFTER the
 * feishu-connector bridge gate and BEFORE the Router's authenticated ingress
 * delivery. All gateway/feishu/audit edges are fakes; the wire contract
 * mirrors the REAL surfaces pinned in SOURCE_CENSUS.md:
 *
 *   - broker gateway envelope {ok, result|error{code,status?,detail?}} with
 *     gateway.execute(call, {agentId}) credential-keyed identity;
 *   - svc-workflow worklist/detail responses SNAKE_CASE
 *     (tests/17_workflow_runtime/http/worklists.rs:363-366);
 *   - transition responses CAMELCASE (src/http/dto.rs:50-63);
 *   - RETURN submission contract {rootCauseNodeVisitId, reasonCode, reason}
 *     (transition_validation.rs:376-436);
 *   - stable downstream error codes surface VERBATIM (never translated,
 *     never retried).
 *
 * Frozen verdicts proven here:
 *
 *   AUTHORIZATION  handle ⟺ p2p ∧ strict `/work` grammar ∧ allowlisted
 *                  sender.openId; EVERYTHING else falls through to the
 *                  Router's authenticated delivery byte-identically.
 *   IDENTITY       exact-string allowlist match only; no substring, prefix,
 *                  case-fold or whitespace inference ever authorizes.
 *   ACTIONS        query/complete/reject drive ONLY the existing canonical
 *                  surfaces (workflow_my_tasks / workflow_instance_detail /
 *                  workflow_execute transition) with fresh-read CAS.
 *   DUPLICATES     no seam-side state machine; same-message redelivery is the
 *                  bridge's dedup domain; two distinct commands are two
 *                  canonical attempts resolved by server CAS/receipts.
 *   STALE/INVALID  stale version / terminal / foreign instance surface the
 *                  verbatim stable code and never retry.
 *   PROVENANCE     one closed, secret-free JSONL audit row per handled
 *                  command (6-char open_id prefix) + canonical receipt ids in
 *                  the success reply.
 *   ZERO EFFECTS   feature OFF by default; unauthorized senders' `/work`
 *                  messages reach the Router untouched; non-p2p is never
 *                  consumed; explicit misconfiguration fails loud.
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  HUMAN_WORK_ITEM_INGRESS_ENABLED_ENV,
  HUMAN_WORK_ITEM_INGRESS_PRINCIPALS_FILE_ENV,
  createHumanWorkItemIngressHandler,
  isStrictTruthyEnv,
  loadPrincipalBindings,
  parseWorkItemCommand,
  wireHumanWorkItemIngress,
} from '../src/human-work-item-ingress.js'

// ───────────────────────────────────────────────────────────────────────────
// Fixtures — wire shapes pinned to the real surfaces (see header).
// ───────────────────────────────────────────────────────────────────────────

const OPEN_ID = 'ou_8b1f2c3d4e5f6a7b8c9d0e1f2a3b4c5d'
const EXECUTOR_AGENT_ID = 'agt_human_work_item_executor'
const HUMAN_PRINCIPAL_ID = '8902db0d-429a-4e37-985c-f8b92d4b78fb'
const INSTANCE_ID = '5f0c3a12-9b7e-4d8a-a1b2-c3d4e5f60718'
const TRANSITION_ID = '1a2b3c4d-5e6f-4a4b-8c8d-9e0f1a2b3c4d'
const RETURN_TRANSITION_ID = '9e0f1a2b-3c4d-4e5f-8a8b-7c6d5e4f3a2b'
const VISIT_ID = 'aa11bb22-cc33-4d44-8e55-ff66aa77bb88'
const OTHER_ID = '7777aaaa-bbbb-4ccc-8ddd-eeeeffff0000'

/** svc-workflow worklist page (SNAKE_CASE wire, one active item). */
const worklistPage = () => ({
  items: [
    {
      detail: {
        instance: {
          workflow_instance_id: INSTANCE_ID,
          domain_id: 'd0d0d0d0-0000-0000-0000-000000000001',
          workflow_state_version: 7,
          metadata: { title: 'Q3 report review' },
          external_reference: 'feat/q3-report',
          current_node: { display_name: 'PM Review', node_key: 'pm_review', node_type: 'APPROVAL' },
        },
        current_node_visit_id: VISIT_ID,
        current_visit: { node_visit_id: VISIT_ID, assignee_principal_id: HUMAN_PRINCIPAL_ID, visit_number: 2 },
        outgoing_transitions: [
          {
            transition_id: TRANSITION_ID,
            transition_key: 'approve',
            display_name: 'Approve',
            transition_effect: 'ADVANCE',
            executable_for_actor: true,
            blocked_reason: null,
            submission_schema: null,
          },
          {
            transition_id: RETURN_TRANSITION_ID,
            transition_key: 'return_to_author',
            display_name: 'Return to author',
            transition_effect: 'RETURN',
            executable_for_actor: true,
            blocked_reason: null,
            submission_schema: { type: 'object' },
          },
        ],
      },
      upstreamSubmissions: [],
      returnFeedbackEvents: [],
      submissionsTruncated: false,
      returnEventsTruncated: false,
    },
  ],
  next_cursor: null,
})

/** svc-workflow instance detail (SNAKE_CASE wire) — same instance. */
const detailFull = () => ({
  visibility: 'full',
  detail: worklistPage().items[0].detail,
})

/** svc-workflow transition response (CAMELCASE wire, dto.rs:50-63). */
const transitionReceipt = () => ({
  workflowInstanceId: INSTANCE_ID,
  workflowStateVersion: 8,
  currentContextRevisionId: 'cc55dd66-ee77-4888-9a99-bbccdd00ee11',
  sourceNodeVisitId: VISIT_ID,
  currentNodeVisitId: 'ff00ee11-dd22-4c33-8b44-aa55bb66cc77',
  submissionId: null,
  eventSequence: 8,
})

/** Stable downstream error envelope (broker passthrough shape). */
const svcError = (code, status = 403) => ({ ok: false, error: { code, status, detail: 'downstream says no' } })

/** p2p IngressEvent (bridge.js:144-173 shape, fields the seam may read). */
const p2pEvent = (text, { openId = OPEN_ID, channel = 'p2p', messageId = 'om_1' } = {}) => ({
  eventId: `evt_${messageId}`,
  type: 'message',
  subType: 'text',
  channel,
  chatType: channel,
  conversationId: channel === 'p2p' ? `oc_p2p_${openId.slice(3, 11)}` : 'oc_group_1',
  chatId: channel === 'p2p' ? `oc_p2p_${openId.slice(3, 11)}` : 'oc_group_1',
  messageId,
  messageType: 'text',
  sender: { openId, senderType: 'user', isBotSelf: false, selfSent: false, senderId: openId },
  text,
  mentions: [],
  mentioned: false,
  addressed: true,
  attachments: [],
  timestamp: Date.now(),
  dedupKey: `evt_${messageId}`,
})

/** Fake broker gateway recording execute() calls; scripted responses. */
function fakeGateway(script = {}) {
  const calls = []
  return {
    calls,
    execute(call, context) {
      calls.push({ call, context: { ...context } })
      const key = `${call.capabilityId}:${call.operation}`
      const next = script[key]?.shift()
      if (next === undefined) return { ok: false, error: { code: 'script_exhausted', status: 500 } }
      return typeof next === 'function' ? next(call, context) : next
    },
  }
}

/** Fake feishu reply surface — mirrors the REAL contract's failure mode:
 * the connector's replyTargetToSdkSend throws on a kind-less ReplyTarget
 * (core.js:441), so a target without a resolved replyTo(messageId) throws. */
function fakeFeishu() {
  const receipts = []
  return {
    receipts,
    reply: async (target, text) => {
      if (typeof target?.messageId !== 'string' || target.messageId.length === 0) {
        throw new Error('unknown ReplyTarget kind "undefined" (missing replyTo)')
      }
      receipts.push({ target, text })
    },
    replyTargetFor: (ingress) => ({
      conversationId: ingress.conversationId,
      replyTo(messageId) { this.messageId = messageId; return this },
    }),
  }
}

/** Handler rig: allowlisted sender, fake edges, recorded fall-through. */
async function rig({ bindings, gateway = fakeGateway(), now = () => 1_700_000_000_000 } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'g5-ingress-'))
  const bindingsFile = join(dir, 'human-work-item-principals.json')
  const auditFile = join(dir, 'control', 'human-work-item-audit.jsonl')
  await writeFile(bindingsFile, JSON.stringify(bindings ?? {
    version: 1,
    principals: [{ feishuOpenId: OPEN_ID, executorAgentId: EXECUTOR_AGENT_ID, humanPrincipalId: HUMAN_PRINCIPAL_ID }],
  }), 'utf8')

  const loaded = loadPrincipalBindings(bindingsFile)
  assert.equal(loaded.ok, true)
  const feishu = fakeFeishu()
  const auditRows = []
  const fallThrough = []
  const pureHandler = createHumanWorkItemIngressHandler({
    bindings: loaded.bindings,
    gateway,
    reply: feishu.reply,
    replyTargetFor: feishu.replyTargetFor,
    audit: (entry) => { auditRows.push(entry) },
    now,
  })
  // Mirror the wire wrapper exactly: unconsumed ingress goes to the
  // authenticated delivery unchanged; the handler itself stays pure.
  const handler = async (ingress) => {
    const handled = await pureHandler(ingress)
    if (!handled) fallThrough.push(ingress)
    return handled
  }
  return {
    dir, bindingsFile, auditFile, loaded, feishu, auditRows, fallThrough, handler, gateway,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 1. Grammar (S2): strict parse — nothing else ever matches.
// ───────────────────────────────────────────────────────────────────────────

test('G1. grammar: exact forms parse; workflowInstanceId normalizes to lowercase uuid', () => {
  assert.deepEqual(parseWorkItemCommand('/work query'), { action: 'query' })
  assert.deepEqual(parseWorkItemCommand('/work help'), { action: 'help' })
  assert.deepEqual(
    parseWorkItemCommand(`/work complete ${INSTANCE_ID.toUpperCase()}`),
    { action: 'complete', workflowInstanceId: INSTANCE_ID },
  )
  assert.deepEqual(
    parseWorkItemCommand(`/work complete ${INSTANCE_ID} approve`),
    { action: 'complete', workflowInstanceId: INSTANCE_ID, transitionKey: 'approve' },
  )
  assert.deepEqual(
    parseWorkItemCommand(`/work reject ${INSTANCE_ID}   does not match  spec `),
    { action: 'reject', workflowInstanceId: INSTANCE_ID, reason: 'does not match  spec' },
  )
})

test('G2. grammar: non-command text returns null; anything under the /work namespace that matches no valid form returns usage', () => {
  // Non-command text (fall-through domain — never consumed for anyone):
  assert.equal(parseWorkItemCommand('/work'), null) // no subcommand namespace entry
  assert.equal(parseWorkItemCommand('  /work query'), null) // must be anchored
  assert.equal(parseWorkItemCommand('/Work query'), null) // case-sensitive
  assert.equal(parseWorkItemCommand('/todo query'), null)
  assert.equal(parseWorkItemCommand('帮我查一下待办'), null)
  assert.equal(parseWorkItemCommand(''), null)
  // Under the namespace but invalid → usage (consumed ONLY for allowlisted):
  assert.deepEqual(parseWorkItemCommand('/work complete'), { action: 'usage' })
  assert.deepEqual(parseWorkItemCommand(`/work reject ${INSTANCE_ID}`), { action: 'usage' })
  assert.deepEqual(parseWorkItemCommand(`/work reject ${INSTANCE_ID}   `), { action: 'usage' })
  assert.deepEqual(parseWorkItemCommand('/work query extra'), { action: 'usage' })
  assert.deepEqual(parseWorkItemCommand('/work complete not-a-uuid'), { action: 'usage' })
  assert.deepEqual(parseWorkItemCommand('/work complete not-a-uuid key'), { action: 'usage' })
  // transitionKey is echoed back into replies — unsafe tokens are usage, not echo material.
  assert.deepEqual(parseWorkItemCommand(`/work complete ${INSTANCE_ID} bad key`), { action: 'usage' })
  assert.deepEqual(parseWorkItemCommand(`/work complete ${INSTANCE_ID} ${'x'.repeat(65)}`), { action: 'usage' })
  // reject reason is forwarded as a submission body — bounded before shipping.
  assert.deepEqual(parseWorkItemCommand(`/work reject ${INSTANCE_ID} ${'r'.repeat(2001)}`), { action: 'usage' })
  // Trailing whitespace is not an argument: plain complete stays valid.
  assert.deepEqual(
    parseWorkItemCommand(`/work complete ${INSTANCE_ID} `),
    { action: 'complete', workflowInstanceId: INSTANCE_ID },
  )
})

// ───────────────────────────────────────────────────────────────────────────
// 2. Authorization boundary: handle ⟺ p2p ∧ grammar ∧ allowlisted sender.
// ───────────────────────────────────────────────────────────────────────────

test('A1. allowlisted sender + grammar → consumed; Router fall-through never runs', async (t) => {
  const r = await rig({ gateway: fakeGateway({ 'workflow_my_tasks:list': [{ ok: true, result: { items: [], next_cursor: null } }] }) })
  t.after(r.cleanup)
  const handled = await r.handler(p2pEvent('/work query'))
  assert.equal(handled, true)
  assert.equal(r.fallThrough.length, 0)
  assert.equal(r.feishu.receipts.length, 1)
})

test('A2. UNALLOWLISTED sender → falls through untouched (zero effect) — even command-shaped text', async (t) => {
  const r = await rig()
  t.after(r.cleanup)
  const intruder = 'ou_someone_else_0000000000000000000000000000'
  // Exact grammar from an unmapped sender:
  assert.equal(await r.handler(p2pEvent('/work query', { openId: intruder })), false)
  // Command-shaped but malformed from an unmapped sender — the allowlist
  // check must precede any usage reply, or the seam would leak its existence.
  assert.equal(await r.handler(p2pEvent('/work complete not-a-uuid', { openId: intruder, messageId: 'om_2' })), false)
  assert.equal(r.fallThrough.length, 2)
  assert.equal(r.gateway.calls.length, 0, 'no workflow surface ever contacted')
  assert.equal(r.feishu.receipts.length, 0, 'no receipt leaks the seam existence')
})

test('A3. allowlisted sender, NON-grammar text → falls through (normal agent turn)', async (t) => {
  const r = await rig()
  t.after(r.cleanup)
  assert.equal(await r.handler(p2pEvent('帮我写周报')), false)
  assert.equal(r.fallThrough.length, 1)
  assert.equal(r.gateway.calls.length, 0)
})

test('A4. allowlisted sender, malformed /work command → usage reply, consumed, NO gateway call', async (t) => {
  const r = await rig()
  t.after(r.cleanup)
  assert.equal(await r.handler(p2pEvent('/work complete not-a-uuid')), true)
  assert.equal(r.fallThrough.length, 0)
  assert.equal(r.gateway.calls.length, 0)
  assert.match(r.feishu.receipts[0].text, /\/work (query|complete|reject)/)
  assert.match(r.feishu.receipts[0].text, /usage/i)
})

test('A5. group/thread messages NEVER consumed — even allowlisted sender + exact grammar', async (t) => {
  const r = await rig()
  t.after(r.cleanup)
  for (const channel of ['group', 'thread']) {
    assert.equal(await r.handler(p2pEvent('/work query', { channel })), false, channel)
  }
  assert.equal(r.fallThrough.length, 2)
  assert.equal(r.gateway.calls.length, 0)
})

// ───────────────────────────────────────────────────────────────────────────
// 3. Identity binding (S1): exact allowlist, fail-closed loader.
// ───────────────────────────────────────────────────────────────────────────

test('I1. loader: exact keys load; lookup is exact-string only', (t) => {
  const map = new Map([[OPEN_ID, { executorAgentId: EXECUTOR_AGENT_ID }]])
  assert.ok(map.get(OPEN_ID))
  assert.equal(map.get(OPEN_ID + 'x'), undefined)
  assert.equal(map.get(OPEN_ID.slice(0, 20)), undefined, 'no prefix inference')
  assert.equal(map.get(OPEN_ID.toUpperCase()), undefined, 'no case-fold')
})

test('I2. loader: rejects wrong version, duplicates, missing fields, junk', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'g5-load-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const file = join(dir, 'p.json')
  const bad = [
    { version: 2, principals: [] },
    { version: 1, principals: [{ feishuOpenId: OPEN_ID }] },
    { version: 1, principals: [{ executorAgentId: EXECUTOR_AGENT_ID }] },
    { version: 1, principals: [{ feishuOpenId: OPEN_ID, executorAgentId: 'x' }, { feishuOpenId: OPEN_ID, executorAgentId: 'y' }] },
    { version: 1, principals: [{ feishuOpenId: OPEN_ID, executorAgentId: 'shared' }, { feishuOpenId: 'ou_other_000000000000000000000000000000', executorAgentId: 'shared' }] },
    { version: 1, principals: 'all-of-them' },
    { principals: [] },
    'not-an-object',
  ]
  for (const shape of bad) {
    await writeFile(file, JSON.stringify(shape), 'utf8')
    const res = loadPrincipalBindings(file)
    assert.equal(res.ok, false, JSON.stringify(shape))
  }
  await writeFile(file, 'github.com/exploding {{', 'utf8')
  assert.equal(loadPrincipalBindings(file).ok, false)
})

test('I3. executor identity travels ONLY via gateway context agentId — never call args', async (t) => {
  const r = await rig({ gateway: fakeGateway({ 'workflow_my_tasks:list': [{ ok: true, result: { items: [], next_cursor: null } }] }) })
  t.after(r.cleanup)
  await r.handler(p2pEvent('/work query'))
  assert.equal(r.gateway.calls[0].context.agentId, EXECUTOR_AGENT_ID)
  assert.equal(JSON.stringify(r.gateway.calls[0].call).includes(EXECUTOR_AGENT_ID), false,
    'agentId must never appear inside the model-visible call payload')
})

// ───────────────────────────────────────────────────────────────────────────
// 4. Query semantics.
// ───────────────────────────────────────────────────────────────────────────

test('Q1. query lists canonical worklist via workflow_my_tasks and formats snake_case items', async (t) => {
  const r = await rig({ gateway: fakeGateway({ 'workflow_my_tasks:list': [{ ok: true, result: worklistPage() }] }) })
  t.after(r.cleanup)
  await r.handler(p2pEvent('/work query'))
  const [call] = r.gateway.calls
  assert.equal(call.call.capabilityId, 'workflow_my_tasks')
  assert.equal(call.call.operation, 'list')
  assert.equal(call.call.args.limit, 10)
  const text = r.feishu.receipts[0].text
  assert.match(text, /1 item|1\/1|pending/i)
  assert.ok(text.includes(INSTANCE_ID), 'full copy-pasteable instance id')
  assert.match(text, /PM Review/)
  assert.match(text, /v7/)
  assert.match(text, /complete|reject/i)
})

test('Q2. empty worklist → explicit empty reply (still a canonical query)', async (t) => {
  const r = await rig({ gateway: fakeGateway({ 'workflow_my_tasks:list': [{ ok: true, result: { items: [], next_cursor: null } }] }) })
  t.after(r.cleanup)
  await r.handler(p2pEvent('/work query'))
  assert.match(r.feishu.receipts[0].text, /no pending work items/i)
})

test('Q3. query downstream failure surfaces the verbatim stable code, no retry', async (t) => {
  const r = await rig({ gateway: fakeGateway({ 'workflow_my_tasks:list': [svcError('principal_disabled', 403)] }) })
  t.after(r.cleanup)
  await r.handler(p2pEvent('/work query'))
  assert.equal(r.gateway.calls.length, 1, 'exactly one attempt')
  assert.match(r.feishu.receipts[0].text, /principal_disabled/)
})

// ───────────────────────────────────────────────────────────────────────────
// 5. Complete → canonical ADVANCE transition (fresh read + CAS).
// ───────────────────────────────────────────────────────────────────────────

test('C1. complete: fresh detail read → executable ADVANCE → transition with CAS version', async (t) => {
  const g = fakeGateway({
    'workflow_instance_detail:read': [{ ok: true, result: detailFull() }],
    'workflow_execute:transition': [{ ok: true, result: transitionReceipt() }],
  })
  const r = await rig({ gateway: g })
  t.after(r.cleanup)
  await r.handler(p2pEvent(`/work complete ${INSTANCE_ID}`))
  assert.deepEqual(g.calls.map((c) => `${c.call.capabilityId}:${c.call.operation}`), [
    'workflow_instance_detail:read',
    'workflow_execute:transition',
  ])
  const tCall = g.calls[1].call
  assert.equal(tCall.args.workflowInstanceId, INSTANCE_ID)
  assert.equal(tCall.args.transitionDefinitionId, TRANSITION_ID)
  assert.equal(tCall.args.expectedWorkflowStateVersion, 7, 'CAS from the FRESH read')
  assert.equal(tCall.args.submissionPayload, undefined)
  assert.match(r.feishu.receipts[0].text, /completed/i)
  assert.ok(r.feishu.receipts[0].text.includes('8'), 'new state version echoed')
  assert.ok(r.feishu.receipts[0].text.includes(String(transitionReceipt().eventSequence)), 'canonical event sequence echoed')
})

test('C2. complete: several executable ADVANCE transitions and no key → disambiguation reply, NO write', async (t) => {
  const d = detailFull()
  d.detail.outgoing_transitions.push({
    transition_id: OTHER_ID, transition_key: 'fast_track', display_name: 'Fast track',
    transition_effect: 'ADVANCE', executable_for_actor: true, blocked_reason: null, submission_schema: null,
  })
  const r = await rig({ gateway: fakeGateway({ 'workflow_instance_detail:read': [{ ok: true, result: d }] }) })
  t.after(r.cleanup)
  await r.handler(p2pEvent(`/work complete ${INSTANCE_ID}`))
  assert.equal(r.gateway.calls.length, 1, 'read only — never a blind write')
  assert.match(r.feishu.receipts[0].text, /approve|fast_track/)
  assert.match(r.feishu.receipts[0].text, /transition key/i)
})

test('C3. complete with explicit transitionKey selects exactly that ADVANCE transition', async (t) => {
  const d = detailFull()
  d.detail.outgoing_transitions.push({
    transition_id: OTHER_ID, transition_key: 'fast_track', display_name: 'Fast track',
    transition_effect: 'ADVANCE', executable_for_actor: true, blocked_reason: null, submission_schema: null,
  })
  const g = fakeGateway({
    'workflow_instance_detail:read': [{ ok: true, result: d }],
    'workflow_execute:transition': [{ ok: true, result: transitionReceipt() }],
  })
  const r = await rig({ gateway: g })
  t.after(r.cleanup)
  await r.handler(p2pEvent(`/work complete ${INSTANCE_ID} fast_track`))
  assert.equal(g.calls[1].call.args.transitionDefinitionId, OTHER_ID)
})

test('C4. complete: no executable ADVANCE (blocked) → refusal reply with blocked reason, NO write', async (t) => {
  const d = detailFull()
  d.detail.outgoing_transitions = d.detail.outgoing_transitions.map((tr) => ({
    ...tr, executable_for_actor: false, blocked_reason: 'TARGET_ASSIGNEE_UNAVAILABLE',
  }))
  const r = await rig({ gateway: fakeGateway({ 'workflow_instance_detail:read': [{ ok: true, result: d }] }) })
  t.after(r.cleanup)
  await r.handler(p2pEvent(`/work complete ${INSTANCE_ID}`))
  assert.equal(r.gateway.calls.length, 1)
  assert.match(r.feishu.receipts[0].text, /TARGET_ASSIGNEE_UNAVAILABLE/)
  assert.match(r.feishu.receipts[0].text, /not executable|cannot/i)
})

// ───────────────────────────────────────────────────────────────────────────
// 6. Reject → canonical RETURN transition with the exact submission contract.
// ───────────────────────────────────────────────────────────────────────────

test('R1. reject: RETURN transition + mandatory submission {rootCauseNodeVisitId, reasonCode, reason}', async (t) => {
  const g = fakeGateway({
    'workflow_instance_detail:read': [{ ok: true, result: detailFull() }],
    'workflow_execute:transition': [{ ok: true, result: transitionReceipt() }],
  })
  const r = await rig({ gateway: g })
  t.after(r.cleanup)
  await r.handler(p2pEvent(`/work reject ${INSTANCE_ID} requirements changed`))
  const tCall = g.calls[1].call
  assert.equal(tCall.args.transitionDefinitionId, RETURN_TRANSITION_ID)
  assert.equal(tCall.args.expectedWorkflowStateVersion, 7)
  assert.deepEqual(tCall.args.submissionPayload, {
    rootCauseNodeVisitId: VISIT_ID,
    reasonCode: 'HUMAN_REJECT',
    reason: 'requirements changed',
  })
  assert.match(r.feishu.receipts[0].text, /reject/i)
  assert.ok(r.feishu.receipts[0].text.includes(String(transitionReceipt().eventSequence)))
})

test('R2. reject: no executable RETURN transition → refusal, NO write', async (t) => {
  const d = detailFull()
  d.detail.outgoing_transitions = d.detail.outgoing_transitions.filter((tr) => tr.transition_effect !== 'RETURN')
  const r = await rig({ gateway: fakeGateway({ 'workflow_instance_detail:read': [{ ok: true, result: d }] }) })
  t.after(r.cleanup)
  await r.handler(p2pEvent(`/work reject ${INSTANCE_ID} nope`))
  assert.equal(r.gateway.calls.length, 1)
  assert.match(r.feishu.receipts[0].text, /return|reject/i)
  assert.match(r.feishu.receipts[0].text, /not available|no .*return/i)
})

// ───────────────────────────────────────────────────────────────────────────
// 7. Invalid / stale work-item refusal (verbatim codes, zero retry).
// ───────────────────────────────────────────────────────────────────────────

test('S1. stale version at write time surfaces workflow_state_version_conflict verbatim (no retry)', async (t) => {
  const g = fakeGateway({
    'workflow_instance_detail:read': [{ ok: true, result: detailFull() }],
    'workflow_execute:transition': [svcError('workflow_state_version_conflict', 409)],
  })
  const r = await rig({ gateway: g })
  t.after(r.cleanup)
  await r.handler(p2pEvent(`/work complete ${INSTANCE_ID}`))
  assert.equal(r.gateway.calls.length, 2, 'read + exactly one write attempt')
  assert.match(r.feishu.receipts[0].text, /workflow_state_version_conflict/)
})

test('S2. terminal / already-advanced instance surfaces source_node_terminal verbatim', async (t) => {
  const g = fakeGateway({
    'workflow_instance_detail:read': [{ ok: true, result: detailFull() }],
    'workflow_execute:transition': [svcError('source_node_terminal', 409)],
  })
  const r = await rig({ gateway: g })
  t.after(r.cleanup)
  await r.handler(p2pEvent(`/work complete ${INSTANCE_ID}`))
  assert.match(r.feishu.receipts[0].text, /source_node_terminal/)
})

test('S3. foreign / nonexistent instance surfaces the verbatim 404 family — never leaks others', async (t) => {
  for (const code of ['workflow_instance_not_found_or_not_visible', 'instance_not_found']) {
    const g = fakeGateway({ 'workflow_instance_detail:read': [svcError(code, 404)] })
    const r = await rig({ gateway: g })
    await r.handler(p2pEvent(`/work complete ${OTHER_ID}`))
    assert.equal(g.calls.length, 1)
    assert.match(r.feishu.receipts[0].text, new RegExp(code))
    await r.cleanup()
  }
})

test('S4. non-assignee (server-authoritative) surfaces principal_not_assignee verbatim', async (t) => {
  const g = fakeGateway({
    'workflow_instance_detail:read': [{ ok: true, result: detailFull() }],
    'workflow_execute:transition': [svcError('principal_not_assignee', 403)],
  })
  const r = await rig({ gateway: g })
  t.after(r.cleanup)
  await r.handler(p2pEvent(`/work complete ${INSTANCE_ID}`))
  assert.match(r.feishu.receipts[0].text, /principal_not_assignee/)
})

test('S5. open assistance case fail-close surfaces assistance_open verbatim', async (t) => {
  const g = fakeGateway({
    'workflow_instance_detail:read': [{ ok: true, result: detailFull() }],
    'workflow_execute:transition': [svcError('assistance_open', 409)],
  })
  const r = await rig({ gateway: g })
  t.after(r.cleanup)
  await r.handler(p2pEvent(`/work reject ${INSTANCE_ID} looks wrong`))
  assert.match(r.feishu.receipts[0].text, /assistance_open/)
})

test('S6. detail read itself failing (not visible / transport) → no write is ever attempted', async (t) => {
  const g = fakeGateway({ 'workflow_instance_detail:read': [svcError('transport_failure')] })
  const r = await rig({ gateway: g })
  t.after(r.cleanup)
  await r.handler(p2pEvent(`/work complete ${INSTANCE_ID}`))
  assert.equal(g.calls.length, 1)
  assert.match(r.feishu.receipts[0].text, /transport_failure/)
})

// ───────────────────────────────────────────────────────────────────────────
// 8. Idempotency / duplicate handling (trusted seams, no seam-side state).
// ───────────────────────────────────────────────────────────────────────────

test('D1. forged idempotencyKey in args is NEVER forwarded (trusted broker seam owns the key)', async (t) => {
  const g = fakeGateway({
    'workflow_instance_detail:read': [{ ok: true, result: detailFull() }],
    'workflow_execute:transition': [{ ok: true, result: transitionReceipt() }],
  })
  const r = await rig({ gateway: g })
  t.after(r.cleanup)
  // The grammar cannot even carry an idempotencyKey; assert the call is clean.
  await r.handler(p2pEvent(`/work complete ${INSTANCE_ID}`))
  const serialized = JSON.stringify(g.calls[1].call)
  assert.equal(serialized.includes('idempotencyKey'), false)
  assert.equal(serialized.includes('Idempotency-Key'), false)
})

test('D2. two distinct complete commands = two canonical attempts; server CAS decides', async (t) => {
  const g = fakeGateway({
    'workflow_instance_detail:read': [{ ok: true, result: detailFull() }, { ok: true, result: detailFull() }],
    'workflow_execute:transition': [{ ok: true, result: transitionReceipt() }, svcError('workflow_state_version_conflict', 409)],
  })
  const r = await rig({ gateway: g })
  t.after(r.cleanup)
  await r.handler(p2pEvent(`/work complete ${INSTANCE_ID}`, { messageId: 'om_a' }))
  await r.handler(p2pEvent(`/work complete ${INSTANCE_ID}`, { messageId: 'om_b' }))
  assert.equal(g.calls.length, 4)
  assert.match(r.feishu.receipts[1].text, /workflow_state_version_conflict/,
    'second attempt surfaces the server decision; the seam keeps no dedup state')
})

// ───────────────────────────────────────────────────────────────────────────
// 9. Provenance: durable closed audit row + canonical receipt binding.
// ───────────────────────────────────────────────────────────────────────────

test('P1. every handled command appends one closed audit row with redacted open_id and receipt ids', async (t) => {
  const g = fakeGateway({
    'workflow_instance_detail:read': [{ ok: true, result: detailFull() }],
    'workflow_execute:transition': [{ ok: true, result: transitionReceipt() }],
  })
  const r = await rig({ gateway: g })
  t.after(r.cleanup)
  await r.handler(p2pEvent(`/work complete ${INSTANCE_ID}`))
  const row = r.auditRows.at(-1)
  assert.equal(row.kind, 'human_work_item_command')
  assert.equal(row.action, 'complete')
  assert.equal(row.workflowInstanceId, INSTANCE_ID)
  assert.equal(row.transitionId, TRANSITION_ID)
  assert.equal(row.outcome, 'executed')
  assert.equal(row.eventSequence, transitionReceipt().eventSequence)
  assert.equal(row.workflowStateVersion, transitionReceipt().workflowStateVersion)
  assert.ok(row.openIdPrefix.length <= 6, 'open_id redacted to prefix')
  assert.equal(JSON.stringify(row).includes(OPEN_ID), false, 'full open_id never persisted')
  assert.equal(JSON.stringify(row).includes('clientSecret'), false)
})

test('P2. failures audit with outcome=error + verbatim code; fall-through never audits', async (t) => {
  const g = fakeGateway({
    'workflow_instance_detail:read': [{ ok: true, result: detailFull() }],
    'workflow_execute:transition': [svcError('principal_not_assignee', 403)],
  })
  const r = await rig({ gateway: g })
  t.after(r.cleanup)
  await r.handler(p2pEvent(`/work reject ${INSTANCE_ID} hmm`))
  assert.equal(r.auditRows.at(-1).outcome, 'error')
  assert.equal(r.auditRows.at(-1).code, 'principal_not_assignee')
  const before = r.auditRows.length
  await r.handler(p2pEvent('/work query', { openId: 'ou_unmapped_00000000000000000000000000000' }))
  assert.equal(r.auditRows.length, before, 'fall-through is invisible to the audit trail')
})

// ───────────────────────────────────────────────────────────────────────────
// 10. Zero unintended production effects (wiring + defaults).
// ───────────────────────────────────────────────────────────────────────────

test('Z1. env gate: strict truthiness — OFF by default', () => {
  assert.equal(isStrictTruthyEnv(undefined), false)
  assert.equal(isStrictTruthyEnv(''), false)
  assert.equal(isStrictTruthyEnv('0'), false)
  assert.equal(isStrictTruthyEnv('false'), false)
  assert.equal(isStrictTruthyEnv('yes'), false, 'anything but the exact tokens is OFF')
  assert.equal(isStrictTruthyEnv('1'), true)
  assert.equal(isStrictTruthyEnv('true'), true)
  assert.equal(HUMAN_WORK_ITEM_INGRESS_ENABLED_ENV, 'HUMAN_WORK_ITEM_INGRESS_ENABLED')
  assert.equal(HUMAN_WORK_ITEM_INGRESS_PRINCIPALS_FILE_ENV, 'HUMAN_WORK_ITEM_INGRESS_PRINCIPALS_FILE')
})

test('Z2. wire: disabled by default → callback chain untouched', async (t) => {
  const setCallbacks = []
  const feishu = { setCallback: (fn) => { setCallbacks.push(fn) } }
  const wired = wireHumanWorkItemIngress({
    feishu,
    router: { routeAuthenticated: async () => {} },
    gateway: fakeGateway(),
    principalsFile: '/nonexistent/principals.json',
    auditFile: join(tmpdir(), 'unused.jsonl'),
    enabled: false,
    log: () => {},
  })
  assert.equal(wired, false)
  assert.equal(setCallbacks.length, 0, 'nothing installed')
})

test('Z3. wire: enabled + explicit wiring → wrapper falls through to routeAuthenticated', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'g5-wire-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const principalsFile = join(dir, 'p.json')
  await writeFile(principalsFile, JSON.stringify({
    version: 1,
    principals: [{ feishuOpenId: OPEN_ID, executorAgentId: EXECUTOR_AGENT_ID }],
  }), 'utf8')

  const installed = []
  const feishu = { setCallback: (fn) => { installed.push(fn) } }
  const routed = []
  const DELIVERY_OUTCOME = { ok: true, reply: 'agent reply' }
  const router = { routeAuthenticated: async (ingress) => { routed.push(ingress); return DELIVERY_OUTCOME } }
  const gateway = fakeGateway({ 'workflow_my_tasks:list': [{ ok: true, result: { items: [], next_cursor: null } }] })

  const wired = wireHumanWorkItemIngress({
    feishu, router, gateway,
    principalsFile,
    auditFile: join(dir, 'audit.jsonl'),
    enabled: true,
    log: () => {},
  })
  assert.equal(wired, true)
  assert.equal(installed.length, 1)

  // Authorized query → consumed; the reply target carries the resolved
  // replyTo(messageId) (the real connector throws on a kind-less target).
  assert.equal(await installed[0](p2pEvent('/work query')), true)
  assert.equal(routed.length, 0)
  assert.equal(gateway.calls.length, 1)
  // NOTE: the Z3 feishu stub has no reply — the handler's send throws and is
  // contained; consumption semantics are unaffected.
  // Fall-through → downstream outcome PROPAGATED (value and identity), so the
  // bridge keeps its error contract for unconsumed deliveries.
  const passthrough = p2pEvent('hello agent')
  const outcome = await installed[0](passthrough)
  assert.equal(routed.length, 1)
  assert.equal(routed[0], passthrough)
  assert.equal(outcome, DELIVERY_OUTCOME, 'fall-through returns the Router delivery outcome unchanged')
})

test('Z4. wire: enabled + broken principals file → FAILS LOUD (never silently unmapped)', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'g5-wire-bad-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const principalsFile = join(dir, 'p.json')
  await writeFile(principalsFile, JSON.stringify({ version: 7, principals: [] }), 'utf8')
  const feishu = { setCallback: () => { throw new Error('must not install') } }
  assert.throws(() => wireHumanWorkItemIngress({
    feishu,
    router: { routeAuthenticated: async () => {} },
    gateway: fakeGateway(),
    principalsFile,
    auditFile: join(dir, 'audit.jsonl'),
    enabled: true,
    log: () => {},
  }))
})

test('Z5. audit rows are durably appended to the JSONL sink and parse back', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'g5-audit-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const auditFile = join(dir, 'control', 'human-work-item-audit.jsonl')
  const principalsFile = join(dir, 'p.json')
  await writeFile(principalsFile, JSON.stringify({
    version: 1,
    principals: [{ feishuOpenId: OPEN_ID, executorAgentId: EXECUTOR_AGENT_ID }],
  }), 'utf8')
  const installed = []
  const replySurface = fakeFeishu()
  const feishu = {
    setCallback: (fn) => { installed.push(fn) },
    reply: replySurface.reply,
    replyTargetFor: replySurface.replyTargetFor,
  }
  const gateway = fakeGateway({ 'workflow_my_tasks:list': [{ ok: true, result: { items: [], next_cursor: null } }] })
  wireHumanWorkItemIngress({
    feishu, router: { routeAuthenticated: async () => {} }, gateway,
    principalsFile, auditFile, enabled: true, log: () => {},
  })
  await installed[0](p2pEvent('/work query'))
  const raw = await readFile(auditFile, 'utf8')
  const rows = raw.trim().split('\n').map((line) => JSON.parse(line))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].kind, 'human_work_item_command')
  assert.equal(rows[0].action, 'query')
  assert.equal(rows[0].outcome, 'executed')
})
