import { createHash } from 'node:crypto'
import { canonicalJSON } from '../occurrence-model.js'
import { compileIncidents } from './incident-compiler.js'

const VERSION = 1

export function notificationKey({ incident, incidentId, transitionRevision, transitionKind, routeClass }) {
  const payload = {
    incidentId: incidentId ?? incident?.incidentId,
    transitionRevision: transitionRevision ?? incident?.transitionRevision,
    transitionKind,
    routeClass: routeClass ?? incident?.routeClass,
  }
  return createHash('sha256').update(canonicalJSON(payload), 'utf8').digest('hex')
}

function initialState(state) {
  if (state === undefined || state === null || Object.keys(state).length === 0) {
    return { version: VERSION, incidents: {}, outbox: {} }
  }
  if (state.version !== VERSION || state.incidents === null || typeof state.incidents !== 'object'
    || state.outbox === null || typeof state.outbox !== 'object') {
    throw new TypeError('unsupported incident state')
  }
  return structuredClone(state)
}

function transitionIntent(record, transitionKind, nowMs) {
  record.transitionRevision += 1
  record.alertState.lastTransitionAt = nowMs
  const intent = {
    incident: structuredClone(record),
    incidentId: record.incidentId,
    transitionRevision: record.transitionRevision,
    transitionKind,
    routeClass: record.routeClass,
    producer: record.producer,
  }
  intent.notificationKey = notificationKey(intent)
  return intent
}

function persistIntent(state, notifications, intent) {
  intent.incident.alertState.delivery = 'PENDING'
  state.incidents[intent.incident.rootIdentity].alertState.delivery = 'PENDING'
  state.outbox[intent.notificationKey] ??= {
    ...intent,
    delivery: 'PENDING',
    payloadRevision: intent.transitionRevision,
  }
  notifications.push(intent)
}

export function updateIncidentState(inputState, currentIncidents, {
  nowMs = Date.now(), acknowledgments = new Set(), ownsIncident = () => true, producer = 'w1',
} = {}) {
  const state = initialState(inputState)
  const notifications = []
  const seen = new Set()
  for (const input of currentIncidents ?? []) {
    const rootIdentity = input.rootIdentity
    seen.add(rootIdentity)
    let record = state.incidents[rootIdentity]
    if (record?.lifecycle?.startsWith('CLOSED_')) {
      if (rootIdentity.startsWith('occurrence|')) continue
      record = {
        ...structuredClone(input), producer, episode: record.episode + 1,
        incidentId: `${rootIdentity}|episode:${record.episode + 1}`,
        lifecycle: 'OPEN', transitionRevision: 0, firstSeenAt: nowMs, lastSeenAt: nowMs,
        alertState: { lifecycle: 'OPEN', delivery: 'PENDING', incidentKey: rootIdentity, lastTransitionAt: nowMs },
      }
      state.incidents[rootIdentity] = record
      persistIntent(state, notifications, transitionIntent(record, 'OPEN', nowMs))
      continue
    }
    if (record === undefined) {
      record = {
        ...structuredClone(input), producer, episode: 1, incidentId: `${rootIdentity}|episode:1`,
        lifecycle: 'OPEN', transitionRevision: 0, firstSeenAt: nowMs, lastSeenAt: nowMs,
        alertState: { lifecycle: 'OPEN', delivery: 'PENDING', incidentKey: rootIdentity, lastTransitionAt: nowMs },
      }
      state.incidents[rootIdentity] = record
      persistIntent(state, notifications, transitionIntent(record, 'OPEN', nowMs))
    } else {
      record.producer ??= producer
      record.lastSeenAt = nowMs
      record.facts = structuredClone(input.facts)
      record.symptoms = structuredClone(input.symptoms)
    }
    if (record.lifecycle === 'OPEN' && acknowledgments.has(rootIdentity)) {
      record.lifecycle = 'CLOSED_ACKNOWLEDGED'
      record.alertState.lifecycle = record.lifecycle
      persistIntent(state, notifications, transitionIntent(record, 'CLOSED_ACKNOWLEDGED', nowMs))
    }
  }
  for (const [rootIdentity, record] of Object.entries(state.incidents)) {
    if (record.lifecycle !== 'OPEN' || seen.has(rootIdentity) || !ownsIncident(record)) continue
    record.lifecycle = 'CLOSED_RECOVERED'
    record.alertState.lifecycle = record.lifecycle
    persistIntent(state, notifications, transitionIntent(record, 'CLOSED_RECOVERED', nowMs))
  }
  return { state, notifications }
}

