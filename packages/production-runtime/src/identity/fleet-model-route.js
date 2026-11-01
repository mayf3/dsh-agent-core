import { CHATGPT_SUBSCRIPTION_V1, GPT6_LUNA_ROUTE_V1 } from '../../../agent-provisioning/src/shared-codex.js'
import { invalid } from './provider-environment.js'

export function fleetSubscription(plugin, pluginVersion, credentialFile, artifactContext) {
  // Spawn-only: the caller verifies this descriptor against fleet current.
  // Bind only its exact artifact identity; names/types that resemble Codex do
  // not make independent subscriptions consumers of the selected generation.
  const selected = artifactContext?.fleetGeneration
  const fleetGeneration = plugin === selected?.plugin && pluginVersion !== GPT6_LUNA_ROUTE_V1.pluginVersion ? selected : undefined
  if (plugin === CHATGPT_SUBSCRIPTION_V1.plugin && pluginVersion !== GPT6_LUNA_ROUTE_V1.pluginVersion && artifactContext?.fleetRequired && !fleetGeneration) {
    throw Object.assign(new Error('ordinary Codex admission requires an accepted fleet generation'), { code: 'FLEET_GENERATION_INVALID' })
  }
  if (fleetGeneration) {
    if (pluginVersion !== fleetGeneration.pluginVersion) throw invalid('subscription pin differs from selected fleet generation; explicit catalog migration required')
    return Object.freeze({
      plugin, pluginVersion, sourceCommit: fleetGeneration.sourceCommit,
      artifactSha256: fleetGeneration.artifactSha256, dshVersion: fleetGeneration.dshVersion,
      dshCommit: fleetGeneration.dshCommit, credentialFile, fleetGeneration,
    })
  }
  return undefined
}

// Ordinary production routes from opts/env need the same artifact carrier as
// the built-in default. Supplied carriers are checked rather than relabelled.
export function bindFleetGlobalRoute(route, artifactContext, ownCanonicalCredentialFile, subscriptionProcessConfigBlock) {
  if (!artifactContext?.fleetRequired && !artifactContext?.fleetGeneration) return route
  if (route.provider !== 'openai-codex') {
    if (route.subscription?.plugin === 'dsh-codex') throw invalid('Codex artifact on a different provider')
    return route
  }
  const supplied = route.subscription
  const dormant = route.model === GPT6_LUNA_ROUTE_V1.model
  if (dormant && supplied?.pluginVersion !== GPT6_LUNA_ROUTE_V1.pluginVersion) throw invalid('GPT6 requires its separately selected exact dormant tuple')
  const version = dormant ? GPT6_LUNA_ROUTE_V1.pluginVersion : artifactContext.fleetGeneration?.pluginVersion
  const expected = subscriptionProcessConfigBlock('dsh-codex', version, ownCanonicalCredentialFile,
    dormant ? (supplied.reasoningEffort ?? GPT6_LUNA_ROUTE_V1.defaultReasoningEffort) : undefined, artifactContext)
  if (supplied !== undefined && (Object.keys(supplied).length !== Object.keys(expected).length
      || Object.entries(expected).some(([key, value]) => JSON.stringify(supplied[key]) !== JSON.stringify(value)))) {
    throw invalid('global subscription differs from selected artifact; explicit migration required')
  }
  return Object.freeze({ ...route, subscription: expected })
}

export function assertFleetCatalog(isCodex, isDormant, context) {
  if (isCodex && !isDormant && context?.fleetRequired && !context.fleetGeneration) {
    throw Object.assign(new Error('ordinary Codex catalog requires an accepted fleet generation'), { code: 'FLEET_GENERATION_INVALID' })
  }
}
