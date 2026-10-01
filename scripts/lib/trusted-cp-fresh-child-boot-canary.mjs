#!/usr/bin/env node
// trusted-cp-fresh-child-boot-canary.mjs — FRESH_CHILD_BOOT_CANARY_V1
//
// Disposable fresh-child boot probe of an assembled trusted-cp candidate.
// This is the end-to-end acceptance proof for CLOSURE_RESOLUTION_GATE_V1:
// it spawns a REAL dsh child (the agent-core-production boot shape) from the
// candidate tree under the candidate's own node-runtime, in a THROWAWAY
// home — it never touches production state, credentials, or homes.
//
// Failure class it exists to catch (2026-10-02 availability rollback,
// Product #414): a closure whose loader cannot acquire its native
// internal-module binding falls back to raw import() from
// vendor/loader/lib/index.js, and the plugin tree dies with
//   Error: failed to import loader entry timer (@deepseek-ai/cordis-plugin-timer):
//     Cannot find package '@deepseek-ai/cordis-plugin-timer' imported from
//     .../harness/vendor/loader/lib/index.js
// for every entry — while already-running children keep working. The canary
// therefore classifies EVERY "Cannot find package 'X'" line: any X inside the
// closure's own resolution surfaces (@deepseek-ai/*, dsh/* workspace
// packages) is a FAILURE. Only explicitly allowlisted external plugins
// (default: dsh-codex, staged per-deployment-root by the shared-codex
// carrier, outside the harness closure) may fail.
//
// Usage:
//   node scripts/lib/trusted-cp-fresh-child-boot-canary.mjs \
//     --trusted-root <CANDIDATE_ROOT> [--profile agent-core-production] \
//     [--setup-profile agent-core-production|none] [--ready-regex <re>] \
//     [--timeout-ms 90000] [--allow-missing dsh-codex] [--json] [--keep-home]
// --setup-profile (default: agent-core-production) provisions the disposable
// home exactly like provisionAgentHome does for an agent-core child (profile
// copies + @agent-core farm links anchored at the candidate app); `none`
// skips provisioning.
//
// Exit: 0 = boot reached the ready marker with no disallowed resolution
// failure; 2 = failure (disallowed missing package, plugin-tree failure, or
// ready marker never reached). The verbatim missing-package lines are always
// printed, so a RED run records the exact cordis-plugin-timer failure.

import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const args = {
    trustedRoot: undefined,
    profile: 'agent-core-production',
    setupProfile: 'agent-core-production',
    readyRegex: '\\[demo-server\\] ready pid=',
    timeoutMs: 90000,
    allowMissing: ['dsh-codex'],
    json: false,
    keepHome: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--trusted-root') args.trustedRoot = argv[++i]
    else if (a === '--profile') args.profile = argv[++i]
    else if (a === '--ready-regex') args.readyRegex = argv[++i]
    else if (a === '--timeout-ms') args.timeoutMs = Number(argv[++i])
    else if (a === '--allow-missing') args.allowMissing.push(...argv[++i].split(','))
    else if (a === '--setup-profile') args.setupProfile = argv[++i]
    else if (a === '--json') args.json = true
    else if (a === '--keep-home') args.keepHome = true
    else {
      console.error(`unknown argument: ${a}`)
      process.exit(2)
    }
  }
  if (!args.trustedRoot) {
    console.error('usage: node trusted-cp-fresh-child-boot-canary.mjs --trusted-root <CANDIDATE_ROOT> [options]')
    process.exit(2)
  }
  args.trustedRoot = resolve(args.trustedRoot)
  args.allowMissing = [...new Set(args.allowMissing)]
  return args
}

const MISSING_RE = /Cannot find package '([^']+)' imported from ([^\s]+)/g
const PLUGIN_TREE_FAIL = 'plugin tree failed to load'

/**
 * Build the per-home profile structure provisionAgentHome() creates for an
 * agent-core child — profile file COPIES (the CLI rewrites cordis.yml inside
 * the profile dir on boot) plus the @agent-core farm SYMLINKS — but anchored
 * at the CANDIDATE tree instead of the repo, so the canary exercises exactly
 * what a freshly spawned production child would resolve. No subscription
 * plugin install (dsh-codex stays an allowlisted external miss), no
 * credentials, no workspace seeding: boot-only fidelity.
 */
