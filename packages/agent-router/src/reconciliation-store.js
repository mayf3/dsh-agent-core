/**
 * @agent-core/agent-router/src/reconciliation-store.js — compatibility shim.
 *
 * The Router reconciliation store implementation moved to src/reconciliation/
 * (capacity / state-machine / query / store, barrel index.js) in the PR #42
 * structure refactor — no semantic change. This shim preserves the original
 * import path and every historical export symbol (public API unchanged).
 */

export * from './reconciliation/index.js'
