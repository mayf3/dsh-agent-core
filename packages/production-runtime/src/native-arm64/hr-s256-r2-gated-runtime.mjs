#!/usr/bin/env node
/**
 * Fixed s256 R2 successor entry. This is not the ordinary launchd entry and
 * does not establish whole-host launch-source closure by itself.
 */

import { authenticateFixedStartupContext } from './hr-s256-r2-startup-context.mjs'

async function main() {
  const runtimeArgs = await authenticateFixedStartupContext()

  // Nothing that opens the Router store or publishes business admission loads
  // before the proof above. MF1 separately retires the ordinary ungated entry.
  const { assertProductionArchitecture } = await import('./admission.js')
  assertProductionArchitecture()
  process.argv = [process.argv[0], process.argv[1], ...runtimeArgs]
  const { runProductionRuntime } = await import('../entry.js')
  return runProductionRuntime()
}

main().catch((error) => {
  process.stderr.write(`[hr-s256-r2-gated-runtime] FATAL ${error?.message ?? error}\n`)
  process.exit(2)
})
