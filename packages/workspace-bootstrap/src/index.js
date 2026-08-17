/**
 * @agent-core/workspace-bootstrap — Cordis plugin providing per-agent
 * workspace bootstrap as a *capability*.
 *
 * The plugin does NOT seed on its own. It publishes a small service
 * (`ctx.workspaceBootstrap`) exposing `ensure(agentId)` (plus the pure path
 * functions) so that a caller — typically the Router's agent/pre-step mount
 * point — may create the agent's long-lived directory on demand. Authoring
 * the directory at the right lifecycle point (before agent-instructions first
 * renders AGENTS.md) belongs to that caller, not to this plugin.
 *
 * Responsibilities implemented here:
 *   1. Stable `agentId → workspace` and `agentId → DSH_HOME` mapping
 *      (see {@link ./paths.js}).
 *   2. Idempotent directory creation + seeding: running `ensure` twice is a
 *      no-op on the second pass; existing files are never overwritten.
 *   3. Seeding only files that have an explicit rationale (AGENTS.md); the
 *      file map and the vetoed files are argued in docs/workspace-bootstrap-v0.md.
 *
 * Config (all optional):
 *   - `workspaceRoot`: override the per-agent workspace root directory
 *     (defaults to `~/.dsh/workspaces`).
 *   - `agentsHome`: override the per-agent DSH home root directory
 *     (defaults to `~/.dsh/agents`).
 *   - `seedFiles`: which relative files (inside the workspace root) to seed
 *     when missing. Default `['AGENTS.md']`.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'

import {
  resolveDshHome as resolveAgentHome,
  resolveWorkspace,
  sanitizeAgentId,
} from './paths.js'

/**
 * AGENT_CORE_BINDING_WORKSPACE_V1: structured rejection code for an invalid
 * workspaceId (a Binding's stable effective workspace identifier). The Router
 * surfaces this code verbatim — it never truncates or reshapes the input.
 */
export const WORKSPACE_ID_INVALID = 'WORKSPACE_ID_INVALID'

/**
 * AGENT_CORE_BINDING_WORKSPACE_V1 §WorkspaceResolution: the frozen ultra-thin
 * workspaceId -> path derivation (`resolveWorkspacePath(workspaceId) =
 * <workspaceRoot>/<sanitizeWorkspaceId(workspaceId)>`). It is the SAME
 * sanitize-backed derivation resolveWorkspace has always performed (resolve
 * accepts any id, not just agent ids) — named here as the Spec seam; no
 * parallel mapping system exists or is introduced.
 *
 * @param {string} workspaceId - the Binding workspace identifier (sanitized
 *   internally; invalid ids throw).
 * @param {string} [configuredWorkspaceRoot] - optional root override.
 * @param {object} [env] - environment mapping ($DSH_WORKSPACE_DIR).
 * @returns {string} the absolute workspace path.
 */
export function resolveWorkspacePath(workspaceId, configuredWorkspaceRoot, env = process.env) {
  return resolveWorkspace(workspaceId, configuredWorkspaceRoot, env)
}

/**
 * AGENT_CORE_BINDING_WORKSPACE_V1 §WorkspaceIdValidation: validate a
 * workspaceId as a single safe path component, REUSING sanitizeAgentId (the
 * isomorphic safe-id helper) — no separate safety system for workspace ids.
 * Rejects (never reshapes) anything that is not a non-empty trimmed string of
 * [A-Za-z0-9_-] within MAX_AGENT_ID_LENGTH; rethrows as a structured
 * WORKSPACE_ID_INVALID error so callers can distinguish validation from IO.
 *
 * @param {string} workspaceId - the Binding workspace identifier to validate.
 * @returns {string} the validated (already-normalized) workspaceId.
 */
export function validateWorkspaceId(workspaceId) {
  try {
    return sanitizeAgentId(workspaceId)
  } catch (cause) {
    throw Object.assign(
      new Error(`workspace-bootstrap: invalid workspaceId (${cause instanceof Error ? cause.message : String(cause)})`),
      { code: WORKSPACE_ID_INVALID },
    )
  }
}

/** Stable plugin name referenced by bundle patches. */
export const name = 'workspace-bootstrap'

/** No hard service dependencies: the capability is self-contained. */
export const inject = []

/** Plugin config. */
export const Config = z.object({
  /** Root under which each agent's workspace lives (default `~/.dsh/workspaces`). */
  workspaceRoot: z.string(),
  /** Root under which each agent's DSH home lives (default `~/.dsh/agents`). */
  agentsHome: z.string(),
  /** Relative workspace files to seed when missing (default `['AGENTS.md']`). */
  seedFiles: z.array(z.string()).default(['AGENTS.md']),
})

/** Template for the seeded AGENTS.md. Plain text on purpose (see report). */
export const AGENTS_TEMPLATE = [
  '# AGENTS.md',
  '',
  'This is the long-lived working directory for this DSH agent.',
  '',
  '## Purpose',
  '- Persistent, isolated home for the agent: default cwd, relative base for file tools, and the place where the agent writes its own working notes.',
  '- Read automatically by the harness (`agent-instructions`) at session start and reloaded when the file changes.',
  '',
  '## Conventions',
  '- Keep this file a short pointer to how the agent should behave in THIS workspace.',
  '- Anything written here is instructions for the agent, not user content; prefer concrete, actionable rules over prose.',
  '- Do not clutter this file with session-specific state — that belongs in per-agent memory files, not here.',
  '',
  '## Written by',
  '- Seeded by `@agent-core/workspace-bootstrap` (M1) to give the workspace its minimal instruction surface.',
  '- Extend or replace freely as the agent evolves; the file is the agent\'s own.',
  '',
].join('\n')

