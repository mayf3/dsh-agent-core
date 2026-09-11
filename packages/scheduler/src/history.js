/**
 * Compatibility barrel (AMENDMENT_3 structure closure, C2): the history
 * implementation modules live in ./history/. External importers
 * (scripts/agentcore-cron.mjs, packages/product-api tests) keep their
 * `src/history.js` specifier untouched.
 */
export * from './history/history.js';
