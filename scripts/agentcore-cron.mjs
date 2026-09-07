#!/usr/bin/env node
/**
 * agentcore-cron — thin Agent Core scheduler control seam (CLI, V2).
 *
 * Control surface (D-007 §12.2 PRESERVE + C-032):
 *
 *   add        create a job           (openclaw cron add; --logical-key REQUIRED —
 *                                     SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 §5.1:
 *                                     same key + same definition = already-applied
 *                                     no-op, same key + different definition = conflict)
 *   list       list jobs + fence state (openclaw cron list)
 *   runs       occurrence/run evidence (openclaw cron runs --id <id> --limit N)
 *   rm         delete a job           (openclaw cron rm <id>)
 *   enable     enable a job           (openclaw cron enable <id>)
 *   disable    disable a job          (openclaw cron disable <id>)
 *   update     patch mutable fields   (schedule/payload semantic changes bump
 *                                     scheduleRevision — future slots only)
 *   lookup     read-back by --logical-key (canonical reconcile read; exact match)
 *   reconcile  resolve an unresolved outcome_unknown occurrence (C-029)
 *
 * MUTATION STORE GUARD (§4.3): every mutation echoes the resolved store path
 * and FAILS LOUD when AGENTCORE_EXPECTED_STORE is configured and the default
 * ($HOME-derived) resolution misses it — a wrong-$HOME caller can never
 * silently write a non-production store (explicit --store remains the only
 * override).
 *
 * CONTROL-ONLY: this CLI never instantiates the scheduler engine and can
 * never execute a job or run startup catch-up. Every write goes through the
 * SAME control ops the broker self-service surface uses (single mutation
 * semantics — §4.1), under the store's cross-process lock.
 *
 * Store: default $HOME/.agent-core/scheduler/jobs.json, override with
 * AGENTCORE_SCHEDULER_STORE or --store <path>.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { JobStore } from '../packages/scheduler/src/store.js'
import { toPublicJob } from '../packages/scheduler/src/job-model.js'
import { computeNextRunAtMs, parseAtToMs } from '../packages/scheduler/src/schedule.js'
import { deriveJobStateSummary } from '../packages/scheduler/src/eligibility.js'
import {
  disableJobOp,
  enableJobOp,
  updateJobOp,
  deleteJobOp,
  createOrReconcileJobOp,
  findJobByLogicalKey,
  reconcileOccurrence,
} from '../packages/scheduler/src/control.js'

const USAGE = `usage: agentcore-cron <add|list|runs|rm|enable|disable|update|lookup|reconcile> [flags] [--json] [--store <path>]
  add --agent <id> --name <n> --logical-key <owner:key> (--at <t>|--cron <expr> --tz <tz>|--every-ms <n>) --message <text> [--deliver --channel <c> --to <dest>|--no-deliver] [...]
  update <id> [--expected-schedule-revision <n> --expected-updated-at <ms>] [...flags]
  enable|disable|rm <id> [--expected-schedule-revision <n> --expected-updated-at <ms>]
  lookup --logical-key <key>
  reconcile <occurrenceId> --run-id <runId> --to succeeded|failed --note <evidence>`

const MUTATION_COMMANDS = new Set(['add', 'rm', 'enable', 'disable', 'update'])

function storePathFromArgs(args) {
  const idx = args.indexOf('--store')
  if (idx >= 0 && args[idx + 1]) return args[idx + 1]
  if (process.env.AGENTCORE_SCHEDULER_STORE) return process.env.AGENTCORE_SCHEDULER_STORE
  return join(homedir(), '.agent-core', 'scheduler', 'jobs.json')
}

/** §4.3 mutation store guard: echo the resolved store on every mutation and
 *  fail LOUD on a silent wrong-$HOME resolution when the deployment freezes
 *  the canonical expectation (AGENTCORE_EXPECTED_STORE). Explicit --store /
 *  AGENTCORE_SCHEDULER_STORE stay conscious overrides. */
