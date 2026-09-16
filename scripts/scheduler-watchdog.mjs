#!/usr/bin/env node
/**
 * scheduler-watchdog — host-side owner-watch runner (roles W1 | W2).
 *
 * SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 §5.6/§5.7. Launchd installs this
 * twice with DIFFERENT failure domains (see deployment-artifacts/
 * scheduler-control-plane-reliability-v1/):
 *
 *   W1 (authsvc, every 5m):  desired-state vs canonical store + run-health
 *                            detectors + runtime health probe; alerts via
 *                            Feishu DIRECT API (reuses the existing feishu
 *                            credentials file READ-ONLY); writes the W1
 *                            heartbeat; checks the W2 heartbeat (mutual
 *                            liveness — W2 death alerts from W1).
 *   W2 (root, every 15m):    reads ONLY the W1 heartbeat file; stale past
 *                            grace -> Feishu alert (SCHEDULER_WATCHDOG_
 *                            FAILURE). Keeps launchd KeepAlive = recovery,
 *                            alerting = this script. Writes the W2 heartbeat
 *                            so W1 can reciprocally detect W2 death.
 *
 * READ-ONLY over the store, credentials, and evidence log. No secret bytes
 * are ever logged or copied. A delivery failure falls back to an alert file
 * plus a non-zero exit code (launchd-visible last resort).
 *
 * Config (env): SCHEDULER_WATCHDOG_ROLE (w1|w2), SCHEDULER_WATCHDOG_STORE,
 * SCHEDULER_DESIRED_STATE, SCHEDULER_WATCHDOG_STATE_DIR, SCHEDULER_HEALTH_URL,
 * FEISHU_CREDS_PATH, SCHEDULER_WATCHDOG_HEARTBEAT_GRACE_MS,
 * SCHEDULER_ROUTING_MANIFEST (deployment-owned protected routing config).
 *
 * Usage: scheduler-watchdog.mjs [--role w1|w2] [--dry-run] [--migrate-incident-state]
 */

