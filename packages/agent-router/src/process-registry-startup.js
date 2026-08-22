/** Normalize dependency failures into an extensible startup carrier. */
export async function disposeProcessSlots(lifecycleSlots, failNoChild) {
  const shutdowns = []
  const seen = new Set()
  for (const [agentId, slot] of lifecycleSlots) {
    const proc = slot.processRef
    if (slot.state === 'STARTUP' && proc === null) {
      failNoChild(agentId, slot)
      continue
    }
    if (proc !== null && proc !== undefined && !seen.has(proc) && typeof proc.shutdown === 'function') {
      seen.add(proc)
      shutdowns.push(Promise.resolve().then(() => proc.shutdown()).catch(() => proc.exitPromise)
        .then(() => proc.exitPromise ?? proc.exit))
    }
  }
  await Promise.allSettled(shutdowns)
}

export function convergeStartedStartup({ agentId, entry, cause, empty, reap, settle, teardownFailure }) {
  const error = startupFailure(cause, {
    agentId, generation: entry.generation, stage: entry.startupFailureStage ?? 'startup',
  })
  const proc = entry.processRef
  const hasChild = proc.ownership !== null && proc.ownership !== undefined
  if (hasChild) reap(agentId, proc, 'startup_failure')
  else empty(agentId, proc)
  settle(entry, error)
  try {
    if (hasChild && typeof proc.fatal === 'function') proc.fatal('startup_failure')
    else if (hasChild) void proc.shutdown?.()
  } catch (fatalCause) { teardownFailure(fatalCause) }
}

export function startupFailure(cause, { agentId, generation, stage }) {
  const error = new Error(cause instanceof Error ? cause.message : String(cause))
  error.name = cause instanceof Error ? cause.name : 'Error'
  if (cause?.code !== undefined) error.code = cause.code
  error.agentId = agentId
  error.processGeneration = generation
  error.startupFailureStage = stage
  return error
}
