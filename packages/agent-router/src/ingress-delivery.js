/**
 * @agent-core/agent-router/src/ingress-delivery.js — ingress message
 * delivery and the AGENT ROUTER DELIVERY V0 admission seam (extracted from
 * src/index.js in the PR #42 structure refactor — no semantic change).
 *
 * `onIngress` delivers one channel ingress through the channel model:
 *   ChannelConversation -> Binding -> Agent + Session -> reply.
 * `deliver` is the frozen admission interface:
 *   deliver({ requestId, agentId, sessionMode: 'main'|'fresh', message })
 *     -> { accepted: true, sessionId }
 * Both paths run the CLAUSE-PROC-BOUNDED rule 8 reconciliation-capacity
 * precheck BEFORE any spawn/write.
 */

import { createHash } from 'node:crypto'

import { ingressBindingNamespace, feishuReplyOwed } from './channel-conversation.js'

/**
 * Create the ingress/delivery surface bound to one router mount.
 * @param {object} deps
 * @param {object} deps.log - structured logger.
 * @param {object|undefined} deps.feishu - the Feishu channel service (when
 *   present; reply transport for Feishu-entry ingresses).
 * @param {object} deps.workspaceBootstrap - workspace-bootstrap service.
 * @param {object} deps.store - BindingStore (fresh-session mapping table).
 * @param {object} deps.reconciliationStore - the Router reconciliation store.
 * @param {function} deps.ensureRunning - registry find-or-start.
 * @param {function} deps.resolveAgentRef - Agent Definition ref resolver.
 * @param {function} deps.resolveChannelConversation - first-contact resolve.
 * @param {function} deps.resolveEffectiveWorkspace - Binding workspace rule.
 */
