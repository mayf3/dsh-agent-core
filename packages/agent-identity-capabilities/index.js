/**
 * @agent-core/agent-identity-capabilities — STABLE PUBLIC ENTRY (tracked).
 *
 * This package-root file is the composition-facing entry of the identity
 * capability package (DSH_AGENT_CORE_MODULARITY_PHASE_A_V1 closure
 * amendment): consumers import THIS tracked path, so the dependency closes
 * under plain tracked-source resolution in every checkout — no untracked
 * node_modules bridge, no manual link registration, no deployment-side
 * step. package.json exports["."] points here as well, so a bare
 * `@agent-core/agent-identity-capabilities` specifier keeps resolving to
 * the exact same surface wherever the monorepo's own link mechanism
 * provides it.
 */
export * from './src/index.js'
