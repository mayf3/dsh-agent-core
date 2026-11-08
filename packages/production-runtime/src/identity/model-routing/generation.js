// CTR-RCG-001..005: one synchronous publication boundary and lifecycle-local G.
import { verifyModelArtifactContext } from '../../../../agent-provisioning/src/deployment-artifact.js'
import { invalid } from '../provider-environment.js'
import { validateCapturedModelOverrides } from './validator.js'
import { captureRoutingInputs, immutable, targetClosure } from './inputs.js'

export function createRoutingConfigRuntime({ file, registeredAgentIds, readContext, log = {}, beforeActivate }) {
  const registered = immutable([...registeredAgentIds].sort())
  let active = null
  let publication = null
  let sequence = 0
  let closed = false

  function observation(decision, extra = {}) {
    return immutable({
      candidateId: publication?.candidate.candidateId ?? null,
      activeGenerationId: active?.generationId ?? null,
      decision,
      ...(publication?.error ? {
        rejectionClass: publication.referenceOnly ? 'unknown_route_refs' : 'candidate_invalid',
        errorAgents: [...new Set(publication.referenceOnly ? publication.error.unknownReferences.map(item => item.agentId) : [])],
      } : {}),
      ...extra,
    })
  }

  function emit(event) {
    log.log?.(`routing-config ${JSON.stringify(event)}`)
    return event
  }

  function superseded(candidateId) {
    return emit(immutable({ candidateId, activeGenerationId: active?.generationId ?? null,
      decision: closed ? 'closed' : 'superseded' }))
  }

  function commit(candidate, ticket) {
    let validated
    try {
      validated = validateCapturedModelOverrides(candidate, registered, candidate.context.options ?? {})
      beforeActivate?.(Object.freeze({ candidateId: candidate.candidateId }))
    } catch (error) {
      if (ticket !== sequence || closed) return superseded(candidate.candidateId)
      publication = Object.freeze({ candidate, error, referenceOnly: !validated && error.unknownReferences !== undefined })
      return emit(observation('rejected'))
    }
    // Reentrant publications cannot let an earlier validation overwrite a later
    // confirmed generation. No await or callback occurs inside this commit.
    if (ticket !== sequence || closed) return superseded(candidate.candidateId)
    active = Object.freeze({ generationId: candidate.candidateId, candidate, validated })
    publication = Object.freeze({ candidate })
    return emit(observation('activated'))
  }

  function refresh(force = false) {
    if (closed) throw Object.assign(invalid('routing runtime lifecycle ended'), { configGeneration: observation('refuse') })
    const ticket = ++sequence
    let candidate
    try {
      candidate = captureRoutingInputs(file, registered, readContext)
      verifyModelArtifactContext(candidate.context.options ?? {})
    } catch (error) {
      if (ticket !== sequence || closed) return superseded(null)
      // An unreadable input has no provable candidate identity or closure.
      publication = Object.freeze({ candidate: { candidateId: null }, error })
      return emit(observation('rejected'))
    }
    if (ticket !== sequence || closed) return superseded(candidate.candidateId)
    if (force || publication?.candidate.candidateId !== candidate.candidateId) return commit(candidate, ticket)
  }

  function resolveChain(agentId) {
    refresh()
    if (closed) throw Object.assign(invalid('routing runtime lifecycle ended'), { configGeneration: observation('refuse') })
    let allowed = active !== null && !publication.error
    let closureUnchanged = false
    if (!allowed && active && publication.referenceOnly
        && !publication.error.unknownReferences.some(item => item.agentId === agentId)) {
      // The validator attaches this collection only after ALL non-reference
      // checks pass. Candidate projections prove equality; values still come G0.
      const current = targetClosure(publication.candidate, agentId)
      closureUnchanged = current !== undefined && current === targetClosure(active.candidate, agentId)
      allowed = closureUnchanged
    }
    const event = observation(allowed ? (publication.error ? 'continue' : 'active') : 'refuse', {
      agentId, closureUnchanged,
    })
    if (!allowed) {
      emit(event)
      const cause = publication.error ?? invalid('no trusted routing generation')
      // No candidate fields or raw error message enter a diagnostic/journal.
      throw Object.assign(new Error(cause.message, { cause }), { code: cause.code, configGeneration: event })
    }
    if (publication.error) emit(event)
    const snapshot = active.validated.resolveChain(agentId, active.candidate.context.globalRoute)
    return Object.freeze({ ...snapshot, generationId: active.generationId, configGeneration: event })
  }

  refresh(true)
  if (!active) throw Object.assign(publication.error, { configGeneration: observation('refuse') })
  return Object.freeze({
    resolveChain,
    publish: () => refresh(true),
    get activeGeneration() {
      return active && Object.freeze({ generationId: active.generationId, overrides: active.validated.overrides })
    },
    close() { closed = true; active = null; publication = null; sequence += 1 },
  })
}