export function bindNotificationDelivery(inputState, key, { producer, route, routeSource, routingSha256, payload, providerKey }, nowMs = Date.now()) {
  const state = initialState(inputState)
  const intent = state.outbox[key]
  if (!intent) throw new TypeError(`unknown notification key: ${key}`)
  if (!Number.isSafeInteger(nowMs) || nowMs < intent.incident.alertState.lastTransitionAt) {
    throw new TypeError('notification delivery binding time is invalid')
  }
  const binding = { producer, route: structuredClone(route), routeSource, routingSha256, payload, providerKey }
  if (intent.deliveryBinding !== undefined && canonicalJSON(intent.deliveryBinding) !== canonicalJSON(binding)) {
    throw new Error('notification delivery binding conflict')
  }
  intent.deliveryBinding ??= binding
  intent.deliveryBindingAt ??= nowMs
  return state
}

export function markNotificationDelivery(inputState, key, delivery, nowMs = Date.now()) {
  if (!['PENDING', 'DELIVERED', 'FAILED', 'OUTCOME_UNKNOWN'].includes(delivery)) throw new TypeError('invalid notification delivery state')
  const state = initialState(inputState)
  const intent = state.outbox[key]
  if (!intent) throw new TypeError(`unknown notification key: ${key}`)
  const chronologyFloor = intent.firstDeliveryAttemptAt ?? intent.deliveryBindingAt ?? intent.incident.alertState.lastTransitionAt
  if (!Number.isSafeInteger(nowMs) || nowMs < chronologyFloor) throw new TypeError('notification delivery update time is invalid')
  const attempted = ['OUTCOME_UNKNOWN', 'DELIVERED'].includes(delivery) || (delivery === 'FAILED' && intent.deliveryBinding !== undefined)
  if (attempted && intent.deliveryBinding === undefined) throw new TypeError('attempted notification delivery requires an immutable binding')
  if (['DELIVERED', 'FAILED'].includes(delivery) && intent.deliveryBinding !== undefined
    && !Number.isSafeInteger(intent.firstDeliveryAttemptAt)) throw new TypeError('terminal notification delivery requires durable attempt evidence')
  intent.delivery = delivery
  intent.deliveryUpdatedAt = nowMs
  if (delivery === 'OUTCOME_UNKNOWN') intent.firstDeliveryAttemptAt ??= nowMs
  const rootIdentity = intent.incident?.rootIdentity
  if (rootIdentity && state.incidents[rootIdentity]) state.incidents[rootIdentity].alertState.delivery = delivery
  return state
}

export function legacyFingerprint(fact) {
  const occurrenceId = fact.occurrenceId ?? fact.runId ?? '-'
  return ['RUN_STUCK', 'RUN_FAILED', 'EXPECTED_RUN_MISSED', 'CONSECUTIVE_FAILURE', 'ADMISSION_BLOCKED_UNKNOWN'].includes(fact.class)
    ? `${fact.class}|${fact.jobId ?? '-'}|${occurrenceId}`
    : `${fact.class}|${fact.logicalKey ?? fact.jobId ?? fact.stableSubjectId ?? '-'}`
}