import { existsSync, readFileSync, writeFileSync, statSync, mkdirSync, appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const DELIVER_TEST = process.argv.includes('--deliver-test')
const MIGRATE_STATE = process.argv.includes('--migrate-incident-state')
const roleArg = process.argv[process.argv.indexOf('--role') + 1]
const roleArgValid = ['w1', 'w2'].includes((roleArg ?? '').toLowerCase())
const ROLE = (roleArgValid ? roleArg : (process.env.SCHEDULER_WATCHDOG_ROLE ?? (DELIVER_TEST ? 'w1' : 'w1'))).toLowerCase()
const DRY_RUN = process.argv.includes('--dry-run')
const STORE = process.env.SCHEDULER_WATCHDOG_STORE
  ?? (ROLE === 'w1' ? '/Users/authsvc/.agent-core/scheduler/jobs.json' : undefined)
const DESIRED_STATE = process.env.SCHEDULER_DESIRED_STATE ?? '/usr/local/libexec/agent-core/config/scheduler-desired-state.json'
// HEARTBEAT/evidence dir MUST BE SHARED BY BOTH ROLES (audit blocker: split
// dirs make the mutual check fire permanently). W2 runs as root and can read
// authsvc's control dir; W1 (authsvc) reads the root-written w2 heartbeat
// (mode 0644). One dir, two failure domains — different uid/label/period.
const SHARED_STATE_DIR = process.env.SCHEDULER_WATCHDOG_STATE_DIR
  ?? '/Users/authsvc/.agent-core/control/scheduler-watchdog'
const STATE_DIR = SHARED_STATE_DIR
const HEALTH_URL = process.env.SCHEDULER_HEALTH_URL ?? 'http://127.0.0.1:8790/health'
const FEISHU_CREDS = process.env.FEISHU_CREDS_PATH ?? (ROLE === 'w1' ? '/Users/authsvc/.dsh/feishu-creds.json' : undefined)
const ROUTING_MANIFEST = process.env.SCHEDULER_ROUTING_MANIFEST
  ?? '/usr/local/libexec/agent-core/config/scheduler-routing.json'
// Per-direction grace: each side allows 3x the PEER's launchd period.
const HEARTBEAT_GRACE_MS = Number(process.env.SCHEDULER_WATCHDOG_HEARTBEAT_GRACE_MS
  ?? (ROLE === 'w1' ? 45 * 60 * 1000 : 30 * 60 * 1000))
// Reconciliation evidence (§5.2/§5.6): written by the CHILD relay (uid 502),
// read by W1. Defaults to the shared provisioning dir — the production packet
// provisions it writable by the child uid and readable by authsvc.
// §5.6 credential self-probe: W1 watches the mutation credential file's
// presence (never its bytes) — its absence makes every scheduler mutation
// capability_unavailable, which is exactly the silent-failure class this
// goal exists to prevent.
const CREDENTIAL_FILE = process.env.SCHEDULER_CREDENTIALS_FILE
  ?? '/usr/local/libexec/agent-core/config/agent-credentials.json'
const INCIDENT_STATE_FILE = process.env.SCHEDULER_INCIDENT_STATE
  ?? join(STATE_DIR, 'incidents.json')
const RECONCILIATION_EVIDENCE = process.env.SCHEDULER_RECONCILIATION_EVIDENCE_FILE
  ?? '/usr/local/var/scheduler-watchdog/reconciliation-evidence.jsonl'
const W1_HEARTBEAT = join(STATE_DIR, 'w1.heartbeat')
const W2_HEARTBEAT = join(STATE_DIR, 'w2.heartbeat')
const EVIDENCE_LOG = join(STATE_DIR, 'scheduler-watchdog-evidence.jsonl')
const LOCAL_OPS_SINK = join(STATE_DIR, 'local-ops.jsonl')

const usage = () => {
  process.stderr.write('usage: scheduler-watchdog.mjs --role w1|w2 [--dry-run]\n')
  process.exit(2)
}
if (!['w1', 'w2'].includes(ROLE) || (ROLE === 'w1' && !STORE)) usage()

function heartbeatPathFor(role) { return role === 'w1' ? W1_HEARTBEAT : W2_HEARTBEAT }

function touchHeartbeat(role, nowMs) {
  mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
  writeFileSync(heartbeatPathFor(role), `${JSON.stringify({ role, ts: nowMs })}\n`)
}

function readHeartbeatAgeMs(path, nowMs) {
  try {
    return nowMs - statSync(path).mtimeMs
  } catch {
    return null // missing = stale
  }
}

function writeEvidence(event) {
  try {
    mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
    appendFileSync(EVIDENCE_LOG, `${JSON.stringify({ ...event, ts: Date.now() })}\n`)
  } catch { /* evidence is best-effort; never crash the watchdog on its own log */ }
}

async function feishuToken() {
  try {
    if (!FEISHU_CREDS) throw new Error('feishu credentials unavailable')
    const creds = JSON.parse(readFileSync(FEISHU_CREDS, 'utf8'))
    const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: creds.appId ?? creds.app_id, app_secret: creds.appSecret ?? creds.app_secret }),
    })
    const token = await tokenRes.json()
    if (!token.tenant_access_token) throw new Error(`feishu token request failed: ${token.code ?? '?'}`)
    return token.tenant_access_token
  } catch (error) { throw Object.assign(error, { deliveryState: 'FAILED' }) }
}

async function feishuAlert(text, { to, notificationKey }) {
  if (DRY_RUN) {
    process.stdout.write(`[watchdog dry-run] alert suppressed:\n${text}\n`)
    return true
  }
  if (!FEISHU_CREDS || !to) throw Object.assign(new Error('feishu alert channel or authorized route not configured'), { deliveryState: 'FAILED' })
  // 3 attempts with backoff: transient network blips must not lose an alert
  // (the park-file fallback remains for total delivery failure).
  let lastError
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const token = await feishuToken()
      const { buildIdempotentFeishuRequest } = await import('../packages/scheduler/src/watchdog/delivery.js')
      const request = buildIdempotentFeishuRequest(notificationKey, { receiveId: to, text })
      const sendRes = await fetch(request.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(request.body),
      })
      const sent = await sendRes.json()
      if (sent.code !== 0) throw Object.assign(new Error(`feishu send failed: ${sent.code} ${sent.msg ?? ''}`), { deliveryState: 'FAILED' })
      return true
    } catch (error) {
      lastError = error
      if (attempt < 3) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000 * attempt)
    }
  }
  throw lastError
}