export function createIngressDelivery({
  log, feishu, workspaceBootstrap, store, reconciliationStore,
  ensureRunning, resolveAgentRef, resolveChannelConversation, resolveEffectiveWorkspace,
}) {
  /** Delivery V0 acceptance log (evidence surface; in-memory only). */
  const deliveries = []

  /**
   * Deliver one ingress message through the channel model:
   *   ChannelConversation -> Binding -> Agent + Session -> reply.
   * The Feishu Connector stays stateless: it only forwards the ingress; the
   * router resolves the binding and dispatches (D-002: the connector does not
   * persist Agent / Session state). Any future entry (Mobile/Web Product
   * Gateway) delivers through this same path.
   *
   * FROZEN NAMESPACE SEMANTICS (merge audit FIX 1): the Feishu connector
   * classifies ingress.channel as the MESSAGE SUBTYPE ('p2p' | 'group' |
   * 'thread') — transport detail, never a Binding namespace. The Binding
   * namespace for every Feishu ingress is 'feishu' (`feishu:<conversationId>`
   * durable Bindings keep matching; nothing is migrated or orphaned), and
   * only the mobile Product API entry uses its own namespace ('mobile',
   * `mobile:<surfaceId>`). Reply is owed exactly for the Feishu entry.
   * @param {object} ingress - { channel?, chatId, conversationId, sender,
   *   text }; channel absent => Feishu entry (legacy callers).
   * @returns {Promise<{reply:string, agentId:string, sessionId:string,
   *   pid?:number} | {error: Error}>} the delivery result.
   */
  async function onIngress(ingress) {
    const namespace = ingressBindingNamespace(ingress)
    const evSummary = `channel=${ingress.channel ?? '(none)'} chat=${ingress.chatId} sender=${ingress.sender?.openId?.slice(0, 6)} text="${(ingress.text ?? '').slice(0, 60)}"`
    const { channelConversation, binding } = await resolveChannelConversation({
      channel: namespace,
      externalId: ingress.conversationId,
      // The product entry's already-decided initial binding triple values
      // (opaque data here — the Router never derives workspace or session
      // values from channel identities).
      workspace: ingress.workspace,
      sessionId: ingress.session,
    })
    log.log(`channelConversation ${channelConversation.id.slice(0, 24)}... -> binding -> agent ${binding.activeAgentId} + session ${binding.activeSessionId} (${evSummary})`)
    const isFeishuEntry = feishuReplyOwed(ingress)
    try {
      // AGENT_CORE_BINDING_WORKSPACE_V1: resolve the Binding's effective
      // workspace and hand it to the turn as the SESSION cwd (R1 create /
      // R2 resume-compare / R3 mismatch reject — all enforced in the
      // demo-server session seam). A valid-but-missing workspace directory is
      // the normal bootstrap path (idempotent ensure, never a rejection).
      const { workspaceId, workspacePath } = resolveEffectiveWorkspace(binding)
      if (workspaceId !== null) {
        await workspaceBootstrap.ensureWorkspace(workspaceId)
      }
      // CLAUSE-PROC-BOUNDED rule 8: capacity precheck before spawn/write.
      reconciliationStore.assertMintCapacity(binding.activeAgentId)
      const proc = await ensureRunning(binding.activeAgentId)
      const turnResult = await proc.turn(binding.activeSessionId, ingress.text ?? '', {
        // The turn belongs to this ChannelConversation: the DSH switch tool
        // inside the agent switches exactly this Binding.
        bindingContext: channelConversation.id,
        // The session's effective workspace cwd (per-session, NOT the
        // process-level cwd — one Agent stays one process across workspaces).
        cwd: workspacePath,
      })
      // C-010 closed envelope. `outcome_unknown` is NOT an ordinary failure:
      // the turn may still be running — surface a structured timeout error
      // through the existing failure reply path (Router-owned product
      // policy; no auto replay, no fabricated completion). Legacy
      // process-factory fakes returning a bare {reply} keep working.
      if (turnResult?.status === 'outcome_unknown') {
        throw Object.assign(
          new Error(`turn outcome unknown (agent ${binding.activeAgentId}, deadline ${turnResult.deadlineAtWallMs ?? 'n/a'}); reconciliation handle ${turnResult.reconciliationHandle}`),
          {
            code: 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN',
            status: 'outcome_unknown',
            reconciliationHandle: turnResult.reconciliationHandle,
          },
        )
      }
      const reply = turnResult?.reply ?? ''
      log.log(`agent ${binding.activeAgentId} (pid ${proc.pid}) replied: ${(reply ?? '').slice(0, 80)}`)
      // Feishu reply is the FEISHU entry's transport half; non-feishu
      // surfaces (mobile Product API) return the reply to their own caller.
      if (feishu !== undefined && isFeishuEntry) {
        // Reply to the originating message (in-thread automatically when the
        // ingress was a topic thread).
        await feishu.reply(feishu.replyTargetFor(ingress).replyTo(ingress.messageId), reply)
        log.log(`reply sent back to ${ingress.conversationId.slice(0, 12)}...`)
      }
      return { reply, agentId: binding.activeAgentId, sessionId: binding.activeSessionId, pid: proc.pid }
    } catch (error) {
      log.error(`delivery to ${binding.activeAgentId} failed: ${error?.message ?? error}`)
      if (feishu !== undefined && isFeishuEntry) {
        try {
          await feishu.reply(feishu.replyTargetFor(ingress).replyTo(ingress.messageId), `[agent-core] delivery failed: ${error.message ?? error}`)
        } catch { /* best effort */ }
      }
      return { error }
    }
  }

  /**
   * AGENT ROUTER DELIVERY V0 — the frozen admission interface:
   *
   *   deliver({ requestId, agentId, sessionMode: 'main'|'fresh', message })
   *     -> { accepted: true, sessionId }
   *
   * `accepted: true` means ONLY "the message entered the correct DSH
   * Session's inbox" — it NEVER waits for the agent turn / model round to
   * finish (the turn continues asynchronously). The admission seam is:
   *
   *   ensureRunning(agentId)           find-or-start the agent's DSH process
   *   -> session resolution            'main' fixed; fresh mapped by requestId
   *   -> proc.deliver(sessionId, text) session/prompt receipt = inbox accept
   *   -> { accepted, sessionId }       return immediately
   *
   * Session selection is the ROUTER's policy and takes NO caller input:
   *
   * - `main`: sessionId is ALWAYS the fixed `main` (exists -> the per-agent
   *   demo-server resumes the persisted session; absent -> creates). This is
   *   the only Session V0 allows to continue across jobs.
   * - `fresh`: the FIRST delivery of a requestId mints a brand-new native
   *   session id (`fresh-<sha256(agentId\0requestId)>`); every retry of the
   *   SAME requestId returns the SAME mapping (durably persisted, survives
   *   control-plane restarts); a DIFFERENT requestId mints a DIFFERENT
   *   session. The caller never addresses a session — the frozen interface
   *   has no sessionId field, and a stray one is rejected fail-loud, so no
   *   caller can specify or resume an arbitrary historical non-main session.
   *
   * The Router does NOT understand Workflow / Forum / Team / Mailbox /
   * notification retry queues / scheduler coupling: this is a pure
   * (agentId, session) admission entry.
   *
   * @param {object} req - { requestId, agentId, sessionMode, message }.
   * @returns {Promise<{accepted:true, sessionId:string}>}
   */
  async function deliver(req) {
    const requestId = req?.requestId
    const sessionMode = req?.sessionMode
    const message = req?.message
    if (typeof requestId !== 'string' || requestId === '') {
      throw new TypeError('agent-router: deliver requestId must be a non-empty string')
    }
    if (sessionMode !== 'main' && sessionMode !== 'fresh') {
      throw new TypeError(`agent-router: deliver sessionMode must be 'main' or 'fresh' (got ${JSON.stringify(sessionMode)})`)
    }
    if (typeof message !== 'string') {
      throw new TypeError('agent-router: deliver message must be a string')
    }
    if (req?.sessionId !== undefined) {
      // DELIVERY V0 boundary: the frozen interface has no sessionId. Reject
      // fail-loud (the same policy product-api applies to switchAgent) so no
      // caller can name or resume an arbitrary historical non-main session.
      throw new TypeError('agent-router: deliver has no sessionId field — the Router owns session selection (main | fresh-by-requestId)')
    }
    const agentRef = req?.agentId
    if (typeof agentRef !== 'string' || agentRef.trim() === '') {
      throw new TypeError('agent-router: deliver agentId must be a non-empty string')
    }
    const agent = resolveAgentRef(agentRef)
    // CLAUSE-PROC-BOUNDED rule 8: reconciliation capacity is checked BEFORE
    // spawn/write — an exhausted store must never cost a spawn or a prompt
    // byte (§10.3 ROUTER_GLOBAL_RECONCILIATION_CAP: S/W = 0/0).
    reconciliationStore.assertMintCapacity(agent.id)
    // Session resolution: 'main' is the fixed V0 cross-job session; 'fresh'
    // maps (agentId, requestId) -> a minted native session id, durably. The
    // mint runs INSIDE the store's mutation queue (read-or-mint is atomic:
    // two concurrent first deliveries of the same requestId converge on one
    // session; the collision loop only guards the astronomically unlikely
    // hash clash between two different requestIds).
    const sessionId = sessionMode === 'main'
      ? 'main'
      : (await store.freshSessionFor(agent.id, requestId, (used) => {
          const digest = createHash('sha256').update(`${agent.id}\u0000${requestId}`).digest('hex')
          const base = `fresh-${digest.slice(0, 32)}`
          let id = base
          let n = 0
          while (used.has(id)) id = `${base}-${++n}`
          return id
        })).sessionId
    const started = Date.now()
    const proc = await ensureRunning(agent.id)
    // AGENT_CORE_BINDING_WORKSPACE_V1: Delivery V0 has no ChannelConversation
    // and therefore no Binding — the Default Workspace Rule applies
    // mechanically (agent default workspace), passed as the per-session cwd
    // exactly like the turn path (R1/R2/R3 enforced in the demo-server seam).
    const workspacePath = workspaceBootstrap.resolveWorkspace(agent.id)
    // callerCorrelation: the Delivery V0 requestId becomes the exact
    // secondary index (occurrenceId/runId absent) so callers can restore the
    // reconciliationHandle after losing their in-memory reference (C-010).
    const receipt = await proc.deliver(sessionId, message, { cwd: workspacePath, callerCorrelation: { requestId } })
    deliveries.push({
      requestId,
      agentId: agent.id,
      sessionMode,
      sessionId,
      messageId: receipt.messageId,
      acceptedAt: new Date().toISOString(),
      ms: Date.now() - started,
    })
    log.log(`deliver accepted: agent ${agent.id} session ${sessionId} requestId ${requestId.slice(0, 24)}... (${receipt.messageId}) in ${Date.now() - started}ms`)
    return { accepted: true, sessionId }
  }

  /** Test/ops: in-memory Delivery V0 acceptance log snapshot. */
  function deliveriesSnapshot() {
    return deliveries.map(d => ({ ...d }))
  }

  return { onIngress, deliver, deliveriesSnapshot }
}
