function replaceExactlyOnce(source, before, after, label) {
  const first = source.indexOf(before)
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) throw new Error(`candidate compose ${label} drift`)
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`
}

/** Keep Watchdog wiring while retaining the separately governed production v2 model generation. */
export function adaptCandidateComposeToPinnedV2(candidate) {
  let result = replaceExactlyOnce(candidate,
    "import { loadAgentModelOverrides, canonicalDefaultGlobalRoute } from './model-overrides.js'\nimport { CANONICAL_DEFAULT_MODEL_ROUTE } from '../../agent-provisioning/src/shared-codex.js'",
    "import { loadAgentModelOverrides } from './model-overrides.js'",
    'model imports')
  result = replaceExactlyOnce(result,
    `  // AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1 (accepted) + IMPL_V1: deployment-
  // owned static route chain config (agent-model-overrides.json version 3).
  // The composition validates it against the already-loaded Agent Definition
  // and re-reads it ONLY at each new process boundary (turn-start chain
  // snapshot) so target-only rollback needs neither a runtime restart nor a
  // file watcher. The Router receives the immutable snapshot resolver and
  // never reads the file or learns provider/model rules.
  // DEFAULT_MODEL_ROUTING_CONFIG_V1 §3: composition config > env pair > the
  // canonical built-in default (GPT Luna as a complete subscription route).
  const globalRouteSource = opts.globalRoute !== undefined
    ? 'composition_config'
    : (process.env.DSH_AGENT_PROVIDER !== undefined || process.env.DSH_AGENT_MODEL !== undefined
      ? 'runtime_env'
      : 'builtin_default')
  const globalRoute = Object.freeze(opts.globalRoute ?? (globalRouteSource === 'runtime_env'
    ? {
      provider: process.env.DSH_AGENT_PROVIDER ?? CANONICAL_DEFAULT_MODEL_ROUTE.provider,
      model: process.env.DSH_AGENT_MODEL ?? CANONICAL_DEFAULT_MODEL_ROUTE.model,
    }
    : canonicalDefaultGlobalRoute()))
  log.log(\`global model route: \${globalRoute.provider}/\${globalRoute.model} (source=\${globalRouteSource})\`)
`,
    `  // AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1 (accepted) + IMPL_V1: deployment-
  // owned static route chain config (agent-model-overrides.json version 2).
  // The v2 -> v3 migration is separately governed and is not part of Watchdog.
  const globalRoute = Object.freeze(opts.globalRoute ?? {
    provider: process.env.DSH_AGENT_PROVIDER ?? 'opencode-go',
    model: process.env.DSH_AGENT_MODEL ?? 'deepseek-v4-flash',
  })
`,
    'model route block')
  return result
}