function guardMutationStore(command, args) {
  if (!MUTATION_COMMANDS.has(command)) return
  const resolved = storePathFromArgs(args)
  const expected = process.env.AGENTCORE_EXPECTED_STORE
  const explicit = args.includes('--store') || process.env.AGENTCORE_SCHEDULER_STORE !== undefined
  if (expected !== undefined && !explicit && resolved !== expected) {
    throw new Error(
      `refusing to mutate a non-canonical scheduler store: ${resolved} (deployment expects ${expected}); `
      + `pass --store explicitly if you really mean a different store`,
    )
  }
  process.stderr.write(`[agentcore-cron] ${command} -> store ${resolved}\n`)
}

/** §5.1.4 compare-before-write anchor from the operator CLI. */
function expectedRevisionFromFlags(args) {
  const rev = flagValue(args, '--expected-schedule-revision')
  const updatedAt = flagValue(args, '--expected-updated-at')
  if (rev === undefined && updatedAt === undefined) return undefined
  if (rev === undefined || updatedAt === undefined) {
    throw new Error('--expected-schedule-revision and --expected-updated-at must be given together')
  }
  const scheduleRevision = Number(rev)
  const updatedAtMs = Number(updatedAt)
  if (!Number.isSafeInteger(scheduleRevision) || scheduleRevision < 1
    || !Number.isSafeInteger(updatedAtMs) || updatedAtMs < 1) {
    throw new Error('expected revision flags must be positive integers')
  }
  return { scheduleRevision, updatedAtMs }
}

function flagValue(args, name) {
  const idx = args.indexOf(name)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : undefined
}

function hasFlag(args, name) {
  return args.includes(name)
}

function parseAtFlag(raw) {
  const atMs = parseAtToMs(raw)
  if (atMs === null) throw new Error(`invalid --at value: ${raw} (use ISO instant or relative like 15m)`)
  return new Date(atMs).toISOString()
}

async function cmdAdd(args) {
  const agent = flagValue(args, '--agent')
  const name = flagValue(args, '--name')
  const logicalKey = flagValue(args, '--logical-key')
  const at = flagValue(args, '--at')
  const cronExpr = flagValue(args, '--cron')
  const everyMs = flagValue(args, '--every-ms')
  const message = flagValue(args, '--message')
  if (!agent) throw new Error('--agent is required')
  if (!name) throw new Error('--name is required')
  if (!logicalKey) throw new Error('--logical-key is required (stable logical identity; re-running with the same key and definition is an idempotent no-op)')
  if (!message) throw new Error('--message is required')
  const kinds = [at, cronExpr, everyMs].filter(Boolean).length
  if (kinds !== 1) throw new Error('exactly one of --at | --cron | --every-ms is required')

  const addNowMs = Date.now()
  const schedule = at
    ? { kind: 'at', at: parseAtFlag(at) }
    : cronExpr
      ? { kind: 'cron', expr: cronExpr, ...(flagValue(args, '--tz') ? { tz: flagValue(args, '--tz') } : {}) }
      : { kind: 'every', everyMs: Number(everyMs), anchorMs: addNowMs }

  const payload = { kind: 'agentTurn', message }
  const timeoutSeconds = flagValue(args, '--timeout-seconds')
  if (timeoutSeconds !== undefined) payload.timeoutSeconds = Number(timeoutSeconds)
  if (hasFlag(args, '--light-context')) payload.lightContext = true
  const model = flagValue(args, '--model')
  if (model) payload.model = model

  // --session is accepted for caller compatibility and IGNORED: V2 executes
  // every occurrence in a fresh non-main session (D-006 §10 / C-031).
  if (hasFlag(args, '--session') || flagValue(args, '--session')) {
    process.stderr.write('[agentcore-cron] note: --session is ignored — scheduled execution always uses a fresh non-main session per occurrence (D-006/C-031)\n')
  }

  const store = new JobStore(storePathFromArgs(args))
  let reconciled
  try {
    reconciled = await createOrReconcileJobOp(store, {
      name,
      agentId: agent,
      logicalKey,
      schedule,
      payload,
      ...(hasFlag(args, '--auto-retry') ? { retry: { auto: true } } : {}),
      delivery: resolveDeliveryFlags(args, 'add'),
      deleteAfterRun: hasFlag(args, '--delete-after-run') || schedule.kind === 'at',
    }, { nowMs: addNowMs })
  } catch (error) {
    if (error?.code === 'LOGICAL_KEY_CONFLICT') {
      throw new Error(
        `logical key ${logicalKey} is already bound to job ${error.existingJobId} with a DIFFERENT definition `
        + `(differing: ${Array.isArray(error.differingFields) ? error.differingFields.join(', ') : 'unknown'}); `
        + `resolve with update/rm — no write was performed`,
      )
    }
    throw error
  }
  const publicJob = reconciled.job
  if (reconciled.outcome === 'already_applied') {
    if (hasFlag(args, '--json')) process.stdout.write(`${JSON.stringify(publicJob, null, 2)}\n`)
    else {
      process.stdout.write(`already applied: job ${publicJob.id} (${publicJob.name}) already carries logical key ${logicalKey} with an identical definition — no second job created\n`)
    }
    return publicJob.id
  }
  if (hasFlag(args, '--json')) {
    process.stdout.write(`${JSON.stringify(publicJob, null, 2)}\n`)
  } else {
    const next = publicJob.nextRunAtMs
      ?? computeNextRunAtMs(publicJob.schedule, Date.now(), { jobId: publicJob.id, fallbackAnchorMs: publicJob.createdAtMs })
    process.stdout.write(`created job ${publicJob.id} (${publicJob.name}) for agent ${publicJob.agentId}, next occurrence ${next !== undefined ? new Date(next).toISOString() : '(none)'}\n`)
  }
  return publicJob.id
}