export function migrateLegacyAlertState(legacy, findings, {
  deliveredFingerprints = new Set(), failedFingerprints = new Set(), legacyFacts = new Map(), nowMs = Date.now(),
} = {}) {
  if (legacy === null || typeof legacy !== 'object' || Array.isArray(legacy)) throw new TypeError('legacy state must be an object')
  const collections = legacy.active === undefined && legacy.acknowledged === undefined && legacy.retired === undefined
    ? { active: legacy, acknowledged: {}, retired: {} }
    : { active: legacy.active ?? {}, acknowledged: legacy.acknowledged ?? {}, retired: legacy.retired ?? {} }
  const currentByFingerprint = new Map((findings ?? []).map((fact) => [legacyFingerprint(fact), fact]))
  const factEvidence = legacyFacts instanceof Map ? legacyFacts : new Map(Object.entries(legacyFacts ?? {}))
  const entries = new Map()
  for (const [phase, values] of Object.entries(collections)) {
    if (values === null || typeof values !== 'object' || Array.isArray(values)) throw new TypeError(`legacy ${phase} must be an object`)
    for (const [fingerprint, value] of Object.entries(values)) {
      if (entries.has(fingerprint)) throw new TypeError(`legacy fingerprint appears in multiple lifecycle sets: ${fingerprint}`)
      const fact = currentByFingerprint.get(fingerprint) ?? factEvidence.get(fingerprint)
      if (!fact || legacyFingerprint(fact) !== fingerprint) throw new TypeError(`legacy fingerprint has no exact fact evidence: ${fingerprint}`)
      if (phase === 'active' && !currentByFingerprint.has(fingerprint)) throw new TypeError(`legacy active fingerprint has no exact current fact: ${fingerprint}`)
      if (phase === 'retired' && currentByFingerprint.has(fingerprint)) throw new TypeError(`legacy retired fingerprint still has a current fact: ${fingerprint}`)
      entries.set(fingerprint, { phase, value, fact })
    }
  }
  const compiled = compileIncidents([...entries.values()].map((entry) => entry.fact)).incidents
  const migrated = { version: VERSION, incidents: {}, outbox: {} }
  for (const incident of compiled) {
    const memberFingerprints = incident.facts.map(legacyFingerprint)
    const phases = new Set(memberFingerprints.map((fp) => entries.get(fp).phase))
    if (phases.size !== 1) throw new TypeError(`legacy root has conflicting lifecycle evidence: ${incident.rootIdentity}`)
    const phase = [...phases][0]
    const lifecycle = phase === 'acknowledged' ? 'CLOSED_ACKNOWLEDGED' : phase === 'retired' ? 'CLOSED_RECOVERED' : 'OPEN'
    const delivered = memberFingerprints.some((fp) => deliveredFingerprints.has(fp))
    const allFailed = memberFingerprints.every((fp) => failedFingerprints.has(fp))
    if (lifecycle === 'OPEN' && !delivered && !allFailed) throw new TypeError(`legacy delivery evidence ambiguous for ${incident.rootIdentity}`)
    const firstSeenAt = Math.min(...memberFingerprints.map((fp) => entries.get(fp).value?.firstSeenAt).filter(Number.isFinite), nowMs)
    const producer = incident.stableSubjectId === 'watchdog:w1' ? 'w2' : 'w1'
    const record = {
      ...structuredClone(incident), episode: 1, incidentId: `${incident.rootIdentity}|episode:1`,
      producer, lifecycle, transitionRevision: 1, firstSeenAt, lastSeenAt: nowMs,
      alertState: { lifecycle, delivery: lifecycle === 'OPEN' ? (delivered ? 'DELIVERED' : 'FAILED') : 'DELIVERED', incidentKey: incident.rootIdentity, lastTransitionAt: nowMs },
    }
    migrated.incidents[incident.rootIdentity] = record
    if (lifecycle === 'OPEN' && !delivered) {
      const intent = { incident: structuredClone(record), incidentId: record.incidentId, transitionRevision: 1, transitionKind: 'OPEN', routeClass: record.routeClass, producer }
      const key = notificationKey(intent)
      migrated.outbox[key] = { ...intent, notificationKey: key, delivery: 'PENDING', payloadRevision: 1 }
    }
  }
  return migrated
}

/** Compatibility name for existing pure consumers; identity is now root-cause based. */
export function findingFingerprint(finding) {
  return compileIncidents([finding]).incidents[0]?.rootIdentity
}

/**
 * Compatibility adapter over the accepted root-incident lifecycle. It intentionally ignores
 * reminder/cooldown options: unchanged state never emits a user notification.
 */
export function updateAlertState(state, findings, { nowMs = Date.now(), ownsIncident, producer } = {}) {
  const compiled = compileIncidents(findings).incidents
  const acknowledgments = new Set(compiled
    .filter((incident) => incident.facts.some((fact) => fact.disposition?.basis === 'operator-reconcile'))
    .map((incident) => incident.rootIdentity))
  const result = updateIncidentState(state, compiled, { nowMs, acknowledgments, ...(ownsIncident ? { ownsIncident } : {}), ...(producer ? { producer } : {}) })
  return {
    state: result.state,
    notifications: result.notifications.map((intent) => ({
      fingerprint: intent.incident.rootIdentity,
      kind: intent.transitionKind === 'OPEN' ? 'new'
        : intent.transitionKind === 'CLOSED_ACKNOWLEDGED' ? 'acknowledged'
          : intent.transitionKind === 'CLOSED_RECOVERED' ? 'recovered' : 'severity',
      finding: intent.incident.facts[0] ?? { class: intent.incident.rootCauseClass },
      notificationKey: intent.notificationKey,
      routeClass: intent.routeClass,
    })),
    recovered: result.notifications.filter((item) => item.transitionKind === 'CLOSED_RECOVERED').map((item) => item.incident.rootIdentity),
  }
}
