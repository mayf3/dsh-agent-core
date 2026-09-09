#!/usr/bin/env node
/**
 * scheduler-cp-disable-forensics — READ-ONLY forensics for the recurring
 * JOB_DISABLED flips of the HR critical job (b115cb96…). Zero writes anywhere.
 *
 * Answers, from durable evidence only:
 *   1. FLIP instant      — job.updatedAtMs + enabled from the store doc
 *   2. WHO (if tool-face)— self_service_mutation events in runs.jsonl carry
 *                          operatorAgentId (CLI/engine disables are NOT evented)
 *   3. WHY (run context) — outcome/delivery events for the job before the flip
 *   4. W1 first detection— watchdog evidence jsonl
 *   5. Migration/rollback rule-out — v1 backups + upgrade sidecar census
 *   6. Runtime log lines — authsvc logs dir, job-id matches in window
 *
 * Every printed field is whitelisted per action; payload/credential bytes are
 * never rendered. Malformed JSONL lines are skipped, missing files tolerated.
 *
 * Usage:
 *   node scheduler-cp-disable-forensics.mjs                # production paths
 *   node scheduler-cp-disable-forensics.mjs --selftest     # offline stub tree
 */

import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const PROD = {
  storePath: '/Users/authsvc/.agent-core/scheduler/jobs.json',
  runsPath: '/Users/authsvc/.agent-core/scheduler/runs.jsonl',
  evidencePath: '/Users/authsvc/.agent-core/control/scheduler-watchdog/scheduler-watchdog-evidence.jsonl',
  alertStatePath: '/Users/authsvc/.agent-core/control/scheduler-watchdog/alert-state.json',
  stateDir: '/Users/authsvc/.agent-core/control/scheduler-watchdog',
  logsDir: '/Users/authsvc/.agent-core/logs',
  desiredPath: '/usr/local/libexec/agent-core/config/scheduler-desired-state.json',
  secondaryJobPrefix: process.env.FORENSICS_SECONDARY_JOB ?? '34b90173',
}
const SINCE_ISO = process.env.FORENSICS_SINCE ?? '2026-09-09T00:00:00Z'
const JOB_PREFIX = process.env.FORENSICS_JOB_PREFIX ?? 'b115cb96'
const TRUNC = 240

const trunc = (v) => (typeof v === 'string' ? (v.length > TRUNC ? `${v.slice(0, TRUNC)}…` : v) : v)
const iso = (ts) => (Number.isFinite(ts) ? new Date(ts).toISOString() : String(ts))

function parseJsonl(file) {
  try {
    return readFileSync(file, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)
  } catch { return [] }
}

function pick(obj, keys) {
  const out = {}
  for (const k of keys) if (obj[k] !== undefined) out[k] = k === 'error' || k === 'reason' ? trunc(obj[k]) : obj[k]
  return out
}

const EVENT_FIELDS = {
  self_service_mutation: ['ts', 'operation', 'jobId', 'operatorAgentId', 'targetAgentId', 'alreadyApplied', 'beforeDigest', 'afterDigest'],
  outcome: ['ts', 'occurrenceId', 'runId', 'state', 'executionOutcome', 'deliveryStatus', 'reason', 'jobId'],
  delivery: ['ts', 'occurrenceId', 'runId', 'deliveryStatus'],
  occurrence_reserved: ['ts', 'occurrenceId', 'runId', 'jobId', 'kind'],
  turn_start: ['ts', 'occurrenceId', 'runId'],
  router_admission: ['ts', 'phase', 'occurrenceId', 'runId', 'error'],
  late_settlement: ['ts', 'occurrenceId', 'runId', 'resolvedTo', 'basis', 'operatorIdentity'],
  import_write: ['ts', 'action', 'jobId', 'file'],
  store_upgrade: ['ts', 'action', 'upgradedAtMs'],
  lock_recovery: ['ts', 'action'],
  lock_unverifiable: ['ts', 'action'],
}
// Whole-document rewrite / anomaly class — always in scope regardless of jobId,
// because a dropped `enabled` field (clobber) also trips JOB_DISABLED with no
// disable actor at all.
const ALWAYS_ACTIONS = new Set(['self_service_mutation', 'import_write', 'store_upgrade', 'lock_recovery', 'lock_unverifiable'])