/**
 * Delivery flags (SELF_SERVICE_SCHEDULER_TOOLS_V1 CLI-1/CLI-2):
 * --channel/--to/--best-effort are only valid under --deliver; announce
 * without an explicit target fails LOUD — the ONLY escape is the explicit
 * internal compatibility mode --compat-last-channel, which preserves the
 * legacy target-less {mode:'announce'} shape.
 */
function resolveDeliveryFlags(args, command) {
  const channel = flagValue(args, '--channel')
  const to = flagValue(args, '--to')
  const bestEffort = hasFlag(args, '--best-effort')
  if ((channel !== undefined || to !== undefined || bestEffort) && !hasFlag(args, '--deliver')) {
    throw new Error('--channel/--to/--best-effort are only valid together with --deliver')
  }
  if (!hasFlag(args, '--deliver')) return { mode: 'none', channel: 'last' } // --no-deliver default, like the daemons
  if (hasFlag(args, '--compat-last-channel')) {
    if (channel !== undefined || to !== undefined || bestEffort) {
      throw new Error('--compat-last-channel produces the legacy target-less announce shape; it cannot be combined with --channel/--to/--best-effort')
    }
    return { mode: 'announce' }
  }
  if (channel === undefined || to === undefined) {
    throw new Error(`${command}: --deliver requires an explicit delivery target — pass --channel <channel> --to <destination> (implicit last-channel is forbidden; --compat-last-channel opts into the legacy internal-compat shape)`)
  }
  return { mode: 'announce', channel, to, ...(bestEffort ? { bestEffort: true } : {}) }
}

