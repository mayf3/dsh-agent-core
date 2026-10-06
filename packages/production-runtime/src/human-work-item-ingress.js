/**
 * G5 Human Work Item Feishu action ingress — composition-level seam
 * (Product #478, NON-PRODUCTION lane, ACCEPTANCE_MODE = TEST_IDENTITY).
 *
 * Boundary contract (frozen in
 * docs/evidence/product-478-g5-human-work-item-feishu-ingress-v1/):
 *
 *   A message is CONSUMED by this seam if and only if ALL of
 *     (a) channel is p2p,
 *     (b) text matches the strict `/work` grammar (anchored, case-sensitive),
 *     (c) sender.openId is an EXACT key of the frozen principals allowlist.
 *   Everything else falls through byte-identically to the Router's
 *   AUTHENTICATED ingress delivery (provenance authority preserved — the
 *   unauthenticated router.route is never used here). An unauthorized
 *   `/work …` message therefore behaves exactly as before this seam existed.
 *
 *   The workflow ACTOR is the allowlisted executor principal's credential
 *   (agentId-keyed gateway context); the canonical transition, CAS,
 *   Idempotency-Key, error preservation and durable provenance all belong to
 *   the existing trusted surfaces (svc-workflow + broker gateway) and are
 *   never reimplemented here. The HUMAN principal cannot be a workflow actor
 *   today (auth-service MachinePrincipal enum is agent|service; svc-workflow
 *   Auth V1 verifier admits principal_type=agent only) — see ROOT_GAP doc.
 *
 *   DURABILITY (parent-review repair): the canonical-result audit row is
 *   persisted BEFORE any Feishu reply attempt, so a reply failure can never
 *   erase or misclassify a known canonical success. Reply-delivery failures
 *   are recorded as linked `human_work_item_reply_failure` rows; audit-sink
 *   failures are returned (never swallowed) and surfaced truthfully in log
 *   + the user reply — never rendered as a transition failure. Every row
 *   carries unambiguous provenance: humanPrincipalId (REQUIRED allowlist
 *   binding; provenance metadata only, never a workflow input),
 *   executorAgentId (the canonical actor), the original Feishu messageId,
 *   a commandId linking the row family, and — on transition rows — the
 *   canonical receipt / source-visit linkage.
 *
 *   This module keeps ZERO state: no work-item numbering, no session, no
 *   dedup store (bridge owns message dedup; the server owns CAS/receipts).
 */

