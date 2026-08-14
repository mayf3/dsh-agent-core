/**
 * @agent-core/agent-router — the Integration V1 Router / Control Plane.
 *
 * Channel model (D-002 AGENT_SESSION_CHANNEL_MODEL_V1):
 *
 *   Feishu conversation -> ChannelConversation -> Binding -> Agent + Session
 *
 * A ChannelConversation is the channel-side identity (the Feishu
 * conversationId + channel type). A Binding is the router's in-memory record
 * that ties one ChannelConversation to one (Agent, Session) pair. V1 creates
 * the first binding automatically on first contact with the default Agent and
 * the default session; it does NOT implement natural-language agent switching
 * nor a binding history.
 *
 * The Agent remains the fixed owner of its workspace / DSH_HOME / process /
 * memory; the channel is only an entry point. Routing a message means: look up
 * (or auto-create) the Binding for its ChannelConversation, find-or-start the
 * bound Agent's DSH process, and deliver the message into the bound session.
 */

import z from '@deepseek-ai/schemastery'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { AgentProcess, agentEnv } from './process.js'
import { provisionAgentHome } from '../../../scripts/demo-home.mjs'

/** Stable plugin name referenced by bundle patches. */
export const name = 'agent-router'

/** Feishu channel and workspace bootstrap are optional services (read via ctx.get). */
export const inject = []

/** Router config. */
export const Config = z.object({
  /**
   * Default Agent every new ChannelConversation binds to on first contact
   * (V1: one default agent; no switching). The agentId is the agent's stable
   * identity: its workspace, DSH home and session context all derive from it.
   */
  defaultAgentId: z.string().default('agent-demo'),
  /** Default Session inside the bound Agent (V1: 'main'). */
  defaultSessionId: z.string().default('main'),
  /** Per-agent process profile (the resume-aware demo-server composition). */
  agentProfile: z.string().default('agent-core-demo'),
  /** Root under which each agent's home lives (defaults to ~/.dsh/agents). */
  agentsRoot: z.string(),
  /** Root under which each agent's workspace lives (defaults to ~/.dsh/workspaces). */
  workspacesRoot: z.string(),
})

const sleep = (ms) => new Promise(resolveTimeout => setTimeout(resolveTimeout, ms))

/**
 * Mount the router: bind the feishu ingress callback (when the channel is
 * present) and keep the per-agent process registry alive for the plugin
 * lifetime.
 * @param ctx - plugin context.
 * @param config - validated router config.
 */