async function cmdUpdate(args) {
  const id = args.find((a) => !a.startsWith('--'))
  if (!id) throw new Error('job id is required')
  const store = new JobStore(storePathFromArgs(args))
  const doc = await store.loadDoc()
  const current = doc.jobs.find((j) => j.id === id)
  if (!current) throw new Error(`unknown job id: ${id}`)

  const patch = {}
  const name = flagValue(args, '--name')
  if (name !== undefined) patch.name = name

  // Schedule: a full respecification uses the same exactly-one-of rule as
  // add; --tz alone retunes an existing cron schedule. Semantic changes bump
  // scheduleRevision inside updateJobOp (future slots only — never a replay).
  const at = flagValue(args, '--at')
  const cronExpr = flagValue(args, '--cron')
  const everyMs = flagValue(args, '--every-ms')
  const tz = flagValue(args, '--tz')
  const kindCount = [at, cronExpr, everyMs].filter(Boolean).length
  if (kindCount > 1) throw new Error('at most one of --at | --cron | --every-ms may be given')
  const scheduleRequested = kindCount === 1 || tz !== undefined
  if (kindCount === 0 && tz !== undefined && current.schedule.kind !== 'cron') {
    throw new Error('--tz without a new --cron is only valid for cron-scheduled jobs')
  }

  // Payload and partial schedule changes are merged from the locked-current
  // definition below, never this authorization/UX snapshot.
  const message = flagValue(args, '--message')
  const timeoutSeconds = flagValue(args, '--timeout-seconds')
  const lightContext = hasFlag(args, '--light-context')
  const model = flagValue(args, '--model')
  const payloadRequested = message !== undefined || timeoutSeconds !== undefined || lightContext || model !== undefined

  if (hasFlag(args, '--deliver') || hasFlag(args, '--no-deliver')) {
    patch.delivery = hasFlag(args, '--no-deliver')
      ? { mode: 'none', channel: 'last' }
      : resolveDeliveryFlags(args, 'update')
  }

  if (Object.keys(patch).length === 0 && !scheduleRequested && !payloadRequested) {
    throw new Error('nothing to update (pass --name/--message/--timeout-seconds/--model/--light-context/schedule or delivery flags)')
  }

  // updateJobOp already returns the public projection. Partial schedule and
  // payload changes are constructed from the exact definition under its lock.
  // --expected-* flags add the §5.1.4 compare-before-write anchor: a stale
  // operator snapshot is rejected (STALE_TARGET_CONFLICT, zero write).
  const updateNowMs = Date.now()
  let publicJob
  try {
    publicJob = await updateJobOp(store, id, patch, {
      nowMs: updateNowMs,
      expectedRevision: expectedRevisionFromFlags(args),
      buildPatch: (lockedCurrent, basePatch) => {
      const effective = { ...basePatch }
      if (kindCount === 1) {
        effective.schedule = at
          ? { kind: 'at', at: parseAtFlag(at) }
          : cronExpr
            ? { kind: 'cron', expr: cronExpr, ...(tz ? { tz } : lockedCurrent.schedule.kind === 'cron' && lockedCurrent.schedule.tz ? { tz: lockedCurrent.schedule.tz } : {}) }
            : { kind: 'every', everyMs: Number(everyMs), anchorMs: updateNowMs }
      } else if (tz !== undefined) {
        if (lockedCurrent.schedule.kind !== 'cron') {
          throw new Error('--tz without a new --cron is only valid for cron-scheduled jobs')
        }
        effective.schedule = { ...lockedCurrent.schedule, tz }
      }
      if (payloadRequested) {
        const payload = { ...lockedCurrent.payload }
        if (message !== undefined) payload.message = message
        if (timeoutSeconds !== undefined) payload.timeoutSeconds = Number(timeoutSeconds)
        if (lightContext) payload.lightContext = true
        if (model !== undefined) payload.model = model
        effective.payload = payload
      }
      return effective
    },
    })
  } catch (error) {
    if (error?.code === 'STALE_TARGET_CONFLICT') {
      throw new Error(`stale target: ${error.message} — re-read with list and re-apply; no write was performed`)
    }
    throw error
  }
  if (hasFlag(args, '--json')) {
    process.stdout.write(`${JSON.stringify(publicJob, null, 2)}\n`)
  } else {
    process.stdout.write(
      `updated job ${publicJob.id} (scheduleRevision ${publicJob.scheduleRevision})\n`
      + `  schedule: ${JSON.stringify(publicJob.schedule)}\n`
      + `  delivery: ${JSON.stringify(publicJob.delivery)}\n`
      + `  next occurrence: ${publicJob.nextRunAtMs !== undefined ? new Date(publicJob.nextRunAtMs).toISOString() : '(none)'}\n`,
    )
  }
  return publicJob.id
}

