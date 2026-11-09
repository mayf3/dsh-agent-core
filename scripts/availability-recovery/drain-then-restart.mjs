/** #1257 R1: ordinary restart through the existing controlled deployment path.
 *
 * The deployment caller supplies its admitted context and operation mandate.
 * The sole restart implementation first observes the durable drain census,
 * then launchd bootout requests the Runtime's graceful SIGTERM stop. It waits
 * for the fresh successful stop receipt (all worker slots empty, settlement
 * visible) AND the exact old native instance's exit before bootstrap.
 *
 * This outer script has no forced-kill, kickstart or undrained escape path.
 * Runtime-owned worker escalation remains governed by PLH C020-C022; the
 * adapter neither sends worker signals nor manufactures termination proof.
 * Importing this module performs no operation; production apply needs the
 * separately authorized existing deployment entrypoint.
 */
import { restartSchedulerProductionRuntime } from '../../packages/production-runtime/src/scheduler/deployment-runtime-restart.js'

export function drainThenRestart({ ctx, phase, sourceSha }) {
  if (ctx?.acceptUndrainedRestart === true) {
    throw Object.assign(new Error('ordinary drain-then-restart does not accept undrained execution'), {
      code: 'RESTART_UNDRAINED_BYPASS_FORBIDDEN',
    })
  }
  return restartSchedulerProductionRuntime({ ctx, phase, sourceSha })
}
