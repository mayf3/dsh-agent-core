/** Binds only the trusted composition resolver's exact-agent policy snapshot. */
import { resolveTrustedNativeToolPolicy } from '../../agent-provisioning/src/trusted-native-tool-policy.js'
import { canonicalRouteIdentity } from './route-chain.js'

function resolveProcessConfigForAgent(agentId, processConfig, resolveNativeToolPolicy) {
  const nativeToolPolicy = resolveTrustedNativeToolPolicy(resolveNativeToolPolicy?.(agentId), agentId)
  const trustedConfig = { ...processConfig }
  delete trustedConfig.nativeToolPolicy
  return nativeToolPolicy === undefined
    ? trustedConfig
    : { ...trustedConfig, nativeToolPolicy }
}

export function createNativePolicyRegistryBinding({ resolveNativeToolPolicy, resolveProcessConfig, getCurrentPolicy }) {
  function hasPolicy(agentId) {
    return resolveTrustedNativeToolPolicy(resolveNativeToolPolicy?.(agentId), agentId) !== undefined
  }

  function prepareWanted(agentId, wanted) {
    const sourceConfig = wanted.processConfig ?? resolveProcessConfig(agentId) ?? {}
    const processConfig = resolveProcessConfigForAgent(agentId, sourceConfig, resolveNativeToolPolicy)
    const policyWasRemoved = processConfig.nativeToolPolicy === undefined
      && getCurrentPolicy(agentId) !== undefined
    return {
      ...wanted,
      processConfig,
      ...(!policyWasRemoved && processConfig.nativeToolPolicy === undefined
        ? {}
        : { routeIdentity: canonicalRouteIdentity(processConfig) }),
    }
  }

  function prepareStartupConfig(agentId, processConfig) {
    return resolveProcessConfigForAgent(agentId, processConfig, resolveNativeToolPolicy)
  }

  function ensureRunning(agentId, routeGate) {
    let processConfig
    try {
      processConfig = resolveProcessConfig(agentId) ?? {}
    } catch (error) {
      return Promise.reject(error)
    }
    return routeGate.ensureRunningForRoute(agentId, {
      processConfig,
      routeIdentity: canonicalRouteIdentity(processConfig),
    }).then((result) => {
      if (result.status === 'ready') return result.proc
      throw Object.assign(new Error(`agent-router: native policy route for ${agentId} is ${result.status}`), {
        code: result.status === 'busy_mismatch' ? 'AGENT_PROCESS_ROUTE_BUSY' : 'AGENT_PROCESS_REAPING',
      })
    })
  }

  function ensureIfBound(agentId, currentProcess, routeGate) {
    try {
      if (!hasPolicy(agentId) && currentProcess?.nativeToolPolicy === undefined) return undefined
      return ensureRunning(agentId, routeGate)
    } catch (error) {
      return Promise.reject(error)
    }
  }

  return { prepareWanted, prepareStartupConfig, ensureIfBound }
}
