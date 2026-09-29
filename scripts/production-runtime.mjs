#!/usr/bin/env node
/**
 * production-runtime — thin launcher for the Agent Core Production Runtime
 * (PRODUCTION_RUNTIME_V1). All behavior lives in
 * packages/production-runtime/src/entry.js; this file only boots it. This is
 * the ProgramArguments[0] target of the launchd supervision unit
 * (scripts/production-runtime-launchd.mjs).
 */

import { assertProductionArchitecture } from '../packages/production-runtime/src/native-arm64/admission.js'

async function main() {
  assertProductionArchitecture()
  // An absent or failed one-use HR cut channel must not block ordinary Agents.
  try {
    const { authenticateFixedHrFreshCutStartup } = await import(
      '../packages/production-runtime/src/native-arm64/hr-fresh-lineage-startup-context.mjs')
    await authenticateFixedHrFreshCutStartup()
  } catch (error) {
    process.stderr.write(`[production-runtime] HR fresh cut startup denied: ${error?.message ?? error}\n`)
  }
  const { runProductionRuntime } = await import('../packages/production-runtime/src/entry.js')
  return runProductionRuntime()
}

main().catch((error) => {
  process.stderr.write(`[production-runtime] FATAL ${error?.stack ?? error}\n`)
  process.exit(2)
})
