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

  return { workspace, dshHome }
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
  }
  ctx.provide('workspaceBootstrap', () => service)
}