export function collect({ storePath, runsPath, evidencePath, alertStatePath, stateDir, logsDir, desiredPath, secondaryJobPrefix, sinceMs, jobPrefix }) {
  const report = { sinceMs, jobPrefix, sections: [] }
  const add = (title, lines) => report.sections.push({ title, lines })

  // 1. Job record (whitelisted — no payload)
  let flipTs = null
  let enabled = null
  try {
    const doc = JSON.parse(readFileSync(storePath, 'utf8'))
    const job = (doc.jobs ?? []).find((j) => typeof j.id === 'string' && j.id.startsWith(jobPrefix))
    if (job) {
      enabled = job.enabled ?? null
      flipTs = Number.isFinite(job.updatedAtMs) ? job.updatedAtMs : null
      add('JOB_RECORD', [
        `id=${job.id} logicalKey=${job.logicalKey ?? '(none)'} name=${job.name ?? '(none)'}`,
        `enabled=${job.enabled} enabledFieldPresent=${Object.prototype.hasOwnProperty.call(job, 'enabled')} updatedAtMs=${job.updatedAtMs} (${iso(job.updatedAtMs)}) scheduleRevision=${job.scheduleRevision}`,
        `schedule=${JSON.stringify(job.schedule)} agentId=${job.agentId}`,
        `retry=${JSON.stringify(job.retry ?? null)} deleteAfterRun=${job.deleteAfterRun ?? false} migrationRestoreBlocked=${job.migrationRestoreBlocked ?? false}`,
        `state=${JSON.stringify(job.state ?? {})}`,
      ])
    } else add('JOB_RECORD', [`NO JOB matching prefix ${jobPrefix} in store`])
  } catch (e) { add('JOB_RECORD', [`STORE UNREADABLE: ${e.message}`]) }

  // 2. runs.jsonl — windowed, whitelisted per action
  const events = parseJsonl(runsPath).filter((e) => Number.isFinite(e.ts) && e.ts >= sinceMs)
  const jobEvents = events.filter((e) => typeof e.jobId === 'string' && e.jobId.startsWith(jobPrefix))
  const disableEvents = events.filter((e) => e.action === 'self_service_mutation' && e.operation === 'disable'
    && typeof e.jobId === 'string' && e.jobId.startsWith(jobPrefix))
  const rendered = events
    .filter((e) => (typeof e.jobId === 'string' && e.jobId.startsWith(jobPrefix)) || ALWAYS_ACTIONS.has(e.action))
    .sort((a, b) => a.ts - b.ts)
    .slice(-120)
    .map((e) => JSON.stringify(pick(e, EVENT_FIELDS[e.action] ?? ['ts', 'action', 'jobId'])))
  add('RUN_EVENTS_WINDOW', rendered.length ? rendered : ['(no matching events in window)'])

  // 3. Outcomes before the flip (why did it stop?)
  const outcomes = jobEvents.filter((e) => e.action === 'outcome').sort((a, b) => a.ts - b.ts)
  const beforeFlip = flipTs ? outcomes.filter((e) => e.ts <= flipTs) : outcomes
  const lastOutcome = beforeFlip.at(-1)
  report.lastOutcomeBeforeFlip = lastOutcome ? pick(lastOutcome, EVENT_FIELDS.outcome) : null
  report.disableEvent = disableEvents.length ? pick(disableEvents.at(-1), EVENT_FIELDS.self_service_mutation) : null
  report.runCountInWindow = outcomes.length

  // 4. W1 watchdog evidence — first JOB_DISABLED detection in window
  const w1Detections = parseJsonl(evidencePath)
    .filter((e) => Number.isFinite(e.ts) && e.ts >= sinceMs)
    .filter((e) => JSON.stringify(e.classes ?? []) .includes('JOB_DISABLED')
      || JSON.stringify(e.notifications ?? []).includes('JOB_DISABLED'))
    .sort((a, b) => a.ts - b.ts)
    .map((e) => JSON.stringify(pick(e, ['ts', 'kind', 'findingCount', 'classes', 'notifications'])))
  report.w1FirstDetectionTs = w1Detections.length ? JSON.parse(w1Detections[0]).ts : null
  add('W1_DETECTIONS', w1Detections.length ? w1Detections : ['(none in window)'])

  // 4b. Fleet minting census — occurrence_reserved since window start grouped by
  // jobId. An enabled periodic job with zero reservations while the runtime is
  // up = engine not admitting (fleet-wide vs job-local discrimination).
  const reserved = parseJsonl(runsPath)
    .filter((e) => e.action === 'occurrence_reserved' && Number.isFinite(e.ts) && e.ts >= sinceMs)
  const byJob = new Map()
  for (const e of reserved) {
    const key = typeof e.jobId === 'string' ? e.jobId.slice(0, 8) : '(no jobId)'
    const cur = byJob.get(key) ?? { count: 0, last: 0 }
    cur.count += 1
    cur.last = Math.max(cur.last, e.ts)
    byJob.set(key, cur)
  }
  report.mintCensus = [...byJob.entries()].map(([job, v]) => ({ job, ...v })).sort((a, b) => b.count - a.count)
  add('FLEET_MINT_CENSUS_SINCE_WINDOW', report.mintCensus.length
    ? report.mintCensus.map((m) => `  ${m.job}: ${m.count} reserved, last ${iso(m.last)}`)
    : ['  ZERO occurrence_reserved fleet-wide since window start — engine not admitting at all'])

  // 4c. Secondary job (mutated seconds before the disable)
  if (secondaryJobPrefix) {
    try {
      const doc = JSON.parse(readFileSync(storePath, 'utf8'))
      const job = (doc.jobs ?? []).find((j) => typeof j.id === 'string' && j.id.startsWith(secondaryJobPrefix))
      add('SECONDARY_JOB', job
        ? [`id=${job.id} logicalKey=${job.logicalKey ?? '(none)'} name=${job.name ?? '(none)'}`,
           `enabled=${job.enabled} agentId=${job.agentId} schedule=${JSON.stringify(job.schedule)}`,
           `updatedAtMs=${job.updatedAtMs} (${iso(job.updatedAtMs)}) state=${JSON.stringify(job.state ?? {})}`]
        : [`NO JOB matching prefix ${secondaryJobPrefix}`])
    } catch (e) { add('SECONDARY_JOB', [`UNREADABLE: ${e.message}`]) }
  }

  // 5. alert-state fingerprint entry
  try {
    const st = JSON.parse(readFileSync(alertStatePath, 'utf8'))
    const fpKey = Object.keys(st.active ?? {}).find((k) => k.includes('JOB_DISABLED') && k.includes(jobPrefix))
      ?? Object.keys(st.retired ?? {}).find((k) => k.includes('JOB_DISABLED') && k.includes(jobPrefix))
    add('ALERT_STATE', fpKey
      ? [`fp=${fpKey}`, JSON.stringify((st.active ?? {})[fpKey] ?? (st.retired ?? {})[fpKey])]
      : ['no matching fingerprint'])
  } catch (e) { add('ALERT_STATE', [`UNREADABLE: ${e.message}`]) }

  // 6. Migration/rollback rule-out + store census
  try {
    const st = statSync(storePath)
    const dirLines = [`store mtime=${st.mtime.toISOString()} size=${st.size}`]
    const dir = join(storePath, '..')
    const siblings = readdirSync(dir).filter((n) => n.startsWith('jobs.json') && n !== 'jobs.json')
    dirLines.push(`siblings=${siblings.length ? siblings.join(', ') : '(none)'}`)
    try {
      const sidecar = JSON.parse(readFileSync(`${storePath}.upgrade-v2.json`, 'utf8'))
      dirLines.push(`sidecar: jobMutationSeen=${sidecar.jobMutationSeen} upgradedAtMs=${iso(sidecar.upgradedAtMs)}`)
      report.sidecar = { jobMutationSeen: sidecar.jobMutationSeen }
    } catch { dirLines.push('sidecar: absent (native v2 store)') }
    add('STORE_CENSUS', dirLines)
  } catch (e) { add('STORE_CENSUS', [`UNREADABLE: ${e.message}`]) }

  // 7. Runtime logs — job-id matches in window (best-effort, read-only)
  const logLines = []
  try {
    for (const name of readdirSync(logsDir)) {
      if (!name.endsWith('.log') && !name.endsWith('.log.0') && !name.endsWith('.err.log')) continue
      const file = join(logsDir, name)
      let st
      try { st = statSync(file) } catch { continue }
      if (st.mtimeMs < sinceMs - 60 * 60 * 1000) continue
      const matches = readFileSync(file, 'utf8').split('\n')
        .filter((l) => l.includes(jobPrefix) || l.includes('JOB_DISABLED'))
        .slice(-12)
        .map((l) => trunc(l))
      if (matches.length) logLines.push(`--- ${name}`, ...matches)
    }
  } catch { /* logs dir unreadable — tolerated */ }
  add('LOG_MATCHES', logLines.length ? logLines : ['(no job-id matches readable)'])

  // 8. State-dir ownership census — authsvc W1 cannot append to root-owned
  // files (appendFileSync failure is silently ignored by the runner), so a
  // root-owned evidence/alert-state file makes W1's bookkeeping invisible.
  try {
    const entries = readdirSync(stateDir).map((name) => {
      const st = statSync(join(stateDir, name))
      return `  ${name} uid=${st.uid} gid=${st.gid} mode=${(st.mode & 0o777).toString(8)} mtime=${st.mtime.toISOString()}`
    })
    add('STATE_DIR_CENSUS', entries.length ? entries : ['(empty)'])
  } catch (e) { add('STATE_DIR_CENSUS', [`UNREADABLE: ${e.message}`]) }

  // 9. Full alert-state (small) — exact fingerprints the live W1 last persisted.
  try { add('ALERT_STATE_FULL', readFileSync(alertStatePath, 'utf8').split('\n').map((l) => `  ${l}`).filter((l) => l.trim())) } catch (e) { add('ALERT_STATE_FULL', [`UNREADABLE: ${e.message}`]) }

  // 10. W1 stdout/stderr tails — per-cycle outcome lines + crash stacks.
  for (const [label, name] of [['W1_STDOUT_TAIL', 'scheduler-watchdog-w1.log'], ['W1_STDERR_TAIL', 'scheduler-watchdog-w1.err.log']]) {
    try {
      const lines = readFileSync(join(logsDir, name), 'utf8').split('\n').filter(Boolean).slice(-25)
      add(label, lines.map((l) => `  ${trunc(l)}`))
    } catch (e) { add(label, [`UNREADABLE: ${e.message}`]) }
  }

  // 11. Desired-state manifest readability (authsvc must read it or
  // JOB_DISABLED/drift findings silently never fire).
  try {
    const st = statSync(desiredPath)
    const doc = JSON.parse(readFileSync(desiredPath, 'utf8'))
    add('DESIRED_STATE', [`mode=${(st.mode & 0o777).toString(8)} uid=${st.uid} jobs=${(doc.jobs ?? []).length} frozenAt=${doc._frozenAt ?? '(none)'}`])
  } catch (e) { add('DESIRED_STATE', [`UNREADABLE: ${e.message}`]) }

  return report
}

