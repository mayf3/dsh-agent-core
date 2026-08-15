#!/usr/bin/env node
/**
 * agentcore-cron — thin Agent Core scheduler control seam (CLI).
 *
 * Drop-in replacement for the `openclaw cron` surface that the external
 * daemons and operator scripts actually call on this machine:
 *
 *   add       create a job           (openclaw cron add)
 *   list      list jobs              (openclaw cron list)
 *   runs      read the run log       (openclaw cron runs --id <id> --limit N)
 *   rm        delete a job           (openclaw cron rm <id>)
 *   enable    enable a job           (openclaw cron enable <id>)
 *   disable   disable a job          (openclaw cron disable <id>)
 *
 * CONTROL-ONLY (audit FIX 2): this CLI never instantiates the scheduler
 * engine and can never execute a job or run startup catch-up. `add`/`rm`/
 * `enable`/`disable` go through the store's locked read-modify-write
 * (`JobStore.mutate`), so they re-read the LATEST store under the
 * cross-process lock and can never clobber the resident Scheduler's state
 * (audit FIX 3).
 *
 * `add` accepts the exact flag surface used by forum-scheduler.sh and
 * unified-dispatcher.py:
 *
 *   --agent <id> --name <name> --at <15m|ISO> --message <text>
 *   [--cron '<expr>'] [--tz <tz>] [--every-ms <n>] [--light-context]
 *   [--no-deliver | --deliver] [--session isolated|main] [--timeout-seconds n]
 *   [--delete-after-run] [--model <model>] [--json]
 *
 * Store: default $HOME/.agent-core/scheduler/jobs.json, override with
 * AGENTCORE_SCHEDULER_STORE or --store <path>.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { JobStore } from '../packages/scheduler/src/store.js'
import { normalizeJob, toPublicJob } from '../packages/scheduler/src/job-model.js'
import { computeNextRunAtMs, parseAtToMs } from '../packages/scheduler/src/schedule.js'

const USAGE = `usage: agentcore-cron <add|list|runs|rm|enable|disable> [flags] [--json] [--store <path>]`

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

  const schedule = at
    ? { kind: 'at', at: parseAtFlag(at) }
    : cronExpr
      ? { kind: 'cron', expr: cronExpr, ...(flagValue(args, '--tz') ? { tz: flagValue(args, '--tz') } : {}) }
      : { kind: 'every', everyMs: Number(everyMs) }

  const payload = { kind: 'agentTurn', message }
  const timeoutSeconds = flagValue(args, '--timeout-seconds')
  if (timeoutSeconds !== undefined) payload.timeoutSeconds = Number(timeoutSeconds)
  if (hasFlag(args, '--light-context')) payload.lightContext = true
  const model = flagValue(args, '--model')
  if (model) payload.model = model

  const store = new JobStore(storePathFromArgs(args))
  const job = normalizeJob({
    name,
    agentId: agent,
    schedule,
    payload,
    sessionTarget: flagValue(args, '--session') ?? 'isolated',
    delivery: hasFlag(args, '--deliver')
      ? { mode: 'announce' }
      : { mode: 'none', channel: 'last' }, // --no-deliver default, like the daemons
    deleteAfterRun: hasFlag(args, '--delete-after-run') || schedule.kind === 'at',
  })
  if (job.enabled && job.state.nextRunAtMs === undefined) {
    job.state.nextRunAtMs = computeNextRunAtMs(job.schedule, Date.now(), { jobId: job.id })
  }
  const { value: created } = await store.mutate((jobs) => {
    jobs.push(job)
    return { value: job }
  })
  const publicJob = toPublicJob(created)
  if (hasFlag(args, '--json')) {
    process.stdout.write(`${JSON.stringify(publicJob, null, 2)}\n`)
  } else {
    process.stdout.write(`created job ${publicJob.id} (${publicJob.name}) for agent ${publicJob.agentId}, next run ${new Date(publicJob.nextRunAtMs).toISOString()}\n`)
  }
  return publicJob.id
}

async function cmdList(args) {
  const store = new JobStore(storePathFromArgs(args))
  const jobs = (await store.load()).map(toPublicJob)
  if (hasFlag(args, '--json')) {
    process.stdout.write(`${JSON.stringify({ jobs }, null, 2)}\n`)
  } else {
    for (const job of jobs) {
      process.stdout.write(`${job.id}\t${job.enabled ? 'enabled ' : 'disabled'}\t${job.agentId}\t${job.schedule.kind}\t${job.name}\n`)
    }
  }
  return jobs.length
}

async function cmdRuns(args) {
  const id = flagValue(args, '--id')
  if (!id) throw new Error('--id is required')
  const limit = Number(flagValue(args, '--limit') ?? '10')
  const store = new JobStore(storePathFromArgs(args))
  const entries = (await store.readRunEvents({ limit }))
    .filter((e) => e.jobId === id)
    .reverse()
  if (hasFlag(args, '--json')) {
    process.stdout.write(`${JSON.stringify({ entries }, null, 2)}\n`)
  } else {
    for (const e of entries) {
      process.stdout.write(`${e.action}\t${e.status ?? ''}\t${new Date(e.ts).toISOString()}\t${e.durationMs ?? ''}ms\n`)
    }
  }
}

async function cmdRm(args) {
  const id = args.find((a) => !a.startsWith('--'))
  if (!id) throw new Error('job id is required')
  const store = new JobStore(storePathFromArgs(args))
  await store.mutate((jobs) => {
    const idx = jobs.findIndex((j) => j.id === id)
    if (idx < 0) throw new Error(`unknown job id: ${id}`)
    jobs.splice(idx, 1)
  })
  process.stdout.write(`deleted job ${id}\n`)
}

async function cmdToggle(args, enabled) {
  const id = args.find((a) => !a.startsWith('--'))
  if (!id) throw new Error('job id is required')
  const store = new JobStore(storePathFromArgs(args))
  const job = await store.mutate((jobs) => {
    const target = jobs.find((j) => j.id === id)
    if (!target) throw new Error(`unknown job id: ${id}`)
    target.enabled = enabled
    if (!enabled) {
      target.state.nextRunAtMs = undefined
      target.state.runningAtMs = undefined
    }
    return { value: toPublicJob(target) }
  })
  process.stdout.write(`${enabled ? 'enabled' : 'disabled'} job ${job.id} (${job.name})\n`)
}

const COMMANDS = {
  add: cmdAdd,
  list: cmdList,
  runs: cmdRuns,
  rm: cmdRm,
  enable: (a) => cmdToggle(a, true),
  disable: (a) => cmdToggle(a, false),
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
