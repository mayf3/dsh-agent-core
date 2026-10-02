/**
 * Production compatibility for AGENT_CORE_DEVELOPMENT_EXECUTION_AUTHORITY_CONVERGENCE_V1:
 * status/result replay recorded history; start/continue/cancel refuse the
 * retired Core writer. The broker keeps its existing local handler surface.
 */
import { DevelopmentExecutionHistory } from './execution-history/development-execution-history.js'

export function mountDevelopmentExecutionRuntime({ ctx, layout, log = { log: () => {} } }) {
  if (ctx === undefined || layout?.developmentExecutionDir === undefined) {
    throw new TypeError('development-execution-runtime: ctx and layout.developmentExecutionDir are required')
  }
  const engine = new DevelopmentExecutionHistory({ devDir: layout.developmentExecutionDir })
  const handlers = {
    development_execute: {
      start: async () => engine.start(),
      status: async (args) => ({ ok: true, result: engine.status(args.executionId) }),
      continue: async () => engine.continue(),
      cancel: async () => engine.cancel(),
      result: async (args) => ({ ok: true, result: engine.result(args.executionId) }),
    },
  }
  ctx.provide('developmentExecutionAccess', { handlers, engine })
  log.log('development-execution history mounted (writer authority retired)')
  return { engine, handlers }
}