async function cmdList(args) {
  const store = new JobStore(storePathFromArgs(args))
  const doc = await store.loadDoc()
  const nowMs = Date.now()
  const rows = doc.jobs.map((job) => {
    const fenced = doc.fences[job.id] !== undefined
    const summary = deriveJobStateSummary(job, doc.occurrences, nowMs)
    return { ...toPublicJob({ ...job, state: summary }), fenced, fence: fenced ? doc.fences[job.id] : undefined }
  })
  if (hasFlag(args, '--json')) {
    process.stdout.write(`${JSON.stringify({ jobs: rows }, null, 2)}\n`)
  } else {
    for (const job of rows) {
      process.stdout.write(`${job.id}\t${job.enabled ? 'enabled ' : 'disabled'}\t${job.fenced ? 'FENCED ' : '       '}\t${job.agentId}\t${job.schedule.kind}\t${job.name}\n`)
    }
  }
  return rows.length
}

async function cmdRuns(args) {
  const id = flagValue(args, '--id')
  const limit = Number(flagValue(args, '--limit') ?? '10')
  const store = new JobStore(storePathFromArgs(args))
  const doc = await store.loadDoc()
  const occurrences = (id === undefined ? doc.occurrences : doc.occurrences.filter((r) => r.jobId === id))
    .slice(-limit)
    .reverse()
  const occurrenceIds = new Set(doc.occurrences.filter((record) => record.jobId === id).map((record) => record.occurrenceId))
  const events = (await store.readRunEvents({ limit: limit * 4 }))
    .filter((event) => id === undefined || event.jobId === id || occurrenceIds.has(event.occurrenceId))
  if (hasFlag(args, '--json')) {
    process.stdout.write(`${JSON.stringify({ occurrences, events }, null, 2)}\n`)
  } else {
    for (const o of occurrences) {
      const nominal = o.nominalScheduledAt ?? o.retryOfOccurrenceId ?? o.catchUpOfNominalAt
      process.stdout.write(
        `${o.occurrenceId}\t${o.runId}\t${o.kind}\t${o.state}${o.lateSettlement ? `->${o.lateSettlement.resolvedTo}(${o.lateSettlement.basis})` : ''}\t`
        + `nominal=${typeof nominal === 'number' ? new Date(nominal).toISOString() : String(nominal ?? '-').slice(0, 24)}\t`
        + `admitted=${new Date(o.admittedAt).toISOString()}\t`
        + `started=${o.startedAt ? new Date(o.startedAt).toISOString() : '-'}\tended=${o.endedAt ? new Date(o.endedAt).toISOString() : '-'}\t`
        + `delivery=${o.deliveryStatus ?? '-'}\tfence=${doc.fences[o.jobId] !== undefined ? 'ACTIVE' : '-'}\n`,
      )
    }
    if (occurrences.length === 0) process.stdout.write('(no occurrences)\n')
  }
}

async function cmdRm(args) {
  const id = args.find((a) => !a.startsWith('--'))
  if (!id) throw new Error('job id is required')
  const store = new JobStore(storePathFromArgs(args))
  try {
    await deleteJobOp(store, id, { expectedRevision: expectedRevisionFromFlags(args) })
  } catch (error) {
    if (error?.code === 'STALE_TARGET_CONFLICT') {
      throw new Error(`stale target: ${error.message} — re-read with list and re-apply; no write was performed`)
    }
    throw error
  }
  process.stdout.write(`deleted job ${id}\n`)
}

async function cmdToggle(args, enabled) {
  const id = args.find((a) => !a.startsWith('--'))
  if (!id) throw new Error('job id is required')
  const store = new JobStore(storePathFromArgs(args))
  let job
  try {
    job = enabled
      ? await enableJobOp(store, id, { nowMs: Date.now(), expectedRevision: expectedRevisionFromFlags(args) })
      : await disableJobOp(store, id, { nowMs: Date.now(), expectedRevision: expectedRevisionFromFlags(args) })
  } catch (error) {
    if (error?.code === 'STALE_TARGET_CONFLICT') {
      throw new Error(`stale target: ${error.message} — re-read with list and re-apply; no write was performed`)
    }
    throw error
  }
  process.stdout.write(`${enabled ? 'enabled' : 'disabled'} job ${job.id} (${job.name})\n`)
}

