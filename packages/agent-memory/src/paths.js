/**
 * @agent-core/agent-memory — path mapping (pure, zero-dependency).
 *
 * Where an Agent's long-term memory lives is a pure function of the agent's
 * workspace (its long-lived home directory), and the agentId → workspace
 * mapping is owned by @agent-core/workspace-bootstrap (D-002 boundary: the
 * router/bootstrap is the single owner of that mapping). This module only
 * derives the memory files INSIDE an already-resolved workspace:
 *
 *   - `<workspace>/MEMORY.md`          — the curated long-term memory file
 *     (canonical, human-editable Markdown; the only source of truth).
 *   - `<workspace>/memory/`            — episodic layer (raw daily notes).
 *   - `<workspace>/memory/YYYY-MM-DD.md` — one daily note per day.
 *
 * Why the workspace and not the DSH home: the workspace is the agent's
 * long-lived, human-visible, git-backable home (per D-002 the Agent owns its
 * workspace / DSH_HOME / credential / memory), and CAPABILITY_MATRIX ruling #3
 * puts V1 memory in files next to the workspace-bootstrap seed surface. The
 * DSH home stays runtime-only (sessions / settings / credentials).
 *
 * Per-agent isolation is therefore PHYSICAL: different agentId → different
 * workspace → different MEMORY.md file. No global store exists.
 */

import { join } from 'node:path'
import { resolveWorkspace } from '@agent-core/workspace-bootstrap/paths'

/** Relative directory (inside the workspace) holding the episodic layer. */
export const MEMORY_DIR_NAME = 'memory'

/** Canonical curated memory file name, inside the workspace root. */
export const MEMORY_FILE_NAME = 'MEMORY.md'

/**
 * Resolve the agent's workspace from its id (delegates the mapping to
 * workspace-bootstrap — the single owner of agentId → workspace).
 * @param agentId - the agent identifier (sanitized by workspace-bootstrap).
 * @param configuredWorkspaceRoot - optional root override (pass-through).
 * @returns the absolute workspace root.
 */
export function resolveAgentWorkspace(agentId, configuredWorkspaceRoot) {
  return resolveWorkspace(agentId, configuredWorkspaceRoot)
}

/**
 * Resolve the curated memory file for an agent's workspace.
 * @param workspace - the agent's resolved workspace root.
 * @returns the absolute MEMORY.md path.
 */
export function resolveMemoryFile(workspace) {
  return join(workspace, MEMORY_FILE_NAME)
}

/**
 * Resolve the episodic memory directory for an agent's workspace.
 * @param workspace - the agent's resolved workspace root.
 * @returns the absolute `<workspace>/memory/` path.
 */
export function resolveMemoryDir(workspace) {
  return join(workspace, MEMORY_DIR_NAME)
}

/**
 * Resolve one daily note file for a date.
 * @param workspace - the agent's resolved workspace root.
 * @param date - an ISO date (YYYY-MM-DD) or a Date; the file name uses the
 *   UTC date part so the mapping is deterministic for a given instant.
 * @returns the absolute `memory/YYYY-MM-DD.md` path.
 */
export function resolveDailyNoteFile(workspace, date = new Date()) {
  const iso = date instanceof Date ? date.toISOString() : String(date)
  const day = iso.slice(0, 10)
  return join(resolveMemoryDir(workspace), `${day}.md`)
}

/**
 * Derive the agentId from a process working directory, when not configured.
 * The workspace path is `<workspaceRoot>/<sanitizedAgentId>`, so the last
 * path component is the agent id.
 * @param cwd - the process working directory (defaults to process.cwd()).
 * @returns the last path component (the agent id), or undefined when the
 *   cwd is a root.
 */
export function agentIdFromCwd(cwd = process.cwd()) {
  if (typeof cwd !== 'string' || cwd === '') return undefined
  const parts = cwd.split(/[\\/]/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : undefined
}