import { mkdirSync, appendFileSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const HUMAN_WORK_ITEM_INGRESS_ENABLED_ENV = 'HUMAN_WORK_ITEM_INGRESS_ENABLED'
export const HUMAN_WORK_ITEM_INGRESS_PRINCIPALS_FILE_ENV = 'HUMAN_WORK_ITEM_INGRESS_PRINCIPALS_FILE'
export const HUMAN_WORK_ITEM_AUDIT_FILE = 'human-work-item-audit.jsonl'

/** Strict enablement: only the exact tokens '1'/'true' enable the seam. */
export function isStrictTruthyEnv(value) {
  return value === '1' || value === 'true'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** transitionKey is echoed back in replies — bound to a safe token shape. */
const TRANSITION_KEY_RE = /^[A-Za-z0-9._-]{1,64}$/
/** User reject reason is forwarded as submissionPayload.reason (server also
 * enforces its own size limit) — bounded here so the seam never ships a
 * multi-hundred-KB body just to get a 413 back. */
const REASON_MAX_LENGTH = 2000

const USAGE_TEXT = [
  'Human work item commands (usage):',
  '/work query — list my pending work items',
  '/work complete <workflowInstanceId> [<transitionKey>]',
  '/work reject <workflowInstanceId> <reason>',
].join('\n')

/**
 * Strict grammar parser. Returns a parsed command object or null when the
 * text is not under the `/work ` command namespace (the fall-through
 * domain). Text under the namespace that matches no valid form returns
 * { action: 'usage' } — command intent gets guidance instead of a silent
 * agent turn; consumption still requires the exact allowlisted sender.
 */
export function parseWorkItemCommand(text) {
  if (typeof text !== 'string' || !text.startsWith('/work ')) return null
  const rest = text.slice('/work '.length)
  const trimmed = rest.replace(/\s+$/, '')
  if (trimmed === 'query') return { action: 'query' }
  if (trimmed === 'help') return { action: 'help' }
  const complete = trimmed.match(/^complete\s+(\S+)(?:\s+(\S+))?$/)
  if (complete) {
    if (!UUID_RE.test(complete[1])) return { action: 'usage' }
    if (complete[2] !== undefined && !TRANSITION_KEY_RE.test(complete[2])) return { action: 'usage' }
    return {
      action: 'complete',
      workflowInstanceId: complete[1].toLowerCase(),
      ...(complete[2] === undefined ? {} : { transitionKey: complete[2] }),
    }
  }
  const reject = trimmed.match(/^reject\s+(\S+)\s+(.+)$/s)
  if (reject) {
    if (!UUID_RE.test(reject[1])) return { action: 'usage' }
    const reason = reject[2].replace(/\s+$/, '')
    if (reason.length === 0 || reason.length > REASON_MAX_LENGTH) return { action: 'usage' }
    return { action: 'reject', workflowInstanceId: reject[1].toLowerCase(), reason }
  }
  // Anything else under the explicit `/work ` prefix is command intent —
  // usage guidance (consumed ONLY for allowlisted senders, checked later)
  // instead of a silent agent turn.
  return { action: 'usage' }
}

/**
 * Load the frozen principals allowlist. TOTAL fail-closed: any structural
 * deviation (version, duplicates, missing fields, wrong types) is a load
 * error — never a partial allowlist.
 */
export function loadPrincipalBindings(file) {
  let raw
  try {
    raw = readFileSync(file, 'utf8')
  } catch (error) {
    return { ok: false, error: `principals file unreadable: ${error?.message ?? error}` }
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return { ok: false, error: `principals file is not valid JSON: ${error?.message ?? error}` }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'principals file must be an object' }
  }
  if (parsed.version !== 1) return { ok: false, error: 'principals file version must be 1' }
  if (!Array.isArray(parsed.principals)) return { ok: false, error: 'principals must be an array' }
  const bindings = new Map()
  const executorAgents = new Set()
  for (const entry of parsed.principals) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return { ok: false, error: 'each principal entry must be an object' }
    }
    const { feishuOpenId, executorAgentId } = entry
    if (typeof feishuOpenId !== 'string' || feishuOpenId.length === 0) {
      return { ok: false, error: 'principal entry missing feishuOpenId' }
    }
    if (typeof executorAgentId !== 'string' || executorAgentId.length === 0) {
      return { ok: false, error: 'principal entry missing executorAgentId' }
    }
    // REQUIRED: without a bound human principal the durable audit trail would
    // carry only a redacted openId prefix — not unambiguous human provenance.
    if (typeof entry.humanPrincipalId !== 'string' || entry.humanPrincipalId.length === 0) {
      return { ok: false, error: 'principal entry missing humanPrincipalId (unambiguous durable human provenance is required)' }
    }
    if (bindings.has(feishuOpenId)) return { ok: false, error: `duplicate feishuOpenId ${JSON.stringify(feishuOpenId.slice(0, 6))}` }
    // One executor identity per human: a shared executor would merge two
    // humans' worklists into one allowlist entry's authority.
    if (executorAgents.has(executorAgentId)) {
      return { ok: false, error: `duplicate executorAgentId ${JSON.stringify(executorAgentId)} — each human principal needs its own executor identity` }
    }
    executorAgents.add(executorAgentId)
    bindings.set(feishuOpenId, {
      executorAgentId,
      humanPrincipalId: entry.humanPrincipalId,
    })
  }
  return { ok: true, bindings }
}

/** Select the canonical transition to execute for an action, or a refusal. */
function selectTransition(detail, action, transitionKey) {
  const transitions = Array.isArray(detail?.outgoing_transitions) ? detail.outgoing_transitions : []
  const wanted = action === 'reject' ? 'RETURN' : 'ADVANCE'
  const executable = transitions.filter((tr) => tr?.executable_for_actor === true && tr?.transition_effect === wanted)
  if (executable.length === 0) {
    const blocked = transitions
      .filter((tr) => tr?.transition_effect === wanted && typeof tr?.blocked_reason === 'string' && tr.blocked_reason.length > 0)
      .map((tr) => tr.blocked_reason)
    return {
      ok: false,
      reply: blocked.length > 0
        ? `⛔ /work ${action}: transition not executable on this work item (blocked: ${[...new Set(blocked)].join(', ')}).`
        : `⛔ /work ${action}: no executable ${wanted} transition is available on this work item.`,
    }
  }
  if (executable.length > 1) {
    if (transitionKey === undefined) {
      const keys = executable.map((tr) => tr.transition_key).join(', ')
      return {
        ok: false,
        reply: `⛔ /work ${action}: several ${wanted} transitions exist — resend with the transition key: ${keys}.`,
      }
    }
    const picked = executable.find((tr) => tr.transition_key === transitionKey)
    if (picked === undefined) {
      const keys = executable.map((tr) => tr.transition_key).join(', ')
      return { ok: false, reply: `⛔ /work ${action}: unknown transition key '${transitionKey}' — available: ${keys}.` }
    }
    return { ok: true, transition: picked }
  }
  return { ok: true, transition: executable[0] }
}

