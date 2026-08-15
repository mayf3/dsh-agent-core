#!/usr/bin/env node
/**
 * Install the Integration V1 control-plane profile into the Harness home
 * (additive only, mirrors scripts/install-profile.mjs):
 *
 *   $DSH_HOME/profiles/agent-core-integration/{package.json,cordis.patch.yml}
 *     -> symlinks into the repo's profile-integration/
 *   $DSH_HOME/profiles/agent-core-integration-agent/{package.json,cordis.patch.yml}
 *     -> symlinks into the repo's profile-integration-agent/ (per-agent
 *        profile for Product Integration V1: demo-server + owner-guard +
 *        agent-memory + agent-switch)
 *   $DSH_HOME/profiles/node_modules/@agent-core/{bundle-integration,
 *     feishu-connector,agent-router,workspace-bootstrap,agent-registry,
 *     bundle-memory,bundle-agent-switch,agent-memory,agent-switch}
 *     -> symlinks into the repo's packages/ (flat fallback mechanism)
 *
 * Also verifies the dev resolution bridge exists.
 */

import { existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')

function ensureSymlink(target, link) {
  mkdirSync(dirname(link), { recursive: true })
  try {
    const stat = lstatSync(link)
    if (stat.isSymbolicLink() && resolve(readlinkSync(link)) === resolve(target)) return
    rmSync(link, { recursive: true, force: true })
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  symlinkSync(target, link)
}

const profileDir = join(HOME, 'profiles', 'agent-core-integration')
mkdirSync(profileDir, { recursive: true })
for (const file of ['package.json', 'cordis.patch.yml']) {
  ensureSymlink(join(REPO, 'profile-integration', file), join(profileDir, file))
}

// Per-agent profile for Product Integration V1 (demo-server + owner-guard +
// agent-memory + agent-switch), installed so the control plane can spawn it
// with ROUTER_AGENT_PROFILE=agent-core-integration-agent.
const agentProfileDir = join(HOME, 'profiles', 'agent-core-integration-agent')
mkdirSync(agentProfileDir, { recursive: true })
for (const file of ['package.json', 'cordis.patch.yml']) {
  ensureSymlink(join(REPO, 'profile-integration-agent', file), join(agentProfileDir, file))
}

const farm = join(HOME, 'profiles', 'node_modules', '@agent-core')
const pkgDirs = {
  // control plane
  'bundle-integration': join(REPO, 'bundle-integration'),
  'feishu-connector': join(REPO, 'packages', 'feishu-connector'),
  'agent-router': join(REPO, 'packages', 'agent-router'),
  'workspace-bootstrap': join(REPO, 'packages', 'workspace-bootstrap'),
  'agent-registry': join(REPO, 'packages', 'agent-registry'),
  // per-agent composition
  'bundle-memory': join(REPO, 'bundle-memory'),
  'bundle-agent-switch': join(REPO, 'bundle-agent-switch'),
  'agent-memory': join(REPO, 'packages', 'agent-memory'),
  'agent-switch': join(REPO, 'packages', 'agent-switch'),
}
for (const [pkg, target] of Object.entries(pkgDirs)) {
  ensureSymlink(target, join(farm, pkg))
}

const dshRoot = process.env.DSH_HARNESS_ROOT ?? resolve(REPO, '../../github/deepseek-harness')
const scopeLink = join(REPO, 'node_modules', '@deepseek-ai')
const dshScope = join(dshRoot, 'node_modules', '.pnpm', 'node_modules', '@deepseek-ai')
if (!existsSync(dshScope)) {
  console.error(`DSH scope not found at ${dshScope}; set DSH_HARNESS_ROOT to the deepseek-harness checkout`)
  process.exit(1)
}
ensureSymlink(dshScope, scopeLink)

console.log(`integration profile installed: ${profileDir}`)
console.log(`integration packages linked: ${farm}`)
