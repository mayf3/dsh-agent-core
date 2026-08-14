/**
 * @agent-core/router — V0 router plugin.
 *
 * Delivers one input message into the inbox of a DSH Agent and drives it to
 * quiescence. The input is the plugin's configured `fixedInput`, overridden by
 * the first launcher argument (`dsh --profile agent-core "<input>"`), which is
 * exactly the external-message path DSH itself documents: input reaches the
 * driver through `agent.followup()` and `agent.whenIdle()` resolves when the
 * turn closes (see docs/architecture.md, "Turn flow").
 *
 * The delivery flow mirrors the reference one-shot driver
 * `@deepseek-ai/dsh-headless` (create an Agent through `ctx.agents`,
 * freeze the default model selection, follow up, flush, summarize), so this
 * plugin replaces the headless bundle's runner inside the agent-core profile
 * without re-implementing any harness machinery.
 *
 * After the run the router prints the final assistant text plus durable
 * evidence (the `tool/call` → `tool/result` events for this session) so a
 * caller can verify external state instead of trusting the model's claim.
 */

import { randomUUID } from 'node:crypto'
import z from '@deepseek-ai/schemastery'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'

/** Stable plugin name referenced by bundle patches. */
export const name = 'router'

/** Core services required before the one-shot turn can start. */
export const inject = ['agents', 'agentDefaultModel', 'sessions']

/** Plugin config: the input to deliver and the session identity to deliver it under. */
export const Config = z.object({
  /** The fixed input delivered when the launcher supplies no inner arguments. */
  fixedInput: z.string().required(),
  /** Optional stable session id; defaults to a fresh `agent-core-<uuid>` identity. */
  sessionId: z.string(),
})

/** One owned run interval's outcome. */
function summarize(events, firstSeq) {
  const callNames = new Map()
  let started = false
  let text = ''
  let reason
  const evidence = []
  for (const event of events) {
    if (event.seq < firstSeq) continue
    if (event.type === 'turn/start') {
      started = true
      continue
    }
    if (!started) continue
    if (event.type === 'tool/call') {
      callNames.set(event.data.callId, event.data.name)
    }
    if (event.type === 'assistant/message') {
      const joined = event.data.message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('')
      if (joined !== '') text = joined
    }
    if (event.type === 'turn/end') reason = event.data.reason
    if (event.type === 'tool/result') {
      const block = event.data.message.content[0]
      const toolName = block?.toolCallId === undefined ? undefined : callNames.get(block.toolCallId)
      if (toolName === 'external_calculator') {
        evidence.push({
          name: toolName,
          content: (block.content ?? [])
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join(''),
        })
      }
    }
  }
  return { text, reason, evidence }
}

/**
 * Create one Agent, deliver the input into its inbox, and wait for the turn to
 * close.
 * @param ctx - plugin context carrying core services.
 * @param input - the text to deliver.
 * @param sessionId - the shared agent/session identity to create.
 * @returns the settled outcome plus durable tool evidence.
 */
async function runOnce(ctx, input, sessionId) {
  // Loader siblings mount concurrently; await the complete application before
  // creating an Agent so its scoped tools and adapters are not half-composed.
  await ctx.get('loader')?.await()
  const agents = ctx.get('agents')
  const defaultModel = ctx.get('agentDefaultModel')
  const sessions = ctx.get('sessions')
  // Early process shutdown can dispose the tree while settlement is pending.
  if (agents === undefined || defaultModel === undefined || sessions === undefined) {
    return { text: '', reason: undefined, evidence: [] }
  }

  const selection = defaultModel.currentSelection()
  const { agent } = await agents.create({
    sessionId,
    meta: { cwd: process.cwd() },
    agentOptions: { provider: selection.provider, model: selection.model },
    setup: (agentCtx) => {
      const selected = { current: selection, assembled: undefined }
      installModelSelection(agentCtx, selected)
    },
  })
  await agent.whenIdle()
  const firstSeq = agent.session.seq
  agent.followup(createUserMessage({
    content: [{ type: 'text', text: input }],
    source: { kind: 'user' },
  }))
  await agent.whenIdle()
  await sessions.flush(agent.session)
  return summarize(agent.session.events, firstSeq)
}

/**
 * Mount the one-shot router driver.
 * @param ctx - plugin context carrying core services and the launcher-provided exit request.
 * @param config - validated router config.
 */
export function apply(ctx, config) {
  const exit = ctx.get('appExit')
  if (exit === undefined) {
    throw new Error('router: the launcher must provide ctx.appExit before the tree mounts')
  }
  const args = ctx.get('cmdlineArgs')?.get() ?? []
  const input = args[0] ?? config.fixedInput
  const sessionId = SessionId(config.sessionId ?? `agent-core-${randomUUID()}`)
  void runOnce(ctx, input, sessionId).then((outcome) => {
    process.stdout.write(`[router] session: ${sessionId}\n`)
    process.stdout.write(`[router] input: ${input}\n`)
    process.stdout.write(`[router] agent reply: ${outcome.text}\n`)
    for (const item of outcome.evidence) {
      process.stdout.write(`[router] evidence: ${item.name} -> ${item.content}\n`)
    }
    if (outcome.reason?.kind === 'error') {
      process.stderr.write(`router: ${outcome.reason.error.code}: ${outcome.reason.error.message}\n`)
    }
    exit(outcome.reason?.kind === 'completed' ? 0 : 1)
  }).catch((error) => {
    process.stderr.write(`router: ${error instanceof Error ? error.message : String(error)}\n`)
    exit(1)
  })
}
