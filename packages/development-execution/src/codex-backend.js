/**
 * @agent-core/development-execution — Codex backend adapter
 * (AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1 CTR-DES-003).
 *
 * The ONLY place where Codex specifics live: binary pinning, argv, session-id
 * capture from `--json` events, CODEX_HOME credential, resume-based continue,
 * and env scrubbing (no broker/agent-core secrets ever reach the backend).
 * The surface/engine depend solely on the generic adapter contract:
 *   verify() / start(task, worktree) / resume(sessionId, instruction, worktree)
 *
 * Real entry (verified on codex-cli 0.153.4):
 *   codex exec --json -C <worktree> -s workspace-write --skip-git-repo-check \
 *     -o <last-message-file> <task>
 *   codex exec resume <SESSION_ID> [--json ...] <instruction>
 * Sandbox is PINNED to workspace-write — the adapter never constructs
 * danger-full-access or any approval-bypass invocation.
 */

import { spawn, execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Load + validate the Operator-managed backend config. Fail loud when absent
 * or incomplete — an unpinned executor must never run.
 */
export function loadBackendConfig(file) {
  if (typeof file !== 'string' || file === '' || !existsSync(file)) {
    return { configured: false }
  }
  let document
  try {
    document = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`development-execution: malformed backend.json (${file}): ${error.message}`)
  }
  if (document?.backend !== 'codex') {
    throw new Error(`development-execution: unsupported backend ${JSON.stringify(document?.backend)} (only 'codex' ships in this revision)`)
  }
  for (const key of ['binaryPath', 'codeHome']) {
    if (typeof document[key] !== 'string' || document[key] === '') {
      throw new Error(`development-execution: backend.json missing ${key}`)
    }
  }
  return {
    configured: true,
    backend: 'codex',
    binaryPath: document.binaryPath,
    codeHome: document.codeHome,
    minVersion: typeof document.minVersion === 'string' ? document.minVersion : null,
    model: typeof document.model === 'string' && document.model !== '' ? document.model : null,
    timeoutMs: Number.isInteger(document.timeoutMs) && document.timeoutMs > 0 ? document.timeoutMs : 3_600_000,
  }
}

/**
 * Pinned-binary verification: the configured path must exist and report a
 * version >= minVersion. Refuses unconfigured/mismatched binaries (fail loud
 * before any task starts).
 */
export function verifyBackend(config, { execFile = (bin, args) => execFileSync(bin, args).toString() } = {}) {
  if (!config.configured) {
    return { ok: false, code: 'config_missing', detail: 'backend.json missing — executor refused' }
  }
  let version
  try {
    version = execFile(config.binaryPath, ['--version']).trim()
  } catch (error) {
    return { ok: false, code: 'backend_unavailable', detail: `pinned binary failed to run: ${error.message}` }
  }
  if (config.minVersion !== null) {
    const parse = (v) => v.replace(/^codex-cli\s*/, '').split('.').map((n) => Number.parseInt(n, 10) || 0)
    const [a1, b1, c1] = parse(version)
    const [a2, b2, c2] = parse(config.minVersion)
    const cmp = (x, y) => x - y
    const ordered = [a1, a2, b1, b2, c1, c2]
    if (cmp(a1, a2) < 0 || (a1 === a2 && cmp(b1, b2) < 0) || (a1 === a2 && b1 === b2 && cmp(c1, c2) < 0)) {
      return { ok: false, code: 'backend_version_refused', detail: `codex ${version} < required ${config.minVersion}` }
    }
  }
  return { ok: true, version }
}

/**
 * Scrubbed backend env: drop every broker/agent-core secret surface, then
 * pin CODEX_HOME to the Operator-provisioned credential home.
 */
export function backendEnv(config, env = process.env) {
  const scrubbed = {}
  for (const [key, value] of Object.entries(env)) {
    if (/^AGENT_CORE_|^BROKER_|^DSH_WORKFLOW_|^SCHEDULER_AUTH_/i.test(key)) continue
    scrubbed[key] = value
  }
  scrubbed.CODEX_HOME = config.codeHome
  return scrubbed
}

function codexArgs(config, { worktree, lastMessageFile, sandbox = 'workspace-write' }) {
  const argv = [
    'exec', '--json',
    // System-owned invocation: the executor's config is THIS adapter's pinned
    // contract, never the operator's interactive ~/.codex config.toml (which
    // may carry unsupported/interactive-only settings).
    '--ignore-user-config',
    '-C', worktree,
    '-s', sandbox, // PINNED: writes confined to the worktree (+ temp). Never danger-full-access.
    '--skip-git-repo-check',
    '-o', lastMessageFile,
  ]
  if (config.model !== null) argv.push('-m', config.model)
  return argv
}

/**
 * Run one non-interactive Codex execution in the worktree.
 * Returns { pid, done: Promise<{exitCode, signal, sessionId, lastMessage, stderrTail}> }.
 * `sessionId` is captured incrementally from --json events so `resume`
 * (continue) remains possible even after a later crash of the parent.
 */
export function runCodex(config, { instruction, worktree, executionDir, resumeSessionId = null }) {
  const lastMessageFile = join(executionDir, 'last-message.txt')
  const argv = [config.binaryPath, ...codexArgs(config, { worktree, lastMessageFile })]
  if (resumeSessionId !== null) argv.splice(2, 0, 'resume', resumeSessionId)
  argv.push(instruction)

  const child = spawn(argv[0], argv.slice(1), {
    cwd: worktree,
    env: backendEnv(config),
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const result = { pid: child.pid, sessionId: null, stderrTail: [], lastMessage: null }
  const done = new Promise((resolve) => {
    createInterface({ input: child.stdout }).on('line', (line) => {
      if (result.sessionId === null) {
        const match = line.match(/"(?:session_id|thread_id)"\s*:\s*"([^"]+)"/)
        if (match) result.sessionId = match[1]
      }
    })
    createInterface({ input: child.stderr }).on('line', (line) => {
      result.stderrTail.push(line)
      if (result.stderrTail.length > 40) result.stderrTail.shift()
    })
    child.on('error', (error) => resolve({ ...result, exitCode: null, signal: null, spawnError: error.message }))
    child.on('close', (exitCode, signal) => resolve({ ...result, exitCode, signal }))
  })
  return { pid: child.pid, done }
}
