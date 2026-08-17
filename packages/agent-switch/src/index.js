/**
 * @agent-core/agent-switch — the DSH-side switch adapter.
 *
 * Registers ONE model tool inside a per-agent DSH process:
 *
 *   agent_core.switch_agent(targetAgentId, targetSessionId?)
 *
 * The tool is a pure ADAPTER. Its execute() forwards the arguments over the
 * demo-server parent-RPC relay (`ctx.agentRpc` -> `rpc.request` notification
 * -> the Router / Control Plane) to the Router's single domain operation
 * `switchAgent`. Everything the task list says an adapter must NOT own stays
 * out of this package:
 *
 *   - Binding persistence        -> the Router (BindingStore)
 *   - Agent lookup policy        -> the Router (via the Agent Registry)
 *   - Session selection policy   -> the Router (explicit session, else main)
 *   - Mobile / Feishu branching  -> not here (one Router, one domain op)
 *   - navigation history         -> not implemented anywhere in V1
 *
 * The parent-RPC method name is a wire contract shared with the Router
 * (`SWITCH_RPC_METHOD` in @agent-core/agent-router). The literal is kept in
 * both packages on purpose — no cross-package source dependency for one
 * constant (same stance as agent-definition vs workspace-bootstrap).
 */

import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

/** Stable plugin name referenced by bundle patches. */
export const name = 'agent-switch'

/** Wire contract: the Router domain operation invoked over the parent RPC. */
export const SWITCH_RPC_METHOD = 'agent-core/switchAgent'

/**
 * The model tool this adapter registers.
 *
 * The task intent was `agent_core.switch_agent`, but the opencode-go model
 * route rejects tool names outside `^[a-zA-Z0-9_-]+$` (verified live: the
 * provider answers `Invalid 'tools[0].function.name': string does not match
 * pattern` for dotted names). The semantic prefix survives as
 * `agent_core_switch_agent`; the adapter behaviour is unchanged.
 */
export const TOOL_NAME = 'agent_core_switch_agent'

/** The parent-RPC relay is a hard dependency of the adapter. */
export const inject = ['agentRpc']

/** Adapter config. */
export const Config = z.object({
  /** Register the tool under this name (default agent_core_switch_agent). */
  toolName: z.string().default(TOOL_NAME),
})

const TEXT_OUTPUT = (text) => [{ type: 'text', text }]

/**
 * Mount the adapter: register the switch tool wired to the Router domain
 * operation through the demo-server parent-RPC relay.
 *
 * Arrow (not function declaration) on purpose: cordis 4 treats any apply with
 * a prototype as a class constructor and discards its return value, so a
 * `function apply` disposer would never run on unload (same pattern as
 * agent-memory).
 *
 * @param ctx - plugin context carrying `agentRpc` (demo-server).
 * @param config - validated plugin config.
 */
export const apply = (ctx, config) => {
  const cfg = Config(config)
  const toolName = cfg.toolName

  /** Forward one switch request; resolves with the new Binding. */
  async function requestSwitch(args) {
    const response = await ctx.agentRpc.request(SWITCH_RPC_METHOD, {
      targetAgentId: args.targetAgentId,
      // Explicit session passes through; undefined lets the Router apply its
      // own V1 rule (target Agent's `main`). Session selection is Router
      // policy, never this adapter's.
      targetSessionId: args.targetSessionId,
    })
    if (response?.ok !== true) {
      throw new Error(response?.error ?? 'switchAgent failed')
    }
    return response.result
  }

  const tool = defineTool({
    name: toolName,
    description:
      'Switch the current conversation to another Agent. Use when the user asks to talk to a different agent ' +
      '("叫 Agent B 来", "换回论文导师", "let me talk to the research director"). ' +
      'targetAgentId is the target Agent\'s id or display name. The next message in this conversation goes to that Agent.',
    parameters: {
      targetAgentId: {
        type: 'string',
        required: true,
        description: 'The target Agent\'s id (agt_...) or display name',
      },
      targetSessionId: {
        type: 'string',
        description: 'Optional target session; omitted switches to the Agent\'s main session',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          binding: {
            type: 'object',
            additionalProperties: false,
            properties: {
              channelConversationId: { type: 'string', required: true },
              activeAgentId: { type: 'string', required: true },
              activeSessionId: { type: 'string', required: true },
              // AGENT_CORE_BINDING_WORKSPACE_V1: the Binding's stable
              // effective workspaceId (null = target Agent default).
              workspace: { oneOf: [{ type: 'string' }, { type: 'null' }] },
              updatedAt: { type: 'string', required: true },
            },
          },
        },
      },
      render: (_args, value) => TEXT_OUTPUT(
        value.ok
          ? `Conversation switched to agent ${value.binding.activeAgentId} / session ${value.binding.activeSessionId}.`
          : 'Switch failed.'),
    },
    async execute(args) {
      const binding = await requestSwitch(args)
      return { ok: true, binding }
    },
  })

  // Register the tool for the lifetime of the plugin (the register disposer
  // is collected by the fiber; an arrow apply also makes this plugin's own
  // disposer run on unload — same pattern as agent-memory).
  const disposers = []
  ctx.inject(['tools'], (toolsCtx) => {
    disposers.push(toolsCtx.tools.register(tool))
  })
  return () => {
    for (const dispose of disposers) {
      if (typeof dispose === 'function') dispose()
    }
  }
}