export function apply(ctx, config) {
  const cfg = { ...Config, ...(config ?? {}) }
  const log = {
    log: (...args) => process.stderr.write(`[router] ${args.join(' ')}\n`),
    error: (...args) => process.stderr.write(`[router] ERROR ${args.join(' ')}\n`),
  }

  const agentsRoot = cfg.agentsRoot || join(homedir(), '.dsh', 'agents')
  const workspacesRoot = cfg.workspacesRoot || join(homedir(), '.dsh', 'workspaces')

  /** agentId -> AgentProcess registry (one live owner per agent). */
  const registry = new Map()
  /** ChannelConversation (conversationId) -> Binding { agentId, sessionId }. */
  const bindings = new Map()

  const workspaceBootstrap = ctx.get('workspaceBootstrap')
  const feishu = ctx.get('feishu')

  if (workspaceBootstrap === undefined) {
    throw new Error('agent-router: workspaceBootstrap service not available')
  }

  /**
   * D-002 contract endpoint #12 (equivalent minimal implementation):
   * `PUT /v1/channel-conversations/resolve` semantics as an in-process
   * service. Idempotent: (channel, externalId) is the ChannelConversation
   * identity. First contact creates the ChannelConversation together with the
   * initial Binding to the default Agent + default Session; later contacts
   * return the existing ChannelConversation + Binding untouched.
   *
   * @param {object} req - { channel, externalId }.
   * @returns {{ channelConversation: {id, channel, externalId},
   *             binding: {activeAgentId, activeSessionId} }}
   */
  function resolveChannelConversation(req) {
    const channel = req?.channel
    const externalId = req?.externalId
    if (typeof channel !== 'string' || channel === '' || typeof externalId !== 'string' || externalId === '') {
      throw new TypeError('resolveChannelConversation: channel and externalId (non-empty strings) are required')
    }
    const ccId = `${channel}:${externalId}`
    let binding = bindings.get(ccId)
    if (binding === undefined) {
      binding = { agentId: cfg.defaultAgentId, sessionId: cfg.defaultSessionId }
      bindings.set(ccId, binding)
      log.log(`binding created: channelConversation ${ccId.slice(0, 24)}... -> agent ${binding.agentId} + session ${binding.sessionId}`)
    }
    return {
      channelConversation: { id: ccId, channel, externalId },
      binding: { activeAgentId: binding.agentId, activeSessionId: binding.sessionId },
    }
  }

  /** Find-or-start the agent's DSH process; never returns a dead one. */
  async function ensureRunning(agentId) {
    const existing = registry.get(agentId)
    if (existing !== undefined && existing.exit === undefined) {
      log.log(`reuse process for ${agentId} (pid ${existing.pid})`)
      return existing
    }
    if (existing !== undefined) {
      registry.delete(agentId)
      log.log(`process for ${agentId} exited (${existing.exit?.code ?? 'signal'}); will respawn`)
    }
    const workspace = workspaceBootstrap.resolveWorkspace(agentId, workspacesRoot)
    const home = workspaceBootstrap.resolveDshHome(agentId, agentsRoot)
    // Provision the agent home (settings/credentials/profile/plugin farm) and
    // the workspace directory — idempotent.
    provisionAgentHome(home, workspace)
    const proc = new AgentProcess({ agentId, home, workspace, profile: cfg.agentProfile, log })
    proc.spawn()
    registry.set(agentId, proc)
    // Reap on exit; the next message re-spawns and resumes.
    void proc.exitPromise.then(() => {
      if (registry.get(agentId) === proc) registry.delete(agentId)
    })
    await proc.ready()
    return proc
  }

  /**
   * Deliver one ingress message through the channel model:
   *   ChannelConversation -> Binding -> Agent + Session -> reply.
   * The Feishu Connector stays stateless: it only forwards the ingress; the
   * router resolves the binding and dispatches (D-002: the connector does not
   * persist Agent / Session state).
   */
  async function onIngress(ingress) {
    const evSummary = `channel=${ingress.channel} chat=${ingress.chatId} sender=${ingress.sender.openId?.slice(0, 6)} text="${(ingress.text ?? '').slice(0, 60)}"`
    const { channelConversation, binding } = resolveChannelConversation({
      channel: 'feishu',
      externalId: ingress.conversationId,
    })
    log.log(`channelConversation ${channelConversation.id.slice(0, 24)}... -> binding -> agent ${binding.activeAgentId} + session ${binding.activeSessionId} (${evSummary})`)
    try {
      const proc = await ensureRunning(binding.activeAgentId)
      const { reply } = await proc.turn(binding.activeSessionId, ingress.text ?? '')
      log.log(`agent ${binding.activeAgentId} (pid ${proc.pid}) replied: ${(reply ?? '').slice(0, 80)}`)
      if (feishu !== undefined) {
        // Reply to the originating message (in-thread automatically when the
        // ingress was a topic thread).
        await feishu.reply(feishu.replyTargetFor(ingress).replyTo(ingress.messageId), reply)
        log.log(`reply sent back to ${ingress.conversationId.slice(0, 12)}...`)
      }
    } catch (error) {
      log.error(`delivery to ${binding.activeAgentId} failed: ${error?.message ?? error}`)
      if (feishu !== undefined) {
        try {
          await feishu.reply(feishu.replyTargetFor(ingress).replyTo(ingress.messageId), `[agent-core] delivery failed: ${error.message ?? error}`)
        } catch { /* best effort */ }
      }
    }
  }

  // Bind the channel ingress (feishu-connector only forwards addressed events).
  if (feishu !== undefined) {
    feishu.setCallback(onIngress)
    log.log(`feishu channel bound; default binding -> agent ${cfg.defaultAgentId} + session ${cfg.defaultSessionId}`)
  } else {
    log.log('feishu channel not present; router idle')
  }

  // Tear down every owned process when the router plugin stops.
  ctx.effect(() => () => {
    for (const proc of registry.values()) {
      void proc.shutdown()
    }
    registry.clear()
  })

  const service = {
    pluginName: name,
    /** D-002 endpoint #12: idempotent ChannelConversation resolve. */
    resolveChannelConversation,
    /** Test/ops surface: current registry snapshot. */
    registrySnapshot: () => [...registry.entries()].map(([agentId, proc]) => ({
      agentId,
      pid: proc.pid,
      alive: proc.exit === undefined,
      home: proc.home,
      workspace: proc.workspace,
    })),
    ensureRunning,
    route: onIngress,
  }

  // Publish the router as an in-process service ('agentRouter') so the Feishu
  // Connector (or any future transport) can resolve ChannelConversations and
  // dispatch per the D-002 contract. VALUE semantics: Cordis stores the value
  // as-is (a factory function would be returned as-is by ctx.get()).
  ctx.provide('agentRouter', service)
  return service
}