async function feishuDeliveryAccepted({ to, notificationKey, firstDeliveryAttemptAt }) {
  if (!FEISHU_CREDS || !to || !Number.isFinite(firstDeliveryAttemptAt)) throw new Error('delivery readback coordinates unavailable')
  const { feishuHistoryContainsNotification } = await import('../packages/scheduler/src/watchdog/delivery.js')
  const token = await feishuToken()
  let pageToken
  for (let page = 0; page < 1000; page += 1) {
    const url = new URL('https://open.feishu.cn/open-apis/im/v1/messages')
    url.searchParams.set('container_id_type', 'chat')
    url.searchParams.set('container_id', to)
    url.searchParams.set('sort_type', 'ByCreateTimeAsc')
    url.searchParams.set('page_size', '50')
    url.searchParams.set('start_time', String(Math.max(0, Math.floor(firstDeliveryAttemptAt / 1000) - 5)))
    url.searchParams.set('end_time', String(Math.ceil(Date.now() / 1000) + 5))
    if (pageToken) url.searchParams.set('page_token', pageToken)
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
    const body = await response.json()
    if (body.code !== 0 || !Array.isArray(body.data?.items)) throw new Error(`feishu delivery readback failed: ${body.code ?? '?'}`)
    if (feishuHistoryContainsNotification(body.data.items, notificationKey)) return true
    if (body.data.has_more !== true) return false
    if (typeof body.data.page_token !== 'string' || body.data.page_token === '') throw new Error('feishu delivery readback pagination invalid')
    pageToken = body.data.page_token
  }
  throw new Error('feishu delivery readback exceeded bounded pagination')
}

async function deliverOrPark(text, { route, notificationKey }) {
  const { attemptNotificationDelivery } = await import('../packages/scheduler/src/watchdog/delivery.js')
  let capturedError
  const delivery = await attemptNotificationDelivery(async () => {
    try { await feishuAlert(text, { to: route?.to, notificationKey }) } catch (error) { capturedError = error; throw error }
  })
  if (delivery !== 'DELIVERED') {
    // Durable local Scheduler ops sink supplements fail-loud delivery. It is
    // never treated as a successful replacement route.
    try {
      const { appendPrivateJsonl } = await import('../packages/scheduler/src/watchdog/durable-state.js')
      appendPrivateJsonl(LOCAL_OPS_SINK, { notificationKey, at: Date.now(), delivery, error: String(capturedError?.message ?? capturedError).slice(0, 160) }, {
        expectedUid: Number(process.env.SCHEDULER_INCIDENT_OWNER_UID ?? process.getuid?.()),
        expectedGid: Number(process.env.SCHEDULER_INCIDENT_OWNER_GID ?? process.getgid?.()),
      })
    } catch { /* ignore */ }
    writeEvidence({ kind: delivery === 'FAILED' ? 'alert_delivery_failed' : 'alert_delivery_outcome_unknown', notificationKey, error: String(capturedError?.message ?? capturedError) })
  }
  return delivery
}

async function probeRuntimeHealth() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(5_000) })
    if (!res.ok) return { healthOk: false, reason: `health endpoint HTTP ${res.status}` }
    const body = await res.json().catch(() => ({}))
    if (body?.ok !== true) return { healthOk: false, reason: 'health endpoint body not ok' }
    return { healthOk: true }
  } catch (error) {
    return { healthOk: false, reason: `health endpoint unreachable: ${String(error?.message ?? error).slice(0, 120)}` }
  }
}

function evidenceAgeMs(nowMs) {
  // STORE = <root>/scheduler/jobs.json -> evidence at <root>/control/.
  const path = STORE ? join(STORE, '..', '..', 'control', 'runtime-evidence.jsonl') : undefined
  if (!path || !existsSync(path)) return null
  return nowMs - statSync(path).mtimeMs
}

