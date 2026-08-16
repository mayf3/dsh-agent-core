#!/usr/bin/env node
/**
 * production-runtime — thin launcher for the Agent Core Production Runtime
 * (PRODUCTION_RUNTIME_V1). All behavior lives in
 * packages/production-runtime/src/entry.js; this file only boots it. This is
 * the ProgramArguments[0] target of the launchd supervision unit
 * (scripts/production-runtime-launchd.mjs).
 */

import { runProductionRuntime } from '../packages/production-runtime/src/entry.js'

runProductionRuntime().catch((error) => {
  process.stderr.write(`[production-runtime] FATAL ${error?.stack ?? error}\n`)
  process.exit(2)
})