const instanceLine = (item) => {
  const d = item?.detail
  const instance = d?.instance
  if (instance === undefined || instance === null) return null
  const effects = Array.isArray(d?.outgoing_transitions)
    ? d.outgoing_transitions.filter((tr) => tr?.executable_for_actor === true).map((tr) => {
        const verb = tr.transition_effect === 'RETURN' ? 'reject' : 'complete'
        return `${verb} ${tr.transition_key}`
      })
    : []
  const actions = effects.length > 0 ? `actions: ${[...new Set(effects)].join(', ')}` : 'actions: none executable'
  const title = instance.metadata?.title ?? instance.external_reference ?? ''
  return [
    `• ${instance.workflow_instance_id}`,
    instance.current_node?.display_name ? `@ ${instance.current_node.display_name}` : null,
    `v${instance.workflow_state_version}`,
    title ? `— ${title}` : null,
    actions,
  ].filter((part) => part !== null).join(' ')
}

/**
 * Create the seam handler: async (ingress) => boolean handled.
 * `fallThrough` receives every unconsumed ingress UNCHANGED.
 */
export function createHumanWorkItemIngressHandler({
  bindings,
  gateway,
  reply,
  replyTargetFor,
  audit,
  fallThrough,
  log = () => {},
  now = () => Date.now(),
}) {
  let commandSeq = 0

  // Returns true when the row was durably written; a sink that throws OR
  // reports {ok:false} is a FAILED write — logged, never swallowed, so the
  // caller can disclose the provenance gap truthfully.
  const auditRow = (entry) => {
    try {
      const res = audit({ kind: 'human_work_item_command', ts: now(), ...entry })
      if (res && typeof res === 'object' && res.ok === false) {
        log(`human-work-item audit write failed: ${res.error ?? 'unknown audit error'}`)
        return false
      }
      return true
    } catch (error) {
      log(`human-work-item audit write failed: ${error?.message ?? error}`)
      return false
    }
  }

  const send = async (ingress, text) => {
    // Mirror the Router's reply construction exactly (ingress-delivery.js):
    // the ReplyTarget MUST carry replyTo(messageId) — the connector's
    // replyTargetToSdkSend rejects a kind-less target, which would consume
    // the command and silently lose every receipt.
    await reply(replyTargetFor(ingress).replyTo(ingress.messageId), text)
  }

  // Delivery is isolated: a reply failure appends a linked reply_failure row
  // and is NEVER allowed to propagate into the command outcome path.
  const deliver = async (ingress, text, { base, action, workflowInstanceId } = {}) => {
    try {
      await send(ingress, text)
      return true
    } catch (error) {
      const message = String(error?.message ?? error).slice(0, 500)
      log(`human-work-item reply delivery failed: ${message}`)
      auditRow({
        kind: 'human_work_item_reply_failure',
        ...(base ?? {}),
        ...(action === undefined ? {} : { action }),
        ...(workflowInstanceId === undefined ? {} : { workflowInstanceId }),
        error: message,
      })
      return false
    }
  }

  // Truthful disclosure when this interaction's own audit row could not be
  // persisted — appended to the reply, never rendered as a transition failure.
  const withAuditDisclosure = (text, auditOk) =>
    auditOk ? text : `${text}\n⚠️ audit write failed — this interaction was NOT durably recorded locally`

  async function runQuery(ingress, binding, base) {
    const res = await gateway.execute(
      { capabilityId: 'workflow_my_tasks', operation: 'list', args: { limit: 10 } },
      { agentId: binding.executorAgentId },
    )
    if (!res?.ok) {
      const code = res?.error?.code ?? 'unknown_error'
      const auditOk = auditRow({ ...base, action: 'query', outcome: 'error', code })
      await deliver(ingress, withAuditDisclosure(`⛔ /work query failed: ${code}`, auditOk), { base, action: 'query' })
      return
    }
    const items = Array.isArray(res.result?.items) ? res.result.items : []
    if (items.length === 0) {
      const auditOk = auditRow({ ...base, action: 'query', outcome: 'executed' })
      await deliver(ingress, withAuditDisclosure('No pending work items assigned to you.', auditOk), { base, action: 'query' })
      return
    }
    const lines = items.map(instanceLine).filter((line) => line !== null)
    const auditOk = auditRow({ ...base, action: 'query', outcome: 'executed', count: items.length })
    await deliver(
      ingress,
      withAuditDisclosure([`You have ${items.length} pending work item(s):`, ...lines, '', USAGE_TEXT].join('\n'), auditOk),
      { base, action: 'query' },
    )
  }

  async function runTransition(ingress, binding, command, base) {
    const { workflowInstanceId } = command
    const detailRes = await gateway.execute(
      { capabilityId: 'workflow_instance_detail', operation: 'read', args: { workflowInstanceId } },
      { agentId: binding.executorAgentId },
    )
    if (!detailRes?.ok) {
      const code = detailRes?.error?.code ?? 'unknown_error'
      const auditOk = auditRow({ ...base, action: command.action, workflowInstanceId, outcome: 'error', code })
      await deliver(ingress, withAuditDisclosure(`⛔ /work ${command.action} failed: ${code}`, auditOk), { base, action: command.action, workflowInstanceId })
      return
    }
    const detail = detailRes.result?.visibility === 'full' ? detailRes.result.detail : null
    if (detail === null) {
      const auditOk = auditRow({ ...base, action: command.action, workflowInstanceId, outcome: 'error', code: 'not_visible' })
      await deliver(ingress, withAuditDisclosure(`⛔ /work ${command.action} failed: instance is not fully visible to the executor principal`, auditOk), { base, action: command.action, workflowInstanceId })
      return
    }
    const picked = selectTransition(detail, command.action, command.transitionKey)
    if (!picked.ok) {
      const auditOk = auditRow({ ...base, action: command.action, workflowInstanceId, outcome: 'refused' })
      await deliver(ingress, withAuditDisclosure(picked.reply, auditOk), { base, action: command.action, workflowInstanceId })
      return
    }
    const transition = picked.transition
    const submissionPayload = command.action === 'reject'
      ? { rootCauseNodeVisitId: detail.current_node_visit_id, reasonCode: 'HUMAN_REJECT', reason: command.reason }
      : undefined
    const res = await gateway.execute(
      {
        capabilityId: 'workflow_execute',
        operation: 'transition',
        args: {
          workflowInstanceId,
          transitionDefinitionId: transition.transition_id,
          expectedWorkflowStateVersion: detail.instance.workflow_state_version,
          ...(submissionPayload === undefined ? {} : { submissionPayload }),
        },
      },
      { agentId: binding.executorAgentId },
    )
    if (!res?.ok) {
      const code = res?.error?.code ?? 'unknown_error'
      const auditOk = auditRow({
        ...base, action: command.action, workflowInstanceId, transitionId: transition.transition_id,
        outcome: 'error', code,
      })
      await deliver(ingress, withAuditDisclosure(`⛔ /work ${command.action} failed: ${code}`, auditOk), { base, action: command.action, workflowInstanceId })
      return
    }
    const receipt = res.result ?? {}
    const verb = command.action === 'reject' ? 'rejected' : 'completed'
    // DURABILITY ORDER: the canonical receipt row is persisted BEFORE any
    // reply attempt — a reply failure can never erase or misclassify a known
    // canonical success.
    const auditOk = auditRow({
      ...base, action: command.action, workflowInstanceId, transitionId: transition.transition_id,
      outcome: 'executed',
      eventSequence: receipt.eventSequence, workflowStateVersion: receipt.workflowStateVersion,
      sourceNodeVisitId: receipt.sourceNodeVisitId, currentNodeVisitId: receipt.currentNodeVisitId,
      ...(receipt.submissionId === undefined || receipt.submissionId === null ? {} : { submissionId: receipt.submissionId }),
      ...(receipt.currentContextRevisionId === undefined || receipt.currentContextRevisionId === null ? {} : { currentContextRevisionId: receipt.currentContextRevisionId }),
      // canonical submission linkage for reject (what was submitted upstream)
      ...(command.action === 'reject' ? { reasonCode: 'HUMAN_REJECT', rootCauseNodeVisitId: detail.current_node_visit_id } : {}),
    })
    await deliver(
      ingress,
      withAuditDisclosure([
        `✅ ${verb} ${workflowInstanceId} (${transition.display_name}).`,
        `stateVersion ${receipt.workflowStateVersion} · event ${receipt.eventSequence} · sourceVisit ${receipt.sourceNodeVisitId}`,
      ].join('\n'), auditOk),
      { base, action: command.action, workflowInstanceId },
    )
  }

  return async function handleIngress(ingress) {
    // (a) p2p only, (b) strict grammar, (c) exact allowlisted sender — the
    // whole authorization boundary. Anything else is someone else's message.
    if (ingress?.channel !== 'p2p') return false
    const command = parseWorkItemCommand(ingress.text)
    if (command === null) return false
    const binding = bindings.get(ingress.sender?.openId)
    if (binding === undefined) return false

    const commandId = `hwic_${now().toString(36)}_${(commandSeq += 1).toString(36)}`
    const base = {
      commandId,
      openIdPrefix: ingress.sender?.openId?.slice(0, 6) ?? '',
      channel: ingress.channel,
      humanPrincipalId: binding.humanPrincipalId,
      executorAgentId: binding.executorAgentId,
      originalMessageId: ingress.messageId,
    }
    log(`human-work-item ingress: action=${command.action} commandId=${commandId} sender=${base.openIdPrefix}`)
    try {
      if (command.action === 'usage' || command.action === 'help') {
        const auditOk = auditRow({ ...base, action: command.action, outcome: 'executed' })
        await deliver(
          ingress,
          withAuditDisclosure(`Human work item commands — ${command.action === 'usage' ? 'malformed command' : 'usage'}:\n${USAGE_TEXT}`, auditOk),
          { base, action: command.action },
        )
      } else if (command.action === 'query') {
        await runQuery(ingress, binding, base)
      } else {
        await runTransition(ingress, binding, command, base)
      }
    } catch (error) {
      // Only genuinely UNRESOLVED failures land here (e.g. a gateway
      // transport throw): the canonical outcome is unknown, recorded as
      // such — never as a decided transition failure. The audit row is
      // written BEFORE the reply attempt so a second delivery failure
      // cannot skip it.
      log(`human-work-item handler error: ${error?.message ?? error}`)
      const auditOk = auditRow({ ...base, action: command.action, outcome: 'error', code: 'internal_error', canonicalOutcome: 'unresolved' })
      await deliver(ingress, withAuditDisclosure('⛔ /work failed: internal_error', auditOk), { base, action: command.action })
    }
    return true
  }
}

