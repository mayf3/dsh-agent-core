/**
 * Local, Feishu-independent recovery consumer.
 *
 * The consumer deliberately knows only the workflow execution kick outbox
 * contract and injected local capabilities.  It does not load Core, consult
 * HR admission, read a user token, or speak a chat transport.  A recovery
 * actor must be distinct from the fenced owner; the original owner is only
 * accepted again after the recovery takeover has succeeded.
 */

const DEFAULT_POLL_INTERVAL_MS = 1_000

function invalid(message) {
  return Object.assign(new TypeError(`local-recovery-consumer: ${message}`), { code: 'VALIDATION_ERROR' })
}

function assertItem(item) {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) throw invalid('outbox item must be an object')
  for (const field of ['eventKey', 'agentId', 'ownerActorId', 'recoveryActorId']) {
    if (typeof item[field] !== 'string' || item[field].trim() === '') throw invalid(`${field} must be non-empty`)
  }
  if (!Number.isSafeInteger(item.generation) || item.generation < 1) throw invalid('generation must be a positive safe integer')
  if (item.recoveryActorId === item.ownerActorId) {
    throw Object.assign(new Error('recovery actor must be independent from the fenced owner'), { code: 'RECOVERY_ACTOR_NOT_INDEPENDENT' })
  }
}

/**
 * @param {object} deps
 * @param {{poll: Function, ack?: Function}} deps.outbox poll() returns an array
 * @param {{register: Function, recordFailure?: Function}} deps.diagnostics
 * @param {{waitUntilWakeable: Function}} deps.readiness
 * @param {{takeover: Function, acceptOriginalRole: Function}} deps.recovery
 * @param {string} deps.recoveryActorId fixed local recovery identity
 */
export function createLocalRecoveryConsumer(deps) {
  if (deps === null || typeof deps !== 'object') throw invalid('dependencies are required')
  const { outbox, diagnostics, readiness, recovery } = deps
  if (typeof outbox?.poll !== 'function') throw invalid('outbox.poll is required')
  if (typeof diagnostics?.register !== 'function') throw invalid('diagnostics.register is required')
  if (typeof readiness?.waitUntilWakeable !== 'function') throw invalid('readiness.waitUntilWakeable is required')
  if (typeof recovery?.takeover !== 'function') throw invalid('recovery.takeover is required')
  if (typeof recovery?.acceptOriginalRole !== 'function') throw invalid('recovery.acceptOriginalRole is required')
  if (typeof deps.recoveryActorId !== 'string' || deps.recoveryActorId.trim() === '') throw invalid('recoveryActorId is required')

  const pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 1) throw invalid('pollIntervalMs must be positive')
  const clock = deps.clock ?? { setTimeout, clearTimeout }
  const seen = new Map()
  const inFlight = new Map()
  let stopped = true
  let timer = null

  async function processItem(rawItem) {
    try {
      assertItem(rawItem)
      if (rawItem.recoveryActorId !== deps.recoveryActorId) {
        throw Object.assign(new Error('outbox recovery actor does not match this consumer'), { code: 'WRONG_RECOVERY_ACTOR' })
      }
    } catch (error) {
      await diagnostics.recordFailure?.({ ...(rawItem ?? {}), error: { code: error?.code, message: error?.message } })
      throw error
    }
    const key = rawItem.eventKey
    if (seen.has(key)) return { eventKey: key, status: 'duplicate', result: seen.get(key) }
    if (inFlight.has(key)) return inFlight.get(key)

    const operation = (async () => {
      const diagnostic = await diagnostics.register({ ...rawItem, consumer: 'local-recovery' })
      await readiness.waitUntilWakeable(rawItem)
      const takeover = await recovery.takeover({ ...rawItem, diagnostic, recoveryActorId: deps.recoveryActorId })
      // The final acceptance is intentionally separate from takeover: it
      // proves the original role can be routed again after the fence clears.
      const accepted = await recovery.acceptOriginalRole({ ...rawItem, takeover, ownerActorId: rawItem.ownerActorId })
      const result = { eventKey: key, status: 'recovered', diagnostic, takeover, accepted }
      seen.set(key, result)
      if (typeof outbox.ack === 'function') await outbox.ack(rawItem, result)
      return result
    })()
    inFlight.set(key, operation)
    try {
      return await operation
    } catch (error) {
      await diagnostics.recordFailure?.({ ...rawItem, error: { code: error?.code, message: error?.message } })
      throw error
    } finally {
      inFlight.delete(key)
    }
  }

  async function pollOnce() {
    const items = await outbox.poll()
    if (!Array.isArray(items)) throw invalid('outbox.poll must return an array')
    const results = []
    for (const item of items) {
      try { results.push(await processItem(item)) } catch (error) {
        results.push({ eventKey: item?.eventKey ?? null, status: 'failed', error })
      }
    }
    return results
  }

  async function loop() {
    if (stopped) return
    try {
      await pollOnce()
    } catch (error) {
      await diagnostics.recordFailure?.({ consumer: 'local-recovery', error: { code: error?.code, message: error?.message } })
    } finally {
      if (!stopped) timer = clock.setTimeout(loop, pollIntervalMs)
    }
  }

  return {
    processItem,
    pollOnce,
    start() {
      if (!stopped) return false
      stopped = false
      void loop()
      return true
    },
    stop() {
      stopped = true
      if (timer !== null) clock.clearTimeout(timer)
      timer = null
    },
    snapshot() { return { running: !stopped, processedEventKeys: [...seen.keys()], inFlightEventKeys: [...inFlight.keys()] } },
  }
}

export const LOCAL_RECOVERY_CONSUMER_DEFAULT_POLL_INTERVAL_MS = DEFAULT_POLL_INTERVAL_MS
