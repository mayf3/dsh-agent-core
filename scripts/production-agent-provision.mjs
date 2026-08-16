#!/usr/bin/env node
/**
 * PRODUCTION_INTEGRATION_V1 — per-agent tree provisioner (ROOT only).
 *
 * WHY this seam exists: in the trusted 505/502 model the Production Runtime
 * (authsvc/505) cannot create a NEW per-agent home/workspace under the
 * 502-owned workspaces/ + homes/ roots AND hand it to the child — chown to
 * 502 requires root, and the setuid spawn helper only drops identity and
 * execs (frozen contract). The proven seam (trusted-credential-505-final-
 * v2-run.mjs, 51/51) is: a ROOT actor provisions each declared agent's DSH
 * home + workspace via the app's own agent-provisioning module (farm links
 * resolve inside the app closure), then hands the trees to the frozen child
 * identity. The runtime's idempotent provisioning then finds everything in
 * place. Run this whenever the Agent Definition gains an agent (after
 * editing the trusted config/agents.json).
 *
 * Usage (root, against the trusted install):
 *   sudo /usr/local/libexec/agent-core/node-runtime/bin/node \
 *     /usr/local/libexec/agent-core/app/scripts/production-agent-provision.mjs
 *
 * Env (all optional):
 *   PROD_ROOT       production persistent root (default /Users/authsvc/.agent-core)
 *   PROVISION_HOME  the 505 identity's home for settings/.credentials copies
 *                   (default /Users/authsvc)
 *   AGENT_PROFILE   per-agent profile (default agent-core-production)
 *   CHILD_UID / CHILD_GID  frozen child identity (default 502 / 20)
 *
 * Never prints or persists secrets; exit 0 = all declared agents provisioned.
 */

import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { provisionAgentHome, REPO } from '../packages/agent-provisioning/src/index.js'
import { resolveProductionLayout } from '../packages/production-runtime/src/paths.js'
import { ensure as ensureWorkspace } from '../packages/workspace-bootstrap/src/index.js'

if (typeof process.getuid === 'function' && process.getuid() !== 0) {
  console.error('must run as root (provisioning hands per-agent trees to the frozen child identity, which requires chown)')
  process.exit(2)
}

const PROD_ROOT = process.env.PROD_ROOT ?? '/Users/authsvc/.agent-core'
const PROVISION_HOME = process.env.PROVISION_HOME ?? '/Users/authsvc'
const PROFILE = process.env.AGENT_PROFILE ?? 'agent-core-production'
const CHILD_UID = process.env.CHILD_UID ?? '502'
const CHILD_GID = process.env.CHILD_GID ?? '20'

const layout = resolveProductionLayout(PROD_ROOT)
const configPath = layout.agentsConfig // symlink -> trusted config/agents.json
if (!existsSync(configPath)) {
  console.error(`Agent Definition config missing: ${configPath} (the runtime loads it, never writes it — seed it first)`)
  process.exit(2)
}

// provisionAgentHome copies settings from DSH_SETTINGS_SOURCE and the .dsh
// credentials file from homedir(); running as root, both must be pointed at
// the 505 identity's home explicitly.
process.env.DSH_SETTINGS_SOURCE ??= join(PROVISION_HOME, '.dsh', 'settings.yaml')
process.env.HOME = PROVISION_HOME

const { agents } = JSON.parse(readFileSync(configPath, 'utf8'))
if (!Array.isArray(agents) || agents.length === 0) {
  console.log('no agents declared — nothing to provision')
  process.exit(0)
}

const sh = (cmd) => spawnSync('sh', ['-c', cmd], { encoding: 'utf8' })
for (const agent of agents) {
  const home = join(layout.homesRoot, agent.id)
  const workspace = join(layout.workspacesRoot, agent.id)
  provisionAgentHome(home, workspace, { profile: PROFILE })
  // Seed the workspace through the SAME capability the Router calls pre-spawn
  // (agent-router ensure(agentId) runs as 505 and only writes AGENTS.md when
  // it is MISSING). Seeding it here as root means the 505-side ensure() is a
  // pure idempotent no-op against the already-handed-to-502 tree — it never
  // attempts a 505 write into the 502-owned workspace (EACCES).
  await ensureWorkspace(agent.id, { workspaceRoot: layout.workspacesRoot, agentsHome: layout.homesRoot })
  // The harness credentials-local plugin requires owner-only 0600 on the
  // copied credentials file (the model key itself travels via the CP env).
  const creds = join(home, '.credentials.yaml')
  if (existsSync(creds)) chmodSync(creds, 0o600)
  // Hand the whole per-agent tree to the frozen child identity.
  const chown = sh(`chown -R -h ${CHILD_UID}:${CHILD_GID} ${JSON.stringify(home)} ${JSON.stringify(workspace)}`)
  if (chown.status !== 0) {
    console.error(`chown failed for ${agent.id}: ${(chown.stderr ?? '').trim()}`)
    process.exit(2)
  }
  console.log(`provisioned ${agent.id} — home ${home} + workspace ${workspace} -> ${CHILD_UID}:${CHILD_GID} (profile ${PROFILE})`)
}

// provisionAgentHome also maintains the app's dev-resolution bridge
// (node_modules/@agent-core symlinks). Written here as root; the app tree
// belongs to the 505 identity, so hand the bridge back to the app's owner.
const appBridge = join(REPO, 'node_modules', '@agent-core')
if (existsSync(appBridge)) {
  const appStat = statSync(REPO)
  sh(`chown -R -h ${appStat.uid}:${appStat.gid} ${JSON.stringify(appBridge)}`)
}

console.log(`provisioned ${agents.length} agent(s) under ${PROD_ROOT}`)
