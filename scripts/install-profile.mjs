#!/usr/bin/env node
/**
 * Install the agent-core profile into the Harness home (additive only).
 *
 * Writes exactly three symlinks into the Harness home and touches nothing
 * else: the profile's manifest and patch file into `$DSH_HOME/profiles/agent-core/`,
 * and the three @agent-core packages into the flat `$DSH_HOME/profiles/node_modules`
 * fallback that bare plugin specifiers resolve through (the same mechanism
 * dsh-app-boot's healProfilesModuleFallback maintains for installation
 * packages — it only ever adds symlinks, so these survive).
 *
 * Default home is `~/.dsh`; override with DSH_HOME.
 */

import { existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')

/** Create (or repair) one symlink. Fails loud on a real file at the target. */
function ensureSymlink(target, link) {
  mkdirSync(dirname(link), { recursive: true })
  try {
    const stat = lstatSync(link)
    if (stat.isSymbolicLink() && resolve(readlinkSync(link)) === resolve(target)) return
    rmSync(link, { recursive: true, force: true })
  } catch (error) {
    // lstatSync on a dangling link throws ENOENT for the link itself; only
    // rethrow when the entry exists but is not a removable symlink.
    if (error?.code !== 'ENOENT') throw error
  }
  symlinkSync(target, link)
}

const profileDir = join(HOME, 'profiles', 'agent-core')
mkdirSync(profileDir, { recursive: true })
for (const file of ['package.json', 'cordis.patch.yml']) {
  ensureSymlink(join(REPO, 'profile', file), join(profileDir, file))
}

const farm = join(HOME, 'profiles', 'node_modules', '@agent-core')
// The bundle package lives at the repo root; the plugin packages under packages/.
const pkgDirs = {
  bundle: join(REPO, 'bundle'),
  router: join(REPO, 'packages', 'router'),
  broker: join(REPO, 'packages', 'broker'),
}
for (const [pkg, target] of Object.entries(pkgDirs)) {
  ensureSymlink(target, join(farm, pkg))
}

// Dev-only resolution bridge: the plugin sources import @deepseek-ai/dsh-*
// by name, and ESM resolves those imports from the importing file's real
// location (our repo), not from the profile config directory. Linking the
// whole @deepseek-ai scope from the DSH checkout's pnpm virtual-store root
// (which holds every workspace package) gives the plugins their peer
// dependencies during development; a real install would ship them in the
// profile's package.json dependencies instead.
const dshRoot = process.env.DSH_HARNESS_ROOT ?? resolve(REPO, '../../github/deepseek-harness')
const scopeLink = join(REPO, 'node_modules', '@deepseek-ai')
const dshScope = join(dshRoot, 'node_modules', '.pnpm', 'node_modules', '@deepseek-ai')
if (!existsSync(dshScope)) {
  console.error(`DSH scope not found at ${dshScope}; set DSH_HARNESS_ROOT to the deepseek-harness checkout`)
  process.exit(1)
}
ensureSymlink(dshScope, scopeLink)

console.log(`agent-core profile installed: ${profileDir}`)
console.log(`agent-core packages linked: ${farm}`)
console.log(`dev resolution bridge: ${scopeLink} -> ${dshScope}`)
