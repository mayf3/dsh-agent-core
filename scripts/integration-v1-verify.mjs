#!/usr/bin/env node
/**
 * Integration V1 acceptance driver — real Feishu message end-to-end.
 *
 * Boots the control-plane DSH process (profile agent-core-integration:
 * feishu-connector + agent-router), waits for real ingress events, and asserts
 * the full chain: ingress -> route(agentId) -> per-agent process (created /
 * reused / respawned+resumed) -> model reply -> reply back to Feishu.
 *
 * Interactive phases (a human sends Feishu messages to the bot):
 *   1. first message  -> session created, reply sent, pid recorded
 *   2. second message -> SAME pid reused (no new agent/context)
 *   3. [driver kills the agent process]
 *   4. third message  -> process respawned, session RESUMED, reply sent
 *
 * Usage:
 *   node scripts/integration-v1-verify.mjs
 * Env:
 *   ROUTER_DEFAULT_AGENT   default agentId for first-contact binding (default 'agent-demo')
 *   ROUTER_DEFAULT_SESSION default sessionId for first-contact binding (default 'main')
 *   FEISHU_CREDS_PATH     feishu credentials file (default: derived via
 *                         scripts/setup-feishu-creds.mjs into ~/.dsh)
 *   DSH_AGENTS_HOME       per-agent home root (default ~/.dsh/agents)
 *   DSH_WORKSPACE_DIR     per-agent workspace root (default ~/.dsh/workspaces)
 *   INTEGRATION_LOG       router log file (default .demo/integration/router.log)
 */

import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cliBin } from './demo-home.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROFILE = 'agent-core-integration'
const LOG_FILE = process.env.INTEGRATION_LOG ?? join(REPO, '.demo', 'integration', 'router.log')
const PHASE_TIMEOUT_MS = Number.parseInt(process.env.INTEGRATION_PHASE_TIMEOUT ?? '600000', 10)

const DEFAULT_AGENT = process.env.ROUTER_DEFAULT_AGENT ?? 'agent-demo'
const DEFAULT_SESSION = process.env.ROUTER_DEFAULT_SESSION ?? 'main'

const sleep = (ms) => new Promise(resolveTimeout => setTimeout(resolveTimeout, ms))

// ------------------------------------------------------------ router process