const REDACT_RE = /((?:secret|token|password|passwd|authorization|credential|api[_-]?key)[\s]*[=:][\s]*)("[^"]*"|\S+)/gi

export function render(report) {
  const out = []
  for (const s of report.sections) {
    out.push(`== ${s.title} ==`)
    out.push(...s.lines.map((l) => `  ${l}`))
  }
  const d = report.disableEvent
  out.push('== VERDICT ==')
  out.push(`  DISABLE_EVENT_FOUND=${d ? 'YES' : 'NO'}${d ? ` operator=${d.operatorAgentId} target=${d.targetAgentId ?? '(self)'} at=${iso(d.ts)} op=${d.operation}` : ' (not evented ⇒ CLI/direct disableJobOp path, or event outside window)'}`)
  out.push(`  LAST_OUTCOME_BEFORE_FLIP=${report.lastOutcomeBeforeFlip ? JSON.stringify(report.lastOutcomeBeforeFlip) : 'none'}`)
  out.push(`  RUNS_IN_WINDOW=${report.runCountInWindow}`)
  out.push(`  W1_FIRST_DETECTION=${report.w1FirstDetectionTs ? iso(report.w1FirstDetectionTs) : 'none-in-window'}`)
  out.push(`  MIGRATION_RERUN=${report.sidecar ? (report.sidecar.jobMutationSeen === true ? 'NO (sidecar normal)' : 'CHECK (jobMutationSeen=false)') : 'NO (native v2)'}`)
  // Whole-text redaction pass: whitelists plus key=value scrubbing (log lines
  // are free-form and may embed credential-shaped substrings).
  return out.join('\n').replace(REDACT_RE, '$1REDACTED')
}

