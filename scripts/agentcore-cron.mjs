#!/usr/bin/env node
/**
 * agentcore-cron — thin Agent Core scheduler submission seam (CLI).
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
 * `add` accepts the exact flag surface used by forum-scheduler.sh and
 * unified-dispatcher.py:
 *
 *   --agent <id> --name <name> --at <15m|ISO> --message <text>
 *   [--cron '<expr>'] [--tz <tz>] [--every-ms <n>] [--light-context]
 *   [--no-deliver | --deliver] [--session isolated|main] [--timeout-seconds n]
 *   [--delete-after-run] [--model <model>] [--json]
 *
 * Store: default $HOME/.agent-core/scheduler/jobs.json, override with
 * AGENTCORE_SCHEDULER_STORE or --store <path>. The engine opens the same
 * file through the same atomic write protocol as the Control Plane
 * (single-writer assumption, decision D-005).
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { Scheduler } from '../packages/scheduler/src/scheduler.js'
import { JobStore } from '../packages/scheduler/src/store.js'
import { createNoopInvoker, createRecordingDelivery } from '../packages/scheduler/src/seams.js'
import { parseAtToMs } from '../packages/scheduler/src/schedule.js'

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

async function openScheduler(args) {
  const store = new JobStore(storePathFromArgs(args))
  const scheduler = new Scheduler({
    store,
    invoker: createNoopInvoker(),
    deliver: createRecordingDelivery(),
    log: { info: () => {}, warn: () => {}, error: (m) => process.stderr.write(`[agentcore-cron] ${m}\n`) },
  })
  await scheduler.start({ autoStart: false })
  return scheduler
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

  const scheduler = await openScheduler(args)
  try {
    const job = await scheduler.createJob({
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
    if (hasFlag(args, '--json')) {
      process.stdout.write(`${JSON.stringify(job, null, 2)}\n`)
    } else {
      process.stdout.write(`created job ${job.id} (${job.name}) for agent ${job.agentId}, next run ${new Date(job.nextRunAtMs).toISOString()}\n`)
    }
    return job.id
  } finally {
    await scheduler.stop()
  }
}

async function cmdList(args) {
  const scheduler = await openScheduler(args)
  try {
    const jobs = await scheduler.listJobs()
    if (hasFlag(args, '--json')) {
      process.stdout.write(`${JSON.stringify({ jobs }, null, 2)}\n`)
    } else {
      for (const job of jobs) {
        process.stdout.write(`${job.id}\t${job.enabled ? 'enabled ' : 'disabled'}\t${job.agentId}\t${job.schedule.kind}\t${job.name}\n`)
      }
    }
    return jobs.length
  } finally {
    await scheduler.stop()
  }
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
  const scheduler = await openScheduler(args)
  try {
    await scheduler.deleteJob(id)
    process.stdout.write(`deleted job ${id}\n`)
  } finally {
    await scheduler.stop()
  }
}

async function cmdToggle(args, enabled) {
  const id = args.find((a) => !a.startsWith('--'))
  if (!id) throw new Error('job id is required')
  const scheduler = await openScheduler(args)
  try {
    const job = enabled ? await scheduler.enableJob(id) : await scheduler.disableJob(id)
    process.stdout.write(`${enabled ? 'enabled' : 'disabled'} job ${job.id} (${job.name})\n`)
  } finally {
    await scheduler.stop()
  }
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