async function processIncidentNotifications(findings, { nowMs, role, doc = { jobs: [] } }) {
  const {
    bindNotificationDelivery, commitIncidentState, loadIncidentState, markNotificationDelivery, providerIdempotencyKey,
    readProtectedRoutingManifest, recoverNotificationDelivery, resolveNotificationRoute, retryableOutboxIntents,
    stableNotificationText, updateAlertState, validateIncidentDeliveryBindings,
  } = await import('../packages/scheduler/src/watchdog/index.js')
  const incidentOwnership = {
    expectedUid: Number(process.env.SCHEDULER_INCIDENT_OWNER_UID ?? process.getuid?.()),
    expectedGid: Number(process.env.SCHEDULER_INCIDENT_OWNER_GID ?? process.getgid?.()),
  }
  const loaded = loadIncidentState(INCIDENT_STATE_FILE, incidentOwnership)
  const ownsIncident = role === 'w2'
    ? (record) => record.stableSubjectId === 'watchdog:w1'
    : (record) => record.stableSubjectId !== 'watchdog:w1'
  const transition = updateAlertState(loaded.state, findings, { nowMs, ownsIncident, producer: role })
  let persisted = commitIncidentState(INCIDENT_STATE_FILE, transition.state, { expectedHash: loaded.hash, ...incidentOwnership })
  const retryable = retryableOutboxIntents(transition.state, { producer: role })
  if (retryable.length === 0) return { outcome: 'suppressed_or_healthy', transition }
  let outcome = 'feishu_sent'
  let currentState = transition.state
  for (const intent of retryable) {
    const notification = {
      fingerprint: intent.incident.rootIdentity,
      kind: intent.transitionKind === 'OPEN' ? 'new'
        : intent.transitionKind === 'CLOSED_ACKNOWLEDGED' ? 'acknowledged' : 'recovered',
      finding: intent.incident.facts?.[0] ?? { class: intent.incident.rootCauseClass },
      notificationKey: intent.notificationKey,
      routeClass: intent.routeClass,
    }
    let manifest = null
    let routingSha256 = null
    try {
      const configuredGid = Number(process.env.SCHEDULER_ROUTING_READER_GID)
      const allowedGids = Number.isInteger(configuredGid) ? [configuredGid] : []
      const protectedRouting = readProtectedRoutingManifest(ROUTING_MANIFEST, {
        expectedUid: Number(process.env.SCHEDULER_ROUTING_OWNER_UID ?? 0), allowedGids, maxMode: 0o640,
      })
      manifest = protectedRouting.manifest
      routingSha256 = protectedRouting.readback.sha256
    } catch (error) {
      writeEvidence({ kind: 'routing_manifest_unavailable', error: String(error?.message ?? error) })
    }
    const job = doc.jobs?.find((candidate) => candidate.id === notification.finding?.jobId)
    try { validateIncidentDeliveryBindings(currentState, { manifest, jobs: doc.jobs, routingSha256, nowMs }) } catch (error) {
      writeEvidence({ kind: 'delivery_binding_authority_invalid', notificationKey: notification.notificationKey, error: String(error?.message ?? error) })
      outcome = 'delivery_failed'
      continue
    }
    const routeDecision = resolveNotificationRoute({ routeClass: notification.routeClass, job, manifest })
    if (intent.deliveryBinding && (JSON.stringify(intent.deliveryBinding.route) !== JSON.stringify(routeDecision.route)
      || intent.deliveryBinding.routeSource !== routeDecision.routeSource || intent.deliveryBinding.routingSha256 !== routingSha256)) {
      writeEvidence({ kind: 'delivery_binding_routing_generation_mismatch', notificationKey: notification.notificationKey })
      outcome = 'delivery_failed'
      continue
    }
    if (!routeDecision.route && intent.delivery !== 'PENDING') {
      outcome = 'delivery_failed'
      continue
    }
    const text = intent.deliveryBinding?.payload ?? stableNotificationText(intent)
    let delivered = 'FAILED'
    if (routeDecision.route) {
      if (!intent.deliveryBinding) {
        currentState = bindNotificationDelivery(currentState, notification.notificationKey, {
          producer: role, route: routeDecision.route, payload: text,
          routeSource: routeDecision.routeSource, routingSha256,
          providerKey: providerIdempotencyKey(notification.notificationKey),
        }, nowMs)
        if (intent.delivery !== 'FAILED') {
          persisted = commitIncidentState(INCIDENT_STATE_FILE, currentState, { expectedHash: persisted.hash, ...incidentOwnership })
        }
      }
      if (intent.delivery === 'OUTCOME_UNKNOWN') {
        delivered = await recoverNotificationDelivery(intent, {
          readback: () => feishuDeliveryAccepted({
            to: routeDecision.route.to, notificationKey: notification.notificationKey,
            firstDeliveryAttemptAt: intent.firstDeliveryAttemptAt,
          }),
          send: async () => {
            const result = await deliverOrPark(text, { route: routeDecision.route, notificationKey: notification.notificationKey })
            if (result !== 'DELIVERED') throw Object.assign(new Error(`delivery ${result.toLowerCase()}`), { deliveryState: result })
          },
        })
        if (delivered === 'OUTCOME_UNKNOWN') writeEvidence({ kind: 'alert_delivery_readback_or_send_unknown', notificationKey: notification.notificationKey })
      } else {
        currentState = markNotificationDelivery(currentState, notification.notificationKey, 'OUTCOME_UNKNOWN', nowMs)
        persisted = commitIncidentState(INCIDENT_STATE_FILE, currentState, { expectedHash: persisted.hash, ...incidentOwnership })
        delivered = await deliverOrPark(text, { route: routeDecision.route, notificationKey: notification.notificationKey })
      }
      currentState = markNotificationDelivery(currentState, notification.notificationKey, delivered, nowMs)
    } else {
      currentState = markNotificationDelivery(currentState, notification.notificationKey, 'FAILED', nowMs)
    }
    persisted = commitIncidentState(INCIDENT_STATE_FILE, currentState, { expectedHash: persisted.hash, ...incidentOwnership })
    if (delivered !== 'DELIVERED') {
      outcome = 'delivery_failed'
      if (!routeDecision.route && intent.delivery !== 'FAILED') {
        try {
          const { appendPrivateJsonl } = await import('../packages/scheduler/src/watchdog/durable-state.js')
          appendPrivateJsonl(LOCAL_OPS_SINK, { notificationKey: notification.notificationKey, at: Date.now(), delivery: 'FAILED', reason: routeDecision.reason ?? 'canonical ops route unavailable' }, incidentOwnership)
        } catch { /* the nonzero outcome remains authoritative */ }
      }
    }
  }
  return { outcome, transition }
}

