/**
 * @agent-core/workspace-bootstrap — path mapping (pure, zero-dependency).
 *
 * The only exported API is a small set of pure path functions used by
 * {@link ./index.js} (and independently testable). Every function is
 * deterministic: the same `agentId` always yields the same path, so a later
 * call to `ensure()` re-derives the identical workspace/home root.
 *
 * Two roots are kept apart on purpose (see docs/workspace-bootstrap-v0.md,
 * "映射与路径设计"):
 *
 *   - WORKSPACE  — the agent's long-lived working directory (its cwd). Default
 *     `~/.dsh/workspaces/<agentId>/`, overridable via `$DSH_WORKSPACE_DIR`.
 *     This is where AGENTS.md lives and where file tools operate.
 *   - DSH_HOME   — the agent's harness home (runtime/skill/credential state),
 *     mirroring DSH's own `dshHomePath` convention under `$DSH_HOME` /
 *     `~/.dsh`. Default `~/.dsh/agents/<agentId>/`, overridable via
 *     `$DSH_AGENTS_HOME`.
 *
 * `agentId` is external input, so it is sanitized before it ever reaches a
 * path. See {@link sanitizeAgentId} for the exact rejection rules; the two
 * resolve functions throw on an unsafe id so a caller cannot build a
 * traversing target by accident.
 *
 * The workspace-root resolution honours a configured root, then the
 * corresponding env var, then the default — matching the precedence DSH's
 * `resolveDshHome` uses (`configured ?? env ?? default`).
 */

import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'

/** Default workspace-root directory name under the OS home. */
export const DEFAULT_WORKSPACE_ROOT = '~/.dsh/workspaces'

/** Default DSH-home-root directory name under the OS home (agents/<id>). */
export const DEFAULT_AGENTS_HOME = '~/.dsh/agents'

/** Env var that overrides the workspace root for every agent. */
export const DSH_WORKSPACE_DIR_ENV = 'DSH_WORKSPACE_DIR'

/** Env var that overrides the agent-homes root for every agent. */
export const DSH_AGENTS_HOME_ENV = 'DSH_AGENTS_HOME'

/**
 * Largest accepted agentId length (arbitrary but generous; the component is
 * the only path segment it forms, and every OS caps total path length well
 * below MAX_SAFE_INTEGER). Overlong ids are rejected rather than truncated to
 * avoid collisions between distinct overlong inputs.
 */
export const MAX_AGENT_ID_LENGTH = 200

/**
 * Invalid agentId characters. A segment may never contain a path separator
 * (so it cannot inject `/`, `\`), nor leading/trailing/embedded dots or
 * spaces (so it cannot smuggle `..`, hide as `.`/`..`, or look like a hidden
 * file), nor a NUL. The surviving alphabet is a strict subset of what both
 * Windows and POSIX accept in a single path component.
 */
export const INVALID_AGENT_ID_RE = /[\u0000/\\ .]/

/**
 * Expand a `~` / `~/` prefix (and a `~\` on Windows) against the OS home.
 * Mirrors DSH's `home-paths` `expandHomePath`.
 * @param value - configured path that may begin with `~`.
 * @returns the expanded absolute path.
 */
export function expandTilde(value) {
  if (value === '~') return homedir()
  if (value.startsWith('~/') || value.startsWith('~\\')) return resolve(join(homedir(), value.slice(2)))
  return value
}

/**
 * Look up an agent's explicit primary-workspace override (an imported
 * existing directory). AGENT_PRIMARY_WORKSPACE_IMPORT_V1 §3: the record is a
 * single-valued `agentId → absolute path` mapping validated at config load
 * (see index.js `validatePrimaryWorkspaces`); absent entry → `undefined`
 * (default agent — everything as today). This is the ONLY place the override
 * is consulted: `resolveWorkspacePath` (Binding.workspace derivation) never
 * sees it, so a binding whose `workspace` happens to equal an agentId still
 * resolves the generic `<workspaceRoot>/<workspaceId>` path.
 *
 * @param agentId - the agent identifier (sanitized internally).
 * @param primaryWorkspaces - optional validated record `agentId → absolute
 *   directory`; `undefined`/`null` = no imports configured.
 * @returns the imported absolute workspace path, or `undefined`.
 */
export function lookupPrimaryWorkspace(agentId, primaryWorkspaces) {
  if (primaryWorkspaces === undefined || primaryWorkspaces === null) return undefined
  const explicit = primaryWorkspaces[sanitizeAgentId(agentId)]
  return typeof explicit === 'string' && explicit !== '' ? resolve(explicit) : undefined
}

