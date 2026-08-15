/**
 * Shared per-agent home provisioning for the process-model demo. One DSH
 * process per Agent runs with its own DSH_HOME; this module prepares that
 * home (additive only, idempotent):
 *
 *   <home>/
 *     settings.yaml          # copy of the user's ~/.dsh/settings.yaml (pi-ai route)
 *     .credentials.yaml      # copy of ~/.dsh/.credentials.yaml (OPENCODE_GO_API_KEY)
 *     profiles/agent-core-demo/{package.json,cordis.patch.yml}   # COPIES (the CLI
 *                             # rewrites cordis.yml in this dir on every boot, so
 *                             # sharing one symlinked dir across agents is unsafe)
 *     profiles/node_modules/@agent-core/{bundle-demo,owner-guard,demo-server}  # symlinks
 *     workspace/             # the agent's working directory
 */

import {
  copyFileSync, existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Repo root (two levels up from scripts/). */
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Resolve the deepseek-harness checkout (env override supported). */
export function dshRoot() {
  return process.env.DSH_HARNESS_ROOT ?? resolve(REPO, '../../github/deepseek-harness')
}

/** The dsh CLI entry the demo processes boot through. */
export function cliBin() {
  const cli = join(dshRoot(), 'apps/cli/lib/bin.js')
  if (!existsSync(cli)) {
    throw new Error(`dsh CLI not found at ${cli}; set DSH_HARNESS_ROOT to the deepseek-harness checkout`)
  }
  return cli
}

/** Create (or repair) one symlink; fails loud on a real file at the target. */
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

/** Copy a file when the source exists; never overwrite an existing target. */
function copyOnce(source, target) {
  if (!existsSync(source)) return false
  if (existsSync(target)) return true
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(source, target)
  return true
}

const MINIMAL_SETTINGS = [
  'llm-pi-ai:',
  '  providers:',
  '    opencode-go:',
  '      apiKeyEnv: OPENCODE_GO_API_KEY',
  'agent-default-model:',
  '  provider: opencode-go',
  '  model: deepseek-v4-flash',
  '',
].join('\n')

/**
 * Per-agent profile definitions: profile name → repo profile dir + the
 * out-of-tree plugin farm links the profile's composition needs.
 *
 * The Router / Control Plane spawns every Agent through `dsh --profile
 * <agentProfile>`; this table is the SINGLE place that maps a profile name
 * to what must be installed into the Agent's DSH_HOME so that spawn is
 * self-sufficient (no verification-driver pre-provisioning allowed).
 *
 * - profile files are COPIES (the CLI rewrites cordis.yml inside the profile
 *   dir on every boot, so sharing one symlinked dir across agents is unsafe);
 * - farm links are SYMLINKS into the repo (additive, idempotent).
 */
export const AGENT_PROFILE_DEFS = {
  'agent-core-demo': {
    repoDir: 'profile-demo',
    farmLinks: {
      'bundle-demo': 'bundle-demo',
      'owner-guard': 'packages/owner-guard',
      'demo-server': 'packages/demo-server',
    },
  },
  'agent-core-integration-agent': {
    repoDir: 'profile-integration-agent',
    farmLinks: {
      'bundle-demo': 'bundle-demo',
      'owner-guard': 'packages/owner-guard',
      'demo-server': 'packages/demo-server',
      'bundle-memory': 'bundle-memory',
      'agent-memory': 'packages/agent-memory',
      'bundle-agent-switch': 'bundle-agent-switch',
      'agent-switch': 'packages/agent-switch',
      'workspace-bootstrap': 'packages/workspace-bootstrap',
    },
  },
}

/** Default per-agent profile (backwards compatible with all existing callers). */
export const DEFAULT_AGENT_PROFILE = 'agent-core-demo'

/**
 * Provision one agent home (idempotent). Returns the resolved home path.
 * @param home - absolute home directory (the agent's DSH_HOME).
 * @param workspace - absolute working directory for the agent process.
 * @param options - `{ profile }` — the per-agent profile to install
 *   (default 'agent-core-demo'); unknown profile names fail loud.
 */
export function provisionAgentHome(home, workspace, options = {}) {
  const profile = options.profile ?? DEFAULT_AGENT_PROFILE
  const def = AGENT_PROFILE_DEFS[profile]
  if (def === undefined) {
    throw new Error(`provisionAgentHome: unknown agent profile ${JSON.stringify(profile)} (known: ${Object.keys(AGENT_PROFILE_DEFS).join(', ')})`)
  }
  const settingsSource = process.env.DSH_SETTINGS_SOURCE ?? join(homedir(), '.dsh', 'settings.yaml')
  if (!copyOnce(settingsSource, join(home, 'settings.yaml'))) {
    mkdirSync(home, { recursive: true })
    if (!existsSync(join(home, 'settings.yaml'))) writeFileSync(join(home, 'settings.yaml'), MINIMAL_SETTINGS)
  }
  copyOnce(join(homedir(), '.dsh', '.credentials.yaml'), join(home, '.credentials.yaml'))

  // The agent profile (copies — the CLI rewrites cordis.yml inside it).
  const profileDir = join(home, 'profiles', profile)
  mkdirSync(profileDir, { recursive: true })
  for (const file of ['package.json', 'cordis.patch.yml']) {
    if (existsSync(join(profileDir, file))) continue
    copyFileSync(join(REPO, def.repoDir, file), join(profileDir, file))
  }

  // Out-of-tree plugin resolution links for this profile's composition.
  const farm = join(home, 'profiles', 'node_modules')
  const agentCoreFarm = join(farm, '@agent-core')
  for (const [pkg, relTarget] of Object.entries(def.farmLinks)) {
    ensureSymlink(join(REPO, relTarget), join(agentCoreFarm, pkg))
  }

  mkdirSync(workspace, { recursive: true })
  return home
}
