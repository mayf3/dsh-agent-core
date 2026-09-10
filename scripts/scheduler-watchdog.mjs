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
 * SCHEDULER_WATCHDOG_ALERT_TO (chat id).
 *
 * Usage: scheduler-watchdog.mjs [--role w1|w2] [--dry-run]
 */

import { existsSync, readFileSync, writeFileSync, statSync, mkdirSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

const DELIVER_TEST = process.argv.includes('--deliver-test')
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
const ALERT_TO = process.env.SCHEDULER_WATCHDOG_ALERT_TO ?? ''
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
const ALERT_STATE_FILE = process.env.SCHEDULER_WATCHDOG_ALERT_STATE
  ?? join(STATE_DIR, 'alert-state.json')
const ALERT_REMINDER_MS = Number(process.env.SCHEDULER_WATCHDOG_REMINDER_MS ?? 60 * 60 * 1000)
const RECONCILIATION_EVIDENCE = process.env.SCHEDULER_RECONCILIATION_EVIDENCE_FILE
  ?? '/usr/local/var/scheduler-watchdog/reconciliation-evidence.jsonl'
const W1_HEARTBEAT = join(STATE_DIR, 'w1.heartbeat')
const W2_HEARTBEAT = join(STATE_DIR, 'w2.heartbeat')
const EVIDENCE_LOG = join(STATE_DIR, 'scheduler-watchdog-evidence.jsonl')
const ALERT_FALLBACK = join(STATE_DIR, 'pending-alert.txt')

const usage = () => {
  process.stderr.write('usage: scheduler-watchdog.mjs --role w1|w2 [--dry-run]\n')
  process.exit(2)
}
if (!['w1', 'w2'].includes(ROLE) || (ROLE === 'w1' && !STORE)) usage()

function heartbeatPathFor(role) { return role === 'w1' ? W1_HEARTBEAT : W2_HEARTBEAT }

function touchHeartbeat(role, nowMs) {
  mkdirSync(STATE_DIR, { recursive: true })
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
    mkdirSync(STATE_DIR, { recursive: true })
    appendFileSync(EVIDENCE_LOG, `${JSON.stringify({ ...event, ts: Date.now() })}\n`)
  } catch { /* evidence is best-effort; never crash the watchdog on its own log */ }
}