/** Closed JSONL audit sink (same discipline as compose writeEvidence).
 * Returns {ok:false, error} instead of swallowing — the handler surfaces
 * audit-write failures truthfully (log + reply disclosure). */
function createAuditAppender(auditFile) {
  return (entry) => {
    try {
      mkdirSync(dirname(auditFile), { recursive: true })
      appendFileSync(auditFile, `${JSON.stringify(entry)}\n`)
    } catch (error) {
      return { ok: false, error: error?.message ?? String(error) }
    }
    return { ok: true }
  }
}

/**
 * Composition wiring — mirrors wireV2IngressGate. Installs the seam ONLY
 * when explicitly enabled with a loadable principals file; a broken file
 * under explicit enablement FAILS LOUD (a misconfigured authorization
 * allowlist must never silently run unmapped). Returns true when installed.
 */
export function wireHumanWorkItemIngress({
  feishu,
  router,
  gateway,
  principalsFile,
  auditFile,
  enabled,
  log = () => {},
}) {
  if (!enabled) return false
  if (feishu === undefined || router === undefined || gateway === undefined) {
    throw new Error('HUMAN_WORK_ITEM_INGRESS enabled but feishu/router/gateway unavailable')
  }
  const loaded = loadPrincipalBindings(principalsFile)
  if (!loaded.ok) throw new Error(`HUMAN_WORK_ITEM_INGRESS principals file invalid: ${loaded.error}`)

  const handler = createHumanWorkItemIngressHandler({
    bindings: loaded.bindings,
    gateway,
    reply: (target, text) => feishu.reply(target, text),
    replyTargetFor: (ingress) => feishu.replyTargetFor(ingress),
    audit: createAuditAppender(auditFile),
    fallThrough: null,
    log,
  })

  const downstream = router.routeAuthenticated
  if (typeof downstream !== 'function') {
    throw new Error('HUMAN_WORK_ITEM_INGRESS requires router.routeAuthenticated (authenticated delivery authority)')
  }
  feishu.setCallback(async (ingress, meta) => {
    const handled = await handler(ingress)
    if (!handled) {
      // Fall-through MUST propagate the downstream outcome (value AND throw):
      // the bridge inspects the callback result to surface delivery failures
      // as channel errors exactly once — swallowing it would change the
      // Router's failure semantics for every unconsumed message.
      return downstream(ingress, meta)
    }
    return true
  })
  log(`human-work-item ingress wired: ${loaded.bindings.size} allowlisted principal(s)`)
  return true
}
