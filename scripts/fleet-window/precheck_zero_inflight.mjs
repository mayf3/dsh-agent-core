#!/usr/bin/env node
// Read-only preflight; per AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const DEFAULT_TURNS = '/Users/authsvc/.agent-core/control/turn-recovery-v3.json'
const DEFAULT_JOBS = '/Users/authsvc/.agent-core/scheduler/jobs.json'
const LISTS = ['inflightTurns', 'unresolvedLostTurns', 'inflightOccurrences']

function metadata(file) {
  const stat = lstatSync(file, { bigint: true })
  if (!stat.isFile()) throw new Error(`census input is not a regular file: ${file}`)
  return ['dev', 'ino', 'mode', 'uid', 'gid', 'size', 'mtimeNs', 'ctimeNs']
    .map(key => String(stat[key])).join(':')
}

function snapshot(file) {
  const before = metadata(file)
  const bytes = readFileSync(file)
  if (metadata(file) !== before) throw new Error(`census input changed during read: ${file}`)
  return { metadata: before, sha256: createHash('sha256').update(bytes).digest('hex'), bytes }
}

function unavailable(error) {
  return { report: { inflightTurns: null, unresolvedLostTurns: null, inflightOccurrences: null,
    status: 'UNKNOWN', error: error instanceof Error ? error.message : String(error) }, exitCode: 1 }
}

export async function precheckZeroInflight({ sourceRoot,
  turnRecoveryStore = DEFAULT_TURNS, jobsStore = DEFAULT_JOBS } = {}) {
  try {
    if (![sourceRoot, turnRecoveryStore, jobsStore].every(value => typeof value === 'string' && isAbsolute(value))) {
      throw new Error('source-root and both store paths must be absolute')
    }
    const { readRestartDrainCensus } = await import(pathToFileURL(join(sourceRoot,
      'packages/production-runtime/src/scheduler/restart-drain.js')).href)
    const paths = [turnRecoveryStore, jobsStore]
    const before = paths.map(snapshot)
    const turns = JSON.parse(before[0].bytes.toString('utf8'))
    const jobs = JSON.parse(before[1].bytes.toString('utf8'))
    // The shared reader treats missing files/occurrences as empty; this
    // standalone gate requires both inputs to exist and carry their schema.
    if (typeof turns?.runtimeEpoch !== 'string' || turns.runtimeEpoch === '') {
      throw new Error('recovery epoch unavailable')
    }
    if (!Array.isArray(jobs?.occurrences)) throw new Error('scheduler occurrences schema absent')
    const census = readRestartDrainCensus({ turnRecoveryStore, jobsStore })
    const after = paths.map(snapshot)
    if (before.some((entry, index) => entry.metadata !== after[index].metadata
      || entry.sha256 !== after[index].sha256)) throw new Error('census stores changed during read')
    if (census.epoch !== turns.runtimeEpoch || !LISTS.every(key => Array.isArray(census[key]))) {
      throw new Error('census epoch or lists unavailable')
    }
    const report = Object.fromEntries(LISTS.map(key => [key, census[key]]))
    return { report, exitCode: LISTS.every(key => report[key].length === 0) ? 0 : 1 }
  } catch (error) {
    return unavailable(error)
  }
}

async function main() {
  try {
    const { values } = parseArgs({ options: {
      'source-root': { type: 'string' },
      'turn-recovery-store': { type: 'string' },
      'jobs-store': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    } })
    if (values.help) {
      console.log('Usage: precheck_zero_inflight.mjs --source-root /absolute/source-root [--turn-recovery-store /absolute/fixture.json] [--jobs-store /absolute/jobs.json]')
      console.log('Read-only. Three empty lists: exit 0; nonempty or unavailable census (UNKNOWN): exit 1.')
      return
    }
    const { report, exitCode } = await precheckZeroInflight({ sourceRoot: values['source-root'],
      turnRecoveryStore: values['turn-recovery-store'], jobsStore: values['jobs-store'] })
    console.log(JSON.stringify(report))
    process.exitCode = exitCode
  } catch (error) {
    const { report, exitCode } = unavailable(error)
    console.log(JSON.stringify(report))
    process.exitCode = exitCode
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