async function feishuAlert(text) {
  if (DRY_RUN) {
    process.stdout.write(`[watchdog dry-run] alert suppressed:\n${text}\n`)
    return true
  }
  if (!FEISHU_CREDS || !ALERT_TO) throw new Error('feishu alert channel not configured (FEISHU_CREDS_PATH / SCHEDULER_WATCHDOG_ALERT_TO)')
  const creds = JSON.parse(readFileSync(FEISHU_CREDS, 'utf8'))
  // 3 attempts with backoff: transient network blips must not lose an alert
  // (the park-file fallback remains for total delivery failure).
  let lastError
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ app_id: creds.appId ?? creds.app_id, app_secret: creds.appSecret ?? creds.app_secret }),
      })
      const token = await tokenRes.json()
      if (!token.tenant_access_token) throw new Error(`feishu token request failed: ${token.code ?? '?'}`)
      const sendRes = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token.tenant_access_token}` },
        body: JSON.stringify({ receive_id: ALERT_TO, msg_type: 'text', content: JSON.stringify({ text }) }),
      })
      const sent = await sendRes.json()
      if (sent.code !== 0) throw new Error(`feishu send failed: ${sent.code} ${sent.msg ?? ''}`)
      return true
    } catch (error) {
      lastError = error
      if (attempt < 3) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000 * attempt)
    }
  }
  throw lastError
}

async function deliverOrPark(text) {
  try {
    await feishuAlert(text)
    return 'feishu_sent'
  } catch (error) {
    // Last resort: park the alert on disk and exit non-zero (launchd-visible).
    try {
      mkdirSync(STATE_DIR, { recursive: true })
      writeFileSync(ALERT_FALLBACK, `${text}\n\n(delivery failure: ${error?.message ?? error})\n`)
    } catch { /* ignore */ }
    writeEvidence({ kind: 'alert_delivery_failed', error: String(error?.message ?? error) })
    return 'delivery_failed'
  }
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

async function runW1(nowMs) {
  const { readFileSync: readRaw } = await import('node:fs')
  const { createHash } = await import('node:crypto')
  const { parseDesiredState, evaluateDesiredState, evaluateRunHealth, evaluateReconciliationEvidence, evaluateCredentialProvider, updateAlertState, formatFindings } =
    await import('../packages/scheduler/src/watchdog.js')
  const findings = []
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
    findings.push(...evaluateDesiredState(doc, desired))
  } catch (error) {
    findings.push({ class: 'SCHEDULER_RUNTIME_UNHEALTHY', reason: `desired-state manifest unreadable/invalid: ${String(error?.message ?? error).slice(0, 120)}` })
  }
  findings.push(...evaluateRunHealth(doc, {
    nowMs,
    desired,
    runtimeHealth: { ...(await probeRuntimeHealth()), evidenceAgeMs: evidenceAgeMs(nowMs) },
  }))
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

  // ── alert-storm hardening: dedupe Owner notifications by fingerprint; every
  // evaluation is still receipted in the evidence log below.
  let alertState = {}
  try {
    alertState = JSON.parse(readFileSync(ALERT_STATE_FILE, 'utf8'))
  } catch { /* first run or unparsable -> fresh */ }
  const transition = updateAlertState(alertState, findings, { nowMs, reminderIntervalMs: ALERT_REMINDER_MS })
  touchHeartbeat('w1', nowMs)
  writeEvidence({
    kind: 'w1_run', findingCount: findings.length, classes: findings.map((f) => f.class),
    notifications: transition.notifications.map((n) => ({ fingerprint: n.fingerprint, kind: n.kind })),
    desiredStateSha256: desiredSha256,
  })
  if (transition.notifications.length === 0) return 'suppressed_or_healthy'
  const render = (n) => {
    const f = n.finding
    const coordinates = [f.logicalKey, f.jobId, f.runId, f.occurrenceId].filter(Boolean).join(' ')
    const body = f.detail ?? f.reason ?? ''
    // ✅ prefix + Chinese gloss: a recovery confirmation must be distinguishable
    // from an alert at a glance (2026-09-09: the plain RECOVERED line was twice
    // misread as a new failure by the Owner).
    if (n.kind === 'recovered') return `- ✅ RECOVERED (已恢复，无需处理) [${n.fingerprint}] the earlier ${f.class} is no longer present`
    // ALERT LIFECYCLE (SCHEDULER_FAILURE_DISPOSITION_ALERT_LIFECYCLE_V1): a formal
    // operator disposition closed this exact incident — exactly-once closure note;
    // the failure fact stays durable in the evidence log.
    if (n.kind === 'acknowledged') return `- ✅ ACKNOWLEDGED (已处置，无需处理) [${n.fingerprint}] the earlier ${f.class} has a formal operator disposition (basis=operator-reconcile) — this incident is closed; the failure fact remains in the evidence log`
    return `- ${n.kind === 'new' ? 'NEW' : n.kind === 'reminder' ? 'REMINDER (bounded)' : 'UPDATED'} ${f.class}${coordinates ? ` [${coordinates}]` : ''} ${body}`
  }
  const text = `Scheduler watchdog W1 ${transition.notifications.length} notification(s) @ ${new Date(nowMs).toISOString()}\n${transition.notifications.map(render).join('\n')}`
  const alertOutcome = await deliverOrPark(text)
  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(ALERT_STATE_FILE, `${JSON.stringify(transition.state, null, 2)}\n`)
  writeEvidence({ kind: 'w1_alerts_delivered', count: transition.notifications.length, alertOutcome })
  return alertOutcome
}

async function runW2(nowMs) {
  const { formatFindings } = await import('../packages/scheduler/src/watchdog.js')
  const age = readHeartbeatAgeMs(W1_HEARTBEAT, nowMs)
  const stale = age === null || age > HEARTBEAT_GRACE_MS
  touchHeartbeat('w2', nowMs)
  writeEvidence({ kind: 'w2_run', w1HeartbeatAgeMs: age, stale })
  if (!stale) return 'ok'
  return deliverOrPark(formatFindings(
    [{ class: 'SCHEDULER_WATCHDOG_FAILURE', reason: `W1 heartbeat stale or missing (ageMs=${age === null ? 'missing' : age})` }],
    { role: 'W2', nowMs },
  ))
}

if (DELIVER_TEST) {
  ;(async () => {
    try { await feishuAlert(`Scheduler watchdog delivery test @ ${new Date().toISOString()} — W1/W2 alerting live.`); process.stdout.write('[deliver-test] SENT\n'); process.exit(0) }
    catch (e) { process.stderr.write(`[deliver-test] FAILED: ${String(e?.message ?? e).slice(0, 200)}\n`); process.exit(1) }
  })()
} else {
const nowMs = Date.now()
const outcome = ROLE === 'w1' ? await runW1(nowMs) : await runW2(nowMs)
process.stdout.write(`[scheduler-watchdog ${ROLE}] ${outcome}\n`)
if (outcome === 'delivery_failed') process.exit(1)
}
