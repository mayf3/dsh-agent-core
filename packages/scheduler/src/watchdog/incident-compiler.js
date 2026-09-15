import { canonicalJSON } from '../occurrence-model.js'

const OCCURRENCE_CLASSES = new Set(['RUN_FAILED', 'RUN_STUCK', 'ADMISSION_BLOCKED_UNKNOWN'])
const JOB_CLASSES = new Set([
  'CONSECUTIVE_FAILURE', 'JOB_DISABLED', 'SCHEDULE_DRIFT', 'TIMEZONE_DRIFT',
  'TARGET_AGENT_DRIFT', 'JOB_CONFIGURATION_INVALID', 'EXPECTED_RUN_MISSED',
])

export const ROOT_CAUSE_CLASSES = Object.freeze({
  RUN_STUCK_OUTCOME_UNKNOWN: 'RUN_STUCK_OUTCOME_UNKNOWN',
})

export function stableIncidentFact({ overdueMs: _overdueMs, ...fact }) { return fact }

export function canonicalIncidentFactSet(facts = []) {
  const values = new Map()
  for (const fact of facts) {
    const stable = stableIncidentFact(fact)
    values.set(canonicalJSON(stable), stable)
  }
  return [...values.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, fact]) => fact)
}

export function incidentRootIdentity(input) {
  const rootCauseClass = nonEmpty(input?.rootCauseClass, 'rootCauseClass')
  if (input.occurrenceId !== undefined) {
    return `occurrence|${rootCauseClass}|${nonEmpty(input.jobId, 'jobId')}|${nonEmpty(input.occurrenceId, 'occurrenceId')}`
  }
  if (input.jobRevision !== undefined) {
    return `job|${rootCauseClass}|${nonEmpty(input.jobId, 'jobId')}|${String(input.jobRevision)}`
  }
  return `control|${rootCauseClass}|${nonEmpty(input.subjectKind, 'subjectKind')}|${nonEmpty(input.stableSubjectId, 'stableSubjectId')}`
}

function nonEmpty(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be non-empty`)
  return value
}

function routeClassFor(rootCauseClass) {
  return ['RUN_FAILED', 'CONSECUTIVE_FAILURE'].includes(rootCauseClass)
    ? 'JOB_FAILURE'
    : 'SCHEDULER_CONTROL_PLANE_INCIDENT'
}

function occurrenceIdentity(fact) {
  return fact.occurrenceId ?? fact.runId
}

function rootInputFor(fact) {
  if (fact.class === 'ADMISSION_BLOCKED_UNKNOWN') {
    return {
      rootCauseClass: ROOT_CAUSE_CLASSES.RUN_STUCK_OUTCOME_UNKNOWN,
      jobId: fact.jobId,
      occurrenceId: occurrenceIdentity(fact),
    }
  }
  if (fact.class === 'EXPECTED_RUN_MISSED' && fact.derivedUnderAdmissionBlock && occurrenceIdentity(fact)) {
    return {
      rootCauseClass: ROOT_CAUSE_CLASSES.RUN_STUCK_OUTCOME_UNKNOWN,
      jobId: fact.jobId,
      occurrenceId: occurrenceIdentity(fact),
    }
  }
  if (OCCURRENCE_CLASSES.has(fact.class) && occurrenceIdentity(fact)) {
    return { rootCauseClass: fact.class, jobId: fact.jobId, occurrenceId: occurrenceIdentity(fact) }
  }
  if (JOB_CLASSES.has(fact.class) && fact.jobId && fact.jobRevision !== undefined) {
    return { rootCauseClass: fact.class, jobId: fact.jobId, jobRevision: fact.jobRevision }
  }
  return {
    rootCauseClass: fact.class,
    subjectKind: fact.subjectKind ?? (fact.jobId ? 'job' : 'watchdog'),
    stableSubjectId: fact.stableSubjectId ?? fact.jobId ?? fact.logicalKey ?? stableControlSubject(fact.class),
  }
}

function stableControlSubject(findingClass) {
  if (findingClass === 'SCHEDULER_WATCHDOG_W2_FAILURE') return 'watchdog:w2'
  if (findingClass === 'SCHEDULER_WATCHDOG_FAILURE') return 'watchdog:w1'
  if (findingClass === 'SCHEDULER_RUNTIME_UNHEALTHY') return 'scheduler-runtime'
  if (findingClass === 'CREDENTIAL_PROVIDER_DEGRADED') return 'credential-provider'
  return `watchdog:${findingClass}`
}

export function compileIncidents(findings = []) {
  const facts = findings.map((fact) => ({ ...fact }))
  const compiled = new Map()
  for (const fact of facts) {
    const root = rootInputFor(fact)
    const rootIdentity = incidentRootIdentity(root)
    const current = compiled.get(rootIdentity) ?? {
      ...root,
      rootIdentity,
      routeClass: routeClassFor(root.rootCauseClass),
      facts: [],
      symptoms: [],
    }
    current.facts.push(fact)
    if (!current.symptoms.includes(fact.class) && fact.class !== root.rootCauseClass) current.symptoms.push(fact.class)
    compiled.set(rootIdentity, current)
  }
  return { facts, incidents: [...compiled.values()].sort((a, b) => a.rootIdentity.localeCompare(b.rootIdentity)) }
}
