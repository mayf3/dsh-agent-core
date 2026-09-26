// Private bridge implementation; index.js keeps the existing public export.
import { accessSync, constants, existsSync, lstatSync, mkdirSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureSymlink } from './ensure-symlink.js'

/** Repo root (three levels up from src/: packages/agent-provisioning/src). */
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

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
 * node_modules dir in writable development checkouts. Deployment owns an
 * immutable repository's topology: provisioning only validates existing
 * bridges there, and never creates/repairs one. Missing optional workspace
 * packages are not dependencies merely because they exist in the source tree.
 */
export function ensureRepoCoreBridge() {
  const bridgeDir = join(REPO, 'node_modules', '@agent-core')
  const writable = repoBridgeWritable(bridgeDir)
  if (writable) mkdirSync(bridgeDir, { recursive: true })
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
    const link = join(bridgeDir, pkg)
    if (writable) {
      ensureSymlink(target, link)
      continue
    }
    let stat
    try { stat = lstatSync(link) } catch (error) {
      if (error?.code === 'ENOENT') continue
      throw error
    }
    if (stat.isSymbolicLink()) {
      try { if (realpathSync(link) === realpathSync(target)) continue } catch (error) {
        if (!['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error?.code)) throw error
      }
    }
    throw Object.assign(new Error(
      `agent-provisioning: immutable repository bridge mismatch at ${link}; deployment must repair its topology`,
      { cause: undefined },
    ), { code: 'repo_bridge_mismatch' })
  }
}

/** Check the nearest existing directory, without trying a topology write. */
function repoBridgeWritable(bridgeDir) {
  let parent = bridgeDir
  for (;;) {
    try {
      accessSync(parent, constants.W_OK)
      return true
    } catch (error) {
      if (['EACCES', 'EPERM', 'EROFS'].includes(error?.code)) return false
      if (error?.code !== 'ENOENT' || parent === dirname(parent)) throw error
      parent = dirname(parent)
    }
  }
}


/** Link the selected home farm and create its workspace; repository links stay deployment-owned. */
export function provisionProfileWorkspaceLinks(home, workspace, farmLinks) {
  // Out-of-tree plugin resolution links for this profile's composition.
  const farm = join(home, 'profiles', 'node_modules')
  const agentCoreFarm = join(farm, '@agent-core')
  for (const [pkg, relTarget] of Object.entries(farmLinks)) {
    ensureSymlink(join(REPO, relTarget), join(agentCoreFarm, pkg))
  }

  // Credential boundary validation is CHILD-TIME (DEFAULT_MODEL_ROUTING_CONFIG_V1
  // prerequisite + AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V2
  // third-uid-denied): provisioning runs as the runtime identity (e.g. authsvc
  // uid505), which must never — and structurally cannot — touch the canonical
  // secret under the uid502 owner's 0700 home. The parent's job here is the
  // credentialFile REFERENCE written into the child profile patch above; the
  // child's dsh-codex store reader enforces the real invariants after the
  // privilege drop (assertOwnerOnly mode 0600 + strict document validation)
  // and fails loud before any model call. assertOAuthCredentialBoundary stays
  // exported (re-export below) for direct ops/unit use — never invoked here.
  mkdirSync(workspace, { recursive: true })
  return home
}
