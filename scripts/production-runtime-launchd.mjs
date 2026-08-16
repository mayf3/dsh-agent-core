#!/usr/bin/env node
/**
 * production-runtime-launchd — the macOS supervision unit for the Agent Core
 * Production Runtime (PRODUCTION_RUNTIME_V1, Task 4).
 *
 * REUSES launchd (the platform supervisor) — no container platform, no
 * Kubernetes, no VM manager, no supervisor framework, no custom watchdog.
 * The generated LaunchAgent follows the exact posture this machine already
 * runs for OpenClaw (ai.openclaw.gateway et al., per
 * docs/investigations/stock-agent-registry-adoption-v1.md):
 *
 *   machine boot / login  -> RunAtLoad starts the runtime
 *   runtime crash         -> KeepAlive restarts it (ThrottleInterval 10s)
 *   graceful stop         -> SIGTERM (the entry's handler) then relaunch
 *
 * The runtime itself owns NOTHING about supervision; this script only
 * renders + installs one plist:
 *
 *   Label                ai.agent-core.runtime
 *   ProgramArguments     node <repo>/scripts/production-runtime.mjs --root <root>
 *   WorkingDirectory     <repo>
 *   EnvironmentVariables DSH_HARNESS_ROOT (resolved), PATH, HOME + every
 *                        pass-through seam env present at install time
 *                        (FEISHU_CREDS_PATH, DSH_AGENT_PROVIDER/MODEL,
 *                        AGENT_CORE_CREDENTIALS_FILE, BROKER_AUTH_ORIGIN,
 *                        DSH_AGENT_CHILD_UID/GID, DSH_AGENT_SPAWN_HELPER —
 *                        the TRUSTED_CP seam: hardening lands by setting env
 *                        here, not by changing runtime code)
 *   Standard{Out,Error}  <root>/logs/runtime{,.err}.log
 *
 * Usage:
 *   node scripts/production-runtime-launchd.mjs --print            # render plist
 *   node scripts/production-runtime-launchd.mjs --install          # write + bootstrap
 *   node scripts/production-runtime-launchd.mjs --status           # launchctl state
 *   node scripts/production-runtime-launchd.mjs --uninstall        # bootout + remove
 *
 * Options:
 *   --root <dir>      production persistent root (default ~/.agent-core)
 *   --label <id>      launchd label (default ai.agent-core.runtime)
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RUNTIME_SCRIPT = join(REPO, 'scripts', 'production-runtime.mjs')

/** Env vars forwarded from the installing shell into the plist when set. */
const PASS_THROUGH_ENV = [
  'FEISHU_CREDS_PATH',
  'DSH_AGENT_PROVIDER',
  'DSH_AGENT_MODEL',
  'AGENT_CORE_CREDENTIALS_FILE',
  'BROKER_AUTH_ORIGIN',
  'DSH_AGENT_CHILD_UID',
  'DSH_AGENT_CHILD_GID',
  'DSH_AGENT_SPAWN_HELPER',
]

function argValue(args, name, fallback) {
  const idx = args.indexOf(name)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}

/** Resolve the DSH harness the spawned agents boot through (baked absolute). */
function harnessRoot() {
  if (process.env.DSH_HARNESS_ROOT) return process.env.DSH_HARNESS_ROOT
  const mainRepo = REPO.split('/.worktree/')[0] ?? REPO
  const candidates = [
    resolve(mainRepo, '../../github/deepseek-harness'),
    resolve(REPO, '../../github/deepseek-harness'),
  ]
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'apps', 'cli', 'lib', 'bin.js'))) return candidate
  }
  return candidates[0]
}

