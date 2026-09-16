#!/usr/bin/env node
/**
 * Retired repair entrypoint retained as a read-only compatibility diagnostic.
 * SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1 forbids this
 * historical script from copying live bytes, reconciling by suffix, changing
 * ownership, releasing fences, or editing the Scheduler store.
 */
import { existsSync, readFileSync } from 'node:fs'

const LIVE = '/usr/local/libexec/agent-core/app'
const STATE = '/Users/authsvc/.agent-core/control/scheduler-watchdog/incidents.json'
const paths = [
  `${LIVE}/scripts/scheduler-watchdog.mjs`,
  `${LIVE}/packages/scheduler/src/watchdog/index.js`,
  STATE,
]

if (process.argv.includes('--repair')) {
  process.stderr.write('[postrepair] RETIRED_MUTATION_PATH: use the accepted controlled deployment/reconciliation path; zero writes performed\n')
  process.exit(2)
}

for (const path of paths) {
  let detail = 'absent'
  if (existsSync(path)) {
    try {
      const bytes = readFileSync(path)
      detail = `present bytes=${bytes.length}`
    } catch (error) {
      detail = `unreadable ${String(error?.code ?? error).slice(0, 40)}`
    }
  }
  process.stdout.write(`[postrepair] ${path}: ${detail}\n`)
}
process.stdout.write('[postrepair] DIAGNOSTIC_ONLY=YES STORE_MUTATION=NO FENCE_RELEASE=NO\n')
