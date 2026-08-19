/**
 * @agent-core/production-runtime/src/paths.js — the production persistent
 * layout (PRODUCTION_RUNTIME_V1, Task 3).
 *
 * ONE root owns every piece of durable state the Production Runtime needs.
 * The default root is `~/.agent-core` — the SAME root the external
 * `agentcore-cron` control seam already defaults to
 * ($HOME/.agent-core/scheduler/jobs.json), so external job writers and the
 * resident engine share one store with zero env wiring. Nothing lives in
 * `.demo`, tmp, or test fixtures; a root path containing a `.demo` segment
 * is rejected fail-loud so production state can never silently land in (or
 * depend on) demo state.
 *
 *   <root>/                             # default ~/.agent-core
 *     agents.json                       # Agent Definition config (existence
 *                                       #   authority; the runtime LOADS it,
 *                                       #   never writes it)
 *     agent-model-overrides.json         # optional startup-only per-Agent
 *                                       #   process model override
 *     bindings/bindings.json            # Router BindingStore — Bindings +
 *                                       #   per-surface bookmarks + Delivery
 *                                       #   V0 fresh-requestId mappings
 *     scheduler/jobs.json               # Scheduler JobStore (agentcore-cron
 *                                       #   default path — DO NOT MOVE)
 *     scheduler/runs.jsonl              # run log (started/finished events)
 *     workspaces/<agentId>/             # per-agent workspace (persona /
 *                                       #   AGENTS.md authority)
 *     homes/<agentId>/                  # per-agent DSH_HOME (settings,
 *                                       #   credentials, profile, sessions)
 *     control/runtime-evidence.jsonl    # lifecycle/admission evidence
 *     logs/                             # supervised stdout/stderr (launchd)
 *
 * Overriding the root: `PRODUCTION_RUNTIME_ROOT` env or the `--root` CLI
 * flag (acceptance drivers use an isolated root with the SAME layout).
 */

import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'

/** Env var that overrides the production persistent root. */
export const PRODUCTION_RUNTIME_ROOT_ENV = 'PRODUCTION_RUNTIME_ROOT'

/** The default production persistent root (matches agentcore-cron's store root). */
export function defaultProductionRoot() {
  return join(homedir(), '.agent-core')
}

/**
 * Resolve the production persistent layout from one root.
 * @param {string} [rootInput] - absolute root; defaults to $PRODUCTION_RUNTIME_ROOT
 *   then ~/.agent-core. Relative inputs are resolved against cwd.
 * @returns {{root:string, agentsConfig:string, agentModelOverrides:string, bindingsStore:string,
 *   jobsStore:string, runsLog:string, workspacesRoot:string, homesRoot:string,
 *   controlDir:string, evidenceLog:string, logsDir:string}}
 * @throws {TypeError} when the resolved root contains a `.demo` path segment
 *   (production state must never live in — or depend on — demo state).
 */
export function resolveProductionLayout(rootInput) {
  const root = resolve(rootInput ?? process.env[PRODUCTION_RUNTIME_ROOT_ENV] ?? defaultProductionRoot())
  if (!isAbsolute(root)) {
    // resolve() already absolutized; kept as a fail-loud guard for future edits.
    throw new TypeError(`production-runtime: root must be absolute (got ${rootInput})`)
  }
  if (root.split('/').includes('.demo')) {
    throw new TypeError(`production-runtime: refusing .demo root ${root} — production persistent state must use a real production directory (default ${defaultProductionRoot()})`)
  }
  return {
    root,
    agentsConfig: join(root, 'agents.json'),
    agentModelOverrides: join(root, 'agent-model-overrides.json'),
    bindingsStore: join(root, 'bindings', 'bindings.json'),
    jobsStore: join(root, 'scheduler', 'jobs.json'),
    runsLog: join(root, 'scheduler', 'runs.jsonl'),
    workspacesRoot: join(root, 'workspaces'),
    homesRoot: join(root, 'homes'),
    controlDir: join(root, 'control'),
    evidenceLog: join(root, 'control', 'runtime-evidence.jsonl'),
    logsDir: join(root, 'logs'),
  }
}
