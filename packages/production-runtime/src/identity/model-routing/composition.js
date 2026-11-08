import { canonicalDefaultGlobalRoute, createModelArtifactContext } from './validator.js'
import { CANONICAL_DEFAULT_MODEL_ROUTE } from '../../../../agent-provisioning/src/shared-codex.js'
import { createRoutingConfigRuntime } from './generation.js'
import { readHarnessIdentity } from '../../../../agent-provisioning/src/index.js'

/** Thin composition adapter: closed default priority and exact explicit states. */
export function composeRoutingConfig({ layout, opts, definition, agentProfile, log, file }) {
  const artifactContext = createModelArtifactContext(layout.root)
  const readContext = () => {
    const source = opts.globalRoute !== undefined ? 'composition_config'
      : (process.env.DSH_AGENT_PROVIDER !== undefined || process.env.DSH_AGENT_MODEL !== undefined ? 'runtime_env' : 'builtin_default')
    const options = { deploymentRoot: layout.root, artifactContext }
    const globalRoute = opts.globalRoute ?? (source === 'runtime_env' ? {
      provider: process.env.DSH_AGENT_PROVIDER ?? CANONICAL_DEFAULT_MODEL_ROUTE.provider,
      model: process.env.DSH_AGENT_MODEL ?? CANONICAL_DEFAULT_MODEL_ROUTE.model,
    } : canonicalDefaultGlobalRoute(options))
    return { options, globalRoute, layers: {
      source, agentProfile,
      composition: { present: opts.globalRoute !== undefined, value: opts.globalRoute },
      env: { provider: process.env.DSH_AGENT_PROVIDER, model: process.env.DSH_AGENT_MODEL },
      builtin: CANONICAL_DEFAULT_MODEL_ROUTE,
      harnessRoot: process.env.DSH_HARNESS_ROOT,
      harnessIdentity: readHarnessIdentity(process.env.DSH_HARNESS_ROOT),
      artifactPaths: { packageArtifact: process.env.DSH_CODEX_PACKAGE_TARBALL, sourceStamp: process.env.DSH_CODEX_SOURCE_STAMP },
    } }
  }
  const runtime = createRoutingConfigRuntime({
    file, registeredAgentIds: definition.listAgents().map(agent => agent.id), readContext, log,
  })
  const context = readContext()
  log.log(`global model route: ${context.globalRoute.provider}/${context.globalRoute.model} (source=${context.layers.source})`)
  return { runtime, globalRoute: Object.freeze({ ...context.globalRoute }) }
}
