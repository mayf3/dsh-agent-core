#!/usr/bin/env node
/**
 * production-runtime-launchd — the macOS supervision unit for the Agent Core
 * Production Runtime (PRODUCTION_RUNTIME_V1, Task 4).
 *
 * REUSES launchd (the platform supervisor) — no container platform, no
 * Kubernetes, no VM manager, no supervisor framework, no custom watchdog.
 * The generated LaunchAgent follows the exact posture this machine already
 * runs for OpenClaw (ai.openclaw.gateway et al.):
 *
 *   machine boot / login  -> RunAtLoad starts the runtime
 *   runtime crash         -> KeepAlive restarts it (ThrottleInterval 10s)
 *   graceful stop         -> SIGTERM (the entry's handler) then relaunch
 *
 * The runtime itself owns NOTHING about supervision; this script only
 * renders + installs one plist:
 *
 *   Label                ai.agent-core.runtime
 *   ProgramArguments     node <exec-target>/scripts-or-app/...production-runtime.mjs --root <root>
 *   WorkingDirectory     <app-closure>
 *   EnvironmentVariables DSH_HARNESS_ROOT (resolved), PATH, HOME + every
 *                        pass-through seam env present at install time
 *                        (FEISHU_CREDS_PATH, FEISHU_REQUIRE_MENTION_IN_GROUP,
 *                        FEISHU_AUTO_MENTION_TRIGGER_SENDER,
 *                        DSH_AGENT_PROVIDER/MODEL,
 *                        AGENT_CORE_CREDENTIALS_FILE, BROKER_AUTH_ORIGIN,
 *                        DSH_AGENT_CHILD_UID/GID, DSH_AGENT_SPAWN_HELPER —
 *                        the TRUSTED_CP seam: hardening lands by setting env
 *                        here, not by changing runtime code — and
 *                        DSH_AGENTS_HOME: the DeepSeek Harness skill-
 *                        filesystem resolves its shared user skill root as
 *                        config.agentsHome ?? $DSH_AGENTS_HOME ?? ~/.agents,
 *                        so the deploying lifecycle sets it to the canonical
 *                        shared skills home at install time; per-agent DSH
 *                        homes are unaffected because the runtime passes the
 *                        configured agentsHome to workspace-bootstrap, whose
 *                        configured root outranks this env var)
 *   Standard{Out,Error}  <root>/logs/runtime{,.err}.log
 *
 * TARGET SELECTION (PRODUCTION_INTEGRATION_V1, Task 2): the production
 * supervision unit MUST NOT boot 505 pre-drop code from the dev repo /
 * feature worktree or the Homebrew /usr/local/bin/node. Two modes:
 *
 *   mode=dev  (default)  node = process.execPath; runtime = <repo>/scripts
 *                        (development/render-only; NOT the production unit)
 *   mode=trusted         node = <trusted>/node-runtime/bin/node  (trusted Node)
 *                        runtime + WorkingDirectory = <trusted>/app
 *                        (the uid-502-writable-safe closure installed by
 *                         trusted-cp-deploy-install.sh)
 *
 * Trusted mode is selected by --trusted or by PRODUCTION_RUNTIME_TRUSTED_ROOT
 * (default /usr/local/libexec/agent-core). The launchd production unit MUST be
 * installed in trusted mode so launchd -> trusted Node -> /usr/local/libexec/
 * agent-core app closure -> uid 505 control plane.
 *
 * Usage:
 *   node scripts/production-runtime-launchd.mjs --print            # render plist
 *   node scripts/production-runtime-launchd.mjs --print --trusted  # trusted-target plist
 *   node scripts/production-runtime-launchd.mjs --install [--trusted]
 *   node scripts/production-runtime-launchd.mjs --status
 *   node scripts/production-runtime-launchd.mjs --uninstall
 *
 * Options:
 *   --root <dir>      production persistent root (default ~/.agent-core)
 *   --label <id>      launchd label (default ai.agent-core.runtime)
 *   --trusted         render/install the production unit against the TRUSTED
 *                     install closure (required for the supervised runtime)
 *   --trusted-root    trusted install root (default /usr/local/libexec/agent-core)
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RUNTIME_SCRIPT = join(REPO, 'scripts', 'production-runtime.mjs')

/** Default trusted install root (matches trusted-cp-deploy-install.sh). */
const DEFAULT_TRUSTED_ROOT = '/usr/local/libexec/agent-core'