/**
 * Idempotently create the per-agent workspace and DSH home and seed the
 * configured files. Second and later calls are no-ops: nothing is re-seeded,
 * nothing already on disk is overwritten, and no error is raised.
 *
 * @param agentId - the agent identifier to bootstrap (sanitized internally).
 * @param options - optional overrides; defaults are taken from the plugin Config.
 * @param options.workspaceRoot - per-agent workspace root override.
 * @param options.agentsHome - per-agent DSH-home root override.
 * @param options.seedFiles - relative workspace files to seed when missing.
 * @returns `{ workspace, dshHome }` — the resolved absolute roots.
 */
/** Seed the configured relative files inside `workspace` (never overwrite). */
async function seedWorkspaceFiles(workspace, seedFiles) {
  for (const relative of seedFiles) {
    // `relative` is a trustworthy config value, but guard against accidental
    // traversal anyway so a misconfigured seed list can never write outside
    // the workspace.
    if (relative === '' || relative.startsWith('/') || relative.includes('\\')
        || relative.split('/').some(part => part === '..' || part === '.')) {
      throw new TypeError(`workspace-bootstrap: invalid seed file path "${relative}"`)
    }
    const target = join(workspace, relative)
    // Write only when absent — never overwrite an existing file.
    try {
      await writeFile(target, AGENTS_TEMPLATE, { encoding: 'utf8', flag: 'wx' })
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error // already seeded → idempotent skip
    }
  }
}

export async function ensure(agentId, options = {}) {
  const workspaceRoot = options.workspaceRoot
  const agentsHome = options.agentsHome
  const seedFiles = options.seedFiles ?? ['AGENTS.md']
  const workspace = resolveWorkspace(agentId, workspaceRoot)
  const dshHome = resolveAgentHome(agentId, agentsHome)

  // Create both roots up front so a genuine IO failure surfaces even when the
  // seed list is empty.
  await mkdir(workspace, { recursive: true })
  await mkdir(dshHome, { recursive: true })
  await seedWorkspaceFiles(workspace, seedFiles)

  return { workspace, dshHome }
}

/**
 * AGENT_CORE_BINDING_WORKSPACE_V1 §WorkspaceResolution / "Workspace 不存在怎么办":
 * idempotent bootstrap of ONE binding workspace (mkdir + seed) keyed by
 * workspaceId — a valid id whose directory is missing is the NORMAL
 * initialization path, never an invalid-workspace rejection. Unlike
 * {@link ensure} this touches only the WORKSPACE root: the DSH home stays
 * keyed by agentId (one Agent = one process = one home; workspaces are
 * per-binding cwd surfaces, not runtime homes).
 *
 * @param {string} workspaceId - the Binding workspace identifier (validated
 *   internally by the same sanitize rules).
 * @param {object} [options] - optional overrides (same meaning as ensure's).
 * @returns `{ workspace }` — the resolved absolute workspace root.
 */
export async function ensureWorkspace(workspaceId, options = {}) {
  validateWorkspaceId(workspaceId)
  const workspace = resolveWorkspace(workspaceId, options.workspaceRoot)
  await mkdir(workspace, { recursive: true })
  await seedWorkspaceFiles(workspace, options.seedFiles ?? ['AGENTS.md'])
  return { workspace }
}

/**
 * Mount the capability. Registers the `ctx.workspaceBootstrap` service so any
 * later-mounting sibling (host or Router) can call `ensure` plus the pure path
 * helpers. Does not seed anything on its own.
 * @param ctx - plugin context.
 * @param config - validated plugin config.
 */
export function apply(ctx, config) {
  const seedFiles = config?.seedFiles ?? ['AGENTS.md']
  const workspaceRoot = config?.workspaceRoot
  const agentsHome = config?.agentsHome
  const service = {
    ensure: (agentId, options = {}) => ensure(agentId, {
      seedFiles: options.seedFiles ?? seedFiles,
      workspaceRoot: options.workspaceRoot ?? workspaceRoot,
      agentsHome: options.agentsHome ?? agentsHome,
    }),
    sanitizeAgentId,
    resolveWorkspace: (agentId) => resolveWorkspace(agentId, workspaceRoot),
    resolveDshHome: (agentId) => resolveAgentHome(agentId, agentsHome),
    // AGENT_CORE_BINDING_WORKSPACE_V1 seams (ultra-thin: the same
    // sanitize-backed derivation, named for the frozen resolution model —
    // <workspaceRoot>/<sanitizeWorkspaceId(workspaceId)>):
    validateWorkspaceId,
    resolveWorkspacePath: (workspaceId) => resolveWorkspacePath(workspaceId, workspaceRoot),
    ensureWorkspace: (workspaceId, options = {}) => ensureWorkspace(workspaceId, {
      seedFiles: options.seedFiles ?? seedFiles,
      workspaceRoot: options.workspaceRoot ?? workspaceRoot,
    }),
  }
  // Provide the service VALUE directly (Cordis stores it as-is; a factory
  // function would be returned as-is by ctx.get()).
  ctx.provide('workspaceBootstrap', service)
}