async function runW1(nowMs) {
  const { readFileSync: readRaw } = await import('node:fs')
  const { createHash } = await import('node:crypto')
  const { parseDesiredState, evaluateDesiredState, evaluateReconciliationEvidence, evaluateCredentialProvider } =
    await import('../packages/scheduler/src/watchdog/index.js')
  const findings = []
  const candidateJobFindings = []
  // Desired-state vs live state (raw file read — no engine, no migration side effects).
  let doc = { jobs: [], occurrences: [] }
  try {
    doc = JSON.parse(readRaw(STORE, 'utf8'))
  } catch (error) {
    findings.push({ class: 'SCHEDULER_RUNTIME_UNHEALTHY', reason: `canonical store unreadable: ${String(error?.message ?? error).slice(0, 120)}` })
  }
  let desired
  let desiredSha256 = null
  try {
    const manifestBytes = readRaw(DESIRED_STATE, 'utf8')
    desiredSha256 = `sha256:${createHash('sha256').update(manifestBytes).digest('hex')}`
    desired = parseDesiredState(JSON.parse(manifestBytes))
    candidateJobFindings.push(...evaluateDesiredState(doc, desired))
  } catch (error) {
    findings.push({ class: 'SCHEDULER_RUNTIME_UNHEALTHY', reason: `desired-state manifest unreadable/invalid: ${String(error?.message ?? error).slice(0, 120)}` })
  }
  const runtimeHealth = { ...(await probeRuntimeHealth()), evidenceAgeMs: evidenceAgeMs(nowMs) }
  try {
    const { createSchedulerHealthRuntime } = await import('../packages/production-runtime/src/scheduler/health-runtime.js')
    const schedulerRoot = dirname(STORE)
    const configuredGid = Number(process.env.SCHEDULER_ROUTING_READER_GID)
    const health = await createSchedulerHealthRuntime({
      layout: {
        jobsStore: STORE,
        runsLog: join(schedulerRoot, 'runs.jsonl'),
        schedulerRoutingManifest: ROUTING_MANIFEST,
        schedulerIncidentState: INCIDENT_STATE_FILE,
      },
      runtimeGeneration: process.env.AGENT_CORE_DEPLOYED_SHA,
      routingSecurity: {
        expectedUid: Number(process.env.SCHEDULER_ROUTING_OWNER_UID ?? 0),
        allowedGids: Number.isInteger(configuredGid) ? [configuredGid] : [],
        maxMode: 0o640,
      },
      incidentOwnership: {
        expectedUid: Number(process.env.SCHEDULER_INCIDENT_OWNER_UID ?? process.getuid?.()),
        expectedGid: Number(process.env.SCHEDULER_INCIDENT_OWNER_GID ?? process.getgid?.()),
      },
      credentialStoreFile: CREDENTIAL_FILE,
      runtimeHealth,
      nowMs: () => nowMs,
    }).read()
    if (health.complete === true) findings.push(...candidateJobFindings, ...(health.findings ?? []))
    else findings.push({ class: 'SCHEDULER_RUNTIME_UNHEALTHY', subjectKind: 'runtime', stableSubjectId: 'scheduler-health',
      reason: `canonical Scheduler health incomplete: ${health.censusError ?? 'unknown source'}` })
  } catch (error) {
    findings.push({ class: 'SCHEDULER_RUNTIME_UNHEALTHY', subjectKind: 'runtime', stableSubjectId: 'scheduler-health', reason: `canonical Scheduler health unavailable: ${String(error?.message ?? error).slice(0, 120)}` })
  }
  // §5.2/§5.6: child-relay STILL_UNKNOWN evidence is Owner-visible from here.
  try {
    const entries = existsSync(RECONCILIATION_EVIDENCE)
      ? readRaw(RECONCILIATION_EVIDENCE, 'utf8').split('\n').filter(Boolean).map((line) => {
        try { return JSON.parse(line) } catch { return null }
      }).filter(Boolean)
      : []
    findings.push(...evaluateReconciliationEvidence(entries, { nowMs }))
  } catch { /* evidence file unreadable is not itself a scheduler failure */ }
  // §5.6 credential self-probe (existence + non-empty only; zero byte reads).
  try {
    const st = statSync(CREDENTIAL_FILE)
    findings.push(...evaluateCredentialProvider({ exists: true, bytes: st.size }, { path: CREDENTIAL_FILE }))
  } catch {
    findings.push(...evaluateCredentialProvider({ exists: false }, { path: CREDENTIAL_FILE }))
  }
  // Mutual liveness: W1 watches W2 (W2 watching W1 lives in runW2). The age
  // is compared directly — missing (null) or beyond grace both mean stale.
  const w2Age = readHeartbeatAgeMs(W2_HEARTBEAT, nowMs)
  if (w2Age === null || w2Age > HEARTBEAT_GRACE_MS) {
    findings.push({ class: 'SCHEDULER_WATCHDOG_W2_FAILURE', reason: `W2 heartbeat stale or missing (ageMs=${w2Age === null ? 'missing' : w2Age})` })
  }

  const processed = await processIncidentNotifications(findings, { nowMs, role: 'w1', doc })
  touchHeartbeat('w1', nowMs)
  writeEvidence({
    kind: 'w1_run', findingCount: findings.length, classes: findings.map((f) => f.class),
    notifications: processed.transition.notifications.map((n) => ({ rootIdentity: n.fingerprint, kind: n.kind, notificationKey: n.notificationKey })),
    desiredStateSha256: desiredSha256,
  })
  writeEvidence({ kind: 'w1_incident_delivery', count: processed.transition.notifications.length, outcome: processed.outcome })
  return processed.outcome
}

