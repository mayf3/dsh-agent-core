#!/usr/bin/env node
/**
 * CLI wrapper over the shared per-agent home provisioning
 * (scripts/demo-home.mjs). Usage:
 *   node scripts/install-demo-home.mjs <home> <agentId> [--workspace <dir>]
 */

import { join, resolve } from 'node:path'
import { provisionAgentHome } from './demo-home.mjs'

const HOME_ARG = process.argv[2]
const AGENT_ID = process.argv[3] ?? 'agent'
if (HOME_ARG === undefined) {
  console.error('usage: node scripts/install-demo-home.mjs <home> <agentId> [--workspace <dir>]')
  process.exit(2)
}
const HOME = resolve(HOME_ARG)
const workspaceFlag = process.argv.indexOf('--workspace')
const WORKSPACE = workspaceFlag !== -1 ? resolve(process.argv[workspaceFlag + 1]) : join(HOME, 'workspace')
provisionAgentHome(HOME, WORKSPACE)
console.log(`demo home ready: ${HOME} (agent ${AGENT_ID}, workspace ${WORKSPACE})`)
