/** CTR-W1: Router caller budgets, independent of AgentProcess deadlines.
 * Deployment-owned configuration is snapshotted once at Router apply time.
 * No message, Binding, Session or model-supplied class is consulted here.
 */
export const CALLER_WAIT_ENV = 'DSH_AGENT_CALLER_WAIT_TIMEOUT_MS'

function objectEntries(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`agent-router: callerWait.${name} must be an object`)
  }
  return Object.entries(value)
}

function positiveMs(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`agent-router: ${name} must be a positive safe integer`)
  }
  return value
}

function timeoutMap(value, name) {
  return new Map(objectEntries(value, name).map(([key, ms]) => {
    if (key.trim() === '') throw new TypeError(`agent-router: callerWait.${name} keys must be non-empty`)
    return [key, positiveMs(ms, `callerWait.${name}.${key}`)]
  }))
}

/** env > class > surface > existing per-Agent turn-budget fallback.
 * `agentIds` and `resolveDefaultMs` come from the Router composition, never
 * from an ingress. Explicit route-chain deadlines (e.g. Scheduler) still win.
 */
export function createCallerWaitResolver({ config = {}, env = process.env, agentIds, resolveDefaultMs }) {
  for (const [key] of objectEntries(config, 'config')) {
    if (!['bySurface', 'byClass', 'agentClasses'].includes(key)) {
      throw new TypeError(`agent-router: unknown callerWait field ${key}`)
    }
  }
  const bySurface = timeoutMap(config.bySurface === undefined ? {} : config.bySurface, 'bySurface')
  const byClass = timeoutMap(config.byClass === undefined ? {} : config.byClass, 'byClass')
  for (const surface of bySurface.keys()) {
    if (!['feishu', 'mobile'].includes(surface)) {
      throw new TypeError(`agent-router: unknown callerWait surface ${surface}`)
    }
  }
  const knownAgents = new Set(agentIds)
  const agentClasses = new Map(objectEntries(config.agentClasses === undefined ? {} : config.agentClasses, 'agentClasses'))
  for (const [agentId, agentClass] of agentClasses) {
    if (!knownAgents.has(agentId)) throw new TypeError(`agent-router: callerWait names unknown agent ${agentId}`)
    if (typeof agentClass !== 'string' || !byClass.has(agentClass)) {
      throw new TypeError(`agent-router: callerWait names unknown class for ${agentId}`)
    }
  }
  const raw = env[CALLER_WAIT_ENV]
  let envMs
  if (raw !== undefined && raw !== '') {
    if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) {
      throw new TypeError(`agent-router: ${CALLER_WAIT_ENV} must be a positive safe integer`)
    }
    envMs = positiveMs(Number(raw), CALLER_WAIT_ENV)
  }
  return (agentId, surface) => envMs
    ?? byClass.get(agentClasses.get(agentId))
    ?? bySurface.get(surface)
    ?? resolveDefaultMs(agentId)
}
