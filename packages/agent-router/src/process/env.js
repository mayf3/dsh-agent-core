/**
 * @agent-core/agent-router/src/process/env.js — child spawn environment
 * policy of the per-agent DSH process client
 * (AGENT_PROCESS_LIFECYCLE_HARDENING_V2; TMPDIR fix + proxy redaction +
 * credential boundary bytes preserved).
 *
 * Zero DSH imports: only node builtins.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const RECOGNIZED_PROXY_ENV_KEYS = Object.freeze([
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'ALL_PROXY',
  'all_proxy',
  'NODE_USE_ENV_PROXY',
])

/**
 * Spawn configuration for the per-agent DSH child under the TRUSTED
 * credential broker model: the trusted Router parent (deployment uid
 * authsvc/505) runs every Agent child at the NORMAL Agent runtime uid/gid
 * (default 502 — NOT a per-agent OS user).
 *
 * - DSH_AGENT_CHILD_UID / DSH_AGENT_CHILD_GID: target uid/gid. Absent =>
 *   the child inherits the parent's identity (legacy behavior).
 * - DSH_AGENT_SPAWN_HELPER (optional): ABSOLUTE path of a privileged spawn
 *   helper (`<helper> <uid> <gid> <node> <program> <args...>` that
 *   setuids and execs the child, stdio inherited). Required when the parent
 *   cannot setuid directly: only root (or the same uid) can setuid, so a
 *   505 parent needs a one-time-root-bootstrapped setuid helper. When the
 *   helper is absent AND the requested uid differs from the parent's and
 *   the parent is not root, the spawn FAILS LOUD — a child must never
 *   silently run with more privilege than configured.
 *
 * @returns {{ argv: string[], spawnUid?: number, spawnGid?: number }}
 */
export function childSpawnConfig(log = console) {
  const uidRaw = process.env.DSH_AGENT_CHILD_UID
  if (uidRaw === undefined || uidRaw === '') return { argv: [process.execPath] }
  const uid = Number.parseInt(uidRaw, 10)
  // The child gid defaults to the PARENT's effective gid (the runtime user's
  // primary group) — never to the numeric uid, which is usually not a group
  // the process may setgid to (macOS: EPERM).
  const gidRaw = process.env.DSH_AGENT_CHILD_GID
  const gid = gidRaw === undefined || gidRaw === ''
    ? (typeof process.getgid === 'function' ? process.getgid() : uid)
    : Number.parseInt(gidRaw, 10)
  if (!Number.isInteger(uid) || uid < 0 || !Number.isInteger(gid) || gid < 0) {
    throw new Error(`agent-router: invalid DSH_AGENT_CHILD_UID/GID (uid=${uidRaw}, gid=${process.env.DSH_AGENT_CHILD_GID})`)
  }
  const helper = process.env.DSH_AGENT_SPAWN_HELPER
  if (typeof helper === 'string' && helper !== '') {
    log.log?.(`[router] spawn helper ${helper} -> child uid ${uid} gid ${gid}`)
    // <helper> <uid> <gid> <program> <args...> — stdio is inherited through
    // the helper's exec so the JSON-RPC pipes connect straight to the child.
    return { argv: [helper, String(uid), String(gid), process.execPath] }
  }
  log.log?.(`[router] spawn child with uid ${uid} gid ${gid} (direct setuid; requires root or same uid)`)
  return { argv: [process.execPath], spawnUid: uid, spawnGid: gid }
}

/**
 * Fixed TMPDIR every Agent child receives, regardless of what the Router
 * parent's environment carries. Production evidence: the launchd Runtime
 * (uid authsvc/505) gets a per-user TMPDIR (/var/folders/.../T, mode 0700,
 * owner authsvc); the Agent child runs at uid 502 via the spawn helper and
 * cannot even traverse that directory, so @deepseek-ai/dsh-spill-local's
 * mkdtempSync(join(tmpdir(), 'dsh-spill-')) fails EACCES => plugin tree
 * load failure => provider never registers => deliver hangs. The system
 * sticky temp root is the one directory every local uid may create in;
 * mkdtemp still yields a randomly-named 0700 child-uid-owned subdirectory,
 * so the child's temp content stays private. /private/tmp is the canonical
 * macOS spelling of the sticky root (what /tmp symlinks to), avoiding the
 * symlink hop; non-darwin hosts get their equivalent fixed root.
 */
export const AGENT_CHILD_TMPDIR = process.platform === 'darwin' ? '/private/tmp' : '/tmp'

/** Base environment for one agent process (its own home, workspace as cwd). */
export function agentEnv(home, extra = {}, omit = [], providerEnv = {}) {
  const env = {
    ...process.env,
    DSH_HOME: home,
    DSH_TELEMETRY_DISABLED: '1',
    DSH_PERMISSION_MODE: 'danger-full-access',
    ...extra,
  }
  // Defense in depth at every spawn: inherited, lowercase-precedence and
  // caller-extra proxy variables are all removed before the validated target
  // providerEnv is injected. A non-target receives an empty providerEnv and
  // therefore has no recognized proxy variable at all.
  for (const name of RECOGNIZED_PROXY_ENV_KEYS) delete env[name]
  Object.assign(env, providerEnv)
  if (env.OPENCODE_GO_API_KEY === undefined) {
    const credentialFile = join(home, '.credentials.yaml')
    if (existsSync(credentialFile)) {
      const match = readFileSync(credentialFile, 'utf8').match(/^OPENCODE_GO_API_KEY:\s*"?([^"\n]+)"?/m)
      if (match !== null) env.OPENCODE_GO_API_KEY = match[1]
    }
  }
  for (const name of omit) delete env[name]
  // Written LAST, after extra/providerEnv/omit: the child's TMPDIR is a
  // fixed runtime property of the uid-502 Agent identity, not configuration.
  // The parent's private 0700 TMPDIR must never cross the uid boundary, and
  // no per-Agent config, model override, caller env param or omit list may
  // override or drop it. The Router parent's own process.env is untouched —
  // this only shapes the child's env object.
  env.TMPDIR = AGENT_CHILD_TMPDIR
  return env
}
