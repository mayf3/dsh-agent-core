#!/usr/bin/env node
/**
 * agentcore-cron — thin Agent Core scheduler control seam (CLI, V2).
 *
 * Control surface (D-007 §12.2 PRESERVE + C-032):
 *
 *   add        create a job           (openclaw cron add)
 *   list       list jobs + fence state (openclaw cron list)
 *   runs       occurrence/run evidence (openclaw cron runs --id <id> --limit N)
 *   rm         delete a job           (openclaw cron rm <id>)
 *   enable     enable a job           (openclaw cron enable <id>)
 *   disable    disable a job          (openclaw cron disable <id>)
 *   reconcile  resolve an unresolved outcome_unknown occurrence (C-029)
 *
 * CONTROL-ONLY: this CLI never instantiates the scheduler engine and can
 * never execute a job or run startup catch-up. Every write goes through the
 * store's locked read-modify-write (single mutation authority), re-reading
 * the LATEST document under the cross-process lock.
 *
 * `runs` shows the OCCURRENCE dimension (occurrenceId / runId / state incl.
 * outcome_unknown / kind / nominal / admitted / started / ended /
 * deliveryStatus / lateSettlement / fence) — not just job-level status.
 * `reconcile` is the explicit operator command: identity comes from the
 * trusted control context (effective OS user), never from request input.
 *
 * Store: default $HOME/.agent-core/scheduler/jobs.json, override with
 * AGENTCORE_SCHEDULER_STORE or --store <path>.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { JobStore } from '../packages/scheduler/src/store.js'
import { normalizeJob, toPublicJob } from '../packages/scheduler/src/job-model.js'
import { computeNextRunAtMs, parseAtToMs } from '../packages/scheduler/src/schedule.js'
import { deriveJobStateSummary } from '../packages/scheduler/src/eligibility.js'
import { disableJobOp, enableJobOp, updateJobOp, reconcileOccurrence } from '../packages/scheduler/src/control.js'

const USAGE = `usage: agentcore-cron <add|list|runs|rm|enable|disable|update|reconcile> [flags] [--json] [--store <path>]
  add --deliver --channel <channel> --to <destination> [--best-effort]   (explicit delivery target)
  update <id> [--name --message --timeout-seconds --model --light-context --cron/--at/--every-ms/--tz --deliver/--no-deliver ...]
  reconcile <occurrenceId> --run-id <runId> --to succeeded|failed --note <evidence>`

function storePathFromArgs(args) {
  const idx = args.indexOf('--store')
  if (idx >= 0 && args[idx + 1]) return args[idx + 1]
  if (process.env.AGENTCORE_SCHEDULER_STORE) return process.env.AGENTCORE_SCHEDULER_STORE
  return join(homedir(), '.agent-core', 'scheduler', 'jobs.json')
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
  const at = flagValue(args, '--at')
  const cronExpr = flagValue(args, '--cron')
  const everyMs = flagValue(args, '--every-ms')
  const message = flagValue(args, '--message')
  if (!agent) throw new Error('--agent is required')
  if (!name) throw new Error('--name is required')
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
  const job = normalizeJob({
    name,
    agentId: agent,
    schedule,
    payload,
    ...(hasFlag(args, '--auto-retry') ? { retry: { auto: true } } : {}),
    delivery: resolveDeliveryFlags(args, 'add'),
    deleteAfterRun: hasFlag(args, '--delete-after-run') || schedule.kind === 'at',
  })
  const { value: created } = await store.mutate((jobs) => {
    jobs.push(job)
    return { value: job }
  })
  const publicJob = toPublicJob(created)
  if (hasFlag(args, '--json')) {
    process.stdout.write(`${JSON.stringify(publicJob, null, 2)}\n`)
  } else {
    const next = publicJob.nextRunAtMs
      ?? computeNextRunAtMs(job.schedule, Date.now(), { jobId: job.id, fallbackAnchorMs: job.createdAtMs })
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
  const updateNowMs = Date.now()
  const publicJob = await updateJobOp(store, id, patch, {
    nowMs: updateNowMs,
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
  await store.mutateDoc((doc) => {
    const idx = doc.jobs.findIndex((j) => j.id === id)
    if (idx < 0) throw new Error(`unknown job id: ${id}`)
    doc.jobs.splice(idx, 1) // definition only — occurrence/run evidence persists
  })
  process.stdout.write(`deleted job ${id}\n`)
}

async function cmdToggle(args, enabled) {
  const id = args.find((a) => !a.startsWith('--'))
  if (!id) throw new Error('job id is required')
  const store = new JobStore(storePathFromArgs(args))
  const job = enabled
    ? await enableJobOp(store, id, { nowMs: Date.now() })
    : await disableJobOp(store, id, { nowMs: Date.now() })
  process.stdout.write(`${enabled ? 'enabled' : 'disabled'} job ${job.id} (${job.name})\n`)
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
    await COMMANDS[command](argv.slice(1))
  } catch (error) {
    process.stderr.write(`[agentcore-cron] ${command} failed: ${error?.message ?? error}\n`)
    process.exit(1)
  }
}

main()