function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Render the LaunchAgent plist. */
export function renderPlist({ root, label, nodeBin, harness }) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    `  <key>Label</key><string>${xmlEscape(label)}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    `    <string>${xmlEscape(nodeBin)}</string>`,
    `    <string>${xmlEscape(RUNTIME_SCRIPT)}</string>`,
    '    <string>--root</string>',
    `    <string>${xmlEscape(root)}</string>`,
    '  </array>',
    `  <key>WorkingDirectory</key><string>${xmlEscape(REPO)}</string>`,
    '  <key>EnvironmentVariables</key>',
    '  <dict>',
    `    <key>DSH_HARNESS_ROOT</key><string>${xmlEscape(harness)}</string>`,
    `    <key>HOME</key><string>${xmlEscape(homedir())}</string>`,
    '    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>',
  ]
  for (const name of PASS_THROUGH_ENV) {
    if (process.env[name] !== undefined && process.env[name] !== '') {
      lines.push(`    <key>${name}</key><string>${xmlEscape(process.env[name])}</string>`)
    }
  }
  lines.push(
    '  </dict>',
    '  <key>RunAtLoad</key><true/>',
    '  <key>KeepAlive</key><true/>',
    '  <key>ThrottleInterval</key><integer>10</integer>',
    `  <key>StandardOutPath</key><string>${xmlEscape(join(root, 'logs', 'runtime.log'))}</string>`,
    `  <key>StandardErrorPath</key><string>${xmlEscape(join(root, 'logs', 'runtime.err.log'))}</string>`,
    '</dict>',
    '</plist>',
    '',
  )
  return lines.join('\n')
}

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8' }).trim()
}

function main() {
  const argv = process.argv.slice(2)
  const action = argv.find((a) => ['--print', '--install', '--uninstall', '--status'].includes(a)) ?? '--print'
  const root = resolve(argValue(argv, '--root', join(homedir(), '.agent-core')))
  const label = argValue(argv, '--label', 'ai.agent-core.runtime')
  const plistPath = join(homedir(), 'Library', 'LaunchAgents', `${label}.plist`)
  const uid = sh('id', ['-u'])
  const guiTarget = `gui/${uid}/${label}`

  if (root.split('/').includes('.demo')) {
    console.error(`refusing .demo root ${root} — the supervised runtime must use a production root`)
    process.exit(2)
  }

  if (action === '--print') {
    process.stdout.write(renderPlist({ root, label, nodeBin: process.execPath, harness: harnessRoot() }))
    return
  }

  if (action === '--status') {
    try {
      const out = sh('launchctl', ['print', guiTarget])
      process.stdout.write(`${out}\n`)
    } catch (error) {
      console.error(`not loaded (${error.message.split('\n')[0]}); run --install first`)
      process.exit(1)
    }
    return
  }

  if (action === '--install') {
    const plist = renderPlist({ root, label, nodeBin: process.execPath, harness: harnessRoot() })
    mkdirSync(join(root, 'logs'), { recursive: true })
    mkdirSync(dirname(plistPath), { recursive: true })
    if (existsSync(plistPath)) {
      try { sh('launchctl', ['bootout', `gui/${uid}`, plistPath]) } catch { /* not loaded */ }
    }
    writeFileSync(plistPath, plist, 'utf8')
    // Modern bootstrap; fall back to the legacy load verb.
    try {
      sh('launchctl', ['bootstrap', `gui/${uid}`, plistPath])
    } catch {
      sh('launchctl', ['load', '-w', plistPath])
    }
    console.log(`installed ${label}`)
    console.log(`  plist: ${plistPath}`)
    console.log(`  root:  ${root}`)
    console.log(`  logs:  ${join(root, 'logs')}`)
    try {
      const state = sh('launchctl', ['print', guiTarget])
      const pidLine = state.split('\n').find((l) => l.trim().startsWith('pid ='))
      const runLine = state.split('\n').find((l) => l.trim().startsWith('state ='))
      console.log(`  ${runLine?.trim() ?? ''} ${pidLine?.trim() ?? '(starting)'}`)
    } catch { /* best effort */ }
    return
  }

  if (action === '--uninstall') {
    try { sh('launchctl', ['bootout', `gui/${uid}`, plistPath]) } catch { /* try legacy */ try { sh('launchctl', ['unload', '-w', plistPath]) } catch { /* not loaded */ } }
    if (existsSync(plistPath)) rmSync(plistPath)
    console.log(`uninstalled ${label} (plist removed; persistent state under ${root} kept)`)
    return
  }
}

// Only act when invoked directly (the acceptance driver imports renderPlist).
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main()
}
