/**
 * Production wiring for AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1:
 * mounts the shared development execution engine over the production layout
 * and provides the LOCAL handler map consumed by the broker gateway
 * (`developmentExecutionAccess`), exactly like selfOpsAccess /
 * executionHistoryAccess.
 *
 * Agentic-neutral by construction: the caller identity comes from the
 * gateway's trusted context; the backend (Codex) never appears in any tool
 * surface; the repo/worktree authority lives under
 * `<root>/dev-execution/{repos.json,backend.json}` (Operator-managed).
 */
import { DevelopmentExecutionEngine } from '../../development-execution/src/index.js'

export function mountDevelopmentExecutionRuntime({ ctx, layout, log = { log: () => {} } }) {
  if (ctx === undefined || layout?.developmentExecutionDir === undefined) {
    throw new TypeError('development-execution-runtime: ctx and layout.developmentExecutionDir are required')
  }
  const engine = new DevelopmentExecutionEngine({
    devDir: layout.developmentExecutionDir,
    log: { log: (...a) => log.log('[development-execution]', ...a) },
  })
  const handlers = {
    development_execute: {
      start: async (args, context) => {
        const r = await engine.start({
          repo: args.repo, baseSha: args.baseSha, task: args.task,
          branch: args.branch, constraints: args.constraints, dedupeKey: args.dedupe_key,
        }, context.callerAgentId)
        return { ok: true, result: r }
      },
      status: async (args) => ({ ok: true, result: engine.status(args.executionId) }),
      continue: async (args, context) => {
        const r = await engine.continue({ executionId: args.executionId, instruction: args.instruction }, context.callerAgentId)
        return { ok: true, result: r }
      },
      cancel: async (args) => ({ ok: true, result: engine.cancel(args.executionId) }),
      result: async (args) => ({ ok: true, result: engine.result(args.executionId) }),
    },
  }
  ctx.provide('developmentExecutionAccess', { handlers, engine })
  log.log('development-execution surface mounted (shared, backend-abstracted)')
  return { engine, handlers }
}
