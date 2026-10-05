/**
 * @agent-core/development-execution — workspace / repository authority
 * (AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1 CTR-DES-004).
 *
 * `development_execute` never grants arbitrary machine execution:
 * - repos come ONLY from the Operator-managed allowlist (`repos.json`);
 * - every execution gets a FRESH git worktree created from the EXACT
 *   requested baseSha inside `<root>/dev-execution/worktrees/<executionId>`;
 * - the worktree is the backend's only writable path (enforced in depth by
 *   the codex workspace-write sandbox).
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Load and structurally validate the repo allowlist. Fail loud on malformed
 * config — a partially-readable authority must never widen access.
 */
export function loadRepoAuthority(file) {
  if (typeof file !== 'string' || file === '' || !existsSync(file)) {
    return { configured: false, repos: new Map() }
  }
  let document
  try {
    document = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`development-execution: malformed repos.json (${file}): ${error.message}`)
  }
  if (!Array.isArray(document?.repos)) {
    throw new Error('development-execution: repos.json must be {repos: [...]}')
  }
  const repos = new Map()
  for (const entry of document.repos) {
    if (typeof entry?.name !== 'string' || entry.name === '') throw new Error('development-execution: repo entry missing name')
    if (typeof entry?.path !== 'string' || entry.path === '') throw new Error(`development-execution: repo ${entry.name} missing path`)
    if (!existsSync(entry.path)) throw new Error(`development-execution: repo ${entry.name} path does not exist: ${entry.path}`)
    repos.set(entry.name, {
      name: entry.name,
      path: entry.path,
      allowedBranchPrefixes: Array.isArray(entry.allowedBranchPrefixes) ? entry.allowedBranchPrefixes : [],
      maxWorktrees: Number.isInteger(entry.maxWorktrees) && entry.maxWorktrees > 0 ? entry.maxWorktrees : 8,
    })
  }
  return { configured: true, repos }
}

function git(repoPath, args) {
  return execFileSync('git', ['-C', repoPath, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()
}

/** Authorize (repo, baseSha, branch) against the allowlist; throw on refusal. */
export function authorizeStart(authority, { repo, baseSha, branch }) {
  if (!authority.configured) {
    throw Object.assign(new Error('development-execution: repo authority not configured (repos.json missing)'), { code: 'config_missing' })
  }
  const entry = authority.repos.get(repo)
  if (entry === undefined) {
    throw Object.assign(new Error(`development-execution: repo ${JSON.stringify(repo)} is not authorized`), { code: 'repo_not_authorized' })
  }
  if (typeof baseSha !== 'string' || !/^[0-9a-f]{7,64}$/i.test(baseSha)) {
    throw Object.assign(new Error('development-execution: baseSha must be a commit SHA'), { code: 'invalid_arguments' })
  }
  try {
    git(entry.path, ['cat-file', '-e', `${baseSha}^{commit}`])
  } catch {
    throw Object.assign(new Error(`development-execution: baseSha ${baseSha} not found in repo ${repo}`), { code: 'base_sha_unknown' })
  }
  if (typeof branch === 'string' && entry.allowedBranchPrefixes.length > 0
    && !entry.allowedBranchPrefixes.some((prefix) => branch.startsWith(prefix))) {
    throw Object.assign(new Error(`development-execution: branch ${JSON.stringify(branch)} not permitted for repo ${repo}`), { code: 'branch_not_permitted' })
  }
  return entry
}

/**
 * Create a FRESH isolated worktree at exactly `baseSha` and verify its HEAD.
 * Each execution owns its worktree; no worktree is ever shared or reused.
 */
export function createWorktree({ repoPath, baseSha, worktreesRoot, executionId }) {
  mkdirSync(worktreesRoot, { recursive: true })
  const worktree = join(worktreesRoot, executionId)
  git(repoPath, ['worktree', 'add', worktree, baseSha])
  const head = git(worktree, ['rev-parse', 'HEAD'])
  if (head !== baseSha) {
    // Structural invariant: the backend must never start anywhere but the
    // authorized base. A mismatch is an authority breach — fail loud.
    throw new Error(`development-execution: worktree HEAD ${head} != authorized baseSha ${baseSha}`)
  }
  return worktree
}

/** List changed files between the authorized base and the worktree HEAD. */
export function changedFiles(worktree, baseSha) {
  const head = git(worktree, ['rev-parse', 'HEAD'])
  if (head === baseSha) return []
  return git(worktree, ['diff', '--name-only', `${baseSha}..HEAD`]).split('\n').filter(Boolean)
}

/** HEAD commit of the worktree (candidate SHA), or null when unchanged. */
export function candidateSha(worktree, baseSha) {
  const head = git(worktree, ['rev-parse', 'HEAD'])
  return head === baseSha ? null : head
}