function startRouter() {
  mkdirSync(dirname(LOG_FILE), { recursive: true })
  const env = {
    ...process.env,
    FEISHU_CREDS_PATH: process.env.FEISHU_CREDS_PATH ?? join(homedir(), '.dsh', 'feishu-creds.json'),
    ROUTER_DEFAULT_AGENT: DEFAULT_AGENT,
    ROUTER_DEFAULT_SESSION: DEFAULT_SESSION,
  }
  const child = spawn(process.execPath, [cliBin(), '--profile', PROFILE], {
    cwd: REPO,
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  const logStream = openLog()
  child.stderr.on('data', (chunk) => {
    logStream.write(chunk)
    process.stdout.write(chunk)
  })
  child.once('exit', (code, signal) => {
    logStream.end()
    console.error(`[verify] router exited ${code ?? signal} — check ${LOG_FILE}`)
  })
  return child
}

function openLog() {
  // Recreate the log file each run for clean evidence.
  rmSync(LOG_FILE, { force: true })
  mkdirSync(dirname(LOG_FILE), { recursive: true })
  return createWriteStream(LOG_FILE, { flags: 'a' })
}

/** Read the router log from byte offset; returns { text, nextOffset }. */
function readLog(fromOffset) {
  const text = existsSync(LOG_FILE) ? readFileSync(LOG_FILE, 'utf8') : ''
  return { text: text.slice(fromOffset), nextOffset: text.length }
}

// ------------------------------------------------------------------- asserts

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}

const checks = []
function record(name, ok, detail = '') {
  check(name, ok, detail)
  checks.push({ name, ok, detail })
}

/** Wait until the log contains every needle (in order is not required). */
async function waitForLog(needles, timeoutMs = PHASE_TIMEOUT_MS) {
  const started = Date.now()
  let offset = 0
  for (;;) {
    const { text } = readLog(offset)
    const missing = needles.filter(n => !text.includes(n))
    if (missing.length === 0) return text
    if (Date.now() - started > timeoutMs) {
      throw new Error(`timeout waiting for ${missing.join(', ')} — last log:\n${text.slice(-2000)}`)
    }
    await sleep(1000)
  }
}

// ----------------------------------------------------------------------- main

async function main() {
  console.log(`=== Integration V1 acceptance — router log: ${LOG_FILE}`)
  console.log(`default binding: ${DEFAULT_AGENT} + session ${DEFAULT_SESSION} (auto-bound on first contact, D-002)`)

  const router = startRouter()
  // NOTE: only stderr reaches the log file (stdout is ignored);
  // 'feishu-transport: connected' is a stdout log line and never appears here.
  await waitForLog(['feishu channel bound'])

  console.log('\n[phase 1] 请给飞书 bot 发第一条消息（私聊），等待回复…')
  let log = await waitForLog(['agent replied', 'reply sent back'])
  const created = /session (\S+) created/.test(log) || log.includes(`session ${DEFAULT_SESSION} created`)
  const p1 = log.match(/reuse process for (\S+) \(pid (\d+)\)|agent (\S+) ready pid=(\d+)/)
  const pid1 = p1?.[2] ?? p1?.[4]
  const replied1 = /agent \S+ \(pid (\d+)\) replied: (.*)/.exec(log)
  record('PHASE1_REPLY_RECEIVED', replied1 !== null, `reply="${replied1?.[2]?.slice(0, 60)}"`)
  record('PHASE1_SESSION_CREATED', created, 'first message creates the session')

  console.log('\n[phase 2] 请再发第二条消息，等待回复…（应复用同一 PID）')
  log = await waitForLog(['reuse process for'])
  const p2 = /reuse process for (\S+) \(pid (\d+)\)/.exec(log)
  record('PHASE2_PID_REUSED', p2 !== null && pid1 !== undefined && p2[2] === pid1,
    `pid ${pid1} reused for ${p2?.[1]}`)

  console.log(`\n[phase 3] driver kills the agent process (pid ${pid1})…`)
  if (pid1 !== undefined) {
    spawnSync('kill', ['-9', pid1])
    await sleep(1500)
  }

  console.log('\n[phase 4] 请再发第三条消息，等待回复…（进程应重建并 resume 会话）')
  log = await waitForLog(['resumed', 'agent replied', 'reply sent back'])
  const resumed = /session (\S+) resumed \(\d+ events\)/.test(log) || log.includes(`session ${DEFAULT_SESSION} resumed`)
  const p3 = /agent (\S+) ready pid=(\d+)/.exec(log)
  const newPid = p3?.[2]
  record('PHASE4_SESSION_RESUMED', resumed, 'session resumed from persistence after kill')
  record('PHASE4_NEW_PID', newPid !== undefined && newPid !== pid1, `pid ${newPid} (was ${pid1})`)
  record('PHASE4_REPLY_RECEIVED', /agent \S+ \(pid \d+\) replied:/.test(log), 'reply sent after resume')

  // ------------------------------------------------------------------ report
  const evidence = readFileSync(LOG_FILE, 'utf8')
  const report = [
    '# Integration V1 — real Feishu end-to-end acceptance',
    '',
    `Run: ${new Date().toISOString()}`,
    `Default binding: ${DEFAULT_AGENT} + session ${DEFAULT_SESSION} (D-002 channel model)`,
    '',
    '```',
    evidence.slice(-4000),
    '```',
    '',
    '## Checks',
    '',
    ...checks.map(c => `- ${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`),
    '',
  ].join('\n')
  const reportPath = join(REPO, '.demo', 'integration', 'integration-v1-evidence.md')
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, report)
  console.log(`\nevidence written: ${reportPath}`)

  const allPass = checks.every(c => c.ok)
  await new Promise(resolveTimeout => setTimeout(resolveTimeout, 500))
  spawnSync('kill', [String(router.pid)])
  process.exit(allPass ? 0 : 1)
}

main().catch((error) => {
  console.error(`\nINTEGRATION V1 FAILED: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