async function runW2(nowMs) {
  const age = readHeartbeatAgeMs(W1_HEARTBEAT, nowMs)
  const stale = age === null || age > HEARTBEAT_GRACE_MS
  touchHeartbeat('w2', nowMs)
  writeEvidence({ kind: 'w2_run', w1HeartbeatAgeMs: age, stale })
  const findings = stale
    ? [{ class: 'SCHEDULER_WATCHDOG_FAILURE', reason: `W1 heartbeat stale or missing (ageMs=${age === null ? 'missing' : age})`, subjectKind: 'watchdog', stableSubjectId: 'watchdog:w1' }]
    : []
  return (await processIncidentNotifications(findings, { nowMs, role: 'w2' })).outcome
}

if (MIGRATE_STATE) {
  ;(async () => {
    try {
      const { createHash } = await import('node:crypto')
      const { migrateLegacyIncidentStateFiles } = await import('../packages/scheduler/src/watchdog/durable-state.js')
      const { readPrivateFile } = await import('../packages/scheduler/src/watchdog/private-state-io.js')
      const factsPath = process.env.SCHEDULER_MIGRATION_FACTS_FILE
      const legacyStatePath = process.env.SCHEDULER_LEGACY_ALERT_STATE
      const legacyEvidencePath = process.env.SCHEDULER_LEGACY_DELIVERY_EVIDENCE
      if (!factsPath || !legacyStatePath || !legacyEvidencePath) throw new Error('migration source paths are required')
      const expectedUid = Number(process.env.SCHEDULER_INCIDENT_OWNER_UID ?? process.getuid?.())
      const expectedGid = Number(process.env.SCHEDULER_INCIDENT_OWNER_GID ?? process.getgid?.())
      const sourceExpectedUid = Number(process.env.SCHEDULER_MIGRATION_SOURCE_OWNER_UID ?? expectedUid)
      const sourceExpectedGid = Number(process.env.SCHEDULER_MIGRATION_SOURCE_OWNER_GID ?? expectedGid)
      const factsBytes = readPrivateFile(factsPath, { expectedUid: sourceExpectedUid, expectedGid: sourceExpectedGid }).bytes
      const factsFileSha256 = createHash('sha256').update(factsBytes).digest('hex')
      if (factsFileSha256 !== process.env.SCHEDULER_MIGRATION_FACTS_FILE_SHA256) throw new Error('migration facts file generation mismatch')
      const findings = JSON.parse(factsBytes.toString('utf8'))
      if (!Array.isArray(findings)) throw new TypeError('migration facts must be a JSON array')
      const result = migrateLegacyIncidentStateFiles({
        legacyStatePath, legacyEvidencePath, incidentStatePath: INCIDENT_STATE_FILE, findings,
        expectedLegacySha256: process.env.SCHEDULER_LEGACY_ALERT_STATE_SHA256,
        expectedEvidenceSha256: process.env.SCHEDULER_LEGACY_DELIVERY_EVIDENCE_SHA256,
        expectedFactsSha256: process.env.SCHEDULER_MIGRATION_FACTS_SHA256,
        expectedUid, expectedGid, sourceExpectedUid, sourceExpectedGid,
      })
      process.stdout.write(`${JSON.stringify({
        status: result.status, incidentSha256: result.incidentSha256, legacySha256: result.legacySha256,
        evidenceSha256: result.evidenceSha256, factsSha256: result.factsSha256, factsFileSha256,
      })}\n`)
    } catch (error) {
      process.stderr.write(`[migration] FAILED: ${String(error?.message ?? error).slice(0, 240)}\n`)
      process.exitCode = 1
    }
  })()
} else if (DELIVER_TEST) {
  ;(async () => {
    try {
      const { createHash } = await import('node:crypto')
      const { readProtectedRoutingManifest, resolveNotificationRoute } = await import('../packages/scheduler/src/watchdog/index.js')
      const configuredGid = Number(process.env.SCHEDULER_ROUTING_READER_GID)
      const manifest = readProtectedRoutingManifest(ROUTING_MANIFEST, {
        expectedUid: Number(process.env.SCHEDULER_ROUTING_OWNER_UID ?? 0),
        allowedGids: Number.isInteger(configuredGid) ? [configuredGid] : [],
        maxMode: 0o640,
      }).manifest
      const decision = resolveNotificationRoute({ routeClass: 'SCHEDULER_CONTROL_PLANE_INCIDENT', manifest })
      if (!decision.route) throw new Error('canonical Scheduler ops target unavailable')
      const notificationKey = createHash('sha256').update(`delivery-test:${Date.now()}`).digest('hex')
      await feishuAlert(`Scheduler watchdog delivery test @ ${new Date().toISOString()} — W1/W2 alerting live.`, { to: decision.route.to, notificationKey })
      process.stdout.write('[deliver-test] SENT\n'); process.exit(0)
    }
    catch (e) { process.stderr.write(`[deliver-test] FAILED: ${String(e?.message ?? e).slice(0, 200)}\n`); process.exit(1) }
  })()
} else {
const nowMs = Date.now()
const outcome = ROLE === 'w1' ? await runW1(nowMs) : await runW2(nowMs)
process.stdout.write(`[scheduler-watchdog ${ROLE}] ${outcome}\n`)
if (outcome === 'delivery_failed') process.exit(1)
}
