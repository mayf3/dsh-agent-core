/**
 * @agent-core/agent-provisioning — per-agent DSH_HOME provisioning.
 *
 * PRODUCTION_RUNTIME_V1 extraction of the home-provisioning half of the old
 * `scripts/demo-home.mjs` (which stays as a thin backwards-compatible shim
 * for the demo/benchmark path): the Router / Control Plane spawns every
 * Agent through `dsh --profile <agentProfile>`, and THIS module is the
 * single place that makes such a spawn self-sufficient — no verification
 * driver or operator may be needed to pre-provision an agent home.
 *
 * Responsibilities (additive only, idempotent — running twice is a no-op):
 *
 *   <home>/
 *     settings.yaml          # copy of the operator's ~/.dsh/settings.yaml (pi-ai route)
 *     .credentials.yaml      # copy of ~/.dsh/.credentials.yaml (OPENCODE_GO_API_KEY)
 *     profiles/<profile>/{package.json,cordis.patch.yml}   # COPIES (the CLI
 *                             # rewrites cordis.yml in this dir on every boot, so
 *                             # sharing one symlinked dir across agents is unsafe)
 *     profiles/node_modules/@agent-core/...                # farm SYMLINKS into the repo
 *     workspace/             # created by the caller (workspace-bootstrap owns it)
 *
 * The profile table (`AGENT_PROFILE_DEFS`) is the SINGLE mapping from a
 * profile name to the repo profile dir + the out-of-tree plugin farm links
 * its composition needs. Production runtimes use `agent-core-production`
 * (packages/production-runtime passes it explicitly); the legacy demo /
 * integration profiles remain available for the demo and acceptance paths.
 *
 * The module is deliberately dependency-free (node builtins only) so the
 * Router can import it directly from the control plane composition.
 */

import {
  copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Repo root (three levels up from src/: packages/agent-provisioning/src). */
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/**
 * Resolve the deepseek-harness checkout (the `dsh` CLI the Router spawns
 * agents through). Env override first; then the sibling-of-repo default,
 * aware that a git WORKTREE root is one level deeper than the main checkout
 * (the harness stays a sibling of the MAIN repo, not of the worktree).
 */
export function resolveHarnessRoot() {
  if (process.env.DSH_HARNESS_ROOT) return process.env.DSH_HARNESS_ROOT
  const mainRepo = REPO.split('/.worktree/')[0] ?? REPO
  const candidates = [
    resolve(mainRepo, '../../github/deepseek-harness'),   // main-tree layout
    resolve(REPO, '../../github/deepseek-harness'),       // worktree layout (same repo, one level deeper)
  ]
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'apps', 'cli', 'lib', 'bin.js'))) return candidate
  }
  return candidates[0]
}

/** Backwards-compatible alias (demo-home called it dshRoot). */
export function dshRoot() {
  return resolveHarnessRoot()
}

/** The dsh CLI entry the agent processes boot through. */
export function cliBin() {
  const cli = join(resolveHarnessRoot(), 'apps/cli/lib/bin.js')
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
  'agent-core-production': {
    repoDir: 'profile-production',
    farmLinks: {
      'bundle-demo': 'bundle-demo',
      'owner-guard': 'packages/owner-guard',
      'demo-server': 'packages/demo-server',
      'bundle-memory': 'bundle-memory',
      'agent-memory': 'packages/agent-memory',
      'bundle-agent-switch': 'bundle-agent-switch',
      'agent-switch': 'packages/agent-switch',
      'workspace-bootstrap': 'packages/workspace-bootstrap',
      // Trusted credential broker: the child composition mounts the broker
      // in relay mode (capability tools -> parent-RPC -> control-plane
      // Broker gateway). The child holds no credential/token.
      'bundle-broker': 'bundle-broker',
      'broker': 'packages/broker',
    },
  },
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
      // Trusted credential broker: the child composition mounts the broker
      // in relay mode (capability tools -> parent-RPC -> control-plane
      // Broker gateway). The child holds no credential/token.
      'bundle-broker': 'bundle-broker',
      'broker': 'packages/broker',
    },
  },
}

/**
 * Dev-harness resolution bridge: symlink every @agent-core package into the
 * REPO's own `node_modules/@agent-core`, mirroring the existing @deepseek-ai
 * bridge (scripts/install-integration.mjs "dev resolution bridge").
 *
 * WHY: the per-home plugin farm (<home>/profiles/node_modules/@agent-core)
 * is symlinked INTO the repo, and Node's ESM resolver walks the REAL path of
 * the importing module. A package loaded through the farm therefore resolves
 * its transitive `@agent-core/*` imports from the REPO — which fails unless
 * the repo itself exposes the same names. The bridge closes exactly that gap
 * (empirically verified: without it the per-agent composition dies at boot
 * with ERR_MODULE_NOT_FOUND for '@agent-core/workspace-bootstrap' imported by
 * agent-memory). Idempotent, additive, only touches the gitignored
 * node_modules dir.
 */
export function ensureRepoCoreBridge() {
  const bridgeDir = join(REPO, 'node_modules', '@agent-core')
  mkdirSync(bridgeDir, { recursive: true })
  const candidates = []
  for (const name of readdirSync(join(REPO, 'packages'))) {
    if (existsSync(join(REPO, 'packages', name, 'package.json'))) {
      candidates.push([name, join(REPO, 'packages', name)])
    }
  }
  for (const name of readdirSync(REPO)) {
    if (name.startsWith('bundle-') && existsSync(join(REPO, name, 'package.json'))) {
      candidates.push([name, join(REPO, name)])
    }
  }
  for (const [pkg, target] of candidates) {
    ensureSymlink(target, join(bridgeDir, pkg))
  }
}

/**
 * Provision one agent home (idempotent). Returns the resolved home path.
 * The profile is REQUIRED and must be a known AGENT_PROFILE_DEFS entry — a
 * production spawn must never silently fall back to a default composition.
 * @param {string} home - absolute home directory (the agent's DSH_HOME).
 * @param {string} workspace - absolute working directory for the agent process.
 * @param {object} options - `{ profile }` — the per-agent profile to install;
 *   unknown profile names fail loud.
 * @returns {string} the resolved home path.
 */
export function provisionAgentHome(home, workspace, options = {}) {
  const profile = options.profile
  if (typeof profile !== 'string' || profile === '') {
    throw new TypeError('provisionAgentHome: options.profile is required (no default — the caller owns the composition choice)')
  }
  const def = AGENT_PROFILE_DEFS[profile]
  if (def === undefined) {
    throw new Error(`provisionAgentHome: unknown agent profile ${JSON.stringify(profile)} (known: ${Object.keys(AGENT_PROFILE_DEFS).join(', ')})`)
  }
  // Farm links point into the repo; the repo must expose @agent-core names
  // for transitive imports (see ensureRepoCoreBridge). Idempotent, gitignored.
  ensureRepoCoreBridge()
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