function selftest() {
  const root = '/tmp/sched-cp-disable-forensics-selftest'
  rmSync(root, { recursive: true, force: true })
  const storeDir = join(root, 'scheduler')
  const ctlDir = join(root, 'control/scheduler-watchdog')
  const logsDir = join(root, 'logs')
  for (const d of [storeDir, ctlDir, logsDir]) mkdirSync(d, { recursive: true })
  const T_FLIP = Date.parse('2026-09-09T10:00:00Z')
  const T = (min) => T_FLIP - min * 60 * 1000
  writeFileSync(join(storeDir, 'jobs.json'), `${JSON.stringify({
    version: 2,
    jobs: [{ id: 'b115cb96-8a4f-49be-9baa-519223022b59', logicalKey: 'agt_hr-agent:hr-workflow-auto-dispatch', name: 'HR dispatch', enabled: false, updatedAtMs: T_FLIP, scheduleRevision: 3, schedule: { kind: 'every', everyMs: 1800000 }, agentId: 'agt_hr-agent', state: { consecutiveErrors: 1, lastStatus: 'outcome_unknown' } },
      { id: '34b90173-aaaa', logicalKey: 'agt_hr-agent:secondary', name: 'HR secondary', enabled: true, updatedAtMs: T_FLIP - 4975, schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'Asia/Shanghai' }, agentId: 'agt_hr-agent', state: {} },
      { id: 'fa13b0ea', logicalKey: 'agt_daily-thought-agent:daily-raw-distilled-summary-check', enabled: true, updatedAtMs: 1, schedule: { kind: 'cron', expr: '0 22 * * *', tz: 'Asia/Shanghai' }, agentId: 'agt_daily-thought-agent', state: {} }],
    occurrences: [], fences: {},
  }, null, 2)}\n`)
  writeFileSync(`${join(storeDir, 'jobs.json')}.upgrade-v2.json`, `${JSON.stringify({ jobMutationSeen: true, upgradedAtMs: 1 })}\n`)
  const events = [
    { ts: Date.parse('2026-09-08T12:00:00Z'), action: 'self_service_mutation', operation: 'disable', jobId: 'b115cb96-8a4f-49be-9baa-519223022b59', operatorAgentId: 'PREWINDOW_SHOULD_NOT_PRINT', secret: 'TOPSECRET' },
    { ts: T(30), action: 'turn_start', occurrenceId: 'occ:x', runId: 'run:x', secret: 'TOPSECRET' },
    { ts: T(29), action: 'occurrence_reserved', occurrenceId: 'occ:x', runId: 'run:x', jobId: 'b115cb96-8a4f-49be-9baa-519223022b59', kind: 'scheduled' },
    { ts: T(28), action: 'outcome', occurrenceId: 'occ:x', runId: 'run:x', state: 'failed', executionOutcome: 'failed', deliveryStatus: 'delivered', reason: 'svc_503_dispatch_refused', jobId: 'b115cb96-8a4f-49be-9baa-519223022b59', secret: 'TOPSECRET' },
    { ts: T(20), action: 'occurrence_reserved', occurrenceId: 'occ:d1', runId: 'run:d1', jobId: 'fa13b0ea-daily', kind: 'scheduled' },
    { ts: T(1), action: 'self_service_mutation', operation: 'disable', jobId: 'b115cb96-8a4f-49be-9baa-519223022b59', operatorAgentId: 'agt_hr-agent', targetAgentId: 'agt_hr-agent', secret: 'TOPSECRET' },
    { ts: T(1), action: 'outcome', occurrenceId: 'occ:otherjob', runId: 'run:o', state: 'succeeded', jobId: 'fa13b0ea' },
    { ts: T(2), action: 'lock_recovery', file: 'jobs.json', secret: 'TOPSECRET' },
  ]
  writeFileSync(join(storeDir, 'runs.jsonl'), `${events.map((e) => JSON.stringify(e)).join('\n')}\n`)
  writeFileSync(join(ctlDir, 'scheduler-watchdog-evidence.jsonl'), `${[
    { ts: T(60), kind: 'w1_run', findingCount: 0, classes: [] },
    { ts: T_FLIP + 5 * 60 * 1000, kind: 'w1_run', findingCount: 1, classes: ['JOB_DISABLED'], notifications: [{ fingerprint: 'JOB_DISABLED|b115cb96', kind: 'new' }] },
  ].map((e) => JSON.stringify(e)).join('\n')}\n`)
  writeFileSync(join(ctlDir, 'alert-state.json'), `${JSON.stringify({ active: { 'JOB_DISABLED|b115cb96-8a4f': { firstSeenAt: T_FLIP + 5 * 60 * 1000, notifiedCount: 1 } }, retired: {} }, null, 2)}\n`)
  writeFileSync(join(logsDir, 'runtime.log'), `noise\n2026-09-09T09:59Z b115cb96 disable via self-service by agt_hr-agent SECRET=TOPSECRET\nnoise\n`)
  writeFileSync(join(logsDir, 'scheduler-watchdog-w1.log'), `[scheduler-watchdog w1] suppressed_or_healthy\n[scheduler-watchdog w1] feishu_sent\n`)
  writeFileSync(join(logsDir, 'scheduler-watchdog-w1.err.log'), `ReferenceError: outcome is not defined\n`)
  writeFileSync(join(root, 'desired-state.json'), `${JSON.stringify({ version: 1, jobs: [{ logicalKey: 'agt_hr-agent:hr-workflow-auto-dispatch', expectedEnabled: true }], _frozenAt: '2026-09-08T12:49:58.745Z' })}\n`)

  const report = collect({
    storePath: join(storeDir, 'jobs.json'),
    runsPath: join(storeDir, 'runs.jsonl'),
    evidencePath: join(ctlDir, 'scheduler-watchdog-evidence.jsonl'),
    alertStatePath: join(ctlDir, 'alert-state.json'),
    stateDir: ctlDir,
    logsDir,
    desiredPath: join(root, 'desired-state.json'),
    secondaryJobPrefix: '34b90173',
    sinceMs: Date.parse('2026-09-09T00:00:00Z'),
    jobPrefix: 'b115cb96',
  })
  const text = render(report)
  const checks = [
    ['flip instant rendered', text.includes(new Date(T_FLIP).toISOString())],
    ['disable operator identified', /DISABLE_EVENT_FOUND=YES .*operator=agt_hr-agent/.test(text)],
    ['failure reason surfaced', text.includes('svc_503_dispatch_refused')],
    ['schedule kind shown', text.includes('"kind":"every"')],
    ['w1 detection shown', text.includes(new Date(T_FLIP + 5 * 60 * 1000).toISOString())],
    ['sidecar rule-out', text.includes('jobMutationSeen=true')],
    ['pre-window event excluded', !text.includes('PREWINDOW_SHOULD_NOT_PRINT')],
    ['secret never rendered', !text.includes('TOPSECRET')],
    ['foreign job event excluded', !text.includes('occ:otherjob')],
    ['log match rendered', text.includes('disable via self-service')],
    ['log secret not rendered', !text.includes('SECRET=TOPSECRET')],
    ['whole-doc anomaly event in scope', text.includes('lock_recovery')],
    ['enabledFieldPresent rendered', text.includes('enabledFieldPresent=true')],
    ['fleet mint census counts both jobs', text.includes('fa13b0ea: 1 reserved') && text.includes('b115cb96: 1 reserved')],
    ['secondary job rendered', text.includes('34b90173-aaaa')],
    ['w1 stdout tail rendered', text.includes('[scheduler-watchdog w1] feishu_sent')],
    ['desired-state readability rendered', text.includes('frozenAt=2026-09-08T12:49:58.745Z')],
  ]
  let failed = 0
  for (const [name, ok] of checks) { process.stdout.write(`  ${ok ? 'PASS' : 'FAIL'} ${name}\n`); if (!ok) failed++ }
  rmSync(root, { recursive: true, force: true })
  if (failed > 0) { process.stderr.write(`SELFTEST FAILED: ${failed}\n`); process.exit(1) }
  process.stdout.write(`SELFTEST PASS (${checks.length} assertions)\n`)
}

if (process.argv.includes('--selftest')) { selftest(); process.exit(0) }
const report = collect({
  storePath: PROD.storePath,
  runsPath: PROD.runsPath,
  evidencePath: PROD.evidencePath,
  alertStatePath: PROD.alertStatePath,
  stateDir: PROD.stateDir,
  logsDir: PROD.logsDir,
  desiredPath: PROD.desiredPath,
  secondaryJobPrefix: PROD.secondaryJobPrefix,
  sinceMs: Date.parse(SINCE_ISO),
  jobPrefix: JOB_PREFIX,
})
process.stdout.write(`${render(report)}\n`)