/**
 * Canonical read-back by logical identity (§5.1.5): exact key match only —
 * no fuzzy or name-based inference. The operator reconcile read.
 */
async function cmdLookup(args) {
  const key = flagValue(args, '--logical-key')
  if (!key) throw new Error('--logical-key is required')
  const store = new JobStore(storePathFromArgs(args))
  const job = await findJobByLogicalKey(store, key)
  if (job === undefined) {
    process.stdout.write(`no job with logical key ${key}\n`)
    return
  }
  if (hasFlag(args, '--json')) {
    process.stdout.write(`${JSON.stringify(job, null, 2)}\n`)
  } else {
    process.stdout.write(
      `${job.id}\t${job.enabled ? 'enabled ' : 'disabled'}\t${job.agentId}\t${JSON.stringify(job.schedule)}\t${job.name}\n`
      + `next occurrence: ${job.nextRunAtMs !== undefined ? new Date(job.nextRunAtMs).toISOString() : '(none)'}\n`,
    )
  }
}

/**
 * Explicit operator reconcile (C-029): resolve an unresolved outcome_unknown
 * occurrence to succeeded|failed with an evidence note. Control-only; the
 * operator identity is captured from the trusted control context (effective
 * OS user) inside the op — never taken from these arguments.
 */
async function cmdReconcile(args) {
  const occurrenceId = args.find((a) => !a.startsWith('--'))
  if (!occurrenceId) throw new Error('occurrence id is required')
  const runId = flagValue(args, '--run-id')
  const resolvedTo = flagValue(args, '--to')
  const note = flagValue(args, '--note')
  if (!runId) throw new Error('--run-id is required')
  if (resolvedTo !== 'succeeded' && resolvedTo !== 'failed') throw new Error('--to must be succeeded|failed')
  if (!note || !note.trim()) throw new Error('--note (evidence) is required')
  if (hasFlag(args, '--operator')) {
    throw new Error('operator identity cannot be self-reported (--operator is untrusted request input; identity comes from the trusted control context)')
  }
  const store = new JobStore(storePathFromArgs(args))
  const result = await reconcileOccurrence(store, { occurrenceId, runId, resolvedTo, evidenceNote: note })
  const identity = result.identity
  process.stdout.write(
    `reconciled ${occurrenceId} -> ${resolvedTo} (basis operator-reconcile)\n`
    + `operator identity: ${identity.username} (uid ${identity.uid}, ${identity.provenance})\n`
    + `fence remaining on job ${result.record.jobId}: ${result.fenceRemaining ? 'ACTIVE (other unresolved unknowns)' : 'released'}\n`
    + `evidence append: ${result.evidenceStatus.ok ? 'durable' : `FAILED (${result.evidenceStatus.error})`}\n`,
  )
}

const COMMANDS = {
  add: cmdAdd,
  list: cmdList,
  runs: cmdRuns,
  rm: cmdRm,
  enable: (a) => cmdToggle(a, true),
  disable: (a) => cmdToggle(a, false),
  update: cmdUpdate,
  lookup: cmdLookup,
  reconcile: cmdReconcile,
}

async function main() {
  const argv = process.argv.slice(2)
  const command = argv[0]
  if (!command || !COMMANDS[command]) {
    process.stderr.write(`${USAGE}\n`)
    process.exit(2)
  }
  try {
    guardMutationStore(command, argv.slice(1))
    await COMMANDS[command](argv.slice(1))
  } catch (error) {
    process.stderr.write(`[agentcore-cron] ${command} failed: ${error?.message ?? error}\n`)
    process.exit(1)
  }
}

main()
