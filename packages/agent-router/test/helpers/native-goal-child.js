/** Real native loop + Loader + demo transport; only the model and peer I/O are scripted. */
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { writeFile } from 'node:fs/promises'
import * as DemoServer from '../../../demo-server/src/index.js'
const root = process.env.NGC_HARNESS_ROOT
if (!root) throw new Error('NGC_HARNESS_ROOT must name the paired built native source')
const load = relative => import(pathToFileURL(join(root, relative, 'lib/index.js')).href)
const [{ Context }, { default: Loader }, { default: Include }, { mountAgentLoopTestDependencies },
  { default: AgentLoop }, { default: GoalService }, driver, { LlmAdapter }, { default: Persistence }] = await Promise.all([
  load('vendor/cordis'), load('vendor/loader'), load('vendor/include'), load('packages/test-support/agent-loop-testkit'),
  load('packages/core/agent-loop'), load('packages/goal/goal'), load('packages/goal/goal-round-driver'), load('packages/llm/llm'), load('packages/session/session-persistence-jsonl'),
])
const ctx = new Context()
await mountAgentLoopTestDependencies(ctx)
await ctx.plugin(Persistence, { root: join(process.cwd(), 'sessions'), compression: 'none' })
await ctx.plugin(GoalService)
await ctx.plugin(AgentLoop, { agents: [] })
class ScriptedModel extends LlmAdapter {
  async * stream() {
    const agent = ctx.agents.list()[0]
    let goal = ctx.goals.get(agent)
    if (!goal) {
      goal = ctx.goals.create(agent, { objective: 'Request one isolated peer nonce in each automatic round', maxGoalRounds: 2 })
      if (process.env.NGC_CANCEL_PENDING === 'cancel') setTimeout(() => agent.cancel({ kind: 'user' }), 150)
    }
    else {
      const response = await ctx.get('agentRpc').request('agent-core/broker', {
        capabilityId: 'agent_session_send', operation: 'send',
        args: { targetAgentId: 'agt_isolated-peer', message: `nonce-round-${goal.roundsStarted}`, timeoutSeconds: 0 },
      })
      if (response?.result?.ok !== true) throw new Error(`scripted peer request rejected: ${JSON.stringify(response)}`)
    }
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: `scripted round ${goal.roundsStarted}` } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}
ctx.llm.registerAdapter(['scripted'], new ScriptedModel())
await ctx.plugin(Loader)
ctx.loader.builtins.include = Include
const modules = new Map([['native-driver', driver], ['demo-server', DemoServer]])
ctx.loader.internal = { version: 'v2', async import(name) {
  if (!modules.has(name)) throw new Error(`unexpected test module: ${name}`)
  return modules.get(name)
} }
const configPath = join(process.cwd(), 'native-goal.cordis.yml')
await writeFile(configPath, `- name: native-driver\n  config:\n    enqueueMode: external\n    enqueueTimeoutMs: ${process.env.NGC_CANCEL_PENDING === 'timeout' ? 100 : 5000}\n- name: demo-server\n  config:\n    nativeGoalContinuation: true\n`)
await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
await ctx.loader.await()