/**
 * Resolve the per-agent workspace root for `agentId` — the Agent PRIMARY
 * WORKSPACE authority (AGENT_PRIMARY_WORKSPACE_IMPORT_V1 §3).
 *
 * Precedence, highest first:
 *   1. an explicit `primaryWorkspaces[agentId]` entry (imported existing
 *      absolute directory — validated at config load; the entry wins over any
 *      root/env derivation);
 *   2. a configured `workspaceRoot`, then `$DSH_WORKSPACE_DIR`, then
 *      `~/.dsh/workspaces/<agentId>`.
 * With no `primaryWorkspaces` argument (or no entry) the derivation is
 * byte-for-byte the pre-Spec behavior. The override parameter must be passed
 * EXPLICITLY — `resolveWorkspacePath` deliberately delegates with only three
 * arguments so the generic workspaceId derivation can never be polluted by a
 * per-agent primary override.
 *
 * @param agentId - the agent identifier to map.
 * @param configuredWorkspaceRoot - optional explicit root override each agent path resolves under.
 * @param env - environment mapping (used to read `DSH_WORKSPACE_DIR`).
 * @param primaryWorkspaces - optional validated record `agentId → imported
 *   absolute directory` (see {@link lookupPrimaryWorkspace}).
 * @returns the absolute per-agent workspace root.
 */
export function resolveWorkspace(agentId, configuredWorkspaceRoot, env = process.env, primaryWorkspaces) {
  const safe = sanitizeAgentId(agentId)
  const explicit = lookupPrimaryWorkspace(safe, primaryWorkspaces)
  if (explicit !== undefined) return explicit
  const fromEnv = env[DSH_WORKSPACE_DIR_ENV]
  const base = configuredWorkspaceRoot ?? (fromEnv !== undefined && fromEnv.trim() !== '' ? fromEnv : DEFAULT_WORKSPACE_ROOT)
  return resolve(expandTilde(base), safe)
}

/**
 * Resolve the per-agent DSH home for `agentId`.
 *
 * Precedence, highest first: a configured `agentsHome`, then
 * `$DSH_AGENTS_HOME`, then `~/.dsh/agents/<agentId>`. Semantics mirror DSH's
 * `resolveDshHome`/`dshHomePath`: a blank env override is treated as unset,
 * so it never resolves the home to cwd; the result is always absolute.
 *
 * @param agentId - the agent identifier to map.
 * @param configuredAgentsHome - optional explicit per-agent home root.
 * @param env - environment mapping (used to read `DSH_AGENTS_HOME`).
 * @returns the absolute per-agent DSH home.
 */
export function resolveDshHome(agentId, configuredAgentsHome, env = process.env) {
  const safe = sanitizeAgentId(agentId)
  const fromEnv = env[DSH_AGENTS_HOME_ENV]
  const base = configuredAgentsHome ?? (fromEnv !== undefined && fromEnv.trim() !== '' ? fromEnv : DEFAULT_AGENTS_HOME)
  return resolve(expandTilde(base), safe)
}

/**
 * Sanitize an `agentId` into a single, safe, path-component-safe identifier,
 * or throw when it cannot be made safe.
 *
 * Rejects (rather than silently reshaping) input that:
 *   - is not a non-empty string (null / undefined / numbers / objects);
 *   - is empty or whitespace-only;
 *   - contains any character that could act as a path separator or traversal
 *     device: NUL, `/`, `\`, `.`, or space — these block `..`, `.`/`..`
 *     components, hidden-file smuggling, injected separators, and trailing
 *     spaces/dots that Windows would silently strip;
 *   - is absolute (a leading separator is impossible once `/` is banned, but
 *     the check is listed for clarity and as a guard against future edits);
 *   - is longer than {@link MAX_AGENT_ID_LENGTH}.
 *
 * The returned value is a single path component containing only alphanumerics,
 * `-`, and `_`, so it can never escape its root directory.
 *
 * @param agentId - the identifier to validate and normalize.
 * @returns the sanitized single path component.
 */
export function sanitizeAgentId(agentId) {
  if (typeof agentId !== 'string' || agentId.trim() === '') {
    throw new TypeError('sanitizeAgentId: agentId must be a non-empty string')
  }
  if (agentId.length > MAX_AGENT_ID_LENGTH) {
    throw new TypeError(`sanitizeAgentId: agentId exceeds ${MAX_AGENT_ID_LENGTH} characters`)
  }
  if (INVALID_AGENT_ID_RE.test(agentId)) {
    throw new TypeError('sanitizeAgentId: agentId may contain only letters, digits, "-" and "_"')
  }
  const normalized = agentId.trim()
  if (normalized !== agentId || isAbsolute(agentId)) {
    throw new TypeError('sanitizeAgentId: agentId must be a single trimmed path component')
  }
  return normalized
}