async function setupProfileHome(home, profileName, trustedRoot, dshHome) {
  const { AGENT_PROFILE_DEFS } = await import(
    pathToFileURL(join(HERE, '../../packages/agent-provisioning/src/index.js')).href
  )
  const def = AGENT_PROFILE_DEFS[profileName]
  if (def === undefined) {
    throw new Error(`unknown profile ${JSON.stringify(profileName)} (known: ${Object.keys(AGENT_PROFILE_DEFS).join(', ')})`)
  }
  const appDir = join(trustedRoot, 'app')
  mkdirSync(dshHome, { recursive: true })
  // settings.yaml: same fallback contract as provisionAgentHome — copy the
  // DSH_SETTINGS_SOURCE when provided, else a minimal parseable file. Boot
  // never calls the model, so no real credential is needed or read.
  const settingsSource = process.env.DSH_SETTINGS_SOURCE
  const settingsPath = join(dshHome, 'settings.yaml')
  if (settingsSource && existsSync(settingsSource)) copyFileSync(settingsSource, settingsPath)
  else if (!existsSync(settingsPath)) writeFileSync(settingsPath, 'agent-default-model:\n  provider: canary-noop\n  model: canary-noop\n')
  const profileDir = join(dshHome, 'profiles', profileName)
  mkdirSync(profileDir, { recursive: true })
  for (const file of ['package.json', 'cordis.patch.yml']) {
    copyFileSync(join(appDir, def.repoDir, file), join(profileDir, file))
  }
  const farm = join(dshHome, 'profiles', 'node_modules')
  for (const [pkg, relTarget] of Object.entries(def.farmLinks)) {
    const link = join(farm, '@agent-core', pkg)
    mkdirSync(dirname(link), { recursive: true })
    symlinkSync(join(appDir, relTarget), link)
  }
  return profileDir
}

export async function runCanary(args, { spawnImpl = spawn, homeFactory = () => mkdtempSync(join(tmpdir(), 'dsh-boot-canary-')), delay = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const node = join(args.trustedRoot, 'node-runtime/bin/node')
  const bin = join(args.trustedRoot, 'harness/apps/cli/lib/bin.js')
  const appDir = join(args.trustedRoot, 'app')
  const home = homeFactory()
  const result = {
    canary: 'FRESH_CHILD_BOOT_CANARY_V1',
    trustedRoot: args.trustedRoot,
    profile: args.profile,
    home,
    ok: false,
    ready: false,
    pluginTreeFailed: false,
    missingPackages: [],
    disallowedMissing: [],
    tail: [],
  }

  const dshHome = join(home, '.dsh')
  if (args.setupProfile) {
    await setupProfileHome(home, args.setupProfile, args.trustedRoot, dshHome)
  }
  const child = spawnImpl(node, [bin, '--profile', args.profile], {
    cwd: appDir,
    env: {
      PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
      HOME: home,
      DSH_HOME: dshHome,
      TMPDIR: home,
      DSH_HARNESS_ROOT: join(args.trustedRoot, 'harness'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let buffered = ''
  child.stdout.on('data', (d) => { buffered += d })
  child.stderr.on('data', (d) => { buffered += d })
  let closed = false
  let spawnError = undefined
  const closedPromise = new Promise((r) => child.on('close', r))
  child.on('error', (e) => { spawnError = e; closed = true })
  child.on('close', () => { closed = true })

  const readyRe = new RegExp(args.readyRegex)
  const deadline = Date.now() + args.timeoutMs
  while (Date.now() < deadline && !closed) {
    await delay(250)
    for (const match of buffered.matchAll(MISSING_RE)) {
      const [, spec, origin] = match
      if (!result.missingPackages.some((m) => m.spec === spec && m.origin === origin)) {
        result.missingPackages.push({ spec, origin })
      }
    }
    if (buffered.includes(PLUGIN_TREE_FAIL)) result.pluginTreeFailed = true
    if (readyRe.test(buffered)) { result.ready = true; break }
  }
  child.kill('SIGKILL')
  await closedPromise

  result.tail = buffered.split('\n').filter(Boolean).slice(-40)
  if (spawnError) {
    result.spawnError = String(spawnError.message ?? spawnError)
    result.ok = false
    if (!args.keepHome) rmSync(home, { recursive: true, force: true })
    return result
  }
  result.disallowedMissing = result.missingPackages.filter(
    (m) => !args.allowMissing.some((a) => m.spec === a || m.spec.startsWith(`${a}/`)),
  )
  result.ok = result.ready && !result.pluginTreeFailed && result.disallowedMissing.length === 0
  if (!args.keepHome) rmSync(home, { recursive: true, force: true })
  return result
}

// ---- CLI (only when executed directly, not when imported by tests) --------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  const result = await runCanary(args)
  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    for (const m of result.missingPackages) {
      const tag = result.disallowedMissing.includes(m) ? 'DISALLOWED' : 'allowlisted'
      console.log(`MISSING[${tag}] ${m.spec} imported from ${m.origin}`)
    }
    console.log(`ready=${result.ready} pluginTreeFailed=${result.pluginTreeFailed} tailLines=${result.tail.length}`)
    console.log(result.ok ? 'FRESH_CHILD_BOOT_CANARY PASS' : 'FRESH_CHILD_BOOT_CANARY FAIL')
  }
  process.exit(result.ok ? 0 : 2)
}
