#!/usr/bin/env node
/**
 * Run the agent-core profile through the dsh CLI.
 *
 * Resolves the DSH checkout (DSH_HARNESS_ROOT env or the default sibling
 * path), supplies OPENCODE_GO_API_KEY from the Harness-home credential
 * document when the environment lacks it, and boots
 * `dsh --profile agent-core <args...>` with the repo as working directory.
 *
 * Usage:
 *   node scripts/run.mjs                      # deliver the fixed input
 *   node scripts/run.mjs "your own input"     # deliver a launcher argument
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DSH_ROOT = process.env.DSH_HARNESS_ROOT ?? resolve(REPO, '../../github/deepseek-harness')
const CLI = join(DSH_ROOT, 'apps/cli/lib/bin.js')
if (!existsSync(CLI)) {
  console.error(`dsh CLI not found at ${CLI}; set DSH_HARNESS_ROOT to the deepseek-harness checkout`)
  process.exit(2)
}

const env = { ...process.env }
if (env.OPENCODE_GO_API_KEY === undefined) {
  const home = env.DSH_HOME ?? join(homedir(), '.dsh')
  const credentialFile = join(home, '.credentials.yaml')
  if (existsSync(credentialFile)) {
    const match = readFileSync(credentialFile, 'utf8').match(/^OPENCODE_GO_API_KEY:\s*"?([^"\n]+)"?/m)
    if (match !== null) env.OPENCODE_GO_API_KEY = match[1]
  }
}
env.DSH_TELEMETRY_DISABLED = env.DSH_TELEMETRY_DISABLED ?? '1'

const result = spawnSync(
  process.execPath,
  [CLI, '--profile', 'agent-core', ...process.argv.slice(2)],
  { stdio: 'inherit', env, cwd: REPO },
)
process.exit(result.status ?? 1)