/** Env vars forwarded from the installing shell into the plist when set. */
const PASS_THROUGH_ENV = [
  'FEISHU_CREDS_PATH',
  'FEISHU_REQUIRE_MENTION_IN_GROUP',
  'FEISHU_AUTO_MENTION_TRIGGER_SENDER',
  // PROCESSING_REACTION pass-through: forwarded into the plist only when set
  // at install time (production target FEISHU_PROCESSING_REACTION_ENABLED=
  // true is frozen for DEPLOY time; NOT deployed this round).
  'FEISHU_PROCESSING_REACTION_ENABLED',
  // REPLY_RENDER_MODE pass-through: forwarded into the plist only when set
  // at install time (production target FEISHU_REPLY_RENDER_MODE=card is
  // frozen for DEPLOY time; NOT deployed this round).
  'FEISHU_REPLY_RENDER_MODE',
  'DSH_AGENT_PROVIDER',
  'DSH_AGENT_MODEL',
  'AGENT_CORE_CREDENTIALS_FILE',
  'BROKER_AUTH_ORIGIN',
  'DSH_AGENT_CHILD_UID',
  'DSH_AGENT_CHILD_GID',
  'DSH_AGENT_SPAWN_HELPER',
  // Shared skill root for the DeepSeek Harness skill-filesystem
  // (config.agentsHome ?? $DSH_AGENTS_HOME ?? ~/.agents). Forwarded only when
  // set at install time — the deploying lifecycle owns the canonical value;
  // nothing is hardcoded here. Per-agent DSH-home resolution is unaffected:
  // the runtime gives workspace-bootstrap a configured agentsHome, which
  // outranks this env var.
  'DSH_AGENTS_HOME',
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

/** Render the LaunchAgent plist.
 *  @param {object} p - { root, label, nodeBin, harness, runtimeScript,
 *    workingDir }. All default to the dev-target; main() passes the trusted
 *    target when --trusted. */
export function renderPlist({ root, label, nodeBin, harness, runtimeScript = RUNTIME_SCRIPT, workingDir = REPO }) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    `  <key>Label</key><string>${xmlEscape(label)}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    `    <string>${xmlEscape(nodeBin)}</string>`,
    `    <string>${xmlEscape(runtimeScript)}</string>`,
    '    <string>--root</string>',
    `    <string>${xmlEscape(root)}</string>`,
    '  </array>',
    `  <key>WorkingDirectory</key><string>${xmlEscape(workingDir)}</string>`,
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

/**
 * Resolve the launchd execution target.
 *
 * mode=trusted (--trusted / PRODUCTION_RUNTIME_TRUSTED_ROOT): the production
 * supervision unit points at the TRUSTED install — trusted Node interpreter +
 * trusted app closure (runtime script + working dir) — so launchd boots the
 * uid-505 control plane from /usr/local/libexec/agent-core, never from the
 * dev repo / feature worktree and never via /usr/local/bin/node.
 *
 * mode=dev (default): the historical dev/render-only target (repo + cwd node).
 */
export function executionTarget(argv) {
  const trusted = argv.includes('--trusted') || Boolean(process.env.PRODUCTION_RUNTIME_TRUSTED_ROOT)
  if (!trusted) {
    return { trusted: false, nodeBin: process.execPath, runtimeScript: RUNTIME_SCRIPT, workingDir: REPO, harness: harnessRoot() }
  }
  const trustedRoot = resolve(argValue(argv, '--trusted-root', process.env.PRODUCTION_RUNTIME_TRUSTED_ROOT ?? DEFAULT_TRUSTED_ROOT))
  const nodeBin = join(trustedRoot, 'node-runtime', 'bin', 'node')
  const appDir = join(trustedRoot, 'app')
  const runtimeScript = join(appDir, 'scripts', 'production-runtime.mjs')
  const harness = join(trustedRoot, 'harness')
  for (const [name, p] of [['trusted node', nodeBin], ['runtime script', runtimeScript], ['trusted harness', harness]]) {
    if (!existsSync(p)) {
      console.error(`--trusted target missing ${name}: ${p} — run sudo scripts/trusted-cp-deploy-install.sh first`)
      process.exit(2)
    }
  }
  return { trusted: true, nodeBin, runtimeScript, workingDir: appDir, harness }
}

function main() {
  const argv = process.argv.slice(2)
  const action = argv.find((a) => ['--print', '--install', '--uninstall', '--status'].includes(a)) ?? '--print'
  const root = resolve(argValue(argv, '--root', join(homedir(), '.agent-core')))
  const label = argValue(argv, '--label', 'ai.agent-core.runtime')
  const target = executionTarget(argv)
  const plistPath = join(homedir(), 'Library', 'LaunchAgents', `${label}.plist`)
  const uid = sh('id', ['-u'])
  const guiTarget = `gui/${uid}/${label}`

  if (root.split('/').includes('.demo')) {
    console.error(`refusing .demo root ${root} — the supervised runtime must use a production root`)
    process.exit(2)
  }

  if (action === '--print') {
    process.stdout.write(renderPlist({ root, label, nodeBin: target.nodeBin, harness: target.harness, runtimeScript: target.runtimeScript, workingDir: target.workingDir }))
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
    const plist = renderPlist({ root, label, nodeBin: target.nodeBin, harness: target.harness, runtimeScript: target.runtimeScript, workingDir: target.workingDir })
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
    console.log(`installed ${label}${target.trusted ? ' (trusted target)' : ' (dev target — NOT the production unit)'}`)
    console.log(`  plist: ${plistPath}`)
    console.log(`  root:  ${root}`)
    console.log(`  node:  ${target.nodeBin}`)
    console.log(`  runtime: ${target.runtimeScript}`)
    console.log(`  logs:  ${join(root, 'logs')}`)
    if (!target.trusted) {
      console.warn('WARN: dev-target unit — use --trusted for the production supervision unit')
    }
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
