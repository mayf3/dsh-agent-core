/**
 * @agent-core/agent-router/src/process.js — compatibility shim.
 *
 * The per-agent DSH process client moved to src/process/ (env /
 * provider-errors / state-machine / evidence-buffer / rpc-channel /
 * event-correlation / turn-execution / spawn / shutdown / agent-process,
 * barrel index.js) in the PR #42 structure refactor — no semantic change.
 * This shim preserves the original import path and every historical export
 * symbol (public API unchanged; package exports map "./process" still
 * resolves here).
 */

export * from './process/index.js'
